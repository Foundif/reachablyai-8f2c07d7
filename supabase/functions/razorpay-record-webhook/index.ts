// Receives Razorpay "payment_link.paid" events from a client's OWN Razorpay account,
// re-verifies the link with that client's keys, marks the booking paid and sends the
// confirmation back on the same WhatsApp chat the booking came from.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: true, info: 'Reachably Razorpay booking webhook' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const raw = await req.text();
  let evt: any;
  try { evt = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const event = String(evt?.event || '');
  if (event !== 'payment_link.paid') return json({ ok: true, ignored: event || 'unknown' });

  const linkId = evt?.payload?.payment_link?.entity?.id;
  const paymentId = evt?.payload?.payment?.entity?.id || null;
  if (!linkId || typeof linkId !== 'string' || !/^plink_[A-Za-z0-9]+$/.test(linkId)) {
    return json({ error: 'Missing payment link id' }, 400);
  }

  const { data: pay } = await admin.from('record_payments').select('*').eq('razorpay_link_id', linkId).maybeSingle();
  if (!pay) return json({ ok: true, ignored: 'unknown link' });
  if (pay.status === 'paid') return json({ ok: true, duplicate: true });

  // Client's own Razorpay keys
  const { data: integ } = await admin.from('integrations').select('settings')
    .eq('workspace_id', pay.workspace_id).eq('provider', 'razorpay').maybeSingle();
  const s = (integ?.settings as any) || {};
  if (!s.key_id || !s.key_secret) return json({ error: 'Razorpay not connected for this workspace' }, 400);

  // Optional signature check when the client saved a webhook secret
  if (s.webhook_secret) {
    const given = req.headers.get('x-razorpay-signature') || '';
    const expected = await hmacHex(String(s.webhook_secret), raw);
    if (given !== expected) return json({ error: 'Bad signature' }, 401);
  }

  // Always re-confirm with Razorpay itself — never trust the webhook body alone
  const check = await fetch(`https://api.razorpay.com/v1/payment_links/${linkId}`, {
    headers: { Authorization: `Basic ${btoa(`${s.key_id}:${s.key_secret}`)}` },
  });
  const link = await check.json().catch(() => ({}));
  if (!check.ok || link?.status !== 'paid') {
    console.error('Razorpay link not confirmed', check.status, link);
    return json({ error: 'Payment link is not paid on Razorpay', status: link?.status || check.status }, 400);
  }

  const now = new Date().toISOString();
  const paidAmount = Number(link.amount_paid ? link.amount_paid / 100 : pay.amount);

  await admin.from('record_payments').update({
    status: 'paid', razorpay_payment_id: paymentId || link?.payments?.[0]?.payment_id || null, updated_at: now,
  }).eq('id', pay.id);

  const { data: rec } = await admin.from('business_records').select('*').eq('id', pay.record_id).maybeSingle();
  if (!rec) return json({ ok: true, warning: 'record missing' });

  const totalPaid = Number(rec.paid_amount || 0) + paidAmount;
  const total = Number(rec.amount || 0);
  const fullyPaid = total > 0 ? totalPaid >= total : pay.kind !== 'advance';
  const balance = Math.max(0, total - totalPaid);

  let status = rec.status;
  if (['new', 'pending_payment'].includes(rec.status)) status = fullyPaid ? 'confirmed' : 'advance_paid';

  await admin.from('business_records').update({
    paid_amount: totalPaid,
    payment_status: fullyPaid ? 'paid' : 'partially_paid',
    status,
    updated_at: now,
  }).eq('id', rec.id);

  await admin.from('record_timeline').insert({
    record_id: rec.id, workspace_id: rec.workspace_id, event: 'payment_received',
    detail: `${pay.kind} ${inr(paidAmount)} paid via Razorpay${paymentId ? ` (${paymentId})` : ''}`,
    actor_name: 'Razorpay',
  });

  // ---- Confirmation on the same WhatsApp chat that booked ----
  try {
    let to: string | null = null;
    if (rec.conversation_id) {
      const { data: conv } = await admin.from('wa_conversations').select('contact_phone').eq('id', rec.conversation_id).maybeSingle();
      to = conv?.contact_phone || null;
    }
    if (!to) to = String(rec.customer_phone || '').replace(/\D/g, '') || null;

    const { data: creds } = await admin.from('whatsapp_credentials')
      .select('business_phone, access_token, phone_number_id')
      .eq('workspace_id', rec.workspace_id).order('is_primary', { ascending: false }).limit(1).maybeSingle();

    if (to && creds?.access_token && creds?.phone_number_id) {
      const text = fullyPaid
        ? `✅ Payment received — ${inr(paidAmount)}\nBooking ${rec.record_code} is fully paid. Thank you!`
        : `✅ Advance received — ${inr(paidAmount)}\nYour booking ${rec.record_code} is confirmed.${balance > 0 ? `\n\nBalance ${inr(balance)} is payable at the end of the service.` : ''}\n\nOur team will share your helper details before the service.`;

      const resp = await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
      });
      const rb = await resp.json().catch(() => ({}));
      if (rec.conversation_id) {
        await admin.from('wa_messages').insert({
          workspace_id: rec.workspace_id, conversation_id: rec.conversation_id, direction: 'outbound',
          wa_message_id: rb?.messages?.[0]?.id || null, from_phone: creds.business_phone, to_phone: to,
          body: text, message_type: 'text', status: resp.ok ? 'sent' : 'failed',
          error: resp.ok ? null : (rb?.error?.message || `HTTP ${resp.status}`),
        });
        if (resp.ok) {
          await admin.from('wa_conversations').update({
            last_message_at: now, last_message_text: text.slice(0, 200), last_message_direction: 'outbound',
          }).eq('id', rec.conversation_id);
        }
      }
      await admin.from('record_timeline').insert({
        record_id: rec.id, workspace_id: rec.workspace_id, event: resp.ok ? 'confirmation_sent' : 'confirmation_failed',
        detail: resp.ok ? `WhatsApp confirmation sent to ${to}` : (rb?.error?.message || `HTTP ${resp.status}`),
        actor_name: 'System',
      });
    }
  } catch (e) {
    console.error('confirmation send failed', e);
  }

  return json({ ok: true, record: rec.record_code, status, payment_status: fullyPaid ? 'paid' : 'partially_paid' });
});

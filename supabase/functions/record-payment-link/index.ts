import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { record_id, kind = 'advance', amount } = await req.json();
    if (!record_id) return json({ error: 'record_id required' }, 400);

    const { data: rec } = await admin.from('business_records').select('*').eq('id', record_id).maybeSingle();
    if (!rec) return json({ error: 'Record not found' }, 404);

    const { data: mem } = await admin.from('workspace_members')
      .select('user_id').eq('workspace_id', rec.workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);

    const amt = Number(amount ?? (kind === 'advance' ? rec.advance_amount : rec.amount));
    if (!amt || amt < 1) return json({ error: 'Enter a valid amount' }, 400);
    if (!rec.customer_phone) return json({ error: 'This record has no customer phone number' }, 400);

    // Workspace-owned Razorpay keys (Integrations → Razorpay)
    const { data: integ } = await admin.from('integrations').select('settings,status')
      .eq('workspace_id', rec.workspace_id).eq('provider', 'razorpay').maybeSingle();
    const key_id = (integ?.settings as any)?.key_id;
    const key_secret = (integ?.settings as any)?.key_secret;
    if (!key_id || !key_secret) {
      return json({ error: 'Connect your Razorpay account in Integrations first.' }, 400);
    }

    const auth = btoa(`${key_id}:${key_secret}`);
    const phone = String(rec.customer_phone).replace(/\D/g, '');
    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amt * 100),
        currency: 'INR',
        description: `${kind === 'advance' ? 'Advance' : kind === 'balance' ? 'Balance' : 'Payment'} - ${rec.record_code}`,
        reference_id: `${rec.record_code}-${kind}-${Date.now()}`.slice(0, 39),
        customer: {
          name: rec.customer_name || 'Customer',
          contact: phone.length >= 10 ? `+${phone}` : undefined,
          email: rec.customer_email || undefined,
        },
        notify: { sms: false, email: false },
        reminder_enable: true,
        notes: { record_id: rec.id, workspace_id: rec.workspace_id, kind },
      }),
    });
    const body = await res.json();
    if (!res.ok || !body?.short_url) {
      console.error('Razorpay payment link failed', res.status, body);
      return json({ error: body?.error?.description || 'Razorpay rejected the payment link' }, 400);
    }

    await admin.from('record_payments').insert({
      record_id: rec.id,
      workspace_id: rec.workspace_id,
      kind,
      amount: amt,
      status: 'link_sent',
      payment_link: body.short_url,
      razorpay_link_id: body.id,
      created_by: user.id,
    });

    await admin.from('business_records').update({
      payment_status: 'link_sent',
      status: rec.status === 'new' ? 'pending_payment' : rec.status,
      updated_at: new Date().toISOString(),
    }).eq('id', rec.id);

    await admin.from('record_timeline').insert({
      record_id: rec.id,
      workspace_id: rec.workspace_id,
      event: 'payment_link_created',
      detail: `${kind} ₹${amt} — ${body.short_url}`,
      actor_id: user.id,
      actor_name: user.email || null,
    });

    return json({ ok: true, link: body.short_url, amount: amt, kind });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

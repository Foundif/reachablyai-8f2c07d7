import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Meta webhook. Configure in Meta App > WhatsApp > Configuration:
// Callback URL: https://<project>.supabase.co/functions/v1/whatsapp-webhook
// Verify token: matches WA_WEBHOOK_VERIFY_TOKEN secret (or 'reachably' default)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Verification handshake
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = Deno.env.get('WA_WEBHOOK_VERIFY_TOKEN') || 'TheAurax@dmin2027';
    if (mode === 'subscribe' && token === expected) return new Response(challenge || 'ok', { status: 200 });
    return new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  try {
    const payload = await req.json();
    const entries = payload?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const v = change.value || {};
        const phoneId = v.metadata?.phone_number_id;
        if (!phoneId) continue;

        // Find workspace by phone_number_id
        const { data: creds } = await admin.from('whatsapp_credentials').select('workspace_id, business_phone').eq('phone_number_id', phoneId).maybeSingle();
        if (!creds) continue;
        const workspace_id = creds.workspace_id;

        // Inbound messages
        for (const m of v.messages || []) {
          const from = m.from as string;
          const contactName = v.contacts?.[0]?.profile?.name || null;
          const bodyText =
            m.text?.body ||
            m.button?.text ||
            m.interactive?.button_reply?.title ||
            m.interactive?.list_reply?.title ||
            (m.image ? '[image]' : m.audio ? '[audio]' : m.document ? '[document]' : m.video ? '[video]' : m.type);

          // Upsert conversation
          const { data: existing } = await admin.from('wa_conversations')
            .select('id, unread_count').eq('workspace_id', workspace_id).eq('contact_phone', from).maybeSingle();

          let convId: string;
          if (existing) {
            convId = existing.id;
            await admin.from('wa_conversations').update({
              contact_name: contactName || undefined,
              last_message_at: new Date().toISOString(),
              last_message_text: (bodyText || '').slice(0, 200),
              last_message_direction: 'inbound',
              unread_count: (existing.unread_count || 0) + 1,
              window_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
              status: 'open',
            }).eq('id', convId);
          } else {
            const { data: created } = await admin.from('wa_conversations').insert({
              workspace_id, contact_phone: from, contact_name: contactName,
              last_message_text: (bodyText || '').slice(0, 200),
              last_message_direction: 'inbound', unread_count: 1,
              window_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            }).select('id').single();
            convId = created!.id;
          }

          // Deduplicate by wa_message_id
          const { data: dup } = await admin.from('wa_messages').select('id').eq('wa_message_id', m.id).maybeSingle();
          if (dup) continue;

          await admin.from('wa_messages').insert({
            workspace_id, conversation_id: convId, direction: 'inbound',
            wa_message_id: m.id, from_phone: from, to_phone: creds.business_phone,
            body: bodyText, message_type: m.type || 'text', status: 'received',
          });

          // Fire automations (keyword_match)
          try {
            const { data: autos } = await admin.from('automations')
              .select('*').eq('workspace_id', workspace_id).eq('enabled', true).eq('trigger_type', 'keyword_match');
            for (const a of autos || []) {
              const kw = (a.trigger_config?.keyword || '').toLowerCase();
              if (kw && (bodyText || '').toLowerCase().includes(kw)) {
                await admin.from('automation_runs').insert({
                  workspace_id, automation_id: a.id, status: 'matched',
                  context: { message: bodyText, from },
                });
                await admin.from('automations').update({
                  run_count: (a.run_count || 0) + 1, last_run_at: new Date().toISOString(),
                }).eq('id', a.id);
              }
            }
          } catch (_) { /* non-fatal */ }
        }

        // Status callbacks
        for (const s of v.statuses || []) {
          await admin.from('wa_messages').update({ status: s.status }).eq('wa_message_id', s.id);
          // Campaign recipient status
          const map: Record<string, any> = { sent: {}, delivered: { delivered_count: 1 }, read: { read_count: 1 }, failed: { failed_count: 1 } };
          await admin.from('campaign_recipients').update({ status: s.status }).eq('meta_message_id', s.id);
        }
      }
    }
    return json({ ok: true });
  } catch (e) {
    console.error('webhook error', e);
    return json({ error: String(e) }, 500);
  }
});

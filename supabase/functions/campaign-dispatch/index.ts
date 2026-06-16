import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) return new Response(JSON.stringify({ error: 'campaign_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: campaign } = await supabase.from('tn_campaigns').select('*').eq('id', campaign_id).maybeSingle();
    if (!campaign) return new Response(JSON.stringify({ error: 'campaign not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Authorize: requester role must allow campaign.publish
    const authz = req.headers.get('Authorization') || '';
    const token = authz.replace('Bearer ', '');
    if (token) {
      const { data: u } = await supabase.auth.getUser(token);
      if (u?.user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle();
        const role = prof?.role || 'freelancer';
        const allowed = ['owner','admin','freelancer'].includes(role);
        if (!allowed) return new Response(JSON.stringify({ error: 'Forbidden — your role cannot publish campaigns.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { data: settings } = await supabase.from('tn_settings').select('meta_phone_number_id, meta_template_language').eq('user_id', campaign.user_id).maybeSingle();
    const templateName = (campaign.audience_snapshot as any)?.template_name;
    const phoneNumberId = settings?.meta_phone_number_id;
    const metaToken = Deno.env.get('META_ACCESS_TOKEN');
    if (!templateName) return new Response(JSON.stringify({ error: 'Select an approved Meta template before publishing this campaign.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!phoneNumberId || !metaToken) return new Response(JSON.stringify({ error: 'WhatsApp sending is not configured.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let customersQ = supabase.from('tn_customers').select('id, wa_id').eq('user_id', campaign.user_id);
    const aud = (campaign.audience_snapshot as any)?.type;
    if (aud === 'recent') customersQ = customersQ.gte('last_seen_at', new Date(Date.now() - 30 * 86400000).toISOString());
    if (aud === 'inactive') customersQ = customersQ.lt('last_seen_at', new Date(Date.now() - 45 * 86400000).toISOString());
    const { data: customers } = await customersQ;
    const recipients = (customers || []).filter((c: any) => c.wa_id);

    // Insert one flow_event per recipient ("entered") + mark sent for first message node
    let firstMessageNode: any = null;
    if (campaign.flow_id) {
      const { data: flow } = await supabase.from('tn_flows').select('nodes').eq('id', campaign.flow_id).maybeSingle();
      firstMessageNode = ((flow?.nodes as any[]) || []).find((n: any) => n.type === 'message');
    }

    const events: any[] = [];
    let sent = 0;
    let failed = 0;
    for (const r of recipients) {
      events.push({ user_id: campaign.user_id, campaign_id, node_id: firstMessageNode?.id || null, event_type: 'entered', customer_id: r.id });
      const payload = {
        messaging_product: 'whatsapp', recipient_type: 'individual', to: r.wa_id, type: 'template',
        template: { name: templateName, language: { code: settings?.meta_template_language || 'en_US' } },
      };
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${metaToken}` }, body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok && !result?.error) {
        sent += 1;
        events.push({ user_id: campaign.user_id, campaign_id, node_id: firstMessageNode?.id || null, event_type: 'sent', customer_id: r.id });
        await supabase.from('tn_messages').insert({ user_id: campaign.user_id, wa_id: r.wa_id, direction: 'out', type: 'template', payload, wa_message_id: result?.messages?.[0]?.id });
      } else {
        failed += 1;
        await supabase.from('tn_messages').insert({ user_id: campaign.user_id, wa_id: r.wa_id, direction: 'out', type: 'webhook_error', payload: { text: { body: result?.error?.message || 'Campaign template send failed' }, error: result?.error || result } });
      }
    }
    if (events.length) await supabase.from('tn_flow_events').insert(events);

    await supabase.from('tn_campaigns').update({
      status: 'running',
      stats: { sent, failed, entered: recipients.length, replied: 0 },
    }).eq('id', campaign_id);

    return new Response(JSON.stringify({ ok: true, recipients: recipients.length, sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

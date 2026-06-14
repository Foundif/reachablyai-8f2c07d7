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

    // Audience: simple "all" for now — fetch tn_customers
    let customersQ = supabase.from('tn_customers').select('id, phone').eq('user_id', campaign.user_id);
    const aud = (campaign.audience_snapshot as any)?.type;
    if (aud === 'recent') customersQ = customersQ.gte('last_seen_at', new Date(Date.now() - 30 * 86400000).toISOString());
    if (aud === 'inactive') customersQ = customersQ.lt('last_seen_at', new Date(Date.now() - 45 * 86400000).toISOString());
    const { data: customers } = await customersQ;
    const recipients = (customers || []).filter((c: any) => c.phone);

    // Insert one flow_event per recipient ("entered") + mark sent for first message node
    let firstMessageNode: any = null;
    if (campaign.flow_id) {
      const { data: flow } = await supabase.from('tn_flows').select('nodes').eq('id', campaign.flow_id).maybeSingle();
      firstMessageNode = ((flow?.nodes as any[]) || []).find((n: any) => n.type === 'message');
    }

    const events: any[] = [];
    for (const r of recipients) {
      events.push({ user_id: campaign.user_id, campaign_id, node_id: firstMessageNode?.id || null, event_type: 'entered', customer_id: r.id });
      if (firstMessageNode) events.push({ user_id: campaign.user_id, campaign_id, node_id: firstMessageNode.id, event_type: 'sent', customer_id: r.id });
    }
    if (events.length) await supabase.from('tn_flow_events').insert(events);

    await supabase.from('tn_campaigns').update({
      status: 'running',
      stats: { sent: recipients.length, entered: recipients.length, replied: 0 },
    }).eq('id', campaign_id);

    return new Response(JSON.stringify({ ok: true, recipients: recipients.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

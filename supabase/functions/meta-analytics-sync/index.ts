import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Pulls Meta WABA analytics (conversation counts + costs by category) for a workspace.
// Returns aggregated numbers; caller renders them.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { workspace_id, days = 30 } = await req.json();
    if (!workspace_id) return json({ error: 'workspace_id required' }, 400);

    const { data: mem } = await admin.from('workspace_members').select('user_id')
      .eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);

    const { data: creds } = await admin.from('whatsapp_credentials').select('*').eq('workspace_id', workspace_id).maybeSingle();
    if (!creds?.access_token || !creds?.waba_id) return json({ error: 'WhatsApp API credentials missing' }, 400);

    const end = Math.floor(Date.now() / 1000);
    const start = end - Number(days) * 86400;

    // Conversation analytics (broken down by category)
    const analyticsUrl = `https://graph.facebook.com/v20.0/${creds.waba_id}?fields=conversation_analytics.start(${start}).end(${end}).granularity(DAILY).phone_numbers([]).dimensions(["CONVERSATION_CATEGORY","CONVERSATION_TYPE"])`;
    const aResp = await fetch(analyticsUrl, { headers: { Authorization: `Bearer ${creds.access_token}` } });
    const aBody: any = await aResp.json();
    if (!aResp.ok) return json({ error: aBody?.error?.message || `Meta error ${aResp.status}` }, 400);

    const dataPoints = aBody?.conversation_analytics?.data?.[0]?.data_points || [];
    const byCategory: Record<string, { conversations: number; cost: number }> = {};
    let totalConv = 0, totalCost = 0;
    for (const p of dataPoints) {
      const cat = (p.conversation_category || 'UNKNOWN').toLowerCase();
      byCategory[cat] ??= { conversations: 0, cost: 0 };
      byCategory[cat].conversations += p.conversation || 0;
      byCategory[cat].cost += Number(p.cost || 0);
      totalConv += p.conversation || 0;
      totalCost += Number(p.cost || 0);
    }

    // Message volume from local mirror (webhook-tracked)
    const sinceIso = new Date(Date.now() - Number(days) * 86400 * 1000).toISOString();
    const { data: msgs } = await admin.from('wa_messages')
      .select('direction,status,message_type,template_name')
      .eq('workspace_id', workspace_id)
      .gte('created_at', sinceIso);

    const messages = { sent: 0, delivered: 0, read: 0, failed: 0, inbound: 0, template: 0, free_form: 0 };
    for (const m of msgs || []) {
      if (m.direction === 'inbound') { messages.inbound++; continue; }
      if (m.template_name) messages.template++; else messages.free_form++;
      if (['sent', 'delivered', 'read'].includes(m.status)) messages.sent++;
      if (['delivered', 'read'].includes(m.status)) messages.delivered++;
      if (m.status === 'read') messages.read++;
      if (m.status === 'failed') messages.failed++;
    }

    await admin.from('whatsapp_credentials')
      .update({ last_analytics_sync: new Date().toISOString() })
      .eq('workspace_id', workspace_id);

    return json({
      ok: true,
      currency: aBody?.conversation_analytics?.data?.[0]?.currency || 'USD',
      totals: { conversations: totalConv, cost: totalCost },
      by_category: byCategory,
      messages,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

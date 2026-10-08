// Daily Meta Ads digest on WhatsApp: yesterday's spend, impressions, clicks, leads, cost per lead,
// plus overspend / high-CPL alerts. Runs for every workspace with Meta Lead Ads connected and an
// ad account ID set. Called by a daily schedule (x-cron-secret) or by a signed-in member ("send now").
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkMessageQuota } from '../_shared/plans.ts';
import { buildTemplatePayload } from '../_shared/templatePayload.ts';

const GRAPH = 'https://graph.facebook.com/v21.0';
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const digits = (v: unknown) => String(v ?? '').replace(/[^\d]/g, '');
const normalizePhone = (raw: string, cc = '91') => {
  let p = digits(raw);
  if (p.startsWith('00')) p = p.slice(2);
  if (p.length === 11 && p.startsWith('0')) p = p.slice(1);
  if (p.length === 10) p = cc + p;
  return p;
};
const money = (n: number, cur: string) =>
  `${cur === 'INR' ? '₹' : cur + ' '}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const LEAD_ACTIONS = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'leadgen_grouped'];

export function summarise(rows: any[]) {
  let spend = 0, impressions = 0, clicks = 0, leads = 0;
  for (const r of rows) {
    spend += Number(r.spend || 0);
    impressions += Number(r.impressions || 0);
    clicks += Number(r.clicks || 0);
    const acts = (r.actions || []) as any[];
    const hit = LEAD_ACTIONS.map((t) => acts.find((a) => a.action_type === t)).find(Boolean);
    leads += Number(hit?.value || 0);
  }
  return { spend, impressions, clicks, leads, cpl: leads ? spend / leads : 0 };
}

async function runFor(admin: any, integ: any) {
  const s = integ.settings || {};
  const account = String(s.ad_account_id || '').replace(/^act_/, '');
  const token = s.ads_access_token || s.page_access_token;
  if (!account || !token) throw new Error('Add your Ad account ID and an access token with ads_read');
  const team = String(s.digest_numbers || s.alert_numbers || '').split(/[,\s]+/)
    .map((n) => normalizePhone(n, s.country_code || '91')).filter((n) => n.length >= 10);
  if (!team.length) throw new Error('Add at least one WhatsApp number for the digest');

  const q = new URLSearchParams({
    level: 'campaign', date_preset: 'yesterday',
    fields: 'campaign_name,spend,impressions,clicks,actions,account_currency',
    access_token: token, limit: '50',
  });
  const r = await fetch(`${GRAPH}/act_${account}/insights?${q}`);
  const body = await r.json();
  if (!r.ok) throw new Error(body?.error?.message || `Meta error ${r.status}`);
  const rows = body.data || [];
  const cur = rows[0]?.account_currency || s.currency || 'INR';
  const t = summarise(rows);

  const budget = Number(s.daily_budget_limit || 0);
  const maxCpl = Number(s.max_cpl || 0);
  const alerts: string[] = [];
  if (budget && t.spend > budget) alerts.push(`⚠️ Spend ${money(t.spend, cur)} is over your daily limit of ${money(budget, cur)}`);
  if (maxCpl && t.leads && t.cpl > maxCpl) alerts.push(`⚠️ Cost per lead ${money(t.cpl, cur)} is above your target of ${money(maxCpl, cur)}`);
  if (t.spend > 0 && t.leads === 0) alerts.push(`⚠️ ${money(t.spend, cur)} spent with zero leads — check your ads`);

  const top = [...rows].sort((a, b) => Number(b.spend) - Number(a.spend)).slice(0, 5).map((row) => {
    const one = summarise([row]);
    return `• ${row.campaign_name}: ${money(one.spend, cur)} · ${one.leads} leads${one.leads ? ` · ${money(one.cpl, cur)}/lead` : ''}`;
  });

  const day = new Date(Date.now() - 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const text = `📊 *Meta Ads report — ${day}*\n\n💰 Spend: ${money(t.spend, cur)}\n👀 Impressions: ${t.impressions.toLocaleString('en-IN')}\n🖱️ Clicks: ${t.clicks.toLocaleString('en-IN')}\n🎯 Leads: ${t.leads}\n📉 Cost per lead: ${t.leads ? money(t.cpl, cur) : '—'}`
    + (top.length ? `\n\n*Top campaigns*\n${top.join('\n')}` : '')
    + (alerts.length ? `\n\n${alerts.join('\n')}` : '\n\n✅ All within limits');

  const { data: creds } = await admin.from('whatsapp_credentials').select('*').eq('workspace_id', integ.workspace_id).maybeSingle();
  if (!creds?.access_token || !creds?.phone_number_id) throw new Error('WhatsApp is not connected');
  let tpl: any = null;
  if (s.digest_template_id) ({ data: tpl } = await admin.from('templates').select('*').eq('id', s.digest_template_id).maybeSingle());

  const failures: string[] = [];
  for (const to of team) {
    const quota = await checkMessageQuota(admin, integ.workspace_id, 1);
    if (!quota.ok) { failures.push(`${to}: ${quota.reason}`); break; }
    const message = tpl
      ? { type: 'template', template: buildTemplatePayload(tpl, { name: '', phone: to, variables: {
          '1': day, '2': money(t.spend, cur), '3': String(t.leads), '4': t.leads ? money(t.cpl, cur) : '—', '5': alerts.length ? alerts.join(' | ').replace(/⚠️ /g, '') : 'All within limits',
        } }) }
      : { type: 'text', text: { body: text.slice(0, 4000) } };
    const res = await fetch(`${GRAPH}/${creds.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
    });
    if (!res.ok) failures.push(`${to}: ${(await res.json())?.error?.message || res.status}`);
  }

  await admin.from('integrations').update({
    settings: { ...s, last_digest_at: new Date().toISOString(), last_digest: { ...t, currency: cur, alerts }, last_digest_error: failures.join('; ') || null },
  }).eq('id', integ.id);
  return { workspace_id: integ.workspace_id, ...t, alerts, sent: team.length - failures.length, failures };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const cronSecret = Deno.env.get('DIGEST_CRON_SECRET');
  const isCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;
  let workspaceId: string | null = null;

  if (!isCron) {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));
    workspaceId = body.workspace_id;
    if (!workspaceId) return json({ error: 'workspace_id required' }, 400);
    const { data: mem } = await admin.from('workspace_members').select('user_id')
      .eq('workspace_id', workspaceId).eq('user_id', u.user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);
  }

  let query = admin.from('integrations').select('id,workspace_id,settings').eq('provider', 'meta_lead_ads');
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data: list } = await query;
  const targets = ((list || []) as any[]).filter((i) => workspaceId || (i.settings?.ad_account_id && i.settings?.digest_enabled !== 'no'));
  if (!targets.length) return json({ error: 'Meta Lead Ads is not connected for this workspace' }, 404);

  const results = [];
  for (const integ of targets) {
    try { results.push(await runFor(admin, integ)); }
    catch (e) {
      const msg = (e as Error).message;
      await admin.from('integrations').update({ settings: { ...integ.settings, last_digest_error: msg } }).eq('id', integ.id);
      results.push({ workspace_id: integ.workspace_id, error: msg });
    }
  }
  if (workspaceId && (results[0] as any)?.error) return json({ error: (results[0] as any).error }, 400);
  return json({ ok: true, results });
});

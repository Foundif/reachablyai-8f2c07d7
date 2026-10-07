// Meta Lead Ads receiver: Facebook/Instagram lead form → CRM lead → instant WhatsApp alerts.
// Subscribe your Page to the "leadgen" field and point the callback here.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildTemplatePayload } from '../_shared/templatePayload.ts';
import { checkMessageQuota } from '../_shared/plans.ts';

const GRAPH = 'https://graph.facebook.com/v21.0';
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const digits = (v: unknown) => String(v ?? '').replace(/[^\d]/g, '');

function normalizePhone(raw: string, cc = '91') {
  let p = digits(raw);
  if (p.startsWith('00')) p = p.slice(2);
  if (p.length === 11 && p.startsWith('0')) p = p.slice(1);
  if (p.length === 10) p = cc + p;
  return p;
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);

  const { data: integrations } = await admin.from('integrations').select('id,workspace_id,settings,status')
    .eq('provider', 'meta_lead_ads');
  const all = (integrations || []) as any[];

  // Meta verification handshake
  if (req.method === 'GET') {
    const token = url.searchParams.get('hub.verify_token');
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && token && all.some((i) => i.settings?.verify_token === token);
    return ok ? new Response(url.searchParams.get('hub.challenge') || '', { status: 200 }) : new Response('Forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const raw = await req.text();
  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const signature = (req.headers.get('x-hub-signature-256') || '').replace('sha256=', '');
  const results: any[] = [];

  for (const entry of body?.entry || []) {
    const pageId = String(entry?.id || '');
    const integ = all.find((i) => String(i.settings?.page_id || '') === pageId);
    if (!integ) { results.push({ pageId, skipped: 'No workspace connected for this Page' }); continue; }
    const s = integ.settings || {};

    const appSecret = s.app_secret || Deno.env.get('META_APP_SECRET');
    if (appSecret && signature && (await hmacHex(appSecret, raw)) !== signature) {
      results.push({ pageId, skipped: 'Bad signature' }); continue;
    }

    for (const change of entry?.changes || []) {
      if (change?.field !== 'leadgen') continue;
      const v = change.value || {};
      try {
        const leadRes = await fetch(`${GRAPH}/${v.leadgen_id}?fields=field_data,created_time,ad_name,adset_name,campaign_name,form_id&access_token=${encodeURIComponent(s.page_access_token || '')}`);
        const lead = await leadRes.json();
        if (!leadRes.ok) throw new Error(lead?.error?.message || 'Could not read lead from Meta');

        const answers: Record<string, string> = {};
        for (const f of lead.field_data || []) answers[f.name] = (f.values || []).join(', ');
        const find = (...keys: string[]) => {
          for (const k of Object.keys(answers)) if (keys.some((x) => k.toLowerCase().includes(x))) return answers[k];
          return '';
        };
        const name = answers.full_name || find('name') || 'Meta lead';
        const phone = normalizePhone(answers.phone_number || find('phone', 'mobile', 'whatsapp'), s.country_code || '91');
        const email = answers.email || find('email') || null;
        const city = answers.city || find('city') || '';
        const campaign = lead.campaign_name || '';
        const formName = s.form_names?.[v.form_id] || lead.form_id || v.form_id || '';
        const tags = ['meta_ads', campaign && `campaign:${campaign}`, lead.ad_name && `ad:${lead.ad_name}`, city && `city:${city}`].filter(Boolean);
        const notes = Object.entries(answers).map(([k, val]) => `${k.replace(/_/g, ' ')}: ${val}`).join('\n')
          + `\n—\nCampaign: ${campaign || '-'} | Ad set: ${lead.adset_name || '-'} | Ad: ${lead.ad_name || '-'} | Form: ${formName}`;

        // Upsert into CRM
        let leadId: string | null = null;
        if (phone) {
          const { data: existing } = await admin.from('leads').select('id').eq('workspace_id', integ.workspace_id).eq('phone', phone).maybeSingle();
          leadId = existing?.id ?? null;
        }
        if (leadId) {
          await admin.from('leads').update({ name, email, notes, tags, source: 'meta_ads' }).eq('id', leadId);
        } else {
          const { data: created } = await admin.from('leads').insert({
            workspace_id: integ.workspace_id, name, phone: phone || `meta-${v.leadgen_id}`, email, notes, tags, source: 'meta_ads', status: 'new',
          }).select('id').maybeSingle();
          leadId = created?.id ?? null;
        }

        const { data: creds } = await admin.from('whatsapp_credentials').select('*').eq('workspace_id', integ.workspace_id).maybeSingle();
        const sent: string[] = [];
        const send = async (to: string, message: any) => {
          const quota = await checkMessageQuota(admin, integ.workspace_id, 1);
          if (!quota.ok) throw new Error(quota.reason || 'Monthly message limit reached');
          const r = await fetch(`${GRAPH}/${creds.phone_number_id}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
          });
          const out = await r.json();
          if (!r.ok) throw new Error(out?.error?.message || 'WhatsApp send failed');
          sent.push(to);
        };

        if (creds?.access_token && creds?.phone_number_id) {
          // 1) Team alert
          const team = String(s.alert_numbers || '').split(/[,\s]+/).map((n) => normalizePhone(n, s.country_code || '91')).filter((n) => n.length >= 10);
          const alertText = `🔥 *New lead from Meta Ads*\n\n👤 ${name}\n📞 +${phone}\n${city ? `📍 ${city}\n` : ''}📣 ${campaign || 'Lead form'}${formName ? ` · ${formName}` : ''}\n\n${Object.entries(answers).filter(([k]) => !['full_name', 'phone_number', 'email'].includes(k)).map(([k, val]) => `• ${k.replace(/_/g, ' ')}: ${val}`).join('\n')}\n\nChat now: https://wa.me/${phone}`;
          let alertTpl: any = null;
          if (s.alert_template_id) ({ data: alertTpl } = await admin.from('templates').select('*').eq('id', s.alert_template_id).maybeSingle());
          for (const to of team) {
            try {
              if (alertTpl) {
                await send(to, { type: 'template', template: buildTemplatePayload(alertTpl, { name, phone, variables: { '1': name, '2': `+${phone}`, '3': campaign || formName || 'Meta Ads' } }) });
              } else {
                await send(to, { type: 'text', text: { body: alertText.slice(0, 4000) } });
              }
            } catch (e) { results.push({ alert: to, error: (e as Error).message }); }
          }

          // 2) Auto-greeting to the lead
          if (s.greeting_template_id && phone.length >= 10) {
            const { data: tpl } = await admin.from('templates').select('*').eq('id', s.greeting_template_id).maybeSingle();
            if (tpl) {
              try {
                await send(phone, { type: 'template', template: buildTemplatePayload(tpl, { name, phone, variables: { '1': name } }) });
                const { data: conv } = await admin.from('wa_conversations').select('id').eq('workspace_id', integ.workspace_id).eq('contact_phone', phone).maybeSingle();
                let convId = conv?.id;
                if (!convId) {
                  const { data: c } = await admin.from('wa_conversations').insert({ workspace_id: integ.workspace_id, contact_phone: phone, contact_name: name }).select('id').maybeSingle();
                  convId = c?.id;
                }
                if (convId) {
                  const preview = String(tpl.body || tpl.name).replace(/\{\{\s*1\s*\}\}/g, name);
                  await admin.from('wa_messages').insert({
                    workspace_id: integ.workspace_id, conversation_id: convId, direction: 'outbound', from_phone: creds.business_phone,
                    to_phone: phone, body: preview, message_type: 'template', template_name: tpl.name, status: 'sent',
                  });
                  await admin.from('wa_conversations').update({ last_message_at: new Date().toISOString(), last_message_text: preview.slice(0, 200), last_message_direction: 'outbound', deleted_at: null }).eq('id', convId);
                }
              } catch (e) { results.push({ greeting: phone, error: (e as Error).message }); }
            }
          }
        }

        await admin.from('integrations').update({
          settings: { ...s, last_lead_at: new Date().toISOString(), last_lead_name: name, leads_received: (Number(s.leads_received) || 0) + 1 },
        }).eq('id', integ.id);
        results.push({ leadgen_id: v.leadgen_id, lead_id: leadId, alerts_sent: sent.length });
      } catch (e) {
        await admin.from('integrations').update({ settings: { ...s, last_error: (e as Error).message, last_error_at: new Date().toISOString() } }).eq('id', integ.id);
        results.push({ leadgen_id: v.leadgen_id, error: (e as Error).message });
      }
    }
  }
  return json({ ok: true, results });
});

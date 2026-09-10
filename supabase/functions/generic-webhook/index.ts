// Generic inbound webhook receiver.
// URL shape: /functions/v1/generic-webhook/<token>
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildTemplatePayload } from '../_shared/templatePayload.ts';
import { checkMessageQuota } from '../_shared/plans.ts';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/** Reads "a.b.0.c" style paths out of an arbitrary JSON payload. */
function pick(payload: any, path?: string | null): any {
  if (!path) return undefined;
  return String(path).split('.').reduce((acc: any, key) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[key];
  }, payload);
}

const digits = (v: unknown) => String(v ?? '').replace(/[^\d]/g, '');

function conditionsPass(conditions: any, payload: any): boolean {
  if (!Array.isArray(conditions) || !conditions.length) return true;
  return conditions.every((c: any) => {
    const left = String(pick(payload, c?.field) ?? '').toLowerCase().trim();
    const right = String(c?.value ?? '').toLowerCase().trim();
    switch (c?.op) {
      case 'not_equals': return left !== right;
      case 'contains': return left.includes(right);
      case 'exists': return left.length > 0;
      default: return left === right;
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);
  const token = url.pathname.split('/').filter(Boolean).pop() || '';

  const { data: endpoint } = await admin.from('webhook_endpoints').select('*').eq('token', token).maybeSingle();
  if (!endpoint) return json({ error: 'Unknown webhook token' }, 404);

  if (req.method === 'GET') return json({ ok: true, webhook: endpoint.name, message: 'Webhook is live. POST JSON here.' });

  // ---- Parse the body (JSON or form encoded) --------------------------------
  let payload: any = {};
  try {
    const raw = await req.text();
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = Object.fromEntries(new URLSearchParams(raw));
      }
    }
  } catch {
    payload = {};
  }
  for (const [k, v] of url.searchParams.entries()) if (!(k in payload)) payload[k] = v;

  await admin.from('webhook_endpoints').update({
    last_payload: payload,
    last_received_at: new Date().toISOString(),
  }).eq('id', endpoint.id);

  const log = (status: string, extra: Record<string, unknown> = {}) =>
    admin.from('webhook_logs').insert({
      endpoint_id: endpoint.id, workspace_id: endpoint.workspace_id,
      status, payload, ...extra,
    });

  const recipientName = String(pick(payload, endpoint.name_field) ?? '').trim() || null;
  const phone = digits(pick(payload, endpoint.phone_field));

  if (!endpoint.active || !endpoint.template_id || !endpoint.phone_field) {
    await log('received', { phone: phone || null, recipient_name: recipientName });
    return json({ ok: true, captured: true });
  }

  if (!conditionsPass(endpoint.conditions, payload)) {
    await log('skipped', { phone: phone || null, recipient_name: recipientName, error: 'Conditions not met' });
    return json({ ok: true, skipped: true });
  }

  if (!phone || phone.length < 8) {
    await log('failed', { recipient_name: recipientName, error: 'Recipient number missing or invalid (use country code, no +)' });
    return json({ error: 'Recipient number missing or invalid' }, 400);
  }

  try {
    const { data: creds } = await admin.from('whatsapp_credentials').select('*')
      .eq('workspace_id', endpoint.workspace_id).maybeSingle();
    if (!creds?.access_token || !creds?.phone_number_id) throw new Error('WhatsApp Cloud API not configured');

    const { data: template } = await admin.from('templates').select('*').eq('id', endpoint.template_id).maybeSingle();
    if (!template) throw new Error('Template not found');

    // Map payload fields onto template variables ({"1":"customer.name"})
    const variables: Record<string, unknown> = {};
    for (const [key, path] of Object.entries((endpoint.variable_map || {}) as Record<string, string>)) {
      const value = pick(payload, path);
      if (value !== undefined && value !== null && String(value).trim()) variables[key] = value;
    }

    const templatePayload = buildTemplatePayload(template, { name: recipientName, phone, variables });

    // Enforce this month's plan message allowance
    const quota = await checkMessageQuota(admin, workspace_id, 1);
    if (!quota.ok) throw new Error(quota.reason || 'Monthly message limit reached');

    const res = await fetch(`https://graph.facebook.com/v21.0/${creds.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template', template: templatePayload }),
    });
    const out = await res.json();
    if (!res.ok) {
      throw new Error(out?.error?.message || 'WhatsApp send failed');
    }

    const waId = out?.messages?.[0]?.id ?? null;
    const preview = String(template.body || template.name || '').replace(/\{\{\s*1\s*\}\}/g, recipientName || 'Customer');

    // Mirror into the team inbox + keep a contact record
    let convId: string | null = null;
    const { data: existing } = await admin.from('wa_conversations').select('id')
      .eq('workspace_id', endpoint.workspace_id).eq('contact_phone', phone).maybeSingle();
    if (existing) convId = existing.id;
    else {
      const { data: created } = await admin.from('wa_conversations')
        .insert({ workspace_id: endpoint.workspace_id, contact_phone: phone, contact_name: recipientName })
        .select('id').maybeSingle();
      convId = created?.id ?? null;
    }
    if (convId) {
      await admin.from('wa_messages').insert({
        workspace_id: endpoint.workspace_id, conversation_id: convId, direction: 'outbound',
        from_phone: creds.business_phone, to_phone: phone, body: preview,
        message_type: 'template', template_name: template.name, status: 'sent', wa_message_id: waId,
      });
      await admin.from('wa_conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_text: preview.slice(0, 200),
        last_message_direction: 'outbound',
        deleted_at: null,
      }).eq('id', convId);
    }

    const { data: lead } = await admin.from('leads').select('id')
      .eq('workspace_id', endpoint.workspace_id).eq('phone', phone).maybeSingle();
    if (!lead) {
      await admin.from('leads').insert({
        workspace_id: endpoint.workspace_id, name: recipientName || phone, phone,
        source: 'webhook', status: 'new',
      });
    }

    await log('sent', { phone, recipient_name: recipientName, wa_message_id: waId });
    return json({ ok: true, sent: true, message_id: waId });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    await log('failed', { phone, recipient_name: recipientName, error: message });
    return json({ error: message }, 500);
  }
});

// Reachably Public API — lets an external admin panel or app send templates,
// create contacts/records and read data using a workspace API key.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const digits = (s: string) => (s || '').replace(/[^\d]/g, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  // supports /public-api/<endpoint> and ?action=<endpoint>
  const parts = url.pathname.split('/').filter(Boolean);
  const endpoint = (url.searchParams.get('action') || parts[parts.length - 1] || '').toLowerCase();

  let keyRow: any = null;
  let payload: any = {};

  const finish = async (status: number, body: any, error?: string) => {
    try {
      if (keyRow) {
        await admin.from('api_logs').insert({
          workspace_id: keyRow.workspace_id, api_key_id: keyRow.id,
          endpoint, status, error: error || null, payload,
        });
        await admin.from('api_keys').update({
          last_used_at: new Date().toISOString(), call_count: (keyRow.call_count || 0) + 1,
        }).eq('id', keyRow.id);
      }
    } catch (_) { /* logging must never break the response */ }
    return json(body, status);
  };

  try {
    const rawKey = req.headers.get('x-api-key') || (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!rawKey || !rawKey.startsWith('rb_')) return json({ error: 'Missing or invalid API key' }, 401);

    const { data: key } = await admin.from('api_keys').select('*').eq('key_hash', await sha256(rawKey)).maybeSingle();
    if (!key || !key.active) return json({ error: 'API key not recognised or revoked' }, 401);
    keyRow = key;
    const ws = key.workspace_id as string;

    if (req.method === 'POST') {
      try { payload = await req.json(); } catch { payload = {}; }
    } else {
      payload = Object.fromEntries(url.searchParams.entries());
    }

    const scopes: string[] = key.scopes || [];
    const need = (s: string) => scopes.includes(s);

    switch (endpoint) {
      case 'ping':
        return await finish(200, { ok: true, workspace_id: ws, scopes });

      case 'templates': {
        if (!need('read')) return await finish(403, { error: 'Key lacks the read scope' }, 'scope');
        const { data } = await admin.from('templates')
          .select('id,name,language,category,status,body,variables')
          .eq('workspace_id', ws).order('name');
        return await finish(200, { templates: data || [] });
      }

      case 'send-template': {
        if (!need('send')) return await finish(403, { error: 'Key lacks the send scope' }, 'scope');
        const to = digits(payload.to || payload.phone || '');
        const name = (payload.template || payload.template_name || '').trim();
        if (to.length < 10) return await finish(400, { error: 'A valid "to" phone number (with country code) is required' }, 'bad phone');
        if (!name) return await finish(400, { error: '"template" name is required' }, 'no template');

        const { data: tpl } = await admin.from('templates').select('id,status,name')
          .eq('workspace_id', ws).eq('name', name).maybeSingle();
        if (!tpl) return await finish(404, { error: `Template "${name}" not found in this workspace` }, 'template missing');
        if (tpl.status !== 'approved') return await finish(400, { error: `Template "${name}" is not approved yet` }, 'template not approved');

        const resp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-reachably-internal': serviceKey, apikey: serviceKey },
          body: JSON.stringify({
            workspace_id: ws, to, template_id: tpl.id,
            variables: payload.variables || payload.params || {},
            whatsapp_credential_id: payload.whatsapp_credential_id || undefined,
          }),
        });
        const body = await resp.json().catch(() => ({}));
        return await finish(resp.status, body, resp.ok ? undefined : body?.error);
      }

      case 'send-message': {
        if (!need('send')) return await finish(403, { error: 'Key lacks the send scope' }, 'scope');
        const to = digits(payload.to || payload.phone || '');
        const text = (payload.message || payload.body || '').toString();
        if (to.length < 10) return await finish(400, { error: 'A valid "to" phone number (with country code) is required' }, 'bad phone');
        if (!text.trim()) return await finish(400, { error: '"message" is required' }, 'no body');

        const resp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-reachably-internal': serviceKey, apikey: serviceKey },
          body: JSON.stringify({
            workspace_id: ws, to, body: text,
            media_url: payload.media_url || undefined, media_type: payload.media_type || undefined,
          }),
        });
        const body = await resp.json().catch(() => ({}));
        return await finish(resp.status, body, resp.ok ? undefined : body?.error);
      }

      case 'contacts': {
        if (req.method === 'GET') {
          if (!need('read')) return await finish(403, { error: 'Key lacks the read scope' }, 'scope');
          const { data } = await admin.from('leads').select('id,name,phone,email,status,tags,created_at')
            .eq('workspace_id', ws).order('created_at', { ascending: false }).limit(200);
          return await finish(200, { contacts: data || [] });
        }
        if (!need('contacts')) return await finish(403, { error: 'Key lacks the contacts scope' }, 'scope');
        const phone = digits(payload.phone || '');
        if (!payload.name || phone.length < 10) return await finish(400, { error: '"name" and a valid "phone" are required' }, 'bad contact');
        const { data: existing } = await admin.from('leads').select('id').eq('workspace_id', ws).eq('phone', phone).maybeSingle();
        if (existing) {
          await admin.from('leads').update({
            name: payload.name, email: payload.email || null,
            tags: Array.isArray(payload.tags) ? payload.tags : undefined,
          }).eq('id', existing.id);
          return await finish(200, { contact_id: existing.id, created: false });
        }
        const { data: created, error } = await admin.from('leads').insert({
          workspace_id: ws, name: payload.name, phone, email: payload.email || null,
          source: payload.source || 'api', status: payload.status || 'new',
          tags: Array.isArray(payload.tags) ? payload.tags : [],
        }).select('id').single();
        if (error) return await finish(400, { error: error.message }, error.message);
        return await finish(201, { contact_id: created.id, created: true });
      }

      case 'records': {
        if (req.method === 'GET') {
          if (!need('read')) return await finish(403, { error: 'Key lacks the read scope' }, 'scope');
          const { data } = await admin.from('business_records')
            .select('id,record_code,record_type,title,customer_name,customer_phone,status,amount,paid_amount,payment_status,scheduled_at,created_at')
            .eq('workspace_id', ws).order('created_at', { ascending: false }).limit(100);
          return await finish(200, { records: data || [] });
        }
        if (!need('records')) return await finish(403, { error: 'Key lacks the records scope' }, 'scope');
        const name = (payload.customer_name || payload.name || '').toString().trim();
        if (!name) return await finish(400, { error: '"customer_name" is required' }, 'no customer');
        const type = (payload.record_type || 'booking').toString();
        const prefix = type === 'order' ? 'OR' : type === 'appointment' ? 'AP' : 'BK';
        const { data: code } = await admin.rpc('next_record_code', { _ws: ws, _prefix: prefix });
        const { data: rec, error } = await admin.from('business_records').insert({
          workspace_id: ws, record_code: code, record_type: type,
          title: payload.title || null, customer_name: name,
          customer_phone: payload.customer_phone ? digits(payload.customer_phone) : null,
          customer_email: payload.customer_email || null,
          service: payload.service || null,
          scheduled_at: payload.scheduled_at || null,
          amount: Number(payload.amount || 0), advance_amount: Number(payload.advance_amount || 0),
          notes: payload.notes || null, custom_fields: payload.custom_fields || {}, source: 'api',
        }).select('id,record_code').single();
        if (error) return await finish(400, { error: error.message }, error.message);
        await admin.from('record_timeline').insert({
          record_id: rec.id, workspace_id: ws, event: 'created',
          detail: `Created through the public API by key ${key.key_prefix}`, actor_name: 'API',
        });
        return await finish(201, { record_id: rec.id, record_code: rec.record_code });
      }

      default:
        return await finish(404, { error: `Unknown endpoint "${endpoint}"` }, 'unknown endpoint');
    }
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    console.error('public-api error', msg);
    return await finish(500, { error: msg }, msg);
  }
});

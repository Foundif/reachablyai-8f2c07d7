// Manage WhatsApp Flows (Meta native bottom-sheet forms) from inside Reachably:
// list/sync, save JSON locally, upload + publish to Meta, and send a live test message.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GRAPH = 'https://graph.facebook.com/v20.0';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const client = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, serviceKey);

    const { data: userRes } = await client.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({} as any));
    const action = String(body?.action || '');
    const workspace_id = String(body?.workspace_id || '');
    if (!workspace_id) return json({ error: 'workspace_id required' }, 400);

    const { data: mem } = await client.from('workspace_members')
      .select('workspace_id').eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) {
      const { data: owned } = await client.from('workspaces')
        .select('id').eq('id', workspace_id).eq('owner_id', user.id).maybeSingle();
      if (!owned) return json({ error: 'Workspace access denied' }, 403);
    }

    let credQ = admin.from('whatsapp_credentials').select('*').eq('workspace_id', workspace_id);
    if (body?.credential_id) credQ = credQ.eq('id', body.credential_id);
    const { data: creds } = await credQ.order('is_primary', { ascending: false }).limit(1).maybeSingle();
    if (!creds?.access_token) return json({ error: 'Connect your WhatsApp number first' }, 400);
    const graphHeaders = { Authorization: `Bearer ${creds.access_token}` };
    const waba = creds.waba_id;

    // ---------- sync: pull flows from Meta into the workspace ----------
    if (action === 'sync') {
      if (!waba) return json({ error: 'WhatsApp Business Account ID missing in WhatsApp settings' }, 400);
      const res = await fetch(`${GRAPH}/${waba}/flows?fields=id,name,status,categories&limit=100`, { headers: graphHeaders });
      const out = await res.json();
      if (!res.ok) return json({ error: out?.error?.message || 'Could not load forms from Meta' }, res.status);
      const remote: any[] = out?.data || [];
      for (const f of remote) {
        const { data: existing } = await admin.from('whatsapp_flows')
          .select('id').eq('workspace_id', workspace_id).eq('flow_id', f.id).maybeSingle();
        const patch = {
          workspace_id, flow_id: f.id, name: f.name || 'Untitled form',
          status: f.status || 'DRAFT',
          categories: Array.isArray(f.categories) && f.categories.length ? f.categories : ['OTHER'],
        };
        if (existing) await admin.from('whatsapp_flows').update(patch).eq('id', existing.id);
        else await admin.from('whatsapp_flows').insert({ ...patch, created_by: user.id });
      }
      return json({ success: true, synced: remote.length });
    }

    // ---------- fetch_json: download the published flow.json from Meta ----------
    if (action === 'fetch_json') {
      const flowId = String(body?.flow_id || '');
      if (!flowId) return json({ error: 'This form has not been created on Meta yet' }, 400);
      const res = await fetch(`${GRAPH}/${flowId}/assets`, { headers: graphHeaders });
      const out = await res.json();
      if (!res.ok) return json({ error: out?.error?.message || 'Could not read the form from Meta' }, res.status);
      const asset = (out?.data || []).find((a: any) => a.asset_type === 'FLOW_JSON') || out?.data?.[0];
      if (!asset?.download_url) return json({ error: 'No form code stored on Meta yet' }, 404);
      const fileRes = await fetch(asset.download_url);
      const text = await fileRes.text();
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { return json({ error: 'Meta returned unreadable form code' }, 502); }
      return json({ json_definition: parsed });
    }

    // ---------- publish: create on Meta (if needed), upload JSON, publish ----------
    if (action === 'publish' || action === 'upload') {
      const rowId = String(body?.id || '');
      if (!rowId) return json({ error: 'id required' }, 400);
      const { data: row } = await admin.from('whatsapp_flows').select('*')
        .eq('id', rowId).eq('workspace_id', workspace_id).maybeSingle();
      if (!row) return json({ error: 'Form not found' }, 404);
      if (!row.json_definition || !(row.json_definition as any)?.screens?.length) {
        return json({ error: 'Add the form code (with at least one screen) before publishing' }, 400);
      }
      if (!waba) return json({ error: 'WhatsApp Business Account ID missing in WhatsApp settings' }, 400);

      let flowId: string | null = row.flow_id;
      if (!flowId) {
        const createRes = await fetch(`${GRAPH}/${waba}/flows`, {
          method: 'POST',
          headers: { ...graphHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: row.name, categories: row.categories || ['OTHER'] }),
        });
        const created = await createRes.json();
        if (!createRes.ok || !created?.id) {
          const msg = created?.error?.message || 'Meta refused to create this form';
          await admin.from('whatsapp_flows').update({ last_error: msg }).eq('id', rowId);
          return json({ error: msg }, createRes.status || 400);
        }
        flowId = created.id;
        await admin.from('whatsapp_flows').update({ flow_id: flowId }).eq('id', rowId);
      }

      // Upload the flow.json asset
      const fd = new FormData();
      fd.append('name', 'flow.json');
      fd.append('asset_type', 'FLOW_JSON');
      fd.append('file', new File([JSON.stringify(row.json_definition)], 'flow.json', { type: 'application/json' }));
      const upRes = await fetch(`${GRAPH}/${flowId}/assets`, { method: 'POST', headers: graphHeaders, body: fd });
      const upOut = await upRes.json();
      const validation = upOut?.validation_errors || [];
      if (!upRes.ok || upOut?.success === false || validation.length) {
        const msg = validation.length
          ? validation.map((v: any) => `${v.pointers?.[0]?.screen_index !== undefined ? `Screen ${v.pointers[0].screen_index + 1}: ` : ''}${v.message}`).join('\n')
          : (upOut?.error?.message || 'Meta rejected the form code');
        await admin.from('whatsapp_flows').update({ last_error: msg }).eq('id', rowId);
        return json({ error: msg, validation_errors: validation }, 400);
      }

      if (action === 'upload') {
        await admin.from('whatsapp_flows').update({ status: 'DRAFT', last_error: null }).eq('id', rowId);
        return json({ success: true, flow_id: flowId, status: 'DRAFT' });
      }

      const pubRes = await fetch(`${GRAPH}/${flowId}/publish`, { method: 'POST', headers: graphHeaders });
      const pubOut = await pubRes.json();
      if (!pubRes.ok || pubOut?.success === false) {
        const msg = pubOut?.error?.message || 'Meta could not publish this form';
        await admin.from('whatsapp_flows').update({ last_error: msg }).eq('id', rowId);
        return json({ error: msg }, pubRes.status || 400);
      }
      await admin.from('whatsapp_flows').update({
        status: 'PUBLISHED', published_at: new Date().toISOString(), last_error: null,
      }).eq('id', rowId);
      return json({ success: true, flow_id: flowId, status: 'PUBLISHED' });
    }

    // ---------- send_test: interactive flow message that opens the bottom sheet ----------
    if (action === 'send_test') {
      const rowId = String(body?.id || '');
      const to = String(body?.to || '').replace(/\D/g, '');
      if (!rowId || !to) return json({ error: 'Pick a form and enter a WhatsApp number' }, 400);
      if (!creds.phone_number_id) return json({ error: 'WhatsApp number is not configured' }, 400);
      const { data: row } = await admin.from('whatsapp_flows').select('*')
        .eq('id', rowId).eq('workspace_id', workspace_id).maybeSingle();
      if (!row?.flow_id) return json({ error: 'Publish this form to Meta before testing' }, 400);
      if (row.status !== 'PUBLISHED') return json({ error: 'Only a published form can be sent as a test' }, 400);

      const screens = ((row.json_definition as any)?.screens || []) as any[];
      const firstScreen = row.first_screen || screens[0]?.id;
      if (!firstScreen) return json({ error: 'Form has no screens' }, 400);

      const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'flow',
          header: { type: 'text', text: row.name.slice(0, 60) },
          body: { text: String(body?.body_text || 'Tap below to open the booking form.').slice(0, 1024) },
          footer: { text: 'Powered by Reachably' },
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_token: `test-${rowId}-${Date.now()}`,
              flow_id: row.flow_id,
              flow_cta: (row.cta_text || 'Open form').slice(0, 20),
              flow_action: 'navigate',
              flow_action_payload: { screen: firstScreen },
            },
          },
        },
      };
      const sendRes = await fetch(`${GRAPH}/${creds.phone_number_id}/messages`, {
        method: 'POST',
        headers: { ...graphHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const sendOut = await sendRes.json();
      if (!sendRes.ok) {
        return json({ error: sendOut?.error?.message || 'WhatsApp refused to send the test' }, sendRes.status);
      }

      // Record it in the inbox so the conversation history stays complete
      let convId: string | null = null;
      const { data: conv } = await admin.from('wa_conversations')
        .select('id').eq('workspace_id', workspace_id).eq('contact_phone', to).maybeSingle();
      if (conv) convId = conv.id;
      else {
        const { data: made } = await admin.from('wa_conversations')
          .insert({ workspace_id, contact_phone: to }).select('id').single();
        convId = made?.id ?? null;
      }
      if (convId) {
        await admin.from('wa_messages').insert({
          workspace_id, conversation_id: convId, direction: 'outbound',
          wa_message_id: sendOut?.messages?.[0]?.id || null,
          to_phone: to, from_phone: creds.business_phone || null,
          body: `📋 ${row.name} form sent`, message_type: 'interactive',
          status: 'sent', sent_by: user.id,
        });
        await admin.from('wa_conversations').update({
          last_message_at: new Date().toISOString(),
          last_message_text: `📋 ${row.name} form sent`,
          last_message_direction: 'outbound',
        }).eq('id', convId);
      }
      return json({ success: true, message_id: sendOut?.messages?.[0]?.id || null });
    }

    return json({ error: 'Unsupported action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

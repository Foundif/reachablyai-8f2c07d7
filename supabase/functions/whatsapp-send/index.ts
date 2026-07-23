import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { conversation_id, workspace_id, to, body, template_id } = await req.json();
    if (!workspace_id || !to) return json({ error: 'workspace_id and to required' }, 400);

    // Verify membership
    const { data: mem } = await admin.from('workspace_members').select('user_id').eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);

    const { data: creds } = await admin.from('whatsapp_credentials').select('*').eq('workspace_id', workspace_id).maybeSingle();
    if (!creds?.access_token || !creds?.phone_number_id) return json({ error: 'WhatsApp not configured' }, 400);

    // Get or create conversation
    let convId = conversation_id;
    if (!convId) {
      const { data: existing } = await admin.from('wa_conversations').select('id').eq('workspace_id', workspace_id).eq('contact_phone', to).maybeSingle();
      if (existing) convId = existing.id;
      else {
        const { data: created } = await admin.from('wa_conversations').insert({ workspace_id, contact_phone: to }).select('id').single();
        convId = created!.id;
      }
    }

    // Build request
    let waPayload: any = { messaging_product: 'whatsapp', to, type: 'text', text: { body } };
    let msgType = 'text', tplName: string | null = null;

    if (template_id) {
      const { data: tpl } = await admin.from('templates').select('*').eq('id', template_id).maybeSingle();
      if (!tpl) return json({ error: 'Template not found' }, 404);
      if (tpl.status !== 'approved') return json({ error: 'Template must be approved' }, 400);
      msgType = 'template';
      tplName = tpl.name;
      const varNames: string[] = Array.isArray(tpl.variables) ? tpl.variables : [];
      const components = varNames.length > 0 ? [{
        type: 'body',
        parameters: varNames.map((v) => ({ type: 'text', text: String(v === 'name' ? '' : '-') })),
      }] : [];
      waPayload = {
        messaging_product: 'whatsapp', to, type: 'template',
        template: { name: tpl.name, language: { code: tpl.language || 'en' }, ...(components.length ? { components } : {}) },
      };
    }

    const resp = await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(waPayload),
    });
    const rbody = await resp.json();
    if (!resp.ok) {
      const err = rbody?.error?.message || `HTTP ${resp.status}`;
      await admin.from('wa_messages').insert({
        workspace_id, conversation_id: convId, direction: 'outbound',
        from_phone: creds.business_phone, to_phone: to, body: body || tplName, message_type: msgType,
        template_name: tplName, status: 'failed', error: err, sent_by: user.id,
      });
      return json({ error: err }, 400);
    }
    const wamid = rbody?.messages?.[0]?.id || null;

    await admin.from('wa_messages').insert({
      workspace_id, conversation_id: convId, direction: 'outbound', wa_message_id: wamid,
      from_phone: creds.business_phone, to_phone: to, body: body || tplName, message_type: msgType,
      template_name: tplName, status: 'sent', sent_by: user.id,
    });

    await admin.from('wa_conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_text: (body || tplName || '').slice(0, 200),
      last_message_direction: 'outbound',
    }).eq('id', convId);

    return json({ ok: true, wamid, conversation_id: convId });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Deletes a template on Meta (WABA) and then removes the local row.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { workspace_id, template_id } = await req.json();
    if (!workspace_id || !template_id) return json({ error: 'workspace_id and template_id required' }, 400);

    const { data: mem } = await admin.from('workspace_members').select('user_id')
      .eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);

    const { data: tpl } = await admin.from('templates').select('*')
      .eq('id', template_id).eq('workspace_id', workspace_id).maybeSingle();
    if (!tpl) return json({ error: 'Template not found' }, 404);

    const { data: creds } = await admin.from('whatsapp_credentials').select('*')
      .eq('workspace_id', workspace_id).maybeSingle();

    let metaDeleted = false;
    let metaError: string | null = null;

    if (creds?.access_token && creds?.waba_id) {
      const params = new URLSearchParams({ name: tpl.name });
      if (tpl.meta_template_id) params.set('hsm_id', String(tpl.meta_template_id));
      const resp = await fetch(
        `https://graph.facebook.com/v20.0/${creds.waba_id}/message_templates?${params.toString()}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${creds.access_token}` } },
      );
      const rbody: any = await resp.json().catch(() => ({}));
      if (resp.ok && rbody?.success !== false) {
        metaDeleted = true;
      } else {
        const msg = rbody?.error?.message || `Meta error ${resp.status}`;
        // Already gone on Meta -> treat as deleted
        if (/does not exist|not found|Unknown/i.test(msg)) metaDeleted = true;
        else metaError = msg;
      }
    } else {
      metaError = 'WhatsApp API credentials missing — removed locally only';
    }

    if (metaError && !metaDeleted) return json({ error: metaError }, 400);

    const { error: delErr } = await admin.from('templates').delete().eq('id', template_id);
    if (delErr) return json({ error: delErr.message }, 400);

    return json({ ok: true, meta_deleted: metaDeleted, warning: metaError });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

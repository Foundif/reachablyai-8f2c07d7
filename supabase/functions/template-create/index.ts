import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Submits a template directly to Meta and stores the returned status.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { workspace_id, name, category, language, header, body, footer } = await req.json();
    if (!workspace_id || !name || !body) return json({ error: 'workspace_id, name and body required' }, 400);

    const { data: mem } = await admin.from('workspace_members').select('user_id')
      .eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);

    const { data: creds } = await admin.from('whatsapp_credentials').select('*').eq('workspace_id', workspace_id).maybeSingle();
    if (!creds?.access_token || !creds?.waba_id) return json({ error: 'Set WhatsApp API credentials (WABA ID & access token) first' }, 400);

    // Convert {{var}} -> {{1}}, {{2}} for Meta
    const vars: string[] = [];
    const metaBody = body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_: string, v: string) => {
      if (!vars.includes(v)) vars.push(v);
      return `{{${vars.indexOf(v) + 1}}}`;
    });

    const components: any[] = [];
    if (header) components.push({ type: 'HEADER', format: 'TEXT', text: header });
    const bodyComp: any = { type: 'BODY', text: metaBody };
    if (vars.length) bodyComp.example = { body_text: [vars.map(v => `sample_${v}`)] };
    components.push(bodyComp);
    if (footer) components.push({ type: 'FOOTER', text: footer });

    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const catUpper = (category || 'MARKETING').toUpperCase();

    const resp = await fetch(`https://graph.facebook.com/v20.0/${creds.waba_id}/message_templates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanName, language: language || 'en',
        category: catUpper, components,
      }),
    });
    const rbody = await resp.json();
    if (!resp.ok) return json({ error: rbody?.error?.message || `Meta error ${resp.status}`, meta: rbody?.error }, 400);

    const { error } = await admin.from('templates').insert({
      workspace_id, name: cleanName, category: catUpper.toLowerCase(), language: language || 'en',
      body, header: header || null, footer: footer || null, variables: vars,
      status: (rbody?.status || 'PENDING').toLowerCase(),
      meta_template_id: rbody?.id || null,
      synced_at: new Date().toISOString(), created_by: user.id,
    });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, meta_id: rbody?.id, status: rbody?.status });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

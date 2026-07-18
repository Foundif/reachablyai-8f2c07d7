import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Fetches all templates from Meta and upserts them locally.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { workspace_id } = await req.json();
    if (!workspace_id) return json({ error: 'workspace_id required' }, 400);

    const { data: mem } = await admin.from('workspace_members').select('user_id')
      .eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);

    const { data: creds } = await admin.from('whatsapp_credentials').select('*').eq('workspace_id', workspace_id).maybeSingle();
    if (!creds?.access_token || !creds?.waba_id) return json({ error: 'WhatsApp API credentials missing' }, 400);

    let url: string | null = `https://graph.facebook.com/v20.0/${creds.waba_id}/message_templates?limit=200&fields=name,status,category,language,components,id,quality_score,rejected_reason`;
    let synced = 0;
    while (url) {
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${creds.access_token}` } });
      const rbody: any = await resp.json();
      if (!resp.ok) return json({ error: rbody?.error?.message || `Meta error ${resp.status}` }, 400);

      for (const t of rbody.data || []) {
        const bodyComp = (t.components || []).find((c: any) => c.type === 'BODY');
        const headerComp = (t.components || []).find((c: any) => c.type === 'HEADER');
        const footerComp = (t.components || []).find((c: any) => c.type === 'FOOTER');
        const btns = (t.components || []).find((c: any) => c.type === 'BUTTONS');
        const rawBody = bodyComp?.text || '';
        const varCount = (rawBody.match(/\{\{\d+\}\}/g) || []).length;
        const variables = Array.from({ length: varCount }, (_, i) => `var${i + 1}`);

        await admin.from('templates').upsert({
          workspace_id,
          name: t.name,
          category: (t.category || 'MARKETING').toLowerCase(),
          language: t.language || 'en',
          body: rawBody,
          header: headerComp?.text || null,
          footer: footerComp?.text || null,
          buttons: btns?.buttons || null,
          variables,
          status: (t.status || 'pending').toLowerCase(),
          meta_template_id: t.id,
          rejection_reason: t.rejected_reason || null,
          synced_at: new Date().toISOString(),
          created_by: user.id,
        }, { onConflict: 'workspace_id,name,language' });
        synced++;
      }
      url = rbody?.paging?.next || null;
    }

    return json({ ok: true, synced });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

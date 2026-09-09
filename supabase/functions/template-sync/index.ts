import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Meta -> our status
const mapStatus = (s: string) => {
  const k = (s || '').toUpperCase();
  if (k === 'APPROVED' || k === 'ACTIVE') return 'approved';
  if (k === 'REJECTED') return 'rejected';
  if (k === 'PAUSED') return 'paused';
  if (k === 'DISABLED') return 'disabled';
  if (k === 'PENDING' || k === 'PENDING_REVIEW' || k === 'IN_REVIEW' || k === 'SUBMITTED') return 'pending';
  if (k === 'IN_APPEAL') return 'in_appeal';
  if (k === 'PENDING_DELETION') return 'pending_deletion';
  if (k === 'DELETED') return 'deleted';
  return 'pending';
};

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

    let url: string | null = `https://graph.facebook.com/v20.0/${creds.waba_id}/message_templates?limit=200&fields=name,status,category,language,parameter_format,components,id,quality_score,rejected_reason`;
    let synced = 0;
    let listError: string | null = null;
    while (url) {
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${creds.access_token}` } });
      const rbody: any = await resp.json();
      if (!resp.ok) {
        listError = rbody?.error?.message || `Meta error ${resp.status}`;
        break;
      }

      for (const t of rbody.data || []) {
        const comps = t.components || [];
        const bodyComp = comps.find((c: any) => c.type === 'BODY');
        const headerComp = comps.find((c: any) => c.type === 'HEADER');
        const footerComp = comps.find((c: any) => c.type === 'FOOTER');
        const btns = comps.find((c: any) => c.type === 'BUTTONS');
        const carouselComp = comps.find((c: any) => c.type === 'CAROUSEL');

        const rawBody = bodyComp?.text || '';
        const variables = Array.from(rawBody.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g), (m: any) => m[1]);

        let header_type = 'none';
        let header_media_url: string | null = null;
        if (headerComp) {
          const fmt = (headerComp.format || 'TEXT').toLowerCase();
          header_type = fmt === 'text' ? 'text' : fmt;
          const ex = headerComp.example;
          if (ex?.header_handle?.length) header_media_url = ex.header_handle[0];
          else if (ex?.header_url?.length) header_media_url = ex.header_url[0];
          // Meta returns opaque upload handles for media headers. Those are not
          // displayable URLs, so keep whatever we already stored locally.
          if (header_media_url && !/^https?:\/\//i.test(header_media_url)) header_media_url = null;
        }
        if (carouselComp) header_type = 'carousel';

        let localCards: any[] = [];
        if (carouselComp) {
          const { data: existing } = await admin.from('templates').select('carousel_cards')
            .eq('workspace_id', workspace_id).eq('name', t.name).eq('language', t.language || 'en').maybeSingle();
          localCards = Array.isArray(existing?.carousel_cards) ? existing!.carousel_cards as any[] : [];
        }

        const { error: upsertErr } = await admin.from('templates').upsert({
          workspace_id,
          name: t.name,
          category: (t.category || 'MARKETING').toLowerCase(),
          language: t.language || 'en',
          body: rawBody,
          header: headerComp?.text || null,
          header_type,
          ...(header_media_url ? { header_media_url } : {}),
          footer: footerComp?.text || null,
          buttons: btns?.buttons || null,
          ...(carouselComp ? { carousel_cards: normalizeCards(carouselComp.cards, localCards) } : {}),
          variables,
          parameter_format: (t.parameter_format || (variables.some((v: string) => !/^\d+$/.test(v)) ? 'NAMED' : 'POSITIONAL')).toUpperCase(),
          status: mapStatus(t.status),
          meta_template_id: t.id,
          rejection_reason: t.rejected_reason || null,
          synced_at: new Date().toISOString(),
          created_by: user.id,
        }, { onConflict: 'workspace_id,name,language' });
        if (upsertErr) throw upsertErr;
        synced++;
      }
      url = rbody?.paging?.next || null;
    }

    if (listError) {
      const { data: localTemplates } = await admin.from('templates')
        .select('id, meta_template_id, carousel_cards')
        .eq('workspace_id', workspace_id)
        .not('meta_template_id', 'is', null);

      for (const local of localTemplates || []) {
        const resp = await fetch(`https://graph.facebook.com/v20.0/${local.meta_template_id}?fields=name,status,category,language,parameter_format,components,id,quality_score,rejected_reason`, {
          headers: { Authorization: `Bearer ${creds.access_token}` },
        });
        const t: any = await resp.json();
        if (!resp.ok) continue;
        const comps = t.components || [];
        const bodyComp = comps.find((c: any) => c.type === 'BODY');
        const headerComp = comps.find((c: any) => c.type === 'HEADER');
        const footerComp = comps.find((c: any) => c.type === 'FOOTER');
        const btns = comps.find((c: any) => c.type === 'BUTTONS');
        const carouselComp = comps.find((c: any) => c.type === 'CAROUSEL');
        const rawBody = bodyComp?.text || '';
        const variables = Array.from(rawBody.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g), (m: any) => m[1]);
        let header_type = 'none';
        let header_media_url: string | null = null;
        if (headerComp) {
          const fmt = (headerComp.format || 'TEXT').toLowerCase();
          header_type = fmt === 'text' ? 'text' : fmt;
          const ex = headerComp.example;
          if (ex?.header_handle?.length) header_media_url = ex.header_handle[0];
          else if (ex?.header_url?.length) header_media_url = ex.header_url[0];
          // Meta returns opaque upload handles for media headers. Those are not
          // displayable URLs, so keep whatever we already stored locally.
          if (header_media_url && !/^https?:\/\//i.test(header_media_url)) header_media_url = null;
        }
        if (carouselComp) header_type = 'carousel';
        const { error: updateErr } = await admin.from('templates').update({
          name: t.name,
          category: (t.category || 'MARKETING').toLowerCase(),
          language: t.language || 'en',
          body: rawBody,
          header: headerComp?.text || null,
          header_type,
          ...(header_media_url ? { header_media_url } : {}),
          footer: footerComp?.text || null,
          buttons: btns?.buttons || null,
          ...(carouselComp ? { carousel_cards: normalizeCards(carouselComp.cards, Array.isArray(local.carousel_cards) ? local.carousel_cards as any[] : []) } : {}),
          variables,
          parameter_format: (t.parameter_format || (variables.some((v: string) => !/^\d+$/.test(v)) ? 'NAMED' : 'POSITIONAL')).toUpperCase(),
          status: mapStatus(t.status),
          rejection_reason: t.rejected_reason || null,
          synced_at: new Date().toISOString(),
        }).eq('id', local.id);
        if (!updateErr) synced++;
      }

      if (synced === 0) {
        await admin.from('whatsapp_credentials').update({ last_error: listError }).eq('workspace_id', workspace_id);
        return json({ error: `${listError}. Check that the saved WABA ID belongs to this WhatsApp Business account and the token has whatsapp_business_management permission.` }, 400);
      }
    }

    return json({ ok: true, synced, warning: listError || null });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

/** Keeps Meta's synced carousel cards in the shape the app renders and sends. */
function normalizeCards(cards: any[], localCards: any[] = []): any[] {
  return (cards || []).map((card: any, i: number) => {
    const comps = card?.components || [];
    const header = comps.find((c: any) => c.type === 'HEADER');
    const body = comps.find((c: any) => c.type === 'BODY');
    const buttons = comps.find((c: any) => c.type === 'BUTTONS');
    const raw = header?.example?.header_url?.[0] || null;
    // Meta returns opaque upload handles (not displayable/downloadable URLs) for
    // card media, so never let a sync wipe the media we already store locally.
    const local = localCards?.[i] || {};
    const remoteUrl = raw && /^https?:\/\//i.test(raw) ? raw : null;
    return {
      ...local,
      header_type: String(header?.format || local.header_type || 'IMAGE').toLowerCase(),
      header_media_url: remoteUrl || local.header_media_url || null,
      body: body?.text || local.body || '',
      buttons: (buttons?.buttons?.length ? buttons.buttons : local.buttons) || [],
    };
  });
}

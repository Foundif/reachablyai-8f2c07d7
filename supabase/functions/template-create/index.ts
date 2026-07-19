import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Submits (or edits) a template on Meta and stores the returned status.
// Supports text/image/video/document headers, quick-reply / URL / phone buttons, and carousel cards.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const {
      workspace_id, name, category, language, header, body, footer,
      header_type = 'none', header_media_url = null,
      buttons = [], carousel_cards = [], template_id,
    } = await req.json();
    if (!workspace_id || !name) return json({ error: 'workspace_id and name required' }, 400);

    const { data: mem } = await admin.from('workspace_members').select('user_id')
      .eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);

    const { data: creds } = await admin.from('whatsapp_credentials').select('*').eq('workspace_id', workspace_id).maybeSingle();
    if (!creds?.access_token || !creds?.waba_id) return json({ error: 'Set WhatsApp API credentials (WABA ID & access token) first' }, 400);

    // Convert {{var}} -> {{1}}, {{2}} for Meta
    const vars: string[] = [];
    const toMetaBody = (txt: string) => txt.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_: string, v: string) => {
      if (!vars.includes(v)) vars.push(v);
      return `{{${vars.indexOf(v) + 1}}}`;
    });

    const catUpper = (category || 'MARKETING').toUpperCase();
    const isCarousel = header_type === 'carousel' || catUpper === 'CAROUSEL';
    const components: any[] = [];

    if (isCarousel) {
      if (body) {
        const metaBody = toMetaBody(body);
        const bc: any = { type: 'BODY', text: metaBody };
        if (vars.length) bc.example = { body_text: [vars.map(v => `sample_${v}`)] };
        components.push(bc);
      }
      const cards = (carousel_cards || []).slice(0, 10).map((card: any) => {
        const cardVars: string[] = [];
        const cardBody = String(card.body || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_: string, v: string) => {
          if (!cardVars.includes(v)) cardVars.push(v);
          return `{{${cardVars.indexOf(v) + 1}}}`;
        });
        const cComps: any[] = [];
        if (card.header_media_url) {
          cComps.push({ type: 'HEADER', format: (card.header_type || 'image').toUpperCase(),
            example: { header_handle: [card.header_media_url] } });
        }
        const bc: any = { type: 'BODY', text: cardBody };
        if (cardVars.length) bc.example = { body_text: [cardVars.map(v => `sample_${v}`)] };
        cComps.push(bc);
        if (Array.isArray(card.buttons) && card.buttons.length) {
          cComps.push({ type: 'BUTTONS', buttons: card.buttons });
        }
        return { components: cComps };
      });
      components.push({ type: 'CAROUSEL', cards });
    } else {
      // HEADER
      if (header_type === 'text' && header) {
        components.push({ type: 'HEADER', format: 'TEXT', text: header });
      } else if (['image', 'video', 'document'].includes(header_type) && header_media_url) {
        components.push({
          type: 'HEADER',
          format: header_type.toUpperCase(),
          example: { header_handle: [header_media_url] },
        });
      }
      // BODY
      const metaBody = body ? toMetaBody(body) : '';
      const bodyComp: any = { type: 'BODY', text: metaBody };
      if (vars.length) bodyComp.example = { body_text: [vars.map(v => `sample_${v}`)] };
      components.push(bodyComp);
      // FOOTER
      if (footer) components.push({ type: 'FOOTER', text: footer });
      // BUTTONS
      if (Array.isArray(buttons) && buttons.length) {
        const cleaned = buttons.slice(0, 10).map((b: any) => {
          if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
          if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number };
          return { type: 'QUICK_REPLY', text: b.text };
        });
        components.push({ type: 'BUTTONS', buttons: cleaned });
      }
    }

    const cleanName = String(name).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const finalCat = isCarousel ? 'MARKETING' : catUpper; // Carousel goes under MARKETING category at Meta

    let metaId = template_id as string | null;
    let rbody: any = null;
    let status = 'pending';

    if (metaId) {
      // Edit existing template — Meta only allows editing components (not name/language)
      const resp = await fetch(`https://graph.facebook.com/v20.0/${metaId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: finalCat, components }),
      });
      rbody = await resp.json();
      if (!resp.ok) return json({ error: rbody?.error?.message || `Meta error ${resp.status}`, meta: rbody?.error }, 400);
      status = 'pending';
    } else {
      const resp = await fetch(`https://graph.facebook.com/v20.0/${creds.waba_id}/message_templates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, language: language || 'en', category: finalCat, components }),
      });
      rbody = await resp.json();
      if (!resp.ok) return json({ error: rbody?.error?.message || `Meta error ${resp.status}`, meta: rbody?.error }, 400);
      metaId = rbody?.id || null;
      status = (rbody?.status || 'PENDING').toLowerCase();
    }

    await admin.from('templates').upsert({
      workspace_id, name: cleanName, category: isCarousel ? 'carousel' : finalCat.toLowerCase(),
      language: language || 'en',
      body: body || '', header: header_type === 'text' ? header : null,
      header_type, header_media_url,
      footer: footer || null, variables: vars,
      buttons: !isCarousel && buttons?.length ? buttons : null,
      carousel_cards: isCarousel ? carousel_cards : null,
      status, meta_template_id: metaId, rejection_reason: null,
      synced_at: new Date().toISOString(), created_by: user.id,
    }, { onConflict: 'workspace_id,name,language' });

    return json({ ok: true, meta_id: metaId, status });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { signMediaUrl } from '../_shared/signedMedia.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { chargeCredits, refundCredits, categoryOf, CREDIT_COST, MessageCategory } from '../_shared/credits.ts';
import { buildTemplatePayload, validateCarouselTemplate } from '../_shared/templatePayload.ts';

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

    const { conversation_id, workspace_id, to, body, template_id, media_url, media_type, filename, location, variables } = await req.json();
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

    // Resolve the contact's display name for template variable mapping
    let contactName = '';
    {
      const { data: conv } = await admin.from('wa_conversations').select('contact_name').eq('id', convId).maybeSingle();
      contactName = (conv?.contact_name || '').trim();
      if (!contactName) {
        const { data: lead } = await admin.from('leads').select('name').eq('workspace_id', workspace_id).eq('phone', to).maybeSingle();
        contactName = (lead?.name || '').trim();
      }
      if (!contactName || /^\+?\d+$/.test(contactName)) contactName = 'there';
    }

    /** Upload bytes to Meta and return a media id (more reliable than link for voice notes). */
    const uploadToMeta = async (url: string, kind: string, name?: string) => {
      const fileRes = await fetch(url);
      if (!fileRes.ok) throw new Error(`Could not read uploaded media (${fileRes.status})`);
      const blob = await fileRes.blob();
      const mime = blob.type && blob.type !== 'application/octet-stream'
        ? blob.type
        : (kind === 'audio' ? 'audio/ogg' : kind === 'image' ? 'image/jpeg' : kind === 'video' ? 'video/mp4' : 'application/pdf');
      const fd = new FormData();
      fd.append('messaging_product', 'whatsapp');
      fd.append('type', mime);
      fd.append('file', new File([blob], name || url.split('/').pop() || 'file', { type: mime }));
      const up = await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/media`, {
        method: 'POST', headers: { Authorization: `Bearer ${creds.access_token}` }, body: fd,
      });
      const upBody = await up.json();
      if (!up.ok || !upBody?.id) throw new Error(upBody?.error?.message || 'Meta rejected the media upload');
      return upBody.id as string;
    };

    // Build request
    let waPayload: any = { messaging_product: 'whatsapp', to, type: 'text', text: { body } };
    let msgType = 'text', tplName: string | null = null;

    if (location && location.latitude && location.longitude) {
      msgType = 'location';
      waPayload = {
        messaging_product: 'whatsapp', to, type: 'location',
        location: {
          latitude: Number(location.latitude), longitude: Number(location.longitude),
          ...(location.name ? { name: location.name } : {}),
          ...(location.address ? { address: location.address } : {}),
        },
      };
    } else if (media_url && media_type) {
      const signedMediaUrl = await signMediaUrl(admin, media_url);
      const kind = ['image', 'video', 'audio', 'document', 'sticker'].includes(media_type) ? media_type : 'document';
      msgType = kind;
      const payload: any = {};
      // Voice notes must be uploaded as bytes (ogg/opus); links are rejected by Meta.
      if (kind === 'audio') {
        payload.id = await uploadToMeta(signedMediaUrl, kind, filename);
      } else {
        payload.link = signedMediaUrl;
      }
      if (kind === 'image' || kind === 'video' || kind === 'document') { if (body) payload.caption = body; }
      if (kind === 'document' && filename) payload.filename = filename;
      waPayload = { messaging_product: 'whatsapp', to, type: kind, [kind]: payload };
    }

    let category: MessageCategory = 'service';
    if (template_id) {
      const { data: tpl } = await admin.from('templates').select('*').eq('id', template_id).maybeSingle();
      if (!tpl) return json({ error: 'Template not found' }, 404);
      if (tpl.status !== 'approved') return json({ error: 'Template must be approved' }, 400);
      msgType = 'template';
      tplName = tpl.name;
      category = categoryOf(tpl.category);

      const supplied: Record<string, string> = (variables && typeof variables === 'object') ? variables : {};

      // Carousel cards live in private storage — sign each card's media and block
      // malformed carousels before Meta rejects the whole message.
      let tplForSend: any = { ...tpl, header_media_url: await signMediaUrl(admin, tpl.header_media_url) };
      if (Array.isArray(tpl.carousel_cards) && tpl.carousel_cards.length) {
        const problems = validateCarouselTemplate(tpl as any);
        if (problems.length) return json({ error: problems.join(' ') }, 400);
        tplForSend.carousel_cards = await Promise.all((tpl.carousel_cards as any[]).map(async (c: any) => ({
          ...c, header_media_url: await signMediaUrl(admin, c.header_media_url),
        })));
      }

      waPayload = {
        messaging_product: 'whatsapp', to, type: 'template',
        template: buildTemplatePayload(tplForSend, { name: contactName, phone: to, variables: supplied }),
      };

      console.log('[whatsapp-send] template payload', JSON.stringify(waPayload));
    }

    // Charge the prepaid wallet (allows the credit buffer to go slightly negative).
    // Marketing templates cost more credits to cover Meta's conversation pricing.
    const charge = await chargeCredits(admin, workspace_id, 1, category);
    if (!charge.ok) return json({ error: charge.reason, code: 'insufficient_credits', balance: charge.balance }, 402);

    console.log('[whatsapp-send] final payload to Meta', JSON.stringify(waPayload));
    const resp = await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(waPayload),
    });
    const rbody = await resp.json();
    if (!resp.ok) {
      await refundCredits(admin, workspace_id, 1, category);
      const err = rbody?.error?.message || `HTTP ${resp.status}`;
      await admin.from('wa_messages').insert({
        workspace_id, conversation_id: convId, direction: 'outbound',
        from_phone: creds.business_phone, to_phone: to, body: body || tplName || (msgType === 'location' ? '📍 Location' : null), message_type: msgType,
        template_name: tplName, media_url: media_url || null, status: 'failed', error: err, sent_by: user.id,
      });
      return json({ error: err }, 400);
    }
    const wamid = rbody?.messages?.[0]?.id || null;

    await admin.from('wa_messages').insert({
      workspace_id, conversation_id: convId, direction: 'outbound', wa_message_id: wamid,
      from_phone: creds.business_phone, to_phone: to, body: body || tplName || (msgType === 'location' ? '📍 Location' : null), message_type: msgType,
      template_name: tplName, media_url: media_url || null, status: 'sent', sent_by: user.id,
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

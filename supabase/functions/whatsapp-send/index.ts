import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { signMediaUrl } from '../_shared/signedMedia.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkMessageQuota } from '../_shared/plans.ts';
import { buildTemplatePayload, validateCarouselTemplate } from '../_shared/templatePayload.ts';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

    // Trusted server-to-server call from another Reachably edge function (public API).
    const isInternal = (req.headers.get('x-reachably-internal') || '') === serviceKey;

    let actorId: string | null = null;
    if (!isInternal) {
      const authHeader = req.headers.get('Authorization') || '';
      const jwt = authHeader.replace('Bearer ', '');
      if (!jwt) return json({ error: 'Unauthorized' }, 401);
      const { data: userData } = await admin.auth.getUser(jwt);
      const user = userData?.user;
      if (!user) return json({ error: 'Unauthorized' }, 401);
      actorId = user.id;
    }

    const { conversation_id, workspace_id, whatsapp_credential_id, to, body, template_id, media_url, media_type, filename, location, variables } = await req.json();
    if (!workspace_id || !to) return json({ error: 'workspace_id and to required' }, 400);

    if (!isInternal) {
      // Verify membership
      const { data: mem } = await admin.from('workspace_members').select('user_id').eq('workspace_id', workspace_id).eq('user_id', actorId!).maybeSingle();
      if (!mem) return json({ error: 'Not a workspace member' }, 403);
    }

    let credsQuery = admin.from('whatsapp_credentials').select('*').eq('workspace_id', workspace_id);
    if (whatsapp_credential_id) credsQuery = credsQuery.eq('id', whatsapp_credential_id);
    const { data: creds } = await credsQuery.order('is_primary', { ascending: false }).limit(1).maybeSingle();
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

    if (template_id) {
      const { data: tpl } = await admin.from('templates').select('*').eq('id', template_id).maybeSingle();
      if (!tpl) return json({ error: 'Template not found' }, 404);
      if (tpl.status !== 'approved') return json({ error: 'Template must be approved' }, 400);
      msgType = 'template';
      tplName = tpl.name;

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

    // Enforce this month's plan message allowance.
    const quota = await checkMessageQuota(admin, workspace_id, 1);
    if (!quota.ok) return json({ error: quota.reason, code: 'quota_exceeded', used: quota.used, limit: quota.limit }, 402);

    console.log('[whatsapp-send] final payload to Meta', JSON.stringify(waPayload));
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
        from_phone: creds.business_phone, to_phone: to, body: body || tplName || (msgType === 'location' ? '📍 Location' : null), message_type: msgType,
        template_name: tplName, media_url: media_url || null, status: 'failed', error: err, sent_by: actorId,
      });
      return json({ error: err }, 400);
    }
    const wamid = rbody?.messages?.[0]?.id || null;

    await admin.from('wa_messages').insert({
      workspace_id, conversation_id: convId, direction: 'outbound', wa_message_id: wamid,
      from_phone: creds.business_phone, to_phone: to, body: body || tplName || (msgType === 'location' ? '📍 Location' : null), message_type: msgType,
      template_name: tplName, media_url: media_url || null, status: 'sent', sent_by: actorId,
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

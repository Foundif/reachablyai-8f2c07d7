// Bulk-send dispatcher: template + free-form (text/images), 24h window aware.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildTemplatePayload } from '../_shared/templatePayload.ts';

const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) return json({ error: 'campaign_id required' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: campaign } = await admin.from('campaigns').select('*').eq('id', campaign_id).maybeSingle();
    if (!campaign) return json({ error: 'Campaign not found' }, 404);

    const { data: creds } = await admin.from('whatsapp_credentials').select('*').eq('workspace_id', campaign.workspace_id).maybeSingle();
    if (!creds?.access_token || !creds?.phone_number_id) {
      return json({ error: 'WhatsApp Cloud API not configured. Set credentials in Settings first.' }, 400);
    }

    const mode = campaign.mode || 'template';
    let template: any = null;
    if (mode === 'template') {
      const { data: t } = await admin.from('templates').select('*').eq('id', campaign.template_id).maybeSingle();
      if (!t) return json({ error: 'Template not found' }, 404);
      if (t.status !== 'approved') return json({ error: 'Template not approved by Meta.' }, 400);
      template = t;
    }

    const { data: recipients } = await admin.from('campaign_recipients')
      .select('*').eq('campaign_id', campaign_id).in('status', ['pending', 'failed']);
    if (!recipients?.length) return json({ error: 'No pending recipients' }, 400);

    await admin.from('campaigns').update({ status: 'sending', started_at: new Date().toISOString() }).eq('id', campaign_id);

    const mediaUrls: string[] = Array.isArray(campaign.media_urls) ? campaign.media_urls : [];
    const bodyText: string = campaign.body_text || '';

    // Meta's synced preview CDN URLs frequently reject server-side downloads
    // with 403. Upload the header once and reuse its durable media id.
    if (mode === 'template' && ['image', 'video', 'document'].includes(String(template.header_type || '').toLowerCase())) {
      template = { ...template, header_media_id: await uploadToMeta(admin, creds, campaign.workspace_id, template.header_media_url, template.header_type) };
    }

    let sent = 0, failed = 0, skipped = 0;

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];

      // Free-form: enforce 24h customer service window
      if (mode === 'freeform') {
        const { data: conv } = await admin.from('wa_conversations')
          .select('window_expires_at')
          .eq('workspace_id', campaign.workspace_id)
          .eq('contact_phone', r.phone).maybeSingle();
        const openUntil = conv?.window_expires_at ? new Date(conv.window_expires_at).getTime() : 0;
        if (openUntil < Date.now()) {
          await admin.from('campaign_recipients').update({
            status: 'skipped', reachable: false,
            reason: 'Outside 24h window — free-form messages need customer to message first, or use an approved template.',
          }).eq('id', r.id);
          skipped++;
          await admin.from('campaigns').update({
            skipped_count: (campaign.skipped_count || 0) + skipped,
            progress: { done: i + 1, total: recipients.length },
          }).eq('id', campaign_id);
          continue;
        }
      }

      try {
        if (mode === 'template') {
          const payload = {
            messaging_product: 'whatsapp', to: r.phone, type: 'template',
            template: buildTemplatePayload(template, { name: r.name, phone: r.phone, variables: r.variables }),
          };
          console.log('[campaign-dispatch] final template payload', JSON.stringify(payload));
          const resp = await metaSend(creds, payload);
          const ok = await handleResp(admin, r, resp, `[template:${template.name}]`);
          if (ok) sent++; else failed++;
        } else {
          // Free-form: optional images (sequence), then text.
          let anyFail: string | null = null;
          for (const url of mediaUrls) {
            const resp = await metaSend(creds, {
              messaging_product: 'whatsapp', to: r.phone, type: 'image',
              image: { link: url, ...(bodyText && mediaUrls.length === 1 ? { caption: personalize(bodyText, r) } : {}) },
            });
            if (!resp.ok) { anyFail = resp.error; break; }
            await sleep(700);
          }
          if (!anyFail && bodyText && !(mediaUrls.length === 1)) {
            const resp = await metaSend(creds, {
              messaging_product: 'whatsapp', to: r.phone, type: 'text',
              text: { body: personalize(bodyText, r), preview_url: true },
            });
            if (!resp.ok) anyFail = resp.error;
          }
          if (anyFail) {
            await admin.from('campaign_recipients').update({ status: 'failed', error: anyFail }).eq('id', r.id);
            failed++;
          } else {
            await admin.from('campaign_recipients').update({ status: 'sent', sent_at: new Date().toISOString(), error: null, reachable: true }).eq('id', r.id);
            sent++;
          }
        }
      } catch (e) {
        await admin.from('campaign_recipients').update({ status: 'failed', error: String(e) }).eq('id', r.id);
        failed++;
      }

      await admin.from('campaigns').update({
        sent_count: (campaign.sent_count || 0) + sent,
        failed_count: (campaign.failed_count || 0) + failed,
        skipped_count: (campaign.skipped_count || 0) + skipped,
        progress: { done: i + 1, total: recipients.length },
      }).eq('id', campaign_id);

      // Approved templates and active service-window messages are dispatched
      // immediately; Meta applies the account's own throughput limits.
    }

    const finalStatus = failed === recipients.length ? 'failed' : 'sent';
    await admin.from('campaigns').update({
      status: finalStatus, completed_at: new Date().toISOString(),
    }).eq('id', campaign_id);

    return json({ sent, failed, skipped, total: recipients.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function personalize(txt: string, r: any) {
  return txt.replaceAll('{{name}}', r.name || '').replaceAll('{{phone}}', r.phone || '');
}

async function metaSend(creds: any, payload: any): Promise<{ ok: boolean; id?: string; error?: string }> {
  const resp = await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await resp.json();
  if (!resp.ok) return { ok: false, error: body?.error?.message || `HTTP ${resp.status}` };
  return { ok: true, id: body?.messages?.[0]?.id };
}

async function uploadToMeta(admin: any, creds: any, workspaceId: string, url: string, kind: string): Promise<string> {
  if (!url) throw new Error(`Template ${kind} header has no reusable media. Re-upload the header in Templates and retry.`);
  const fileRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  let blob: Blob | null = fileRes.ok ? await fileRes.blob() : null;
  // Synced Meta example URLs expire or reject server downloads. Templates
  // created in Reachably retain their original upload, so use that instead.
  if (!blob) {
    const { data: files } = await admin.storage.from('salon-assets').list(`template-media/${workspaceId}`, {
      limit: 100, sortBy: { column: 'created_at', order: 'desc' },
    });
    const expected = kind === 'image' ? 'image/' : kind === 'video' ? 'video/' : 'application/';
    const source = (files || []).find((file: any) => String(file.metadata?.mimetype || '').startsWith(expected));
    if (source?.name) {
      const { data } = await admin.storage.from('salon-assets').download(`template-media/${workspaceId}/${source.name}`);
      blob = data || null;
    }
  }
  if (!blob) throw new Error(`Template header media is no longer accessible (${fileRes.status}). Re-upload it in Templates and retry.`);
  const mime = blob.type || (kind === 'image' ? 'image/jpeg' : kind === 'video' ? 'video/mp4' : 'application/pdf');
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mime);
  form.append('file', new File([blob], `template-header.${kind === 'document' ? 'pdf' : kind === 'video' ? 'mp4' : 'jpg'}`, { type: mime }));
  const response = await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/media`, {
    method: 'POST', headers: { Authorization: `Bearer ${creds.access_token}` }, body: form,
  });
  const result = await response.json();
  if (!response.ok || !result?.id) throw new Error(result?.error?.message || 'Meta rejected the template header upload');
  return result.id;
}

async function handleResp(admin: any, r: any, resp: { ok: boolean; id?: string; error?: string }, label: string) {
  if (!resp.ok) {
    await admin.from('campaign_recipients').update({ status: 'failed', error: resp.error }).eq('id', r.id);
    return false;
  }
  await admin.from('campaign_recipients').update({
    status: 'sent', meta_message_id: resp.id, sent_at: new Date().toISOString(), error: null, reachable: true,
  }).eq('id', r.id);
  return true;
}

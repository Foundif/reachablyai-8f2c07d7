import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractFlowResponse, flowSummary, handleFlowSubmission } from '../_shared/flowIntake.ts';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Send a WhatsApp free-form text and log it as an outbound message + auto_reply_log entry
async function sendAutoReply(admin: any, creds: any, workspace_id: string, convId: string, to: string, text: string, ruleKind: string, ruleRef: string | null) {
  try {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    });
    const rb = await resp.json();
    const ok = resp.ok;
    const wamid = rb?.messages?.[0]?.id || null;
    const err = ok ? null : (rb?.error?.message || `HTTP ${resp.status}`);
    await admin.from('wa_messages').insert({
      workspace_id, conversation_id: convId, direction: 'outbound', wa_message_id: wamid,
      from_phone: creds.business_phone, to_phone: to, body: text, message_type: 'text',
      status: ok ? 'sent' : 'failed', error: err,
    });
    if (ok) {
      await admin.from('wa_conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_text: text.slice(0, 200),
        last_message_direction: 'outbound',
      }).eq('id', convId);
      await admin.from('auto_reply_log').insert({ workspace_id, contact_phone: to, rule_kind: ruleKind, rule_ref: ruleRef });
    }
    await admin.from('wa_webhook_events').insert({
      workspace_id, phone_number_id: creds.phone_number_id, event_type: 'auto_reply',
      status: ok ? 'ok' : 'error', summary: `${ruleKind} → ${to}: ${text.slice(0, 60)}`, error: err, payload: { rule_ref: ruleRef },
    });
  } catch (e: any) {
    await admin.from('wa_webhook_events').insert({
      workspace_id, phone_number_id: creds.phone_number_id, event_type: 'auto_reply',
      status: 'error', summary: `auto-reply exception (${ruleKind})`, error: String(e?.message || e),
    });
  }
}

function isWithinBusinessHours(bh: any, timezone: string): boolean {
  if (!bh) return true;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = fmt.formatToParts(new Date());
    const wd = (parts.find(p => p.type === 'weekday')?.value || '').toLowerCase().slice(0, 3);
    const hh = parts.find(p => p.type === 'hour')?.value || '00';
    const mm = parts.find(p => p.type === 'minute')?.value || '00';
    const now = `${hh === '24' ? '00' : hh}:${mm}`;
    const day = bh[wd];
    if (!day || !day.enabled) return false;
    return now >= (day.start || '00:00') && now <= (day.end || '23:59');
  } catch { return true; }
}

async function alreadySentRecently(admin: any, workspace_id: string, phone: string, ruleKind: string, hours = 24): Promise<boolean> {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { data } = await admin.from('auto_reply_log').select('id')
    .eq('workspace_id', workspace_id).eq('contact_phone', phone).eq('rule_kind', ruleKind)
    .gte('sent_at', since).limit(1).maybeSingle();
  return !!data;
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Verification handshake
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = Deno.env.get('WA_WEBHOOK_VERIFY_TOKEN') || 'TheAurax@dmin2027';
    await admin.from('wa_webhook_events').insert({
      event_type: 'verify',
      status: mode === 'subscribe' && token === expected ? 'ok' : 'error',
      summary: `GET verify (mode=${mode})`,
      error: mode === 'subscribe' && token === expected ? null : 'token mismatch',
      payload: { mode, token_len: (token || '').length },
    });
    if (mode === 'subscribe' && token === expected) return new Response(challenge || 'ok', { status: 200 });
    return new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }

  try {
    const entries = payload?.entry || [];
    if (entries.length === 0) {
      await admin.from('wa_webhook_events').insert({
        event_type: 'empty', status: 'error', summary: 'No entries', error: 'no entry[]', payload,
      });
    }
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const v = change.value || {};
        const phoneId = v.metadata?.phone_number_id || null;

        const { data: creds } = phoneId
          ? await admin.from('whatsapp_credentials').select('workspace_id, business_phone, access_token').eq('phone_number_id', phoneId).maybeSingle()
          : { data: null };

        if (!creds) {
          await admin.from('wa_webhook_events').insert({
            phone_number_id: phoneId,
            event_type: change.field || 'unknown',
            status: 'error',
            summary: `No matching workspace for phone_number_id ${phoneId}`,
            error: 'No whatsapp_credentials row matches this phone_number_id. Update WhatsApp Settings.',
            payload: v,
          });
          continue;
        }
        const workspace_id = creds.workspace_id;

        // Inbound messages
        for (const m of v.messages || []) {
          try {
            const from = m.from as string;
            const contactName = v.contacts?.[0]?.profile?.name || null;
            const mediaNode = m.image || m.video || m.audio || m.document || m.sticker || null;
            const mediaKind = m.image ? 'image' : m.video ? 'video' : m.audio ? 'audio'
              : m.document ? 'document' : m.sticker ? 'sticker' : null;
            // WhatsApp Flow submission (nfm_reply) — every field the customer filled in
            const flowFields = extractFlowResponse(m);
            const bodyText =
              (flowFields ? flowSummary(flowFields) : null) ||
              m.text?.body || m.button?.text ||
              m.interactive?.button_reply?.title || m.interactive?.list_reply?.title ||
              mediaNode?.caption ||
              (mediaKind === 'image' ? '\u{1F4F7} Photo' : mediaKind === 'video' ? '\u{1F3A5} Video'
                : mediaKind === 'audio' ? (m.audio?.voice ? '\u{1F3A4} Voice message' : '\u{1F3B5} Audio')
                : mediaKind === 'document' ? `\u{1F4C4} ${m.document?.filename || 'Document'}`
                : mediaKind === 'sticker' ? '\u{1F642} Sticker' : m.type);

            // Download inbound media from Meta and store it so the CRM can render it inline
            let storedMediaUrl: string | null = null;
            if (mediaNode?.id && creds.access_token) {
              try {
                const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaNode.id}`, {
                  headers: { Authorization: `Bearer ${creds.access_token}` },
                });
                const meta = await metaRes.json();
                if (meta?.url) {
                  const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${creds.access_token}` } });
                  if (binRes.ok) {
                    const bytes = new Uint8Array(await binRes.arrayBuffer());
                    const mime = meta.mime_type || binRes.headers.get('content-type') || 'application/octet-stream';
                    const extMap: Record<string, string> = {
                      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
                      'video/mp4': 'mp4', 'video/3gpp': '3gp',
                      'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/amr': 'amr', 'audio/aac': 'aac',
                      'application/pdf': 'pdf',
                    };
                    const ext = extMap[mime.split(';')[0]] || (m.document?.filename?.split('.').pop() ?? 'bin');
                    const path = `chat-media/${workspace_id}/in-${mediaNode.id}.${ext}`;
                    const { error: upErr } = await admin.storage.from('salon-assets')
                      .upload(path, bytes, { contentType: mime.split(';')[0], upsert: true });
                    if (!upErr) {
                      storedMediaUrl = admin.storage.from('salon-assets').getPublicUrl(path).data.publicUrl;
                    }
                  }
                }
              } catch (_) { /* non-fatal: message still stores without media */ }
            }

            // Auto-create/find lead so every inbound customer shows in Leads
            let leadId: string | null = null;
            let isNewContact = false;
            try {
              const { data: existingLead } = await admin.from('leads')
                .select('id').eq('workspace_id', workspace_id).eq('phone', from).maybeSingle();
              if (existingLead) {
                leadId = existingLead.id;
                if (contactName) {
                  await admin.from('leads').update({ name: contactName }).eq('id', leadId).eq('name', from);
                }
              } else {
                isNewContact = true;
                const { data: newLead } = await admin.from('leads').insert({
                  workspace_id, name: contactName || from, phone: from,
                  source: 'manual', status: 'new', tags: ['whatsapp'],
                  notes: `Auto-created from WhatsApp: "${(bodyText || '').slice(0, 100)}"`,
                }).select('id').single();
                leadId = newLead?.id || null;
              }
            } catch (_) { /* non-fatal */ }


            const { data: existing } = await admin.from('wa_conversations')
              .select('id, unread_count, lead_id').eq('workspace_id', workspace_id).eq('contact_phone', from).maybeSingle();

            let convId: string;
            if (existing) {
              convId = existing.id;
              await admin.from('wa_conversations').update({
                contact_name: contactName || undefined,
                last_message_at: new Date().toISOString(),
                last_message_text: (bodyText || '').slice(0, 200),
                last_message_direction: 'inbound',
                unread_count: (existing.unread_count || 0) + 1,
                window_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                status: 'open',
                lead_id: existing.lead_id || leadId,
                deleted_at: null,
              }).eq('id', convId);
            } else {
              const { data: created, error: cErr } = await admin.from('wa_conversations').insert({
                workspace_id, contact_phone: from, contact_name: contactName,
                lead_id: leadId,
                last_message_text: (bodyText || '').slice(0, 200),
                last_message_direction: 'inbound', unread_count: 1,
                window_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
              }).select('id').single();
              if (cErr) throw cErr;
              convId = created!.id;
            }

            const { data: dup } = await admin.from('wa_messages').select('id').eq('wa_message_id', m.id).maybeSingle();
            if (dup) {
              await admin.from('wa_webhook_events').insert({
                workspace_id, phone_number_id: phoneId, event_type: 'message', from_phone: from,
                status: 'skipped', summary: `Duplicate ${m.type} (already stored)`, payload: m,
              });
              continue;
            }

            const { error: mErr } = await admin.from('wa_messages').insert({
              workspace_id, conversation_id: convId, direction: 'inbound',
              wa_message_id: m.id, from_phone: from, to_phone: creds.business_phone,
              body: bodyText, message_type: mediaKind || m.type || 'text', status: 'received',
              media_url: storedMediaUrl,
            });
            if (mErr) throw mErr;

            await admin.from('wa_webhook_events').insert({
              workspace_id, phone_number_id: phoneId, event_type: 'message', from_phone: from,
              status: 'ok', summary: `Inbound ${m.type}: ${(bodyText || '').slice(0, 80)}`, payload: m,
            });

            // ===== WhatsApp Flow submission → CRM record + advance payment link =====
            if (flowFields) {
              try {
                const out = await handleFlowSubmission({
                  admin, creds: { ...creds, phone_number_id: phoneId! },
                  workspace_id, conversation_id: convId, lead_id: leadId, from, fields: flowFields,
                });
                await admin.from('wa_webhook_events').insert({
                  workspace_id, phone_number_id: phoneId, event_type: 'flow_submission', from_phone: from,
                  status: out.linkError ? 'error' : 'ok',
                  summary: `Record ${out.record.record_code} created from Flow`,
                  error: out.linkError, payload: flowFields,
                });
              } catch (flowErr: any) {
                await admin.from('wa_webhook_events').insert({
                  workspace_id, phone_number_id: phoneId, event_type: 'flow_submission', from_phone: from,
                  status: 'error', summary: 'Flow submission could not be saved',
                  error: String(flowErr?.message || flowErr), payload: flowFields,
                });
              }
              continue; // no keyword/welcome auto-reply on top of the booking confirmation
            }

            // ===== Auto-replies pipeline: keyword rules → welcome → away =====
            try {
              let repliedThisTurn = false;

              // 1) Keyword automations (send free-form text if action_type=send_text, else just log run)
              const { data: autos } = await admin.from('automations')
                .select('*').eq('workspace_id', workspace_id).eq('enabled', true).eq('trigger_type', 'keyword_match');
              for (const a of autos || []) {
                const kw = (a.trigger_config?.keyword || '').toLowerCase().trim();
                if (!kw) continue;
                const matchMode = a.trigger_config?.match || 'contains'; // 'contains' | 'exact'
                const hay = (bodyText || '').toLowerCase();
                const matched = matchMode === 'exact' ? hay.trim() === kw : hay.includes(kw);
                if (!matched) continue;

                await admin.from('automation_runs').insert({
                  workspace_id, automation_id: a.id, status: 'matched',
                  detail: `keyword "${kw}" matched`,
                });
                await admin.from('automations').update({
                  run_count: (a.run_count || 0) + 1, last_run_at: new Date().toISOString(),
                }).eq('id', a.id);

                const replyText = a.action_config?.reply_text || (a.action_type === 'send_text' ? a.action_config?.text : null);
                if (replyText && !(await alreadySentRecently(admin, workspace_id, from, `keyword:${a.id}`, 1))) {
                  await sendAutoReply(admin, creds, workspace_id, convId, from, replyText, `keyword:${a.id}`, a.id);
                  repliedThisTurn = true;
                }
              }

              // 2) Welcome + business-hours auto-reply (only if no keyword rule already replied)
              if (!repliedThisTurn) {
                const { data: settings } = await admin.from('workspace_settings')
                  .select('*').eq('workspace_id', workspace_id).maybeSingle();
                if (settings) {
                  const withinHours = isWithinBusinessHours(settings.business_hours, settings.timezone);

                  // Only greet contacts the business never messaged first.
                  // If the chat was started from the CRM (an outbound message exists),
                  // no automatic template/greeting is sent — the agent picks one manually.
                  let businessInitiated = false;
                  try {
                    const { count } = await admin.from('wa_messages')
                      .select('id', { count: 'exact', head: true })
                      .eq('conversation_id', convId).eq('direction', 'outbound');
                    businessInitiated = (count || 0) > 0;
                  } catch (_) { /* ignore */ }

                  if (settings.welcome_enabled && isNewContact && !businessInitiated) {

                    if (!(await alreadySentRecently(admin, workspace_id, from, 'welcome', 24 * 365))) {
                      await sendAutoReply(admin, creds, workspace_id, convId, from, settings.welcome_message, 'welcome', null);
                      repliedThisTurn = true;
                    }
                  }

                  if (!repliedThisTurn && settings.away_enabled && !withinHours) {
                    if (!(await alreadySentRecently(admin, workspace_id, from, 'away', 24))) {
                      await sendAutoReply(admin, creds, workspace_id, convId, from, settings.away_message, 'away', null);
                    }
                  }
                }
              }
            } catch (autoErr: any) {
              await admin.from('wa_webhook_events').insert({
                workspace_id, phone_number_id: phoneId, event_type: 'auto_reply',
                status: 'error', summary: 'auto-reply pipeline failed', error: String(autoErr?.message || autoErr),
              });
            }

          } catch (msgErr: any) {
            await admin.from('wa_webhook_events').insert({
              workspace_id, phone_number_id: phoneId, event_type: 'message', from_phone: m.from,
              status: 'error', summary: `Failed to store inbound ${m.type}`, error: String(msgErr?.message || msgErr), payload: m,
            });
          }
        }

        // Status callbacks (sent → delivered → read). Never downgrade an already higher status.
        const STATUS_RANK: Record<string, number> = { pending: 0, accepted: 1, sent: 2, delivered: 3, read: 4, failed: 5 };
        for (const s of v.statuses || []) {
          const statusError = s.errors?.map((item: any) => item?.error_data?.details || item?.message || item?.title).filter(Boolean).join(' · ') || null;
          const { data: existingMsg } = await admin.from('wa_messages')
            .select('id,status').eq('wa_message_id', s.id).maybeSingle();
          const incomingRank = STATUS_RANK[s.status] ?? 0;
          const currentRank = STATUS_RANK[existingMsg?.status || ''] ?? -1;
          if (existingMsg && incomingRank >= currentRank) {
            await admin.from('wa_messages')
              .update({ status: s.status, ...(statusError ? { error: statusError } : {}) })
              .eq('id', existingMsg.id);
          }

          const { data: changed } = await admin.from('campaign_recipients')
            .update({ status: s.status, error: statusError })
            .eq('meta_message_id', s.id)
            .select('campaign_id')
            .maybeSingle();
          if (changed?.campaign_id) {
            const { data: rows } = await admin.from('campaign_recipients').select('status').eq('campaign_id', changed.campaign_id);
            const counts = (rows || []).reduce((acc: Record<string, number>, row: any) => {
              acc[row.status] = (acc[row.status] || 0) + 1;
              return acc;
            }, {});
            await admin.from('campaigns').update({
              sent_count: (counts.sent || 0) + (counts.delivered || 0) + (counts.read || 0),
              delivered_count: (counts.delivered || 0) + (counts.read || 0),
              read_count: counts.read || 0,
              failed_count: counts.failed || 0,
              status: (rows?.length && (counts.failed || 0) === rows.length) ? 'failed' : 'sent',
            }).eq('id', changed.campaign_id);
          }
          await admin.from('wa_webhook_events').insert({
            workspace_id, phone_number_id: phoneId, event_type: 'status',
            status: 'ok', summary: `Status ${s.status} for ${s.id}`, payload: s,
          });
        }
      }
    }
    return json({ ok: true });
  } catch (e: any) {
    console.error('webhook error', e);
    await admin.from('wa_webhook_events').insert({
      event_type: 'exception', status: 'error', summary: 'Handler threw', error: String(e?.message || e), payload,
    });
    return json({ error: String(e) }, 500);
  }
});

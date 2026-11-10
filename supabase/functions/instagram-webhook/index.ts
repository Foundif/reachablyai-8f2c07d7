// Receives Instagram DMs, postbacks, story replies/mentions and comments; runs automations.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { igProfile, igPublicCommentReply, igSendText } from '../_shared/instagramGraph.ts';
import { findCommentRule, findKeywordReply, postbackReply, windowOpen, privateReplyAllowed, verifySignature, type IgSettings } from '../_shared/instagramRules.ts';
import { aiReplyCreditsFor, aiRepliesUsed, hasActiveSubscription } from '../_shared/plans.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function getConversation(acct: any, token: string, igsid: string) {
  const ws = acct.workspace_id;
  const { data: existing } = await admin.from('wa_conversations').select('id, lead_id, contact_name, created_at, last_message_at')
    .eq('workspace_id', ws).eq('channel', 'instagram').eq('contact_phone', igsid).maybeSingle();
  if (existing) return { conv: existing, isNew: false };
  const { data: reserved, error: reserveError } = await admin.from('wa_conversations').upsert({ workspace_id: ws, channel: 'instagram', contact_phone: igsid, status: 'open', tags: ['instagram'] }, { onConflict: 'workspace_id,channel,contact_phone', ignoreDuplicates: true }).select('id,lead_id,contact_name,created_at,last_message_at').maybeSingle();
  if (reserveError) throw reserveError;
  if (!reserved) { const { data: conv } = await admin.from('wa_conversations').select('id,lead_id,contact_name,created_at,last_message_at').eq('workspace_id',ws).eq('channel','instagram').eq('contact_phone',igsid).single(); return { conv, isNew: false }; }
  const p = await igProfile(igsid, token);
  const name = p.name || (p.username ? `@${p.username}` : null);
  // Every Instagram chat becomes a contact.
  let leadId: string | null = null;
  const { data: lead, error: le } = await admin.from('leads').insert({
    workspace_id: ws, name: name || 'Instagram user', source: 'instagram', status: 'new', tags: ['instagram'],
    notes: `Instagram${p.username ? ` @${p.username}` : ''} (id ${igsid})`,
  }).select('id').single();
  if (!le) leadId = lead.id;
  const { data: conv, error } = await admin.from('wa_conversations').update({ contact_name: name, lead_id: leadId }).eq('id',reserved.id).select('id,lead_id,contact_name,created_at,last_message_at').single();
  if(error) throw error;
  return { conv, isNew: true };
}

async function logMsg(acct: any, convId: string, dir: 'inbound' | 'outbound', peer: string, body: string, extra: Record<string, unknown> = {}) {
  const { error } = await admin.from('wa_messages').insert({
    workspace_id: acct.workspace_id, conversation_id: convId, direction: dir,
    from_phone: dir === 'inbound' ? peer : acct.ig_user_id, to_phone: dir === 'inbound' ? acct.ig_user_id : peer,
    body, message_type: 'text', status: dir === 'inbound' ? 'received' : 'sent', ...extra,
  });
  if(error) throw error;
}

async function reply(acct: any, token: string, convId: string, igsid: string, text: string, kind: string) {
  const r = await igSendText(acct.page_id, token, { id: igsid }, text);
  await logMsg(acct, convId, 'outbound', igsid, text, { wa_message_id: r.id || null, status: r.ok ? 'sent' : 'failed', error: r.error });
  if (r.ok) {
    await admin.from('wa_conversations').update({ last_message_at: new Date().toISOString(), last_message_text: text, last_message_direction: 'outbound' }).eq('id', convId);
    await admin.from('auto_reply_log').insert({ workspace_id: acct.workspace_id, contact_phone: igsid, rule_kind: kind, rule_ref: 'instagram' });
  }
  return r.ok;
}

async function aiReply(acct: any, convId: string): Promise<string> {
  const ws = acct.workspace_id;
  const { data: settings } = await admin.from('workspace_settings').select('ai_reply_enabled, ai_reply_instructions').eq('workspace_id', ws).maybeSingle();
  if (!settings?.ai_reply_enabled || !settings.ai_reply_instructions?.trim()) return '';
  const { data: w } = await admin.from('workspaces').select('name, plan_id').eq('id', ws).maybeSingle();
  if ((await aiRepliesUsed(admin, ws)) >= aiReplyCreditsFor(w?.plan_id)) return '';
  const key = Deno.env.get('LOVABLE_API_KEY'); if (!key) return '';
  const { data: hist } = await admin.from('wa_messages').select('direction, body').eq('conversation_id', convId).order('created_at', { ascending: false }).limit(8);
  const messages = ((hist || []) as any[]).reverse().filter((m) => m.body).map((m) => ({ role: m.direction === 'inbound' ? 'user' : 'assistant', content: String(m.body).slice(0, 800) }));
  const system = `You are the friendly Instagram DM assistant for ${w?.name || 'this business'}. Reply in the customer's language, under 60 words, plain text. If unsure, say a team member will reply shortly. Never invent prices or policies.\n\nBusiness info:\n${settings.ai_reply_instructions.slice(0, 3000)}`;
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ model: 'google/gemini-3.1-flash-lite', messages: [{ role: 'system', content: system }, ...messages] }),
  });
  if (!resp.ok) { const failure = await resp.json().catch(() => ({})); throw new Error(failure.message || `AI replies paused (${resp.status}); check AI settings before retrying.`); }
  const d = await resp.json();
  return String(d?.choices?.[0]?.message?.content || '').trim();
}

async function handleMessaging(acct: any, token: string, ev: any) {
  const s = (acct.settings || {}) as IgSettings;
  const igsid = ev.sender?.id;
  if (!igsid || !/^\d+$/.test(igsid) || igsid === acct.ig_user_id || ev.message?.is_echo || (!ev.message && !ev.postback)) return;
  if(ev.message?.is_deleted || ev.message?.admin_text) return;
  const eventKey = ev.message?.mid || ev.postback?.mid || `${igsid}:${ev.timestamp}:${ev.postback?.payload || ''}`;
  const { data: claim, error: claimError } = await admin.from('instagram_events').insert({workspace_id:acct.workspace_id,event_key:`dm:${eventKey}`,event_type:'message'}).select('id').single();
  if(claimError?.code === '23505') return;
  if(claimError || !claim) throw claimError || new Error('Event could not be claimed.');
  const { conv, isNew } = await getConversation(acct, token, igsid);
  if (!conv) return;
  const msg = ev.message || {};
  const storyMention = (msg.attachments || []).some((a: any) => a.type === 'story_mention');
  const storyReply = !!msg.reply_to?.story;
  let text = msg.text || (ev.postback ? `[button] ${ev.postback.title || ''}` : '');
  if (storyMention) text = '[mentioned you in their story]';
  else if (storyReply) text = `[replied to your story] ${msg.text || ''}`.trim();
  else if (!text && msg.attachments?.length) text = `[${msg.attachments[0].type}]`;

  const receivedAt = Number(ev.timestamp) || Date.now();
  const now = new Date(receivedAt);
  await logMsg(acct, conv.id, 'inbound', igsid, text, { wa_message_id: msg.mid || ev.postback?.mid || null, created_at: now.toISOString(), media_url: msg.attachments?.[0]?.payload?.url || null, message_type: ['image','video','audio'].includes(msg.attachments?.[0]?.type) ? msg.attachments[0].type : 'text' });
  const { data: c2 } = await admin.from('wa_conversations').select('unread_count').eq('id', conv.id).single();
  await admin.from('wa_conversations').update({
    last_message_at: now.toISOString(), last_message_text: text, last_message_direction: 'inbound',
    unread_count: (c2?.unread_count || 0) + 1, window_expires_at: new Date(now.getTime() + 86400000).toISOString(), status: 'open',
  }).eq('id', conv.id);

  await admin.from('instagram_events').update({status:'received',completed_at:new Date().toISOString()}).eq('id',claim.id);
  if (!windowOpen(now.toISOString()) || !(await hasActiveSubscription(admin, acct.workspace_id))) return;
  // Pipeline: button → story → keyword → welcome → AI
  if (ev.postback?.payload) {
    const r = postbackReply(ev.postback.payload, s);
    if (r) return void (await reply(acct, token, conv.id, igsid, r, 'ig_button'));
  }
  if (storyMention && s.story_mention_enabled && s.story_mention_message?.trim()) return void (await reply(acct, token, conv.id, igsid, s.story_mention_message, 'ig_story_mention'));
  if (storyReply && s.story_reply_enabled && s.story_reply_message?.trim()) return void (await reply(acct, token, conv.id, igsid, s.story_reply_message, 'ig_story_reply'));
  if (msg.text) {
    const k = findKeywordReply(msg.text, s);
    if (k) return void (await reply(acct, token, conv.id, igsid, k, 'ig_keyword'));
  }
  if (isNew && s.welcome_enabled && s.welcome_message?.trim()) return void (await reply(acct, token, conv.id, igsid, s.welcome_message, 'ig_welcome'));
  if (msg.text && s.ai_enabled) {
    const a = await aiReply(acct, conv.id);
    if (a) await reply(acct, token, conv.id, igsid, a, 'ai');
  }
}

async function handleComment(acct: any, token: string, v: any) {
  const s = (acct.settings || {}) as IgSettings;
  if (!v?.id || !v.text || v.from?.id === acct.ig_user_id) return;
  const rule = findCommentRule(v.text, s, v.media?.id);
  await admin.from('wa_webhook_events').insert({ workspace_id: acct.workspace_id, event_type: 'ig_comment', from_phone: v.from?.id || null, summary: `@${v.from?.username || '?'}: ${String(v.text).slice(0, 120)}`, status: rule ? 'matched' : 'ignored' });
  if (!rule || !(await hasActiveSubscription(admin, acct.workspace_id))) return;
  const {data: claim,error: claimError} = await admin.from('instagram_events').insert({workspace_id:acct.workspace_id,event_key:`comment:${v.id}`,event_type:'comment'}).select('id').single();
  if(claimError?.code==='23505') return;
  if(claimError || !claim) throw claimError || new Error('Comment claim failed.');
  if(v.timestamp && !privateReplyAllowed(Number(v.timestamp)*1000)) return;
  // Private reply opens a DM thread with the commenter.
  const r = await igSendText(acct.page_id, token, { comment_id: v.id }, rule.dm);
  await admin.from('instagram_events').update({status:r.ok?'sent':'failed',error:r.error,completed_at:new Date().toISOString()}).eq('id',claim.id);
  if (r.ok && rule.public_reply?.trim()) await igPublicCommentReply(v.id, token, rule.public_reply);
  if (r.ok && v.from?.id) {
    const { conv } = await getConversation(acct, token, v.from.id);
    if (conv) {
      await logMsg(acct, conv.id, 'inbound', v.from.id, `[commented] ${v.text}`);
      await logMsg(acct, conv.id, 'outbound', v.from.id, rule.dm, { wa_message_id: r.id || null });
      await admin.from('wa_conversations').update({ last_message_at: new Date().toISOString(), last_message_text: rule.dm, last_message_direction: 'outbound' }).eq('id', conv.id);
    }
    await admin.from('auto_reply_log').insert({ workspace_id: acct.workspace_id, contact_phone: v.from.id, rule_kind: 'ig_comment', rule_ref: rule.keyword });
  }
}

Deno.serve(async (req) => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const expected = Deno.env.get('WA_WEBHOOK_VERIFY_TOKEN');
    if (url.searchParams.get('hub.mode') === 'subscribe' && expected && url.searchParams.get('hub.verify_token') === expected)
      return new Response(url.searchParams.get('hub.challenge') || '', { status: 200 });
    return new Response('Forbidden', { status: 403 });
  }
  if(req.method!=='POST') return new Response('Method not allowed',{status:405,headers:corsHeaders});
  if(!Deno.env.get('META_APP_SECRET')) return new Response('Signature verification is not configured',{status:503,headers:corsHeaders});
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get('x-hub-signature-256'), Deno.env.get('META_APP_SECRET')))) return new Response('bad signature', { status: 401 });
  let payload: any; try { payload = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
  if(!['instagram','page'].includes(payload.object) || !Array.isArray(payload.entry)) return new Response('Unsupported event',{status:400,headers:corsHeaders});
  for (const entry of payload.entry) {
    if(!/^\d+$/.test(String(entry.id))) continue;
    try {
      const { data: acct } = await admin.from('instagram_accounts').select('*').or(`ig_user_id.eq.${String(entry.id).replace(/\D/g, '')},page_id.eq.${String(entry.id).replace(/\D/g, '')}`).maybeSingle();
      if (!acct) continue;
      const { data: cred } = await admin.from('instagram_credentials').select('page_token').eq('workspace_id', acct.workspace_id).maybeSingle();
      if (!cred) continue;
      await admin.from('instagram_accounts').update({ last_event_at: new Date().toISOString() }).eq('workspace_id', acct.workspace_id);
      for (const ev of entry.messaging || []) await handleMessaging(acct, cred.page_token, ev);
      for (const ch of entry.changes || []) if (ch.field === 'comments' || ch.field === 'live_comments') await handleComment(acct, cred.page_token, ch.value);
    } catch (e) {
      const {data: account} = await admin.from('instagram_accounts').select('workspace_id').eq('ig_user_id',String(entry.id)).maybeSingle();
      if(account) { await admin.from('instagram_accounts').update({last_error:(e as Error).message.slice(0,500),status:'needs_attention'}).eq('workspace_id',account.workspace_id); await admin.from('wa_webhook_events').insert({ workspace_id:account.workspace_id,event_type: 'ig_error', status: 'error', error: (e as Error).message.slice(0, 500) }); }
    }
  }
  return new Response('EVENT_RECEIVED', { status: 200, headers:corsHeaders });
});

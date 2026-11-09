// Receives Instagram DMs, postbacks, story replies/mentions and comments; runs automations.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { igProfile, igPublicCommentReply, igSendText } from '../_shared/instagramGraph.ts';
import { findCommentRule, findKeywordReply, postbackReply, type IgSettings } from '../_shared/instagramRules.ts';
import { aiReplyCreditsFor, aiRepliesUsed, hasActiveSubscription } from '../_shared/plans.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function hmacOk(raw: string, sig: string | null) {
  const secret = Deno.env.get('META_APP_SECRET');
  if (!secret || !sig) return !secret; // only enforce when secret configured
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sig === `sha256=${hex}`;
}

async function getConversation(acct: any, token: string, igsid: string) {
  const ws = acct.workspace_id;
  const { data: existing } = await admin.from('wa_conversations').select('id, lead_id, contact_name, created_at, last_message_at')
    .eq('workspace_id', ws).eq('channel', 'instagram').eq('contact_phone', igsid).maybeSingle();
  if (existing) return { conv: existing, isNew: false };
  const p = await igProfile(igsid, token);
  const name = p.name || (p.username ? `@${p.username}` : null);
  // Every Instagram chat becomes a contact.
  let leadId: string | null = null;
  const { data: lead, error: le } = await admin.from('leads').insert({
    workspace_id: ws, name: name || 'Instagram user', source: 'instagram', status: 'new', tags: ['instagram'],
    notes: `Instagram${p.username ? ` @${p.username}` : ''} (id ${igsid})`,
  }).select('id').single();
  if (!le) leadId = lead.id;
  const { data: conv } = await admin.from('wa_conversations').insert({
    workspace_id: ws, channel: 'instagram', contact_phone: igsid, contact_name: name, lead_id: leadId, status: 'open',
  }).select('id, lead_id, contact_name, created_at, last_message_at').single();
  return { conv, isNew: true };
}

async function logMsg(acct: any, convId: string, dir: 'inbound' | 'outbound', peer: string, body: string, extra: Record<string, unknown> = {}) {
  await admin.from('wa_messages').insert({
    workspace_id: acct.workspace_id, conversation_id: convId, direction: dir,
    from_phone: dir === 'inbound' ? peer : acct.ig_user_id, to_phone: dir === 'inbound' ? acct.ig_user_id : peer,
    body, message_type: 'text', status: dir === 'inbound' ? 'received' : 'sent', ...extra,
  });
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
    body: JSON.stringify({ model: 'google/gemini-3.1-flash-lite', messages: [{ role: 'system', content: system }, ...messages] }),
  });
  if (!resp.ok) return '';
  const d = await resp.json();
  return String(d?.choices?.[0]?.message?.content || '').trim();
}

async function handleMessaging(acct: any, token: string, ev: any) {
  const s = (acct.settings || {}) as IgSettings;
  const igsid = ev.sender?.id;
  if (!igsid || igsid === acct.ig_user_id || ev.message?.is_echo) return;
  const { conv, isNew } = await getConversation(acct, token, igsid);
  if (!conv) return;
  const msg = ev.message || {};
  const storyMention = (msg.attachments || []).some((a: any) => a.type === 'story_mention');
  const storyReply = !!msg.reply_to?.story;
  let text = msg.text || (ev.postback ? `[button] ${ev.postback.title || ''}` : '');
  if (storyMention) text = '[mentioned you in their story]';
  else if (storyReply) text = `[replied to your story] ${msg.text || ''}`.trim();
  else if (!text && msg.attachments?.length) text = `[${msg.attachments[0].type}]`;

  const now = new Date();
  await logMsg(acct, conv.id, 'inbound', igsid, text, { wa_message_id: msg.mid || null });
  const { data: c2 } = await admin.from('wa_conversations').select('unread_count').eq('id', conv.id).single();
  await admin.from('wa_conversations').update({
    last_message_at: now.toISOString(), last_message_text: text, last_message_direction: 'inbound',
    unread_count: (c2?.unread_count || 0) + 1, window_expires_at: new Date(now.getTime() + 86400000).toISOString(), status: 'open',
  }).eq('id', conv.id);

  if (!(await hasActiveSubscription(admin, acct.workspace_id))) return;
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
  const rule = findCommentRule(v.text, s);
  await admin.from('wa_webhook_events').insert({ workspace_id: acct.workspace_id, event_type: 'ig_comment', from_phone: v.from?.id || null, summary: `@${v.from?.username || '?'}: ${String(v.text).slice(0, 120)}`, status: rule ? 'matched' : 'ignored' });
  if (!rule || !(await hasActiveSubscription(admin, acct.workspace_id))) return;
  // Private reply opens a DM thread with the commenter.
  const r = await igSendText(acct.page_id, token, { comment_id: v.id }, rule.dm);
  if (rule.public_reply?.trim()) await igPublicCommentReply(v.id, token, rule.public_reply);
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
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const expected = Deno.env.get('WA_WEBHOOK_VERIFY_TOKEN');
    if (url.searchParams.get('hub.mode') === 'subscribe' && expected && url.searchParams.get('hub.verify_token') === expected)
      return new Response(url.searchParams.get('hub.challenge') || '', { status: 200 });
    return new Response('Forbidden', { status: 403 });
  }
  const raw = await req.text();
  if (!(await hmacOk(raw, req.headers.get('x-hub-signature-256')))) return new Response('bad signature', { status: 401 });
  let payload: any; try { payload = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
  for (const entry of payload?.entry || []) {
    try {
      const { data: acct } = await admin.from('instagram_accounts').select('*').or(`ig_user_id.eq.${String(entry.id).replace(/\D/g, '')},page_id.eq.${String(entry.id).replace(/\D/g, '')}`).maybeSingle();
      if (!acct) continue;
      const { data: cred } = await admin.from('instagram_credentials').select('page_token').eq('workspace_id', acct.workspace_id).maybeSingle();
      if (!cred) continue;
      await admin.from('instagram_accounts').update({ last_event_at: new Date().toISOString(), status: 'connected', last_error: null }).eq('workspace_id', acct.workspace_id);
      for (const ev of entry.messaging || []) await handleMessaging(acct, cred.page_token, ev);
      for (const ch of entry.changes || []) if (ch.field === 'comments' || ch.field === 'live_comments') await handleComment(acct, cred.page_token, ch.value);
    } catch (e) {
      await admin.from('wa_webhook_events').insert({ event_type: 'ig_error', status: 'error', error: (e as Error).message.slice(0, 500) });
    }
  }
  return new Response('EVENT_RECEIVED', { status: 200 });
});

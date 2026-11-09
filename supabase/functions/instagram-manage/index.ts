// Instagram channel management + staff sending.
// actions: connect | disconnect | save_settings | send | followup
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GRAPH, igSendText } from '../_shared/instagramGraph.ts';
import { windowOpen, type IgSettings } from '../_shared/instagramRules.ts';
import { hasActiveSubscription } from '../_shared/plans.ts';

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function syncProfile(pageId: string, token: string, s: IgSettings) {
  // Starter questions (ice breakers) + fixed menu shown inside the Instagram chat.
  const ib = (s.ice_breakers || []).filter((b) => b.question?.trim()).slice(0, 4)
    .map((b, i) => ({ question: b.question!.slice(0, 80), payload: `IB_${i}` }));
  const menu = (s.menu || []).filter((b) => b.title?.trim()).slice(0, 5)
    .map((b, i) => ({ type: 'postback', title: b.title!.slice(0, 30), payload: `MENU_${i}` }));
  const errors: string[] = [];
  const call = async (method: string, body: unknown) => {
    const r = await fetch(`${GRAPH}/${pageId}/messenger_profile?platform=instagram&access_token=${encodeURIComponent(token)}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) errors.push((await r.json().catch(() => ({})))?.error?.message || `HTTP ${r.status}`);
  };
  if (ib.length) await call('POST', { platform: 'instagram', ice_breakers: [{ locale: 'default', call_to_actions: ib }] });
  else await call('DELETE', { fields: ['ice_breakers'] });
  if (menu.length) await call('POST', { platform: 'instagram', persistent_menu: [{ locale: 'default', call_to_actions: menu }] });
  else await call('DELETE', { fields: ['persistent_menu'] });
  return errors;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ error: 'Please sign in again.' }, 401);
    const body = await req.json().catch(() => ({}));
    const { action, workspace_id } = body || {};
    if (typeof workspace_id !== 'string' || typeof action !== 'string') return json({ error: 'workspace_id and action required' }, 400);
    const { data: isMember } = await admin.rpc('is_workspace_member', { _ws: workspace_id, _uid: u.user.id });
    if (!isMember) return json({ error: 'Not a workspace member' }, 403);
    const { data: isAdmin } = await admin.rpc('is_workspace_admin', { _ws: workspace_id, _uid: u.user.id });

    if (action === 'connect') {
      if (!isAdmin) return json({ error: 'Only owners or admins can connect Instagram.' }, 403);
      const token = String(body.page_token || '').trim();
      const pageId = String(body.page_id || '').trim();
      if (!token || !/^\d+$/.test(pageId)) return json({ error: 'Facebook Page ID and Page access token are required.' }, 400);
      const r = await fetch(`${GRAPH}/${pageId}?fields=name,instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(token)}`);
      const page = await r.json();
      if (!r.ok) return json({ error: `Meta rejected the token: ${page?.error?.message || r.status}` }, 400);
      const ig = page?.instagram_business_account;
      if (!ig?.id) return json({ error: 'This Facebook Page has no Instagram Business/Creator account linked.' }, 400);
      const sub = await fetch(`${GRAPH}/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=${encodeURIComponent(token)}`, { method: 'POST' });
      const subErr = sub.ok ? null : ((await sub.json().catch(() => ({})))?.error?.message || `HTTP ${sub.status}`);
      const { data: existing } = await admin.from('instagram_accounts').select('workspace_id').eq('ig_user_id', ig.id).maybeSingle();
      if (existing && existing.workspace_id !== workspace_id) return json({ error: 'This Instagram account is already connected to another workspace.' }, 409);
      const { error: e1 } = await admin.from('instagram_accounts').upsert({
        workspace_id, page_id: pageId, ig_user_id: ig.id, username: ig.username || null,
        profile_picture_url: ig.profile_picture_url || null, status: subErr ? 'needs_attention' : 'connected', last_error: subErr,
      }, { onConflict: 'workspace_id' });
      if (e1) return json({ error: e1.message }, 500);
      await admin.from('instagram_credentials').upsert({ workspace_id, page_token: token, updated_at: new Date().toISOString() });
      return json({ ok: true, username: ig.username, warning: subErr });
    }

    const { data: acct } = await admin.from('instagram_accounts').select('*').eq('workspace_id', workspace_id).maybeSingle();
    const { data: cred } = await admin.from('instagram_credentials').select('page_token').eq('workspace_id', workspace_id).maybeSingle();
    if (!acct || !cred) return json({ error: 'Instagram is not connected yet.' }, 400);

    if (action === 'disconnect') {
      if (!isAdmin) return json({ error: 'Only owners or admins can disconnect.' }, 403);
      await admin.from('instagram_accounts').delete().eq('workspace_id', workspace_id);
      return json({ ok: true });
    }

    if (action === 'save_settings') {
      if (!isAdmin) return json({ error: 'Only owners or admins can change automations.' }, 403);
      const s = (body.settings || {}) as IgSettings;
      if (typeof s !== 'object') return json({ error: 'settings must be an object' }, 400);
      const { error } = await admin.from('instagram_accounts').update({ settings: s }).eq('workspace_id', workspace_id);
      if (error) return json({ error: error.message }, 500);
      const errors = await syncProfile(acct.page_id, cred.page_token, s);
      return json({ ok: true, profile_errors: errors });
    }

    if (action === 'send' || action === 'followup') {
      if (!(await hasActiveSubscription(admin, workspace_id))) return json({ error: 'Your plan has expired. Renew to send messages.' }, 402);
      const text = String(body.body || '').trim();
      if (!text || text.length > 1000) return json({ error: 'Message must be 1–1000 characters.' }, 400);
      let q = admin.from('wa_conversations').select('id, contact_phone, window_expires_at').eq('workspace_id', workspace_id).eq('channel', 'instagram').is('deleted_at', null);
      if (action === 'send') {
        if (typeof body.conversation_id !== 'string') return json({ error: 'conversation_id required' }, 400);
        q = q.eq('id', body.conversation_id);
      } else q = q.gt('window_expires_at', new Date().toISOString());
      const { data: convs } = await q.limit(500);
      if (!convs?.length) return json({ error: action === 'send' ? 'Conversation not found' : 'Nobody has messaged you on Instagram in the last 24 hours.' }, 400);
      let sent = 0, failed = 0, skipped = 0; let lastError: string | null = null;
      for (const c of convs as any[]) {
        const last = c.window_expires_at ? new Date(new Date(c.window_expires_at).getTime() - 86400000).toISOString() : null;
        if (!windowOpen(last)) { skipped++; lastError = 'Instagram only allows replies within 24 hours of the customer’s last message.'; continue; }
        const r = await igSendText(acct.page_id, cred.page_token, { id: c.contact_phone }, text);
        await admin.from('wa_messages').insert({ workspace_id, conversation_id: c.id, direction: 'outbound', wa_message_id: r.id || null, from_phone: acct.ig_user_id, to_phone: c.contact_phone, body: text, message_type: 'text', status: r.ok ? 'sent' : 'failed', error: r.error, sent_by: u.user.id });
        if (r.ok) { sent++; await admin.from('wa_conversations').update({ last_message_at: new Date().toISOString(), last_message_text: text, last_message_direction: 'outbound' }).eq('id', c.id); }
        else { failed++; lastError = r.error; }
      }
      if (action === 'send' && !sent) return json({ error: lastError || 'Send failed' }, 400);
      return json({ ok: true, sent, failed, skipped, error: lastError });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

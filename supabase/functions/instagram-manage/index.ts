import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { graphRequest, igSendText } from '../_shared/instagramGraph.ts';
import { windowOpen, type IgSettings } from '../_shared/instagramRules.ts';
import { hasActiveSubscription } from '../_shared/plans.ts';
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const text = z.string().trim().min(1).max(1000);
const settingsSchema = z.object({
 welcome_enabled: z.boolean().optional(), welcome_message: z.string().max(1000).optional(),
 keywords: z.array(z.object({ keyword: z.string().trim().min(1).max(100), reply: text })).max(50).optional(),
 ice_breakers: z.array(z.object({ question: z.string().trim().min(1).max(80), reply: text })).max(4).optional(),
 menu: z.array(z.object({ title: z.string().trim().min(1).max(30), reply: text })).max(5).optional(),
 comment_rules: z.array(z.object({ keyword: z.string().trim().min(1).max(100), dm: text, public_reply: z.string().max(300).optional(), media_id: z.string().regex(/^\d*$/).optional() })).max(50).optional(),
 story_reply_enabled: z.boolean().optional(), story_reply_message: z.string().max(1000).optional(),
 story_mention_enabled: z.boolean().optional(), story_mention_message: z.string().max(1000).optional(), ai_enabled: z.boolean().optional(),
}).strict();
const requestSchema = z.object({ action: z.enum(['connect','disconnect','save_settings','send','followup','posts','health','status']), workspace_id: z.string().uuid(), page_id: z.string().regex(/^\d+$/).optional(), page_token: z.string().min(20).max(8192).optional(), settings: settingsSchema.optional(), conversation_id: z.string().uuid().optional(), body: text.optional(), conversation_ids: z.array(z.string().uuid()).min(1).max(50).optional() });
async function syncProfile(pageId: string, token: string, s: IgSettings) {
 const errors: string[] = [];
 const sync = async (field: string, value: unknown[], present: boolean) => {
  try { await graphRequest(`${pageId}/messenger_profile?platform=instagram`, token, present ? 'POST' : 'DELETE', present ? { platform: 'instagram', [field]: value } : { platform: 'instagram', fields: [field] }); } catch (e) { errors.push(`${field}: ${(e as Error).message}`); }
 };
 await sync('ice_breakers', [{locale: 'default', call_to_actions: (s.ice_breakers || []).map((b,i) => ({ question: b.question, payload: `IB_${i}` }))}], !!s.ice_breakers?.length);
 await sync('persistent_menu', [{locale: 'default', composer_input_disabled: false, call_to_actions: (s.menu || []).map((b,i) => ({ type: 'postback', title: b.title, payload: `MENU_${i}` }))}], !!s.menu?.length);
 return errors;
}
Deno.serve(async req => {
 if (req.method === 'OPTIONS') return new Response('ok', {headers: corsHeaders});
 if (req.method !== 'POST') return json({error: 'Method not allowed'},405);
 try {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data: auth} = await admin.auth.getUser((req.headers.get('Authorization') || '').replace(/^Bearer /,''));
  if (!auth.user) return json({error: 'Please sign in again.'},401);
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')},400);
  const b = parsed.data, ws = b.workspace_id;
  const {data: member} = await admin.rpc('is_workspace_member',{_ws:ws,_uid:auth.user.id});
  if (!member) return json({error:'Not a workspace member'},403);
  const {data: owner} = await admin.rpc('is_workspace_admin',{_ws:ws,_uid:auth.user.id});
  if (['connect','disconnect','save_settings','followup','health'].includes(b.action) && !owner) return json({error:'Only owners or admins can manage Instagram or send follow-ups.'},403);
  if (b.action === 'status') {
   const {data: account,error} = await admin.from('instagram_accounts').select('*').eq('workspace_id',ws).maybeSingle();
   if(error) throw error;
   return json({account,can_manage:!!owner,webhook_url:`${Deno.env.get('SUPABASE_URL')}/functions/v1/instagram-webhook`,signature_ready:!!Deno.env.get('META_APP_SECRET'),verification_ready:!!Deno.env.get('WA_WEBHOOK_VERIFY_TOKEN')});
  }
  if(b.action === 'connect') {
   if(!b.page_id || !b.page_token) return json({error:'Page ID and Page access token are required.'},400);
   const page = await graphRequest(`${b.page_id}?fields=name,instagram_business_account{id,username,profile_picture_url}`,b.page_token);
   const ig = page.instagram_business_account;
   if(!ig?.id) return json({error:'Link an Instagram Business/Creator account to this Facebook Page first.'},400);
   const {data: existing,error: lookupError} = await admin.from('instagram_accounts').select('workspace_id').eq('ig_user_id',ig.id).maybeSingle();
   if(lookupError) throw lookupError;
   if(existing && existing.workspace_id !== ws) return json({error:'Instagram is connected to another workspace.'},409);
   await graphRequest(`${b.page_id}/subscribed_apps`,b.page_token,'POST',{subscribed_fields:['messages','messaging_postbacks','feed']});
   const {error} = await admin.from('instagram_accounts').upsert({workspace_id:ws,page_id:b.page_id,ig_user_id:ig.id,username:ig.username || null,profile_picture_url:ig.profile_picture_url || null,status:'connected',last_error:null},{onConflict:'workspace_id'});
   if(error) throw error;
   const {error: credentialError} = await admin.from('instagram_credentials').upsert({workspace_id:ws,page_token:b.page_token,updated_at:new Date().toISOString()});
   if(credentialError) { await admin.from('instagram_accounts').update({status:'needs_attention',last_error:'Token could not be saved; reconnect.'}).eq('workspace_id',ws); throw credentialError; }
   return json({ok:true,username:ig.username});
  }
  const {data: acct,error: accountError} = await admin.from('instagram_accounts').select('*').eq('workspace_id',ws).maybeSingle();
  if(accountError) throw accountError;
  const {data: cred} = await admin.from('instagram_credentials').select('page_token').eq('workspace_id',ws).maybeSingle();
  if(!acct || !cred) return json({error:'Connect Instagram first.'},400);
  if(b.action === 'disconnect') {
   await graphRequest(`${acct.page_id}/subscribed_apps`,cred.page_token,'DELETE');
   const {data,error} = await admin.from('instagram_accounts').delete().eq('workspace_id',ws).select('workspace_id');
   if(error || !data?.length) throw error || new Error('Disconnect was not confirmed.');
   return json({ok:true});
  }
  if(b.action === 'health') {
   try { await graphRequest(`${acct.page_id}?fields=id,name`,cred.page_token); await admin.from('instagram_accounts').update({status:'connected',last_error:null}).eq('workspace_id',ws); return json({ok:true}); }
   catch(e) { await admin.from('instagram_accounts').update({status:'needs_attention',last_error:(e as Error).message}).eq('workspace_id',ws); throw e; }
  }
  if(b.action === 'posts') { const posts = await graphRequest(`${acct.ig_user_id}/media?fields=id,caption,media_type,permalink&limit=50`,cred.page_token); return json({posts:posts.data || []}); }
  if(b.action === 'save_settings') {
   if(!b.settings) return json({error:'Settings required'},400);
   const s = {...acct.settings,...b.settings} as IgSettings;
   for(const [enabled,message] of [[s.welcome_enabled,s.welcome_message],[s.story_reply_enabled,s.story_reply_message],[s.story_mention_enabled,s.story_mention_message]]) if(enabled && !String(message || '').trim()) return json({error:'Enabled replies need a message.'},400);
   if(s.ai_enabled) { const {data: ai} = await admin.from('workspace_settings').select('ai_reply_enabled,ai_reply_instructions').eq('workspace_id',ws).maybeSingle(); if(!ai?.ai_reply_enabled || (ai.ai_reply_instructions?.trim().length || 0)<20) return json({error:'Configure and enable business AI in Auto-replies first.'},400); }
   const errors = await syncProfile(acct.page_id,cred.page_token,s);
   const {data,error} = await admin.from('instagram_accounts').update({settings:s,last_error:errors.join('; ') || null,status:errors.length?'needs_attention':'connected',updated_at:new Date().toISOString()}).eq('workspace_id',ws).select('workspace_id');
   if(error || !data?.length) throw error || new Error('Save was not confirmed.');
   return json({ok:true,profile_errors:errors});
  }
  if(!(await hasActiveSubscription(admin,ws))) return json({error:'Renew your plan to send messages.'},402);
  if(!b.body || (b.action === 'send' && !b.conversation_id) || (b.action === 'followup' && !b.conversation_ids)) return json({error:'Choose conversations and enter a message.'},400);
  let q = admin.from('wa_conversations').select('id,contact_phone,assigned_to,window_expires_at').eq('workspace_id',ws).eq('channel','instagram').is('deleted_at',null);
  q = b.action === 'send' ? q.eq('id',b.conversation_id) : q.in('id',b.conversation_ids || []);
  const {data: convs,error} = await q;
  if(error) throw error;
  if(!convs?.length) return json({error:'No matching Instagram conversations.'},404);
  const results = [];
  for(const c of convs) {
   if(!owner && c.assigned_to && c.assigned_to !== auth.user.id) { results.push({id:c.id,status:'skipped',error:'Assigned to another teammate.'}); continue; }
   const last = c.window_expires_at ? new Date(new Date(c.window_expires_at).getTime()-86400000).toISOString() : null;
   if(!windowOpen(last)) {results.push({id:c.id,status:'skipped',error:'Customer must message again to reopen the 24-hour window.'});continue;}
   const r = await igSendText(acct.page_id,cred.page_token,{id:c.contact_phone},b.body);
   const {error: logError} = await admin.from('wa_messages').insert({workspace_id:ws,conversation_id:c.id,direction:'outbound',wa_message_id:r.id || null,from_phone:acct.ig_user_id,to_phone:c.contact_phone,body:b.body,message_type:'text',status:r.ok?'sent':'failed',error:r.error,sent_by:auth.user.id});
   if(logError) throw new Error(r.ok?'Meta accepted the message, but Inbox logging failed; do not resend.':logError.message);
   if(r.ok) await admin.from('wa_conversations').update({last_message_at:new Date().toISOString(),last_message_text:b.body,last_message_direction:'outbound'}).eq('id',c.id).eq('workspace_id',ws);
   results.push({id:c.id,status:r.ok?'sent':'failed',error:r.error});
  }
  const sent = results.filter(r=>r.status==='sent').length;
  if(b.action==='send' && !sent) return json({error:results[0]?.error || 'Send failed'},400);
  return json({ok:true,sent,failed:results.filter(r=>r.status==='failed').length,skipped:results.filter(r=>r.status==='skipped').length,results});
 } catch(e) {return json({error:(e as Error).message},400);}
});

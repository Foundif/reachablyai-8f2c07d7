import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiReplyCreditsFor, aiRepliesUsed } from '../_shared/plans.ts';

// Test AI replies from the Automations page: stores a sample customer message and the AI's
// answer in a "Test customer" Inbox chat. Nothing is sent on WhatsApp. Uses 1 AI credit.
const TEST_PHONE = '910000000000';
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: 'Please sign in again.' }, 401);

    const { workspace_id, message } = await req.json().catch(() => ({}));
    const text = String(message || '').trim().slice(0, 500);
    if (!workspace_id || !text) return json({ error: 'Type a test message first.' }, 400);
    const { data: isMember } = await admin.rpc('is_workspace_member', { _ws: workspace_id, _uid: u.user.id });
    if (!isMember) return json({ error: 'No access to this workspace.' }, 403);

    const { data: s } = await admin.from('workspace_settings').select('ai_reply_enabled, ai_reply_instructions').eq('workspace_id', workspace_id).maybeSingle();
    if (!s?.ai_reply_enabled || !s.ai_reply_instructions) return json({ error: 'Turn AI replies on and save your business info first.' }, 400);
    const { data: ws } = await admin.from('workspaces').select('name, plan_id').eq('id', workspace_id).maybeSingle();
    if ((await aiRepliesUsed(admin, workspace_id)) >= aiReplyCreditsFor(ws?.plan_id)) return json({ error: 'No AI credits left this month.' }, 402);

    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'AI is not configured.' }, 500);
    const system = `You are the friendly WhatsApp assistant for ${ws?.name || 'this business'}. Reply in the customer's language, in under 60 words, plain text. If you don't know something, say a team member will reply shortly. Never invent prices or policies.\n\nBusiness info:\n${s.ai_reply_instructions.slice(0, 3000)}`;
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'google/gemini-3.1-flash-lite', messages: [{ role: 'system', content: system }, { role: 'user', content: text }] }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error(`AI test failed [${resp.status}]: ${body}`);
      return json({ error: resp.status === 429 ? 'AI is busy, try again in a minute.' : resp.status === 402 ? 'AI usage limit reached.' : 'AI reply failed.', status: resp.status, details: body.slice(0, 300) }, resp.status);
    }
    const reply = String((await resp.json())?.choices?.[0]?.message?.content || '').trim();
    if (!reply) return json({ error: 'AI returned an empty reply.' }, 502);

    const now = new Date().toISOString();
    let { data: conv } = await admin.from('wa_conversations').select('id').eq('workspace_id', workspace_id).eq('contact_phone', TEST_PHONE).maybeSingle();
    if (!conv) {
      const { data: c, error } = await admin.from('wa_conversations').insert({ workspace_id, contact_phone: TEST_PHONE, contact_name: 'Test customer (AI test)', status: 'open', tags: ['ai-test'] }).select('id').single();
      if (error) throw error;
      conv = c;
    }
    const { error: mErr } = await admin.from('wa_messages').insert([
      { workspace_id, conversation_id: conv!.id, direction: 'inbound', from_phone: TEST_PHONE, body: text, message_type: 'text', status: 'received', created_at: now },
      { workspace_id, conversation_id: conv!.id, direction: 'outbound', to_phone: TEST_PHONE, body: reply, message_type: 'text', status: 'sent', sent_by: null, created_at: new Date(Date.now() + 1000).toISOString() },
    ]);
    if (mErr) throw mErr;
    await admin.from('wa_conversations').update({ last_message_at: now, last_message_text: reply.slice(0, 200), last_message_direction: 'outbound', deleted_at: null }).eq('id', conv!.id);
    await admin.from('auto_reply_log').insert({ workspace_id, contact_phone: TEST_PHONE, rule_kind: 'ai', rule_ref: 'test' });
    return json({ reply, conversation_id: conv!.id });
  } catch (e: any) {
    console.error('ai-reply-test error', e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

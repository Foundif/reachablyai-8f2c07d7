import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { embedText, chatCompletion } from '../_shared/chatbot.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json();
    const { bot_key, visitor_id, message, visitor_name, visitor_email, page_url, action } = body;
    if (!bot_key || !visitor_id) return json({ error: 'bot_key and visitor_id required' }, 400);

    const { data: bot } = await admin.from('chatbots').select('*').eq('public_key', bot_key).maybeSingle();
    if (!bot || !bot.enabled) return json({ error: 'Bot not available' }, 404);

    // init / fetch conversation
    let { data: conv } = await admin.from('chatbot_conversations').select('*')
      .eq('chatbot_id', bot.id).eq('visitor_id', visitor_id).maybeSingle();
    if (!conv) {
      const { data: created, error: convErr } = await admin.from('chatbot_conversations').insert({
        chatbot_id: bot.id, workspace_id: bot.workspace_id, visitor_id,
        visitor_name: visitor_name || null, visitor_email: visitor_email || null,
        page_url: page_url || null, last_message_at: new Date().toISOString(),
      }).select('*').single();
      if (convErr) return json({ error: convErr.message }, 500);
      conv = created;
    } else if (visitor_name || visitor_email || page_url) {
      await admin.from('chatbot_conversations').update({
        visitor_name: visitor_name || conv.visitor_name,
        visitor_email: visitor_email || conv.visitor_email,
        page_url: page_url || conv.page_url,
      }).eq('id', conv.id);
    }

    if (action === 'init') {
      // fetch prior messages
      const { data: msgs } = await admin.from('chatbot_messages').select('role, content, created_at')
        .eq('conversation_id', conv.id).order('created_at').limit(50);
      return json({
        conversation_id: conv.id,
        welcome: bot.welcome_message,
        brand_color: bot.brand_color,
        launcher_text: bot.launcher_text,
        avatar_url: bot.avatar_url,
        position: bot.position,
        name: bot.name,
        human_takeover: conv.human_takeover,
        messages: msgs || [],
      });
    }

    if (!message || typeof message !== 'string') return json({ error: 'message required' }, 400);

    // rate limit: last hour
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from('chatbot_messages').select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id).eq('role', 'user').gte('created_at', since);
    if ((count || 0) >= 30) return json({ error: 'Rate limit exceeded. Try again later.' }, 429);

    // save user message
    await admin.from('chatbot_messages').insert({
      conversation_id: conv.id, chatbot_id: bot.id, workspace_id: bot.workspace_id,
      role: 'user', content: message,
    });
    await admin.from('chatbot_conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: message.slice(0, 200),
    }).eq('id', conv.id);

    if (conv.human_takeover) {
      return json({ reply: null, human_takeover: true });
    }

    // RAG retrieval
    let context = '';
    try {
      const qEmb = await embedText(message);
      const { data: matches } = await admin.rpc('match_chatbot_chunks', {
        _chatbot_id: bot.id, query_embedding: qEmb as any, match_count: 5,
      });
      if (matches && matches.length > 0) {
        context = matches.map((m: any, i: number) => `[${i + 1}] ${m.content}`).join('\n\n');
      }
    } catch (e) {
      console.error('RAG failed', e);
    }

    // fetch recent history
    const { data: history } = await admin.from('chatbot_messages').select('role, content')
      .eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(10);
    const recentMsgs = (history || []).reverse()
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({ role: m.role, content: m.content }));

    const systemPrompt = `${bot.system_prompt}\n\nTone: ${bot.tone}.\n\nKnowledge base (use this to answer; do not invent facts not present here or in general knowledge):\n${context || '(no knowledge base entries matched)'}\n\nIf the answer isn't in the knowledge base and you are not sure, offer to connect the user to a human agent.`;

    let reply = '';
    try {
      reply = await chatCompletion(recentMsgs, systemPrompt);
    } catch (e: any) {
      reply = "Sorry, I'm having trouble right now. A team member will get back to you shortly.";
      console.error('chat completion failed', e);
    }

    await admin.from('chatbot_messages').insert({
      conversation_id: conv.id, chatbot_id: bot.id, workspace_id: bot.workspace_id,
      role: 'assistant', content: reply,
    });
    await admin.from('chatbot_conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: reply.slice(0, 200),
    }).eq('id', conv.id);

    return json({ reply, conversation_id: conv.id });
  } catch (e: any) {
    console.error('chatbot-message error', e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

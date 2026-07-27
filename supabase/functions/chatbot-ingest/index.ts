import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { embedText, chunkText, stripHtml } from '../_shared/chatbot.ts';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function fetchUrlText(url: string): Promise<string> {
  const resp = await fetch(url, { headers: { 'User-Agent': 'ReachablyBot/1.0' } });
  if (!resp.ok) throw new Error(`Fetch ${url} failed: ${resp.status}`);
  const html = await resp.text();
  return stripHtml(html);
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // Lightweight PDF text extraction using pdf-parse via npm
  const pdfParse = (await import('npm:pdf-parse@1.1.1')).default;
  const buf = new Uint8Array(bytes);
  const result = await pdfParse(buf);
  return String(result.text || '');
}

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

    const body = await req.json();
    const { chatbot_id, type, url, faq, text, storage_path, title } = body;
    if (!chatbot_id || !type) return json({ error: 'chatbot_id and type required' }, 400);

    const { data: bot, error: botErr } = await admin.from('chatbots').select('id, workspace_id').eq('id', chatbot_id).maybeSingle();
    if (botErr || !bot) return json({ error: 'Chatbot not found' }, 404);
    const { data: mem } = await admin.from('workspace_members').select('user_id').eq('workspace_id', bot.workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Forbidden' }, 403);

    // create source row
    const { data: source, error: srcErr } = await admin.from('chatbot_sources').insert({
      chatbot_id, workspace_id: bot.workspace_id, type,
      source_ref: url || storage_path || null,
      title: title || (type === 'url' ? url : type === 'pdf' ? (storage_path || 'PDF') : type),
      status: 'processing',
    }).select('*').single();
    if (srcErr) return json({ error: srcErr.message }, 500);

    try {
      let rawText = '';
      if (type === 'url') {
        if (!url) throw new Error('url required');
        rawText = await fetchUrlText(url);
      } else if (type === 'faq') {
        // faq: [{q,a}, ...]
        rawText = (faq || []).map((p: any) => `Q: ${p.q}\nA: ${p.a}`).join('\n\n');
      } else if (type === 'text') {
        rawText = String(text || '');
      } else if (type === 'pdf') {
        if (!storage_path) throw new Error('storage_path required');
        const { data: file, error: dlErr } = await admin.storage.from('chatbot-uploads').download(storage_path);
        if (dlErr || !file) throw new Error('Failed to download PDF: ' + (dlErr?.message || 'unknown'));
        const bytes = new Uint8Array(await file.arrayBuffer());
        rawText = await extractPdfText(bytes);
      } else {
        throw new Error('Unsupported type: ' + type);
      }

      const chunks = chunkText(rawText, 800, 100).slice(0, 200); // safety cap
      if (chunks.length === 0) throw new Error('No content extracted');

      let inserted = 0;
      for (const chunk of chunks) {
        try {
          const emb = await embedText(chunk);
          await admin.from('chatbot_chunks').insert({
            chatbot_id, source_id: source.id, workspace_id: bot.workspace_id,
            content: chunk, embedding: emb as any, token_count: Math.ceil(chunk.length / 4),
          });
          inserted++;
        } catch (e) {
          console.error('chunk failed', e);
        }
      }

      await admin.from('chatbot_sources').update({
        status: inserted > 0 ? 'ready' : 'failed',
        chars_ingested: rawText.length,
        error: inserted === 0 ? 'No chunks embedded' : null,
      }).eq('id', source.id);

      return json({ ok: true, source_id: source.id, chunks: inserted, chars: rawText.length });
    } catch (e: any) {
      await admin.from('chatbot_sources').update({ status: 'failed', error: String(e?.message || e) }).eq('id', source.id);
      return json({ error: String(e?.message || e) }, 500);
    }
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

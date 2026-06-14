// AI smart reply suggestions for Unified Inbox
// Uses Lovable AI Gateway (gemini-3-flash) to suggest 3 concise replies

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { context } = await req.json();
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return new Response(JSON.stringify({ replies: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a WhatsApp customer support assistant. Given the recent conversation, suggest exactly 3 short, friendly, concise reply options (each under 90 chars) the agent could send next. Return ONLY a JSON array of 3 strings, nothing else.',
          },
          { role: 'user', content: context || '' },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ replies: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || '[]';
    let replies: string[] = [];
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) replies = parsed.filter((x) => typeof x === 'string').slice(0, 3);
    } catch {
      replies = text.split('\n').map((l) => l.replace(/^[\d.\-*\s"]+|["]+$/g, '').trim()).filter(Boolean).slice(0, 3);
    }
    return new Response(JSON.stringify({ replies }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ replies: [], error: String(e) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

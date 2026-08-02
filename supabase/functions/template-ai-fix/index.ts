import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SYSTEM = `You are a WhatsApp Cloud API message-template compliance expert.
You receive a draft template (name, category, language, header, body, footer, buttons, carousel cards) and optionally the exact rejection error Meta returned.

Meta rules you must enforce:
- Body cannot start or end with a variable placeholder.
- Two variables cannot be adjacent (e.g. "{{1}} {{2}}").
- Header text (max 60 chars) may contain at most 1 variable and cannot start or end with one.
- Footer (max 60 chars) cannot contain variables at all.
- Body max 1024 chars. Button text max 25 chars. Name: lowercase letters, digits, underscores only, max 512 chars.
- At most 1 URL button and 1 phone button; up to 10 buttons total.
- No double spaces, no trailing newlines, no more than 4 consecutive newlines, no emojis in header text.
- Marketing/utility category must match the content intent (promotional => marketing, order/account updates => utility).

Return STRICT JSON only:
{"issues":[{"field":"body","message":"...","severity":"error|warning"}],
 "fixed":{"name":"","category":"","language":"","header_type":"","header":"","body":"","footer":"","buttons":[{"type":"","text":"","url":"","phone_number":""}]}}
"fixed" must keep the author's meaning and language, keep the same variable placeholders (same names) but reposition/pad text so they are valid, and only change what is necessary. Never invent media URLs. If nothing is wrong, return an empty issues array and echo the original values.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'AI is not configured on this project.' }, 500);

    const body = await req.json().catch(() => null);
    const template = body?.template;
    if (!template || typeof template !== 'object') return json({ error: 'template is required' }, 400);
    const metaError = typeof body?.meta_error === 'string' ? body.meta_error : '';

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'google/gemini-3.6-flash',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `Draft template (JSON):\n${JSON.stringify(template).slice(0, 8000)}\n\n${
              metaError ? `Meta rejected it with: ${metaError.slice(0, 800)}` : 'Not yet submitted to Meta.'
            }\n\nReturn the JSON described in your instructions.`,
          },
        ],
      }),
    });

    if (resp.status === 429) return json({ error: 'AI rate limit reached — try again in a moment.' }, 429);
    if (resp.status === 402) return json({ error: 'AI credits exhausted. Add credits to continue.' }, 402);
    if (!resp.ok) return json({ error: `AI request failed (${resp.status}): ${(await resp.text()).slice(0, 300)}` }, 400);

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? '';
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }
    if (!parsed) return json({ error: 'AI returned an unreadable response. Please try again.' }, 400);

    return json({
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 20) : [],
      fixed: parsed.fixed && typeof parsed.fixed === 'object' ? parsed.fixed : null,
    });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 400);
  }
});

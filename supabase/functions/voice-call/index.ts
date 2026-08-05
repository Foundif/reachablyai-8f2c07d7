import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/**
 * Starts an outbound voice call through the Wati Astra agent API.
 * Body: { workspace_id, conversation_id?, to }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { workspace_id, conversation_id, to } = await req.json();
    if (!workspace_id || !to) return json({ error: 'workspace_id and to are required' }, 400);
    if (!/^\+?\d{8,15}$/.test(String(to).replace(/[^\d+]/g, ''))) return json({ error: 'Invalid phone number' }, 400);

    const { data: mem } = await admin.from('workspace_members')
      .select('user_id').eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);

    const baseUrl = (Deno.env.get('WATI_ASTRA_BASE_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('WATI_ASTRA_API_KEY');
    if (!baseUrl || !apiKey) return json({ error: 'Voice calling is not configured' }, 400);

    const phone = String(to).replace(/[^\d]/g, '');

    const resp = await fetch(`${baseUrl}/api/v1/voice/call`, {
      method: 'POST',
      headers: {
        Authorization: apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone_number: phone, whatsapp_number: phone, direction: 'outbound' }),
    });

    const text = await resp.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }

    if (!resp.ok) {
      console.error('[voice-call] provider error', resp.status, text.slice(0, 500));
      return json({ error: body?.message || body?.error || `Call provider returned ${resp.status}`, details: body }, 502);
    }

    if (conversation_id) {
      await admin.from('wa_messages').insert({
        workspace_id, conversation_id, direction: 'outbound',
        to_phone: phone, body: '📞 Voice call started', message_type: 'call',
        status: 'sent', sent_by: user.id,
      });
    }

    return json({ ok: true, call: body });
  } catch (e) {
    console.error('[voice-call]', e);
    return json({ error: String(e) }, 500);
  }
});

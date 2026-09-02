import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { workspace_id } = await req.json();
    if (!workspace_id) return json({ error: 'workspace_id required' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: creds } = await supabase.from('whatsapp_credentials').select('*').eq('workspace_id', workspace_id).maybeSingle();
    if (!creds?.access_token || !creds?.phone_number_id) {
      return json({ verified: false, error: 'Missing access token or phone number ID' });
    }

    const resp = await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}?fields=display_phone_number,verified_name,quality_rating,name_status`, {
      headers: { Authorization: `Bearer ${creds.access_token}` },
    });
    const body = await resp.json();
    if (!resp.ok) {
      const err = body?.error?.message || `HTTP ${resp.status}`;
      await supabase.from('whatsapp_credentials').update({ verified: false, last_error: err }).eq('workspace_id', workspace_id);
      return json({ verified: false, error: err });
    }

    await supabase.from('whatsapp_credentials').update({
      verified: true,
      verified_at: new Date().toISOString(),
      status: 'connected',
      connected_at: new Date().toISOString(),
      last_error: null,
      business_phone: body.display_phone_number || creds.business_phone,
      verified_name: body.verified_name || creds.verified_name,
      quality_rating: body.quality_rating || creds.quality_rating,
      messaging_limit: body.name_status || creds.messaging_limit,
    }).eq('workspace_id', workspace_id);

    return json({ verified: true, phone: body.display_phone_number, name: body.verified_name });
  } catch (e) {
    return json({ verified: false, error: String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: 'Unauthorized' }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const { code, redirect_uri } = body as any;
    const hintWabaId: string | undefined = body?.waba_id;
    const hintPhoneId: string | undefined = body?.phone_number_id;
    if (!code) return json({ error: 'Missing OAuth code' }, 400);


    const appId = Deno.env.get('META_APP_ID');
    const appSecret = Deno.env.get('META_APP_SECRET');
    if (!appId || !appSecret) return json({ error: 'Meta app not configured on server' }, 500);

    // 1. Exchange code -> access_token
    const tokenUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('code', code);
    if (redirect_uri) tokenUrl.searchParams.set('redirect_uri', redirect_uri);

    const tokenResp = await fetch(tokenUrl.toString());
    const tokenBody = await tokenResp.json();
    if (!tokenResp.ok || !tokenBody?.access_token) {
      return json({ error: tokenBody?.error?.message || 'Failed to exchange code' }, 400);
    }
    const accessToken = tokenBody.access_token as string;

    // 2. Get WABA(s) accessible to this token (popup signup already tells us which one)
    const wabaIds: string[] = [];
    if (hintWabaId) wabaIds.push(hintWabaId);

    if (wabaIds.length === 0) {
      const debugResp = await fetch(
        `https://graph.facebook.com/v20.0/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`,
      );
      const debugBody = await debugResp.json();
      const grantedScopes: any[] = debugBody?.data?.granular_scopes || [];
      for (const g of grantedScopes) {
        if (g?.scope === 'whatsapp_business_management' || g?.scope === 'whatsapp_business_messaging') {
          for (const id of g.target_ids || []) if (!wabaIds.includes(id)) wabaIds.push(id);
        }
      }
    }

    if (wabaIds.length === 0) {
      // Fallback: businesses -> owned WABAs
      const bizResp = await fetch(
        `https://graph.facebook.com/v20.0/me/businesses?access_token=${accessToken}`,
      );
      const bizBody = await bizResp.json();
      for (const b of bizBody?.data || []) {
        const wabaResp = await fetch(
          `https://graph.facebook.com/v20.0/${b.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`,
        );
        const wabaBody = await wabaResp.json();
        for (const w of wabaBody?.data || []) if (!wabaIds.includes(w.id)) wabaIds.push(w.id);
      }
    }

    if (wabaIds.length === 0) return json({ error: 'No WhatsApp Business Account found on this Facebook account' }, 400);

    const wabaId = wabaIds[0];

    // 3. Get phone numbers on this WABA
    const phoneResp = await fetch(
      `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers?access_token=${accessToken}`,
    );
    const phoneBody = await phoneResp.json();
    const phones: any[] = phoneBody?.data || [];
    const phone = (hintPhoneId && phones.find((p) => p.id === hintPhoneId)) || phones[0];
    if (!phone && !hintPhoneId) {
      return json({ error: phoneBody?.error?.message || 'No phone numbers found on WABA' }, 400);
    }
    const phoneNumberId = phone?.id || hintPhoneId!;
    const displayPhone = phone?.display_phone_number || null;


    // 4. Subscribe app to WABA webhooks
    await fetch(`https://graph.facebook.com/v20.0/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 5. Register phone number for Cloud API (best-effort; may already be registered)
    await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin: '000000' }),
    }).catch(() => {});

    // 6. Locate workspace and upsert credentials
    const { data: ws } = await admin
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId)
      .order('created_at')
      .limit(1)
      .maybeSingle();
    if (!ws?.id) return json({ error: 'Workspace not found' }, 400);

    const { error: upsertErr } = await admin.from('whatsapp_credentials').upsert(
      {
        workspace_id: ws.id,
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        business_phone: displayPhone,
        access_token: accessToken,
        connection_type: 'embedded',
        connected_at: new Date().toISOString(),
        status: 'connected',
        verified: true,
        verified_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: 'workspace_id' },
    );
    if (upsertErr) return json({ error: upsertErr.message }, 500);

    return json({
      success: true,
      phone: displayPhone,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

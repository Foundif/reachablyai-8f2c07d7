import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const GV = 'v20.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const workspace_id = body?.workspace_id as string | undefined;
    const repair = body?.repair !== false;
    if (!workspace_id) return json({ error: 'workspace_id required' }, 400);

    const { data: mem } = await admin.from('workspace_members')
      .select('user_id').eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
    if (!mem) return json({ error: 'Not a workspace member' }, 403);

    const appId = Deno.env.get('META_APP_ID')!;
    const appSecret = Deno.env.get('META_APP_SECRET')!;
    const appToken = `${appId}|${appSecret}`;
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`;
    const verifyToken = Deno.env.get('WA_WEBHOOK_VERIFY_TOKEN') || 'TheAurax@dmin2027';

    const out: any = { callback_url: callbackUrl, steps: [] };

    // 1) App-level webhook subscription for whatsapp_business_account
    const subsResp = await fetch(`https://graph.facebook.com/${GV}/${appId}/subscriptions?access_token=${encodeURIComponent(appToken)}`);
    const subs = await subsResp.json();
    out.app_subscriptions = subs;
    const wabaSub = (subs?.data || []).find((s: any) => s.object === 'whatsapp_business_account');
    const fields = (wabaSub?.fields || []).map((f: any) => f.name || f);
    out.app_webhook_ok = !!wabaSub && wabaSub.callback_url === callbackUrl && fields.includes('messages');

    if (!out.app_webhook_ok && repair) {
      const form = new URLSearchParams({
        object: 'whatsapp_business_account',
        callback_url: callbackUrl,
        verify_token: verifyToken,
        fields: 'messages,message_template_status_update,account_update,phone_number_quality_update',
        include_values: 'true',
        access_token: appToken,
      });
      const fix = await fetch(`https://graph.facebook.com/${GV}/${appId}/subscriptions`, { method: 'POST', body: form });
      out.steps.push({ step: 'set_app_webhook', result: await fix.json() });
    }

    // 2) WABA-level app subscription
    const { data: creds } = await admin.from('whatsapp_credentials').select('*').eq('workspace_id', workspace_id).maybeSingle();
    if (!creds?.access_token || !creds?.waba_id) return json({ ...out, error: 'WhatsApp not connected' }, 400);

    const saResp = await fetch(`https://graph.facebook.com/${GV}/${creds.waba_id}/subscribed_apps`, {
      headers: { Authorization: `Bearer ${creds.access_token}` },
    });
    const sa = await saResp.json();
    out.waba_subscribed_apps = sa;
    const subscribed = (sa?.data || []).some((d: any) => d?.whatsapp_business_api_data?.id === appId);
    out.waba_subscribed = subscribed;

    if (!subscribed && repair) {
      const fix = await fetch(`https://graph.facebook.com/${GV}/${creds.waba_id}/subscribed_apps`, {
        method: 'POST', headers: { Authorization: `Bearer ${creds.access_token}` },
      });
      out.steps.push({ step: 'subscribe_waba', result: await fix.json() });
    }

    // 3) Phone number status
    const pnResp = await fetch(
      `https://graph.facebook.com/${GV}/${creds.phone_number_id}?fields=display_phone_number,verified_name,status,platform_type,quality_rating`,
      { headers: { Authorization: `Bearer ${creds.access_token}` } },
    );
    out.phone_number = await pnResp.json();

    out.healthy = out.phone_number?.status === 'CONNECTED' && (out.waba_subscribed || out.steps.some((s: any) => s.step === 'subscribe_waba' && s.result?.success));

    return json(out);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

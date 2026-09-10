import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

const PLAN_IDS = ['plus', 'scale', 'supreme'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (authErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const user_id = claims.claims.sub as string;

    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      kind = 'subscription', plan_id, billing_period,
    } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: 'Missing payment fields' }, 400);
    }

    const key_secret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!key_secret) return json({ error: 'Razorpay not configured' }, 500);

    const expected = createHmac('sha256', key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) return json({ error: 'Signature verification failed' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: ws } = await admin.from('workspaces').select('id')
      .eq('owner_id', user_id).order('created_at').limit(1).maybeSingle();

    if (kind === 'scrape_topup') {
      if (!ws?.id) return json({ error: 'No workspace' }, 400);
      const key_id = Deno.env.get('RAZORPAY_KEY_ID')!;
      const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
        headers: { Authorization: `Basic ${btoa(`${key_id}:${key_secret}`)}` },
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) return json({ error: 'Could not verify order amount', details: orderJson }, 400);
      const leadsGranted = Math.floor(Number(orderJson.amount || 0) / 100); // ₹1 per lead
      if (leadsGranted < 1) return json({ error: 'Invalid top-up amount' }, 400);
      const now = new Date();
      const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      await admin.from('scrape_topups').insert({
        workspace_id: ws.id, user_id, leads_granted: leadsGranted, month_key: monthKey,
        amount_paise: Number(orderJson.amount || 0), razorpay_order_id, razorpay_payment_id,
      });
      return json({ success: true, credited: leadsGranted, month_key: monthKey });
    }

    // Subscription
    if (!PLAN_IDS.includes(plan_id)) return json({ error: 'Unknown plan' }, 400);
    const period = billing_period === 'yearly' ? 'yearly' : 'monthly';

    const now = new Date();
    const renews = new Date(now);
    if (period === 'yearly') renews.setFullYear(renews.getFullYear() + 1);
    else renews.setMonth(renews.getMonth() + 1);

    await admin.from('profiles').update({
      subscription_status: plan_id,
      trial_end_date: renews.toISOString(),
    } as any).eq('user_id', user_id);

    if (ws?.id) {
      await admin.from('workspaces').update({
        plan_id,
        plan_tier: plan_id,
        billing_period: period,
        plan_started_at: now.toISOString(),
        plan_renews_at: renews.toISOString(),
        first_month_discount_used: true,
      } as any).eq('id', ws.id);

      // Staff in this workspace inherit the owner's plan.
      const { data: members } = await admin.from('workspace_members').select('user_id').eq('workspace_id', ws.id);
      const ids = (members || []).map((m: any) => m.user_id).filter((id: string) => id !== user_id);
      if (ids.length) {
        await admin.from('profiles').update({
          subscription_status: plan_id, trial_end_date: renews.toISOString(),
        } as any).in('user_id', ids);
      }
    }

    return json({ success: true, plan_id, billing_period: period, renews_at: renews.toISOString() });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

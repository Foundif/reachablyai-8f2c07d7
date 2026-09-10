import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Kinds:
//   'subscription' (default) - monthly/yearly plan (Plus / Scale / Supreme)
//   'scrape_topup'           - ₹1 per lead top-up for the lead scraper
//
// Subscription pricing is decided server-side — the client cannot set the amount.
const PLAN_PRICES: Record<string, { monthly: number; promoMonthly: number; yearly: number }> = {
  plus:    { monthly: 3999,  promoMonthly: 1999.5, yearly: 39000 },
  scale:   { monthly: 7999,  promoMonthly: 3999.5, yearly: 79000 },
  supreme: { monthly: 16999, promoMonthly: 8499.5, yearly: 169000 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (authErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const user_id = claims.claims.sub as string;

    const body = await req.json();
    const kind = String(body.kind || 'subscription');
    const plan_id = String(body.plan_id || '');
    const billing_period = body.billing_period === 'yearly' ? 'yearly' : 'monthly';
    let amount = Number(body.amount);

    if (kind === 'subscription') {
      const price = PLAN_PRICES[plan_id];
      if (!price) return json({ error: 'Unknown plan' }, 400);

      if (billing_period === 'yearly') {
        amount = price.yearly;
      } else {
        // 50% off applies to the first month only.
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: ws } = await admin.from('workspaces')
          .select('first_month_discount_used').eq('owner_id', user_id).order('created_at').limit(1).maybeSingle();
        amount = ws?.first_month_discount_used ? price.monthly : price.promoMonthly;
      }
    }

    // Lead top-ups are priced at a flat ₹1 per lead.
    const leads = Math.round(Number(body.leads || 0));
    if (kind === 'scrape_topup') {
      if (!leads || leads < 50 || leads > 10000 || amount !== leads) {
        return json({ error: 'Lead top-ups are ₹1 per lead (min 50, max 10000)' }, 400);
      }
    }

    if (!amount || amount < 1) return json({ error: 'Invalid amount' }, 400);

    const key_id = Deno.env.get('RAZORPAY_KEY_ID');
    const key_secret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!key_id || !key_secret) return json({ error: 'Razorpay not configured' }, 500);

    const auth = btoa(`${key_id}:${key_secret}`);
    const receiptBase = kind === 'scrape_topup' ? 'scrape' : plan_id || 'plan';
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: `${receiptBase}-${Date.now()}`.slice(0, 40),
        notes: { user_id, kind, plan_id, billing_period, leads: String(leads || '') },
      }),
    });
    const orderJson = await orderRes.json();
    if (!orderRes.ok) {
      console.error('Razorpay order failed', orderRes.status, orderJson);
      return json({ error: 'Order failed', details: orderJson }, orderRes.status);
    }

    return json({ order: orderJson, key_id });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

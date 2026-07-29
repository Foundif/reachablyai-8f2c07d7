import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Kinds:
//   'subscription' (default) - monthly/yearly plan
//   'recharge'   - one-time message pack, requires pack_id
//   'setup'      - one-time onboarding fee
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const amount = Number(body.amount);
    const kind = String(body.kind || 'subscription');
    const plan_id = String(body.plan_id || '');
    const pack_id = String(body.pack_id || '');
    const billing_period = body.billing_period === 'yearly' ? 'yearly' : 'monthly';

    if (!amount || amount < 1) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (kind === 'subscription' && !plan_id) {
      return new Response(JSON.stringify({ error: 'plan_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (kind === 'recharge' && !pack_id) {
      return new Response(JSON.stringify({ error: 'pack_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (kind === 'scrape_topup' && amount !== 299) {
      return new Response(JSON.stringify({ error: 'Invalid scrape top-up amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key_id = Deno.env.get('RAZORPAY_KEY_ID');
    const key_secret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!key_id || !key_secret) {
      return new Response(JSON.stringify({ error: 'Razorpay not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = btoa(`${key_id}:${key_secret}`);
    const receiptBase = kind === 'recharge' ? pack_id : kind === 'setup' ? 'setup' : plan_id;
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: `${receiptBase}-${Date.now()}`.slice(0, 40),
        notes: { user_id: claims.claims.sub, kind, plan_id, pack_id, billing_period },
      }),
    });
    const orderJson = await orderRes.json();
    if (!orderRes.ok) {
      console.error('Razorpay order failed', orderRes.status, orderJson);
      return new Response(JSON.stringify({ error: 'Order failed', details: orderJson }), {
        status: orderRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ order: orderJson, key_id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

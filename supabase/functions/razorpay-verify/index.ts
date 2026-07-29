import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

// Message pack catalogue (server is source of truth — never trust client on msgs credited)
const PACKS: Record<string, { msgs: number; amount: number }> = {
  starter_500:  { msgs: 500,   amount: 599 },
  pack_1k:      { msgs: 1000,  amount: 1099 },
  pack_3k:      { msgs: 3000,  amount: 2999 },
  pack_6k:      { msgs: 6000,  amount: 5999 },
  pack_10k:     { msgs: 10000, amount: 8999 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user_id = claims.claims.sub as string;

    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      kind = 'subscription', plan_id, billing_period, pack_id,
    } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Missing payment fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key_secret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!key_secret) {
      return new Response(JSON.stringify({ error: 'Razorpay not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const expected = createHmac('sha256', key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Signature verification failed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (kind === 'recharge') {
      const pack = PACKS[pack_id];
      if (!pack) {
        return new Response(JSON.stringify({ error: 'Unknown pack' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Resolve the user's primary workspace
      const { data: ws } = await admin.from('workspaces').select('id')
        .eq('owner_id', user_id).order('created_at').limit(1).maybeSingle();
      if (!ws?.id) {
        return new Response(JSON.stringify({ error: 'No workspace' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Upsert wallet balance atomically-ish
      const { data: cur } = await admin.from('message_credits').select('*').eq('workspace_id', ws.id).maybeSingle();
      if (cur) {
        await admin.from('message_credits').update({
          balance: (cur.balance || 0) + pack.msgs,
          lifetime_purchased: (cur.lifetime_purchased || 0) + pack.msgs,
          updated_at: new Date().toISOString(),
        }).eq('workspace_id', ws.id);
      } else {
        await admin.from('message_credits').insert({
          workspace_id: ws.id, balance: pack.msgs, lifetime_purchased: pack.msgs,
        });
      }
      await admin.from('credit_transactions').insert({
        workspace_id: ws.id, user_id, kind: 'topup', pack_id,
        msgs: pack.msgs, amount_paise: pack.amount * 100,
        razorpay_payment_id, razorpay_order_id,
      });
      return new Response(JSON.stringify({ success: true, credited: pack.msgs }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (kind === 'scrape_topup') {
      const { data: ws } = await admin.from('workspaces').select('id')
        .eq('owner_id', user_id).order('created_at').limit(1).maybeSingle();
      if (!ws?.id) {
        return new Response(JSON.stringify({ error: 'No workspace' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const now = new Date();
      const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      await admin.from('scrape_topups').insert({
        workspace_id: ws.id, user_id, leads_granted: 150, month_key: monthKey,
        amount_paise: 29900, razorpay_order_id, razorpay_payment_id,
      });
      return new Response(JSON.stringify({ success: true, credited: 150, month_key: monthKey }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (kind === 'setup') {
      await admin.from('profiles').update({ services_concept: 'setup_paid' } as any).eq('user_id', user_id);
      return new Response(JSON.stringify({ success: true, kind }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: subscription
    const now = new Date();
    const end = new Date(now);
    if (billing_period === 'yearly') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);

    const statusFor = plan_id && ['starter', 'growth', 'business'].includes(plan_id) ? plan_id : 'active';
    await admin.from('profiles').update({
      subscription_status: statusFor,
      trial_end_date: end.toISOString(),
    } as any).eq('user_id', user_id);

    // Seed monthly quota credits for this plan
    const monthlyCredits: Record<string, number> = { starter: 500, growth: 1200, business: 2800 };
    const grant = monthlyCredits[statusFor] || 0;
    if (grant > 0) {
      const { data: ws } = await admin.from('workspaces').select('id')
        .eq('owner_id', user_id).order('created_at').limit(1).maybeSingle();
      if (ws?.id) {
        const { data: cur } = await admin.from('message_credits').select('*').eq('workspace_id', ws.id).maybeSingle();
        if (cur) {
          await admin.from('message_credits').update({
            balance: (cur.balance || 0) + grant,
            lifetime_purchased: (cur.lifetime_purchased || 0) + grant,
            updated_at: new Date().toISOString(),
          }).eq('workspace_id', ws.id);
        } else {
          await admin.from('message_credits').insert({
            workspace_id: ws.id, balance: grant, lifetime_purchased: grant,
          });
        }
        await admin.from('credit_transactions').insert({
          workspace_id: ws.id, user_id, kind: 'grant', pack_id: `plan_${statusFor}`,
          msgs: grant, amount_paise: 0, razorpay_payment_id, razorpay_order_id,
          notes: `${statusFor} plan ${billing_period} activation`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, plan_id, billing_period }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

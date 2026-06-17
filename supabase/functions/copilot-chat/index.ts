// AI Copilot for travel-services businesses.
// Service/business focused — answers booking, customer, service, revenue
// and operations questions. Does NOT recommend products, campaigns, or flows.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are Chatarly Copilot — an operational assistant for a travel-services business (tours, transfers, hotels, packages).

Stay strictly within these topics:
- Bookings: status, upcoming trips, cancellations, advance payments.
- Customers: who they are, repeat travelers, contact details.
- Services & tariffs: itineraries, transport, pricing.
- Revenue & accounting: bookings revenue, expenses, profit & loss.
- Operations: today's pickups, peak booking days, staff coordination.

Do NOT discuss product inventory, retail SKUs, marketing campaigns, flow builders, ad creatives, or generic AI agent topics — this business is service-based, not product-based.

Style: concise, practical, plain English. Numbers in INR (₹). When you don't have data, say so and suggest where to look in the app (Bookings, Customers, Accounting, Analytics).`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ error: 'AI gateway not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.6,
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limit, try again shortly.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: 'AI credits exhausted on the gateway.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: 'AI gateway error', detail: t }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? '';
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

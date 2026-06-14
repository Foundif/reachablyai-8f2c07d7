// Admin-only: send WhatsApp message (used by panel to manually confirm bookings, etc.)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''))
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claims.claims.sub

    const reqBody = await req.json()
    const { to, text, booking_id, flow, flow_id, flow_cta, header, body: flowBody, footer, starting_screen } = reqBody
    if (!to) {
      return new Response(JSON.stringify({ error: 'to required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: settings } = await admin.from('tn_settings').select('meta_phone_number_id').eq('user_id', userId).maybeSingle()
    const phoneNumberId = settings?.meta_phone_number_id
    const token = Deno.env.get('META_ACCESS_TOKEN')
    if (!phoneNumberId || !token) {
      return new Response(JSON.stringify({ error: 'WhatsApp not configured' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let payload: any
    if (flow && flow_id) {
      payload = {
        messaging_product: 'whatsapp', to, type: 'interactive',
        interactive: {
          type: 'flow',
          header: { type: 'text', text: header || '🚖 TN45 Travel Aid' },
          body: { text: flowBody || 'Tap below to book your travel assistance.' },
          footer: { text: footer || 'Powered by TN45' },
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_token: `tn45-${crypto.randomUUID()}`,
              flow_id,
              flow_cta: flow_cta || 'Book Now',
              flow_action: 'navigate',
              flow_action_payload: { screen: starting_screen || 'SERVICE_MENU', data: {} },
            },
          },
        },
      }
    } else if (text) {
      payload = { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }
    } else {
      return new Response(JSON.stringify({ error: 'text or flow required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    const result = await res.json()
    await admin.from('tn_messages').insert({
      user_id: userId, wa_id: to, direction: 'out', type: payload.type, payload, wa_message_id: result?.messages?.[0]?.id,
    })
    if (booking_id) {
      await admin.from('tn_bookings').update({ status: 'confirmed' }).eq('id', booking_id).eq('user_id', userId)
    }
    return new Response(JSON.stringify({ ok: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

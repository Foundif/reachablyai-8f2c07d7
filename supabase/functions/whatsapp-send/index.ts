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
    const { to, text, booking_id, flow, flow_id, flow_cta, header, body: flowBody, footer, starting_screen, template_name, template_language } = reqBody
    if (!to) {
      return new Response(JSON.stringify({ error: 'to required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: settings } = await admin.from('tn_settings').select('meta_phone_number_id, meta_template_name, meta_template_language').eq('user_id', userId).maybeSingle()
    const phoneNumberId = settings?.meta_phone_number_id
    const token = Deno.env.get('META_ACCESS_TOKEN')
    if (!phoneNumberId || !token) {
      return new Response(JSON.stringify({ error: 'WhatsApp not configured' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let payload: any
    const finalTemplateName = template_name || settings?.meta_template_name
    const finalTemplateLanguage = template_language || settings?.meta_template_language || 'en'
    if (flow && finalTemplateName) {
      payload = {
        messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'template',
        template: {
          name: finalTemplateName,
          language: { code: finalTemplateLanguage },
          components: [{
            type: 'button', sub_type: 'flow', index: '0',
            parameters: [{ type: 'action', action: { flow_token: `tn45-${crypto.randomUUID()}`, flow_action_data: {} } }],
          }],
        },
      }
    } else if (flow && flow_id) {
      return new Response(JSON.stringify({ error: 'Approved Meta template name required for production flow send' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
    if (!res.ok || result?.error) {
      await admin.from('tn_messages').insert({
        user_id: userId,
        wa_id: to,
        direction: 'out',
        type: 'webhook_error',
        payload: { text: { body: result?.error?.message || 'WhatsApp send failed' }, error: result?.error || result, attempted_payload: payload },
      })
      await admin.from('notifications').insert({
        user_id: userId,
        type: 'whatsapp_inbound',
        title: 'WhatsApp send failed',
        message: result?.error?.message || 'Meta rejected the message.',
        data: { wa_id: to, error: result?.error || result },
      })
      return new Response(JSON.stringify({ error: result?.error?.message || 'WhatsApp send failed', result }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
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

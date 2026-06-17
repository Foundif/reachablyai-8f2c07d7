// Public WhatsApp Cloud API webhook - verifies HMAC, sends real WhatsApp Flow, parses flow submission
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
}

const GRAPH = 'https://graph.facebook.com/v21.0'

async function verifyHmac(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false
  const expected = signature.replace('sha256=', '')
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === expected
}

async function sendWhatsApp(phoneNumberId: string, token: string, payload: any) {
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const result = await res.json()
  console.log('whatsapp send result', JSON.stringify({ ok: res.ok, status: res.status, result }).slice(0, 1200))
  return { ok: res.ok, status: res.status, result }
}

const textMsg = (to: string, body: string) => ({
  messaging_product: 'whatsapp', to, type: 'text', text: { body }
})

const normalizeWaPhone = (waId: string) => waId?.startsWith('+') ? waId : `+${waId}`

const extractStatusError = (status: any) => {
  const error = status?.errors?.[0]
  if (!error) return null
  return `${error.title || error.message || 'WhatsApp delivery failed'}${error.error_data?.details ? ` — ${error.error_data.details}` : ''}`
}

const configuredTemplateName = (settings: any) => settings.meta_template_name || 'tn45_whatsapp_automation'
const configuredTemplateLanguage = (settings: any) => settings.meta_template_language || 'en'

const templateMsg = (to: string, settings: any) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'template',
  template: {
    name: configuredTemplateName(settings),
    language: { code: configuredTemplateLanguage(settings) },
    components: [
      {
        type: 'button',
        sub_type: 'flow',
        index: '0',
        parameters: [
          {
            type: 'action',
            action: {
              flow_token: `tn45-${crypto.randomUUID()}`,
              flow_action_data: {},
            },
          },
        ],
      },
    ],
  },
})

// Real WhatsApp Flow message (CTA flow). Requires a published Flow ID in Meta Flow Manager.
function flowMsg(to: string, settings: any, flowToken: string) {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'flow',
      header: { type: 'text', text: settings.flow_header || '🚖 TN45 Travel Aid' },
      body: { text: settings.flow_body || 'Tap below to book your travel assistance.' },
      footer: { text: settings.flow_footer || 'Powered by TN45' },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: flowToken,
          flow_id: settings.meta_flow_id,
          flow_cta: settings.meta_flow_cta || 'Book Now',
          flow_action: 'navigate',
          flow_action_payload: {
            screen: 'SERVICE_MENU',
            data: {},
          },
        },
      },
    },
  }
}

const SERVICE_PRICES: Record<string, { name: string; price: number }> = {
  'terminal-railbus': { name: 'In Railway/Bus Station Assist', price: 200 },
  'home-terminal': { name: 'Home to Terminal', price: 200 },
  'home-railbus': { name: 'Home to Railway/Bus Station', price: 200 },
  'terminal-home': { name: 'Terminal to Home', price: 200 },
  'railbus-home': { name: 'Railway/Bus Station to Home', price: 200 },
  'festivity-half': { name: 'Festivity Half Day (6H)', price: 600 },
  'festivity-full': { name: 'Festivity Full Day (12H)', price: 1200 },
  'hospital': { name: 'Hospital Visit Assist (4H)', price: 500 },
  'outstation': { name: 'Outstation Medical Escort', price: 1200 },
}

async function handleFlowSubmission(supabase: any, userId: string, waId: string, payload: any, settings: any, phoneNumberId: string, token: string) {
  const d = payload || {}
  const svcCode = String(d.service || '').trim()
  const svc = SERVICE_PRICES[svcCode] || { name: svcCode || 'Service', price: 0 }
  let addons: string[] = []
  if (Array.isArray(d.addons)) addons = d.addons
  else if (typeof d.addons === 'string' && d.addons) addons = d.addons.split(',').map((a: string) => a.trim()).filter(Boolean)

  let price = svc.price
  if (addons.includes('wheelchair')) price += 50

  const { data: customer } = await supabase
    .from('tn_customers')
    .upsert({ user_id: userId, wa_id: waId, name: d.name || null }, { onConflict: 'user_id,wa_id' })
    .select().single()

  const advance = Number(settings?.advance_amount || 50)
  const { data: booking, error: bErr } = await supabase.from('tn_bookings').insert({
    user_id: userId,
    customer_id: customer?.id,
    wa_id: waId,
    service_code: svcCode,
    service_name: svc.name,
    price,
    addons,
    name: d.name || null,
    phone: d.phone || null,
    transport_mode: d.transport_mode || null,
    transport_details: d.transport_details || null,
    address: d.address || null,
    landmark: d.landmark || null,
    booking_date: d.date || null,
    booking_time: d.time || d.preferred_time || null,
    expected_hours: d.hours || null,
    details: d,
    status: 'awaiting_payment',
    advance_amount: advance,
    balance_amount: Math.max(0, price - advance),
    source: 'whatsapp_flow',
    flow_token: d.flow_token || null,
  }).select().single()

  if (bErr) {
    console.error('booking insert error', bErr)
    return
  }

  await supabase.from('tn_payments').insert({
    user_id: userId, booking_id: booking?.id, amount: advance, method: 'upi', status: 'pending',
  })

  const upi = settings?.upi_id || '9486642242@kvb'
  const payee = settings?.payee_name || 'Tamilnadu Travel'
  const link = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(payee)}&am=${advance}&tn=TN45-${booking?.id?.slice(0,8)}`

  const summary = `✅ *Booking Received!*\n\n` +
    `🆔 TN45-${booking?.id?.slice(0,8)}\n` +
    `🧾 ${svc.name}\n` +
    `👤 ${d.name || '-'}\n` +
    `📞 ${d.phone || '-'}\n` +
    `📅 ${d.date || '-'} • ${d.time || '-'}\n` +
    `🚉 ${d.transport_mode || '-'} ${d.transport_details ? '• ' + d.transport_details : ''}\n` +
    `📍 ${d.address || '-'}\n` +
    (addons.length ? `➕ ${addons.join(', ')}\n` : '') +
    `\n💰 Estimated: ₹${price}\n` +
    `💳 Pay Advance: *₹${advance}*\n${link}\n` +
    `UPI: ${upi} (${payee})\n\n` +
    `After payment, send screenshot here.`

  if (settings?.qr_image_url) {
    await sendWhatsApp(phoneNumberId, token, {
      messaging_product: 'whatsapp', to: waId, type: 'image',
      image: { link: settings.qr_image_url, caption: `Scan to pay ₹${advance}` },
    })
  }
  await sendWhatsApp(phoneNumberId, token, textMsg(waId, summary))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expected = Deno.env.get('META_VERIFY_TOKEN')
    if (mode === 'subscribe' && token === expected) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('forbidden', { status: 403 })
  }

  try {
    const rawBody = await req.text()
    const sig = req.headers.get('x-hub-signature-256')
    const appSecret = Deno.env.get('META_APP_SECRET')
    if (appSecret) {
      const ok = await verifyHmac(rawBody, sig, appSecret)
      if (!ok) {
        console.error('HMAC verification FAILED - META_APP_SECRET does not match Facebook App secret. Received sig:', sig)
        return new Response('invalid signature', { status: 401 })
      }
    } else {
      console.warn('META_APP_SECRET not configured - skipping HMAC verification')
    }
    const body = JSON.parse(rawBody)
    console.log('webhook payload:', JSON.stringify(body).slice(0, 800))

    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    const phoneNumberId = value?.metadata?.phone_number_id
    console.log('field:', change?.field, 'phone_number_id:', phoneNumberId)
    if (!phoneNumberId) {
      return new Response(JSON.stringify({ ok: true, note: 'no phone_number_id, likely a status/account event' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: settings } = await supabase
      .from('tn_settings').select('*').eq('meta_phone_number_id', phoneNumberId).maybeSingle()
    if (!settings) {
      console.error(`NO OWNER FOUND for phone_number_id="${phoneNumberId}". Update tn_settings.meta_phone_number_id to this value in WhatsApp Settings.`)
      return new Response(JSON.stringify({ ok: true, error: `no owner for phone_number_id ${phoneNumberId}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = settings.user_id
    const token = Deno.env.get('META_ACCESS_TOKEN')!
    const messages = value?.messages || []
    const contacts = value?.contacts || []
    console.log(`processing ${messages.length} message(s) for user ${userId}`)

    for (const msg of messages) {
      const waId = msg.from
      const contact = contacts.find((c: any) => c.wa_id === waId)
      const profileName = contact?.profile?.name || null
      const avatarUrl = contact?.profile?.picture || contact?.profile?.profile_pic || null

      // Upsert WhatsApp customer (tn_customers for inbox panel)
      await supabase.from('tn_customers').upsert(
        { user_id: userId, wa_id: waId, name: profileName, avatar_url: avatarUrl, last_seen_at: new Date().toISOString() },
        { onConflict: 'user_id,wa_id' }
      )

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'whatsapp_inbound',
        title: profileName || waId,
        message: msg?.text?.body || msg?.interactive?.body?.text || `New ${msg.type || 'WhatsApp'} message`,
        data: { wa_id: waId, message_id: msg.id, type: msg.type },
      })

      // Also mirror into the general customers table so the Customers page shows them
      try {
        const phoneFormatted = waId.startsWith('+') ? waId : `+${waId}`
        const { data: existing } = await supabase
          .from('customers').select('id,name').eq('user_id', userId).eq('phone', phoneFormatted).maybeSingle()
        if (!existing) {
          await supabase.from('customers').insert({
            user_id: userId, name: profileName || waId, phone: phoneFormatted, avatar_url: avatarUrl,
          })
        } else if (profileName && existing.name !== profileName) {
          await supabase.from('customers').update({ name: profileName, avatar_url: avatarUrl }).eq('id', existing.id)
        }
      } catch (e) { console.warn('customers mirror failed', e) }

      await supabase.from('tn_messages').insert({
        user_id: userId, wa_id: waId, direction: 'in', type: msg.type, payload: msg, wa_message_id: msg.id,
      })

      // Flow submission (nfm_reply) — parse and save booking
      const nfm = msg?.interactive?.nfm_reply
      if (nfm) {
        let parsed: any = {}
        try { parsed = JSON.parse(nfm.response_json || '{}') } catch { parsed = {} }
        await handleFlowSubmission(supabase, userId, waId, parsed, settings, phoneNumberId, token)
        continue
      }

      // Payment screenshot
      if (msg.type === 'image') {
        const { data: latest } = await supabase
          .from('tn_bookings').select('id').eq('user_id', userId).eq('wa_id', waId)
          .eq('status', 'awaiting_payment').order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (latest) {
          await supabase.from('tn_payments').update({
            screenshot_url: `wa-media:${msg.image?.id}`,
          }).eq('booking_id', latest.id)
          await sendWhatsApp(phoneNumberId, token, textMsg(waId, '📸 Screenshot received. Our team will verify shortly.'))
        }
        continue
      }

      // Trigger: send the approved Meta template that contains the Flow button
      const text = (msg?.text?.body || '').trim()
      const triggers = /\b(hi|hello|hai|help|assist|assistance|old\s*age|senior|elder|menu|start|book|booking|hey)\b/i
      if (msg.type === 'text' && triggers.test(text)) {
        const matchedKeyword = text.match(triggers)?.[0] || 'trigger'
        // 1) Create a draft booking row so the operator sees the lead immediately
        const { data: cust } = await supabase
          .from('tn_customers').select('id').eq('user_id', userId).eq('wa_id', waId).maybeSingle()
        const { data: draftBooking } = await supabase.from('tn_bookings').insert({
          user_id: userId,
          customer_id: cust?.id || null,
          wa_id: waId,
          name: profileName || null,
          service_code: 'pending',
          service_name: `Lead from "${matchedKeyword}" message`,
          price: 0,
          status: 'draft',
          source: 'whatsapp_keyword',
          details: { trigger: matchedKeyword, raw_text: text, message_id: msg.id },
        }).select().single()

        // 2) Send the template that opens the Flow
        const out = templateMsg(waId, settings)
        const { ok: sendOk, status: sendStatus, result: res } = await sendWhatsApp(phoneNumberId, token, out)
        if (!sendOk || res?.error) {
          console.error('template send failed', JSON.stringify(res?.error || res))
          if (draftBooking?.id) {
            await supabase.from('tn_bookings').update({
              details: { ...(draftBooking.details || {}), send_status: 'failed', error: res?.error || res },
            }).eq('id', draftBooking.id)
          }
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'whatsapp_inbound',
            title: 'WhatsApp template failed',
            message: res?.error?.message || `Meta rejected the configured template message (${sendStatus}).`,
            data: { wa_id: waId, error: res?.error || res, template: configuredTemplateName(settings), booking_id: draftBooking?.id },
          })
          await supabase.from('tn_messages').insert({
            user_id: userId, wa_id: waId, direction: 'out', type: 'webhook_error',
            payload: { text: { body: res?.error?.message || 'Meta rejected the configured template message.' }, error: res?.error || res, template: configuredTemplateName(settings) },
          })
          continue
        }
        if (draftBooking?.id) {
          await supabase.from('tn_bookings').update({
            status: 'awaiting_payment',
            details: { ...(draftBooking.details || {}), send_status: 'sent', wa_message_id: res?.messages?.[0]?.id },
          }).eq('id', draftBooking.id)
        }
        await supabase.from('tn_messages').insert({
          user_id: userId, wa_id: waId, direction: 'out', type: 'template', payload: out, wa_message_id: res?.messages?.[0]?.id,
        })
        continue
      }

      // No fallback auto-reply in production mode; store inbound only.
    }

    for (const status of value?.statuses || []) {
      const waId = status.recipient_id
      const errText = extractStatusError(status)
      if (!waId || !errText) continue
      await supabase.from('tn_messages').insert({
        user_id: userId,
        wa_id: waId,
        direction: 'out',
        type: 'webhook_error',
        payload: { text: { body: errText }, status },
        wa_message_id: status.id,
      })
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'whatsapp_inbound',
        title: 'WhatsApp delivery failed',
        message: errText,
        data: { wa_id: waId, status },
      })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: unknown) {
    console.error('webhook error', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

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

// Best-effort parsing of free-text "Help" messages so the operator gets prefilled fields.
function parseHelpText(text: string): Record<string, any> {
  const out: Record<string, any> = {}
  const t = text.replace(/\s+/g, ' ').trim()
  const low = t.toLowerCase()

  // Service code keyword map
  const svcMap: Array<[RegExp, string]> = [
    [/\b(railway|bus station|station assist|terminal)\b.*\b(assist|help)\b/, 'terminal-railbus'],
    [/\bhome\s*(to|->|→)\s*(railway|bus|station)\b/, 'home-railbus'],
    [/\bhome\s*(to|->|→)\s*terminal\b/, 'home-terminal'],
    [/\b(railway|bus|station)\s*(to|->|→)\s*home\b/, 'railbus-home'],
    [/\bterminal\s*(to|->|→)\s*home\b/, 'terminal-home'],
    [/\bfestivity\b.*\b(full|12h|12 ?hour)\b/, 'festivity-full'],
    [/\bfestivity\b.*\b(half|6h|6 ?hour)\b/, 'festivity-half'],
    [/\bhospital\b/, 'hospital'],
    [/\b(outstation|medical escort)\b/, 'outstation'],
    [/\b(old\s*age|senior|elder)\b/, 'home-railbus'],
    [/\btravel( assistance)?\b/, 'home-railbus'],
  ]
  for (const [re, code] of svcMap) { if (re.test(low)) { out.service = code; break } }

  // Name: "I am X", "this is X", "my name is X", "name: X", or "Hi X here"
  const nameMatch =
    t.match(/\b(?:my name is|i am|i'm|this is|name[:\-])\s+([A-Z][a-zA-Z .'-]{1,40})/i) ||
    t.match(/\bI need (?:help|assistance)[^.]*?for\s+([A-Z][a-zA-Z .'-]{1,40})/i)
  if (nameMatch) out.name = nameMatch[1].trim().replace(/[.,;]$/, '')

  // Date: dd/mm, dd-mm, "on 25 Dec", "tomorrow", "today"
  if (/\btomorrow\b/i.test(t)) {
    out.date = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  } else if (/\btoday\b/i.test(t)) {
    out.date = new Date().toISOString().slice(0, 10)
  } else {
    const md = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/)
    if (md) {
      const y = md[3] ? (md[3].length === 2 ? `20${md[3]}` : md[3]) : String(new Date().getFullYear())
      out.date = `${y}-${md[2].padStart(2,'0')}-${md[1].padStart(2,'0')}`
    } else {
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
      const mm = low.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/)
      if (mm) {
        const y = new Date().getFullYear()
        out.date = `${y}-${String(months.indexOf(mm[2])+1).padStart(2,'0')}-${mm[1].padStart(2,'0')}`
      }
    }
  }

  // Time: "at 6pm", "06:30", "5.30 am"
  const tm = t.match(/\b(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i) || t.match(/\b(\d{1,2}):(\d{2})\b/)
  if (tm) {
    let h = parseInt(tm[1]); const min = tm[2] ? parseInt(tm[2]) : 0
    const ap = (tm[3] || '').toLowerCase()
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    out.time = `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`
  }

  // Address: "address: ...", "at <place>", "from <place> to <place>"
  const addrMatch =
    t.match(/\baddress[:\-]\s*(.+?)(?:[.;]|$)/i) ||
    t.match(/\b(?:pickup|pick up|from)[:\-]?\s+([A-Z][\w ,.\-]{4,80})/i)
  if (addrMatch) out.address = addrMatch[1].trim()

  // Transport mode
  const trMode = low.match(/\b(train|bus|flight|cab|car|taxi)\b/)
  if (trMode) out.transport_mode = trMode[1]
  const trDet = t.match(/\b(?:train|bus|flight)\s*(?:no\.?|number|#)?\s*([A-Z0-9\-]{3,15})/i) ||
                t.match(/\bPNR[:\-\s]*([A-Z0-9]{6,12})/i)
  if (trDet) out.transport_details = trDet[1]

  // Advance amount: "₹500", "Rs 500", "500 rupees", "advance 500"
  const am = t.match(/(?:₹|rs\.?|inr|advance)\s*(\d{2,5})/i)
  if (am) out.advance = Number(am[1])

  return out
}


async function createRazorpayLink(amount: number, booking: any, customerName: string, customerPhone: string) {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID')
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
  if (!keyId || !keySecret) return { ok: false, error: 'Razorpay keys not configured' }
  try {
    const auth = btoa(`${keyId}:${keySecret}`)
    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'INR',
        accept_partial: false,
        description: `TN45-${booking.id.slice(0,8)} ${booking.service_name || 'Travel Aid'} advance`,
        customer: { name: customerName || 'Customer', contact: customerPhone || undefined },
        notify: { sms: false, email: false },
        reminder_enable: true,
        notes: { booking_id: booking.id, wa_id: booking.wa_id },
        callback_method: 'get',
      }),
    })
    const json = await res.json()
    return { ok: res.ok, link: json.short_url, id: json.id, raw: json }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

async function appendToGoogleSheet(sheetId: string, tab: string, row: (string | number)[]) {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const connKey = Deno.env.get('GOOGLE_SHEETS_API_KEY')
  if (!lovableKey || !connKey) return { ok: false, error: 'Google Sheets connection missing' }
  try {
    const range = encodeURIComponent(`${tab || 'Bookings'}!A:Z`)
    const url = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': connKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) console.error('sheets append failed', res.status, JSON.stringify(json).slice(0, 600))
    return { ok: res.ok, status: res.status, raw: json }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
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

  // 1) Razorpay payment link
  const rzp = await createRazorpayLink(advance, booking, d.name || '', d.phone || waId)
  await supabase.from('tn_payments').insert({
    user_id: userId, booking_id: booking?.id, amount: advance,
    method: rzp.ok ? 'razorpay' : 'manual',
    status: 'pending',
    screenshot_url: rzp.ok ? rzp.link : null,
  })

  // 2) Append to Google Sheet (best-effort)
  if (settings?.google_sheet_enabled && settings?.google_sheet_id) {
    const sheetRes = await appendToGoogleSheet(settings.google_sheet_id, settings.google_sheet_tab || 'Bookings', [
      new Date().toISOString(),
      `TN45-${booking.id.slice(0,8)}`,
      d.name || '',
      d.phone || waId,
      svc.name,
      d.date || '',
      d.time || d.preferred_time || '',
      d.transport_mode || '',
      d.transport_details || '',
      d.address || '',
      d.landmark || '',
      d.hours || '',
      (addons || []).join(', '),
      price,
      advance,
      'awaiting_payment',
      rzp.ok ? rzp.link : '',
    ])
    if (!sheetRes.ok) {
      await supabase.from('tn_audit_log').insert({
        user_id: userId, actor_id: userId, entity_type: 'google_sheet_append',
        entity_id: booking.id, action: 'failed',
        after: { error: sheetRes.error || sheetRes.raw, status: sheetRes.status || null },
      })
    }
  }

  const summary = `✅ *Booking Received!*\n\n` +
    `🆔 TN45-${booking.id.slice(0,8)}\n` +
    `🧾 ${svc.name}\n` +
    `👤 ${d.name || '-'}\n` +
    `📞 ${d.phone || '-'}\n` +
    `📅 ${d.date || '-'} • ${d.time || d.preferred_time || '-'}\n` +
    `🚉 ${d.transport_mode || '-'} ${d.transport_details ? '• ' + d.transport_details : ''}\n` +
    `📍 ${d.address || '-'}${d.landmark ? `\n🏷️ ${d.landmark}` : ''}\n` +
    (addons.length ? `➕ ${addons.join(', ')}\n` : '') +
    `\n💰 Estimated: ₹${price}\n` +
    `💳 Pay Advance: *₹${advance}*\n` +
    (rzp.ok
      ? `🔗 Razorpay link: ${rzp.link}\n(UPI / Card / Netbanking — secure)`
      : `⚠️ Payment link unavailable right now. Our team will contact you.`)
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
        const parsed = parseHelpText(text)
        const svcCode = parsed.service ? String(parsed.service) : null
        const svc = svcCode ? SERVICE_PRICES[svcCode] : null
        const advance = Number(parsed.advance || settings?.advance_amount || 50)

        // 1) Create a draft booking row prefilled from parsed text
        const { data: cust } = await supabase
          .from('tn_customers').select('id').eq('user_id', userId).eq('wa_id', waId).maybeSingle()
        const { data: draftBooking } = await supabase.from('tn_bookings').insert({
          user_id: userId,
          customer_id: cust?.id || null,
          wa_id: waId,
          name: parsed.name || profileName || null,
          service_code: svcCode || 'pending',
          service_name: svc?.name || `Lead from "${matchedKeyword}" message`,
          price: svc?.price || 0,
          advance_amount: advance,
          balance_amount: Math.max(0, (svc?.price || 0) - advance),
          booking_date: parsed.date || null,
          booking_time: parsed.time || null,
          address: parsed.address || null,
          transport_mode: parsed.transport_mode || null,
          transport_details: parsed.transport_details || null,
          status: 'draft',
          source: 'whatsapp_keyword',
          details: { trigger: matchedKeyword, raw_text: text, message_id: msg.id, parsed },
        }).select().single()

        // 2) Send the template that opens the Flow
        const out = templateMsg(waId, settings)
        const { ok: sendOk, status: sendStatus, result: res } = await sendWhatsApp(phoneNumberId, token, out)

        // 3) Audit log of the entire Help trigger attempt
        try {
          await supabase.from('tn_audit_log').insert({
            user_id: userId,
            actor_id: userId,
            entity_type: 'whatsapp_help_trigger',
            entity_id: draftBooking?.id || null,
            action: sendOk && !res?.error ? 'template_sent' : 'template_failed',
            before: { wa_id: waId, keyword: matchedKeyword, raw_text: text, parsed },
            after: {
              request: { template: configuredTemplateName(settings), language: configuredTemplateLanguage(settings) },
              response: { http_status: sendStatus, ok: sendOk, body: res },
              booking_id: draftBooking?.id || null,
              booking_status: sendOk && !res?.error ? 'awaiting_payment' : 'send_failed',
            },
          })
        } catch (e) { console.warn('audit insert failed', e) }

        if (!sendOk || res?.error) {
          console.error('template send failed', JSON.stringify(res?.error || res))
          if (draftBooking?.id) {
            await supabase.from('tn_bookings').update({
              status: 'cancelled',
              notes: `Template send failed: ${res?.error?.message || 'unknown'}`,
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

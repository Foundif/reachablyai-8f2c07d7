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

const templateMsg = (to: string, settings: any, flowToken = `tn45-${crypto.randomUUID()}`) => ({
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
              flow_token: flowToken,
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
          // IMPORTANT: do NOT include `data` when there is nothing to pass.
          // Meta rejects `data: {}` with error 131009 "data ... must be of type dynamic_object".
          flow_action_payload: {
            screen: 'SERVICE_MENU',
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


async function createRazorpayLink(amount: number, booking: any, customerName: string, customerPhone: string, bookingCode?: string) {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID')
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
  if (!keyId || !keySecret) return { ok: false, error: 'Razorpay keys not configured' }
  try {
    const auth = btoa(`${keyId}:${keySecret}`)
    const code = bookingCode || `TN45-${booking.id.slice(0,8)}`
    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'INR',
        accept_partial: false,
        description: `TN45 Advance Payment - ${code}`,
        customer: { name: customerName || 'Customer', contact: customerPhone || undefined },
        notify: { sms: false, email: false },
        reminder_enable: true,
        notes: { booking_id: booking.id, booking_code: code, wa_id: booking.wa_id, user_id: booking.user_id },
        callback_method: 'get',
      }),
    })
    const json = await res.json()
    return { ok: res.ok, link: json.short_url, id: json.id, raw: json }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

const SHEET_HEADERS = [
  'Timestamp','Booking ID','Service Selected','Customer Name','Phone Number',
  'Transport Mode','Service Category','Service Info','Reporting Address',
  'Nearest Landmark','Date of Service','Reporting Time','Expected Hrs/Days',
  'Add-ons','Payment Status','UPI Reference','Helper Assigned','Booking Status',
  'Source','Booking For','Passenger Name','Passenger Phone',
]
// 22 columns -> A:V

function istParts() {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return {
    yy: String(d.getUTCFullYear()).slice(-2),
    mm: String(d.getUTCMonth() + 1).padStart(2, '0'),
    dd: String(d.getUTCDate()).padStart(2, '0'),
    d,
  }
}

function istTimestamp() {
  // Force text-friendly format so Google Sheets keeps it as a string, not a serial number
  return istParts().d.toISOString().replace('T', ' ').slice(0, 19) + ' IST'
}

// Format: TN45-YYMM-XXX  (e.g. TN45-2607-008) — monthly counter, IST-based
function bookingIdFor(seq: number) {
  const { yy, mm } = istParts()
  return `TN45-${yy}${mm}-${String(seq).padStart(3, '0')}`
}

async function sheetsFetch(url: string, init: RequestInit) {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const connKey = Deno.env.get('GOOGLE_SHEETS_API_KEY')
  if (!lovableKey || !connKey) return { ok: false, status: 0, json: { error: 'Google Sheets connection missing' } }
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': connKey,
      'Content-Type': 'application/json',
    },
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

const cleanSheetTitle = (tab?: string) => String(tab || 'Sheet1').trim() || 'Sheet1'
const a1Sheet = (tab: string) => /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${tab.replace(/'/g, "''")}'`

// Cache: skip metadata + header GETs once verified (per function instance).
// This prevents hitting the Sheets read quota (1500/min) on every booking append.
const sheetReadyCache = new Set<string>()

async function ensureSheetTabAndHeader(sheetId: string, tab: string) {
  const key = `${sheetId}|${tab}`
  if (sheetReadyCache.has(key)) return { ok: true, status: 200, json: { cached: true } }

  const metaUrl = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}?fields=sheets.properties`
  const meta = await sheetsFetch(metaUrl, { method: 'GET' })
  if (!meta.ok) return meta
  const sheetsMeta = meta.json?.sheets || []
  let sheetProps = sheetsMeta.find((s: any) => s?.properties?.title === tab)?.properties
  if (!sheetProps) {
    const batchUrl = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}:batchUpdate`
    const add = await sheetsFetch(batchUrl, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab, gridProperties: { columnCount: 26, frozenRowCount: 1 } } } }] }),
    })
    if (!add.ok) return add
    sheetProps = add.json?.replies?.[0]?.addSheet?.properties
  }

  const range = `${a1Sheet(tab)}!A1:V1`
  const getUrl = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}/values/${range}`
  const r = await sheetsFetch(getUrl, { method: 'GET' })
  if (!r.ok) return r
  const firstRow = r.json?.values?.[0] || []
  if (firstRow.length < SHEET_HEADERS.length) {
    const putUrl = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`
    const put = await sheetsFetch(putUrl, { method: 'PUT', body: JSON.stringify({ values: [SHEET_HEADERS] }) })
    if (!put.ok) return put
  }

  // Style header row: purple bg, white bold, frozen, and force column L (Reporting Time) as plain text
  const sheetGid = sheetProps?.sheetId
  if (typeof sheetGid === 'number') {
    const styleUrl = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}:batchUpdate`
    await sheetsFetch(styleUrl, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId: sheetGid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: SHEET_HEADERS.length },
              cell: { userEnteredFormat: {
                backgroundColor: { red: 0.42, green: 0.23, blue: 0.72 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
                horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
              }},
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          { updateSheetProperties: { properties: { sheetId: sheetGid, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
          {
            repeatCell: {
              range: { sheetId: sheetGid, startRowIndex: 1, startColumnIndex: 10, endColumnIndex: 12 },
              cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
              fields: 'userEnteredFormat.numberFormat',
            },
          },
        ],
      }),
    })
  }

  sheetReadyCache.add(key)
  return { ok: true, status: 200, json: { ensured: true } }
}

async function appendToGoogleSheet(sheetId: string, tab: string, row: (string | number)[]) {
  try {
    const safeTab = cleanSheetTitle(tab)
    // Ensure tab + styled header exist (cached after first call per instance)
    const ensured = await ensureSheetTabAndHeader(sheetId, safeTab)
    if (!ensured.ok) return { ok: false, status: ensured.status || 0, raw: ensured.json || ensured }
    const range = `${a1Sheet(safeTab)}!A:V`
    // RAW keeps times like "8Am" / "8:00" as literal text so Sheets never converts them into decimals.
    const url = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
    let r = await sheetsFetch(url, { method: 'POST', body: JSON.stringify({ values: [row] }) })

    // If the tab/header isn't ready (400 parse-range or 404), ensure once and retry.
    if (!r.ok && (r.status === 400 || r.status === 404)) {
      const ensured = await ensureSheetTabAndHeader(sheetId, safeTab)
      if (!ensured.ok) return { ok: false, status: ensured.status || 0, raw: ensured.json || ensured }
      r = await sheetsFetch(url, { method: 'POST', body: JSON.stringify({ values: [row] }) })
    }

    // On read-quota 429 the append itself may still succeed on retry after a short pause.
    if (!r.ok && r.status === 429) {
      await new Promise((res) => setTimeout(res, 1200))
      r = await sheetsFetch(url, { method: 'POST', body: JSON.stringify({ values: [row] }) })
    }

    if (!r.ok) console.error('sheets append failed', r.status, JSON.stringify(r.json).slice(0, 600))
    return { ok: r.ok, status: r.status, raw: r.json }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

async function handleFlowSubmission(supabase: any, userId: string, waId: string, payload: any, settings: any, phoneNumberId: string, token: string) {
  const d = payload || {}
  const hasSubmittedFields = Boolean(d.service || d.name || d.phone || d.transport_mode || d.transport_details || d.service_info || d.address || d.landmark || d.date || d.time || d.hours || d.addons)
  if (!hasSubmittedFields) {
    const { data: draft } = await supabase
      .from('tn_bookings')
      .select('id, details')
      .eq('user_id', userId)
      .eq('wa_id', waId)
      .in('status', ['draft', 'awaiting_payment'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (draft?.id) {
      await supabase.from('tn_bookings').update({
        notes: 'Meta returned an empty Flow payload. The customer must submit the updated published Flow.',
        details: { ...(draft.details || {}), empty_flow_payload: d },
      }).eq('id', draft.id)
    }
    await supabase.from('tn_audit_log').insert({
      user_id: userId,
      actor_id: userId,
      entity_type: 'whatsapp_flow_submission',
      entity_id: draft?.id || null,
      action: 'empty_payload',
      after: { payload: d, reason: 'Meta nfm_reply did not include booking form fields. Usually caused by an old Flow/template still attached in Meta.' },
    })
    await sendWhatsApp(phoneNumberId, token, textMsg(waId, '⚠️ Booking details were not received from Meta. Please tap Help again and submit the updated booking form.'))
    return
  }
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




  const advance = Number(settings?.advance_amount || 200)
  const balance = Math.max(0, price - advance)

  // Monthly IST counter for TN45-YYMM-XXX (shared across WhatsApp + manual bookings)
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const istMonthStartUtc = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1) - 5.5 * 60 * 60 * 1000)
  const { count: monthCount } = await supabase
    .from('tn_bookings').select('*', { count: 'exact', head: true })
    .eq('user_id', userId).gte('created_at', istMonthStartUtc.toISOString())
  const bookingCode = bookingIdFor((monthCount || 0) + 1)

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
    details: { ...d, service_info: d.service_info || null },
    status: 'awaiting_payment',
    advance_amount: advance,
    balance_amount: balance,
    source: 'whatsapp_flow',
    flow_token: d.flow_token || null,
    booking_code: bookingCode,
  }).select().single()

  if (bErr) {
    console.error('booking insert error', bErr)
    return
  }

  // 1) Razorpay payment link
  const rzp = await createRazorpayLink(advance, booking, d.name || '', d.phone || waId, bookingCode)
  await supabase.from('tn_payments').insert({
    user_id: userId, booking_id: booking?.id, amount: advance,
    method: rzp.ok ? 'razorpay' : 'manual',
    status: 'pending',
    screenshot_url: rzp.ok ? rzp.link : null,
  })

  // 2) Append to Google Sheet — 22 columns (A:V), same booking code as WhatsApp summary
  if (settings?.google_sheet_enabled && settings?.google_sheet_id) {
    const addonText = (addons && addons.length) ? addons.join(', ') : 'None'
    const bookingFor = String(d.booking_for || 'myself').toLowerCase()
    const isSomeoneElse = bookingFor === 'someone_else'
    const row = [
      istTimestamp(),                              // A Timestamp
      bookingCode,                                  // B Booking ID (TN45-DDMM-XXX)
      svc.name || svcCode || '',                    // C Service Selected
      d.name || '',                                 // D Customer Name (booker)
      d.phone || waId || '',                        // E Phone Number (booker)
      d.transport_mode || '',                       // F Transport Mode
      d.transport_details || '',                    // G Service Category
      d.service_info || '',                         // H Service Info
      d.address || '',                              // I Reporting Address
      d.landmark || '',                             // J Nearest Landmark
      d.date || '',                                 // K Date of Service
      d.time || d.preferred_time || '',             // L Reporting Time
      d.hours || '',                                // M Expected Hrs/Days
      addonText,                                    // N Add-ons
      `Advance Pending ₹${advance}`,                // O Payment Status
      '',                                           // P UPI Reference
      '',                                           // Q Helper Assigned
      'New',                                        // R Booking Status
      'WhatsApp Flow',                              // S Source
      bookingFor,                                   // T Booking For (myself/someone_else)
      isSomeoneElse ? (d.passenger_name || '') : '', // U Passenger Name
      isSomeoneElse ? (d.passenger_phone || '') : '',// V Passenger Phone
    ]
    const sheetRes = await appendToGoogleSheet(settings.google_sheet_id, settings.google_sheet_tab || 'Bookings', row)
    if (!sheetRes.ok) {
      await supabase.from('tn_audit_log').insert({
        user_id: userId, actor_id: userId, entity_type: 'google_sheet_append',
        entity_id: booking.id, action: 'failed',
        after: { error: sheetRes.error || sheetRes.raw, status: sheetRes.status || null, row, payload: d },
      })
    }
  }

  // Customer-facing messages — respect user-defined templates when provided
  const vars: Record<string, string> = {
    booking_id: bookingCode,
    service: svc.name || '',
    name: d.name || '-',
    phone: d.phone || waId || '-',
    date: d.date || '-',
    time: d.time || d.preferred_time || '-',
    transport: d.transport_mode || '-',
    transport_details: d.transport_details || d.service_info || '',
    address: d.address || '-',
    landmark: d.landmark || '',
    addons: addons.length ? addons.join(', ') : 'None',
    total: String(price),
    advance: String(advance),
    balance: String(balance),
    razorpay_link: rzp.ok ? (rzp.link || '') : '',
    booking_for: String(d.booking_for || 'myself'),
    passenger_name: d.passenger_name || '',
    passenger_phone: d.passenger_phone || '',
  }
  const renderTpl = (tpl: string) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')

  const defaultSummary = `✅ *Booking Received!*\n\n` +
    `🆔 {booking_id}\n🧾 {service}\n👤 {name}\n📞 {phone}\n📅 {date} • {time}\n` +
    `🚉 {transport}${d.service_info || d.transport_details ? ' • {transport_details}' : ''}\n` +
    `📍 {address}${d.landmark ? '\n🏷️ {landmark}' : ''}\n` +
    (addons.length ? `➕ {addons}\n` : '') +
    `\n💰 Estimated Total: ₹{total}\n💳 Advance to Pay: *₹{advance}*\n🧮 Balance at Service: ₹{balance}\n` +
    (rzp.ok
      ? `\n🔗 Razorpay link: {razorpay_link}\n(UPI / Card / Netbanking — secure)`
      : `\n⚠️ Payment link unavailable right now. Our team will contact you.`)
  const summary = renderTpl(settings?.tpl_booking_received || defaultSummary)
  await sendWhatsApp(phoneNumberId, token, textMsg(waId, summary))

  // Dedicated follow-up payment-link message
  if (rzp.ok && rzp.link) {
    const defaultPay =
      `💳 *Pay ₹{advance} Advance to Confirm*\n\nBooking: {booking_id}\n` +
      `Secure Razorpay link (UPI / Card / Netbanking):\n{razorpay_link}\n\n` +
      `Your booking will be confirmed automatically once payment is received. ✅`
    const payMsg = renderTpl(settings?.tpl_payment_reminder || defaultPay)
    await sendWhatsApp(phoneNumberId, token, textMsg(waId, payMsg))
  }
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
        const advance = Number(parsed.advance || settings?.advance_amount || 200)
        const flowToken = `tn45-${crypto.randomUUID()}`

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
          flow_token: flowToken,
          details: { trigger: matchedKeyword, raw_text: text, message_id: msg.id, parsed },
        }).select().single()

        // Always send the approved Meta template (tn45_whatsapp_automation by default).
        // The template's Flow button carries the published flow — this is the format Meta requires
        // outside the 24h window and also works inside it.
        const out = templateMsg(waId, settings, flowToken)
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
              request: { mode: 'template_flow', template: configuredTemplateName(settings), language: configuredTemplateLanguage(settings), flow_token: flowToken },
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

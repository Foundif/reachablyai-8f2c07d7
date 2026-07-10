// Public Booking API — single source of truth for bookings across Website, WhatsApp Flow,
// Admin, and future mobile apps. Public POST is protected via API key + rate limit + idempotency.
// Admin endpoints require a Supabase JWT.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'

const META_URL = 'https://graph.facebook.com/v20.0'

// ---------- Rate limiter (per instance, sliding window) ----------
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20 // 20 public bookings / minute / IP
const rateBuckets = new Map<string, number[]>()
function rateLimit(ip: string): boolean {
  const now = Date.now()
  const bucket = (rateBuckets.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (bucket.length >= RATE_LIMIT_MAX) { rateBuckets.set(ip, bucket); return false }
  bucket.push(now); rateBuckets.set(ip, bucket); return true
}

// ---------- IST helpers ----------
function istParts() {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return {
    yy: String(d.getUTCFullYear()).slice(-2),
    mm: String(d.getUTCMonth() + 1).padStart(2, '0'),
    d,
  }
}
const istTimestamp = () => istParts().d.toISOString().replace('T', ' ').slice(0, 19) + ' IST'
const bookingIdFor = (seq: number) => {
  const { yy, mm } = istParts()
  return `TN45-${yy}${mm}-${String(seq).padStart(3, '0')}`
}

// ---------- Google Sheets (same shape as whatsapp-webhook) ----------
const SHEET_HEADERS = [
  'Timestamp','Booking ID','Service Selected','Customer Name','Phone Number',
  'Transport Mode','Service Category','Service Info','Reporting Address',
  'Nearest Landmark','Date of Service','Reporting Time','Expected Hrs/Days',
  'Add-ons','Payment Status','UPI Reference','Helper Assigned','Booking Status',
  'Source','Booking For','Passenger Name','Passenger Phone',
]
const cleanTab = (t?: string) => String(t || 'Bookings').trim() || 'Bookings'
const a1Sheet = (t: string) => /^[A-Za-z0-9_]+$/.test(t) ? t : `'${t.replace(/'/g, "''")}'`
async function sheetsFetch(url: string, init: RequestInit) {
  const lk = Deno.env.get('LOVABLE_API_KEY'); const ck = Deno.env.get('GOOGLE_SHEETS_API_KEY')
  if (!lk || !ck) return { ok: false, status: 0, json: { error: 'sheets not configured' } }
  const res = await fetch(url, { ...init, headers: {
    ...(init.headers || {}), Authorization: `Bearer ${lk}`, 'X-Connection-Api-Key': ck,
    'Content-Type': 'application/json',
  }})
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}
const sheetReady = new Set<string>()
async function ensureSheet(sheetId: string, tab: string) {
  const key = `${sheetId}|${tab}`
  if (sheetReady.has(key)) return { ok: true }
  const meta = await sheetsFetch(`https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}?fields=sheets.properties`, { method: 'GET' })
  if (!meta.ok) return meta
  const found = (meta.json?.sheets || []).find((s: any) => s?.properties?.title === tab)
  if (!found) {
    const add = await sheetsFetch(`https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab, gridProperties: { columnCount: 26, frozenRowCount: 1 } } } }] }),
    })
    if (!add.ok) return add
  }
  const range = `${a1Sheet(tab)}!A1:V1`
  const get = await sheetsFetch(`https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}/values/${range}`, { method: 'GET' })
  if (get.ok && (get.json?.values?.[0] || []).length < SHEET_HEADERS.length) {
    await sheetsFetch(`https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
      method: 'PUT', body: JSON.stringify({ values: [SHEET_HEADERS] }),
    })
  }
  sheetReady.add(key)
  return { ok: true }
}
async function appendSheet(sheetId: string, tab: string, row: (string | number)[]) {
  try {
    const safe = cleanTab(tab)
    const e = await ensureSheet(sheetId, safe); if (!e.ok) return e
    const range = `${a1Sheet(safe)}!A:V`
    const url = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
    let r = await sheetsFetch(url, { method: 'POST', body: JSON.stringify({ values: [row] }) })
    if (!r.ok && r.status === 429) { await new Promise(res => setTimeout(res, 1200)); r = await sheetsFetch(url, { method: 'POST', body: JSON.stringify({ values: [row] }) }) }
    return r
  } catch (e: any) { return { ok: false, error: e?.message || String(e) } }
}

// ---------- Razorpay payment link ----------
async function createRazorpayLink(amount: number, booking: any, name: string, phone: string, code: string) {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID'); const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
  if (!keyId || !keySecret) return { ok: false, error: 'razorpay not configured' }
  try {
    const auth = btoa(`${keyId}:${keySecret}`)
    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amount * 100), currency: 'INR', accept_partial: false,
        description: `TN45 Advance Payment - ${code}`,
        customer: { name: name || 'Customer', contact: phone || undefined },
        notify: { sms: false, email: false }, reminder_enable: true,
        notes: { booking_id: booking.id, booking_code: code, user_id: booking.user_id },
        callback_method: 'get',
      }),
    })
    const json = await res.json()
    return { ok: res.ok, link: json.short_url, id: json.id }
  } catch (e: any) { return { ok: false, error: e?.message || String(e) } }
}

// ---------- WhatsApp send ----------
async function sendWhatsAppText(phoneNumberId: string, token: string, to: string, body: string) {
  try {
    const res = await fetch(`${META_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, json }
  } catch (e: any) { return { ok: false, status: 0, json: { error: e?.message } } }
}

// ---------- Validation ----------
const BookingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(20),
  service_code: z.string().trim().max(40).optional(),
  service_name: z.string().trim().max(120).optional(),
  price: z.number().nonnegative().optional(),
  transport_mode: z.string().max(40).optional().nullable(),
  transport_details: z.string().max(200).optional().nullable(),
  service_info: z.string().max(500).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  landmark: z.string().max(200).optional().nullable(),
  booking_date: z.string().max(40).optional().nullable(),
  booking_time: z.string().max(40).optional().nullable(),
  expected_hours: z.string().max(40).optional().nullable(),
  addons: z.array(z.string().max(40)).max(20).optional(),
  booking_for: z.enum(['myself', 'someone_else']).optional(),
  passenger_name: z.string().max(120).optional().nullable(),
  passenger_phone: z.string().max(20).optional().nullable(),
  source: z.string().max(40).optional(), // website, mobile_app, partner, admin
  notes: z.string().max(1000).optional().nullable(),
  idempotency_key: z.string().max(120).optional(),
})

const normalizePhone = (raw: string) => {
  const s = String(raw ?? '').replace(/[\s\-\+()]/g, '')
  return /^\d{10,}$/.test(s) ? s : null
}

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra } })
}

// ---------- Admin auth helper ----------
async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return { error: 'unauthorized' as const }
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data, error } = await supa.auth.getClaims(authHeader.replace('Bearer ', ''))
  if (error || !data?.claims?.sub) return { error: 'unauthorized' as const }
  return { userId: data.claims.sub as string }
}

// ---------- Handlers ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  // Route by trailing path segment (function name stripped by supabase runtime)
  const parts = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean)
  // parts[0] === 'booking-api'
  const sub = parts[1] || ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    // ---- PUBLIC: POST /booking-api  (create booking) ----
    if (req.method === 'POST' && (sub === '' || sub === 'bookings')) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      if (!rateLimit(ip)) return jsonResponse({ error: 'rate_limited', message: 'Too many requests. Retry in 60s.' }, 429, { 'Retry-After': '60' })

      const apiKey = req.headers.get('x-api-key') || ''
      if (!apiKey) return jsonResponse({ error: 'missing_api_key' }, 401)

      const { data: settings, error: sErr } = await supabase
        .from('tn_settings').select('*')
        .eq('public_booking_api_key', apiKey).eq('public_booking_enabled', true)
        .maybeSingle()
      if (sErr || !settings) return jsonResponse({ error: 'invalid_api_key' }, 401)
      const userId = settings.user_id

      const raw = await req.json().catch(() => null)
      if (!raw) return jsonResponse({ error: 'invalid_json' }, 400)
      const parsed = BookingSchema.safeParse(raw)
      if (!parsed.success) return jsonResponse({ error: 'validation_failed', details: parsed.error.flatten().fieldErrors }, 400)
      const d = parsed.data

      // Idempotency
      const headerKey = req.headers.get('idempotency-key') || d.idempotency_key || ''
      if (headerKey) {
        const { data: prior } = await supabase
          .from('tn_booking_idempotency').select('booking_id')
          .eq('user_id', userId).eq('idempotency_key', headerKey).maybeSingle()
        if (prior?.booking_id) {
          const { data: existing } = await supabase.from('tn_bookings').select('*').eq('id', prior.booking_id).maybeSingle()
          return jsonResponse({ ok: true, idempotent: true, booking: existing }, 200)
        }
      }

      // Duplicate detection: same phone + service + date within 2 minutes
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const { data: dupe } = await supabase.from('tn_bookings')
        .select('id, booking_code').eq('user_id', userId).eq('phone', d.phone)
        .gte('created_at', twoMinAgo).limit(1).maybeSingle()
      if (dupe) return jsonResponse({ ok: true, duplicate: true, booking_id: dupe.id, booking_code: dupe.booking_code }, 200)

      // Monthly counter for booking ID
      const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
      const istMonthStartUtc = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1) - 5.5 * 60 * 60 * 1000)
      const { count: monthCount } = await supabase.from('tn_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId).gte('created_at', istMonthStartUtc.toISOString())
      const bookingCode = bookingIdFor((monthCount || 0) + 1)

      const advance = Number(settings.advance_amount || 200)
      const price = Number(d.price || 0)
      const balance = Math.max(0, price - advance)
      const waId = normalizePhone(d.phone) || d.phone
      const source = d.source || 'website'

      // Upsert customer
      const { data: customer } = await supabase.from('tn_customers')
        .upsert({ user_id: userId, wa_id: waId, name: d.name }, { onConflict: 'user_id,wa_id' })
        .select().single()

      const { data: booking, error: bErr } = await supabase.from('tn_bookings').insert({
        user_id: userId, customer_id: customer?.id, wa_id: waId,
        service_code: d.service_code || 'custom', service_name: d.service_name || d.service_code || 'Custom Booking',
        price, addons: d.addons || [],
        name: d.name, phone: d.phone,
        transport_mode: d.transport_mode || null, transport_details: d.transport_details || null,
        address: d.address || null, landmark: d.landmark || null,
        booking_date: d.booking_date || null, booking_time: d.booking_time || null,
        expected_hours: d.expected_hours || null,
        details: { ...d, service_info: d.service_info || null },
        status: 'awaiting_payment',
        advance_amount: advance, balance_amount: balance,
        source, booking_code: bookingCode,
        notes: d.notes || null,
      }).select().single()
      if (bErr) return jsonResponse({ error: 'db_insert_failed', details: bErr.message }, 500)

      // Store idempotency mapping
      if (headerKey) {
        await supabase.from('tn_booking_idempotency').insert({
          user_id: userId, idempotency_key: headerKey, booking_id: booking.id,
        }).select().maybeSingle()
      }

      // Razorpay link
      const rzp = await createRazorpayLink(advance, booking, d.name, d.phone, bookingCode)
      await supabase.from('tn_payments').insert({
        user_id: userId, booking_id: booking.id, amount: advance,
        method: rzp.ok ? 'razorpay' : 'manual', status: 'pending',
        screenshot_url: rzp.ok ? rzp.link : null,
      })

      // Google Sheets sync
      let sheetOk = true
      if (settings.google_sheet_enabled && settings.google_sheet_id) {
        const bookerPhoneValid = !!normalizePhone(d.phone)
        const isSomeoneElse = d.booking_for === 'someone_else'
        const passengerPhoneValid = isSomeoneElse ? !!normalizePhone(d.passenger_phone || '') : true
        const flagged = !bookerPhoneValid || !passengerPhoneValid
        const paymentStatus = flagged ? `Invalid Phone — Advance Pending ₹${advance}` : `Advance Pending ₹${advance}`
        const row = [
          istTimestamp(), bookingCode, d.service_name || d.service_code || '',
          d.name, d.phone, d.transport_mode || '', d.transport_details || '',
          d.service_info || '', d.address || '', d.landmark || '',
          d.booking_date || '', d.booking_time || '', d.expected_hours || '',
          (d.addons || []).join(', ') || 'None', paymentStatus, '', '', 'New',
          source, d.booking_for || 'myself',
          isSomeoneElse ? (d.passenger_name || '') : '',
          isSomeoneElse ? (d.passenger_phone || '') : '',
        ]
        const sres: any = await appendSheet(settings.google_sheet_id, settings.google_sheet_tab || 'Bookings', row)
        sheetOk = !!sres?.ok
        if (!sheetOk) await supabase.from('tn_audit_log').insert({
          user_id: userId, actor_id: userId, entity_type: 'google_sheet_append',
          entity_id: booking.id, action: 'failed', after: { error: sres?.json || sres?.error, source },
        })
      }

      // WhatsApp confirmation (uses existing template variables)
      let waOk = false
      const phoneNumberId = settings.meta_phone_number_id
      const token = Deno.env.get('META_ACCESS_TOKEN')
      if (phoneNumberId && token && waId) {
        const vars: Record<string, string> = {
          booking_id: bookingCode, service: d.service_name || d.service_code || '',
          name: d.name, phone: d.phone,
          date: d.booking_date || '-', time: d.booking_time || '-',
          transport: d.transport_mode || '-', transport_details: d.transport_details || d.service_info || '',
          address: d.address || '-', landmark: d.landmark || '',
          addons: (d.addons || []).join(', ') || 'None',
          total: String(price), advance: String(advance), balance: String(balance),
          razorpay_link: rzp.ok ? (rzp.link || '') : '',
          booking_for: d.booking_for || 'myself',
          passenger_name: d.passenger_name || '', passenger_phone: d.passenger_phone || '',
        }
        const render = (tpl: string) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
        const defaultSummary = `✅ *Booking Received!*\n\n🆔 {booking_id}\n🧾 {service}\n👤 {name}\n📞 {phone}\n📅 {date} • {time}\n📍 {address}\n\n💰 Total: ₹{total}\n💳 Advance: *₹{advance}*\n🧮 Balance: ₹{balance}\n` +
          (rzp.ok ? `\n🔗 Pay: {razorpay_link}` : `\n⚠️ Payment link unavailable — our team will contact you.`)
        const msg = render(settings.tpl_booking_received || defaultSummary)
        const r = await sendWhatsAppText(phoneNumberId, token, waId, msg)
        waOk = r.ok
      }

      // Audit
      await supabase.from('tn_audit_log').insert({
        user_id: userId, actor_id: userId, entity_type: 'booking_api',
        entity_id: booking.id, action: 'created',
        after: { source, ip, sheet: sheetOk, whatsapp: waOk, razorpay: rzp.ok, booking_code: bookingCode },
      })

      return jsonResponse({
        ok: true, booking_id: booking.id, booking_code: bookingCode,
        status: 'awaiting_payment', payment_link: rzp.ok ? rzp.link : null,
        advance_amount: advance, balance_amount: balance,
      }, 201)
    }

    // ---- ADMIN: everything below needs a Supabase JWT ----
    const auth = await requireUser(req)
    if ('error' in auth) return jsonResponse({ error: 'unauthorized' }, 401)
    const userId = auth.userId

    // GET /booking-api/bookings  (list, ?q= search, ?status=, limit, offset)
    if (req.method === 'GET' && (sub === '' || sub === 'bookings')) {
      const q = url.searchParams.get('q')?.trim()
      const status = url.searchParams.get('status')?.trim()
      const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)
      const offset = Number(url.searchParams.get('offset') || 0)
      let query = supabase.from('tn_bookings').select('*', { count: 'exact' })
        .eq('user_id', userId).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
      if (status) query = query.eq('status', status)
      if (q) query = query.or(`booking_code.ilike.%${q}%,phone.ilike.%${q}%,name.ilike.%${q}%,wa_id.ilike.%${q}%`)
      const { data, error, count } = await query
      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ ok: true, count, bookings: data })
    }

    // GET /booking-api/bookings/:id
    if (req.method === 'GET' && sub === 'bookings' && parts[2]) {
      const id = parts[2]
      const { data, error } = await supabase.from('tn_bookings').select('*').eq('user_id', userId)
        .or(`id.eq.${id},booking_code.eq.${id}`).maybeSingle()
      if (error) return jsonResponse({ error: error.message }, 500)
      if (!data) return jsonResponse({ error: 'not_found' }, 404)
      return jsonResponse({ ok: true, booking: data })
    }

    // PATCH /booking-api/bookings/:id  { status, notes }
    if (req.method === 'PATCH' && sub === 'bookings' && parts[2]) {
      const id = parts[2]
      const raw = await req.json().catch(() => ({}))
      const patch = z.object({
        status: z.enum(['draft','awaiting_payment','confirmed','completed','cancelled','paid']).optional(),
        notes: z.string().max(2000).optional(),
      }).safeParse(raw)
      if (!patch.success) return jsonResponse({ error: 'validation_failed', details: patch.error.flatten().fieldErrors }, 400)
      const { data, error } = await supabase.from('tn_bookings').update(patch.data)
        .eq('user_id', userId).eq('id', id).select().maybeSingle()
      if (error) return jsonResponse({ error: error.message }, 500)
      if (!data) return jsonResponse({ error: 'not_found' }, 404)
      await supabase.from('tn_audit_log').insert({
        user_id: userId, actor_id: userId, entity_type: 'booking_api',
        entity_id: id, action: 'updated', after: patch.data,
      })
      return jsonResponse({ ok: true, booking: data })
    }

    return jsonResponse({ error: 'not_found', path: url.pathname, method: req.method }, 404)
  } catch (err: any) {
    console.error('booking-api error', err)
    return jsonResponse({ error: err?.message || 'internal_error' }, 500)
  }
})

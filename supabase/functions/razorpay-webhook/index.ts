// Razorpay webhook: handles payment.captured / payment_link.paid
// - Marks tn_payments completed, tn_bookings status=confirmed
// - Updates Google Sheet "Payment Status" column (R) to "Advance Paid ₹X ✅"
// - Sends a WhatsApp confirmation message to the customer
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
}

const GATEWAY = 'https://connector-gateway.lovable.dev/google_sheets/v4'

async function verifySignature(body: string, signature: string, secret: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const hex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === signature
}

async function sheetsAuthHeaders() {
  return {
    Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
    'X-Connection-Api-Key': Deno.env.get('GOOGLE_SHEETS_API_KEY') || '',
    'Content-Type': 'application/json',
  }
}

async function updateSheetPaymentStatus(sheetId: string, tab: string, bookingCode: string, newStatus: string) {
  try {
    const headers = await sheetsAuthHeaders()
    // Read column B (booking codes) to find the row
    const range = `${tab}!B:B`
    const getUrl = `${GATEWAY}/spreadsheets/${sheetId}/values/${range}`
    const res = await fetch(getUrl, { headers })
    if (!res.ok) return { ok: false, error: `read failed ${res.status}` }
    const data = await res.json()
    const rows: string[][] = data.values || []
    let rowIdx = -1
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i]?.[0] || '').trim() === bookingCode) { rowIdx = i + 1; break }
    }
    if (rowIdx < 1) return { ok: false, error: 'row not found' }
    const putRange = `${tab}!R${rowIdx}`
    const putUrl = `${GATEWAY}/spreadsheets/${sheetId}/values/${putRange}?valueInputOption=USER_ENTERED`
    const put = await fetch(putUrl, {
      method: 'PUT', headers,
      body: JSON.stringify({ range: putRange, majorDimension: 'ROWS', values: [[newStatus]] }),
    })
    if (!put.ok) return { ok: false, error: `write failed ${put.status}` }
    // Also set U (Booking Status) to Confirmed
    const uRange = `${tab}!U${rowIdx}`
    await fetch(`${GATEWAY}/spreadsheets/${sheetId}/values/${uRange}?valueInputOption=USER_ENTERED`, {
      method: 'PUT', headers,
      body: JSON.stringify({ range: uRange, majorDimension: 'ROWS', values: [['Confirmed']] }),
    })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

async function sendWhatsAppText(phoneNumberId: string, token: string, to: string, body: string) {
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body, preview_url: false } }),
  })
  return { ok: res.ok, status: res.status, raw: await res.text() }
}

async function sendWhatsAppImage(phoneNumberId: string, token: string, to: string, imageUrl: string, caption: string) {
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'image', image: { link: imageUrl, caption } }),
  })
  return { ok: res.ok, status: res.status, raw: await res.text() }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const raw = await req.text()
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
  const signature = req.headers.get('x-razorpay-signature') || ''

  if (secret) {
    const valid = await verifySignature(raw, signature, secret)
    if (!valid) {
      console.error('razorpay-webhook: invalid signature')
      return new Response(JSON.stringify({ ok: false, error: 'invalid signature' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  let event: any = {}
  try { event = JSON.parse(raw) } catch { /* noop */ }

  const ev = event?.event || ''
  const payload = event?.payload || {}
  const pl = payload?.payment_link?.entity || payload?.order?.entity || null
  const pmt = payload?.payment?.entity || null
  const notes = pl?.notes || pmt?.notes || {}
  const bookingId = notes?.booking_id
  const bookingCode = notes?.booking_code
  const amount = Math.round((pmt?.amount || pl?.amount_paid || pl?.amount || 0) / 100)

  // Only act on success-style events
  const isSuccess = ev === 'payment.captured' || ev === 'payment_link.paid' || ev === 'order.paid'
  if (!isSuccess || !bookingId) {
    return new Response(JSON.stringify({ ok: true, ignored: ev }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1) Update booking + payments
  const { data: booking } = await supabase
    .from('tn_bookings').select('*').eq('id', bookingId).maybeSingle()

  if (!booking) {
    return new Response(JSON.stringify({ ok: false, error: 'booking not found' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await supabase.from('tn_payments').update({
    status: 'completed', verified_at: new Date().toISOString(),
  }).eq('booking_id', bookingId).in('status', ['pending', 'verified'])

  await supabase.from('tn_bookings').update({
    status: 'confirmed',
    notes: `Razorpay payment received (${ev})`,
  }).eq('id', bookingId)

  // 2) Update Google Sheet
  const { data: settings } = await supabase
    .from('tn_settings').select('*').eq('user_id', booking.user_id).maybeSingle()

  if (settings?.google_sheet_enabled && settings?.google_sheet_id && bookingCode) {
    const sheetRes = await updateSheetPaymentStatus(
      settings.google_sheet_id,
      settings.google_sheet_tab || 'Sheet1',
      bookingCode,
      `Advance Paid ₹${amount || booking.advance_amount || 200} ✅`,
    )
    if (!sheetRes.ok) {
      await supabase.from('tn_audit_log').insert({
        user_id: booking.user_id, actor_id: booking.user_id,
        entity_type: 'google_sheet_update', entity_id: bookingId,
        action: 'failed', after: { error: sheetRes.error, bookingCode, ev },
      })
    }
  }

  // 3) WhatsApp confirmation (customizable template)
  const metaToken = settings?.meta_access_token || Deno.env.get('META_ACCESS_TOKEN')
  if (settings?.meta_phone_number_id && metaToken && booking.wa_id) {
    const paid = amount || booking.advance_amount || 200
    const balance = Number(booking.balance_amount || 0)
    const vars: Record<string, string> = {
      booking_id: bookingCode || '',
      amount: String(paid),
      name: booking.name || '-',
      service: booking.service_name || '',
      balance: String(balance),
      total: String(booking.total_amount || 0),
      advance: String(booking.advance_amount || paid),
      upi_id: settings?.upi_id || '',
      payee_name: settings?.payee_name || '',
      qr_image_url: settings?.qr_image_url || '',
    }
    const render = (tpl: string) => tpl.replace(/\{(\w+)\}/g, (_: string, k: string) => vars[k] ?? '')

    const defaultTpl =
      `✅ *Payment Received!*\n\nBooking {booking_id} is now *fully confirmed*.\n` +
      `Amount: ₹{amount}\nBalance at service: ₹{balance}\n\n` +
      `Our team will contact you shortly with helper assignment details. Thank you! 🙏`
    const tpl = settings.tpl_payment_confirmed || defaultTpl
    await sendWhatsAppText(settings.meta_phone_number_id, metaToken, booking.wa_id, render(tpl))

    // 4) Final balance collection message (only if there's a balance remaining)
    if (balance > 0) {
      const defaultFinal =
        `💰 *Balance Collection*\n\nBooking {booking_id}\nRemaining Balance: *₹{balance}*\n\n` +
        `Please pay the remaining amount using:\n` +
        `📱 UPI ID: *{upi_id}*\n👤 Payee: {payee_name}\n\n` +
        `After payment, please share the screenshot here. Thank you! 🙏`
      const finalTpl = settings.tpl_final_collection || defaultFinal
      const finalMsg = render(finalTpl)
      if (settings?.qr_image_url) {
        const imgRes = await sendWhatsAppImage(settings.meta_phone_number_id, metaToken, booking.wa_id, settings.qr_image_url, finalMsg)
        if (!imgRes.ok) {
          // fallback to text if image fails
          await sendWhatsAppText(settings.meta_phone_number_id, metaToken, booking.wa_id, finalMsg)
        }
      } else {
        await sendWhatsAppText(settings.meta_phone_number_id, metaToken, booking.wa_id, finalMsg)
      }
    }
  }

  await supabase.from('tn_audit_log').insert({
    user_id: booking.user_id, actor_id: booking.user_id,
    entity_type: 'razorpay_webhook', entity_id: bookingId,
    action: 'paid', after: { ev, amount, bookingCode },
  })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

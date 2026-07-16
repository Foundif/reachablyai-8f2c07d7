// Manual "Send Payment Follow-up" — staff-triggered balance collection message.
// Sends the UPI/QR balance-collection template ONCE per booking (unless force=true).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const META = 'https://graph.facebook.com/v20.0'

async function sendText(pnid: string, token: string, to: string, body: string) {
  const r = await fetch(`${META}/${pnid}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body, preview_url: false } }),
  })
  return { ok: r.ok, status: r.status, raw: await r.text().catch(() => '') }
}
async function sendImage(pnid: string, token: string, to: string, url: string, caption: string) {
  const r = await fetch(`${META}/${pnid}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'image', image: { link: url, caption } }),
  })
  return { ok: r.ok, status: r.status, raw: await r.text().catch(() => '') }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: claims, error: aErr } = await anon.auth.getClaims(authHeader.replace('Bearer ', ''))
    if (aErr || !claims?.claims?.sub) return json({ error: 'unauthorized' }, 401)
    const actorId = claims.claims.sub as string

    const body = await req.json().catch(() => ({}))
    const bookingId = body?.booking_id
    const force = !!body?.force
    if (!bookingId) return json({ error: 'booking_id required' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: booking, error: bErr } = await admin.from('tn_bookings').select('*').eq('id', bookingId).maybeSingle()
    if (bErr || !booking) return json({ error: 'booking_not_found' }, 404)

    // ownership check (owner or staff of owner)
    const { data: prof } = await admin.from('profiles').select('user_id,is_staff,owner_id').eq('user_id', actorId).maybeSingle()
    const ownerId = prof?.is_staff ? prof?.owner_id : actorId
    if (booking.user_id !== ownerId && booking.user_id !== actorId) return json({ error: 'forbidden' }, 403)

    if (!force && booking.balance_msg_sent_at) {
      return json({ ok: false, already_sent: true, sent_at: booking.balance_msg_sent_at, message: 'Balance collection message was already sent for this booking.' }, 409)
    }

    const { data: settings } = await admin.from('tn_settings').select('*').eq('user_id', booking.user_id).maybeSingle()
    const token = settings?.meta_access_token || Deno.env.get('META_ACCESS_TOKEN')
    const pnid = settings?.meta_phone_number_id
    if (!pnid || !token || !booking.wa_id) return json({ error: 'whatsapp_not_configured' }, 400)

    const balance = Number(booking.balance_amount || 0)
    const vars: Record<string, string> = {
      booking_id: booking.booking_code || '',
      name: booking.name || '-',
      service: booking.service_name || '',
      total: String(booking.price || 0),
      advance: String(booking.advance_amount || 0),
      balance: String(balance),
      amount: String(balance),
      upi_id: settings?.upi_id || '',
      payee_name: settings?.payee_name || '',
      qr_image_url: settings?.qr_image_url || '',
    }
    const render = (tpl: string) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
    const defaultTpl =
      `💰 *Balance Collection*\n\nBooking {booking_id}\nRemaining Balance: *₹{balance}*\n\n` +
      `Please pay using:\n📱 UPI ID: *{upi_id}*\n👤 Payee: {payee_name}\n\n` +
      `After payment, share the screenshot here. Thank you! 🙏`
    const msg = render(settings?.tpl_final_collection || defaultTpl)

    let result
    if (settings?.qr_image_url) {
      result = await sendImage(pnid, token, booking.wa_id, settings.qr_image_url, msg)
      if (!result.ok) result = await sendText(pnid, token, booking.wa_id, msg)
    } else {
      result = await sendText(pnid, token, booking.wa_id, msg)
    }

    if (!result.ok) {
      await admin.from('tn_audit_log').insert({
        user_id: booking.user_id, actor_id: actorId,
        entity_type: 'balance_followup', entity_id: bookingId,
        action: 'failed', after: { status: result.status, error: result.raw },
      })
      return json({ ok: false, error: 'meta_send_failed', details: result.raw, status: result.status }, 502)
    }

    await admin.from('tn_bookings').update({
      balance_msg_sent_at: new Date().toISOString(),
      balance_msg_sent_by: actorId,
    }).eq('id', bookingId)

    await admin.from('tn_audit_log').insert({
      user_id: booking.user_id, actor_id: actorId,
      entity_type: 'balance_followup', entity_id: bookingId,
      action: force ? 'resent' : 'sent', after: { to: booking.wa_id },
    })

    return json({ ok: true, sent_to: booking.wa_id })
  } catch (e: any) {
    return json({ error: e?.message || 'internal_error' }, 500)
  }
})

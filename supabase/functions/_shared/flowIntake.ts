// Captures a WhatsApp Flow submission (interactive → nfm_reply) as a CRM record,
// stores every submitted field, and raises the advance payment link automatically.

const FIELD_LABELS: Record<string, string> = {
  service: 'Service',
  name: 'Name',
  phone: 'Phone',
  booking_for: 'Booking for',
  passenger_name: 'Passenger name',
  passenger_phone: 'Passenger phone',
  transport_mode: 'Transport mode',
  transport_details: 'Service category',
  service_info: 'Service info',
  address: 'Reporting address',
  landmark: 'Nearest landmark',
  date: 'Date',
  time: 'Reporting time',
  hours: 'Expected hours/days',
  addons: 'Add-ons',
  status: 'Submission status',
};

// Fallback price book (₹) keyed by the service option ids used in the Flow JSON.
// A workspace can override this from workspace_settings.flow_service_prices.
const DEFAULT_PRICES: Record<string, number> = {
  'terminal-railbus': 200,
  'home-railbus': 200,
  'railbus-home': 200,
  'festivity-half': 600,
  'festivity-full': 1200,
  hospital: 500,
  outstation: 1200,
};

const ADDON_PRICES: Record<string, number> = { wheelchair: 50 };

const HIDDEN_KEYS = new Set(['flow_token', 'flow_id', 'version', 'screen', '__version__']);

export function extractFlowResponse(m: any): Record<string, any> | null {
  const raw = m?.interactive?.nfm_reply?.response_json;
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function prettyLabel(key: string) {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyValue(v: any): string {
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x).replace(/_/g, ' ')).join(', ') : '—';
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

export function flowSummary(fields: Record<string, any>) {
  const lines = Object.entries(fields)
    .filter(([k]) => !HIDDEN_KEYS.has(k))
    .map(([k, v]) => `${prettyLabel(k)}: ${prettyValue(v)}`);
  return `\u{1F4CB} Form submitted\n${lines.join('\n')}`;
}

function parseScheduledAt(date?: string, time?: string): string | null {
  if (!date) return null;
  // Flow DatePicker sends either an epoch-ms string or YYYY-MM-DD.
  let base: Date | null = null;
  if (/^\d{10,}$/.test(String(date))) base = new Date(Number(date));
  else if (/^\d{4}-\d{2}-\d{2}/.test(String(date))) base = new Date(`${String(date).slice(0, 10)}T00:00:00+05:30`);
  if (!base || isNaN(base.getTime())) return null;
  const t = String(time || '').trim();
  const match = t.match(/^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/i);
  if (match) {
    let h = Number(match[1]);
    const mm = Number(match[2] || 0);
    const ap = (match[3] || '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    const iso = base.toISOString().slice(0, 10);
    const withTime = new Date(`${iso}T${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`);
    if (!isNaN(withTime.getTime())) return withTime.toISOString();
  }
  return base.toISOString();
}

function digits(v: any) {
  return String(v || '').replace(/\D/g, '');
}

/**
 * Creates the CRM record from a Flow submission and (when Razorpay is connected)
 * the advance payment link, sending it to the customer on WhatsApp.
 */
export async function handleFlowSubmission(opts: {
  admin: any;
  creds: { workspace_id: string; business_phone: string; access_token: string; phone_number_id?: string };
  workspace_id: string;
  conversation_id: string;
  lead_id: string | null;
  from: string;
  fields: Record<string, any>;
}) {
  const { admin, creds, workspace_id, conversation_id, lead_id, from, fields } = opts;
  const isTravelBooking = Boolean(fields.transport_mode || fields.booking_for || fields.passenger_name || fields.passenger_phone);

  const { data: settings } = await admin.from('workspace_settings')
    .select('flow_service_prices, flow_advance_amount').eq('workspace_id', workspace_id).maybeSingle();
  const prices: Record<string, number> = { ...DEFAULT_PRICES, ...((settings?.flow_service_prices as any) || {}) };
  const advanceAmount = Number(settings?.flow_advance_amount ?? 200) || 200;

  const serviceId = String(fields.service || '').trim();
  const addons: string[] = Array.isArray(fields.addons)
    ? fields.addons.map((a: any) => String(a))
    : String(fields.addons || '').split(',').map((s) => s.trim()).filter(Boolean);
  const base = prices[serviceId] || 0;
  const addonTotal = addons.reduce((sum, a) => sum + (ADDON_PRICES[a] || 0), 0);
  const total = base + addonTotal;

  const customerName = String(fields.name || '').trim() || from;
  // Booking on behalf of someone else: the record keeps the traveller too, but
  // WhatsApp messaging always stays on the chat that submitted the form.
  const customerPhone = digits(fields.phone) || from;
  const scheduled_at = parseScheduledAt(fields.date, fields.time);

  const recordPrefix = isTravelBooking ? 'BK' : 'FM';
  const { data: code } = await admin.rpc('next_record_code', { _ws: workspace_id, _prefix: recordPrefix });

  const genericTitle = String(fields.subject || fields.interest || fields.event || fields.feedback || fields.message || '').trim();
  const title = isTravelBooking
    ? (serviceId ? prettyValue(serviceId) : 'WhatsApp booking')
    : (genericTitle ? genericTitle.slice(0, 100) : 'WhatsApp form submission');

  const { data: rec, error: recErr } = await admin.from('business_records').insert({
    workspace_id,
    record_code: code || `${recordPrefix}-${Date.now()}`,
    record_type: isTravelBooking ? 'booking' : 'form_submission',
    title,
    customer_name: customerName,
    customer_phone: customerPhone,
    status: isTravelBooking ? 'pending_payment' : 'new',
    payment_status: 'pending',
    amount: total,
    advance_amount: isTravelBooking ? advanceAmount : 0,
    service: serviceId || null,
    scheduled_at,
    source: 'whatsapp_flow',
    conversation_id,
    lead_id,
    custom_fields: fields,
    notes: [fields.service_info, fields.address, fields.landmark].filter(Boolean).join(' · ') || null,
  }).select('*').single();

  if (recErr || !rec) throw new Error(recErr?.message || 'record insert failed');

  await admin.from('record_timeline').insert({
    record_id: rec.id, workspace_id, event: 'flow_submitted',
    detail: flowSummary(fields).slice(0, 2000), actor_name: customerName,
  });

  // Keep the contact record in sync with what the customer typed in the form.
  if (lead_id) {
    await admin.from('leads').update({
      name: customerName,
      notes: `Latest form submission ${rec.record_code}`,
      status: 'qualified',
    }).eq('id', lead_id);
  }

  // ---- Advance payment link (travel booking only; workspace-owned Razorpay keys) ----
  let link: string | null = null;
  let linkError: string | null = null;
  if (isTravelBooking) try {
    const { data: integ } = await admin.from('integrations').select('settings')
      .eq('workspace_id', workspace_id).eq('provider', 'razorpay').maybeSingle();
    const key_id = (integ?.settings as any)?.key_id;
    const key_secret = (integ?.settings as any)?.key_secret;
    if (!key_id || !key_secret) {
      linkError = 'Razorpay not connected for this workspace';
    } else {
      const res = await fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: { Authorization: `Basic ${btoa(`${key_id}:${key_secret}`)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(advanceAmount * 100),
          currency: 'INR',
          description: `Advance Payment - ${rec.record_code}`,
          reference_id: `${rec.record_code}-advance-${Date.now()}`.slice(0, 39),
          customer: { name: customerName, contact: `+${customerPhone}` },
          notify: { sms: false, email: false },
          reminder_enable: true,
          notes: { record_id: rec.id, workspace_id, kind: 'advance' },
        }),
      });
      const body = await res.json();
      if (res.ok && body?.short_url) {
        link = body.short_url;
        await admin.from('record_payments').insert({
          record_id: rec.id, workspace_id, kind: 'advance', amount: advanceAmount,
          status: 'link_sent', payment_link: link, razorpay_link_id: body.id,
        });
        await admin.from('business_records').update({ payment_status: 'link_sent' }).eq('id', rec.id);
        await admin.from('record_timeline').insert({
          record_id: rec.id, workspace_id, event: 'payment_link_created',
          detail: `advance ₹${advanceAmount} — ${link}`,
        });
      } else {
        linkError = body?.error?.description || `Razorpay HTTP ${res.status}`;
      }
    }
  } catch (e: any) {
    linkError = String(e?.message || e);
  }

  // ---- Notify the customer on the same WhatsApp chat ----
  const text = isTravelBooking
    ? (link
      ? `✅ Booking received — ${rec.record_code}\n${prettyValue(serviceId)}\n\nPay the advance of ₹${advanceAmount} to confirm:\n${link}\n\nBalance is payable at the end of the service.`
      : `✅ Booking received — ${rec.record_code}\nOur team will send you the advance payment link shortly.`)
    : `✅ Form received — ${rec.record_code}\nThank you. Our team will get back to you shortly.`;

  try {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'text', text: { body: text, preview_url: true } }),
    });
    const rb = await resp.json();
    await admin.from('wa_messages').insert({
      workspace_id, conversation_id, direction: 'outbound',
      wa_message_id: rb?.messages?.[0]?.id || null,
      from_phone: creds.business_phone, to_phone: from, body: text, message_type: 'text',
      status: resp.ok ? 'sent' : 'failed', error: resp.ok ? null : (rb?.error?.message || `HTTP ${resp.status}`),
    });
    if (resp.ok) {
      await admin.from('wa_conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_text: text.slice(0, 200),
        last_message_direction: 'outbound',
      }).eq('id', conversation_id);
    }
  } catch (_) { /* non-fatal: the record already exists in the CRM */ }

  return { record: rec, link, linkError };
}

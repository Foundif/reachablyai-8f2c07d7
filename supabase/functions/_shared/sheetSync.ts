// Google Sheets live sync.
//
// Each workspace connects its OWN Google Sheet by deploying a tiny Apps Script
// web app (see the Integrations page for the snippet + instructions) and saving
// that web app URL here. We POST a flat row keyed by the CRM record code; the
// script appends a new row or updates the existing one with the same code.
//
// Never throws — a sheet problem must never break a booking or a payment.

export const SHEET_COLUMNS = [
  'Updated At',
  'Booking ID',
  'Type',
  'Customer Name',
  'Customer Phone',
  'Booked For',
  'Passenger Name',
  'Passenger Phone',
  'Service',
  'Add-ons',
  'Address',
  'Landmark',
  'Scheduled Date',
  'Scheduled Time',
  'Hours',
  'Total Amount',
  'Advance Amount',
  'Paid Amount',
  'Balance',
  'Booking Status',
  'Payment Status',
  'Payment ID',
  'Payment Link',
  'Source',
  'Notes',
] as const;

const IST = 'Asia/Kolkata';

function istParts(iso?: string | null) {
  if (!iso) return { date: '', time: '', stamp: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: '', stamp: '' };
  const date = d.toLocaleDateString('en-GB', { timeZone: IST });
  const time = d.toLocaleTimeString('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit' });
  return { date, time, stamp: `${date} ${time}` };
}

function titleCase(v: any) {
  const s = String(v ?? '').replace(/[_-]+/g, ' ').trim();
  return s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : '';
}

function listValue(v: any) {
  if (Array.isArray(v)) return v.map((x) => titleCase(x)).join(', ');
  return titleCase(v);
}

/** Builds the flat sheet row for a CRM record. */
export function buildSheetRow(rec: any, pay: any | null): Record<string, string | number> {
  const f = (rec?.custom_fields as Record<string, any>) || {};
  const sched = istParts(rec?.scheduled_at);
  const total = Number(rec?.amount || 0);
  const paid = Number(rec?.paid_amount || 0);

  return {
    'Updated At': istParts(new Date().toISOString()).stamp,
    'Booking ID': String(rec?.record_code || ''),
    Type: rec?.record_type === 'booking' ? 'Booking' : 'Form Submission',
    'Customer Name': String(rec?.customer_name || ''),
    'Customer Phone': String(rec?.customer_phone || ''),
    'Booked For': titleCase(f.booking_for) || 'Self',
    'Passenger Name': String(f.passenger_name || ''),
    'Passenger Phone': String(f.passenger_phone || ''),
    Service: titleCase(rec?.service || f.service || rec?.title),
    'Add-ons': listValue(f.addons),
    Address: String(f.address || ''),
    Landmark: String(f.landmark || ''),
    'Scheduled Date': sched.date,
    'Scheduled Time': sched.time || String(f.time || ''),
    Hours: String(f.hours || ''),
    'Total Amount': total,
    'Advance Amount': Number(rec?.advance_amount || 0),
    'Paid Amount': paid,
    Balance: Math.max(0, total - paid),
    'Booking Status': titleCase(rec?.status),
    'Payment Status': titleCase(rec?.payment_status),
    'Payment ID': String(pay?.razorpay_payment_id || ''),
    'Payment Link': String(pay?.payment_link || ''),
    Source: titleCase(rec?.source),
    Notes: String(rec?.notes || f.notes || ''),
  };
}

type SheetSettings = { web_app_url?: string; tab?: string; secret?: string; enabled?: boolean };

export async function getSheetSettings(admin: any, workspace_id: string): Promise<SheetSettings | null> {
  const { data } = await admin.from('integrations').select('settings')
    .eq('workspace_id', workspace_id).eq('provider', 'google_sheets').maybeSingle();
  const s = (data?.settings as SheetSettings) || null;
  if (!s?.web_app_url) return null;
  return s;
}

/** Posts one row to the workspace's Apps Script web app. */
export async function pushSheetRow(
  settings: SheetSettings,
  row: Record<string, string | number>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(String(settings.web_app_url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify({
        secret: settings.secret || '',
        tab: settings.tab || 'Bookings',
        key: 'Booking ID',
        columns: SHEET_COLUMNS,
        row,
      }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Sheet HTTP ${res.status}: ${text.slice(0, 300)}` };
    let body: any = {};
    try { body = JSON.parse(text); } catch { /* Apps Script may return HTML on redirect */ }
    if (body && body.ok === false) return { ok: false, error: String(body.error || 'Sheet rejected the row') };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/**
 * Syncs a single CRM record (and its latest payment) to the workspace sheet.
 * Safe to call from any flow — resolves quietly when Sheets isn't connected.
 */
export async function syncRecordToSheet(
  admin: any,
  workspace_id: string,
  record: any,
): Promise<{ synced: boolean; error?: string }> {
  try {
    const settings = await getSheetSettings(admin, workspace_id);
    if (!settings || settings.enabled === false) return { synced: false };

    const { data: pay } = await admin.from('record_payments')
      .select('razorpay_payment_id, payment_link, status')
      .eq('record_id', record.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

    const result = await pushSheetRow(settings, buildSheetRow(record, pay));
    if (!result.ok) {
      console.error('sheet sync failed', record?.record_code, result.error);
      await admin.from('record_timeline').insert({
        record_id: record.id, workspace_id, event: 'sheet_sync_failed',
        detail: String(result.error).slice(0, 500), actor_name: 'Google Sheets',
      });
      return { synced: false, error: result.error };
    }
    return { synced: true };
  } catch (e: any) {
    console.error('sheet sync error', e);
    return { synced: false, error: String(e?.message || e) };
  }
}

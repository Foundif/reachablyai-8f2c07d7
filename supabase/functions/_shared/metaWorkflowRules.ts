export const KPI_KEYS = ['spend', 'impressions', 'clicks', 'leads', 'cpl'] as const;
export function validateClient(c: Record<string, unknown>) {
  if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 120) throw new Error('Client name is required (maximum 120 characters)');
  if (c.destination && !/^\+[1-9]\d{7,14}$/.test(String(c.destination))) throw new Error('Use an international WhatsApp number, such as +919876543210');
  for (const key of ['ad_account_id', 'page_id']) if (c[key] && !/^\d+$/.test(String(c[key]))) throw new Error(`${key} must contain digits only`);
  if (!['daily', 'weekly', 'monthly'].includes(String(c.cadence))) throw new Error('Select a valid schedule');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(c.report_time))) throw new Error('Select a valid time');
  try { new Intl.DateTimeFormat('en', { timeZone: String(c.timezone) }); } catch { throw new Error('Select a valid timezone'); }
  if (!Array.isArray(c.kpis) || !c.kpis.length || c.kpis.some(k => !KPI_KEYS.includes(k))) throw new Error('Select supported KPIs');
  if (!Array.isArray(c.form_ids) || c.form_ids.some(id => !/^\d+$/.test(String(id)))) throw new Error('Form IDs must contain digits only');
  if (!Number.isInteger(c.weekday) || Number(c.weekday) < 0 || Number(c.weekday) > 6) throw new Error('Weekday must be 0–6');
  if (!Number.isInteger(c.monthday) || Number(c.monthday) < 1 || Number(c.monthday) > 28) throw new Error('Monthly day must be 1–28');
}
export function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return {year:get('year'),month:get('month'),day:get('day'),hour:get('hour'),minute:get('minute')};
}
export function nextReport(c: any, now = new Date()) {
  // Resolve wall-clock schedules through Intl to respect timezone/DST changes.
  const [hour, minute] = c.report_time.split(':').map(Number);
  const start = Math.floor(now.getTime()/60000)*60000 + 60000;
  for (let t=start; t<start+33*86400000; t+=60000) {
    const p = localParts(new Date(t), c.timezone);
    if (p.hour!==hour || p.minute!==minute) continue;
    const weekday = new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay();
    if (c.cadence==='weekly' && weekday!==c.weekday) continue;
    if (c.cadence==='monthly' && p.day!==c.monthday) continue;
    return new Date(t).toISOString();
  }
  throw new Error('Could not calculate schedule');
}
export function reportPeriod(c: any, now = new Date()) {
  const p = localParts(now,c.timezone);
  const end = new Date(Date.UTC(p.year,p.month-1,p.day));
  let start: Date;
  if(c.cadence==='monthly') { end.setUTCDate(1); start=new Date(end); start.setUTCMonth(start.getUTCMonth()-1); }
  else { start=new Date(end); start.setUTCDate(start.getUTCDate()-(c.cadence==='weekly'?7:1)); }
  end.setUTCDate(end.getUTCDate()-1);
  return {since:start.toISOString().slice(0,10),until:end.toISOString().slice(0,10)};
}
export function summariseInsights(rows: any[]) {
  const total={spend:0,impressions:0,clicks:0,leads:0,cpl:0};
  for(const r of rows) { for(const key of ['spend','impressions','clicks'] as const) total[key]+=Number(r[key]||0);
    const action=['lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead','leadgen_grouped'].map(type=>(r.actions||[]).find((a:any)=>a.action_type===type)).find(Boolean);
    total.leads+=Number(action?.value||0);
  }
  total.cpl=total.leads?total.spend/total.leads:0; return total;
}
export async function validMetaSignature(secret: string, raw: string, header: string | null) {
  if(!secret || !header || !/^sha256=[a-f0-9]{64}$/.test(header)) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const signature=new Uint8Array(header.slice(7).match(/../g)?.map(h=>parseInt(h,16))||[]);
  return crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(raw));
}

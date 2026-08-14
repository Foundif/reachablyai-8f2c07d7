/**
 * Client-side WhatsApp Gateway API helper.
 * All WhatsApp logic lives on the external Bolt gateway; we only call it from the browser.
 */

const SETTINGS_KEY = 'wa_gateway_settings';
const QUOTA_KEY = 'wa_gateway_quota';

export const DAILY_QUOTA = 100;

export type GatewaySettings = {
  baseUrl: string;
  webhookUrl: string;
  instanceId: string;
};

const DEFAULTS: GatewaySettings = {
  baseUrl: 'https://whatsapp-business-ap-bu3j.bolt.host',
  webhookUrl: '',
  instanceId: '',
};

export function getGatewaySettings(): GatewaySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveGatewaySettings(patch: Partial<GatewaySettings>) {
  const next = { ...getGatewaySettings(), ...patch };
  next.baseUrl = next.baseUrl.replace(/\/+$/, '');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('gateway-settings-changed'));
  return next;
}

/* ---------------- quota ---------------- */

const today = () => new Date().toISOString().slice(0, 10);

export function getQuotaUsed(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(QUOTA_KEY) || '{}');
    return raw.date === today() ? Number(raw.count) || 0 : 0;
  } catch {
    return 0;
  }
}

export function addQuotaUsed(n: number) {
  const count = getQuotaUsed() + n;
  localStorage.setItem(QUOTA_KEY, JSON.stringify({ date: today(), count }));
  window.dispatchEvent(new CustomEvent('gateway-quota-changed'));
  return count;
}

export function quotaRemaining() {
  return Math.max(0, DAILY_QUOTA - getQuotaUsed());
}

/* ---------------- api ---------------- */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl } = getGatewaySettings();
  if (!baseUrl) throw new Error('Gateway URL is not configured. Open Gateway → Settings.');
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Request failed (${res.status})`);
  return data as T;
}

export type InstanceStatus = 'connected' | 'disconnected' | 'qrcode' | string;

export const gatewayApi = {
  createInstance: () => request<{ instanceId: string; qrCode: string }>('/instance/create', { method: 'POST', body: '{}' }),
  status: (id: string) => request<{ status: InstanceStatus; qrCode?: string }>(`/instance/status/${encodeURIComponent(id)}`),
  logout: (id: string) => request<any>(`/instance/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  contacts: (id: string) => request<any>(`/contacts/${encodeURIComponent(id)}`),
  messages: (id: string, chatId: string) => request<any>(`/messages/${encodeURIComponent(id)}/${encodeURIComponent(chatId)}`),
  send: (instanceId: string, number: string, message: string) =>
    request<any>('/message/send', { method: 'POST', body: JSON.stringify({ instanceId, number, message }) }),
  sendBulk: (instanceId: string, recipients: { number: string; message: string }[]) =>
    request<any>('/message/send-bulk', { method: 'POST', body: JSON.stringify({ instanceId, recipients }) }),
  sendCarousel: (
    instanceId: string,
    number: string,
    title: string,
    cards: { title: string; description: string; imageUrl: string; buttonText: string }[],
  ) => request<any>('/message/send-carousel', { method: 'POST', body: JSON.stringify({ instanceId, number, title, cards }) }),
};

/** Normalises the various shapes a gateway may return into an array. */
export function toArray(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  for (const k of ['contacts', 'messages', 'data', 'items', 'result']) {
    if (Array.isArray(payload[k])) return payload[k];
  }
  return [];
}

/* ---------------- local contact store ---------------- */

const CONTACTS_KEY = 'wa_gateway_contacts';
export type GatewayContact = { id: string; name: string; number: string; savedAt: string };

export function getSavedContacts(): GatewayContact[] {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'); } catch { return []; }
}

export function saveContacts(list: GatewayContact[]) {
  const map = new Map(getSavedContacts().map(c => [c.number, c]));
  list.forEach(c => map.set(c.number, c));
  const next = Array.from(map.values());
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
  return next;
}

export function removeContact(number: string) {
  const next = getSavedContacts().filter(c => c.number !== number);
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
  return next;
}

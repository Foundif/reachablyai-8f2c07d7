// Pure Instagram automation rules (no network) so they can be unit tested.

export interface IgKeyword { keyword: string; reply: string }
export interface IgButton { question?: string; title?: string; reply: string }
export interface IgCommentRule { keyword: string; dm: string; public_reply?: string }
export interface IgSettings {
  welcome_enabled?: boolean;
  welcome_message?: string;
  keywords?: IgKeyword[];
  ice_breakers?: IgButton[];
  menu?: IgButton[];
  comment_rules?: IgCommentRule[];
  story_reply_enabled?: boolean;
  story_reply_message?: string;
  story_mention_enabled?: boolean;
  story_mention_message?: string;
  ai_enabled?: boolean;
}

export const IG_WINDOW_MS = 24 * 60 * 60 * 1000;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Keyword matches when it equals the text or appears as a whole word/phrase. */
export function matchesKeyword(text: string, keyword: string): boolean {
  const t = norm(text || '');
  const k = norm(keyword || '');
  if (!k) return false;
  if (t === k) return true;
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, 'u').test(t);
}

export function findKeywordReply(text: string, s: IgSettings): string | null {
  for (const k of s.keywords || []) if (k.reply?.trim() && matchesKeyword(text, k.keyword)) return k.reply;
  return null;
}

export function findCommentRule(text: string, s: IgSettings): IgCommentRule | null {
  for (const r of s.comment_rules || []) if (r.dm?.trim() && matchesKeyword(text, r.keyword)) return r;
  return null;
}

/** Postback payloads: IB_<n> = starter question, MENU_<n> = fixed menu item. */
export function postbackReply(payload: string, s: IgSettings): string | null {
  const m = /^(IB|MENU)_(\d+)$/.exec(payload || '');
  if (!m) return null;
  const list = m[1] === 'IB' ? s.ice_breakers : s.menu;
  return list?.[Number(m[2])]?.reply?.trim() || null;
}

/** Instagram only allows free-form messages within 24h of the customer's last message. */
export function windowOpen(lastInboundAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastInboundAt) return false;
  return now - new Date(lastInboundAt).getTime() < IG_WINDOW_MS;
}

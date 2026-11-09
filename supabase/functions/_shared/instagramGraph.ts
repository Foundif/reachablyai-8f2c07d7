// Instagram Messaging API (via the linked Facebook Page) helpers.
export const GRAPH = 'https://graph.facebook.com/v21.0';

export async function igSendText(pageId: string, token: string, recipient: { id?: string; comment_id?: string }, text: string) {
  const r = await fetch(`${GRAPH}/${pageId}/messages?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, message: { text: text.slice(0, 1000) } }),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, id: body?.message_id as string | undefined, error: r.ok ? null : (body?.error?.message || `HTTP ${r.status}`) };
}

export async function igPublicCommentReply(commentId: string, token: string, text: string) {
  const r = await fetch(`${GRAPH}/${commentId}/replies?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text.slice(0, 300) }),
  });
  return r.ok;
}

export async function igProfile(igsid: string, token: string): Promise<{ name?: string; username?: string }> {
  try {
    const r = await fetch(`${GRAPH}/${igsid}?fields=name,username&access_token=${encodeURIComponent(token)}`);
    return r.ok ? await r.json() : {};
  } catch { return {}; }
}

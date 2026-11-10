// Instagram Messaging API (via the linked Facebook Page) helpers.
export const GRAPH = 'https://graph.facebook.com/v26.0';

export async function graphRequest(path: string, token: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${GRAPH}/${path}`, { method, signal: AbortSignal.timeout(12000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error?.message || `Meta request failed (${response.status})`);
  return data;
}

export async function igSendText(pageId: string, token: string, recipient: { id?: string; comment_id?: string }, text: string) {
  try {
    const data = await graphRequest(`${pageId}/messages`, token, 'POST', { recipient, message: { text } });
    return { ok: true, id: data.message_id as string | undefined, error: null };
  } catch (error) { return { ok: false, id: undefined, error: (error as Error).message }; }
}

export async function igPublicCommentReply(commentId: string, token: string, text: string) {
  const r = await fetch(`${GRAPH}/${commentId}/replies?access_token=${encodeURIComponent(token)}`, {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text.slice(0, 300) }),
  });
  return r.ok;
}

export async function igProfile(igsid: string, token: string): Promise<{ name?: string; username?: string }> {
  try {
    const r = await fetch(`${GRAPH}/${igsid}?fields=name,username&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(8000) });
    return r.ok ? await r.json() : {};
  } catch { return {}; }
}

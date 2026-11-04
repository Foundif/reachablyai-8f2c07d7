/** Turn raw Meta/edge errors into a clear, actionable sentence. */
export function friendlyWaError(raw?: string | null): string {
  if (!raw) return '';
  const s = String(raw);
  if (/session has expired|access token|authentication error|\b190\b|OAuthException/i.test(s)) {
    return 'WhatsApp access token expired — open WhatsApp Settings and save a permanent token to resume sending.';
  }
  if (/131009|parameter value is not valid/i.test(s)) return 'Template parameters don\'t match the approved template.';
  if (/131047|re-engagement|24 hours/i.test(s)) return 'Outside the 24-hour window — send an approved template instead.';
  return s;
}

/** Read the JSON error body from a supabase.functions.invoke failure. */
export async function invokeErrorMessage(error: any, data?: any): Promise<string> {
  if (data?.error) return friendlyWaError(data.error);
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return friendlyWaError(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
  } catch { /* ignore */ }
  return friendlyWaError(error?.message) || 'Something went wrong';
}

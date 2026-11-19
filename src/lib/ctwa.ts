export type CtwaSource = 'instagram' | 'facebook_post' | 'facebook_ads' | 'google' | 'others';

/** Classify a Meta Click-to-WhatsApp `referral` object into a dashboard source bucket. */
export function classifyReferral(ref: { source_type?: string; source_url?: string } | null | undefined): CtwaSource {
  const url = (ref?.source_url || '').toLowerCase();
  const type = (ref?.source_type || '').toLowerCase();
  if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
  if (url.includes('google.') || url.includes('gclid')) return 'google';
  if (type === 'ad') return 'facebook_ads';
  if (type === 'post' || url.includes('facebook.com') || url.includes('fb.me') || url.includes('fb.com')) return 'facebook_post';
  return 'others';
}

// Media stored in the private `salon-assets` bucket must be handed to Meta as a
// short-lived signed URL, since anonymous public reads are disabled.

const PRIVATE_BUCKETS = ['salon-assets'];

function parseStoragePath(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public\/|authenticated\/|sign\/)?([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  const [, bucket, path] = m;
  if (!PRIVATE_BUCKETS.includes(bucket)) return null;
  return { bucket, path: decodeURIComponent(path) };
}

/** Returns a 1-hour signed URL for private storage files; other URLs pass through. */
export async function signMediaUrl(admin: any, url?: string | null): Promise<string> {
  if (!url) return '';
  const parsed = parseStoragePath(url);
  if (!parsed) return url;
  const { data } = await admin.storage.from(parsed.bucket).createSignedUrl(parsed.path, 3600);
  return data?.signedUrl || url;
}

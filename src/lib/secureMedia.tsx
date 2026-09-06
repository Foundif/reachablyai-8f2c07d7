import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PRIVATE_BUCKETS = ['salon-assets'];
const cache = new Map<string, { url: string; exp: number }>();

/** Extracts `bucket/path` from a Supabase storage URL, if it points at a private bucket. */
const parseStoragePath = (url?: string | null): { bucket: string; path: string } | null => {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public\/|authenticated\/|sign\/)?([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  const [, bucket, path] = m;
  if (!PRIVATE_BUCKETS.includes(bucket)) return null;
  return { bucket, path: decodeURIComponent(path) };
};

/** Returns a short-lived signed URL for private storage files; passes other URLs through. */
export const resolveMediaUrl = async (url?: string | null): Promise<string | undefined> => {
  if (!url) return undefined;
  const parsed = parseStoragePath(url);
  if (!parsed) return url;
  const key = `${parsed.bucket}/${parsed.path}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 3600);
  if (!data?.signedUrl) return undefined;
  cache.set(key, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
};

export const useSignedUrl = (url?: string | null) => {
  const [resolved, setResolved] = useState<string | undefined>(() =>
    parseStoragePath(url) ? undefined : url || undefined,
  );
  useEffect(() => {
    let active = true;
    resolveMediaUrl(url).then(u => { if (active) setResolved(u); });
    return () => { active = false; };
  }, [url]);
  return resolved;
};

type ImgProps = React.ImgHTMLAttributes<HTMLImageElement> & { src?: string | null };
export const SecureImg = ({ src, ...rest }: ImgProps) => {
  const url = useSignedUrl(src);
  if (!url) return <div className={rest.className} aria-hidden />;
  return <img {...rest} src={url} />;
};

type VideoProps = React.VideoHTMLAttributes<HTMLVideoElement> & { src?: string | null };
export const SecureVideo = ({ src, ...rest }: VideoProps) => {
  const url = useSignedUrl(src);
  if (!url) return <div className={rest.className} aria-hidden />;
  return <video {...rest} src={url} />;
};

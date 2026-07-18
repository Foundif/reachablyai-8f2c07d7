
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'template',
  ADD COLUMN IF NOT EXISTS body_text text,
  ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS min_delay_sec integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS max_delay_sec integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS skipped_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS reachable boolean,
  ADD COLUMN IF NOT EXISTS reason text;

DROP POLICY IF EXISTS "campaign_media_read" ON storage.objects;
CREATE POLICY "campaign_media_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-media');

DROP POLICY IF EXISTS "campaign_media_write" ON storage.objects;
CREATE POLICY "campaign_media_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-media' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "campaign_media_delete" ON storage.objects;
CREATE POLICY "campaign_media_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-media' AND auth.uid() IS NOT NULL);

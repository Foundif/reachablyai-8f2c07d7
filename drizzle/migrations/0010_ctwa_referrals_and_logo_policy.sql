CREATE TABLE IF NOT EXISTS public.ctwa_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  lead_id uuid,
  conversation_phone text NOT NULL,
  source text NOT NULL CHECK (source IN ('instagram','facebook_post','facebook_ads','google','others')),
  source_type text, source_id text, source_url text, headline text, body text, media_url text,
  ctwa_clid text, message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ctwa_referrals TO authenticated;
GRANT ALL ON public.ctwa_referrals TO service_role;
ALTER TABLE public.ctwa_referrals ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS ctwa_referrals_ws_msg_uidx ON public.ctwa_referrals(workspace_id, message_id);
CREATE INDEX IF NOT EXISTS ctwa_referrals_ws_created_idx ON public.ctwa_referrals(workspace_id, created_at DESC);
CREATE POLICY "ctwa members read" ON public.ctwa_referrals FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "salon assets logo read" ON storage.objects;
CREATE POLICY "salon assets logo read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'salon-assets'
  AND (storage.foldername(name))[1] IN ('logos','pricelists')
  AND (
    (storage.foldername(name))[2] = (select auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.owner_id::text = (storage.foldername(name))[2]
        AND public.is_workspace_member(w.id, (select auth.uid()))
    )
  )
);
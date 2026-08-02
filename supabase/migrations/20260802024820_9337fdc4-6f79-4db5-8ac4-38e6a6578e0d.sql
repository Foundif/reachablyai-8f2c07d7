CREATE TABLE IF NOT EXISTS public.wa_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#25D366',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_labels TO authenticated;
GRANT ALL ON public.wa_labels TO service_role;
ALTER TABLE public.wa_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can manage labels" ON public.wa_labels
  FOR ALL TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "template media write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'salon-assets' AND (storage.foldername(name))[1] = 'template-media');
CREATE POLICY "template media update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'salon-assets' AND (storage.foldername(name))[1] = 'template-media');
CREATE POLICY "template media delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'salon-assets' AND (storage.foldername(name))[1] = 'template-media');
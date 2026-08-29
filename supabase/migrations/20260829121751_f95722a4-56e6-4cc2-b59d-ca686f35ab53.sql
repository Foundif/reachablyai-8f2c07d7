CREATE TABLE public.contact_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_segments TO authenticated;
GRANT ALL ON public.contact_segments TO service_role;
ALTER TABLE public.contact_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access contact_segments" ON public.contact_segments FOR ALL TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX idx_contact_segments_ws ON public.contact_segments(workspace_id);
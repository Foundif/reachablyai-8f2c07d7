
-- Flow templates library
CREATE TABLE public.tn_flow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token TEXT UNIQUE,
  uses_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_flow_templates TO authenticated;
GRANT ALL ON public.tn_flow_templates TO service_role;
ALTER TABLE public.tn_flow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own templates"
  ON public.tn_flow_templates FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "view public templates"
  ON public.tn_flow_templates FOR SELECT
  USING (is_public = true);

CREATE TRIGGER tn_flow_templates_updated
  BEFORE UPDATE ON public.tn_flow_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX tn_flow_templates_owner_idx ON public.tn_flow_templates(owner_id);
CREATE INDEX tn_flow_templates_public_idx ON public.tn_flow_templates(is_public) WHERE is_public = true;

-- Per-user permission overrides (assigned from admin panel)
CREATE TABLE public.tn_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, action)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_permission_overrides TO authenticated;
GRANT ALL ON public.tn_permission_overrides TO service_role;
ALTER TABLE public.tn_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own overrides"
  ON public.tn_permission_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER tn_permission_overrides_updated
  BEFORE UPDATE ON public.tn_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX tn_permission_overrides_user_idx ON public.tn_permission_overrides(user_id);

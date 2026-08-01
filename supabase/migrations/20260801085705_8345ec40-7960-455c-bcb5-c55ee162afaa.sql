ALTER TABLE public.message_credits
  ADD COLUMN IF NOT EXISTS credit_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buffer_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.credit_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  buffer_msgs integer NOT NULL DEFAULT 100,
  auto_recharge boolean NOT NULL DEFAULT false,
  auto_recharge_pack text,
  pause_on_exhausted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_settings TO authenticated;
GRANT ALL ON public.credit_settings TO service_role;

ALTER TABLE public.credit_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members manage credit settings"
ON public.credit_settings FOR ALL TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER update_credit_settings_updated_at
BEFORE UPDATE ON public.credit_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
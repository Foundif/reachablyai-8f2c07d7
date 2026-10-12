CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  description text NOT NULL DEFAULT '',
  base_price numeric NOT NULL DEFAULT 0,
  price_unit text NOT NULL DEFAULT 'per booking',
  advance_amount numeric NOT NULL DEFAULT 0,
  duration_minutes integer,
  add_ons jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS services_ws_idx ON public.services (workspace_id, category);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read services" ON public.services FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Admins insert services" ON public.services FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));
CREATE POLICY "Admins update services" ON public.services FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));
CREATE POLICY "Admins delete services" ON public.services FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()));
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
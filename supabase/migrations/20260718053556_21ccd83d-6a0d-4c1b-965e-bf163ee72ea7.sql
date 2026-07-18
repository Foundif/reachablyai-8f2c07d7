
CREATE TABLE IF NOT EXISTS public.finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale','expense')),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  category TEXT,
  notes TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_entries members" ON public.finance_entries;
CREATE POLICY "finance_entries members" ON public.finance_entries
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
DROP TRIGGER IF EXISTS finance_updated_at ON public.finance_entries;
CREATE TRIGGER finance_updated_at BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS finance_ws_date ON public.finance_entries(workspace_id, entry_date DESC);

ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS meta_template_id TEXT,
  ADD COLUMN IF NOT EXISTS header TEXT,
  ADD COLUMN IF NOT EXISTS footer TEXT,
  ADD COLUMN IF NOT EXISTS buttons JSONB,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

ALTER TABLE public.whatsapp_credentials
  ADD COLUMN IF NOT EXISTS last_analytics_sync TIMESTAMPTZ;

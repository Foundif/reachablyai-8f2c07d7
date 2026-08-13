CREATE TABLE IF NOT EXISTS public.scraper_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'serpapi',
  api_key text,
  actor_id text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scraper_settings TO authenticated;
GRANT ALL ON public.scraper_settings TO service_role;

ALTER TABLE public.scraper_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members manage scraper settings"
ON public.scraper_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = scraper_settings.workspace_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = scraper_settings.workspace_id AND m.user_id = auth.uid()));
ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS flow_service_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS flow_advance_amount numeric NOT NULL DEFAULT 200;
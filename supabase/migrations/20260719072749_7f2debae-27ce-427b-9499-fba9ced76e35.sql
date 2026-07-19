
CREATE TABLE IF NOT EXISTS public.wa_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number_id TEXT,
  event_type TEXT,
  from_phone TEXT,
  summary TEXT,
  status TEXT DEFAULT 'ok',
  error TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_webhook_events_ws_time_idx ON public.wa_webhook_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_webhook_events_phone_time_idx ON public.wa_webhook_events(phone_number_id, created_at DESC);

GRANT SELECT ON public.wa_webhook_events TO authenticated;
GRANT ALL ON public.wa_webhook_events TO service_role;

ALTER TABLE public.wa_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace webhook events"
  ON public.wa_webhook_events FOR SELECT
  TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_webhook_events;
ALTER TABLE public.wa_webhook_events REPLICA IDENTITY FULL;

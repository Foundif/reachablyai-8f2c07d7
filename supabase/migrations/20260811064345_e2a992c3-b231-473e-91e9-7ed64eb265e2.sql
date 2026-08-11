CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  active boolean NOT NULL DEFAULT true,
  last_payload jsonb,
  last_received_at timestamptz,
  workflow_name text,
  name_field text,
  phone_field text,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  variable_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws members manage webhook endpoints" ON public.webhook_endpoints
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER trg_webhook_endpoints_updated BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'received',
  phone text,
  recipient_name text,
  payload jsonb,
  error text,
  wa_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws members read webhook logs" ON public.webhook_logs
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE INDEX idx_webhook_logs_endpoint ON public.webhook_logs(endpoint_id, created_at DESC);
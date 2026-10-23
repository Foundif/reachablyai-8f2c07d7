CREATE TABLE public.meta_reporting_clients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id), name text NOT NULL, destination text NOT NULL DEFAULT '', ad_account_id text NOT NULL DEFAULT '', page_id text NOT NULL DEFAULT '', form_ids text[] NOT NULL DEFAULT '{}', kpis text[] NOT NULL DEFAULT '{spend,impressions,clicks,leads,cpl}', cadence text NOT NULL DEFAULT 'daily', report_time text NOT NULL DEFAULT '08:00', timezone text NOT NULL DEFAULT 'Asia/Kolkata', weekday integer NOT NULL DEFAULT 1, monthday integer NOT NULL DEFAULT 1, report_enabled boolean NOT NULL DEFAULT false, lead_enabled boolean NOT NULL DEFAULT false, report_template_id uuid REFERENCES public.templates(id), lead_template_id uuid REFERENCES public.templates(id), archived_at timestamptz, next_report_at timestamptz, reconciliation_at timestamptz, connection_status text NOT NULL DEFAULT 'setup_required', last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON public.meta_reporting_clients TO authenticated;
GRANT ALL ON public.meta_reporting_clients TO service_role;
ALTER TABLE public.meta_reporting_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY meta_clients_admin ON public.meta_reporting_clients FOR ALL TO authenticated USING (public.is_workspace_admin(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));
CREATE TABLE public.meta_client_credentials (client_id uuid PRIMARY KEY REFERENCES public.meta_reporting_clients(id), user_token text, page_token text, expires_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.meta_client_credentials TO service_role;
ALTER TABLE public.meta_client_credentials ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.meta_oauth_states (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES public.meta_reporting_clients(id), user_id uuid NOT NULL, redirect_uri text NOT NULL, expires_at timestamptz NOT NULL DEFAULT (now()+interval '10 minutes'));
GRANT ALL ON public.meta_oauth_states TO service_role;
ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.meta_workflow_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES public.meta_reporting_clients(id), workspace_id uuid NOT NULL REFERENCES public.workspaces(id), kind text NOT NULL, dedupe_key text NOT NULL, status text NOT NULL DEFAULT 'processing', metrics jsonb NOT NULL DEFAULT '{}', message_id text, lead_id uuid REFERENCES public.leads(id), error text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(client_id,kind,dedupe_key));
GRANT SELECT ON public.meta_workflow_runs TO authenticated;
GRANT ALL ON public.meta_workflow_runs TO service_role;
ALTER TABLE public.meta_workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY meta_runs_admin ON public.meta_workflow_runs FOR SELECT TO authenticated USING (public.is_workspace_admin(workspace_id,auth.uid()));
CREATE INDEX meta_clients_due ON public.meta_reporting_clients(next_report_at) WHERE report_enabled AND archived_at IS NULL;
CREATE INDEX meta_clients_page ON public.meta_reporting_clients(page_id) WHERE archived_at IS NULL;
CREATE OR REPLACE FUNCTION public.claim_meta_workflow(_client uuid, _kind text, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run_id uuid;
BEGIN
 INSERT INTO public.meta_workflow_runs(client_id,workspace_id,kind,dedupe_key) SELECT id,workspace_id,_kind,_key FROM public.meta_reporting_clients WHERE id=_client AND archived_at IS NULL ON CONFLICT DO NOTHING RETURNING id INTO run_id;
 RETURN run_id;
END; $$;
REVOKE ALL ON FUNCTION public.claim_meta_workflow(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meta_workflow(uuid,text,text) TO service_role;
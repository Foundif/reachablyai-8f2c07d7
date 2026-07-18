
-- =========== WhatsApp Cloud API credentials (one per workspace) ===========
CREATE TABLE public.whatsapp_credentials (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number_id text,
  waba_id text,
  business_phone text,
  access_token text,
  app_secret text,
  webhook_verify_token text,
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_credentials TO authenticated;
GRANT ALL ON public.whatsapp_credentials TO service_role;
ALTER TABLE public.whatsapp_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage wa creds" ON public.whatsapp_credentials FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_wacred_updated BEFORE UPDATE ON public.whatsapp_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== Templates ===========
CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'marketing' CHECK (category IN ('marketing','utility','authentication')),
  language text NOT NULL DEFAULT 'en',
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected')),
  meta_template_id text,
  rejection_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
CREATE INDEX idx_templates_ws ON public.templates(workspace_id);
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage templates" ON public.templates FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== Campaigns ===========
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  delivered_count int NOT NULL DEFAULT 0,
  read_count int NOT NULL DEFAULT 0,
  replied_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
CREATE INDEX idx_campaigns_ws ON public.campaigns(workspace_id);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  phone text NOT NULL,
  name text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','replied','failed')),
  meta_message_id text,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_recipients TO authenticated;
GRANT ALL ON public.campaign_recipients TO service_role;
CREATE INDEX idx_camprec_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_camprec_ws ON public.campaign_recipients(workspace_id);
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage recipients" ON public.campaign_recipients FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- =========== Automations ===========
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL CHECK (trigger_type IN ('new_lead','tag_added','status_changed','keyword_match','no_reply_24h')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_type text NOT NULL CHECK (action_type IN ('send_template','add_tag','set_status','assign_agent')),
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  run_count int NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;
CREATE INDEX idx_automations_ws ON public.automations(workspace_id);
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage automations" ON public.automations FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_automations_updated BEFORE UPDATE ON public.automations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','skipped')),
  detail text,
  executed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
CREATE INDEX idx_autoruns_automation ON public.automation_runs(automation_id);
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read runs" ON public.automation_runs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "service writes runs" ON public.automation_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

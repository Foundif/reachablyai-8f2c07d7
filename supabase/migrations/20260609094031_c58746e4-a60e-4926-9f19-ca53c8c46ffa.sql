
-- tn_flows
CREATE TABLE public.tn_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_flows TO authenticated;
GRANT ALL ON public.tn_flows TO service_role;
ALTER TABLE public.tn_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own flows" ON public.tn_flows FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tn_campaigns
CREATE TABLE public.tn_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  flow_id UUID REFERENCES public.tn_flows(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  audience_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  schedule_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_campaigns TO authenticated;
GRANT ALL ON public.tn_campaigns TO service_role;
ALTER TABLE public.tn_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaigns" ON public.tn_campaigns FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tn_flow_events
CREATE TABLE public.tn_flow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  campaign_id UUID,
  session_id UUID,
  node_id TEXT,
  event_type TEXT NOT NULL,
  customer_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_flow_events TO authenticated;
GRANT ALL ON public.tn_flow_events TO service_role;
ALTER TABLE public.tn_flow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own flow events" ON public.tn_flow_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_flow_events_campaign_node ON public.tn_flow_events (campaign_id, node_id);
CREATE INDEX idx_flow_events_created ON public.tn_flow_events (user_id, created_at DESC);

-- tn_agent_versions
CREATE TABLE public.tn_agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL,
  system_prompt TEXT,
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  temperature NUMERIC,
  change_note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_agent_versions TO authenticated;
GRANT ALL ON public.tn_agent_versions TO service_role;
ALTER TABLE public.tn_agent_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent versions" ON public.tn_agent_versions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_agent_versions_agent ON public.tn_agent_versions (agent_id, created_at DESC);

-- tn_audit_log
CREATE TABLE public.tn_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  actor_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tn_audit_log TO authenticated;
GRANT ALL ON public.tn_audit_log TO service_role;
ALTER TABLE public.tn_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit log" ON public.tn_audit_log FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_audit_entity ON public.tn_audit_log (user_id, entity_type, created_at DESC);

-- updated_at triggers
CREATE TRIGGER tn_flows_updated BEFORE UPDATE ON public.tn_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tn_campaigns_updated BEFORE UPDATE ON public.tn_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- agent version snapshot trigger
CREATE OR REPLACE FUNCTION public.tn_snapshot_agent_version()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.system_prompt IS DISTINCT FROM OLD.system_prompt OR
    NEW.tools IS DISTINCT FROM OLD.tools OR
    NEW.model IS DISTINCT FROM OLD.model OR
    NEW.temperature IS DISTINCT FROM OLD.temperature
  ) THEN
    INSERT INTO public.tn_agent_versions (agent_id, user_id, system_prompt, tools, model, temperature, change_note, created_by)
    VALUES (OLD.id, OLD.user_id, OLD.system_prompt, OLD.tools, OLD.model, OLD.temperature, 'auto-snapshot', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tn_ai_agents_versioning BEFORE UPDATE ON public.tn_ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.tn_snapshot_agent_version();

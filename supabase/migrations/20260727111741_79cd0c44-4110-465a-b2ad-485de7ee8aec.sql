
CREATE TABLE public.workspace_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  business_hours JSONB NOT NULL DEFAULT '{"mon":{"enabled":true,"start":"09:00","end":"18:00"},"tue":{"enabled":true,"start":"09:00","end":"18:00"},"wed":{"enabled":true,"start":"09:00","end":"18:00"},"thu":{"enabled":true,"start":"09:00","end":"18:00"},"fri":{"enabled":true,"start":"09:00","end":"18:00"},"sat":{"enabled":false,"start":"09:00","end":"18:00"},"sun":{"enabled":false,"start":"09:00","end":"18:00"}}'::jsonb,
  away_enabled BOOLEAN NOT NULL DEFAULT false,
  away_message TEXT NOT NULL DEFAULT 'Thanks for reaching out! We''re currently away. Our team will reply during business hours.',
  welcome_enabled BOOLEAN NOT NULL DEFAULT false,
  welcome_message TEXT NOT NULL DEFAULT 'Hi! 👋 Thanks for messaging us. How can we help?',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_settings TO authenticated;
GRANT ALL ON public.workspace_settings TO service_role;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage settings" ON public.workspace_settings FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_workspace_settings_updated BEFORE UPDATE ON public.workspace_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.auto_reply_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  rule_kind TEXT NOT NULL,
  rule_ref TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auto_reply_log_lookup ON public.auto_reply_log (workspace_id, contact_phone, rule_kind, sent_at DESC);
GRANT SELECT ON public.auto_reply_log TO authenticated;
GRANT ALL ON public.auto_reply_log TO service_role;
ALTER TABLE public.auto_reply_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read auto reply log" ON public.auto_reply_log FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

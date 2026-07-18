
-- ============ WORKSPACES ============
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Workspace',
  plan_tier text NOT NULL DEFAULT 'free',
  whatsapp_mode text NOT NULL DEFAULT 'meta_api' CHECK (whatsapp_mode IN ('meta_api','unofficial')),
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('owner','admin','agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- helper: is caller a member of workspace?
CREATE OR REPLACE FUNCTION public.is_workspace_member(_ws uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _ws AND user_id = _uid);
$$;

CREATE POLICY "members read workspace" ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(id, auth.uid()));
CREATE POLICY "owner updates workspace" ON public.workspaces FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "user creates own workspace" ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "members read members" ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "owner manages members" ON public.workspace_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROFILE active workspace ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_workspace_id uuid;

-- ============ AUTO-CREATE workspace on new user + backfill ============
CREATE OR REPLACE FUNCTION public.ensure_personal_workspace(_uid uuid, _email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws_id uuid;
BEGIN
  SELECT id INTO ws_id FROM public.workspaces WHERE owner_id = _uid ORDER BY created_at LIMIT 1;
  IF ws_id IS NULL THEN
    INSERT INTO public.workspaces(name, owner_id) VALUES (COALESCE(_email, 'My Workspace'), _uid) RETURNING id INTO ws_id;
    INSERT INTO public.workspace_members(workspace_id, user_id, role) VALUES (ws_id, _uid, 'owner')
      ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.profiles SET active_workspace_id = COALESCE(active_workspace_id, ws_id) WHERE user_id = _uid;
  RETURN ws_id;
END; $$;

-- Extend handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws uuid;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  ws := public.ensure_personal_workspace(NEW.id, NEW.email);
  RETURN NEW;
END; $$;

-- Backfill for existing users
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id, email FROM public.profiles WHERE user_id IS NOT NULL LOOP
    PERFORM public.ensure_personal_workspace(r.user_id, r.email);
  END LOOP;
END $$;

-- helper: current workspace for caller
CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT active_workspace_id FROM public.profiles WHERE user_id = auth.uid()),
    (SELECT id FROM public.workspaces WHERE owner_id = auth.uid() ORDER BY created_at LIMIT 1)
  );
$$;

-- ============ WHATSAPP SESSIONS ============
CREATE TABLE public.whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'meta_api' CHECK (mode IN ('meta_api','unofficial')),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','qr_pending','banned')),
  phone_number text,
  meta_api_key_encrypted text,
  meta_phone_number_id text,
  meta_business_account_id text,
  qr_code_url text,
  last_connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sessions TO authenticated;
GRANT ALL ON public.whatsapp_sessions TO service_role;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access sessions" ON public.whatsapp_sessions FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_wa_sessions_updated BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LEADS ============
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','csv','meta_ads','scraped','booking')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted','lost')),
  tags text[] NOT NULL DEFAULT '{}',
  assigned_to uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_workspace ON public.leads(workspace_id);
CREATE INDEX idx_leads_phone ON public.leads(workspace_id, phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access leads" ON public.leads FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ADD workspace_id to existing tables (backwards compatible) ============
ALTER TABLE public.tn_bookings ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.tn_customers ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.tn_messages ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.tn_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.tn_payments ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.tn_services ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.tn_campaigns ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.tn_meta_flows ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.tn_meta_templates ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.tn_flows ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.tn_ai_agents ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.tn_expenses ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- Backfill workspace_id from owner's personal workspace
DO $$
DECLARE t text; tables text[] := ARRAY['tn_bookings','tn_customers','tn_messages','tn_settings','tn_payments','tn_services','tn_campaigns','tn_meta_flows','tn_meta_templates','tn_flows','tn_ai_agents','tn_expenses'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format($f$
      UPDATE public.%I x
         SET workspace_id = w.id
        FROM public.workspaces w
       WHERE w.owner_id = x.user_id
         AND x.workspace_id IS NULL
    $f$, t);
  END LOOP;
END $$;

-- ============ BOOKING -> LEAD trigger ============
CREATE OR REPLACE FUNCTION public.tn_booking_to_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws uuid; existing uuid;
BEGIN
  ws := COALESCE(NEW.workspace_id, (SELECT id FROM public.workspaces WHERE owner_id = NEW.user_id ORDER BY created_at LIMIT 1));
  IF ws IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO existing FROM public.leads WHERE workspace_id = ws AND phone = NEW.customer_phone LIMIT 1;
  IF existing IS NULL AND NEW.customer_phone IS NOT NULL THEN
    INSERT INTO public.leads(workspace_id, name, phone, source, status, notes)
    VALUES (ws, COALESCE(NEW.customer_name,'Booking'), NEW.customer_phone, 'booking', 'new',
            'Auto-created from booking ' || COALESCE(NEW.booking_code, NEW.id::text));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_tn_booking_to_lead ON public.tn_bookings;
CREATE TRIGGER trg_tn_booking_to_lead AFTER INSERT ON public.tn_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tn_booking_to_lead();

-- 1. Feedback conversation thread ------------------------------------------
CREATE TABLE public.feedback_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.feedback_tickets(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  author_role text NOT NULL DEFAULT 'user',
  author_id uuid,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.feedback_messages TO authenticated;
GRANT ALL ON public.feedback_messages TO service_role;

ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submitters read their ticket thread" ON public.feedback_messages
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.feedback_tickets t
  WHERE t.id = feedback_messages.ticket_id AND t.submitted_by = auth.uid()
));

CREATE POLICY "Submitters reply on their ticket" ON public.feedback_messages
FOR INSERT TO authenticated
WITH CHECK (
  author_role = 'user'
  AND author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.feedback_tickets t
    WHERE t.id = feedback_messages.ticket_id
      AND t.submitted_by = auth.uid()
      AND t.workspace_id = feedback_messages.workspace_id
  )
);

CREATE INDEX idx_feedback_messages_ticket ON public.feedback_messages(ticket_id, created_at);

-- 2. Product updates inbox --------------------------------------------------
CREATE TABLE public.product_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'update',
  image_url text,
  icon text,
  link_url text,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_updates TO authenticated;
GRANT ALL ON public.product_updates TO service_role;

ALTER TABLE public.product_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read published updates" ON public.product_updates
FOR SELECT TO authenticated USING (is_published);

CREATE TRIGGER trg_product_updates_updated BEFORE UPDATE ON public.product_updates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_update_reads (
  user_id uuid NOT NULL,
  update_id uuid NOT NULL REFERENCES public.product_updates(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, update_id)
);

GRANT SELECT, INSERT, DELETE ON public.product_update_reads TO authenticated;
GRANT ALL ON public.product_update_reads TO service_role;

ALTER TABLE public.product_update_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own read marks" ON public.product_update_reads
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Onboarding progress + paid setup package ------------------------------
CREATE TABLE public.workspace_onboarding (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  completed_steps text[] NOT NULL DEFAULT '{}',
  dismissed boolean NOT NULL DEFAULT false,
  setup_package_paid boolean NOT NULL DEFAULT false,
  setup_package_paid_at timestamptz,
  setup_package_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.workspace_onboarding TO authenticated;
GRANT ALL ON public.workspace_onboarding TO service_role;

ALTER TABLE public.workspace_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage workspace onboarding" ON public.workspace_onboarding
FOR ALL TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER trg_workspace_onboarding_updated BEFORE UPDATE ON public.workspace_onboarding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Security: WhatsApp API secrets only for workspace owners/admins -------
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_ws uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _ws AND user_id = _uid AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = _ws AND owner_id = _uid
  );
$$;

DROP POLICY IF EXISTS "ws members manage whatsapp creds" ON public.whatsapp_credentials;
DROP POLICY IF EXISTS "Members manage whatsapp credentials" ON public.whatsapp_credentials;
DROP POLICY IF EXISTS "workspace members whatsapp_credentials" ON public.whatsapp_credentials;

CREATE POLICY "Owners and admins manage whatsapp credentials" ON public.whatsapp_credentials
FOR ALL TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

-- Non-secret connection info stays readable by every workspace member.
CREATE VIEW public.whatsapp_connections
WITH (security_invoker = false) AS
SELECT id, workspace_id, phone_number_id, waba_id, business_phone, label, is_primary,
       verified, verified_at, status, connection_type, connected_at,
       verified_name, quality_rating, messaging_limit,
       profile_picture_url, profile_address, profile_description, profile_email,
       profile_vertical, profile_websites, profile_about, profile_synced_at,
       created_at, updated_at
FROM public.whatsapp_credentials
WHERE public.is_workspace_member(workspace_id, auth.uid());

GRANT SELECT ON public.whatsapp_connections TO authenticated;
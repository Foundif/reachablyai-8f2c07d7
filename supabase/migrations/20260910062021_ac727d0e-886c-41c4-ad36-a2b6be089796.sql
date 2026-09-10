
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan_id text PRIMARY KEY,
  name text NOT NULL,
  max_users int NOT NULL,
  max_numbers int NOT NULL,
  max_contacts int NOT NULL,
  max_clients int NOT NULL,
  max_messages int NOT NULL
);
GRANT SELECT ON public.plan_limits TO authenticated;
GRANT SELECT ON public.plan_limits TO anon;
GRANT ALL ON public.plan_limits TO service_role;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Plan limits are public" ON public.plan_limits;
CREATE POLICY "Plan limits are public" ON public.plan_limits FOR SELECT USING (true);

INSERT INTO public.plan_limits (plan_id, name, max_users, max_numbers, max_contacts, max_clients, max_messages) VALUES
  ('trial',   'Free trial', 3,  1,  1000,  1000,  1000),
  ('plus',    'Plus',       3,  1,  5000,  5000,  10000),
  ('scale',   'Scale',      10, 3,  20000, 20000, 40000),
  ('supreme', 'Supreme',    25, 10, 40000, 40000, 500000)
ON CONFLICT (plan_id) DO UPDATE SET
  name = EXCLUDED.name, max_users = EXCLUDED.max_users, max_numbers = EXCLUDED.max_numbers,
  max_contacts = EXCLUDED.max_contacts, max_clients = EXCLUDED.max_clients, max_messages = EXCLUDED.max_messages;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS billing_period text,
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_renews_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_month_discount_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_numbers int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_contacts int NOT NULL DEFAULT 0;

ALTER TABLE public.whatsapp_credentials
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true;

ALTER TABLE public.whatsapp_credentials DROP CONSTRAINT IF EXISTS whatsapp_credentials_pkey;
ALTER TABLE public.whatsapp_credentials ADD CONSTRAINT whatsapp_credentials_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_credentials_ws_phone_idx
  ON public.whatsapp_credentials (workspace_id, coalesce(phone_number_id, ''));

CREATE OR REPLACE FUNCTION public.workspace_plan_limits(_ws uuid)
RETURNS public.plan_limits
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.* FROM public.plan_limits l
  WHERE l.plan_id = COALESCE(
    (SELECT NULLIF(w.plan_id, '') FROM public.workspaces w WHERE w.id = _ws),
    'trial')
$$;

CREATE OR REPLACE FUNCTION public.enforce_wa_number_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt int; lim int; extra int;
BEGIN
  SELECT COALESCE((SELECT max_numbers FROM public.workspace_plan_limits(NEW.workspace_id)), 1) INTO lim;
  SELECT COALESCE(extra_numbers, 0) INTO extra FROM public.workspaces WHERE id = NEW.workspace_id;
  lim := lim + COALESCE(extra, 0);
  SELECT count(*) INTO cnt FROM public.whatsapp_credentials WHERE workspace_id = NEW.workspace_id;
  IF cnt >= lim THEN
    RAISE EXCEPTION 'You have reached your WhatsApp number limit (%). Upgrade your plan or purchase an additional WhatsApp number.', lim;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_number_limit ON public.whatsapp_credentials;
CREATE TRIGGER trg_wa_number_limit BEFORE INSERT ON public.whatsapp_credentials
FOR EACH ROW EXECUTE FUNCTION public.enforce_wa_number_limit();

CREATE OR REPLACE FUNCTION public.enforce_user_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt int; lim int;
BEGIN
  SELECT COALESCE((SELECT max_users FROM public.workspace_plan_limits(NEW.workspace_id)), 3) INTO lim;
  SELECT count(*) INTO cnt FROM public.workspace_members WHERE workspace_id = NEW.workspace_id;
  IF cnt >= lim THEN
    RAISE EXCEPTION 'You have reached your team member limit (%). Upgrade your plan to add more users.', lim;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_user_limit ON public.workspace_members;
CREATE TRIGGER trg_user_limit BEFORE INSERT ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_user_limit();

CREATE OR REPLACE FUNCTION public.enforce_contact_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt int; lim int; extra int;
BEGIN
  SELECT COALESCE((SELECT max_contacts FROM public.workspace_plan_limits(NEW.workspace_id)), 1000) INTO lim;
  SELECT COALESCE(extra_contacts, 0) INTO extra FROM public.workspaces WHERE id = NEW.workspace_id;
  lim := lim + COALESCE(extra, 0);
  SELECT count(*) INTO cnt FROM public.leads WHERE workspace_id = NEW.workspace_id;
  IF cnt >= lim THEN
    RAISE EXCEPTION 'You have reached your contact limit (%). Upgrade your plan or add a contacts add-on.', lim;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_contact_limit ON public.leads;
CREATE TRIGGER trg_contact_limit BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.enforce_contact_limit();

UPDATE public.whatsapp_credentials SET is_primary = true WHERE is_primary IS NOT TRUE;

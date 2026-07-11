
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_staff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_modules text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS profiles_owner_id_idx ON public.profiles(owner_id);

-- Resolves the effective data-owner user_id for the current auth user
CREATE OR REPLACE FUNCTION public.tn_owner_of(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.profiles WHERE user_id = _uid AND is_staff = true LIMIT 1),
    _uid
  );
$$;

-- Returns true when the caller is the row's owner OR a staff member of that owner
CREATE OR REPLACE FUNCTION public.tn_team_can(_row_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = _row_user
      OR EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.user_id = auth.uid()
           AND p.is_staff = true
           AND p.owner_id = _row_user
      );
$$;

-- Attach team access policies (idempotent)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tn_bookings','tn_customers','tn_settings','tn_services','tn_messages','tn_payments','tn_ai_agents','tn_campaigns','tn_expenses','tn_flow_sessions','tn_flow_events','tn_audit_log']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "team_access_%1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "team_access_%1$s" ON public.%1$s FOR ALL TO authenticated USING (public.tn_team_can(user_id)) WITH CHECK (public.tn_team_can(user_id))', t);
  END LOOP;
END$$;

-- Allow staff to read their owner's profile too
DROP POLICY IF EXISTS "team_read_profile" ON public.profiles;
CREATE POLICY "team_read_profile" ON public.profiles FOR SELECT TO authenticated
  USING (public.tn_team_can(user_id));

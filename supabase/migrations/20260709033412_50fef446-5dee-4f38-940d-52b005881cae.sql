
CREATE OR REPLACE FUNCTION public.tn_shared_access(_row_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = _row_user
      OR (
        auth.uid() IN (
          '8cdb08f1-d5d3-496e-8c1d-4a80563ac03b'::uuid,
          'cb5032b9-add1-464e-8035-655e0a163e6f'::uuid
        )
        AND _row_user IN (
          '8cdb08f1-d5d3-496e-8c1d-4a80563ac03b'::uuid,
          'cb5032b9-add1-464e-8035-655e0a163e6f'::uuid
        )
      );
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tn_bookings','tn_customers','tn_messages','tn_payments','tn_services',
    'tn_settings','tn_meta_flows','tn_meta_templates','tn_flow_sessions',
    'tn_expenses','tn_campaigns','tn_flows','tn_ai_agents','tn_ai_credits',
    'tn_agent_versions','tn_flow_events','tn_permission_overrides','tn_audit_log'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tn_shared_access_all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "tn_shared_access_all" ON public.%I FOR ALL TO authenticated USING (public.tn_shared_access(user_id)) WITH CHECK (public.tn_shared_access(user_id))',
      t
    );
  END LOOP;
END $$;

-- tn_flow_templates uses owner_id
DROP POLICY IF EXISTS "tn_shared_access_all" ON public.tn_flow_templates;
CREATE POLICY "tn_shared_access_all" ON public.tn_flow_templates
  FOR ALL TO authenticated
  USING (public.tn_shared_access(owner_id))
  WITH CHECK (public.tn_shared_access(owner_id));

DROP POLICY IF EXISTS "tn_shared_access_profiles" ON public.profiles;
CREATE POLICY "tn_shared_access_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.tn_shared_access(user_id));

INSERT INTO public.profiles (user_id, email, full_name, role, subscription_status, trial_start_date, trial_end_date, onboarding_completed, country, currency)
VALUES
  ('cb5032b9-add1-464e-8035-655e0a163e6f','tntc45office@gmail.com','TN45 Office','owner','active', now(), now() + interval '365 days', true, 'India','INR'),
  ('8cdb08f1-d5d3-496e-8c1d-4a80563ac03b','thariqajees522@gmail.com','TN45 Demo','owner','active', now(), now() + interval '365 days', true, 'India','INR')
ON CONFLICT (user_id) DO UPDATE
SET subscription_status = 'active',
    trial_start_date = COALESCE(public.profiles.trial_start_date, EXCLUDED.trial_start_date),
    trial_end_date = GREATEST(COALESCE(public.profiles.trial_end_date, EXCLUDED.trial_end_date), EXCLUDED.trial_end_date),
    role = 'owner',
    onboarding_completed = true,
    email = EXCLUDED.email,
    updated_at = now();

DELETE FROM public.tn_settings
WHERE user_id = '8cdb08f1-d5d3-496e-8c1d-4a80563ac03b'
  AND EXISTS (
    SELECT 1 FROM public.tn_settings s2
    WHERE s2.user_id = 'cb5032b9-add1-464e-8035-655e0a163e6f'
      AND s2.meta_phone_number_id = public.tn_settings.meta_phone_number_id
  );

DROP VIEW IF EXISTS public.whatsapp_connections;

-- Column-level privileges keep the secrets unreadable through the API,
-- while members can still read connection status columns.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_credentials FROM authenticated;

GRANT SELECT (id, workspace_id, phone_number_id, waba_id, business_phone, label, is_primary,
  verified, verified_at, status, connection_type, connected_at, last_error,
  verified_name, quality_rating, messaging_limit, last_analytics_sync,
  profile_picture_url, profile_address, profile_description, profile_email,
  profile_vertical, profile_websites, profile_about, profile_synced_at,
  created_at, updated_at) ON public.whatsapp_credentials TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.whatsapp_credentials TO authenticated;
GRANT ALL ON public.whatsapp_credentials TO service_role;

DROP POLICY IF EXISTS "Owners and admins manage whatsapp credentials" ON public.whatsapp_credentials;

CREATE POLICY "Members read whatsapp connection status" ON public.whatsapp_credentials
FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners and admins insert whatsapp credentials" ON public.whatsapp_credentials
FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Owners and admins update whatsapp credentials" ON public.whatsapp_credentials
FOR UPDATE TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Owners and admins delete whatsapp credentials" ON public.whatsapp_credentials
FOR DELETE TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()));
DROP POLICY IF EXISTS "members manage wa creds" ON public.whatsapp_credentials;
DROP POLICY IF EXISTS "Members read whatsapp connection status" ON public.whatsapp_credentials;

CREATE POLICY "Owners and admins read whatsapp credentials"
ON public.whatsapp_credentials FOR SELECT TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE OR REPLACE VIEW public.whatsapp_connections AS
SELECT id, workspace_id, phone_number_id, waba_id, business_phone, label, is_primary,
       verified, verified_at, status, connection_type, connected_at, last_error,
       verified_name, quality_rating, messaging_limit, profile_picture_url,
       profile_address, profile_description, profile_email, profile_vertical,
       profile_websites, profile_about, profile_synced_at, created_at, updated_at,
       (access_token IS NOT NULL) AS has_access_token,
       (app_secret IS NOT NULL) AS has_app_secret,
       (webhook_verify_token IS NOT NULL) AS has_webhook_verify_token
FROM public.whatsapp_credentials
WHERE public.is_workspace_member(workspace_id, auth.uid());

GRANT SELECT ON public.whatsapp_connections TO authenticated;
GRANT SELECT ON public.whatsapp_connections TO service_role;
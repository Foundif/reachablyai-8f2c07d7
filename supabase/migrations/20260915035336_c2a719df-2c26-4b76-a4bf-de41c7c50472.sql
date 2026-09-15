DROP POLICY IF EXISTS "Members read whatsapp connection status" ON public.whatsapp_credentials;

DROP POLICY IF EXISTS "Admins read whatsapp credentials" ON public.whatsapp_credentials;
CREATE POLICY "Admins read whatsapp credentials"
ON public.whatsapp_credentials FOR SELECT TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE OR REPLACE VIEW public.whatsapp_connection_status
WITH (security_invoker = off) AS
SELECT id, workspace_id, label, is_primary, verified, status, connection_type,
       phone_number_id, waba_id, business_phone, quality_rating,
       messaging_limit, created_at
FROM public.whatsapp_credentials
WHERE public.is_workspace_member(workspace_id, auth.uid());

GRANT SELECT ON public.whatsapp_connection_status TO authenticated;
GRANT SELECT ON public.whatsapp_connection_status TO service_role;
DROP VIEW IF EXISTS public.whatsapp_connection_status;

CREATE OR REPLACE FUNCTION public.list_whatsapp_connections(_ws uuid)
RETURNS TABLE (
  id uuid, workspace_id uuid, label text, is_primary boolean, verified boolean,
  status text, connection_type text, phone_number_id text, waba_id text,
  business_phone text, quality_rating text, messaging_limit text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.workspace_id, c.label, c.is_primary, c.verified,
         c.status::text, c.connection_type::text, c.phone_number_id::text, c.waba_id::text,
         c.business_phone::text, c.quality_rating::text, c.messaging_limit::text, c.created_at
  FROM public.whatsapp_credentials c
  WHERE c.workspace_id = _ws
    AND public.is_workspace_member(_ws, auth.uid())
$$;

REVOKE ALL ON FUNCTION public.list_whatsapp_connections(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_whatsapp_connections(uuid) TO authenticated, service_role;
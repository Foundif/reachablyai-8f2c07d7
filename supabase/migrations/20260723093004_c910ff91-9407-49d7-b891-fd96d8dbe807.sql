GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS "Workspace members can view teammate profiles" ON public.profiles;
CREATE POLICY "Workspace members can view teammate profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.user_id = profiles.user_id
      AND public.is_workspace_member(wm.workspace_id, auth.uid())
  )
);
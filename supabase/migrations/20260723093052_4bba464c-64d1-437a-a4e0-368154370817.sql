DROP POLICY IF EXISTS "Workspace members can view teammate profiles" ON public.profiles;
CREATE POLICY "Workspace members can view staff teammate profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR (
    profiles.is_staff IS TRUE
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.user_id = profiles.user_id
        AND public.is_workspace_member(wm.workspace_id, auth.uid())
    )
  )
);
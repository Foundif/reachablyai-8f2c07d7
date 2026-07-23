GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_conversations TO authenticated;
GRANT ALL ON public.wa_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_messages TO authenticated;
GRANT ALL ON public.wa_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS "members access conversations" ON public.wa_conversations;
DROP POLICY IF EXISTS "wa_conversations members" ON public.wa_conversations;
CREATE POLICY "Workspace members can manage conversations"
ON public.wa_conversations
FOR ALL
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "members access messages" ON public.wa_messages;
DROP POLICY IF EXISTS "wa_messages members" ON public.wa_messages;
CREATE POLICY "Workspace members can manage messages"
ON public.wa_messages
FOR ALL
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "members read members" ON public.workspace_members;
CREATE POLICY "Workspace members can read team members"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "owner manages members" ON public.workspace_members;
CREATE POLICY "Workspace owners can manage team members"
ON public.workspace_members
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid()));

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, p.user_id, CASE WHEN p.role = 'admin' THEN 'admin' ELSE 'agent' END
FROM public.profiles p
JOIN public.workspaces w ON w.owner_id = p.owner_id
WHERE p.is_staff IS TRUE
  AND p.owner_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

UPDATE public.profiles p
SET active_workspace_id = w.id
FROM public.workspaces w
WHERE p.is_staff IS TRUE
  AND p.owner_id = w.owner_id
  AND p.active_workspace_id IS DISTINCT FROM w.id;
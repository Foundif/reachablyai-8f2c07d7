
-- Allow workspace teammates to view each other's basic profile fields (fixes UUID showing in assignee dropdown)
DROP POLICY IF EXISTS "Workspace members can view staff teammate profiles" ON public.profiles;
CREATE POLICY "Workspace teammates can view each other profiles"
ON public.profiles FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.user_id = profiles.user_id
      AND public.is_workspace_member(wm.workspace_id, auth.uid())
  )
);

-- Notes & tags per conversation
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

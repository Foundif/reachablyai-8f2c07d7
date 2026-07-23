INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, p.user_id, 'owner'
FROM public.profiles p
JOIN public.workspaces w ON w.owner_id = p.owner_id
WHERE p.is_staff = true
  AND p.owner_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO UPDATE
SET role = EXCLUDED.role;

UPDATE public.profiles p
SET active_workspace_id = w.id
FROM public.workspaces w
WHERE p.is_staff = true
  AND p.owner_id IS NOT NULL
  AND w.owner_id = p.owner_id
  AND (p.active_workspace_id IS DISTINCT FROM w.id);
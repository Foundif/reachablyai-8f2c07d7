import { supabase } from '@/integrations/supabase/client';

export async function resolveWorkspaceId(userId: string, profile?: any): Promise<string | null> {
  const activeId = profile?.active_workspace_id;
  if (activeId) return activeId;

  const { data: membership } = await supabase
    .from('workspace_members' as any)
    .select('workspace_id, created_at')
    .eq('user_id', userId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if ((membership as any)?.workspace_id) return (membership as any).workspace_id;

  const { data: owned } = await supabase
    .from('workspaces' as any)
    .select('id')
    .eq('owner_id', userId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  return (owned as any)?.id || null;
}
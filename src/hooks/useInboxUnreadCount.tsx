import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { usePageVisible } from '@/hooks/usePageVisible';

export function useInboxUnreadCount() {
  const { user, profile } = useAuth();
  const visible = usePageVisible();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    if (!visible) return; // no live connection while the tab is in the background
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const wsId = await resolveWorkspaceId(user.id, profile);
      if (!wsId || cancelled) return;
      const load = async () => {
        const { data } = await supabase
          .from('wa_conversations' as any).select('unread_count').eq('workspace_id', wsId);
        const total = ((data as any[]) || []).reduce((s, r) => s + (r.unread_count || 0), 0);
        if (!cancelled) setCount(total);
      };
      load();
      channel = supabase
        .channel(`inbox-unread-${wsId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations', filter: `workspace_id=eq.${wsId}` }, load)
        .subscribe();
    })();

    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [user, profile, visible]);

  return count;
}

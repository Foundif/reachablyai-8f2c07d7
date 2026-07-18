import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useInboxUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    let wsId: string | null = null;

    const load = async () => {
      const { data: ws } = await supabase
        .from('workspaces' as any).select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
      wsId = (ws as any)?.id || null;
      if (!wsId) return;
      const { data } = await supabase
        .from('wa_conversations' as any).select('unread_count').eq('workspace_id', wsId);
      const total = ((data as any[]) || []).reduce((s, r) => s + (r.unread_count || 0), 0);
      setCount(total);
    };
    load();

    const channel = supabase
      .channel('inbox-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return count;
}

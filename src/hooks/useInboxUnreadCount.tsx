import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useInboxUnreadCount = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    const { count: unread } = await supabase
      .from('tn_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('direction', 'in')
      .is('read_at', null);
    setCount(unread || 0);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchCount();

    const channel = supabase
      .channel(`inbox-unread-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tn_messages',
        filter: `user_id=eq.${user.id}`,
      }, fetchCount)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchCount]);

  return count;
};

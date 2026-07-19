import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { playAlert } from '@/lib/sound';
import { toast } from 'sonner';

/**
 * Mount once (in AppLayout). Subscribes to inbound WhatsApp messages and
 * conversation assignments across all workspaces the user belongs to,
 * plays an alert sound and shows a toast — no page refresh required.
 */
export function useGlobalAlerts() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let channels: any[] = [];

    (async () => {
      const { data: mems } = await supabase
        .from('workspace_members' as any)
        .select('workspace_id')
        .eq('user_id', user.id);
      if (cancelled) return;
      const wsIds = ((mems as any[]) || []).map(m => m.workspace_id);
      if (wsIds.length === 0) return;

      for (const wsId of wsIds) {
        const ch = supabase
          .channel(`alerts-${wsId}-${user.id}`)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'wa_messages', filter: `workspace_id=eq.${wsId}` },
            (payload: any) => {
              if (payload.new?.direction === 'inbound') {
                playAlert();
                toast('New WhatsApp message', {
                  description: `${payload.new.from_phone}: ${(payload.new.body || '').slice(0, 60)}`,
                });
              }
            })
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'wa_conversations', filter: `workspace_id=eq.${wsId}` },
            (payload: any) => {
              if (payload.new?.assigned_to === user.id && payload.old?.assigned_to !== user.id) {
                playAlert();
                toast('Conversation assigned to you', {
                  description: payload.new.contact_name || payload.new.contact_phone,
                });
              }
            })
          .subscribe();
        channels.push(ch);
      }
    })();

    return () => { cancelled = true; channels.forEach(c => supabase.removeChannel(c)); };
  }, [user]);
}

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { setPermissionOverrides } from '@/lib/permissions';

/** Loads per-user permission overrides into the runtime cache. */
export function usePermissionOverridesLoader() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) { setPermissionOverrides({}); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('tn_permission_overrides')
        .select('action, allowed')
        .eq('user_id', user.id);
      if (cancelled) return;
      const map: Record<string, boolean> = {};
      (data || []).forEach((r: any) => { map[r.action] = r.allowed; });
      setPermissionOverrides(map);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);
}

export const PermissionLoader = () => {
  usePermissionOverridesLoader();
  return null;
};

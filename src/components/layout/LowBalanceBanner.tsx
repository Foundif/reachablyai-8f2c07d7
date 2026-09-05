import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { Battery, X } from 'lucide-react';

/**
 * Global low-balance warning. Shows when the message wallet drops below 100
 * credits, and turns blocking-red when it's empty or in the credit buffer.
 */
const LowBalanceBanner = () => {
  const { user, profile } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let channel: any;
    (async () => {
      const wsId = await resolveWorkspaceId(user.id, profile);
      if (!wsId) return;
      const { data } = await supabase.from('message_credits' as any).select('balance').eq('workspace_id', wsId).maybeSingle();
      setBalance((data as any)?.balance ?? 0);
      channel = supabase
        .channel(`wallet-${wsId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_credits', filter: `workspace_id=eq.${wsId}` },
          (p: any) => setBalance(p.new?.balance ?? 0))
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user, profile]);

  if (balance === null || balance >= 100 || dismissed) return null;
  const empty = balance <= 0;

  return (
    <div className={`px-4 py-2 text-xs flex items-center justify-center gap-2 ${empty ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>
      <Battery className="w-3.5 h-3.5 shrink-0" />
      <span>
        {empty
          ? 'Message wallet empty — campaigns, auto-replies and webhook messages are paused.'
          : `Low balance: ${Math.max(0, balance)} message credits left.`}
      </span>
      <Link to="/pricing#credits" className="font-semibold underline underline-offset-2 shrink-0">Recharge</Link>
      {!empty && (
        <button onClick={() => setDismissed(true)} className="ml-1 opacity-70 hover:opacity-100" aria-label="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default LowBalanceBanner;

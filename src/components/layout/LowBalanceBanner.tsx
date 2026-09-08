import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { Battery, X } from 'lucide-react';

/**
 * Quiet by design: the message balance is only surfaced once it drops below 5
 * credits, so a healthy wallet never nags the customer.
 */
const LOW_AT = 5;

const LowBalanceBanner = () => {
  const { user, profile } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [packSize, setPackSize] = useState(25);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let channel: any;
    (async () => {
      const wsId = await resolveWorkspaceId(user.id, profile);
      if (!wsId) return;
      const { data } = await supabase.from('message_credits' as any).select('balance').eq('workspace_id', wsId).maybeSingle();
      setBalance((data as any)?.balance ?? 0);
      const { data: last } = await supabase.from('credit_transactions' as any)
        .select('msgs').eq('workspace_id', wsId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if ((last as any)?.msgs) setPackSize(Math.max(1, (last as any).msgs));
      channel = supabase
        .channel(`wallet-${wsId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_credits', filter: `workspace_id=eq.${wsId}` },
          (p: any) => setBalance(p.new?.balance ?? 0))
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user, profile]);

  if (balance === null || dismissed) return null;
  const left = Math.max(0, balance);
  if (left >= LOW_AT) return null;
  const empty = left <= 0;
  const pct = Math.max(0, Math.min(100, Math.round((left / packSize) * 100)));

  return (
    <div className={`px-4 py-2 text-xs flex items-center justify-center gap-2 ${empty ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>
      <Battery className="w-3.5 h-3.5 shrink-0" />
      <span>
        {empty
          ? 'Message balance used up — campaigns and auto-replies are paused.'
          : `${left} message credits left (${pct}% of your last top-up).`}
      </span>
      <Link to="/pricing#credits" className="font-semibold underline underline-offset-2 shrink-0">Top up</Link>
      {!empty && (
        <button onClick={() => setDismissed(true)} className="ml-1 opacity-70 hover:opacity-100" aria-label="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default LowBalanceBanner;

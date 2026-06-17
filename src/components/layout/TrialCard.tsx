import { useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const TrialCard = ({ compact = false }: { compact?: boolean }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const status = (profile as any)?.subscription_status || 'trial';
  if (status === 'pro' || status === 'growth' || status === 'professional' || status === 'enterprise' || status === 'active') return null;

  const start = (profile as any)?.trial_start_date
    ? new Date((profile as any).trial_start_date)
    : ((profile as any)?.created_at ? new Date((profile as any).created_at) : new Date());
  const end = (profile as any)?.trial_end_date
    ? new Date((profile as any).trial_end_date)
    : new Date(start.getTime() + 14 * 86400000);
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const left = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  const used = Math.min(total, total - left);
  const pct = Math.min(100, Math.round((used / total) * 100));
  const expired = left <= 0;

  return (
    <div className={`relative rounded-2xl p-3 bg-gradient-to-br from-primary/15 via-secondary/10 to-transparent border border-primary/20 ${compact ? '' : ''}`}>
      <div className="flex items-center gap-2">
        <Crown className="w-4 h-4 text-primary" />
        <p className="text-[12px] font-semibold">{expired ? 'Trial ended' : 'Free trial'}</p>
        <span className="ml-auto text-[10px] text-muted-foreground">{expired ? '0 days left' : `${left}/${total} days`}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary to-secondary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <button
        onClick={() => navigate('/pricing')}
        className="mt-2.5 w-full text-[11px] font-semibold py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition"
      >
        {expired ? 'Upgrade to continue' : 'Upgrade plan'}
      </button>
    </div>
  );
};

export default TrialCard;

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const TrialCard = ({ compact = false }: { compact?: boolean }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [now, setNow] = useState(() => Date.now());

  // Live ticking — update every minute so the bar and remaining time stay current
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const status = (profile as any)?.subscription_status || 'trial';
  if (status === 'pro' || status === 'growth' || status === 'professional' || status === 'enterprise' || status === 'active') return null;

  const start = (profile as any)?.trial_start_date
    ? new Date((profile as any).trial_start_date)
    : ((profile as any)?.created_at ? new Date((profile as any).created_at) : new Date());
  const end = (profile as any)?.trial_end_date
    ? new Date((profile as any).trial_end_date)
    : new Date(start.getTime() + 7 * 86400000);

  const totalMs = Math.max(1, end.getTime() - start.getTime());
  const remainingMs = Math.max(0, end.getTime() - now);
  const usedMs = Math.min(totalMs, totalMs - remainingMs);
  const pct = Math.min(100, Math.max(0, (usedMs / totalMs) * 100));

  const totalDays = Math.max(1, Math.round(totalMs / 86400000));
  const daysLeft = Math.floor(remainingMs / 86400000);
  const hoursLeft = Math.floor((remainingMs % 86400000) / 3600000);
  const minsLeft = Math.floor((remainingMs % 3600000) / 60000);
  const expired = remainingMs <= 0;

  const remainingLabel = expired
    ? 'Expired'
    : daysLeft > 0
      ? `${daysLeft}/${totalDays} days`
      : hoursLeft > 0
        ? `${hoursLeft}h ${minsLeft}m left`
        : `${minsLeft}m left`;

  // Colour the bar by urgency
  const barClass = expired
    ? 'from-destructive to-destructive'
    : pct >= 85
      ? 'from-orange-500 to-red-500'
      : pct >= 60
        ? 'from-amber-400 to-orange-500'
        : 'from-primary to-secondary';

  return (
    <div
      className={`relative rounded-2xl p-3 border transition-colors
        bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent
        border-border/60 dark:border-white/10
        ${compact ? '' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Crown className="w-4 h-4 text-primary" />
        <p className="text-[12px] font-semibold text-foreground">
          {expired ? 'Trial ended' : 'Free trial'}
        </p>
        <span className="ml-auto text-[10px] font-medium text-muted-foreground tabular-nums">
          {remainingLabel}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 rounded-full overflow-hidden bg-muted/70 dark:bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className={`h-full bg-gradient-to-r ${barClass} transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
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

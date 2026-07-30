import { useNavigate } from 'react-router-dom';
import { Crown, Sparkles, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTrial } from '@/hooks/useTrial';

/**
 * Sidebar CTA. While the 7-day free trial is running it shows a countdown,
 * afterwards it becomes a plain upgrade prompt.
 */
const TrialCard = ({ compact = false }: { compact?: boolean }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isSubscribed, isTrialing, daysLeft, hoursLeft, endsAt } = useTrial();

  // Staff / admin sub-users inherit their owner's plan — hide upgrade CTA.
  if ((profile as any)?.is_staff) return null;
  if (isSubscribed) return null;

  const endLabel = endsAt?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div
      className={`relative rounded-2xl p-3 border bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent border-border/60 dark:border-white/10 ${compact ? '' : ''}`}
    >
      <div className="flex items-center gap-2">
        {isTrialing ? <Clock className="w-4 h-4 text-primary" /> : <Sparkles className="w-4 h-4 text-primary" />}
        <p className="text-[12px] font-semibold text-foreground">
          {isTrialing
            ? (daysLeft > 1 ? `${daysLeft} days left in trial` : `${hoursLeft} hours left in trial`)
            : 'Upgrade required'}
        </p>
      </div>
      <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
        {isTrialing
          ? `All features unlocked${endLabel ? ` until ${endLabel}` : ''}. Pick a plan to keep going.`
          : 'Subscribe to unlock bookings, automation & WhatsApp Flow sends.'}
      </p>
      <button
        onClick={() => navigate('/pricing')}
        className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition"
      >
        <Crown className="w-3 h-3" />
        {isTrialing ? 'See plans' : 'Choose a plan'}
      </button>
    </div>
  );
};

export default TrialCard;

import { useNavigate } from 'react-router-dom';
import { Crown, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Persistent "Upgrade" CTA shown in the sidebar.
 * Free trial has been removed — every non-subscribed account sees a single
 * upgrade prompt instead of a countdown.
 */
const TrialCard = ({ compact = false }: { compact?: boolean }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const status = (profile as any)?.subscription_status;
  // Staff / admin sub-users inherit their owner's plan — hide upgrade CTA.
  if ((profile as any)?.is_staff) return null;
  if (status && ['active', 'starter', 'growth', 'pro', 'professional', 'enterprise'].includes(status)) return null;

  return (
    <div
      className={`relative rounded-2xl p-3 border bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent border-border/60 dark:border-white/10 ${compact ? '' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-[12px] font-semibold text-foreground">Upgrade required</p>
      </div>
      <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
        Subscribe to unlock bookings, automation & WhatsApp Flow sends.
      </p>
      <button
        onClick={() => navigate('/pricing')}
        className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition"
      >
        <Crown className="w-3 h-3" />
        Choose a plan
      </button>
    </div>
  );
};

export default TrialCard;

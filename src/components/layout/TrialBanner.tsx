import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useTrial } from '@/hooks/useTrial';
import { useAuth } from '@/hooks/useAuth';

/**
 * Slim yellow notice bar shown while the 7-day free trial is running.
 */
const TrialBanner = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isTrialing, isExpired, daysLeft } = useTrial();

  if ((profile as any)?.is_staff) return null;
  if (!isTrialing && !isExpired) return null;

  return (
    <div className="w-full bg-[#fdf6d8] dark:bg-yellow-500/15 border-b border-yellow-500/40 text-[11px] sm:text-xs text-yellow-900 dark:text-yellow-100 px-3 py-1.5 text-center">
      <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
        <Info className="w-3.5 h-3.5 shrink-0" />
        {isTrialing ? (
          <span>Your Reachably free trial will expire in <strong>{daysLeft} {daysLeft === 1 ? 'day' : 'days'}</strong>.</span>
        ) : (
          <span>Your Reachably free trial has <strong>expired</strong>.</span>
        )}
        <button onClick={() => navigate('/pricing')} className="underline font-medium">I'm ready to upgrade</button>
        <span className="opacity-50">|</span>
        <a href="mailto:foundifinnovations@gmail.com?subject=Reachably%20consultation" className="underline font-medium">Book a free consultation</a>
      </span>
    </div>
  );
};

export default TrialBanner;

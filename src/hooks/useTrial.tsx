import { useAuth } from '@/hooks/useAuth';

const PAID_STATUSES = new Set([
  'active', 'plus', 'scale', 'supreme',
  'starter', 'growth', 'business', 'pro', 'professional', 'enterprise',
]);

export interface TrialState {
  /** Account is on a paid plan (or inherits one as staff) */
  isSubscribed: boolean;
  /** Trial window is currently running */
  isTrialing: boolean;
  /** Trial window has ended and no plan is active */
  isExpired: boolean;
  endsAt: Date | null;
  daysLeft: number;
  hoursLeft: number;
  /** Every feature stays unlocked while trialing or subscribed */
  hasAccess: boolean;
}

export const useTrial = (): TrialState => {
  const { profile } = useAuth();
  const p = profile as any;

  const isStaff = !!p?.is_staff;
  const isSubscribed = isStaff || PAID_STATUSES.has(p?.subscription_status || '');

  const endsAt = p?.trial_end_date ? new Date(p.trial_end_date) : null;
  const msLeft = endsAt ? endsAt.getTime() - Date.now() : 0;

  const isTrialing = !isSubscribed && !!endsAt && msLeft > 0;
  const isExpired = !isSubscribed && !!endsAt && msLeft <= 0;

  return {
    isSubscribed,
    isTrialing,
    isExpired,
    endsAt,
    daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
    hoursLeft: Math.max(0, Math.ceil(msLeft / 3_600_000)),
    hasAccess: isSubscribed || isTrialing,
  };
};

export default useTrial;

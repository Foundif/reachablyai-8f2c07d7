import { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { resolveWorkspaceId } from '@/lib/workspace';

const ACTIVE = ['active', 'plus', 'scale', 'supreme', 'starter', 'growth', 'business', 'pro', 'professional', 'enterprise'];

/**
 * Shows a persistent alert bar when the workspace has no active subscription
 * or when Meta has an outstanding balance to pay.
 */
const PaymentAlertBanner = () => {
  const { profile, user } = useAuth();
  const nav = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [metaDue, setMetaDue] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const wsId = await resolveWorkspaceId(user.id, profile);
      if (!wsId) return;
      const { data: cred } = await supabase.from('whatsapp_credentials' as any).select('*').eq('workspace_id', wsId).maybeSingle();
      const due = (cred as any)?.last_error ? null : (cred as any)?.balance_due ?? null;
      setMetaDue(typeof due === 'number' ? due : null);
    })();
  }, [user, profile]);

  if (dismissed) return null;
  const status = (profile as any)?.subscription_status;
  const isStaff = (profile as any)?.is_staff;
  const unpaid = !isStaff && (!status || !ACTIVE.includes(status));

  if (!unpaid && !(metaDue && metaDue > 0)) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-amber-500/40 bg-amber-500/10 backdrop-blur">
      <div className="max-w-[1600px] mx-auto flex items-center gap-3 px-3 py-2 text-sm">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          {unpaid ? (
            <span><span className="font-semibold">Choose a plan to keep everything running.</span> Your messages, inbox and automations stay active once a plan is active.</span>
          ) : (
            <span><span className="font-semibold">Meta balance due: ₹{metaDue?.toFixed(2)}.</span> Settle in your Meta Business Manager to avoid delivery pauses.</span>
          )}
        </div>
        <button
          onClick={() => nav(unpaid ? '/pricing' : '/accounting')}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-foreground text-background text-xs font-semibold hover:opacity-90"
        >
          <CreditCard className="w-3 h-3" />
          {unpaid ? 'See plans' : 'View bill'}
        </button>
        <button onClick={() => setDismissed(true)} className="p-1 rounded hover:bg-black/10 text-muted-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default PaymentAlertBanner;

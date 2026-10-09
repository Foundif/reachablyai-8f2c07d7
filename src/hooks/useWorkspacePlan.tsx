import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { PLANS, planById, type Plan } from '@/lib/plans';

export interface WorkspacePlanState {
  loading: boolean;
  workspaceId: string | null;
  plan: Plan | null;
  planName: string;
  /** Paid plan present and not past its renewal date */
  isActive: boolean;
  status: string;
  billingPeriod: 'monthly' | 'yearly' | null;
  renewsAt: Date | null;
  /** true when the workspace is on the highest tier — hide upgrade CTAs */
  isHighestTier: boolean;
  /** Owner is the only one allowed to buy or change the subscription */
  canManageBilling: boolean;
}

/**
 * Real subscription state for the current user's workspace, read from the
 * database. Staff/admin sub-users inherit the owner workspace's plan.
 */
export const useWorkspacePlan = (): WorkspacePlanState => {
  const { user, profile } = useAuth();
  const [ws, setWs] = useState<any>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setLoading(false); return; }
    (async () => {
      const wsId = await resolveWorkspaceId(user.id, profile);
      if (cancelled) return;
      setWorkspaceId(wsId);
      if (!wsId) { setLoading(false); return; }
      const { data } = await supabase.from('workspaces' as any).select('*').eq('id', wsId).maybeSingle();
      if (cancelled) return;
      setWs(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, (profile as any)?.active_workspace_id]);

  const rawPlan = planById(ws?.plan_id);
  const renewsAt = ws?.plan_renews_at ? new Date(ws.plan_renews_at) : null;
  const isActive = !!rawPlan && (!renewsAt || renewsAt.getTime() > Date.now());
  const plan = isActive ? rawPlan : null;
  const isStaff = !!(profile as any)?.is_staff;

  return {
    loading,
    workspaceId,
    plan,
    isActive,
    planName: plan ? plan.name : 'No active plan',
    status: plan ? 'active' : 'expired',
    billingPeriod: (ws?.billing_period as 'monthly' | 'yearly') || (plan ? 'monthly' : null),
    renewsAt,
    isHighestTier: !!plan && plan.id === PLANS[PLANS.length - 1].id,
    canManageBilling: !isStaff,
  };
};

export default useWorkspacePlan;

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

  const plan = planById(ws?.plan_id);
  const renewsAt = ws?.plan_renews_at ? new Date(ws.plan_renews_at) : null;
  const isStaff = !!(profile as any)?.is_staff;

  return {
    loading,
    workspaceId,
    plan,
    planName: plan ? plan.name : 'Free trial',
    status: plan ? (ws?.subscription_status || 'active') : (ws?.subscription_status || 'trialing'),
    billingPeriod: (ws?.billing_period as 'monthly' | 'yearly') || (plan ? 'monthly' : null),
    renewsAt,
    isHighestTier: !!plan && plan.id === PLANS[PLANS.length - 1].id,
    canManageBilling: !isStaff,
  };
};

export default useWorkspacePlan;

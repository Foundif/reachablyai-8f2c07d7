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
// Shared across pages so moving between screens is instant (no re-check spinner).
const cache = new Map<string, { at: number; wsId: string | null; ws: any }>();
const inflight = new Map<string, Promise<{ wsId: string | null; ws: any }>>();
const TTL = 5 * 60_000;

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
  Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

async function fetchPlan(userId: string, profile: any) {
  const wsId = await resolveWorkspaceId(userId, profile);
  if (!wsId) return { wsId, ws: null };
  const { data } = await supabase.from('workspaces' as any).select('*').eq('id', wsId).maybeSingle();
  return { wsId, ws: data };
}

export const clearWorkspacePlanCache = () => cache.clear();

export const useWorkspacePlan = (): WorkspacePlanState => {
  const { user, profile } = useAuth();
  const key = `${user?.id}:${(profile as any)?.active_workspace_id || ''}`;
  const hit = user ? cache.get(key) : undefined;
  const [ws, setWs] = useState<any>(hit?.ws ?? null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(hit?.wsId ?? null);
  const [loading, setLoading] = useState(!hit);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setLoading(false); return; }
    const c = cache.get(key);
    if (c) { setWs(c.ws); setWorkspaceId(c.wsId); setLoading(false); if (Date.now() - c.at < TTL) return; }
    let req = inflight.get(key);
    if (!req) {
      req = fetchPlan(user.id, profile).catch(() => ({ wsId: null, ws: null }));
      inflight.set(key, req);
      req.finally(() => inflight.delete(key));
    }
    // Never leave the page spinning: after 8s show the page and keep checking.
    withTimeout(req, 8000, null as any).then((r) => {
      if (cancelled) return;
      if (r) {
        cache.set(key, { at: Date.now(), ...r });
        setWs(r.ws); setWorkspaceId(r.wsId);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

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

// Plan limits + monthly broadcast quota enforcement.
// Mirrors the `plan_limits` table; the table is the source of truth at runtime.

export interface PlanLimits {
  plan_id: string;
  name: string;
  max_users: number;
  max_numbers: number;
  max_contacts: number;
  max_clients: number;
  max_messages: number;
}

const FALLBACK: PlanLimits = {
  plan_id: 'trial', name: 'Free trial',
  max_users: 3, max_numbers: 1, max_contacts: 1000, max_clients: 1000, max_messages: 1000,
};

export async function planLimitsFor(admin: any, workspaceId: string): Promise<PlanLimits> {
  const { data: ws } = await admin.from('workspaces').select('plan_id').eq('id', workspaceId).maybeSingle();
  const planId = ws?.plan_id || 'trial';
  const { data: limits } = await admin.from('plan_limits').select('*').eq('plan_id', planId).maybeSingle();
  return (limits as PlanLimits) || FALLBACK;
}

/** Outbound messages already sent in the current calendar month. */
export async function monthlyMessagesUsed(admin: any, workspaceId: string): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from('wa_messages')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('direction', 'outbound')
    .gte('created_at', start.toISOString());
  return count || 0;
}

export interface QuotaCheck { ok: boolean; used: number; limit: number; reason?: string }

/** Checks whether `needed` more outbound messages fit in this month's plan quota. */
export async function checkMessageQuota(admin: any, workspaceId: string, needed = 1): Promise<QuotaCheck> {
  const limits = await planLimitsFor(admin, workspaceId);
  const used = await monthlyMessagesUsed(admin, workspaceId);
  if (used + needed > limits.max_messages) {
    return {
      ok: false, used, limit: limits.max_messages,
      reason: `You've used ${used.toLocaleString('en-IN')} of your ${limits.max_messages.toLocaleString('en-IN')} monthly broadcast/template messages. Upgrade your plan to keep sending.`,
    };
  }
  return { ok: true, used, limit: limits.max_messages };
}

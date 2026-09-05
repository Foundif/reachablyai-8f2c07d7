// Prepaid message wallet with a small line-of-credit buffer.
// Reachably pays Meta; customers spend message credits from their wallet.
// When the balance hits zero, sending can continue into a negative buffer
// (credit_limit) until that buffer is exhausted.
//
// Category pricing (keeps margin over Meta's India conversation rates):
//   marketing template = 2 credits/msg · utility/auth template = 1 · service (free-form) = 1

export type MessageCategory = 'marketing' | 'utility' | 'service';

export const CREDIT_COST: Record<MessageCategory, number> = {
  marketing: 2,
  utility: 1,
  service: 1,
};

export interface CreditCheck {
  ok: boolean;
  balance: number;
  buffer: number;
  charged: number;
  reason?: string;
}

export function categoryOf(input?: string | null): MessageCategory {
  const c = String(input || '').toLowerCase();
  if (c === 'marketing') return 'marketing';
  if (c === 'utility' || c === 'authentication') return 'utility';
  return 'service';
}

export async function chargeCredits(
  admin: any,
  workspaceId: string,
  msgs = 1,
  category: MessageCategory = 'service',
): Promise<CreditCheck> {
  const cost = msgs * CREDIT_COST[category];

  const [{ data: wallet }, { data: settings }] = await Promise.all([
    admin.from('message_credits').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    admin.from('credit_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(),
  ]);

  const buffer = settings?.buffer_msgs ?? wallet?.credit_limit ?? 100;
  const bufferEnabled = wallet?.buffer_enabled !== false;
  const floor = bufferEnabled ? -Math.abs(buffer) : 0;
  const balance = wallet?.balance ?? 0;

  if (balance - cost < floor) {
    return {
      ok: false,
      balance,
      buffer,
      charged: 0,
      reason: bufferEnabled
        ? `Message wallet empty and the ${buffer}-message credit buffer is used up. Recharge to keep sending.`
        : 'Message wallet empty. Recharge to keep sending.',
    };
  }

  const next = balance - cost;
  if (wallet) {
    await admin.from('message_credits').update({
      balance: next,
      lifetime_used: (wallet.lifetime_used || 0) + cost,
      credit_used: next < 0 ? Math.abs(next) : 0,
      updated_at: new Date().toISOString(),
    }).eq('workspace_id', workspaceId);
  } else {
    await admin.from('message_credits').insert({
      workspace_id: workspaceId,
      balance: next,
      lifetime_used: cost,
      credit_used: next < 0 ? Math.abs(next) : 0,
    });
  }

  // Low-balance alert: WhatsApp the owner a one-tap recharge link (max 1/day).
  if (next < 100 && settings?.auto_recharge !== false) {
    await notifyLowBalance(admin, workspaceId, next).catch(() => {});
  }

  return { ok: true, balance: next, buffer, charged: cost };
}

/** Refund a charge when the provider send fails. */
export async function refundCredits(admin: any, workspaceId: string, msgs = 1, category: MessageCategory = 'service') {
  const cost = msgs * CREDIT_COST[category];
  const { data: wallet } = await admin.from('message_credits').select('*').eq('workspace_id', workspaceId).maybeSingle();
  if (!wallet) return;
  const next = (wallet.balance || 0) + cost;
  await admin.from('message_credits').update({
    balance: next,
    lifetime_used: Math.max(0, (wallet.lifetime_used || 0) - cost),
    credit_used: next < 0 ? Math.abs(next) : 0,
    updated_at: new Date().toISOString(),
  }).eq('workspace_id', workspaceId);
}

const RECHARGE_URL = 'https://reachablyai.lovable.app/pricing#credits';

/** Sends the workspace owner a low-balance WhatsApp alert, throttled to once per 24h. */
async function notifyLowBalance(admin: any, workspaceId: string, balance: number) {
  const { data: settings } = await admin.from('credit_settings')
    .select('last_low_balance_alert_at').eq('workspace_id', workspaceId).maybeSingle();
  const last = settings?.last_low_balance_alert_at ? new Date(settings.last_low_balance_alert_at).getTime() : 0;
  if (Date.now() - last < 24 * 3600 * 1000) return;

  const { data: creds } = await admin.from('whatsapp_credentials')
    .select('access_token, phone_number_id, business_phone')
    .eq('workspace_id', workspaceId).maybeSingle();
  if (!creds?.access_token || !creds?.phone_number_id || !creds?.business_phone) return;

  const to = String(creds.business_phone).replace(/[^\d]/g, '');
  const text = `⚠️ Your Reachably message wallet is low — ${Math.max(0, balance)} credits left. Campaigns and auto-replies pause when it runs out. Recharge here (UPI / cards / netbanking, no card on Meta needed): ${RECHARGE_URL}`;

  const resp = await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: true } }),
  });

  if (resp.ok) {
    await admin.from('credit_settings')
      .upsert({ workspace_id: workspaceId, last_low_balance_alert_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  }
}

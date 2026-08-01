// Prepaid message wallet with a small line-of-credit buffer.
// Reachably pays Meta; customers spend message credits from their wallet.
// When the balance hits zero, sending can continue into a negative buffer
// (credit_limit) until that buffer is exhausted.

export interface CreditCheck {
  ok: boolean;
  balance: number;
  buffer: number;
  reason?: string;
}

export async function chargeCredits(
  admin: any,
  workspaceId: string,
  msgs = 1,
): Promise<CreditCheck> {
  const [{ data: wallet }, { data: settings }] = await Promise.all([
    admin.from('message_credits').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    admin.from('credit_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(),
  ]);

  const buffer = settings?.buffer_msgs ?? wallet?.credit_limit ?? 100;
  const bufferEnabled = wallet?.buffer_enabled !== false;
  const floor = bufferEnabled ? -Math.abs(buffer) : 0;
  const balance = wallet?.balance ?? 0;

  if (balance - msgs < floor) {
    return {
      ok: false,
      balance,
      buffer,
      reason: bufferEnabled
        ? `Message wallet empty and the ${buffer}-message credit buffer is used up. Recharge to keep sending.`
        : 'Message wallet empty. Recharge to keep sending.',
    };
  }

  const next = balance - msgs;
  if (wallet) {
    await admin.from('message_credits').update({
      balance: next,
      lifetime_used: (wallet.lifetime_used || 0) + msgs,
      credit_used: next < 0 ? Math.abs(next) : 0,
      updated_at: new Date().toISOString(),
    }).eq('workspace_id', workspaceId);
  } else {
    await admin.from('message_credits').insert({
      workspace_id: workspaceId,
      balance: next,
      lifetime_used: msgs,
      credit_used: next < 0 ? Math.abs(next) : 0,
    });
  }

  return { ok: true, balance: next, buffer };
}

/** Refund a charge when the provider send fails. */
export async function refundCredits(admin: any, workspaceId: string, msgs = 1) {
  const { data: wallet } = await admin.from('message_credits').select('*').eq('workspace_id', workspaceId).maybeSingle();
  if (!wallet) return;
  const next = (wallet.balance || 0) + msgs;
  await admin.from('message_credits').update({
    balance: next,
    lifetime_used: Math.max(0, (wallet.lifetime_used || 0) - msgs),
    credit_used: next < 0 ? Math.abs(next) : 0,
    updated_at: new Date().toISOString(),
  }).eq('workspace_id', workspaceId);
}

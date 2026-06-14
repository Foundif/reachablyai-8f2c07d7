import { supabase } from '@/integrations/supabase/client';

export async function logAudit(opts: {
  user_id: string;
  entity_type: string;
  entity_id?: string | null;
  action: string;
  before?: any;
  after?: any;
}) {
  try {
    await supabase.from('tn_audit_log').insert({
      user_id: opts.user_id,
      actor_id: opts.user_id,
      entity_type: opts.entity_type,
      entity_id: opts.entity_id ?? null,
      action: opts.action,
      before: opts.before ?? null,
      after: opts.after ?? null,
    });
  } catch (e) {
    console.warn('audit log failed', e);
  }
}

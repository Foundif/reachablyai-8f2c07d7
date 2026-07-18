// Audit log table removed with old concept. Stub until rebuilt in step 2.
export async function logAudit(_opts: {
  user_id: string;
  entity_type: string;
  entity_id?: string | null;
  action: string;
  before?: any;
  after?: any;
}) {}

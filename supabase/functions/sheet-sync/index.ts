// Manual / on-demand Google Sheets sync from inside Reachably.
//
// POST { action: 'test' }                      -> writes a sample row so the client can verify the setup
// POST { action: 'sync', record_id }           -> syncs one booking/form record
// POST { action: 'sync_all', limit? }          -> backfills recent records into the sheet
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildSheetRow, getSheetSettings, pushSheetRow, syncRecordToSheet, SHEET_COLUMNS } from '../_shared/sheetSync.ts';

const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const client = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: auth } = await client.auth.getUser();
    const user = auth?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(url, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');

    // Workspace of the caller: active workspace -> membership -> owned workspace
    let workspace_id: string | null = null;
    const { data: profile } = await admin.from('profiles')
      .select('active_workspace_id').eq('id', user.id).maybeSingle();
    workspace_id = (profile as any)?.active_workspace_id || null;
    if (!workspace_id) {
      const { data: member } = await admin.from('workspace_members')
        .select('workspace_id').eq('user_id', user.id).order('created_at').limit(1).maybeSingle();
      workspace_id = (member as any)?.workspace_id || null;
    }
    if (!workspace_id) {
      const { data: owned } = await admin.from('workspaces')
        .select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
      workspace_id = (owned as any)?.id || null;
    }
    if (!workspace_id) return json({ error: 'No workspace found for this user' }, 400);

    const settings = await getSheetSettings(admin, workspace_id);
    if (!settings) return json({ error: 'Google Sheets is not connected for this workspace' }, 400);

    if (action === 'test') {
      const sample = buildSheetRow({
        record_code: 'TEST-CONNECTION',
        record_type: 'booking',
        customer_name: 'Reachably Test',
        customer_phone: '910000000000',
        service: 'connection_test',
        status: 'new',
        payment_status: 'pending',
        amount: 0,
        advance_amount: 0,
        paid_amount: 0,
        source: 'reachably_test',
        scheduled_at: new Date().toISOString(),
        custom_fields: {},
        notes: 'Delete this row — it only confirms the sheet connection works.',
      }, null);
      const res = await pushSheetRow(settings, sample);
      if (!res.ok) return json({ ok: false, error: res.error }, 400);
      return json({ ok: true, tab: settings.tab || 'Bookings', columns: SHEET_COLUMNS });
    }

    if (action === 'sync') {
      const recordId = String(body?.record_id || '');
      if (!recordId) return json({ error: 'record_id is required' }, 400);
      const { data: rec } = await admin.from('business_records').select('*')
        .eq('id', recordId).eq('workspace_id', workspace_id).maybeSingle();
      if (!rec) return json({ error: 'Record not found' }, 404);
      const out = await syncRecordToSheet(admin, workspace_id, rec);
      if (!out.synced) return json({ ok: false, error: out.error || 'Sync failed' }, 400);
      return json({ ok: true, record: rec.record_code });
    }

    if (action === 'sync_all') {
      const limit = Math.min(Math.max(Number(body?.limit ?? 100), 1), 500);
      const { data: recs } = await admin.from('business_records').select('*')
        .eq('workspace_id', workspace_id).order('created_at', { ascending: true }).limit(limit);
      let synced = 0;
      let failed = 0;
      let lastError: string | undefined;
      for (const rec of (recs || [])) {
        const out = await syncRecordToSheet(admin, workspace_id, rec);
        if (out.synced) synced++;
        else { failed++; lastError = out.error; }
      }
      return json({ ok: failed === 0, synced, failed, error: lastError });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    console.error('sheet-sync error', e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

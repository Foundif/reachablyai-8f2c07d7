import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const GATEWAY = 'https://connector-gateway.lovable.dev/google_sheets/v4'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''))
    const userId = claims?.claims?.sub
    if (!userId) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: settings } = await admin.from('tn_settings').select('google_sheet_id, google_sheet_tab').eq('user_id', userId).maybeSingle()
    const sheetId = body?.sheet_id || settings?.google_sheet_id
    const tab = body?.tab || settings?.google_sheet_tab || 'Bookings'
    if (!sheetId) return json({ error: 'No Google Sheet ID configured.' }, 400)

    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    const sheetsKey = Deno.env.get('GOOGLE_SHEETS_API_KEY')
    if (!lovableKey || !sheetsKey) return json({ error: 'Google Sheets connector not linked.' }, 400)

    const a1Tab = /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${String(tab).replace(/'/g, "''")}'`
    const range = `${a1Tab}!A1:Z1000`
    const url = `${GATEWAY}/spreadsheets/${sheetId}/values/${range}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': sheetsKey,
      },
    })
    const data = await res.json()
    if (!res.ok) return json({ error: data?.error?.message || data?.message || 'Sheets read failed', status: res.status, data }, 400)

    return json({ ok: true, range: data.range, values: data.values || [], sheet_id: sheetId, tab })
  } catch (e) {
    console.error('sheets-read error', e)
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500)
  }
})

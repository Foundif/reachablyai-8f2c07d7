import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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
    // body: { sheet_id?, tab?, range, values: string[][] }  OR  { append: true, values: string[][] }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: settings } = await admin.from('tn_settings').select('google_sheet_id, google_sheet_tab').eq('user_id', userId).maybeSingle()
    const sheetId = body?.sheet_id || settings?.google_sheet_id
    const tab = body?.tab || settings?.google_sheet_tab || 'Bookings'
    if (!sheetId) return json({ error: 'No sheet configured' }, 400)
    if (!Array.isArray(body?.values)) return json({ error: 'values[][] required' }, 400)

    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    const sheetsKey = Deno.env.get('GOOGLE_SHEETS_API_KEY')
    if (!lovableKey || !sheetsKey) return json({ error: 'Sheets connector not linked' }, 400)

    const headers = {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': sheetsKey,
      'Content-Type': 'application/json',
    }

    const a1Tab = /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${String(tab).replace(/'/g, "''")}'`
    let url: string
    let method: 'PUT' | 'POST' = 'PUT'
    if (body.append) {
      url = `${GATEWAY}/spreadsheets/${sheetId}/values/${a1Tab}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
      method = 'POST'
    } else {
      const range = body.range || `${a1Tab}!A1`
      url = `${GATEWAY}/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`
    }

    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify({ values: body.values, majorDimension: 'ROWS' }),
    })
    const data = await res.json()
    if (!res.ok) return json({ error: data?.error?.message || 'Write failed', data }, 400)
    return json({ ok: true, data })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500)
  }
})

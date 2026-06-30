import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GRAPH = 'https://graph.facebook.com/v21.0'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

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
    const action = String(body?.action || 'fetch')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: settings } = await admin.from('tn_settings').select('*').eq('user_id', userId).maybeSingle()
    const flowId = body?.flow_id || settings?.meta_flow_id
    if (!flowId) return json({ error: 'No Flow ID configured. Save Meta Flow ID in WhatsApp Settings first.' }, 400)

    const token = Deno.env.get('META_ACCESS_TOKEN')
    if (!token) return json({ error: 'META_ACCESS_TOKEN missing' }, 400)

    if (action === 'fetch') {
      // Get flow metadata
      const metaRes = await fetch(`${GRAPH}/${flowId}?fields=id,name,status,categories,validation_errors,preview`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const meta = await metaRes.json()
      if (!metaRes.ok) return json({ error: meta?.error?.message || 'Meta fetch failed', meta }, 400)

      // Get latest asset (flow.json)
      const assetsRes = await fetch(`${GRAPH}/${flowId}/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const assets = await assetsRes.json()
      let flowJson: any = null
      const asset = (assets?.data || []).find((a: any) => a.name === 'flow.json' || a.asset_type === 'FLOW_JSON')
      if (asset?.download_url) {
        try {
          const dl = await fetch(asset.download_url)
          flowJson = await dl.json()
        } catch (_) { flowJson = null }
      }
      return json({ ok: true, meta, flow_json: flowJson })
    }

    if (action === 'save') {
      const flowJson = body?.flow_json
      if (!flowJson || typeof flowJson !== 'object') return json({ error: 'flow_json required' }, 400)
      const form = new FormData()
      const blob = new Blob([JSON.stringify(flowJson)], { type: 'application/json' })
      form.append('name', 'flow.json')
      form.append('asset_type', 'FLOW_JSON')
      form.append('file', blob, 'flow.json')

      const res = await fetch(`${GRAPH}/${flowId}/assets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const result = await res.json()
      if (!res.ok) return json({ error: result?.error?.message || 'Save failed', result }, 400)
      return json({ ok: true, result })
    }

    if (action === 'publish') {
      const res = await fetch(`${GRAPH}/${flowId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!res.ok) return json({ error: result?.error?.message || 'Publish failed', result }, 400)
      return json({ ok: true, result })
    }

    if (action === 'validate') {
      const res = await fetch(`${GRAPH}/${flowId}?fields=validation_errors,status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      return json({ ok: res.ok, result })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (e) {
    console.error('meta-flow-manage error', e)
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500)
  }
})

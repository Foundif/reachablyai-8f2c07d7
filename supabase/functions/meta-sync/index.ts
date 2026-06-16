import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GRAPH = 'https://graph.facebook.com/v21.0'
const PREFERRED_TN45_FLOW_ID = '1668931244342394'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

async function fetchAllGraph(path: string, token: string) {
  const rows: any[] = []
  let next: string | null = `${GRAPH}${path}`
  while (next) {
    const res = await fetch(next, { headers: { Authorization: `Bearer ${token}` } })
    const body = await res.json()
    if (!res.ok || body?.error) throw body?.error || body
    rows.push(...(body.data || []))
    next = body.paging?.next || null
  }
  return rows
}

function hasFlowButton(components: any[] = []) {
  return components.some((component) => {
    const buttons = component?.buttons || []
    return String(component?.type || '').toUpperCase() === 'BUTTONS' && buttons.some((button: any) => {
      const type = String(button?.type || button?.sub_type || '').toUpperCase()
      return type === 'FLOW'
    })
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claims } = await client.auth.getClaims(authHeader.replace('Bearer ', ''))
    const userId = claims?.claims?.sub
    if (!userId) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: settings, error: settingsError } = await admin
      .from('tn_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (settingsError) return json({ error: settingsError.message }, 400)
    if (!settings?.meta_waba_id) return json({ error: 'Save your WhatsApp Business Account ID before syncing.' }, 400)

    const token = Deno.env.get('META_ACCESS_TOKEN')
    if (!token) return json({ error: 'Meta access token is not configured in backend secrets.' }, 400)

    const errors: any[] = []
    let templates: any[] = []
    let flows: any[] = []

    try {
      templates = await fetchAllGraph(`/${settings.meta_waba_id}/message_templates?fields=id,name,category,language,status,components,quality_score&limit=100`, token)
      for (const template of templates) {
        const { error } = await admin.from('tn_meta_templates').upsert({
          user_id: userId,
          meta_id: String(template.id),
          name: template.name,
          category: template.category || null,
          language: template.language || null,
          status: template.status || null,
          components: template.components || [],
          quality_rating: template.quality_score?.score || null,
          raw: template,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'user_id,meta_id,language' })
        if (error) errors.push({ scope: 'template_upsert', name: template.name, error })
      }
    } catch (error) {
      errors.push({ scope: 'templates_fetch', error })
    }

    try {
      flows = await fetchAllGraph(`/${settings.meta_waba_id}/flows?fields=id,name,status,categories,endpoint_uri,validation_errors&limit=100`, token)
      for (const flow of flows) {
        const { error } = await admin.from('tn_meta_flows').upsert({
          user_id: userId,
          meta_id: String(flow.id),
          name: flow.name || `Flow ${flow.id}`,
          status: flow.status || null,
          categories: flow.categories || [],
          endpoint_uri: flow.endpoint_uri || null,
          validation_errors: flow.validation_errors || [],
          preview: {},
          raw: flow,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'user_id,meta_id' })
        if (error) errors.push({ scope: 'flow_upsert', name: flow.name, error })
      }
    } catch (error) {
      errors.push({ scope: 'flows_fetch', error })
    }

    const approvedTemplates = templates.filter((template) => String(template.status).toUpperCase() === 'APPROVED')
    const activeTemplate = approvedTemplates.find((template) => hasFlowButton(template.components))
      || approvedTemplates.find((template) => String(template.name).includes('tn45'))
      || approvedTemplates[0]
    const preferredFlowId = String(body?.preferred_flow_id || settings.meta_flow_id || PREFERRED_TN45_FLOW_ID)
    const activeFlow = flows.find((flow) => String(flow.id) === preferredFlowId)
      || flows.find((flow) => String(flow.status).toUpperCase() === 'PUBLISHED')

    const settingsPatch: Record<string, string> = {}
    if (activeTemplate) {
      settingsPatch.meta_template_name = activeTemplate.name
      settingsPatch.meta_template_language = activeTemplate.language || 'en'
    }
    if (activeFlow) settingsPatch.meta_flow_id = String(activeFlow.id)

    if (Object.keys(settingsPatch).length) {
      const { error } = await admin.from('tn_settings').update(settingsPatch).eq('user_id', userId)
      if (error) errors.push({ scope: 'settings_update', error })
    }

    return json({
      ok: errors.length === 0,
      templates: templates.length,
      flows: flows.length,
      errors,
      selected: { template: activeTemplate?.name || null, language: activeTemplate?.language || null, flow_id: activeFlow?.id || null },
      settings: settingsPatch,
    })
  } catch (err) {
    console.error('meta-sync error', err)
    return json({ error: err instanceof Error ? err.message : 'Meta sync failed' }, 500)
  }
})
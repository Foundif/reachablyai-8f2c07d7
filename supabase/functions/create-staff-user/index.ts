// Create staff/admin sub-user under the calling owner's workspace.
// Requires a Supabase JWT (owner). Creates auth user + profile row scoped via owner_id.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: uErr } = await anon.auth.getUser()
    if (uErr || !userData.user) return json({ error: 'unauthorized' }, 401)
    const ownerId = userData.user.id
    const { data: ownerWorkspace } = await admin.from('workspaces')
      .select('id')
      .eq('owner_id', ownerId)
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (!ownerWorkspace?.id) return json({ error: 'workspace_not_found' }, 400)

    // Only real owners (not staff themselves) can create users
    const { data: ownerProfile } = await admin.from('profiles').select('is_staff').eq('user_id', ownerId).maybeSingle()
    if (ownerProfile?.is_staff) return json({ error: 'forbidden', message: 'Staff cannot create users' }, 403)

    const body = await req.json().catch(() => ({}))
    const action = body.action || 'create'

    if (action === 'list') {
      const { data, error } = await admin.from('profiles')
        .select('user_id, email, full_name, role, is_staff, allowed_modules, created_at')
        .eq('owner_id', ownerId).eq('is_staff', true).order('created_at', { ascending: false })
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, members: data })
    }

    if (action === 'update') {
      const { user_id, allowed_modules, role, full_name } = body
      if (!user_id) return json({ error: 'user_id required' }, 400)
      // Ensure the target belongs to this owner
      const { data: target } = await admin.from('profiles').select('user_id').eq('user_id', user_id).eq('owner_id', ownerId).maybeSingle()
      if (!target) return json({ error: 'not_found' }, 404)
      const patch: Record<string, unknown> = {}
      if (Array.isArray(allowed_modules)) patch.allowed_modules = allowed_modules
      if (role) patch.role = role
      if (full_name) patch.full_name = full_name
      const { error } = await admin.from('profiles').update(patch).eq('user_id', user_id)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    if (action === 'delete') {
      const { user_id } = body
      if (!user_id) return json({ error: 'user_id required' }, 400)
      const { data: target } = await admin.from('profiles').select('user_id').eq('user_id', user_id).eq('owner_id', ownerId).maybeSingle()
      if (!target) return json({ error: 'not_found' }, 404)
      await admin.auth.admin.deleteUser(user_id)
      return json({ ok: true })
    }

    // Default: create
    const { email, password, full_name, role, allowed_modules } = body
    if (!email || !password) return json({ error: 'email and password required' }, 400)
    if (String(password).length < 6) return json({ error: 'password must be at least 6 chars' }, 400)
    const finalRole = role === 'admin' ? 'admin' : 'staff'
    const mods: string[] = Array.isArray(allowed_modules) ? allowed_modules : []

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: full_name || '', owner_id: ownerId },
    })
    if (cErr || !created.user) return json({ error: cErr?.message || 'create_failed' }, 400)
    const newId = created.user.id

    // Upsert profile with owner_id + allowed_modules; skip onboarding for staff
    const { error: pErr } = await admin.from('profiles').upsert({
      user_id: newId, email, full_name: full_name || '',
      role: finalRole, owner_id: ownerId, is_staff: true,
      allowed_modules: finalRole === 'admin' ? [] : mods,
      active_workspace_id: ownerWorkspace.id,
      onboarding_completed: true,
    }, { onConflict: 'user_id' })
    if (pErr) {
      await admin.auth.admin.deleteUser(newId)
      return json({ error: pErr.message }, 500)
    }

    const { error: wmErr } = await admin.from('workspace_members').upsert({
      workspace_id: ownerWorkspace.id,
      user_id: newId,
      role: 'owner',
    }, { onConflict: 'workspace_id,user_id' })
    if (wmErr) {
      await admin.auth.admin.deleteUser(newId)
      return json({ error: wmErr.message }, 500)
    }

    return json({ ok: true, user_id: newId, email })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'internal_error' }, 500)
  }
})

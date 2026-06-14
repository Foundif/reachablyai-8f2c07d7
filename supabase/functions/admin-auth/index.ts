import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { action, username, password, token } = await req.json()

    if (action === 'login') {
      const { data, error } = await supabase
        .from('super_admins')
        .select('*')
        .eq('username', username)
        .single()

      if (error || !data || data.password_hash !== password) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const sessionToken = crypto.randomUUID()
      await supabase.from('super_admins')
        .update({ session_token: sessionToken, updated_at: new Date().toISOString() })
        .eq('id', data.id)

      return new Response(JSON.stringify({ token: sessionToken, username: data.username }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'verify') {
      const adminToken = token || req.headers.get('authorization')?.replace('Bearer ', '')
      if (!adminToken) {
        return new Response(JSON.stringify({ valid: false }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data } = await supabase
        .from('super_admins')
        .select('username')
        .eq('session_token', adminToken)
        .single()

      return new Response(JSON.stringify({ valid: !!data, username: data?.username }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'logout') {
      const adminToken = token || req.headers.get('authorization')?.replace('Bearer ', '')
      if (adminToken) {
        await supabase.from('super_admins')
          .update({ session_token: null })
          .eq('session_token', adminToken)
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'update_credentials') {
      const adminToken = token || req.headers.get('authorization')?.replace('Bearer ', '')
      const { data: admin } = await supabase
        .from('super_admins')
        .select('id')
        .eq('session_token', adminToken)
        .single()

      if (!admin) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const updates: Record<string, string> = {}
      if (username) updates.username = username
      if (password) updates.password_hash = password

      const { error } = await supabase.from('super_admins')
        .update(updates)
        .eq('id', admin.id)

      if (error) throw error

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

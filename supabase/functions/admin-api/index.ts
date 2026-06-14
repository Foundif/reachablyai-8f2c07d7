import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyAdmin(supabase: any, req: Request, body?: any): Promise<boolean> {
  const token = body?.token || req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const { data } = await supabase
    .from('super_admins')
    .select('id')
    .eq('session_token', token)
    .single()
  return !!data
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

    const body = await req.json()
    const isAdmin = await verifyAdmin(supabase, req, body)
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { action } = body

    if (action === 'get_users') {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return new Response(JSON.stringify({ users: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'update_user') {
      const { user_id, trial_end_date, subscription_status, role } = body
      const updates: Record<string, any> = {}
      if (trial_end_date !== undefined) updates.trial_end_date = trial_end_date
      if (subscription_status !== undefined) updates.subscription_status = subscription_status
      if (role !== undefined) updates.role = role

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user_id)

      if (error) throw error
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // List per-user permission overrides
    if (action === 'list_overrides') {
      const { user_id } = body
      const { data, error } = await supabase
        .from('tn_permission_overrides')
        .select('*')
        .eq('user_id', user_id)
      if (error) throw error
      return new Response(JSON.stringify({ overrides: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Set or remove a permission override
    if (action === 'set_override') {
      const { user_id, override_action, allowed, remove } = body
      if (remove) {
        const { error } = await supabase
          .from('tn_permission_overrides')
          .delete()
          .eq('user_id', user_id)
          .eq('action', override_action)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tn_permission_overrides')
          .upsert({ user_id, action: override_action, allowed }, { onConflict: 'user_id,action' })
        if (error) throw error
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'get_stats') {
      const { data: profiles } = await supabase.from('profiles').select('*')
      const { data: salonInvoices } = await supabase.from('salon_invoices').select('total_amount, gst_type, invoice_date, created_at')

      const totalUsers = profiles?.length || 0
      const activeTrials = profiles?.filter((p: any) =>
        p.subscription_status === 'trial' && p.trial_end_date && new Date(p.trial_end_date) > new Date()
      ).length || 0
      const expiredTrials = profiles?.filter((p: any) =>
        p.subscription_status === 'trial' && p.trial_end_date && new Date(p.trial_end_date) <= new Date()
      ).length || 0
      const paidUsers = profiles?.filter((p: any) => p.subscription_status === 'active').length || 0

      const totalRevenue = salonInvoices?.reduce((s: number, i: any) => s + (i.total_amount || 0), 0) || 0
      const gstRevenue = salonInvoices?.filter((i: any) => i.gst_type === 'with_gst')
        .reduce((s: number, i: any) => s + (i.total_amount || 0), 0) || 0
      const nonGstRevenue = salonInvoices?.filter((i: any) => i.gst_type === 'without_gst')
        .reduce((s: number, i: any) => s + (i.total_amount || 0), 0) || 0

      const roleDistribution: Record<string, number> = {}
      profiles?.forEach((p: any) => {
        const r = p.role || 'freelancer'
        roleDistribution[r] = (roleDistribution[r] || 0) + 1
      })

      const monthlyRevenue: Record<string, { gst: number; nonGst: number }> = {}
      salonInvoices?.forEach((inv: any) => {
        const m = inv.invoice_date?.slice(0, 7)
        if (!m) return
        if (!monthlyRevenue[m]) monthlyRevenue[m] = { gst: 0, nonGst: 0 }
        if (inv.gst_type === 'with_gst') monthlyRevenue[m].gst += inv.total_amount || 0
        else monthlyRevenue[m].nonGst += inv.total_amount || 0
      })

      const chartData = Object.entries(monthlyRevenue)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, data]) => ({
          month: new Date(month + '-01').toLocaleDateString('en', { month: 'short', year: '2-digit' }),
          gst: data.gst,
          nonGst: data.nonGst,
          total: data.gst + data.nonGst,
        }))

      return new Response(JSON.stringify({
        totalUsers, activeTrials, expiredTrials, paidUsers,
        totalRevenue, gstRevenue, nonGstRevenue, chartData, roleDistribution,
      }), {
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

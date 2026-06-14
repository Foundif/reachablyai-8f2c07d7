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

    const now = new Date()
    const notifications: { user_id: string; type: string; title: string; message: string; data?: any }[] = []

    // 1. Appointment reminders - appointments in next 2 hours
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const todayStr = now.toISOString().split('T')[0]
    const nowTime = now.toTimeString().slice(0, 5)
    const laterTime = twoHoursLater.toTimeString().slice(0, 5)

    const { data: appointments } = await supabase
      .from('appointments')
      .select('*, customers(name), services(name)')
      .eq('appointment_date', todayStr)
      .eq('status', 'booked')
      .gte('appointment_time', nowTime)
      .lte('appointment_time', laterTime)

    if (appointments) {
      for (const apt of appointments) {
        const customerName = (apt as any).customers?.name || 'Customer'
        const serviceName = (apt as any).services?.name || 'Service'
        notifications.push({
          user_id: apt.user_id,
          type: 'appointment_reminder',
          title: `Upcoming Appointment`,
          message: `${customerName} has ${serviceName} at ${apt.appointment_time} today.`,
          data: { appointment_id: apt.id },
        })
      }
    }

    // 2. Low stock alerts - products with ≤ 3 units
    const { data: products } = await supabase
      .from('products')
      .select('id, user_id, brand, model_name')

    if (products) {
      for (const product of products) {
        const { data: sizes } = await supabase
          .from('product_sizes')
          .select('quantity')
          .eq('product_id', product.id)

        const totalStock = (sizes || []).reduce((s: number, sz: any) => s + (sz.quantity || 0), 0)
        
        if (totalStock <= 3) {
          notifications.push({
            user_id: product.user_id,
            type: 'low_stock',
            title: totalStock === 0 ? `Out of Stock!` : `Low Stock Alert`,
            message: `${product.brand} ${product.model_name} has only ${totalStock} units remaining.`,
            data: { product_id: product.id, stock: totalStock },
          })
        }
      }
    }

    // 3. Daily revenue summary (run once per day ideally)
    const { data: profiles } = await supabase.from('profiles').select('user_id')

    if (profiles) {
      for (const profile of profiles) {
        const { data: todayInvoices } = await supabase
          .from('salon_invoices')
          .select('total_amount')
          .eq('user_id', profile.user_id)
          .eq('invoice_date', todayStr)

        const todayRevenue = (todayInvoices || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0)

        const { data: todayExpenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('user_id', profile.user_id)
          .eq('expense_date', todayStr)

        const totalExpenses = (todayExpenses || []).reduce((s: number, e: any) => s + (e.amount || 0), 0)

        if (todayRevenue > 0 || totalExpenses > 0) {
          notifications.push({
            user_id: profile.user_id,
            type: 'daily_revenue',
            title: `Daily Summary`,
            message: `Today's revenue: ₹${todayRevenue.toLocaleString()} | Expenses: ₹${totalExpenses.toLocaleString()} | Net: ₹${(todayRevenue - totalExpenses).toLocaleString()}`,
            data: { revenue: todayRevenue, expenses: totalExpenses },
          })
        }
      }
    }

    // Deduplicate - don't insert if same type+user+title exists in last 4 hours
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()
    const { data: recentNotifs } = await supabase
      .from('notifications')
      .select('user_id, type, title')
      .gte('created_at', fourHoursAgo)

    const recentKeys = new Set(
      (recentNotifs || []).map((n: any) => `${n.user_id}:${n.type}:${n.title}`)
    )

    const toInsert = notifications.filter(n =>
      !recentKeys.has(`${n.user_id}:${n.type}:${n.title}`)
    )

    if (toInsert.length > 0) {
      const { error } = await supabase.from('notifications').insert(toInsert)
      if (error) throw error
    }

    return new Response(JSON.stringify({
      generated: toInsert.length,
      skipped_duplicates: notifications.length - toInsert.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

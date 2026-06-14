import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { SalonInvoice } from '@/types/salon';

export const useSalonInvoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<SalonInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    if (!user) { setInvoices([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('salon_invoices')
        .select('*, customers(name, phone), salon_invoice_items(*, employees(name))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices((data || []).map((inv: any) => ({
        id: inv.id, user_id: inv.user_id, invoice_number: inv.invoice_number,
        customer_id: inv.customer_id, invoice_date: inv.invoice_date,
        gst_type: inv.gst_type, payment_mode: inv.payment_mode,
        discount: Number(inv.discount) || 0, total_amount: Number(inv.total_amount),
        notes: inv.notes, created_at: inv.created_at,
        customer_name: inv.customers?.name, customer_phone: inv.customers?.phone,
        items: (inv.salon_invoice_items || []).map((item: any) => ({
          id: item.id, invoice_id: item.invoice_id, service_id: item.service_id,
          employee_id: item.employee_id, service_name: item.service_name,
          price: Number(item.price), quantity: item.quantity,
          created_at: item.created_at, employee_name: item.employees?.name,
        })),
      })));
    } catch (err: any) {
      console.error('Error fetching salon invoices:', err);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchInvoices();

    const channel = supabase
      .channel('salon-invoices-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salon_invoices' }, () => fetchInvoices())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchInvoices]);

  return { invoices, loading, refetch: fetchInvoices };
};

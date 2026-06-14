import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Sale, SaleItem } from '@/types/store';

export const useSales = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSales = useCallback(async () => {
    if (!user) { setSales([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data: salesData, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: itemsData } = await supabase
        .from('sale_items')
        .select('*');

      setSales((salesData || []).map((s: any) => ({
        id: s.id, user_id: s.user_id, invoice_number: s.invoice_number,
        customer_id: s.customer_id, customer_phone: s.customer_phone,
        total_amount: Number(s.total_amount), payment_method: s.payment_method,
        created_at: s.created_at,
        items: (itemsData || []).filter((i: any) => i.sale_id === s.id).map((i: any) => ({
          id: i.id, sale_id: i.sale_id, product_id: i.product_id,
          product_size_id: i.product_size_id, product_name: i.product_name,
          size: i.size, quantity: i.quantity, selling_price: Number(i.selling_price),
          created_at: i.created_at,
        })),
      })));
    } catch (err: any) {
      console.error('Error fetching sales:', err);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchSales();

    const channel = supabase
      .channel('sales-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => fetchSales())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchSales]);

  return { sales, loading, refetch: fetchSales };
};

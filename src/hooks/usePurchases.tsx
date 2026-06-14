import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Purchase, PurchaseItem } from '@/types/store';

export const usePurchases = () => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = useCallback(async () => {
    if (!user) { setPurchases([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data: purchasesData, error } = await supabase
        .from('purchases')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: itemsData } = await supabase.from('purchase_items').select('*');

      setPurchases((purchasesData || []).map((p: any) => ({
        id: p.id, user_id: p.user_id, supplier_id: p.supplier_id,
        purchase_date: p.purchase_date, total_amount: Number(p.total_amount),
        created_at: p.created_at,
        items: (itemsData || []).filter((i: any) => i.purchase_id === p.id).map((i: any) => ({
          id: i.id, purchase_id: i.purchase_id, product_id: i.product_id,
          product_size_id: i.product_size_id, size: i.size,
          quantity: i.quantity, purchase_price: Number(i.purchase_price),
          created_at: i.created_at,
        })),
      })));
    } catch (err: any) {
      console.error('Error fetching purchases:', err);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchPurchases();
  }, [user, fetchPurchases]);

  return { purchases, loading, refetch: fetchPurchases };
};

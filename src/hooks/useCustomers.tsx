import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Customer } from '@/types/store';

export const useCustomers = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    if (!user) { setCustomers([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomers((data || []).map((c: any) => ({
        id: c.id, user_id: c.user_id, name: c.name, phone: c.phone,
        avatar_url: c.avatar_url,
        total_purchases: Number(c.total_purchases) || 0,
        last_purchase_date: c.last_purchase_date,
        created_at: c.created_at, updated_at: c.updated_at,
      })));
    } catch (err: any) {
      console.error('Error fetching customers:', err);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchCustomers();
  }, [user, fetchCustomers]);

  return { customers, loading, refetch: fetchCustomers };
};

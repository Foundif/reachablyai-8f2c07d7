import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Supplier } from '@/types/store';

export const useSuppliers = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = useCallback(async () => {
    if (!user) { setSuppliers([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSuppliers((data || []).map((s: any) => ({
        id: s.id, user_id: s.user_id, name: s.name, phone: s.phone,
        address: s.address, brands_supplied: s.brands_supplied,
        created_at: s.created_at, updated_at: s.updated_at,
      })));
    } catch (err: any) {
      console.error('Error fetching suppliers:', err);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchSuppliers();
  }, [user, fetchSuppliers]);

  return { suppliers, loading, refetch: fetchSuppliers };
};

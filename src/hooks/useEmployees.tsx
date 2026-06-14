import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Employee } from '@/types/salon';

export const useEmployees = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    if (!user) { setEmployees([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setEmployees((data || []).map((e: any) => ({
        id: e.id, user_id: e.user_id, name: e.name, phone: e.phone,
        role: e.role, commission_percentage: Number(e.commission_percentage),
        created_at: e.created_at, updated_at: e.updated_at,
      })));
    } catch (err: any) {
      console.error('Error fetching employees:', err);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchEmployees();
  }, [user, fetchEmployees]);

  return { employees, loading, refetch: fetchEmployees };
};

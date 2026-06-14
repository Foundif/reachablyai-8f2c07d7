import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Expense } from '@/types/salon';

export const useExpenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    if (!user) { setExpenses([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      if (error) throw error;
      setExpenses((data || []).map((e: any) => ({
        id: e.id, user_id: e.user_id, name: e.name, category: e.category,
        amount: Number(e.amount), expense_date: e.expense_date,
        notes: e.notes, created_at: e.created_at,
      })));
    } catch (err: any) {
      console.error('Error fetching expenses:', err);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchExpenses();
  }, [user, fetchExpenses]);

  return { expenses, loading, refetch: fetchExpenses };
};

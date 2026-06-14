import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PaymentRecord {
  id: string;
  client_id: string;
  invoice_id: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'late' | 'overdue';
  due_date: string | null;
  payment_date: string | null;
  days_late: number;
  created_at: string;
}

export const usePaymentHistory = (clientId?: string) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!user) {
      setPayments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('payment_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const mappedPayments: PaymentRecord[] = (data || []).map((p) => ({
        id: p.id,
        client_id: p.client_id,
        invoice_id: p.invoice_id,
        amount: Number(p.amount),
        status: (p.status as PaymentRecord['status']) ?? 'pending',
        due_date: p.due_date,
        payment_date: p.payment_date,
        days_late: p.days_late ?? 0,
        created_at: p.created_at,
      }));

      setPayments(mappedPayments);
    } catch (err: any) {
      console.error('Error fetching payment history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, clientId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const addPayment = async (payment: Omit<PaymentRecord, 'id' | 'created_at'>) => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('payment_history')
      .insert({
        ...payment,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  return { payments, loading, error, refetch: fetchPayments, addPayment };
};

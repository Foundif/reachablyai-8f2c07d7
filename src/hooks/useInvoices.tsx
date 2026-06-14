import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  amount: number;
  advance_amount: number;
  due_date: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  description: string | null;
  payment_terms: string | null;
  suggested_advance_percent: number | null;
  risk_warning: string | null;
  created_at: string;
  updated_at: string;
}

export const useInvoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!user) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mappedInvoices: Invoice[] = (data || []).map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        client_id: inv.client_id,
        amount: Number(inv.amount),
        advance_amount: Number(inv.advance_amount) || 0,
        due_date: inv.due_date,
        status: (inv.status as Invoice['status']) ?? 'draft',
        description: inv.description,
        payment_terms: inv.payment_terms,
        suggested_advance_percent: inv.suggested_advance_percent,
        risk_warning: inv.risk_warning,
        created_at: inv.created_at,
        updated_at: inv.updated_at,
      }));

      setInvoices(mappedInvoices);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchInvoices();

    const channel = supabase
      .channel('invoices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newInv = payload.new as any;
            setInvoices((prev) => [{
              id: newInv.id,
              invoice_number: newInv.invoice_number,
              client_id: newInv.client_id,
              amount: Number(newInv.amount),
              advance_amount: Number(newInv.advance_amount) || 0,
              due_date: newInv.due_date,
              status: (newInv.status as Invoice['status']) ?? 'draft',
              description: newInv.description,
              payment_terms: newInv.payment_terms,
              suggested_advance_percent: newInv.suggested_advance_percent,
              risk_warning: newInv.risk_warning,
              created_at: newInv.created_at,
              updated_at: newInv.updated_at,
            }, ...prev]);
            toast.success(`Invoice ${newInv.invoice_number} created`);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            const old = payload.old as any;

            setInvoices((prev) =>
              prev.map((inv) =>
                inv.id === updated.id
                  ? {
                      id: updated.id,
                      invoice_number: updated.invoice_number,
                      client_id: updated.client_id,
                      amount: Number(updated.amount),
                      advance_amount: Number(updated.advance_amount) || 0,
                      due_date: updated.due_date,
                      status: (updated.status as Invoice['status']) ?? 'draft',
                      description: updated.description,
                      payment_terms: updated.payment_terms,
                      suggested_advance_percent: updated.suggested_advance_percent,
                      risk_warning: updated.risk_warning,
                      created_at: updated.created_at,
                      updated_at: updated.updated_at,
                    }
                  : inv
              )
            );

            // Notify on status changes
            if (old.status !== 'overdue' && updated.status === 'overdue') {
              toast.error(`🚨 Invoice ${updated.invoice_number} is now OVERDUE!`, {
                duration: 8000,
              });
            } else if (old.status !== 'paid' && updated.status === 'paid') {
              toast.success(`💰 Invoice ${updated.invoice_number} has been paid!`, {
                duration: 5000,
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as any;
            setInvoices((prev) => prev.filter((inv) => inv.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchInvoices]);

  return { invoices, loading, error, refetch: fetchInvoices };
};

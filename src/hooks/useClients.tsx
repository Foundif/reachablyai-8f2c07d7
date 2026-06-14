import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  industry: string | null;
  country: string | null;
  trust_score: number;
  risk_level: 'safe' | 'medium' | 'high';
  total_paid: number;
  total_outstanding: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentHistory {
  id: string;
  client_id: string;
  invoice_id: string | null;
  amount: number;
  due_date: string | null;
  payment_date: string | null;
  days_late: number;
  status: 'paid' | 'pending' | 'overdue';
}

export const useClients = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    if (!user) {
      setClients([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mappedClients: Client[] = (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        company: c.company,
        industry: c.industry,
        country: c.country,
        trust_score: c.trust_score ?? 75,
        risk_level: (c.risk_level as 'safe' | 'medium' | 'high') ?? 'medium',
        total_paid: Number(c.total_paid) || 0,
        total_outstanding: Number(c.total_outstanding) || 0,
        notes: c.notes,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));

      setClients(mappedClients);
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return;

    fetchClients();

    const channel = supabase
      .channel('clients-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newClient = payload.new as any;
            setClients((prev) => [{
              id: newClient.id,
              name: newClient.name,
              email: newClient.email,
              company: newClient.company,
              industry: newClient.industry,
              country: newClient.country,
              trust_score: newClient.trust_score ?? 75,
              risk_level: (newClient.risk_level as 'safe' | 'medium' | 'high') ?? 'medium',
              total_paid: Number(newClient.total_paid) || 0,
              total_outstanding: Number(newClient.total_outstanding) || 0,
              notes: newClient.notes,
              created_at: newClient.created_at,
              updated_at: newClient.updated_at,
            }, ...prev]);
            toast.success(`New client "${newClient.name}" added`);
          } else if (payload.eventType === 'UPDATE') {
            const updatedClient = payload.new as any;
            const oldClient = payload.old as any;
            
            setClients((prev) =>
              prev.map((c) =>
                c.id === updatedClient.id
                  ? {
                      id: updatedClient.id,
                      name: updatedClient.name,
                      email: updatedClient.email,
                      company: updatedClient.company,
                      industry: updatedClient.industry,
                      country: updatedClient.country,
                      trust_score: updatedClient.trust_score ?? 75,
                      risk_level: (updatedClient.risk_level as 'safe' | 'medium' | 'high') ?? 'medium',
                      total_paid: Number(updatedClient.total_paid) || 0,
                      total_outstanding: Number(updatedClient.total_outstanding) || 0,
                      notes: updatedClient.notes,
                      created_at: updatedClient.created_at,
                      updated_at: updatedClient.updated_at,
                    }
                  : c
              )
            );

            // Check for risk score changes
            if (oldClient.trust_score !== updatedClient.trust_score) {
              const scoreDiff = updatedClient.trust_score - oldClient.trust_score;
              if (scoreDiff < 0) {
                toast.warning(`⚠️ ${updatedClient.name}'s trust score dropped by ${Math.abs(scoreDiff)} points`, {
                  duration: 5000,
                });
              } else {
                toast.success(`📈 ${updatedClient.name}'s trust score increased by ${scoreDiff} points`, {
                  duration: 5000,
                });
              }
            }

            // Check for risk level changes
            if (oldClient.risk_level !== updatedClient.risk_level) {
              if (updatedClient.risk_level === 'high') {
                toast.error(`🚨 ${updatedClient.name} is now HIGH RISK`, {
                  duration: 8000,
                });
              } else if (updatedClient.risk_level === 'medium') {
                toast.warning(`⚠️ ${updatedClient.name} is now MEDIUM RISK`, {
                  duration: 5000,
                });
              } else {
                toast.success(`✅ ${updatedClient.name} is now SAFE`, {
                  duration: 5000,
                });
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedClient = payload.old as any;
            setClients((prev) => prev.filter((c) => c.id !== deletedClient.id));
            toast.info(`Client removed`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchClients]);

  return { clients, loading, error, refetch: fetchClients };
};

export const usePaymentHistory = (clientId?: string) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPayments([]);
      setLoading(false);
      return;
    }

    const fetchPayments = async () => {
      try {
        setLoading(true);
        let query = supabase.from('payment_history').select('*');
        
        if (clientId) {
          query = query.eq('client_id', clientId);
        }
        
        const { data, error } = await query.order('due_date', { ascending: false });

        if (error) throw error;

        const mappedPayments: PaymentHistory[] = (data || []).map((p) => ({
          id: p.id,
          client_id: p.client_id,
          invoice_id: p.invoice_id,
          amount: Number(p.amount),
          due_date: p.due_date,
          payment_date: p.payment_date,
          days_late: p.days_late ?? 0,
          status: (p.status as 'paid' | 'pending' | 'overdue') ?? 'pending',
        }));

        setPayments(mappedPayments);
      } catch (err) {
        console.error('Error fetching payments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();

    // Subscribe to payment changes for overdue notifications
    const channel = supabase
      .channel('payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_history',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            const old = payload.old as any;

            // Check if payment just became overdue
            if (old.status !== 'overdue' && updated.status === 'overdue') {
              toast.error(`🚨 Payment of $${updated.amount} is now OVERDUE!`, {
                duration: 8000,
              });
            }

            // Check if payment was made
            if (old.status !== 'paid' && updated.status === 'paid') {
              toast.success(`💰 Payment of $${updated.amount} received!`, {
                duration: 5000,
              });
            }

            setPayments((prev) =>
              prev.map((p) =>
                p.id === updated.id
                  ? {
                      id: updated.id,
                      client_id: updated.client_id,
                      invoice_id: updated.invoice_id,
                      amount: Number(updated.amount),
                      due_date: updated.due_date,
                      payment_date: updated.payment_date,
                      days_late: updated.days_late ?? 0,
                      status: (updated.status as 'paid' | 'pending' | 'overdue') ?? 'pending',
                    }
                  : p
              )
            );
          } else if (payload.eventType === 'INSERT') {
            const newPayment = payload.new as any;
            setPayments((prev) => [{
              id: newPayment.id,
              client_id: newPayment.client_id,
              invoice_id: newPayment.invoice_id,
              amount: Number(newPayment.amount),
              due_date: newPayment.due_date,
              payment_date: newPayment.payment_date,
              days_late: newPayment.days_late ?? 0,
              status: (newPayment.status as 'paid' | 'pending' | 'overdue') ?? 'pending',
            }, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, clientId]);

  return { payments, loading };
};

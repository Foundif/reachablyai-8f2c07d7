import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Appointment } from '@/types/salon';

export const useAppointments = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    if (!user) { setAppointments([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select('*, customers(name), services(name), employees(name)')
        .order('appointment_date', { ascending: false });
      if (error) throw error;
      setAppointments((data || []).map((a: any) => ({
        id: a.id, user_id: a.user_id, customer_id: a.customer_id,
        service_id: a.service_id, employee_id: a.employee_id,
        appointment_date: a.appointment_date, appointment_time: a.appointment_time,
        status: a.status, notes: a.notes,
        created_at: a.created_at, updated_at: a.updated_at,
        customer_name: a.customers?.name, service_name: a.services?.name,
        employee_name: a.employees?.name,
      })));
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchAppointments();
  }, [user, fetchAppointments]);

  return { appointments, loading, refetch: fetchAppointments };
};

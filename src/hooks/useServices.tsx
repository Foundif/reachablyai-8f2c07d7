import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Service } from '@/types/salon';

export const useServices = () => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = useCallback(async () => {
    if (!user) { setServices([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setServices((data || []).map((s: any) => ({
        id: s.id, user_id: s.user_id, name: s.name, category: s.category,
        price: Number(s.price), duration: s.duration,
        gst_applicable: s.gst_applicable,
        created_at: s.created_at, updated_at: s.updated_at,
      })));
    } catch (err: any) {
      console.error('Error fetching services:', err);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchServices();
  }, [user, fetchServices]);

  return { services, loading, refetch: fetchServices };
};

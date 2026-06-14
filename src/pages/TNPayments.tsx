import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const TNPayments = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('tn_payments').select('*, tn_bookings(*)').eq('user_id', user.id).order('created_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, [user]);

  const verify = async (p: any, status: 'verified' | 'rejected') => {
    await supabase.from('tn_payments').update({ status, verified_at: new Date().toISOString(), verified_by: user?.id }).eq('id', p.id);
    if (status === 'verified' && p.booking_id) {
      await supabase.from('tn_bookings').update({ status: 'paid' }).eq('id', p.booking_id);
      await supabase.functions.invoke('whatsapp-send', { body: { to: p.tn_bookings.wa_id, text: `✅ Payment of ₹${p.amount} verified. Booking TN45-${p.booking_id.slice(0,8)} is confirmed!`, booking_id: p.booking_id } });
    }
    toast.success(status);
    load();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-5">
        <h1 className="text-2xl md:text-3xl font-bold">Payments</h1>
        {rows.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">No payments yet.</Card>
        ) : rows.map(p => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2"><span className="font-mono text-xs">{p.id.slice(0,8)}</span><Badge>{p.status}</Badge></div>
                <p className="font-semibold mt-1">₹{p.amount} • {p.method}</p>
                <p className="text-sm text-muted-foreground">Booking: TN45-{p.booking_id?.slice(0,8)} • {p.tn_bookings?.wa_id}</p>
                {p.screenshot_url && <p className="text-xs mt-1">📎 {p.screenshot_url}</p>}
              </div>
              {p.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => verify(p, 'verified')}>Verify</Button>
                  <Button size="sm" variant="outline" onClick={() => verify(p, 'rejected')}>Reject</Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
};
export default TNPayments;

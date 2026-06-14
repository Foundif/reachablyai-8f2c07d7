import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const statusColor: Record<string, string> = {
  draft: 'bg-gray-500',
  awaiting_payment: 'bg-orange-500',
  paid: 'bg-blue-500',
  confirmed: 'bg-green-600',
  completed: 'bg-emerald-600',
  cancelled: 'bg-red-500',
};

const TNBookings = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
    if (!user) return;
    let q = supabase.from('tn_bookings').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setRows(data || []);
  };

  useEffect(() => { load(); }, [user, filter]);

  const confirm = async (b: any) => {
    const { data, error } = await supabase.functions.invoke('whatsapp-send', {
      body: { to: b.wa_id, text: `✅ Your booking is confirmed!\nID: TN45-${b.id.slice(0,8)}\nService: ${b.service_name}\nWe will contact you shortly.`, booking_id: b.id },
    });
    if (error) toast.error(error.message);
    else { toast.success('Confirmation sent'); load(); }
  };

  const cancel = async (b: any) => {
    await supabase.from('tn_bookings').update({ status: 'cancelled' }).eq('id', b.id);
    toast.success('Cancelled');
    load();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">Bookings</h1>
          <div className="flex gap-2 flex-wrap">
            {['all', 'awaiting_payment', 'paid', 'confirmed', 'completed', 'cancelled'].map(s => (
              <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
                {s.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">No bookings yet. They will appear here when customers book via WhatsApp.</Card>
        ) : (
          <div className="space-y-3">
            {rows.map(b => (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">TN45-{b.id.slice(0,8)}</span>
                      <Badge className={`${statusColor[b.status]} text-white`}>{b.status}</Badge>
                      {b.source === 'whatsapp_flow' && <Badge variant="outline" className="text-xs">Flow</Badge>}
                    </div>
                    <p className="font-semibold mt-1">{b.service_name} — ₹{b.price}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                      {b.name && <p>👤 <b>{b.name}</b></p>}
                      {b.phone && <p>📞 {b.phone}</p>}
                      {b.booking_date && <p>📅 {b.booking_date} {b.booking_time && `• ${b.booking_time}`}</p>}
                      {b.expected_hours && <p>⏱ {b.expected_hours}</p>}
                      {b.transport_mode && <p>🚉 {b.transport_mode} {b.transport_details && `• ${b.transport_details}`}</p>}
                      {b.address && <p className="col-span-2">📍 {b.address}{b.landmark ? ` (near ${b.landmark})` : ''}</p>}
                      <p className="text-muted-foreground">WA: {b.wa_id}</p>
                    </div>
                    {b.addons?.length > 0 && <p className="text-xs mt-2">➕ {b.addons.join(', ')}</p>}
                    <p className="text-xs text-muted-foreground mt-2">Advance ₹{b.advance_amount} • Balance ₹{b.balance_amount}</p>
                  </div>
                  <div className="flex gap-2">
                    {b.status !== 'confirmed' && b.status !== 'cancelled' && (
                      <Button size="sm" onClick={() => confirm(b)}>Confirm</Button>
                    )}
                    {b.status !== 'cancelled' && (
                      <Button size="sm" variant="outline" onClick={() => cancel(b)}>Cancel</Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TNBookings;

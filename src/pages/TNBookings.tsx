import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Edit3, Trash2, Loader2, Check, Eye } from 'lucide-react';

const statusColor: Record<string, string> = {
  draft: 'bg-gray-500',
  awaiting_payment: 'bg-orange-500',
  paid: 'bg-blue-500',
  confirmed: 'bg-green-600',
  completed: 'bg-emerald-600',
  cancelled: 'bg-red-500',
};

const SERVICES = [
  { code: 'terminal-railbus', name: 'In Railway/Bus Station Assist', price: 200 },
  { code: 'home-terminal', name: 'Home to Terminal', price: 200 },
  { code: 'home-railbus', name: 'Home to Railway/Bus Station', price: 200 },
  { code: 'terminal-home', name: 'Terminal to Home', price: 200 },
  { code: 'railbus-home', name: 'Railway/Bus Station to Home', price: 200 },
  { code: 'festivity-half', name: 'Festivity Half Day (6H)', price: 600 },
  { code: 'festivity-full', name: 'Festivity Full Day (12H)', price: 1200 },
  { code: 'hospital', name: 'Hospital Visit Assist (4H)', price: 500 },
  { code: 'outstation', name: 'Outstation Medical Escort', price: 1200 },
];

const blankForm = {
  id: '', service_code: 'terminal-railbus', service_name: '', price: '200',
  name: '', phone: '', wa_id: '', booking_date: '', booking_time: '',
  address: '', landmark: '', transport_mode: '', transport_details: '',
  status: 'confirmed', advance_amount: '50',
};

const TNBookings = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm);

  const load = async () => {
    if (!user) return;
    let q = supabase.from('tn_bookings').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setRows(data || []);
  };

  useEffect(() => { load(); }, [user, filter]);

  const openAdd = () => {
    const svc = SERVICES[0];
    setForm({ ...blankForm, service_code: svc.code, service_name: svc.name, price: String(svc.price) });
    setOpen(true);
  };
  const openEdit = (b: any) => {
    setForm({
      id: b.id, service_code: b.service_code || SERVICES[0].code, service_name: b.service_name || '',
      price: String(b.price || 0), name: b.name || '', phone: b.phone || '', wa_id: b.wa_id || '',
      booking_date: b.booking_date || '', booking_time: b.booking_time || '',
      address: b.address || '', landmark: b.landmark || '',
      transport_mode: b.transport_mode || '', transport_details: b.transport_details || '',
      status: b.status || 'confirmed', advance_amount: String(b.advance_amount || 0),
    });
    setOpen(true);
  };

  const onServiceChange = (code: string) => {
    const svc = SERVICES.find(s => s.code === code) || SERVICES[0];
    setForm({ ...form, service_code: code, service_name: svc.name, price: String(svc.price) });
  };

  const save = async () => {
    if (!user) return;
    if (!form.name || !form.wa_id) { toast.error('Customer name & WhatsApp number required'); return; }
    setSaving(true);
    try {
      const wa = form.wa_id.replace(/\D/g, '');
      const price = Number(form.price) || 0;
      const advance = Number(form.advance_amount) || 0;
      const payload: any = {
        user_id: user.id,
        service_code: form.service_code,
        service_name: form.service_name,
        price,
        advance_amount: advance,
        balance_amount: Math.max(0, price - advance),
        name: form.name,
        phone: form.phone || null,
        wa_id: wa,
        booking_date: form.booking_date || null,
        booking_time: form.booking_time || null,
        address: form.address || null,
        landmark: form.landmark || null,
        transport_mode: form.transport_mode || null,
        transport_details: form.transport_details || null,
        status: form.status,
        source: 'manual',
      };
      if (form.id) {
        const { error } = await supabase.from('tn_bookings').update(payload).eq('id', form.id);
        if (error) throw error;
        toast.success('Booking updated');
      } else {
        // upsert customer
        await supabase.from('tn_customers').upsert(
          { user_id: user.id, wa_id: wa, name: form.name, last_seen_at: new Date().toISOString() },
          { onConflict: 'user_id,wa_id' }
        );
        const { error } = await supabase.from('tn_bookings').insert(payload);
        if (error) throw error;
        toast.success('Booking created');
      }
      setOpen(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (b: any) => {
    if (!confirm('Delete this booking?')) return;
    const { error } = await supabase.from('tn_bookings').delete().eq('id', b.id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); load(); }
  };

  const updateStatus = async (b: any, status: string) => {
    const { error } = await supabase.from('tn_bookings').update({ status }).eq('id', b.id);
    if (error) toast.error(error.message); else { toast.success(`Status → ${status}`); load(); }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">Bookings</h1>
          <div className="flex gap-2 items-center flex-wrap">
            {['all', 'awaiting_payment', 'paid', 'confirmed', 'completed', 'cancelled'].map(s => (
              <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
                {s.replace('_', ' ')}
              </Button>
            ))}
            <Button onClick={openAdd}><Plus className="w-4 h-4" />New booking</Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">No bookings yet. Add manually or wait for WhatsApp flow submissions.</Card>
        ) : (
          <div className="space-y-3">
            {rows.map(b => (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">TN45-{b.id.slice(0, 8)}</span>
                      <Badge className={`${statusColor[b.status]} text-white`}>{b.status}</Badge>
                      {b.source && <Badge variant="outline" className="text-xs">{b.source}</Badge>}
                    </div>
                    <p className="font-semibold mt-1">{b.service_name} — ₹{b.price}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                      {b.name && <p>👤 <b>{b.name}</b></p>}
                      {b.phone && <p>📞 {b.phone}</p>}
                      {b.booking_date && <p>📅 {b.booking_date} {b.booking_time && `• ${b.booking_time}`}</p>}
                      {b.transport_mode && <p>🚉 {b.transport_mode} {b.transport_details && `• ${b.transport_details}`}</p>}
                      {b.address && <p className="col-span-2">📍 {b.address}{b.landmark ? ` (near ${b.landmark})` : ''}</p>}
                      <p className="text-muted-foreground">WA: {b.wa_id}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Advance ₹{b.advance_amount} • Balance ₹{b.balance_amount}</p>
                    <BookingTimeline history={b.status_history} notes={b.notes} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}><Edit3 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => remove(b)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    {b.status !== 'confirmed' && b.status !== 'cancelled' && (
                      <Button size="sm" onClick={() => updateStatus(b, 'confirmed')}>Confirm</Button>
                    )}
                    {b.status !== 'completed' && b.status === 'confirmed' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(b, 'completed')}>Complete</Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'New'} booking</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label>Service</Label>
              <Select value={form.service_code} onValueChange={onServiceChange}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{SERVICES.map(s => <SelectItem key={s.code} value={s.code}>{s.name} (₹{s.price})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (₹)</Label><Input type="number" className="mt-1.5" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Advance (₹)</Label><Input type="number" className="mt-1.5" value={form.advance_amount} onChange={e => setForm({ ...form, advance_amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Customer name *</Label><Input className="mt-1.5" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>WhatsApp no. *</Label><Input className="mt-1.5" placeholder="919XXXXXXXXX" value={form.wa_id} onChange={e => setForm({ ...form, wa_id: e.target.value })} /></div>
            </div>
            <div><Label>Phone (optional)</Label><Input className="mt-1.5" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" className="mt-1.5" value={form.booking_date} onChange={e => setForm({ ...form, booking_date: e.target.value })} /></div>
              <div><Label>Time</Label><Input type="time" className="mt-1.5" value={form.booking_time} onChange={e => setForm({ ...form, booking_time: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Textarea className="mt-1.5" rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Landmark</Label><Input className="mt-1.5" value={form.landmark} onChange={e => setForm({ ...form, landmark: e.target.value })} /></div>
              <div><Label>Transport</Label><Input className="mt-1.5" placeholder="Train / Bus / Flight" value={form.transport_mode} onChange={e => setForm({ ...form, transport_mode: e.target.value })} /></div>
            </div>
            <div><Label>Transport details</Label><Input className="mt-1.5" placeholder="Train no., PNR, terminal..." value={form.transport_details} onChange={e => setForm({ ...form, transport_details: e.target.value })} /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['draft', 'awaiting_payment', 'paid', 'confirmed', 'completed', 'cancelled'].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

const STATUS_ORDER = ['draft', 'awaiting_payment', 'paid', 'confirmed', 'completed'];
const BookingTimeline = ({ history, notes }: { history: any; notes?: string | null }) => {
  const arr: Array<{ status: string; at: string; note?: string }> = Array.isArray(history) ? history : [];
  if (arr.length === 0) return null;
  const latestByStatus: Record<string, string> = {};
  arr.forEach(h => { if (h?.status) latestByStatus[h.status] = h.at; });
  const reached = (s: string) => Boolean(latestByStatus[s]);
  return (
    <div className="mt-3 p-2.5 rounded-md bg-muted/40 border border-border/50">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">Status timeline</p>
      <div className="flex items-center gap-1 flex-wrap">
        {STATUS_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`flex flex-col items-center min-w-[78px]`}>
              <div className={`w-2.5 h-2.5 rounded-full ${reached(s) ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
              <span className={`text-[10px] mt-1 capitalize ${reached(s) ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {s.replace('_', ' ')}
              </span>
              {latestByStatus[s] && (
                <span className="text-[9px] text-muted-foreground">{new Date(latestByStatus[s]).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
            {i < STATUS_ORDER.length - 1 && <div className={`h-px w-4 ${reached(STATUS_ORDER[i + 1]) ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />}
          </div>
        ))}
      </div>
      {notes && <p className="text-[11px] text-red-500 mt-2">⚠ {notes}</p>}
    </div>
  );
};

export default TNBookings;

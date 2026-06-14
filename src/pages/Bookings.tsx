import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useAppointments } from '@/hooks/useAppointments';
import { useCustomers } from '@/hooks/useCustomers';
import { useServices } from '@/hooks/useServices';
import { useEmployees } from '@/hooks/useEmployees';
import { supabase } from '@/integrations/supabase/client';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CalendarDays, Plus, Loader2, Check, Clock, User, Scissors, Trash2, Edit3, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  booked: 'bg-risk-medium/20 text-risk-medium',
  completed: 'bg-risk-safe/20 text-risk-safe',
  cancelled: 'bg-risk-high/20 text-risk-high',
};

const Bookings = () => {
  const { user, profile } = useAuth();
  const { appointments, loading, refetch } = useAppointments();
  const { customers } = useCustomers();
  const { services } = useServices();
  const { employees } = useEmployees();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: '', service_id: '', employee_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '10:00', notes: '',
  });

  const resetForm = () => setForm({ customer_id: '', service_id: '', employee_id: '', appointment_date: new Date().toISOString().split('T')[0], appointment_time: '10:00', notes: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.customer_id || !form.service_id) {
      toast.error('Customer and service are required'); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('appointments').insert({
        user_id: user.id, customer_id: form.customer_id, service_id: form.service_id,
        employee_id: form.employee_id || null, appointment_date: form.appointment_date,
        appointment_time: form.appointment_time, notes: form.notes || null,
      });
      if (error) throw error;
      toast.success('Appointment created!');
      setAddOpen(false); resetForm(); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (apt: any) => {
    setEditingId(apt.id);
    setForm({
      customer_id: apt.customer_id || '', service_id: apt.service_id || '',
      employee_id: apt.employee_id || '', appointment_date: apt.appointment_date,
      appointment_time: apt.appointment_time, notes: apt.notes || '',
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('appointments').update({
        customer_id: form.customer_id || null, service_id: form.service_id || null,
        employee_id: form.employee_id || null, appointment_date: form.appointment_date,
        appointment_time: form.appointment_time, notes: form.notes || null,
      }).eq('id', editingId);
      if (error) throw error;
      toast.success('Appointment updated!');
      setEditOpen(false); resetForm(); setEditingId(null); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success(`Status updated to ${status}`); refetch(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this appointment?')) return;
    try {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Appointment deleted'); refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  const sendWhatsAppReminder = (apt: any) => {
    const salonName = profile?.store_name || 'Glamsup Salon';
    const message = `Hi ${apt.customer_name},\n\nReminder: Your appointment at ${salonName}\n📅 ${apt.appointment_date}\n⏰ ${apt.appointment_time}\n💇 ${apt.service_name || 'Service'}\n\nSee you soon! ✨`;
    const customer = customers.find(c => c.id === apt.customer_id);
    const phone = customer?.phone?.replace(/[^0-9]/g, '') || '';
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    else toast.error('No phone number for this customer');
  };

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  const formContent = (onSubmit: (e: React.FormEvent) => void, label: string) => (
    <form onSubmit={onSubmit} className="space-y-4 mt-4">
      <div><Label>Customer *</Label>
        <Select value={form.customer_id} onValueChange={v => setForm({...form, customer_id: v})}>
          <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select customer" /></SelectTrigger>
          <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Service *</Label>
        <Select value={form.service_id} onValueChange={v => setForm({...form, service_id: v})}>
          <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select service" /></SelectTrigger>
          <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Employee</Label>
        <Select value={form.employee_id} onValueChange={v => setForm({...form, employee_id: v})}>
          <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select employee" /></SelectTrigger>
          <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Date</Label><Input type="date" value={form.appointment_date} onChange={e => setForm({...form, appointment_date: e.target.value})} className="mt-1.5" /></div>
        <div><Label>Time</Label><Input type="time" value={form.appointment_time} onChange={e => setForm({...form, appointment_time: e.target.value})} className="mt-1.5" /></div>
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" className="flex-1" onClick={() => { setAddOpen(false); setEditOpen(false); resetForm(); }}>Cancel</Button>
        <Button type="submit" variant="trust" className="flex-1" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{label}
        </Button>
      </div>
    </form>
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Appointments</h1>
              <p className="text-muted-foreground">{appointments.length} bookings</p>
            </div>
          </div>
          <Button variant="trust" className="w-full sm:w-auto" onClick={() => { resetForm(); setAddOpen(true); }}><Plus className="w-5 h-5" />New Booking</Button>
        </div>

        {appointments.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <CalendarDays className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Appointments Yet</h3>
            <p className="text-muted-foreground mb-6">Create your first appointment booking.</p>
            <Button variant="trust" onClick={() => setAddOpen(true)}>New Booking</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt, index) => (
              <div key={apt.id} className="glass-card p-4 hover-lift animate-fade-up" style={{ animationDelay: `${index * 30}ms` }}>
                <div className="flex flex-col gap-3">
                  {/* Top row: avatar + info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-sm">{apt.customer_name || 'Customer'}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${statusColors[apt.status] || ''}`}>
                          {apt.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{apt.appointment_date} at {apt.appointment_time}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                        {apt.service_name && <span className="flex items-center gap-1"><Scissors className="w-3 h-3" />{apt.service_name}</span>}
                        {apt.employee_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{apt.employee_name}</span>}
                      </div>
                    </div>
                  </div>
                  {/* Bottom row: actions */}
                  <div className="flex items-center gap-1 flex-wrap pl-0 sm:pl-13">
                    {apt.status === 'booked' && (
                      <>
                        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => updateStatus(apt.id, 'completed')}>Done</Button>
                        <Button variant="ghost" size="sm" className="text-xs text-risk-high h-8" onClick={() => updateStatus(apt.id, 'cancelled')}>Cancel</Button>
                      </>
                    )}
                    <div className="flex gap-1 ml-auto">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-risk-safe" onClick={() => sendWhatsAppReminder(apt)}>
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(apt)}><Edit3 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-risk-high" onClick={() => handleDelete(apt.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary" />New Booking</DialogTitle></DialogHeader>
          {formContent(handleAdd, "Book")}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" />Edit Booking</DialogTitle></DialogHeader>
          {formContent(handleEdit, "Save")}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Bookings;

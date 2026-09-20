import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ClipboardList, Plus, Search, IndianRupee, Link2, Copy, MessageCircle, Clock, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export const RECORD_STATUSES = [
  'new', 'pending_payment', 'advance_paid', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled',
] as const;

const STATUS_LABEL: Record<string, string> = {
  new: 'New', pending_payment: 'Pending payment', advance_paid: 'Advance paid', confirmed: 'Confirmed',
  assigned: 'Assigned', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
};

const PAY_LABEL: Record<string, string> = {
  pending: 'Pending', link_sent: 'Link sent', paid: 'Paid', partially_paid: 'Partially paid',
  failed: 'Failed', refunded: 'Refunded',
};

const RECORD_TYPES = ['booking', 'order', 'appointment', 'service_request', 'application', 'enquiry', 'custom'];

type Rec = {
  id: string; record_code: string; record_type: string; title: string | null;
  customer_name: string; customer_phone: string | null; customer_email: string | null;
  status: string; payment_status: string; amount: number; advance_amount: number; paid_amount: number;
  service: string | null; scheduled_at: string | null; notes: string | null; assigned_to: string | null;
  created_at: string; conversation_id: string | null; source?: string | null;
  custom_fields?: Record<string, any> | null;
};

const FIELD_LABELS: Record<string, string> = {
  service: 'Service', name: 'Name', phone: 'Phone', booking_for: 'Booking for',
  passenger_name: 'Passenger name', passenger_phone: 'Passenger phone',
  transport_mode: 'Transport mode', transport_details: 'Service category',
  service_info: 'Service info', address: 'Reporting address', landmark: 'Nearest landmark',
  date: 'Date', time: 'Reporting time', hours: 'Expected hours/days', addons: 'Add-ons',
  status: 'Submission status',
};
const HIDDEN_FIELDS = new Set(['flow_token', 'flow_id', 'version', 'screen', '__version__']);
const fieldLabel = (k: string) => FIELD_LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const fieldValue = (v: any) => {
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x).replace(/_/g, ' ')).join(', ') : '—';
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const StatusPill = ({ value, map }: { value: string; map: Record<string, string> }) => (
  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-foreground/80">
    {map[value] || value}
  </span>
);

const Bookings = () => {
  const { user, profile } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    record_type: 'booking', title: '', customer_name: '', customer_phone: '', customer_email: '',
    service: '', scheduled_at: '', amount: '', advance_amount: '', notes: '',
  });

  const [active, setActive] = useState<Rec | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [linking, setLinking] = useState(false);

  const load = async (id: string) => {
    const { data, error } = await supabase
      .from('business_records' as any)
      .select('*').eq('workspace_id', id)
      .order('created_at', { ascending: false }).limit(300);
    if (error) toast.error(error.message);
    setRows(((data as any[]) || []) as Rec[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const id = await resolveWorkspaceId(user.id, profile);
      if (!id) { setLoading(false); return; }
      setWsId(id);
      await load(id);
    })();
  }, [user]);

  useEffect(() => {
    if (!wsId) return;
    const ch = supabase.channel(`records-${wsId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_records', filter: `workspace_id=eq.${wsId}` }, () => load(wsId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [r.record_code, r.customer_name, r.customer_phone, r.service, r.title]
      .some((v) => (v || '').toLowerCase().includes(s));
  }), [rows, q, statusFilter]);

  const totals = useMemo(() => ({
    count: filtered.length,
    revenue: filtered.reduce((s, r) => s + Number(r.paid_amount || 0), 0),
    pending: filtered.reduce((s, r) => s + Math.max(0, Number(r.amount || 0) - Number(r.paid_amount || 0)), 0),
  }), [filtered]);

  const create = async () => {
    if (!wsId) return;
    if (!form.customer_name.trim()) return toast.error('Customer name is required');
    setSaving(true);
    try {
      const prefix = form.record_type === 'order' ? 'OR' : form.record_type === 'appointment' ? 'AP' : 'BK';
      const { data: code, error: codeErr } = await supabase.rpc('next_record_code' as any, { _ws: wsId, _prefix: prefix });
      if (codeErr) throw codeErr;
      const payload = {
        workspace_id: wsId,
        record_code: code,
        record_type: form.record_type,
        title: form.title || null,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.replace(/\s/g, '') || null,
        customer_email: form.customer_email || null,
        service: form.service || null,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        amount: Number(form.amount || 0),
        advance_amount: Number(form.advance_amount || 0),
        notes: form.notes || null,
        source: 'manual',
        created_by: user?.id || null,
      };
      const { data: created, error } = await supabase.from('business_records' as any).insert(payload as any).select('*').single();
      if (error) throw error;
      await supabase.from('record_timeline' as any).insert({
        record_id: (created as any).id, workspace_id: wsId, event: 'record_created',
        detail: `${STATUS_LABEL.new} · ${(created as any).record_code}`,
        actor_id: user?.id || null, actor_name: profile?.full_name || profile?.email || null,
      } as any);
      toast.success(`${(created as any).record_code} created`);
      setOpen(false);
      setForm({ record_type: 'booking', title: '', customer_name: '', customer_phone: '', customer_email: '', service: '', scheduled_at: '', amount: '', advance_amount: '', notes: '' });
      load(wsId);
    } catch (e: any) { toast.error(e.message || 'Could not create the record'); }
    finally { setSaving(false); }
  };

  const changeStatus = async (r: Rec, status: string) => {
    const { error } = await supabase.from('business_records' as any)
      .update({ status, updated_at: new Date().toISOString() } as any).eq('id', r.id);
    if (error) return toast.error(error.message);
    await supabase.from('record_timeline' as any).insert({
      record_id: r.id, workspace_id: wsId, event: 'status_changed',
      detail: `${STATUS_LABEL[r.status] || r.status} → ${STATUS_LABEL[status] || status}`,
      actor_id: user?.id || null, actor_name: profile?.full_name || profile?.email || null,
    } as any);
    if (wsId) load(wsId);
    openRecord({ ...r, status });
  };

  const openRecord = async (r: Rec) => {
    setActive(r);
    const [{ data: tl }, { data: ps }] = await Promise.all([
      supabase.from('record_timeline' as any).select('*').eq('record_id', r.id).order('created_at', { ascending: false }),
      supabase.from('record_payments' as any).select('*').eq('record_id', r.id).order('created_at', { ascending: false }),
    ]);
    setTimeline((tl as any[]) || []);
    setPayments((ps as any[]) || []);
  };

  const createLink = async (kind: 'advance' | 'balance' | 'full') => {
    if (!active) return;
    setLinking(true);
    try {
      const amount = kind === 'advance' ? Number(active.advance_amount || 0)
        : kind === 'balance' ? Math.max(0, Number(active.amount || 0) - Number(active.paid_amount || 0))
        : Number(active.amount || 0);
      const { data, error } = await supabase.functions.invoke('record-payment-link', {
        body: { record_id: active.id, kind, amount },
      });
      if (error) throw new Error((error as any)?.context ? await (error as any).context.text() : error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Payment link created');
      await openRecord(active);
      if (wsId) load(wsId);
    } catch (e: any) { toast.error(e.message || 'Could not create the payment link'); }
    finally { setLinking(false); }
  };

  const sendLink = async (link: string) => {
    if (!active || !wsId || !active.customer_phone) return toast.error('No customer phone number on this record');
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          workspace_id: wsId, to: active.customer_phone.replace(/\D/g, ''),
          conversation_id: active.conversation_id || undefined,
          body: `Hi ${active.customer_name}, please complete your payment for ${active.record_code}: ${link}`,
        },
      });
      if (error) throw new Error((error as any)?.context ? await (error as any).context.text() : error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Sent on WhatsApp');
    } catch (e: any) { toast.error(e.message || 'Could not send the message'); }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" /> Bookings & Records
            </h1>
            <p className="text-sm text-muted-foreground">Bookings, orders, appointments and enquiries with payments and a full history.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> New record</Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4"><p className="text-xs text-muted-foreground">Records</p><p className="text-2xl font-bold">{totals.count}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Collected</p><p className="text-2xl font-bold">₹{totals.revenue.toLocaleString('en-IN')}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-2xl font-bold">₹{totals.pending.toLocaleString('en-IN')}</p></Card>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, customer, phone…" className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="glass-elevated divide-y divide-border/50">
          {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-10 text-center space-y-2">
              <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="font-medium">No records yet</p>
              <p className="text-sm text-muted-foreground">Create your first booking, or let WhatsApp forms create them automatically.</p>
              <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> New record</Button>
            </div>
          )}
          {filtered.map((r) => (
            <button key={r.id} onClick={() => openRecord(r)} className="w-full text-left flex items-center gap-3 p-4 hover:bg-muted/30">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{r.customer_name} <span className="text-muted-foreground font-mono text-xs">· {r.record_code}</span></p>
                <p className="text-xs text-muted-foreground truncate">
                  {[r.service || r.title, r.customer_phone, r.scheduled_at ? new Date(r.scheduled_at).toLocaleString('en-IN') : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1">
                <StatusPill value={r.status} map={STATUS_LABEL} />
                <StatusPill value={r.payment_status} map={PAY_LABEL} />
              </div>
              <div className="text-right w-24">
                <p className="font-semibold text-sm">₹{Number(r.amount || 0).toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-muted-foreground">₹{Number(r.paid_amount || 0).toLocaleString('en-IN')} paid</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Create */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New record</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.record_type} onValueChange={(v) => setForm({ ...form, record_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECORD_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Service / item</Label><Input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} /></div>
            </div>
            <div><Label>Customer name *</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="919876543210" /></div>
              <div><Label>Email</Label><Input value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Total amount (₹)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Advance (₹)</Label><Input type="number" value={form.advance_amount} onChange={(e) => setForm({ ...form, advance_amount: e.target.value })} /></div>
            </div>
            <div><Label>Scheduled for</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={create} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Sheet open={!!active} onOpenChange={(o) => { if (!o) setActive(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{active?.record_code}</SheetTitle></SheetHeader>
          {active && (
            <div className="mt-4 space-y-5">
              <div>
                <p className="font-semibold">{active.customer_name}</p>
                <p className="text-sm text-muted-foreground">{active.customer_phone || 'No phone'} {active.service ? `· ${active.service}` : ''}</p>
                {active.scheduled_at && <p className="text-sm text-muted-foreground">{new Date(active.scheduled_at).toLocaleString('en-IN')}</p>}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Card className="p-2"><p className="text-[11px] text-muted-foreground">Total</p><p className="font-semibold">₹{Number(active.amount || 0).toLocaleString('en-IN')}</p></Card>
                <Card className="p-2"><p className="text-[11px] text-muted-foreground">Advance</p><p className="font-semibold">₹{Number(active.advance_amount || 0).toLocaleString('en-IN')}</p></Card>
                <Card className="p-2"><p className="text-[11px] text-muted-foreground">Paid</p><p className="font-semibold">₹{Number(active.paid_amount || 0).toLocaleString('en-IN')}</p></Card>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={active.status} onValueChange={(v) => changeStatus(active, v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" /> Payments</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" disabled={linking} onClick={() => createLink('advance')}>
                    <Link2 className="w-3.5 h-3.5" /> Advance link
                  </Button>
                  <Button size="sm" variant="outline" disabled={linking} onClick={() => createLink('balance')}>
                    <Link2 className="w-3.5 h-3.5" /> Balance link
                  </Button>
                  <Button size="sm" variant="outline" disabled={linking} onClick={() => createLink('full')}>
                    <Link2 className="w-3.5 h-3.5" /> Full link
                  </Button>
                </div>
                {payments.length === 0 && <p className="text-xs text-muted-foreground">No payment requests yet.</p>}
                {payments.map((p) => (
                  <div key={p.id} className="glass-panel p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium capitalize">{p.kind} · ₹{Number(p.amount).toLocaleString('en-IN')}</span>
                      <StatusPill value={p.status} map={PAY_LABEL} />
                    </div>
                    {p.payment_link && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(p.payment_link); toast.success('Link copied'); }}>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => sendLink(p.payment_link)}>
                          <MessageCircle className="w-3.5 h-3.5" /> Send on WhatsApp
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {active.custom_fields && Object.keys(active.custom_fields).filter((k) => !HIDDEN_FIELDS.has(k)).length > 0 && (
                <div className="space-y-2">
                  <Label>Submitted details{active.source === 'whatsapp_flow' ? ' (WhatsApp form)' : ''}</Label>
                  <div className="glass-panel divide-y divide-border">
                    {Object.entries(active.custom_fields)
                      .filter(([k]) => !HIDDEN_FIELDS.has(k))
                      .map(([k, v]) => (
                        <div key={k} className="flex gap-3 px-3 py-2 text-sm">
                          <span className="text-muted-foreground min-w-[8rem] shrink-0">{fieldLabel(k)}</span>
                          <span className="font-medium break-words">{fieldValue(v)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Timeline</Label>
                {timeline.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
                {timeline.map((t) => (
                  <div key={t.id} className="text-xs border-l-2 border-border pl-3 py-1">
                    <p className="font-medium">{String(t.event).replace(/_/g, ' ')}</p>
                    {t.detail && <p className="text-muted-foreground">{t.detail}</p>}
                    <p className="text-muted-foreground/70">{new Date(t.created_at).toLocaleString('en-IN')}{t.actor_name ? ` · ${t.actor_name}` : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default Bookings;

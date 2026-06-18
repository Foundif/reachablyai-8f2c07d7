import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEmployees } from '@/hooks/useEmployees';
import { toast } from 'sonner';
import {
  ArrowLeft, Edit3, Trash2, MessageCircle, Phone, MapPin, Train, Bus, Car, Clock,
  Accessibility, BatteryCharging, Luggage, Copy, ChevronDown, ChevronUp, CheckCircle2,
  Circle, Loader2,
} from 'lucide-react';

const STATUS_ORDER = ['draft', 'awaiting_payment', 'paid', 'confirmed', 'completed'];
const statusColor: Record<string, string> = {
  draft: 'bg-gray-500', awaiting_payment: 'bg-orange-500', paid: 'bg-blue-500',
  confirmed: 'bg-green-600', completed: 'bg-emerald-600', cancelled: 'bg-red-500',
};

const ADDONS = [
  { key: 'wheelchair', label: 'Wheelchair', icon: Accessibility, price: '+₹50' },
  { key: 'battery_car', label: 'Battery Car', icon: BatteryCharging, price: 'Actuals' },
  { key: 'porter', label: 'Porter', icon: Luggage, price: 'Actuals' },
];

const BookingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { employees } = useEmployees();
  const [b, setB] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showJson, setShowJson] = useState(false);
  const [note, setNote] = useState('');
  const [txnId, setTxnId] = useState('');
  const [helperId, setHelperId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user || !id) return;
    setLoading(true);
    const { data, error } = await supabase.from('tn_bookings').select('*').eq('id', id).maybeSingle();
    if (error) toast.error(error.message);
    setB(data);
    if (data) {
      setTxnId((data.details as any)?.txn_id || '');
      setHelperId((data.details as any)?.helper_id || '');
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, id]);

  if (loading) return <AppLayout><div className="p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div></AppLayout>;
  if (!b) return <AppLayout><div className="p-8 text-center text-muted-foreground">Booking not found.</div></AppLayout>;

  const addonsArr: string[] = Array.isArray(b.addons) ? b.addons.map((a: any) => typeof a === 'string' ? a : a?.key || '').filter(Boolean) : [];
  const details: any = b.details && typeof b.details === 'object' ? b.details : {};
  const notesHistory: Array<{ at: string; by?: string; text: string }> = Array.isArray(details.admin_notes) ? details.admin_notes : [];
  const statusHistory: Array<{ status: string; at: string; note?: string }> = Array.isArray(b.status_history) ? b.status_history : [];
  const latestByStatus: Record<string, string> = {};
  statusHistory.forEach(h => { if (h?.status) latestByStatus[h.status] = h.at; });
  const headerGradient = b.status === 'confirmed' || b.status === 'completed'
    ? 'from-emerald-500/20 via-emerald-400/10 to-transparent border-emerald-500/30'
    : b.status === 'awaiting_payment'
      ? 'from-amber-500/20 via-amber-400/10 to-transparent border-amber-500/30'
      : 'from-primary/15 via-secondary/10 to-transparent border-primary/20';

  const transportIcon = b.transport_mode?.toLowerCase().includes('train') ? Train
    : b.transport_mode?.toLowerCase().includes('bus') ? Bus : Car;
  const transportColor = b.transport_mode?.toLowerCase().includes('train') ? 'bg-blue-500'
    : b.transport_mode?.toLowerCase().includes('bus') ? 'bg-orange-500' : 'bg-gray-500';
  const TIcon = transportIcon;

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from('tn_bookings').update({ status }).eq('id', b.id);
    if (error) toast.error(error.message); else { toast.success(`Status → ${status.replace('_',' ')}`); load(); }
  };

  const remove = async () => {
    if (!confirm('Delete this booking?')) return;
    const { error } = await supabase.from('tn_bookings').delete().eq('id', b.id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); navigate('/bookings'); }
  };

  const saveDetailsPatch = async (patch: any, successMsg: string) => {
    setSaving(true);
    const next = { ...details, ...patch };
    const { error } = await supabase.from('tn_bookings').update({ details: next }).eq('id', b.id);
    if (error) toast.error(error.message); else { toast.success(successMsg); await load(); }
    setSaving(false);
  };

  const addNote = async () => {
    if (!note.trim()) return;
    const entry = { at: new Date().toISOString(), by: profile?.full_name || user?.email || 'admin', text: note.trim() };
    await saveDetailsPatch({ admin_notes: [...notesHistory, entry] }, 'Note added');
    setNote('');
  };

  const assignHelper = async (eid: string) => {
    setHelperId(eid);
    const emp = employees.find(e => e.id === eid);
    await saveDetailsPatch({ helper_id: eid, helper_name: emp?.name || null }, `Helper ${emp?.name || ''} assigned`);
  };

  const sendWhatsAppUpdate = () => {
    const msg = `Hi ${b.name},\n\nBooking ${`TN45-${b.id.slice(0,8)}`} update:\nService: ${b.service_name}\nDate: ${b.booking_date || '-'} ${b.booking_time || ''}\nStatus: ${b.status}\nBalance: ₹${b.balance_amount}\n\nThank you!`;
    const wa = String(b.wa_id || '').replace(/\D/g, '');
    if (!wa) { toast.error('No WhatsApp number'); return; }
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const mapAddress = encodeURIComponent([b.address, b.landmark].filter(Boolean).join(', '));

  return (
    <AppLayout>
      {/* Top nav */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="flex items-center justify-between px-4 md:px-8 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/bookings')}><ArrowLeft className="w-4 h-4" />Back</Button>
          <span className="font-mono text-sm">TN45-{b.id.slice(0, 8)}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(`/bookings?edit=${b.id}`)}><Edit3 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={remove}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-6 pb-32">
        {/* Page header card */}
        <Card className={`relative p-5 md:p-6 bg-gradient-to-br ${headerGradient} border`}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold break-words">{b.service_name}</h1>
              <Badge variant="outline" className="mt-1 font-mono text-[10px]">{b.service_code}</Badge>
            </div>
            <Badge className={`${statusColor[b.status]} text-white capitalize`}>{b.status.replace('_',' ')}</Badge>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="px-3 py-1.5 rounded-full bg-background/60 border border-border text-xs font-medium">💰 Total ₹{b.price}</span>
            <span className="px-3 py-1.5 rounded-full bg-background/60 border border-border text-xs font-medium">💳 Advance ₹{b.advance_amount}</span>
            <span className="px-3 py-1.5 rounded-full bg-background/60 border border-border text-xs font-medium">🔄 Balance ₹{b.balance_amount}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Created {new Date(b.created_at).toLocaleString()} • Updated {new Date(b.updated_at).toLocaleString()}
          </p>
        </Card>

        {/* 2-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-5">
            <Card className="p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">👤 Customer Info</h2>
              <p className="text-lg font-bold">{b.name}</p>
              <div className="mt-3 space-y-2 text-sm">
                {b.wa_id && (
                  <a href={`https://wa.me/${String(b.wa_id).replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-emerald-500 hover:underline">
                    <MessageCircle className="w-4 h-4" /> {b.wa_id}
                  </a>
                )}
                {b.phone && (
                  <a href={`tel:${b.phone}`} className="flex items-center gap-2 text-foreground hover:underline">
                    <Phone className="w-4 h-4" /> {b.phone}
                  </a>
                )}
                {details.trigger_keyword && (
                  <p className="text-muted-foreground">Trigger: <span className="font-mono text-foreground">{details.trigger_keyword}</span></p>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">📅 Schedule & Location</h2>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[10px] uppercase text-muted-foreground">Date</p><p className="text-lg font-semibold">{b.booking_date || '—'}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Time</p><p className="text-lg font-semibold">{b.booking_time || '—'}</p></div>
              </div>
              {b.address && <div className="mt-3 p-3 rounded-md bg-muted/50 text-sm">{b.address}</div>}
              {b.landmark && <p className="text-sm mt-2 flex items-center gap-1.5 text-muted-foreground"><MapPin className="w-3.5 h-3.5" />{b.landmark}</p>}
              {b.address && (
                <iframe
                  title="map"
                  className="w-full h-48 rounded-md border border-border mt-3"
                  loading="lazy"
                  src={`https://www.google.com/maps?q=${mapAddress}&output=embed`}
                />
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">🚌 Transport Details</h2>
              {b.transport_mode ? (
                <div className="flex items-center gap-3">
                  <Badge className={`${transportColor} text-white capitalize`}><TIcon className="w-3 h-3 mr-1" />{b.transport_mode}</Badge>
                  <p className="font-semibold">{b.transport_details || '—'}</p>
                </div>
              ) : <p className="text-sm text-muted-foreground">No transport details provided.</p>}
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">➕ Add-ons & Duration</h2>
              <div className="flex flex-wrap gap-2">
                {ADDONS.map(a => {
                  const active = addonsArr.includes(a.key);
                  const AIcon = a.icon;
                  return (
                    <span key={a.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${active ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500' : 'bg-muted/40 border-border text-muted-foreground'}`}>
                      <AIcon className="w-3.5 h-3.5" /> {a.label} <span className="opacity-70">({a.price})</span>
                    </span>
                  );
                })}
              </div>
              {b.expected_hours && (
                <p className="text-sm mt-3 flex items-center gap-1.5"><Clock className="w-4 h-4" />Expected Hours: <b>{b.expected_hours}</b></p>
              )}
              {details.after_hours_surcharge && <p className="text-xs mt-1 text-amber-500">⚠ After-hours surcharge applies</p>}
            </Card>

            <Card className="p-5">
              <button onClick={() => setShowJson(s => !s)} className="w-full flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">📋 Flow Submission Data</h2>
                {showJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showJson && (
                <div className="mt-3">
                  <div className="flex justify-end mb-2">
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(details, null, 2)); toast.success('Copied'); }}>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </Button>
                  </div>
                  <pre className="text-[11px] bg-muted/50 p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(details, null, 2)}</pre>
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT */}
          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">🕒 Status Timeline</h2>
              <div className="space-y-3">
                {STATUS_ORDER.map((s) => {
                  const reached = !!latestByStatus[s];
                  const active = b.status === s;
                  return (
                    <div key={s} className="flex items-start gap-3">
                      {reached
                        ? <CheckCircle2 className={`w-5 h-5 mt-0.5 ${active ? 'text-primary animate-pulse' : 'text-emerald-500'}`} />
                        : <Circle className="w-5 h-5 mt-0.5 text-muted-foreground/40" />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm capitalize ${reached ? 'font-medium' : 'text-muted-foreground'}`}>{s.replace('_', ' ')}</p>
                        {latestByStatus[s] && <p className="text-[11px] text-muted-foreground">{new Date(latestByStatus[s]).toLocaleString()}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">💰 Payment Summary</h2>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="capitalize">{details.payment_method || 'UPI'}</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Advance</span><span>₹{b.advance_amount} {Number(b.advance_amount) > 0 ? '✅' : '⏳'}</span></div>
                <div className="flex justify-between"><span>Balance</span><span>₹{b.balance_amount} <span className="text-muted-foreground text-xs">(after service)</span></span></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>UPI ID</span><span className="font-mono">9486642242@kvb</span></div>
              </div>
              <div className="mt-3">
                <label className="text-[10px] uppercase text-muted-foreground">Transaction ID</label>
                <div className="flex gap-2 mt-1">
                  <Input value={txnId} onChange={e => setTxnId(e.target.value)} placeholder="UPI Ref / TXN" />
                  <Button size="sm" disabled={saving} onClick={() => saveDetailsPatch({ txn_id: txnId }, 'Saved')}>Save</Button>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">👷 Helper Assignment</h2>
              <p className="text-sm mb-2">{details.helper_name ? <b>{details.helper_name}</b> : <span className="text-muted-foreground">Not yet assigned</span>}</p>
              <Select value={helperId} onValueChange={assignHelper}>
                <SelectTrigger><SelectValue placeholder="Assign helper" /></SelectTrigger>
                <SelectContent>
                  {employees.length === 0 && <SelectItem disabled value="none">No helpers</SelectItem>}
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-2">Helper assigned 1 hour before service.</p>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">🗒️ Admin Notes</h2>
              <Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Internal note..." />
              <Button size="sm" className="mt-2 w-full" disabled={saving || !note.trim()} onClick={addNote}>Save Note</Button>
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {notesHistory.slice().reverse().map((n, i) => (
                  <div key={i} className="p-2 rounded-md bg-muted/40 text-xs">
                    <p>{n.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{n.by} • {new Date(n.at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[260px] z-30 backdrop-blur-md bg-background/90 border-t border-border p-3">
        <div className="max-w-[1600px] mx-auto flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" className="text-red-500" onClick={() => updateStatus('cancelled')}>🔴 Cancel</Button>
          <Button variant="outline" size="sm" className="text-amber-500" onClick={() => updateStatus('awaiting_payment')}>🟡 Awaiting Payment</Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatus('confirmed')}>🟢 Confirm</Button>
          <Button size="sm" variant="default" onClick={sendWhatsAppUpdate}>📲 WhatsApp Update</Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default BookingDetail;

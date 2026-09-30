import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Wallet, Pencil, Trash2, X, CloudOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { toast } from 'sonner';

type AddOn = { name: string; price: number };
type Service = {
  id?: string;
  name: string;
  category: string;
  description: string;
  base_price: number;
  price_unit: string;
  advance_amount: number;
  duration_minutes: number | null;
  add_ons: AddOn[];
  is_active: boolean;
};

const empty: Service = {
  name: '', category: 'General', description: '', base_price: 0, price_unit: 'per booking',
  advance_amount: 0, duration_minutes: null, add_ons: [], is_active: true,
};

const db = supabase as any;
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const Services = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [edit, setEdit] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [wsId, setWsId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const ws = user ? await resolveWorkspaceId(user.id) : null;
      setWsId(ws);
      const { data, error } = await db.from('services').select('*').order('category').order('name');
      if (error) throw error;
      setItems((data || []).map((s: any) => ({ ...empty, ...s, add_ons: Array.isArray(s.add_ons) ? s.add_ons : [] })));
      setOffline(false);
    } catch {
      setOffline(true);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user?.id]);

  const cats = useMemo(() => ['All', ...Array.from(new Set(items.map((i) => i.category || 'General')))], [items]);
  const shown = items.filter((i) => (cat === 'All' || i.category === cat) && i.name.toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    if (!edit || !edit.name.trim()) { toast.error('Service name is required'); return; }
    setSaving(true);
    const payload = { ...edit, workspace_id: wsId, add_ons: edit.add_ons.filter((a) => a.name.trim()) };
    const res = edit.id
      ? await db.from('services').update(payload).eq('id', edit.id)
      : await db.from('services').insert(payload);
    setSaving(false);
    if (res.error) { toast.error('Could not save — the database is offline right now'); return; }
    toast.success('Service saved');
    setEdit(null); load();
  };

  const remove = async (s: Service) => {
    if (!s.id || !confirm(`Delete "${s.name}"?`)) return;
    const { error } = await db.from('services').delete().eq('id', s.id);
    if (error) { toast.error('Could not delete'); return; }
    load();
  };

  const toggle = async (s: Service) => {
    if (!s.id) return;
    setItems((prev) => prev.map((i) => (i.id === s.id ? { ...i, is_active: !i.is_active } : i)));
    const { error } = await db.from('services').update({ is_active: !s.is_active }).eq('id', s.id);
    if (error) { toast.error('Could not update'); load(); }
  };

  const setAddOn = (idx: number, patch: Partial<AddOn>) =>
    setEdit((e) => e && ({ ...e, add_ons: e.add_ons.map((a, i) => (i === idx ? { ...a, ...patch } : a)) }));

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Wallet className="w-6 h-6 text-primary" /> Services & Tariff
            </h1>
            <p className="text-sm text-muted-foreground">Your price list — used to fill prices and advance amounts in bookings.</p>
          </div>
          <Button onClick={() => setEdit({ ...empty })}><Plus className="w-4 h-4" /> Add service</Button>
        </div>

        {offline && (
          <div className="glass-elevated p-4 flex items-start gap-3 text-sm">
            <CloudOff className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-muted-foreground">Your services can't be loaded right now because the database is offline. Everything will appear here once it's back.</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services" className="pl-9" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {cats.map((c) => (
              <Button key={c} size="sm" variant={cat === c ? 'default' : 'outline'} onClick={() => setCat(c)} className="shrink-0">{c}</Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-36 rounded-2xl bg-muted/40 animate-pulse" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="glass-elevated p-10 text-center text-sm text-muted-foreground">
            {offline ? 'No services to show yet.' : 'No services yet. Add your first service and its price.'}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((s) => (
              <div key={s.id} className="glass-elevated p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.category}</p>
                  </div>
                  <Switch checked={s.is_active} onCheckedChange={() => toggle(s)} />
                </div>
                {s.description && <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span><b>{inr(s.base_price)}</b> <span className="text-muted-foreground">{s.price_unit}</span></span>
                  <span className="text-muted-foreground">Advance {inr(s.advance_amount)}</span>
                  {s.duration_minutes ? <span className="text-muted-foreground">{s.duration_minutes} min</span> : null}
                </div>
                {s.add_ons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {s.add_ons.map((a, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-muted">{a.name} +{inr(a.price)}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEdit({ ...s })}><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s)}><Trash2 className="w-3.5 h-3.5" /> Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit service' : 'Add service'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Category</Label><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Price (₹)</Label><Input type="number" min={0} value={edit.base_price} onChange={(e) => setEdit({ ...edit, base_price: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Price unit</Label><Input value={edit.price_unit} onChange={(e) => setEdit({ ...edit, price_unit: e.target.value })} placeholder="per hour, per trip…" /></div>
                <div className="space-y-1.5"><Label>Advance (₹)</Label><Input type="number" min={0} value={edit.advance_amount} onChange={(e) => setEdit({ ...edit, advance_amount: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Duration (min)</Label><Input type="number" min={0} value={edit.duration_minutes ?? ''} onChange={(e) => setEdit({ ...edit, duration_minutes: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Add-ons</Label>
                  <Button size="sm" variant="outline" onClick={() => setEdit({ ...edit, add_ons: [...edit.add_ons, { name: '', price: 0 }] })}><Plus className="w-3.5 h-3.5" /> Add</Button>
                </div>
                {edit.add_ons.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Add-on name" value={a.name} onChange={(e) => setAddOn(i, { name: e.target.value })} />
                    <Input type="number" className="w-28" value={a.price} onChange={(e) => setAddOn(i, { price: Number(e.target.value) })} />
                    <Button size="icon" variant="ghost" onClick={() => setEdit({ ...edit, add_ons: edit.add_ons.filter((_, j) => j !== i) })}><X className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2"><Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /><Label>Active (shown to customers)</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save service'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Services;

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, Plus, Edit3, Trash2, Loader2, Check, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const formatWhatsAppPhone = (waId: string) => {
  const digits = String(waId || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return waId?.startsWith('+') ? waId : `+${waId}`;
};

const blankForm = { id: '', name: '', wa_id: '', notes: '' };

const TNCustomers = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tn_customers')
      .select('*')
      .eq('user_id', user.id)
      .order('last_seen_at', { ascending: false });
    setRows(data || []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`customers-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tn_customers', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const openAdd = () => { setForm(blankForm); setOpen(true); };
  const openEdit = (c: any) => { setForm({ id: c.id, name: c.name || '', wa_id: c.wa_id || '', notes: c.notes || '' }); setOpen(true); };

  const save = async () => {
    if (!user) return;
    const wa = form.wa_id.replace(/\D/g, '');
    if (!wa) { toast.error('WhatsApp number is required'); return; }
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from('tn_customers')
          .update({ name: form.name || null, wa_id: wa, notes: form.notes || null })
          .eq('id', form.id);
        if (error) throw error;
        toast.success('Customer updated');
      } else {
        const { error } = await supabase.from('tn_customers').insert({
          user_id: user.id, wa_id: wa, name: form.name || null, notes: form.notes || null,
          last_seen_at: new Date().toISOString(),
        });
        if (error) throw error;
        toast.success('Customer added');
      }
      setOpen(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (c: any) => {
    if (!confirm(`Delete ${c.name || c.wa_id}?`)) return;
    const { error } = await supabase.from('tn_customers').delete().eq('id', c.id);
    if (error) toast.error(error.message); else { toast.success('Customer deleted'); load(); }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-bold">Customers</h1>
          <Button onClick={openAdd}><Plus className="w-4 h-4" />Add customer</Button>
        </div>
        {rows.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            No customers yet. Add one manually or wait for WhatsApp messages.
          </Card>
        ) : rows.map(c => (
          <Card key={c.id} className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {c.avatar_url ? (
                <img src={c.avatar_url} alt={c.name || c.wa_id} className="w-10 h-10 rounded-full object-cover bg-muted border border-border" loading="lazy" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold truncate">{c.name || 'Unnamed'}</p>
                <p className="text-sm text-muted-foreground truncate">{formatWhatsAppPhone(c.wa_id)}</p>
                {c.notes && <p className="text-xs text-muted-foreground truncate">{c.notes}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground mr-2 hidden sm:block">{new Date(c.last_seen_at).toLocaleDateString()}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Edit3 className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => remove(c)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'Add'} customer</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label>Name</Label><Input className="mt-1.5" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>WhatsApp number (with country code)</Label><Input className="mt-1.5" placeholder="919XXXXXXXXX" value={form.wa_id} onChange={e => setForm({ ...form, wa_id: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea className="mt-1.5" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
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

export default TNCustomers;

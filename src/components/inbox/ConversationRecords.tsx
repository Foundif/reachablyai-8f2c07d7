import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardList, Plus, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type Props = {
  workspaceId: string | null | undefined;
  conversationId: string;
  contactPhone: string;
  contactName?: string | null;
};

/** Bookings/records attached to a conversation, with timeline and quick creation. */
const ConversationRecords = ({ workspaceId, conversationId, contactPhone, contactName }: Props) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ service: '', amount: '', advance_amount: '', scheduled_at: '' });

  const load = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from('business_records' as any)
      .select('*')
      .eq('workspace_id', workspaceId)
      .or(`conversation_id.eq.${conversationId},customer_phone.eq.${contactPhone}`)
      .order('created_at', { ascending: false })
      .limit(10);
    const list = (data as any[]) || [];
    setRows(list);
    if (list.length) {
      const { data: tl } = await supabase
        .from('record_timeline' as any)
        .select('*')
        .in('record_id', list.map((r) => r.id))
        .order('created_at', { ascending: false })
        .limit(8);
      setEvents((tl as any[]) || []);
    } else setEvents([]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspaceId, conversationId, contactPhone]);

  const create = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const { data: code, error: codeErr } = await supabase.rpc('next_record_code' as any, { _ws: workspaceId, _prefix: 'BK' });
      if (codeErr) throw codeErr;
      const { data: created, error } = await supabase.from('business_records' as any).insert({
        workspace_id: workspaceId,
        record_code: code,
        record_type: 'booking',
        customer_name: contactName || contactPhone,
        customer_phone: contactPhone,
        conversation_id: conversationId,
        service: form.service || null,
        amount: Number(form.amount || 0),
        advance_amount: Number(form.advance_amount || 0),
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        source: 'inbox',
        created_by: user?.id || null,
      } as any).select('*').single();
      if (error) throw error;
      await supabase.from('record_timeline' as any).insert({
        record_id: (created as any).id, workspace_id: workspaceId, event: 'record_created',
        detail: `Created from chat · ${(created as any).record_code}`,
        actor_id: user?.id || null, actor_name: profile?.full_name || profile?.email || null,
      } as any);
      toast.success(`${(created as any).record_code} created`);
      setOpen(false);
      setForm({ service: '', amount: '', advance_amount: '', scheduled_at: '' });
      load();
    } catch (e: any) { toast.error(e.message || 'Could not create the booking'); }
    finally { setSaving(false); }
  };

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-medium flex items-center gap-1.5"><ClipboardList className="w-3 h-3" /> Bookings</div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setOpen(true)}>
          <Plus className="w-3 h-3" /> New
        </Button>
      </div>

      {rows.length === 0 && <p className="text-[11px] text-muted-foreground">No bookings for this contact yet.</p>}
      <div className="space-y-1.5">
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => navigate('/bookings')}
            className="w-full text-left rounded-lg border p-2 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px]">{r.record_code}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{String(r.status).replace(/_/g, ' ')}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {[r.service, `₹${Number(r.amount || 0).toLocaleString('en-IN')}`, `₹${Number(r.paid_amount || 0).toLocaleString('en-IN')} paid`].filter(Boolean).join(' · ')}
            </div>
          </button>
        ))}
      </div>

      {events.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Activity</div>
          <div className="space-y-1">
            {events.map((e) => (
              <div key={e.id} className="text-[11px] border-l-2 border-border pl-2">
                <span className="font-medium">{String(e.event).replace(/_/g, ' ')}</span>
                {e.detail && <span className="text-muted-foreground"> · {e.detail}</span>}
                <div className="text-muted-foreground/70">{new Date(e.created_at).toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New booking for {contactName || contactPhone}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Service / item</Label><Input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Total (₹)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Advance (₹)</Label><Input type="number" value={form.advance_amount} onChange={(e) => setForm({ ...form, advance_amount: e.target.value })} /></div>
            </div>
            <div><Label>Scheduled for</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={create} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConversationRecords;

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';

type Ticket = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  resolution_note: string | null;
  created_at: string;
  submitter: { full_name?: string | null; email?: string | null; store_name?: string | null } | null;
};

type Message = { id: string; author_role: string; body: string; created_at: string };

const STATUSES = ['submitted', 'reviewing', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const AdminFeedbackPanel = ({ apiCall }: { apiCall: (action: string, extra?: Record<string, any>) => Promise<any> }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall('list_feedback');
      setTickets(res.tickets || []);
    } catch (e: any) {
      toast.error(e.message || 'Could not load tickets');
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  const openTicket = async (ticket: Ticket) => {
    setSelected(ticket);
    setReply('');
    setMessages([]);
    setScreenshots([]);
    try {
      const res = await apiCall('feedback_thread', { ticket_id: ticket.id });
      setSelected({ ...ticket, ...res.ticket, submitter: ticket.submitter });
      setMessages(res.messages || []);
      setScreenshots(res.screenshots || []);
      setNote(res.ticket?.resolution_note || '');
    } catch (e: any) {
      toast.error(e.message || 'Could not open ticket');
    }
  };

  const update = async (extra: Record<string, any>) => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiCall('update_feedback', { ticket_id: selected.id, ...extra });
      setSelected({ ...selected, ...extra } as Ticket);
      toast.success('Ticket updated');
      void loadTickets();
    } catch (e: any) {
      toast.error(e.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!selected || reply.trim().length < 1) return;
    setBusy(true);
    try {
      await apiCall('reply_feedback', { ticket_id: selected.id, message: reply.trim() });
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), author_role: 'admin', body: reply.trim(), created_at: new Date().toISOString(),
      }]);
      setReply('');
      toast.success('Reply sent');
    } catch (e: any) {
      toast.error(e.message || 'Reply failed');
    } finally {
      setBusy(false);
    }
  };

  const visible = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-4">
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm flex-1">Feedback tickets</h3>
          <Button variant="ghost" size="icon" onClick={loadTickets}><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <div className="p-3 border-b border-border">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : visible.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No tickets here yet.</p>
          ) : visible.map((t) => (
            <button
              key={t.id}
              onClick={() => openTicket(t)}
              className={`w-full text-left px-4 py-3 border-b border-border/60 hover:bg-muted/40 ${selected?.id === t.id ? 'bg-muted/60' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate flex-1">{t.title}</span>
                <Badge variant="outline" className="text-[10px]">{t.status.replace('_', ' ')}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {t.submitter?.full_name || t.submitter?.email || 'Unknown'} · {t.category} · {new Date(t.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {!selected ? (
          <p className="p-10 text-sm text-muted-foreground text-center">Select a ticket to read and reply.</p>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold">{selected.title}</h3>
              <p className="text-xs text-muted-foreground">
                {selected.submitter?.full_name || '—'} · {selected.submitter?.email || '—'}
                {selected.submitter?.store_name ? ` · ${selected.submitter.store_name}` : ''}
              </p>
            </div>

            <p className="text-sm whitespace-pre-wrap rounded-md border p-3 bg-muted/30">{selected.description}</p>

            {screenshots.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {screenshots.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="Screenshot" className="w-28 h-28 object-cover rounded-lg border" />
                  </a>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={selected.status} onValueChange={(v) => update({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={selected.priority || 'normal'} onValueChange={(v) => update({ priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Resolution note (shown to the customer)</Label>
              <div className="flex gap-2">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Fixed in today's release" />
                <Button variant="outline" disabled={busy} onClick={() => update({ resolution_note: note })}>Save</Button>
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <p className="text-sm font-semibold">Conversation</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {messages.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.author_role === 'admin' ? 'bg-primary/10 ml-8' : 'bg-muted mr-8'}`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {m.author_role === 'admin' ? 'You' : 'Customer'} · {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
              <Button onClick={sendReply} disabled={busy || !reply.trim()} className="gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send reply
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFeedbackPanel;

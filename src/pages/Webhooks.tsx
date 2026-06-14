import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Webhook as WebhookIcon, Plus, Trash2, Activity } from 'lucide-react';
import { toast } from 'sonner';

type Hook = { id: string; url: string; events: string[]; active: boolean; createdAt: string };
const STORAGE = 'foundif_webhooks';
const EVENTS = ['message.received', 'message.sent', 'campaign.completed', 'flow.triggered', 'booking.created', 'payment.received'];

const Webhooks = () => {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [evs, setEvs] = useState<string[]>([]);

  useEffect(() => { setHooks(JSON.parse(localStorage.getItem(STORAGE) || '[]')); }, []);
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(hooks)); }, [hooks]);

  const save = () => {
    if (!url || evs.length === 0) return toast.error('URL and at least 1 event required');
    setHooks((h) => [{ id: crypto.randomUUID(), url, events: evs, active: true, createdAt: new Date().toISOString() }, ...h]);
    toast.success('Webhook created'); setOpen(false); setUrl(''); setEvs([]);
  };
  const toggle = (id: string) => setHooks((h) => h.map((x) => x.id === id ? { ...x, active: !x.active } : x));
  const remove = (id: string) => { setHooks((h) => h.filter((x) => x.id !== id)); toast.success('Removed'); };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <WebhookIcon className="w-6 h-6 text-primary" /> Webhooks
            </h1>
            <p className="text-sm text-muted-foreground">Receive real-time events at your HTTPS endpoint.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> Add webhook</Button>
        </div>

        <div className="glass-elevated divide-y divide-border/50">
          {hooks.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No webhooks configured.</div>}
          {hooks.map((h) => (
            <div key={h.id} className="p-4 flex items-center gap-3 flex-wrap">
              <Activity className={`w-4 h-4 ${h.active ? 'text-emerald-500' : 'text-muted-foreground'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs truncate">{h.url}</p>
                <div className="flex gap-1 flex-wrap mt-1">
                  {h.events.map((e) => <span key={e} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{e}</span>)}
                </div>
              </div>
              <Switch checked={h.active} onCheckedChange={() => toggle(h.id)} />
              <Button variant="ghost" size="icon" onClick={() => remove(h.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New webhook</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Endpoint URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourapp.com/webhooks/foundif" /></div>
              <div>
                <Label>Events</Label>
                <div className="space-y-1.5 mt-2">
                  {EVENTS.map((e) => (
                    <label key={e} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={evs.includes(e)} onChange={() => setEvs((s) => s.includes(e) ? s.filter((x) => x !== e) : [...s, e])} />
                      <code className="text-xs">{e}</code>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Create webhook</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};
export default Webhooks;

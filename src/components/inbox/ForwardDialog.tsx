import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Forward, Loader2 } from 'lucide-react';

export interface ForwardTarget { id: string; contact_phone: string; contact_name: string | null }

/** WhatsApp-style "Forward to…" chat picker. */
export default function ForwardDialog({
  open, onOpenChange, targets, count, sending, onForward,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targets: ForwardTarget[];
  count: number;
  sending: boolean;
  onForward: (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const list = useMemo(() => targets.filter(t =>
    `${t.contact_name || ''} ${t.contact_phone}`.toLowerCase().includes(q.toLowerCase())), [targets, q]);

  const toggle = (id: string) =>
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!sending) { onOpenChange(v); if (!v) { setPicked([]); setQ(''); } } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forward {count} {count === 1 ? 'message' : 'messages'}</DialogTitle>
          <DialogDescription>Pick the chats to forward to. Only chats inside their 24-hour window can receive them.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search chats…" className="pl-9" />
        </div>

        <div className="max-h-64 overflow-y-auto -mx-2 px-2 space-y-1">
          {list.map(t => (
            <label key={t.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
              <Checkbox checked={picked.includes(t.id)} onCheckedChange={() => toggle(t.id)} />
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 grid place-items-center text-white text-xs font-bold">
                {(t.contact_name || t.contact_phone)[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm truncate">{t.contact_name || t.contact_phone}</div>
                <div className="text-[11px] text-muted-foreground truncate">{t.contact_phone}</div>
              </div>
            </label>
          ))}
          {!list.length && <p className="text-sm text-muted-foreground p-2">No chats found.</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!picked.length || sending} onClick={() => onForward(picked)}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Forward className="w-4 h-4 mr-2" />}
            Forward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

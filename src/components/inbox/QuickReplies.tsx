import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Zap, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type QuickReply = { id: string; shortcut: string; text: string };

const DEFAULTS: QuickReply[] = [
  { id: 'd1', shortcut: 'hi', text: 'Hi! Thanks for reaching out. How can we help you today?' },
  { id: 'd2', shortcut: 'price', text: 'Here is our price list. Let us know which service you would like to book.' },
  { id: 'd3', shortcut: 'slot', text: 'Please share your preferred date and time, and we will confirm the slot.' },
  { id: 'd4', shortcut: 'pay', text: 'You can pay the advance using the payment link we share. Thank you!' },
];

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** Team-wide quick replies stored per workspace in the database. */
export const useQuickReplies = (ws: string | null) => {
  const [items, setItems] = useState<QuickReply[]>(DEFAULTS);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!ws) return;
    let cancel = false;
    (supabase as any).from('quick_replies').select('id, shortcut, text').eq('workspace_id', ws).order('created_at')
      .then(({ data }: any) => {
        if (cancel) return;
        if (data && data.length) { setItems(data); setSeeded(true); } else { setItems(DEFAULTS); setSeeded(false); }
      });
    return () => { cancel = true; };
  }, [ws]);

  const save = async (next: QuickReply[]) => {
    const prev = items;
    setItems(next);
    if (!ws) return;
    const db = (supabase as any).from('quick_replies');
    // First edit: persist the defaults the user kept so the team shares them.
    const toInsert = (seeded ? next.filter(n => !prev.some(p => p.id === n.id)) : next)
      .map(n => ({ id: isUuid(n.id) ? n.id : crypto.randomUUID(), workspace_id: ws, shortcut: n.shortcut, text: n.text }));
    const removed = seeded ? prev.filter(p => !next.some(n => n.id === p.id)).map(p => p.id) : [];
    if (removed.length) await db.delete().in('id', removed);
    if (toInsert.length) {
      const { data, error } = await (supabase as any).from('quick_replies').insert(toInsert).select('id, shortcut, text');
      if (error) { toast.error('Could not save quick reply'); setItems(prev); return; }
      if (!seeded) { setItems(data); setSeeded(true); }
    }
  };
  return { items, save };
};

/** Matches when the draft is "/" or "/word" (no spaces). */
export const slashQuery = (draft: string) => (/^\/(\S*)$/.exec(draft)?.[1] ?? null);

export const filterReplies = (items: QuickReply[], q: string) =>
  items.filter(r => r.shortcut.toLowerCase().includes(q.toLowerCase()) || r.text.toLowerCase().includes(q.toLowerCase()));

export const SlashMenu = ({ items, active, onPick }: { items: QuickReply[]; active: number; onPick: (r: QuickReply) => void }) => (
  <div className="absolute bottom-full left-0 right-0 mb-2 z-30 rounded-xl border bg-popover shadow-lg max-h-64 overflow-y-auto">
    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Quick replies</p>
    {items.length === 0 && <p className="px-3 pb-3 text-sm text-muted-foreground">No match</p>}
    {items.map((r, i) => (
      <button key={r.id} type="button" onMouseDown={e => { e.preventDefault(); onPick(r); }}
        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${i === active ? 'bg-muted' : ''}`}>
        <span className="font-medium text-primary">/{r.shortcut}</span>
        <span className="block text-muted-foreground truncate">{r.text}</span>
      </button>
    ))}
  </div>
);

export const QuickReplyManager = ({ items, save, onPick, disabled }: {
  items: QuickReply[]; save: (n: QuickReply[]) => void; onPick: (r: QuickReply) => void; disabled?: boolean;
}) => {
  const [sc, setSc] = useState(''); const [tx, setTx] = useState('');
  const add = () => {
    const s = sc.trim().replace(/^\//, '').replace(/\s+/g, '-');
    if (!s || !tx.trim()) return;
    save([...items, { id: crypto.randomUUID(), shortcut: s, text: tx.trim() }]); setSc(''); setTx('');
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full shrink-0" disabled={disabled} title="Quick replies (type /)">
          <Zap className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-0">
        <div className="p-3 border-b"><p className="font-semibold text-sm">Quick replies</p><p className="text-xs text-muted-foreground">Type / in the message box to insert one.</p></div>
        <div className="max-h-56 overflow-y-auto">
          {items.map(r => (
            <div key={r.id} className="flex items-start gap-2 px-3 py-2 hover:bg-muted">
              <button type="button" className="flex-1 text-left text-sm min-w-0" onClick={() => onPick(r)}>
                <span className="font-medium text-primary">/{r.shortcut}</span>
                <span className="block text-muted-foreground truncate">{r.text}</span>
              </button>
              <button type="button" aria-label="Delete" className="p-1 text-muted-foreground hover:text-destructive" onClick={() => save(items.filter(x => x.id !== r.id))}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="p-3 border-t space-y-2">
          <Input value={sc} onChange={e => setSc(e.target.value)} placeholder="Shortcut, e.g. timings" className="h-8" />
          <Textarea value={tx} onChange={e => setTx(e.target.value)} placeholder="Reply text" rows={2} />
          <Button size="sm" className="w-full" onClick={add}><Plus className="w-3.5 h-3.5 mr-1" />Save quick reply</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

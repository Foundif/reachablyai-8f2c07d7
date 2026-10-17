import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export type FieldMapRow = { question: string; target: string };
const TARGETS = [
  { v: 'name', l: 'Contact name' },
  { v: 'phone', l: 'Phone / WhatsApp' },
  { v: 'email', l: 'Email' },
  { v: 'city', l: 'City' },
  { v: 'tag', l: 'Add answer as tag' },
];

export const LeadFieldMapping = ({ integrationId, settings, onSaved }: {
  integrationId: string; settings: Record<string, any>; onSaved?: () => void;
}) => {
  const [rows, setRows] = useState<FieldMapRow[]>(Array.isArray(settings?.field_map) ? settings.field_map : []);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const clean = rows.filter(r => r.question.trim()).map(r => ({ question: r.question.trim(), target: r.target }));
    const { error } = await supabase.from('integrations' as any).update({ settings: { ...settings, field_map: clean } }).eq('id', integrationId);
    setBusy(false);
    if (error) return toast.error('Could not save mapping');
    toast.success('Field mapping saved'); onSaved?.();
  };
  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div>
        <p className="text-xs font-medium">Form question mapping</p>
        <p className="text-xs text-muted-foreground">Type the question as it appears in your Meta form (or its field key) and choose where the answer goes.</p>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col sm:flex-row gap-2">
          <Input className="h-9" placeholder="e.g. Which service are you interested in?" value={r.question}
            onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} />
          <div className="flex gap-2">
            <Select value={r.target} onValueChange={v => setRows(rows.map((x, j) => j === i ? { ...x, target: v } : x))}>
              <SelectTrigger className="h-9 sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{TARGETS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setRows([...rows, { question: '', target: 'tag' }])}><Plus className="w-4 h-4 mr-1" />Add question</Button>
        <Button size="sm" onClick={save} disabled={busy}>Save mapping</Button>
      </div>
    </div>
  );
};

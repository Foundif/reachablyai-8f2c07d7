import { useState } from 'react';
import { GripVertical, Plus, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import type { FlowComponent, FlowJson } from '@/lib/flowStudio';

const PALETTE: { type: string; label: string; make: (n: string) => FlowComponent }[] = [
  { type: 'TextHeading', label: 'Heading', make: () => ({ type: 'TextHeading', text: 'New heading' }) },
  { type: 'TextBody', label: 'Text', make: () => ({ type: 'TextBody', text: 'Some helpful text' }) },
  { type: 'TextInput', label: 'Short answer', make: n => ({ type: 'TextInput', name: n, label: 'New question', 'input-type': 'text' }) },
  { type: 'TextArea', label: 'Long answer', make: n => ({ type: 'TextArea', name: n, label: 'Tell us more' }) },
  { type: 'Dropdown', label: 'Dropdown', make: n => ({ type: 'Dropdown', name: n, label: 'Choose one', 'data-source': [{ id: 'option_1', title: 'Option 1' }, { id: 'option_2', title: 'Option 2' }] }) },
  { type: 'RadioButtonsGroup', label: 'Single choice', make: n => ({ type: 'RadioButtonsGroup', name: n, label: 'Pick one', 'data-source': [{ id: 'option_1', title: 'Option 1' }, { id: 'option_2', title: 'Option 2' }] }) },
  { type: 'CheckboxGroup', label: 'Multiple choice', make: n => ({ type: 'CheckboxGroup', name: n, label: 'Pick any', 'data-source': [{ id: 'option_1', title: 'Option 1' }, { id: 'option_2', title: 'Option 2' }] }) },
  { type: 'DatePicker', label: 'Date', make: n => ({ type: 'DatePicker', name: n, label: 'Pick a date' }) },
  { type: 'OptIn', label: 'Agree box', make: n => ({ type: 'OptIn', name: n, label: 'I agree' }) },
];
const CHOICE = ['Dropdown', 'RadioButtonsGroup', 'CheckboxGroup'];
const INPUT_TYPES = ['text', 'number', 'email', 'phone', 'password'];

/** Returns the editable list for a screen: the Form's children, or the layout children. */
function fieldsOf(def: FlowJson, s: number): { list: FlowComponent[]; set: (l: FlowComponent[]) => FlowJson } {
  const clone: FlowJson = JSON.parse(JSON.stringify(def));
  const screen = clone.screens![s];
  screen.layout = screen.layout || { type: 'SingleColumnLayout', children: [] };
  const root = screen.layout.children = screen.layout.children || [];
  const form = root.find(c => c.type === 'Form');
  const holder = form ? (form.children = form.children || []) : root;
  const footerIdx = holder.findIndex(c => c.type === 'Footer');
  const footer = footerIdx >= 0 ? holder[footerIdx] : null;
  const list = holder.filter(c => c.type !== 'Footer');
  return {
    list,
    set: l => {
      holder.splice(0, holder.length, ...l, ...(footer ? [footer] : []));
      return clone;
    },
  };
}

export default function FlowVisualEditor({ definition, onChange }: { definition: FlowJson | null; onChange: (d: FlowJson) => void }) {
  const [screenIdx, setScreenIdx] = useState(0);
  const [drag, setDrag] = useState<{ from?: number; palette?: string } | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  if (!definition?.screens?.length) return <p className="text-sm text-muted-foreground">Fix the form code first to use the visual editor.</p>;
  const s = Math.min(screenIdx, definition.screens.length - 1);
  const { list, set } = fieldsOf(definition, s);
  const usedNames = new Set(definition.screens.flatMap((_, i) => fieldsOf(definition, i).list.map(c => c.name).filter(Boolean)));
  const newName = (type: string) => { let i = 1; const base = type.toLowerCase().replace(/[^a-z]/g, ''); while (usedNames.has(`${base}_${i}`)) i++; return `${base}_${i}`; };
  const commit = (l: FlowComponent[]) => onChange(set(l));
  const update = (i: number, patch: Partial<FlowComponent>) => commit(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const drop = (to: number) => {
    if (!drag) return;
    const l = [...list];
    if (drag.palette) {
      const p = PALETTE.find(x => x.type === drag.palette)!;
      l.splice(to, 0, p.make(newName(p.type)));
      setOpen(to);
    } else if (drag.from !== undefined) {
      const [item] = l.splice(drag.from, 1);
      l.splice(drag.from < to ? to - 1 : to, 0, item);
    }
    commit(l); setDrag(null); setOver(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {definition.screens.map((sc, i) => (
          <Button key={sc.id || i} size="sm" variant={i === s ? 'default' : 'outline'} onClick={() => { setScreenIdx(i); setOpen(null); }}>{sc.title || sc.id}</Button>
        ))}
      </div>

      <div className="rounded-lg border bg-muted/30 p-2">
        <p className="mb-2 text-xs text-muted-foreground">Drag a field into the form, or tap to add it at the end.</p>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map(p => (
            <button key={p.type} type="button" draggable
              onDragStart={() => setDrag({ palette: p.type })} onDragEnd={() => { setDrag(null); setOver(null); }}
              onClick={() => { commit([...list, p.make(newName(p.type))]); setOpen(list.length); }}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:border-primary cursor-grab">
              <Plus className="h-3 w-3" />{p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5" onDragOver={e => { e.preventDefault(); }} onDrop={() => drop(list.length)}>
        {list.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Drop fields here</div>}
        {list.map((c, i) => {
          const label = c.label || c.text || c.name || c.type;
          return (
            <div key={i}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setOver(i); }}
              onDrop={e => { e.stopPropagation(); drop(i); }}
              className={`rounded-lg border bg-card ${over === i ? 'border-t-2 border-t-primary' : ''}`}>
              <div className="flex items-center gap-2 p-2">
                <span draggable onDragStart={() => setDrag({ from: i })} onDragEnd={() => { setDrag(null); setOver(null); }} className="cursor-grab text-muted-foreground" aria-label="Drag to reorder"><GripVertical className="h-4 w-4" /></span>
                <button type="button" className="min-w-0 flex-1 truncate text-left text-sm" onClick={() => setOpen(open === i ? null : i)}>{label}</button>
                <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">{PALETTE.find(p => p.type === c.type)?.label || c.type}</Badge>
                {c.required && <Badge variant="outline" className="text-[10px]">Required</Badge>}
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Duplicate" onClick={() => { const l = [...list]; l.splice(i + 1, 0, { ...c, name: c.name ? newName(c.type || 'field') : undefined }); commit(l); }}><Copy className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Delete" onClick={() => { commit(list.filter((_, j) => j !== i)); setOpen(null); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              {open === i && (
                <div className="space-y-2 border-t p-3">
                  {'text' in c || ['TextHeading', 'TextSubheading', 'TextBody', 'TextCaption'].includes(c.type || '') ? (
                    <Input value={String(c.text ?? '')} onChange={e => update(i, { text: e.target.value })} placeholder="Text" />
                  ) : (
                    <>
                      <Input value={c.label || ''} onChange={e => update(i, { label: e.target.value })} placeholder="Question shown to customer" />
                      <Input value={c.name || ''} onChange={e => update(i, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })} placeholder="Field key (saved in CRM)" />
                      {c.type === 'TextInput' && (
                        <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={c['input-type'] || 'text'} onChange={e => update(i, { 'input-type': e.target.value })}>
                          {INPUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      )}
                      <label className="flex items-center gap-2 text-sm"><Switch checked={!!c.required} onCheckedChange={v => update(i, { required: v })} /> Required</label>
                      {CHOICE.includes(c.type || '') && (
                        <div className="space-y-1.5">
                          {(c['data-source'] || []).map((o, k) => (
                            <div key={k} className="flex gap-1.5">
                              <Input value={o.title || ''} onChange={e => update(i, { 'data-source': c['data-source']!.map((x, m) => m === k ? { ...x, title: e.target.value } : x) })} />
                              <Button size="icon" variant="ghost" aria-label="Remove option" onClick={() => update(i, { 'data-source': c['data-source']!.filter((_, m) => m !== k) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          ))}
                          <Button size="sm" variant="outline" onClick={() => { const n = (c['data-source']?.length || 0) + 1; update(i, { 'data-source': [...(c['data-source'] || []), { id: `option_${Date.now().toString(36)}`, title: `Option ${n}` }] }); }}><Plus className="mr-1 h-3 w-3" />Add option</Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

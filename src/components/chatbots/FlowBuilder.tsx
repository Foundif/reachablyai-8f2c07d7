import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowDown, ChevronDown, ChevronUp, GitBranch, MessageSquare, Plus,
  Sparkles, Trash2, UserRound, HelpCircle,
} from 'lucide-react';

export type FlowStepType = 'message' | 'question' | 'choice' | 'handoff' | 'ai';

export interface FlowOption { label: string; next?: string | null }
export interface FlowStep {
  id: string;
  type: FlowStepType;
  text: string;
  field?: string;
  options?: FlowOption[];
  next?: string | null;
}

const TYPE_META: Record<FlowStepType, { label: string; hint: string; icon: any; color: string }> = {
  message: { label: 'Message', hint: 'Sends a message and moves on', icon: MessageSquare, color: 'bg-primary/10 text-primary' },
  question: { label: 'Question', hint: 'Asks and saves the answer', icon: HelpCircle, color: 'bg-blue-500/10 text-blue-600' },
  choice: { label: 'Choice', hint: 'Offers options and branches', icon: GitBranch, color: 'bg-amber-500/10 text-amber-600' },
  handoff: { label: 'Human handoff', hint: 'Hands the chat to your team', icon: UserRound, color: 'bg-emerald-500/10 text-emerald-600' },
  ai: { label: 'AI takes over', hint: 'Ends the flow, AI answers freely', icon: Sparkles, color: 'bg-fuchsia-500/10 text-fuchsia-600' },
};

const uid = () => `s_${Math.random().toString(36).slice(2, 9)}`;

interface Props {
  steps: FlowStep[];
  enabled: boolean;
  saving?: boolean;
  onSave: (patch: { flow: FlowStep[]; flow_enabled: boolean }) => Promise<void> | void;
}

const FlowBuilder = ({ steps: initial, enabled: initialEnabled, saving, onSave }: Props) => {
  const [steps, setSteps] = useState<FlowStep[]>(initial || []);
  const [enabled, setEnabled] = useState(!!initialEnabled);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setSteps(initial || []); setEnabled(!!initialEnabled); setDirty(false); }, [initial, initialEnabled]);

  const mutate = (fn: (s: FlowStep[]) => FlowStep[]) => { setSteps(prev => fn([...prev])); setDirty(true); };

  const addStep = (type: FlowStepType) => mutate(s => {
    const step: FlowStep = {
      id: uid(), type, text: '',
      field: type === 'question' || type === 'choice' ? '' : undefined,
      options: type === 'choice' ? [{ label: '' }, { label: '' }] : undefined,
      next: null,
    };
    const last = s[s.length - 1];
    if (last && !last.next && last.type !== 'handoff' && last.type !== 'ai') last.next = step.id;
    return [...s, step];
  });

  const update = (id: string, patch: Partial<FlowStep>) =>
    mutate(s => s.map(st => (st.id === id ? { ...st, ...patch } : st)));

  const remove = (id: string) => mutate(s => s
    .filter(st => st.id !== id)
    .map(st => ({
      ...st,
      next: st.next === id ? null : st.next,
      options: st.options?.map(o => (o.next === id ? { ...o, next: null } : o)),
    })));

  const move = (idx: number, dir: -1 | 1) => mutate(s => {
    const t = idx + dir;
    if (t < 0 || t >= s.length) return s;
    [s[idx], s[t]] = [s[t], s[idx]];
    return s;
  });

  const nextOptions = useMemo(() => steps.map(s => ({ id: s.id, label: (s.text || TYPE_META[s.type].label).slice(0, 40) })), [steps]);

  const validate = () => {
    for (const s of steps) {
      if (!s.text.trim() && s.type !== 'ai') return `Every ${TYPE_META[s.type].label.toLowerCase()} step needs text.`;
      if (s.type === 'question' && !(s.field || '').trim()) return 'Each question needs a "save answer as" name.';
      if (s.type === 'choice') {
        const opts = (s.options || []).filter(o => o.label.trim());
        if (opts.length < 2) return 'Choice steps need at least two options.';
      }
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) return toast.error(err);
    const clean = steps.map(s => ({
      ...s,
      text: s.text.trim(),
      options: s.type === 'choice' ? (s.options || []).filter(o => o.label.trim()).map(o => ({ label: o.label.trim(), next: o.next || null })) : undefined,
    }));
    await onSave({ flow: clean, flow_enabled: enabled });
    setDirty(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-sm">Run this flow before the AI</div>
          <p className="text-xs text-muted-foreground">
            Visitors go through the steps first. When the flow ends, the AI answers anything else.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={v => { setEnabled(v); setDirty(true); }} />
          <Button size="sm" onClick={save} disabled={!!saving || !dirty}>{saving ? 'Saving…' : 'Save flow'}</Button>
        </div>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Start</Badge>
          <span>First step runs when the visitor sends their first message.</span>
        </div>

        {steps.length === 0 && (
          <Card className="p-8 text-center space-y-2">
            <GitBranch className="w-8 h-8 mx-auto text-muted-foreground" />
            <div className="font-medium">No steps yet</div>
            <p className="text-sm text-muted-foreground">Add a message, a question or a set of choices to build the conversation.</p>
          </Card>
        )}

        {steps.map((s, i) => {
          const meta = TYPE_META[s.type];
          const Icon = meta.icon;
          return (
            <div key={s.id}>
              <Card className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${meta.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{i + 1}. {meta.label}</span>
                      <span className="text-xs text-muted-foreground">{meta.hint}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ChevronUp className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move down"><ChevronDown className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)} aria-label="Delete step"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>

                {s.type !== 'ai' ? (
                  <Textarea
                    rows={2}
                    value={s.text}
                    onChange={e => update(s.id, { text: e.target.value })}
                    placeholder={s.type === 'question' ? 'What is your name?' : s.type === 'handoff' ? 'Connecting you to our team…' : 'Type what the bot should say. Use {{field}} to reuse an answer.'}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">The flow stops here and the trained AI assistant answers from your knowledge base.</p>
                )}

                {(s.type === 'question' || s.type === 'choice') && (
                  <div>
                    <Label className="text-xs">Save answer as</Label>
                    <Input value={s.field || ''} onChange={e => update(s.id, { field: e.target.value.replace(/[^\w]/g, '_') })} placeholder="name" />
                  </div>
                )}

                {s.type === 'choice' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Options</Label>
                    {(s.options || []).map((o, oi) => (
                      <div key={oi} className="flex gap-2 items-center">
                        <Input
                          value={o.label}
                          onChange={e => update(s.id, { options: (s.options || []).map((x, xi) => xi === oi ? { ...x, label: e.target.value } : x) })}
                          placeholder={`Option ${oi + 1}`}
                        />
                        <Select
                          value={o.next || 'none'}
                          onValueChange={v => update(s.id, { options: (s.options || []).map((x, xi) => xi === oi ? { ...x, next: v === 'none' ? null : v } : x) })}
                        >
                          <SelectTrigger className="w-44"><SelectValue placeholder="Go to…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">End flow</SelectItem>
                            {nextOptions.filter(n => n.id !== s.id).map(n => <SelectItem key={n.id} value={n.id}>{n.label || 'Step'}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" aria-label="Remove option"
                          onClick={() => update(s.id, { options: (s.options || []).filter((_, xi) => xi !== oi) })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => update(s.id, { options: [...(s.options || []), { label: '' }] })}>
                      <Plus className="w-3 h-3 mr-1" /> Add option
                    </Button>
                  </div>
                )}

                {s.type !== 'handoff' && s.type !== 'ai' && (
                  <div>
                    <Label className="text-xs">Then go to</Label>
                    <Select value={s.next || 'none'} onValueChange={v => update(s.id, { next: v === 'none' ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">End flow (AI takes over)</SelectItem>
                        {nextOptions.filter(n => n.id !== s.id).map(n => <SelectItem key={n.id} value={n.id}>{n.label || 'Step'}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </Card>
              {i < steps.length - 1 && <div className="flex justify-center py-1"><ArrowDown className="w-4 h-4 text-muted-foreground" /></div>}
            </div>
          );
        })}
      </div>

      <Card className="p-3 flex flex-wrap gap-2">
        {(Object.keys(TYPE_META) as FlowStepType[]).map(t => (
          <Button key={t} size="sm" variant="outline" onClick={() => addStep(t)}>
            <Plus className="w-3 h-3 mr-1" /> {TYPE_META[t].label}
          </Button>
        ))}
      </Card>
    </div>
  );
};

export default FlowBuilder;

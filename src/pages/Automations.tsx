import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Workflow, Trash2 } from 'lucide-react';

type TriggerType = 'new_lead' | 'tag_added' | 'status_changed' | 'keyword_match' | 'no_reply_24h';
type ActionType = 'send_template' | 'add_tag' | 'set_status' | 'assign_agent';

interface Automation {
  id: string; name: string; enabled: boolean;
  trigger_type: TriggerType; trigger_config: any;
  action_type: ActionType; action_config: any;
  template_id: string | null; run_count: number; last_run_at: string | null;
}
interface Template { id: string; name: string; status: string; }

const TRIGGER_LABELS: Record<TriggerType, string> = {
  new_lead: 'New lead created',
  tag_added: 'Tag added to lead',
  status_changed: 'Lead status changed',
  keyword_match: 'Incoming message matches keyword',
  no_reply_24h: 'No reply in 24 hours',
};
const ACTION_LABELS: Record<ActionType, string> = {
  send_template: 'Send WhatsApp template',
  add_tag: 'Add tag',
  set_status: 'Change lead status',
  assign_agent: 'Assign to agent',
};

const Automations = () => {
  const { user } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [items, setItems] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    trigger_type: 'new_lead' as TriggerType,
    trigger_value: '',
    action_type: 'send_template' as ActionType,
    template_id: '',
    action_value: '',
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: ws } = await supabase.from('workspaces' as any)
      .select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
    const id = (ws as any)?.id || null;
    setWsId(id);
    if (!id) { setLoading(false); return; }
    const [{ data: a }, { data: t }] = await Promise.all([
      supabase.from('automations' as any).select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
      supabase.from('templates' as any).select('id,name,status').eq('workspace_id', id).eq('status', 'approved'),
    ]);
    setItems((a as any) || []);
    setTemplates((t as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!wsId) return;
    if (!form.name.trim()) return toast.error('Name required');
    if (form.action_type === 'send_template' && !form.template_id) return toast.error('Pick a template');
    if (form.action_type === 'add_tag' && !form.action_value.trim()) return toast.error('Enter tag');
    if (form.action_type === 'set_status' && !form.action_value.trim()) return toast.error('Pick status');

    const trigger_config: any = {};
    if (form.trigger_type === 'tag_added') trigger_config.tag = form.trigger_value.trim();
    if (form.trigger_type === 'status_changed') trigger_config.status = form.trigger_value.trim();
    if (form.trigger_type === 'keyword_match') trigger_config.keyword = form.trigger_value.trim();

    const action_config: any = {};
    if (form.action_type === 'add_tag') action_config.tag = form.action_value.trim();
    if (form.action_type === 'set_status') action_config.status = form.action_value.trim();

    const { error } = await supabase.from('automations' as any).insert({
      workspace_id: wsId,
      name: form.name.trim(),
      trigger_type: form.trigger_type,
      trigger_config,
      action_type: form.action_type,
      action_config,
      template_id: form.action_type === 'send_template' ? form.template_id : null,
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success('Automation created');
    setOpen(false);
    setForm({ name: '', trigger_type: 'new_lead', trigger_value: '', action_type: 'send_template', template_id: '', action_value: '' });
    load();
  };

  const toggle = async (a: Automation) => {
    await supabase.from('automations' as any).update({ enabled: !a.enabled }).eq('id', a.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete automation?')) return;
    await supabase.from('automations' as any).delete().eq('id', id);
    load();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Workflow className="w-6 h-6" /> Automations
            </h1>
            <p className="text-muted-foreground text-sm">Trigger → action rules. Runs whenever leads or messages match.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> New Automation</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create automation</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Welcome new leads" /></div>
                <div>
                  <Label>Trigger</Label>
                  <Select value={form.trigger_type} onValueChange={(v: TriggerType) => setForm({ ...form, trigger_type: v, trigger_value: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRIGGER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {['tag_added', 'keyword_match'].includes(form.trigger_type) && (
                    <Input className="mt-2" placeholder={form.trigger_type === 'tag_added' ? 'Tag name' : 'Keyword'} value={form.trigger_value} onChange={e => setForm({ ...form, trigger_value: e.target.value })} />
                  )}
                  {form.trigger_type === 'status_changed' && (
                    <Select value={form.trigger_value} onValueChange={v => setForm({ ...form, trigger_value: v })}>
                      <SelectTrigger className="mt-2"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        {['new','contacted','converted','lost'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label>Action</Label>
                  <Select value={form.action_type} onValueChange={(v: ActionType) => setForm({ ...form, action_type: v, action_value: '', template_id: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.action_type === 'send_template' && (
                    <Select value={form.template_id} onValueChange={v => setForm({ ...form, template_id: v })}>
                      <SelectTrigger className="mt-2"><SelectValue placeholder={templates.length ? 'Pick template' : 'No approved templates'} /></SelectTrigger>
                      <SelectContent>
                        {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {form.action_type === 'add_tag' && (
                    <Input className="mt-2" placeholder="Tag to add" value={form.action_value} onChange={e => setForm({ ...form, action_value: e.target.value })} />
                  )}
                  {form.action_type === 'set_status' && (
                    <Select value={form.action_value} onValueChange={v => setForm({ ...form, action_value: v })}>
                      <SelectTrigger className="mt-2"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        {['new','contacted','converted','lost'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="overflow-hidden">
          {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
          : items.length === 0 ? (
            <div className="p-12 text-center">
              <Workflow className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No automations yet</p>
              <p className="text-sm text-muted-foreground">Automate repetitive follow-ups.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Trigger</TableHead>
                  <TableHead>Action</TableHead><TableHead>Runs</TableHead>
                  <TableHead>Last run</TableHead><TableHead>On</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell><Badge variant="outline">{TRIGGER_LABELS[a.trigger_type]}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{ACTION_LABELS[a.action_type]}</Badge></TableCell>
                    <TableCell>{a.run_count}</TableCell>
                    <TableCell className="text-xs">{a.last_run_at ? new Date(a.last_run_at).toLocaleString() : '—'}</TableCell>
                    <TableCell><Switch checked={a.enabled} onCheckedChange={() => toggle(a)} /></TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default Automations;

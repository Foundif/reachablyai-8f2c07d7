import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Trash2, MessageSquareText, RefreshCw, Info, Loader2 } from 'lucide-react';

type TplStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';
type TplCategory = 'marketing' | 'utility' | 'authentication';

interface Template {
  id: string; workspace_id: string; name: string; category: TplCategory;
  language: string; body: string; header: string | null; footer: string | null;
  variables: string[]; status: TplStatus; rejection_reason: string | null;
  meta_template_id: string | null; synced_at: string | null; created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  rejected: 'bg-red-500/15 text-red-600 border-red-500/30',
  paused: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
  disabled: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
  draft: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
};

const Templates = () => {
  const { user } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', category: 'marketing' as TplCategory, language: 'en',
    header: '', body: 'Hi {{name}}, welcome to our store!', footer: '',
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: ws } = await supabase.from('workspaces' as any)
      .select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
    const id = (ws as any)?.id || null;
    setWsId(id);
    if (!id) { setLoading(false); return; }
    const { data } = await supabase.from('templates' as any)
      .select('*').eq('workspace_id', id).order('created_at', { ascending: false });
    setItems((data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const submitToMeta = async () => {
    if (!wsId) return;
    if (!form.name.trim() || !form.body.trim()) return toast.error('Name and body required');
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('template-create', {
      body: { workspace_id: wsId, ...form },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error!.message);
    }
    toast.success(`Submitted to Meta — status: ${(data as any).status}`);
    setOpen(false);
    setForm({ name: '', category: 'marketing', language: 'en', header: '', body: 'Hi {{name}}, welcome!', footer: '' });
    load();
  };

  const syncFromMeta = async () => {
    if (!wsId) return;
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke('template-sync', { body: { workspace_id: wsId } });
    setSyncing(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error!.message);
    toast.success(`Synced ${(data as any).synced} templates from Meta`);
    load();
  };

  const remove = async (t: Template) => {
    if (!confirm(`Delete template "${t.name}"? This only removes it locally, not from Meta.`)) return;
    await supabase.from('templates' as any).delete().eq('id', t.id);
    load();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <MessageSquareText className="w-6 h-6" /> Message Templates
            </h1>
            <p className="text-muted-foreground text-sm">All templates come from Meta. Create here → submitted to Meta → usable once approved.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={syncFromMeta} disabled={syncing || !wsId} className="gap-2">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync from Meta
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={!wsId}><Plus className="w-4 h-4" /> New Template</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Submit template to Meta</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="text-xs bg-primary/5 border border-primary/20 rounded-md p-2 flex gap-2">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>This is sent to Meta immediately. Approval takes minutes to hours. Only approved templates can be used in campaigns and outside the 24-hour window.</span>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="welcome_offer" />
                    <p className="text-[11px] text-muted-foreground mt-1">Lowercase, digits, underscores only.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Category</Label>
                      <Select value={form.category} onValueChange={(v: TplCategory) => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="utility">Utility</SelectItem>
                          <SelectItem value="authentication">Authentication</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Language</Label>
                      <Input value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} placeholder="en" />
                    </div>
                  </div>
                  <div>
                    <Label>Header (optional)</Label>
                    <Input value={form.header} onChange={e => setForm({ ...form, header: e.target.value })} placeholder="Big news!" />
                  </div>
                  <div>
                    <Label>Body</Label>
                    <Textarea rows={5} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
                    <p className="text-[11px] text-muted-foreground mt-1">Use <code>{'{{name}}'}</code> for variables.</p>
                  </div>
                  <div>
                    <Label>Footer (optional)</Label>
                    <Input value={form.footer} onChange={e => setForm({ ...form, footer: e.target.value })} placeholder="Reply STOP to opt out" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
                  <Button onClick={submitToMeta} disabled={submitting}>
                    {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Submitting…</> : 'Submit to Meta'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquareText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No templates yet</p>
              <p className="text-sm text-muted-foreground">Click <b>Sync from Meta</b> to pull existing ones, or create a new one.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead>Vars</TableHead>
                  <TableHead>Meta Status</TableHead>
                  <TableHead>Last synced</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {t.name}
                      {t.rejection_reason && <div className="text-[11px] text-red-500 mt-0.5">{t.rejection_reason}</div>}
                    </TableCell>
                    <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                    <TableCell>{t.language}</TableCell>
                    <TableCell className="text-xs">{(t.variables || []).length}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_STYLES[t.status] || STATUS_STYLES.draft}>{t.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.synced_at ? new Date(t.synced_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => remove(t)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
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

export default Templates;

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
import { Plus, Trash2, MessageSquareText } from 'lucide-react';

type TplStatus = 'draft' | 'pending' | 'approved' | 'rejected';
type TplCategory = 'marketing' | 'utility' | 'authentication';

interface Template {
  id: string;
  workspace_id: string;
  name: string;
  category: TplCategory;
  language: string;
  body: string;
  variables: string[];
  status: TplStatus;
  rejection_reason: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<TplStatus, string> = {
  draft: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
  pending: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-600 border-red-500/30',
};

function extractVars(body: string): string[] {
  const matches = body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
  return Array.from(new Set(Array.from(matches, (m) => m[1])));
}

const Templates = () => {
  const { user } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'marketing' as TplCategory,
    language: 'en',
    body: 'Hi {{name}}, ',
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: ws } = await supabase
      .from('workspaces' as any).select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
    const id = (ws as any)?.id || null;
    setWsId(id);
    if (!id) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('templates' as any).select('*').eq('workspace_id', id).order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleCreate = async () => {
    if (!wsId) return;
    const name = form.name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!name) return toast.error('Name required');
    if (!form.body.trim()) return toast.error('Body required');
    const vars = extractVars(form.body);
    const { error } = await supabase.from('templates' as any).insert({
      workspace_id: wsId,
      name,
      category: form.category,
      language: form.language,
      body: form.body,
      variables: vars,
      status: 'draft',
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success('Template saved as draft');
    setOpen(false);
    setForm({ name: '', category: 'marketing', language: 'en', body: 'Hi {{name}}, ' });
    load();
  };

  const submitForApproval = async (id: string) => {
    // Marks locally. Real Meta submission happens via WhatsApp settings integration in step 2a wiring.
    const { error } = await supabase.from('templates' as any)
      .update({ status: 'pending' }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Marked pending. Submit to Meta from WhatsApp Manager to get approval.');
    load();
  };

  const markApproved = async (id: string) => {
    const { error } = await supabase.from('templates' as any)
      .update({ status: 'approved' }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Marked approved. You can now use it in campaigns.');
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    const { error } = await supabase.from('templates' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
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
            <p className="text-muted-foreground text-sm">Reusable WhatsApp templates. Only approved templates can be sent outside the 24-hour window.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> New Template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create template</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="welcome_offer" />
                  <p className="text-xs text-muted-foreground mt-1">Meta rule: lowercase, digits and underscores only.</p>
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
                  <Label>Body</Label>
                  <Textarea rows={5} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Hi {{name}}, ..." />
                  <p className="text-xs text-muted-foreground mt-1">Use <code>{'{{variable}}'}</code> for placeholders. Detected: {extractVars(form.body).join(', ') || 'none'}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate}>Save draft</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading templates…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquareText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No templates yet</p>
              <p className="text-sm text-muted-foreground">Create your first template to run campaigns and automations.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                    <TableCell>{t.language}</TableCell>
                    <TableCell className="text-xs">{(t.variables || []).join(', ') || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_STYLES[t.status]}>{t.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      {t.status === 'draft' && <Button size="sm" variant="outline" onClick={() => submitForApproval(t.id)}>Submit</Button>}
                      {t.status === 'pending' && <Button size="sm" variant="outline" onClick={() => markApproved(t.id)}>Mark approved</Button>}
                      <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4" /></Button>
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

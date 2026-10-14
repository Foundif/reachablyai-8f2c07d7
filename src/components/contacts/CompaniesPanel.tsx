import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Globe, Plus, Search, Trash2, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Company { id: string; name: string; website: string | null; tags: string[]; notes: string | null; created_at: string }
const empty = { name: '', website: '', tags: '', notes: '' };

const CompaniesPanel = ({ wsId }: { wsId: string | null }) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!wsId) return;
    setLoading(true);
    const { data, error } = await supabase.from('companies' as any).select('*').eq('workspace_id', wsId).order('created_at', { ascending: false });
    if (error) toast.error('Could not load companies');
    setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [wsId]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Company) => { setEditing(c); setForm({ name: c.name, website: c.website || '', tags: c.tags.join(', '), notes: c.notes || '' }); setOpen(true); };

  const save = async () => {
    const name = form.name.trim();
    if (!name || !wsId) return toast.error('Company name is required');
    let website = form.website.trim();
    if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
    const payload = { name, website: website || null, notes: form.notes.trim() || null, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
    setSaving(true);
    const { error } = editing
      ? await supabase.from('companies' as any).update(payload).eq('id', editing.id)
      : await supabase.from('companies' as any).insert({ ...payload, workspace_id: wsId, created_by: user?.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? 'Company updated' : 'Company created');
    setOpen(false); load();
  };

  const remove = async (c: Company) => {
    if (!confirm(`Delete ${c.name}?`)) return;
    const { error } = await supabase.from('companies' as any).delete().eq('id', c.id);
    if (error) return toast.error(error.message);
    setRows(r => r.filter(x => x.id !== c.id));
  };

  const list = rows.filter(r => `${r.name} ${r.website || ''} ${r.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name" className="pl-8 h-9" />
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5 ml-auto"><Plus className="w-4 h-4" /> Create company</Button>
      </div>

      <div className="rounded-xl border bg-card divide-y">
        <div className="hidden md:grid grid-cols-[2fr_2fr_2fr_80px] gap-3 px-4 py-2.5 text-xs font-semibold text-muted-foreground bg-muted/40 rounded-t-xl">
          <span>Company name</span><span>Website</span><span>Tags</span><span />
        </div>
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {rows.length ? 'No companies match your search.' : 'No companies yet. Create your first one.'}
          </div>
        ) : list.map(c => (
          <div key={c.id} className="grid md:grid-cols-[2fr_2fr_2fr_80px] gap-2 md:gap-3 px-4 py-3 items-center">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Building2 className="w-4 h-4" /></div>
              <span className="font-medium truncate">{c.name}</span>
            </div>
            <div className="text-sm truncate">
              {c.website ? <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Globe className="w-3.5 h-3.5" />{c.website.replace(/^https?:\/\//, '')}</a> : <span className="text-muted-foreground">—</span>}
            </div>
            <div className="flex flex-wrap gap-1">{c.tags.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>
            <div className="flex gap-1 md:justify-end">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)} aria-label="Edit"><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(c)} aria-label="Delete"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit company' : 'Create company'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Company name <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter company name" className="pr-14" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{form.name.length}/100</span>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Website</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://example.com" /></div>
            <div className="space-y-1.5"><Label>Tags</Label><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="vip, wholesale (comma separated)" /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}{editing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompaniesPanel;

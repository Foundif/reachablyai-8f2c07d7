import { useEffect, useState } from 'react';
import { SecureImg, SecureVideo } from '@/lib/secureMedia';
import { useNavigate } from 'react-router-dom';

import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Trash2, MessageSquareText, RefreshCw, Info, Loader2, Upload, Pencil, X, Eye, AlertTriangle } from 'lucide-react';
import { resolveWorkspaceId } from '@/lib/workspace';

type TplStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled' | 'in_appeal' | 'pending_deletion' | 'deleted';
type TplCategory = 'marketing' | 'utility' | 'authentication' | 'carousel';
type HeaderType = 'none' | 'text' | 'image' | 'video' | 'document' | 'carousel';
type BtnType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

interface Btn { type: BtnType; text: string; url?: string; phone_number?: string }
interface CarouselCard { header_media_url: string; header_type: 'image' | 'video'; body: string; buttons: Btn[] }

interface Template {
  id: string; workspace_id: string; name: string; category: TplCategory;
  language: string; body: string; header: string | null; footer: string | null;
  variables: string[]; status: TplStatus; rejection_reason: string | null;
  meta_template_id: string | null; synced_at: string | null; created_at: string;
  header_type?: HeaderType; header_media_url?: string | null;
  buttons?: Btn[] | null; carousel_cards?: CarouselCard[] | null;
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  rejected: 'bg-red-500/15 text-red-600 border-red-500/30',
  paused: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
  disabled: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
  draft: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
  in_appeal: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  pending_deletion: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
  deleted: 'bg-red-500/15 text-red-600 border-red-500/30',
};

const emptyForm = () => ({
  name: '', category: 'marketing' as TplCategory, language: 'en',
  header_type: 'none' as HeaderType, header: '', header_media_url: '',
  body: 'Hi {{name}}, welcome to our store!', footer: '',
  buttons: [] as Btn[],
  carousel_cards: [] as CarouselCard[],
});

const extractVars = (s: string): string[] => {
  const set: string[] = [];
  (s || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, v: string) => { if (!set.includes(v)) set.push(v); return _m; });
  return set;
};

// Meta rejects templates where a variable is at the very start or end of the body/header.
const validateTemplateForm = (form: ReturnType<typeof emptyForm>) => {
  const errors: string[] = [];
  if (!form.name.trim() || !/^[a-z0-9_]+$/.test(form.name)) {
    errors.push('Name must be lowercase letters, digits, or underscores.');
  }
  const isCarousel = form.category === 'carousel' || form.header_type === 'carousel';
  if (!isCarousel && !form.body.trim()) errors.push('Body is required.');

  const body = (form.body || '').trim();
  if (body) {
    if (/^\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(body)) errors.push('Body can\'t start with a variable — add some text before {{...}}.');
    if (/\{\{\s*[a-zA-Z0-9_]+\s*\}\}$/.test(body)) errors.push('Body can\'t end with a variable — add text or punctuation after {{...}}.');
  }
  if (form.header_type === 'text' && form.header) {
    const h = form.header.trim();
    if (/^\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(h) || /\{\{\s*[a-zA-Z0-9_]+\s*\}\}$/.test(h)) {
      errors.push('Header text can\'t start or end with a variable.');
    }
  }
  if (['image', 'video', 'document'].includes(form.header_type) && !form.header_media_url) {
    errors.push('Upload or paste a public URL for the header media.');
  }
  for (const b of form.buttons || []) {
    if (!b.text?.trim()) errors.push('Every button needs text.');
    if (b.type === 'URL' && !b.url?.trim()) errors.push('URL buttons need a URL.');
    if (b.type === 'PHONE_NUMBER' && !b.phone_number?.trim()) errors.push('Call buttons need a phone number.');
  }
  return errors;
};

const Templates = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [wsId, setWsId] = useState<string | null>(null);

  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Template | null>(null);

  const load = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    const id = await resolveWorkspaceId(user.id, profile);
    setWsId(id);
    if (!id) { setLoading(false); return; }
    const { data } = await supabase.from('templates' as any)
      .select('*').eq('workspace_id', id).order('created_at', { ascending: false });
    setItems((data as any[]) || []);
    setLoading(false);
    // Auto-sync from Meta on mount so approved statuses show up without user clicking Sync
    if (!silent) {
      supabase.functions.invoke('template-sync', { body: { workspace_id: id } })
        .then(({ error }) => { if (!error) load(true); })
        .catch(() => {});
    }
  };
  useEffect(() => { load(); }, [user, profile]);

  const openNew = () => navigate('/templates/new');
  const openEdit = (t: Template) => navigate(`/templates/${t.id}`);


  const syncFromMeta = async () => {
    if (!wsId) return;
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke('template-sync', { body: { workspace_id: wsId } });
    setSyncing(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error!.message);
    toast.success(`Synced ${(data as any).synced} templates from Meta`);
    load();
  };

  const confirmRemove = async () => {
    const t = pendingDelete;
    if (!t || !wsId) return;
    setPendingDelete(null);
    const tid = toast.loading(`Deleting ${t.name} on Meta…`);
    const { data, error } = await supabase.functions.invoke('template-delete', {
      body: { workspace_id: wsId, template_id: t.id },
    });
    toast.dismiss(tid);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error!.message);
    toast.success((data as any)?.meta_deleted ? 'Template deleted on Meta and in Reachably' : 'Template deleted');
    load();
  };


  const canEdit = (t: Template) => !!t.meta_template_id && ['approved', 'rejected', 'paused'].includes(t.status);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  const filtered = items.filter(t =>
    (!q || t.name.toLowerCase().includes(q.toLowerCase())) &&
    (statusFilter === 'all' || t.status === statusFilter) &&
    (catFilter === 'all' || t.category === catFilter)
  );

  const ago = (d?: string | null) => {
    if (!d) return '—';
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
    const days = Math.floor(s / 86400);
    return days === 1 ? 'a day ago' : `${days} days ago`;
  };

  const renderBody = (t: Template) => {
    const parts = (t.body || '').split(/(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g);
    return parts.map((p, i) =>
      /^\{\{/.test(p)
        ? <span key={i} className="rounded bg-emerald-500/15 text-emerald-600 px-1 py-0.5 mx-0.5">{p.replace(/[{}]/g, '').trim()}</span>
        : <span key={i}>{p}</span>
    );
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MessageSquareText className="w-6 h-6" /> WhatsApp Templates
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={syncFromMeta} disabled={syncing || !wsId} aria-label="Sync from Meta">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button className="gap-2" disabled={!wsId} onClick={openNew}><Plus className="w-4 h-4" /> Create New Template</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status: All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              {['approved', 'pending', 'rejected', 'draft', 'paused'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Category: All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Category: All</SelectItem>
              {['marketing', 'utility', 'authentication', 'carousel'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <MessageSquareText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No templates found</p>
            <p className="text-sm text-muted-foreground">Sync from Meta to pull existing ones, or create a new one.</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map(t => (
              <Card key={t.id} className="overflow-hidden flex flex-col">
                <div className="p-3 flex items-start justify-between gap-2 border-b">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{t.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={STATUS_STYLES[t.status] || STATUS_STYLES.draft}>{t.status.replace('_', ' ')}</Badge>
                      <span className="text-xs text-muted-foreground capitalize">{t.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)}>View</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPendingDelete(t)} aria-label={`Delete ${t.name}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-muted/40 flex-1">
                  <div className="rounded-xl bg-card border p-3 text-sm whitespace-pre-wrap max-h-56 overflow-y-auto custom-scrollbar">
                    {t.header_type && !['none', 'text'].includes(t.header_type) && (
                      <div className="mb-2 rounded-lg overflow-hidden bg-muted h-24">
                        {t.header_media_url && t.header_type === 'image' ? (
                          <SecureImg src={t.header_media_url} alt={`${t.name} header image`} loading="lazy" className="h-24 w-full object-cover" />
                        ) : t.header_media_url && t.header_type === 'video' ? (
                          <SecureVideo src={t.header_media_url} muted className="h-24 w-full object-cover" />
                        ) : (
                          <div className="h-24 grid place-items-center text-xs text-muted-foreground capitalize">{t.header_type} header</div>
                        )}
                      </div>
                    )}
                    {Array.isArray(t.carousel_cards) && t.carousel_cards.length > 0 && (
                      <div className="mb-2 flex gap-2 overflow-x-auto">
                        {t.carousel_cards.map((c, i) => (
                          <div key={i} className="h-20 w-24 shrink-0 rounded-lg overflow-hidden bg-muted">
                            {c.header_media_url && c.header_type === 'video' ? (
                              <SecureVideo src={c.header_media_url} muted className="h-full w-full object-cover" />
                            ) : c.header_media_url ? (
                              <SecureImg src={c.header_media_url} alt={`Card ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full grid place-items-center text-[10px] text-muted-foreground">Card {i + 1}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {t.header_type === 'text' && t.header && <p className="font-semibold mb-1">{t.header}</p>}
                    {renderBody(t)}
                    {t.footer && <p className="text-xs text-muted-foreground mt-2">{t.footer}</p>}
                  </div>
                  {t.rejection_reason && (
                    <p className="text-[11px] text-red-500 mt-2 flex gap-1"><AlertTriangle className="w-3 h-3 mt-0.5" />{t.rejection_reason}</p>
                  )}
                </div>

                <div className="px-3 py-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="uppercase">{t.language}</span>
                  <span>{ago(t.synced_at || t.created_at)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>





      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              <b>{pendingDelete?.name}</b> will be deleted on <b>Meta</b> and removed from Reachably. This cannot be undone — campaigns using it will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete everywhere</AlertDialogAction>

          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Templates;

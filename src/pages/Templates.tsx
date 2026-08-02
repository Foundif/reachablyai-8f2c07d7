import { useEffect, useState } from 'react';
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

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <MessageSquareText className="w-6 h-6" /> Message Templates
            </h1>
            <p className="text-muted-foreground text-sm">All templates come from Meta. Submit here → shown on Meta → usable once approved. Click <b>Sync from Meta</b> to refresh statuses.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={syncFromMeta} disabled={syncing || !wsId} className="gap-2">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync from Meta
            </Button>
            <Button className="gap-2" disabled={!wsId} onClick={openNew}><Plus className="w-4 h-4" /> New Template</Button>
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
                  <TableHead>Header</TableHead>
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
                    <TableCell className="text-xs capitalize">{t.header_type || 'none'}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_STYLES[t.status] || STATUS_STYLES.draft}>{t.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.synced_at ? new Date(t.synced_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)} title={canEdit(t) ? 'Edit & resubmit to Meta' : 'View / duplicate'}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPendingDelete(t)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
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

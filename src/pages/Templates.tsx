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
  const [wsId, setWsId] = useState<string | null>(null);
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [pendingDelete, setPendingDelete] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const validationErrors = validateTemplateForm(form);
  const detectedVars = extractVars(form.body);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const renderedPreview = detectedVars.length
    ? form.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, v: string) => previewValues[v] || `{{${v}}}`)
    : form.body;

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

  const uploadMedia = async (file: File, setUrl: (u: string) => void) => {
    if (!wsId) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `template-media/${wsId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('salon-assets').upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('salon-assets').getPublicUrl(path);
      setUrl(pub.publicUrl);
      toast.success('Uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openNew = () => {
    setEditingId(null); setEditingMetaId(null);
    setForm(emptyForm()); setOpen(true);
  };
  const openEdit = (t: Template) => {
    setEditingId(t.id); setEditingMetaId(t.meta_template_id || null);
    setForm({
      name: t.name, category: t.category, language: t.language,
      header_type: (t.header_type || (t.header ? 'text' : 'none')) as HeaderType,
      header: t.header || '', header_media_url: t.header_media_url || '',
      body: t.body || '', footer: t.footer || '',
      buttons: (t.buttons || []) as Btn[],
      carousel_cards: (t.carousel_cards || []) as CarouselCard[],
    });
    setOpen(true);
  };

  const submitToMeta = async () => {
    if (!wsId) return;
    const errs = validateTemplateForm(form);
    if (errs.length) {
      toast.error(errs[0], { description: errs.length > 1 ? `+${errs.length - 1} more issue(s)` : undefined });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('template-create', {
      body: { workspace_id: wsId, template_id: editingMetaId, ...form },
    });
    setSubmitting(false);
    const errPayload: any = (data as any)?.error || error?.message;
    if (errPayload || (data as any)?.error) {
      const meta = (data as any)?.meta;
      const friendly = meta?.error_user_msg || meta?.error_user_title || (data as any)?.error || error?.message || 'Meta rejected this template.';
      toast.error('Template not accepted', { description: friendly, duration: 10000 });
      return;
    }
    toast.success(`${editingMetaId ? 'Update' : 'Submission'} sent to Meta — status: ${(data as any).status}`);
    setOpen(false);
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

  const confirmRemove = async () => {
    const t = pendingDelete;
    if (!t) return;
    setPendingDelete(null);
    const { error } = await supabase.from('templates' as any).delete().eq('id', t.id);
    if (error) return toast.error(error.message);
    toast.success('Template removed locally');
    load();
  };

  const addBtn = () => setForm(f => ({ ...f, buttons: [...f.buttons, { type: 'QUICK_REPLY', text: 'Reply' }] }));
  const upBtn = (i: number, patch: Partial<Btn>) => setForm(f => ({ ...f, buttons: f.buttons.map((b, ix) => ix === i ? { ...b, ...patch } : b) }));
  const rmBtn = (i: number) => setForm(f => ({ ...f, buttons: f.buttons.filter((_, ix) => ix !== i) }));

  const addCard = () => setForm(f => ({ ...f, carousel_cards: [...f.carousel_cards, { header_media_url: '', header_type: 'image', body: '', buttons: [] }] }));
  const upCard = (i: number, patch: Partial<CarouselCard>) => setForm(f => ({ ...f, carousel_cards: f.carousel_cards.map((c, ix) => ix === i ? { ...c, ...patch } : c) }));
  const rmCard = (i: number) => setForm(f => ({ ...f, carousel_cards: f.carousel_cards.filter((_, ix) => ix !== i) }));

  const isCarousel = form.category === 'carousel' || form.header_type === 'carousel';
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMetaId ? 'Edit template on Meta' : 'Submit template to Meta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs bg-primary/5 border border-primary/20 rounded-md p-2 flex gap-2">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>Sent to Meta immediately. Approval takes minutes to hours. Only approved templates can be used in campaigns and outside the 24-hour window.</span>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="welcome_offer" disabled={!!editingMetaId} />
              <p className="text-[11px] text-muted-foreground mt-1">Lowercase, digits, underscores only. Cannot be changed after submission.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v: TplCategory) => setForm({ ...form, category: v, header_type: v === 'carousel' ? 'carousel' : form.header_type })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="utility">Utility</SelectItem>
                    <SelectItem value="authentication">Authentication</SelectItem>
                    <SelectItem value="carousel">Carousel (multi-card)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Language</Label>
                <Input value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} placeholder="en" disabled={!!editingMetaId} />
              </div>
            </div>

            <Tabs defaultValue="content" className="mt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="buttons" disabled={isCarousel}>Buttons</TabsTrigger>
                <TabsTrigger value="carousel" disabled={!isCarousel}>Cards</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-3 pt-3">
                <div>
                  <Label>Header</Label>
                  <Select value={form.header_type} onValueChange={(v: HeaderType) => setForm({ ...form, header_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="image">Image (JPG/PNG)</SelectItem>
                      <SelectItem value="video">Video (MP4)</SelectItem>
                      <SelectItem value="document">Document (PDF)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.header_type === 'text' && (
                  <Input value={form.header} onChange={e => setForm({ ...form, header: e.target.value })} placeholder="Big news!" />
                )}
                {['image', 'video', 'document'].includes(form.header_type) && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input value={form.header_media_url} onChange={e => setForm({ ...form, header_media_url: e.target.value })} placeholder="Public URL of media (JPG/PNG/MP4/PDF)" />
                      <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                        <label className="cursor-pointer">
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <input type="file" className="hidden"
                            accept={form.header_type === 'image' ? 'image/*' : form.header_type === 'video' ? 'video/mp4' : 'application/pdf'}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f, (u) => setForm(cur => ({ ...cur, header_media_url: u }))); }} />
                        </label>
                      </Button>
                    </div>
                    {form.header_media_url && form.header_type === 'image' && (
                      <img src={form.header_media_url} alt="preview" className="max-h-28 rounded border" />
                    )}
                  </div>
                )}
                {!isCarousel && (
                  <div>
                    <Label>Body</Label>
                    <Textarea rows={5} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
                    <p className="text-[11px] text-muted-foreground mt-1">Use <code>{'{{name}}'}</code> for variables.</p>
                  </div>
                )}
                {!isCarousel && (
                  <div>
                    <Label>Footer (optional)</Label>
                    <Input value={form.footer} onChange={e => setForm({ ...form, footer: e.target.value })} placeholder="Reply STOP to opt out" />
                  </div>
                )}
                {isCarousel && (
                  <div>
                    <Label>Intro text (shown above cards)</Label>
                    <Textarea rows={3} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Check out our new arrivals" />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="buttons" className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground">Up to 10 buttons. Mix quick replies with 1–2 CTAs (URL or Call).</p>
                {form.buttons.map((b, i) => (
                  <div key={i} className="p-3 border rounded-lg space-y-2 relative">
                    <button className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" onClick={() => rmBtn(i)}><X className="w-4 h-4" /></button>
                    <Select value={b.type} onValueChange={(v: BtnType) => upBtn(i, { type: v })}>
                      <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QUICK_REPLY">Quick reply</SelectItem>
                        <SelectItem value="URL">URL / website</SelectItem>
                        <SelectItem value="PHONE_NUMBER">Call phone number</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Button text (max 25 chars)" maxLength={25} value={b.text} onChange={e => upBtn(i, { text: e.target.value })} />
                    {b.type === 'URL' && <Input placeholder="https://..." value={b.url || ''} onChange={e => upBtn(i, { url: e.target.value })} />}
                    {b.type === 'PHONE_NUMBER' && <Input placeholder="+919999999999" value={b.phone_number || ''} onChange={e => upBtn(i, { phone_number: e.target.value })} />}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addBtn} disabled={form.buttons.length >= 10}><Plus className="w-4 h-4 mr-1" /> Add button</Button>
              </TabsContent>

              <TabsContent value="carousel" className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground">2–10 media cards. Each card can have its own image/video, body text, and buttons.</p>
                {form.carousel_cards.map((c, i) => (
                  <div key={i} className="p-3 border rounded-lg space-y-2 relative">
                    <button className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" onClick={() => rmCard(i)}><X className="w-4 h-4" /></button>
                    <div className="text-xs font-semibold text-muted-foreground">Card {i + 1}</div>
                    <Select value={c.header_type} onValueChange={(v: 'image' | 'video') => upCard(i, { header_type: v })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input value={c.header_media_url} onChange={e => upCard(i, { header_media_url: e.target.value })} placeholder="Public media URL" />
                      <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                        <label className="cursor-pointer">
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <input type="file" className="hidden" accept={c.header_type === 'image' ? 'image/*' : 'video/mp4'}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f, (u) => upCard(i, { header_media_url: u })); }} />
                        </label>
                      </Button>
                    </div>
                    <Textarea rows={2} value={c.body} onChange={e => upCard(i, { body: e.target.value })} placeholder="Card description" />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addCard} disabled={form.carousel_cards.length >= 10}><Plus className="w-4 h-4 mr-1" /> Add card</Button>
              </TabsContent>
            </Tabs>

            {/* Live preview + validation */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium"><Eye className="w-4 h-4" /> Preview</div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowPreview(s => !s)}>{showPreview ? 'Hide' : 'Show'}</Button>
              </div>
              {showPreview && (
                <>
                  {detectedVars.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {detectedVars.map(v => (
                        <div key={v}>
                          <Label className="text-[11px]">Sample for {`{{${v}}}`}</Label>
                          <Input value={previewValues[v] || ''} onChange={e => setPreviewValues(p => ({ ...p, [v]: e.target.value }))} placeholder={`e.g. ${v === 'name' ? 'Aisha' : 'value'}`} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-md bg-[#e5ddd5] p-3 max-w-sm mx-auto">
                    <div className="rounded-lg bg-white shadow-sm p-3 text-sm text-slate-800 space-y-1.5">
                      {form.header_type === 'text' && form.header && <div className="font-semibold">{form.header}</div>}
                      {form.header_type === 'image' && form.header_media_url && <img src={form.header_media_url} alt="" className="rounded max-h-32 w-full object-cover" />}
                      <div className="whitespace-pre-wrap break-words">{renderedPreview || <span className="text-slate-400">Your message body will appear here…</span>}</div>
                      {form.footer && <div className="text-[11px] text-slate-500 pt-1">{form.footer}</div>}
                      {form.buttons?.length > 0 && (
                        <div className="pt-2 border-t border-slate-200 mt-2 space-y-1">
                          {form.buttons.map((b, i) => (
                            <div key={i} className="text-center text-[13px] text-blue-600 font-medium py-1">{b.text || '(button)'}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              {validationErrors.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                  <div className="flex items-center gap-1 font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> Meta will reject this — fix before submitting:</div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submitToMeta} disabled={submitting || validationErrors.length > 0}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Submitting…</> : editingMetaId ? 'Update on Meta' : 'Submit to Meta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template locally?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes <b>{pendingDelete?.name}</b> from Reachably. The template stays on Meta — click <b>Sync from Meta</b> to bring it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Templates;

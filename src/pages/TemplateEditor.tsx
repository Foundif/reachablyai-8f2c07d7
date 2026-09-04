import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ArrowLeft, Info, Loader2, Upload, X, Plus, AlertTriangle, FileText, Play, MapPin, Sparkles } from 'lucide-react';
import { resolveWorkspaceId } from '@/lib/workspace';

type TplCategory = 'marketing' | 'utility' | 'authentication' | 'carousel';
type HeaderType = 'none' | 'text' | 'image' | 'video' | 'document' | 'location' | 'carousel';
type BtnType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

interface Btn { type: BtnType; text: string; url?: string; phone_number?: string }
interface CarouselCard { header_media_url: string; header_type: 'image' | 'video'; body: string; buttons: Btn[] }

const emptyForm = () => ({
  name: '', category: 'marketing' as TplCategory, language: 'en',
  header_type: 'none' as HeaderType, header: '', header_media_url: '',
  body: 'Hi {{name}}, welcome to our store!', footer: '',
  buttons: [] as Btn[],
  carousel_cards: [] as CarouselCard[],
});
type Form = ReturnType<typeof emptyForm>;

const extractVars = (s: string): string[] => {
  const set: string[] = [];
  (s || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, v: string) => { if (!set.includes(v)) set.push(v); return _m; });
  return set;
};

const validateTemplateForm = (form: Form) => {
  const errors: string[] = [];
  if (!form.name.trim() || !/^[a-z0-9_]+$/.test(form.name)) {
    errors.push('Name must be lowercase letters, digits, or underscores.');
  }
  const isCarousel = form.category === 'carousel' || form.header_type === 'carousel';
  if (!isCarousel && !form.body.trim()) errors.push('Body is required.');

  const body = (form.body || '').trim();
  if (body) {
    if (/^\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(body)) errors.push("Body can't start with a variable — add some text before {{...}}.");
    if (/\{\{\s*[a-zA-Z0-9_]+\s*\}\}$/.test(body)) errors.push("Body can't end with a variable — add text or punctuation after {{...}}.");
    if (/\}\}\s*\{\{/.test(body)) errors.push("Two variables can't sit next to each other — add words between them.");
    if (/ {2,}/.test(body)) errors.push('Remove double spaces from the body — Meta rejects them.');
    if (/\n{5,}/.test(body)) errors.push('Too many blank lines in the body.');
  }
  if (form.header_type === 'text' && form.header) {
    const h = form.header.trim();
    if (/^\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(h) || /\{\{\s*[a-zA-Z0-9_]+\s*\}\}$/.test(h)) {
      errors.push("Header text can't start or end with a variable.");
    }
    if (extractVars(h).length > 1) errors.push('Header text can contain at most 1 variable.');
    if (h.length > 60) errors.push('Header text must be 60 characters or fewer.');
  }
  if (form.footer && /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(form.footer)) {
    errors.push("Footer can't contain variables — move them into the body.");
  }
  if (['image', 'video', 'document'].includes(form.header_type) && !form.header_media_url) {
    errors.push('Upload or paste a public URL for the header media.');
  }
  if (isCarousel) {
    if (form.carousel_cards.length < 2) errors.push('Carousel templates need at least 2 cards.');
    form.carousel_cards.forEach((c, i) => {
      if (!c.header_media_url) errors.push(`Card ${i + 1} needs an image or video.`);
      if (!c.body.trim()) errors.push(`Card ${i + 1} needs body text.`);
    });
  }
  let urlBtns = 0, phoneBtns = 0;
  for (const b of form.buttons || []) {
    if (!b.text?.trim()) errors.push('Every button needs text.');
    if ((b.text || '').length > 25) errors.push('Button text must be 25 characters or fewer.');
    if (b.type === 'URL') {
      urlBtns++;
      if (!b.url?.trim()) errors.push('URL buttons need a URL.');
      else if (!/^https?:\/\//i.test(b.url.trim())) errors.push('Button URLs must start with https://');
    }
    if (b.type === 'PHONE_NUMBER') {
      phoneBtns++;
      if (!b.phone_number?.trim()) errors.push('Call buttons need a phone number.');
      else if (!/^\+?\d{8,15}$/.test(b.phone_number.trim())) errors.push('Call button number must be digits in international format (e.g. +919999999999).');
    }
  }
  if (urlBtns > 1) errors.push('Only 1 URL button is allowed.');
  if (phoneBtns > 1) errors.push('Only 1 call button is allowed.');
  return errors;
};


const TemplateEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [metaId, setMetaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [metaError, setMetaError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiIssues, setAiIssues] = useState<{ field?: string; message: string; severity?: string }[] | null>(null);


  useEffect(() => {
    if (!user) return;
    (async () => {
      const ws = await resolveWorkspaceId(user.id, profile);
      setWsId(ws);
      if (!id || !ws) { setLoading(false); return; }
      const { data } = await supabase.from('templates' as any).select('*').eq('id', id).maybeSingle();
      const t = data as any;
      if (t) {
        setMetaId(t.meta_template_id || null);
        setForm({
          name: t.name, category: t.category, language: t.language,
          header_type: (t.header_type || (t.header ? 'text' : 'none')) as HeaderType,
          header: t.header || '', header_media_url: t.header_media_url || '',
          body: t.body || '', footer: t.footer || '',
          buttons: (t.buttons || []) as Btn[],
          carousel_cards: (t.carousel_cards || []) as CarouselCard[],
        });
      }
      setLoading(false);
    })();
  }, [user, profile, id]);

  const isCarousel = form.category === 'carousel' || form.header_type === 'carousel';
  const validationErrors = useMemo(() => validateTemplateForm(form), [form]);
  const detectedVars = extractVars(form.body);
  const renderedPreview = form.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, v: string) => previewValues[v] || `{{${v}}}`);

  const uploadMedia = async (file: File, setUrl: (u: string) => void) => {
    if (!wsId) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `template-media/${wsId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('salon-assets').upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('salon-assets').getPublicUrl(path);
      setUrl(pub.publicUrl);
      toast.success('Media uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  /** Uploads several images/videos at once and turns each one into its own card. */
  const uploadManyAsCards = async (files: File[]) => {
    if (!wsId || !files.length) return;
    setUploading(true);
    let added = 0;
    try {
      for (const file of files.slice(0, 10)) {
        const ext = file.name.split('.').pop() || 'bin';
        const path = `template-media/${wsId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from('salon-assets').upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw error;
        const { data: pub } = supabase.storage.from('salon-assets').getPublicUrl(path);
        const isVideo = (file.type || '').startsWith('video');
        setForm(f => f.carousel_cards.length >= 10 ? f : ({
          ...f,
          carousel_cards: [...f.carousel_cards, { header_media_url: pub.publicUrl, header_type: isVideo ? 'video' : 'image', body: '', buttons: [] }],
        }));
        added++;
      }
      toast.success(`${added} ${added === 1 ? 'card' : 'cards'} added`);
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const runAiFix = async (autoApply: boolean) => {
    setAiBusy(true);
    setAiIssues(null);
    try {
      const { data, error } = await supabase.functions.invoke('template-ai-fix', {
        body: { template: form, meta_error: metaError || '' },
      });
      let errBody: any = (data as any)?.error ? data : null;
      if (error && (error as any)?.context?.json) {
        try { errBody = await (error as any).context.json(); } catch { /* ignore */ }
      }
      if (errBody?.error) return toast.error(errBody.error);
      if (error) return toast.error(error.message);

      const issues = ((data as any)?.issues || []) as { field?: string; message: string; severity?: string }[];
      const fixed = (data as any)?.fixed as Partial<Form> | null;
      setAiIssues(issues);

      if (autoApply && fixed) {
        setForm(f => ({
          ...f,
          name: typeof fixed.name === 'string' && !metaId ? fixed.name.toLowerCase().replace(/[^a-z0-9_]/g, '_') : f.name,
          category: (['marketing', 'utility', 'authentication', 'carousel'].includes(String(fixed.category).toLowerCase()) ? String(fixed.category).toLowerCase() : f.category) as TplCategory,
          header: typeof fixed.header === 'string' ? fixed.header : f.header,
          body: typeof fixed.body === 'string' && fixed.body.trim() ? fixed.body : f.body,
          footer: typeof fixed.footer === 'string' ? fixed.footer : f.footer,
          buttons: Array.isArray(fixed.buttons) ? (fixed.buttons as Btn[]) : f.buttons,
        }));
        setMetaError(null);
        toast.success(issues.length ? 'AI fixed the template' : 'Template already looks good');
      } else if (!issues.length) {
        toast.success('AI found no problems with this template');
      } else {
        toast.warning(`AI found ${issues.length} issue(s)`, { description: issues[0].message });
      }
    } finally {
      setAiBusy(false);
    }
  };

  const submitToMeta = async () => {
    if (!wsId) return;
    if (validationErrors.length) {
      toast.error(validationErrors[0], { description: validationErrors.length > 1 ? `+${validationErrors.length - 1} more issue(s)` : undefined });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('template-create', {
      body: { workspace_id: wsId, template_id: metaId, ...form },
    });
    setSubmitting(false);
    let errBody: any = (data as any)?.error ? data : null;
    if (error && (error as any)?.context?.json) {
      try { errBody = await (error as any).context.json(); } catch { /* ignore */ }
    }
    if (errBody?.error) {
      const meta = errBody.meta;
      const friendly = meta?.error_user_msg || meta?.error_user_title || errBody.error || 'Meta rejected this template.';
      setMetaError([meta?.error_user_title, meta?.error_user_msg, errBody.error].filter(Boolean).join(' — '));
      toast.error('Template not accepted', {
        description: `${friendly} — use "Fix with AI" to correct it automatically.`,
        duration: 10000,
      });
      return;
    }
    if (error) return toast.error(error.message);
    setMetaError(null);
    toast.success(`${metaId ? 'Update' : 'Submission'} sent to Meta — status: ${(data as any).status}`);
    navigate('/templates');
  };



  const addBtn = () => setForm(f => ({ ...f, buttons: [...f.buttons, { type: 'QUICK_REPLY', text: 'Reply' }] }));
  const upBtn = (i: number, patch: Partial<Btn>) => setForm(f => ({ ...f, buttons: f.buttons.map((b, ix) => ix === i ? { ...b, ...patch } : b) }));
  const rmBtn = (i: number) => setForm(f => ({ ...f, buttons: f.buttons.filter((_, ix) => ix !== i) }));

  const addCard = () => setForm(f => ({ ...f, carousel_cards: [...f.carousel_cards, { header_media_url: '', header_type: 'image', body: '', buttons: [] }] }));
  const upCard = (i: number, patch: Partial<CarouselCard>) => setForm(f => ({ ...f, carousel_cards: f.carousel_cards.map((c, ix) => ix === i ? { ...c, ...patch } : c) }));
  const rmCard = (i: number) => setForm(f => ({ ...f, carousel_cards: f.carousel_cards.filter((_, ix) => ix !== i) }));

  const MediaPicker = ({ value, kind, onChange }: { value: string; kind: 'image' | 'video' | 'document'; onChange: (u: string) => void }) => (
    <div className="space-y-2">
      {value && kind !== 'document' && (
        <div className="rounded-lg overflow-hidden bg-muted h-28">
          {kind === 'video'
            ? <video src={value} muted controls className="h-28 w-full object-cover" />
            : <img src={value} alt="Selected media preview" className="h-28 w-full object-cover" />}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Public URL (JPG/PNG/MP4/PDF) or upload →" />
        <Button type="button" variant="outline" size="icon" asChild disabled={uploading}>
          <label className="cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <input type="file" className="hidden"
              accept={kind === 'image' ? 'image/png,image/jpeg' : kind === 'video' ? 'video/mp4' : 'application/pdf'}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f, onChange); }} />
          </label>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        We upload this file to Meta as a media handle when you submit — that's what Meta requires for media headers.
      </p>
    </div>
  );

  if (loading) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">Loading…</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        {/* Header bar */}
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}><ArrowLeft className="w-4 h-4" /></Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">{metaId ? 'Edit template' : 'Create template'}</h1>
            <p className="text-xs text-muted-foreground">Submitted straight to Meta for approval.</p>
          </div>
          <Button variant="outline" onClick={() => runAiFix(false)} disabled={aiBusy}>
            {aiBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />} Check with AI
          </Button>
          <Button onClick={submitToMeta} disabled={submitting || validationErrors.length > 0}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Submitting…</> : metaId ? 'Update on Meta' : 'Submit for approval'}
          </Button>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          {/* ============ Form column ============ */}
          <div className="space-y-4 min-w-0">
            <Card className="p-4 space-y-4">
              <div className="text-xs bg-primary/5 border border-primary/20 rounded-md p-2 flex gap-2">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Approval takes minutes to hours. Only approved templates can be used in campaigns and outside the 24-hour window.</span>
              </div>
              <div>
                <Label>Template name <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="welcome_offer" disabled={!!metaId} />
                <p className="text-[11px] text-muted-foreground mt-1">Lowercase, digits, underscores only. Cannot be changed after submission.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Category <span className="text-destructive">*</span></Label>
                  <Select value={form.category} onValueChange={(v: TplCategory) => setForm({ ...form, category: v, header_type: v === 'carousel' ? 'carousel' : (form.header_type === 'carousel' ? 'none' : form.header_type) })}>
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
                  <Label>Language <span className="text-destructive">*</span></Label>
                  <Input value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} placeholder="en" disabled={!!metaId} />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <Tabs defaultValue="content">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="buttons" disabled={isCarousel}>Buttons</TabsTrigger>
                  <TabsTrigger value="carousel" disabled={!isCarousel}>Cards</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-4 pt-4">
                  <div>
                    <Label>Message header <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(['none', 'text', 'image', 'video', 'document', 'location'] as HeaderType[]).map(h => (
                        <button
                          key={h}
                          type="button"
                          disabled={isCarousel}
                          onClick={() => setForm({ ...form, header_type: h })}
                          className={`px-3 py-1.5 rounded-full border text-xs capitalize transition-colors disabled:opacity-40 ${form.header_type === h ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.header_type === 'location' && (
                    <p className="text-[11px] text-muted-foreground">Location headers carry a map pin. You provide the latitude, longitude, name and address when the template is sent.</p>
                  )}
                  {form.header_type === 'text' && (
                    <Input value={form.header} onChange={e => setForm({ ...form, header: e.target.value })} placeholder="Big news!" maxLength={60} />
                  )}
                  {(['image', 'video', 'document'] as string[]).includes(form.header_type) && (
                    <MediaPicker value={form.header_media_url} kind={form.header_type as any} onChange={u => setForm(c => ({ ...c, header_media_url: u }))} />
                  )}

                  <div>
                    <Label>{isCarousel ? 'Intro text (shown above the cards)' : 'Message body'} <span className="text-destructive">*</span></Label>
                    <Textarea rows={7} maxLength={1024} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Hi {{name}}, welcome!" />
                    <div className="flex justify-between mt-1">
                      <p className="text-[11px] text-muted-foreground">Use <code>{'{{name}}'}</code> for variables.</p>
                      <span className="text-[11px] text-muted-foreground">{form.body.length}/1024</span>
                    </div>
                  </div>

                  {!isCarousel && (
                    <div>
                      <Label>Footer <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input value={form.footer} onChange={e => setForm({ ...form, footer: e.target.value })} maxLength={60} placeholder="Reply STOP to opt out" />
                    </div>
                  )}

                  {detectedVars.length > 0 && (
                    <div>
                      <Label className="text-xs">Sample values (used in the preview)</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {detectedVars.map(v => (
                          <Input key={v} value={previewValues[v] || ''} onChange={e => setPreviewValues(p => ({ ...p, [v]: e.target.value }))} placeholder={`{{${v}}} → e.g. ${v === 'name' ? 'Aisha' : 'value'}`} />
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="buttons" className="space-y-3 pt-4">
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

                <TabsContent value="carousel" className="space-y-3 pt-4">
                  <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
                    <p className="text-sm font-medium">Add several photos at once</p>
                    <p className="text-xs text-muted-foreground">
                      Pick 2–10 photos or videos together — each one becomes its own card that customers swipe through. Then just write a line of text under each.
                    </p>
                    <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                      <label className="cursor-pointer">
                        {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                        {uploading ? 'Uploading…' : 'Choose photos'}
                        <input
                          type="file" multiple className="hidden" accept="image/png,image/jpeg,video/mp4"
                          onChange={e => { const fs = Array.from(e.target.files || []); e.currentTarget.value = ''; if (fs.length) uploadManyAsCards(fs); }}
                        />
                      </label>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{form.carousel_cards.length}/10 cards added. Each card needs a photo (or video) and a short description.</p>
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
                      <MediaPicker value={c.header_media_url} kind={c.header_type} onChange={u => upCard(i, { header_media_url: u })} />
                      <Textarea rows={2} value={c.body} onChange={e => upCard(i, { body: e.target.value })} placeholder="Card description" />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addCard} disabled={form.carousel_cards.length >= 10}><Plus className="w-4 h-4 mr-1" /> Add card</Button>
                </TabsContent>
              </Tabs>
            </Card>

            {validationErrors.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-2">
                <div className="flex items-center gap-1 font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> Meta will reject this — fix before submitting:</div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
                <Button size="sm" variant="outline" onClick={() => runAiFix(true)} disabled={aiBusy}>
                  {aiBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />} Fix with AI
                </Button>
              </div>
            )}

            {metaError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-2">
                <div className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Meta rejected this template</div>
                <p className="text-muted-foreground">{metaError}</p>
                <Button size="sm" onClick={() => runAiFix(true)} disabled={aiBusy}>
                  {aiBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />} Fix this with AI
                </Button>
              </div>
            )}

            {aiIssues && aiIssues.length > 0 && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
                <div className="font-semibold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-primary" /> AI review</div>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                  {aiIssues.map((it, i) => <li key={i}><span className="font-medium">{it.field ? `${it.field}: ` : ''}</span>{it.message}</li>)}
                </ul>
                <Button size="sm" variant="outline" onClick={() => runAiFix(true)} disabled={aiBusy}>
                  {aiBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />} Apply AI fixes
                </Button>
              </div>
            )}
            {aiIssues && aiIssues.length === 0 && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
                AI found no compliance problems with this template.
              </div>
            )}

          </div>

          {/* ============ Live preview ============ */}
          <div className="lg:sticky lg:top-6">
            <Card className="overflow-hidden">
              <div className="h-12 flex items-center gap-2 px-3 bg-[#075E54] text-white">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold">B</div>
                <span className="text-sm font-medium">Business Account</span>
              </div>
              <div className="wa-doodle-bg p-3 min-h-[380px] space-y-2">
                {isCarousel ? (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {form.carousel_cards.length === 0 && (
                      <div className="rounded-lg bg-white shadow-sm p-3 text-xs text-slate-400 w-52">Add cards to preview the carousel…</div>
                    )}
                    {form.carousel_cards.map((c, i) => (
                      <div key={i} className="rounded-lg bg-white shadow-sm p-2 w-52 shrink-0 space-y-1.5">
                        {c.header_media_url && c.header_type === 'image'
                          ? <img src={c.header_media_url} alt="" className="rounded w-full h-24 object-cover" />
                          : <div className="rounded w-full h-24 bg-slate-200 flex items-center justify-center text-slate-400"><Play className="w-5 h-5" /></div>}
                        <div className="text-[12px] text-slate-800 whitespace-pre-wrap break-words">{c.body || 'Card text…'}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="rounded-lg bg-white shadow-sm p-2.5 text-sm text-slate-800 space-y-1.5 max-w-[290px]">
                  {form.header_type === 'text' && form.header && <div className="font-semibold">{form.header}</div>}
                  {form.header_type === 'image' && (form.header_media_url
                    ? <img src={form.header_media_url} alt="" className="rounded w-full max-h-40 object-cover" />
                    : <div className="rounded w-full h-28 bg-slate-200" />)}
                  {form.header_type === 'video' && (
                    <div className="rounded w-full h-28 bg-slate-900 flex items-center justify-center text-white/70"><Play className="w-6 h-6" /></div>
                  )}
                  {form.header_type === 'location' && (
                    <div className="rounded w-full bg-slate-100 p-3 flex items-center gap-2 text-slate-600 text-xs"><MapPin className="w-5 h-5" /> Map location (filled in when you send)</div>
                  )}
                  {form.header_type === 'document' && (
                    <div className="rounded w-full bg-slate-100 p-3 flex items-center gap-2 text-slate-600 text-xs"><FileText className="w-5 h-5" /> Document.pdf</div>
                  )}
                  <div className="whitespace-pre-wrap break-words text-[13px]">
                    {renderedPreview || <span className="text-slate-400">Your message body will appear here…</span>}
                  </div>
                  {form.footer && <div className="text-[11px] text-slate-500 pt-0.5">{form.footer}</div>}
                  <div className="text-[10px] text-slate-400 text-right">
                    {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  {form.buttons.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-200 space-y-1">
                      {form.buttons.map((b, i) => (
                        <div key={i} className="text-center text-[13px] text-[#00a5f4] font-medium py-1">{b.text || '(button)'}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default TemplateEditor;

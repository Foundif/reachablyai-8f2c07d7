import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Plus, Megaphone, Send, ArrowLeft, Trash2, Upload, Image as ImageIcon,
  CheckCircle2, AlertTriangle, Clock, ShieldCheck, X,
} from 'lucide-react';
import { resolveWorkspaceId } from '@/lib/workspace';
import ConfirmDialog from '@/components/ConfirmDialog';

// ---------- Types ----------
interface Campaign {
  id: string; name: string; status: string; mode: string; template_id: string | null;
  body_text: string | null; media_urls: string[] | null;
  min_delay_sec: number; max_delay_sec: number;
  total_count: number; sent_count: number; delivered_count: number;
  read_count: number; replied_count: number; failed_count: number; skipped_count: number;
  progress: { done?: number; total?: number } | null;
  created_at: string; scheduled_at: string | null;
}
interface Template { id: string; name: string; status: string; body: string; variables: string[]; category?: string; }
interface Lead { id: string; name: string; phone: string | null; }
interface Recipient {
  id: string; phone: string; name: string | null; status: string;
  error: string | null; sent_at: string | null; reachable: boolean | null; reason: string | null;
}
type Contact = { name: string; phone: string; leadId?: string };

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-600', scheduled: 'bg-blue-500/15 text-blue-600',
  sending: 'bg-amber-500/15 text-amber-600', sent: 'bg-emerald-500/15 text-emerald-600',
  failed: 'bg-red-500/15 text-red-600', pending: 'bg-slate-500/15 text-slate-600',
  delivered: 'bg-blue-500/15 text-blue-600', read: 'bg-emerald-500/15 text-emerald-600',
  replied: 'bg-emerald-500/15 text-emerald-600', skipped: 'bg-orange-500/15 text-orange-600',
};

const cleanPhone = (v: string) => v.replace(/[^\d]/g, '');

// ---------- Wizard ----------
function BulkWizard({
  open, onOpenChange, wsId, userId, onCreated, leads, templates,
}: {
  open: boolean; onOpenChange: (b: boolean) => void; wsId: string; userId: string;
  onCreated: (id: string) => void; leads: Lead[]; templates: Template[];
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'template' | 'freeform'>('template');
  const [source, setSource] = useState<'leads' | 'csv'>('leads');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [csvContacts, setCsvContacts] = useState<Contact[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [reachCheck, setReachCheck] = useState<{ ok: number; skip: number; loading: boolean }>({ ok: 0, skip: 0, loading: false });
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1); setName(''); setMode('template'); setSource('leads');
    setSelectedLeadIds([]); setCsvContacts([]); setTemplateId(''); setBodyText('');
    setMediaUrls([]); setReachCheck({ ok: 0, skip: 0, loading: false });
  };

  const contacts: Contact[] = useMemo(() => {
    if (source === 'csv') return csvContacts;
    return leads.filter((l) => selectedLeadIds.includes(l.id) && l.phone)
      .map((l) => ({ name: l.name, phone: cleanPhone(l.phone!), leadId: l.id }))
      .filter((c) => c.phone.length >= 10);
  }, [source, csvContacts, leads, selectedLeadIds]);

  // CSV parsing
  const handleCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines.map((l) => l.split(',').map((s) => s.trim()));
      const header = rows[0].map((h) => h.toLowerCase());
      const nameIdx = header.findIndex((h) => h.includes('name'));
      const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('number'));
      const dataStart = phoneIdx >= 0 ? 1 : 0;
      const parsed: Contact[] = [];
      for (let i = dataStart; i < rows.length; i++) {
        const r = rows[i];
        const phone = cleanPhone(phoneIdx >= 0 ? r[phoneIdx] || '' : r[0] || '');
        const nm = nameIdx >= 0 ? r[nameIdx] || '' : (r[1] || '');
        if (phone.length >= 10) parsed.push({ name: nm || 'Contact', phone });
      }
      setCsvContacts(parsed);
      toast.success(`${parsed.length} contacts parsed from CSV`);
    };
    reader.readAsText(file);
  };

  // Reachability preview (only meaningful for freeform)
  const runReachCheck = async () => {
    setReachCheck({ ok: 0, skip: 0, loading: true });
    if (mode === 'template') {
      setReachCheck({ ok: contacts.length, skip: 0, loading: false });
      return;
    }
    const phones = contacts.map((c) => c.phone);
    const { data } = await supabase.from('wa_conversations' as any)
      .select('contact_phone,window_expires_at')
      .eq('workspace_id', wsId).in('contact_phone', phones);
    const openSet = new Set<string>();
    const now = Date.now();
    ((data as any[]) || []).forEach((c) => {
      if (c.window_expires_at && new Date(c.window_expires_at).getTime() > now) openSet.add(c.contact_phone);
    });
    const ok = phones.filter((p) => openSet.has(p)).length;
    setReachCheck({ ok, skip: phones.length - ok, loading: false });
  };

  const handleImageUpload = async (files: FileList) => {
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const path = `${wsId}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('campaign-media').upload(path, file, { upsert: false });
      if (upErr) { toast.error(upErr.message); continue; }
      const { data: signed } = await supabase.storage.from('campaign-media').createSignedUrl(path, 60 * 60 * 24 * 30);
      if (signed?.signedUrl) uploaded.push(signed.signedUrl);
    }
    setMediaUrls((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const create = async () => {
    if (!name.trim()) return toast.error('Campaign name required');
    if (contacts.length === 0) return toast.error('Add at least one recipient');
    if (mode === 'template' && !templateId) return toast.error('Pick an approved template');
    if (mode === 'freeform' && !bodyText.trim() && mediaUrls.length === 0) return toast.error('Add message text or at least one image');

    setCreating(true);
    const { data: campaign, error } = await supabase.from('campaigns' as any).insert({
      workspace_id: wsId, name: name.trim(), mode,
      template_id: mode === 'template' ? templateId : null,
      body_text: mode === 'freeform' ? bodyText : null,
      media_urls: mode === 'freeform' ? mediaUrls : [],
      min_delay_sec: 0, max_delay_sec: 0,
      status: 'draft', total_count: contacts.length, created_by: userId,
    }).select().single();

    if (error || !campaign) { setCreating(false); return toast.error(error?.message || 'Failed'); }
    const recipients = contacts.map((c) => ({
      campaign_id: (campaign as any).id, workspace_id: wsId,
      lead_id: c.leadId || null, phone: c.phone, name: c.name,
      variables: { name: c.name }, status: 'pending',
    }));
    const { error: rErr } = await supabase.from('campaign_recipients' as any).insert(recipients);
    setCreating(false);
    if (rErr) return toast.error(rErr.message);
    toast.success('Campaign created');
    onOpenChange(false); reset();
    onCreated((campaign as any).id);
  };

  const stepLabel = ['Mode', 'Recipients', 'Compose', 'Safety & Review'][step - 1];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New bulk campaign — Step {step}/4: {stepLabel}</DialogTitle>
        </DialogHeader>

        {/* progress */}
        <div className="flex gap-1 mb-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Campaign name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. August promo" />
            </div>
            <div>
              <Label>Message type</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="grid gap-3 mt-2">
                <label className={`border rounded-lg p-4 cursor-pointer flex gap-3 ${mode === 'template' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="template" id="m-tpl" />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> Meta approved template
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Works for any contact, any time. Required for marketing outside the 24h window. Includes carousel templates.
                    </p>
                  </div>
                </label>
                <label className={`border rounded-lg p-4 cursor-pointer flex gap-3 ${mode === 'freeform' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="freeform" id="m-ff" />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" /> Free-form (text + images)
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Send your own message with up to 10 images as a sequence. Only delivered to contacts inside Meta's 24h service window; others are skipped and reported.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <RadioGroup value={source} onValueChange={(v) => setSource(v as any)} className="grid grid-cols-2 gap-3">
              <label className={`border rounded-lg p-3 cursor-pointer flex items-center gap-2 ${source === 'leads' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem value="leads" /> <span className="font-medium">From Leads ({leads.length})</span>
              </label>
              <label className={`border rounded-lg p-3 cursor-pointer flex items-center gap-2 ${source === 'csv' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem value="csv" /> <span className="font-medium">Upload CSV</span>
              </label>
            </RadioGroup>

            {source === 'leads' ? (
              <div className="border rounded-md">
                <div className="p-2 flex gap-2 border-b sticky top-0 bg-background">
                  <Button size="sm" variant="outline" onClick={() => setSelectedLeadIds(leads.filter(l => l.phone).map(l => l.id))}>Select all</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedLeadIds([])}>Clear</Button>
                  <div className="ml-auto text-sm text-muted-foreground self-center">{selectedLeadIds.length} selected</div>
                </div>
                <div className="max-h-64 overflow-auto">
                  {leads.length === 0 && <div className="p-6 text-sm text-center text-muted-foreground">No leads with phone numbers yet.</div>}
                  {leads.map((l) => (
                    <label key={l.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer text-sm">
                      <Checkbox
                        checked={selectedLeadIds.includes(l.id)}
                        onCheckedChange={(c) => setSelectedLeadIds((prev) => c ? [...prev, l.id] : prev.filter(x => x !== l.id))}
                      />
                      <span className="flex-1">{l.name}</span>
                      <span className="text-muted-foreground">{l.phone}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border rounded-md p-4 text-center space-y-3">
                <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleCsv(e.target.files[0])} />
                <Button variant="outline" onClick={() => csvRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" /> Choose CSV file
                </Button>
                <p className="text-xs text-muted-foreground">
                  CSV must have headers like <code>name,phone</code>. Phones auto-cleaned. {csvContacts.length > 0 && <span className="font-medium text-emerald-600">{csvContacts.length} contacts loaded.</span>}
                </p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {mode === 'template' ? (
              <div>
                <Label>Approved template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue placeholder={templates.length ? 'Select template' : 'No approved templates'} /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.category ? `· ${t.category}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <Link className="underline" to="/templates">Create & submit a template to Meta</Link> first.
                  </p>
                )}
                {templateId && (
                  <Card className="p-3 mt-3 bg-muted/40">
                    <p className="text-xs text-muted-foreground mb-1">Preview</p>
                    <div className="text-sm whitespace-pre-wrap">{templates.find(t => t.id === templateId)?.body}</div>
                  </Card>
                )}
              </div>
            ) : (
              <>
                <div>
                  <Label>Message text</Label>
                  <Textarea rows={5} value={bodyText} onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Hi {{name}}, here's our offer..." />
                  <p className="text-xs text-muted-foreground mt-1">Use <code>{'{{name}}'}</code> to personalize. Text goes as caption if you attach a single image, else as a separate message.</p>
                </div>
                <div>
                  <Label>Images (optional, up to 10 — sent as sequence)</Label>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => e.target.files && handleImageUpload(e.target.files)} />
                  <div className="flex gap-2 flex-wrap mt-2">
                    {mediaUrls.map((u, i) => (
                      <div key={i} className="relative w-20 h-20 rounded border overflow-hidden group">
                        <img src={u} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setMediaUrls(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-0 right-0 bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {mediaUrls.length < 10 && (
                      <button onClick={() => fileRef.current?.click()} disabled={uploading}
                        className="w-20 h-20 rounded border-2 border-dashed flex flex-col items-center justify-center text-xs text-muted-foreground hover:border-primary">
                        <ImageIcon className="w-5 h-5 mb-1" />
                        {uploading ? '...' : 'Add'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300">
              <div className="flex gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-emerald-900 dark:text-emerald-200">Optimized high-speed delivery</p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
                    Messages are queued immediately. Meta automatically manages throughput for your WhatsApp Business account.
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid gap-2">
              <Button variant="outline" onClick={runReachCheck} disabled={reachCheck.loading}>
                {reachCheck.loading ? 'Checking...' : 'Check reachability'}
              </Button>
              {(reachCheck.ok > 0 || reachCheck.skip > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3 flex items-center gap-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div><div className="font-bold">{reachCheck.ok}</div><div className="text-xs">Will send</div></div>
                  </Card>
                  <Card className="p-3 flex items-center gap-2 border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <div><div className="font-bold">{reachCheck.skip}</div><div className="text-xs">{mode === 'freeform' ? 'Outside 24h window' : 'Unreachable'}</div></div>
                  </Card>
                </div>
              )}
            </div>

            <Card className="p-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">Name:</span> {name}</div>
              <div><span className="text-muted-foreground">Mode:</span> {mode === 'template' ? 'Meta template' : 'Free-form'}</div>
              <div><span className="text-muted-foreground">Recipients:</span> {contacts.length}</div>
              <div><span className="text-muted-foreground">Delivery:</span> Starts immediately</div>
            </Card>
          </div>
        )}

        <DialogFooter className="mt-4 flex justify-between sm:justify-between">
          <Button variant="ghost" onClick={() => step === 1 ? onOpenChange(false) : setStep(step - 1)}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step < 4 ? (
            <Button onClick={() => {
              if (step === 1 && !name.trim()) return toast.error('Enter a campaign name');
              if (step === 2 && contacts.length === 0) return toast.error('Add recipients');
              if (step === 3 && mode === 'template' && !templateId) return toast.error('Pick a template');
              if (step === 3 && mode === 'freeform' && !bodyText.trim() && mediaUrls.length === 0) return toast.error('Add text or images');
              setStep(step + 1);
            }}>Next</Button>
          ) : (
            <Button onClick={create} disabled={creating} className="gap-2">
              <Send className="w-4 h-4" /> {creating ? 'Creating...' : 'Create campaign'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- List page ----------
const CampaignsList = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [wsId, setWsId] = useState<string | null>(null);
  const [items, setItems] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const id = await resolveWorkspaceId(user.id, profile);
    setWsId(id);
    if (!id) { setLoading(false); return; }
    const [{ data: cs }, { data: ts }, { data: ls }] = await Promise.all([
      supabase.from('campaigns' as any).select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
      supabase.from('templates' as any).select('id,name,status,body,variables,category').eq('workspace_id', id).eq('status', 'approved'),
      supabase.from('leads' as any).select('id,name,phone').eq('workspace_id', id).not('phone', 'is', null),
    ]);
    setItems((cs as any) || []);
    setTemplates((ts as any) || []);
    setLeads((ls as any) || []);
    setLoading(false);
    // Auto-sync approved templates from Meta so freshly-approved ones show up in the picker
    supabase.functions.invoke('template-sync', { body: { workspace_id: id } })
      .then(async ({ error }) => {
        if (error) return;
        const { data: ts2 } = await supabase.from('templates' as any).select('id,name,status,body,variables,category').eq('workspace_id', id).eq('status', 'approved');
        setTemplates((ts2 as any) || []);
      }).catch(() => {});
  };
  useEffect(() => { load(); }, [user, profile]);

  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null);
  const confirmDelete = async () => {
    const c = pendingDelete;
    if (!c) return;
    setPendingDelete(null);
    const { error } = await supabase.from('campaigns' as any).delete().eq('id', c.id);
    if (error) return toast.error(error.message);
    toast.success('Campaign deleted');
    load();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Megaphone className="w-6 h-6" /> Campaigns
            </h1>
            <p className="text-muted-foreground text-sm">Bulk WhatsApp campaigns with safe pacing. Send Meta templates to anyone, or free-form text + images to contacts inside the 24h window.</p>
          </div>
          <Button className="gap-2" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> New Campaign</Button>
          {wsId && user && (
            <BulkWizard
              open={open} onOpenChange={setOpen} wsId={wsId} userId={user.id}
              onCreated={(id) => { load(); navigate(`/campaigns/${id}`); }}
              leads={leads} templates={templates}
            />
          )}
        </div>

        <Card className="overflow-hidden">
          {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
          : items.length === 0 ? (
            <div className="p-12 text-center">
              <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No campaigns yet</p>
              <p className="text-sm text-muted-foreground">Create your first bulk broadcast in 4 quick steps.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead>
                  <TableHead>Total</TableHead><TableHead>Sent</TableHead><TableHead>Skipped</TableHead>
                  <TableHead>Failed</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/campaigns/${c.id}`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="outline">{c.mode === 'freeform' ? 'Free-form' : 'Template'}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_STYLES[c.status]}>{c.status}</Badge></TableCell>
                    <TableCell>{c.total_count}</TableCell>
                    <TableCell>{c.sent_count}</TableCell>
                    <TableCell>{c.skipped_count || 0}</TableCell>
                    <TableCell>{c.failed_count}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => setPendingDelete(c)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete campaign?"
        description={<>Campaign <b>{pendingDelete?.name}</b> and its recipient log will be permanently deleted.</>}
        confirmLabel="Delete campaign"
        onConfirm={confirmDelete}
      />
    </AppLayout>
  );
};

// ---------- Detail page ----------
export const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<number | null>(null);

  const load = async () => {
    if (!id) return;
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from('campaigns' as any).select('*').eq('id', id).maybeSingle(),
      supabase.from('campaign_recipients' as any).select('id,phone,name,status,error,sent_at,reachable,reason').eq('campaign_id', id).order('created_at'),
    ]);
    setCampaign(c as any);
    setRecipients((r as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  // Poll while sending
  useEffect(() => {
    if (campaign?.status === 'sending') {
      pollRef.current = window.setInterval(load, 2500);
      return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
    }
  }, [campaign?.status]);

  const dispatch = async () => {
    if (!campaign) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('campaign-dispatch', { body: { campaign_id: campaign.id } });
    setSending(false);
    if (error) return toast.error(error.message || 'Dispatch failed');
    const summary = data as any;
    if (summary?.error) return toast.error(summary.error);
    toast.success(`${summary?.sent || 0} sent · ${summary?.skipped || 0} skipped · ${summary?.failed || 0} failed`);
    load();
  };

  const progress = useMemo(() => {
    if (!campaign) return 0;
    const done = (campaign.sent_count || 0) + (campaign.failed_count || 0) + (campaign.skipped_count || 0);
    return campaign.total_count ? Math.round((done / campaign.total_count) * 100) : 0;
  }, [campaign]);

  if (loading) return <AppLayout><div className="p-8">Loading…</div></AppLayout>;
  if (!campaign) return <AppLayout><div className="p-8">Campaign not found.</div></AppLayout>;

  const stats = [
    { l: 'Total', v: campaign.total_count },
    { l: 'Sent', v: campaign.sent_count },
    { l: 'Delivered', v: campaign.delivered_count },
    { l: 'Read', v: campaign.read_count },
    { l: 'Skipped', v: campaign.skipped_count || 0 },
    { l: 'Failed', v: campaign.failed_count },
  ];

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate('/campaigns')}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <Badge variant="outline" className={STATUS_STYLES[campaign.status]}>{campaign.status}</Badge>
          <Badge variant="outline">{campaign.mode === 'freeform' ? 'Free-form' : 'Template'}</Badge>
          <div className="ml-auto">
            {['draft', 'failed'].includes(campaign.status) && (
              <Button onClick={dispatch} disabled={sending} className="gap-2">
                <Send className="w-4 h-4" /> {sending ? 'Starting…' : 'Send now'}
              </Button>
            )}
          </div>
        </div>

        {(campaign.status === 'sending' || progress > 0) && (
          <Card className="p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">
                Progress · optimized delivery
              </span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} />
          </Card>
        )}

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {stats.map((s) => (
            <Card key={s.l} className="p-4">
              <div className="text-xs text-muted-foreground">{s.l}</div>
              <div className="text-2xl font-bold">{s.v}</div>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Phone</TableHead>
                <TableHead>Status</TableHead><TableHead>Sent at</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name || '—'}</TableCell>
                  <TableCell>{r.phone}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_STYLES[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell className="text-xs">{r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs whitespace-normal break-words">{r.error || r.reason || ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CampaignsList;

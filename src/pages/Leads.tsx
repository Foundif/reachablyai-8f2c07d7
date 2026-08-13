import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Plus, Search, Upload, MessageCircle, LayoutGrid, List, Trash2, Tag, Globe, Loader2, Sparkles,
  StickyNote, KeyRound, BookOpen, Save,
} from 'lucide-react';
import { resolveWorkspaceId } from '@/lib/workspace';
import ConfirmDialog from '@/components/ConfirmDialog';

type LeadStatus = 'new' | 'contacted' | 'converted' | 'lost';
type LeadSource = 'manual' | 'csv' | 'meta_ads' | 'scraped' | 'booking';

interface Lead {
  id: string;
  workspace_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  tags: string[];
  notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  contacted: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  converted: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  lost: 'bg-red-500/15 text-red-600 border-red-500/30',
};

const SOURCE_COLORS: Record<LeadSource, string> = {
  manual: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
  csv: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30',
  meta_ads: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  scraped: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  booking: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
};

const TEMPS = ['hot', 'warm', 'cold'] as const;
const TEMP_COLORS: Record<string, string> = {
  hot: 'bg-red-500/15 text-red-600 border-red-500/30',
  warm: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  cold: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
};
const tempOf = (tags: string[] = []) => TEMPS.find(t => tags.map(x => x.toLowerCase()).includes(t)) || null;

// Detect the delimiter actually used by the file (Excel/DB exports often use ; or tab)
function detectDelimiter(text: string): string {
  const firstLine = (text.split(/\r?\n/).find(l => l.trim()) || '');
  const candidates = [',', ';', '\t', '|'];
  let best = ',', bestCount = 0;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

// Tiny CSV parser (supports quoted fields and custom delimiters)
function parseCSV(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delimiter) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cell += c;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());


const Leads = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'cards' | 'table'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [tempFilter, setTempFilter] = useState('all');
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [noteDraft, setNoteDraft] = useState({ notes: '', tags: '' });
  const [addOpen, setAddOpen] = useState(false);
  const [wsId, setWsId] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<Lead | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const [form, setForm] = useState({ name: '', phone: '', email: '', tags: '' });

  // Deep link from Home: /leads?import=1 opens the CSV file picker
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('import') === '1') {
      const t = setTimeout(() => csvInputRef.current?.click(), 300);
      return () => clearTimeout(t);
    }
  }, []);

  const loadWorkspace = async () => {
    if (!user) return;
    setWsId(await resolveWorkspaceId(user.id, profile));
  };

  const loadLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load leads: ' + error.message);
    setLeads((data as any as Lead[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadWorkspace(); loadLeads(); }, [user, profile]);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.email?.toLowerCase().includes(q))) return false;
      }
      if (tempFilter !== 'all' && tempOf(l.tags) !== tempFilter) return false;
      return true;
    });
  }, [leads, statusFilter, sourceFilter, search, tempFilter]);

  const openNotes = (l: Lead) => {
    setNoteLead(l);
    setNoteDraft({ notes: l.notes || '', tags: (l.tags || []).join(', ') });
  };
  const saveNotes = async () => {
    if (!noteLead) return;
    const tags = noteDraft.tags.split(',').map(t => t.trim()).filter(Boolean);
    const { error } = await supabase.from('leads' as any)
      .update({ notes: noteDraft.notes.trim() || null, tags }).eq('id', noteLead.id);
    if (error) return toast.error(error.message);
    setLeads(prev => prev.map(l => l.id === noteLead.id ? { ...l, notes: noteDraft.notes, tags } : l));
    setNoteLead(null);
    toast.success('Notes saved');
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return toast.error('Name required');
    if (!wsId) return toast.error('Workspace not ready');
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    const { error } = await supabase.from('leads' as any).insert({
      workspace_id: wsId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      source: 'manual',
      tags,
    });
    if (error) return toast.error(error.message);
    toast.success('Lead added');
    setAddOpen(false);
    setForm({ name: '', phone: '', email: '', tags: '' });
    loadLeads();
  };

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    const { error } = await supabase.from('leads' as any).update({ status }).eq('id', id);
    if (error) return toast.error(error.message);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  };

  const handleDelete = (l: Lead) => setPendingDelete(l);
  const confirmDelete = async () => {
    const l = pendingDelete;
    if (!l) return;
    setPendingDelete(null);
    const { error } = await supabase.from('leads' as any).delete().eq('id', l.id);
    if (error) return toast.error(error.message);
    setLeads(prev => prev.filter(x => x.id !== l.id));
    toast.success('Lead deleted');
  };

  const handleOpenWhatsApp = (l: Lead) => {
    if (!l.phone) return toast.error('No phone number');
    const digits = l.phone.replace(/\D/g, '');
    navigate(`/inbox?phone=${encodeURIComponent(digits)}&name=${encodeURIComponent(l.name || '')}`);
  };

  const handleCsvUpload = async (file: File) => {
    if (!wsId) return toast.error('Workspace not ready');
    const raw = await file.text();
    const text = raw.replace(/^\uFEFF/, '');
    const rows = parseCSV(text, detectDelimiter(text));
    if (rows.length < 2) return toast.error('CSV appears empty');
    const headers = rows[0].map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const find = (...keys: string[]) => headers.findIndex(h => keys.some(k => h === k || h.includes(k)));
    const nameIdx = find('name', 'contact', 'business');
    const phoneIdx = find('phone', 'mobile', 'whatsapp', 'number');
    const emailIdx = find('email', 'mail');
    const tagsIdx = find('tags', 'tag');
    const notesIdx = find('notes', 'note', 'address');
    const statusIdx = find('status');
    if (nameIdx === -1 && phoneIdx === -1) {
      return toast.error('Could not find a "name" or "phone" column. Make sure the first row is a header row.');
    }
    const val = (r: string[], i: number) => (i >= 0 ? (r[i] || '').trim().replace(/^"|"$/g, '') : '');
    const validStatus = ['new', 'contacted', 'converted', 'lost'];
    const payload = rows.slice(1)
      .filter(r => r.some(c => c.trim()))
      .map(r => {
        const phone = val(r, phoneIdx);
        const status = val(r, statusIdx).toLowerCase();
        const tags = val(r, tagsIdx)
          .replace(/^[\[{]|[\]}]$/g, '')
          .split(/[,;|]/).map(t => t.trim().replace(/^"|"$/g, '')).filter(Boolean);
        return {
          workspace_id: wsId,
          name: val(r, nameIdx) || phone || 'Unnamed',
          phone: phone && !isUuid(phone) ? phone : null,
          email: val(r, emailIdx) || null,
          notes: val(r, notesIdx) || null,
          tags,
          status: validStatus.includes(status) ? status : 'new',
          source: 'csv' as const,
        };
      })
      .filter(p => !isUuid(p.name) && (p.phone || p.email || p.name !== 'Unnamed'));
    if (!payload.length) return toast.error('No valid rows found in this file');
    // batch insert in chunks of 100
    for (let i = 0; i < payload.length; i += 100) {
      const chunk = payload.slice(i, i + 100);
      const { error } = await supabase.from('leads' as any).insert(chunk);
      if (error) { toast.error('Import failed: ' + error.message); return; }
    }
    toast.success(`Imported ${payload.length} contact(s)`);
    if (csvInputRef.current) csvInputRef.current.value = '';
    loadLeads();
  };

  // ---- Bulk selection ----
  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allVisibleSelected = filtered.length > 0 && filtered.every(l => selected.has(l.id));
  const toggleSelectAll = () =>
    setSelected(allVisibleSelected ? new Set() : new Set(filtered.map(l => l.id)));

  const confirmBulkDelete = async () => {
    const ids = Array.from(selected);
    setBulkOpen(false);
    if (!ids.length) return;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error } = await supabase.from('leads' as any).delete().in('id', chunk);
      if (error) { toast.error(error.message); loadLeads(); return; }
    }
    setLeads(prev => prev.filter(l => !selected.has(l.id)));
    setSelected(new Set());
    toast.success(`${ids.length} contact(s) deleted`);
  };


  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Contacts</h1>
            <p className="text-muted-foreground text-sm mt-1">Your unified contact book — WhatsApp chats, ads, imports and scraped businesses.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={csvInputRef}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f); }}
            />
            <Button variant="outline" className="flex-1 sm:flex-none min-w-[140px]" onClick={() => csvInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Import CSV
            </Button>
            <ScrapeLeadsDialog wsId={wsId} onDone={loadLeads} />
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-none min-w-[140px]">
                  <Plus className="w-4 h-4 mr-2" /> Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Name *</label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Phone (WhatsApp)</label>
                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91..." />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Email</label>
                    <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Tags (comma separated)</label>
                    <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="vip, referral" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button onClick={handleAdd}>Add Contact</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, email…" className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="meta_ads">Meta Ads</SelectItem>
                <SelectItem value="scraped">Scraped</SelectItem>
                <SelectItem value="booking">Booking</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tempFilter} onValueChange={setTempFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All temperatures</SelectItem>
                <SelectItem value="hot">🔥 Hot leads</SelectItem>
                <SelectItem value="warm">🌤 Warm leads</SelectItem>
                <SelectItem value="cold">❄️ Cold leads</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-1">
              <Button variant={view === 'table' ? 'default' : 'outline'} size="icon" onClick={() => setView('table')}>
                <List className="w-4 h-4" />
              </Button>
              <Button variant={view === 'cards' ? 'default' : 'outline'} size="icon" onClick={() => setView('cards')}>
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <Card className="p-3 flex flex-wrap items-center gap-3 border-primary/40">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setBulkOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete selected
            </Button>
          </Card>
        )}

        {/* Results */}
        {loading ? (
          <Card className="p-12 text-center text-muted-foreground">Loading…</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No contacts yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Add one manually, import a CSV, or wait for inbound WhatsApp messages to auto-create contacts.</p>
          </Card>
        ) : view === 'table' ? (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => (
                  <TableRow key={l.id} data-state={selected.has(l.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} aria-label={`Select ${l.name}`} />
                    </TableCell>
                    <TableCell className="font-medium">{l.name}</TableCell>

                    <TableCell className="text-sm text-muted-foreground">{l.phone || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={SOURCE_COLORS[l.source]}>{l.source}</Badge></TableCell>
                    <TableCell>
                      <Select value={l.status} onValueChange={(v) => handleStatusChange(l.id, v as LeadStatus)}>
                        <SelectTrigger className={`h-7 w-[120px] text-xs ${STATUS_COLORS[l.status]}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {l.tags?.length ? l.tags.slice(0, 3).map(t => (
                        <Badge key={t} variant="outline" className={`mr-1 text-[10px] ${TEMP_COLORS[t.toLowerCase()] || ''}`}>{t}</Badge>
                      )) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenWhatsApp(l)} title="Open WhatsApp">
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openNotes(l)} title="Notes & tags">
                        <StickyNote className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(l)} title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(l => (
              <Card key={l.id} className={`p-4 hover:shadow-glow transition-shadow ${selected.has(l.id) ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Checkbox className="mt-1" checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} aria-label={`Select ${l.name}`} />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{l.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{l.phone || l.email || '—'}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={SOURCE_COLORS[l.source]}>{l.source}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline" className={STATUS_COLORS[l.status]}>{l.status}</Badge>
                  {l.tags?.slice(0, 2).map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px]"><Tag className="w-3 h-3 mr-1" />{t}</Badge>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleOpenWhatsApp(l)}>
                    <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(l)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {filtered.length} of {leads.length} contact(s) · Inbound WhatsApp messages automatically create contacts.
        </p>
      </div>
      <Dialog open={!!noteLead} onOpenChange={(o) => !o && setNoteLead(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notes for {noteLead?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Tags (comma separated — e.g. hot, Coimbatore, salon)</label>
              <Input value={noteDraft.tags} onChange={e => setNoteDraft({ ...noteDraft, tags: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea rows={5} value={noteDraft.notes} onChange={e => setNoteDraft({ ...noteDraft, notes: e.target.value })} placeholder="Call summary, requirements, follow-up date…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteLead(null)}>Cancel</Button>
            <Button onClick={saveNotes}><Save className="w-4 h-4 mr-1" /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete this contact?"
        description={<>Contact <b>{pendingDelete?.name}</b> will be permanently removed. This cannot be undone.</>}
        confirmLabel="Delete contact"
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Delete ${selected.size} contact(s)?`}
        description={<>The selected contacts will be permanently removed. This cannot be undone.</>}
        confirmLabel="Delete contacts"
        onConfirm={confirmBulkDelete}
      />
    </AppLayout>
  );
};

export default Leads;

declare global { interface Window { Razorpay?: any } }
const loadRazorpay = () => new Promise<boolean>((resolve) => {
  if (window.Razorpay) return resolve(true);
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = () => resolve(true);
  s.onerror = () => resolve(false);
  document.body.appendChild(s);
});


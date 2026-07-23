import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Plus, Search, Upload, MessageCircle, LayoutGrid, List, Trash2, Tag, Globe, Loader2, Sparkles,
} from 'lucide-react';
import { resolveWorkspaceId } from '@/lib/workspace';

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

// Tiny CSV parser (supports quoted fields, commas inside quotes)
function parseCSV(text: string): string[][] {
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
      else if (c === ',') { row.push(cell); cell = ''; }
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

const Leads = () => {
  const { user, profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'cards' | 'table'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [wsId, setWsId] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ name: '', phone: '', email: '', tags: '' });

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
      return true;
    });
  }, [leads, statusFilter, sourceFilter, search]);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    const { error } = await supabase.from('leads' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    setLeads(prev => prev.filter(l => l.id !== id));
    toast.success('Deleted');
  };

  const handleOpenWhatsApp = (l: Lead) => {
    if (!l.phone) return toast.error('No phone number');
    const digits = l.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${digits}`, '_blank');
  };

  const handleCsvUpload = async (file: File) => {
    if (!wsId) return toast.error('Workspace not ready');
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return toast.error('CSV appears empty');
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const nameIdx = headers.findIndex(h => h.includes('name'));
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('whatsapp'));
    const emailIdx = headers.findIndex(h => h.includes('email'));
    if (nameIdx === -1 && phoneIdx === -1) return toast.error('Need a "name" or "phone" column');
    const payload = rows.slice(1)
      .filter(r => r.some(c => c.trim()))
      .map(r => ({
        workspace_id: wsId,
        name: (nameIdx >= 0 ? r[nameIdx] : r[phoneIdx] || '').trim() || 'Unnamed',
        phone: phoneIdx >= 0 ? r[phoneIdx]?.trim() || null : null,
        email: emailIdx >= 0 ? r[emailIdx]?.trim() || null : null,
        source: 'csv' as const,
      }));
    // batch insert in chunks of 100
    for (let i = 0; i < payload.length; i += 100) {
      const chunk = payload.slice(i, i + 100);
      const { error } = await supabase.from('leads' as any).insert(chunk);
      if (error) { toast.error('Import failed: ' + error.message); return; }
    }
    toast.success(`Imported ${payload.length} lead(s)`);
    if (csvInputRef.current) csvInputRef.current.value = '';
    loadLeads();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Leads</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage prospects across all channels — WhatsApp, ads, imports, bookings.</p>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={csvInputRef}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f); }}
            />
            <Button variant="outline" onClick={() => csvInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Import CSV
            </Button>
            <ScrapeLeadsDialog wsId={wsId} onDone={loadLeads} />
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" /> Add Lead
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add lead</DialogTitle></DialogHeader>
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
                  <Button onClick={handleAdd}>Add Lead</Button>
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

        {/* Results */}
        {loading ? (
          <Card className="p-12 text-center text-muted-foreground">Loading…</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No leads yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Add one manually, import a CSV, or wait for bookings to auto-create leads.</p>
          </Card>
        ) : view === 'table' ? (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableRow key={l.id}>
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
                        <Badge key={t} variant="secondary" className="mr-1 text-[10px]">{t}</Badge>
                      )) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenWhatsApp(l)} title="Open WhatsApp">
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)} title="Delete">
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
              <Card key={l.id} className="p-4 hover:shadow-glow transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{l.name}</p>
                    <p className="text-sm text-muted-foreground">{l.phone || l.email || '—'}</p>
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
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(l.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {filtered.length} of {leads.length} lead(s) · New bookings automatically create leads.
        </p>
      </div>
    </AppLayout>
  );
};

export default Leads;

function ScrapeLeadsDialog({ wsId, onDone }: { wsId: string | null; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    keyword: '', location: '',
    hasWebsite: 'any' as 'any' | 'yes' | 'no',
    requirePhone: true,
    minRating: '', minReviews: '',
    maxResults: 40,
  });
  const [result, setResult] = useState<any | null>(null);

  const run = async () => {
    if (!wsId) return toast.error('Workspace not ready');
    if (!form.keyword.trim()) return toast.error('Enter a keyword like "salons" or "cafes"');
    setLoading(true); setResult(null);
    const { data, error } = await supabase.functions.invoke('leads-scrape', {
      body: {
        workspace_id: wsId,
        keyword: form.keyword, location: form.location,
        hasWebsite: form.hasWebsite,
        requirePhone: form.requirePhone,
        minRating: Number(form.minRating) || 0,
        minReviews: Number(form.minReviews) || 0,
        maxResults: form.maxResults,
        saveAsLeads: true,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    setResult(data);
    toast.success(`Scraped ${(data as any).matched} matches, added ${(data as any).inserted} new leads`);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1"><Sparkles className="w-4 h-4" /> Scrape Leads</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Scrape Google Maps leads</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Keyword *</label>
              <Input value={form.keyword} onChange={e => setForm({ ...form, keyword: e.target.value })} placeholder="salons, gyms, dentists…" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Location</label>
              <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Coimbatore" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Website</label>
              <Select value={form.hasWebsite} onValueChange={(v: any) => setForm({ ...form, hasWebsite: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="no">No website (best for cold outreach)</SelectItem>
                  <SelectItem value="yes">Has website</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Min rating</label>
              <Input type="number" step="0.1" min="0" max="5" value={form.minRating} onChange={e => setForm({ ...form, minRating: e.target.value })} placeholder="4.0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Min reviews</label>
              <Input type="number" min="0" value={form.minReviews} onChange={e => setForm({ ...form, minReviews: e.target.value })} placeholder="20" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requirePhone} onChange={e => setForm({ ...form, requirePhone: e.target.checked })} />
            Only keep businesses with a phone number
          </label>
          <div>
            <label className="text-xs text-muted-foreground">Max results ({form.maxResults})</label>
            <input type="range" min="10" max="100" step="10" value={form.maxResults} onChange={e => setForm({ ...form, maxResults: Number(e.target.value) })} className="w-full" />
          </div>
          {result && (
            <div className="text-xs bg-muted/40 border rounded-md p-3">
              Found <b>{result.total_found}</b>, matched filters <b>{result.matched}</b>, new leads added <b>{result.inserted}</b>.
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Uses your SerpAPI key (free tier: 100 searches/mo). Configure once in project settings.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          <Button onClick={run} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Scraping…</> : <><Globe className="w-4 h-4 mr-1" /> Scrape now</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

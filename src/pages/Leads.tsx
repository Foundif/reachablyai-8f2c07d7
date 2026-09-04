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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Plus, Search, Upload, MessageCircle, Trash2, Tag, Globe, Loader2, Sparkles,
  StickyNote, KeyRound, BookOpen, Save, Download, Filter as FilterIcon, X, ChevronDown,
  Phone, GripVertical, MoreVertical, Columns3, History,
} from 'lucide-react';
import { resolveWorkspaceId } from '@/lib/workspace';
import ConfirmDialog from '@/components/ConfirmDialog';

// ---------- Contact table fields (Turbodev-style column manager) ----------
type FieldKey = 'name' | 'phone' | 'email' | 'status' | 'source' | 'temperature' | 'tags' | 'notes' | 'created_at' | 'updated_at';
interface FieldDef { key: FieldKey; label: string; kind: 'text' | 'option' | 'date' | 'list' }
const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', kind: 'text' },
  { key: 'phone', label: 'Phone', kind: 'text' },
  { key: 'email', label: 'Email', kind: 'text' },
  { key: 'status', label: 'Status', kind: 'option' },
  { key: 'source', label: 'Source', kind: 'option' },
  { key: 'temperature', label: 'Temperature', kind: 'option' },
  { key: 'tags', label: 'Tags', kind: 'list' },
  { key: 'notes', label: 'Notes', kind: 'text' },
  { key: 'created_at', label: 'Created At', kind: 'date' },
  { key: 'updated_at', label: 'Updated At', kind: 'date' },
];
const DEFAULT_COLUMNS: FieldKey[] = ['name', 'phone', 'status', 'source', 'created_at'];
const COLS_KEY = 'reachably.contacts.columns';

type Condition = 'is' | 'is_not' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty';
const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'is', label: 'Is' },
  { value: 'is_not', label: 'Is not' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];
interface FilterRule { field: FieldKey; condition: Condition; value: string }

const initials = (n: string) =>
  (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const AVATAR_TONES = [
  'bg-red-500/15 text-red-600', 'bg-blue-500/15 text-blue-600', 'bg-emerald-500/15 text-emerald-600',
  'bg-amber-500/15 text-amber-600', 'bg-purple-500/15 text-purple-600', 'bg-sky-500/15 text-sky-600',
];
const toneOf = (s: string) => AVATAR_TONES[[...(s || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (d: string) =>
  `${fmtDate(d)} | ${new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

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
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [noteDraft, setNoteDraft] = useState({ notes: '', tags: '' });
  const [addOpen, setAddOpen] = useState(false);
  const [wsId, setWsId] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<Lead | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);


  // Turbodev-style table state
  const [tab, setTab] = useState<'contacts' | 'segments'>('contacts');
  const [columns, setColumns] = useState<FieldKey[]>(() => {
    try {
      const raw = localStorage.getItem(COLS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) return parsed as FieldKey[];
    } catch { /* ignore */ }
    return DEFAULT_COLUMNS;
  });
  const [colSheet, setColSheet] = useState(false);
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [importHistory, setImportHistory] = useState<{ file: string; count: number; at: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('reachably.contacts.imports') || '[]'); } catch { return []; }
  });

  // Segments
  const [segments, setSegments] = useState<any[]>([]);
  const [segOpen, setSegOpen] = useState(false);
  const [segDraft, setSegDraft] = useState<{ name: string; rules: FilterRule[] }>({ name: '', rules: [] });
  const [pendingSegDelete, setPendingSegDelete] = useState<any | null>(null);

  useEffect(() => { localStorage.setItem(COLS_KEY, JSON.stringify(columns)); }, [columns]);

  const [form, setForm] = useState({
    name: '', phone: '+91', email: '', tags: '', optIn: 'no', notes: '', status: 'new' as LeadStatus,
  });

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

  const loadSegments = async () => {
    const { data } = await supabase.from('contact_segments' as any).select('*').order('created_at', { ascending: false });
    setSegments((data as any[]) || []);
  };

  useEffect(() => { loadWorkspace(); loadLeads(); loadSegments(); }, [user, profile]);

  // ---- Filter engine (shared by the Filter popover and Segments) ----
  const fieldValue = (l: Lead, f: FieldKey): string => {
    switch (f) {
      case 'temperature': return tempOf(l.tags) || '';
      case 'tags': return (l.tags || []).join(', ');
      case 'updated_at': return l.created_at;
      default: return String((l as any)[f] ?? '');
    }
  };
  const matchRule = (l: Lead, r: FilterRule) => {
    const v = fieldValue(l, r.field).toLowerCase();
    const q = (r.value || '').toLowerCase().trim();
    switch (r.condition) {
      case 'is': return !q || v === q;
      case 'is_not': return !q || v !== q;
      case 'contains': return !q || v.includes(q);
      case 'not_contains': return !q || !v.includes(q);
      case 'is_empty': return !v;
      case 'is_not_empty': return !!v;
      default: return true;
    }
  };
  const applyRules = (list: Lead[], rs: FilterRule[]) => list.filter(l => rs.every(r => matchRule(l, r)));

  const filtered = useMemo(() => {
    let list = applyRules(leads, rules);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.email?.toLowerCase().includes(q));
    }
    return list;
  }, [leads, rules, search]);

  useEffect(() => { setPage(1); }, [rules, search, perPage]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage]);

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
    if (!form.name.trim()) return toast.error('Name is required');
    if (!wsId) return toast.error('Workspace not ready');
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (form.optIn === 'yes') tags.push('marketing-opt-in');
    const phone = form.phone.replace(/\s/g, '');
    const { error } = await supabase.from('leads' as any).insert({
      workspace_id: wsId,
      name: form.name.trim(),
      phone: phone && phone !== '+91' ? phone : null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      source: 'manual',
      tags,
    });
    if (error) return toast.error(error.message);
    toast.success('Contact created');
    setAddOpen(false);
    setForm({ name: '', phone: '+91', email: '', tags: '', optIn: 'no', notes: '', status: 'new' });
    loadLeads();
  };

  // ---- Segments ----
  const saveSegment = async () => {
    if (!segDraft.name.trim()) return toast.error('Segment name is required');
    if (!wsId) return toast.error('Workspace not ready');
    const { error } = await supabase.from('contact_segments' as any).insert({
      workspace_id: wsId,
      name: segDraft.name.trim(),
      filters: segDraft.rules as any,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success('Segment created');
    setSegOpen(false);
    setSegDraft({ name: '', rules: [] });
    loadSegments();
  };
  const confirmSegDelete = async () => {
    const s = pendingSegDelete;
    setPendingSegDelete(null);
    if (!s) return;
    const { error } = await supabase.from('contact_segments' as any).delete().eq('id', s.id);
    if (error) return toast.error(error.message);
    setSegments(prev => prev.filter(x => x.id !== s.id));
    toast.success('Segment deleted');
  };
  const segmentCount = (s: any) => applyRules(leads, (s.filters as FilterRule[]) || []).length;

  const exportContacts = () => {
    const cols = FIELDS.filter(f => columns.includes(f.key));
    const rows = [cols.map(c => c.label)]
      .concat(filtered.map(l => cols.map(c => fieldValue(l, c.key))));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'contacts.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Export in the format Meta Business Suite / Ads Manager accepts for a customer list
  const exportForMeta = () => {
    const rows = [['phone', 'email', 'fn']].concat(
      filtered
        .filter(l => l.phone || l.email)
        .map(l => [
          (l.phone || '').replace(/[^\d+]/g, ''),
          (l.email || '').toLowerCase(),
          (l.name || '').split(' ')[0] || '',
        ]),
    );
    if (rows.length < 2) return toast.error('No contacts with a phone or email to export');
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'meta-customer-list.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('File ready — upload it in Meta Business Suite > Audiences > Create customer list');
  };

  // Pull everyone who has chatted on WhatsApp into Contacts
  const syncFromWhatsApp = async () => {
    if (!wsId) return toast.error('Workspace not ready yet, try again in a moment');
    setSyncing(true);
    try {
      const { data, error } = await supabase
        .from('wa_conversations' as any)
        .select('contact_phone, contact_name, last_message_at')
        .eq('workspace_id', wsId)
        .is('deleted_at', null);
      if (error) throw error;
      const convos = (data as any[]) || [];
      const norm = (p?: string | null) => (p || '').replace(/[^\d]/g, '').slice(-10);
      const existing = new Set(leads.map(l => norm(l.phone)).filter(Boolean));
      const seen = new Set<string>();
      const payload: any[] = [];
      for (const c of convos) {
        const key = norm(c.contact_phone);
        if (!key || existing.has(key) || seen.has(key)) continue;
        seen.add(key);
        payload.push({
          workspace_id: wsId,
          name: c.contact_name || c.contact_phone,
          phone: c.contact_phone,
          source: 'whatsapp',
          status: 'new',
          tags: ['whatsapp'],
        });
      }
      if (!payload.length) {
        toast.info('All WhatsApp chats are already in your contacts');
        return;
      }
      for (let i = 0; i < payload.length; i += 100) {
        const { error: insErr } = await supabase.from('leads' as any).insert(payload.slice(i, i + 100));
        if (insErr) throw insErr;
      }
      toast.success(`Added ${payload.length} contact(s) from WhatsApp`);
      loadLeads();
    } catch (e: any) {
      toast.error(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };


  const renderCell = (l: Lead, key: FieldKey) => {
    switch (key) {
      case 'name':
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-7 h-7 shrink-0 rounded-full grid place-items-center text-[11px] font-semibold ${toneOf(l.name)}`}>
              {initials(l.name)}
            </span>
            <span className="font-medium truncate">{l.name}</span>
          </div>
        );
      case 'phone':
        return l.phone
          ? <span className="inline-flex items-center gap-1.5 text-sm"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{l.phone}</span>
          : <span className="text-muted-foreground">–</span>;
      case 'status':
        return (
          <Select value={l.status} onValueChange={(v) => handleStatusChange(l.id, v as LeadStatus)}>
            <SelectTrigger className={`h-7 w-[118px] text-xs ${STATUS_COLORS[l.status]}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        );
      case 'source':
        return <Badge variant="outline" className={SOURCE_COLORS[l.source]}>{l.source}</Badge>;
      case 'temperature': {
        const t = tempOf(l.tags);
        return t
          ? <Badge variant="outline" className={TEMP_COLORS[t]}>{t}</Badge>
          : <span className="text-muted-foreground">–</span>;
      }
      case 'tags':
        return l.tags?.length
          ? <div className="flex flex-wrap gap-1">{l.tags.slice(0, 3).map(t => (
              <Badge key={t} variant="outline" className={`text-[10px] ${TEMP_COLORS[t.toLowerCase()] || ''}`}>{t}</Badge>))}</div>
          : <span className="text-muted-foreground">–</span>;
      case 'notes':
        return <span className="text-sm text-muted-foreground line-clamp-1 max-w-[260px]">{l.notes || '–'}</span>;
      case 'email':
        return <span className="text-sm">{l.email || <span className="text-muted-foreground">–</span>}</span>;
      case 'created_at':
        return <span className="text-sm whitespace-nowrap">{fmtDate(l.created_at)}</span>;
      case 'updated_at':
        return <span className="text-sm whitespace-nowrap">{fmtDateTime(l.created_at)}</span>;
      default:
        return null;
    }
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
    setImportHistory(prev => {
      const next = [{ file: file.name, count: payload.length, at: new Date().toISOString() }, ...prev].slice(0, 20);
      localStorage.setItem('reachably.contacts.imports', JSON.stringify(next));
      return next;
    });
    if (csvInputRef.current) csvInputRef.current.value = '';
    loadLeads();
  };

  // ---- Bulk selection ----
  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allVisibleSelected = pageRows.length > 0 && pageRows.every(l => selected.has(l.id));
  const toggleSelectAll = () =>
    setSelected(allVisibleSelected ? new Set() : new Set(pageRows.map(l => l.id)));

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


  const visibleFields = FIELDS.filter(f => columns.includes(f.key))
    .sort((a, b) => columns.indexOf(a.key) - columns.indexOf(b.key));

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Tabs header */}
        <div className="border-b px-4 md:px-6">
          <div className="flex gap-6">
            {(['contacts', 'segments'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                  tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === 'contacts' ? (
          <div className="p-3 md:p-6 space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FilterIcon className="w-4 h-4" /> Filter
                    {rules.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{rules.length}</Badge>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[340px] p-3">
                  <FilterBuilder rules={rules} onChange={setRules} />
                </PopoverContent>
              </Popover>

              {rules.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setRules([])} className="gap-1 text-muted-foreground">
                  <X className="w-3.5 h-3.5" /> Clear
                </Button>
              )}

              <div className="ml-auto flex items-center gap-2">
                {searchOpen ? (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      autoFocus value={search} onChange={e => setSearch(e.target.value)}
                      onBlur={() => { if (!search) setSearchOpen(false); }}
                      placeholder="Search name, phone, email…" className="pl-8 h-9 w-[220px]"
                    />
                  </div>
                ) : (
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSearchOpen(true)}>
                    <Search className="w-4 h-4" />
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" /> Export <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportContacts}>Export contacts</DropdownMenuItem>
                    <DropdownMenuItem onClick={exportForMeta}>Export for Meta customer list</DropdownMenuItem>

                  </DropdownMenuContent>
                </DropdownMenu>

                <input
                  type="file" accept=".csv,.txt" className="hidden" ref={csvInputRef}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f); }}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Upload className="w-4 h-4" /> Import <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => csvInputRef.current?.click()}>Import file</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (!importHistory.length) return toast.info('No imports yet');
                      toast.message('Import history', {
                        description: importHistory.slice(0, 5)
                          .map(h => `${h.file} · ${h.count} contacts · ${fmtDate(h.at)}`).join('\n'),
                      });
                    }}>
                      <History className="w-4 h-4 mr-2" /> Import history
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="outline" size="sm" className="gap-2" onClick={syncFromWhatsApp} disabled={syncing}>
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                  Sync WhatsApp
                </Button>

                <ScrapeLeadsDialog wsId={wsId} onDone={loadLeads} />


                <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
                  <Plus className="w-4 h-4" /> Add contact
                </Button>
              </div>
            </div>

            {/* Bulk actions */}
            {selected.size > 0 && (
              <Card className="p-2.5 flex items-center gap-3 border-primary/40">
                <span className="text-sm font-medium">{selected.size} selected</span>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
                <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setBulkOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete selected
                </Button>
              </Card>
            )}

            {/* Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-10">
                        <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                      </TableHead>
                      {visibleFields.map(f => (
                        <TableHead key={f.key} className="whitespace-nowrap">{f.label}</TableHead>
                      ))}
                      <TableHead className="w-24 text-right">
                        <Button
                          size="icon" variant="secondary" className="h-7 w-7"
                          title="Select table columns" onClick={() => setColSheet(true)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={visibleFields.length + 2} className="h-40 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                    ) : pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={visibleFields.length + 2} className="h-40 text-center">
                          <p className="text-muted-foreground">No results.</p>
                          <p className="text-xs text-muted-foreground mt-1">Add a contact, import a file, or wait for inbound WhatsApp messages.</p>
                        </TableCell>
                      </TableRow>
                    ) : pageRows.map(l => (
                      <TableRow key={l.id} data-state={selected.has(l.id) ? 'selected' : undefined}>
                        <TableCell>
                          <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} aria-label={`Select ${l.name}`} />
                        </TableCell>
                        {visibleFields.map(f => (
                          <TableCell key={f.key}>{renderCell(l, f.key)}</TableCell>
                        ))}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenWhatsApp(l)}>
                                <MessageCircle className="w-4 h-4 mr-2" /> Open chat
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openNotes(l)}>
                                <StickyNote className="w-4 h-4 mr-2" /> Notes & tags
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(l)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center gap-3 border-t px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Show rows per page</span>
                  <Select value={String(perPage)} onValueChange={v => setPerPage(Number(v))}>
                    <SelectTrigger className="h-8 w-[76px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1} - {Math.min(page * perPage, filtered.length)} of{' '}
                    <span className="text-foreground font-medium">{filtered.length}</span>
                  </span>
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          /* -------- Segments tab -------- */
          <div className="p-3 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Segments update dynamically according to the filters. Click "View count" to see the count.
              </p>
              <Button size="sm" className="ml-auto gap-2" onClick={() => { setSegDraft({ name: '', rules: [] }); setSegOpen(true); }}>
                <Plus className="w-4 h-4" /> New Segment
              </Button>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Filters</TableHead>
                      <TableHead>Total Contacts</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {segments.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No results.</TableCell></TableRow>
                    ) : segments.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {((s.filters as FilterRule[]) || []).length
                            ? ((s.filters as FilterRule[]) || []).map((r, i) => (
                                <Badge key={i} variant="outline" className="mr-1 text-[10px]">
                                  {FIELDS.find(f => f.key === r.field)?.label} {r.condition.replace('_', ' ')} {r.value}
                                </Badge>
                              ))
                            : 'All contacts'}
                        </TableCell>
                        <TableCell className="font-medium">{segmentCount(s)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(s.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setRules(((s.filters as FilterRule[]) || []));
                            setTab('contacts');
                          }}>View contacts</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPendingSegDelete(s)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* -------- Create Contact side sheet -------- */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Create Contact</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Name <span className="text-destructive">*</span></label>
              <Input className="mt-1.5" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter the name" />
            </div>
            <div>
              <label className="text-sm font-medium">Phone <span className="text-destructive">*</span></label>
              <Input className="mt-1.5" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91" />
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <label className="text-sm font-medium">Marketing Opt In <span className="text-destructive">*</span></label>
              <p className="text-xs text-muted-foreground mt-1">
                Mark "Yes" if consent for marketing messages has been obtained from this contact.
              </p>
              <Select value={form.optIn} onValueChange={v => setForm({ ...form, optIn: v })}>
                <SelectTrigger className="mt-2 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input className="mt-1.5" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Enter the email" />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as LeadStatus })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Tags</label>
              <Input className="mt-1.5" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="hot, vip, referral" />
              <p className="text-[11px] text-muted-foreground mt-1">Comma separated. Use hot / warm / cold to set temperature.</p>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">Additional details</p>
              <label className="text-sm font-medium">Notes</label>
              <Textarea className="mt-1.5" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Requirements, follow-up date…" />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Submit</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* -------- Select Table Columns sheet -------- */}
      <Sheet open={colSheet} onOpenChange={setColSheet}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><Columns3 className="w-4 h-4" /> Select Table Columns</SheetTitle></SheetHeader>
          <div className="py-4 space-y-6">
            <div>
              <p className="text-sm font-semibold mb-2">Selected Fields</p>
              <div className="rounded-md border divide-y">
                {visibleFields.map((f, i) => (
                  <div key={f.key} className="flex items-center gap-2 px-3 py-2.5">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm flex-1">{f.label}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0}
                        onClick={() => setColumns(c => { const n = [...c]; const idx = n.indexOf(f.key); [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; return n; })}>↑</Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === visibleFields.length - 1}
                        onClick={() => setColumns(c => { const n = [...c]; const idx = n.indexOf(f.key); [n[idx + 1], n[idx]] = [n[idx], n[idx + 1]]; return n; })}>↓</Button>
                      <Checkbox
                        checked
                        disabled={visibleFields.length === 1}
                        onCheckedChange={() => setColumns(c => c.filter(k => k !== f.key))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Non Selected Fields</p>
              <div className="rounded-md border divide-y">
                {FIELDS.filter(f => !columns.includes(f.key)).map(f => (
                  <div key={f.key} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="text-sm flex-1 text-muted-foreground">{f.label}</span>
                    <Checkbox checked={false} onCheckedChange={() => setColumns(c => [...c, f.key])} />
                  </div>
                ))}
                {FIELDS.every(f => columns.includes(f.key)) && (
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">All fields are selected.</p>
                )}
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setColumns(DEFAULT_COLUMNS)}>Reset</Button>
            <Button onClick={() => setColSheet(false)}>Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* -------- Create Segment -------- */}
      <Dialog open={segOpen} onOpenChange={setSegOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Segment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Segment name</label>
              <Input className="mt-1.5" value={segDraft.name} onChange={e => setSegDraft({ ...segDraft, name: e.target.value })} placeholder="Hot leads in Coimbatore" />
            </div>
            <div className="rounded-md border p-3">
              <FilterBuilder rules={segDraft.rules} onChange={(r) => setSegDraft(d => ({ ...d, rules: r }))} />
            </div>
            <p className="text-xs text-muted-foreground">
              Matches right now: <b className="text-foreground">{applyRules(leads, segDraft.rules).length}</b> contact(s).
              Segments update dynamically as contacts change.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSegOpen(false)}>Cancel</Button>
            <Button onClick={saveSegment}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingSegDelete}
        onOpenChange={(o) => !o && setPendingSegDelete(null)}
        title="Delete this segment?"
        description={<>Segment <b>{pendingSegDelete?.name}</b> will be removed. Your contacts stay untouched.</>}
        confirmLabel="Delete segment"
        onConfirm={confirmSegDelete}
      />
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

function FilterBuilder({ rules, onChange }: { rules: FilterRule[]; onChange: (r: FilterRule[]) => void }) {
  const update = (i: number, patch: Partial<FilterRule>) =>
    onChange(rules.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  return (
    <div className="space-y-2">
      {rules.length === 0 && <p className="text-xs text-muted-foreground">No filters yet. Add one to narrow the list.</p>}
      {rules.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Select value={r.field} onValueChange={v => update(i, { field: v as FieldKey })}>
            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELDS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={r.condition} onValueChange={v => update(i, { condition: v as Condition })}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {!['is_empty', 'is_not_empty'].includes(r.condition) && (
            <Input className="h-8 w-[110px] text-xs" value={r.value} placeholder="Value"
              onChange={e => update(i, { value: e.target.value })} />
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange(rules.filter((_, idx) => idx !== i))}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1"
        onClick={() => onChange([...rules, { field: 'name', condition: 'contains', value: '' }])}>
        <Plus className="w-3.5 h-3.5" /> Add filter
      </Button>
    </div>
  );
}

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

function ScrapeLeadsDialog({ wsId, onDone }: { wsId: string | null; onDone: () => void }) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [form, setForm] = useState({
    keyword: '', location: '',
    hasWebsite: 'any' as 'any' | 'yes' | 'no',
    requirePhone: true,
    minRating: '', minReviews: '',
    maxResults: 40,
    temps: ['hot', 'warm'] as string[],
  });
  const [result, setResult] = useState<any | null>(null);
  const [quota, setQuota] = useState<{ used: number; allowance: number; plan: string } | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [topupQty, setTopupQty] = useState(100);

  // Bring-your-own scraper API key
  const [byo, setByo] = useState({ provider: 'apify', api_key: '', actor_id: 'compass~crawler-google-places', enabled: true, saved: false });
  const [byoSaving, setByoSaving] = useState(false);

  const refreshQuota = async () => {
    if (!wsId) return;
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const plan = String((profile as any)?.subscription_status || 'trial').toLowerCase();
    const BASE: Record<string, number> = { starter: 150, growth: 1000, business: 5000, trial: 30 };
    const base = BASE[plan] ?? 30;
    const [{ count }, { data: tops }, { data: settings }] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId).eq('source', 'scraped').gte('created_at', monthStart),
      supabase.from('scrape_topups' as any).select('leads_granted')
        .eq('workspace_id', wsId).eq('month_key', monthKey),
      supabase.from('scraper_settings' as any).select('provider,api_key,actor_id,enabled')
        .eq('workspace_id', wsId).maybeSingle(),
    ]);
    const topTotal = ((tops as any[]) || []).reduce((s, r) => s + (r.leads_granted || 0), 0);
    setQuota({ used: count || 0, allowance: base + topTotal, plan });
    const st = settings as any;
    if (st) setByo({ provider: st.provider || 'apify', api_key: st.api_key || '', actor_id: st.actor_id || 'compass~crawler-google-places', enabled: st.enabled !== false, saved: !!st.api_key });
  };

  useEffect(() => { if (open) refreshQuota(); }, [open, wsId]);

  const usingOwnKey = byo.saved && byo.enabled && !!byo.api_key;

  const saveByo = async () => {
    if (!wsId) return toast.error('Workspace not ready');
    if (!byo.api_key.trim()) return toast.error('Paste your API key / token first');
    setByoSaving(true);
    const { error } = await supabase.from('scraper_settings' as any).upsert({
      workspace_id: wsId,
      provider: byo.provider,
      api_key: byo.api_key.trim(),
      actor_id: byo.provider === 'apify' ? (byo.actor_id.trim() || 'compass~crawler-google-places') : null,
      enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id' });
    setByoSaving(false);
    if (error) return toast.error(error.message);
    setByo(b => ({ ...b, saved: true, enabled: true }));
    toast.success('Your scraper key is connected — scraping is now free & unlimited on your quota');
  };

  const removeByo = async () => {
    if (!wsId) return;
    const { error } = await supabase.from('scraper_settings' as any).delete().eq('workspace_id', wsId);
    if (error) return toast.error(error.message);
    setByo({ provider: 'apify', api_key: '', actor_id: 'compass~crawler-google-places', enabled: true, saved: false });
    toast.success('Removed — back to the Reachably scraper');
  };

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
        temperatures: form.temps,
        maxResults: form.maxResults,
        saveAsLeads: true,
      },
    });
    setLoading(false);
    const payload = (data as any) || {};
    if (payload?.error === 'quota_exceeded' || (error as any)?.context?.status === 402) {
      setUnlockOpen(true);
      return;
    }
    if (error) return toast.error(error.message);
    if (payload?.error) return toast.error(payload.error);
    setResult(payload);
    toast.success(`Scraped ${payload.matched} matches, added ${payload.inserted} new contacts`);
    await refreshQuota();
    onDone();
  };

  const unlockPay = async () => {
    if (!user) return;
    const qty = Math.max(50, Math.min(10000, Math.round(topupQty)));
    setPayLoading(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Failed to load Razorpay');
      const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
        body: { amount: qty, leads: qty, kind: 'scrape_topup' },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Order failed');
      const { order, key_id } = data as any;
      const rzp = new window.Razorpay({
        key: key_id, amount: order.amount, currency: order.currency, order_id: order.id,
        name: 'Reachably', description: `${qty} leads · ₹1 per lead`,
        prefill: {
          email: user.email || '',
          name: (profile as any)?.full_name || (profile as any)?.store_name || '',
        },
        theme: { color: '#111111' },
        handler: async (resp: any) => {
          try {
            const { data: v, error: vErr } = await supabase.functions.invoke('razorpay-verify', {
              body: {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                kind: 'scrape_topup',
              },
            });
            if (vErr || (v as any)?.error) throw new Error((v as any)?.error || vErr?.message || 'Verify failed');
            toast.success(`Added ${(v as any)?.credited ?? qty} leads to this month's balance`);
            setUnlockOpen(false);
            await refreshQuota();
          } catch (e: any) {
            toast.error(e.message || 'Verification failed');
          }
        },
        modal: { ondismiss: () => setPayLoading(false) },
      });
      rzp.on('payment.failed', (r: any) => {
        toast.error(r?.error?.description || 'Payment failed');
        setPayLoading(false);
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || 'Payment error');
    } finally {
      setPayLoading(false);
    }
  };

  const remaining = quota ? Math.max(0, quota.allowance - quota.used) : null;
  const pct = quota && quota.allowance ? Math.min(100, Math.round((quota.used / quota.allowance) * 100)) : 0;
  const planLabel = quota?.plan ? quota.plan[0].toUpperCase() + quota.plan.slice(1) : '';
  const toggleTemp = (t: string) =>
    setForm(f => ({ ...f, temps: f.temps.includes(t) ? f.temps.filter(x => x !== t) : [...f.temps, t] }));

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1"><Sparkles className="w-4 h-4" /> Find Leads</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lead finder — Google Maps</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="find">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="find" className="text-xs">Find leads</TabsTrigger>
            <TabsTrigger value="key" className="text-xs gap-1"><KeyRound className="w-3 h-3" /> My API key</TabsTrigger>
            <TabsTrigger value="help" className="text-xs gap-1"><BookOpen className="w-3 h-3" /> How to</TabsTrigger>
          </TabsList>

          <TabsContent value="find" className="space-y-3 pt-3">
            {usingOwnKey ? (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
                Using <b>your own {byo.provider === 'apify' ? 'Apify' : 'SerpAPI'} key</b> — leads are free and don't touch your Reachably quota.
              </div>
            ) : quota && (
              <div className="rounded-md border bg-muted/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{planLabel} plan · this month</span>
                  <span className="text-muted-foreground">{quota.used} / {quota.allowance} used</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{remaining} leads remaining</span>
                  <button onClick={() => setUnlockOpen(true)} className="text-primary hover:underline font-medium">
                    Top up · ₹1 per lead
                  </button>
                </div>
              </div>
            )}

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

            <div>
              <label className="text-xs text-muted-foreground">Lead temperature (auto-tagged)</label>
              <div className="flex gap-2 mt-1.5">
                {[['hot', '🔥 Hot'], ['warm', '🌤 Warm'], ['cold', '❄️ Cold']].map(([v, label]) => (
                  <button key={v} type="button" onClick={() => toggleTemp(v)}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${form.temps.includes(v) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Hot = no website + phone + strong ratings (needs your service most). Warm = partial signals. Cold = already well established online.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Website</label>
                <Select value={form.hasWebsite} onValueChange={(v: any) => setForm({ ...form, hasWebsite: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="no">No website</SelectItem>
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
              <input type="range" min="10" max="200" step="10" value={form.maxResults} onChange={e => setForm({ ...form, maxResults: Number(e.target.value) })} className="w-full" />
            </div>

            {result && (
              <div className="text-xs bg-muted/40 border rounded-md p-3 space-y-1">
                <div>Found <b>{result.total_found}</b>, matched <b>{result.matched}</b>, added <b>{result.inserted}</b> new contacts.</div>
                <div className="flex gap-2">
                  <Badge variant="outline" className={TEMP_COLORS.hot}>🔥 {result.breakdown?.hot ?? 0} hot</Badge>
                  <Badge variant="outline" className={TEMP_COLORS.warm}>🌤 {result.breakdown?.warm ?? 0} warm</Badge>
                  <Badge variant="outline" className={TEMP_COLORS.cold}>❄️ {result.breakdown?.cold ?? 0} cold</Badge>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
              <Button onClick={run} disabled={loading || (!usingOwnKey && remaining === 0)}>
                {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Finding…</> : <><Globe className="w-4 h-4 mr-1" /> Find leads</>}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="key" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Connect your own free scraper API and Reachably will use it instead of ours — you pay nothing to us per lead.
            </p>
            <div>
              <label className="text-xs text-muted-foreground">Provider</label>
              <Select value={byo.provider} onValueChange={v => setByo({ ...byo, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apify">Apify (free $5 credit / month)</SelectItem>
                  <SelectItem value="serpapi">SerpAPI (free 100 searches / month)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{byo.provider === 'apify' ? 'Apify API token' : 'SerpAPI key'}</label>
              <Input type="password" value={byo.api_key} onChange={e => setByo({ ...byo, api_key: e.target.value })} placeholder={byo.provider === 'apify' ? 'apify_api_…' : 'Paste your SerpAPI key'} />
            </div>
            {byo.provider === 'apify' && (
              <div>
                <label className="text-xs text-muted-foreground">Actor ID (leave default if unsure)</label>
                <Input value={byo.actor_id} onChange={e => setByo({ ...byo, actor_id: e.target.value })} placeholder="compass~crawler-google-places" />
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={saveByo} disabled={byoSaving}>
                {byoSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Save & use my key</>}
              </Button>
              {byo.saved && <Button variant="outline" onClick={removeByo}>Remove</Button>}
            </div>
            {byo.saved && <p className="text-[11px] text-emerald-600">Connected — your key is used for every search.</p>}
          </TabsContent>

          <TabsContent value="help" className="pt-3 text-xs leading-relaxed space-y-3">
            <div>
              <p className="font-semibold text-sm mb-1">Use the Reachably scraper (easiest)</p>
              <ol className="list-decimal ml-4 space-y-1 text-muted-foreground">
                <li>Type a keyword (e.g. "beauty salon") and a city.</li>
                <li>Pick which temperatures you want — hot leads have no website, so they buy faster.</li>
                <li>Press <b>Find leads</b>. Each saved lead costs ₹1 once your plan quota is used; top up any amount from 50 leads upward.</li>
                <li>Leads land in Contacts, auto-tagged with temperature, city and category, with a notes line you can edit anytime.</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">Use your own free Apify key (₹0 per lead)</p>
              <ol className="list-decimal ml-4 space-y-1 text-muted-foreground">
                <li>Go to <b>apify.com</b> and create a free account (no card needed — you get free monthly credit).</li>
                <li>Open <b>Settings → Integrations → API tokens</b> and copy the token that starts with <code>apify_api_</code>.</li>
                <li>Come back here, open the <b>My API key</b> tab, choose <b>Apify</b>, paste the token and press Save.</li>
                <li>Keep the default actor <code>compass~crawler-google-places</code> (Google Maps scraper).</li>
                <li>Search as usual — results now come through your Apify account and cost you nothing here.</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">Prefer SerpAPI?</p>
              <ol className="list-decimal ml-4 space-y-1 text-muted-foreground">
                <li>Sign up free at <b>serpapi.com</b> (100 free searches per month).</li>
                <li>Copy the key from your dashboard's <b>API Key</b> page.</li>
                <li>Paste it in the <b>My API key</b> tab with provider set to SerpAPI.</li>
              </ol>
            </div>
            <p className="text-muted-foreground">Only scrape publicly listed business contacts and always send your first WhatsApp message with an approved template.</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Top up leads — ₹1 per lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You've used {quota?.used ?? 0} of {quota?.allowance ?? 0} leads this month on the <b>{planLabel}</b> plan.
          </p>
          <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {[50, 100, 250, 500, 1000].map(q => (
                <button key={q} type="button" onClick={() => setTopupQty(q)}
                  className={`px-3 py-1.5 rounded-md border text-xs font-medium ${topupQty === q ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                  {q}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Leads (min 50)</label>
              <Input type="number" min={50} max={10000} value={topupQty} onChange={e => setTopupQty(Number(e.target.value))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Valid for the current month</span>
              <div className="text-2xl font-bold">₹{Math.max(50, Math.round(topupQty || 0)).toLocaleString('en-IN')}</div>
            </div>
            <Button className="w-full" onClick={unlockPay} disabled={payLoading}>
              {payLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…</> : `Pay ₹${Math.max(50, Math.round(topupQty || 0))} & unlock ${Math.max(50, Math.round(topupQty || 0))} leads`}
            </Button>
          </div>
          <div className="text-center text-xs text-muted-foreground">— or scrape for free —</div>
          <Button variant="outline" className="w-full" onClick={() => setUnlockOpen(false)}>
            <KeyRound className="w-4 h-4 mr-1" /> Connect my own Apify / SerpAPI key
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

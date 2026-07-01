import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  RefreshCw, ExternalLink, Download, Search, Loader2, Save,
  Plus, Trash2, Pencil, Table as TableIcon, CheckCircle2,
} from 'lucide-react';

const colLetter = (i: number) => {
  let s = ''; let n = i;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
};

const SheetsViewer = () => {
  const { user } = useAuth();
  const [sheetId, setSheetId] = useState('');
  const [tab, setTab] = useState('Bookings');
  const [rows, setRows] = useState<string[][]>([]);
  const [original, setOriginal] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [filter, setFilter] = useState('');
  const [editMode, setEditMode] = useState(false);
  const lastLoaded = useRef<string>('');

  useEffect(() => { (async () => {
    if (!user) return;
    const { data } = await supabase.from('tn_settings').select('google_sheet_id, google_sheet_tab').eq('user_id', user.id).maybeSingle();
    if (data) {
      setSheetId(data.google_sheet_id || '');
      setTab((data as any).google_sheet_tab || 'Bookings');
    }
  })(); }, [user]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('sheets-read', { body: { sheet_id: sheetId || undefined, tab: tab || undefined } });
    setLoading(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || 'Failed to read');
    const v: string[][] = data.values || [];
    setRows(v);
    setOriginal(JSON.parse(JSON.stringify(v)));
    setEditMode(false);
    lastLoaded.current = `${sheetId}:${tab}`;
    toast.success(`Loaded ${Math.max(0, v.length - 1)} rows`);
  };

  useEffect(() => { if (sheetId && lastLoaded.current !== `${sheetId}:${tab}`) load(); /* eslint-disable-next-line */ }, [sheetId]);

  const saveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    const { error } = await supabase.from('tn_settings').upsert({ user_id: user.id, google_sheet_id: sheetId, google_sheet_tab: tab } as any, { onConflict: 'user_id' });
    setSavingSettings(false);
    if (error) return toast.error(error.message);
    toast.success('Sheet settings saved');
    load();
  };

  const maxCols = useMemo(() => rows.reduce((m, r) => Math.max(m, r?.length || 0), 0), [rows]);
  const rawHeader = rows[0] || [];
  const headerLooksLikeData = useMemo(() => (
    rawHeader.some(c => /^\d/.test(String(c ?? '').trim())) || rawHeader.length < maxCols / 2
  ), [rawHeader, maxCols]);
  const header: string[] = useMemo(() => headerLooksLikeData
    ? Array.from({ length: maxCols }, (_, i) => `Col ${colLetter(i)}`)
    : Array.from({ length: maxCols }, (_, i) => String(rawHeader[i] ?? `Col ${colLetter(i)}`)), [headerLooksLikeData, maxCols, rawHeader]);
  const dataStart = headerLooksLikeData ? 0 : 1;

  // map filtered index back to absolute row index
  const filteredIdx = useMemo(() => {
    const out: number[] = [];
    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i] || [];
      if (!filter || r.some(c => String(c ?? '').toLowerCase().includes(filter.toLowerCase()))) out.push(i);
    }
    return out;
  }, [rows, filter, dataStart]);

  const dirty = JSON.stringify(rows) !== JSON.stringify(original);

  const setCell = (rowIdx: number, colIdx: number, v: string) => {
    setRows(prev => {
      const next = prev.map(r => r.slice());
      while (next.length <= rowIdx) next.push([]);
      const row = next[rowIdx];
      while (row.length <= colIdx) row.push('');
      row[colIdx] = v;
      return next;
    });
  };

  const addRow = () => {
    setRows(prev => [...prev, Array(Math.max(maxCols, 1)).fill('')]);
    setEditMode(true);
  };
  const deleteRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const saveChanges = async () => {
    setSaving(true);
    const lastCol = colLetter(Math.max(0, maxCols - 1));
    const a1Tab = /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${tab.replace(/'/g, "''")}'`;
    const range = `${a1Tab}!A1:${lastCol}${rows.length}`;
    const { data, error } = await supabase.functions.invoke('sheets-write', {
      body: { sheet_id: sheetId, tab, range, values: rows },
    });
    setSaving(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || 'Save failed');
    toast.success('Changes saved to Google Sheets');
    setOriginal(JSON.parse(JSON.stringify(rows)));
    setEditMode(false);
  };

  const exportCsv = () => {
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${tab}-${Date.now()}.csv`; a.click();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <TableIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">Bookings Sheet</h1>
                <Badge variant="secondary" className="text-[10px]">Live editor</Badge>
                {dirty && <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30">Unsaved changes</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Edit cells in place and save back to Google Sheets. Every WhatsApp booking auto-appends here.
              </p>
            </div>
          </div>
          {sheetId && (
            <a href={`https://docs.google.com/spreadsheets/d/${sheetId}`} target="_blank" rel="noopener noreferrer"
               className="text-xs text-primary inline-flex items-center gap-1 shrink-0">
              Open in Google Sheets <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Settings */}
        <Card className="p-4 grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-end">
          <div>
            <Label className="text-xs">Google Sheet ID</Label>
            <Input value={sheetId} onChange={e => setSheetId(e.target.value)} placeholder="From your sheet URL: /d/<THIS_ID>/edit" />
          </div>
          <div>
            <Label className="text-xs">Tab name</Label>
            <Input value={tab} onChange={e => setTab(e.target.value)} placeholder="Bookings" />
          </div>
          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Save & load
          </Button>
        </Card>

        {/* Toolbar */}
        <Card className="p-3 flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input className="pl-8 h-9" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search rows…" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={editMode ? 'default' : 'outline'} size="sm" onClick={() => setEditMode(v => !v)}>
              <Pencil className="w-4 h-4 mr-1" />{editMode ? 'Editing' : 'Edit'}
            </Button>
            <Button variant="outline" size="sm" onClick={addRow} disabled={!sheetId}>
              <Plus className="w-4 h-4 mr-1" />Add row
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading || !sheetId}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="w-4 h-4 mr-1" />CSV
            </Button>
            <Button size="sm" onClick={saveChanges} disabled={!dirty || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Save to Sheets
            </Button>
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          {!sheetId ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Paste your Google Sheet ID above to start viewing and editing.
            </div>
          ) : loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : maxCols === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No rows in <b>{tab}</b>. Click <b>Add row</b> to create one, or check your tab name.
            </div>
          ) : (
            <div className="overflow-auto max-h-[68vh]">
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="bg-muted/80 backdrop-blur text-left p-2 font-semibold border-b border-r w-10 text-muted-foreground">#</th>
                    {header.map((h, i) => (
                      <th key={i} className="bg-muted/80 backdrop-blur text-left p-2 font-semibold border-b border-r whitespace-nowrap min-w-[140px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground font-mono">{colLetter(i)}</span>
                          <span className="truncate">{h}</span>
                        </div>
                      </th>
                    ))}
                    {editMode && <th className="bg-muted/80 backdrop-blur border-b w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredIdx.map((absIdx, i) => (
                    <tr key={absIdx} className="group hover:bg-muted/30">
                      <td className="p-2 border-b border-r text-muted-foreground font-mono text-[10px] text-center">{i + 1}</td>
                      {header.map((_, j) => {
                        const val = rows[absIdx]?.[j] ?? '';
                        return (
                          <td key={j} className="border-b border-r align-top">
                            {editMode ? (
                              <input
                                value={String(val)}
                                onChange={e => setCell(absIdx, j, e.target.value)}
                                className="w-full px-2 py-1.5 bg-transparent outline-none focus:bg-primary/5 focus:ring-1 focus:ring-primary/40 text-xs"
                              />
                            ) : (
                              <div className="px-2 py-1.5 max-w-[300px] truncate" title={String(val)}>{String(val)}</div>
                            )}
                          </td>
                        );
                      })}
                      {editMode && (
                        <td className="border-b text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteRow(absIdx)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Showing {filteredIdx.length} of {Math.max(0, rows.length - dataStart)} rows · {maxCols} columns</span>
          {dirty && <span className="text-amber-600">Unsaved changes — click <b>Save to Sheets</b> to persist.</span>}
        </div>
      </div>
    </AppLayout>
  );
};

export default SheetsViewer;

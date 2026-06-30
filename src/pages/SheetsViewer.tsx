import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { RefreshCw, ExternalLink, Download, Search, Loader2, Save } from 'lucide-react';

const SheetsViewer = () => {
  const { user } = useAuth();
  const [sheetId, setSheetId] = useState('');
  const [tab, setTab] = useState('Bookings');
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [filter, setFilter] = useState('');

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
    setRows(data.values || []);
    toast.success(`Loaded ${(data.values?.length || 1) - 1} rows`);
  };

  useEffect(() => { if (sheetId) load(); /* eslint-disable-next-line */ }, [sheetId]);

  const saveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    const { error } = await supabase.from('tn_settings').upsert({ user_id: user.id, google_sheet_id: sheetId, google_sheet_tab: tab } as any, { onConflict: 'user_id' });
    setSavingSettings(false);
    if (error) return toast.error(error.message);
    toast.success('Sheet settings saved');
    load();
  };

  const exportCsv = () => {
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${tab}-${Date.now()}.csv`; a.click();
  };

  const maxCols = rows.reduce((m, r) => Math.max(m, r?.length || 0), 0);
  const rawHeader = rows[0] || [];
  const headerLooksLikeData = rawHeader.some(c => /^\d/.test(String(c ?? '').trim())) || rawHeader.length < maxCols / 2;
  const header: string[] = headerLooksLikeData
    ? Array.from({ length: maxCols }, (_, i) => `Col ${i + 1}`)
    : Array.from({ length: maxCols }, (_, i) => String(rawHeader[i] ?? `Col ${i + 1}`));
  const dataRows = headerLooksLikeData ? rows : rows.slice(1);
  const body = dataRows.filter(r => !filter || r.some(c => String(c ?? '').toLowerCase().includes(filter.toLowerCase())));

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Bookings Sheet</h1>
            <p className="text-sm text-muted-foreground">Live view of your Google Sheet — every WhatsApp booking syncs here automatically.</p>
          </div>
          {sheetId && (
            <a href={`https://docs.google.com/spreadsheets/d/${sheetId}`} target="_blank" rel="noopener noreferrer"
               className="text-sm text-primary inline-flex items-center gap-1">Open in Google Sheets <ExternalLink className="w-3.5 h-3.5" /></a>
          )}
        </div>

        <Card className="p-4 grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-end">
          <div>
            <Label className="text-xs">Google Sheet ID</Label>
            <Input value={sheetId} onChange={e => setSheetId(e.target.value)} placeholder="1AbCDef...xyz (from sheet URL)" />
          </div>
          <div>
            <Label className="text-xs">Tab Name</Label>
            <Input value={tab} onChange={e => setTab(e.target.value)} placeholder="Bookings" />
          </div>
          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Save & Load
          </Button>
        </Card>

        <Card className="p-3 flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input className="pl-8" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search rows…" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading || !sheetId}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="w-4 h-4 mr-1" />CSV
            </Button>
          </div>
        </Card>

        <Card className="overflow-auto max-h-[70vh]">
          {!sheetId ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Paste your Google Sheet ID above to view bookings.</div>
          ) : loading ? (
            <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : maxCols === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No rows in <b>{tab}</b>. Make sure the tab name matches.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0 z-10">
                <tr>
                  {header.map((h, i) => <th key={i} className="text-left p-2 font-semibold whitespace-nowrap border-b">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {body.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30">
                    {header.map((_, j) => <td key={j} className="p-2 whitespace-nowrap max-w-[280px] truncate" title={String(r[j] ?? '')}>{r[j] ?? ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <p className="text-xs text-muted-foreground">Showing {body.length} of {dataRows.length} rows · {maxCols} columns</p>

      </div>
    </AppLayout>
  );
};

export default SheetsViewer;

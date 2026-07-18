import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Wallet, TrendingUp, MessageCircle, RefreshCw, Plus, Trash2, Loader2, IndianRupee, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

interface Entry {
  id: string; type: 'sale' | 'expense'; amount: number; cost: number;
  category: string | null; notes: string | null; entry_date: string;
  lead_id: string | null; campaign_id: string | null;
  leads?: { name: string } | null;
}

interface Lead { id: string; name: string; }

const Accounting = () => {
  const { user } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const [tab, setTab] = useState<'sales' | 'meta'>('sales');

  // Sales
  const [entries, setEntries] = useState<Entry[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({
    type: 'sale' as 'sale' | 'expense', amount: '', cost: '', category: '',
    notes: '', lead_id: '', entry_date: new Date().toISOString().slice(0, 10),
  });

  // Meta
  const [metaData, setMetaData] = useState<any | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: ws } = await supabase.from('workspaces' as any)
        .select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
      const id = (ws as any)?.id || null;
      setWsId(id);
      if (id) {
        const { data: ls } = await supabase.from('leads' as any).select('id,name').eq('workspace_id', id).order('created_at', { ascending: false }).limit(500);
        setLeads((ls as any) || []);
      }
    })();
  }, [user]);

  const loadEntries = async () => {
    if (!wsId) return;
    const since = new Date(Date.now() - Number(range) * 86400000).toISOString().slice(0, 10);
    const { data } = await supabase.from('finance_entries' as any)
      .select('*, leads(name)').eq('workspace_id', wsId).gte('entry_date', since)
      .order('entry_date', { ascending: false });
    setEntries((data as any) || []);
  };
  useEffect(() => { if (wsId) loadEntries(); }, [wsId, range]);

  const totals = useMemo(() => {
    const sales = entries.filter(e => e.type === 'sale').reduce((s, e) => s + Number(e.amount || 0), 0);
    const salesCost = entries.filter(e => e.type === 'sale').reduce((s, e) => s + Number(e.cost || 0), 0);
    const expenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);
    const grossProfit = sales - salesCost;
    const netProfit = grossProfit - expenses;
    const margin = sales > 0 ? (netProfit / sales) * 100 : 0;
    return { sales, salesCost, expenses, grossProfit, netProfit, margin };
  }, [entries]);

  const addEntry = async () => {
    if (!wsId) return;
    if (!entryForm.amount) return toast.error('Amount required');
    const { error } = await supabase.from('finance_entries' as any).insert({
      workspace_id: wsId,
      type: entryForm.type,
      amount: Number(entryForm.amount),
      cost: Number(entryForm.cost || 0),
      category: entryForm.category || null,
      notes: entryForm.notes || null,
      lead_id: entryForm.lead_id || null,
      entry_date: entryForm.entry_date,
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success('Entry added');
    setEntryOpen(false);
    setEntryForm({ type: 'sale', amount: '', cost: '', category: '', notes: '', lead_id: '', entry_date: new Date().toISOString().slice(0, 10) });
    loadEntries();
  };

  const removeEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await supabase.from('finance_entries' as any).delete().eq('id', id);
    loadEntries();
  };

  const syncMeta = async () => {
    if (!wsId) return;
    setMetaLoading(true);
    const { data, error } = await supabase.functions.invoke('meta-analytics-sync', {
      body: { workspace_id: wsId, days: Number(range) },
    });
    setMetaLoading(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error!.message);
    setMetaData(data);
    toast.success('Synced from Meta');
  };
  useEffect(() => { if (tab === 'meta' && wsId && !metaData) syncMeta(); }, [tab, wsId]);
  useEffect(() => { if (tab === 'meta' && wsId) syncMeta(); }, [range]);

  const metaCategoryEntries = useMemo(() => {
    const bc = metaData?.by_category || {};
    return Object.entries(bc).map(([k, v]: any) => ({ category: k, ...v }));
  }, [metaData]);

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6" /> Accounting</h1>
            <p className="text-muted-foreground text-sm">Track sales, profit & margins for your leads — plus real WhatsApp costs pulled from Meta.</p>
          </div>
          <Select value={range} onValueChange={(v: any) => setRange(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
          <TabsList>
            <TabsTrigger value="sales">Sales & Profit</TabsTrigger>
            <TabsTrigger value="meta">WhatsApp (Meta)</TabsTrigger>
          </TabsList>

          {/* ---------- SALES TAB ---------- */}
          <TabsContent value="sales" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Sales" value={fmt(totals.sales)} icon={<ArrowUpRight className="w-4 h-4 text-emerald-500" />} />
              <StatCard label="Cost of Sales" value={fmt(totals.salesCost)} icon={<IndianRupee className="w-4 h-4 text-muted-foreground" />} />
              <StatCard label="Gross Profit" value={fmt(totals.grossProfit)} tone={totals.grossProfit >= 0 ? 'good' : 'bad'} />
              <StatCard label="Expenses" value={fmt(totals.expenses)} icon={<ArrowDownRight className="w-4 h-4 text-red-500" />} />
              <StatCard label="Net Profit" value={fmt(totals.netProfit)} tone={totals.netProfit >= 0 ? 'good' : 'bad'} sub={`${totals.margin.toFixed(1)}% margin`} />
            </div>

            <div className="flex justify-end">
              <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
                <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Add entry</Button></DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>New finance entry</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Type</Label>
                        <Select value={entryForm.type} onValueChange={(v: any) => setEntryForm({ ...entryForm, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sale">Sale</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Date</Label>
                        <Input type="date" value={entryForm.entry_date} onChange={e => setEntryForm({ ...entryForm, entry_date: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Amount (₹)</Label>
                        <Input type="number" value={entryForm.amount} onChange={e => setEntryForm({ ...entryForm, amount: e.target.value })} placeholder="0" />
                      </div>
                      {entryForm.type === 'sale' && (
                        <div>
                          <Label>Cost (₹)</Label>
                          <Input type="number" value={entryForm.cost} onChange={e => setEntryForm({ ...entryForm, cost: e.target.value })} placeholder="0" />
                        </div>
                      )}
                    </div>
                    {entryForm.type === 'sale' && (
                      <div>
                        <Label>Lead (optional)</Label>
                        <Select value={entryForm.lead_id || 'none'} onValueChange={v => setEntryForm({ ...entryForm, lead_id: v === 'none' ? '' : v })}>
                          <SelectTrigger><SelectValue placeholder="Link to a lead" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label>Category</Label>
                      <Input value={entryForm.category} onChange={e => setEntryForm({ ...entryForm, category: e.target.value })} placeholder={entryForm.type === 'sale' ? 'Product / Service' : 'Ads / Salary / Rent'} />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea rows={2} value={entryForm.notes} onChange={e => setEntryForm({ ...entryForm, notes: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setEntryOpen(false)}>Cancel</Button>
                    <Button onClick={addEntry}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="overflow-hidden">
              <div className="p-4 border-b flex items-center gap-2"><TrendingUp className="w-4 h-4" /><h3 className="font-semibold">Entries</h3></div>
              {entries.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No entries yet in this range. Click <b>Add entry</b> to log a sale or expense.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead><TableHead>Type</TableHead>
                      <TableHead>Category</TableHead><TableHead>Lead</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map(e => {
                      const profit = e.type === 'sale' ? Number(e.amount) - Number(e.cost) : -Number(e.amount);
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs">{new Date(e.entry_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={e.type === 'sale' ? 'text-emerald-600 border-emerald-500/30' : 'text-red-600 border-red-500/30'}>
                              {e.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{e.category || '—'}</TableCell>
                          <TableCell className="text-sm">{e.leads?.name || '—'}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(Number(e.amount))}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{e.type === 'sale' ? fmt(Number(e.cost)) : '—'}</TableCell>
                          <TableCell className={`text-right font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(profit)}</TableCell>
                          <TableCell><Button size="sm" variant="ghost" onClick={() => removeEntry(e.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          {/* ---------- META TAB ---------- */}
          <TabsContent value="meta" className="space-y-4 mt-4">
            <Card className="p-3 flex items-start justify-between gap-2 text-xs bg-primary/5 border-primary/20">
              <div className="flex gap-2">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">Numbers below are pulled live from Meta's conversation analytics. Currency and pricing reflect your WABA billing.</span>
              </div>
              <Button size="sm" variant="outline" onClick={syncMeta} disabled={metaLoading} className="gap-2">
                {metaLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Sync
              </Button>
            </Card>

            {!metaData && !metaLoading && (
              <Card className="p-8 text-center text-muted-foreground text-sm">Click <b>Sync</b> to pull the latest from Meta.</Card>
            )}

            {metaLoading && (
              <Card className="p-8 text-center text-muted-foreground text-sm"><Loader2 className="w-4 h-4 mx-auto animate-spin" /> Fetching from Meta…</Card>
            )}

            {metaData && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Meta Conversations" value={metaData.totals.conversations.toLocaleString()} icon={<MessageCircle className="w-4 h-4 text-primary" />} />
                  <StatCard label="Meta Cost" value={`${metaData.currency} ${Number(metaData.totals.cost).toFixed(2)}`} tone="bad" />
                  <StatCard label="Messages Sent" value={metaData.messages.sent.toLocaleString()} sub={`${metaData.messages.template} template · ${metaData.messages.free_form} free-form`} />
                  <StatCard label="Delivered / Read" value={`${metaData.messages.delivered} / ${metaData.messages.read}`} sub={`${metaData.messages.failed} failed`} />
                </div>

                <Card className="overflow-hidden">
                  <div className="p-4 border-b flex items-center gap-2"><TrendingUp className="w-4 h-4" /><h3 className="font-semibold">Cost by category (Meta)</h3></div>
                  {metaCategoryEntries.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">No conversation data returned for this period.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Conversations</TableHead>
                          <TableHead className="text-right">Cost ({metaData.currency})</TableHead>
                          <TableHead className="text-right">Avg / conv</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metaCategoryEntries.map((r: any) => (
                          <TableRow key={r.category}>
                            <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                            <TableCell className="text-right">{r.conversations}</TableCell>
                            <TableCell className="text-right font-semibold">{Number(r.cost).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {r.conversations ? (r.cost / r.conversations).toFixed(4) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-3 text-sm">Inbound</h3>
                  <div className="text-sm text-muted-foreground">Received messages: <span className="font-semibold text-foreground">{metaData.messages.inbound}</span></div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

const StatCard = ({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon?: React.ReactNode; tone?: 'good' | 'bad' }) => (
  <Card className="p-4">
    <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
    <div className={`text-2xl font-bold mt-1 ${tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : ''}`}>{value}</div>
    {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
  </Card>
);

export default Accounting;

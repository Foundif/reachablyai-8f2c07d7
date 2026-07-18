import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Wallet, TrendingUp, MessageCircle, Info } from 'lucide-react';

// WhatsApp Cloud API conversation-based pricing (indicative — India, INR).
// These are editable rates. Templates categorize a conversation.
const RATES: Record<string, number> = {
  marketing: 0.7846,
  utility: 0.113,
  authentication: 0.113,
  service: 0, // free-form within 24h window
};

const Accounting = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: ws } = await supabase.from('workspaces' as any).select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
      const wsId = (ws as any)?.id;
      if (!wsId) { setLoading(false); return; }
      const since = new Date(Date.now() - Number(range) * 86400000).toISOString();

      const { data: campaigns } = await supabase.from('campaigns' as any)
        .select('id,name,sent_count,delivered_count,template_id,created_at,templates(name,category)')
        .eq('workspace_id', wsId).gte('created_at', since).order('created_at', { ascending: false });

      setRows((campaigns as any[]) || []);
      setLoading(false);
    })();
  }, [user, range]);

  const enriched = useMemo(() => rows.map(c => {
    const cat = c.templates?.category || 'utility';
    const rate = RATES[cat] ?? RATES.utility;
    const cost = (c.delivered_count || 0) * rate;
    return { ...c, category: cat, rate, cost };
  }), [rows]);

  const totals = useMemo(() => enriched.reduce((acc, r) => {
    acc.sent += r.sent_count || 0;
    acc.delivered += r.delivered_count || 0;
    acc.cost += r.cost;
    acc.byCat[r.category] = (acc.byCat[r.category] || 0) + r.cost;
    return acc;
  }, { sent: 0, delivered: 0, cost: 0, byCat: {} as Record<string, number> }), [enriched]);

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6" /> Accounting</h1>
            <p className="text-muted-foreground text-sm">Estimated WhatsApp Cloud API conversation cost by campaign & category.</p>
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

        <Card className="p-3 flex items-start gap-2 text-xs text-muted-foreground bg-primary/5 border-primary/20">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>Estimates use Meta's per-conversation pricing (India, INR): Marketing {fmt(RATES.marketing)}, Utility/Auth {fmt(RATES.utility)}, Service ₹0. Actual billing is via your Meta account.</span>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Messages sent</div><div className="text-2xl font-bold mt-1 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-primary" />{totals.sent}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Delivered</div><div className="text-2xl font-bold mt-1">{totals.delivered}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Estimated cost</div><div className="text-2xl font-bold mt-1 text-primary">{fmt(totals.cost)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Avg / message</div><div className="text-2xl font-bold mt-1">{fmt(totals.delivered ? totals.cost / totals.delivered : 0)}</div></Card>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {(['marketing', 'utility', 'authentication', 'service'] as const).map(c => (
            <Card key={c} className="p-4">
              <div className="text-xs text-muted-foreground uppercase">{c}</div>
              <div className="text-xl font-bold mt-1">{fmt((totals.byCat as any)[c] || 0)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Rate {fmt(RATES[c])}/conv</div>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2"><TrendingUp className="w-4 h-4" /><h3 className="font-semibold">Campaign cost breakdown</h3></div>
          {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
            : enriched.length === 0 ? <div className="p-8 text-center text-muted-foreground">No campaigns in this range.</div>
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead><TableHead>Category</TableHead>
                    <TableHead className="text-right">Sent</TableHead><TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enriched.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                      <TableCell className="text-right">{r.sent_count || 0}</TableCell>
                      <TableCell className="text-right">{r.delivered_count || 0}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{fmt(r.rate)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(r.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default Accounting;

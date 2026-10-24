import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Series = { d: string; v: number }[];
type Metric = { title: string; value: number; sub: string; series: Series | null; cta: string; to: string; empty?: string };

const Spark = ({ data }: { data: Series }) => (
  <ResponsiveContainer width="100%" height={150}>
    <LineChart data={data} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
      <Tooltip
        cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '3 3' }}
        contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
        formatter={(v: any) => [v, 'Count']}
      />
      <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
    </LineChart>
  </ResponsiveContainer>
);

/** Turbodev-style "Your overview": six sparkline cards driven by real workspace data. */
const OverviewGrid = ({ wsId }: { wsId: string | null }) => {
  const navigate = useNavigate();
  const [range, setRange] = useState('30');
  const [metrics, setMetrics] = useState<Metric[] | null>(null);

  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    (async () => {
      const n = Number(range);
      const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (n - 1));
      const iso = start.toISOString();
      const [{ data: convs }, { data: msgs }, { data: camps }, { data: autos }] = await Promise.all([
        supabase.from('wa_conversations' as any).select('created_at,status').eq('workspace_id', wsId).gte('created_at', iso).limit(10000),
        supabase.from('wa_messages' as any).select('created_at,conversation_id').eq('workspace_id', wsId).eq('direction', 'inbound').gte('created_at', iso).limit(20000),
        supabase.from('campaigns' as any).select('created_at,sent_count,delivered_count,read_count,failed_count,total_count').eq('workspace_id', wsId).gte('created_at', iso).limit(2000),
        supabase.from('automations' as any).select('enabled').eq('workspace_id', wsId),
      ]);
      if (!alive) return;
      const keyOf = (t: string | Date) => { const x = new Date(t); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
      const blank = () => {
        const m = new Map<string, { d: string; v: number }>(); const list: Series = [];
        for (let i = 0; i < n; i++) {
          const dt = new Date(start); dt.setDate(start.getDate() + i);
          const r = { d: dt.toLocaleDateString([], { day: 'numeric', month: 'short' }), v: 0 };
          m.set(keyOf(dt), r); list.push(r);
        }
        return { m, list };
      };
      const c = (convs as any[]) || [], ms = (msgs as any[]) || [], cs = (camps as any[]) || [], au = (autos as any[]) || [];

      const s1 = blank(); c.forEach(r => { const b = s1.m.get(keyOf(r.created_at)); if (b) b.v++; });
      const s2 = blank(); ms.forEach(r => { const b = s2.m.get(keyOf(r.created_at)); if (b) b.v++; });
      const s3 = blank(); const seen = new Map<string, Set<string>>();
      ms.forEach(r => { const k = keyOf(r.created_at); const set = seen.get(k) || new Set(); set.add(r.conversation_id); seen.set(k, set); });
      seen.forEach((set, k) => { const b = s3.m.get(k); if (b) b.v = set.size; });
      const s4 = blank(); cs.forEach(r => { const b = s4.m.get(keyOf(r.created_at)); if (b) b.v += Number(r.sent_count || 0); });
      const s5 = blank(); cs.forEach(r => { const b = s5.m.get(keyOf(r.created_at)); if (b) b.v += Number(r.failed_count || 0); });

      const sent = cs.reduce((s, r) => s + Number(r.sent_count || 0), 0);
      const deliv = cs.reduce((s, r) => s + Number(r.delivered_count || 0), 0);
      const read = cs.reduce((s, r) => s + Number(r.read_count || 0), 0);
      const failed = cs.reduce((s, r) => s + Number(r.failed_count || 0), 0);
      const pct = (a: number) => (sent ? Math.round((a / sent) * 100) : 0);
      const live = au.filter(a => a.enabled).length;

      setMetrics([
        { title: 'New conversations', value: c.length, sub: `${c.filter(x => x.status === 'resolved').length} resolved in period`, series: s1.list, cta: 'Open inbox', to: '/inbox' },
        { title: 'Messages received', value: ms.length, sub: 'Customer messages received in period', series: s2.list, cta: 'Open inbox', to: '/inbox' },
        { title: 'Open chats', value: new Set(ms.map(m => m.conversation_id)).size, sub: 'Chats with customer messages in period', series: s3.list, cta: 'Open inbox', to: '/inbox' },
        { title: 'Broadcasts sent', value: sent, sub: `${pct(deliv)}% delivered · ${pct(read)}% read`, series: s4.list, cta: 'More details', to: '/campaigns' },
        { title: 'Failed broadcasts', value: failed, sub: `${cs.length} broadcasts in period`, series: s5.list, cta: 'More details', to: '/campaigns' },
        { title: 'Live automations', value: live, sub: `${au.length - live} paused`, series: live ? null : null, cta: 'Create automation', to: '/automation', empty: 'No data' },
      ]);
    })();
    return () => { alive = false; };
  }, [wsId, range]);

  const label = range === '7' ? 'Last 7 days' : range === '90' ? 'Last 90 days' : 'Last 30 days';

  return (
    <section className="space-y-4">
      <h2 className="text-2xl md:text-[28px] font-semibold tracking-tight">Your overview</h2>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        Date range
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-9 w-auto gap-2 rounded-full border-primary/20 px-4 text-primary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <span className="h-9 inline-flex items-center rounded-full border border-primary/20 px-4 text-primary">Daily</span>
      </div>

      <div className="rounded-2xl bg-muted/50 p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {(metrics || Array.from({ length: 6 }, () => null)).map((m, i) => (
          <div key={i} className="rounded-xl border bg-card flex flex-col transition-shadow hover:shadow-md">
            {!m ? (
              <div className="h-[310px] animate-pulse rounded-xl bg-muted/40" />
            ) : (
              <>
                <div className="p-5 pb-2 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex items-center gap-1.5">{m.title}<Info className="h-3.5 w-3.5 text-muted-foreground" /></p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
                  </div>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">{m.value.toLocaleString('en-IN')}</p>
                  <p className="text-sm text-muted-foreground">{m.sub}</p>
                  <div className="mt-3">
                    {m.series ? (
                      <>
                        <Spark data={m.series} />
                        <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                          <span>{m.series[0]?.d}</span><span>{m.series[m.series.length - 1]?.d}</span>
                        </div>
                      </>
                    ) : (
                      <div className="h-[168px] rounded-lg border border-dashed flex items-center justify-center">
                        <span className="rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground">{m.empty || 'No data'}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t px-5 py-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Updated just now</span>
                  <button onClick={() => navigate(m.to)} className="font-medium text-primary hover:underline">{m.cta}</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default OverviewGrid;

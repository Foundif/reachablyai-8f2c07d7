import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Day = { d: string; inbound: number; outbound: number; ai: number; bookings: number; revenue: number };

/** "Your overview": daily messages, AI replies and bookings over a chosen range. */
const OverviewCharts = ({ wsId }: { wsId: string | null }) => {
  const [range, setRange] = useState('30');
  const [days, setDays] = useState<Day[]>([]);

  useEffect(() => {
    if (!wsId) return;
    (async () => {
      const n = Number(range);
      const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (n - 1));
      const iso = start.toISOString();
      const [{ data: msgs }, { data: ai }, { data: recs }] = await Promise.all([
        supabase.from('wa_messages' as any).select('created_at,direction').eq('workspace_id', wsId).gte('created_at', iso).limit(20000),
        supabase.from('chatbot_messages' as any).select('created_at').eq('workspace_id', wsId).eq('role', 'assistant').gte('created_at', iso).limit(20000),
        supabase.from('business_records' as any).select('created_at,paid_amount').eq('workspace_id', wsId).gte('created_at', iso).limit(5000),
      ]);
      const map = new Map<string, Day>();
      const key = (t: string | Date) => { const x = new Date(t); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
      const list: Day[] = [];
      for (let i = 0; i < n; i++) {
        const dt = new Date(start); dt.setDate(start.getDate() + i);
        const row = { d: dt.toLocaleDateString([], { day: 'numeric', month: 'short' }), inbound: 0, outbound: 0, ai: 0, bookings: 0, revenue: 0 };
        map.set(key(dt), row); list.push(row);
      }
      ((msgs as any[]) || []).forEach(m => { const r = map.get(key(m.created_at)); if (r) m.direction === 'inbound' ? r.inbound++ : r.outbound++; });
      ((ai as any[]) || []).forEach(m => { const r = map.get(key(m.created_at)); if (r) r.ai++; });
      ((recs as any[]) || []).forEach(m => { const r = map.get(key(m.created_at)); if (r) { r.bookings++; r.revenue += Number(m.paid_amount || 0); } });
      setDays(list);
    })();
  }, [wsId, range]);

  const sum = (k: keyof Day) => days.reduce((s, d) => s + Number(d[k] || 0), 0);
  const charts = [
    { title: 'Messages', total: sum('inbound') + sum('outbound'), sub: `${sum('inbound')} received · ${sum('outbound')} sent`, keys: ['inbound', 'outbound'] as const },
    { title: 'AI replies', total: sum('ai'), sub: 'Answers sent by your AI chatbots', keys: ['ai'] as const },
    { title: 'Bookings', total: sum('bookings'), sub: `₹${sum('revenue').toLocaleString('en-IN')} collected`, keys: ['bookings'] as const },
  ];

  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Your overview</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Date range
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-9 w-[140px] rounded-full text-primary"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {charts.map(c => (
          <div key={c.title} className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">{c.title}</p>
            <p className="text-3xl font-bold">{c.total.toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
            <div className="h-32 mt-3 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`ov-${c.title}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="d" tickLine={false} axisLine={false} minTickGap={24} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  {c.keys.map((k, i) => (
                    <Area key={k} type="monotone" dataKey={k} name={k === 'ai' ? 'AI replies' : k[0].toUpperCase() + k.slice(1)}
                      stroke={i ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))'} strokeWidth={2}
                      fill={i ? 'transparent' : `url(#ov-${c.title})`} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default OverviewCharts;

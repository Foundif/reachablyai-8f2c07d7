import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, MessageSquare, CheckCheck, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

const KPI = ({ icon: Icon, label, value, accent }: any) => (
  <div className="glass-panel p-4 rounded-2xl">
    <div className="flex items-center justify-between">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Icon className={`w-4 h-4 ${accent || 'text-accent'}`} />
    </div>
    <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
  </div>
);

const CampaignAnalytics = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [flow, setFlow] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: c } = await supabase.from('tn_campaigns').select('*').eq('id', id).maybeSingle();
      setCampaign(c);
      if (c?.flow_id) {
        const { data: f } = await supabase.from('tn_flows').select('*').eq('id', c.flow_id).maybeSingle();
        setFlow(f);
      }
      const { data: e } = await supabase.from('tn_flow_events').select('*').eq('campaign_id', id).order('created_at', { ascending: true });
      setEvents((e as any) || []);
      setLoading(false);
    })();
  }, [id]);

  const kpis = useMemo(() => {
    const count = (t: string) => events.filter(e => e.event_type === t).length;
    return {
      sent: count('sent'),
      delivered: count('delivered'),
      read: count('read'),
      replied: count('replied'),
      converted: count('converted'),
      dropped: count('dropped'),
    };
  }, [events]);

  const timeSeries = useMemo(() => {
    const buckets: Record<string, any> = {};
    events.forEach(e => {
      const d = new Date(e.created_at).toLocaleDateString();
      if (!buckets[d]) buckets[d] = { date: d, sent: 0, replied: 0, converted: 0 };
      if (['sent','replied','converted'].includes(e.event_type)) buckets[d][e.event_type]++;
    });
    return Object.values(buckets);
  }, [events]);

  const funnel = useMemo(() => {
    const nodes = ((flow?.nodes as any[]) || []);
    return nodes.map((n: any) => {
      const entered = events.filter(e => e.node_id === n.id && e.event_type === 'entered').length;
      const replied = events.filter(e => e.node_id === n.id && e.event_type === 'replied').length;
      const dropped = events.filter(e => e.node_id === n.id && e.event_type === 'dropped').length;
      return { node: n.data?.label || n.type, entered, replied, dropped };
    });
  }, [events, flow]);

  if (loading) return <AppLayout><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div></AppLayout>;
  if (!campaign) return <AppLayout><div className="p-6">Campaign not found.</div></AppLayout>;

  const replyRate = kpis.sent ? Math.round((kpis.replied / kpis.sent) * 100) : 0;
  const convRate = kpis.sent ? Math.round((kpis.converted / kpis.sent) * 100) : 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/campaigns"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Campaign Analytics</div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
          </div>
          <Badge variant="outline" className="capitalize">{campaign.status}</Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPI icon={Send} label="Sent" value={kpis.sent} />
          <KPI icon={CheckCheck} label="Delivered" value={kpis.delivered} />
          <KPI icon={MessageSquare} label="Read" value={kpis.read} />
          <KPI icon={MessageSquare} label="Replied" value={`${kpis.replied} · ${replyRate}%`} accent="text-emerald-400" />
          <KPI icon={TrendingUp} label="Converted" value={`${kpis.converted} · ${convRate}%`} accent="text-violet-400" />
          <KPI icon={AlertTriangle} label="Dropped" value={kpis.dropped} accent="text-amber-400" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="glass-panel p-5 rounded-2xl">
            <div className="text-sm font-semibold mb-3">Activity over time</div>
            {timeSeries.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">No events yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={timeSeries as any}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--glass-border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--glass-border))', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="sent" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="replied" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="converted" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="glass-panel p-5 rounded-2xl">
            <div className="text-sm font-semibold mb-3">Drop-off by step</div>
            {funnel.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">Add nodes to your flow to see funnel data</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={funnel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--glass-border))" />
                  <XAxis dataKey="node" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--glass-border))', borderRadius: 8 }} />
                  <Bar dataKey="entered" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                  <Bar dataKey="dropped" fill="hsl(var(--destructive))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5 text-sm font-semibold">Per-step breakdown</div>
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-white/[0.02]">
              <tr><th className="text-left p-3">Step</th><th className="text-left p-3">Entered</th><th className="text-left p-3">Replied</th><th className="text-left p-3">Dropped</th><th className="text-left p-3">Reply rate</th></tr>
            </thead>
            <tbody>
              {funnel.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">No data yet.</td></tr>
              ) : funnel.map((row: any, i: number) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="p-3 font-medium">{row.node}</td>
                  <td className="p-3 tabular-nums">{row.entered}</td>
                  <td className="p-3 tabular-nums">{row.replied}</td>
                  <td className="p-3 tabular-nums">{row.dropped}</td>
                  <td className="p-3 tabular-nums">{row.entered ? Math.round((row.replied / row.entered) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default CampaignAnalytics;

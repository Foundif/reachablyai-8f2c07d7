import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BarChart3, TrendingUp, Users, Send } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';

const COLORS = ['#d946ef', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#8b5cf6'];

const Analytics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ leads: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 });
  const [leadsDaily, setLeadsDaily] = useState<any[]>([]);
  const [campaignPerf, setCampaignPerf] = useState<any[]>([]);
  const [leadSources, setLeadSources] = useState<any[]>([]);
  const [leadStatus, setLeadStatus] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: ws } = await supabase.from('workspaces' as any).select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
      const wsId = (ws as any)?.id;
      if (!wsId) { setLoading(false); return; }

      const since = new Date(Date.now() - 30 * 86400000);
      const [{ data: leads }, { data: campaigns }] = await Promise.all([
        supabase.from('leads').select('id,status,source,created_at').eq('workspace_id', wsId),
        supabase.from('campaigns' as any).select('id,name,sent_count,delivered_count,read_count,replied_count,failed_count,total_count,created_at').eq('workspace_id', wsId),
      ]);

      const ls = (leads as any[]) || [];
      const cs = (campaigns as any[]) || [];

      // Totals
      const t = { leads: ls.length, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 };
      cs.forEach(c => {
        t.sent += c.sent_count || 0;
        t.delivered += c.delivered_count || 0;
        t.read += c.read_count || 0;
        t.replied += c.replied_count || 0;
        t.failed += c.failed_count || 0;
      });
      setTotals(t);

      // Leads per day (last 30d)
      const buckets: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        buckets[d.toISOString().slice(0, 10)] = 0;
      }
      ls.forEach(l => {
        const d = l.created_at?.slice(0, 10);
        if (d && d in buckets) buckets[d]++;
      });
      setLeadsDaily(Object.entries(buckets).map(([date, count]) => ({ date: date.slice(5), leads: count })));

      // Campaign performance (top 8)
      setCampaignPerf(cs.slice(-8).map(c => ({
        name: c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
        Sent: c.sent_count || 0,
        Delivered: c.delivered_count || 0,
        Read: c.read_count || 0,
        Replied: c.replied_count || 0,
      })));

      // Sources & statuses
      const srcMap: Record<string, number> = {};
      const stMap: Record<string, number> = {};
      ls.forEach(l => {
        const s = l.source || 'manual';
        srcMap[s] = (srcMap[s] || 0) + 1;
        stMap[l.status] = (stMap[l.status] || 0) + 1;
      });
      setLeadSources(Object.entries(srcMap).map(([name, value]) => ({ name, value })));
      setLeadStatus(Object.entries(stMap).map(([name, value]) => ({ name, value })));

      setLoading(false);
    })();
  }, [user]);

  const deliveryRate = totals.sent ? Math.round((totals.delivered * 100) / totals.sent) : 0;
  const readRate = totals.delivered ? Math.round((totals.read * 100) / totals.delivered) : 0;
  const replyRate = totals.delivered ? Math.round((totals.replied * 100) / totals.delivered) : 0;

  const Stat = ({ icon: Icon, label, value, hint }: any) => (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icon className="w-4 h-4" /></div>
      </div>
    </Card>
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Analytics</h1>
          <p className="text-muted-foreground text-sm">Lead growth, campaign delivery and message engagement.</p>
        </div>

        {loading ? <Card className="p-12 text-center text-muted-foreground">Loading analytics…</Card> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={Users} label="Total leads" value={totals.leads} />
              <Stat icon={Send} label="Messages sent" value={totals.sent} />
              <Stat icon={TrendingUp} label="Delivery rate" value={`${deliveryRate}%`} hint={`${totals.delivered} delivered`} />
              <Stat icon={TrendingUp} label="Read rate" value={`${readRate}%`} hint={`${totals.read} read · ${replyRate}% reply`} />
            </div>

            <Card className="p-5">
              <h3 className="font-semibold mb-4">Leads captured (last 30 days)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={leadsDaily}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="leads" stroke="#d946ef" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className="font-semibold mb-4">Lead sources</h3>
                {leadSources.length === 0 ? <p className="text-sm text-muted-foreground">No leads yet.</p> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={leadSources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {leadSources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>
              <Card className="p-5">
                <h3 className="font-semibold mb-4">Lead status funnel</h3>
                {leadStatus.length === 0 ? <p className="text-sm text-muted-foreground">No leads yet.</p> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={leadStatus}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#ec4899" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            <Card className="p-5">
              <h3 className="font-semibold mb-4">Campaign performance</h3>
              {campaignPerf.length === 0 ? <p className="text-sm text-muted-foreground">No campaigns yet.</p> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={campaignPerf}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Sent" fill="#d946ef" />
                    <Bar dataKey="Delivered" fill="#ec4899" />
                    <Bar dataKey="Read" fill="#f97316" />
                    <Bar dataKey="Replied" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Analytics;

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  CalendarDays, Users, Wallet, TrendingUp, Briefcase, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#22c55e'];
const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const Analytics = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState('30');
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const since = new Date(Date.now() - Number(period) * 86400_000).toISOString();
    Promise.all([
      supabase.from('tn_bookings').select('*').eq('user_id', user.id).gte('created_at', since),
      supabase.from('tn_payments').select('*').eq('user_id', user.id).eq('status', 'completed').gte('created_at', since),
      supabase.from('tn_customers').select('*').eq('user_id', user.id),
    ]).then(([b, p, c]) => {
      setBookings(b.data || []); setPayments(p.data || []); setCustomers(c.data || []);
    });
  }, [user, period]);

  const kpis = useMemo(() => {
    const revenue = payments.reduce((s, r) => s + Number(r.amount || 0), 0);
    const confirmed = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length;
    const aov = confirmed ? revenue / confirmed : 0;
    return {
      revenue, bookings: bookings.length, confirmed,
      customers: customers.length, aov,
    };
  }, [bookings, payments, customers]);

  // Revenue trend
  const trend = useMemo(() => {
    const days: Record<string, { date: string; bookings: number; revenue: number }> = {};
    const n = Number(period);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      days[d] = { date: d.slice(5), bookings: 0, revenue: 0 };
    }
    bookings.forEach(b => { const k = b.created_at.slice(0, 10); if (days[k]) days[k].bookings++; });
    payments.forEach(p => { const k = p.created_at.slice(0, 10); if (days[k]) days[k].revenue += Number(p.amount || 0); });
    return Object.values(days);
  }, [bookings, payments, period]);

  // Top services
  const topServices = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    bookings.forEach(b => {
      const k = b.service_name || b.service_code || 'Other';
      map[k] = map[k] || { name: k, count: 0, revenue: 0 };
      map[k].count++;
      map[k].revenue += Number(b.price || 0);
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [bookings]);

  // Booking status distribution
  const statusDist = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach(b => { map[b.status] = (map[b.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [bookings]);

  // Peak booking hours
  const peakHours = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, bookings: 0 }));
    bookings.forEach(b => {
      const h = b.booking_time ? Number(b.booking_time.split(':')[0]) : new Date(b.created_at).getHours();
      if (!isNaN(h) && h >= 0 && h < 24) buckets[h].bookings++;
    });
    return buckets;
  }, [bookings]);

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6 text-primary" />Service Analytics</h1>
            <p className="text-sm text-muted-foreground">Bookings, revenue & customer insights</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI icon={Wallet} label="Revenue" value={inr(kpis.revenue)} />
          <KPI icon={CalendarDays} label="Bookings" value={String(kpis.bookings)} />
          <KPI icon={Briefcase} label="Confirmed" value={String(kpis.confirmed)} />
          <KPI icon={Users} label="Customers" value={String(kpis.customers)} />
          <KPI icon={TrendingUp} label="Avg booking" value={inr(kpis.aov)} />
        </div>

        <Card className="p-4">
          <p className="text-sm font-semibold mb-3">Bookings & Revenue trend</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis yAxisId="left" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-sm font-semibold mb-3">Top services</p>
            {topServices.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No bookings yet</p> :
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topServices} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={150} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            }
          </Card>

          <Card className="p-4">
            <p className="text-sm font-semibold mb-3">Booking status</p>
            {statusDist.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No bookings yet</p> :
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            }
          </Card>
        </div>

        <Card className="p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4" />Peak booking hours</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="hour" fontSize={10} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="bookings" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </AppLayout>
  );
};

const KPI = ({ icon: Icon, label, value }: any) => (
  <Card className="p-3">
    <div className="flex items-center gap-2 text-muted-foreground"><Icon className="w-3.5 h-3.5" /><span className="text-[10px] uppercase tracking-wide">{label}</span></div>
    <p className="text-lg md:text-xl font-bold mt-1 truncate">{value}</p>
  </Card>
);

export default Analytics;

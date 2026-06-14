import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CalendarDays, CreditCard, Users, MessageSquare, TrendingUp, AlertCircle } from 'lucide-react';

const Stat = ({ icon: Icon, label, value, accent }: any) => (
  <Card className="p-5 hover:shadow-glow transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className="text-3xl font-bold mt-2">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${accent}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </Card>
);

const TNDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ todayBookings: 0, pendingPayments: 0, customers: 0, msgsToday: 0, revenue: 0, awaiting: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [b, p, c, m, conf] = await Promise.all([
        supabase.from('tn_bookings').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', today),
        supabase.from('tn_payments').select('amount', { count: 'exact' }).eq('user_id', user.id).eq('status', 'pending'),
        supabase.from('tn_customers').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('tn_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', today),
        supabase.from('tn_payments').select('amount').eq('user_id', user.id).eq('status', 'verified'),
      ]);
      const revenue = (conf.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      setStats({
        todayBookings: b.count || 0,
        pendingPayments: p.count || 0,
        customers: c.count || 0,
        msgsToday: m.count || 0,
        revenue,
        awaiting: (p.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
      });
    })();
  }, [user]);

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">TN45 Travel Aid — Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">WhatsApp booking automation overview</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Stat icon={CalendarDays} label="Today Bookings" value={stats.todayBookings} accent="bg-primary" />
          <Stat icon={AlertCircle} label="Pending Payments" value={stats.pendingPayments} accent="bg-orange-500" />
          <Stat icon={Users} label="Total Customers" value={stats.customers} accent="bg-blue-500" />
          <Stat icon={MessageSquare} label="Msgs Today" value={stats.msgsToday} accent="bg-green-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Verified Revenue</p>
            <p className="text-4xl font-bold mt-3 text-green-600">₹{stats.revenue.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-2">Sum of verified UPI advance payments.</p>
          </Card>
          <Card className="p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Awaiting Verification</p>
            <p className="text-4xl font-bold mt-3 text-orange-600">₹{stats.awaiting.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-2">Customers have paid; verify screenshots in Payments.</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Quick Setup Checklist</h2>
          </div>
          <ol className="space-y-2 text-sm">
            <li>1. Open <b>WhatsApp Settings</b> → paste your Meta Access Token, Phone Number ID, WABA ID, App Secret & Verify Token.</li>
            <li>2. Upload your UPI QR code + enter UPI ID and payee name.</li>
            <li>3. Set webhook URL in Meta dashboard to <code className="text-xs bg-muted px-2 py-1 rounded">https://fpgdzyzmejhagkszrphl.supabase.co/functions/v1/whatsapp-webhook</code></li>
            <li>4. Send "hi" from a test WhatsApp number — booking flow starts.</li>
          </ol>
        </Card>
      </div>
    </AppLayout>
  );
};

export default TNDashboard;

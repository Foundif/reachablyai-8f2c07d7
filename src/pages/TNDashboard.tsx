import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CreditCard, Users, MessageSquare, TrendingUp, AlertCircle, Contact, Inbox, Megaphone, Workflow, ArrowRight } from 'lucide-react';


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

const ModuleTile = ({ icon: Icon, label, value, hint, gradient, to, navigate }: any) => (
  <button
    onClick={() => navigate(to)}
    className="group relative text-left p-5 rounded-2xl border bg-card hover:shadow-glow transition-all overflow-hidden"
  >
    <div className={`absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity ${gradient}`} />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className="text-4xl font-bold mt-2">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </div>
      <div className={`p-3 rounded-xl ${gradient}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <div className="relative mt-4 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
      Open <ArrowRight className="w-3 h-3" />
    </div>
  </button>
);

const TNDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ todayBookings: 0, pendingPayments: 0, customers: 0, msgsToday: 0, revenue: 0, awaiting: 0, leadsNew: 0, inboxUnread: 0, campaignsMonth: 0, automationsActive: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [b, c, m, allBookings, payVerified, payPending, leadsRes, msgUnread, campRes] = await Promise.all([
        supabase.from('tn_bookings').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', today),
        supabase.from('tn_customers').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('tn_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', today),
        supabase.from('tn_bookings').select('status, price, advance_amount, balance_amount').eq('user_id', user.id),
        supabase.from('tn_payments').select('amount').eq('user_id', user.id).eq('status', 'verified'),
        supabase.from('tn_payments').select('amount').eq('user_id', user.id).eq('status', 'pending'),
        supabase.from('leads' as any).select('id', { count: 'exact', head: true }).gte('created_at', weekAgo).eq('status', 'new'),
        supabase.from('tn_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('direction', 'inbound').gte('created_at', today),
        supabase.from('tn_campaigns').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', monthStart),
      ]);



      // Revenue = verified payments + advance from paid/completed bookings (whichever wired)
      const paidStatuses = new Set(['paid', 'completed', 'confirmed']);
      const awaitingStatuses = new Set(['awaiting_payment', 'pending']);
      let bookingRevenue = 0;
      let bookingAwaiting = 0;
      (allBookings.data || []).forEach((row: any) => {
        const adv = Number(row.advance_amount || 0);
        const price = Number(row.price || 0);
        if (paidStatuses.has(row.status)) bookingRevenue += adv || price;
        else if (awaitingStatuses.has(row.status)) bookingAwaiting += adv || price;
      });
      const verifiedSum = (payVerified.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const pendingSum = (payPending.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

      setStats({
        todayBookings: b.count || 0,
        pendingPayments: (payPending.data || []).length,
        customers: c.count || 0,
        msgsToday: m.count || 0,
        revenue: verifiedSum + bookingRevenue,
        awaiting: pendingSum + bookingAwaiting,
        leadsNew: leadsRes.count || 0,
        inboxUnread: msgUnread.count || 0,
        campaignsMonth: campRes.count || 0,
        automationsActive: 0,
      });
    })();
  }, [user]);

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reachably — Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">WhatsApp CRM · Leads · Campaigns · Automation</p>
        </div>

        {/* 2x2 Module grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <ModuleTile icon={Contact} label="Leads" value={stats.leadsNew} hint="New this week" gradient="bg-gradient-to-br from-fuchsia-500 to-pink-500" to="/leads" navigate={navigate} />
          <ModuleTile icon={Inbox} label="Inbox" value={stats.inboxUnread} hint="Unread messages" gradient="bg-gradient-to-br from-blue-500 to-indigo-500" to="/inbox" navigate={navigate} />
          <ModuleTile icon={Megaphone} label="Campaigns" value={stats.campaignsMonth} hint="Sent this month" gradient="bg-gradient-to-br from-orange-500 to-rose-500" to="/campaigns" navigate={navigate} />
          <ModuleTile icon={Workflow} label="Automation" value={stats.automationsActive} hint="Active flows" gradient="bg-gradient-to-br from-emerald-500 to-teal-500" to="/automation" navigate={navigate} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Stat icon={CalendarDays} label="Today Bookings" value={stats.todayBookings} accent="bg-indigo-500" />
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
          <ol className="space-y-3 text-sm">
            <li>1. Open <b>WhatsApp Settings</b> → paste your Meta Access Token, Phone Number ID, WABA ID, App Secret & Verify Token.</li>
            <li>2. Upload your UPI QR code + enter UPI ID and payee name.</li>
            <li>
              3. Set webhook URL in Meta dashboard to:
              <code className="block mt-1.5 text-[11px] bg-muted px-2 py-1.5 rounded break-all whitespace-pre-wrap">
                https://fpgdzyzmejhagkszrphl.supabase.co/functions/v1/whatsapp-webhook
              </code>
            </li>
            <li>4. Send "hi" from a test WhatsApp number — booking flow starts.</li>
          </ol>
        </Card>
      </div>
    </AppLayout>
  );
};

export default TNDashboard;

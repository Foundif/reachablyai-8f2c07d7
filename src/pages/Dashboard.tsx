import { useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { useCustomers } from '@/hooks/useCustomers';
import { useSalonInvoices } from '@/hooks/useSalonInvoices';
import { useExpenses } from '@/hooks/useExpenses';
import { useEmployees } from '@/hooks/useEmployees';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import {
  Users, FileText, FileX, Wallet, Bell, Receipt,
  TrendingUp, UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { customers, loading: customersLoading } = useCustomers();
  const { invoices, loading: invoicesLoading } = useSalonInvoices();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { employees, loading: employeesLoading } = useEmployees();
  const currency = useCurrency();

  const loading = customersLoading || invoicesLoading || expensesLoading || employeesLoading;

  const today = new Date().toISOString().split('T')[0];

  const stats = useMemo(() => {
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const totalCustomers = customers.length;
    const customersThisMonth = customers.filter(c => c.created_at >= thisMonthStart).length;
    const customersToday = customers.filter(c => c.created_at.startsWith(today)).length;

    const gstInvoices = invoices.filter(i => i.gst_type === 'with_gst');
    const gstToday = gstInvoices.filter(i => i.invoice_date === today).reduce((s, i) => s + i.total_amount, 0);
    const gstMonth = gstInvoices.filter(i => i.invoice_date >= thisMonthStart).reduce((s, i) => s + i.total_amount, 0);

    const nonGstInvoices = invoices.filter(i => i.gst_type === 'without_gst');
    const nonGstToday = nonGstInvoices.filter(i => i.invoice_date === today).reduce((s, i) => s + i.total_amount, 0);
    const nonGstMonth = nonGstInvoices.filter(i => i.invoice_date >= thisMonthStart).reduce((s, i) => s + i.total_amount, 0);

    const expensesToday = expenses.filter(e => e.expense_date === today).reduce((s, e) => s + e.amount, 0);
    const expensesMonth = expenses.filter(e => e.expense_date >= thisMonthStart).reduce((s, e) => s + e.amount, 0);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 45);
    const reminders = customers.filter(c =>
      c.last_purchase_date && new Date(c.last_purchase_date) <= cutoffDate
    );

    const employeePerf = employees.map(emp => {
      const empItems = invoices.flatMap(inv =>
        (inv.items || []).filter(item => item.employee_id === emp.id).map(item => ({
          ...item,
          gst_type: inv.gst_type,
          invoice_date: inv.invoice_date,
        }))
      );
      const todayItems = empItems.filter(i => i.invoice_date === today);
      const monthItems = empItems.filter(i => i.invoice_date >= thisMonthStart);
      return {
        ...emp,
        gstToday: todayItems.filter(i => i.gst_type === 'with_gst').reduce((s, i) => s + i.price * i.quantity, 0),
        nonGstToday: todayItems.filter(i => i.gst_type === 'without_gst').reduce((s, i) => s + i.price * i.quantity, 0),
        gstMonth: monthItems.filter(i => i.gst_type === 'with_gst').reduce((s, i) => s + i.price * i.quantity, 0),
        nonGstMonth: monthItems.filter(i => i.gst_type === 'without_gst').reduce((s, i) => s + i.price * i.quantity, 0),
      };
    });

    // Monthly trends for charts
    const monthlyGst: Record<string, number> = {};
    const monthlyNonGst: Record<string, number> = {};
    invoices.forEach(inv => {
      const m = inv.invoice_date.slice(0, 7);
      if (inv.gst_type === 'with_gst') monthlyGst[m] = (monthlyGst[m] || 0) + inv.total_amount;
      else monthlyNonGst[m] = (monthlyNonGst[m] || 0) + inv.total_amount;
    });

    // Build chart data (last 6 months)
    const allMonths = new Set([...Object.keys(monthlyGst), ...Object.keys(monthlyNonGst)]);
    const chartData = Array.from(allMonths).sort().slice(-6).map(m => ({
      month: new Date(m + '-01').toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      gst: monthlyGst[m] || 0,
      nonGst: monthlyNonGst[m] || 0,
    }));

    return {
      totalCustomers, customersThisMonth, customersToday,
      gstToday, gstMonth, nonGstToday, nonGstMonth,
      expensesToday, expensesMonth,
      reminders, employeePerf, chartData,
    };
  }, [customers, invoices, expenses, employees, today]);

  if (loading) {
    return <AppLayout><DashboardSkeleton /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-5 lg:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Welcome back, {profile?.store_name || 'Salon'}</p>
          </div>
          <Button variant="trust" size="default" className="w-full sm:w-auto" onClick={() => navigate('/create-bill')}>
            <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />Create Bill
          </Button>
        </div>

        {/* KPI Cards - 2x2 on mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          <StatsCard title="Total Customers" value={stats.totalCustomers.toString()} icon={Users} variant="primary"
            change={stats.customersToday > 0 ? { value: stats.customersToday, label: 'today' } : undefined} />
          <StatsCard title="GST Sales Today" value={formatCurrency(stats.gstToday, currency)} icon={FileText} variant="default" />
          <StatsCard title="Non-GST Today" value={formatCurrency(stats.nonGstToday, currency)} icon={FileX} variant="default" />
          <StatsCard title="Expenses Today" value={formatCurrency(stats.expensesToday, currency)} icon={Wallet} variant="warning" />
          <div className="cursor-pointer col-span-2 lg:col-span-1" onClick={() => navigate('/customers?tab=reminders')}>
            <StatsCard title="Reminders to Send" value={stats.reminders.length.toString()} icon={Bell}
              variant={stats.reminders.length > 0 ? 'danger' : 'default'} />
          </div>
        </div>

        {/* Monthly summaries - 2x2 on mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          <StatsCard title="Customers This Month" value={stats.customersThisMonth.toString()} icon={Users} variant="default" />
          <StatsCard title="GST Sales (Month)" value={formatCurrency(stats.gstMonth, currency)} icon={FileText} variant="primary" />
          <StatsCard title="Non-GST (Month)" value={formatCurrency(stats.nonGstMonth, currency)} icon={FileX} variant="default" />
          <StatsCard title="Expenses (Month)" value={formatCurrency(stats.expensesMonth, currency)} icon={Wallet} variant="default" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
          {/* GST Sales Trend Chart */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm sm:text-base">GST Sales Trend</h3>
            </div>
            <div className="p-4">
              {stats.chartData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">No sales data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={stats.chartData}>
                    <defs>
                      <linearGradient id="gstGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [formatCurrency(value, currency), 'GST Sales']}
                    />
                    <Area type="monotone" dataKey="gst" stroke="hsl(var(--primary))" fill="url(#gstGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Non-GST Sales Trend Chart */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Non-GST Sales Trend</h3>
            </div>
            <div className="p-4">
              {stats.chartData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">No sales data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [formatCurrency(value, currency), 'Non-GST Sales']}
                    />
                    <Bar dataKey="nonGst" fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {/* Employee Performance */}
          <div className="lg:col-span-2">
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">Employee Performance</h3>
              </div>
              <div className="divide-y divide-border">
                {stats.employeePerf.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No employees added yet</div>
                ) : (
                  stats.employeePerf.map((emp) => (
                    <div key={emp.id} className="px-4 py-3">
                      <p className="text-sm font-semibold text-foreground mb-2">{emp.name}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-muted-foreground">GST Today</p>
                          <p className="font-bold text-foreground">{formatCurrency(emp.gstToday, currency)}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-muted-foreground">Non-GST Today</p>
                          <p className="font-bold text-foreground">{formatCurrency(emp.nonGstToday, currency)}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-muted-foreground">GST Month</p>
                          <p className="font-bold text-primary">{formatCurrency(emp.gstMonth, currency)}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-muted-foreground">Non-GST Month</p>
                          <p className="font-bold text-primary">{formatCurrency(emp.nonGstMonth, currency)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Reminders */}
          <div>
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Bell className="w-4 h-4 text-risk-high" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">Reminders to Send</h3>
              </div>
              <div className="divide-y divide-border">
                {stats.reminders.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">All customers are active!</div>
                ) : (
                  stats.reminders.slice(0, 5).map((c) => {
                    const daysSince = Math.floor((Date.now() - new Date(c.last_purchase_date!).getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={c.id} className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-risk-high">{daysSince} days since last visit</p>
                      </div>
                    );
                  })
                )}
                {stats.reminders.length > 5 && (
                  <div className="px-4 py-2 text-center">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/customers?tab=reminders')} className="text-xs">
                      View all {stats.reminders.length} reminders
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
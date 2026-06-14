import { useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/data/mockData';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import {
  BarChart3, TrendingUp, Package, Archive, ShoppingCart,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const Analytics = () => {
  const { products, loading: prodLoading } = useProducts();
  const { sales, loading: salesLoading } = useSales();
  const currency = useCurrency();
  const loading = prodLoading || salesLoading;

  // Sales trends (last 30 days)
  const salesTrend = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days[key] = 0;
    }
    sales.forEach(s => {
      const key = s.created_at.split('T')[0];
      if (days[key] !== undefined) days[key] += s.total_amount;
    });
    return Object.entries(days).map(([date, amount]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount,
    }));
  }, [sales]);

  // Top selling products
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    sales.forEach(s => {
      (s.items || []).forEach(item => {
        if (!map[item.product_id]) map[item.product_id] = { name: item.product_name, qty: 0, revenue: 0 };
        map[item.product_id].qty += item.quantity;
        map[item.product_id].revenue += item.selling_price * item.quantity;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [sales]);

  // Top selling sizes
  const topSizes = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach(s => {
      (s.items || []).forEach(item => {
        map[item.size] = (map[item.size] || 0) + item.quantity;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([size, qty]) => ({ size: `Size ${size}`, qty }));
  }, [sales]);

  // Dead stock (no sale in 90 days)
  const deadStock = useMemo(() => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return products.filter(p => {
      if ((p.total_stock || 0) === 0) return false;
      const productSales = sales.flatMap(s => (s.items || []).filter(i => i.product_id === p.id));
      if (productSales.length === 0) return new Date(p.created_at) < ninetyDaysAgo;
      const lastSale = productSales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return new Date(lastSale.created_at) < ninetyDaysAgo;
    });
  }, [products, sales]);

  // Low stock
  const lowStock = useMemo(() => products.filter(p => (p.total_stock || 0) > 0 && (p.total_stock || 0) < 3), [products]);

  // Payment method distribution
  const paymentDist = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach(s => { map[s.payment_method] = (map[s.payment_method] || 0) + s.total_amount; });
    return Object.entries(map).map(([method, value]) => ({ name: method.toUpperCase(), value }));
  }, [sales]);

  // Category distribution
  const categoryDist = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => { map[p.category] = (map[p.category] || 0) + (p.total_stock || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [products]);

  // Summary stats
  const totalRevenue = sales.reduce((s, sale) => s + sale.total_amount, 0);
  const totalProfit = useMemo(() => {
    let profit = 0;
    sales.forEach(s => {
      (s.items || []).forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          profit += (item.selling_price - product.purchase_price) * item.quantity;
        }
      });
    });
    return profit;
  }, [sales, products]);

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1">Analytics</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Insights into sales, inventory, and performance</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Revenue', value: formatCurrency(totalRevenue, currency), icon: TrendingUp, color: 'text-primary' },
            { label: 'Est. Profit', value: formatCurrency(totalProfit, currency), icon: BarChart3, color: 'text-risk-safe' },
            { label: 'Low Stock Items', value: lowStock.length.toString(), icon: Package, color: 'text-risk-medium' },
            { label: 'Dead Stock Items', value: deadStock.length.toString(), icon: Archive, color: 'text-risk-high' },
          ].map((stat, i) => (
            <div key={i} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={cn('w-4 h-4', stat.color)} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className={cn('text-xl sm:text-2xl font-bold', stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Sales Trend Chart */}
        <div className="glass-card p-4 sm:p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />Sales Trend (Last 30 Days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={4} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [formatCurrency(value, currency), 'Revenue']}
                />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Top Selling Products */}
          <div className="glass-card p-4 sm:p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />Top Selling Products
            </h3>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`${value} pairs`, 'Sold']}
                    />
                    <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top Selling Sizes */}
          <div className="glass-card p-4 sm:p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />Top Selling Sizes
            </h3>
            {topSizes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSizes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="size" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Payment Distribution */}
          <div className="glass-card p-4 sm:p-6">
            <h3 className="font-semibold text-foreground mb-4">Payment Distribution</h3>
            {paymentDist.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paymentDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [formatCurrency(value, currency), 'Revenue']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Category Stock Distribution */}
          <div className="glass-card p-4 sm:p-6">
            <h3 className="font-semibold text-foreground mb-4">Stock by Category</h3>
            {categoryDist.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {categoryDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Dead Stock Report */}
        <div className="glass-card overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
            <Archive className="w-5 h-5 text-risk-high" />
            <h3 className="font-semibold text-foreground">Dead Stock Report</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-risk-high/10 text-risk-high">{deadStock.length} items</span>
          </div>
          {deadStock.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No dead stock detected — all products are selling well!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Product</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Category</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Stock</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Value</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {deadStock.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-4 font-medium text-foreground">{p.brand} {p.model_name}</td>
                      <td className="p-4 text-sm text-muted-foreground capitalize">{p.category}</td>
                      <td className="p-4 text-sm text-risk-high font-semibold">{p.total_stock} pairs</td>
                      <td className="p-4 text-sm text-foreground">{formatCurrency((p.total_stock || 0) * p.purchase_price, currency)}</td>
                      <td className="p-4 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Analytics;

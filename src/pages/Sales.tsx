import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useSales } from '@/hooks/useSales';
import { useCurrency } from '@/hooks/useCurrency';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { formatCurrency } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportToCSV, exportToExcel, ExportColumn } from '@/lib/exportUtils';
import { 
  Plus, Search, ShoppingCart, Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sale } from '@/types/store';

const Sales = () => {
  const navigate = useNavigate();
  const { sales, loading } = useSales();
  const currency = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const filteredSales = useMemo(() => {
    let filtered = [...sales];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.invoice_number.toLowerCase().includes(q) ||
        s.customer_phone?.toLowerCase().includes(q)
      );
    }
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (dateFilter === 'today') {
        filtered = filtered.filter(s => new Date(s.created_at) >= today);
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(s => new Date(s.created_at) >= weekAgo);
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(s => new Date(s.created_at) >= monthAgo);
      }
    }
    return filtered;
  }, [sales, searchQuery, dateFilter]);

  const stats = {
    total: filteredSales.reduce((sum, s) => sum + s.total_amount, 0),
    count: filteredSales.length,
    cash: filteredSales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + s.total_amount, 0),
    upi: filteredSales.filter(s => s.payment_method === 'upi').reduce((sum, s) => sum + s.total_amount, 0),
  };

  const exportColumns: ExportColumn<Sale>[] = [
    { header: 'Invoice', accessor: 'invoice_number' },
    { header: 'Date', accessor: (s) => new Date(s.created_at).toLocaleString() },
    { header: 'Amount', accessor: 'total_amount' },
    { header: 'Payment Method', accessor: 'payment_method' },
    { header: 'Customer Phone', accessor: (s) => s.customer_phone || '' },
    { header: 'Items', accessor: (s) => s.items?.length || 0 },
  ];

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Sales History</h1>
            <p className="text-muted-foreground">Track all completed transactions</p>
          </div>
          <div className="flex gap-2">
            {filteredSales.length > 0 && (
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredSales, exportColumns, 'sales-report')}>
                  <Download className="w-4 h-4" />CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportToExcel(filteredSales, exportColumns, 'sales-report')}>
                  <Download className="w-4 h-4" />Excel
                </Button>
              </div>
            )}
            <Button variant="trust" size="lg" onClick={() => navigate('/sales/new')}>
              <Plus className="w-5 h-5" />New Sale
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Sales', value: formatCurrency(stats.total, currency), color: 'text-foreground' },
            { label: 'Transactions', value: stats.count.toString(), color: 'text-primary' },
            { label: 'Cash Sales', value: formatCurrency(stats.cash, currency), color: 'text-risk-safe' },
            { label: 'UPI Sales', value: formatCurrency(stats.upi, currency), color: 'text-primary' },
          ].map((stat, i) => (
            <div key={i} className="glass-card p-4">
              <div className="text-sm text-muted-foreground mb-1">{stat.label}</div>
              <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input placeholder="Search by invoice or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {['all', 'today', 'week', 'month'].map((f) => (
              <Button key={f} variant={dateFilter === f ? 'default' : 'outline'} size="sm" onClick={() => setDateFilter(f)} className="whitespace-nowrap capitalize">
                {f === 'all' ? 'All Time' : f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : 'Today'}
              </Button>
            ))}
          </div>
        </div>

        {/* Sales List */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Invoice</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date & Time</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Items</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Payment</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Phone</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/sales/${sale.id}`)}>
                    <td className="p-4 font-medium text-foreground">{sale.invoice_number}</td>
                    <td className="p-4 text-sm text-muted-foreground">{new Date(sale.created_at).toLocaleString()}</td>
                    <td className="p-4 text-sm text-foreground">{sale.items?.length || 0} items</td>
                    <td className="p-4 font-bold text-foreground">{formatCurrency(sale.total_amount, currency)}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary capitalize">{sale.payment_method}</span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{sale.customer_phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredSales.length === 0 && (
            <div className="p-12 text-center">
              <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No sales found</h3>
              <p className="text-muted-foreground mb-4">{sales.length === 0 ? 'Make your first sale to get started' : 'Try adjusting your filters'}</p>
              <Button variant="trust" onClick={() => navigate('/sales/new')}><Plus className="w-4 h-4" />New Sale</Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Sales;

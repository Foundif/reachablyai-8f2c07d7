import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';
import { 
  Bell, AlertTriangle, Package, TrendingDown, Archive,
  Filter, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const Alerts = () => {
  const navigate = useNavigate();
  const { products } = useProducts();
  const { sales } = useSales();
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'dead_stock'>('all');

  // Low stock: quantity < 3 pairs (but > 0)
  const lowStockProducts = products.filter(p => (p.total_stock || 0) > 0 && (p.total_stock || 0) < 3);
  
  // Out of stock
  const outOfStockProducts = products.filter(p => (p.total_stock || 0) === 0);

  // Dead stock: no sale in 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const deadStockProducts = products.filter(p => {
    const productSales = sales.flatMap(s => (s.items || []).filter(i => i.product_id === p.id));
    if (productSales.length === 0) {
      return new Date(p.created_at) < ninetyDaysAgo;
    }
    const lastSale = productSales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    return new Date(lastSale.created_at) < ninetyDaysAgo;
  });

  // Build alerts list
  type AlertItem = { id: string; type: 'low_stock' | 'out_of_stock' | 'dead_stock'; severity: 'high' | 'medium' | 'low'; title: string; message: string; productId: string; };
  const alerts: AlertItem[] = [];

  outOfStockProducts.forEach(p => {
    alerts.push({ id: `oos-${p.id}`, type: 'out_of_stock' as any, severity: 'high', title: 'Out of Stock', message: `${p.brand} ${p.model_name} has 0 pairs in stock`, productId: p.id });
  });
  lowStockProducts.forEach(p => {
    alerts.push({ id: `low-${p.id}`, type: 'low_stock', severity: 'medium', title: 'Low Stock', message: `${p.brand} ${p.model_name} has only ${p.total_stock} pairs left`, productId: p.id });
  });
  deadStockProducts.forEach(p => {
    alerts.push({ id: `dead-${p.id}`, type: 'dead_stock', severity: 'low', title: 'Dead Stock', message: `${p.brand} ${p.model_name} hasn't sold in 90+ days`, productId: p.id });
  });

  const filteredAlerts = filter === 'all' ? alerts : alerts.filter(a => a.type === filter || (filter === 'low_stock' && a.type === 'out_of_stock' as any));

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return Package;
      case 'out_of_stock': return AlertTriangle;
      case 'dead_stock': return Archive;
      default: return Bell;
    }
  };

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-5 lg:space-y-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 sm:gap-3 mb-0.5 sm:mb-1 flex-wrap">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Stock Alerts</h1>
              {alerts.length > 0 && (
                <span className="bg-risk-high text-white text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">{alerts.length}</span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Monitor inventory levels and dead stock</p>
          </div>
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 sm:gap-3">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-full xs:w-[160px] bg-background text-sm">
                <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Alerts</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="dead_stock">Dead Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {filteredAlerts.map((alert, index) => {
            const Icon = getAlertIcon(alert.type);
            return (
              <div key={alert.id} onClick={() => navigate(`/products/${alert.productId}`)}
                className={cn('glass-card p-3 sm:p-4 lg:p-5 border-l-4 cursor-pointer transition-all duration-300 hover-lift animate-fade-up',
                  alert.severity === 'high' ? 'border-l-risk-high' : alert.severity === 'medium' ? 'border-l-risk-medium' : 'border-l-risk-safe'
                )} style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex items-start gap-2.5 sm:gap-3 lg:gap-4">
                  <div className={cn('p-2 sm:p-2.5 lg:p-3 rounded-lg sm:rounded-xl flex-shrink-0',
                    alert.severity === 'high' ? 'bg-risk-high/20 text-risk-high' : alert.severity === 'medium' ? 'bg-risk-medium/20 text-risk-medium' : 'bg-risk-safe/20 text-risk-safe')}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 sm:mb-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm sm:text-base">{alert.title}</span>
                      <span className={cn('text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full',
                        alert.severity === 'high' ? 'bg-risk-high/20 text-risk-high' : alert.severity === 'medium' ? 'bg-risk-medium/20 text-risk-medium' : 'bg-risk-safe/20 text-risk-safe')}>
                        {alert.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredAlerts.length === 0 && (
            <div className="glass-card p-8 sm:p-12 text-center">
              <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-muted-foreground">
                {filter === 'all' ? 'No alerts — all stock levels are healthy!' : `No ${filter.replace('_', ' ')} alerts`}
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Alerts;

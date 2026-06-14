import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Package, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

type Order = { id: string; customer: string; total: number; status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'; items: number; createdAt: string };
const STORAGE = 'foundif_orders';
const STATUSES: Order['status'][] = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
const COLORS: Record<Order['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-600',
  paid: 'bg-blue-500/15 text-blue-600',
  shipped: 'bg-violet-500/15 text-violet-600',
  delivered: 'bg-emerald-500/15 text-emerald-600',
  cancelled: 'bg-red-500/15 text-red-600',
};
const seed = (): Order[] => [
  { id: 'ORD-1042', customer: 'Priya S.', total: 1299, status: 'pending', items: 2, createdAt: '2026-06-12T10:00:00Z' },
  { id: 'ORD-1041', customer: 'Rahul K.', total: 549, status: 'paid', items: 1, createdAt: '2026-06-12T08:15:00Z' },
  { id: 'ORD-1040', customer: 'Aisha M.', total: 2199, status: 'shipped', items: 3, createdAt: '2026-06-11T17:42:00Z' },
  { id: 'ORD-1039', customer: 'Vikram R.', total: 899, status: 'delivered', items: 1, createdAt: '2026-06-10T14:20:00Z' },
];

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE);
    setOrders(raw ? JSON.parse(raw) : seed());
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(orders)); }, [orders]);

  const setStatus = (id: string, s: Order['status']) => {
    setOrders((o) => o.map((x) => x.id === id ? { ...x, status: s } : x));
    toast.success(`Order ${id} → ${s}`);
  };

  const filtered = orders.filter((o) => !q || o.id.toLowerCase().includes(q.toLowerCase()) || o.customer.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" /> Orders
          </h1>
          <p className="text-sm text-muted-foreground">Track and fulfil orders from WhatsApp.</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by ID or customer…" className="pl-9" />
        </div>

        <div className="glass-elevated overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="border-b border-border/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Items</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Date</th>
            </tr></thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{o.id}</td>
                  <td className="p-3 font-medium">{o.customer}</td>
                  <td className="p-3">{o.items}</td>
                  <td className="p-3 font-semibold">₹{o.total}</td>
                  <td className="p-3">
                    <Select value={o.status} onValueChange={(v) => setStatus(o.id, v as Order['status'])}>
                      <SelectTrigger className={`h-7 w-32 text-xs border-0 ${COLORS[o.status]}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};
export default Orders;

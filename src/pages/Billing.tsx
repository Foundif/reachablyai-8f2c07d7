import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Receipt, CreditCard, Zap, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const PLAN_DETAILS: Record<string, { name: string; price: string; limits: [string, number, number][] }> = {
  free: { name: 'Free', price: '₹0 / month', limits: [['Messages', 0, 100], ['AI replies', 0, 25], ['Contacts', 0, 100]] },
  pro: { name: 'Pro', price: '₹999 / month', limits: [['Messages', 0, 5000], ['AI replies', 0, 1000], ['Contacts', 0, 2500]] },
  professional: { name: 'Pro', price: '₹999 / month', limits: [['Messages', 0, 5000], ['AI replies', 0, 1000], ['Contacts', 0, 2500]] },
  growth: { name: 'Growth', price: '₹2,499 / month', limits: [['Messages', 0, 15000], ['AI replies', 0, 5000], ['Contacts', 0, 10000]] },
  premium: { name: 'Growth', price: '₹2,499 / month', limits: [['Messages', 0, 15000], ['AI replies', 0, 5000], ['Contacts', 0, 10000]] },
};

const Billing = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const status = (profile?.subscription_status || 'free').toLowerCase();
  const plan = PLAN_DETAILS[status] || PLAN_DETAILS.free;
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" /> Billing & Plans
          </h1>
          <p className="text-sm text-muted-foreground">Manage your subscription, invoices and credits.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 glass-elevated p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</p>
            <div className="flex items-center gap-2 mt-1">
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">Active</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{plan.price}{plan.name === 'Free' ? ' · upgrade anytime' : ' · manual UPI verified plan'}</p>
            <div className="grid grid-cols-3 gap-3 mt-5">
              {plan.limits.map(([label, used, total]) => <Stat key={label} label={label} used={used} total={total} />)}
            </div>
            <div className="flex gap-2 mt-5">
              <Button onClick={() => navigate('/pricing')}><Zap className="w-4 h-4" /> {plan.name === 'Free' ? 'Upgrade plan' : 'Change plan'}</Button>
            </div>
          </div>

          <div className="glass-elevated p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Payment method</p>
            <div className="flex items-center gap-3 mt-3">
              <CreditCard className="w-8 h-8 text-primary" />
              <div>
                <p className="font-semibold">Manual UPI</p>
                <p className="text-xs text-muted-foreground">No saved card on file</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => navigate('/pricing')}>Open plans</Button>
          </div>
        </div>

        <div className="glass-elevated">
          <div className="p-4 border-b border-border/50"><h3 className="font-semibold">Invoices</h3></div>
          <div className="p-8 text-center text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">No verified billing invoices yet.</p>
            <p className="text-xs mt-1">After a manual payment is verified, the active plan appears here from your account status.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

const Stat = ({ label, used, total }: { label: string; used: number; total: number }) => {
  const pct = (used / total) * 100;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-bold mt-0.5">{used.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">/ {total.toLocaleString()}</span></p>
      <div className="h-1.5 mt-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
};
export default Billing;

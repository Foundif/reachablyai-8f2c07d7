import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Receipt, CreditCard, Download, CheckCircle2, Zap } from 'lucide-react';

const INVOICES = [
  { id: 'INV-2026-0612', date: '2026-06-01', amount: '₹2,499', status: 'Paid' },
  { id: 'INV-2026-0512', date: '2026-05-01', amount: '₹2,499', status: 'Paid' },
  { id: 'INV-2026-0412', date: '2026-04-01', amount: '₹2,499', status: 'Paid' },
];

const Billing = () => {
  const navigate = useNavigate();
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
              <h2 className="text-2xl font-bold">Growth</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">Active</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">₹2,499 / month · renews on July 1, 2026</p>
            <div className="grid grid-cols-3 gap-3 mt-5">
              <Stat label="Messages" used={4203} total={10000} />
              <Stat label="AI replies" used={812} total={2000} />
              <Stat label="Contacts" used={2104} total={5000} />
            </div>
            <div className="flex gap-2 mt-5">
              <Button onClick={() => navigate('/pricing')}><Zap className="w-4 h-4" /> Upgrade plan</Button>
              <Button variant="outline">Cancel subscription</Button>
            </div>
          </div>

          <div className="glass-elevated p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Payment method</p>
            <div className="flex items-center gap-3 mt-3">
              <CreditCard className="w-8 h-8 text-primary" />
              <div>
                <p className="font-semibold">•••• 4242</p>
                <p className="text-xs text-muted-foreground">Expires 12/28</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4">Update method</Button>
          </div>
        </div>

        <div className="glass-elevated">
          <div className="p-4 border-b border-border/50"><h3 className="font-semibold">Invoices</h3></div>
          <div className="divide-y divide-border/50">
            {INVOICES.map((i) => (
              <div key={i.id} className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{i.id}</p>
                  <p className="text-xs text-muted-foreground">{i.date}</p>
                </div>
                <span className="font-semibold text-sm">{i.amount}</span>
                <Button variant="ghost" size="icon"><Download className="w-4 h-4" /></Button>
              </div>
            ))}
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

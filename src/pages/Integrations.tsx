import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plug, Check, Search } from 'lucide-react';
import { toast } from 'sonner';

const APPS = [
  { id: 'shopify', name: 'Shopify', cat: 'Commerce', desc: 'Sync products, orders & customers' },
  { id: 'stripe', name: 'Stripe', cat: 'Payments', desc: 'Accept payments in WhatsApp checkout' },
  { id: 'razorpay', name: 'Razorpay', cat: 'Payments', desc: 'UPI / card / netbanking for India' },
  { id: 'hubspot', name: 'HubSpot', cat: 'CRM', desc: 'Two-way contact & deal sync' },
  { id: 'salesforce', name: 'Salesforce', cat: 'CRM', desc: 'Enterprise CRM sync' },
  { id: 'zapier', name: 'Zapier', cat: 'Automation', desc: '6,000+ apps via Zaps' },
  { id: 'make', name: 'Make.com', cat: 'Automation', desc: 'Visual scenario automation' },
  { id: 'google-sheets', name: 'Google Sheets', cat: 'Data', desc: 'Export contacts and conversations' },
  { id: 'mailchimp', name: 'Mailchimp', cat: 'Marketing', desc: 'Sync audience for email + WhatsApp' },
  { id: 'calendly', name: 'Calendly', cat: 'Bookings', desc: 'Auto-confirm meetings via WhatsApp' },
  { id: 'slack', name: 'Slack', cat: 'Collaboration', desc: 'Get inbox alerts in Slack channels' },
  { id: 'notion', name: 'Notion', cat: 'Collaboration', desc: 'Log conversations to a database' },
];
const STORAGE = 'foundif_integrations';

const Integrations = () => {
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  useEffect(() => { setConnected(JSON.parse(localStorage.getItem(STORAGE) || '{}')); }, []);
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(connected)); }, [connected]);

  const toggle = (id: string, name: string) => {
    setConnected((c) => ({ ...c, [id]: !c[id] }));
    toast.success(connected[id] ? `${name} disconnected` : `${name} connected ✓`);
  };

  const filtered = APPS.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.cat.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Plug className="w-6 h-6 text-primary" /> Integrations Hub
          </h1>
          <p className="text-sm text-muted-foreground">Connect Chatarly with your favorite tools.</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search integrations…" className="pl-9" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => {
            const on = !!connected[a.id];
            return (
              <div key={a.id} className="glass-panel p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/15 text-primary font-bold flex items-center justify-center">{a.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{a.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.cat}</p>
                  </div>
                  {on && <span className="text-emerald-600 flex items-center gap-1 text-xs"><Check className="w-3.5 h-3.5" />Connected</span>}
                </div>
                <p className="text-xs text-muted-foreground flex-1">{a.desc}</p>
                <Button variant={on ? 'outline' : 'default'} size="sm" onClick={() => toggle(a.id, a.name)} className="w-full">
                  {on ? 'Disconnect' : 'Connect'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};
export default Integrations;

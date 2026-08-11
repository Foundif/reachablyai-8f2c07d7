import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';

/** Shopify events that can move a client's trust score. */
const EVENTS: { id: string; label: string; hint: string; defaultDelta: number }[] = [
  { id: 'order_paid', label: 'Order paid', hint: 'Payment captured on time', defaultDelta: 4 },
  { id: 'order_placed', label: 'Order placed', hint: 'New order created', defaultDelta: 1 },
  { id: 'order_fulfilled', label: 'Order fulfilled', hint: 'Shipped without disputes', defaultDelta: 2 },
  { id: 'payment_pending', label: 'Payment pending past due', hint: 'Invoice overdue', defaultDelta: -6 },
  { id: 'order_cancelled', label: 'Order cancelled', hint: 'Customer cancelled', defaultDelta: -3 },
  { id: 'refund_issued', label: 'Refund issued', hint: 'Money returned', defaultDelta: -4 },
  { id: 'chargeback', label: 'Chargeback / dispute', hint: 'Strongest negative signal', defaultDelta: -20 },
  { id: 'cart_abandoned', label: 'Cart abandoned', hint: 'Low-intent signal', defaultDelta: 0 },
];

/** Risk-profile fields the Shopify customer record can populate. */
const FIELDS: { id: string; label: string; options: string[] }[] = [
  { id: 'email', label: 'Client email', options: ['customer.email', 'email', 'contact_email'] },
  { id: 'phone', label: 'Client phone', options: ['customer.phone', 'phone', 'billing_address.phone'] },
  { id: 'company', label: 'Company', options: ['customer.default_address.company', 'billing_address.company', 'company'] },
  { id: 'country', label: 'Country', options: ['billing_address.country', 'shipping_address.country', 'customer.default_address.country'] },
  { id: 'industry', label: 'Industry tag', options: ['customer.tags', 'tags', 'note_attributes.industry'] },
  { id: 'amount', label: 'Invoice amount', options: ['total_price', 'current_total_price', 'subtotal_price'] },
  { id: 'due_date', label: 'Payment due date', options: ['processed_at', 'created_at', 'note_attributes.due_date'] },
];

type RiskConfig = {
  enabled: boolean;
  events: Record<string, { on: boolean; delta: number }>;
  fields: Record<string, string>;
  delay_penalty_per_day: number;
  high_risk_below: number;
  medium_risk_below: number;
};

const defaults = (): RiskConfig => ({
  enabled: true,
  events: Object.fromEntries(EVENTS.map(e => [e.id, { on: e.defaultDelta !== 0, delta: e.defaultDelta }])),
  fields: Object.fromEntries(FIELDS.map(f => [f.id, f.options[0]])),
  delay_penalty_per_day: 0.5,
  high_risk_below: 40,
  medium_risk_below: 70,
});

const ShopifyRiskMapping = ({ workspaceId }: { workspaceId: string | null }) => {
  const [cfg, setCfg] = useState<RiskConfig>(defaults());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!workspaceId) { setLoading(false); return; }
      const { data } = await supabase.from('integrations' as any)
        .select('settings').eq('workspace_id', workspaceId).eq('provider', 'shopify').maybeSingle();
      const saved = (data as any)?.settings?.risk;
      if (saved) setCfg({ ...defaults(), ...saved, events: { ...defaults().events, ...(saved.events || {}) }, fields: { ...defaults().fields, ...(saved.fields || {}) } });
      setLoading(false);
    })();
  }, [workspaceId]);

  const save = async () => {
    if (!workspaceId) return;
    setSaving(true);
    const { data: existing } = await supabase.from('integrations' as any)
      .select('settings').eq('workspace_id', workspaceId).eq('provider', 'shopify').maybeSingle();
    const settings = { ...((existing as any)?.settings || {}), risk: cfg };
    const { error } = await supabase.from('integrations' as any).upsert({
      workspace_id: workspaceId, provider: 'shopify', status: 'connected', settings,
    } as any, { onConflict: 'workspace_id,provider' });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Risk scoring rules saved');
  };

  if (loading) return <div className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Client Risk Intelligence Network
          </p>
          <p className="text-xs text-muted-foreground">
            Feed Shopify order and payment events into each client's trust score.
          </p>
        </div>
        <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
      </Card>

      <Card className="p-4 space-y-3">
        <p className="font-semibold text-sm">Events → score impact</p>
        <div className="space-y-2">
          {EVENTS.map(e => {
            const row = cfg.events[e.id] || { on: false, delta: e.defaultDelta };
            return (
              <div key={e.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Switch
                  checked={row.on}
                  onCheckedChange={(v) => setCfg({ ...cfg, events: { ...cfg.events, [e.id]: { ...row, on: v } } })}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{e.hint}</p>
                </div>
                <Badge variant="outline" className={row.delta >= 0 ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : 'bg-destructive/15 text-destructive border-destructive/30'}>
                  {row.delta >= 0 ? `+${row.delta}` : row.delta}
                </Badge>
                <Input
                  type="number"
                  className="w-20"
                  value={row.delta}
                  onChange={(ev) => setCfg({ ...cfg, events: { ...cfg.events, [e.id]: { ...row, delta: Number(ev.target.value) } } })}
                  aria-label={`${e.label} score impact`}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <p className="font-semibold text-sm">Field mapping</p>
        <p className="text-xs text-muted-foreground">Which Shopify payload field fills each risk-profile attribute.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {FIELDS.map(f => (
            <div key={f.id} className="space-y-1.5">
              <Label>{f.label}</Label>
              <Select value={cfg.fields[f.id]} onValueChange={(v) => setCfg({ ...cfg, fields: { ...cfg.fields, [f.id]: v } })}>
                <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                <SelectContent>{f.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <p className="font-semibold text-sm">Scoring thresholds</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Penalty per day late</Label>
            <Input type="number" step="0.1" value={cfg.delay_penalty_per_day}
              onChange={(e) => setCfg({ ...cfg, delay_penalty_per_day: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Medium risk below</Label>
            <Input type="number" value={cfg.medium_risk_below}
              onChange={(e) => setCfg({ ...cfg, medium_risk_below: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>High risk below</Label>
            <Input type="number" value={cfg.high_risk_below}
              onChange={(e) => setCfg({ ...cfg, high_risk_below: Number(e.target.value) })} />
          </div>
        </div>
      </Card>

      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save risk rules
      </Button>
    </div>
  );
};

export default ShopifyRiskMapping;

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, Loader2, ShoppingBag, ShoppingCart, Truck, BadgeCheck, Settings2 } from 'lucide-react';

const FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/generic-webhook`;
const PHONE = 'customer.phone|shipping_address.phone|billing_address.phone|phone';

/** Pre-built Shopify → WhatsApp notification recipes. */
export const SHOPIFY_RECIPES = [
  {
    key: 'order_placed', icon: ShoppingBag, name: 'Shopify · Order confirmation',
    title: 'Order confirmation', event: 'Order creation',
    sample: 'Hi {{1}}, thanks for your order {{2}}! Total ₹{{3}}. We are packing it now.',
    variables: { '1': 'customer.first_name', '2': 'name', '3': 'total_price' },
    conditions: [] as any[],
  },
  {
    key: 'cod_verify', icon: BadgeCheck, name: 'Shopify · COD verification',
    title: 'COD verification', event: 'Order creation',
    sample: 'Hi {{1}}, please confirm your Cash on Delivery order {{2}} of ₹{{3}}.',
    variables: { '1': 'customer.first_name', '2': 'name', '3': 'total_price' },
    conditions: [{ field: 'payment_gateway_names.0', op: 'contains', value: 'cash' }],
  },
  {
    key: 'shipped', icon: Truck, name: 'Shopify · Shipping update',
    title: 'Shipping / tracking update', event: 'Fulfillment creation',
    sample: 'Good news {{1}}! Order {{2}} has shipped via {{3}}. Track: {{4}}',
    variables: { '1': 'destination.first_name', '2': 'name', '3': 'tracking_company', '4': 'tracking_url' },
    conditions: [] as any[],
  },
  {
    key: 'abandoned_cart', icon: ShoppingCart, name: 'Shopify · Abandoned cart',
    title: 'Abandoned cart recovery', event: 'Checkout update',
    sample: 'Hey {{1}}, you left items in your cart! Complete your order here: {{2}}',
    variables: { '1': 'customer.first_name', '2': 'abandoned_checkout_url' },
    conditions: [{ field: 'completed_at', op: 'not_equals', value: '' }].map(c => ({ ...c, op: 'equals' })),
  },
];

interface Hook { id: string; name: string; token: string; active: boolean; template_id: string | null; last_received_at: string | null }

const ShopifyRecipes = ({ workspaceId, userId }: { workspaceId: string | null; userId?: string }) => {
  const navigate = useNavigate();
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!workspaceId) return;
    const { data } = await supabase.from('webhook_endpoints' as any)
      .select('id,name,token,active,template_id,last_received_at')
      .eq('workspace_id', workspaceId).like('name', 'Shopify · %');
    setHooks((data as any) || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspaceId]);

  const create = async (r: typeof SHOPIFY_RECIPES[number]) => {
    if (!workspaceId) return;
    setBusy(r.key);
    const { data, error } = await supabase.from('webhook_endpoints' as any).insert({
      workspace_id: workspaceId, name: r.name, created_by: userId,
      phone_field: PHONE, name_field: 'customer.first_name',
      variable_map: r.variables, conditions: r.conditions, active: true,
    } as any).select('id').maybeSingle();
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${r.title} ready — pick your approved template next`);
    navigate(`/integrations/webhooks/${(data as any).id}`);
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success('Webhook URL copied'); };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">WhatsApp order notifications</p>
        <p className="text-xs text-muted-foreground">
          One click sets up each alert with Shopify fields pre-filled. Then pick an approved template, copy the URL and add it in
          Shopify → Settings → Notifications → Webhooks (format JSON) for the event shown.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SHOPIFY_RECIPES.map(r => {
          const hook = hooks.find(h => h.name === r.name);
          const Icon = r.icon;
          return (
            <Card key={r.key} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 text-primary" />
                  <p className="text-sm font-medium truncate">{r.title}</p>
                </div>
                {hook && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {hook.template_id ? (hook.active ? 'Live' : 'Paused') : 'Pick template'}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Shopify event: <b>{r.event}</b></p>
              <p className="text-[11px] italic text-muted-foreground line-clamp-2">“{r.sample}”</p>
              {hook ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => copy(`${FN_BASE}/${hook.token}`)}>
                    <Copy className="w-3.5 h-3.5 mr-1" />URL
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => navigate(`/integrations/webhooks/${hook.id}`)}>
                    <Settings2 className="w-3.5 h-3.5 mr-1" />Setup
                  </Button>
                </div>
              ) : (
                <Button size="sm" className="w-full" disabled={busy === r.key} onClick={() => create(r)}>
                  {busy === r.key && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}Enable
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ShopifyRecipes;

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { toast } from 'sonner';
import { Copy, Loader2, Plug, Trash2, ExternalLink, Webhook, ChevronRight } from 'lucide-react';
import ShopifyRiskMapping from '@/components/integrations/ShopifyRiskMapping';
import razorpayLogo from '@/assets/razorpay.svg.asset.json';
import shiprocketLogo from '@/assets/shiprocket.png.asset.json';

type Field = { key: string; label: string; placeholder?: string; secret?: boolean };

type Provider = {
  id: string;
  name: string;
  logo: string;
  tagline: string;
  blurb: string;
  free?: boolean;
  docs?: string;
  fields: Field[];
  capabilities: string[];
};

const PROVIDERS: Provider[] = [
  {
    id: 'webhook',
    name: 'Generic Webhook',
    logo: 'https://cdn.simpleicons.org/webhooks/C73A63',
    tagline: 'Trigger WhatsApp messages from an external system using webhook.',
    blurb: 'Post JSON to your Reachably endpoint from any external system and trigger WhatsApp messages instantly.',
    fields: [
      { key: 'name', label: 'Integration name', placeholder: 'e.g. Storesum API' },
      { key: 'secret', label: 'Signing secret (optional)', placeholder: 'Shared secret to verify calls', secret: true },
    ],
    capabilities: ['Trigger template messages', 'Create contacts automatically', 'Custom payload mapping'],
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    logo: razorpayLogo.url,
    tagline: 'Send Payment notifications and subscription updates to drive quick recovery.',
    blurb: 'Integrate Razorpay with your Official WhatsApp Business Number and share payment updates with your customers.',
    docs: 'https://razorpay.com/docs/payments/payment-links/',
    fields: [
      { key: 'brand_name', label: 'Brand name', placeholder: 'Enter your brand name' },
      { key: 'key_id', label: 'Razorpay Key ID', placeholder: 'rzp_live_xxxxxxxx' },
      { key: 'key_secret', label: 'Razorpay Key Secret', placeholder: '••••••••', secret: true },
    ],
    capabilities: [
      'Send customized payment links',
      'Send payment confirmation and invoices',
      'Send refund updates to your customers',
      'Send different payment statuses and keep customers informed',
      'WhatsApp broadcast to targeted customers',
    ],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    logo: 'https://cdn.simpleicons.org/shopify/95BF47',
    tagline: 'Send Order notifications to your customers and also boost cart recovery.',
    blurb: 'Sync orders, customers and abandoned carts from your Shopify store into Reachably.',
    free: true,
    docs: 'https://shopify.dev/docs/api/admin',
    fields: [
      { key: 'shop_domain', label: 'Store domain', placeholder: 'mystore.myshopify.com' },
      { key: 'access_token', label: 'Admin API access token', placeholder: 'shpat_xxxxxxxx', secret: true },
    ],
    capabilities: ['Order placed / shipped / delivered alerts', 'Abandoned cart recovery', 'Customer & revenue sync'],
  },
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    logo: shiprocketLogo.url,
    tagline: 'Send Order updates to your customer on WhatsApp for better experience.',
    blurb: 'Push shipment and tracking updates straight to your customers on WhatsApp.',
    docs: 'https://apidocs.shiprocket.in/',
    fields: [
      { key: 'email', label: 'Shiprocket email', placeholder: 'you@company.com' },
      { key: 'password', label: 'Shiprocket password', placeholder: '••••••••', secret: true },
    ],
    capabilities: ['Shipment picked up / in transit / delivered', 'Tracking link sharing', 'NDR follow-ups'],
  },
];

interface Row { id: string; provider: string; status: string; display_name: string | null; settings: Record<string, any> }
interface WebhookRow { id: string; name: string; token: string; active: boolean; last_received_at: string | null; template_id: string | null }

const FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/generic-webhook`;

const Logo = ({ src, alt, className = 'w-10 h-10' }: { src: string; alt: string; className?: string }) => (
  <div className={`${className} rounded-xl bg-muted/60 grid place-items-center overflow-hidden shrink-0`}>
    <img src={src} alt={`${alt} logo`} className="w-3/5 h-3/5 object-contain" loading="lazy" />
  </div>
);

const Integrations = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [wsId, setWsId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Provider | null>(null);
  const [detail, setDetail] = useState<Provider | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Provider | null>(null);
  const [hookDialog, setHookDialog] = useState(false);
  const [hookName, setHookName] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const id = await resolveWorkspaceId(user.id, profile);
    setWsId(id);
    if (!id) { setLoading(false); return; }
    const [{ data }, { data: wh }] = await Promise.all([
      supabase.from('integrations' as any).select('*').eq('workspace_id', id),
      supabase.from('webhook_endpoints' as any).select('id,name,token,active,last_received_at,template_id')
        .eq('workspace_id', id).order('created_at', { ascending: false }),
    ]);
    setRows(((data as any[]) || []) as Row[]);
    setHooks(((wh as any[]) || []) as WebhookRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user, profile]);

  const connected = useMemo(() => new Map(rows.map(r => [r.provider, r])), [rows]);

  const createWebhook = async () => {
    if (!wsId) return;
    if (!hookName.trim()) return toast.error('Enter a webhook name');
    setSaving(true);
    const { data, error } = await supabase.from('webhook_endpoints' as any)
      .insert({ workspace_id: wsId, name: hookName.trim(), created_by: user?.id } as any)
      .select('id').maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    setHookDialog(false);
    setHookName('');
    navigate(`/integrations/webhooks/${(data as any).id}`);
  };

  const openConnect = (p: Provider) => {
    if (p.id === 'webhook') { setHookName(''); setHookDialog(true); return; }
    const existing = connected.get(p.id);
    setForm((existing?.settings as Record<string, string>) || {});
    setActive(p);
  };


  const save = async () => {
    if (!active || !wsId) return;
    const missing = active.fields.filter(f => !f.label.toLowerCase().includes('optional') && !form[f.key]?.trim());
    if (missing.length) return toast.error(`Please fill: ${missing.map(m => m.label).join(', ')}`);
    setSaving(true);
    const { error } = await supabase.from('integrations' as any).upsert({
      workspace_id: wsId,
      provider: active.id,
      status: 'connected',
      display_name: form.brand_name || form.name || active.name,
      settings: form,
    } as any, { onConflict: 'workspace_id,provider' });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${active.name} connected`);
    setActive(null);
    load();
  };

  const remove = async () => {
    const p = pendingRemove;
    setPendingRemove(null);
    if (!p || !wsId) return;
    const { error } = await supabase.from('integrations' as any).delete().eq('workspace_id', wsId).eq('provider', p.id);
    if (error) return toast.error(error.message);
    toast.success(`${p.name} disconnected`);
    load();
  };

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied'); };

  const myIntegrations = PROVIDERS.filter(p => connected.has(p.id));

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Plug className="w-6 h-6" /> Integrations</h1>
          <p className="text-muted-foreground text-sm">Connect payments, shipping, storefronts and webhooks to your WhatsApp workspace.</p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : (
          <>
            {hooks.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Generic Webhooks</h2>
                  <Button size="sm" variant="outline" onClick={() => { setHookName(''); setHookDialog(true); }}>New webhook</Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {hooks.map(h => (
                    <Card
                      key={h.id}
                      className="p-4 space-y-2 hover-lift cursor-pointer"
                      onClick={() => navigate(`/integrations/webhooks/${h.id}`)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Webhook className="w-4 h-4 shrink-0" />
                          <p className="font-semibold truncate">{h.name}</p>
                        </div>
                        <Badge variant="outline" className={h.active && h.template_id ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : ''}>
                          {h.template_id ? (h.active ? 'Active' : 'Paused') : 'Setup'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] truncate flex-1 text-muted-foreground">{`${FN_BASE}/${h.token}`}</code>
                        <Button size="sm" variant="ghost" aria-label="Copy webhook URL"
                          onClick={(e) => { e.stopPropagation(); copy(`${FN_BASE}/${h.token}`); }}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        {h.last_received_at ? `Last event ${new Date(h.last_received_at).toLocaleString()}` : 'No events yet'}
                        <ChevronRight className="w-3 h-3" />
                      </p>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {myIntegrations.length > 0 && (

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">My Integrations</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {myIntegrations.map(p => {
                    const row = connected.get(p.id)!;
                    return (
                      <Card key={p.id} className="p-4 space-y-3 hover-lift">
                        <div className="flex items-start justify-between gap-3">
                          <Logo src={p.logo} alt={p.name} />
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Connected</Badge>
                        </div>
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{p.tagline}</p>
                        </div>
                        <div className="rounded-lg border px-3 py-2 text-xs flex items-center gap-2 truncate">
                          <Plug className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{row.display_name || p.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => openConnect(p)}>Configure</Button>
                          <Button size="sm" variant="ghost" onClick={() => setPendingRemove(p)} aria-label={`Disconnect ${p.name}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Available Integrations</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {PROVIDERS.map(p => (
                  <Card key={p.id} className="p-4 space-y-3 hover-lift cursor-pointer" onClick={() => setDetail(p)}>
                    <div className="flex items-center gap-2">
                      <Logo src={p.logo} alt={p.name} />
                      {p.free && <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Free</Badge>}
                    </div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.tagline}</p>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Detail sheet */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <Logo src={detail.logo} alt={detail.name} className="w-12 h-12" />
                  <div className="flex-1">
                    <DialogTitle>{detail.name} Integration</DialogTitle>
                    <DialogDescription>{detail.blurb}</DialogDescription>
                    {detail.docs && (
                      <a href={detail.docs} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 mt-1 underline">
                        Help Docs <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3">
                <p className="font-semibold text-sm">What can I do?</p>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {detail.capabilities.map(c => (
                    <li key={c} className="text-sm text-muted-foreground flex gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-foreground/40 shrink-0" />{c}
                    </li>
                  ))}
                </ul>

                {detail.id === 'webhook' && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium">How it works</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                      <li>Click Connect and give the webhook a name.</li>
                      <li>Copy the generated webhook URL into your external platform.</li>
                      <li>Trigger a test event, then hit “Capture webhook response”.</li>
                      <li>Map recipient name &amp; number, pick a template, activate the workflow.</li>
                      <li>Track everything under Logs (received / sent / failed).</li>
                    </ol>
                    <code className="block text-[11px] truncate text-muted-foreground">{`${FN_BASE}/<your-token>`}</code>
                  </div>
                )}

                {detail.id === 'shopify' && (
                  <div className="pt-2 border-t space-y-3">
                    <ShopifyRiskMapping workspaceId={wsId} />
                  </div>
                )}

              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
                <Button onClick={() => { const p = detail; setDetail(null); openConnect(p); }}>
                  {connected.has(detail.id) ? 'Configure' : 'Connect'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create generic webhook */}
      <Dialog open={hookDialog} onOpenChange={setHookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Generic Webhook</DialogTitle>
            <DialogDescription>Give this webhook a name. You'll get a unique URL to paste into your platform.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="hook-name">Webhook name</Label>
            <Input id="hook-name" placeholder="Lead Capture Webhook" value={hookName}
              onChange={(e) => setHookName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHookDialog(false)}>Cancel</Button>
            <Button onClick={createWebhook} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Connect form */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>Connect {active.name} Account</DialogTitle>
                <DialogDescription>{active.blurb}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {active.fields.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={f.key}>{f.label}</Label>
                    <Input
                      id={f.key}
                      type={f.secret ? 'password' : 'text'}
                      placeholder={f.placeholder}
                      value={form[f.key] || ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Connect Account
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {pendingRemove?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Saved credentials and automation for this integration will be removed from this workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Integrations;

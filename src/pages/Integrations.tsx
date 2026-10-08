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
import { Copy, Loader2, Plug, Trash2, ExternalLink, Webhook, ChevronRight, Table2, RefreshCw, Megaphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ShopifyRiskMapping from '@/components/integrations/ShopifyRiskMapping';
import webhookIcon from '@/assets/webhook-icon.png';
import razorpayLogo from '@/assets/razorpay.svg.asset.json';
import shiprocketLogo from '@/assets/shiprocket.png.asset.json';

type Field = { key: string; label: string; placeholder?: string; secret?: boolean };

type Provider = {
  id: string;
  name: string;
  logo?: string;
  icon?: LucideIcon;
  tagline: string;
  blurb: string;
  free?: boolean;
  docs?: string;
  fields: Field[];
  capabilities: string[];
};

// Apps Script the client pastes into their own Google Sheet. It appends a new row
// per booking and updates the existing row when the payment status changes.
const SHEETS_SCRIPT = `function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var props = PropertiesService.getScriptProperties();
  var expected = props.getProperty('SECRET') || '';
  if (expected && body.secret !== expected) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Bad secret' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = body.tab || 'Bookings';
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var cols = body.columns;

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(cols);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold');
  }

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = cols.map(function (c) { return body.row[c] === undefined ? '' : body.row[c]; });
  var keyCol = header.indexOf(body.key) + 1;
  var keyValue = body.row[body.key];
  var rowIndex = 0;

  if (keyCol > 0 && keyValue && sheet.getLastRow() > 1) {
    var keys = sheet.getRange(2, keyCol, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(keyValue)) { rowIndex = i + 2; break; }
    }
  }

  if (rowIndex) sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);

  return ContentService.createTextOutput(JSON.stringify({ ok: true, updated: !!rowIndex }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const PROVIDERS: Provider[] = [
  {
    id: 'webhook',
    name: 'Generic Webhook',
    logo: webhookIcon,
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
    blurb: `Payments go straight to your own bank account. To confirm bookings automatically when a customer pays, open Razorpay Dashboard → Settings → Webhooks → Add, paste this URL and tick "payment_link.paid": https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/razorpay-record-webhook`,
    docs: 'https://razorpay.com/docs/payments/payment-links/',
    fields: [
      { key: 'brand_name', label: 'Brand name', placeholder: 'Enter your brand name' },
      { key: 'key_id', label: 'Razorpay Key ID', placeholder: 'rzp_live_xxxxxxxx' },
      { key: 'key_secret', label: 'Razorpay Key Secret', placeholder: '••••••••', secret: true },
      { key: 'webhook_secret', label: 'Webhook secret (optional)', placeholder: 'Same secret you typed in Razorpay webhook', secret: true },
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
    id: 'google_sheets',
    name: 'Google Sheets',
    icon: Table2,
    tagline: 'Every booking and payment appears live in your own Google Sheet.',
    blurb: 'Connect your own Google Sheet and Reachably writes each booking as a row, then updates the same row when the advance is paid.',
    free: true,
    docs: 'https://developers.google.com/apps-script/guides/web',
    fields: [
      { key: 'web_app_url', label: 'Apps Script web app URL', placeholder: 'https://script.google.com/macros/s/.../exec' },
      { key: 'tab', label: 'Sheet tab name', placeholder: 'Bookings' },
      { key: 'secret', label: 'Secret (optional)', placeholder: 'Same value you set as SECRET in Apps Script', secret: true },
    ],
    capabilities: [
      'New booking added as a row instantly',
      'Same row updated when the advance is paid',
      'Passenger, address, date, add-ons and notes included',
      'Amount, advance, paid and balance columns',
      'Share the sheet with your team or accountant',
    ],
  },
  {
    id: 'meta_lead_ads',
    name: 'Meta Lead Ads',
    icon: Megaphone,
    tagline: 'Facebook & Instagram ad leads delivered to WhatsApp in seconds.',
    blurb: 'Every lead form submission lands in Contacts with campaign, ad and answers, alerts your team on WhatsApp instantly, and can greet the lead automatically.',
    free: true,
    docs: 'https://developers.facebook.com/docs/marketing-api/guides/lead-ads/',
    fields: [
      { key: 'page_id', label: 'Facebook Page ID', placeholder: '1234567890' },
      { key: 'page_access_token', label: 'Page access token', placeholder: 'EAAG...', secret: true },
      { key: 'verify_token', label: 'Webhook verify token', placeholder: 'Any word you choose, e.g. reachably-leads' },
      { key: 'alert_numbers', label: 'Team WhatsApp numbers (comma separated)', placeholder: '9876543210, 9123456780' },
      { key: 'alert_template_id', label: 'Alert template ID (optional)', placeholder: 'Approved template for team alerts' },
      { key: 'greeting_template_id', label: 'Greeting template ID for the lead (optional)', placeholder: 'Approved welcome template' },
      { key: 'app_secret', label: 'Meta app secret (optional)', placeholder: 'Verifies calls really come from Meta', secret: true },
      { key: 'ad_account_id', label: 'Ad account ID (for daily report)', placeholder: 'act_1234567890' },
      { key: 'ads_access_token', label: 'Ads access token with ads_read (optional)', placeholder: 'Uses the Page token if empty', secret: true },
      { key: 'digest_numbers', label: 'Daily report WhatsApp numbers', placeholder: 'Defaults to team numbers' },
      { key: 'daily_budget_limit', label: 'Daily spend limit (₹) — alert if crossed', placeholder: '2000' },
      { key: 'max_cpl', label: 'Max cost per lead (₹) — alert if crossed', placeholder: '150' },
      { key: 'digest_template_id', label: 'Report template ID (optional)', placeholder: '1 date, 2 spend, 3 leads, 4 CPL, 5 alerts' },
    ],
    capabilities: [
      'Instant CRM contact with campaign, ad set and ad tags',
      'All form answers saved in notes',
      'WhatsApp alert to your sales team with one-tap chat link',
      'Optional auto-greeting template to the lead',
      'Duplicate numbers merged, not repeated',
      'Daily WhatsApp report: spend, leads, cost per lead, top campaigns',
      'Overspend, high cost-per-lead and zero-lead alerts',
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
const LEADGEN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/meta-leadgen-webhook`;

const Logo = ({ provider, className = 'w-10 h-10' }: { provider: Provider; className?: string }) => (
  <div className={`${className} rounded-xl bg-muted/60 grid place-items-center overflow-hidden shrink-0`}>
    {provider.logo
      ? <img src={provider.logo} alt={`${provider.name} logo`} className="w-3/5 h-3/5 object-contain" loading="lazy" />
      : provider.icon
        ? <provider.icon className="w-3/5 h-3/5 text-emerald-600" aria-label={`${provider.name} logo`} />
        : null}
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
  const [sheetBusy, setSheetBusy] = useState<'test' | 'backfill' | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);
  const sendDigestNow = async () => {
    if (!wsId) return;
    setDigestBusy(true);
    const { data, error } = await supabase.functions.invoke('meta-ads-digest', { body: { workspace_id: wsId } });
    setDigestBusy(false);
    if (error || (data as any)?.error) {
      let msg = (data as any)?.error || error?.message || 'Could not send report';
      try { msg = JSON.parse(await (error as any)?.context?.text())?.error || msg; } catch { /* keep msg */ }
      toast.error(msg);
    } else toast.success('Ad report sent on WhatsApp');
  };

  const callSheetSync = async (action: 'test' | 'sync_all') => {
    setSheetBusy(action === 'test' ? 'test' : 'backfill');
    const { data, error } = await supabase.functions.invoke('sheet-sync', { body: { action } });
    setSheetBusy(null);
    if (error) {
      let detail = error.message;
      try { detail = await (error as any)?.context?.text?.() || detail; } catch { /* keep message */ }
      return toast.error('Sheet sync failed', { description: String(detail).slice(0, 300) });
    }
    if ((data as any)?.ok === false) return toast.error('Sheet sync failed', { description: (data as any).error });
    if (action === 'test') toast.success('Test row added to your Google Sheet');
    else toast.success(`Sent ${(data as any)?.synced ?? 0} records to your sheet`);
  };

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
                          <Logo provider={p} />
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
                        {p.id === 'google_sheets' && (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button size="sm" variant="secondary" className="flex-1" disabled={sheetBusy !== null}
                              onClick={() => callSheetSync('test')}>
                              {sheetBusy === 'test' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                              Send test row
                            </Button>
                            <Button size="sm" variant="secondary" className="flex-1" disabled={sheetBusy !== null}
                              onClick={() => callSheetSync('sync_all')}>
                              {sheetBusy === 'backfill' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Sync existing
                            </Button>
                          </div>
                        )}
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
                      <Logo provider={p} />
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
                  <Logo provider={detail} className="w-12 h-12" />
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

                {detail.id === 'google_sheets' && (
                  <div className="rounded-lg border p-3 space-y-3">
                    <p className="text-xs font-medium">Setup (2 minutes)</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                      <li>Open your Google Sheet → Extensions → Apps Script.</li>
                      <li>Delete any code there and paste the script below. Save.</li>
                      <li>Optional: Project Settings → Script Properties → add <b>SECRET</b> with any password.</li>
                      <li>Deploy → New deployment → Web app. Execute as <b>Me</b>, access <b>Anyone</b>. Copy the Web app URL.</li>
                      <li>Click Connect here, paste the URL, tab name (e.g. Bookings) and the same secret.</li>
                      <li>Press “Send test row” on the connected card to confirm.</li>
                    </ol>
                    <pre className="text-[11px] bg-muted/50 rounded p-2 max-h-48 overflow-auto whitespace-pre">{SHEETS_SCRIPT}</pre>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(SHEETS_SCRIPT); toast.success('Script copied'); }}>Copy script</Button>
                      {connected.has('google_sheets') && (
                        <Button size="sm" variant="secondary" disabled={sheetBusy !== null} onClick={() => callSheetSync('test')}>
                          {sheetBusy === 'test' && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Send test row
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {detail.id === 'meta_lead_ads' && (
                  <div className="rounded-lg border p-3 space-y-3">
                    <p className="text-xs font-medium">Setup</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                      <li>Click Connect and fill your Facebook Page ID, Page access token (with leads_retrieval), a verify token of your choice, and team WhatsApp numbers.</li>
                      <li>In your Meta app → Webhooks → Page, paste the callback URL below and the same verify token.</li>
                      <li>Subscribe to the <b>leadgen</b> field and add your Page under Lead Access (CRM: your app).</li>
                      <li>Submit a test lead using Meta's Lead Ads Testing Tool — it appears in Contacts and your team gets a WhatsApp alert.</li>
                    </ol>
                    <code className="block text-[11px] break-all text-muted-foreground">{LEADGEN_URL}</code>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(LEADGEN_URL); toast.success('Callback URL copied'); }}>Copy callback URL</Button>
                    <p className="text-[11px] text-muted-foreground">Team alerts are plain WhatsApp messages, which only arrive if that number messaged your business in the last 24 hours. For guaranteed delivery, add an approved alert template ID (variables: 1 = name, 2 = phone, 3 = campaign).</p>
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs font-medium">Daily ad report</p>
                      <p className="text-[11px] text-muted-foreground">Every morning your team gets yesterday's spend, leads, cost per lead and top campaigns on WhatsApp, with alerts when spend or cost per lead crosses your limits. Add your Ad account ID in Configure.</p>
                      {connected.has('meta_lead_ads') && (
                        <Button size="sm" variant="secondary" disabled={digestBusy} onClick={sendDigestNow}>
                          {digestBusy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Send report now
                        </Button>
                      )}
                    </div>
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

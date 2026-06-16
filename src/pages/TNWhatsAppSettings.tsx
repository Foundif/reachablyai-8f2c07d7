import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { enableNotificationSound, playNotificationSound } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Copy, RefreshCw, Radio, Send, GitBranch } from 'lucide-react';

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

const TNWhatsAppSettings = () => {
  const { user } = useAuth();
  const [s, setS] = useState<any>({
    upi_id: '', payee_name: '', qr_image_url: '', advance_amount: 50,
    meta_phone_number_id: '', meta_waba_id: '', verify_token_hint: '',
    meta_template_name: '', meta_template_language: 'en_US',
  });
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  const loadEvents = async () => {
    if (!user) return;
    setLoadingEvents(true);
    const { data } = await supabase
      .from('tn_messages')
      .select('id, created_at, direction, type, wa_id, payload')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setEvents(data || []);
    setLoadingEvents(false);
  };

  const loadMetaLibrary = async () => {
    if (!user) return;
    const [t, f] = await Promise.all([
      supabase.from('tn_meta_templates').select('*').eq('user_id', user.id).order('synced_at', { ascending: false }),
      supabase.from('tn_meta_flows').select('*').eq('user_id', user.id).order('synced_at', { ascending: false }),
    ]);
    setTemplates(t.data || []);
    setFlows(f.data || []);
  };

  useEffect(() => { (async () => {
    if (!user) return;
    const { data } = await supabase.from('tn_settings').select('*').eq('user_id', user.id).maybeSingle();
    if (data) setS(data);
    loadEvents();
    loadMetaLibrary();
  })(); }, [user]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from('tn_settings').upsert({ ...s, user_id: user.id }, { onConflict: 'user_id' });
    if (error) toast.error(error.message); else toast.success('Settings saved');
  };

  const uploadQR = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/qr-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('tn-qr-codes').upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from('tn-qr-codes').getPublicUrl(path);
    setS({ ...s, qr_image_url: data.publicUrl });
    toast.success('QR uploaded — click Save');
  };

  const copyUrl = () => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success('Webhook URL copied'); };

  const syncMeta = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-sync', { body: { preferred_flow_id: '1668931244342394' } });
      if (error) throw error;
      await loadMetaLibrary();
      if (data?.settings) setS((prev: any) => ({ ...prev, ...data.settings }));
      const msg = `${data?.templates || 0} templates, ${data?.flows || 0} flows synced`;
      data?.errors?.length ? toast.warning(msg, { description: data.errors[0]?.error?.message || 'Some Meta items could not be synced.' }) : toast.success(msg);
    } catch (e: any) {
      toast.error(e.message || 'Meta sync failed', { description: 'Check that the WABA ID is saved and the backend Meta token has template and flow permissions.' });
    } finally {
      setSyncing(false);
    }
  };

  const testSound = () => {
    enableNotificationSound();
    playNotificationSound();
    toast.success('Message alert sound tested');
  };

  const useTemplate = async (template: any) => {
    const next = {
      ...s,
      meta_template_name: template.name,
      meta_template_language: template.language || s.meta_template_language || 'en_US',
    };
    setS(next);
    if (!user) return;
    const { error } = await supabase.from('tn_settings').upsert({ ...next, user_id: user.id }, { onConflict: 'user_id' });
    if (error) toast.error(error.message); else toast.success(`${template.name} will send for HELP/Hi keywords`);
  };

  const useFlow = async (flow: any) => {
    const next = { ...s, meta_flow_id: flow.meta_id };
    setS(next);
    if (!user) return;
    const { error } = await supabase.from('tn_settings').upsert({ ...next, user_id: user.id }, { onConflict: 'user_id' });
    if (error) toast.error(error.message); else toast.success(`${flow.name} saved as the published Flow`);
  };

  const inbound = events.filter(e => e.direction === 'in');
  const lastInbound = inbound[0];
  const minutesAgo = lastInbound
    ? Math.floor((Date.now() - new Date(lastInbound.created_at).getTime()) / 60000)
    : null;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-3xl">
        <h1 className="text-2xl md:text-3xl font-bold">WhatsApp Settings</h1>

        {/* Webhook setup */}
        <Card className="p-5 bg-orange-500/10 border-orange-500/30">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-2 flex-1">
              <p className="font-semibold">Meta Webhook URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background p-2 rounded break-all">{WEBHOOK_URL}</code>
                <Button size="sm" variant="ghost" onClick={copyUrl}><Copy className="w-4 h-4" /></Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Paste in <b>Meta → WhatsApp → Configuration → Webhook</b>. After verifying,
                click <b>Manage</b> next to the webhook and <b>subscribe to the <code>messages</code> field</b> on your WABA —
                without that subscription, inbound Hi/Help from customers will never reach this app.
              </p>
            </div>
          </div>
        </Card>

        {/* Live diagnostics */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className={`w-4 h-4 ${lastInbound ? 'text-emerald-500 animate-pulse' : 'text-muted-foreground'}`} />
              <h2 className="font-semibold text-lg">Webhook Diagnostics</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={loadEvents} disabled={loadingEvents}>
              <RefreshCw className={`w-4 h-4 ${loadingEvents ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {lastInbound ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Last inbound message received {minutesAgo === 0 ? 'just now' : `${minutesAgo}m ago`} from {lastInbound.wa_id}
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-orange-600 dark:text-orange-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">No inbound messages received yet.</p>
                <p className="text-muted-foreground text-xs mt-1">
                  If a customer texts your business number and nothing appears here, the cause is almost always:
                  (1) the webhook isn't subscribed to the <code>messages</code> field in Meta,
                  (2) the Phone Number ID below doesn't match the live number, or
                  (3) <code>META_APP_SECRET</code> doesn't match your Facebook App's secret.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {events.length === 0 && <p className="text-xs text-muted-foreground">No events logged yet.</p>}
            {events.map(e => (
              <div key={e.id} className="text-xs flex items-center gap-2 p-2 rounded bg-muted/40">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${e.direction === 'in' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-blue-500/20 text-blue-600'}`}>
                  {e.direction}
                </span>
                <span className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
                <span className="font-mono">{e.wa_id}</span>
                <span className="text-muted-foreground">· {e.type}</span>
                <span className="truncate flex-1 text-muted-foreground">
                  {e.payload?.text?.body || e.payload?.interactive?.body?.text || ''}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Meta credentials */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Meta WhatsApp Cloud API</h2>
          <div>
            <Label>Phone Number ID</Label>
            <Input value={s.meta_phone_number_id || ''} onChange={e => setS({ ...s, meta_phone_number_id: e.target.value })} placeholder="e.g. 109876543210987" />
            <p className="text-xs text-muted-foreground mt-1">Must exactly match the ID Meta sends in webhook payloads.</p>
          </div>
          <div>
            <Label>WhatsApp Business Account ID (WABA)</Label>
            <Input value={s.meta_waba_id || ''} onChange={e => setS({ ...s, meta_waba_id: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Approved Flow Template Name</Label>
              <Input value={s.meta_template_name || ''} onChange={e => setS({ ...s, meta_template_name: e.target.value })} placeholder="e.g. booking_flow_help" />
            </div>
            <div>
              <Label>Template Language</Label>
              <Input value={s.meta_template_language || ''} onChange={e => setS({ ...s, meta_template_language: e.target.value })} placeholder="en_US" />
            </div>
          </div>
          <div>
            <Label>Verify Token (must match Meta dashboard)</Label>
            <Input value={s.verify_token_hint || ''} onChange={e => setS({ ...s, verify_token_hint: e.target.value })} placeholder="Pick any string and paste in both places" />
          </div>
          <p className="text-xs text-muted-foreground">
            🔒 <b>Access Token</b>, <b>App Secret</b> and <b>Verify Token</b> are stored as project secrets
            (<code>META_ACCESS_TOKEN</code>, <code>META_APP_SECRET</code>, <code>META_VERIFY_TOKEN</code>). Update them in Cloud → Secrets.
          </p>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-semibold text-lg">Meta Templates & Flows</h2>
              <p className="text-xs text-muted-foreground">Sync approved templates and published Flows, then choose the template Chatarly sends for HELP/Hi keywords.</p>
            </div>
            <Button onClick={syncMeta} disabled={syncing || !s.meta_waba_id} variant="outline">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sync from Meta
            </Button>
            <Button type="button" onClick={testSound} variant="secondary">Test Sound</Button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><Send className="w-4 h-4 text-primary" />Approved templates</div>
              {templates.length === 0 ? <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/40">No templates synced yet.</p> : templates.map((t) => (
                <div key={`${t.meta_id}-${t.language}`} className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">{t.language || 'language'} · {t.category || 'category'}</p>
                    </div>
                    <Badge variant={t.status === 'APPROVED' ? 'default' : 'outline'} className="text-[10px]">{t.status || 'unknown'}</Badge>
                  </div>
                  <Button size="sm" variant={s.meta_template_name === t.name ? 'default' : 'outline'} className="w-full" onClick={() => useTemplate(t)} disabled={t.status !== 'APPROVED'}>
                    {s.meta_template_name === t.name ? 'Active for HELP' : 'Use for HELP auto-reply'}
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><GitBranch className="w-4 h-4 text-primary" />Published Flows</div>
              {flows.length === 0 ? <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/40">No flows synced yet.</p> : flows.map((f) => (
                <div key={f.meta_id} className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{f.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{f.meta_id}</p>
                    </div>
                    <Badge variant={f.status === 'PUBLISHED' ? 'default' : 'outline'} className="text-[10px]">{f.status || 'unknown'}</Badge>
                  </div>
                  <Button size="sm" variant={s.meta_flow_id === f.meta_id ? 'default' : 'outline'} className="w-full" onClick={() => useFlow(f)} disabled={f.status !== 'PUBLISHED'}>
                    {s.meta_flow_id === f.meta_id ? 'Active Flow' : 'Use this Flow ID'}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Meta profile photos are not included in normal WhatsApp webhook payloads, so Chatarly shows initials unless a public profile image URL is provided by Meta.
          </p>
        </Card>

        {/* UPI */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">UPI Payment</h2>
          <div>
            <Label>UPI ID</Label>
            <Input value={s.upi_id || ''} onChange={e => setS({ ...s, upi_id: e.target.value })} placeholder="yourname@okhdfcbank" />
          </div>
          <div>
            <Label>Payee Name</Label>
            <Input value={s.payee_name || ''} onChange={e => setS({ ...s, payee_name: e.target.value })} />
          </div>
          <div>
            <Label>Advance Amount (₹)</Label>
            <Input type="number" value={s.advance_amount || 50} onChange={e => setS({ ...s, advance_amount: Number(e.target.value) })} />
          </div>
          <div>
            <Label>UPI QR Image</Label>
            <Input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadQR(e.target.files[0])} />
            {s.qr_image_url && <img src={s.qr_image_url} alt="QR" className="w-32 h-32 mt-2 rounded border" />}
          </div>
        </Card>

        <Button onClick={save} className="w-full md:w-auto">Save Settings</Button>
      </div>
    </AppLayout>
  );
};
export default TNWhatsAppSettings;

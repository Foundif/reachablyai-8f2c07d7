import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Settings, ShieldCheck, ShieldAlert, Copy, Bug, RefreshCw, CheckCircle2, XCircle, MinusCircle, Inbox as InboxIcon, Facebook, Zap, Unplug } from 'lucide-react';
import { META_APP_ID, META_CONFIG_ID } from '@/lib/metaConfig';
import { resolveWorkspaceId } from '@/lib/workspace';

interface Creds {
  workspace_id: string;
  phone_number_id: string | null;
  waba_id: string | null;
  business_phone: string | null;
  access_token: string | null;
  app_secret: string | null;
  webhook_verify_token: string | null;
  verified: boolean;
  verified_at: string | null;
  last_error: string | null;
  connection_type: 'manual' | 'embedded' | null;
  connected_at: string | null;
  status: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const mask = (s: string | null) => s && s.length > 6 ? `••••${s.slice(-4)}` : (s || '');

const WhatsAppSettings = () => {
  const { user, profile } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({
    phone_number_id: '',
    waba_id: '',
    business_phone: '',
    access_token: '',
    app_secret: '',
    webhook_verify_token: '',
  });
  const [showToken, setShowToken] = useState(false);
  const [embedLoading, setEmbedLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [sessionInfo, setSessionInfo] = useState<{ waba_id?: string; phone_number_id?: string }>({});

  // Meta posts the Embedded Signup session data (WABA + phone id) back via postMessage
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (!/facebook\.com$/.test(new URL(event.origin).hostname)) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.event === 'FINISH') {
          setSessionInfo({ waba_id: data.data?.waba_id, phone_number_id: data.data?.phone_number_id });
        }
      } catch { /* not JSON — ignore */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const finishEmbedded = async (code: string, info: { waba_id?: string; phone_number_id?: string }) => {
    const { data, error } = await supabase.functions.invoke('whatsapp-embedded-connect', {
      body: { code, ...info },
    });
    setEmbedLoading(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || 'Connection failed');
    }
    toast.success(`Connected ${(data as any)?.phone || 'WhatsApp'}`);
    load();
  };

  /** WATI-style popup Embedded Signup (Facebook JS SDK, no page redirect). */
  const startEmbeddedSignup = async () => {
    setEmbedLoading(true);
    try {
      const FB = await loadFacebookSdk();
      FB.login((response: any) => {
        const code = response?.authResponse?.code;
        if (!code) {
          setEmbedLoading(false);
          return toast.error('Facebook sign-in was cancelled.');
        }
        finishEmbedded(code, sessionInfo);
      }, {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      });
    } catch (e: any) {
      // SDK blocked (extension / strict browser) — fall back to a full redirect
      toast.message('Opening Facebook in a new window…');
      const redirect_uri = `${window.location.origin}/whatsapp/callback`;
      const extras = encodeURIComponent(JSON.stringify({ setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' }));
      const url =
        `https://www.facebook.com/${'v20.0'}/dialog/oauth` +
        `?client_id=${encodeURIComponent(META_APP_ID)}` +
        `&config_id=${encodeURIComponent(META_CONFIG_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
        `&response_type=code&override_default_response_type=true` +
        `&extras=${extras}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      setEmbedLoading(false);
    }
  };


  const disconnect = async () => {
    if (!wsId) return;
    if (!confirm('Disconnect WhatsApp? Incoming messages will stop until you reconnect.')) return;
    setDisconnecting(true);
    const { error } = await supabase.from('whatsapp_credentials' as any)
      .update({ status: 'disconnected', verified: false, access_token: null })
      .eq('workspace_id', wsId);
    setDisconnecting(false);
    if (error) return toast.error(error.message);
    toast.success('Disconnected');
    load();
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const id = await resolveWorkspaceId(user.id, profile);
    setWsId(id);
    if (!id) { setLoading(false); return; }
    const { data } = await supabase.from('whatsapp_credentials' as any)
      .select('*').eq('workspace_id', id).maybeSingle();
    const c = data as any as Creds | null;
    setCreds(c);
    if (c) {
      setForm({
        phone_number_id: c.phone_number_id || '',
        waba_id: c.waba_id || '',
        business_phone: c.business_phone || '',
        access_token: '',
        app_secret: '',
        webhook_verify_token: c.webhook_verify_token || '',
      });
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user, profile]);

  const save = async () => {
    if (!wsId) return;
    if (!form.phone_number_id.trim() || !form.waba_id.trim()) return toast.error('Phone Number ID and WABA ID required');
    setSaving(true);
    const payload: any = {
      workspace_id: wsId,
      phone_number_id: form.phone_number_id.trim(),
      waba_id: form.waba_id.trim(),
      business_phone: form.business_phone.trim() || null,
      webhook_verify_token: form.webhook_verify_token.trim() || null,
      verified: false,
      connection_type: 'manual',
    };
    if (form.access_token.trim()) payload.access_token = form.access_token.trim();
    if (form.app_secret.trim()) payload.app_secret = form.app_secret.trim();

    const { error } = await supabase.from('whatsapp_credentials' as any).upsert(payload, { onConflict: 'workspace_id' });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Saved. Test the connection to verify.');
    load();
  };

  const test = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke('whatsapp-verify', { body: { workspace_id: wsId } });
    setTesting(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.verified) toast.success('Connection verified with Meta Cloud API');
    else toast.error((data as any)?.error || 'Verification failed');
    load();
  };

  const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success('Copied'); };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" /> WhatsApp Cloud API</h1>
          <p className="text-muted-foreground text-sm">Connect your Meta WhatsApp Business Cloud account.</p>
        </div>

        {loading ? <Card className="p-8 text-center">Loading…</Card> : (
        <>
        {/* Connection status header */}
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-semibold flex items-center gap-2">
                Connection status
                {creds?.status === 'connected' || creds?.verified
                  ? <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1"><ShieldCheck className="w-3 h-3" /> Connected</Badge>
                  : <Badge variant="outline" className="gap-1"><ShieldAlert className="w-3 h-3" /> Not connected</Badge>}
                {creds?.connection_type && (
                  <Badge variant="outline" className="gap-1 text-[10px] uppercase">
                    {creds.connection_type === 'embedded' ? <><Facebook className="w-3 h-3" /> Embedded</> : <>Manual</>}
                  </Badge>
                )}
              </div>
              {creds?.business_phone && <div className="text-sm text-muted-foreground mt-1">{creds.business_phone}</div>}
              {creds?.connected_at && <div className="text-xs text-muted-foreground">Connected {new Date(creds.connected_at).toLocaleString()}</div>}
            </div>
            {(creds?.status === 'connected' || creds?.verified) && (
              <Button variant="outline" size="sm" onClick={disconnect} disabled={disconnecting} className="gap-1">
                <Unplug className="w-3.5 h-3.5" /> {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            )}
          </div>
          {creds?.last_error && <p className="text-sm text-red-600">{creds.last_error}</p>}
        </Card>

        {/* Two connection methods */}
        <Card className="p-6 space-y-4">
          <div>
            <div className="font-semibold">Connect WhatsApp</div>
            <p className="text-xs text-muted-foreground">Choose how you want to link your WhatsApp Business account.</p>
          </div>
          <Tabs defaultValue={creds?.connection_type === 'manual' ? 'manual' : 'embedded'} className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="embedded" className="gap-1"><Zap className="w-3.5 h-3.5" /> Quick Connect <Badge className="ml-1 text-[9px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Recommended</Badge></TabsTrigger>
              <TabsTrigger value="manual">Manual Setup</TabsTrigger>
            </TabsList>

            <TabsContent value="embedded" className="pt-4 space-y-3">
              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600"><Facebook className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <div className="font-medium">Quick Connect via Facebook</div>
                    <p className="text-xs text-muted-foreground">Sign in with the Facebook account that owns your WhatsApp Business. We'll auto-fetch your Phone Number ID, WABA ID, and access token in one click.</p>
                  </div>
                </div>
                <Button onClick={startEmbeddedSignup} disabled={embedLoading} className="w-full gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                  <Facebook className="w-4 h-4" />
                  {embedLoading ? 'Redirecting to Facebook…' : 'Continue with Facebook'}
                </Button>
                <p className="text-[11px] text-muted-foreground">Requires a Meta Business account with a verified WhatsApp Business number.</p>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="pt-4 space-y-4">
              <p className="text-xs text-muted-foreground">Advanced — paste credentials from Meta Developer Console.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Phone Number ID *</Label><Input value={form.phone_number_id} onChange={e => setForm({ ...form, phone_number_id: e.target.value })} placeholder="e.g. 123456789012345" /></div>
                <div><Label>WhatsApp Business Account ID *</Label><Input value={form.waba_id} onChange={e => setForm({ ...form, waba_id: e.target.value })} placeholder="e.g. 987654321098765" /></div>
                <div><Label>Business phone number</Label><Input value={form.business_phone} onChange={e => setForm({ ...form, business_phone: e.target.value })} placeholder="+91…" /></div>
                <div>
                  <Label>Access Token {creds?.access_token && <span className="text-xs text-muted-foreground">(saved: {mask(creds.access_token)})</span>}</Label>
                  <div className="flex gap-2">
                    <Input type={showToken ? 'text' : 'password'} value={form.access_token} onChange={e => setForm({ ...form, access_token: e.target.value })} placeholder="Leave blank to keep existing" />
                    <Button type="button" variant="outline" onClick={() => setShowToken(s => !s)}>{showToken ? 'Hide' : 'Show'}</Button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label>App Secret {creds?.app_secret && <span className="text-xs text-muted-foreground">(saved: {mask(creds.app_secret)})</span>}</Label>
                  <Input type="password" value={form.app_secret} onChange={e => setForm({ ...form, app_secret: e.target.value })} placeholder="For webhook signature verification" />
                </div>
                <div className="md:col-span-2">
                  <Label>Webhook Verify Token</Label>
                  <Input value={form.webhook_verify_token} onChange={e => setForm({ ...form, webhook_verify_token: e.target.value })} placeholder="Any string. You'll paste this into Meta." />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                <Button variant="outline" onClick={test} disabled={testing || !creds?.access_token}>{testing ? 'Testing…' : 'Test Connection'}</Button>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="font-semibold">Webhook configuration (paste into Meta)</div>
          <div>
            <Label className="text-xs">Callback URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} />
              <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)}><Copy className="w-4 h-4" /></Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Verify Token</Label>
            <div className="flex gap-2">
              <Input readOnly value={form.webhook_verify_token || '(set and save above)'} />
              <Button variant="outline" size="icon" onClick={() => copy(form.webhook_verify_token)} disabled={!form.webhook_verify_token}><Copy className="w-4 h-4" /></Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Subscribe to <code>messages</code> and <code>message_status</code> fields on your WhatsApp app in Meta Developer Console.</p>
          <WebhookTestButton phoneNumberId={form.phone_number_id} webhookUrl={webhookUrl} />
        </Card>

        {wsId && <DebugPanel workspaceId={wsId} phoneNumberId={form.phone_number_id} />}
        </>)}
      </div>
    </AppLayout>
  );
};

export default WhatsAppSettings;

interface DebugEvent {
  id: string; event_type: string | null; status: string | null;
  from_phone: string | null; summary: string | null; error: string | null;
  phone_number_id: string | null; created_at: string; payload: any;
}

const DebugPanel = ({ workspaceId, phoneNumberId }: { workspaceId: string; phoneNumberId: string }) => {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    // Show workspace events + orphan events matching this phone_number_id (unmatched-workspace hits)
    const orFilter = phoneNumberId
      ? `workspace_id.eq.${workspaceId},and(workspace_id.is.null,phone_number_id.eq.${phoneNumberId})`
      : `workspace_id.eq.${workspaceId}`;
    const { data } = await supabase.from('wa_webhook_events' as any)
      .select('*').or(orFilter).order('created_at', { ascending: false }).limit(50);
    setEvents((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [workspaceId, phoneNumberId]);

  useEffect(() => {
    const ch = supabase
      .channel(`webhook-debug-${workspaceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_webhook_events' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId, phoneNumberId]);

  const okCount = events.filter(e => e.status === 'ok').length;
  const errCount = events.filter(e => e.status === 'error').length;

  const StatusIcon = ({ s }: { s: string | null }) =>
    s === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
    s === 'error' ? <XCircle className="w-4 h-4 text-red-500" /> :
    <MinusCircle className="w-4 h-4 text-muted-foreground" />;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-primary" />
          <div>
            <div className="font-semibold">Webhook Debug Panel</div>
            <div className="text-xs text-muted-foreground">Live feed of every inbound event Meta sends to your webhook.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">{okCount} ok</Badge>
          <Badge className="bg-red-500/15 text-red-600 border-red-500/30">{errCount} failed</Badge>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-lg">
          <InboxIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No webhook events yet. Send a "Hi" from any WhatsApp to your business number and it should appear here within a second.<br />
          If nothing appears, Meta isn't reaching this URL — check the Callback URL and Verify Token above, and make sure you subscribed to <code>messages</code> in Meta.
        </div>
      ) : (
        <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
          {events.map(e => (
            <div key={e.id} className="p-3 text-sm">
              <div className="flex items-start gap-2">
                <StatusIcon s={e.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] uppercase">{e.event_type}</Badge>
                    {e.from_phone && <span className="text-xs font-mono text-muted-foreground">{e.from_phone}</span>}
                    <span className="text-[11px] text-muted-foreground ml-auto">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1">{e.summary}</div>
                  {e.error && <div className="mt-1 text-xs text-red-600 bg-red-500/10 rounded px-2 py-1"><b>Reason:</b> {e.error}</div>}
                  <button onClick={() => setShowRaw(showRaw === e.id ? null : e.id)} className="mt-1 text-[11px] text-primary underline">
                    {showRaw === e.id ? 'Hide' : 'Show'} raw payload
                  </button>
                  {showRaw === e.id && (
                    <pre className="mt-2 p-2 bg-muted/50 rounded text-[10px] overflow-x-auto max-h-60">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const WebhookTestButton = ({ phoneNumberId, webhookUrl }: { phoneNumberId: string; webhookUrl: string }) => {
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!phoneNumberId) return toast.error('Save your Phone Number ID first (Manual tab) or connect via Facebook.');
    setSending(true);
    const testFrom = '919999900000';
    const msgId = `wamid.TEST_${Date.now()}`;
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'TEST',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: 'test', phone_number_id: phoneNumberId },
            contacts: [{ profile: { name: 'Webhook Test' }, wa_id: testFrom }],
            messages: [{ from: testFrom, id: msgId, timestamp: `${Math.floor(Date.now()/1000)}`, type: 'text', text: { body: `🧪 Webhook test at ${new Date().toLocaleTimeString()}` } }],
          },
        }],
      }],
    };
    try {
      const r = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const t = await r.text();
      if (!r.ok) toast.error(`Webhook returned ${r.status}: ${t.slice(0,120)}`);
      else toast.success('Test payload delivered. Check the debug panel and Inbox.');
    } catch (e: any) {
      toast.error(`Failed to reach webhook: ${e?.message || e}`);
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="pt-2 border-t">
      <Button variant="outline" size="sm" onClick={send} disabled={sending} className="gap-2">
        <Bug className="w-3.5 h-3.5" /> {sending ? 'Sending test…' : 'Send test webhook event'}
      </Button>
      <p className="text-[11px] text-muted-foreground mt-1">
        Simulates a Meta inbound message hitting your webhook. If this appears in the Inbox but real customer messages don't, the problem is in Meta's webhook subscription (not payments — inbound receipts are free).
      </p>
    </div>
  );
};

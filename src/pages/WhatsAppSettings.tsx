import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Settings, ShieldCheck, ShieldAlert, Copy, Bug, RefreshCw, CheckCircle2, XCircle, MinusCircle, Inbox as InboxIcon } from 'lucide-react';

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
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const mask = (s: string | null) => s && s.length > 6 ? `••••${s.slice(-4)}` : (s || '');

const WhatsAppSettings = () => {
  const { user } = useAuth();
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

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: ws } = await supabase.from('workspaces' as any)
      .select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
    const id = (ws as any)?.id || null;
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
  useEffect(() => { load(); }, [user]);

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
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Connection status</div>
            {creds?.verified
              ? <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1"><ShieldCheck className="w-3 h-3" /> Verified</Badge>
              : <Badge variant="outline" className="gap-1"><ShieldAlert className="w-3 h-3" /> Not verified</Badge>}
          </div>
          {creds?.last_error && <p className="text-sm text-red-600">{creds.last_error}</p>}
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
        </Card>
        </>)}
      </div>
    </AppLayout>
  );
};

export default WhatsAppSettings;

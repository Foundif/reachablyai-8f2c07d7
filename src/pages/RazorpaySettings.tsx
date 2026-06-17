import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CreditCard, Loader2, ExternalLink, ShieldCheck, Webhook, KeyRound, Lock, Crown } from 'lucide-react';

const WEBHOOK_URL = 'https://fpgdzyzmejhagkszrphl.supabase.co/functions/v1/razorpay-webhook';
const ALLOWED_PLANS = ['trial', 'growth', 'professional', 'enterprise', 'active', 'pro'];

const RazorpaySettings = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const status = ((profile as any)?.subscription_status || 'trial').toLowerCase();
  const planAllowed = ALLOWED_PLANS.includes(status);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('tn_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        setKeyId((data as any).razorpay_key_id || '');
        setKeySecret((data as any).razorpay_key_secret || '');
        setWebhookSecret((data as any).razorpay_webhook_secret || '');
        setEnabled(!!(data as any).razorpay_enabled);
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = {
      user_id: user.id,
      razorpay_key_id: keyId.trim() || null,
      razorpay_key_secret: keySecret.trim() || null,
      razorpay_webhook_secret: webhookSecret.trim() || null,
      razorpay_enabled: enabled,
    };
    const { error } = await supabase.from('tn_settings').upsert(payload, { onConflict: 'user_id' });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success('Razorpay settings saved');
  };

  if (loading) return <AppLayout><div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-foreground text-background flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Razorpay Payments</h1>
            <p className="text-sm text-muted-foreground">Collect UPI, cards, netbanking & wallet payments in INR.</p>
          </div>
        </div>

        {!planAllowed && (
          <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-foreground text-background flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-4 h-4 text-primary" />
                  <p className="font-semibold">Razorpay is a Growth plan feature</p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Accept UPI, cards, netbanking & wallets directly inside Chatarly. Available on Growth, Professional and Enterprise plans.
                </p>
                <Button onClick={() => navigate('/pricing')}>
                  <Crown className="w-4 h-4" /> View plans & upgrade
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className={planAllowed ? '' : 'opacity-50 pointer-events-none select-none'}>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Enable Razorpay collection</p>
              <p className="text-xs text-muted-foreground">When on, booking confirmations will offer a Razorpay link.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid gap-4">
            <div>
              <Label className="flex items-center gap-1.5 text-xs"><KeyRound className="w-3.5 h-3.5" /> Key ID</Label>
              <Input className="mt-1.5 font-mono" placeholder="rzp_live_XXXXXXXXXXXX" value={keyId} onChange={e => setKeyId(e.target.value)} />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 text-xs"><ShieldCheck className="w-3.5 h-3.5" /> Key Secret</Label>
              <Input className="mt-1.5 font-mono" type="password" placeholder="••••••••••••••••" value={keySecret} onChange={e => setKeySecret(e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">Stored encrypted, used by server only for capture & refund.</p>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 text-xs"><Webhook className="w-3.5 h-3.5" /> Webhook Secret</Label>
              <Input className="mt-1.5 font-mono" type="password" placeholder="From Razorpay dashboard → Webhooks" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} />
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Razorpay settings'}
          </Button>
        </Card>

        <Card className="p-5">
          <p className="font-semibold mb-3">How to connect (5 minutes)</p>
          <ol className="space-y-3 text-sm">
            <li>
              1. Sign up / log in to <a href="https://dashboard.razorpay.com" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">Razorpay Dashboard <ExternalLink className="w-3 h-3" /></a>.
            </li>
            <li>2. Go to <b>Account & Settings → API Keys</b> and click <b>Generate Live Key</b> (or Test Key while testing).</li>
            <li>3. Copy <b>Key ID</b> and <b>Key Secret</b> into the form above.</li>
            <li>
              4. Open <b>Account & Settings → Webhooks</b>, click <b>Add New Webhook</b>:
              <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs">
                <p className="font-mono break-all">{WEBHOOK_URL}</p>
                <p className="mt-2 text-muted-foreground">Subscribe to: <code>payment.captured</code>, <code>payment.failed</code>, <code>refund.processed</code></p>
              </div>
            </li>
            <li>5. Copy the auto-generated <b>Webhook Secret</b> back into the form above & save.</li>
            <li>6. Toggle <b>Enable Razorpay collection</b> on. Done — bookings will offer Razorpay links automatically.</li>
          </ol>
        </Card>

        <Card className="p-5 bg-muted/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pricing</p>
          <p className="text-sm">Razorpay charges <b>2% per transaction</b> (1.99% for UPI, capped). GST applies. Chatarly takes no cut on collections.</p>
        </Card>
      </div>
    </AppLayout>
  );
};

export default RazorpaySettings;

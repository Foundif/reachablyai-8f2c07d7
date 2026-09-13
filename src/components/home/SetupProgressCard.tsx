import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Rocket, X, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

declare global { interface Window { Razorpay?: any } }

const loadRazorpay = () => new Promise<boolean>((resolve) => {
  if (window.Razorpay) return resolve(true);
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = () => resolve(true);
  s.onerror = () => resolve(false);
  document.body.appendChild(s);
});

interface Props {
  wsId: string | null;
  checks: {
    whatsapp: boolean;
    contacts: boolean;
    template: boolean;
    campaign: boolean;
    automation: boolean;
  };
}

const SETUP_PACKAGE_PRICE = 5990;

const SetupProgressCard = ({ wsId, checks }: Props) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    (async () => {
      const { data } = await supabase.from('workspace_onboarding' as any)
        .select('dismissed,setup_package_paid').eq('workspace_id', wsId).maybeSingle();
      setDismissed(!!(data as any)?.dismissed);
      setPaid(!!(data as any)?.setup_package_paid);
      setReady(true);
    })();
  }, [wsId]);

  const steps = [
    { key: 'whatsapp', label: 'Connect your WhatsApp number', done: checks.whatsapp, to: '/whatsapp-settings' },
    { key: 'contacts', label: 'Add or import your contacts', done: checks.contacts, to: '/leads' },
    { key: 'template', label: 'Get one message template approved', done: checks.template, to: '/templates' },
    { key: 'campaign', label: 'Send your first broadcast', done: checks.campaign, to: '/campaigns' },
    { key: 'automation', label: 'Turn on an automation or chatbot', done: checks.automation, to: '/automation' },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  const hide = async () => {
    setDismissed(true);
    if (!wsId) return;
    await supabase.from('workspace_onboarding' as any)
      .upsert({ workspace_id: wsId, dismissed: true }, { onConflict: 'workspace_id' });
  };

  const buySetup = async () => {
    if (!user) return;
    setPaying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not open the payment window');

      const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
        body: { kind: 'onboarding' },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Order failed');
      const { order, key_id } = data as any;

      const rzp = new window.Razorpay({
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: 'Reachably',
        description: 'Done-for-you setup & onboarding',
        prefill: { email: user.email || '', name: (profile as any)?.full_name || '' },
        handler: async (resp: any) => {
          const { data: v, error: vErr } = await supabase.functions.invoke('razorpay-verify', {
            body: {
              kind: 'onboarding',
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
          });
          if (vErr || (v as any)?.error) return toast.error((v as any)?.error || 'Payment could not be confirmed');
          setPaid(true);
          toast.success('Payment received — our team will reach out within 24 hours.');
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on('payment.failed', (r: any) => toast.error(r?.error?.description || 'Payment failed'));
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || 'Payment error');
    } finally {
      setPaying(false);
    }
  };

  if (!ready || dismissed || pct === 100) return null;

  return (
    <Card className="p-4 md:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-muted"><Rocket className="w-4 h-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Finish setting up Reachably</p>
          <p className="text-xs text-muted-foreground">{doneCount} of {steps.length} done · takes about 15 minutes</p>
        </div>
        <Badge variant="secondary">{pct}%</Badge>
        <button onClick={hide} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Hide setup guide">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-1">
        {steps.map((step) => (
          <button
            key={step.key}
            onClick={() => navigate(step.to)}
            className="w-full flex items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/60 transition-colors"
          >
            {step.done
              ? <CheckCircle2 className="w-4 h-4 text-foreground flex-shrink-0" />
              : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            <span className={`text-sm flex-1 ${step.done ? 'line-through text-muted-foreground' : ''}`}>{step.label}</span>
            {!step.done && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
        ))}
      </div>

      <div className="rounded-xl border p-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Want us to set it all up for you?</p>
          <p className="text-xs text-muted-foreground">
            Guided onboarding: WhatsApp approval, templates, contact import, automations and team training.
          </p>
        </div>
        {paid ? (
          <Badge variant="secondary">Purchased</Badge>
        ) : (
          <Button size="sm" onClick={buySetup} disabled={paying}>
            {paying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Pay ₹{SETUP_PACKAGE_PRICE.toLocaleString('en-IN')}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default SetupProgressCard;

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, X, Loader2, ArrowRight, ChevronUp, ChevronDown, Minus } from 'lucide-react';
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
  const [open, setOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);

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

  const next = steps.find(s => !s.done);
  const done = steps.filter(s => s.done);
  const R = 18, C = 2 * Math.PI * R;
  const Ring = ({ size = 44 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 44 44" className="-rotate-90 shrink-0">
      <circle cx="22" cy="22" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
      <circle cx="22" cy="22" r={R} fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} className="transition-all" />
    </svg>
  );

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="fixed z-40 right-4 bottom-20 md:bottom-6 flex items-center gap-2.5 rounded-full border bg-card shadow-lg pl-1.5 pr-4 py-1.5 hover:shadow-xl transition-shadow">
      <Ring size={36} />
      <span className="font-semibold text-sm">Setup</span>
      <span className="text-xs text-muted-foreground">{steps.length - doneCount} left</span>
      <ChevronUp className="w-4 h-4 text-muted-foreground" />
    </button>
  );

  return (
    <Card className="fixed z-40 right-3 left-3 sm:left-auto bottom-20 md:bottom-6 sm:w-[380px] max-h-[75vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
      <div className="flex items-center gap-3 p-4 border-b">
        <Ring />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Workspace setup</p>
          <p className="text-xs text-muted-foreground">{doneCount}/{steps.length} · {steps.length - doneCount} remaining</p>
        </div>
        <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-muted" aria-label="Minimize"><Minus className="w-4 h-4" /></button>
        <button onClick={hide} className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Hide setup guide"><X className="w-4 h-4" /></button>
      </div>
      {next && (
        <div className="p-4 border-b space-y-3">
          <p className="text-[11px] font-semibold tracking-widest text-primary">UP NEXT</p>
          <p className="font-semibold">{next.label}</p>
          <Button className="w-full" onClick={() => navigate(next.to)}>Continue <ArrowRight className="w-4 h-4" /></Button>
        </div>
      )}
      <div className="p-3 space-y-1">
        {steps.filter(s => !s.done).map(s => (
          <button key={s.key} onClick={() => navigate(s.to)} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left bg-primary/5 hover:bg-primary/10">
            <Circle className="w-4 h-4 text-primary" /><span className="text-sm font-medium flex-1">{s.label}</span>
          </button>
        ))}
        {done.length > 0 && (
          <>
            <button onClick={() => setShowDone(v => !v)} className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground">
              {done.length} completed {showDone ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showDone && done.map(s => (
              <div key={s.key} className="flex items-center gap-3 px-3 py-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" /><span className="text-sm line-through text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="m-3 mt-0 rounded-xl border p-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Want us to set it all up?</p>
          <p className="text-xs text-muted-foreground">Done-for-you onboarding & team training.</p>
        </div>
        {paid ? <Badge variant="secondary">Purchased</Badge> : (
          <Button size="sm" variant="outline" onClick={buySetup} disabled={paying}>
            {paying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}₹{SETUP_PACKAGE_PRICE.toLocaleString('en-IN')}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default SetupProgressCard;

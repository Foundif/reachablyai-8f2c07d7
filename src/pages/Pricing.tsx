import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Check, X, Crown, Sparkles, Zap, Star, MessageSquare, ArrowLeft, Wrench, Battery, Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PlanId = 'starter' | 'growth' | 'business';

interface Plan {
  id: PlanId; name: string; tagline: string;
  monthly: number; yearly: number; credits: string;
  badge?: string; badgeIcon?: any; icon: any; popular?: boolean;
  cta: string; features: string[];
}

const PLANS: Plan[] = [
  { id: 'starter', name: 'Starter', tagline: 'Solo founders getting started with WhatsApp outreach',
    monthly: 999, yearly: 9990, credits: '~500 msgs / mo', badge: 'Basic', badgeIcon: Zap, icon: MessageSquare,
    cta: 'Start with Starter',
    features: ['1 team member', 'Unlimited templates', 'CRM Dashboard', 'Contact management', 'WhatsApp broadcast', 'Official Meta Cloud API', 'Website integration', 'Basic campaign analytics', 'Basic automation workflows'] },
  { id: 'growth', name: 'Growth', tagline: 'Most popular — everything you need to scale outreach',
    monthly: 1999, yearly: 19990, credits: '~1,200 msgs / mo', badge: 'Most popular', badgeIcon: Crown, icon: Star, popular: true,
    cta: 'Choose Growth',
    features: ['Up to 3 team members', 'Everything in Starter, plus:', 'API access', 'Advanced campaign analytics', 'Advanced automation workflows', 'Priority support'] },
  { id: 'business', name: 'Business', tagline: 'Agencies & high-volume teams with dedicated support',
    monthly: 3999, yearly: 39990, credits: '~2,800 msgs / mo', badge: 'Advanced', badgeIcon: Sparkles, icon: Crown,
    cta: 'Choose Business',
    features: ['Unlimited team members', 'Everything in Growth, plus:', 'Unlimited automation workflows', 'Dedicated account manager', 'Priority support · SLA'] },
];

// Message recharge packs — priced above Meta's ~₹0.86/msg marketing rate
interface Pack { id: string; msgs: number; price: number; badge?: string; perMsg: string }
const PACKS: Pack[] = [
  { id: 'starter_500', msgs: 500,   price: 599,  perMsg: '₹1.20/msg' },
  { id: 'pack_1k',    msgs: 1000,   price: 1099, perMsg: '₹1.10/msg' },
  { id: 'pack_3k',    msgs: 3000,   price: 2999, badge: 'Popular', perMsg: '₹1.00/msg' },
  { id: 'pack_6k',    msgs: 6000,   price: 5999, perMsg: '₹1.00/msg' },
  { id: 'pack_10k',   msgs: 10000,  price: 8999, badge: 'Best value', perMsg: '₹0.90/msg' },
];

const SETUP_FEE = 2999;

const COMPARE: { label: string; values: [string | boolean, string | boolean, string | boolean] }[] = [
  { label: 'Monthly Price', values: ['₹999', '₹1,999', '₹3,999'] },
  { label: 'Annual Price (2 months free)', values: ['₹9,990', '₹19,990', '₹39,990'] },
  { label: 'Included Message Credits*', values: ['~500', '~1,200', '~2,800'] },
  { label: 'CRM Dashboard', values: [true, true, true] },
  { label: 'Contact Management', values: [true, true, true] },
  { label: 'WhatsApp Broadcast', values: [true, true, true] },
  { label: 'Official Meta Cloud API', values: [true, true, true] },
  { label: 'Campaign Analytics', values: ['Basic', 'Advanced', 'Advanced'] },
  { label: 'Team Members', values: ['1', '3', 'Unlimited'] },
  { label: 'Templates', values: ['Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Website Integration', values: [true, true, true] },
  { label: 'API Access', values: [false, true, true] },
  { label: 'Automation Workflows', values: ['Basic', 'Advanced', 'Unlimited'] },
  { label: 'Priority Support', values: [false, true, true] },
  { label: 'Dedicated Account Manager', values: [false, false, true] },
];

const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const Cell = ({ v }: { v: string | boolean }) => {
  if (v === true) return <Check className="w-4 h-4 text-emerald-600 mx-auto" />;
  if (v === false) return <X className="w-4 h-4 text-muted-foreground/60 mx-auto" />;
  return <span className="text-sm">{v}</span>;
};

declare global { interface Window { Razorpay?: any } }
const loadRazorpay = () => new Promise<boolean>((resolve) => {
  if (window.Razorpay) return resolve(true);
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = () => resolve(true); s.onerror = () => resolve(false);
  document.body.appendChild(s);
});

const PricingContent = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [busy, setBusy] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: ws } = await supabase.from('workspaces' as any).select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
      const wsId = (ws as any)?.id;
      if (!wsId) return;
      const { data: cr } = await supabase.from('message_credits' as any).select('balance').eq('workspace_id', wsId).maybeSingle();
      setBalance((cr as any)?.balance ?? 0);
    })();
  }, [user]);

  const priceFor = (p: Plan) => billing === 'yearly' ? p.yearly : p.monthly;
  const savingsFor = (p: Plan) => p.monthly * 12 - p.yearly;
  const currentStatus = (profile as any)?.subscription_status;
  const activePlan = ['starter', 'growth', 'business'].includes(currentStatus) ? currentStatus : null;

  const checkout = async (opts: {
    key: string; amount: number; name: string; description: string;
    body: any; onSuccess?: (v: any) => void;
  }) => {
    if (!user) { navigate('/auth'); return; }
    setBusy(opts.key);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Failed to load Razorpay');
      const { data, error } = await supabase.functions.invoke('razorpay-create-order', { body: opts.body });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Order failed');
      const { order, key_id } = data;
      const rzp = new window.Razorpay({
        key: key_id, amount: order.amount, currency: order.currency, order_id: order.id,
        name: 'Reachably', description: opts.description,
        prefill: { email: user.email || '', name: (profile as any)?.full_name || '' },
        theme: { color: '#000000' },
        handler: async (resp: any) => {
          const { data: v, error: vErr } = await supabase.functions.invoke('razorpay-verify', {
            body: {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              ...opts.body,
            },
          });
          if (vErr || (v as any)?.error) return toast.error((v as any)?.error || vErr?.message || 'Verify failed');
          toast.success('Payment successful!');
          opts.onSuccess?.(v);
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      rzp.on('payment.failed', (r: any) => { toast.error(r?.error?.description || 'Payment failed'); setBusy(null); });
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || 'Payment error');
    } finally {
      setTimeout(() => setBusy(null), 800);
    }
  };

  const buyPlan = (plan: Plan) => checkout({
    key: `plan_${plan.id}`, amount: priceFor(plan), name: plan.name,
    description: `${plan.name} — ${billing}`,
    body: { kind: 'subscription', amount: priceFor(plan), plan_id: plan.id, billing_period: billing },
    onSuccess: () => setTimeout(() => window.location.reload(), 1200),
  });

  const buyPack = (pack: Pack) => checkout({
    key: `pack_${pack.id}`, amount: pack.price, name: `${pack.msgs} messages`,
    description: `Message recharge — ${pack.msgs.toLocaleString('en-IN')} msgs`,
    body: { kind: 'recharge', amount: pack.price, pack_id: pack.id },
    onSuccess: (v: any) => setBalance(b => (b || 0) + (v?.credited || pack.msgs)),
  });

  const paySetup = () => checkout({
    key: 'setup', amount: SETUP_FEE, name: 'Setup', description: 'One-time WhatsApp API & CRM setup',
    body: { kind: 'setup', amount: SETUP_FEE },
  });

  return (
    <div className="relative overflow-hidden">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border mb-5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium">Simple pricing · Safe WhatsApp automation</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              One plan to run all your <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">WhatsApp growth</span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Bulk campaigns, approved Meta templates, safe pacing, team inbox — plus top-up packs when you need more messages.
            </p>
            {balance !== null && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs">
                <Battery className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-medium">{balance.toLocaleString('en-IN')} messages available</span>
              </div>
            )}

            <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full bg-muted border border-border">
              <button onClick={() => setBilling('monthly')} className={cn('px-4 py-1.5 rounded-full text-xs font-semibold transition-all', billing === 'monthly' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>Monthly</button>
              <button onClick={() => setBilling('yearly')} className={cn('px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5', billing === 'yearly' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>Yearly <Badge variant="secondary" className="text-[10px] py-0 px-1.5">2 months free</Badge></button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <Card className="mb-8 p-5 border-primary/30 bg-gradient-to-r from-primary/10 to-secondary/10">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/20"><Wrench className="w-5 h-5 text-primary" /></div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">One-time WhatsApp API &amp; CRM setup</h3>
                  <Badge variant="secondary" className="text-[10px]">Paid separately</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                  Meta Cloud API config · WhatsApp Business onboarding · Webhook setup · CRM setup · Team onboarding · Contact import · Basic training.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 md:shrink-0">
              <div className="text-right">
                <div className="text-2xl font-bold">{formatINR(SETUP_FEE)}</div>
                <div className="text-[11px] text-muted-foreground">one-time</div>
              </div>
              <Button onClick={paySetup} disabled={busy === 'setup'}>
                {busy === 'setup' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pay setup fee'}
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const BadgeIcon = plan.badgeIcon;
            const isActive = activePlan === plan.id;
            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}>
                <Card className={cn('relative p-6 h-full flex flex-col border-2 transition-all',
                  plan.popular ? 'border-primary shadow-2xl shadow-primary/20 md:scale-[1.03]' : 'border-border hover:border-primary/30',
                  isActive && 'ring-2 ring-emerald-500')}>
                  {plan.badge && (
                    <div className={cn('absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1',
                      plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground border')}>
                      {BadgeIcon && <BadgeIcon className="w-3 h-3" />} {plan.badge}
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white flex items-center gap-1">
                      <Check className="w-3 h-3" /> ACTIVE
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10"><Icon className="w-5 h-5 text-primary" /></div>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{plan.tagline}</p>
                  <div className="mb-2">
                    <span className="text-4xl font-bold">{formatINR(priceFor(plan))}</span>
                    <span className="text-muted-foreground text-sm">/{billing === 'yearly' ? 'year' : 'month'}</span>
                  </div>
                  {billing === 'yearly' && <p className="text-xs text-emerald-600 mb-3">You save {formatINR(savingsFor(plan))} /year</p>}
                  <div className="text-xs text-muted-foreground mb-5 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> {plan.credits}</div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f, idx) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button onClick={() => buyPlan(plan)} disabled={busy === `plan_${plan.id}` || isActive} className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                    {busy === `plan_${plan.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : isActive ? 'Current plan' : plan.cta}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center mt-2">+ one-time {formatINR(SETUP_FEE)} setup</p>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Message recharge packs */}
        <div className="mt-14">
          <div className="text-center mb-2">
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2"><Battery className="w-6 h-6" /> Message recharge packs</h2>
            <p className="text-sm text-muted-foreground mt-1">Need more messages this month? Buy top-up packs — never expires while your plan is active.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
            {PACKS.map(p => (
              <Card key={p.id} className={cn('p-4 border-2 relative flex flex-col', p.badge === 'Best value' && 'border-primary')}>
                {p.badge && <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">{p.badge}</div>}
                <div className="text-xs text-muted-foreground">Top-up</div>
                <div className="text-2xl font-bold">{p.msgs.toLocaleString('en-IN')}</div>
                <div className="text-xs text-muted-foreground mb-3">messages · {p.perMsg}</div>
                <div className="text-xl font-bold mb-3">{formatINR(p.price)}</div>
                <Button size="sm" onClick={() => buyPack(p)} disabled={busy === `pack_${p.id}`} className="mt-auto">
                  {busy === `pack_${p.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buy now'}
                </Button>
              </Card>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            Meta charges ≈ ₹0.86 per marketing message. Prices above include Reachably platform costs, safe-pacing infrastructure, and delivery retries.
          </p>
        </div>

        <div className="mt-14">
          <h2 className="text-2xl font-bold text-center mb-2">Compare features</h2>
          <p className="text-center text-sm text-muted-foreground mb-6">Everything you get across all Reachably plans.</p>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold">Features</th>
                  {PLANS.map(p => (
                    <th key={p.id} className="px-4 py-3 font-semibold text-center min-w-[110px]">
                      {p.name}{p.popular && <Badge className="ml-2 text-[10px]" variant="default">Popular</Badge>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={i} className={cn('border-b last:border-0', i % 2 && 'bg-muted/20')}>
                    <td className="px-4 py-3 text-muted-foreground">{row.label}</td>
                    {row.values.map((v, j) => (<td key={j} className="px-4 py-3 text-center"><Cell v={v} /></td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            *Plan credits reset monthly. Additional messages can be topped up anytime with recharge packs above.
          </p>
        </div>
      </div>
    </div>
  );
};

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(user ? '/' : '/auth')} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
        <PricingContent />
      </div>
    </AppLayout>
  );
};

export default Pricing;

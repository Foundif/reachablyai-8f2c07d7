import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import {
  Check, X, Crown, Sparkles, Zap, Star, MessageSquare, ArrowLeft, Wrench, Battery, Loader2,
  ShoppingBag, Building2, Users, Phone, Headset, Building,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { resolveWorkspaceId } from '@/lib/workspace';

type PlanId = 'starter' | 'growth' | 'business';
type Audience = 'shopify' | 'business';

interface Plan {
  id: PlanId; name: string; tagline: string;
  monthly: number; yearly: number; credits: string;
  badge?: string; badgeIcon?: any; icon: any; popular?: boolean;
  cta: string; features: string[]; extra?: Record<Audience, string[]>;
}

const PLANS: Plan[] = [
  {
    id: 'starter', name: 'Basic', tagline: 'Essential tools to get started with WhatsApp',
    monthly: 999, yearly: 9990, credits: '~500 msgs / mo', badge: 'Basic', badgeIcon: Zap, icon: MessageSquare,
    cta: 'Start free trial',
    features: ['1 user', '1 WhatsApp account', 'Unlimited contacts', '3 automation flows', 'Bulk broadcast campaigns', 'Rich media messaging', 'Official Meta Cloud API', 'No markup on templates', 'WhatsApp chat support'],
    extra: {
      shopify: ['Store order sync', 'Abandoned cart reminders'],
      business: ['CRM contact tags', 'Website chat widget'],
    },
  },
  {
    id: 'growth', name: 'Growth', tagline: 'Everything you need to scale outreach',
    monthly: 1999, yearly: 19990, credits: '~1,200 msgs / mo', badge: 'Most popular', badgeIcon: Crown, icon: Star, popular: true,
    cta: 'Start free trial',
    features: ['3 users', 'Everything in Basic, plus:', 'AI chatbots & AI agents', '25 automation flows', 'Shared team inbox', 'Advanced campaign analytics', 'API access', 'Priority support'],
    extra: {
      shopify: ['Order status & COD confirm flows', 'Cart recovery automation', 'Product catalog messaging'],
      business: ['Lead scraper (1,000 / mo)', 'Accounting & sales ledger'],
    },
  },
  {
    id: 'business', name: 'Pro', tagline: 'Advanced features for growing businesses',
    monthly: 3999, yearly: 39990, credits: '~2,800 msgs / mo', badge: 'Advanced', badgeIcon: Sparkles, icon: Crown,
    cta: 'Start free trial',
    features: ['Unlimited users', 'Everything in Growth, plus:', 'Unlimited automation flows', 'Unlimited webhooks', 'Dedicated account manager', 'Priority support · SLA'],
    extra: {
      shopify: ['Multi-store sync', 'Post-purchase upsell journeys'],
      business: ['Lead scraper (5,000 / mo)', 'Custom integrations'],
    },
  },
];

const ENTERPRISE_FEATURES = [
  'Custom users & WhatsApp numbers', 'Unlimited contacts & tags', 'Custom automation flows',
  'Custom feature integration', 'Enterprise grade security', 'SLA-backed support',
];

interface AddOn { id: string; name: string; desc: string; price: string; unit: string; icon: any }
const ADDONS: AddOn[] = [
  { id: 'user', name: 'Extra user', desc: 'Scale your team as you grow', price: '₹499', unit: 'per user / month', icon: Users },
  { id: 'rm', name: 'Dedicated relationship manager', desc: 'A dedicated expert for your account', price: '₹9,999', unit: 'per month', icon: Headset },
  { id: 'wa', name: 'Additional WhatsApp number', desc: 'Add one more WhatsApp Business number', price: '₹2,499', unit: 'per month', icon: Phone },
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

type CmpVal = string | boolean;
const COMPARE: { label: string; values: [CmpVal, CmpVal, CmpVal, CmpVal] }[] = [
  { label: 'Monthly price', values: ['₹999', '₹1,999', '₹3,999', 'Custom'] },
  { label: 'Annual price (2 months free)', values: ['₹9,990', '₹19,990', '₹39,990', 'Custom'] },
  { label: 'Included message credits*', values: ['~500', '~1,200', '~2,800', 'Custom'] },
  { label: 'Team members', values: ['1', '3', 'Unlimited', 'Custom'] },
  { label: 'WhatsApp accounts', values: ['1', '1', '2', 'Custom'] },
  { label: 'Contacts', values: ['Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Automation flows', values: ['3', '25', 'Unlimited', 'Custom'] },
  { label: 'Template cost – Marketing', values: ['₹0.86', '₹0.86', '₹0.86', '₹0.86'] },
  { label: 'Template cost – Utility', values: ['₹0.12', '₹0.12', '₹0.12', '₹0.12'] },
  { label: '0% markup on templates', values: [true, true, true, true] },
  { label: 'Broadcast messaging', values: [true, true, true, true] },
  { label: 'Shared team inbox', values: [true, true, true, true] },
  { label: 'Built-in CRM', values: [true, true, true, true] },
  { label: 'Contact tags', values: ['5', '20', 'Unlimited', 'Unlimited'] },
  { label: 'Rich media & carousels', values: [true, true, true, true] },
  { label: 'AI chatbots', values: [false, true, true, true] },
  { label: 'Webhooks', values: [false, false, true, true] },
  { label: 'API access', values: [false, true, true, true] },
  { label: 'Priority support', values: [false, true, true, true] },
  { label: 'Dedicated relationship manager', values: [false, false, true, true] },
];

const FAQS = [
  { q: 'Do I need my own Meta WhatsApp Business account?', a: 'Yes. Reachably connects to the official Meta Cloud API using your own WhatsApp Business number, so you fully own your number, templates and quality rating.' },
  { q: 'What are message credits?', a: 'Each plan includes a monthly pool of message credits. Meta charges per conversation (approx ₹0.86 for marketing, ₹0.12 for utility). If you need more, buy a top-up pack anytime — credits never expire while your plan is active.' },
  { q: 'Is there a free trial?', a: 'Every account gets a 7-day free trial with all features unlocked. No credit or debit card required to start.' },
  { q: 'Why is there a one-time setup fee?', a: 'The ₹2,999 setup covers Meta Cloud API configuration, WhatsApp Business onboarding, webhook setup, CRM setup, contact import and team training. It is billed once, separately from your plan.' },
  { q: 'Can I change plans later?', a: 'Yes — upgrade or downgrade at any time. Upgrades apply immediately and your remaining message credits carry over.' },
  { q: 'Do you mark up WhatsApp template costs?', a: 'No. You pay Meta’s conversation rates at 0% markup. Reachably only charges the platform subscription and optional add-ons.' },
];

const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const Cell = ({ v }: { v: CmpVal }) => {
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
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  const [audience, setAudience] = useState<Audience>('business');
  const [busy, setBusy] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get('audience');
    if (a === 'shopify' || a === 'business') setAudience(a);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const wsId = await resolveWorkspaceId(user.id, profile);
      if (!wsId) return;
      const { data: cr } = await supabase.from('message_credits' as any).select('balance').eq('workspace_id', wsId).maybeSingle();
      setBalance((cr as any)?.balance ?? 0);
    })();
  }, [user, profile]);

  const priceFor = (p: Plan) => billing === 'yearly' ? p.yearly : p.monthly;
  const perMonth = (p: Plan) => billing === 'yearly' ? Math.round(p.yearly / 12) : p.monthly;
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
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-8 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {/* Audience switch */}
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted border border-border mb-6">
              {([
                { id: 'shopify' as Audience, label: 'For Shopify', icon: ShoppingBag },
                { id: 'business' as Audience, label: 'For Businesses', icon: Building2 },
              ]).map(a => (
                <button key={a.id} onClick={() => setAudience(a.id)}
                  className={cn('px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5',
                    audience === a.id ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                  <a.icon className="w-3.5 h-3.5" /> {a.label}
                </button>
              ))}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Pricing that <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">scales</span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              {audience === 'shopify'
                ? 'Recover abandoned carts, confirm COD orders and drive repeat purchases on WhatsApp — synced with your store.'
                : 'Automate your sales funnel and double your business growth with WhatsApp automation.'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">7-day free trial. No credit or debit card required.</p>

            {balance !== null && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs">
                <Battery className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-medium">{balance.toLocaleString('en-IN')} messages available</span>
              </div>
            )}

            <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full bg-muted border border-border">
              <button onClick={() => setBilling('monthly')} className={cn('px-4 py-1.5 rounded-full text-xs font-semibold transition-all', billing === 'monthly' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>Monthly</button>
              <button onClick={() => setBilling('yearly')} className={cn('px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5', billing === 'yearly' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>Yearly <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Save 2 months</Badge></button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        {/* Plans */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 items-stretch">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const BadgeIcon = plan.badgeIcon;
            const isActive = activePlan === plan.id;
            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.06 }}>
                <Card className={cn('relative p-6 h-full flex flex-col border-2 transition-all',
                  plan.popular ? 'border-primary shadow-2xl shadow-primary/20' : 'border-border hover:border-primary/30',
                  isActive && 'ring-2 ring-emerald-500')}>
                  {plan.badge && (
                    <div className={cn('absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 whitespace-nowrap',
                      plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground border')}>
                      {BadgeIcon && <BadgeIcon className="w-3 h-3" />} {plan.badge}
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white flex items-center gap-1">
                      <Check className="w-3 h-3" /> ACTIVE
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3 mt-1">
                    <div className="p-2 rounded-lg bg-primary/10"><Icon className="w-5 h-5 text-primary" /></div>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">{plan.tagline}</p>
                  <div className="mb-1">
                    <span className="text-4xl font-bold">{formatINR(perMonth(plan))}</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {billing === 'yearly'
                      ? `${formatINR(priceFor(plan))} billed yearly · save ${formatINR(savingsFor(plan))}`
                      : 'billed monthly'}
                  </p>
                  <div className="text-xs text-muted-foreground mb-5 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> {plan.credits}</div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {[...plan.features, ...(plan.extra?.[audience] || [])].map((f, idx) => (
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

          {/* Enterprise */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.24 }}>
            <Card className="relative p-6 h-full flex flex-col border-2 border-border bg-muted/30">
              <div className="flex items-center gap-2 mb-3 mt-1">
                <div className="p-2 rounded-lg bg-primary/10"><Building className="w-5 h-5 text-primary" /></div>
                <h3 className="text-xl font-bold">Enterprise</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">For organisations operating at scale</p>
              <div className="mb-1"><span className="text-4xl font-bold">Custom</span></div>
              <p className="text-xs text-muted-foreground mb-3">Talk to us for volume pricing</p>
              <div className="text-xs text-muted-foreground mb-5 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Custom message credits</div>
              <ul className="space-y-2 mb-6 flex-1">
                {ENTERPRISE_FEATURES.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>{f}</span></li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <a href="mailto:foundifinnovations@gmail.com?subject=Reachably%20Enterprise%20enquiry">Book a demo</a>
              </Button>
            </Card>
          </motion.div>
        </div>

        {/* Setup fee */}
        <Card className="mt-8 p-5 border-primary/30 bg-gradient-to-r from-primary/10 to-secondary/10">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/20"><Wrench className="w-5 h-5 text-primary" /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
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

        {/* Add-ons */}
        <div className="mt-14">
          <div className="text-center mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Flexible pricing</div>
            <h2 className="text-2xl font-bold mt-1">Add-ons</h2>
            <p className="text-sm text-muted-foreground mt-1">Extend your plan with exactly what you need, nothing more.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADDONS.map(a => (
              <Card key={a.id} className="p-5 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0"><a.icon className="w-5 h-5 text-primary" /></div>
                <div className="min-w-0">
                  <div className="font-semibold">{a.name}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                  <div className="mt-3 text-xl font-bold">{a.price}</div>
                  <div className="text-[11px] text-muted-foreground">{a.unit}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Prepaid wallet + credit buffer */}
        <div className="mt-14 max-w-3xl mx-auto">
          <CreditWallet />
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
                {p.badge && <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold whitespace-nowrap">{p.badge}</div>}
                <div className="text-xs text-muted-foreground mt-1">Top-up</div>
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

        {/* Compare */}
        <div className="mt-14">
          <h2 className="text-2xl font-bold text-center mb-2">Compare features</h2>
          <p className="text-center text-sm text-muted-foreground mb-6">Everything you get across all Reachably plans.</p>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold min-w-[200px]">Features</th>
                  {PLANS.map(p => (
                    <th key={p.id} className="px-4 py-3 font-semibold text-center min-w-[110px]">
                      {p.name}{p.popular && <Badge className="ml-2 text-[10px]" variant="default">Popular</Badge>}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-center min-w-[110px]">Enterprise</th>
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

        {/* FAQ */}
        <div className="mt-14 max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">FAQ</div>
            <h2 className="text-2xl font-bold mt-1">FAQs about pricing</h2>
          </div>
          <Card className="px-4 sm:px-6">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
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

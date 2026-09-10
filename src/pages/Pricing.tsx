import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import PlanUsageCard from '@/components/pricing/PlanUsageCard';
import { useTrial } from '@/hooks/useTrial';
import { PLANS, Plan, formatINR } from '@/lib/plans';
import {
  Check, Crown, ArrowLeft, Loader2, Sparkles, Phone, Users, Contact, Building,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ADDONS = [
  { id: 'wa', name: 'Additional WhatsApp number', desc: 'Connect one more WhatsApp Business number to your CRM', icon: Phone },
  { id: 'contacts', name: 'Extra contacts', desc: 'Increase your contact limit beyond your plan', icon: Contact },
  { id: 'clients', name: 'Extra clients', desc: 'Increase your client limit beyond your plan', icon: Users },
];

const FAQS = [
  { q: 'Can I connect more than one WhatsApp number?', a: 'Yes. Plus includes 1 WhatsApp Business number, Scale includes 3 and Supreme includes 10 — all managed from the same Reachably CRM. WhatsApp numbers are a separate limit from users, and extra numbers are available as an add-on.' },
  { q: 'How does the 50% first-month offer work?', a: 'Subscribe to a monthly plan before your trial ends and your first month is half price. From the second month onwards you pay the normal monthly price.' },
  { q: 'Are WhatsApp/Meta charges included?', a: 'No. WhatsApp/Meta conversation charges are separate and billed directly with Meta. Reachably only charges the platform subscription and optional add-ons.' },
  { q: 'Is there a free trial?', a: 'Every account gets a 7-day free trial with all features unlocked. No credit or debit card required to start.' },
  { q: 'Can I change plans later?', a: 'Yes — upgrade or downgrade at any time. Your data, WhatsApp connections, contacts and campaigns stay exactly as they are.' },
];

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
  const { isTrialing, daysLeft } = useTrial();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [busy, setBusy] = useState<string | null>(null);

  const currentStatus = (profile as any)?.subscription_status;
  const activePlan = PLANS.find(p => p.id === currentStatus)?.id || null;

  const priceFor = (p: Plan) => billing === 'yearly' ? p.yearly : p.monthly;
  const payableFor = (p: Plan) => billing === 'yearly' ? p.yearly : p.promoMonthly;

  const checkout = async (plan: Plan) => {
    if (!user) { navigate('/auth'); return; }
    const key = `plan_${plan.id}`;
    setBusy(key);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load the payment window');
      const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
        body: { kind: 'subscription', amount: payableFor(plan), plan_id: plan.id, billing_period: billing },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Order failed');
      const { order, key_id } = data as any;
      const rzp = new window.Razorpay({
        key: key_id, amount: order.amount, currency: order.currency, order_id: order.id,
        name: 'Reachably', description: `${plan.name} — ${billing}`,
        prefill: { email: user.email || '', name: (profile as any)?.full_name || '' },
        handler: async (resp: any) => {
          const { data: v, error: vErr } = await supabase.functions.invoke('razorpay-verify', {
            body: {
              kind: 'subscription', plan_id: plan.id, billing_period: billing,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
          });
          if (vErr || (v as any)?.error) return toast.error((v as any)?.error || vErr?.message || 'Verification failed');
          toast.success(`You're on ${plan.name}!`);
          setTimeout(() => window.location.reload(), 1200);
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

  return (
    <div className="relative overflow-hidden">
      {user && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Plans &amp; Subscription</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your plan, usage, WhatsApp numbers and add-ons.</p>
          </div>
          <PlanUsageCard />
        </div>
      )}

      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-6 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {!activePlan && (
              <div className="inline-flex flex-col items-center gap-1 px-5 py-3 rounded-2xl border border-primary/30 bg-primary/5 mb-6">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                  <Sparkles className="w-3.5 h-3.5" /> Limited time Offer!
                </span>
                <span className="text-sm font-medium">Subscribe before your trial ends and enjoy 50% off your first month.</span>
                {isTrialing && <span className="text-xs text-muted-foreground">Your trial ends in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</span>}
                <button onClick={() => document.getElementById('plan-grid')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-xs font-semibold underline underline-offset-2">Upgrade Now!</button>
              </div>
            )}

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Pricing that <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">scales</span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              One subscription. Multiple WhatsApp Business numbers, your whole team and every conversation in one place.
            </p>

            <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full bg-muted border border-border">
              <button onClick={() => setBilling('monthly')}
                className={cn('px-5 py-1.5 rounded-full text-xs font-semibold transition-all', billing === 'monthly' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>Monthly</button>
              <button onClick={() => setBilling('yearly')}
                className={cn('px-5 py-1.5 rounded-full text-xs font-semibold transition-all', billing === 'yearly' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>Yearly</button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div id="plan-grid" className="grid gap-5 lg:grid-cols-3 scroll-mt-20">
          {PLANS.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card className={cn('relative p-6 h-full flex flex-col', p.popular && 'border-primary shadow-lg')}>
                {p.popular && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider">Most popular</Badge>
                )}
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  {activePlan === p.id && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 min-h-[32px]">{p.tagline}</p>

                <div className="mt-4">
                  {billing === 'monthly' ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg text-muted-foreground line-through">{formatINR(p.monthly)}</span>
                        <span className="text-3xl font-bold">{formatINR(p.promoMonthly)}</span>
                        <span className="text-xs text-muted-foreground">/month</span>
                      </div>
                      <div className="text-[11px] font-semibold text-primary mt-1">50% off your first month!</div>
                      <div className="text-[11px] text-muted-foreground">Then {formatINR(p.monthly)}/month</div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">{formatINR(p.yearly)}</span>
                        <span className="text-xs text-muted-foreground">/year</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">Billed once a year</div>
                    </>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-border p-2">
                    <div className="text-base font-bold">{p.numbers}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">WhatsApp {p.numbers === 1 ? 'number' : 'numbers'} included</div>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <div className="text-base font-bold">{p.usersLabel.replace('Up to ', '').replace(' users', '')}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">Users</div>
                  </div>
                </div>

                <ul className="mt-5 space-y-2 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button className="w-full mt-6" variant={p.popular ? 'default' : 'outline'}
                  disabled={busy === `plan_${p.id}` || activePlan === p.id}
                  onClick={() => checkout(p)}>
                  {busy === `plan_${p.id}`
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : activePlan === p.id ? 'Current plan'
                    : billing === 'monthly' ? `Get ${p.name} at ${formatINR(p.promoMonthly)}` : `Get ${p.name}`}
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          WhatsApp/Meta conversation charges are separate and billed directly with Meta.
        </p>

        {/* Add-ons */}
        <div className="mt-14">
          <h2 className="text-xl font-bold flex items-center gap-2"><Crown className="w-5 h-5" /> Add-ons</h2>
          <p className="text-sm text-muted-foreground mt-1">Need more than your plan includes? Add-ons are available on every plan.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {ADDONS.map(a => (
              <Card key={a.id} className="p-5">
                <a.icon className="w-5 h-5 text-primary" />
                <div className="mt-3 font-semibold text-sm">{a.name}</div>
                <p className="text-xs text-muted-foreground mt-1">{a.desc}</p>
                <Button variant="outline" size="sm" className="mt-4 w-full"
                  onClick={() => window.location.href = 'mailto:foundifinnovations@gmail.com?subject=Reachably%20add-on%20request'}>
                  Request add-on
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Enterprise */}
        <Card className="mt-8 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-semibold flex items-center gap-2"><Building className="w-4 h-4" /> Enterprise</div>
            <p className="text-xs text-muted-foreground mt-1">More than 25 users or 10 WhatsApp numbers? We'll build a plan around you.</p>
          </div>
          <Button variant="outline" onClick={() => window.location.href = 'mailto:foundifinnovations@gmail.com?subject=Reachably%20Enterprise'}>Talk to sales</Button>
        </Card>

        {/* FAQ */}
        <div className="mt-14 max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-5">Frequently asked questions</h2>
          <Accordion type="single" collapsible>
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
};

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user) return <AppLayout><PricingContent /></AppLayout>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>
      <PricingContent />
    </div>
  );
};

export default Pricing;

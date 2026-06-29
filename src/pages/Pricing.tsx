import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Check, Crown, Sparkles, ArrowRight, Shield, Users, MessageCircle,
  Headphones, Building2, Zap, Star, ArrowLeft, Phone, Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

declare global { interface Window { Razorpay?: any } }
const loadRazorpay = () => new Promise<boolean>((resolve) => {
  if (window.Razorpay) return resolve(true);
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = () => resolve(true);
  s.onerror = () => resolve(false);
  document.body.appendChild(s);
});

type PlanId = 'starter' | 'growth' | 'pro';

interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  setupFee: number;
  monthly: number;
  yearly: number;
  firstMonthTotal: number;
  badge?: string;
  badgeIcon?: any;
  icon: any;
  popular?: boolean;
  features: { label: string; included: boolean }[];
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Solo operators, single WhatsApp number, basic booking flow + sheet sync',
    setupFee: 4500,
    monthly: 2999,
    yearly: 29999,
    firstMonthTotal: 7499,
    badge: 'Your launch price',
    badgeIcon: Star,
    icon: Zap,
    features: [
      { label: 'WhatsApp Flow (5 screens)', included: true },
      { label: 'Google Sheets sync (21 columns)', included: true },
      { label: 'IST timestamp + Booking ID', included: true },
      { label: 'Audit log — no data loss', included: true },
      { label: '1 Meta Flow deployment', included: true },
      { label: '1 flow edit / month', included: true },
      { label: 'Email support (48 hrs)', included: true },
      { label: 'WhatsApp summary to customer', included: false },
      { label: 'Admin booking alerts', included: false },
      { label: 'Admin dashboard', included: false },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Growing services, daily bookings, WhatsApp automation for customer + admin',
    setupFee: 7500,
    monthly: 4999,
    yearly: 49999,
    firstMonthTotal: 12499,
    badge: 'Most popular',
    badgeIcon: Crown,
    icon: Star,
    popular: true,
    features: [
      { label: 'Everything in Starter', included: true },
      { label: 'WhatsApp summary to customer', included: true },
      { label: 'Admin alert on every booking', included: true },
      { label: 'Payment status tracking', included: true },
      { label: '3 flow edits / month', included: true },
      { label: 'WhatsApp priority support (12 hrs)', included: true },
      { label: 'Admin dashboard', included: false },
      { label: 'Helper assignment alerts', included: false },
      { label: 'Multi-number support', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'High-volume, multiple helpers, full admin control + booking status automation',
    setupFee: 15000,
    monthly: 9999,
    yearly: 99999,
    firstMonthTotal: 24999,
    badge: 'Full operations',
    badgeIcon: Crown,
    icon: Crown,
    features: [
      { label: 'Everything in Growth', included: true },
      { label: 'Admin web dashboard', included: true },
      { label: 'Helper assignment from dashboard', included: true },
      { label: 'Booking status updates to customer', included: true },
      { label: 'Multi-number / multi-location', included: true },
      { label: 'Unlimited flow edits', included: true },
      { label: 'Monthly analytics report', included: true },
      { label: 'Dedicated account manager (4 hrs)', included: true },
    ],
  },
];

const COMPARE_SECTIONS: { title: string; rows: { label: string; values: (string | boolean)[] }[] }[] = [
  {
    title: 'Pricing breakdown',
    rows: [
      { label: 'One-time setup fee', values: ['₹4,500', '₹7,500', '₹15,000'] },
      { label: 'Monthly retainer', values: ['₹2,999', '₹4,999', '₹9,999'] },
      { label: 'Annual retainer (save ~2 months)', values: ['₹29,999', '₹49,999', '₹99,999'] },
      { label: 'First month all-in', values: ['₹7,499', '₹12,499', '₹24,999'] },
    ],
  },
  {
    title: 'WhatsApp Flow',
    rows: [
      { label: '5-screen booking flow', values: [true, true, true] },
      { label: 'Service category dropdown', values: [true, true, true] },
      { label: 'Add-ons (wheelchair, porter)', values: [true, true, true] },
      { label: 'Flow edits per month', values: ['1', '3', 'Unlimited'] },
      { label: 'Meta Flow deployment', values: ['1 number', '1 number', 'Multi-number'] },
    ],
  },
  {
    title: 'Google Sheets data',
    rows: [
      { label: 'Auto sync on booking submit', values: [true, true, true] },
      { label: '21-column data capture', values: [true, true, true] },
      { label: 'IST timestamp + auto Booking ID', values: [true, true, true] },
      { label: 'Audit log — zero data loss', values: [true, true, true] },
      { label: 'Payment status column', values: ['Manual', 'Manual', 'Auto-update'] },
    ],
  },
  {
    title: 'WhatsApp automation',
    rows: [
      { label: 'Booking summary to customer', values: [false, true, true] },
      { label: 'Admin alert on new booking', values: [false, true, true] },
      { label: 'Helper assigned notification', values: [false, false, true] },
      { label: 'Booking status updates to customer', values: [false, false, true] },
    ],
  },
  {
    title: 'Support',
    rows: [
      { label: 'Support channel', values: ['Email', 'WhatsApp', 'Dedicated manager'] },
      { label: 'Response time', values: ['48 hrs', '12 hrs', '4 hrs'] },
      { label: 'Admin dashboard', values: [false, false, true] },
      { label: 'Monthly analytics report', values: [false, false, true] },
    ],
  },
];

const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const PricingContent = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [payingId, setPayingId] = useState<string | null>(null);

  const handleSelect = async (plan: typeof PLANS[number]) => {
    if (plan.id === 'enterprise') {
      window.location.href = 'mailto:sales@chatarly.com?subject=Enterprise%20Plan%20Enquiry';
      return;
    }
    if (!user) { navigate('/auth'); return; }
    if (plan.monthly === null) return;
    const amount = billing === 'yearly' ? plan.yearly! : plan.monthly!;
    setPayingId(plan.id);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Failed to load Razorpay checkout');
      const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
        body: { amount, currency: 'INR', plan_id: plan.id, billing_period: billing, user_id: user.id },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Order failed');
      const { order, key_id } = data as any;
      const rzp = new window.Razorpay({
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: 'Chatarly',
        description: `${plan.name} plan (${billing})`,
        prefill: { email: user.email || '', name: (profile as any)?.full_name || '' },
        theme: { color: '#6366f1' },
        handler: () => {
          toast.success('Payment successful! Your plan will activate shortly.');
        },
        modal: { ondismiss: () => setPayingId(null) },
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || 'Razorpay error');
    } finally {
      setPayingId(null);
    }
  };

  const priceFor = (p: typeof PLANS[number]) => {
    if (p.monthly === null) return null;
    return billing === 'yearly' ? p.yearly! : p.monthly;
  };

  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border mb-5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium">7-day free trial · No card required</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Simple Pricing for{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
                Growing Travel Businesses
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Automate WhatsApp enquiries, follow-ups, bookings, and customer communication
              from one powerful platform built for travel agencies, tour operators, taxi services,
              and tourism businesses.
            </p>

            {/* Billing toggle */}
            <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full bg-muted border border-border">
              <button
                onClick={() => setBilling('monthly')}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
                  billing === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >Monthly</button>
              <button
                onClick={() => setBilling('yearly')}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5',
                  billing === 'yearly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >Yearly
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">2 months free</span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Plans */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {PLANS.map((plan, i) => {
            const price = priceFor(plan);
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={cn(
                  'relative rounded-3xl p-6 flex flex-col transition-all',
                  plan.popular
                    ? 'bg-gradient-to-b from-primary/[0.08] via-card to-card border-2 border-primary shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.45)]'
                    : 'bg-card/80 backdrop-blur border border-border hover:border-primary/30',
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg">
                    <Crown className="w-3 h-3" />{plan.highlight}
                  </div>
                )}
                <div className={cn(
                  'w-11 h-11 rounded-2xl flex items-center justify-center mb-4',
                  plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                )}>
                  <plan.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-5 min-h-[32px]">{plan.tagline}</p>

                <div className="mb-5">
                  {price === null ? (
                    <div className="text-3xl font-bold">Custom</div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{formatINR(price)}</span>
                      <span className="text-xs text-muted-foreground">/{billing === 'yearly' ? 'year' : 'month'}</span>
                    </div>
                  )}
                  {billing === 'yearly' && plan.monthly && (
                    <p className="text-[11px] text-primary font-medium mt-1">
                      Save {formatINR(plan.monthly * 12 - plan.yearly!)} vs monthly
                    </p>
                  )}
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                      <Check className={cn('w-4 h-4 mt-0.5 shrink-0', plan.popular ? 'text-primary' : 'text-foreground/70')} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSelect(plan)}
                  disabled={payingId === plan.id}
                  variant={plan.popular ? 'default' : 'outline'}
                  className={cn('w-full rounded-full', plan.popular && 'bg-primary hover:bg-primary/90')}
                >
                  {payingId === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{plan.cta}<ArrowRight className="w-4 h-4" /></>}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Secondary CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" className="rounded-full px-6" onClick={() => handleSelect(PLANS[1])}>
            Start free trial<ArrowRight className="w-4 h-4" />
          </Button>
          <Button size="lg" variant="outline" className="rounded-full px-6"
            onClick={() => { window.location.href = 'mailto:sales@chatarly.com?subject=Book%20a%20demo'; }}>
            <Phone className="w-4 h-4" />Book a demo
          </Button>
        </div>

        {/* Trust badges */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: MessageCircle, label: 'Official WhatsApp Business API' },
            { icon: Shield, label: 'Secure Cloud Infrastructure' },
            { icon: Users, label: 'Dedicated Onboarding' },
            { icon: Headphones, label: 'Local Support' },
          ].map((t, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card/50 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <t.icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold">Compare every feature</h2>
          <p className="text-sm text-muted-foreground mt-2">A complete breakdown across all plans.</p>
        </div>
        <div className="rounded-3xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left p-4 font-semibold w-[34%]">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className={cn(
                      'p-4 font-semibold text-center',
                      p.popular && 'text-primary',
                    )}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="p-4 text-muted-foreground">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="p-4 text-center">
                        {typeof v === 'boolean' ? (
                          v ? <Check className="w-4 h-4 text-primary mx-auto" /> : <span className="text-muted-foreground/40">—</span>
                        ) : (
                          <span className="text-foreground font-medium">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legal footer links */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <button onClick={() => navigate('/privacy')} className="hover:text-foreground underline-offset-2 hover:underline">Privacy Policy</button>
          <span>·</span>
          <button onClick={() => navigate('/terms')} className="hover:text-foreground underline-offset-2 hover:underline">Terms & Conditions</button>
          <span>·</span>
          <a href="mailto:support@chatarly.com" className="hover:text-foreground underline-offset-2 hover:underline">support@chatarly.com</a>
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
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/auth')} className="font-bold text-foreground">Chatarly</button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
            <ArrowLeft className="w-4 h-4" />Back to Login
          </Button>
        </div>
      </div>
      <PricingContent />
    </div>
  );
};

export default Pricing;

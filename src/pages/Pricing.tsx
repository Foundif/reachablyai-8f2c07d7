import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Check, Crown, Sparkles, ArrowRight, Shield, Users, MessageCircle,
  Headphones, Building2, Zap, Star, ArrowLeft, Phone, Loader2, X,
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

type PlanId = 'basic' | 'growth' | 'business';

interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  setupFee: number;
  monthly: number;
  yearly: number;
  yearlySave: number;
  badge?: string;
  badgeIcon?: any;
  icon: any;
  popular?: boolean;
  features: { label: string; included: boolean }[];
}

const SETUP_FEE = 7500;

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Small businesses, single WhatsApp number, booking flow live and running',
    setupFee: SETUP_FEE,
    monthly: 2100,
    yearly: 21000,
    yearlySave: 4200,
    badge: 'Starter',
    badgeIcon: Star,
    icon: Zap,
    features: [
      { label: 'WhatsApp Flow (5 screens)', included: true },
      { label: 'Google Sheets auto sync', included: true },
      { label: '18-column booking data', included: true },
      { label: 'Auto Booking ID + IST timestamp', included: true },
      { label: 'Audit log — zero data loss', included: true },
      { label: '1 flow edit per month', included: true },
      { label: 'Email support — 48 hrs', included: true },
      { label: 'WhatsApp summary to customer', included: false },
      { label: 'Admin booking alerts', included: false },
      { label: 'Priority support', included: false },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Growing businesses, daily bookings, automated WhatsApp messages to customer and admin',
    setupFee: SETUP_FEE,
    monthly: 4999,
    yearly: 49999,
    yearlySave: 9989,
    badge: 'Most popular',
    badgeIcon: Crown,
    icon: Star,
    popular: true,
    features: [
      { label: 'Everything in Basic', included: true },
      { label: 'WhatsApp booking summary to customer', included: true },
      { label: 'Admin alert on every new booking', included: true },
      { label: 'Payment status tracking in sheet', included: true },
      { label: '3 flow edits per month', included: true },
      { label: 'WhatsApp support — 12 hrs', included: true },
      { label: 'Monthly booking report', included: true },
      { label: 'Admin dashboard', included: false },
      { label: 'Helper assignment system', included: false },
      { label: 'Multi-number support', included: false },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'High volume, multiple helpers, full admin control and booking automation end to end',
    setupFee: SETUP_FEE,
    monthly: 9999,
    yearly: 99999,
    yearlySave: 19989,
    badge: 'Pro',
    badgeIcon: Crown,
    icon: Crown,
    features: [
      { label: 'Everything in Growth', included: true },
      { label: 'Admin web dashboard', included: true },
      { label: 'Helper assignment and tracking', included: true },
      { label: 'Booking status updates to customer', included: true },
      { label: 'Multi-number / multi-location', included: true },
      { label: 'Unlimited flow edits', included: true },
      { label: 'Dedicated account manager', included: true },
      { label: '4 hr priority response', included: true },
    ],
  },
];

const COMPARE_SECTIONS: { title: string; rows: { label: string; values: (string | boolean)[] }[] }[] = [
  {
    title: 'Pricing breakdown',
    rows: [
      { label: 'One-time setup fee', values: ['₹7,500', '₹7,500', '₹7,500'] },
      { label: 'Monthly retainer', values: ['₹2,100', '₹4,999', '₹9,999'] },
      { label: 'Annual retainer', values: ['₹21,000', '₹49,999', '₹99,999'] },
      { label: 'Annual savings', values: ['₹4,200', '₹9,989', '₹19,989'] },
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
      { label: '18-column data capture', values: [true, true, true] },
      { label: 'IST timestamp + auto Booking ID', values: [true, true, true] },
      { label: 'Audit log — zero data loss', values: [true, true, true] },
      { label: 'Payment status column', values: ['Manual', 'Auto-update', 'Auto-update'] },
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
      { label: 'Admin dashboard', values: [false, true, true] },
      { label: 'Monthly analytics report', values: [false, true, true] },
    ],
  },
];


const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const PricingContent = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [payingId, setPayingId] = useState<string | null>(null);

  const handleSelect = async (plan: Plan) => {
    if (!user) { navigate('/auth'); return; }
    const amount = billing === 'yearly' ? plan.setupFee + plan.yearly : plan.setupFee + plan.monthly;
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
        description: `${plan.name} plan — setup + ${billing}`,
        prefill: { email: user.email || '', name: (profile as any)?.full_name || '' },
        theme: { color: '#6366f1' },
        handler: () => { toast.success('Payment successful! Your plan will activate shortly.'); },
        modal: { ondismiss: () => setPayingId(null) },
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || 'Razorpay error');
    } finally {
      setPayingId(null);
    }
  };

  const priceFor = (p: Plan) => billing === 'yearly' ? p.yearly : p.monthly;

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
              <span className="text-xs font-medium">Setup + Monthly · Pay & activate instantly</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Plans built for{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
                Travel & Tourism Businesses
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              One-time setup + monthly retainer. WhatsApp Flow, Google Sheets sync, audit log
              and full booking automation for travel agencies, tour operators, taxi services
              and tourism businesses.
            </p>

            <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full bg-muted border border-border">
              <button
                onClick={() => setBilling('monthly')}
                className={cn('px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
                  billing === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >Monthly</button>
              <button
                onClick={() => setBilling('yearly')}
                className={cn('px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5',
                  billing === 'yearly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >Yearly
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">Save ~2 months</span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Plans */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => {
            const price = priceFor(plan);
            const BadgeIcon = plan.badgeIcon || Sparkles;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={cn('relative rounded-3xl p-6 flex flex-col transition-all',
                  plan.popular
                    ? 'bg-gradient-to-b from-primary/[0.08] via-card to-card border-2 border-primary shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.45)]'
                    : 'bg-card/80 backdrop-blur border border-border hover:border-primary/30')}
              >
                {plan.badge && (
                  <div className={cn('inline-flex self-start items-center gap-1 mb-4 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                    plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                    <BadgeIcon className="w-3 h-3" />{plan.badge}
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center',
                    plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                    <plan.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-5 min-h-[40px]">{plan.tagline}</p>

                <div className="rounded-2xl border border-border bg-muted/30 p-4 mb-5 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">One-time setup</span>
                    <span className="font-semibold">{formatINR(plan.setupFee)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{billing === 'yearly' ? 'Annual retainer' : 'Monthly retainer'}</span>
                    <span className="font-semibold text-primary">
                      {formatINR(price)}<span className="text-muted-foreground font-normal"> /{billing === 'yearly' ? 'yr' : 'mo'}</span>
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between text-sm">
                    <span className="font-semibold">First {billing === 'yearly' ? 'year' : 'month'} total</span>
                    <span className="font-bold text-foreground">{formatINR(plan.setupFee + price)}</span>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className={cn('flex items-start gap-2.5 text-xs',
                      f.included ? 'text-foreground' : 'text-muted-foreground/60')}>
                      {f.included
                        ? <Check className={cn('w-4 h-4 mt-0.5 shrink-0', plan.popular ? 'text-primary' : 'text-foreground/70')} />
                        : <X className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground/40" />}
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSelect(plan)}
                  disabled={payingId === plan.id}
                  variant={plan.popular ? 'default' : 'outline'}
                  className={cn('w-full rounded-full', plan.popular && 'bg-primary hover:bg-primary/90')}
                >
                  {payingId === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Pay & activate {plan.name}<ArrowRight className="w-4 h-4" /></>}
                </Button>
              </motion.div>
            );
          })}
        </div>

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
          <h2 className="text-2xl sm:text-3xl font-bold">What's included</h2>
          <p className="text-sm text-muted-foreground mt-2">A complete feature breakdown across all plans.</p>
        </div>
        <div className="rounded-3xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left p-4 font-semibold w-[40%]">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className={cn('p-4 font-semibold text-center', p.popular && 'text-primary')}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_SECTIONS.map((section) => (
                  <FragmentRows key={section.title} section={section} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 text-[11px] text-muted-foreground border-t border-border bg-muted/20">
            Meta WhatsApp API conversation charges are billed separately by Meta and are not included above.
            Setup fee is one-time, non-refundable, and collected before work begins. Annual retainer is billed upfront.
          </div>
        </div>

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

const FragmentRows = ({ section }: { section: typeof COMPARE_SECTIONS[number] }) => (
  <>
    <tr className="bg-muted/20">
      <td colSpan={4} className="p-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {section.title}
      </td>
    </tr>
    {section.rows.map((row, idx) => (
      <tr key={idx} className="border-b border-border last:border-0">
        <td className="p-4 text-muted-foreground">{row.label}</td>
        {row.values.map((v, i) => (
          <td key={i} className="p-4 text-center">
            {typeof v === 'boolean'
              ? (v ? <Check className="w-4 h-4 text-primary mx-auto" /> : <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />)
              : <span className="text-foreground font-medium">{v}</span>}
          </td>
        ))}
      </tr>
    ))}
  </>
);

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

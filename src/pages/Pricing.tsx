import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Check, Crown, Sparkles, ArrowRight, Shield, Users, MessageCircle,
  Headphones, Building2, Zap, Star, ArrowLeft, Phone,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PaymentModal from '@/components/pricing/PaymentModal';

type PlanId = 'starter' | 'growth' | 'professional' | 'enterprise';

const PLANS: {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number | null;
  yearly: number | null;
  icon: any;
  popular?: boolean;
  highlight?: string;
  features: string[];
  cta: string;
}[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For new travel desks getting started on WhatsApp',
    monthly: 2100,
    yearly: 21000,
    icon: Zap,
    features: [
      '1 WhatsApp Business number',
      'Basic automation flows',
      'Lead capture forms',
      'Auto replies (business hours)',
      'Customer database',
      'Booking enquiry tracking',
      'Basic analytics',
      'Email support',
    ],
    cta: 'Start 7-day free trial',
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Most loved by tour operators & taxi services',
    monthly: 4500,
    yearly: 45000,
    icon: Star,
    popular: true,
    highlight: 'Most Popular',
    features: [
      'Everything in Starter',
      'Unlimited automation flows',
      'Lead pipeline CRM',
      'Follow-up automation',
      'Team access (3 users)',
      'Broadcast campaigns',
      'Advanced analytics',
      'Priority support',
    ],
    cta: 'Start 7-day free trial',
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'For multi-branch agencies & DMC operators',
    monthly: 8500,
    yearly: 85000,
    icon: Crown,
    features: [
      'Everything in Growth',
      'AI-powered responses',
      'Multi-agent shared inbox',
      'Custom workflow builder',
      'API integrations',
      'Unlimited contacts',
      'White-label support',
      'Dedicated success manager',
    ],
    cta: 'Start 7-day free trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom infrastructure for OTAs & travel chains',
    monthly: null,
    yearly: null,
    icon: Building2,
    features: [
      'Custom development',
      'Custom integrations',
      'Dedicated infrastructure',
      'SLA-backed uptime',
      'Account manager',
      'Onboarding & training',
    ],
    cta: 'Book a demo',
  },
];

const COMPARE_ROWS: { label: string; values: (string | boolean)[] }[] = [
  { label: 'WhatsApp Business numbers', values: ['1', '2', '5', 'Unlimited'] },
  { label: 'Automation flows', values: ['Basic', 'Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Team members', values: ['1', '3', '10', 'Unlimited'] },
  { label: 'Contacts', values: ['2,000', '10,000', 'Unlimited', 'Unlimited'] },
  { label: 'Lead pipeline CRM', values: [false, true, true, true] },
  { label: 'Broadcast campaigns', values: [false, true, true, true] },
  { label: 'AI-powered responses', values: [false, false, true, true] },
  { label: 'Custom workflow builder', values: [false, false, true, true] },
  { label: 'API access', values: [false, false, true, true] },
  { label: 'White-label', values: [false, false, true, true] },
  { label: 'Priority support', values: [false, true, true, true] },
  { label: 'Dedicated manager', values: [false, false, true, true] },
  { label: 'SLA & uptime guarantee', values: [false, false, false, true] },
];

const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const PricingContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selected, setSelected] = useState<typeof PLANS[number] | null>(null);

  const handleSelect = (plan: typeof PLANS[number]) => {
    if (plan.id === 'enterprise') {
      window.location.href = 'mailto:sales@chatarly.com?subject=Enterprise%20Plan%20Enquiry';
      return;
    }
    if (!user) { navigate('/auth'); return; }
    setSelected(plan);
    setPaymentOpen(true);
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
                  variant={plan.popular ? 'default' : 'outline'}
                  className={cn('w-full rounded-full', plan.popular && 'bg-primary hover:bg-primary/90')}
                >
                  {plan.cta}<ArrowRight className="w-4 h-4" />
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

      <PaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        plan={selected && selected.monthly !== null ? {
          id: selected.id,
          name: selected.name,
          price: billing === 'yearly' ? selected.yearly! : selected.monthly,
        } : null}
        formattedPrice={selected && selected.monthly !== null
          ? formatINR(billing === 'yearly' ? selected.yearly! : selected.monthly)
          : ''}
        billingPeriod={billing}
        upiId="chatarly@ybl"
        qrCodeUrl=""
      />
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

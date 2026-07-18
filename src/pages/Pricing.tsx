import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Check, X, Crown, Sparkles, Zap, Star, MessageSquare, ArrowLeft, Wrench,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PlanId = 'starter' | 'growth' | 'business';

interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number;   // ₹ / month
  yearly: number;    // ₹ / year (2 months free)
  credits: string;   // included message credits (approx)
  badge?: string;
  badgeIcon?: any;
  icon: any;
  popular?: boolean;
  cta: string;
  features: string[];
}

// Reachably pricing — matches the published feature-comparison sheet.
// Yearly = monthly × 10 (2 months free).
const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Solo founders getting started with WhatsApp outreach',
    monthly: 999,
    yearly: 9990,
    credits: '~500 msgs / mo',
    badge: 'Basic',
    badgeIcon: Zap,
    icon: MessageSquare,
    cta: 'Start with Starter',
    features: [
      '1 team member',
      'Unlimited templates',
      'CRM Dashboard',
      'Contact management',
      'WhatsApp broadcast',
      'Official Meta Cloud API',
      'Website integration',
      'Basic campaign analytics',
      'Basic automation workflows',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Most popular — everything you need to scale outreach',
    monthly: 1999,
    yearly: 19990,
    credits: '~1,200 msgs / mo',
    badge: 'Most popular',
    badgeIcon: Crown,
    icon: Star,
    popular: true,
    cta: 'Choose Growth',
    features: [
      'Up to 3 team members',
      'Everything in Starter, plus:',
      'API access',
      'Advanced campaign analytics',
      'Advanced automation workflows',
      'Priority support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Agencies & high-volume teams with dedicated support',
    monthly: 3999,
    yearly: 39990,
    credits: '~2,800 msgs / mo',
    badge: 'Advanced',
    badgeIcon: Sparkles,
    icon: Crown,
    cta: 'Choose Business',
    features: [
      'Unlimited team members',
      'Everything in Growth, plus:',
      'Unlimited automation workflows',
      'Dedicated account manager',
      'Priority support · SLA',
    ],
  },
];

const SETUP_FEE = 2999;

const COMPARE: { label: string; values: [string | boolean, string | boolean, string | boolean] }[] = [
  { label: 'Monthly Price',           values: ['₹999', '₹1,999', '₹3,999'] },
  { label: 'Annual Price (2 months free)', values: ['₹9,990', '₹19,990', '₹39,990'] },
  { label: 'Included Message Credits*',    values: ['~500', '~1,200', '~2,800'] },
  { label: 'CRM Dashboard',           values: [true, true, true] },
  { label: 'Contact Management',      values: [true, true, true] },
  { label: 'WhatsApp Broadcast',      values: [true, true, true] },
  { label: 'Official Meta Cloud API', values: [true, true, true] },
  { label: 'Campaign Analytics',      values: ['Basic', 'Advanced', 'Advanced'] },
  { label: 'Team Members',            values: ['1', '3', 'Unlimited'] },
  { label: 'Templates',               values: ['Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Website Integration',     values: [true, true, true] },
  { label: 'API Access',              values: [false, true, true] },
  { label: 'Automation Workflows',    values: ['Basic', 'Advanced', 'Unlimited'] },
  { label: 'Priority Support',        values: [false, true, true] },
  { label: 'Dedicated Account Manager', values: [false, false, true] },
];

const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const Cell = ({ v }: { v: string | boolean }) => {
  if (v === true) return <Check className="w-4 h-4 text-emerald-600 mx-auto" />;
  if (v === false) return <X className="w-4 h-4 text-muted-foreground/60 mx-auto" />;
  return <span className="text-sm">{v}</span>;
};

const PricingContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);

  const priceFor = (p: Plan) => billing === 'yearly' ? p.yearly : p.monthly;
  const savingsFor = (p: Plan) => p.monthly * 12 - p.yearly;

  const handleSelect = async (plan: Plan) => {
    if (!user) { navigate('/auth'); return; }
    setBusy(plan.id);
    toast.info(`${plan.name} plan selected — checkout coming soon. We'll email you to activate.`);
    setTimeout(() => setBusy(null), 800);
  };

  const paySetup = async () => {
    if (!user) { navigate('/auth'); return; }
    setSetupBusy(true);
    toast.info(`One-time setup fee ${formatINR(SETUP_FEE)} — checkout coming soon.`);
    setTimeout(() => setSetupBusy(false), 800);
  };

  return (
    <div className="relative overflow-hidden">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border mb-5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium">Simple pricing · Safe WhatsApp automation</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              One plan to run all your{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
                WhatsApp growth
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Bulk campaigns, approved Meta templates, safe pacing to protect your number,
              and a team inbox — all in one CRM.
            </p>

            <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full bg-muted border border-border">
              <button onClick={() => setBilling('monthly')}
                className={cn('px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
                  billing === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >Monthly</button>
              <button onClick={() => setBilling('yearly')}
                className={cn('px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5',
                  billing === 'yearly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >Yearly <Badge variant="secondary" className="text-[10px] py-0 px-1.5">2 months free</Badge></button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        {/* One-time setup banner */}
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
                  Meta Cloud API config · WhatsApp Business onboarding · Webhook setup · CRM account setup · Team onboarding · Contact import · Basic training.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 md:shrink-0">
              <div className="text-right">
                <div className="text-2xl font-bold">{formatINR(SETUP_FEE)}</div>
                <div className="text-[11px] text-muted-foreground">one-time</div>
              </div>
              <Button onClick={paySetup} disabled={setupBusy}>
                {setupBusy ? 'Loading…' : 'Pay setup fee'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const BadgeIcon = plan.badgeIcon;
            return (
              <motion.div key={plan.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <Card className={cn(
                  'relative p-6 h-full flex flex-col border-2 transition-all',
                  plan.popular
                    ? 'border-primary shadow-2xl shadow-primary/20 md:scale-[1.03]'
                    : 'border-border hover:border-primary/30',
                )}>
                  {plan.badge && (
                    <div className={cn(
                      'absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1',
                      plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground border',
                    )}>
                      {BadgeIcon && <BadgeIcon className="w-3 h-3" />} {plan.badge}
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
                  {billing === 'yearly' && (
                    <p className="text-xs text-emerald-600 mb-3">You save {formatINR(savingsFor(plan))} /year</p>
                  )}
                  <div className="text-xs text-muted-foreground mb-5 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> {plan.credits}
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f, idx) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelect(plan)}
                    disabled={busy === plan.id}
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {busy === plan.id ? 'Loading…' : plan.cta}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center mt-2">
                    + one-time {formatINR(SETUP_FEE)} setup (paid separately)
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <div className="mt-14">
          <h2 className="text-2xl font-bold text-center mb-2">Compare features</h2>
          <p className="text-center text-sm text-muted-foreground mb-6">
            Everything you get across all Reachably plans.
          </p>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold">Features</th>
                  {PLANS.map(p => (
                    <th key={p.id} className="px-4 py-3 font-semibold text-center min-w-[110px]">
                      {p.name}
                      {p.popular && <Badge className="ml-2 text-[10px]" variant="default">Popular</Badge>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={i} className={cn('border-b last:border-0', i % 2 && 'bg-muted/20')}>
                    <td className="px-4 py-3 text-muted-foreground">{row.label}</td>
                    {row.values.map((v, j) => (
                      <td key={j} className="px-4 py-3 text-center">
                        <Cell v={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            *Included message credits are sufficient for approximately the stated number of standard WhatsApp template messages.
            Actual usage varies by Meta conversation category and destination country. Additional credits can be purchased anytime.
          </p>
        </div>

        {/* Annual savings recap */}
        <Card className="mt-10 p-6">
          <h3 className="font-semibold mb-4">Annual savings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2">Plan</th>
                  <th className="text-right py-2">Monthly total (12 mo)</th>
                  <th className="text-right py-2">Annual price</th>
                  <th className="text-right py-2">Savings</th>
                </tr>
              </thead>
              <tbody>
                {PLANS.map(p => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="text-right">{formatINR(p.monthly * 12)}</td>
                    <td className="text-right">{formatINR(p.yearly)}</td>
                    <td className="text-right text-emerald-600 font-medium">{formatINR(savingsFor(p))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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

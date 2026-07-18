import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles, Zap, Star, MessageSquare, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PlanId = 'starter' | 'growth' | 'pro';

interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  yearlySave: number;
  dailyLimit: string;
  badge?: string;
  badgeIcon?: any;
  icon: any;
  popular?: boolean;
  cta: string;
  features: string[];
  limits?: string[];
}

// Decoy pricing: Starter is the anchor, Growth is the target, Pro makes Growth look great.
const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Solo founders getting started with WhatsApp outreach',
    monthly: 999,
    yearly: 9990,
    yearlySave: 1998,
    dailyLimit: '40–50 msgs / day',
    badge: 'Anchor',
    badgeIcon: Zap,
    icon: MessageSquare,
    cta: 'Start with Starter',
    features: [
      '1 WhatsApp Business number',
      'Your own free-form templates (in-app)',
      'Bulk send to imported CSV / leads',
      'Safe pacing (6–12s random delay)',
      'Team inbox — 1 seat',
      'Basic analytics',
      'Email support',
    ],
    limits: ['~1,200 messages / month', 'No Meta template broadcasts', 'No automations'],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'The most popular plan — everything you need to scale',
    monthly: 2499,
    yearly: 24990,
    yearlySave: 4998,
    dailyLimit: 'Up to 2,000 msgs / day',
    badge: 'Most popular',
    badgeIcon: Crown,
    icon: Star,
    popular: true,
    cta: 'Choose Growth',
    features: [
      'Everything in Starter, plus:',
      'Approved Meta templates + carousels',
      'Unlimited campaigns & automations',
      'Reachability preview + progress tracker',
      'Lead scraper (Google Maps)',
      'Team inbox — 5 seats',
      '24h window smart-fallback to templates',
      'Priority email + chat support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'High-volume teams, agencies, and multi-brand ops',
    monthly: 4999,
    yearly: 49990,
    yearlySave: 9998,
    dailyLimit: 'Meta tier limits (up to 100K+)',
    badge: 'Advanced',
    badgeIcon: Sparkles,
    icon: Crown,
    cta: 'Talk to sales',
    features: [
      'Everything in Growth, plus:',
      'Multiple WhatsApp numbers',
      'Public Booking API + webhooks',
      'AI reply assistant',
      'Advanced accounting & Meta cost sync',
      'Custom automations & role permissions',
      'Unlimited team seats',
      'Dedicated account manager · SLA',
    ],
  },
];

const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const PricingContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [busy, setBusy] = useState<PlanId | null>(null);

  const priceFor = (p: Plan) => billing === 'yearly' ? p.yearly : p.monthly;

  const handleSelect = async (plan: Plan) => {
    if (!user) { navigate('/auth'); return; }
    setBusy(plan.id);
    // Subscription checkout will be wired to Razorpay separately.
    toast.info(`${plan.name} plan selected — checkout coming soon. We'll email you to activate.`);
    setTimeout(() => setBusy(null), 800);
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
              >Yearly <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Save 17%</Badge></button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
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
                    <p className="text-xs text-emerald-600 mb-3">You save {formatINR(plan.yearlySave)} /year</p>
                  )}
                  <div className="text-xs text-muted-foreground mb-5 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> {plan.dailyLimit}
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f, idx) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.limits?.map((l, idx) => (
                      <li key={`l-${idx}`} className="flex gap-2 text-xs text-muted-foreground">
                        <span className="w-4 shrink-0 text-center">·</span>
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelect(plan)}
                    disabled={busy === plan.id}
                    className={cn('w-full', plan.popular ? '' : 'variant-outline')}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {busy === plan.id ? 'Loading…' : plan.cta}
                  </Button>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <Card className="mt-10 p-6 bg-muted/30 border-dashed">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <h3 className="font-semibold">Why the daily limit on Starter?</h3>
              <p className="text-sm text-muted-foreground max-w-2xl">
                To keep your WhatsApp number safe from Meta bans. Sending too fast — especially without approved templates —
                is the #1 reason numbers get flagged. Growth and Pro add Meta template broadcasts, so you can safely scale to thousands.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/guide')}>Read safety guide</Button>
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

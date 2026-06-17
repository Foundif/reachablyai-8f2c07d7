import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Shield, Check, Zap, Users, BarChart3, Globe,
  ArrowRight, Sparkles, Crown, Building2, ArrowLeft,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PaymentModal from '@/components/pricing/PaymentModal';

const CURRENCIES = [
  { code: 'USD', symbol: '$', rate: 1 },
  { code: 'EUR', symbol: '€', rate: 0.92 },
  { code: 'GBP', symbol: '£', rate: 0.79 },
  { code: 'INR', symbol: '₹', rate: 83.12 },
  { code: 'AUD', symbol: 'A$', rate: 1.53 },
  { code: 'CAD', symbol: 'C$', rate: 1.36 },
];

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for solo stylists',
    monthlyPrice: 0,
    icon: Shield,
    popular: false,
    features: [
      'Up to 50 clients',
      'Basic billing & receipts',
      'Expense tracking',
      'Single employee',
      'Email support',
    ],
    cta: 'Get Started Free',
    ctaVariant: 'outline' as const,
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For growing salons & spas',
    monthlyPrice: 29,
    icon: Zap,
    popular: true,
    features: [
      'Unlimited clients',
      'Advanced analytics & reports',
      'Team management',
      'GST/Non-GST billing',
      'WhatsApp reminders',
      'Appointment booking',
      'Priority support',
    ],
    cta: 'Start 14-day free trial',
    ctaVariant: 'trust' as const,
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Multi-location salon chains',
    monthlyPrice: 99,
    icon: Building2,
    popular: false,
    features: [
      'Everything in Professional',
      'Multi-location support',
      'Advanced analytics dashboard',
      'API access',
      'Custom branding',
      'Exportable reports',
      'Dedicated account manager',
      'SSO authentication',
    ],
    cta: 'Contact Sales',
    ctaVariant: 'outline' as const,
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currency, setCurrency] = useState(CURRENCIES[3]); // Default INR
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[number] | null>(null);

  const getPrice = (monthlyUsd: number) => {
    if (monthlyUsd === 0) return 0;
    const monthlyLocal = monthlyUsd * currency.rate;
    if (billingPeriod === 'yearly') {
      return Math.round(monthlyLocal * 12 * 0.8); // 20% off yearly total
    }
    return monthlyLocal;
  };

  const formatPrice = (monthlyUsd: number) => {
    const price = getPrice(monthlyUsd);
    if (currency.code === 'INR') return `${currency.symbol}${Math.round(price).toLocaleString()}`;
    return `${currency.symbol}${price.toFixed(price % 1 === 0 ? 0 : 2)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-glow">
                <img src="/__l5e/assets-v1/28fc78aa-8351-4b67-a60e-e6bf0a7894c8/chatarly-logo.png" alt="Chatarly" className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-foreground text-sm sm:text-base">Chatarly</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(user ? '/' : '/auth')}>
              <ArrowLeft className="w-4 h-4" />
              {user ? 'Back to Dashboard' : 'Back to Login'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4 sm:mb-6">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary">20% off yearly plans</span>
          </div>
          
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3 sm:mb-4 px-2">
            Elevate Your Salon,<br className="hidden sm:block" />
            <span className="text-primary">Choose Your Plan</span>
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto mb-2 px-4">
            Start with a 14-day free trial on any paid plan. No card needed up-front — verify UPI payment when your trial ends to keep your workspace active.
          </p>
          <p className="text-xs text-muted-foreground mb-6 sm:mb-8 px-4">Trial includes every feature. After 14 days, access is paused until your manual UPI payment is verified.</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-8 sm:mb-12">
            <div className="flex items-center gap-2 p-1 rounded-lg bg-muted">
              <button onClick={() => setBillingPeriod('monthly')}
                className={cn('px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all',
                  billingPeriod === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                Monthly
              </button>
              <button onClick={() => setBillingPeriod('yearly')}
                className={cn('px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5',
                  billingPeriod === 'yearly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                Yearly<span className="text-[10px] sm:text-xs text-primary font-bold">-20%</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <select value={currency.code} onChange={(e) => setCurrency(CURRENCIES.find(c => c.code === e.target.value) || CURRENCIES[3])}
                className="bg-muted border-0 rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-5xl mx-auto">
          {PLANS.map((plan, index) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.1 }}
              className={cn('relative rounded-2xl p-4 sm:p-6 text-left transition-all duration-300',
                plan.popular ? 'bg-card border-2 border-primary shadow-glow' : 'glass-card border border-border hover:border-primary/30')}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1">
                  <Crown className="w-3 h-3" />Most Popular
                </div>
              )}
              <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-4',
                plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                <plan.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1">{plan.name}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-3xl sm:text-4xl font-bold text-foreground">
                  {plan.monthlyPrice === 0 ? 'Free' : formatPrice(plan.monthlyPrice)}
                </span>
                {plan.monthlyPrice > 0 && <span className="text-muted-foreground text-sm">/{billingPeriod === 'yearly' ? 'year' : 'month'}</span>}
              </div>
              <ul className="space-y-2.5 sm:space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />{feature}
                  </li>
                ))}
              </ul>
              <Button variant={plan.ctaVariant} className="w-full" size="lg"
                onClick={() => {
                  if (plan.id === 'starter') {
                    if (user) toast.success('You are on the Starter plan!');
                    else navigate('/auth');
                  } else if (plan.id === 'premium') {
                    window.location.href = 'mailto:sales@chatarly.com?subject=Premium%20Plan%20Inquiry';
                    toast.info('Opening email to contact sales...');
                  } else {
                    if (!user) { toast.info('Please create an account first'); navigate('/auth'); return; }
                    setSelectedPlan(plan);
                    setPaymentModalOpen(true);
                  }
                }}>
                {plan.cta}<ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="mt-12 sm:mt-16 pt-8 sm:pt-12 border-t border-border">
          <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">Trusted by 10,000+ salons worldwide</p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 lg:gap-12">
            {[
              { icon: Shield, label: 'Secure Payments' },
              { icon: Users, label: '50K+ Salons' },
              { icon: BarChart3, label: 'Real-time Analytics' },
              { icon: Globe, label: 'Multi-currency' },
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-2 text-muted-foreground">
                <badge.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm font-medium">{badge.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        plan={selectedPlan ? { id: selectedPlan.id, name: selectedPlan.name, price: getPrice(selectedPlan.monthlyPrice) } : null}
        formattedPrice={selectedPlan ? formatPrice(selectedPlan.monthlyPrice) : ''}
        billingPeriod={billingPeriod}
        upiId="chatarly@ybl"
        qrCodeUrl=""
      />
    </div>
  );
};

export default Pricing;

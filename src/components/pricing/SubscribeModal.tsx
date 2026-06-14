import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CreditCard, Check, Shield, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SubscribeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: {
    id: string;
    name: string;
    price: number;
  } | null;
  billingPeriod: 'monthly' | 'yearly';
  currencySymbol: string;
  formattedPrice: string;
}

const SubscribeModal = ({ 
  open, 
  onOpenChange, 
  plan, 
  billingPeriod,
  currencySymbol,
  formattedPrice 
}: SubscribeModalProps) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'success'>('info');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !name) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    
    // Simulate subscription process (in production, integrate with Stripe)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setStep('success');
    setLoading(false);
    toast.success(`Successfully subscribed to ${plan?.name}!`);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep('info');
      setEmail('');
      setName('');
    }, 200);
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'info' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Subscribe to {plan.name}
              </DialogTitle>
              <DialogDescription>
                {billingPeriod === 'yearly' 
                  ? 'Billed annually (20% discount applied)'
                  : 'Billed monthly, cancel anytime'}
              </DialogDescription>
            </DialogHeader>

            {/* Plan Summary */}
            <div className="p-4 rounded-xl bg-accent/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-foreground">{plan.name} Plan</span>
                <span className="text-lg font-bold text-foreground">
                  {formattedPrice}
                  <span className="text-sm text-muted-foreground">
                    /{billingPeriod === 'yearly' ? 'year' : 'month'}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-primary" />
                30-day money-back guarantee
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="sub-name" className="text-foreground">Full Name</Label>
                <Input
                  id="sub-name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>

              <div>
                <Label htmlFor="sub-email" className="text-foreground">Email Address</Label>
                <Input
                  id="sub-email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-1">
                  <Lock className="w-4 h-4" />
                  Secure payment via Stripe
                </div>
                <p className="text-xs text-muted-foreground">
                  You'll be redirected to complete payment
                </p>
              </div>

              <Button
                type="submit"
                variant="trust"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue to Payment
                    <CreditCard className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <div className="w-16 h-16 rounded-full bg-trust/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-trust-safe" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Welcome to {plan.name}!
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Your subscription is now active. You now have access to all {plan.name} features.
            </p>
            <Button variant="trust" onClick={handleClose}>
              Start Using Glamsup
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubscribeModal;

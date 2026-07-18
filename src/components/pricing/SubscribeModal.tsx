import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CreditCard, Check, Shield, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

declare global { interface Window { Razorpay?: any } }

const loadRazorpay = () => new Promise<boolean>((resolve) => {
  if (window.Razorpay) return resolve(true);
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = () => resolve(true);
  s.onerror = () => resolve(false);
  document.body.appendChild(s);
});

interface SubscribeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: { id: string; name: string; price: number } | null;
  billingPeriod: 'monthly' | 'yearly';
  currencySymbol: string;
  formattedPrice: string;
}

const SubscribeModal = ({
  open, onOpenChange, plan, billingPeriod, formattedPrice,
}: SubscribeModalProps) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'success'>('info');

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => setStep('info'), 200);
  };

  const handlePay = async () => {
    if (!plan || !user) return;
    setLoading(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Failed to load Razorpay');

      const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
        body: { amount: plan.price, plan_id: plan.id, billing_period: billingPeriod },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Order failed');
      const { order, key_id } = data;

      const rzp = new window.Razorpay({
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: 'Reachably',
        description: `${plan.name} — ${billingPeriod}`,
        prefill: {
          email: user.email || '',
          name: (profile as any)?.full_name || (profile as any)?.store_name || '',
        },
        theme: { color: '#d946ef' },
        handler: async (resp: any) => {
          try {
            const { data: v, error: vErr } = await supabase.functions.invoke('razorpay-verify', {
              body: {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                plan_id: plan.id,
                billing_period: billingPeriod,
              },
            });
            if (vErr || v?.error) throw new Error(v?.error || vErr?.message || 'Verify failed');
            setStep('success');
            toast.success(`Subscribed to ${plan.name}!`);
          } catch (e: any) {
            toast.error(e.message || 'Verification failed');
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.on('payment.failed', (r: any) => {
        toast.error(r?.error?.description || 'Payment failed');
        setLoading(false);
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || 'Payment error');
    } finally {
      setLoading(false);
    }
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'info' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Subscribe to {plan.name}
              </DialogTitle>
              <DialogDescription>
                {billingPeriod === 'yearly' ? 'Billed annually (2 months free)' : 'Billed monthly, cancel anytime'}
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 rounded-xl bg-accent/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{plan.name} Plan</span>
                <span className="text-lg font-bold">
                  {formattedPrice}
                  <span className="text-sm text-muted-foreground">
                    /{billingPeriod === 'yearly' ? 'year' : 'month'}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-primary" />Instant activation after payment
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-1">
                <Lock className="w-4 h-4" />Secure payment via Razorpay
              </div>
              <p className="text-xs text-muted-foreground">Cards · UPI · Netbanking · Wallets</p>
            </div>

            <Button size="lg" className="w-full" disabled={loading} onClick={handlePay}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Pay {formattedPrice} <CreditCard className="w-4 h-4 ml-2" /></>}
            </Button>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Welcome to {plan.name}!</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Your subscription is active. Enjoy full access to Reachably.
            </p>
            <Button onClick={handleClose}>Start using Reachably</Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubscribeModal;

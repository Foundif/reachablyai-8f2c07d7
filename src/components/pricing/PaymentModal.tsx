import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Check, QrCode, Smartphone, Timer, Copy, CreditCard } from 'lucide-react';
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

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: { id: string; name: string; price: number } | null;
  formattedPrice: string;
  billingPeriod: 'monthly' | 'yearly';
  upiId?: string;
  qrCodeUrl?: string;
}

const UPI_APPS = [
  { name: 'GPay', icon: '💳', scheme: 'gpay' },
  { name: 'PhonePe', icon: '📱', scheme: 'phonepe' },
  { name: 'Paytm', icon: '💰', scheme: 'paytm' },
  { name: 'BHIM', icon: '🏦', scheme: 'bhim' },
];

const PaymentModal = ({ open, onOpenChange, plan, formattedPrice, billingPeriod, upiId = '', qrCodeUrl = '' }: PaymentModalProps) => {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<'pay' | 'waiting' | 'success'>('pay');
  const [timeLeft, setTimeLeft] = useState(60);
  const [canSubmit, setCanSubmit] = useState(false);
  const [rzpLoading, setRzpLoading] = useState(false);

  useEffect(() => {
    if (step !== 'waiting') return;
    setTimeLeft(60);
    setCanSubmit(false);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setCanSubmit(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => setStep('pay'), 300);
  };

  const handleUpiOpen = (scheme: string) => {
    const amount = plan?.price || 0;
    const upiLink = `upi://pay?pa=${upiId}&pn=Chatarly&am=${amount}&cu=INR&tn=${plan?.name}%20Plan`;
    window.open(upiLink, '_blank');
    setStep('waiting');
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText(upiId);
    toast.success('UPI ID copied!');
  };

  const handlePaymentDone = () => {
    setStep('success');
    toast.success('Payment submitted! Our team will verify and activate your plan.');
  };

  const handleRazorpay = async () => {
    if (!plan) return;
    setRzpLoading(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Failed to load Razorpay checkout');
      const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
        body: { amount: plan.price, currency: 'INR', plan_id: plan.id, billing_period: billingPeriod, user_id: user?.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Order failed');
      const { order, key_id } = data;
      const rzp = new window.Razorpay({
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: 'Chatarly',
        description: `${plan.name} plan (${billingPeriod})`,
        prefill: { email: user?.email || '', name: (profile as any)?.full_name || '' },
        theme: { color: '#6366f1' },
        handler: () => {
          setStep('success');
          toast.success('Payment successful! Your plan will activate shortly.');
        },
        modal: { ondismiss: () => setRzpLoading(false) },
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || 'Razorpay error');
    } finally {
      setRzpLoading(false);
    }
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'pay' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                Pay for {plan.name}
              </DialogTitle>
              <DialogDescription>
                {formattedPrice}/{billingPeriod === 'yearly' ? 'year' : 'month'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* QR Code */}
              {qrCodeUrl ? (
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-xl border border-border">
                    <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-48 object-contain" />
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-48 h-48 bg-muted rounded-xl flex items-center justify-center">
                    <QrCode className="w-16 h-16 text-muted-foreground" />
                  </div>
                </div>
              )}

              {/* UPI ID */}
              {upiId && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">UPI ID</p>
                    <p className="font-mono text-sm font-medium text-foreground">{upiId}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyUpiId}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* UPI App Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {UPI_APPS.map(app => (
                  <button
                    key={app.scheme}
                    onClick={() => handleUpiOpen(app.scheme)}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <span className="text-2xl">{app.icon}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">{app.name}</span>
                  </button>
                ))}
              </div>

              <Button className="w-full" onClick={handleRazorpay} disabled={rzpLoading}>
                {rzpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Pay with Razorpay (Cards / UPI / Netbanking)</>}
              </Button>

              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider"><span className="bg-background px-2 text-muted-foreground">or pay manually</span></div>
              </div>

              <Button variant="trust" className="w-full" onClick={() => setStep('waiting')}>
                <Smartphone className="w-4 h-4" />I've made the payment
              </Button>
            </div>
          </>
        )}

        {step === 'waiting' && (
          <div className="text-center py-4 space-y-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Timer className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">Verifying Payment</h3>
              <p className="text-sm text-muted-foreground">Please wait while we confirm your payment</p>
            </div>

            {timeLeft > 0 && (
              <div className="text-3xl font-bold text-primary tabular-nums">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            )}

            <Button
              variant="trust"
              className="w-full"
              disabled={!canSubmit}
              onClick={handlePaymentDone}
            >
              {canSubmit ? (
                <><Check className="w-4 h-4" />Submit Payment Confirmation</>
              ) : (
                <><Loader2 className="w-4 h-4 animate-spin" />Please wait {timeLeft}s</>
              )}
            </Button>
          </div>
        )}

        {step === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <div className="w-16 h-16 rounded-full bg-risk-safe/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-risk-safe" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Payment Submitted! 🎉
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Our team will verify your payment and activate your {plan.name} plan within 24 hours. We'll contact you shortly.
            </p>
            <Button variant="trust" onClick={handleClose}>
              Done
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const TermsContent = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 text-foreground">
    <h1 className="text-3xl sm:text-4xl font-bold">Terms & Conditions</h1>
    <p className="text-sm text-muted-foreground">Last updated: June 17, 2026</p>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">1. Agreement</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        By creating a Chatarly account you agree to these Terms. Chatarly is operated by
        Foundif Innovations ("we", "us"). If you don't agree, please don't use the service.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">2. Subscriptions & Billing</h2>
      <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
        <li>Paid plans start with a 7-day free trial. After the trial, access is paused until the
          first subscription payment is verified.</li>
        <li>Payments are processed in INR through Razorpay. Plan pricing is listed on the Pricing page.</li>
        <li>Subscriptions auto-renew monthly or yearly based on your selection. You may cancel anytime
          from the Billing page; access continues until the end of the current billing cycle.</li>
        <li>Yearly plans receive a discount equivalent to approximately 2 months free.</li>
      </ul>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">3. Refund Policy</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        All subscription payments are non-refundable once the billing cycle has started. If a payment
        was charged in error, contact <a href="mailto:support@chatarly.com" className="text-primary underline">support@chatarly.com</a>
        within 7 days and we will investigate.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">4. Acceptable Use</h2>
      <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
        <li>No spam, unsolicited bulk messaging, or violation of Meta WhatsApp Business policies.</li>
        <li>No unlawful, harmful, or fraudulent activity through the platform.</li>
        <li>You are responsible for the accuracy of customer data and content you send.</li>
      </ul>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">5. Service Availability</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        We target 99.5% monthly uptime but do not guarantee uninterrupted service. Scheduled maintenance
        will be announced where possible.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">6. Account Termination</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        We may suspend or terminate accounts that violate these Terms or Meta's WhatsApp policies.
        You may delete your account anytime from Settings.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">7. Limitation of Liability</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        To the maximum extent permitted by law, Chatarly's total liability is limited to the amount
        paid by you in the preceding 3 months. We are not liable for indirect or consequential losses.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">8. Governing Law</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        These Terms are governed by the laws of India. Disputes are subject to the courts of Bengaluru, Karnataka.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">9. Contact</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Foundif Innovations · <a href="mailto:support@chatarly.com" className="text-primary underline">support@chatarly.com</a>
      </p>
    </section>
  </div>
);

const Terms = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  if (user) return <AppLayout><TermsContent /></AppLayout>;
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold">Chatarly</span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}><ArrowLeft className="w-4 h-4" />Back</Button>
        </div>
      </div>
      <TermsContent />
    </div>
  );
};

export default Terms;

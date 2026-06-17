import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const PrivacyContent = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 text-foreground">
    <h1 className="text-3xl sm:text-4xl font-bold">Privacy Policy</h1>
    <p className="text-sm text-muted-foreground">Last updated: June 17, 2026</p>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">1. Introduction</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Chatarly ("we", "our", "us") is a WhatsApp automation platform operated by Foundif Innovations.
        This Privacy Policy explains how we collect, use, and protect information when you use our
        services at chatarly.lovable.app and related applications.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">2. Information We Collect</h2>
      <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
        <li><strong>Account data:</strong> name, email, phone, business name, country.</li>
        <li><strong>Business data:</strong> customers, bookings, payments, messages you process through the platform.</li>
        <li><strong>WhatsApp data:</strong> messages, contacts, and flow submissions routed via the Meta WhatsApp Business API.</li>
        <li><strong>Payment data:</strong> processed via Razorpay; we do not store full card numbers or UPI credentials.</li>
        <li><strong>Usage data:</strong> device, browser, IP, log timestamps, feature interactions.</li>
      </ul>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">3. How We Use Information</h2>
      <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
        <li>To operate the service, sync WhatsApp messages, and store bookings.</li>
        <li>To process subscription payments through Razorpay.</li>
        <li>To send transactional notifications (booking, payment, account alerts).</li>
        <li>To improve product quality, security, and customer support.</li>
      </ul>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">4. Data Sharing</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        We share data only with the providers required to deliver the service: Meta (WhatsApp Business API),
        Razorpay (payments), Supabase / Lovable Cloud (database & hosting), and email/SMS providers for
        notifications. We never sell personal data.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">5. Data Retention</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        We retain business records as long as your workspace is active. On account deletion, your data is
        removed within 30 days unless we are legally required to retain it (e.g. tax records).
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">6. Your Rights</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        You may request access, correction, export or deletion of your data at any time by writing to
        <a href="mailto:support@chatarly.com" className="text-primary underline ml-1">support@chatarly.com</a>.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">7. Security</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        We use TLS in transit, encryption at rest, role-based access, and row-level security on every
        tenant table. Payment data is handled by PCI-DSS compliant providers.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">8. Contact</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Foundif Innovations · <a href="mailto:support@chatarly.com" className="text-primary underline">support@chatarly.com</a>
      </p>
    </section>
  </div>
);

const Privacy = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  if (user) return <AppLayout><PrivacyContent /></AppLayout>;
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold">Chatarly</span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}><ArrowLeft className="w-4 h-4" />Back</Button>
        </div>
      </div>
      <PrivacyContent />
    </div>
  );
};

export default Privacy;

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { LANGUAGES } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Building2, Plane, BarChart3, Crown, Gift, Bell, Moon, Sun,
  Globe, Shield, LogOut, ChevronRight, Receipt, FileText, Check, Loader2,
  Volume2, VolumeX, Play,
} from 'lucide-react';
import { toast } from 'sonner';
import ChangePasswordModal from '@/components/profile/ChangePasswordModal';
import { isNotificationMuted, setNotificationMuted, playNotificationSound, enableNotificationSound } from '@/hooks/useNotifications';

type Row = { icon: any; label: string; sub?: string; right?: React.ReactNode; onClick?: () => void };

const SectionCard = ({ title, rows }: { title: string; rows: Row[] }) => (
  <div className="space-y-2">
    <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground px-1">{title}</p>
    <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
      {rows.map((r, i) => (
        <button
          key={i}
          onClick={r.onClick}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <r.icon className="w-4 h-4 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{r.label}</p>
            {r.sub && <p className="text-xs text-muted-foreground truncate">{r.sub}</p>}
          </div>
          {r.right ?? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        </button>
      ))}
    </div>
  </div>
);

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [muted, setMuted] = useState(isNotificationMuted());
  const [editOpen, setEditOpen] = useState(false);

  const toggleMute = (m: boolean) => {
    setMuted(m);
    setNotificationMuted(m);
    toast.success(m ? 'Message sound muted' : 'Message sound unmuted');
  };

  const testSound = () => {
    enableNotificationSound();
    playNotificationSound();
    toast.success('Playing test sound — if you hear nothing, click anywhere on the page first then try again.');
  };


  const planStatus = (profile as any)?.subscription_status || 'free';
  const planLabel = planStatus === 'pro' ? 'Pro' : planStatus === 'growth' ? 'Growth' : 'Free';
  const storeName = profile?.store_name || 'My Business';
  const initial = (storeName?.[0] || 'B').toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Hero */}
        <div className="flex flex-col items-center text-center pt-2">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-200 to-emerald-300 dark:from-emerald-800 dark:to-emerald-900 flex items-center justify-center text-3xl font-semibold text-emerald-900 dark:text-emerald-100 shadow-sm">
            {(profile as any)?.logo_url ? (
              <img src={(profile as any).logo_url} alt={storeName} className="w-full h-full rounded-full object-cover" />
            ) : initial}
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">{storeName}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <Button
            onClick={() => setEditOpen(v => !v)}
            className="mt-4 rounded-full bg-foreground text-background hover:bg-foreground/90 px-6"
          >
            Edit profile
          </Button>
        </div>

        {editOpen && <EditProfileCard onClose={() => setEditOpen(false)} />}

        <SectionCard
          title="Business"
          rows={[
            { icon: Building2, label: 'Agency Details', sub: (profile as any)?.phone || user?.email, onClick: () => navigate('/shop-info') },
            { icon: Plane, label: 'Services & Branding', sub: 'Logo, tagline, services line', onClick: () => navigate('/services') },
            { icon: BarChart3, label: 'Reports & Exports', sub: 'Bookings, payments, customers', onClick: () => navigate('/analytics') },
          ]}
        />

        <SectionCard
          title="Plan"
          rows={[
            {
              icon: Crown, label: planLabel === 'Free' ? 'Upgrade to Pro' : `${planLabel} plan active`,
              sub: planLabel === 'Free' ? 'Unlimited bookings & exports' : 'Manage subscription & invoices',
              right: <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${planLabel === 'Free' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-primary/15 text-primary'}`}>{planLabel.toUpperCase()}</span>,
              onClick: () => navigate(planLabel === 'Free' ? '/pricing' : '/billing'),
            },
            { icon: Receipt, label: 'Billing & Invoices', sub: 'Download GST invoices', onClick: () => navigate('/billing') },
            { icon: Gift, label: 'Refer & Earn Credits', sub: 'Invite a friend, earn ₹500', onClick: () => toast.info('Referral programme launching soon') },
          ]}
        />

        <SectionCard
          title="Preferences"
          rows={[
            {
              icon: Bell, label: 'Push notifications', sub: 'Booking & payment alerts',
              right: <Switch checked={pushAlerts} onCheckedChange={setPushAlerts} onClick={(e) => e.stopPropagation()} />,
            },
            {
              icon: muted ? VolumeX : Volume2, label: 'Message alert sound',
              sub: muted ? 'Muted — no chime on new messages' : 'Plays chime on every new message',
              right: <Switch checked={!muted} onCheckedChange={(v) => toggleMute(!v)} onClick={(e) => e.stopPropagation()} />,
            },
            {
              icon: Play, label: 'Test sound', sub: 'Play the alert chime now',
              onClick: testSound,
            },
            {
              icon: theme === 'dark' ? Moon : Sun, label: 'Dark mode', sub: 'Easy on the eyes',
              right: <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} onClick={(e) => e.stopPropagation()} />,
            },
            {
              icon: Globe, label: 'Language',
              sub: LANGUAGES.find(l => l.id === language)?.nativeLabel || 'English',
              onClick: () => {
                const ids = LANGUAGES.map(l => l.id);
                const next = ids[(ids.indexOf(language) + 1) % ids.length];
                setLanguage(next);
                toast.success(`Language set to ${LANGUAGES.find(l => l.id === next)?.label}`);
              },
            },
          ]}
        />

        <SectionCard
          title="Security"
          rows={[
            { icon: FileText, label: 'Audit Logs', sub: 'See every account action', onClick: () => navigate('/audit') },
            { icon: Shield, label: 'Change password', sub: 'Update your login password', onClick: () => setPasswordModalOpen(true) },
          ]}
        />

        <SectionCard
          title="Legal"
          rows={[
            { icon: FileText, label: 'Privacy Policy', sub: 'How we handle your data', onClick: () => navigate('/privacy') },
            { icon: Shield, label: 'Terms & Conditions', sub: 'Subscription, refunds & usage', onClick: () => navigate('/terms') },
          ]}
        />


        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full text-red-500 border-red-500/30 hover:bg-red-500/10 rounded-2xl py-6"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </Button>

        <p className="text-center text-[11px] text-muted-foreground pb-6">
          © 2026 Reachably
        </p>

        <ChangePasswordModal open={passwordModalOpen} onOpenChange={setPasswordModalOpen} />
      </div>
    </AppLayout>
  );
};

const EditProfileCard = ({ onClose }: { onClose: () => void }) => {
  const { user, profile, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [storeName, setStoreName] = useState(profile?.store_name || '');
  const [businessType, setBusinessType] = useState((profile as any)?.business_type || '');
  const [businessCategory, setBusinessCategory] = useState((profile as any)?.business_category || '');
  const [gstNumber, setGstNumber] = useState((profile as any)?.gst_number || '');
  const [phone, setPhone] = useState((profile as any)?.phone || '');
  const [country, setCountry] = useState(profile?.country || 'India');
  const [currency, setCurrency] = useState(profile?.currency || 'INR');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await updateProfile({
      full_name: fullName, store_name: storeName,
      business_type: businessType, business_category: businessCategory,
      gst_number: gstNumber, phone, country, currency,
    } as any);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success('Profile updated'); onClose(); }
  };

  const changeEmail = async () => {
    const next = email.trim().toLowerCase();
    if (!next || next === (user?.email || '').toLowerCase()) return toast.error('Enter a new email');
    setEmailSaving(true);
    const { supabase } = await import('@/integrations/supabase/client');
    const { error } = await supabase.auth.updateUser({ email: next });
    setEmailSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Confirmation link sent', {
      description: `Open ${next} and click the link. Also confirm from your old address if asked. Your login email will change once both links are clicked.`,
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label className="text-xs">Full name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1.5" /></div>
        <div><Label className="text-xs">Business name</Label><Input value={storeName} onChange={e => setStoreName(e.target.value)} className="mt-1.5" /></div>
        <div><Label className="text-xs">Business type</Label><Input value={businessType} onChange={e => setBusinessType(e.target.value)} className="mt-1.5" /></div>
        <div><Label className="text-xs">Category</Label><Input value={businessCategory} onChange={e => setBusinessCategory(e.target.value)} className="mt-1.5" placeholder="B2C, B2B…" /></div>
        <div><Label className="text-xs">Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1.5" /></div>
        <div><Label className="text-xs">GST number</Label><Input value={gstNumber} onChange={e => setGstNumber(e.target.value.toUpperCase())} className="mt-1.5" /></div>
        <div><Label className="text-xs">Country</Label><Input value={country} onChange={e => setCountry(e.target.value)} className="mt-1.5" /></div>
        <div><Label className="text-xs">Currency</Label><Input value={currency} onChange={e => setCurrency(e.target.value)} className="mt-1.5" /></div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={save} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save</>}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>

      <div className="pt-4 mt-2 border-t border-border space-y-2">
        <Label className="text-xs">Login email</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="new@example.com" />
          <Button variant="outline" onClick={changeEmail} disabled={emailSaving}>
            {emailSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send confirmation'}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          A confirmation link is sent to the new address. Your login email switches only after you click it.
          If your provider requires it, also click the confirmation on the old address.
        </p>
      </div>
    </div>
  );
};

export default Profile;

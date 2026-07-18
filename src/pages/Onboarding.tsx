import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowRight, ArrowLeft, Check, Loader2, Upload, Image as ImageIcon, X,
  MessageSquare, Megaphone, ShoppingCart, Users, Target, Sparkles,
  Instagram, Facebook, Search, UserPlus, Youtube, HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const BUSINESS_TYPES = ['Salon / Spa', 'Clinic', 'Gym / Fitness', 'Retail Store', 'Restaurant', 'Travel & Tours', 'Real Estate', 'Education', 'Agency', 'Ecommerce', 'Other'];
const CATEGORIES = ['B2C', 'B2B', 'D2C', 'Marketplace', 'Service', 'SaaS'];

const PURPOSES = [
  { id: 'leads', label: 'Generate more leads', icon: Target },
  { id: 'support', label: 'Customer support', icon: MessageSquare },
  { id: 'sales', label: 'Sell products / services', icon: ShoppingCart },
  { id: 'campaigns', label: 'Run WhatsApp campaigns', icon: Megaphone },
  { id: 'team', label: 'Team collaboration', icon: Users },
  { id: 'other', label: 'Something else', icon: Sparkles },
];

const SOURCES = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'google', label: 'Google Search', icon: Search },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'friend', label: 'Friend / Referral', icon: UserPlus },
  { id: 'other', label: 'Other', icon: HelpCircle },
];

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [category, setCategory] = useState('');
  const [gst, setGst] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [source, setSource] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();

  const steps = ['Business', 'Goal', 'Source'];
  const progress = ((step + 1) / steps.length) * 100;

  const onLogoPick = (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return; }
    setLogoFile(file);
    const r = new FileReader(); r.onload = e => setLogoPreview(e.target?.result as string); r.readAsDataURL(file);
  };

  const canNext = () => {
    if (step === 0) return businessName.trim() && businessType && phone.trim().length >= 10;
    if (step === 1) return !!purpose;
    if (step === 2) return !!source;
    return false;
  };

  const uploadLogo = async () => {
    if (!logoFile || !user) return null;
    const ext = logoFile.name.split('.').pop() || 'png';
    const path = `logos/${user.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('salon-assets').upload(path, logoFile, { upsert: true });
    if (error) { toast.error('Logo upload failed'); return null; }
    return supabase.storage.from('salon-assets').getPublicUrl(path).data.publicUrl;
  };

  const finish = async () => {
    setLoading(true);
    const logo_url = logoFile ? await uploadLogo() : null;
    const { error } = await updateProfile({
      store_name: businessName,
      business_type: businessType,
      business_category: category || null,
      gst_number: gst || null,
      phone,
      purpose,
      referral_source: source,
      logo_url: logo_url || undefined,
      onboarding_completed: true,
    } as any);
    setLoading(false);
    if (error) return toast.error(error.message || 'Could not save');
    toast.success('You\'re all set!');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-white to-pink-50 dark:from-background dark:to-background flex flex-col">
      <div className="max-w-2xl w-full mx-auto p-4 md:p-8 flex-1 flex flex-col">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            {steps.map((s, i) => (
              <span key={s} className={cn(i === step && 'text-primary font-semibold', i < step && 'text-primary')}>
                {i < step && <Check className="inline w-3 h-3 mr-1" />}
                {s}
              </span>
            ))}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col"
          >
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold mb-1">Tell us about your business</h1>
                  <p className="text-muted-foreground text-sm">This helps us personalize Reachably for you.</p>
                </div>

                {/* Logo */}
                <div>
                  <Label className="mb-2 block">Business Logo (optional)</Label>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => onLogoPick(e.target.files?.[0] || null)} />
                  {logoPreview ? (
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden border">
                      <img src={logoPreview} className="w-full h-full object-cover" />
                      <button onClick={() => { setLogoFile(null); setLogoPreview(''); }} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <button onClick={() => logoRef.current?.click()} className="w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition">
                      <Upload className="w-5 h-5" /><span className="text-[10px]">Upload</span>
                    </button>
                  )}
                </div>

                <div>
                  <Label>Business name *</Label>
                  <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Acme Inc." />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Business type *</Label>
                    <Select value={businessType} onValueChange={setBusinessType}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{BUSINESS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Phone number *</Label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                  </div>
                  <div>
                    <Label>GST number (optional)</Label>
                    <Input value={gst} onChange={e => setGst(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">Email <span className="font-medium">{user?.email}</span> from your account.</p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold mb-1">What's your main goal?</h1>
                  <p className="text-muted-foreground text-sm">Pick the outcome you want most from Reachably.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {PURPOSES.map(p => {
                    const Icon = p.icon;
                    const active = purpose === p.id;
                    return (
                      <button key={p.id} onClick={() => setPurpose(p.id)}
                        className={cn(
                          'p-4 rounded-xl border-2 text-left transition-all',
                          active ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/50',
                        )}>
                        <Icon className={cn('w-6 h-6 mb-2', active ? 'text-primary' : 'text-muted-foreground')} />
                        <div className="font-semibold text-sm">{p.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold mb-1">Where did you find us?</h1>
                  <p className="text-muted-foreground text-sm">Helps us know what's working. One quick tap!</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {SOURCES.map(s => {
                    const Icon = s.icon;
                    const active = source === s.id;
                    return (
                      <button key={s.id} onClick={() => setSource(s.id)}
                        className={cn(
                          'p-4 rounded-xl border-2 text-left transition-all',
                          active ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/50',
                        )}>
                        <Icon className={cn('w-6 h-6 mb-2', active ? 'text-primary' : 'text-muted-foreground')} />
                        <div className="font-semibold text-sm">{s.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Nav */}
        <div className="flex items-center justify-between pt-6 mt-auto">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || loading}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Continue <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={!canNext() || loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</> : <>Finish setup <Check className="w-4 h-4 ml-1" /></>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;

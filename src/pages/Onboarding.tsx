import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowRight, ArrowLeft, Briefcase, Building2, Users,
  Globe, DollarSign, Check, Sparkles, Scissors,
  CalendarDays, BarChart3, Stethoscope, Dumbbell, Store,
  Upload, Type, ListPlus, FileText, X, Image as ImageIcon, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import logoAsset from '@/assets/foundif-logo.png.asset.json';

const BUSINESS_TYPES = [
  { id: 'salon', label: 'Salon & Spa', icon: Scissors, desc: 'Hair, beauty & wellness' },
  { id: 'clinic', label: 'Clinic', icon: Stethoscope, desc: 'Medical & dental practice' },
  { id: 'gym', label: 'Gym & Fitness', icon: Dumbbell, desc: 'Fitness center or studio' },
  { id: 'general', label: 'Other Business', icon: Store, desc: 'Retail, services & more' },
];

const ROLES = [
  { id: 'owner', label: 'Owner / Director', icon: Briefcase, desc: 'Full business control' },
  { id: 'manager', label: 'Manager', icon: Building2, desc: 'Day-to-day operations' },
  { id: 'staff', label: 'Front Desk / Staff', icon: Users, desc: 'Billing & bookings' },
];

const CURRENCIES = [
  { id: 'USD', symbol: '$', name: 'US Dollar' },
  { id: 'EUR', symbol: '€', name: 'Euro' },
  { id: 'GBP', symbol: '£', name: 'British Pound' },
  { id: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { id: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { id: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'India', 'Singapore', 'Netherlands', 'Other'
];

type IntakeMode = 'upload' | 'concept' | 'list';

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [role, setRole] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);

  // Branding + services intake
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [tagline, setTagline] = useState('');
  const [intakeMode, setIntakeMode] = useState<IntakeMode>('list');
  const [priceListFile, setPriceListFile] = useState<File | null>(null);
  const [concept, setConcept] = useState('');
  const [services, setServices] = useState<Array<{ name: string; price: string }>>([
    { name: '', price: '' },
  ]);
  const logoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { updateProfile, user } = useAuth();
  const navigate = useNavigate();

  const totalSteps = 6;
  const progress = ((step + 1) / totalSteps) * 100;
  const stepLabels = ['Welcome', 'Business Type', 'Your Role', 'Region', 'Services', 'Ready'];

  const onLogoPick = (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const uploadIfAny = async (file: File | null, folder: 'logos' | 'pricelists') => {
    if (!file || !user) return null;
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${folder}/${user.id}/${folder === 'logos' ? 'logo' : `pricelist-${Date.now()}`}.${ext}`;
    const { error } = await supabase.storage.from('salon-assets').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { console.error(error); return null; }
    const { data } = supabase.storage.from('salon-assets').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const logoUrl = await uploadIfAny(logoFile, 'logos');
      const priceListUrl = intakeMode === 'upload' ? await uploadIfAny(priceListFile, 'pricelists') : null;
      const conceptText =
        intakeMode === 'concept'
          ? concept
          : intakeMode === 'list'
          ? services.filter(s => s.name.trim()).map(s => `${s.name} — ${s.price || 'on request'}`).join('\n')
          : '';

      const { error } = await updateProfile({
        role,
        currency,
        country,
        store_name: businessName || `My ${BUSINESS_TYPES.find(b => b.id === businessType)?.label || 'Business'}`,
        business_type: businessType,
        tagline: tagline || null,
        logo_url: logoUrl,
        services_concept: conceptText || null,
        price_list_url: priceListUrl,
        onboarding_completed: true,
      });
      if (error) throw error;

      // Seed services into DB when user added them one-by-one
      if (intakeMode === 'list' && user) {
        const rows = services
          .filter(s => s.name.trim())
          .map(s => ({ user_id: user.id, name: s.name.trim(), price: Number(s.price) || 0, duration: 30, category: 'General' }));
        if (rows.length) {
          await supabase.from('services').insert(rows as any).then(({ error }) => error && console.warn(error));
        }
      }

      toast.success('Business setup complete!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return businessType !== '';
      case 2: return role !== '';
      case 3: return country !== '' && currency !== '';
      case 4:
        if (intakeMode === 'upload') return !!priceListFile;
        if (intakeMode === 'concept') return concept.trim().length > 10;
        return services.some(s => s.name.trim().length > 0);
      case 5: return true;
      default: return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-glow animate-pulse-ring">
              <img src={logoAsset.url} alt="Foundif" className="h-16 w-auto object-contain" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-4">Welcome to Foundif</h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto mb-6">
              Let's set up your business in under 3 minutes. We'll guide you step by step.
            </p>

            <div className="glass-card p-4 max-w-md mx-auto text-left space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Optional branding</Label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/40">
                  {logoPreview ? <img src={logoPreview} alt="logo" className="w-full h-full object-contain" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
                </div>
                <div className="flex-1">
                  <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
                    <Upload className="w-4 h-4" /> Upload logo
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-1">PNG/JPG, ≤ 2MB</p>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => onLogoPick(e.target.files?.[0] || null)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Tagline</Label>
                <Input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Premium hair studio" className="mt-1" />
              </div>
            </div>
          </motion.div>
        );

      case 1:
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <h2 className="text-2xl font-bold text-foreground mb-2">What type of business?</h2>
            <p className="text-muted-foreground mb-6">We'll customize the experience for you</p>
            <div className="grid gap-3">
              {BUSINESS_TYPES.map((b) => (
                <button key={b.id} onClick={() => setBusinessType(b.id)}
                  className={cn('flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left',
                    businessType === b.id ? 'border-foreground bg-foreground/5' : 'border-border hover:border-foreground/40 bg-card')}>
                  <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center',
                    businessType === b.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>
                    <b.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{b.label}</div>
                    <div className="text-sm text-muted-foreground">{b.desc}</div>
                  </div>
                  {businessType === b.id && <Check className="w-5 h-5 text-foreground ml-auto" />}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Label className="text-sm text-muted-foreground">Business Name</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                placeholder={`e.g. ${BUSINESS_TYPES.find(b => b.id === businessType)?.label || 'My Business'}`}
                className="mt-1.5" />
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <h2 className="text-2xl font-bold text-foreground mb-2">What's your role?</h2>
            <p className="text-muted-foreground mb-6">This sets your default permissions</p>
            <div className="grid gap-3">
              {ROLES.map((r) => (
                <button key={r.id} onClick={() => setRole(r.id)}
                  className={cn('flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left',
                    role === r.id ? 'border-foreground bg-foreground/5' : 'border-border hover:border-foreground/40 bg-card')}>
                  <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center',
                    role === r.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>
                    <r.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{r.label}</div>
                    <div className="text-sm text-muted-foreground">{r.desc}</div>
                  </div>
                  {role === r.id && <Check className="w-5 h-5 text-foreground ml-auto" />}
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <h2 className="text-2xl font-bold text-foreground mb-2">Location & Currency</h2>
            <p className="text-muted-foreground mb-6">Set your regional preferences</p>
            <div className="space-y-5">
              <div>
                <Label htmlFor="country" className="flex items-center gap-2 mb-2"><Globe className="w-4 h-4" />Country</Label>
                <select id="country" value={country} onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-card border border-border text-foreground focus:border-foreground focus:outline-none">
                  <option value="">Select your country</option>
                  {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div>
                <Label className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4" />Default Currency</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CURRENCIES.map((c) => (
                    <button key={c.id} onClick={() => setCurrency(c.id)}
                      className={cn('p-3 rounded-lg border-2 text-center transition-all',
                        currency === c.id ? 'border-foreground bg-foreground/5' : 'border-border hover:border-foreground/40 bg-card')}>
                      <div className="text-lg font-bold text-foreground">{c.symbol}</div>
                      <div className="text-xs text-muted-foreground">{c.id}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 4: {
        const modes: { id: IntakeMode; label: string; icon: any; desc: string }[] = [
          { id: 'list', label: 'Add services one by one', icon: ListPlus, desc: 'Quickest — name & price each' },
          { id: 'upload', label: 'Upload price list', icon: Upload, desc: 'PDF, Excel or image of your tariff' },
          { id: 'concept', label: 'Describe in your words', icon: Type, desc: "Free text — we'll structure later" },
        ];
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <h2 className="text-2xl font-bold text-foreground mb-2">Tell us about your services</h2>
            <p className="text-muted-foreground mb-6">Pick the easiest way for you — you can always edit later</p>

            <div className="grid sm:grid-cols-3 gap-2 mb-5">
              {modes.map(m => (
                <button key={m.id} onClick={() => setIntakeMode(m.id)}
                  className={cn('p-3 rounded-xl border-2 text-left transition-all',
                    intakeMode === m.id ? 'border-foreground bg-foreground/5' : 'border-border hover:border-foreground/40 bg-card')}>
                  <m.icon className="w-5 h-5 mb-1.5" />
                  <div className="font-semibold text-sm text-foreground">{m.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>

            {intakeMode === 'list' && (
              <div className="space-y-2">
                {services.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder={`Service ${i + 1} (e.g. Haircut)`} value={s.name}
                      onChange={e => setServices(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                      className="flex-1" />
                    <Input placeholder="Price" type="number" inputMode="numeric" value={s.price}
                      onChange={e => setServices(prev => prev.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))}
                      className="w-28" />
                    {services.length > 1 && (
                      <button onClick={() => setServices(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setServices(prev => [...prev, { name: '', price: '' }])}>
                  <ListPlus className="w-4 h-4" /> Add another
                </Button>
              </div>
            )}

            {intakeMode === 'upload' && (
              <div className="glass-card p-5 text-center">
                <input ref={fileRef} type="file" accept="image/*,.pdf,.xlsx,.xls,.csv" className="hidden"
                  onChange={e => setPriceListFile(e.target.files?.[0] || null)} />
                <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  {priceListFile ? <><b className="text-foreground">{priceListFile.name}</b> · {(priceListFile.size / 1024).toFixed(0)} KB</> : 'PDF, Excel, CSV or image of your price list'}
                </p>
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4" /> {priceListFile ? 'Choose a different file' : 'Choose file'}
                </Button>
              </div>
            )}

            {intakeMode === 'concept' && (
              <div>
                <Label className="text-sm">Describe your services & pricing</Label>
                <Textarea rows={6} value={concept} onChange={e => setConcept(e.target.value)} className="mt-1.5"
                  placeholder="e.g. We offer haircuts starting from ₹300, hair colouring from ₹1500, facials from ₹800. Bridal packages are bespoke and quoted on request…" />
                <p className="text-[10px] text-muted-foreground mt-1">Minimum 10 characters</p>
              </div>
            )}
          </motion.div>
        );
      }

      case 5:
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">You're All Set!</h2>
            <p className="text-muted-foreground mb-8">Here's what you can do with Foundif</p>
            <div className="glass-card p-6 text-left space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-foreground mt-0.5" />
                <div>
                  <div className="font-medium text-foreground">WhatsApp Inbox & AI Agents</div>
                  <div className="text-sm text-muted-foreground">Reply to customers and let AI handle routine questions.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Scissors className="w-5 h-5 text-foreground mt-0.5" />
                <div>
                  <div className="font-medium text-foreground">Services, Billing & Inventory</div>
                  <div className="text-sm text-muted-foreground">Manage your tariff, take payments and track stock.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays className="w-5 h-5 text-foreground mt-0.5" />
                <div>
                  <div className="font-medium text-foreground">Appointments & Reminders</div>
                  <div className="text-sm text-muted-foreground">Auto reminders for bookings, follow-ups & dormant customers.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-foreground mt-0.5" />
                <div>
                  <div className="font-medium text-foreground">Campaigns & Analytics</div>
                  <div className="text-sm text-muted-foreground">Broadcast flows with delivery, reply and conversion metrics.</div>
                </div>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <motion.div className="h-full bg-foreground" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
      </div>

      <div className="flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-2">
          <img src={logoAsset.url} alt="Foundif" className="h-7 w-auto object-contain" />
        </div>
        <div className="text-sm text-muted-foreground">{stepLabels[step]} · {step + 1}/{totalSteps}</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
        </div>
      </div>

      <div className="p-4 md:p-6 border-t border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
          ) : (<div />)}
          {step < totalSteps - 1 ? (
            <Button variant="trust" onClick={() => setStep(step + 1)} disabled={!canProceed()}>Continue<ArrowRight className="w-4 h-4 ml-2" /></Button>
          ) : (
            <Button variant="trust" onClick={handleComplete} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Launch Dashboard<ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;

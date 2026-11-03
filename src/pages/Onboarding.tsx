import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Sparkles, ArrowRight, ArrowLeft, Loader2, CheckCircle2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const COUNTRIES = ['India', 'United States', 'United Arab Emirates', 'United Kingdom', 'Singapore', 'Australia', 'Canada', 'Other'];
const ORG_SIZES = ['1-10', '11-50', '51-100', '101-500', '500+'];
const ROLES = ['Founder / Owner', 'Marketing', 'Sales', 'Customer Support', 'Operations', 'Other'];
const INDUSTRIES = ['E-commerce / Retail', 'Travel & Tourism', 'Education', 'Healthcare / Clinic', 'Real Estate', 'Services & Salon', 'Other'];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('India');
  const [city, setCity] = useState('');
  const [orgSize, setOrgSize] = useState('1-10');
  const [jobRole, setJobRole] = useState('Founder / Owner');
  const [industry, setIndustry] = useState('E-commerce / Retail');

  useEffect(() => {
    if (profile) {
      if ((profile as any).onboarding_completed) {
        navigate('/', { replace: true });
        return;
      }
      setBusinessName((profile as any).store_name || '');
    }
  }, [profile, navigate]);

  const handleFinish = async () => {
    if (!businessName.trim()) {
      toast.error('Please enter your business or store name');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      // 1. Create or update workspace
      const { data: existing } = await supabase
        .from('workspaces' as any)
        .select('id')
        .eq('owner_id', user.id)
        .order('created_at')
        .limit(1)
        .maybeSingle();

      let wsId = (existing as any)?.id as string | undefined;
      if (wsId) {
        await supabase.from('workspaces' as any).update({ name: businessName.trim() }).eq('id', wsId);
      } else {
        const { data: created, error } = await supabase
          .from('workspaces' as any)
          .insert({ name: businessName.trim(), owner_id: user.id })
          .select('id')
          .maybeSingle();
        if (error) throw error;
        wsId = (created as any)?.id;
        if (wsId) {
          await supabase.from('workspace_members' as any)
            .upsert({ workspace_id: wsId, user_id: user.id, role: 'owner' }, { onConflict: 'workspace_id,user_id' });
        }
      }

      // 2. Start 7-day trial and mark onboarding complete
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 86_400_000);

      const { error: pErr } = await updateProfile({
        store_name: businessName.trim(),
        website: website.trim(),
        country,
        address: city.trim(),
        org_size: orgSize,
        job_role: jobRole,
        industry,
        active_workspace_id: wsId,
        onboarding_completed: true,
        trial_start_date: now.toISOString(),
        trial_end_date: trialEnd.toISOString(),
      } as any);

      if (pErr) throw pErr;
      await refreshProfile();
      toast.success('Your workspace is ready! 7-day trial activated.');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Could not complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand header */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center shadow-lg shadow-primary/20">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Reachably</h1>
          <p className="text-xs text-muted-foreground">WhatsApp CRM & Automation</p>
        </div>
      </div>

      {/* Card container */}
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 sm:p-8 shadow-xl relative z-10">
        {/* Progress steps */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b">
          <div className="flex items-center gap-2">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              1
            </span>
            <span className="text-sm font-medium">Business</span>
          </div>
          <div className="h-0.5 flex-1 mx-4 bg-muted overflow-hidden">
            <div className={`h-full bg-primary transition-all duration-300 ${step === 1 ? 'w-1/2' : 'w-full'}`} />
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              2
            </span>
            <span className="text-sm font-medium">Preferences</span>
          </div>
        </div>

        {/* Step 1: Business info */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Tell us about your business</h2>
              <p className="text-sm text-muted-foreground mt-0.5">We will set up your dedicated workspace with these details.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="bizName">Business or Store Name <span className="text-destructive">*</span></Label>
                <Input
                  id="bizName"
                  placeholder="e.g. House of Aiyshwaryam or JerseysHub"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="website">Website or Instagram handle (optional)</Label>
                <Input
                  id="website"
                  placeholder="e.g. https://mybrand.com or @mybrand"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="city">City / State</Label>
                  <Input
                    id="city"
                    placeholder="e.g. Chennai, Tamil Nadu"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Button
              className="w-full mt-4"
              onClick={() => {
                if (!businessName.trim()) {
                  toast.error('Please enter your business name');
                  return;
                }
                setStep(2);
              }}
            >
              Next step <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Role & Industry */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Customize your Reachably setup</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Helps tailor templates and automations for your industry.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Your Role</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Industry</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Team Size</Label>
                <div className="grid grid-cols-5 gap-2">
                  {ORG_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setOrgSize(size)}
                      className={`h-9 text-xs rounded-md border font-medium transition-all ${
                        orgSize === size ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-foreground'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
              </Button>
              <Button className="flex-1" onClick={handleFinish} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Launching workspace...
                  </>
                ) : (
                  <>
                    Complete & Start Free Trial <Sparkles className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-6 text-center">
        7-day free trial includes unlimited WhatsApp broadcast campaigns, AI chatbots, and Team Inbox.
      </p>
    </div>
  );
}

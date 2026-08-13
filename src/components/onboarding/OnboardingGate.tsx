import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, LogOut, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const COUNTRIES = ['India', 'United States', 'United Arab Emirates', 'United Kingdom', 'Singapore', 'Australia', 'Canada', 'Other'];
const INDIAN_STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];
const ORG_SIZES = ['1-10', '11-50', '51-100', '101-500', '500+'];
const SOURCES = ['Facebook', 'Instagram', 'LinkedIn', 'Google', 'Recommended by a friend', 'Other'];
const ROLES = ['Founder', 'Marketer', 'Sales', 'Customer Support', 'Engineer', 'Other'];
const INDUSTRIES = ['Ecommerce', 'Education', 'Healthcare', 'Finance', 'Travel', 'Real Estate', 'Other'];

const Chip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick}
    className={cn('px-3 py-1.5 rounded-md border text-xs font-medium transition-colors',
      active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40 text-foreground')}>
    {label}
  </button>
);

const Req = () => <span className="text-destructive"> *</span>;

/**
 * Blocking onboarding modal shown right after login until the profile is complete.
 * Three steps: business details → about you → workspace creation.
 */
const OnboardingGate = () => {
  const { user, profile, updateProfile, refreshProfile, signOut } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('');
  const [orgSize, setOrgSize] = useState('');
  const [source, setSource] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [sells, setSells] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');

  useEffect(() => {
    const p = profile as any;
    if (!p) return;
    setBusinessName(v => v || p.store_name || '');
    setWorkspaceName(v => v || p.store_name || '');
  }, [profile]);

  if (!user || !profile) return null;
  if ((profile as any).onboarding_completed) return null;
  if ((profile as any).is_staff) return null;

  const step1Ok = businessName.trim() && website.trim() && country && state.trim() && orgSize && source;
  const step2Ok = jobRole && industry && sells;

  const finish = async () => {
    if (!workspaceName.trim()) return;
    setSaving(true);
    try {
      // Reuse an existing workspace when the signup trigger already created one.
      const { data: existing } = await supabase
        .from('workspaces' as any).select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();

      let wsId = (existing as any)?.id as string | undefined;
      if (wsId) {
        await supabase.from('workspaces' as any).update({ name: workspaceName.trim() }).eq('id', wsId);
      } else {
        const { data: created, error } = await supabase
          .from('workspaces' as any).insert({ name: workspaceName.trim(), owner_id: user.id }).select('id').maybeSingle();
        if (error) throw error;
        wsId = (created as any)?.id;
        if (wsId) {
          await supabase.from('workspace_members' as any)
            .upsert({ workspace_id: wsId, user_id: user.id, role: 'owner' }, { onConflict: 'workspace_id,user_id' });
        }
      }

      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 86_400_000);
      const { error: pErr } = await updateProfile({
        store_name: businessName.trim(),
        website: website.trim(),
        country,
        state: state.trim(),
        org_size: orgSize,
        referral_source: source,
        job_role: jobRole,
        industry,
        sells,
        active_workspace_id: wsId,
        onboarding_completed: true,
        ...((profile as any).trial_end_date ? {} : {
          trial_start_date: now.toISOString(),
          trial_end_date: trialEnd.toISOString(),
        }),
      } as any);
      if (pErr) throw pErr;
      await refreshProfile();
      toast.success('Workspace created — your 7-day free trial has started');
    } catch (e: any) {
      toast.error(e.message || 'Could not complete setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-foreground/40 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            {step === 0 && 'Tell us about your business'}
            {step === 1 && <>A little more about you <Sparkles className="w-4 h-4 text-primary" /></>}
            {step === 2 && 'Create your Workspace'}
          </h2>
          <button onClick={signOut} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 shrink-0">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Business Name<Req /></Label>
                <Input className="mt-1" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Enter your business name" />
              </div>
              <div>
                <Label className="text-xs">Website<Req /></Label>
                <Input className="mt-1" value={website} onChange={e => setWebsite(e.target.value)} placeholder="Enter your website" />
              </div>
              <div>
                <Label className="text-xs">Country<Req /></Label>
                <Select value={country} onValueChange={v => { setCountry(v); setState(''); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select your country" /></SelectTrigger>
                  <SelectContent position="popper" className="z-[300]">{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">State<Req /></Label>
                {country === 'India' ? (
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select your state" /></SelectTrigger>
                    <SelectContent position="popper" className="z-[300]">{INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input className="mt-1" value={state} onChange={e => setState(e.target.value)} placeholder="Enter your state" />
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs">How many people are there in your organization?<Req /></Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ORG_SIZES.map(o => <Chip key={o} label={o} active={orgSize === o} onClick={() => setOrgSize(o)} />)}
              </div>
            </div>

            <div>
              <Label className="text-xs">How did you hear about us?<Req /></Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SOURCES.map(s => <Chip key={s} label={s} active={source === s} onClick={() => setSource(s)} />)}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button size="sm" disabled={!step1Ok} onClick={() => setStep(1)}>Next</Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Role<Req /></Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ROLES.map(r => <Chip key={r} label={r} active={jobRole === r} onClick={() => setJobRole(r)} />)}
              </div>
            </div>
            <div>
              <Label className="text-xs">Industry<Req /></Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {INDUSTRIES.map(i => <Chip key={i} label={i} active={industry === i} onClick={() => setIndustry(i)} />)}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 items-end">
              <div>
                <Label className="text-xs">Selling products or services<Req /></Label>
                <Select value={sells} onValueChange={setSells}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent position="popper" className="z-[300]">
                    <SelectItem value="Products">Products</SelectItem>
                    <SelectItem value="Services">Services</SelectItem>
                    <SelectItem value="Both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setStep(0)}>Previous</Button>
                <Button size="sm" disabled={!step2Ok} onClick={() => setStep(2)}>Next</Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Label className="text-xs flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Workspace Name</Label>
            <Input value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="Enter your workspace name" />
            <Button className="w-full" disabled={!workspaceName.trim() || saving} onClick={finish}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Workspace'}
            </Button>
            <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:text-foreground">Previous</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingGate;

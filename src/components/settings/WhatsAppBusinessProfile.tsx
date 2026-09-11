import { ChangeEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Building2, Camera, Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

type BusinessProfile = {
  about: string;
  address: string;
  description: string;
  email: string;
  vertical: string;
  websites: string[];
  profile_picture_url: string;
};

const EMPTY_PROFILE: BusinessProfile = {
  about: '', address: '', description: '', email: '', vertical: 'OTHER', websites: [''], profile_picture_url: '',
};

const VERTICALS = [
  ['OTHER', 'Other'], ['AUTO', 'Automotive'], ['BEAUTY', 'Beauty, spa and salon'], ['APPAREL', 'Clothing and apparel'],
  ['EDU', 'Education'], ['ENTERTAIN', 'Entertainment'], ['EVENT_PLAN', 'Event planning'], ['FINANCE', 'Finance'],
  ['GROCERY', 'Grocery'], ['GOVT', 'Government'], ['HOTEL', 'Hotel'], ['HEALTH', 'Health and medical'],
  ['NONPROFIT', 'Non-profit'], ['PROF_SERVICES', 'Professional services'], ['RETAIL', 'Shopping and retail'],
  ['TRAVEL', 'Travel'], ['RESTAURANT', 'Restaurant'], ['NOT_A_BIZ', 'Not a business'],
];

interface Props {
  workspaceId: string;
  credentialId?: string;
  connected: boolean;
  fallbackName: string;
  cachedProfile?: Partial<BusinessProfile>;
}

const WhatsAppBusinessProfile = ({ workspaceId, credentialId, connected, fallbackName, cachedProfile }: Props) => {
  const [profile, setProfile] = useState<BusinessProfile>({ ...EMPTY_PROFILE, ...cachedProfile });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!connected) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('whatsapp-profile', { body: { action: 'get', workspace_id: workspaceId, credential_id: credentialId } });
    setLoading(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message || 'Could not load business profile');
    const remote = (data as any)?.profile || {};
    setProfile({ ...EMPTY_PROFILE, ...remote, websites: remote.websites?.length ? remote.websites.slice(0, 2) : [''] });
  };

  useEffect(() => { load(); }, [workspaceId, credentialId, connected]);

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('whatsapp-profile', {
      body: { action: 'update', workspace_id: workspaceId, credential_id: credentialId, profile },
    });
    setSaving(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message || 'Could not update business profile');
    toast.success('WhatsApp business profile updated');
  };

  const uploadPicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return toast.error('Choose a JPG or PNG image');
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5 MB');
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const { data, error } = await supabase.functions.invoke('whatsapp-profile', {
        body: { action: 'upload_picture', workspace_id: workspaceId, credential_id: credentialId, file_base64: reader.result, file_type: file.type },
      });
      setUploading(false);
      if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message || 'Could not update profile picture');
      const remote = (data as any)?.profile || {};
      setProfile((current) => ({ ...current, ...remote, websites: remote.websites || current.websites }));
      toast.success('WhatsApp display picture updated');
    };
    reader.onerror = () => { setUploading(false); toast.error('Could not read this image'); };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const setWebsite = (index: number, value: string) => setProfile((current) => ({
    ...current, websites: current.websites.map((website, websiteIndex) => websiteIndex === index ? value : website),
  }));

  if (!connected) {
    return (
      <Card className="p-5 border-dashed">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2"><Building2 className="h-5 w-5" /></div>
          <div><p className="font-semibold">WhatsApp business profile</p><p className="text-sm text-muted-foreground">Connect a WhatsApp channel to edit the profile customers see.</p></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-4">
        <div>
          <h2 className="font-semibold">Business profile</h2>
          <p className="text-xs text-muted-foreground">Information visible to customers on WhatsApp.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Sync from Meta
        </Button>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-3 lg:border-r lg:pr-6">
          <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-full border bg-muted">
            {profile.profile_picture_url ? <img src={profile.profile_picture_url} alt={`${fallbackName} WhatsApp profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-muted-foreground">{fallbackName.slice(0, 1).toUpperCase()}</div>}
            {uploading && <div className="absolute inset-0 flex items-center justify-center bg-background/80"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={uploadPicture} />
          <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Camera className="h-4 w-4" /> Change picture
          </Button>
          <p className="text-center text-xs text-muted-foreground">JPG or PNG · square image recommended</p>
        </div>

        <div className="space-y-5">
          <Field label="About" hint={`${profile.about.length}/139 characters`}>
            <Input maxLength={139} value={profile.about} onChange={(event) => setProfile({ ...profile, about: event.target.value })} placeholder="A short status shown below your business name" />
          </Field>
          <Field label="Business description" hint={`${profile.description.length}/512 characters`}>
            <Textarea maxLength={512} rows={4} value={profile.description} onChange={(event) => setProfile({ ...profile, description: event.target.value })} placeholder="Tell customers what your business offers" />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Business email" hint="Customer contact email">
              <Input type="email" maxLength={128} value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} placeholder="hello@business.com" />
            </Field>
            <Field label="Business category" hint="Choose the closest match">
              <Select value={profile.vertical || 'OTHER'} onValueChange={(vertical) => setProfile({ ...profile, vertical })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VERTICALS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Address" hint={`${profile.address.length}/256 characters`}>
            <Textarea maxLength={256} rows={2} value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} placeholder="Business address" />
          </Field>
          <Field label="Website URLs" hint="Add up to two customer-facing links">
            <div className="space-y-2">
              {profile.websites.map((website, index) => (
                <div key={index} className="flex gap-2">
                  <Input type="url" value={website} onChange={(event) => setWebsite(index, event.target.value)} placeholder="https://yourbusiness.com" />
                  {profile.websites.length > 1 && <Button type="button" variant="outline" size="icon" aria-label="Remove website" onClick={() => setProfile({ ...profile, websites: profile.websites.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              {profile.websites.length < 2 && <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => setProfile({ ...profile, websites: [...profile.websites, ''] })}><Plus className="h-4 w-4" /> Add another website</Button>}
            </div>
          </Field>
          <div className="flex justify-end border-t pt-4">
            <Button onClick={save} disabled={saving || uploading} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? 'Applying…' : 'Apply changes'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

const Field = ({ label, hint, children }: { label: string; hint: string; children: ReactNode }) => (
  <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:gap-5">
    <div><Label>{label}</Label><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div>
    <div>{children}</div>
  </div>
);

export default WhatsAppBusinessProfile;
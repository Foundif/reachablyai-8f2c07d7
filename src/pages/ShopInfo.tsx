import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Save, Loader2, Upload, Image as ImageIcon, FileText } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD'];
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Singapore', 'Netherlands', 'Other'];

const ShopInfo = () => {
  const { user, profile, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'pricelist' | null>(null);

  const [storeName, setStoreName] = useState(profile?.store_name || '');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email] = useState(profile?.email || '');
  const [phone, setPhone] = useState((profile as any)?.phone || '');
  const [address, setAddress] = useState((profile as any)?.address || '');
  const [tagline, setTagline] = useState((profile as any)?.tagline || '');
  const [concept, setConcept] = useState((profile as any)?.services_concept || '');
  const [country, setCountry] = useState(profile?.country || 'India');
  const [currency, setCurrency] = useState(profile?.currency || 'INR');
  const [logoUrl, setLogoUrl] = useState((profile as any)?.logo_url || '');
  const [priceListUrl, setPriceListUrl] = useState((profile as any)?.price_list_url || '');

  const logoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File, folder: 'logos' | 'pricelists') => {
    if (!user) return null;
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${folder}/${user.id}/${folder === 'logos' ? 'logo' : `pricelist-${Date.now()}`}.${ext}`;
    const { error } = await supabase.storage.from('salon-assets').upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return supabase.storage.from('salon-assets').getPublicUrl(path).data.publicUrl;
  };

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return; }
    setUploading('logo');
    try {
      const url = await upload(f, 'logos');
      if (url) { setLogoUrl(url); await updateProfile({ logo_url: url } as any); toast.success('Logo updated!'); }
    } catch (err: any) { toast.error(err.message || 'Upload failed'); }
    finally { setUploading(null); }
  };

  const handlePriceList = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('Price list must be under 5MB'); return; }
    setUploading('pricelist');
    try {
      const url = await upload(f, 'pricelists');
      if (url) { setPriceListUrl(url); await updateProfile({ price_list_url: url } as any); toast.success('Price list uploaded!'); }
    } catch (err: any) { toast.error(err.message || 'Upload failed'); }
    finally { setUploading(null); }
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateProfile({
      store_name: storeName, full_name: fullName, country, currency,
      phone, address, tagline, services_concept: concept,
    } as any);
    if (error) toast.error(error.message); else toast.success('Business profile saved!');
    setSaving(false);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3 mb-1">
          <Building2 className="w-8 h-8 text-foreground" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Business Profile</h1>
            <p className="text-muted-foreground">Your branding, contact details and services</p>
          </div>
        </div>

        <div className="glass-card p-6 space-y-5 max-w-2xl">
          {/* Logo */}
          <div>
            <Label>Business Logo</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/40">
                {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="w-8 h-8 text-muted-foreground" />}
              </div>
              <div>
                <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={uploading === 'logo'}>
                  {uploading === 'logo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading === 'logo' ? 'Uploading…' : 'Upload Logo'}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">Max 2MB · PNG, JPG, SVG</p>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Business Name</Label>
              <Input value={storeName} onChange={e => setStoreName(e.target.value)} className="mt-1.5" placeholder="My Business" />
            </div>
            <div>
              <Label>Tagline</Label>
              <Input value={tagline} onChange={e => setTagline(e.target.value)} className="mt-1.5" placeholder="Premium hair studio" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Owner / Manager</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1.5" placeholder="John Doe" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={email} disabled className="mt-1.5 bg-muted" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1.5" placeholder="+91 98765 43210" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} className="mt-1.5" placeholder="Street, City" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Services & Tariff (concept)</Label>
            <Textarea rows={5} value={concept} onChange={e => setConcept(e.target.value)} className="mt-1.5"
              placeholder="Describe what you offer and pricing — used by AI agents when answering customers." />
          </div>

          <div>
            <Label>Price List (file)</Label>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {priceListUrl ? (
                  <a href={priceListUrl} target="_blank" rel="noreferrer" className="text-sm text-foreground underline truncate inline-flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> View current file
                  </a>
                ) : (<p className="text-sm text-muted-foreground">No file uploaded</p>)}
              </div>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading === 'pricelist'}>
                {uploading === 'pricelist' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {priceListUrl ? 'Replace' : 'Upload'}
              </Button>
              <input ref={fileRef} type="file" accept="image/*,.pdf,.xlsx,.xls,.csv" className="hidden" onChange={handlePriceList} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">PDF, Excel, CSV or image · max 5MB</p>
          </div>

          <Button variant="trust" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ShopInfo;

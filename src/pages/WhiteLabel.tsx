import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Building2, Save, Globe } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE = 'foundif_whitelabel';

const WhiteLabel = () => {
  const [s, setS] = useState({ brand: 'My Agency', domain: 'app.myagency.com', primary: '#111111', hideBadge: false, supportEmail: 'support@myagency.com' });
  useEffect(() => { const raw = localStorage.getItem(STORAGE); if (raw) setS(JSON.parse(raw)); }, []);
  const save = () => { localStorage.setItem(STORAGE, JSON.stringify(s)); toast.success('White-label settings saved'); };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> White Label
          </h1>
          <p className="text-sm text-muted-foreground">Run Foundif under your own brand and domain.</p>
        </div>

        <div className="glass-elevated p-5 space-y-4">
          <div><Label>Brand name</Label><Input value={s.brand} onChange={(e) => setS({ ...s, brand: e.target.value })} /></div>
          <div>
            <Label className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Custom domain</Label>
            <Input value={s.domain} onChange={(e) => setS({ ...s, domain: e.target.value })} placeholder="app.yourbrand.com" />
            <p className="text-[11px] text-muted-foreground mt-1">Add a CNAME record pointing to <code className="bg-muted px-1 rounded">cname.foundif.app</code></p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Primary color</Label><Input type="color" value={s.primary} onChange={(e) => setS({ ...s, primary: e.target.value })} className="h-10" /></div>
            <div><Label>Support email</Label><Input type="email" value={s.supportEmail} onChange={(e) => setS({ ...s, supportEmail: e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div>
              <p className="font-semibold text-sm">Hide "Powered by Foundif"</p>
              <p className="text-xs text-muted-foreground">Requires Agency plan</p>
            </div>
            <Switch checked={s.hideBadge} onCheckedChange={(v) => setS({ ...s, hideBadge: v })} />
          </div>
          <Button onClick={save} className="w-full"><Save className="w-4 h-4" /> Save</Button>
        </div>
      </div>
    </AppLayout>
  );
};
export default WhiteLabel;

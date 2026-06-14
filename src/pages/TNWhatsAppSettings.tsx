import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

const TNWhatsAppSettings = () => {
  const { user } = useAuth();
  const [s, setS] = useState<any>({
    upi_id: '', payee_name: '', qr_image_url: '', advance_amount: 50,
    meta_phone_number_id: '', meta_waba_id: '', verify_token_hint: '',
  });

  useEffect(() => { (async () => {
    if (!user) return;
    const { data } = await supabase.from('tn_settings').select('*').eq('user_id', user.id).maybeSingle();
    if (data) setS(data);
  })(); }, [user]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from('tn_settings').upsert({ ...s, user_id: user.id }, { onConflict: 'user_id' });
    if (error) toast.error(error.message); else toast.success('Settings saved');
  };

  const uploadQR = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/qr-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('tn-qr-codes').upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from('tn-qr-codes').getPublicUrl(path);
    setS({ ...s, qr_image_url: data.publicUrl });
    toast.success('QR uploaded — click Save');
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-3xl">
        <h1 className="text-2xl md:text-3xl font-bold">WhatsApp Settings</h1>

        <Card className="p-5 bg-orange-500/10 border-orange-500/30">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <p className="font-semibold">Meta Webhook URL</p>
              <code className="block text-xs bg-background p-2 rounded break-all">{WEBHOOK_URL}</code>
              <p className="text-muted-foreground">Paste this in Meta → WhatsApp → Configuration → Webhook. Use your Verify Token below.</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Meta WhatsApp Cloud API</h2>
          <div>
            <Label>Phone Number ID</Label>
            <Input value={s.meta_phone_number_id || ''} onChange={e => setS({ ...s, meta_phone_number_id: e.target.value })} placeholder="e.g. 109876543210987" />
          </div>
          <div>
            <Label>WhatsApp Business Account ID (WABA)</Label>
            <Input value={s.meta_waba_id || ''} onChange={e => setS({ ...s, meta_waba_id: e.target.value })} />
          </div>
          <div>
            <Label>Verify Token (must match Meta dashboard)</Label>
            <Input value={s.verify_token_hint || ''} onChange={e => setS({ ...s, verify_token_hint: e.target.value })} placeholder="Pick any string and paste in both places" />
          </div>
          <p className="text-xs text-muted-foreground">
            🔒 <b>Access Token</b> and <b>App Secret</b> are sensitive — add them as project secrets named
            <code className="bg-muted px-1 mx-1 rounded">META_ACCESS_TOKEN</code>,
            <code className="bg-muted px-1 mx-1 rounded">META_APP_SECRET</code>, and
            <code className="bg-muted px-1 mx-1 rounded">META_VERIFY_TOKEN</code> via Lovable Cloud → Secrets. The Verify Token above is just a hint label.
          </p>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">UPI Payment</h2>
          <div>
            <Label>UPI ID</Label>
            <Input value={s.upi_id || ''} onChange={e => setS({ ...s, upi_id: e.target.value })} placeholder="yourname@okhdfcbank" />
          </div>
          <div>
            <Label>Payee Name</Label>
            <Input value={s.payee_name || ''} onChange={e => setS({ ...s, payee_name: e.target.value })} placeholder="TN45 Travel Aid" />
          </div>
          <div>
            <Label>Advance Amount (₹)</Label>
            <Input type="number" value={s.advance_amount || 50} onChange={e => setS({ ...s, advance_amount: Number(e.target.value) })} />
          </div>
          <div>
            <Label>UPI QR Image</Label>
            <Input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadQR(e.target.files[0])} />
            {s.qr_image_url && <img src={s.qr_image_url} alt="QR" className="w-32 h-32 mt-2 rounded border" />}
          </div>
        </Card>

        <Button onClick={save} className="w-full md:w-auto">Save Settings</Button>
      </div>
    </AppLayout>
  );
};
export default TNWhatsAppSettings;

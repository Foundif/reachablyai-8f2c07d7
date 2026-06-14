import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Copy, ExternalLink, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { TN45_FLOW_JSON } from '@/lib/tn45FlowJson';

const TNFlow = () => {
  const { user } = useAuth();
  const [s, setS] = useState<any>({
    meta_flow_id: '', meta_flow_cta: 'Book Now',
    flow_header: '🚖 TN45 Travel Aid',
    flow_body: 'வணக்கம்! Tap below to book your travel assistance.',
    flow_footer: 'Powered by TN45',
  });
  const [testNumber, setTestNumber] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { (async () => {
    if (!user) return;
    const { data } = await supabase.from('tn_settings').select('*').eq('user_id', user.id).maybeSingle();
    if (data) setS((p: any) => ({ ...p, ...data }));
  })(); }, [user]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from('tn_settings').upsert({ ...s, user_id: user.id }, { onConflict: 'user_id' });
    if (error) toast.error(error.message); else toast.success('Flow settings saved');
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(TN45_FLOW_JSON, null, 2));
    toast.success('Flow JSON copied to clipboard');
  };

  const sendTest = async () => {
    if (!testNumber) return toast.error('Enter a WhatsApp number');
    if (!s.meta_flow_id) return toast.error('Save your Flow ID first');
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          to: testNumber.replace(/\D/g, ''),
          flow: true,
          flow_id: s.meta_flow_id,
          flow_cta: s.meta_flow_cta,
          header: s.flow_header,
          body: s.flow_body,
          footer: s.flow_footer,
          starting_screen: 'SERVICE_MENU',
        },
      });
      if (error) throw error;
      toast.success('Flow message sent — check WhatsApp');
    } catch (e: any) {
      toast.error(e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const ready = !!s.meta_flow_id && !!s.meta_phone_number_id;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-5 max-w-4xl">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">WhatsApp Booking Flow</h1>
          <p className="text-muted-foreground text-sm mt-1">Real native WhatsApp Flow — customers fill the form inside WhatsApp, you receive the booking instantly.</p>
        </div>

        <Card className={`p-4 flex items-start gap-3 ${ready ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
          {ready ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />}
          <div className="text-sm">
            <p className="font-semibold">{ready ? 'Flow is live' : 'Flow setup pending'}</p>
            <p className="text-muted-foreground">{ready ? 'When customers message "hi" to your WhatsApp number, the booking flow opens automatically.' : 'Complete the 3 steps below to activate the flow.'}</p>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">1</div>
            <div className="flex-1">
              <h2 className="font-semibold">Copy the Flow JSON</h2>
              <p className="text-xs text-muted-foreground mb-2">This is the exact 5-screen booking form your customers will see.</p>
              <Button size="sm" onClick={copyJson}><Copy className="w-4 h-4 mr-2" />Copy Flow JSON</Button>
              <details className="mt-3">
                <summary className="text-xs cursor-pointer text-muted-foreground">Preview JSON</summary>
                <pre className="text-[10px] bg-muted/50 p-3 rounded mt-2 max-h-64 overflow-auto">{JSON.stringify(TN45_FLOW_JSON, null, 2)}</pre>
              </details>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">2</div>
            <div className="flex-1">
              <h2 className="font-semibold">Publish in Meta Flow Manager</h2>
              <ol className="text-sm text-muted-foreground space-y-1 mt-2 list-decimal list-inside">
                <li>Open Meta Business → WhatsApp Manager → <b>Flows</b></li>
                <li>Click <b>Create Flow</b> → name it "TN45 Booking" → Categories: <b>OTHER</b></li>
                <li>Choose <b>Endpoint: None</b> (no data exchange — all client-side)</li>
                <li>Switch to <b>JSON</b> tab → paste the copied JSON → <b>Save Draft</b></li>
                <li>Click <b>Publish</b> → copy the <b>Flow ID</b> shown</li>
              </ol>
              <a href="https://business.facebook.com/wa/manage/flows" target="_blank" rel="noopener noreferrer"
                 className="text-primary text-sm inline-flex items-center gap-1 mt-2">
                Open Meta Flow Manager <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">3</div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="font-semibold">Paste the Flow ID</h2>
                <p className="text-xs text-muted-foreground">Once you paste & save here, the flow is live for incoming "hi" messages.</p>
              </div>
              <div>
                <Label>Flow ID</Label>
                <Input value={s.meta_flow_id || ''} onChange={e => setS({ ...s, meta_flow_id: e.target.value })} placeholder="e.g. 1234567890123456" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>CTA Button</Label>
                  <Input value={s.meta_flow_cta || ''} onChange={e => setS({ ...s, meta_flow_cta: e.target.value })} placeholder="Book Now" />
                </div>
                <div>
                  <Label>Header</Label>
                  <Input value={s.flow_header || ''} onChange={e => setS({ ...s, flow_header: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Body Message</Label>
                <Textarea rows={2} value={s.flow_body || ''} onChange={e => setS({ ...s, flow_body: e.target.value })} />
              </div>
              <div>
                <Label>Footer</Label>
                <Input value={s.flow_footer || ''} onChange={e => setS({ ...s, flow_footer: e.target.value })} />
              </div>
              <Button onClick={save}>Save Flow Settings</Button>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Send className="w-4 h-4" />Send a test flow</h2>
          <p className="text-xs text-muted-foreground">Send the live flow to any WhatsApp number to test the full booking experience.</p>
          <div className="flex gap-2">
            <Input value={testNumber} onChange={e => setTestNumber(e.target.value)} placeholder="91XXXXXXXXXX (with country code)" />
            <Button onClick={sendTest} disabled={sending || !ready}>{sending ? 'Sending…' : 'Send Test'}</Button>
          </div>
        </Card>

        <Card className="p-5 bg-muted/40">
          <h3 className="font-semibold mb-2">How customers experience this</h3>
          <ol className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
            <li>Customer messages <b>"hi"</b> to your WhatsApp Business number.</li>
            <li>They instantly receive the Flow card with your CTA button.</li>
            <li>They tap → 5 screens open natively inside WhatsApp (Service → Details → Review → Payment → Confirmed).</li>
            <li>On submit, a new booking appears in <b>/bookings</b>, a payment record in <b>/payments</b>, and an automatic UPI link + QR is sent back.</li>
            <li>When they upload the payment screenshot, it attaches to that booking — verify it in /payments.</li>
          </ol>
        </Card>
      </div>
    </AppLayout>
  );
};
export default TNFlow;

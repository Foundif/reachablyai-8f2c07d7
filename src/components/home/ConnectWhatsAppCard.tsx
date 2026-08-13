import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { loadFacebookSdk } from '@/lib/facebookSdk';
import { META_APP_ID, META_CONFIG_ID, META_GRAPH_VERSION } from '@/lib/metaConfig';
import { toast } from 'sonner';
import { Facebook, CheckCircle2, ChevronDown, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Home-page card that connects WhatsApp using Meta's Coexistence flow —
 * the business keeps using the WhatsApp Business app on their phone while
 * Reachably reads and replies to the same number.
 */
const ConnectWhatsAppCard = ({ connected, onConnected }: { connected: boolean; onConnected?: () => void }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ waba_id?: string; phone_number_id?: string }>({});

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      try {
        if (!/facebook\.com$/.test(new URL(event.origin).hostname)) return;
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.event === 'FINISH') {
          setSessionInfo({ waba_id: data.data?.waba_id, phone_number_id: data.data?.phone_number_id });
        }
      } catch { /* ignore non-JSON */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const finish = async (code: string, info: { waba_id?: string; phone_number_id?: string }) => {
    const { data, error } = await supabase.functions.invoke('whatsapp-embedded-connect', { body: { code, ...info } });
    setLoading(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || 'Connection failed');
    }
    toast.success(`Connected ${(data as any)?.phone || 'WhatsApp'}`);
    onConnected?.();
  };

  const connect = async () => {
    setLoading(true);
    const extrasObj = {
      setup: {},
      featureType: 'whatsapp_business_app_onboarding', // Coexistence
      sessionInfoVersion: '3',
    };
    try {
      const FB = await loadFacebookSdk();
      FB.login((response: any) => {
        const code = response?.authResponse?.code;
        if (!code) { setLoading(false); return toast.error('Facebook sign-in was cancelled.'); }
        finish(code, sessionInfo);
      }, {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: extrasObj,
      });
    } catch {
      const redirect_uri = `${window.location.origin}/whatsapp/callback`;
      const url =
        `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth` +
        `?client_id=${encodeURIComponent(META_APP_ID)}` +
        `&config_id=${encodeURIComponent(META_CONFIG_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
        `&response_type=code&override_default_response_type=true` +
        `&extras=${encodeURIComponent(JSON.stringify(extrasObj))}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      setLoading(false);
    }
  };

  if (connected) {
    return (
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">WhatsApp is connected</p>
          <p className="text-xs text-muted-foreground">Messages sync to your Team Inbox in real time.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/whatsapp')}>Manage</Button>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-4 border-primary/30">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-[#1877F2]/10 text-[#1877F2] shrink-0"><Facebook className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">Connect WhatsApp with Coexistence</h3>
            <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Recommended</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Keep chatting from the WhatsApp Business app on your phone <b>and</b> from Reachably — same number, same chats, no number migration and no card required.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={connect} disabled={loading} className="gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
          <Facebook className="w-4 h-4" />
          {loading ? 'Waiting for Facebook…' : 'Continue with Facebook'}
        </Button>
        <Button variant="outline" onClick={() => navigate('/whatsapp')}>Manual API setup</Button>
      </div>

      <button onClick={() => setHowOpen(o => !o)} className="flex items-center gap-1 text-xs font-medium text-primary">
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${howOpen ? 'rotate-180' : ''}`} />
        How coexistence works — step by step
      </button>

      {howOpen && (
        <div className="text-xs leading-relaxed text-muted-foreground space-y-2 border-t pt-3">
          <p className="flex items-center gap-1.5 font-medium text-foreground"><Smartphone className="w-3.5 h-3.5" /> Before you start</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Install the <b>WhatsApp Business app</b> on the phone that owns your business number and make sure it's updated.</li>
            <li>Log in to Facebook as the person who owns (or admins) your Meta Business account.</li>
          </ol>
          <p className="font-medium text-foreground pt-1">Connecting</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Tap <b>Continue with Facebook</b> above — a Meta window opens.</li>
            <li>Choose your Business portfolio, then pick <b>“Use my existing WhatsApp Business app number”</b> (coexistence).</li>
            <li>Meta shows a QR code. On your phone open WhatsApp Business → <b>Settings → Linked devices → Link a device</b> and scan it.</li>
            <li>Approve the permissions and wait for the “Finish” screen — the window closes on its own.</li>
            <li>Your recent chats and contacts sync into the Team Inbox within a few minutes.</li>
          </ol>
          <p className="font-medium text-foreground pt-1">Good to know</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>Keep the phone app installed — coexistence needs it linked, just like WhatsApp Web.</li>
            <li>You can reply from either place; every message appears in both.</li>
            <li>Broadcasts still need approved templates, created under <b>Templates</b>.</li>
            <li>No credit card is required to receive messages. Billing only applies to Meta's paid template conversations.</li>
          </ul>
        </div>
      )}
    </Card>
  );
};

export default ConnectWhatsAppCard;

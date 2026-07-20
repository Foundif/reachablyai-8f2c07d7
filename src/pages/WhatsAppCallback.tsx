import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WhatsAppCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('Finishing WhatsApp connection…');

  useEffect(() => {
    const run = async () => {
      const code = params.get('code');
      const err = params.get('error') || params.get('error_reason');
      if (err) {
        setStatus('error');
        setMessage(params.get('error_description') || 'You cancelled the connection.');
        return;
      }
      if (!code) {
        setStatus('error');
        setMessage('Missing authorization code from Facebook.');
        return;
      }
      const redirect_uri = `${window.location.origin}/whatsapp/callback`;
      const { data, error } = await supabase.functions.invoke('whatsapp-embedded-connect', {
        body: { code, redirect_uri },
      });
      if (error || (data as any)?.error) {
        setStatus('error');
        setMessage((data as any)?.error || error?.message || 'Connection failed');
        return;
      }
      setStatus('ok');
      setMessage(`Connected ${(data as any)?.phone || 'WhatsApp'} successfully.`);
      toast.success('WhatsApp connected via Facebook');
      setTimeout(() => navigate('/whatsapp-settings'), 1500);
    };
    run();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4 p-8 border rounded-xl">
        {status === 'loading' && <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />}
        {status === 'ok' && <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />}
        {status === 'error' && <XCircle className="w-10 h-10 mx-auto text-red-500" />}
        <h1 className="text-xl font-semibold">WhatsApp Connection</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        {status === 'error' && (
          <Button onClick={() => navigate('/whatsapp-settings')}>Back to WhatsApp Settings</Button>
        )}
      </div>
    </div>
  );
};

export default WhatsAppCallback;

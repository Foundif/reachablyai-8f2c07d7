import { useEffect, useRef, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, QrCode, CheckCircle2 } from 'lucide-react';
import { InstanceStatus, gatewayApi, getGatewaySettings, saveGatewaySettings } from '@/lib/gateway';

const GatewayConnect = () => {
  const [instanceId, setInstanceId] = useState(getGatewaySettings().instanceId);
  const [qr, setQr] = useState<string>('');
  const [status, setStatus] = useState<InstanceStatus>('disconnected');
  const [creating, setCreating] = useState(false);
  const timer = useRef<any>(null);

  const poll = async (id: string) => {
    try {
      const r = await gatewayApi.status(id);
      setStatus(r?.status || 'disconnected');
      if (r?.qrCode) setQr(r.qrCode);
      if (r?.status === 'connected') {
        clearInterval(timer.current);
        toast.success('WhatsApp connected');
      }
    } catch (e: any) {
      // keep polling silently; surface once
      setStatus('disconnected');
    }
  };

  useEffect(() => {
    if (!instanceId) return;
    poll(instanceId);
    timer.current = setInterval(() => poll(instanceId), 4000);
    return () => clearInterval(timer.current);
  }, [instanceId]);

  const create = async () => {
    setCreating(true);
    try {
      const r = await gatewayApi.createInstance();
      if (!r?.instanceId) throw new Error('Gateway did not return an instanceId');
      saveGatewaySettings({ instanceId: r.instanceId });
      setInstanceId(r.instanceId);
      setQr(r.qrCode || '');
      setStatus('qrcode');
      toast.success('Instance created — scan the QR code');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const qrSrc = qr ? (qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`) : '';

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Connect WhatsApp</h1>
          <p className="text-muted-foreground text-sm mt-1">Create an instance on the gateway and scan the QR from WhatsApp → Linked devices.</p>
        </div>

        <Card className="p-6 space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Badge variant={status === 'connected' ? 'default' : 'secondary'}>{status}</Badge>
            {instanceId && <span className="text-xs font-mono text-muted-foreground break-all">{instanceId}</span>}
          </div>

          {status === 'connected' ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <CheckCircle2 className="w-12 h-12" />
              <p className="font-semibold">Your WhatsApp is linked.</p>
            </div>
          ) : qrSrc ? (
            <img src={qrSrc} alt="WhatsApp connection QR code" className="mx-auto w-64 h-64 rounded-xl border bg-white p-2" />
          ) : (
            <div className="py-14 flex flex-col items-center gap-3 text-muted-foreground">
              <QrCode className="w-12 h-12" />
              <p className="text-sm">No QR yet. Create an instance to start.</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={create} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {instanceId ? 'Create new instance' : 'Create instance'}
            </Button>
            {instanceId && (
              <Button variant="outline" onClick={() => poll(instanceId)}>Check status</Button>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default GatewayConnect;

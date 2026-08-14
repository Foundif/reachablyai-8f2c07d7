import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getGatewaySettings, saveGatewaySettings, gatewayApi } from '@/lib/gateway';

const GatewaySettings = () => {
  const s = getGatewaySettings();
  const [baseUrl, setBaseUrl] = useState(s.baseUrl);
  const [webhookUrl, setWebhookUrl] = useState(s.webhookUrl);
  const [instanceId, setInstanceId] = useState(s.instanceId);
  const [testing, setTesting] = useState(false);

  const save = () => {
    saveGatewaySettings({ baseUrl, webhookUrl, instanceId });
    toast.success('Gateway settings saved');
  };

  const test = async () => {
    saveGatewaySettings({ baseUrl, webhookUrl, instanceId });
    if (!instanceId) { toast.error('Enter an instance ID to test'); return; }
    setTesting(true);
    try {
      const r = await gatewayApi.status(instanceId);
      toast.success(`Gateway reachable — status: ${r?.status}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Gateway Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Stored in this browser and used for every gateway API call.</p>
        </div>

        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baseUrl">Backend base URL</Label>
            <Input id="baseUrl" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://your-gateway.bolt.host" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input id="webhookUrl" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhook" />
            <p className="text-xs text-muted-foreground">Configure this same URL on the gateway for incoming messages and status updates.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="instanceId">Instance ID</Label>
            <Input id="instanceId" value={instanceId} onChange={e => setInstanceId(e.target.value)} placeholder="Created on the Connect screen" />
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>Save</Button>
            <Button variant="outline" onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Test connection'}</Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default GatewaySettings;

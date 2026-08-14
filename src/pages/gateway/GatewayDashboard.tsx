import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { QrCode, Signal, Gauge, Users, Settings2, RefreshCw } from 'lucide-react';
import {
  DAILY_QUOTA, InstanceStatus, gatewayApi, getGatewaySettings, getQuotaUsed,
  getSavedContacts, saveGatewaySettings,
} from '@/lib/gateway';

const GatewayDashboard = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(getGatewaySettings());
  const [status, setStatus] = useState<InstanceStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState(getQuotaUsed());
  const contacts = getSavedContacts().length;

  const refresh = async () => {
    const s = getGatewaySettings();
    setSettings(s);
    setUsed(getQuotaUsed());
    if (!s.instanceId) { setStatus('disconnected'); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await gatewayApi.status(s.instanceId);
      setStatus(r?.status || 'disconnected');
    } catch (e: any) {
      setError(e.message);
      setStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, []);

  const connected = status === 'connected';
  const pct = Math.min(100, (used / DAILY_QUOTA) * 100);

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-5 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">WhatsApp Gateway</h1>
            <p className="text-muted-foreground text-sm mt-1">Instance health, quota and quick actions.</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {error && (
          <Card className="p-4 border-destructive/40">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-muted"><Signal className="w-4 h-4" /></div>
              <Badge variant={connected ? 'default' : 'secondary'}>{status}</Badge>
            </div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mt-4">Instance</p>
            <p className="text-sm font-mono mt-1 break-all">{settings.instanceId || 'Not connected'}</p>
          </Card>

          <Card className="p-5">
            <div className="p-2.5 rounded-xl bg-muted w-fit"><Gauge className="w-4 h-4" /></div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mt-4">Daily quota</p>
            <p className="text-3xl font-bold mt-1">{used}<span className="text-base text-muted-foreground">/{DAILY_QUOTA}</span></p>
            <Progress value={pct} className="mt-3 h-2" />
          </Card>

          <Card className="p-5">
            <div className="p-2.5 rounded-xl bg-muted w-fit"><Users className="w-4 h-4" /></div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mt-4">Saved contacts</p>
            <p className="text-3xl font-bold mt-1">{contacts}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button onClick={() => navigate('/gateway/connect')}><QrCode className="w-4 h-4 mr-2" /> Connect / QR</Button>
          <Button variant="outline" onClick={() => navigate('/gateway/campaigns')}>Campaign builder</Button>
          <Button variant="outline" onClick={() => navigate('/gateway/settings')}><Settings2 className="w-4 h-4 mr-2" /> Settings</Button>
        </div>

        {settings.instanceId && (
          <Card className="p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Disconnect this instance and clear it from the gateway.</p>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                try { await gatewayApi.logout(settings.instanceId); } catch { /* ignore */ }
                saveGatewaySettings({ instanceId: '' });
                refresh();
              }}
            >
              Logout instance
            </Button>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default GatewayDashboard;

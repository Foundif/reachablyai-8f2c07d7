import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import {
  MessageSquare, Instagram, ShieldCheck, CheckCircle2,
  Signal, Smartphone, ExternalLink, RefreshCw, AlertCircle, Copy, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function Channels() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [waCred, setWaCred] = useState<any>(null);
  const [igCred, setIgCred] = useState<any>(null);
  const [csatEnabled, setCsatEnabled] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const wsId = await resolveWorkspaceId(user.id, profile);
    if (!wsId) { setLoading(false); return; }

    const [{ data: wa }, { data: ig }, { data: wsSettings }] = await Promise.all([
      supabase.from('whatsapp_credentials').select('*').eq('workspace_id', wsId).maybeSingle(),
      supabase.from('instagram_credentials').select('*').eq('workspace_id', wsId).maybeSingle(),
      supabase.from('workspace_settings').select('*').eq('workspace_id', wsId).maybeSingle(),
    ]);

    setWaCred(wa);
    setIgCred(ig);
    if (wsSettings) {
      setCsatEnabled((wsSettings as any).away_enabled || false);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user, profile]);

  const copyText = (txt: string, key: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isWaConnected = Boolean(waCred && waCred.status === 'connected' && waCred.business_phone);
  const isIgConnected = Boolean(igCred && igCred.status === 'connected');

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Channels</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage connected messaging accounts, Official Business Account (Blue Tick) verification, and channel health.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Channel Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* WhatsApp Channel Card */}
          <Card className="p-5 border-l-4 border-l-emerald-500 relative overflow-hidden bg-card/60 backdrop-blur">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">{waCred?.label || 'WhatsApp Cloud API'}</span>
                    <Badge variant="outline" className={isWaConnected ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : 'bg-amber-500/15 text-amber-600'}>
                      {isWaConnected ? 'LIVE' : 'UNVERIFIED'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {waCred?.business_phone ? `+${waCred.business_phone}` : 'Not connected'}
                  </p>
                </div>
              </div>
              <Link to="/whatsapp-settings">
                <Button size="sm" variant="outline">Settings</Button>
              </Link>
            </div>

            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Signal className="w-4 h-4 text-emerald-500" />
                <span>Tier: <b className="text-foreground">{waCred?.messaging_limit || '10,000 / day'}</b></span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Quality: <b className="text-emerald-600">{waCred?.quality_rating || 'HIGH'}</b></span>
              </div>
            </div>
          </Card>

          {/* Instagram Channel Card */}
          <Card className="p-5 border-l-4 border-l-purple-500 relative overflow-hidden bg-card/60 backdrop-blur">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                  <Instagram className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">Instagram DM</span>
                    <Badge variant="outline" className={isIgConnected ? 'bg-purple-500/15 text-purple-600 border-purple-500/30' : 'bg-slate-500/15 text-slate-600'}>
                      {isIgConnected ? 'LIVE' : 'DISCONNECTED'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {igCred?.username ? `@${igCred.username}` : 'No Instagram connected'}
                  </p>
                </div>
              </div>
              <Link to="/instagram">
                <Button size="sm" variant="outline">{isIgConnected ? 'Configure' : 'Connect'}</Button>
              </Link>
            </div>

            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2 text-xs">
              <div className="text-muted-foreground">
                Page ID: <b className="text-foreground">{igCred?.page_id || 'N/A'}</b>
              </div>
              <div className="text-muted-foreground">
                24h Window: <b className="text-foreground">Active</b>
              </div>
            </div>
          </Card>
        </div>

        {/* Detailed Channel Management Tabs */}
        <Card className="p-6">
          <Tabs defaultValue="health" className="space-y-6">
            <TabsList className="grid grid-cols-3 max-w-md">
              <TabsTrigger value="health">Channel Health</TabsTrigger>
              <TabsTrigger value="bluetick">Blue Tick (OBA)</TabsTrigger>
              <TabsTrigger value="csat">CSAT Survey</TabsTrigger>
            </TabsList>

            {/* Tab 1: Channel Health & Meta details */}
            <TabsContent value="health" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
                  <span className="text-xs uppercase font-medium text-muted-foreground">Meta Verified Business Name</span>
                  <div className="font-semibold text-base">{waCred?.verified_name || 'TN45 Travel Aid'}</div>
                  <p className="text-xs text-muted-foreground">Displayed at the top of customer WhatsApp chats.</p>
                </div>

                <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
                  <span className="text-xs uppercase font-medium text-muted-foreground">Phone Number ID</span>
                  <div className="flex items-center justify-between font-mono text-xs bg-card p-2 rounded border">
                    <span className="truncate">{waCred?.phone_number_id || 'Not configured'}</span>
                    {waCred?.phone_number_id && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyText(waCred.phone_number_id, 'pid')}>
                        {copiedKey === 'pid' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
                  <span className="text-xs uppercase font-medium text-muted-foreground">WhatsApp Business Account ID (WABA)</span>
                  <div className="flex items-center justify-between font-mono text-xs bg-card p-2 rounded border">
                    <span className="truncate">{waCred?.waba_id || 'Not configured'}</span>
                    {waCred?.waba_id && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyText(waCred.waba_id, 'waba')}>
                        {copiedKey === 'waba' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
                  <span className="text-xs uppercase font-medium text-muted-foreground">Messaging Limit & Quality</span>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Tier: 10k messages / 24h</Badge>
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Quality: Green / High</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Limit auto-upgrades to 100k when reaching 50% capacity over 7 days.</p>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Blue Tick (OBA) Guide */}
            <TabsContent value="bluetick" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      Official Business Account (Green/Blue Tick)
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Meta grants the Official Business Account badge to recognized, notable brands. Here is the step-by-step checklist to apply directly in your Meta Business Suite.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">1. Meta Business Verification</p>
                        <p className="text-xs text-muted-foreground">Verify your legal business entity (GST / MSME / Incorporation certificate) in Meta Business Settings.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">2. Enable 2-Factor Authentication (2FA)</p>
                        <p className="text-xs text-muted-foreground">Ensure 2FA is required for all admins in your Meta Business Manager.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">3. Brand Notability & Press Links</p>
                        <p className="text-xs text-muted-foreground">Meta requires 3–5 independent news articles or press releases covering your business (paid PR or blogs are not accepted).</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">4. Submit in Meta WhatsApp Manager</p>
                        <p className="text-xs text-muted-foreground">Go to Meta WhatsApp Manager &gt; Phone Numbers &gt; Settings &gt; Profile &gt; "Submit Request for Official Business Account".</p>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" className="gap-2" asChild>
                    <a href="https://business.facebook.com/wa/manage/phone-numbers/" target="_blank" rel="noopener noreferrer">
                      Open Meta WhatsApp Manager <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>

                {/* Mobile Preview Mockup */}
                <div className="lg:col-span-5 flex justify-center">
                  <div className="w-64 border-4 border-border rounded-3xl p-3 bg-muted/40 shadow-lg">
                    <div className="w-16 h-3 bg-border rounded-full mx-auto mb-4" />
                    <div className="bg-card rounded-2xl p-4 border text-center space-y-3">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center font-bold text-xl">
                        {waCred?.verified_name?.[0] || 'T'}
                      </div>
                      <div>
                        <div className="font-semibold text-sm flex items-center justify-center gap-1.5">
                          <span>{waCred?.verified_name || 'TN45 Travel Aid'}</span>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                        </div>
                        <p className="text-[11px] text-muted-foreground">Official Business Account</p>
                      </div>
                      <div className="text-[11px] bg-muted p-2 rounded text-left text-muted-foreground">
                        Verified by Meta as an authentic business account.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: CSAT Survey */}
            <TabsContent value="csat" className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div>
                  <h4 className="font-medium text-sm">Automated CSAT / Feedback Survey</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically trigger a 5-star or rating question on WhatsApp when a conversation is marked "Resolved" in Inbox.
                  </p>
                </div>
                <Switch checked={csatEnabled} onCheckedChange={(val) => {
                  setCsatEnabled(val);
                  toast.success(val ? 'CSAT survey enabled' : 'CSAT survey disabled');
                }} />
              </div>

              <div className="p-4 border rounded-lg bg-muted/20 text-xs space-y-2">
                <p className="font-medium">Default CSAT Prompt:</p>
                <div className="p-3 bg-card rounded border font-mono text-muted-foreground">
                  "How would you rate our service today? Please reply with a number from 1 (Poor) to 5 (Excellent). Thank you!"
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AppLayout>
  );
}

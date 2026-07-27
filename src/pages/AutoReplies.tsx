import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { toast } from 'sonner';
import { Bot, Clock, MessageCircle, Save } from 'lucide-react';

type DayCfg = { enabled: boolean; start: string; end: string };
type BH = Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayCfg>;
const DAYS: { key: keyof BH; label: string }[] = [
  { key: 'mon', label: 'Monday' }, { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' }, { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' }, { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];
const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Australia/Sydney', 'UTC',
];

const DEFAULT_BH: BH = {
  mon: { enabled: true, start: '09:00', end: '18:00' },
  tue: { enabled: true, start: '09:00', end: '18:00' },
  wed: { enabled: true, start: '09:00', end: '18:00' },
  thu: { enabled: true, start: '09:00', end: '18:00' },
  fri: { enabled: true, start: '09:00', end: '18:00' },
  sat: { enabled: false, start: '09:00', end: '18:00' },
  sun: { enabled: false, start: '09:00', end: '18:00' },
};

const AutoReplies = () => {
  const { user, profile } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tz, setTz] = useState('Asia/Kolkata');
  const [bh, setBh] = useState<BH>(DEFAULT_BH);
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState('Hi! 👋 Thanks for messaging us. How can we help?');
  const [awayEnabled, setAwayEnabled] = useState(false);
  const [awayMsg, setAwayMsg] = useState("Thanks for reaching out! We're currently away. Our team will reply during business hours.");

  useEffect(() => {
    (async () => {
      if (!user) return;
      const id = await resolveWorkspaceId(user.id, profile);
      setWsId(id);
      if (!id) { setLoading(false); return; }
      const { data } = await supabase.from('workspace_settings' as any).select('*').eq('workspace_id', id).maybeSingle();
      if (data) {
        const d: any = data;
        setTz(d.timezone || 'Asia/Kolkata');
        setBh({ ...DEFAULT_BH, ...(d.business_hours || {}) });
        setWelcomeEnabled(!!d.welcome_enabled);
        setWelcomeMsg(d.welcome_message || welcomeMsg);
        setAwayEnabled(!!d.away_enabled);
        setAwayMsg(d.away_message || awayMsg);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const save = async () => {
    if (!wsId) return;
    setSaving(true);
    const payload = {
      workspace_id: wsId, timezone: tz, business_hours: bh,
      welcome_enabled: welcomeEnabled, welcome_message: welcomeMsg,
      away_enabled: awayEnabled, away_message: awayMsg,
    };
    const { error } = await supabase.from('workspace_settings' as any).upsert(payload, { onConflict: 'workspace_id' });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Auto-replies saved');
  };

  const updateDay = (key: keyof BH, patch: Partial<DayCfg>) =>
    setBh(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Bot className="w-6 h-6" /> Auto-replies & Business Hours
            </h1>
            <p className="text-muted-foreground text-sm">Send instant responses to customers when you're away or when they message for the first time.</p>
          </div>
          <Button onClick={save} disabled={saving || loading} className="gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>

        {loading ? (
          <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
        ) : (
          <>
            <Card className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  <div>
                    <div className="font-semibold">Welcome message</div>
                    <div className="text-xs text-muted-foreground">Sent the first time a new customer messages you.</div>
                  </div>
                </div>
                <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
              </div>
              <Textarea rows={3} value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)} maxLength={1000} placeholder="Hi! Thanks for messaging us…" />
              <p className="text-xs text-muted-foreground">Sent at most once per contact, ever.</p>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <div>
                    <div className="font-semibold">Away message</div>
                    <div className="text-xs text-muted-foreground">Sent when a customer messages you outside business hours.</div>
                  </div>
                </div>
                <Switch checked={awayEnabled} onCheckedChange={setAwayEnabled} />
              </div>
              <Textarea rows={3} value={awayMsg} onChange={e => setAwayMsg(e.target.value)} maxLength={1000} />
              <p className="text-xs text-muted-foreground">Sent at most once per 24h per contact.</p>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold flex items-center gap-2"><Clock className="w-5 h-5" /> Business hours</div>
                  <div className="text-xs text-muted-foreground">Used to decide when the away message applies.</div>
                </div>
                <div className="w-56">
                  <Label className="text-xs">Timezone</Label>
                  <Select value={tz} onValueChange={setTz}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIMEZONES.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                {DAYS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3 flex-wrap py-1 border-b last:border-b-0">
                    <div className="w-28 font-medium">{label}</div>
                    <Switch checked={bh[key].enabled} onCheckedChange={(v) => updateDay(key, { enabled: v })} />
                    <div className="flex items-center gap-2 opacity-100 data-[disabled=true]:opacity-40" data-disabled={!bh[key].enabled}>
                      <Input type="time" className="w-32" value={bh[key].start} disabled={!bh[key].enabled} onChange={e => updateDay(key, { start: e.target.value })} />
                      <span className="text-muted-foreground">to</span>
                      <Input type="time" className="w-32" value={bh[key].end} disabled={!bh[key].enabled} onChange={e => updateDay(key, { end: e.target.value })} />
                    </div>
                    {!bh[key].enabled && <span className="text-xs text-muted-foreground ml-2">Closed</span>}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 space-y-2 bg-muted/30">
              <div className="font-semibold text-sm">Keyword auto-replies</div>
              <p className="text-sm text-muted-foreground">
                Create keyword rules (e.g. "price", "hi", "hours") on the <a className="underline text-primary" href="/automation">Automations</a> page. Choose <b>Incoming message matches keyword</b> as the trigger and <b>Send text reply</b> as the action.
              </p>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default AutoReplies;

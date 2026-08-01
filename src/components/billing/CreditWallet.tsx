import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Wallet, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Wallet { balance: number; lifetime_purchased: number; lifetime_used: number; buffer_enabled: boolean; }
interface Settings { buffer_msgs: number; pause_on_exhausted: boolean; }

/**
 * Prepaid message wallet + line-of-credit buffer.
 * Reachably holds the Meta billing — customers never add a card to Meta.
 */
const CreditWallet = () => {
  const { user, profile } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [settings, setSettings] = useState<Settings>({ buffer_msgs: 100, pause_on_exhausted: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const id = await resolveWorkspaceId(user.id, profile);
      if (!id) { setLoading(false); return; }
      setWsId(id);
      const [{ data: w }, { data: s }] = await Promise.all([
        supabase.from('message_credits' as any).select('*').eq('workspace_id', id).maybeSingle(),
        supabase.from('credit_settings' as any).select('*').eq('workspace_id', id).maybeSingle(),
      ]);
      setWallet((w as any) || { balance: 0, lifetime_purchased: 0, lifetime_used: 0, buffer_enabled: true });
      if (s) setSettings(s as any);
      setLoading(false);
    })();
  }, [user, profile]);

  const saveSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (!wsId) return;
    const { error } = await supabase.from('credit_settings' as any)
      .upsert({ workspace_id: wsId, ...next }, { onConflict: 'workspace_id' });
    if (error) return toast.error(error.message);
    toast.success('Credit settings saved');
  };

  if (loading) return null;

  const balance = wallet?.balance ?? 0;
  const buffer = settings.buffer_msgs;
  const inBuffer = balance < 0;
  const bufferLeft = inBuffer ? Math.max(0, buffer - Math.abs(balance)) : buffer;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <h3 className="font-semibold flex items-center gap-2">
            Message wallet
            <Badge variant="outline" className="gap-1 text-[10px]">
              <ShieldCheck className="w-3 h-3" /> No card on Meta needed
            </Badge>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            We hold the Meta billing line. You just keep message credits topped up — no debit/credit card on your
            WhatsApp Business account, no "card not supported" errors.
          </p>
        </div>
        <div className="text-right">
          <div className={inBuffer ? 'text-2xl font-bold text-amber-600' : 'text-2xl font-bold'}>
            {balance.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-muted-foreground">messages left</div>
        </div>
      </div>

      {inBuffer && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          You're using your credit buffer — {bufferLeft} of {buffer} buffer messages remain. Recharge to avoid a pause.
        </div>
      )}

      <div className="mt-5 space-y-4 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Credit buffer</div>
            <div className="text-xs text-muted-foreground">
              Keep sending up to {buffer} messages after the wallet hits zero, then settle on your next recharge.
            </div>
          </div>
          <Switch
            checked={wallet?.buffer_enabled !== false}
            onCheckedChange={async (v) => {
              setWallet(w => (w ? { ...w, buffer_enabled: v } : w));
              if (wsId) await supabase.from('message_credits' as any).update({ buffer_enabled: v }).eq('workspace_id', wsId);
            }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Buffer size</span>
            <span className="font-medium">{buffer} messages</span>
          </div>
          <Slider
            value={[buffer]}
            min={0}
            max={500}
            step={25}
            onValueCommit={(v) => saveSettings({ buffer_msgs: v[0] })}
            onValueChange={(v) => setSettings(s => ({ ...s, buffer_msgs: v[0] }))}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Pause sending when buffer is used up</div>
            <div className="text-xs text-muted-foreground">Recommended — prevents surprise overages.</div>
          </div>
          <Switch
            checked={settings.pause_on_exhausted}
            onCheckedChange={(v) => saveSettings({ pause_on_exhausted: v })}
          />
        </div>
      </div>
    </Card>
  );
};

export default CreditWallet;

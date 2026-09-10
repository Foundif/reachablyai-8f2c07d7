import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrial } from '@/hooks/useTrial';
import { resolveWorkspaceId } from '@/lib/workspace';
import { PLANS, TRIAL_LIMITS, planById } from '@/lib/plans';
import { cn } from '@/lib/utils';
import { Phone, Users, Contact, UserCheck, Send } from 'lucide-react';

interface Usage { numbers: number; users: number; contacts: number; clients: number; messages: number }

const Bar = ({ icon: Icon, label, used, limit }: { icon: any; label: string; used: number; limit: number }) => {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="flex items-center gap-1.5 font-medium"><Icon className="w-3.5 h-3.5" /> {label}</span>
        <span className="text-muted-foreground tabular-nums">
          {used.toLocaleString('en-IN')} / {limit.toLocaleString('en-IN')}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-amber-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/** Current plan + live usage against every plan limit. */
const PlanUsageCard = () => {
  const { user, profile } = useAuth();
  const { isTrialing, daysLeft } = useTrial();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [ws, setWs] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const wsId = await resolveWorkspaceId(user.id, profile);
      if (!wsId) return;
      const monthStart = new Date();
      monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const c = (q: any) => q.then((r: any) => r.count || 0);
      const [workspace, numbers, users, contacts, clients, messages] = await Promise.all([
        supabase.from('workspaces' as any).select('*').eq('id', wsId).maybeSingle().then(r => r.data),
        c(supabase.from('whatsapp_credentials' as any).select('id', { count: 'exact', head: true }).eq('workspace_id', wsId)),
        c(supabase.from('workspace_members' as any).select('user_id', { count: 'exact', head: true }).eq('workspace_id', wsId)),
        c(supabase.from('leads' as any).select('id', { count: 'exact', head: true }).eq('workspace_id', wsId)),
        c(supabase.from('wa_conversations' as any).select('id', { count: 'exact', head: true }).eq('workspace_id', wsId)),
        c(supabase.from('wa_messages' as any).select('id', { count: 'exact', head: true }).eq('workspace_id', wsId)
          .eq('direction', 'outbound').gte('created_at', monthStart.toISOString())),
      ]);
      setWs(workspace);
      setUsage({ numbers, users, contacts, clients, messages });
    })();
  }, [user, profile]);

  const planId = ws?.plan_id || null;
  const plan = planById(planId);
  const limits = plan ?? TRIAL_LIMITS;
  const extraNumbers = ws?.extra_numbers || 0;
  const extraContacts = ws?.extra_contacts || 0;
  const renews = ws?.plan_renews_at ? new Date(ws.plan_renews_at) : null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Current plan</div>
          <div className="text-xl font-bold mt-0.5 flex items-center gap-2">
            {plan ? plan.name : 'Free trial'}
            {plan && <Badge variant="secondary" className="text-[10px]">{ws?.billing_period === 'yearly' ? 'Yearly' : 'Monthly'}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {plan
              ? <>Active{renews ? ` · renews on ${renews.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</>
              : isTrialing ? `Trial · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} remaining` : 'No active subscription'}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{limits.users} users allowed</div>
          <div>{limits.numbers + extraNumbers} WhatsApp numbers allowed</div>
        </div>
      </div>

      {usage && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Bar icon={Phone} label="WhatsApp Numbers" used={usage.numbers} limit={limits.numbers + extraNumbers} />
          <Bar icon={Users} label="Users" used={usage.users} limit={limits.users} />
          <Bar icon={Contact} label="Contacts" used={usage.contacts} limit={limits.contacts + extraContacts} />
          <Bar icon={UserCheck} label="Clients" used={usage.clients} limit={limits.clients + extraContacts} />
          <Bar icon={Send} label="Broadcast Messages" used={usage.messages} limit={limits.messages} />
        </div>
      )}

      {!plan && (
        <p className="mt-4 text-xs text-muted-foreground">
          Trial limits apply until you subscribe. Pick a plan below to unlock the full limits.
        </p>
      )}
      {plan && plan.id !== PLANS[PLANS.length - 1].id && (
        <p className="mt-4 text-xs text-muted-foreground">
          Need more numbers or contacts? Add-ons are available — or upgrade your plan below.
        </p>
      )}
    </Card>
  );
};

export default PlanUsageCard;

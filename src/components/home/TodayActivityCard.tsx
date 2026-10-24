import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight } from 'lucide-react';

type Props = { wsId: string | null; credits: number; creditsPack: number; aiReplies: number };

/** Turbodev-style "Today" overview: open chats + hourly inbound activity + wallet. */
const TodayActivityCard = ({ wsId, credits, creditsPack, aiReplies }: Props) => {
  const navigate = useNavigate();
  const [hours, setHours] = useState<{ h: string; v: number }[]>([]);
  const [openChats, setOpenChats] = useState(0);

  useEffect(() => {
    if (!wsId) return;
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase.from('wa_messages' as any)
        .select('created_at,conversation_id').eq('workspace_id', wsId).eq('direction', 'inbound')
        .gte('created_at', start.toISOString()).limit(5000);
      const rows = (data as any[]) || [];
      const buckets = Array.from({ length: 24 }, (_, i) => ({
        h: new Date(2000, 0, 1, i).toLocaleTimeString([], { hour: 'numeric' }), v: 0,
      }));
      rows.forEach(r => { buckets[new Date(r.created_at).getHours()].v++; });
      setHours(buckets);
      setOpenChats(new Set(rows.map(r => r.conversation_id)).size);
    })();
  }, [wsId]);

  const today = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Today</h2>
          <p className="mt-4 text-sm text-muted-foreground">Open chats</p>
          <p className="text-4xl font-semibold leading-tight tabular-nums">{openChats}</p>
          <p className="text-sm text-muted-foreground">Chats with customer messages today</p>
        </div>
        <p className="text-sm text-muted-foreground text-right shrink-0">{today}<br /><span className="text-foreground">Today</span></p>
      </div>

      <div className="h-36 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={hours} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="todayFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="h" tickLine={false} axisLine={false} interval={2} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [v, 'Messages']} />
            <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#todayFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      </div>

      <div className="lg:border-l lg:pl-8 pt-2 lg:pt-14">
        <p className="font-semibold mb-2">Wallet</p>
        <button onClick={() => navigate('/pricing')} className="group w-full flex items-center justify-between py-4 border-b text-left">
          <span>
            <span className="block text-sm text-muted-foreground">Message credits</span>
            <span className="block text-2xl font-semibold mt-1 tabular-nums">{Math.max(0, creditsPack - credits).toLocaleString('en-IN')} <span className="text-sm font-normal text-muted-foreground">left of {creditsPack.toLocaleString('en-IN')}</span></span>
            <span className="block text-sm text-muted-foreground mt-1 group-hover:text-primary">View usage & top up</span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
        <button onClick={() => navigate('/chatbots')} className="group w-full flex items-center justify-between py-4 text-left">
          <span>
            <span className="block text-sm text-muted-foreground">AI replies this month</span>
            <span className="block text-2xl font-semibold mt-1 tabular-nums">{aiReplies.toLocaleString('en-IN')}</span>
            <span className="block text-sm text-muted-foreground mt-1 group-hover:text-primary">View usage & top up</span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </section>
  );
};

export default TodayActivityCard;

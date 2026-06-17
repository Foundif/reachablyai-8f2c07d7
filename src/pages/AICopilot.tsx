import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Bot, Send, Sparkles, User, Coins, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'How many bookings are confirmed this week?',
  'Which service generated the most revenue last month?',
  'List customers who travelled more than twice this year.',
  'What is my profit after expenses this month?',
];

const AICopilot = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<{ free_remaining: number; free_limit: number; purchased: number } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => { scroll.current?.scrollTo(0, scroll.current.scrollHeight); }, [msgs]);

  const loadCredits = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('tn_ai_credits')
      .select('free_used, free_limit, purchased_balance, period_start')
      .eq('user_id', user.id)
      .maybeSingle();
    const cur = new Date(); cur.setUTCDate(1);
    if (!data) {
      setCredits({ free_remaining: 5, free_limit: 5, purchased: 0 });
    } else {
      const periodStart = new Date(data.period_start);
      const isCurrent = periodStart.getUTCFullYear() === cur.getUTCFullYear() && periodStart.getUTCMonth() === cur.getUTCMonth();
      const used = isCurrent ? data.free_used : 0;
      setCredits({
        free_remaining: Math.max(0, data.free_limit - used),
        free_limit: data.free_limit,
        purchased: data.purchased_balance ?? 0,
      });
    }
  };

  useEffect(() => { loadCredits(); }, [user?.id]);

  const send = async (text: string) => {
    if (!text.trim() || loading || !user) return;

    // Reserve a credit before calling the model.
    const { data: consume, error: cErr } = await (supabase as any).rpc('tn_consume_ai_credit', { _user_id: user.id });
    if (cErr) {
      toast.error('Could not check AI credits, please try again.');
      return;
    }
    if (!consume?.ok) {
      toast.error('You are out of AI Copilot credits for this month.');
      setCredits((c) => c ? { ...c, free_remaining: 0, purchased: consume?.purchased_balance ?? 0 } : c);
      return;
    }
    setCredits({
      free_remaining: consume.free_remaining ?? 0,
      free_limit: credits?.free_limit ?? 5,
      purchased: consume.purchased_balance ?? 0,
    });

    const next = [...msgs, { role: 'user' as const, content: text }];
    setMsgs(next); setInput(''); setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('copilot-chat', {
        body: { messages: next },
      });
      if (error) throw error;
      const reply = data?.reply || 'I can help with bookings, customers, revenue and operations. Try a suggestion below.';
      setMsgs((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'assistant', content: 'I had trouble reaching the AI service. Please try again in a moment.' }]);
    } finally { setLoading(false); }
  };

  const totalRemaining = (credits?.free_remaining ?? 0) + (credits?.purchased ?? 0);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 h-[calc(100vh-7rem)] flex flex-col max-w-4xl mx-auto w-full">
        <div className="mb-4 flex flex-wrap items-start gap-3 justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="w-6 h-6 text-foreground" /> AI Copilot
            </h1>
            <p className="text-sm text-muted-foreground">Ask about bookings, customers, revenue & operations.</p>
          </div>
          <div className="flex items-center gap-2 glass-panel px-3 py-2 rounded-xl">
            <Coins className="w-4 h-4 text-foreground" />
            <div className="text-xs leading-tight">
              <div className="font-semibold">{totalRemaining} credit{totalRemaining === 1 ? '' : 's'} left</div>
              <div className="text-muted-foreground">
                {credits?.free_remaining ?? 0}/{credits?.free_limit ?? 5} free · {credits?.purchased ?? 0} purchased
              </div>
            </div>
            <Button size="sm" variant="outline" className="ml-2" onClick={() => navigate('/pricing')}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Buy
            </Button>
          </div>
        </div>

        <div ref={scroll} className="flex-1 glass-elevated p-4 overflow-y-auto custom-scrollbar space-y-3">
          {msgs.length === 0 && (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-foreground text-background flex items-center justify-center mx-auto mb-3 shadow-glow">
                <Sparkles className="w-7 h-7" />
              </div>
              <p className="font-semibold mb-1">How can I help your travel business today?</p>
              <p className="text-xs text-muted-foreground mb-6">Try a suggestion below</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-left px-3 py-2.5 rounded-xl glass-panel hover:bg-foreground/5 text-xs">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>}
              <div className={cn('max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap',
                m.role === 'user' ? 'bg-foreground text-background' : 'bg-muted text-foreground border border-border')}>
                {m.content}
              </div>
              {m.role === 'user' && <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="w-4 h-4" /></div>}
            </div>
          ))}
          {loading && <div className="text-xs text-muted-foreground">Copilot is thinking…</div>}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
            placeholder={totalRemaining > 0 ? 'Ask anything about your travel business…' : 'No credits left — buy a pack to continue'}
            disabled={totalRemaining <= 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border focus:border-foreground/40 focus:outline-none text-sm disabled:opacity-60"
          />
          <Button onClick={() => send(input)} disabled={loading || totalRemaining <= 0}><Send className="w-4 h-4" /></Button>
        </div>
        {totalRemaining <= 1 && (
          <p className="mt-2 text-[11px] text-muted-foreground text-center">
            You get 5 free Copilot credits every month. Need more? <button onClick={() => navigate('/pricing')} className="underline font-medium">Buy a credit pack →</button>
          </p>
        )}
      </div>
    </AppLayout>
  );
};
export default AICopilot;

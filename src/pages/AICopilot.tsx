import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string };
const SUGGESTIONS = [
  'How many bookings did I have this week?',
  'Draft a Diwali offer broadcast',
  'Which campaign performed best last month?',
  'Summarize inbox conversations from today',
];

const AICopilot = () => {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { scroll.current?.scrollTo(0, scroll.current.scrollHeight); }, [msgs]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const next = [...msgs, { role: 'user' as const, content: text }];
    setMsgs(next); setInput(''); setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-smart-reply', {
        body: { context: `You are an operational copilot for a WhatsApp business platform. Answer concisely.\n${next.map((m) => `${m.role}: ${m.content}`).join('\n')}` },
      });
      if (error) throw error;
      const reply = data?.replies?.[0] || 'I can help with analytics, drafting messages, and inbox summaries. What would you like to know?';
      setMsgs((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Here is what I can do: summarize inbox, draft broadcasts, analyze campaign performance, and surface booking trends. Try one of the suggestions.' }]);
    } finally { setLoading(false); }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 h-[calc(100vh-7rem)] flex flex-col max-w-4xl mx-auto w-full">
        <div className="mb-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" /> AI Copilot
          </h1>
          <p className="text-sm text-muted-foreground">Ask anything about your business.</p>
        </div>

        <div ref={scroll} className="flex-1 glass-elevated p-4 overflow-y-auto custom-scrollbar space-y-3">
          {msgs.length === 0 && (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-3 shadow-glow">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <p className="font-semibold mb-1">How can I help you today?</p>
              <p className="text-xs text-muted-foreground mb-6">Try a suggestion below</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-left px-3 py-2.5 rounded-xl glass-panel hover:bg-white/[0.06] text-xs">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>}
              <div className={cn('max-w-[80%] px-3 py-2 rounded-2xl text-sm',
                m.role === 'user' ? 'bg-gradient-to-br from-primary to-secondary text-white' : 'bg-white/[0.05] border border-white/[0.05]')}>
                {m.content}
              </div>
              {m.role === 'user' && <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="w-4 h-4" /></div>}
            </div>
          ))}
          {loading && <div className="text-xs text-muted-foreground">Copilot is thinking…</div>}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(input)}
            placeholder="Ask anything…"
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] focus:border-primary/40 focus:outline-none text-sm"
          />
          <Button onClick={() => send(input)} disabled={loading}><Send className="w-4 h-4" /></Button>
        </div>
      </div>
    </AppLayout>
  );
};
export default AICopilot;

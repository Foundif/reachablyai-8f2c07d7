import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Sparkles, Plus, Bot, Send, Loader2, Wand2, Trash2, Save, Power,
  BookOpen, Wrench, MessageSquare, Zap, Brain, Settings as SettingsIcon, History, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { can } from '@/lib/permissions';
import AgentHistory from '@/components/ai/AgentHistory';

type Agent = {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  model: string;
  temperature: number;
  tools: any[];
  knowledge: any[];
  greeting: string | null;
  is_active: boolean;
  is_default: boolean;
};

const MODELS = [
  { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', tag: 'Fast' },
  { id: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro', tag: 'Smart' },
  { id: 'openai/gpt-5.1', label: 'GPT-5.1', tag: 'Balanced' },
  { id: 'openai/gpt-5.1-mini', label: 'GPT-5.1 Mini', tag: 'Cheap' },
];

const TOOL_LIBRARY = [
  { id: 'lookup_customer', name: 'Lookup Customer', icon: '👤' },
  { id: 'create_booking', name: 'Create Booking', icon: '📅' },
  { id: 'check_payment', name: 'Check Payment', icon: '💳' },
  { id: 'send_template', name: 'Send Template', icon: '📤' },
  { id: 'escalate_human', name: 'Escalate to Human', icon: '🙋' },
  { id: 'search_catalog', name: 'Search Catalog', icon: '🛍️' },
];

const TEMPLATES = [
  { name: 'Travel Concierge', prompt: 'You are a warm, knowledgeable travel concierge for a boutique tour operator. Help guests discover destinations, suggest itineraries, quote packages and capture booking intent. Always ask for travel dates, party size and budget before quoting. Confirm pricing in INR.' },
  { name: 'Sales Closer', prompt: 'You are an enthusiastic sales rep. Qualify leads, handle objections, present pricing with urgency, and always end with a clear next step (book a call, send a quote, complete a payment).' },
  { name: 'Support Hero', prompt: 'You are a calm, empathetic customer support agent. Acknowledge the issue, troubleshoot step-by-step, never blame the customer, and offer to escalate to a human if unresolved within 3 turns.' },
  { name: 'Receptionist', prompt: 'You are a friendly digital receptionist. Greet, identify intent (booking, info, complaint), collect contact info, and route the request. Keep replies under 2 sentences.' },
];

const AIStudio = () => {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canEditPrompt = can(role, 'agent.edit_prompt');
  const canEditTools = can(role, 'agent.edit_tools');
  const canEditModel = can(role, 'agent.edit_model');
  const canDelete = can(role, 'agent.delete');
  const canCreate = can(role, 'agent.create');
  const canRestore = can(role, 'agent.restore_version');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // playground
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => agents.find(a => a.id === selectedId) || null, [agents, selectedId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('tn_ai_agents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { toast.error(error.message); setLoading(false); return; }
      const list = (data as any) as Agent[];
      setAgents(list);
      setSelectedId(list[0]?.id ?? null);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat, thinking]);

  const createAgent = async (template?: typeof TEMPLATES[number]) => {
    if (!user) return;
    const { data, error } = await supabase.from('tn_ai_agents').insert({
      user_id: user.id,
      name: template?.name ?? 'Untitled Agent',
      description: template ? `${template.name} starter template` : '',
      system_prompt: template?.prompt ?? 'You are a helpful WhatsApp business assistant.',
      greeting: 'Hi! How can I help you today?',
    }).select('*').single();
    if (error) { toast.error(error.message); return; }
    setAgents(prev => [data as any, ...prev]);
    setSelectedId((data as any).id);
    setChat([]);
    toast.success('Agent created');
  };

  const updateLocal = (patch: Partial<Agent>) => {
    if (!selected) return;
    setAgents(prev => prev.map(a => a.id === selected.id ? { ...a, ...patch } : a));
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from('tn_ai_agents').update({
      name: selected.name,
      description: selected.description,
      system_prompt: selected.system_prompt,
      model: selected.model,
      temperature: selected.temperature,
      tools: selected.tools,
      greeting: selected.greeting,
      is_active: selected.is_active,
    }).eq('id', selected.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Saved');
  };

  const remove = async () => {
    if (!selected) return;
    if (!confirm('Delete this agent?')) return;
    const { error } = await supabase.from('tn_ai_agents').delete().eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    setAgents(prev => prev.filter(a => a.id !== selected.id));
    setSelectedId(agents.find(a => a.id !== selected.id)?.id ?? null);
    setChat([]);
  };

  const toggleTool = (toolId: string) => {
    if (!selected) return;
    const has = (selected.tools || []).some((t: any) => t.id === toolId);
    const next = has
      ? selected.tools.filter((t: any) => t.id !== toolId)
      : [...(selected.tools || []), TOOL_LIBRARY.find(t => t.id === toolId)];
    updateLocal({ tools: next });
  };

  const send = async () => {
    if (!input.trim() || !selected || thinking) return;
    const userMsg = { role: 'user' as const, content: input.trim() };
    const next = [...chat, userMsg];
    setChat(next);
    setInput('');
    setThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-agent-chat', {
        body: {
          system_prompt: selected.system_prompt,
          model: selected.model,
          temperature: Number(selected.temperature),
          messages: next.map(m => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setChat(c => [...c, { role: 'assistant', content: (data as any).reply || '...' }]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to get reply');
    } finally {
      setThinking(false);
    }
  };

  return (
    <AppLayout>
      <div className="relative p-4 md:p-6 space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden glass-elevated glass-sheen p-6 md:p-8">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl animate-aurora" />
          <div className="pointer-events-none absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-secondary/30 blur-3xl animate-aurora" style={{ animationDelay: '3s' }} />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-xs mb-3">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span className="text-muted-foreground">AI Agent Studio</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Design <span className="aurora-text">intelligent agents</span> that
                <br className="hidden md:block" /> close conversations for you.
              </h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
                Compose a personality, plug in tools, ground them in your knowledge — then drop them
                straight into your Unified Inbox.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createAgent()} disabled={!canCreate} className="bg-gradient-to-r from-primary to-secondary text-white border-0 shadow-glow disabled:opacity-50">
                <Plus className="w-4 h-4" /> New Agent
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_400px] gap-4">
          {/* Agents list */}
          <div className="glass-panel p-3 h-fit lg:sticky lg:top-4">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Agents</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canCreate} onClick={() => createAgent()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {loading && <div className="px-2 py-6 text-center text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>}

            {!loading && agents.length === 0 && (
              <div className="px-3 py-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">Start from a template:</p>
                {TEMPLATES.map(t => (
                  <button
                    key={t.name}
                    onClick={() => createAgent(t)}
                    className="w-full text-left p-2.5 rounded-lg glass-panel hover:bg-white/5 transition group"
                  >
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-3.5 h-3.5 text-accent" />
                      <span className="text-xs font-medium">{t.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1">
              {agents.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedId(a.id); setChat([]); }}
                  className={cn(
                    'w-full text-left p-2.5 rounded-xl flex items-center gap-2.5 transition',
                    selectedId === a.id ? 'bg-gradient-to-r from-primary/20 to-secondary/10 ring-1 ring-primary/30' : 'hover:bg-white/[0.04]',
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{a.model.split('/')[1]}</div>
                  </div>
                  {a.is_active && <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="glass-panel p-5 min-h-[600px]">
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20">
                <Brain className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Create or select an agent to start designing.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <Input
                      value={selected.name}
                      onChange={(e) => updateLocal({ name: e.target.value })}
                      className="text-xl font-bold border-0 bg-transparent px-0 focus-visible:ring-0 h-auto"
                    />
                    <Input
                      value={selected.description ?? ''}
                      placeholder="Short description for your teammates"
                      onChange={(e) => updateLocal({ description: e.target.value })}
                      className="text-sm border-0 bg-transparent px-0 focus-visible:ring-0 h-auto text-muted-foreground"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => updateLocal({ is_active: !selected.is_active })}
                      className={cn(selected.is_active && 'text-accent')}
                    >
                      <Power className="w-4 h-4" /> {selected.is_active ? 'Active' : 'Paused'}
                    </Button>
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={remove}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    {!canEditPrompt && <Badge variant="outline" className="text-[10px]"><Lock className="w-3 h-3 mr-1" />Read-only</Badge>}
                    <Button size="sm" onClick={save} disabled={saving} className="bg-gradient-to-r from-primary to-secondary text-white border-0">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                    </Button>
                  </div>
                </div>

                <Tabs defaultValue="brain">
                  <TabsList className="glass-panel">
                    <TabsTrigger value="brain"><Brain className="w-3.5 h-3.5 mr-1.5" />Brain</TabsTrigger>
                    <TabsTrigger value="tools"><Wrench className="w-3.5 h-3.5 mr-1.5" />Tools</TabsTrigger>
                    <TabsTrigger value="knowledge"><BookOpen className="w-3.5 h-3.5 mr-1.5" />Knowledge</TabsTrigger>
                    <TabsTrigger value="settings"><SettingsIcon className="w-3.5 h-3.5 mr-1.5" />Tuning</TabsTrigger>
                    <TabsTrigger value="history"><History className="w-3.5 h-3.5 mr-1.5" />History</TabsTrigger>
                  </TabsList>

                  <TabsContent value="brain" className="space-y-4 pt-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Greeting</label>
                      <Input
                        value={selected.greeting ?? ''}
                        onChange={(e) => updateLocal({ greeting: e.target.value })}
                        placeholder="First message the agent sends"
                        className="mt-1.5 glass-panel border-white/10"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">System Prompt</label>
                      <Textarea
                        value={selected.system_prompt}
                        onChange={(e) => updateLocal({ system_prompt: e.target.value })}
                        rows={12}
                        disabled={!canEditPrompt}
                        className="mt-1.5 glass-panel border-white/10 font-mono text-xs leading-relaxed disabled:opacity-70"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1.5">Define personality, rules, tone and edge cases. Markdown supported.</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="tools" className="pt-4">
                    <p className="text-xs text-muted-foreground mb-3">Enable tools your agent can call mid-conversation.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {TOOL_LIBRARY.map(t => {
                        const on = (selected.tools || []).some((x: any) => x.id === t.id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => canEditTools && toggleTool(t.id)}
                            disabled={!canEditTools}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-xl text-left transition',
                              on ? 'bg-gradient-to-r from-primary/20 to-secondary/10 ring-1 ring-primary/30' : 'glass-panel hover:bg-white/[0.04]',
                            )}
                          >
                            <span className="text-lg">{t.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{t.name}</div>
                              <div className="text-[10px] text-muted-foreground">{on ? 'Enabled' : 'Tap to enable'}</div>
                            </div>
                            {on && <Zap className="w-3.5 h-3.5 text-accent" />}
                          </button>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="knowledge" className="pt-4">
                    <div className="glass-panel p-6 text-center rounded-xl border border-dashed border-white/10">
                      <BookOpen className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">Connect Knowledge Base</p>
                      <p className="text-xs text-muted-foreground mt-1">Upload PDFs, FAQs and URLs in the Knowledge module to ground this agent.</p>
                      <Button variant="ghost" size="sm" className="mt-3" onClick={() => location.href = '/knowledge'}>Open Knowledge Base →</Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-5 pt-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Model</label>
                      <div className="grid grid-cols-2 gap-2 mt-1.5">
                        {MODELS.map(m => (
                          <button
                            key={m.id}
                            onClick={() => canEditModel && updateLocal({ model: m.id })}
                            disabled={!canEditModel}
                            className={cn(
                              'p-3 rounded-xl text-left transition disabled:opacity-50',
                              selected.model === m.id ? 'bg-gradient-to-r from-primary/20 to-secondary/10 ring-1 ring-primary/30' : 'glass-panel hover:bg-white/[0.04]',
                            )}
                          >
                            <div className="text-sm font-medium">{m.label}</div>
                            <Badge variant="outline" className="mt-1 text-[10px]">{m.tag}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Creativity</label>
                        <span className="text-xs font-mono">{Number(selected.temperature).toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[Number(selected.temperature) * 100]}
                        onValueChange={(v) => canEditModel && updateLocal({ temperature: v[0] / 100 })}
                        disabled={!canEditModel}
                        max={100} step={5}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>Precise</span><span>Balanced</span><span>Imaginative</span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="pt-4">
                    <AgentHistory agentId={selected.id} currentPrompt={selected.system_prompt} canRestore={canRestore} onRestore={async () => {
                      const { data } = await supabase.from('tn_ai_agents').select('*').eq('id', selected.id).maybeSingle();
                      if (data) setAgents(prev => prev.map(a => a.id === selected.id ? (data as any) : a));
                    }} />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>

          {/* Playground */}
          <div className="glass-panel flex flex-col min-h-[600px]">
            <div className="flex items-center gap-2 p-4 border-b border-white/5">
              <MessageSquare className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">Live Playground</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{selected?.model.split('/')[1] || '—'}</Badge>
            </div>

            <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {selected?.greeting && chat.length === 0 && (
                <div className="max-w-[85%] p-3 rounded-2xl glass-panel text-sm">
                  {selected.greeting}
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-primary to-secondary text-white rounded-br-sm'
                      : 'glass-panel rounded-bl-sm',
                  )}>
                    {m.content}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="glass-panel p-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>
              )}
              {!selected && (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Select an agent to start testing.</div>
              )}
            </div>

            <div className="p-3 border-t border-white/5 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder={selected ? 'Test your agent…' : 'Select an agent first'}
                disabled={!selected || thinking}
                className="glass-panel border-white/10"
              />
              <Button onClick={send} disabled={!selected || thinking || !input.trim()} className="bg-gradient-to-r from-primary to-secondary text-white border-0">
                {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AIStudio;

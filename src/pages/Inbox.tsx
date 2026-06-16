import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Search, Send, Sparkles, Phone, Video, MoreHorizontal, ArrowLeft, Paperclip, Mic, Smile, CalendarDays, CreditCard, MessageSquare, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type Msg = {
  id: string;
  wa_id: string;
  direction: 'in' | 'out';
  type?: string | null;
  payload: any;
  created_at: string;
  read_at?: string | null;
  wa_message_id?: string | null;
};

type Customer = {
  id: string;
  wa_id: string;
  name: string | null;
  avatar_url?: string | null;
  last_seen_at: string;
};

type Thread = {
  wa_id: string;
  name: string;
  lastMsg: string;
  lastAt: string;
  unread: number;
  avatar_url?: string | null;
};

const extractText = (p: any): string => {
  if (!p) return '';
  if (typeof p === 'string') return p;
  if (p.text?.body) return p.text.body;
  if (p.body) return p.body;
  if (p.image) return '📷 Image';
  if (p.audio) return '🎙️ Voice note';
  if (p.document) return '📎 Document';
  if (p.interactive) return p.interactive?.body?.text || 'Interactive message';
  return '';
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatWhatsAppPhone = (waId: string) => {
  const digits = String(waId || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return waId?.startsWith('+') ? waId : `+${waId}`;
};

const Inbox = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [aiReplies, setAiReplies] = useState<string[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [paneCustomerOpen, setPaneCustomerOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mergeMessage = useCallback((next: Msg) => {
    setMessages((prev) => {
      const withoutSame = prev.filter((m) => m.id !== next.id && m.wa_message_id !== (next as any).wa_message_id);
      return [next, ...withoutSame].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });
  }, []);

  const mergeCustomer = useCallback((next: Customer) => {
    setCustomers((prev) => {
      const withoutSame = prev.filter((c) => c.id !== next.id && c.wa_id !== next.wa_id);
      return [next, ...withoutSame].sort((a, b) => new Date(b.last_seen_at || 0).getTime() - new Date(a.last_seen_at || 0).getTime());
    });
  }, []);

  // Load + realtime
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [c, m] = await Promise.all([
        supabase.from('tn_customers').select('*').eq('user_id', user.id).order('last_seen_at', { ascending: false }),
        supabase.from('tn_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
      ]);
      setCustomers((c.data || []) as Customer[]);
      setMessages((m.data || []) as Msg[]);
    })();

    const ch = supabase
      .channel(`inbox-live-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tn_messages', filter: `user_id=eq.${user.id}` },
        (payload) => mergeMessage(payload.new as Msg))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tn_messages', filter: `user_id=eq.${user.id}` },
        (payload) => mergeMessage(payload.new as Msg))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tn_customers', filter: `user_id=eq.${user.id}` },
        (payload) => mergeCustomer(payload.new as Customer))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tn_customers', filter: `user_id=eq.${user.id}` },
        (payload) => mergeCustomer(payload.new as Customer))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, mergeMessage, mergeCustomer]);

  // Threads
  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Thread>();
    for (const m of [...messages].reverse()) {
      const existing = map.get(m.wa_id);
      const customer = customers.find((c) => c.wa_id === m.wa_id);
      const text = extractText(m.payload);
      map.set(m.wa_id, {
        wa_id: m.wa_id,
        name: customer?.name || m.wa_id,
        lastMsg: text || existing?.lastMsg || '',
        lastAt: m.created_at,
        unread: messages.filter((x) => x.wa_id === m.wa_id && x.direction === 'in' && !x.read_at).length,
        avatar_url: customer?.avatar_url,
      });
    }
    // Include customers without messages
    for (const c of customers) {
      if (!map.has(c.wa_id)) {
        map.set(c.wa_id, { wa_id: c.wa_id, name: c.name || c.wa_id, lastMsg: '', lastAt: c.last_seen_at, unread: 0, avatar_url: c.avatar_url });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
      .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.wa_id.includes(search));
  }, [messages, customers, search]);

  // Auto-select first
  useEffect(() => { if (!active && threads.length) setActive(threads[0].wa_id); }, [threads, active]);

  // Active conversation messages
  const convo = useMemo(
    () => messages.filter((m) => m.wa_id === active).slice().reverse(),
    [messages, active]
  );

  useEffect(() => {
    if (!user || !active) return;
    const unread = messages.filter((m) => m.wa_id === active && m.direction === 'in' && !m.read_at).map((m) => m.id);
    if (unread.length === 0) return;
    const readAt = new Date().toISOString();
    setMessages((prev) => prev.map((m) => unread.includes(m.id) ? { ...m, read_at: readAt } : m));
    supabase.from('tn_messages').update({ read_at: readAt }).in('id', unread).eq('user_id', user.id);
  }, [user, active, messages]);

  // Scroll to bottom on new
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [convo.length, active]);

  // AI smart replies
  useEffect(() => {
    if (!active || convo.length === 0) { setAiReplies([]); return; }
    const last = convo[convo.length - 1];
    if (last.direction !== 'in') { setAiReplies([]); return; }
    setLoadingAi(true);
    const recent = convo.slice(-6).map((m) => `${m.direction === 'in' ? 'Customer' : 'Agent'}: ${extractText(m.payload)}`).join('\n');
    supabase.functions.invoke('ai-smart-reply', { body: { context: recent } })
      .then(({ data, error }) => {
        if (!error && data?.replies) setAiReplies(data.replies);
        else setAiReplies([]);
      })
      .finally(() => setLoadingAi(false));
  }, [active, convo.length]);

  const activeCustomer = customers.find((c) => c.wa_id === active);

  const send = async (text: string) => {
    if (!active || !text.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.functions.invoke('whatsapp-send', { body: { to: active, text } });
    setSending(false);
    if (error) { toast.error(error.message || 'Failed to send'); return; }
    setInput('');
    // optimistic
    const optimistic: Msg = {
      id: `tmp-${Date.now()}`,
      wa_id: active,
      direction: 'out',
      payload: { text: { body: text } },
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimistic, ...prev]);
  };

  return (
    <AppLayout>
      <div className="px-3 md:px-4 pt-4 md:pt-6 pb-3">
        <div className="md:h-[calc(100vh-7.5rem)] h-[calc(100vh-10rem)] grid xl:grid-cols-[300px_1fr_300px] md:grid-cols-[280px_1fr] grid-cols-1 gap-3">
          {/* LIST */}
          <aside className={cn('glass-elevated glass-sheen flex-col overflow-hidden', active && 'hidden md:flex', !active && 'flex')}>
            <div className="p-3 border-b border-white/5">
              <h2 className="text-lg font-bold tracking-tight mb-2">Inbox</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 focus:border-primary/40 focus:bg-white/[0.05] focus:outline-none text-sm transition-all"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {threads.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-12 px-4">
                  No conversations yet. They appear here as customers message your WhatsApp number.
                </div>
              )}
              {threads.map((t) => {
                const isActive = active === t.wa_id;
                return (
                  <button
                    key={t.wa_id}
                    onClick={() => setActive(t.wa_id)}
                    className={cn(
                      'w-full text-left flex gap-3 px-3 py-2.5 rounded-xl transition-all',
                      isActive ? 'bg-gradient-to-r from-primary/15 to-secondary/10 ring-1 ring-primary/25' : 'hover:bg-white/[0.04]',
                    )}
                  >
                    <Avatar name={t.name} waId={t.wa_id} avatarUrl={t.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm truncate flex-1">{t.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{t.lastAt && fmtTime(t.lastAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{t.lastMsg || 'No messages yet'}</p>
                    </div>
                    {t.unread > 0 && (
                      <span className="self-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                        {t.unread > 99 ? '99+' : t.unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* CHAT */}
          <section className={cn('glass-elevated glass-sheen flex-col overflow-hidden relative', !active && 'hidden md:flex', active && 'flex')}>
            {active ? (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 px-3 py-3 border-b border-white/5">
                  <button onClick={() => setActive(null)} className="md:hidden p-1.5 rounded-lg hover:bg-white/[0.05] -ml-1">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <Avatar name={activeCustomer?.name || active} waId={active} avatarUrl={activeCustomer?.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{activeCustomer?.name || active}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{formatWhatsAppPhone(active)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconBtn><Phone className="w-4 h-4" /></IconBtn>
                    <IconBtn><Video className="w-4 h-4" /></IconBtn>
                    <IconBtn onClick={() => setPaneCustomerOpen((v) => !v)} className="hidden lg:flex"><MoreHorizontal className="w-4 h-4" /></IconBtn>
                  </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 md:px-6 py-4 space-y-2">
                  {convo.length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-10">No messages in this conversation yet.</div>
                  )}
                  {convo.map((m, i) => {
                    const prev = convo[i - 1];
                    const grouped = prev && prev.direction === m.direction && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60000);
                    const text = extractText(m.payload);
                    const isOut = m.direction === 'out';
                    return (
                      <div key={m.id} className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
                        <div
                          className={cn(
                            'max-w-[78%] px-3.5 py-2 text-sm leading-relaxed break-words',
                            'rounded-2xl',
                            isOut
                              ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-[0_4px_24px_-6px_hsl(211_100%_52%/0.45)] rounded-br-md'
                              : 'bg-white/[0.06] text-foreground border border-white/[0.05] backdrop-blur rounded-bl-md',
                            grouped && (isOut ? 'rounded-tr-md' : 'rounded-tl-md'),
                          )}
                        >
                          <MessageBody message={m} text={text} />
                          <div className={cn('text-[10px] mt-1 opacity-70', isOut ? 'text-white/80' : 'text-muted-foreground')}>
                            {fmtTime(m.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI smart replies */}
                {(aiReplies.length > 0 || loadingAi) && (
                  <div className="px-3 md:px-6 pt-2 pb-1 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    {loadingAi ? (
                      <span className="text-xs text-muted-foreground">AI thinking…</span>
                    ) : (
                      aiReplies.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => send(r)}
                          className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-primary/30 transition-all max-w-[260px] truncate"
                        >
                          {r}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Composer */}
                <div className="p-3 border-t border-white/5">
                  <div className="flex items-end gap-2 px-2 py-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] focus-within:border-primary/40 transition-all">
                    <IconBtn><Paperclip className="w-4 h-4" /></IconBtn>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                      placeholder="Type a message…"
                      rows={1}
                      className="flex-1 bg-transparent text-sm resize-none focus:outline-none py-2 max-h-32"
                    />
                    <IconBtn><Smile className="w-4 h-4" /></IconBtn>
                    {input.trim() ? (
                      <button
                        onClick={() => send(input)}
                        disabled={sending}
                        className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center shadow-glow disabled:opacity-50 magnetic"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    ) : (
                      <IconBtn><Mic className="w-4 h-4" /></IconBtn>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <EmptyChat />
            )}
          </section>

          {/* CUSTOMER PANEL */}
          {active && (
            <aside className="glass-elevated glass-sheen overflow-y-auto custom-scrollbar hidden xl:block">
              <CustomerPanel waId={active} customer={activeCustomer} />
            </aside>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

/* ---------- subcomponents ---------- */

const MessageBody = ({ message, text }: { message: Msg; text: string }) => {
  if (message.direction === 'out' && message.type === 'template') {
    const templateName = message.payload?.template?.name || 'Meta template';
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />Flow template sent</div>
        <div className="text-xs opacity-80 break-all">{templateName}</div>
      </div>
    );
  }
  if (message.type === 'webhook_error') {
    return <div className="flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{text || 'Webhook error'}</div>;
  }
  return <>{text}</>;
};

const Avatar = ({ name, waId, avatarUrl }: { name: string; waId?: string; avatarUrl?: string | null }) => {
  const initials = (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const hue = (name?.charCodeAt(0) || 0) * 37 % 360;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Customer'}
        className="w-10 h-10 rounded-full object-cover shrink-0 shadow-md border border-white/[0.08] bg-muted"
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 80% 55%), hsl(${(hue + 60) % 360} 80% 45%))` }}
      title="Meta does not include customer profile photos in normal webhook payloads"
    >
      {initials || (waId ? waId.slice(-2) : '?')}
    </div>
  );
};

const IconBtn = ({ children, onClick, className }: any) => (
  <button onClick={onClick} className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all', className)}>
    {children}
  </button>
);

const EmptyChat = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
    <div className="relative mb-4">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-secondary blur-2xl opacity-40 animate-pulse-ring" />
      <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow">
        <MessageSquare className="w-7 h-7 text-white" />
      </div>
    </div>
    <h3 className="text-lg font-semibold mb-1">Select a conversation</h3>
    <p className="text-sm text-muted-foreground max-w-xs">Pick a customer from the inbox to start chatting. AI smart replies appear as they type.</p>
  </div>
);

const CustomerPanel = ({ waId, customer }: { waId: string; customer?: Customer }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !waId) return;
    (async () => {
      const [b, p] = await Promise.all([
        supabase.from('tn_bookings').select('*').eq('user_id', user.id).eq('wa_id', waId).order('created_at', { ascending: false }).limit(5),
        supabase.from('tn_payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      ]);
      setBookings(b.data || []);
      const bookingIds = new Set((b.data || []).map((x: any) => x.id));
      setPayments((p.data || []).filter((x: any) => bookingIds.has(x.booking_id)));
    })();
  }, [user, waId]);

  const totalSpend = payments.filter((p) => p.status === 'verified').reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="p-4 space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-3">
          <div className="inline-block">
            <Avatar name={customer?.name || waId} waId={waId} avatarUrl={customer?.avatar_url} />
          </div>
        </div>
        <h3 className="font-semibold tracking-tight">{customer?.name || 'Unnamed customer'}</h3>
        <p className="text-xs text-muted-foreground">{formatWhatsAppPhone(waId)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={CalendarDays} label="Bookings" value={bookings.length} />
        <Stat icon={CreditCard} label="Lifetime ₹" value={totalSpend.toFixed(0)} />
      </div>

      <div>
        <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">AI Summary</h4>
        <div className="glass-panel p-3 text-xs leading-relaxed text-muted-foreground">
          {bookings.length === 0
            ? 'No bookings yet. This is a new lead — guide them through your booking flow.'
            : `Regular customer with ${bookings.length} booking${bookings.length > 1 ? 's' : ''}. Last interaction ${fmtTime(customer?.last_seen_at || new Date().toISOString())}.`}
        </div>
      </div>

      <div>
        <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">Recent Bookings</h4>
        <div className="space-y-2">
          {bookings.length === 0 && <p className="text-xs text-muted-foreground">No bookings.</p>}
          {bookings.map((b) => (
            <div key={b.id} className="glass-panel p-2.5 flex items-center gap-2">
              <div className="w-1 h-8 rounded-full bg-gradient-to-b from-primary to-secondary" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{b.service_name}</p>
                <p className="text-[10px] text-muted-foreground">₹{b.price} • {b.status}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value }: any) => (
  <div className="glass-panel p-3">
    <Icon className="w-4 h-4 text-primary mb-1.5" />
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
    <p className="text-lg font-bold mt-0.5">{value}</p>
  </div>
);

export default Inbox;

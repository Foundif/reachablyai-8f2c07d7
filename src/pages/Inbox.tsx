import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Inbox as InboxIcon, Send, Search, User, Clock, MessageSquareText, ArrowLeft, Trash2, Tag, StickyNote, X, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { resolveWorkspaceId } from '@/lib/workspace';

interface Conversation {
  id: string;
  contact_phone: string;
  contact_name: string | null;
  assigned_to: string | null;
  status: string;
  last_message_at: string;
  last_message_text: string | null;
  last_message_direction: string | null;
  unread_count: number;
  window_expires_at: string | null;
  notes?: string | null;
  tags?: string[] | null;
}
interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string | null;
  status: string;
  message_type: string;
  template_name: string | null;
  created_at: string;
  sent_by: string | null;
  error: string | null;
}
interface Member { user_id: string; email: string; full_name: string | null; hasProfile: boolean; }
interface Template { id: string; name: string; status: string; }

const displayName = (m?: Member | null) =>
  m ? (m.full_name?.trim() || (m.email?.includes('@') ? m.email.split('@')[0] : m.email) || 'Teammate') : 'Unassigned';

const Inbox = () => {
  const { user, profile } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned' | 'unread'>('all');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => convs.find(c => c.id === selectedId) || null, [convs, selectedId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const id = await resolveWorkspaceId(user.id, profile);
      if (!id) return;
      setWsId(id);

      const [{ data: cs }, { data: ms }, { data: ts }] = await Promise.all([
        supabase.from('wa_conversations' as any).select('*').eq('workspace_id', id).is('deleted_at', null).order('last_message_at', { ascending: false }),
        supabase.from('workspace_members' as any).select('user_id').eq('workspace_id', id),
        supabase.from('templates' as any).select('id,name,status').eq('workspace_id', id).eq('status', 'approved'),
      ]);
      setConvs((cs as any) || []);
      const memberIds = ((ms as any[]) || []).map(m => m.user_id).filter(Boolean);
      if (memberIds.length) {
        const { data: profs } = await supabase.from('profiles' as any)
          .select('user_id, email, full_name').in('user_id', memberIds);
        const byId = new Map(((profs as any[]) || []).map(p => [p.user_id, p]));
        setMembers(memberIds.map(uid => {
          const p = byId.get(uid);
          return {
            user_id: uid,
            email: p?.email || '',
            full_name: p?.full_name || null,
            hasProfile: !!p,
          };
        }));
      } else {
        setMembers([]);
      }
      setTemplates((ts as any) || []);
    })();
  }, [user, profile]);

  // Realtime for conversations & messages
  useEffect(() => {
    if (!wsId) return;
    const ch = supabase
      .channel(`inbox-${wsId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations', filter: `workspace_id=eq.${wsId}` }, async () => {
        const { data } = await supabase.from('wa_conversations' as any).select('*').eq('workspace_id', wsId).is('deleted_at', null).order('last_message_at', { ascending: false });
        setConvs((data as any) || []);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_messages', filter: `workspace_id=eq.${wsId}` }, (payload: any) => {
        if (payload.new.conversation_id === selectedId) {
          setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId, selectedId]);

  // Load messages when selecting
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    (async () => {
      const { data } = await supabase.from('wa_messages' as any).select('*').eq('conversation_id', selectedId).order('created_at');
      setMessages((data as any) || []);
      // Mark read
      await supabase.from('wa_conversations' as any).update({ unread_count: 0 }).eq('id', selectedId);
    })();
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const filtered = convs.filter(c => {
    if (search && !(`${c.contact_name || ''} ${c.contact_phone}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filter === 'mine' && c.assigned_to !== user?.id) return false;
    if (filter === 'unassigned' && c.assigned_to) return false;
    if (filter === 'unread' && !c.unread_count) return false;
    return true;
  });

  const windowOpen = selected?.window_expires_at ? new Date(selected.window_expires_at) > new Date() : false;

  const send = async () => {
    if (!selected || !draft.trim() || !wsId) return;
    setSending(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: { workspace_id: wsId, conversation_id: selected.id, to: selected.contact_phone, body: draft },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setDraft('');
  };

  const sendTemplate = async (templateId: string) => {
    if (!selected || !wsId) return;
    setSending(true);
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: { workspace_id: wsId, conversation_id: selected.id, to: selected.contact_phone, template_id: templateId },
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success('Template sent');
  };

  const canAssign = !profile?.is_staff || profile?.role === 'admin';
  const assignedMember = useMemo(
    () => members.find(m => m.user_id === selected?.assigned_to) || null,
    [members, selected?.assigned_to],
  );

  const assign = async (userId: string | null) => {
    if (!selected) return;
    if (!canAssign) return toast.error('Only owners/admins can assign chats');
    const { error } = await supabase.from('wa_conversations' as any).update({ assigned_to: userId }).eq('id', selected.id);
    if (error) return toast.error(error.message);
    setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, assigned_to: userId } : c));
    if (userId) {
      const m = members.find(mm => mm.user_id === userId);
      toast.success(`Chat assigned to ${displayName(m)}`);
    } else {
      toast.success('Chat unassigned');
    }
  };

  const saveNotes = async (notes: string) => {
    if (!selected) return;
    setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, notes } : c));
    await supabase.from('wa_conversations' as any).update({ notes }).eq('id', selected.id);
  };

  const saveTags = async (tags: string[]) => {
    if (!selected) return;
    setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, tags } : c));
    await supabase.from('wa_conversations' as any).update({ tags }).eq('id', selected.id);
  };

  const toggleStatus = async () => {
    if (!selected) return;
    const next = selected.status === 'open' ? 'closed' : 'open';
    const { error } = await supabase.from('wa_conversations' as any).update({ status: next }).eq('id', selected.id);
    if (error) return toast.error(error.message);
    setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, status: next } : c));
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    // Soft delete — history preserved so we can undo
    const { error } = await supabase.from('wa_conversations' as any)
      .update({ deleted_at: new Date().toISOString() }).eq('id', target.id);
    if (error) return toast.error(error.message);
    setConvs(prev => prev.filter(c => c.id !== target.id));
    if (selectedId === target.id) { setSelectedId(null); setShowMobileChat(false); }
    toast.success('Chat deleted', {
      description: target.contact_name || target.contact_phone,
      action: {
        label: 'Undo',
        onClick: async () => {
          const { error: e } = await supabase.from('wa_conversations' as any)
            .update({ deleted_at: null }).eq('id', target.id);
          if (e) return toast.error(e.message);
          setConvs(prev => prev.some(c => c.id === target.id) ? prev : [{ ...target, deleted_at: null } as any, ...prev]);
          toast.success('Chat restored');
        },
      },
      duration: 8000,
    });
  };

  const startChat = async (rawPhone: string, name?: string | null) => {
    if (!wsId) return;
    const phone = rawPhone.replace(/[^\d]/g, '');
    if (phone.length < 8) return toast.error('Enter a valid phone number with country code');
    // Check if conversation exists (including soft-deleted)
    const { data: existing } = await supabase.from('wa_conversations' as any)
      .select('*').eq('workspace_id', wsId).eq('contact_phone', phone).maybeSingle();
    let conv = existing as any;
    if (conv) {
      if (conv.deleted_at) {
        await supabase.from('wa_conversations' as any).update({ deleted_at: null }).eq('id', conv.id);
        conv = { ...conv, deleted_at: null };
      }
    } else {
      const { data: created, error } = await supabase.from('wa_conversations' as any)
        .insert({ workspace_id: wsId, contact_phone: phone, contact_name: name || null, status: 'open' })
        .select('*').single();
      if (error) return toast.error(error.message);
      conv = created;
    }
    setConvs(prev => prev.some(c => c.id === conv.id) ? prev : [conv as Conversation, ...prev]);
    setSelectedId(conv.id);
    setShowMobileChat(true);
    setNewChatOpen(false);
    toast.success('Chat ready — send an approved template to start the 24h window');
  };

  // Auto-open chat from ?phone=&name= (e.g. deep-link from Contacts page)
  useEffect(() => {
    if (!wsId) return;
    const phone = searchParams.get('phone');
    if (!phone) return;
    const name = searchParams.get('name') || null;
    startChat(phone, name);
    searchParams.delete('phone');
    searchParams.delete('name');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  const tabCounts = useMemo(() => ({
    new: convs.filter(c => c.unread_count > 0).length,
    open: convs.filter(c => c.status === 'open').length,
    resolved: convs.filter(c => c.status !== 'open').length,
    all: convs.length,
  }), [convs]);

  const windowHoursLeft = selected?.window_expires_at
    ? Math.max(0, Math.ceil((new Date(selected.window_expires_at).getTime() - Date.now()) / 3_600_000))
    : 0;

  return (
    <AppLayout fullBleed>
      <div className="flex h-[calc(100dvh-10.5rem)] md:h-[100dvh] w-full overflow-hidden bg-background">
        {/* ============ Conversation list ============ */}
        <aside className={cn('w-full md:w-[330px] shrink-0 flex flex-col border-r bg-card', showMobileChat && 'hidden md:flex')}>
          <div className="p-3 border-b space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" className="pl-8 h-9 rounded-full" />
              </div>
              <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                <SelectTrigger className="h-9 w-9 p-0 justify-center rounded-full border" aria-label="Filter">
                  <Filter className="w-4 h-4" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">All conversations</SelectItem>
                  <SelectItem value="mine">Assigned to me</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => setNewChatOpen(true)} title="New chat">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 -mb-3">
              {([
                { id: 'new', label: 'New', icon: MessageSquareText },
                { id: 'open', label: 'Open', icon: InboxIcon },
                { id: 'resolved', label: 'Resolved', icon: CheckCircle2 },
                { id: 'all', label: 'All', icon: Users },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 px-1 pb-2 text-[11px] font-medium border-b-2 transition-colors',
                    tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                  {tabCounts[t.id] > 0 && (
                    <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] leading-4">{tabCounts[t.id]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <MessageSquareText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No conversations here yet.
              </div>
            )}
            {filtered.map(c => {
              const active = c.id === selectedId;
              const assignee = members.find(m => m.user_id === c.assigned_to) || null;
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setShowMobileChat(true); }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 transition-colors relative',
                    active && 'bg-muted before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(c.contact_name || c.contact_phone)[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate flex-1">{c.contact_name || c.contact_phone}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.last_message_direction === 'outbound' && '→ '}{c.last_message_text || '—'}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-muted-foreground truncate">
                          {assignee ? displayName(assignee) : 'Unassigned'}
                        </span>
                        {c.unread_count > 0 && (
                          <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{c.unread_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ============ Chat ============ */}
        <section className={cn('flex-1 min-w-0 flex flex-col', !showMobileChat && 'hidden md:flex')}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm wa-doodle-bg">
              <div className="text-center"><InboxIcon className="w-12 h-12 mx-auto mb-3 opacity-40" /><p>Select a conversation</p></div>
            </div>
          ) : (
            <>
              <header className="h-14 shrink-0 px-3 border-b flex items-center gap-2 bg-card">
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setShowMobileChat(false)}><ArrowLeft className="w-4 h-4" /></Button>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {(selected.contact_name || selected.contact_phone)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate leading-tight">{selected.contact_name || selected.contact_phone}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{selected.contact_phone}</div>
                </div>

                {/* 24h window ring */}
                <div
                  title={windowOpen ? `24h window expires in ~${windowHoursLeft}h` : '24h window closed — send a template'}
                  className={cn(
                    'ml-2 w-8 h-8 shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] font-semibold',
                    windowOpen ? 'border-emerald-500 text-emerald-600' : 'border-muted-foreground/30 text-muted-foreground',
                  )}
                >
                  {windowOpen ? windowHoursLeft : '—'}
                </div>

                <div className="ml-auto flex items-center gap-1.5">
                  {canAssign ? (
                    <Select value={selected.assigned_to || 'none'} onValueChange={(v) => assign(v === 'none' ? null : v)}>
                      <SelectTrigger className="h-8 w-[150px] text-xs hidden sm:flex"><User className="w-3 h-3 mr-1" /><SelectValue placeholder="Assign" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {members.filter(m => m.hasProfile).map(m => <SelectItem key={m.user_id} value={m.user_id}>{displayName(m)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="h-8 px-3 gap-1 hidden sm:flex">
                      <User className="w-3 h-3" />{assignedMember ? displayName(assignedMember) : 'Unassigned'}
                    </Badge>
                  )}
                  <Button size="sm" variant="outline" className="h-8 hidden sm:inline-flex" onClick={toggleStatus}>
                    {selected.status === 'open' ? 'Resolve' : 'Reopen'}
                  </Button>
                  {canAssign && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setPendingDelete(selected)} title="Delete chat">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                  <Button
                    size="icon" variant="ghost" className="h-8 w-8 hidden lg:inline-flex"
                    onClick={() => setPanelOpen(o => !o)}
                    title={panelOpen ? 'Hide contact panel' : 'Show contact panel'}
                  >
                    {panelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                  </Button>
                </div>
              </header>

              {selected.assigned_to && (
                <div className="px-4 py-1.5 border-b bg-primary/5 text-[11px] text-muted-foreground flex items-center gap-2 shrink-0">
                  <User className="w-3 h-3" />
                  Assigned to <span className="font-medium text-foreground">{displayName(assignedMember)}</span>
                </div>
              )}

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5 wa-doodle-bg">
                {messages.map(m => (
                  <div key={m.id} className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                      m.direction === 'outbound' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border rounded-bl-md',
                    )}>
                      {m.template_name && <div className="text-[10px] opacity-70 uppercase mb-1">Template · {m.template_name}</div>}
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] opacity-70">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {m.direction === 'outbound' && <span>· {m.status}</span>}
                      </div>
                      {m.error && <div className="text-[10px] text-red-500 mt-1">{m.error}</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t p-3 space-y-2 bg-card shrink-0">
                {!windowOpen && (
                  <div className="text-[11px] text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
                    24-hour reply window closed. Send an approved template to reopen the conversation.
                  </div>
                )}
                {templates.length > 0 && (
                  <Select onValueChange={(v) => sendTemplate(v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Send approved template…" /></SelectTrigger>
                    <SelectContent>
                      {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex gap-2">
                  <Input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={windowOpen ? 'Type a message…' : 'Free-form disabled outside 24h window'}
                    disabled={!windowOpen || sending}
                    className="rounded-full"
                  />
                  <Button onClick={send} disabled={!draft.trim() || sending || !windowOpen} size="icon" className="rounded-full shrink-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ============ Contact panel ============ */}
        {selected && panelOpen && (
          <aside className="w-[300px] shrink-0 hidden lg:flex flex-col border-l bg-card">
            <ContactPanel
              key={selected.id}
              conversation={selected}
              assigneeName={assignedMember ? displayName(assignedMember) : null}
              onClose={() => setPanelOpen(false)}
              onSaveNotes={saveNotes}
              onSaveTags={saveTags}
            />
          </aside>
        )}
      </div>


      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Chat with <b>{pendingDelete?.contact_name || pendingDelete?.contact_phone}</b> will be hidden.
              Message history is preserved and you can undo this action for a few seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete chat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        workspaceId={wsId}
        onStart={startChat}
      />
    </AppLayout>
  );
};

function NewChatDialog({
  open, onOpenChange, workspaceId, onStart,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string | null;
  onStart: (phone: string, name?: string | null) => void;
}) {
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState<{ id: string; name: string | null; phone: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !workspaceId) return;
    setPhone(''); setName(''); setQ('');
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('leads' as any)
        .select('id, name, phone').eq('workspace_id', workspaceId)
        .not('phone', 'is', null).order('updated_at', { ascending: false }).limit(200);
      setContacts((data as any) || []);
      setLoading(false);
    })();
  }, [open, workspaceId]);

  const filtered = contacts.filter(c => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (c.name || '').toLowerCase().includes(s) || (c.phone || '').includes(s);
  });

  const submitNew = () => {
    const clean = phone.replace(/[^\d]/g, '');
    const cc = countryCode.replace(/[^\d]/g, '');
    if (!clean) return toast.error('Enter a phone number');
    onStart(`${cc}${clean}`, name || null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b shrink-0 text-left">
          <DialogTitle className="text-base sm:text-lg">Start new chat</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">Pick a contact or enter a new WhatsApp number.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">New number</div>
            <div className="flex gap-2">
              <Input
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                placeholder="+91"
                className="w-16 sm:w-20 shrink-0"
              />
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Phone number"
                className="flex-1 min-w-0"
                inputMode="tel"
              />
            </div>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Contact name (optional)" />
            <Button onClick={submitNew} className="w-full" disabled={!phone.trim()}>Start chat</Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or choose contact</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search contacts" className="pl-8 h-9" />
            </div>
            <div className="max-h-[40vh] sm:max-h-64 overflow-y-auto border rounded-md divide-y">
              {loading && <div className="p-4 text-center text-xs text-muted-foreground">Loading…</div>}
              {!loading && filtered.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">No contacts found</div>
              )}
              {filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => onStart(c.phone, c.name)}
                  className="w-full text-left p-2.5 hover:bg-muted/50 flex items-center gap-2"
                >
                  <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white text-[11px] font-bold">
                    {(c.name || c.phone)[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name || c.phone}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.phone}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 sm:p-4 border-t shrink-0 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotesPanel({
  conversation, onSaveNotes, onSaveTags,
}: {
  conversation: Conversation;
  onSaveNotes: (v: string) => void | Promise<void>;
  onSaveTags: (v: string[]) => void | Promise<void>;
}) {
  const [notes, setNotes] = useState(conversation.notes || '');
  const [tags, setTags] = useState<string[]>(conversation.tags || []);
  const [tagDraft, setTagDraft] = useState('');
  const notesDirty = useRef(false);

  useEffect(() => {
    setNotes(conversation.notes || '');
    setTags(conversation.tags || []);
    notesDirty.current = false;
  }, [conversation.id]);

  useEffect(() => {
    if (!notesDirty.current) return;
    const t = setTimeout(() => { onSaveNotes(notes); notesDirty.current = false; }, 700);
    return () => clearTimeout(t);
  }, [notes]);

  const addTag = () => {
    const v = tagDraft.trim();
    if (!v || tags.includes(v)) { setTagDraft(''); return; }
    const next = [...tags, v];
    setTags(next); setTagDraft('');
    onSaveTags(next);
  };
  const removeTag = (t: string) => {
    const next = tags.filter(x => x !== t);
    setTags(next); onSaveTags(next);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b flex items-center gap-2">
        <StickyNote className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Lead details</h3>
      </div>
      <div className="p-3 space-y-4 overflow-y-auto flex-1">
        <div>
          <div className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
            <Tag className="w-3 h-3" /> Tags
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.length === 0 && <span className="text-[11px] text-muted-foreground">No tags yet</span>}
            {tags.map(t => (
              <Badge key={t} variant="secondary" className="gap-1 pr-1">
                {t}
                <button onClick={() => removeTag(t)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={tagDraft}
              onChange={e => setTagDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Add tag (e.g. VIP, hot-lead)"
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" className="h-8" onClick={addTag}>Add</Button>
          </div>
        </div>
        <div>
          <div className="text-xs font-medium mb-1.5">Notes</div>
          <Textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); notesDirty.current = true; }}
            placeholder="Write anything about this lead — preferences, follow-ups, quoted price…"
            className="text-sm min-h-[220px] resize-none"
          />
          <div className="text-[10px] text-muted-foreground mt-1">Auto-saves as you type</div>
        </div>
      </div>
    </div>
  );
}

export default Inbox;

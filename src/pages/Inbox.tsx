import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Inbox as InboxIcon, Send, Search, User, Clock, MessageSquareText, ArrowLeft, Trash2, Tag, StickyNote, X } from 'lucide-react';
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

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] max-w-7xl mx-auto p-2 md:p-4 gap-3">
        {/* List */}
        <Card className={cn('w-full md:w-80 flex flex-col', showMobileChat && 'hidden md:flex')}>
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center gap-2">
              <InboxIcon className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Team Inbox</h2>
              <Badge variant="outline" className="ml-auto">{convs.length}</Badge>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" className="pl-8 h-9" />
            </div>
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All conversations</SelectItem>
                <SelectItem value="mine">Assigned to me</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <MessageSquareText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No conversations yet. Once customers message your WhatsApp number, they'll appear here.
              </div>
            )}
            {filtered.map(c => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setShowMobileChat(true); }}
                  className={cn('w-full text-left p-3 border-b hover:bg-muted/50 transition-colors', active && 'bg-primary/10')}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(c.contact_name || c.contact_phone)[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{c.contact_name || c.contact_phone}</div>
                      <div className="text-[11px] text-muted-foreground">{c.contact_phone}</div>
                    </div>
                    {c.unread_count > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{c.unread_count}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.last_message_direction === 'outbound' && '→ '}{c.last_message_text || '—'}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Chat */}
        <Card className={cn('flex-1 flex flex-col', !showMobileChat && 'hidden md:flex')}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center"><InboxIcon className="w-12 h-12 mx-auto mb-3 opacity-40" /><p>Select a conversation</p></div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center gap-3 flex-wrap">
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setShowMobileChat(false)}><ArrowLeft className="w-4 h-4" /></Button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white font-bold">
                  {(selected.contact_name || selected.contact_phone)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{selected.contact_name || selected.contact_phone}</div>
                  <div className="text-xs text-muted-foreground">{selected.contact_phone}</div>
                </div>
                <div className="flex items-center gap-2">
                  {canAssign ? (
                    <Select value={selected.assigned_to || 'none'} onValueChange={(v) => assign(v === 'none' ? null : v)}>
                      <SelectTrigger className="h-8 w-[180px] text-xs"><User className="w-3 h-3 mr-1" /><SelectValue placeholder="Assign" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {members
                          .filter(m => m.hasProfile)
                          .map(m => <SelectItem key={m.user_id} value={m.user_id}>{displayName(m)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="h-8 px-3 gap-1">
                      <User className="w-3 h-3" />{assignedMember ? displayName(assignedMember) : 'Unassigned'}
                    </Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={toggleStatus}>{selected.status === 'open' ? 'Close' : 'Reopen'}</Button>
                  {canAssign && (
                    <Button size="sm" variant="ghost" onClick={() => setPendingDelete(selected)} title="Delete chat"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  )}
                </div>
              </div>

              {selected.assigned_to && (
                <div className="px-4 py-2 border-b bg-primary/5 text-xs text-muted-foreground flex items-center gap-2">
                  <User className="w-3 h-3" />
                  This chat is assigned to <span className="font-medium text-foreground">{displayName(assignedMember)}</span>
                </div>
              )}

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                {messages.map(m => (
                  <div key={m.id} className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
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

              <div className="border-t p-3 space-y-2">
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
                  />
                  <Button onClick={send} disabled={!draft.trim() || sending || !windowOpen}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Notes & Tags */}
        {selected && (
          <Card className={cn('w-72 hidden lg:flex flex-col')}>
            <NotesPanel
              key={selected.id}
              conversation={selected}
              onSaveNotes={saveNotes}
              onSaveTags={saveTags}
            />
          </Card>
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
    </AppLayout>
  );
};

export default Inbox;

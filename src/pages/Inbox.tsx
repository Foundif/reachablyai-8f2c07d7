import { usePageVisible } from "@/hooks/usePageVisible";
import { useEffect, useMemo, useRef, useState } from "react";
import { SecureImg, SecureVideo, resolveMediaUrl } from "@/lib/secureMedia";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Inbox as InboxIcon,
  Send,
  Search,
  User,
  Clock,
  MessageSquareText,
  ArrowLeft,
  Trash2,
  Tag,
  StickyNote,
  X,
  Plus,
  Filter,
  CheckCircle2,
  Users,
  PanelRightClose,
  PanelRightOpen,
  Phone,
  Mail,
  Paperclip,
  Image as ImageIcon,
  Video,
  FileText,
  MapPin,
  Mic,
  Square,
  Loader2,
  Smile,
  PhoneCall,
  Forward,
  Images,
  CheckSquare,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label as FieldLabel } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { resolveWorkspaceId } from "@/lib/workspace";
import { COUNTRY_CODES } from "@/lib/countryCodes";
import VoiceNote from "@/components/inbox/VoiceNote";
import MessageTicks from "@/components/inbox/MessageTicks";
import AlbumComposer from "@/components/inbox/AlbumComposer";
import ForwardDialog from "@/components/inbox/ForwardDialog";
import TemplatePickerSheet, { renderTemplateText, type TemplateOption } from "@/components/inbox/TemplatePickerSheet";
import ConversationRecords from "@/components/inbox/ConversationRecords";
import {
  useQuickReplies,
  slashQuery,
  filterReplies,
  SlashMenu,
  QuickReplyManager,
} from "@/components/inbox/QuickReplies";
import { playAlert } from "@/lib/sound";

const EMOJIS =
  "😀😁😂🤣😃😄😅😆😉😊😋😎😍😘😗😙😚☺🙂🤗🤩🤔🤨😐😑😶🙄😏😣😥😮🤐😯😪😫🥱😴😌😛😜😝🤤😒😓😔😕🙃🤑😲☹🙁😖😞😟😤😢😭😦😧😨😩🤯😬😰😱🥵🥶😳🤪😵🥴😠😡🤬😷🤒🤕🤢🤮🤧😇🤠🥳🥺🤫🤭🧐🤓☻"
    .split(/(?=[\s\S])/u)
    .filter((c) => c.trim().length > 0);

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
  direction: "inbound" | "outbound";
  body: string | null;
  status: string;
  message_type: string;
  media_url?: string | null;
  template_name: string | null;
  created_at: string;
  sent_by: string | null;
  error: string | null;
}
interface Member {
  user_id: string;
  email: string;
  full_name: string | null;
  hasProfile: boolean;
}
type Template = TemplateOption;
interface Label {
  id: string;
  name: string;
  color: string;
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

const LABEL_COLORS = ["#25D366", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const displayName = (m?: Member | null) =>
  m ? m.full_name?.trim() || (m.email?.includes("@") ? m.email.split("@")[0] : m.email) || "Teammate" : "Unassigned";

const Inbox = () => {
  const { user, profile } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const quickReplies = useQuickReplies(wsId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [qrActive, setQrActive] = useState(0);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine" | "unassigned" | "unread">("all");
  const [tab, setTab] = useState<"new" | "open" | "resolved" | "all">("all");
  const [labels, setLabels] = useState<Label[]>([]);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const [showMobileChat, setShowMobileChat] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live clock so the 24h window timer ticks in real time
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const [intervened, setIntervened] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<{ name: string; pct: number } | null>(null);

  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [locOpen, setLocOpen] = useState(false);
  const [locForm, setLocForm] = useState({ latitude: "", longitude: "", name: "", address: "" });

  // Multi-photo album composer
  const [albumOpen, setAlbumOpen] = useState(false);
  const [albumFiles, setAlbumFiles] = useState<File[]>([]);
  const [albumSending, setAlbumSending] = useState(false);
  const [albumProgress, setAlbumProgress] = useState<{ done: number; total: number } | null>(null);

  // Multi-select + forward
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwarding, setForwarding] = useState(false);

  // Wati Astra voice calling
  const [calling, setCalling] = useState(false);

  const selected = useMemo(() => convs.find((c) => c.id === selectedId) || null, [convs, selectedId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const id = await resolveWorkspaceId(user.id, profile);
      if (!id) return;
      setWsId(id);

      const [{ data: cs }, { data: ms }, { data: ts }, { data: ls }] = await Promise.all([
        supabase
          .from("wa_conversations" as any)
          .select("*")
          .eq("workspace_id", id)
          .is("deleted_at", null)
          .order("last_message_at", { ascending: false }),
        supabase
          .from("workspace_members" as any)
          .select("user_id")
          .eq("workspace_id", id),
        supabase
          .from("templates" as any)
          .select("id,name,status,language,category,body,header,header_type,header_media_url,footer")
          .eq("workspace_id", id)
          .eq("status", "approved"),
        supabase
          .from("wa_labels" as any)
          .select("id,name,color")
          .eq("workspace_id", id)
          .order("created_at"),
      ]);
      setConvs((cs as any) || []);
      setLabels((ls as any) || []);

      const memberIds = ((ms as any[]) || []).map((m) => m.user_id).filter(Boolean);
      if (memberIds.length) {
        const { data: profs } = await supabase
          .from("profiles" as any)
          .select("user_id, email, full_name")
          .in("user_id", memberIds);
        const byId = new Map(((profs as any[]) || []).map((p) => [p.user_id, p]));
        setMembers(
          memberIds.map((uid) => {
            const p = byId.get(uid);
            return {
              user_id: uid,
              email: p?.email || "",
              full_name: p?.full_name || null,
              hasProfile: !!p,
            };
          }),
        );
      } else {
        setMembers([]);
      }
      setTemplates((ts as any) || []);
    })();
  }, [user, profile]);

  // Realtime for conversations & messages with Sound and Zero Function Calls
  const visible = usePageVisible();
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    if (!wsId) return;
    const ch = supabase
      .channel(`inbox-live-${wsId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_conversations", filter: `workspace_id=eq.${wsId}` },
        async (payload: any) => {
          if (payload.new && payload.new.last_message_direction === "inbound") {
            playAlert();
          }
          const { data } = await supabase
            .from("wa_conversations" as any)
            .select("*")
            .eq("workspace_id", wsId)
            .is("deleted_at", null)
            .order("last_message_at", { ascending: false });
          setConvs((data as any) || []);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wa_messages", filter: `workspace_id=eq.${wsId}` },
        (payload: any) => {
          if (payload.new.direction === "inbound") {
            playAlert();
          }
          if (payload.new.conversation_id === selectedRef.current) {
            setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wa_messages", filter: `workspace_id=eq.${wsId}` },
        (payload: any) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [wsId]);

  // Load messages when selecting a chat
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let stale = false;
    (async () => {
      const { data } = await supabase
        .from("wa_messages" as any)
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at");
      if (stale) return;
      setMessages((data as any) || []);
      await supabase
        .from("wa_conversations" as any)
        .update({ unread_count: 0 })
        .eq("id", selectedId);
    })();
    return () => {
      stale = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const filtered = convs.filter((c) => {
    if (search && !`${c.contact_name || ""} ${c.contact_phone}`.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (filter === "mine" && c.assigned_to !== user?.id) return false;
    if (filter === "unassigned" && c.assigned_to) return false;
    if (filter === "unread" && !c.unread_count) return false;
    if (labelFilter && !(c.tags || []).includes(labelFilter)) return false;
    if (tab === "new" && !c.unread_count) return false;
    if (tab === "open" && c.status !== "open") return false;
    if (tab === "resolved" && c.status === "open") return false;
    return true;
  });

  const windowExpiresAt = selected?.window_expires_at ? new Date(selected.window_expires_at).getTime() : 0;
  const is24hExpired = windowExpiresAt ? now > windowExpiresAt : false;
  const hoursRemaining = Math.max(0, Math.floor((windowExpiresAt - now) / 3600000));
  const minsRemaining = Math.max(0, Math.floor(((windowExpiresAt - now) % 3600000) / 60000));

  const handleSend = async () => {
    if (!draft.trim() || !selected || !wsId) return;
    setSending(true);
    const textToSend = draft.trim();
    setDraft("");

    try {
      const res = await supabase.functions.invoke("whatsapp-send", {
        body: {
          workspace_id: wsId,
          to: selected.contact_phone,
          message: textToSend,
          type: "text",
          conversation_id: selected.id,
        },
      });
      if (res.error) throw res.error;
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
      setDraft(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSend = async (tpl: TemplateOption, renderedBody: string) => {
    if (!selected || !wsId) return;
    setSending(true);
    try {
      const res = await supabase.functions.invoke("whatsapp-send", {
        body: {
          workspace_id: wsId,
          to: selected.contact_phone,
          type: "template",
          template_id: tpl.id,
          template_name: tpl.name,
          conversation_id: selected.id,
        },
      });
      if (res.error) throw res.error;
      toast.success(`Template ${tpl.name} sent!`);
      setTemplatePickerOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send template");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full w-full overflow-hidden bg-background">
        {/* Left column: Conversation list */}
        <div
          className={cn(
            "flex flex-col border-r border-border bg-card/40 w-full md:w-80 lg:w-96 shrink-0",
            showMobileChat && "hidden md:flex",
          )}
        >
          {/* Header */}
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <InboxIcon className="h-5 w-5 text-primary" />
              Inbox
            </h2>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setNewChatOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> New
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search phone or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 p-2 border-b border-border text-xs overflow-x-auto">
            {(["all", "unread", "mine", "unassigned"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "ghost"}
                className="h-7 px-2.5 capitalize text-xs"
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No chats found</div>
            ) : (
              filtered.map((c) => {
                const isSel = c.id === selectedId;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedId(c.id);
                      setShowMobileChat(true);
                    }}
                    className={cn(
                      "p-3 cursor-pointer hover:bg-muted/40 transition-colors flex gap-3 items-start",
                      isSel && "bg-muted/80",
                    )}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                      {(c.contact_name || c.contact_phone).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{c.contact_name || c.contact_phone}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {c.last_message_at ? dayLabel(c.last_message_at) : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.last_message_text || "No messages yet"}
                      </p>
                      {c.unread_count > 0 && (
                        <span className="mt-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Messages view */}
        <div className={cn("flex-1 flex flex-col min-w-0 bg-background", !showMobileChat && "hidden md:flex")}>
          {selected ? (
            <>
              {/* Chat Header */}
              <div className="h-14 border-b border-border px-4 flex items-center justify-between shrink-0 bg-card/30">
                <div className="flex items-center gap-3 min-w-0">
                  <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setShowMobileChat(false)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                    {(selected.contact_name || selected.contact_phone).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{selected.contact_name || selected.contact_phone}</p>
                    <p className="text-[11px] text-muted-foreground truncate">+{selected.contact_phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {is24hExpired ? (
                    <Badge variant="destructive" className="text-[10px] uppercase">
                      24h window closed (Template only)
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                    >
                      24h window active: {hoursRemaining}h {minsRemaining}m
                    </Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setTemplatePickerOpen(true)}>
                    Send Template
                  </Button>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No messages yet in this conversation.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isOut = m.direction === "outbound";
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex flex-col max-w-[75%] space-y-1",
                          isOut ? "ml-auto items-end" : "mr-auto items-start",
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2 text-sm shadow-sm whitespace-pre-wrap break-words",
                            isOut
                              ? "bg-primary text-primary-foreground rounded-br-xs"
                              : "bg-card border border-border/60 text-card-foreground rounded-bl-xs",
                          )}
                        >
                          {m.body}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-1">
                          <span>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {isOut && <MessageTicks status={m.status} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Compose Bar */}
              <div className="p-3 border-t border-border bg-card/40 shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={is24hExpired ? "24h window closed — click 'Send Template' above" : "Type a message..."}
                    value={draft}
                    disabled={is24hExpired || sending}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button size="icon" disabled={is24hExpired || !draft.trim() || sending} onClick={handleSend}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
              <MessageSquareText className="h-12 w-12 stroke-[1.25] text-muted-foreground/40 mb-3" />
              <p className="font-medium text-sm">Select a conversation to read and reply</p>
              <p className="text-xs text-muted-foreground/80 mt-1">Realtime updates are connected</p>
            </div>
          )}
        </div>
      </div>

      <TemplatePickerSheet
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        templates={templates}
        recipientName={selected?.contact_name || "Customer"}
        recipientPhone={selected?.contact_phone || ""}
        onSelectTemplate={handleTemplateSend}
      />
    </AppLayout>
  );
};

export default Inbox;

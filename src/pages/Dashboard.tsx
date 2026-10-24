import { usePageVisible } from "@/hooks/usePageVisible";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Contact,
  Inbox,
  Megaphone,
  Workflow,
  ArrowRight,
  Send,
  Wallet,
  Sparkles,
  Upload,
  ClipboardList,
  Clock,
  IndianRupee,
  HelpCircle,
} from "lucide-react";

import { resolveWorkspaceId } from "@/lib/workspace";
import ConnectWhatsAppCard from "@/components/home/ConnectWhatsAppCard";
import SetupProgressCard from "@/components/home/SetupProgressCard";
import TodayActivityCard from "@/components/home/TodayActivityCard";
import OverviewGrid from "@/components/home/OverviewGrid";

const QuickCard = ({ icon: Icon, title, desc, cta, to, navigate, tint }: any) => (
  <button
    onClick={() => navigate(to)}
    className="group relative text-left p-5 rounded-2xl border bg-card hover:shadow-glow transition-all overflow-hidden"
  >
    <div className={`absolute inset-0 opacity-[0.07] group-hover:opacity-[0.14] transition-opacity ${tint}`} />
    <div className="relative flex items-start justify-between">
      <div className="p-2.5 rounded-xl bg-muted">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[10px] font-semibold tracking-widest text-muted-foreground">OPEN</span>
    </div>
    <p className="relative mt-4 font-semibold">{title}</p>
    <p className="relative text-sm text-muted-foreground mt-1">{desc}</p>
    <span className="relative mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
      {cta} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
    </span>
  </button>
);

const ModuleTile = ({ icon: Icon, label, value, hint, gradient, to, navigate }: any) => (
  <button
    onClick={() => navigate(to)}
    className="group relative text-left p-5 rounded-2xl border bg-card hover:shadow-glow transition-all overflow-hidden"
  >
    <div className={`absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity ${gradient}`} />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className="text-4xl font-bold mt-2">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </div>
      <div className={`p-3 rounded-xl ${gradient}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <div className="relative mt-4 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
      Open <ArrowRight className="w-3 h-3" />
    </div>
  </button>
);

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [wsId, setWsId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    leadsNew: 0,
    leadsTotal: 0,
    campaignsMonth: 0,
    messagesSent: 0,
    templatesApproved: 0,
    automationsActive: 0,
    waConnected: false,
    inboxUnread: 0,
    inboxConversations: 0,
    messagesToday: 0,
    msgCredits: 0,
    msgCreditsPack: 1000,
    aiRepliesMonth: 0,
    botsActive: 0,
    recordsToday: 0,
    pendingPayments: 0,
    pendingAmount: 0,
    revenueMonth: 0,
  });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = async (id: string) => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      { count: leadsNew },
      { count: leadsTotal },
      { data: campaigns },
      { count: templatesApproved },
      { count: automationsActive },
      { data: creds },
      { data: recLeads },
      { data: conversations },
      { count: messagesToday },
      { count: msgsMonth },
      { count: botsActive },
      { count: aiRepliesMonth },
    ] = await Promise.all([
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", id)
        .gte("created_at", weekAgo),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", id),
      supabase
        .from("campaigns" as any)
        .select("id,name,status,sent_count,delivered_count,total_count,created_at")
        .eq("workspace_id", id)
        .gte("created_at", monthStart)
        .order("created_at", { ascending: false }),
      supabase
        .from("templates" as any)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", id)
        .eq("status", "approved"),
      supabase
        .from("automations" as any)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", id)
        .eq("enabled", true),
      supabase.rpc("list_whatsapp_connections" as any, { _ws: id }),
      supabase
        .from("leads")
        .select("id,name,phone,status,created_at")
        .eq("workspace_id", id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("wa_conversations" as any)
        .select("id,unread_count")
        .eq("workspace_id", id),
      supabase
        .from("wa_messages" as any)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", id)
        .gte("created_at", todayStart.toISOString()),
      supabase
        .from("wa_messages" as any)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", id)
        .eq("direction", "outbound")
        .gte("created_at", monthStart),
      supabase
        .from("chatbots" as any)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", id)
        .eq("enabled", true),
      supabase
        .from("chatbot_messages" as any)
        .select("id", { count: "exact", head: true })
        .eq("role", "assistant")
        .gte("created_at", monthStart),
    ]);

    const { data: wsRow } = await supabase
      .from("workspaces" as any)
      .select("plan_id")
      .eq("id", id)
      .maybeSingle();
    const { data: limRow } = await supabase
      .from("plan_limits" as any)
      .select("max_messages")
      .eq("plan_id", (wsRow as any)?.plan_id || "trial")
      .maybeSingle();
    const planMsgLimit = Number((limRow as any)?.max_messages ?? 1000);

    // Bookings / records: today's count, outstanding money, revenue this month
    const [{ data: recToday }, { data: recOpen }, { data: recMonth }] = await Promise.all([
      supabase
        .from("business_records" as any)
        .select("id")
        .eq("workspace_id", id)
        .gte("created_at", todayStart.toISOString()),
      supabase
        .from("business_records" as any)
        .select("amount,paid_amount")
        .eq("workspace_id", id)
        .neq("payment_status", "paid")
        .neq("status", "cancelled"),
      supabase
        .from("business_records" as any)
        .select("paid_amount")
        .eq("workspace_id", id)
        .gte("created_at", monthStart),
    ]);
    const pendingRows = (recOpen as any[]) || [];
    const pendingAmount = pendingRows.reduce(
      (s, r) => s + Math.max(0, Number(r.amount || 0) - Number(r.paid_amount || 0)),
      0,
    );
    const revenueMonth = ((recMonth as any[]) || []).reduce((s, r) => s + Number(r.paid_amount || 0), 0);

    const cs = (campaigns as any[]) || [];
    const messagesSent = cs.reduce((s, c) => s + (c.sent_count || 0), 0);
    const cred = (creds as any[])?.[0];
    const convs = (conversations as any[]) || [];
    const inboxUnread = convs.reduce((s, c) => s + (Number(c.unread_count) || 0), 0);

    setStats({
      leadsNew: leadsNew || 0,
      leadsTotal: leadsTotal || 0,
      campaignsMonth: cs.length,
      messagesSent,
      templatesApproved: templatesApproved || 0,
      automationsActive: automationsActive || 0,
      waConnected: !!(
        cred?.verified ||
        cred?.phone_number_id ||
        ["connected", "active"].includes(String(cred?.status || "").toLowerCase())
      ),
      inboxUnread,
      inboxConversations: convs.length,
      messagesToday: messagesToday || 0,
      msgCredits: msgsMonth || 0,
      msgCreditsPack: planMsgLimit,
      aiRepliesMonth: aiRepliesMonth || 0,
      botsActive: botsActive || 0,
      recordsToday: ((recToday as any[]) || []).length,
      pendingPayments: pendingRows.length,
      pendingAmount,
      revenueMonth,
    });
    setRecentCampaigns(cs.slice(0, 5));
    setRecentLeads((recLeads as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const id = await resolveWorkspaceId(user.id, profile);
      if (!id) {
        setLoading(false);
        return;
      }
      setWsId(id);
      await loadStats(id);
    })();
  }, [user]);

  // Realtime: auto-refresh the tiles when data changes
  const visible = usePageVisible();
  useEffect(() => {
    if (!wsId || !visible) return;
    let t: number | undefined;
    // Debounce: bursts of message events trigger one refresh, not dozens
    const refresh = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => loadStats(wsId), 1500);
    };
    const ch = supabase
      .channel(`dash-${wsId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads", filter: `workspace_id=eq.${wsId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaigns", filter: `workspace_id=eq.${wsId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "templates", filter: `workspace_id=eq.${wsId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "automations", filter: `workspace_id=eq.${wsId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_credentials", filter: `workspace_id=eq.${wsId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_conversations", filter: `workspace_id=eq.${wsId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_messages", filter: `workspace_id=eq.${wsId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_records", filter: `workspace_id=eq.${wsId}` },
        refresh,
      )
      .subscribe();
    return () => {
      window.clearTimeout(t);
      supabase.removeChannel(ch);
    };
  }, [wsId, visible]);

  const firstName = profile?.full_name ? profile.full_name.split(" ")[0] : "";

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-10 max-w-[1500px] mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight">Today</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Hey {firstName || "there"}, here's what's happening on WhatsApp.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <SetupProgressCard
              wsId={wsId}
              checks={{
                whatsapp: stats.waConnected,
                contacts: stats.leadsTotal > 0,
                template: stats.templatesApproved > 0,
                campaign: stats.campaignsMonth > 0 || stats.messagesSent > 0,
                automation: stats.automationsActive > 0 || stats.botsActive > 0,
              }}
            />
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => navigate("/documentation")}
              title="Help & docs"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {!loading && !stats.waConnected && (
          <ConnectWhatsAppCard connected={stats.waConnected} onConnected={() => wsId && loadStats(wsId)} />
        )}

        <TodayActivityCard
          wsId={wsId}
          credits={stats.msgCredits}
          creditsPack={stats.msgCreditsPack}
          aiReplies={stats.aiRepliesMonth}
        />

        <OverviewGrid wsId={wsId} />

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Recent campaigns</h2>
          <div className="rounded-2xl border bg-card p-4 md:p-6">
            {recentCampaigns.length === 0 ? (
              <div className="h-40 rounded-xl border border-dashed flex flex-col items-center justify-center gap-3">
                <span className="rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground">No data</span>
                <Button size="sm" variant="outline" onClick={() => navigate("/campaigns")}>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  New broadcast
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {recentCampaigns.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => navigate("/campaigns")}
                    className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-muted/40 rounded-lg px-2 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {c.sent_count || 0} sent · {c.delivered_count || 0} delivered
                    </span>
                    <span className="text-xs rounded-md bg-muted px-2 py-1 capitalize">{c.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <SetupProgressCard
          wsId={wsId}
          checks={{
            whatsapp: stats.waConnected,
            contacts: stats.leadsTotal > 0,
            template: stats.templatesApproved > 0,
            campaign: stats.campaignsMonth > 0 || stats.messagesSent > 0,
            automation: stats.automationsActive > 0 || stats.botsActive > 0,
          }}
        />
      </div>
    </AppLayout>
  );
};

export default Dashboard;

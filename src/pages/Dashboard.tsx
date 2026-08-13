import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Contact, Inbox, Megaphone, Workflow, ArrowRight, Send, Wallet, Sparkles,
} from 'lucide-react';
import { resolveWorkspaceId } from '@/lib/workspace';
import ConnectWhatsAppCard from '@/components/home/ConnectWhatsAppCard';

const QuickCard = ({ icon: Icon, title, desc, cta, to, navigate, tint }: any) => (
  <button
    onClick={() => navigate(to)}
    className="group relative text-left p-5 rounded-2xl border bg-card hover:shadow-glow transition-all overflow-hidden"
  >
    <div className={`absolute inset-0 opacity-[0.07] group-hover:opacity-[0.14] transition-opacity ${tint}`} />
    <div className="relative flex items-start justify-between">
      <div className="p-2.5 rounded-xl bg-muted"><Icon className="w-5 h-5" /></div>
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
    leadsNew: 0, leadsTotal: 0, campaignsMonth: 0, messagesSent: 0,
    templatesApproved: 0, automationsActive: 0, waConnected: false,
    inboxUnread: 0, inboxConversations: 0, messagesToday: 0,
    msgCredits: 0, aiRepliesMonth: 0, botsActive: 0,
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
      { data: wallet },
      { count: botsActive },
      { count: aiRepliesMonth },
    ] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', id).gte('created_at', weekAgo),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', id),
      supabase.from('campaigns' as any).select('id,name,status,sent_count,delivered_count,total_count,created_at').eq('workspace_id', id).gte('created_at', monthStart).order('created_at', { ascending: false }),
      supabase.from('templates' as any).select('id', { count: 'exact', head: true }).eq('workspace_id', id).eq('status', 'approved'),
      supabase.from('automations' as any).select('id', { count: 'exact', head: true }).eq('workspace_id', id).eq('enabled', true),
      supabase.from('whatsapp_credentials' as any).select('id,verified,phone_number_id').eq('workspace_id', id).limit(1),
      supabase.from('leads').select('id,name,phone,status,created_at').eq('workspace_id', id).order('created_at', { ascending: false }).limit(5),
      supabase.from('wa_conversations' as any).select('id,unread_count').eq('workspace_id', id),
      supabase.from('wa_messages' as any).select('id', { count: 'exact', head: true }).eq('workspace_id', id).gte('created_at', todayStart.toISOString()),
      supabase.from('message_credits' as any).select('balance').eq('workspace_id', id).maybeSingle(),
      supabase.from('chatbots' as any).select('id', { count: 'exact', head: true }).eq('workspace_id', id).eq('enabled', true),
      supabase.from('chatbot_messages' as any).select('id', { count: 'exact', head: true }).eq('role', 'assistant').gte('created_at', monthStart),
    ]);

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
      waConnected: !!(cred?.verified || cred?.phone_number_id),
      inboxUnread,
      inboxConversations: convs.length,
      messagesToday: messagesToday || 0,
      msgCredits: Number((wallet as any)?.balance ?? 0),
      aiRepliesMonth: aiRepliesMonth || 0,
      botsActive: botsActive || 0,
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
      if (!id) { setLoading(false); return; }
      setWsId(id);
      await loadStats(id);
    })();
  }, [user]);

  // Realtime: auto-refresh the tiles when data changes
  useEffect(() => {
    if (!wsId) return;
    const ch = supabase
      .channel(`dash-${wsId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `workspace_id=eq.${wsId}` }, () => loadStats(wsId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns', filter: `workspace_id=eq.${wsId}` }, () => loadStats(wsId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'templates', filter: `workspace_id=eq.${wsId}` }, () => loadStats(wsId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automations', filter: `workspace_id=eq.${wsId}` }, () => loadStats(wsId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_credentials', filter: `workspace_id=eq.${wsId}` }, () => loadStats(wsId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations', filter: `workspace_id=eq.${wsId}` }, () => loadStats(wsId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_messages', filter: `workspace_id=eq.${wsId}` }, () => loadStats(wsId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId]);

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : '';

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-5 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Hey {firstName || 'there'} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Here's your WhatsApp growth desk for today.</p>
        </div>

        {/* WhatsApp coexistence connection */}
        <ConnectWhatsAppCard connected={stats.waConnected} onConnected={() => wsId && loadStats(wsId)} />

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <QuickCard icon={Contact} title="Contacts" desc="Import, scrape or add leads." cta="Open Contacts" to="/leads" navigate={navigate} tint="bg-foreground" />
          <QuickCard icon={Send} title="Broadcasts" desc="Send campaigns & track delivery." cta="Open Broadcasts" to="/campaigns" navigate={navigate} tint="bg-foreground" />
          <QuickCard icon={Inbox} title="Chat Inbox" desc="Reply with your team in real time." cta="Open Inbox" to="/inbox" navigate={navigate} tint="bg-foreground" />
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <ModuleTile icon={Contact} label="Contacts" value={stats.leadsTotal} hint={`${stats.leadsNew} new this week`} gradient="bg-foreground" to="/leads" navigate={navigate} />
          <ModuleTile icon={Inbox} label="Inbox" value={stats.inboxUnread} hint={`${stats.inboxConversations} chats · ${stats.messagesToday} today`} gradient="bg-foreground" to="/inbox" navigate={navigate} />
          <ModuleTile icon={Megaphone} label="Campaigns" value={stats.campaignsMonth} hint={`${stats.messagesSent} sent this month`} gradient="bg-foreground" to="/campaigns" navigate={navigate} />
          <ModuleTile icon={Workflow} label="Automation" value={stats.automationsActive} hint="Active flows" gradient="bg-foreground" to="/automation" navigate={navigate} />
        </div>

        {/* Credits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-muted"><Wallet className="w-4 h-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Message credits</p>
              <p className="text-2xl font-bold leading-tight">{stats.msgCredits.toLocaleString('en-IN')}</p>
            </div>
            <Button size="sm" onClick={() => navigate('/pricing')}>Top up</Button>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-muted"><Sparkles className="w-4 h-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">AI replies this month</p>
              <p className="text-2xl font-bold leading-tight">{stats.aiRepliesMonth.toLocaleString('en-IN')}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/chatbots')}>Bots</Button>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Need help getting started?{' '}
          <button onClick={() => navigate('/guide')} className="underline font-medium">Open the setup guide</button>
        </p>
      </div>
    </AppLayout>
  );
};

export default Dashboard;

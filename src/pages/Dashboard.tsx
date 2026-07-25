import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Contact, Inbox, Megaphone, Workflow, ArrowRight, MessageSquareText, Send } from 'lucide-react';
import { resolveWorkspaceId } from '@/lib/workspace';

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

  // Realtime: auto-refresh the checklist + tiles when data changes
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


  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
          <p className="text-muted-foreground text-sm mt-1">Reachably · WhatsApp CRM · Contacts · Campaigns · Automation</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <ModuleTile icon={Contact} label="Contacts" value={stats.leadsNew} hint={`${stats.leadsTotal} total · new this week`} gradient="bg-gradient-to-br from-fuchsia-500 to-pink-500" to="/leads" navigate={navigate} />
          <ModuleTile icon={Inbox} label="Inbox" value={stats.inboxUnread} hint={`${stats.inboxConversations} chats · ${stats.messagesToday} msgs today`} gradient="bg-gradient-to-br from-blue-500 to-indigo-500" to="/inbox" navigate={navigate} />
          <ModuleTile icon={Megaphone} label="Campaigns" value={stats.campaignsMonth} hint={`${stats.messagesSent} messages this month`} gradient="bg-gradient-to-br from-orange-500 to-rose-500" to="/campaigns" navigate={navigate} />
          <ModuleTile icon={Workflow} label="Automation" value={stats.automationsActive} hint="Active flows" gradient="bg-gradient-to-br from-emerald-500 to-teal-500" to="/automation" navigate={navigate} />
        </div>


        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Contact className="w-4 h-4" /> Recent contacts</h3>
              <button onClick={() => navigate('/leads')} className="text-xs text-primary hover:underline">View all</button>
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
              : recentLeads.length === 0 ? <p className="text-sm text-muted-foreground">No contacts yet. Import a CSV to get started.</p>
              : (
                <div className="space-y-2">
                  {recentLeads.map(l => (
                    <div key={l.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 text-sm">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">{(l.name || '?')[0]?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{l.name || 'Unnamed'}</div>
                        <div className="text-xs text-muted-foreground truncate">{l.phone || '—'}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{l.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Send className="w-4 h-4" /> Recent campaigns</h3>
              <button onClick={() => navigate('/campaigns')} className="text-xs text-primary hover:underline">View all</button>
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
              : recentCampaigns.length === 0 ? <p className="text-sm text-muted-foreground">No campaigns this month.</p>
              : (
                <div className="space-y-2">
                  {recentCampaigns.map(c => {
                    const rate = c.total_count ? Math.round((c.delivered_count || 0) * 100 / c.total_count) : 0;
                    return (
                      <div key={c.id} onClick={() => navigate(`/campaigns/${c.id}`)} className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate">{c.name}</span>
                          <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{c.sent_count}/{c.total_count} sent</span>
                          <span>{rate}% delivered</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500" style={{ width: `${rate}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Approved templates</div><div className="text-2xl font-bold mt-1 flex items-center gap-2"><MessageSquareText className="w-5 h-5 text-primary" />{stats.templatesApproved}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">WhatsApp status</div><div className="text-2xl font-bold mt-1">{stats.waConnected ? <span className="text-emerald-500">Live</span> : <span className="text-amber-500">Setup</span>}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Active automations</div><div className="text-2xl font-bold mt-1">{stats.automationsActive}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Messages this month</div><div className="text-2xl font-bold mt-1">{stats.messagesSent}</div></Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;

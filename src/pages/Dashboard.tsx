import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Contact, Inbox, Megaphone, Workflow, ArrowRight } from 'lucide-react';


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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ leadsNew: 0, inboxUnread: 0, campaignsMonth: 0, automationsActive: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo)
        .eq('status', 'new');
      setStats({ leadsNew: count || 0, inboxUnread: 0, campaignsMonth: 0, automationsActive: 0 });
    })();
  }, [user]);


  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reachably — Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">WhatsApp CRM · Leads · Campaigns · Automation</p>
        </div>

        {/* Module tiles — 2x2 on mobile, single row on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <ModuleTile icon={Contact} label="Leads" value={stats.leadsNew} hint="New this week" gradient="bg-gradient-to-br from-fuchsia-500 to-pink-500" to="/leads" navigate={navigate} />
          <ModuleTile icon={Inbox} label="Inbox" value={stats.inboxUnread} hint="Unread today" gradient="bg-gradient-to-br from-blue-500 to-indigo-500" to="/inbox" navigate={navigate} />
          <ModuleTile icon={Megaphone} label="Campaigns" value={stats.campaignsMonth} hint="Sent this month" gradient="bg-gradient-to-br from-orange-500 to-rose-500" to="/campaigns" navigate={navigate} />
          <ModuleTile icon={Workflow} label="Automation" value={stats.automationsActive} hint="Active flows" gradient="bg-gradient-to-br from-emerald-500 to-teal-500" to="/automation" navigate={navigate} />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Send, Plus, Sparkles, Loader2, BarChart3, Lock, Play, Pause, Trash2 } from 'lucide-react';
import { can } from '@/lib/permissions';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';

type Campaign = { id: string; name: string; status: string; flow_id: string | null; stats: any; created_at: string; schedule_at: string | null };
type Flow = { id: string; name: string };

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted/40 text-muted-foreground',
  scheduled: 'bg-blue-500/20 text-blue-300',
  running: 'bg-emerald-500/20 text-emerald-300',
  paused: 'bg-amber-500/20 text-amber-300',
  completed: 'bg-violet-500/20 text-violet-300',
};

const Campaigns = () => {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canCreate = can(role, 'campaign.create');
  const canPublish = can(role, 'campaign.publish');
  const canPause = can(role, 'campaign.pause');
  const canDelete = can(role, 'campaign.delete');

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [flowId, setFlowId] = useState('');
  const [audience, setAudience] = useState<'all' | 'recent' | 'inactive'>('all');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [c, f] = await Promise.all([
        supabase.from('tn_campaigns').select('*').order('created_at', { ascending: false }),
        supabase.from('tn_flows').select('id,name').order('updated_at', { ascending: false }),
      ]);
      setCampaigns((c.data as any) || []);
      setFlows((f.data as any) || []);
      setLoading(false);
    })();
  }, [user]);

  const create = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error('Campaign needs a name'); return; }
    const { data, error } = await supabase.from('tn_campaigns').insert({
      user_id: user.id, name, flow_id: flowId || null,
      audience_snapshot: { type: audience },
      status: 'draft',
    }).select('*').single();
    if (error) { toast.error(error.message); return; }
    setCampaigns(prev => [data as any, ...prev]);
    setOpen(false); setName(''); setFlowId('');
    await logAudit({ user_id: user.id, entity_type: 'campaign', entity_id: (data as any).id, action: 'campaign.created', after: data });
    toast.success('Campaign created');
  };

  const setStatus = async (c: Campaign, status: string) => {
    if (!user) return;
    const { error } = await supabase.from('tn_campaigns').update({ status }).eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status } : x));
    await logAudit({ user_id: user.id, entity_type: 'campaign', entity_id: c.id, action: `campaign.${status}`, before: { status: c.status }, after: { status } });
    if (status === 'running') {
      supabase.functions.invoke('campaign-dispatch', { body: { campaign_id: c.id } }).catch(() => {});
      toast.success('Campaign published');
    }
  };

  const remove = async (c: Campaign) => {
    if (!confirm('Delete this campaign?')) return;
    await supabase.from('tn_campaigns').delete().eq('id', c.id);
    setCampaigns(prev => prev.filter(x => x.id !== c.id));
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="relative overflow-hidden glass-elevated glass-sheen p-6 md:p-8">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl animate-aurora" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-xs mb-3">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span className="text-muted-foreground">Broadcast Campaigns</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Send <span className="aurora-text">precision broadcasts</span><br className="hidden md:block"/>
                that actually convert.
              </h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
                Pair a flow with an audience, schedule it, and watch every step's performance in real-time.
              </p>
            </div>
            {canCreate ? (
              <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-primary to-secondary text-white border-0 shadow-glow">
                <Plus className="w-4 h-4" /> New Campaign
              </Button>
            ) : (
              <Badge variant="outline"><Lock className="w-3 h-3 mr-1" />View-only</Badge>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : campaigns.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl">
            <Send className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm">No campaigns yet. Create your first broadcast above.</p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-white/[0.02]">
                <tr><th className="text-left p-3">Campaign</th><th className="text-left p-3">Status</th><th className="text-left p-3">Sent</th><th className="text-left p-3">Replied</th><th className="text-left p-3">Created</th><th className="text-right p-3">Actions</th></tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const stats = c.stats || {};
                  return (
                    <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="p-3">
                        <Link to={`/campaigns/${c.id}/analytics`} className="font-medium hover:text-primary">{c.name}</Link>
                      </td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${STATUS_COLORS[c.status] || ''}`}>{c.status}</span></td>
                      <td className="p-3 tabular-nums">{stats.sent ?? 0}</td>
                      <td className="p-3 tabular-nums">{stats.replied ?? 0}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Link to={`/campaigns/${c.id}/analytics`}>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><BarChart3 className="w-3.5 h-3.5" /></Button>
                          </Link>
                          {c.status === 'draft' && canPublish && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStatus(c, 'running')}><Play className="w-3.5 h-3.5" /></Button>
                          )}
                          {c.status === 'running' && canPause && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStatus(c, 'paused')}><Pause className="w-3.5 h-3.5" /></Button>
                          )}
                          {c.status === 'paused' && canPublish && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStatus(c, 'running')}><Play className="w-3.5 h-3.5" /></Button>
                          )}
                          {canDelete && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(c)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-elevated">
          <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Sale Blast" className="mt-1 glass-panel border-white/10" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Flow</label>
              <Select value={flowId} onValueChange={setFlowId}>
                <SelectTrigger className="mt-1 glass-panel border-white/10"><SelectValue placeholder="Select a flow" /></SelectTrigger>
                <SelectContent>
                  {flows.length === 0 && <div className="p-3 text-xs text-muted-foreground">No flows yet — create one first.</div>}
                  {flows.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Audience</label>
              <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
                <SelectTrigger className="mt-1 glass-panel border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  <SelectItem value="recent">Active last 30 days</SelectItem>
                  <SelectItem value="inactive">Inactive 45+ days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} className="bg-gradient-to-r from-primary to-secondary text-white border-0">Create draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Campaigns;

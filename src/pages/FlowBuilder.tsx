import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Plus, Loader2, Trash2, Sparkles } from 'lucide-react';
import { can } from '@/lib/permissions';
import { toast } from 'sonner';

type Flow = { id: string; name: string; description: string | null; status: string; updated_at: string; nodes: any[] };

const TEMPLATES = [
  { name: 'Welcome Series', description: 'Greet new contacts and qualify intent over 3 days.' },
  { name: 'Abandoned Cart', description: 'Recover incomplete checkouts with a 3-step nudge.' },
  { name: 'Appointment Reminder', description: 'Auto reminders 24h and 1h before booking.' },
];

const FlowBuilder = () => {
  const { user, profile } = useAuth();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const role = profile?.role;
  const canCreate = can(role, 'flow.create');
  const canDelete = can(role, 'flow.delete');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('tn_flows').select('*').order('updated_at', { ascending: false });
      setFlows((data as any) || []);
      setLoading(false);
    })();
  }, [user]);

  const create = async (seed?: typeof TEMPLATES[number]) => {
    if (!user || !canCreate) return;
    const { data, error } = await supabase.from('tn_flows').insert({
      user_id: user.id,
      name: seed?.name ?? 'Untitled Flow',
      description: seed?.description ?? '',
      nodes: [{ id: 'trigger-1', type: 'trigger', position: { x: 80, y: 120 }, data: { label: 'New contact', triggerType: 'new_contact' } }],
      edges: [],
    }).select('*').single();
    if (error) { toast.error(error.message); return; }
    window.location.href = `/flows/${(data as any).id}`;
  };

  const remove = async (id: string) => {
    if (!canDelete) return;
    if (!confirm('Delete this flow?')) return;
    await supabase.from('tn_flows').delete().eq('id', id);
    setFlows(prev => prev.filter(f => f.id !== id));
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="relative overflow-hidden glass-elevated glass-sheen p-6 md:p-8">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-secondary/30 blur-3xl animate-aurora" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-xs mb-3">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span className="text-muted-foreground">Flow Builder</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Design <span className="aurora-text">automated journeys</span><br className="hidden md:block"/>
                that run themselves.
              </h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
                Drag triggers, messages, waits and branches onto the canvas. Publish once — let your flows do the rest.
              </p>
            </div>
            {canCreate && (
              <Button onClick={() => create()} className="bg-gradient-to-r from-primary to-secondary text-white border-0 shadow-glow">
                <Plus className="w-4 h-4" /> New Flow
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : flows.length === 0 ? (
          <div className="grid md:grid-cols-3 gap-4">
            {TEMPLATES.map(t => (
              <button
                key={t.name}
                onClick={() => create(t)}
                disabled={!canCreate}
                className="glass-panel hover:bg-white/[0.04] p-5 text-left rounded-2xl transition disabled:opacity-50"
              >
                <GitBranch className="w-5 h-5 text-accent mb-2" />
                <div className="text-base font-semibold">{t.name}</div>
                <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {flows.map(f => (
              <div key={f.id} className="glass-panel p-5 rounded-2xl group hover:bg-white/[0.04] transition">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/flows/${f.id}`} className="flex-1 min-w-0">
                    <div className="text-base font-semibold truncate">{f.name}</div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{f.description || 'No description'}</p>
                  </Link>
                  <Badge variant="outline" className="text-[10px] capitalize">{f.status}</Badge>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                  <span className="text-[10px] text-muted-foreground">{(f.nodes || []).length} nodes</span>
                  <div className="flex gap-1">
                    <Link to={`/flows/${f.id}`} className="text-xs text-primary hover:underline">Open →</Link>
                    {canDelete && (
                      <button onClick={() => remove(f.id)} className="text-muted-foreground hover:text-destructive ml-2">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default FlowBuilder;

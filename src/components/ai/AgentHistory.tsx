import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, RotateCcw, Loader2 } from 'lucide-react';
import { diffWords } from 'diff';
import { toast } from 'sonner';

type Version = {
  id: string;
  agent_id: string;
  system_prompt: string | null;
  tools: any[];
  model: string | null;
  temperature: number | null;
  change_note: string | null;
  created_by: string | null;
  created_at: string;
};

export default function AgentHistory({
  agentId,
  currentPrompt,
  canRestore,
  onRestore,
}: {
  agentId: string;
  currentPrompt: string;
  canRestore: boolean;
  onRestore?: (v: Version) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('tn_agent_versions')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(50);
      const list = (data as any[]) || [];
      setVersions(list as Version[]);
      const ids = Array.from(new Set(list.map(v => v.created_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id,full_name,email').in('user_id', ids as string[]);
        const map: Record<string, string> = {};
        (profs as any[] | null)?.forEach(p => map[p.user_id] = p.full_name || p.email || 'Teammate');
        setActors(map);
      }
      setLoading(false);
    })();
  }, [agentId]);

  const restore = async (v: Version) => {
    if (!canRestore) return;
    if (!confirm('Restore this prompt version? Current values will be saved as a new history entry first.')) return;
    const { error } = await supabase.from('tn_ai_agents').update({
      system_prompt: v.system_prompt,
      tools: v.tools as any,
      model: v.model,
      temperature: v.temperature,
    }).eq('id', v.agent_id);
    if (error) { toast.error(error.message); return; }
    toast.success('Restored');
    onRestore?.(v);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  if (versions.length === 0) {
    return (
      <div className="glass-panel p-6 text-center rounded-xl border border-dashed border-white/10">
        <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">No history yet</p>
        <p className="text-xs text-muted-foreground mt-1">Every prompt, tool or model change will be tracked here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {versions.map(v => {
        const isOpen = openId === v.id;
        const parts = isOpen ? diffWords(v.system_prompt || '', currentPrompt || '') : [];
        return (
          <div key={v.id} className="glass-panel rounded-xl overflow-hidden">
            <button onClick={() => setOpenId(isOpen ? null : v.id)} className="w-full p-3 flex items-center gap-3 text-left hover:bg-white/[0.03]">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{actors[v.created_by || ''] || 'System'} · {new Date(v.created_at).toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground flex gap-2">
                  <Badge variant="outline" className="text-[9px]">{v.model?.split('/')[1] || '—'}</Badge>
                  <span>temp {Number(v.temperature ?? 0).toFixed(2)}</span>
                  <span>{(v.tools || []).length} tools</span>
                </div>
              </div>
              {canRestore && (
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); restore(v); }}>
                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                </Button>
              )}
            </button>
            {isOpen && (
              <div className="p-3 border-t border-white/5 bg-black/20">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Prompt diff vs current</div>
                <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                  {parts.map((p, i) => (
                    <span key={i} className={p.added ? 'bg-emerald-500/20 text-emerald-200' : p.removed ? 'bg-red-500/20 text-red-200 line-through' : 'text-muted-foreground'}>{p.value}</span>
                  ))}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

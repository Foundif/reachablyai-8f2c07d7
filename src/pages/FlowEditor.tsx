import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Zap, MessageSquare, Clock, GitBranch as Branch, Wrench, CircleStop, ArrowLeft, Save, Loader2, Lock, Send, Play, Library } from 'lucide-react';
import { can } from '@/lib/permissions';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import FlowSimulator from '@/components/flow/FlowSimulator';

const NODE_PALETTE = [
  { type: 'trigger', label: 'Trigger', icon: Zap, color: 'from-amber-500/30 to-orange-500/20' },
  { type: 'message', label: 'Message', icon: MessageSquare, color: 'from-primary/30 to-secondary/20' },
  { type: 'wait', label: 'Wait', icon: Clock, color: 'from-blue-500/30 to-cyan-500/20' },
  { type: 'branch', label: 'Branch', icon: Branch, color: 'from-fuchsia-500/30 to-pink-500/20' },
  { type: 'action', label: 'Action', icon: Wrench, color: 'from-emerald-500/30 to-teal-500/20' },
  { type: 'end', label: 'End', icon: CircleStop, color: 'from-red-500/30 to-rose-500/20' },
] as const;

const ICON_FOR: Record<string, any> = Object.fromEntries(NODE_PALETTE.map(p => [p.type, p.icon]));

function FlowNode({ data }: { data: any }) {
  const Icon = ICON_FOR[data.kind] || Zap;
  return (
    <div className="glass-panel rounded-xl px-3 py-2 min-w-[160px] shadow-card border border-white/10">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{data.kind}</div>
          <div className="text-xs font-medium truncate">{data.label}</div>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { custom: FlowNode };

const FlowEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canEdit = can(role, 'flow.edit');
  const canPublish = can(role, 'flow.publish');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flow, setFlow] = useState<any>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const canTemplate = can(role, 'template.create');

  const serialize = () => ({
    nodes: nodes.map(n => ({ id: n.id, type: (n.data as any).kind, position: n.position, data: { label: (n.data as any).label, ...(n.data as any).config } })),
    edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
  });

  const saveAsTemplate = async () => {
    if (!user || !canTemplate) return;
    const name = prompt('Template name?', flow?.name ? `${flow.name} template` : 'New template');
    if (!name) return;
    const { nodes: ns, edges: es } = serialize();
    const { error } = await supabase.from('tn_flow_templates').insert({
      owner_id: user.id, name, description: flow?.description || '', nodes: ns as any, edges: es as any, tags: [],
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Saved to templates library');
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from('tn_flows').select('*').eq('id', id).maybeSingle();
      if (error || !data) { toast.error('Flow not found'); navigate('/flows'); return; }
      setFlow(data);
      const ns = ((data.nodes as any[]) || []).map((n: any) => ({
        id: n.id, type: 'custom', position: n.position,
        data: { kind: n.type, label: n.data?.label || n.type, config: n.data || {} },
      }));
      const es = ((data.edges as any[]) || []).map((e: any) => ({
        id: e.id, source: e.source, target: e.target,
        markerEnd: { type: MarkerType.ArrowClosed },
      }));
      setNodes(ns); setEdges(es);
      setLoading(false);
    })();
  }, [id, navigate]);

  const onNodesChange = useCallback((c: NodeChange[]) => canEdit && setNodes(n => applyNodeChanges(c, n)), [canEdit]);
  const onEdgesChange = useCallback((c: EdgeChange[]) => canEdit && setEdges(e => applyEdgeChanges(c, e)), [canEdit]);
  const onConnect = useCallback((c: Connection) => canEdit && setEdges(e => addEdge({ ...c, markerEnd: { type: MarkerType.ArrowClosed } }, e)), [canEdit]);

  const addNode = (kind: string) => {
    if (!canEdit) return;
    const id = `${kind}-${Date.now()}`;
    setNodes(n => [...n, {
      id, type: 'custom',
      position: { x: 220 + n.length * 30, y: 120 + n.length * 40 },
      data: { kind, label: kind.charAt(0).toUpperCase() + kind.slice(1), config: {} },
    }]);
  };

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedId), [nodes, selectedId]);

  const updateSelected = (patch: any) => {
    if (!selectedNode) return;
    setNodes(ns => ns.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, ...patch, config: { ...(n.data as any).config, ...patch } } } : n));
  };

  const persist = async (status?: string) => {
    if (!flow || !canEdit) return;
    setSaving(true);
    const serializedNodes = nodes.map(n => ({
      id: n.id, type: (n.data as any).kind, position: n.position,
      data: { label: (n.data as any).label, ...(n.data as any).config },
    }));
    const serializedEdges = edges.map(e => ({ id: e.id, source: e.source, target: e.target }));
    const before = { nodes: flow.nodes, edges: flow.edges, status: flow.status };
    const after: any = { nodes: serializedNodes, edges: serializedEdges };
    if (status) after.status = status;
    const { error } = await supabase.from('tn_flows').update(after).eq('id', flow.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (user) await logAudit({ user_id: user.id, entity_type: 'flow', entity_id: flow.id, action: status === 'published' ? 'flow.published' : 'flow.edited', before, after });
    toast.success(status === 'published' ? 'Flow published' : 'Saved');
    setFlow({ ...flow, ...after });
  };

  if (loading) return <AppLayout><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate('/flows')}><ArrowLeft className="w-4 h-4" /></Button>
            <Input
              value={flow.name}
              disabled={!canEdit}
              onChange={(e) => setFlow({ ...flow, name: e.target.value })}
              onBlur={async () => canEdit && await supabase.from('tn_flows').update({ name: flow.name }).eq('id', flow.id)}
              className="text-lg font-semibold border-0 bg-transparent px-0 focus-visible:ring-0 h-auto max-w-md"
            />
            <Badge variant="outline" className="capitalize text-[10px]">{flow.status}</Badge>
            {!canEdit && <Badge variant="outline" className="text-[10px]"><Lock className="w-3 h-3 mr-1" />Read-only</Badge>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSimOpen(true)} disabled={nodes.length === 0}>
              <Play className="w-4 h-4" /> Simulate
            </Button>
            {canTemplate && (
              <Button size="sm" variant="ghost" onClick={saveAsTemplate}>
                <Library className="w-4 h-4" /> Save as template
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => persist()} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </Button>
            )}
            {canPublish && (
              <Button size="sm" onClick={() => persist('published')} disabled={saving} className="bg-foreground text-background hover:bg-foreground/90">
                <Send className="w-4 h-4" /> Publish
              </Button>
            )}
          </div>
        </div>

        <FlowSimulator
          open={simOpen}
          onClose={() => setSimOpen(false)}
          nodes={serialize().nodes as any}
          edges={serialize().edges as any}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_320px] gap-3" style={{ height: 'calc(100vh - 200px)' }}>
          {/* Palette */}
          <div className="glass-panel p-3 space-y-1.5 h-fit">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 pb-1">Add node</div>
            {NODE_PALETTE.map(p => (
              <button
                key={p.type}
                disabled={!canEdit}
                onClick={() => addNode(p.type)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                  <p.icon className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium">{p.label}</span>
              </button>
            ))}
          </div>

          {/* Canvas */}
          <div className="glass-panel rounded-2xl overflow-hidden" style={{ minHeight: 500 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, n) => setSelectedId(n.id)}
              onPaneClick={() => setSelectedId(null)}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
              style={{ background: 'transparent' }}
            >
              <Background gap={20} size={1} color="hsl(var(--glass-border))" />
              <Controls className="!bg-background/60 !backdrop-blur !border-white/10" />
              <MiniMap pannable className="!bg-background/60 !backdrop-blur !border !border-white/10" />
            </ReactFlow>
          </div>

          {/* Inspector */}
          <div className="glass-panel p-4 space-y-3 overflow-y-auto">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Inspector</div>
            {!selectedNode ? (
              <p className="text-xs text-muted-foreground">Select a node to configure.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Label</label>
                  <Input
                    value={(selectedNode.data as any).label}
                    disabled={!canEdit}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                    className="mt-1 glass-panel border-white/10"
                  />
                </div>

                {(selectedNode.data as any).kind === 'trigger' && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Trigger type</label>
                    <Select
                      value={(selectedNode.data as any).config?.triggerType || 'new_contact'}
                      onValueChange={(v) => updateSelected({ triggerType: v })}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="mt-1 glass-panel border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new_contact">New contact</SelectItem>
                        <SelectItem value="keyword">Keyword received</SelectItem>
                        <SelectItem value="tag_added">Tag added</SelectItem>
                        <SelectItem value="manual_broadcast">Manual broadcast</SelectItem>
                        <SelectItem value="schedule">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                    {(selectedNode.data as any).config?.triggerType === 'keyword' && (
                      <Input
                        placeholder="e.g. BOOK, PRICE"
                        value={(selectedNode.data as any).config?.keyword || ''}
                        disabled={!canEdit}
                        onChange={(e) => updateSelected({ keyword: e.target.value })}
                        className="mt-2 glass-panel border-white/10"
                      />
                    )}
                  </div>
                )}

                {(selectedNode.data as any).kind === 'message' && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Message body</label>
                    <Textarea
                      rows={6}
                      value={(selectedNode.data as any).config?.body || ''}
                      disabled={!canEdit}
                      onChange={(e) => updateSelected({ body: e.target.value })}
                      className="mt-1 glass-panel border-white/10"
                      placeholder="Hi {{name}}, thanks for reaching out…"
                    />
                  </div>
                )}

                {(selectedNode.data as any).kind === 'wait' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</label>
                      <Input type="number" value={(selectedNode.data as any).config?.amount || 1} disabled={!canEdit} onChange={(e) => updateSelected({ amount: Number(e.target.value) })} className="mt-1 glass-panel border-white/10" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Unit</label>
                      <Select value={(selectedNode.data as any).config?.unit || 'hours'} onValueChange={(v) => updateSelected({ unit: v })} disabled={!canEdit}>
                        <SelectTrigger className="mt-1 glass-panel border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">Minutes</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {(selectedNode.data as any).kind === 'branch' && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Condition</label>
                    <Input placeholder="reply contains 'yes'" value={(selectedNode.data as any).config?.condition || ''} disabled={!canEdit} onChange={(e) => updateSelected({ condition: e.target.value })} className="mt-1 glass-panel border-white/10" />
                  </div>
                )}

                {(selectedNode.data as any).kind === 'action' && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Action</label>
                    <Select value={(selectedNode.data as any).config?.action || 'add_tag'} onValueChange={(v) => updateSelected({ action: v })} disabled={!canEdit}>
                      <SelectTrigger className="mt-1 glass-panel border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="add_tag">Add tag</SelectItem>
                        <SelectItem value="remove_tag">Remove tag</SelectItem>
                        <SelectItem value="assign_agent">Assign AI agent</SelectItem>
                        <SelectItem value="webhook">Call webhook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default FlowEditor;

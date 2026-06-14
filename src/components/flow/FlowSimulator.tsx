import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Play, RotateCcw, MessageSquare, Clock, GitBranch, Wrench, Zap, CircleStop, ArrowRight, User } from 'lucide-react';

type SimNode = { id: string; type: string; data: any };
type SimEdge = { id: string; source: string; target: string };

const SAMPLE_AUDIENCES = [
  { id: 'new', label: 'New leads (3)', contacts: [
    { name: 'Aarav', phone: '+91 98xxxx1101', tags: ['lead'], reply: 'yes' },
    { name: 'Priya', phone: '+91 98xxxx1102', tags: ['lead'], reply: 'no' },
    { name: 'Karan', phone: '+91 98xxxx1103', tags: ['lead','vip'], reply: 'maybe' },
  ]},
  { id: 'vip', label: 'VIP customers (2)', contacts: [
    { name: 'Maya', phone: '+91 98xxxx2201', tags: ['vip'], reply: 'YES book me' },
    { name: 'Rohan', phone: '+91 98xxxx2202', tags: ['vip'], reply: 'thanks' },
  ]},
  { id: 'cart', label: 'Abandoned cart (2)', contacts: [
    { name: 'Diya', phone: '+91 98xxxx3301', tags: ['cart'], reply: 'still browsing' },
    { name: 'Ishaan', phone: '+91 98xxxx3302', tags: ['cart'], reply: 'yes pay' },
  ]},
];

const ICON_FOR: Record<string, any> = { trigger: Zap, message: MessageSquare, wait: Clock, branch: GitBranch, action: Wrench, end: CircleStop };

function interpolate(template: string, ctx: Record<string, any>) {
  return (template || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => ctx[k] ?? `{{${k}}}`);
}

function startNodeId(nodes: SimNode[]): string | null {
  return nodes.find(n => n.type === 'trigger')?.id ?? nodes[0]?.id ?? null;
}

function nextEdge(edges: SimEdge[], fromId: string) {
  return edges.find(e => e.source === fromId);
}

type StepLog = {
  contact: string;
  nodeId: string;
  nodeType: string;
  label: string;
  body?: string;
  note?: string;
  branch?: 'yes' | 'no';
};

export default function FlowSimulator({
  open, onClose, nodes, edges,
}: { open: boolean; onClose: () => void; nodes: SimNode[]; edges: SimEdge[] }) {
  const [audienceId, setAudienceId] = useState(SAMPLE_AUDIENCES[0].id);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<{ sent: number; replied: number; dropped: number; completed: number }>({ sent: 0, replied: 0, dropped: 0, completed: 0 });

  const audience = useMemo(() => SAMPLE_AUDIENCES.find(a => a.id === audienceId)!, [audienceId]);

  useEffect(() => { if (!open) { setLogs([]); setStats({ sent: 0, replied: 0, dropped: 0, completed: 0 }); } }, [open]);

  const run = async () => {
    setRunning(true);
    setLogs([]);
    const startId = startNodeId(nodes);
    if (!startId) { setRunning(false); return; }
    let sent = 0, replied = 0, dropped = 0, completed = 0;
    const newLogs: StepLog[] = [];

    for (const contact of audience.contacts) {
      const ctx: Record<string, any> = { name: contact.name, phone: contact.phone };
      let currentId: string | null = startId;
      let safety = 24;
      while (currentId && safety-- > 0) {
        const node = nodes.find(n => n.id === currentId);
        if (!node) break;
        const Icon = ICON_FOR[node.type] || Zap;
        const label = node.data?.label || node.type;

        if (node.type === 'trigger') {
          newLogs.push({ contact: contact.name, nodeId: node.id, nodeType: node.type, label, note: `Matched ${node.data?.triggerType || 'trigger'}` });
        } else if (node.type === 'message') {
          const body = interpolate(node.data?.body || `(empty message)`, ctx);
          newLogs.push({ contact: contact.name, nodeId: node.id, nodeType: node.type, label, body });
          sent++;
        } else if (node.type === 'wait') {
          newLogs.push({ contact: contact.name, nodeId: node.id, nodeType: node.type, label, note: `Waits ${node.data?.amount ?? 1} ${node.data?.unit ?? 'hours'}` });
        } else if (node.type === 'branch') {
          const cond: string = node.data?.condition || '';
          const matched = cond ? contact.reply.toLowerCase().includes(cond.toLowerCase().replace(/^reply contains\s*'?/, '').replace(/'$/, '').trim()) : true;
          if (matched) replied++;
          newLogs.push({ contact: contact.name, nodeId: node.id, nodeType: node.type, label, branch: matched ? 'yes' : 'no', note: `Reply "${contact.reply}" → ${matched ? 'yes' : 'no'}` });
          if (!matched) { dropped++; break; }
        } else if (node.type === 'action') {
          newLogs.push({ contact: contact.name, nodeId: node.id, nodeType: node.type, label, note: `Action: ${node.data?.action || 'add_tag'}` });
        } else if (node.type === 'end') {
          newLogs.push({ contact: contact.name, nodeId: node.id, nodeType: node.type, label, note: 'Journey completed' });
          completed++;
          break;
        }

        const edge = nextEdge(edges, currentId);
        if (!edge) {
          newLogs.push({ contact: contact.name, nodeId: node.id, nodeType: node.type, label, note: '(no outgoing edge — flow ends here)' });
          completed++;
          break;
        }
        currentId = edge.target;
        await new Promise(r => setTimeout(r, 80));
        setLogs([...newLogs]);
      }
    }
    setLogs(newLogs);
    setStats({ sent, replied, dropped, completed });
    setRunning(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-5 border-b border-border">
          <SheetTitle className="flex items-center gap-2"><Play className="w-4 h-4" />Flow Simulator</SheetTitle>
          <p className="text-xs text-muted-foreground">Dry-run this flow against a sample audience. No real messages are sent.</p>
        </SheetHeader>

        <div className="p-5 space-y-3 border-b border-border">
          <div className="flex gap-2">
            <Select value={audienceId} onValueChange={setAudienceId} disabled={running}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SAMPLE_AUDIENCES.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={run} disabled={running || nodes.length === 0} className="bg-foreground text-background hover:bg-foreground/90">
              {running ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Simulate
            </Button>
          </div>
          {logs.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Sent', value: stats.sent },
                { label: 'Replied', value: stats.replied },
                { label: 'Dropped', value: stats.dropped },
                { label: 'Completed', value: stats.completed },
              ].map(k => (
                <div key={k.label} className="glass-panel p-2 text-center">
                  <div className="text-lg font-semibold">{k.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2 custom-scrollbar">
          {logs.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Play className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Pick an audience and click Simulate to preview every step.
            </div>
          )}
          {logs.map((l, i) => {
            const Icon = ICON_FOR[l.nodeType] || Zap;
            return (
              <div key={i} className="glass-panel p-3 animate-fade-up">
                <div className="flex items-center gap-2 mb-1.5">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-medium">{l.contact}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs">{l.label}</span>
                  {l.branch && <Badge variant="outline" className="text-[10px] ml-auto">{l.branch}</Badge>}
                </div>
                {l.body && (
                  <div className="ml-5 mt-1 p-2 rounded-lg bg-muted/60 text-xs whitespace-pre-wrap">{l.body}</div>
                )}
                {l.note && <div className="ml-5 text-[11px] text-muted-foreground italic">{l.note}</div>}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

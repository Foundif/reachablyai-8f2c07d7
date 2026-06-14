import { useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { FileText, Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SAMPLE = [
  { ts: '2026-06-12T17:01:00Z', actor: 'you@workspace.app', action: 'flow.published', target: 'Welcome flow', ip: '49.36.x.x' },
  { ts: '2026-06-12T16:42:11Z', actor: 'you@workspace.app', action: 'campaign.dispatched', target: 'Summer Sale', ip: '49.36.x.x' },
  { ts: '2026-06-12T16:10:01Z', actor: 'you@workspace.app', action: 'team.member_invited', target: 'jane@co.com', ip: '49.36.x.x' },
  { ts: '2026-06-12T15:55:30Z', actor: 'system', action: 'auth.login', target: 'you@workspace.app', ip: '49.36.x.x' },
  { ts: '2026-06-12T14:21:09Z', actor: 'you@workspace.app', action: 'template.created', target: 'order_confirmation', ip: '49.36.x.x' },
  { ts: '2026-06-12T13:02:55Z', actor: 'you@workspace.app', action: 'settings.updated', target: 'WhatsApp number', ip: '49.36.x.x' },
  { ts: '2026-06-11T18:30:00Z', actor: 'system', action: 'webhook.delivered', target: 'message.received', ip: '-' },
  { ts: '2026-06-11T11:15:00Z', actor: 'you@workspace.app', action: 'role.updated', target: 'Agent → Manager', ip: '49.36.x.x' },
];

const AuditLogs = () => {
  const [q, setQ] = useState('');
  const rows = useMemo(() => SAMPLE.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())), [q]);

  const exportCsv = () => {
    const csv = ['timestamp,actor,action,target,ip', ...SAMPLE.map((r) => `${r.ts},${r.actor},${r.action},${r.target},${r.ip}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'audit-logs.csv'; a.click();
    toast.success('Exported');
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" /> Audit Logs
            </h1>
            <p className="text-sm text-muted-foreground">Complete activity trail for compliance.</p>
          </div>
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4" /> Export CSV</Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="pl-9" />
        </div>

        <div className="glass-elevated overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="border-b border-border/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-3">Time</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">IP</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="p-3 text-xs text-muted-foreground">{new Date(r.ts).toLocaleString()}</td>
                  <td className="p-3 text-xs font-mono">{r.actor}</td>
                  <td className="p-3"><code className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{r.action}</code></td>
                  <td className="p-3 text-sm">{r.target}</td>
                  <td className="p-3 text-xs text-muted-foreground font-mono">{r.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};
export default AuditLogs;

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ArrowLeft, Copy, Loader2, Plus, RefreshCw, Trash2, Webhook, CheckCircle2, XCircle, Clock,
} from 'lucide-react';

const FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/generic-webhook`;

interface Endpoint {
  id: string; workspace_id: string; name: string; token: string; active: boolean;
  last_payload: any; last_received_at: string | null; workflow_name: string | null;
  name_field: string | null; phone_field: string | null; conditions: any[];
  template_id: string | null; variable_map: Record<string, string>;
}
interface LogRow {
  id: string; status: string; phone: string | null; recipient_name: string | null;
  error: string | null; created_at: string; payload: any;
}

/** Flattens a captured payload into dot-paths the user can map. */
function flatten(obj: any, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== 'object') { out[prefix || 'value'] = String(obj); return out; }
  Object.entries(obj).forEach(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, path, out);
    else out[path] = v === null || v === undefined ? '' : String(v);
  });
  return out;
}

const STATUS_UI: Record<string, { icon: any; cls: string }> = {
  sent: { icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  received: { icon: Clock, cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  skipped: { icon: Clock, cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  failed: { icon: XCircle, cls: 'bg-destructive/15 text-destructive border-destructive/30' },
};

const WebhookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ep, setEp] = useState<Endpoint | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  const webhookUrl = ep ? `${FN_BASE}/${ep.token}` : '';

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from('webhook_endpoints' as any).select('*').eq('id', id).maybeSingle();
    if (!data) { toast.error('Webhook not found'); navigate('/integrations'); return; }
    const row = data as any;
    setEp({ ...row, conditions: row.conditions || [], variable_map: row.variable_map || {} });
    const { data: tpl } = await supabase.from('templates' as any).select('id,name,body,status')
      .eq('workspace_id', row.workspace_id).order('name');
    setTemplates((tpl as any[]) || []);
    const { data: lg } = await supabase.from('webhook_logs' as any).select('*')
      .eq('endpoint_id', id).order('created_at', { ascending: false }).limit(50);
    setLogs(((lg as any[]) || []) as LogRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const fields = useMemo(() => Object.keys(flatten(ep?.last_payload)), [ep?.last_payload]);
  const sample = useMemo(() => flatten(ep?.last_payload), [ep?.last_payload]);
  const selectedTemplate = templates.find(t => t.id === ep?.template_id);
  const templateVars = useMemo(() => {
    const body = String(selectedTemplate?.body || '');
    const found: string[] = [];
    for (const m of body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) if (!found.includes(m[1])) found.push(m[1]);
    return found;
  }, [selectedTemplate]);

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success('Copied'); };

  const capture = async () => {
    setCapturing(true);
    await load();
    setCapturing(false);
    if (!ep?.last_payload) toast.info('No payload yet — trigger a test event from your platform, then capture again.');
    else toast.success('Webhook response captured');
  };

  const patch = (p: Partial<Endpoint>) => setEp(prev => (prev ? { ...prev, ...p } : prev));

  const save = async () => {
    if (!ep) return;
    setSaving(true);
    const { error } = await supabase.from('webhook_endpoints' as any).update({
      name: ep.name,
      workflow_name: ep.workflow_name,
      name_field: ep.name_field,
      phone_field: ep.phone_field,
      template_id: ep.template_id,
      conditions: ep.conditions,
      variable_map: ep.variable_map,
      active: ep.active,
    } as any).eq('id', ep.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Workflow updated');
    load();
  };

  const remove = async () => {
    if (!ep) return;
    await supabase.from('webhook_endpoints' as any).delete().eq('id', ep.id);
    toast.success('Webhook deleted');
    navigate('/integrations');
  };

  if (loading || !ep) {
    return <AppLayout><div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div></AppLayout>;
  }

  const captured = !!ep.last_payload;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/integrations')} aria-label="Back to integrations">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 truncate">
              <Webhook className="w-5 h-5 shrink-0" /> {ep.name}
            </h1>
            <p className="text-xs text-muted-foreground">Generic webhook · trigger WhatsApp messages from any external system</p>
          </div>
          <Badge variant="outline" className={ep.active ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : ''}>
            {ep.active ? 'Active' : 'Paused'}
          </Badge>
        </div>

        <Tabs defaultValue="setup">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="setup" className="flex-1 sm:flex-none">Setup</TabsTrigger>
            <TabsTrigger value="workflow" className="flex-1 sm:flex-none">Workflow</TabsTrigger>
            <TabsTrigger value="logs" className="flex-1 sm:flex-none">Logs</TabsTrigger>
          </TabsList>

          {/* ---------------- Setup ---------------- */}
          <TabsContent value="setup" className="space-y-4 pt-4">
            <Card className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Integration name</Label>
                <Input value={ep.name} onChange={(e) => patch({ name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Webhook URL</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate rounded-lg border px-3 py-2 text-[11px] sm:text-xs">{webhookUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(webhookUrl)} aria-label="Copy webhook URL">
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste this URL into your website backend, CRM, lead form, Shopify or automation tool and POST JSON to it.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Webhook active</p>
                  <p className="text-xs text-muted-foreground">Pause to keep capturing payloads without sending messages.</p>
                </div>
                <Switch checked={ep.active} onCheckedChange={(v) => patch({ active: v })} />
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">Capture webhook response</p>
                  <p className="text-xs text-muted-foreground">
                    Trigger a test event from your platform, then capture it to unlock field mapping.
                  </p>
                </div>
                <Button size="sm" onClick={capture} disabled={capturing}>
                  {capturing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Capture
                </Button>
              </div>
              {captured ? (
                <pre className="rounded-lg border bg-muted/40 p-3 text-[11px] overflow-auto max-h-72">
                  {JSON.stringify(ep.last_payload, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">
                  No response captured yet.
                </p>
              )}
              {ep.last_received_at && (
                <p className="text-[11px] text-muted-foreground">Last received {new Date(ep.last_received_at).toLocaleString()}</p>
              )}
            </Card>

            <Button variant="outline" className="text-destructive" onClick={remove}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete webhook
            </Button>
          </TabsContent>

          {/* ---------------- Workflow ---------------- */}
          <TabsContent value="workflow" className="space-y-4 pt-4">
            {!captured && (
              <Card className="p-4 text-sm text-muted-foreground">
                Capture a webhook response first — mapping options are built from your real payload fields.
              </Card>
            )}
            <Card className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Workflow name</Label>
                <Input
                  placeholder="New Lead WhatsApp Notification"
                  value={ep.workflow_name || ''}
                  onChange={(e) => patch({ workflow_name: e.target.value })}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Recipient name</Label>
                  <Select value={ep.name_field || ''} onValueChange={(v) => patch({ name_field: v })}>
                    <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                    <SelectContent>
                      {fields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {ep.name_field && <p className="text-[11px] text-muted-foreground truncate">e.g. {sample[ep.name_field]}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Recipient number</Label>
                  <Select value={ep.phone_field || ''} onValueChange={(v) => patch({ phone_field: v })}>
                    <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                    <SelectContent>
                      {fields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Country code + 10-digit number, without “+”. Example: 917358XXXXXX
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Conditions (optional)</p>
                  <p className="text-xs text-muted-foreground">Only send when every condition matches.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => patch({ conditions: [...ep.conditions, { field: '', op: 'equals', value: '' }] })}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
              {ep.conditions.map((c: any, i: number) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_1fr_auto] gap-2">
                  <Select value={c.field || ''} onValueChange={(v) => {
                    const next = [...ep.conditions]; next[i] = { ...c, field: v }; patch({ conditions: next });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Field" /></SelectTrigger>
                    <SelectContent>{fields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={c.op || 'equals'} onValueChange={(v) => {
                    const next = [...ep.conditions]; next[i] = { ...c, op: v }; patch({ conditions: next });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">equals</SelectItem>
                      <SelectItem value="not_equals">not equals</SelectItem>
                      <SelectItem value="contains">contains</SelectItem>
                      <SelectItem value="exists">exists</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Value" value={c.value || ''} onChange={(e) => {
                    const next = [...ep.conditions]; next[i] = { ...c, value: e.target.value }; patch({ conditions: next });
                  }} />
                  <Button variant="ghost" size="icon" aria-label="Remove condition"
                    onClick={() => patch({ conditions: ep.conditions.filter((_: any, j: number) => j !== i) })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </Card>

            <Card className="p-4 space-y-4">
              <div>
                <p className="font-semibold text-sm">Action — Send WhatsApp message</p>
                <p className="text-xs text-muted-foreground">Choose a Meta-approved template.</p>
              </div>
              <Select value={ep.template_id || ''} onValueChange={(v) => patch({ template_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.status !== 'approved' ? `· ${t.status}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!!templateVars.length && (
                <div className="space-y-2">
                  <p className="text-xs font-medium">Template variables</p>
                  {templateVars.map(v => (
                    <div key={v} className="grid grid-cols-[70px_1fr] gap-2 items-center">
                      <code className="text-xs">{`{{${v}}}`}</code>
                      <Select
                        value={ep.variable_map?.[v] || ''}
                        onValueChange={(val) => patch({ variable_map: { ...ep.variable_map, [v]: val } })}
                      >
                        <SelectTrigger><SelectValue placeholder="Map payload field" /></SelectTrigger>
                        <SelectContent>{fields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              {selectedTemplate?.body && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{selectedTemplate.body}</div>
              )}
            </Card>

            <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Update workflow
            </Button>
          </TabsContent>

          {/* ---------------- Logs ---------------- */}
          <TabsContent value="logs" className="space-y-3 pt-4">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
            </div>
            {logs.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">No webhook activity yet.</Card>
            ) : logs.map(l => {
              const ui = STATUS_UI[l.status] || STATUS_UI.received;
              const Icon = ui.icon;
              return (
                <Card key={l.id} className="p-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={ui.cls}><Icon className="w-3 h-3 mr-1" />{l.status}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                    {l.phone && <span className="text-xs font-medium">{l.phone}</span>}
                    {l.recipient_name && <span className="text-xs text-muted-foreground">· {l.recipient_name}</span>}
                  </div>
                  {l.error && <p className="text-xs text-destructive">{l.error}</p>}
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default WebhookDetail;

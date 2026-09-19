import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';

const API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public-api`;

const SCOPES = [
  { id: 'send', label: 'Send messages & templates' },
  { id: 'contacts', label: 'Create / update contacts' },
  { id: 'records', label: 'Create bookings & records' },
  { id: 'read', label: 'Read templates, contacts, records' },
];

interface KeyRow {
  id: string; name: string; key_prefix: string; scopes: string[]; active: boolean;
  last_used_at: string | null; call_count: number; created_at: string;
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return `rb_live_${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

const copy = (text: string, what = 'Copied') => {
  navigator.clipboard.writeText(text);
  toast.success(what);
};

const Snippet = ({ title, code }: { title: string; code: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium">{title}</div>
      <Button size="sm" variant="ghost" onClick={() => copy(code, 'Example copied')}><Copy className="w-3 h-3 mr-1" /> Copy</Button>
    </div>
    <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre">{code}</pre>
  </div>
);

const ApiSettings = () => {
  const { user, profile } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['send', 'contacts', 'records', 'read']);
  const [created, setCreated] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KeyRow | null>(null);

  const load = async (id: string) => {
    const [{ data: k }, { data: l }] = await Promise.all([
      supabase.from('api_keys').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
      supabase.from('api_logs').select('*').eq('workspace_id', id).order('created_at', { ascending: false }).limit(25),
    ]);
    setKeys((k as any) || []);
    setLogs((l as any) || []);
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      const id = await resolveWorkspaceId(user.id, profile);
      setWsId(id);
      if (id) await load(id);
      setLoading(false);
    })();
  }, [user, profile]);

  const create = async () => {
    if (!wsId) return;
    if (!name.trim()) return toast.error('Give this key a name');
    if (!scopes.length) return toast.error('Pick at least one permission');
    const raw = generateKey();
    const { error } = await supabase.from('api_keys').insert({
      workspace_id: wsId, name: name.trim(), key_prefix: raw.slice(0, 16),
      key_hash: await sha256(raw), scopes, created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    setCreated(raw);
    setOpen(false);
    setName('');
    await load(wsId);
  };

  const toggle = async (k: KeyRow) => {
    await supabase.from('api_keys').update({ active: !k.active }).eq('id', k.id);
    if (wsId) load(wsId);
  };

  const confirmDelete = async () => {
    const k = pendingDelete;
    setPendingDelete(null);
    if (!k) return;
    await supabase.from('api_keys').delete().eq('id', k.id);
    toast.success('Key deleted');
    if (wsId) load(wsId);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><KeyRound className="w-6 h-6" /> API Settings</h1>
            <p className="text-sm text-muted-foreground">
              Let your own admin panel or any other app send templates, reminders, contacts and bookings into Reachably.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New API key</Button>
        </div>

        <Tabs defaultValue="keys">
          <TabsList>
            <TabsTrigger value="keys">Keys</TabsTrigger>
            <TabsTrigger value="docs">Documentation</TabsTrigger>
            <TabsTrigger value="logs">Recent calls</TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="mt-4">
            <Card className="overflow-hidden">
              {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
              : keys.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <KeyRound className="w-8 h-8 mx-auto text-muted-foreground" />
                  <div className="font-medium">No API keys yet</div>
                  <p className="text-sm text-muted-foreground">Create a key, paste it into your admin panel, and start sending.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Key</TableHead><TableHead>Permissions</TableHead>
                      <TableHead>Calls</TableHead><TableHead>Last used</TableHead><TableHead>Active</TableHead><TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map(k => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell><code className="text-xs">{k.key_prefix}…</code></TableCell>
                        <TableCell className="space-x-1">
                          {(k.scopes || []).map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                        </TableCell>
                        <TableCell>{k.call_count}</TableCell>
                        <TableCell className="text-xs">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}</TableCell>
                        <TableCell><Switch checked={k.active} onCheckedChange={() => toggle(k)} /></TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setPendingDelete(k)} aria-label="Delete key"><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="mt-4 space-y-4">
            <Card className="p-4 space-y-3">
              <div>
                <Label className="text-xs">Base URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={API_BASE} />
                  <Button variant="outline" onClick={() => copy(API_BASE, 'Base URL copied')}><Copy className="w-4 h-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Send your key in the <code>x-api-key</code> header on every call. Keep it on your server — never in browser code.
                </p>
              </div>
            </Card>

            <Card className="p-4 space-y-5">
              <Snippet title="Send an approved template (reminders, confirmations)" code={`curl -X POST "${API_BASE}/send-template" \\
  -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "919876543210",
    "template": "payment_reminder",
    "variables": { "1": "Rahul", "2": "₹200" }
  }'`} />
              <Snippet title="Send a plain message (only inside the 24-hour window)" code={`curl -X POST "${API_BASE}/send-message" \\
  -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "to": "919876543210", "message": "Your driver is on the way." }'`} />
              <Snippet title="Create or update a contact" code={`curl -X POST "${API_BASE}/contacts" \\
  -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Rahul", "phone": "919876543210", "email": "rahul@mail.com", "tags": ["website"] }'`} />
              <Snippet title="Create a booking / order / appointment" code={`curl -X POST "${API_BASE}/records" \\
  -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "record_type": "booking",
    "customer_name": "Rahul",
    "customer_phone": "919876543210",
    "service": "Chennai to Tirunelveli",
    "amount": 6500,
    "advance_amount": 200,
    "scheduled_at": "2026-10-02T09:00:00Z"
  }'`} />
              <Snippet title="Read data" code={`curl "${API_BASE}/templates" -H "x-api-key: YOUR_KEY"
curl "${API_BASE}/contacts"  -H "x-api-key: YOUR_KEY"
curl "${API_BASE}/records"   -H "x-api-key: YOUR_KEY"
curl "${API_BASE}/ping"      -H "x-api-key: YOUR_KEY"`} />
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card className="overflow-hidden">
              {logs.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">No API calls yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>When</TableHead><TableHead>Endpoint</TableHead><TableHead>Status</TableHead><TableHead>Details</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                        <TableCell><code className="text-xs">{l.endpoint}</code></TableCell>
                        <TableCell>
                          <Badge variant={l.status < 300 ? 'default' : 'destructive'}>{l.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate">{l.error || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New API key</DialogTitle>
            <DialogDescription>You'll see the full key once — copy it straight into your app.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Client admin panel" />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              {SCOPES.map(s => (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-sm">{s.label}</span>
                  <Switch
                    checked={scopes.includes(s.id)}
                    onCheckedChange={v => setScopes(p => v ? [...p, s.id] : p.filter(x => x !== s.id))}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!created} onOpenChange={o => !o && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your API key</DialogTitle>
            <DialogDescription>Copy it now — it can't be shown again.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={created || ''} className="font-mono text-xs" />
            <Button variant="outline" onClick={() => copy(created || '', 'API key copied')}><Copy className="w-4 h-4" /></Button>
          </div>
          <DialogFooter><Button onClick={() => setCreated(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={o => !o && setPendingDelete(null)}
        title="Delete API key?"
        description={<>Any app using <b>{pendingDelete?.name}</b> will stop working immediately.</>}
        confirmLabel="Delete key"
        onConfirm={confirmDelete}
      />
    </AppLayout>
  );
};

export default ApiSettings;

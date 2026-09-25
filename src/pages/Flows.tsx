import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import FlowPhonePreview from '@/components/flows/FlowPhonePreview';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { FLOW_STARTERS, stringifyFlow, validateFlowJson } from '@/lib/flowStudio';
import { toast } from 'sonner';
import { Plus, RefreshCw, Send, Trash2, UploadCloud, CheckCircle2, AlertTriangle, Loader2, Workflow, Braces, Copy, WandSparkles } from 'lucide-react';

interface FlowRow {
  id: string;
  name: string;
  flow_id: string | null;
  status: string;
  categories: string[];
  json_definition: any;
  first_screen: string | null;
  cta_text: string;
  last_error: string | null;
  published_at: string | null;
  updated_at: string;
}

const statusTone = (s: string) =>
  s === 'PUBLISHED' ? 'bg-primary/15 text-primary border-primary/30'
    : s === 'DEPRECATED' ? 'bg-destructive/15 text-destructive border-destructive/30'
    : 'bg-muted text-muted-foreground border-border';

const Flows = () => {
  const { user, profile } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [rows, setRows] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftJson, setDraftJson] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftCta, setDraftCta] = useState('Open form');
  const [draftScreen, setDraftScreen] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [starterId, setStarterId] = useState('blank');
  const [testOpen, setTestOpen] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testBody, setTestBody] = useState('Tap below to open the form.');

  const selected = useMemo(() => rows.find(r => r.id === selectedId) || null, [rows, selectedId]);

  const jsonValidity = useMemo(() => validateFlowJson(draftJson), [draftJson]);

  useEffect(() => {
    if (!user) return;
    resolveWorkspaceId(user.id, profile).then(setWsId);
  }, [user, profile]);

  const load = async (ws: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_flows' as any)
      .select('*')
      .eq('workspace_id', ws)
      .order('updated_at', { ascending: false });
    const list = ((data as any) || []) as FlowRow[];
    setRows(list);
    setLoading(false);
    if (list.length && !selectedId) pick(list[0]);
  };

  useEffect(() => { if (wsId) load(wsId); /* eslint-disable-next-line */ }, [wsId]);

  const pick = (row: FlowRow) => {
    setSelectedId(row.id);
    setDraftName(row.name);
    setDraftCta(row.cta_text || 'Open form');
    setDraftScreen(row.first_screen || '');
    setDraftJson(row.json_definition ? JSON.stringify(row.json_definition, null, 2) : '');
  };

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('meta-flow-manage', {
      body: { workspace_id: wsId, ...body },
    });
    if (error) {
      let msg = error.message;
      try {
        const ctx: any = (error as any).context;
        if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); if (j?.error) msg = j.error; }
      } catch { /* keep default */ }
      throw new Error(msg);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const createFlow = async () => {
    if (!wsId || !newName.trim()) return;
    const starter = FLOW_STARTERS.find(item => item.id === starterId) || FLOW_STARTERS[0];
    setBusy('create');
    const { data, error } = await supabase.from('whatsapp_flows' as any).insert({
      workspace_id: wsId,
      name: newName.trim(),
      categories: ['OTHER'],
      status: 'DRAFT',
      json_definition: starter.definition,
      first_screen: starter.definition.screens?.[0]?.id || 'FORM',
      cta_text: starter.cta,
      created_by: user?.id,
    } as any).select('*').single();
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setCreateOpen(false);
    setNewName('');
    setStarterId('blank');
    const row = data as any as FlowRow;
    setRows(prev => [row, ...prev]);
    pick(row);
    toast.success('Form created — customise it, preview it, then publish');
  };

  const saveDraft = async () => {
    if (!selected) return;
    if (!jsonValidity.ok) { toast.error(jsonValidity.errors[0]); return; }
    setBusy('save');
    const parsed = JSON.parse(draftJson);
    const firstScreen = draftScreen || jsonValidity.screens[0]?.id;
    const { error } = await supabase.from('whatsapp_flows' as any).update({
      name: draftName.trim() || selected.name,
      json_definition: parsed,
      first_screen: firstScreen,
      cta_text: draftCta.trim() || 'Open form',
    } as any).eq('id', selected.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Saved');
    if (wsId) load(wsId);
  };

  const runAction = async (action: 'sync' | 'publish' | 'upload' | 'fetch_json' | 'send_test') => {
    if (!wsId) return;
    setBusy(action);
    try {
      if (action === 'sync') {
        const res = await invoke({ action: 'sync' });
        toast.success(`${res.synced ?? 0} form(s) synced from WhatsApp`);
      } else if (action === 'fetch_json' && selected?.flow_id) {
        const res = await invoke({ action: 'fetch_json', flow_id: selected.flow_id });
        setDraftJson(JSON.stringify(res.json_definition, null, 2));
        toast.success('Latest form code loaded from WhatsApp');
      } else if (action === 'publish' || action === 'upload') {
        if (!selected) return;
         if (!jsonValidity.ok) { toast.error(jsonValidity.errors[0]); setBusy(null); return; }
        await saveDraftSilently();
        const res = await invoke({ action, id: selected.id });
        toast.success(action === 'publish' ? 'Published on WhatsApp — ready to send' : 'Saved to WhatsApp as a draft');
        if (res?.flow_id) toast.message(`Form ID: ${res.flow_id}`);
      } else if (action === 'send_test') {
        if (!selected) return;
        await invoke({ action: 'send_test', id: selected.id, to: testNumber, body_text: testBody });
        setTestOpen(false);
        toast.success('Test form sent on WhatsApp');
      }
      if (wsId) await load(wsId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    }
    setBusy(null);
  };

  const saveDraftSilently = async () => {
    if (!selected || !jsonValidity.ok) return;
    const { error } = await supabase.from('whatsapp_flows' as any).update({
      name: draftName.trim() || selected.name,
      json_definition: JSON.parse(draftJson),
      first_screen: draftScreen || jsonValidity.screens[0]?.id,
      cta_text: draftCta.trim() || 'Open form',
    } as any).eq('id', selected.id);
    if (error) throw error;
  };

  const removeFlow = async (row: FlowRow) => {
    const { error } = await supabase.from('whatsapp_flows' as any).delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.filter(r => r.id !== row.id));
    if (selectedId === row.id) { setSelectedId(null); setDraftJson(''); }
    toast.success('Removed from Reachably');
  };

  const formatJson = () => {
    if (!jsonValidity.definition) { toast.error(jsonValidity.errors[0]); return; }
    setDraftJson(stringifyFlow(jsonValidity.definition));
    toast.success('Form code formatted');
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(draftJson);
    toast.success('Form code copied');
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">WhatsApp Forms</h1>
            <p className="text-sm text-muted-foreground">Create any form customers can complete inside WhatsApp, preview every screen, publish, and test it.</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button className="flex-1 sm:flex-none" variant="outline" onClick={() => runAction('sync')} disabled={busy === 'sync'}>
              {busy === 'sync' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Sync from WhatsApp
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" /> New form</Button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* List */}
          <Card className="p-3 h-fit">
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="py-10 px-3 text-center space-y-3">
                <Workflow className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No forms yet. Create one, or pull existing forms from your WhatsApp account.</p>
                <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" /> New form</Button>
              </div>
            ) : (
              <div className="space-y-1">
                {rows.map(row => (
                  <button
                    key={row.id}
                    onClick={() => pick(row)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${selectedId === row.id ? 'bg-muted' : 'hover:bg-muted/60'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{row.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${statusTone(row.status)}`}>{row.status}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {row.flow_id ? `ID ${row.flow_id}` : 'Not on WhatsApp yet'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Editor */}
          {selected ? (
            <div className="space-y-4 min-w-0">
            <Card className="p-3 sm:p-4 space-y-4 overflow-hidden">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Form name</Label>
                  <Input value={draftName} onChange={e => setDraftName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Button text</Label>
                  <Input value={draftCta} onChange={e => setDraftCta(e.target.value)} maxLength={20} />
                </div>
                <div className="space-y-1.5">
                  <Label>Opening screen</Label>
                  <Select value={draftScreen || jsonValidity.screens[0]?.id || ''} onValueChange={setDraftScreen}>
                    <SelectTrigger><SelectValue placeholder="Choose a screen" /></SelectTrigger>
                    <SelectContent>{jsonValidity.screens.map(screen => <SelectItem key={screen.id} value={screen.id}>{screen.title || screen.id}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {selected.last_error && (
                <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive whitespace-pre-wrap">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{selected.last_error}</span>
                </div>
              )}

              <Tabs defaultValue="build" className="space-y-3">
                <TabsList className="grid w-full grid-cols-2 sm:w-[320px]"><TabsTrigger value="build">Form code</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList>
                <TabsContent value="build" className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Meta Flow JSON</Label>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={formatJson} disabled={!jsonValidity.definition}><Braces className="w-3.5 h-3.5 mr-1" /> Format</Button>
                    <Button size="sm" variant="ghost" onClick={copyJson} disabled={!draftJson}><Copy className="w-3.5 h-3.5 mr-1" /> Copy</Button>
                    {selected.flow_id && (
                      <Button size="sm" variant="ghost" onClick={() => runAction('fetch_json')} disabled={busy === 'fetch_json'}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Load from WhatsApp
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea
                  value={draftJson}
                  onChange={e => setDraftJson(e.target.value)}
                  spellCheck={false}
                  className="font-mono text-[11px] leading-relaxed min-h-[360px] max-h-[62dvh] overflow-auto whitespace-pre"
                  placeholder='{"version":"7.3","screens":[ ... ]}'
                />
                {jsonValidity.ok ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span>{jsonValidity.screens.length} screen(s):</span>
                    {jsonValidity.screens.map(s => <Badge key={s.id} variant="secondary" className="text-[10px]">{s.id}</Badge>)}
                  </div>
                ) : (
                  <div className="space-y-1">{jsonValidity.errors.map(error => <p key={error} className="text-xs text-destructive">{error}</p>)}</div>
                )}
                </TabsContent>
                <TabsContent value="preview" className="lg:hidden"><FlowPhonePreview screens={jsonValidity.screens} initialScreen={draftScreen} /></TabsContent>
              </Tabs>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" onClick={saveDraft} disabled={busy === 'save'}>Save</Button>
                <Button variant="outline" onClick={() => runAction('upload')} disabled={busy === 'upload'}>
                  {busy === 'upload' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                  Save to WhatsApp
                </Button>
                <Button onClick={() => runAction('publish')} disabled={busy === 'publish'}>
                  {busy === 'publish' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Publish
                </Button>
                <Button variant="outline" onClick={() => setTestOpen(true)} disabled={selected.status !== 'PUBLISHED'}>
                  <Send className="w-4 h-4 mr-2" /> Send test to my phone
                </Button>
                <Button variant="ghost" className="text-destructive sm:ml-auto" onClick={() => removeFlow(selected)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Remove
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                 Once published, attach this form to a template button or trigger it from Automation when a customer sends a keyword.
                 Every submission gets a unique CRM reference and saves all submitted fields. Travel bookings keep their automatic advance-payment flow.
              </p>
            </Card>
            <Card className="hidden lg:block p-4">
              <div className="mb-3"><h2 className="font-semibold">Live preview</h2><p className="text-xs text-muted-foreground">Screen-by-screen preview updates as you edit the JSON.</p></div>
              <FlowPhonePreview screens={jsonValidity.screens} initialScreen={draftScreen} />
            </Card>
            </div>
          ) : (
            <Card className="p-10 text-center text-sm text-muted-foreground">Pick a form on the left, or create a new one.</Card>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New WhatsApp form</DialogTitle>
            <DialogDescription>Choose a starting point. Every field and screen can be changed later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Form name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Customer enquiry" /></div>
            <div className="space-y-2"><Label>Start with</Label><div className="grid gap-2 sm:grid-cols-2">
              {FLOW_STARTERS.map(starter => <Button key={starter.id} type="button" variant={starterId === starter.id ? 'default' : 'outline'} className="h-auto justify-start px-3 py-3 text-left" onClick={() => { setStarterId(starter.id); if (!newName) setNewName(starter.name); }}><WandSparkles className="mr-2 h-4 w-4 shrink-0" /><span className="min-w-0"><span className="block text-sm font-medium">{starter.name}</span><span className="block whitespace-normal text-xs opacity-70">{starter.description}</span></span></Button>)}
            </div></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createFlow} disabled={!newName.trim() || busy === 'create'}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send a test form</DialogTitle>
            <DialogDescription>We will send the form button to this WhatsApp number right now.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>WhatsApp number (with country code)</Label>
              <Input value={testNumber} onChange={e => setTestNumber(e.target.value)} placeholder="919000000000" />
            </div>
            <div className="space-y-1.5">
              <Label>Message above the button</Label>
              <Textarea value={testBody} onChange={e => setTestBody(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>Cancel</Button>
            <Button onClick={() => runAction('send_test')} disabled={!testNumber.trim() || busy === 'send_test'}>
              {busy === 'send_test' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Flows;

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Save, Trash2, Copy, Send, RefreshCw, Upload, Globe, FileText, HelpCircle, Loader2, Code } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const ChatbotDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [bot, setBot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [sources, setSources] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selConv, setSelConv] = useState<any>(null);
  const [convMsgs, setConvMsgs] = useState<any[]>([]);

  // train inputs
  const [urlIn, setUrlIn] = useState('');
  const [textIn, setTextIn] = useState('');
  const [faqPairs, setFaqPairs] = useState<{ q: string; a: string }[]>([{ q: '', a: '' }]);
  const [training, setTraining] = useState<string | null>(null);

  // test chat
  const [testMsgs, setTestMsgs] = useState<{ role: string; content: string }[]>([]);
  const [testInput, setTestInput] = useState('');
  const [testSending, setTestSending] = useState(false);
  const testVid = useRef('test_' + Math.random().toString(36).slice(2));

  // reply-as-human
  const [agentReply, setAgentReply] = useState('');

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    setLoading(true);
    const { data: b } = await supabase.from('chatbots' as any).select('*').eq('id', id!).maybeSingle();
    if (!b) { toast.error('Chatbot not found'); nav('/chatbots'); return; }
    setBot(b);
    const [{ data: srcs }, { data: convs }] = await Promise.all([
      supabase.from('chatbot_sources' as any).select('*').eq('chatbot_id', id!).order('created_at', { ascending: false }),
      supabase.from('chatbot_conversations' as any).select('*').eq('chatbot_id', id!).order('last_message_at', { ascending: false }).limit(100),
    ]);
    setSources((srcs as any[]) || []);
    setConversations((convs as any[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!selConv) return;
    (async () => {
      const { data } = await supabase.from('chatbot_messages' as any).select('*').eq('conversation_id', selConv.id).order('created_at');
      setConvMsgs((data as any[]) || []);
    })();
    const ch = supabase.channel('cbmsg_' + selConv.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chatbot_messages', filter: `conversation_id=eq.${selConv.id}` },
        (payload) => setConvMsgs(m => [...m, payload.new]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selConv]);

  async function save(patch: any) {
    setSaving(true);
    const { data, error } = await supabase.from('chatbots' as any).update(patch).eq('id', id!).select('*').single();
    setSaving(false);
    if (error) return toast.error(error.message);
    setBot(data);
    toast.success('Saved');
  }

  async function del() {
    const { error } = await supabase.from('chatbots' as any).delete().eq('id', id!);
    if (error) return toast.error(error.message);
    toast.success('Deleted');
    nav('/chatbots');
  }

  async function ingest(payload: any) {
    setTraining(payload.type);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/chatbot-ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session?.access_token}` },
      body: JSON.stringify({ chatbot_id: id, ...payload }),
    });
    const r = await res.json();
    setTraining(null);
    if (!res.ok) return toast.error(r.error || 'Ingest failed');
    toast.success(`Trained on ${r.chunks} chunks (${r.chars} chars)`);
    await load();
  }

  async function deleteSource(sid: string) {
    await supabase.from('chatbot_chunks' as any).delete().eq('source_id', sid);
    await supabase.from('chatbot_sources' as any).delete().eq('id', sid);
    toast.success('Source removed');
    load();
  }

  async function uploadPdf(file: File) {
    if (file.size > 10 * 1024 * 1024) return toast.error('Max 10 MB');
    const path = `${id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('chatbot-uploads').upload(path, file);
    if (error) return toast.error(error.message);
    await ingest({ type: 'pdf', storage_path: path, title: file.name });
  }

  async function sendTest() {
    if (!testInput.trim() || !bot) return;
    const msg = testInput.trim();
    setTestMsgs(m => [...m, { role: 'user', content: msg }]);
    setTestInput(''); setTestSending(true);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/chatbot-message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_key: bot.public_key, visitor_id: testVid.current, message: msg }),
    });
    const r = await res.json();
    setTestSending(false);
    if (r.reply) setTestMsgs(m => [...m, { role: 'assistant', content: r.reply }]);
    else if (r.error) toast.error(r.error);
  }

  async function sendAgentReply() {
    if (!selConv || !agentReply.trim() || !bot) return;
    await supabase.from('chatbot_messages' as any).insert({
      conversation_id: selConv.id, chatbot_id: bot.id, workspace_id: bot.workspace_id,
      role: 'agent', content: agentReply.trim(),
    });
    await supabase.from('chatbot_conversations' as any).update({
      last_message_at: new Date().toISOString(),
      last_message_preview: agentReply.slice(0, 200),
    }).eq('id', selConv.id);
    setAgentReply('');
  }

  async function toggleTakeover(v: boolean) {
    if (!selConv) return;
    await supabase.from('chatbot_conversations' as any).update({ human_takeover: v }).eq('id', selConv.id);
    setSelConv({ ...selConv, human_takeover: v });
  }

  if (loading || !bot) {
    return <AppLayout><div className="p-6">Loading…</div></AppLayout>;
  }

  const embedSnippet = `<script src="${SUPABASE_URL}/functions/v1/widget-js?bot=${bot.public_key}" async></script>`;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => nav('/chatbots')}><ArrowLeft className="w-4 h-4" /></Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{bot.name}</h1>
            <div className="text-xs text-muted-foreground truncate">Public key: <code>{bot.public_key}</code></div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm">Enabled</span>
            <Switch checked={bot.enabled} onCheckedChange={v => save({ enabled: v })} />
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete chatbot?</AlertDialogTitle><AlertDialogDescription>All sources, chunks, and conversations will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="train">Train</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
            <TabsTrigger value="install">Install</TabsTrigger>
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 mt-4">
            <Card className="p-4 space-y-3">
              <div>
                <Label>Name</Label>
                <Input defaultValue={bot.name} onBlur={e => e.target.value !== bot.name && save({ name: e.target.value })} />
              </div>
              <div>
                <Label>Welcome message</Label>
                <Textarea defaultValue={bot.welcome_message} onBlur={e => e.target.value !== bot.welcome_message && save({ welcome_message: e.target.value })} />
              </div>
              <div>
                <Label>System prompt (behaviour)</Label>
                <Textarea rows={5} defaultValue={bot.system_prompt} onBlur={e => e.target.value !== bot.system_prompt && save({ system_prompt: e.target.value })} />
              </div>
              <div>
                <Label>Tone</Label>
                <Select defaultValue={bot.tone} onValueChange={v => save({ tone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="playful">Playful</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {saving && <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</div>}
            </Card>
          </TabsContent>

          <TabsContent value="train" className="space-y-3 mt-4">
            <Card className="p-4 space-y-3">
              <div className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4" /> Website URL</div>
              <div className="flex gap-2">
                <Input value={urlIn} onChange={e => setUrlIn(e.target.value)} placeholder="https://your-site.com/faq" />
                <Button disabled={training !== null || !urlIn.trim()} onClick={() => { ingest({ type: 'url', url: urlIn.trim() }); setUrlIn(''); }}>
                  {training === 'url' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crawl'}
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="font-semibold flex items-center gap-2"><Upload className="w-4 h-4" /> PDF upload</div>
              <input type="file" accept="application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.currentTarget.value = ''; }} />
              {training === 'pdf' && <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Processing PDF…</div>}
            </Card>

            <Card className="p-4 space-y-3">
              <div className="font-semibold flex items-center gap-2"><HelpCircle className="w-4 h-4" /> FAQ pairs</div>
              {faqPairs.map((p, i) => (
                <div key={i} className="grid md:grid-cols-2 gap-2">
                  <Input placeholder="Question" value={p.q} onChange={e => { const c = [...faqPairs]; c[i].q = e.target.value; setFaqPairs(c); }} />
                  <Input placeholder="Answer" value={p.a} onChange={e => { const c = [...faqPairs]; c[i].a = e.target.value; setFaqPairs(c); }} />
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setFaqPairs([...faqPairs, { q: '', a: '' }])}>+ Add pair</Button>
                <Button disabled={training !== null || !faqPairs.some(p => p.q && p.a)} onClick={() => { ingest({ type: 'faq', faq: faqPairs.filter(p => p.q && p.a), title: 'FAQ' }); setFaqPairs([{ q: '', a: '' }]); }}>
                  {training === 'faq' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Train on FAQ'}
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Custom text / instructions</div>
              <Textarea rows={5} value={textIn} onChange={e => setTextIn(e.target.value)} placeholder="Paste product info, policies, anything the bot should know…" />
              <Button disabled={training !== null || !textIn.trim()} onClick={() => { ingest({ type: 'text', text: textIn, title: 'Custom text' }); setTextIn(''); }}>
                {training === 'text' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Train on text'}
              </Button>
            </Card>

            <Card className="p-4">
              <div className="font-semibold mb-2">Knowledge sources ({sources.length})</div>
              {sources.length === 0 ? <div className="text-sm text-muted-foreground">None yet.</div> : (
                <div className="space-y-2">
                  {sources.map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-2 border rounded">
                      <Badge variant="outline">{s.type}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{s.title || s.source_ref || s.id}</div>
                        <div className="text-xs text-muted-foreground">{s.status} · {s.chars_ingested} chars{s.error ? ` · ${s.error}` : ''}</div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => deleteSource(s.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-3 mt-4">
            <Card className="p-4 space-y-3">
              <div>
                <Label>Brand color</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" defaultValue={bot.brand_color} onBlur={e => e.target.value !== bot.brand_color && save({ brand_color: e.target.value })} className="w-12 h-10 rounded border" />
                  <Input defaultValue={bot.brand_color} onBlur={e => e.target.value !== bot.brand_color && save({ brand_color: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Launcher text</Label>
                <Input defaultValue={bot.launcher_text} onBlur={e => e.target.value !== bot.launcher_text && save({ launcher_text: e.target.value })} />
              </div>
              <div>
                <Label>Avatar URL (optional)</Label>
                <Input defaultValue={bot.avatar_url || ''} onBlur={e => e.target.value !== (bot.avatar_url || '') && save({ avatar_url: e.target.value || null })} />
              </div>
              <div>
                <Label>Position</Label>
                <Select defaultValue={bot.position} onValueChange={v => save({ position: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Bottom right</SelectItem>
                    <SelectItem value="bottom-left">Bottom left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="mt-4">
            <Card className="p-4">
              <div className="mb-3 text-sm text-muted-foreground">Chat with the live bot using the same public endpoint that your website will use.</div>
              <div className="h-96 overflow-y-auto space-y-2 bg-muted/30 p-3 rounded">
                {testMsgs.length === 0 && <div className="text-sm text-muted-foreground">Say hi 👋</div>}
                {testMsgs.map((m, i) => (
                  <div key={i} className={`max-w-[80%] p-2 rounded text-sm ${m.role === 'user' ? 'ml-auto text-white' : 'bg-white border'}`} style={m.role === 'user' ? { background: bot.brand_color } : {}}>
                    {m.content}
                  </div>
                ))}
                {testSending && <div className="text-xs text-muted-foreground">typing…</div>}
              </div>
              <form className="flex gap-2 mt-3" onSubmit={e => { e.preventDefault(); sendTest(); }}>
                <Input value={testInput} onChange={e => setTestInput(e.target.value)} placeholder="Message" />
                <Button type="submit" disabled={testSending}><Send className="w-4 h-4" /></Button>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="install" className="mt-4 space-y-3">
            <Card className="p-4 space-y-3">
              <div className="font-semibold flex items-center gap-2"><Code className="w-4 h-4" /> Embed on any website</div>
              <p className="text-sm text-muted-foreground">Paste this snippet before the closing <code>&lt;/body&gt;</code> tag of your site (WordPress, Shopify, Webflow, React, plain HTML — all supported).</p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto"><code>{embedSnippet}</code></pre>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(embedSnippet); toast.success('Copied'); }}><Copy className="w-4 h-4 mr-1" /> Copy snippet</Button>
              <div className="text-xs text-muted-foreground pt-2 border-t">
                <div className="font-semibold text-foreground mb-1">Platform notes</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li><b>WordPress:</b> Appearance → Widgets → Custom HTML, or paste in your theme's footer.</li>
                  <li><b>Shopify:</b> Online Store → Themes → Edit Code → theme.liquid, paste before <code>&lt;/body&gt;</code>.</li>
                  <li><b>Webflow:</b> Project Settings → Custom Code → Footer Code.</li>
                  <li><b>React/Next.js:</b> Inject via <code>useEffect</code> or Next <code>Script</code> component.</li>
                </ul>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="conversations" className="mt-4">
            <div className="grid md:grid-cols-[280px_1fr] gap-3 h-[600px]">
              <Card className="p-0 overflow-y-auto">
                <div className="p-2 border-b flex items-center justify-between">
                  <div className="text-sm font-semibold">{conversations.length} conversations</div>
                  <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-3 h-3" /></Button>
                </div>
                {conversations.length === 0 && <div className="p-4 text-sm text-muted-foreground">No conversations yet.</div>}
                {conversations.map(c => (
                  <div key={c.id} onClick={() => setSelConv(c)} className={`p-3 border-b cursor-pointer hover:bg-muted ${selConv?.id === c.id ? 'bg-muted' : ''}`}>
                    <div className="text-sm font-medium truncate">{c.visitor_name || c.visitor_id.slice(0, 12)}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.last_message_preview || '—'}</div>
                    <div className="text-xs text-muted-foreground">{c.visitor_email || c.page_url || ''}</div>
                  </div>
                ))}
              </Card>

              <Card className="p-0 flex flex-col">
                {!selConv ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a conversation</div>
                ) : (
                  <>
                    <div className="p-3 border-b flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{selConv.visitor_name || 'Visitor'}</div>
                        <div className="text-xs text-muted-foreground truncate">{selConv.visitor_email || selConv.page_url || selConv.visitor_id}</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        Human takeover
                        <Switch checked={selConv.human_takeover} onCheckedChange={toggleTakeover} />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20">
                      {convMsgs.map((m: any) => (
                        <div key={m.id} className={`max-w-[80%] p-2 rounded text-sm ${m.role === 'user' ? 'bg-white border' : m.role === 'agent' ? 'ml-auto bg-blue-600 text-white' : 'ml-auto text-white'}`} style={m.role === 'assistant' ? { background: bot.brand_color } : {}}>
                          <div className="text-[10px] opacity-70 uppercase">{m.role}</div>
                          {m.content}
                        </div>
                      ))}
                    </div>
                    <form className="p-3 border-t flex gap-2" onSubmit={e => { e.preventDefault(); sendAgentReply(); }}>
                      <Input value={agentReply} onChange={e => setAgentReply(e.target.value)} placeholder="Reply as human…" />
                      <Button type="submit" disabled={!agentReply.trim()}><Send className="w-4 h-4" /></Button>
                    </form>
                  </>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ChatbotDetail;

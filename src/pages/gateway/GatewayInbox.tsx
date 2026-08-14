import { useEffect, useRef, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import {
  addQuotaUsed, gatewayApi, getGatewaySettings, getSavedContacts, quotaRemaining, toArray,
} from '@/lib/gateway';

type Msg = { id: string; body: string; fromMe: boolean; ts: number };

const normalise = (m: any, i: number): Msg => ({
  id: String(m?.id ?? m?.messageId ?? i),
  body: String(m?.body ?? m?.message ?? m?.text ?? ''),
  fromMe: !!(m?.fromMe ?? m?.from_me ?? m?.outgoing),
  ts: Number(m?.timestamp ?? m?.ts ?? 0) || 0,
});

const GatewayInbox = () => {
  const contacts = getSavedContacts();
  const [chatId, setChatId] = useState(contacts[0]?.number || '');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const timer = useRef<any>(null);

  const load = async (id = chatId) => {
    const { instanceId } = getGatewaySettings();
    if (!instanceId || !id) return;
    setLoading(true);
    try {
      const data = await gatewayApi.messages(instanceId, id);
      setMessages(toArray(data).map(normalise).sort((a, b) => a.ts - b.ts));
    } catch (e: any) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    clearInterval(timer.current);
    if (chatId) timer.current = setInterval(() => load(chatId), 10000);
    return () => clearInterval(timer.current);
  }, [chatId]);

  const send = async () => {
    const { instanceId } = getGatewaySettings();
    if (!instanceId) { toast.error('Connect an instance first'); return; }
    if (!draft.trim() || !chatId) return;
    if (quotaRemaining() <= 0) { toast.error('Daily quota reached'); return; }
    try {
      await gatewayApi.send(instanceId, chatId, draft);
      addQuotaUsed(1);
      setMessages(m => [...m, { id: String(Date.now()), body: draft, fromMe: true, ts: Date.now() / 1000 }]);
      setDraft('');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Gateway Inbox</h1>
        <p className="text-muted-foreground text-sm mb-5">Polls chat history from the gateway every 10 seconds.</p>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
          <Card className="p-3 h-fit">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Chats</p>
            <Input placeholder="Chat ID / number" value={chatId} onChange={e => setChatId(e.target.value)} className="mb-2" />
            <div className="divide-y max-h-[50vh] overflow-y-auto">
              {contacts.map(c => (
                <button key={c.number} onClick={() => setChatId(c.number)}
                  className={`w-full text-left py-2 px-1 text-sm ${chatId === c.number ? 'font-semibold' : ''}`}>
                  {c.name}
                  <span className="block text-xs text-muted-foreground font-mono">{c.number}</span>
                </button>
              ))}
              {contacts.length === 0 && <p className="text-sm text-muted-foreground py-3">Import contacts to list chats.</p>}
            </div>
          </Card>

          <Card className="flex flex-col h-[65vh]">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
              {!loading && messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">No messages yet for this chat.</p>
              )}
              {messages.map(m => (
                <div key={m.id} className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.fromMe ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {m.body}
                </div>
              ))}
            </div>
            <div className="border-t p-3 flex gap-2">
              <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a message"
                onKeyDown={e => { if (e.key === 'Enter') send(); }} />
              <Button onClick={send}><Send className="w-4 h-4" /></Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default GatewayInbox;

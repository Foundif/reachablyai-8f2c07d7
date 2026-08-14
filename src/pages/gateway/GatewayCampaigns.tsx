import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  DAILY_QUOTA, addQuotaUsed, gatewayApi, getGatewaySettings,
  getQuotaUsed, getSavedContacts, quotaRemaining,
} from '@/lib/gateway';

type Card_ = { title: string; description: string; imageUrl: string; buttonText: string };

const GatewayCampaigns = () => {
  const contacts = getSavedContacts();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [manual, setManual] = useState('');
  const [message, setMessage] = useState('Hi {{name}}, ');
  const [title, setTitle] = useState('Our latest picks');
  const [cards, setCards] = useState<Card_[]>([{ title: '', description: '', imageUrl: '', buttonText: 'View' }]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [used, setUsed] = useState(getQuotaUsed());

  const recipients = () => {
    const picked = contacts.filter(c => selected[c.number]);
    const extra = manual.split(/[\n,;]+/).map(s => s.trim().replace(/[^\d+]/g, '')).filter(Boolean)
      .map(n => ({ number: n, name: n }));
    const map = new Map<string, { number: string; name: string }>();
    [...picked, ...extra].forEach(c => map.set(c.number, { number: c.number, name: (c as any).name || c.number }));
    return Array.from(map.values());
  };

  const guard = (count: number) => {
    const { instanceId } = getGatewaySettings();
    if (!instanceId) { toast.error('Connect a WhatsApp instance first'); return false; }
    if (!count) { toast.error('Pick at least one recipient'); return false; }
    if (count > quotaRemaining()) {
      toast.error(`Daily quota exceeded — ${quotaRemaining()} of ${DAILY_QUOTA} messages left today`);
      return false;
    }
    return true;
  };

  const sendText = async () => {
    const list = recipients();
    if (!guard(list.length)) return;
    if (!message.trim()) { toast.error('Message is empty'); return; }
    const { instanceId } = getGatewaySettings();
    setSending(true); setProgress(0);
    try {
      const payload = list.map(r => ({ number: r.number, message: message.split('{{name}}').join(r.name) }));
      if (payload.length === 1) {
        await gatewayApi.send(instanceId, payload[0].number, payload[0].message);
      } else {
        await gatewayApi.sendBulk(instanceId, payload);
      }
      setProgress(100);
      setUsed(addQuotaUsed(payload.length));
      toast.success(`Sent to ${payload.length} recipient(s)`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const sendCarousel = async () => {
    const list = recipients();
    if (!guard(list.length)) return;
    const clean = cards.filter(c => c.title.trim());
    if (!clean.length) { toast.error('Add at least one card with a title'); return; }
    const { instanceId } = getGatewaySettings();
    setSending(true); setProgress(0);
    let done = 0;
    for (const r of list) {
      try {
        await gatewayApi.sendCarousel(instanceId, r.number, title, clean);
        done++;
      } catch (e: any) {
        toast.error(`${r.number}: ${e.message}`);
      }
      setProgress(Math.round((++done / list.length) * 100));
    }
    setUsed(addQuotaUsed(done));
    setSending(false);
    toast.success(`Carousel sent to ${done} recipient(s)`);
  };

  const count = recipients().length;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Campaign Builder</h1>
            <p className="text-muted-foreground text-sm mt-1">Send text or carousel campaigns through your gateway.</p>
          </div>
          <Badge variant="secondary">{used}/{DAILY_QUOTA} used today</Badge>
        </div>

        <Card className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Recipients ({count})</Label>
          <div className="divide-y max-h-52 overflow-y-auto border rounded-lg px-3">
            {contacts.length === 0 && <p className="text-sm text-muted-foreground py-4">No saved contacts — import some or paste numbers below.</p>}
            {contacts.map(c => (
              <label key={c.number} className="flex items-center gap-3 py-2 cursor-pointer">
                <Checkbox checked={!!selected[c.number]} onCheckedChange={v => setSelected(s => ({ ...s, [c.number]: !!v }))} />
                <span className="text-sm">{c.name} <span className="text-muted-foreground font-mono text-xs">{c.number}</span></span>
              </label>
            ))}
          </div>
          <Textarea placeholder="Or paste numbers, one per line" value={manual} onChange={e => setManual(e.target.value)} rows={3} />
        </Card>

        <Tabs defaultValue="text">
          <TabsList>
            <TabsTrigger value="text">Text message</TabsTrigger>
            <TabsTrigger value="carousel">Carousel</TabsTrigger>
          </TabsList>

          <TabsContent value="text">
            <Card className="p-4 space-y-3">
              <Label>Message — use <code>{'{{name}}'}</code> for personalisation</Label>
              <Textarea rows={6} value={message} onChange={e => setMessage(e.target.value)} />
              <Button onClick={sendText} disabled={sending}>
                {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Send to {count}
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="carousel">
            <Card className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Carousel title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              {cards.map((c, i) => (
                <div key={i} className="border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Card {i + 1}</p>
                    <Button variant="ghost" size="icon" onClick={() => setCards(cards.filter((_, j) => j !== i))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input placeholder="Title" value={c.title} onChange={e => setCards(cards.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                  <Input placeholder="Description" value={c.description} onChange={e => setCards(cards.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                  <Input placeholder="Image URL" value={c.imageUrl} onChange={e => setCards(cards.map((x, j) => j === i ? { ...x, imageUrl: e.target.value } : x))} />
                  <Input placeholder="Button text" value={c.buttonText} onChange={e => setCards(cards.map((x, j) => j === i ? { ...x, buttonText: e.target.value } : x))} />
                  {c.imageUrl && <img src={c.imageUrl} alt={c.title || 'Card preview'} className="w-full h-32 object-cover rounded-lg" />}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setCards([...cards, { title: '', description: '', imageUrl: '', buttonText: 'View' }])}>
                <Plus className="w-4 h-4 mr-2" /> Add card
              </Button>
              <div>
                <Button onClick={sendCarousel} disabled={sending}>
                  {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Send carousel to {count}
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {sending && <Progress value={progress} className="h-2" />}
      </div>
    </AppLayout>
  );
};

export default GatewayCampaigns;

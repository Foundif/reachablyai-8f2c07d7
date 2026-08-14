import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Download, Loader2, Trash2 } from 'lucide-react';
import {
  GatewayContact, gatewayApi, getGatewaySettings, getSavedContacts,
  removeContact, saveContacts, toArray,
} from '@/lib/gateway';

const normalise = (c: any): GatewayContact | null => {
  const number = String(c?.number ?? c?.phone ?? c?.id ?? c?.wa_id ?? '').replace(/[^\d+]/g, '');
  if (!number) return null;
  return { id: number, name: String(c?.name ?? c?.pushname ?? c?.notify ?? number), number, savedAt: new Date().toISOString() };
};

const GatewayContacts = () => {
  const [remote, setRemote] = useState<GatewayContact[]>([]);
  const [saved, setSaved] = useState<GatewayContact[]>(getSavedContacts());
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  const fetchContacts = async () => {
    const { instanceId } = getGatewaySettings();
    if (!instanceId) { toast.error('Connect an instance first'); return; }
    setLoading(true);
    try {
      const data = await gatewayApi.contacts(instanceId);
      const list = toArray(data).map(normalise).filter(Boolean) as GatewayContact[];
      setRemote(list);
      if (!list.length) toast.info('Gateway returned no contacts');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  const filtered = remote.filter(c =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.number.includes(q));

  const importSelected = () => {
    const list = filtered.filter(c => selected[c.number]);
    if (!list.length) { toast.error('Select at least one contact'); return; }
    setSaved(saveContacts(list));
    setSelected({});
    toast.success(`${list.length} contact(s) saved`);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Gateway Contacts</h1>
            <p className="text-muted-foreground text-sm mt-1">Pull contacts from your connected WhatsApp instance and save them locally.</p>
          </div>
          <Button onClick={fetchContacts} disabled={loading} variant="outline" size="sm">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Fetch
          </Button>
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search name or number" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
            <Button size="sm" onClick={importSelected}>Import selected</Button>
            <Button size="sm" variant="outline" onClick={() => { setSaved(saveContacts(filtered)); toast.success('All imported'); }}>
              Import all
            </Button>
          </div>
          <div className="divide-y max-h-[45vh] overflow-y-auto">
            {filtered.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No contacts loaded.</p>}
            {filtered.map(c => (
              <label key={c.number} className="flex items-center gap-3 py-2.5 cursor-pointer">
                <Checkbox
                  checked={!!selected[c.number]}
                  onCheckedChange={v => setSelected(s => ({ ...s, [c.number]: !!v }))}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{c.number}</p>
                </div>
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <p className="font-semibold text-sm mb-3">Saved contacts ({saved.length})</p>
          <div className="divide-y max-h-[40vh] overflow-y-auto">
            {saved.length === 0 && <p className="text-sm text-muted-foreground py-4">Nothing saved yet.</p>}
            {saved.map(c => (
              <div key={c.number} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{c.number}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSaved(removeContact(c.number))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default GatewayContacts;

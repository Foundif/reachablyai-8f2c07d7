import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Code2, Copy, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

type Key = { id: string; label: string; key: string; createdAt: string };
const STORAGE = 'foundif_api_keys';
const gen = () => 'fdif_' + crypto.randomUUID().replace(/-/g, '').slice(0, 32);

const ApiConsole = () => {
  const [keys, setKeys] = useState<Key[]>([]);
  const [label, setLabel] = useState('');
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  useEffect(() => { setKeys(JSON.parse(localStorage.getItem(STORAGE) || '[]')); }, []);
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(keys)); }, [keys]);

  const create = () => {
    if (!label) return toast.error('Give the key a label');
    setKeys((k) => [{ id: crypto.randomUUID(), label, key: gen(), createdAt: new Date().toISOString() }, ...k]);
    setLabel(''); toast.success('API key created');
  };
  const remove = (id: string) => { setKeys((k) => k.filter((x) => x.id !== id)); toast.success('Key revoked'); };
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success('Copied'); };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Code2 className="w-6 h-6 text-primary" /> API Console
          </h1>
          <p className="text-sm text-muted-foreground">Programmatic access to your Foundif workspace.</p>
        </div>

        <div className="glass-elevated p-4">
          <h2 className="font-semibold mb-3">Create new key</h2>
          <div className="flex gap-2">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Production server)" />
            <Button onClick={create}><Plus className="w-4 h-4" /> Generate</Button>
          </div>
        </div>

        <div className="glass-elevated divide-y divide-border/50">
          {keys.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No API keys yet.</div>}
          {keys.map((k) => (
            <div key={k.id} className="p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{k.label}</p>
                <code className="text-xs text-muted-foreground font-mono">
                  {reveal[k.id] ? k.key : k.key.slice(0, 10) + '••••••••••••••••••'}
                </code>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setReveal((r) => ({ ...r, [k.id]: !r[k.id] }))}>
                {reveal[k.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => copy(k.key)}><Copy className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(k.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </div>

        <div className="glass-panel p-4">
          <h3 className="font-semibold mb-2 text-sm">Quick start</h3>
          <pre className="text-[11px] font-mono bg-muted/40 p-3 rounded-lg overflow-x-auto">
{`curl https://api.foundif.app/v1/messages \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -d '{"to":"+919999999999","text":"Hello from API"}'`}
          </pre>
        </div>
      </div>
    </AppLayout>
  );
};
export default ApiConsole;

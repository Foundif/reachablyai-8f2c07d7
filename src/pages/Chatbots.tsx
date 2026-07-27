import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { toast } from 'sonner';
import { Bot, Plus, MessagesSquare } from 'lucide-react';

const Chatbots = () => {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [wsId, setWsId] = useState<string | null>(null);
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    (async () => {
      if (!user) return;
      const id = await resolveWorkspaceId(user.id, profile);
      setWsId(id);
      if (id) await load(id);
      setLoading(false);
    })();
  }, [user, profile]);

  async function load(id: string) {
    const { data } = await supabase.from('chatbots' as any).select('*').eq('workspace_id', id).order('created_at', { ascending: false });
    setBots((data as any[]) || []);
  }

  async function create() {
    if (!wsId || !name.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from('chatbots' as any).insert({
      workspace_id: wsId, name: name.trim(), created_by: user!.id,
    }).select('*').single();
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success('Chatbot created');
    setOpen(false); setName('');
    nav(`/chatbots/${(data as any).id}`);
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="w-6 h-6" /> AI Chatbots</h1>
            <p className="text-sm text-muted-foreground">Train AI assistants and embed them on any website.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New chatbot</Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : bots.length === 0 ? (
          <Card className="p-10 text-center space-y-3">
            <Bot className="w-10 h-10 mx-auto text-muted-foreground" />
            <div className="font-semibold">No chatbots yet</div>
            <div className="text-sm text-muted-foreground">Create your first AI chatbot, train it on your content, and embed it on your website.</div>
            <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Create chatbot</Button>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {bots.map(b => (
              <Card key={b.id} className="p-4 hover:shadow cursor-pointer" onClick={() => nav(`/chatbots/${b.id}`)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: b.brand_color }}>
                    <MessagesSquare className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{b.enabled ? 'Active' : 'Disabled'} · {b.tone}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create chatbot</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Support Bot" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={creating || !name.trim()}>{creating ? 'Creating…' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Chatbots;

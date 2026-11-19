import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { Zap, Plus, Trash2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function CannedResponses() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shortcut, setShortcut] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const wsId = await resolveWorkspaceId(user.id, profile);
    if (!wsId) { setLoading(false); return; }

    const { data } = await supabase
      .from('quick_replies')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user, profile]);

  const handleCreate = async () => {
    if (!shortcut.trim()) return toast.error('Shortcut trigger is required (e.g. /welcome)');
    if (!text.trim()) return toast.error('Response text is required');
    const formattedShortcut = shortcut.startsWith('/') ? shortcut.trim() : `/${shortcut.trim()}`;

    setSaving(true);
    const wsId = await resolveWorkspaceId(user?.id || '', profile);
    const { error } = await supabase.from('quick_replies').insert({
      workspace_id: wsId,
      shortcut: formattedShortcut,
      text: text.trim(),
      created_by: user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);

    toast.success('Canned response added');
    setShortcut('');
    setText('');
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('quick_replies').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Removed canned response');
    loadData();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" /> Canned Responses (Quick Replies)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Save reusable text snippets. Type <b>/</b> in the Inbox composer to quickly send these messages to clients.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Canned Reply
          </Button>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading canned responses...</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-3">
              <Zap className="w-10 h-10 mx-auto opacity-40" />
              <p>No canned responses found. Add shortcuts like <b>/address</b> or <b>/bank</b> for instant 1-click replies.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Shortcut</TableHead>
                  <TableHead>Response Message</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <span className="font-mono text-xs bg-primary/10 text-primary px-2.5 py-1 rounded font-semibold">
                        {i.shortcut}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/90 whitespace-pre-wrap">{i.text}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Add Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Canned Response</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold mb-1 block">Shortcut Trigger (e.g. /address, /price)</label>
                <Input placeholder="/pricing" value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Full Message Text</label>
                <Textarea rows={4} placeholder="Hello! Here are our tariff rates and packages..." value={text} onChange={(e) => setText(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saving...' : 'Save Shortcut'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
      }
                

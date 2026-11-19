import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { Tags as TagsIcon, Plus, Trash2, Tag, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const COLOR_PRESETS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#64748B', '#06B6D4'
];

export default function Tags() {
  const { user, profile } = useAuth();
  const [labels, setLabels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#10B981');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const wsId = await resolveWorkspaceId(user.id, profile);
    if (!wsId) { setLoading(false); return; }

    const { data } = await supabase
      .from('wa_labels')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    setLabels(data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user, profile]);

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Tag name is required');
    setSaving(true);
    const wsId = await resolveWorkspaceId(user?.id || '', profile);
    const { error } = await supabase.from('wa_labels').insert({
      workspace_id: wsId,
      name: name.trim(),
      color,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Tag created');
    setName('');
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('wa_labels').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Tag deleted');
    loadData();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <TagsIcon className="w-6 h-6 text-primary" /> Tags & Labels
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage color-coded tags to organize your contacts, leads, and inbox conversations.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Tag
          </Button>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading tags...</div>
          ) : labels.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-3">
              <Tag className="w-10 h-10 mx-auto opacity-40" />
              <p>No tags created yet. Add tags like "Hot Lead", "VIP", "Follow Up" to categorize contacts.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag Name</TableHead>
                  <TableHead>Preview Badge</TableHead>
                  <TableHead>Color Hex</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labels.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-semibold text-sm">{t.name}</TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: t.color || '#10B981' }}
                      >
                        <Tag className="w-3 h-3" /> {t.name}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.color}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Add Tag Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold mb-1 block">Tag Name</label>
                <Input placeholder="e.g. Hot Lead, High Value, Follow-up" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-2 block">Choose Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-primary ring-offset-2' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saving...' : 'Create Tag'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

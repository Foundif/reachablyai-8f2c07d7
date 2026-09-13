import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Megaphone, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Update = {
  id?: string;
  title: string;
  body: string;
  category: string;
  image_url: string | null;
  icon: string | null;
  link_url: string | null;
  is_published: boolean;
  published_at?: string;
};

const CATEGORIES = ['update', 'feature', 'fix', 'announcement', 'offer'];

const blank = (): Update => ({
  title: '', body: '', category: 'update', image_url: '', icon: '', link_url: '', is_published: true,
});

const AdminUpdatesPanel = ({ apiCall }: { apiCall: (action: string, extra?: Record<string, any>) => Promise<any> }) => {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Update>(blank());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall('list_updates');
      setUpdates(res.updates || []);
    } catch (e: any) {
      toast.error(e.message || 'Could not load updates');
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!draft.title.trim() || !draft.body.trim()) return toast.error('Add a title and body');
    setSaving(true);
    try {
      await apiCall('save_update', { ...draft });
      toast.success(draft.id ? 'Update saved' : 'Update published');
      setDraft(blank());
      void load();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id?: string) => {
    if (!id || !confirm('Delete this update?')) return;
    try {
      await apiCall('delete_update', { id });
      void load();
    } catch (e: any) {
      toast.error(e.message || 'Delete failed');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm flex-1">{draft.id ? 'Edit update' : 'New update'}</h3>
          {draft.id && <Button variant="ghost" size="sm" onClick={() => setDraft(blank())}>Cancel</Button>}
        </div>
        <div className="p-4 space-y-3">
          <div><Label className="text-xs">Title</Label>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Multiple WhatsApp numbers" /></div>
          <div><Label className="text-xs">Body</Label>
            <Textarea rows={5} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="What changed and why it matters." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Category</Label>
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Emoji icon</Label>
              <Input value={draft.icon || ''} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="🚀" /></div>
          </div>
          <div><Label className="text-xs">Image URL</Label>
            <Input value={draft.image_url || ''} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="https://…" /></div>
          <div><Label className="text-xs">Learn more link</Label>
            <Input value={draft.link_url || ''} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} placeholder="https://…" /></div>
          <div className="flex items-center gap-2">
            <Select value={draft.is_published ? 'yes' : 'no'} onValueChange={(v) => setDraft({ ...draft, is_published: v === 'yes' })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Published</SelectItem>
                <SelectItem value="no">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {draft.id ? 'Save changes' : 'Publish update'}
            </Button>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm flex-1">Published updates</h3>
          <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : updates.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Nothing published yet.</p>
          ) : updates.map((u) => (
            <div key={u.id} className="px-4 py-3 border-b border-border/60 flex items-start gap-3">
              <span className="text-xl">{u.icon || '✨'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{u.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{u.body}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  {u.category} · {u.published_at ? new Date(u.published_at).toLocaleDateString() : ''}
                </p>
              </div>
              {!u.is_published && <Badge variant="outline" className="text-[10px]">Draft</Badge>}
              <Button variant="ghost" size="sm" onClick={() => setDraft({ ...u })}>Edit</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(u.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminUpdatesPanel;

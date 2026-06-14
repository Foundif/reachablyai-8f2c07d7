import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BookOpen, Plus, Trash2, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';

type Doc = { id: string; title: string; content: string; words: number; createdAt: string };
const STORAGE = 'foundif_kb';

const KnowledgeBase = () => {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => { setDocs(JSON.parse(localStorage.getItem(STORAGE) || '[]')); }, []);
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(docs)); }, [docs]);

  const save = () => {
    if (!title || !content) return toast.error('Title and content required');
    setDocs((d) => [{ id: crypto.randomUUID(), title, content, words: content.split(/\s+/).length, createdAt: new Date().toISOString() }, ...d]);
    toast.success('Document added to knowledge base'); setOpen(false); setTitle(''); setContent('');
  };
  const remove = (id: string) => { setDocs((d) => d.filter((x) => x.id !== id)); toast.success('Removed'); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text();
    setDocs((d) => [{ id: crypto.randomUUID(), title: f.name, content: text, words: text.split(/\s+/).length, createdAt: new Date().toISOString() }, ...d]);
    toast.success(`${f.name} uploaded`);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> Knowledge Base
            </h1>
            <p className="text-sm text-muted-foreground">Train your AI agents on your business docs & FAQs.</p>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <input type="file" accept=".txt,.md" hidden onChange={onFile} />
              <Button variant="outline" asChild><span><Upload className="w-4 h-4" /> Upload</span></Button>
            </label>
            <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> Add doc</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.length === 0 && <div className="md:col-span-2 lg:col-span-3 text-center text-sm text-muted-foreground py-12">No documents yet.</div>}
          {docs.map((d) => (
            <div key={d.id} className="glass-panel p-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{d.title}</p>
                  <p className="text-[11px] text-muted-foreground">{d.words.toLocaleString()} words</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3 line-clamp-3">{d.content}</p>
            </div>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New knowledge doc</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Refund policy)" />
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste your content here…" rows={12} />
            </div>
            <DialogFooter><Button onClick={save}>Add to KB</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};
export default KnowledgeBase;

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Bug, Camera, Lightbulb, Loader2, MessageSquarePlus, Monitor, Send, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveWorkspaceId } from '@/lib/workspace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type Ticket = {
  id: string;
  category: string;
  title: string;
  description: string;
  screenshot_urls: string[];
  status: 'submitted' | 'reviewing' | 'in_progress' | 'resolved' | 'closed';
  resolution_note: string | null;
  created_at: string;
};

const ACTIVE = new Set(['submitted', 'reviewing', 'in_progress']);
const labels: Record<Ticket['status'], string> = {
  submitted: 'Submitted', reviewing: 'Reviewing', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed',
};

export default function FeedbackWidget() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const activeTicket = tickets.find((ticket) => ACTIVE.has(ticket.status));

  const loadTickets = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from('feedback_tickets' as any)
      .select('*').eq('submitted_by', user.id).order('created_at', { ascending: false });
    setLoading(false);
    if (error) return toast.error('Could not load your feedback');
    setTickets((data as any as Ticket[]) || []);
  };

  useEffect(() => { if (open) void loadTickets(); }, [open, user]);

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).slice(0, 3);
    if (selected.some((file) => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      toast.error('Use PNG, JPG, or WebP screenshots under 5 MB each');
      event.target.value = '';
      return;
    }
    setFiles(selected);
  };

  const submit = async () => {
    if (!user || !title.trim() || description.trim().length < 10) {
      return toast.error('Add a title and at least 10 characters of detail');
    }
    setSubmitting(true);
    const workspaceId = await resolveWorkspaceId(user.id, profile);
    if (!workspaceId) { setSubmitting(false); return toast.error('Workspace not found'); }

    const uploaded: string[] = [];
    for (const file of files) {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from('feedback-attachments').upload(path, file, { contentType: file.type });
      if (error) { setSubmitting(false); return toast.error(`Screenshot upload failed: ${error.message}`); }
      uploaded.push(path);
    }

    const { error } = await supabase.from('feedback_tickets' as any).insert({
      workspace_id: workspaceId,
      submitted_by: user.id,
      category,
      title: title.trim(),
      description: description.trim(),
      screenshot_urls: uploaded,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === '23505') return toast.error('Your current ticket must be cleared before submitting another');
      return toast.error(error.message);
    }
    setTitle(''); setDescription(''); setFiles([]);
    toast.success('Feedback submitted');
    void loadTickets();
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 z-40 h-auto -translate-y-1/2 rounded-r-none rounded-l-md px-2 py-3 [writing-mode:vertical-rl] rotate-180 shadow-lg md:px-2.5"
        aria-label="Open feedback"
      >
        <MessageSquarePlus className="mb-1 h-4 w-4 rotate-90" /> Feedback
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Feedback & support</DialogTitle>
            <DialogDescription>Report a bug, request a feature, or share a small improvement.</DialogDescription>
          </DialogHeader>

          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : activeTicket ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div><p className="font-semibold">{activeTicket.title}</p><p className="text-xs text-muted-foreground">Submitted {new Date(activeTicket.created_at).toLocaleString()}</p></div>
                  <Badge variant="outline">{labels[activeTicket.status]}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{activeTicket.description}</p>
                {activeTicket.resolution_note && <p className="mt-3 border-t pt-3 text-sm"><strong>Update:</strong> {activeTicket.resolution_note}</p>}
              </div>
              <p className="text-sm text-muted-foreground">You can submit another ticket after this one is resolved or closed.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug"><span className="flex items-center gap-2"><Bug className="h-4 w-4" /> Bug</span></SelectItem>
                    <SelectItem value="feature"><span className="flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Feature request</span></SelectItem>
                    <SelectItem value="ui_issue"><span className="flex items-center gap-2"><Monitor className="h-4 w-4" /> UI problem</span></SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Title</Label><Input maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs attention?" /></div>
              <div className="space-y-2"><Label>Details</Label><Textarea rows={5} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tell us what happened and what you expected." /></div>
              <div className="space-y-2">
                <Label>Screenshots <span className="text-muted-foreground">(optional, up to 3)</span></Label>
                <input ref={fileRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={chooseFiles} />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="w-full gap-2"><Camera className="h-4 w-4" /> Add screenshots</Button>
                {files.length > 0 && <div className="space-y-1">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs"><span className="truncate">{file.name}</span><Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))}><X className="h-3.5 w-3.5" /></Button></div>)}</div>}
              </div>
              <Button onClick={submit} disabled={submitting} className="w-full gap-2">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit feedback</Button>
            </div>
          )}

          {tickets.filter((ticket) => !ACTIVE.has(ticket.status)).length > 0 && (
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-semibold">Previous tickets</p>
              <div className="space-y-2">{tickets.filter((ticket) => !ACTIVE.has(ticket.status)).slice(0, 5).map((ticket) => <div key={ticket.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{ticket.title}</p><p className="text-xs text-muted-foreground">{new Date(ticket.created_at).toLocaleDateString()}</p></div><Badge variant="secondary">{labels[ticket.status]}</Badge></div>)}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
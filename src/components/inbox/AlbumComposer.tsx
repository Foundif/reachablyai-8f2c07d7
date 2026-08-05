import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AlbumItem { file: File; url: string; isVideo: boolean }

/** WhatsApp-style multi-photo/video preview: big preview, thumbnail strip, one shared caption. */
export default function AlbumComposer({
  open, files, onOpenChange, onAdd, onRemove, onSend, sending, progress,
}: {
  open: boolean;
  files: File[];
  onOpenChange: (v: boolean) => void;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onSend: (caption: string) => void;
  sending: boolean;
  progress?: { done: number; total: number } | null;
}) {
  const [caption, setCaption] = useState('');
  const [active, setActive] = useState(0);

  const items = useMemo<AlbumItem[]>(
    () => files.map(f => ({ file: f, url: URL.createObjectURL(f), isVideo: f.type.startsWith('video') })),
    [files],
  );

  useEffect(() => () => { items.forEach(i => URL.revokeObjectURL(i.url)); }, [items]);
  useEffect(() => { if (active >= files.length) setActive(Math.max(0, files.length - 1)); }, [files.length, active]);
  useEffect(() => { if (!open) { setCaption(''); setActive(0); } }, [open]);

  const current = items[active];

  return (
    <Dialog open={open} onOpenChange={v => { if (!sending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 h-12 border-b">
          <span className="text-sm font-medium">
            {files.length} {files.length === 1 ? 'item' : 'items'} selected
          </span>
        </div>

        <div className="bg-black/90 h-[300px] grid place-items-center">
          {current && (current.isVideo
            ? <video src={current.url} controls className="max-h-full max-w-full" />
            : <img src={current.url} alt="" className="max-h-full max-w-full object-contain" />)}
        </div>

        <div className="flex items-center gap-2 p-3 overflow-x-auto border-b">
          {items.map((it, i) => (
            <div key={i} className={cn(
              'relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border-2 cursor-pointer',
              i === active ? 'border-primary' : 'border-transparent opacity-70',
            )} onClick={() => setActive(i)}>
              {it.isVideo
                ? <video src={it.url} className="h-full w-full object-cover" />
                : <img src={it.url} alt="" className="h-full w-full object-cover" />}
              <button
                type="button" disabled={sending}
                onClick={e => { e.stopPropagation(); onRemove(i); }}
                className="absolute top-0 right-0 bg-black/70 text-white rounded-bl p-0.5"
                aria-label="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <label className="h-14 w-14 shrink-0 rounded-lg border-2 border-dashed grid place-items-center cursor-pointer hover:bg-muted">
            <Plus className="w-4 h-4 text-muted-foreground" />
            <input
              type="file" multiple accept="image/*,video/*" className="hidden" disabled={sending}
              onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) onAdd(fs); e.currentTarget.value = ''; }}
            />
          </label>
        </div>

        <div className="p-3 flex items-center gap-2">
          <Input
            value={caption} onChange={e => setCaption(e.target.value)} disabled={sending}
            placeholder="Add a caption…" className="rounded-full"
            onKeyDown={e => { if (e.key === 'Enter' && !sending && files.length) onSend(caption); }}
          />
          <Button
            size="icon" className="rounded-full shrink-0"
            disabled={sending || !files.length} onClick={() => onSend(caption)}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        {sending && progress && (
          <div className="px-4 pb-3 text-[11px] text-muted-foreground">
            Sending {progress.done} of {progress.total}…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from 'react';
import { SecureImg, SecureVideo } from '@/lib/secureMedia';
import { Search, X, Send, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TemplateOption {
  id: string;
  name: string;
  status: string;
  language?: string | null;
  category?: string | null;
  body?: string | null;
  header?: string | null;
  header_type?: string | null;
  header_media_url?: string | null;
  footer?: string | null;
}

/** Resolves {{var}} placeholders to a live preview using the contact's name. */
export const renderTemplateText = (text: string | null | undefined, contactName: string) =>
  String(text || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, () => contactName || 'there');

export default function TemplatePickerSheet({
  open, onClose, templates, contactName, onSend, sending,
}: {
  open: boolean;
  onClose: () => void;
  templates: TemplateOption[];
  contactName: string;
  onSend: (id: string) => void;
  sending?: boolean;
}) {
  const [q, setQ] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);

  const list = useMemo(
    () => templates.filter(t => t.name.toLowerCase().includes(q.trim().toLowerCase())),
    [templates, q],
  );
  const picked = templates.find(t => t.id === pickedId) || null;

  if (!open) return null;

  const mediaIcon = (type?: string | null) =>
    type === 'image' ? ImageIcon : type === 'video' ? Video : FileText;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-top duration-300">
      <header className="flex items-center gap-3 px-4 h-14 border-b shrink-0">
        <h2 className="text-base font-semibold flex-1">Select template</h2>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close template picker">
          <X className="w-4 h-4" />
        </Button>
      </header>

      <div className="flex-1 min-h-0 grid md:grid-cols-2">
        <div className="flex flex-col min-h-0 border-r">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name" className="pl-9" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {list.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">No approved templates found</p>
            )}
            {list.map(t => {
              const Icon = mediaIcon(t.header_type);
              return (
                <button
                  key={t.id} type="button" onClick={() => setPickedId(t.id)}
                  className={cn(
                    'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                    pickedId === t.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {t.header_type && t.header_type !== 'none' && t.header_type !== 'text' && (
                      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">{t.name}</span>
                    <span className="ml-auto text-[10px] uppercase text-muted-foreground">{t.language || 'en'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {renderTemplateText(t.body, contactName)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden md:flex flex-col min-h-0 wa-doodle-bg">
          <div className="flex-1 overflow-y-auto p-6">
            {!picked ? (
              <p className="text-sm text-muted-foreground text-center mt-16">Select a template to preview it</p>
            ) : (
              <div className="max-w-sm ml-auto rounded-2xl rounded-br-md bg-primary text-primary-foreground px-3 py-2 shadow-sm text-sm space-y-1.5">
                {picked.header_media_url && picked.header_type === 'image' && (
                  <SecureImg src={picked.header_media_url} alt="" className="rounded-lg max-h-48 w-full object-cover" />
                )}
                {picked.header_media_url && picked.header_type === 'video' && (
                  <SecureVideo src={picked.header_media_url} controls className="rounded-lg max-h-48 w-full" />
                )}
                {picked.header_type === 'text' && picked.header && (
                  <div className="font-semibold">{renderTemplateText(picked.header, contactName)}</div>
                )}
                <div className="whitespace-pre-wrap break-words">{renderTemplateText(picked.body, contactName)}</div>
                {picked.footer && <div className="text-[11px] opacity-70">{picked.footer}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t p-3 flex justify-end gap-2 shrink-0">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={!picked || sending} onClick={() => picked && onSend(picked.id)}>
          <Send className="w-4 h-4 mr-2" /> Send template
        </Button>
      </footer>
    </div>
  );
}

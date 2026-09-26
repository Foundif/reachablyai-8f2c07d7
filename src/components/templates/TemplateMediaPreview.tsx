import { FileText, ExternalLink } from 'lucide-react';
import { SecureImg, SecureVideo, useSignedUrl } from '@/lib/secureMedia';

interface Props {
  url?: string | null;
  type: 'image' | 'video' | 'document';
  label?: string;
  className?: string;
}

export default function TemplateMediaPreview({ url, type, label = 'Template media', className = '' }: Props) {
  const signedUrl = useSignedUrl(type === 'document' ? url : null);
  if (type === 'document') {
    return <div className={`relative flex flex-col overflow-hidden bg-muted ${className}`}>
      {signedUrl ? <object data={`${signedUrl}#toolbar=0&navpanes=0`} type="application/pdf" aria-label={`${label} PDF preview`} className="h-full min-h-[150px] w-full flex-1 pointer-events-none">
        <div className="flex items-center gap-2 p-3 text-sm"><FileText className="h-5 w-5" />PDF document</div>
      </object> : <div className="grid flex-1 place-items-center"><FileText className="h-8 w-8 text-muted-foreground" /></div>}
      {signedUrl && <a href={signedUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 border-t bg-background p-2 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" /> Open PDF</a>}
    </div>;
  }
  if (type === 'video') return <SecureVideo src={url} muted controls className={`object-cover ${className}`} />;
  return <SecureImg src={url} alt={label} loading="lazy" className={`object-cover ${className}`} />;
}
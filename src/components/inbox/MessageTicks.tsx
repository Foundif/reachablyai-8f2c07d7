import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * WhatsApp-style delivery indicator.
 * pending → clock · sent → single tick · delivered → double grey · read → double blue
 */
export default function MessageTicks({ status, outbound }: { status?: string | null; outbound: boolean }) {
  if (!outbound) return null;
  const s = (status || '').toLowerCase();

  if (s === 'failed' || s === 'error') return <AlertCircle className="w-3.5 h-3.5 text-red-400" aria-label="Failed" />;
  if (s === 'read') return <CheckCheck className="w-3.5 h-3.5 text-sky-400" aria-label="Read" />;
  if (s === 'delivered') return <CheckCheck className={cn('w-3.5 h-3.5 opacity-80')} aria-label="Delivered" />;
  if (s === 'sent' || s === 'accepted') return <Check className="w-3.5 h-3.5 opacity-80" aria-label="Sent" />;
  return <Clock className="w-3 h-3 opacity-70" aria-label="Pending" />;
}

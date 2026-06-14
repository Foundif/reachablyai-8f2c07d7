import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

interface SendReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientEmail: string | null;
  invoiceNumber?: string;
  amount?: number;
  dueDate?: string;
}

const SendReminderModal = ({
  open,
  onOpenChange,
  clientName,
  clientEmail,
  invoiceNumber,
  amount,
  dueDate,
}: SendReminderModalProps) => {
  const [sending, setSending] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  const handleSend = async () => {
    if (!clientEmail) {
      toast.error('No email address for this client');
      return;
    }

    setSending(true);
    try {
      const response = await supabase.functions.invoke('send-invoice-email', {
        body: {
          type: 'payment_reminder',
          recipientEmail: clientEmail,
          recipientName: clientName,
          invoiceNumber: invoiceNumber || 'N/A',
          amount: amount || 0,
          dueDate: dueDate || new Date().toISOString(),
          customMessage,
        },
      });

      if (response.error) throw response.error;

      toast.success('Reminder sent successfully!');
      onOpenChange(false);
      setCustomMessage('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reminder');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Send Payment Reminder
          </DialogTitle>
          <DialogDescription>
            Send a payment reminder email to {clientName}
            {clientEmail && <span className="block text-xs mt-1">({clientEmail})</span>}
          </DialogDescription>
        </DialogHeader>

        {!clientEmail ? (
          <div className="py-4 text-center text-muted-foreground">
            <p>This client doesn't have an email address.</p>
            <p className="text-sm mt-2">Please add an email address to send reminders.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {invoiceNumber && (
                <div className="p-3 bg-accent/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Invoice: <span className="font-medium text-foreground">{invoiceNumber}</span></p>
                  {amount && <p className="text-sm text-muted-foreground">Amount: <span className="font-medium text-foreground">${amount.toLocaleString()}</span></p>}
                </div>
              )}
              
              <div>
                <Label htmlFor="message">Custom Message (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Add a personal note to the reminder..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="mt-1.5 min-h-[100px]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Reminder
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SendReminderModal;

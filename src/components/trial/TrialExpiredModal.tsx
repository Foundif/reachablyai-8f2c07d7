import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Lock, Eye } from 'lucide-react';

const ACTIVE_STATUSES = new Set(['active', 'starter', 'growth', 'pro', 'professional', 'enterprise']);
const EXEMPT_ROUTES = new Set(['/pricing', '/profile', '/privacy', '/terms', '/billing']);

const TrialExpiredModal = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (!profile) return null;
  // Staff / admin sub-users inherit their owner's paid access — never show this modal.
  if ((profile as any).is_staff) return null;
  if (ACTIVE_STATUSES.has(String((profile as any).subscription_status || ''))) return null;
  if (EXEMPT_ROUTES.has(pathname)) return null;
  if (dismissed) return null;

  return (
    <Dialog open={true} onOpenChange={(o) => !o && setDismissed(true)}>
      <DialogContent
        className="sm:max-w-md bg-card border-border"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Lock className="w-5 h-5 text-primary" />
            Your account is read-only
          </DialogTitle>
          <DialogDescription>
            Your backend is connected, but you don't have an active subscription. You can browse
            your data in read-only mode — to send WhatsApp Flows, accept bookings or sync to
            Google Sheets, please upgrade to a plan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
            <Crown className="w-9 h-9 text-primary mx-auto mb-2" />
            <p className="text-sm text-foreground font-medium">Choose a plan to continue</p>
            <p className="text-xs text-muted-foreground mt-1">
              Starter · Growth · Pro — pay once-time setup + monthly retainer.
            </p>
          </div>
          <Button variant="default" className="w-full" onClick={() => navigate('/pricing')}>
            <Crown className="w-4 h-4 mr-1" />
            View plans &amp; upgrade
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setDismissed(true)}>
            <Eye className="w-4 h-4 mr-1" />
            Continue browsing in read-only mode
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrialExpiredModal;

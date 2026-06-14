import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Clock } from 'lucide-react';

const TrialExpiredModal = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  if (!profile) return null;

  const isExpired =
    profile.subscription_status === 'expired' ||
    (profile.subscription_status === 'trial' &&
      profile.trial_end_date &&
      new Date(profile.trial_end_date) <= new Date());

  if (!isExpired || profile.subscription_status === 'active') return null;

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md bg-card border-border" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Clock className="w-5 h-5 text-risk-high" />
            Free Trial Expired
          </DialogTitle>
          <DialogDescription>
            Your free trial has ended. Upgrade to a paid plan to continue using Glamsup with all features.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
            <Crown className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="text-sm text-foreground font-medium">Unlock unlimited access</p>
            <p className="text-xs text-muted-foreground mt-1">Services, billing, analytics & more</p>
          </div>
          <Button variant="trust" className="w-full" onClick={() => navigate('/pricing')}>
            <Crown className="w-4 h-4" />Upgrade Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrialExpiredModal;

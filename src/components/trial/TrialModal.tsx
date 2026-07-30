import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTrial } from '@/hooks/useTrial';
import { Sparkles, Zap, Users, MessageSquare, Crown } from 'lucide-react';

const dismissKey = (uid: string, stamp: string) => `reachably.trialModal.${uid}.${stamp}`;

const FEATURES = [
  { icon: MessageSquare, title: 'Unlimited WhatsApp campaigns', desc: 'Broadcast with approved Meta templates and safe pacing.' },
  { icon: Zap, title: 'Automations & AI chatbots', desc: 'Auto-replies, flows and trained bots working around the clock.' },
  { icon: Users, title: 'Team inbox & contacts', desc: 'Assign chats, add notes and scrape new contacts.' },
];

/**
 * Welcome / countdown modal for the 7-day free trial.
 * Shown once per trial window per user (dismissal stored locally).
 */
const TrialModal = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isTrialing, isExpired, daysLeft, hoursLeft, endsAt } = useTrial();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    if (!isTrialing && !isExpired) return;
    const stamp = isExpired ? 'expired' : (endsAt?.toISOString().slice(0, 10) || 'active');
    if (localStorage.getItem(dismissKey(user.id, stamp))) return;
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [user, profile, isTrialing, isExpired, endsAt]);

  const close = () => {
    if (user) {
      const stamp = isExpired ? 'expired' : (endsAt?.toISOString().slice(0, 10) || 'active');
      localStorage.setItem(dismissKey(user.id, stamp), '1');
    }
    setOpen(false);
  };

  if (!isTrialing && !isExpired) return null;

  const endLabel = endsAt?.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const countdown = daysLeft > 1 ? `${daysLeft} days left` : `${hoursLeft} hours left`;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="p-0 overflow-hidden w-[calc(100vw-2rem)] sm:w-full max-w-lg gap-0 rounded-2xl">
        {/* Gradient hero */}
        <div className="relative h-40 sm:h-52 bg-gradient-to-br from-primary via-secondary to-primary/40 flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--background)/0.35),transparent_60%)]" />
          <div className="relative text-center px-6">
            <Sparkles className="w-9 h-9 mx-auto text-primary-foreground" />
            <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-primary-foreground">7 days free</p>
            <p className="text-xs sm:text-sm text-primary-foreground/85 mt-1">
              {isExpired ? 'Your free trial has ended' : countdown}
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 max-h-[55vh] overflow-y-auto">
          <h2 className="text-lg sm:text-xl font-bold">
            {isExpired ? 'Keep your growth running' : 'Everything is unlocked for you'}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isExpired
              ? 'Choose a plan to continue sending campaigns, automations and WhatsApp messages.'
              : `Your free trial gives you full access to every Reachably feature${endLabel ? ` until ${endLabel}` : ''}. No card required.`}
          </p>

          <div className="mt-5 space-y-3.5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t bg-muted/30 flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" className="sm:flex-1" onClick={close}>
            {isExpired ? 'Later' : 'Start exploring'}
          </Button>
          <Button className="sm:flex-1 gap-1.5" onClick={() => { close(); navigate('/pricing'); }}>
            <Crown className="w-4 h-4" /> View plans
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrialModal;

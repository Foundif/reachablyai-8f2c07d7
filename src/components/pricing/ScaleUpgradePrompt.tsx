import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STORAGE_KEY =
  'reachably_scale_whatsapp_prompt_v1';

const REMIND_DAYS = 7;

type PromptState = {
  dismissed?: boolean;
  remindUntil?: number;
  openedAt?: string;
};

type ScaleUpgradePromptProps = {
  currentPlanId: string | null;
  trigger?: number;
  onUpgrade: () => void;
};

const readState = (): PromptState => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const writeState = (state: PromptState) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    // Ignore localStorage errors.
  }
};

export default function ScaleUpgradePrompt({
  currentPlanId,
  trigger = 0,
  onUpgrade,
}: ScaleUpgradePromptProps) {
  const [open, setOpen] = useState(false);

  /*
   * Automatically show the popup for Plus users.
   *
   * Behaviour:
   * - First time: show popup
   * - Remind later: wait 7 days
   * - Close popup: don't automatically show again
   * - Upgrade: don't show again
   * - Scale/Supreme: never show
   */
  useEffect(() => {
    if (currentPlanId !== 'plus') {
      setOpen(false);
      return;
    }

    const state = readState();

    if (state.dismissed) {
      return;
    }

    if (
      state.remindUntil &&
      state.remindUntil > Date.now()
    ) {
      return;
    }

    writeState({
      ...state,
      openedAt: new Date().toISOString(),
    });

    setOpen(true);
  }, [currentPlanId]);

  /*
   * Opens the same popup when the user clicks:
   * "Need more numbers? Learn more"
   */
  useEffect(() => {
    if (
      !trigger ||
      currentPlanId !== 'plus'
    ) {
      return;
    }

    setOpen(true);

    const state = readState();

    writeState({
      ...state,
      openedAt: new Date().toISOString(),
    });
  }, [trigger, currentPlanId]);

  const closeForever = () => {
    const state = readState();

    writeState({
      ...state,
      dismissed: true,
    });

    setOpen(false);
  };

  const remindLater = () => {
    const state = readState();

    writeState({
      ...state,
      remindUntil:
        Date.now() +
        REMIND_DAYS * 24 * 60 * 60 * 1000,
    });

    setOpen(false);
  };

  const upgrade = () => {
    const state = readState();

    writeState({
      ...state,
      dismissed: true,
    });

    setOpen(false);

    onUpgrade();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) {
          setOpen(true);
        } else {
          closeForever();
        }
      }}
    >
      <DialogContent className="w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl border-border/80 p-0 shadow-2xl sm:max-w-lg">
        <div className="p-6 sm:p-7">
          <DialogHeader className="text-left">
            <div className="mb-4 flex items-center gap-2">
              <Badge
                variant="secondary"
                className="rounded-full px-3 py-1"
              >
                Scale plan
              </Badge>

              <span className="text-xs text-muted-foreground">
                More WhatsApp capacity
              </span>
            </div>

            <DialogTitle className="text-2xl leading-tight">
              Need more than 1 WhatsApp number?
            </DialogTitle>

            <DialogDescription className="pt-2 text-sm leading-6">
              You’re currently on Plus. Scale lets your
              team connect up to{' '}
              <strong>
                3 WhatsApp Business numbers
              </strong>{' '}
              in the same Reachably workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 rounded-2xl border bg-muted/30 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                '3 WhatsApp numbers',
                '10 users',
                '40,000 messages/month',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />

                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={remindLater}
            >
              Remind me later
            </Button>

            <Button
              onClick={upgrade}
              className="gap-2"
            >
              Upgrade to Scale

              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            You can continue using Plus with 1 WhatsApp
            number.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
      }

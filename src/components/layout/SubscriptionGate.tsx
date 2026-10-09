import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspacePlan } from '@/hooks/useWorkspacePlan';
import { useAuth } from '@/hooks/useAuth';

// Pages reachable without an active subscription.
const OPEN = ['/pricing', '/profile', '/auth', '/admin'];

/** Blocks the app for workspaces with no active paid plan; only Pricing stays open. */
const SubscriptionGate = ({ children }: { children: ReactNode }) => {
  const { loading, isActive, workspaceId } = useWorkspacePlan();
  const { signOut } = useAuth() as any;
  const loc = useLocation();
  const nav = useNavigate();

  if (OPEN.some((p) => loc.pathname.startsWith(p))) return <>{children}</>;
  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (isActive || !workspaceId) return <>{children}</>;

  return (
    <div className="flex items-center justify-center px-4 py-20">
      <div className="max-w-md w-full rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Your subscription has expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Messages, campaigns and automations are paused. Renew a plan to unlock your inbox, contacts and bookings — your data is safe.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={() => nav('/pricing')}>See plans & renew</Button>
          {signOut && <Button variant="outline" onClick={() => signOut()}>Sign out</Button>}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionGate;

import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';
import MobileHeader from './MobileHeader';
import TopBar from './TopBar';
import AppFooter from './AppFooter';
import PaymentAlertBanner from './PaymentAlertBanner';
import TrialBanner from './TrialBanner';
import LowBalanceBanner from './LowBalanceBanner';
import { useGlobalAlerts } from '@/hooks/useGlobalAlerts';

interface AppLayoutProps {
  children: ReactNode;
  /** Edge-to-edge page (no top bar, no footer, no max-width) — used by the Inbox */
  fullBleed?: boolean;
}

const AppLayout = ({ children, fullBleed = false }: AppLayoutProps) => {
  useGlobalAlerts();
  return (
    <div className="relative flex min-h-screen w-full">
      <AppSidebar />

      <main className="relative flex-1 min-w-0 min-h-screen pb-28 md:pb-0 overflow-x-clip flex flex-col">
        <TrialBanner />
        <MobileHeader />
        {!fullBleed && <TopBar />}
        <PaymentAlertBanner />
        <div className={fullBleed ? 'relative flex-1 w-full min-h-0' : 'relative max-w-[1600px] mx-auto flex-1 w-full'}>
          {children}
        </div>
        {!fullBleed && <AppFooter />}
      </main>

      <MobileNav />
    </div>
  );
};

export default AppLayout;

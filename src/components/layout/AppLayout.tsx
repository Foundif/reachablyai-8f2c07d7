import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";
import AppFooter from "./AppFooter";
import TrialBanner from "./TrialBanner";
import { useGlobalAlerts } from "@/hooks/useGlobalAlerts";
import FeedbackWidget from "@/components/feedback/FeedbackWidget";
import SubscriptionGate from "./SubscriptionGate";

interface AppLayoutProps {
  children: ReactNode;
  /** Edge-to-edge page (no footer, no max-width) — used by the Inbox */
  fullBleed?: boolean;
}

const AppLayout = ({ children, fullBleed = false }: AppLayoutProps) => {
  useGlobalAlerts();
  return (
    <div className="relative min-h-screen w-full flex flex-col bg-background">
      {/* Full-width curved dark-green announcement / trial bar */}
      <TrialBanner />

      <div className="relative flex flex-1 w-full min-h-0">
        <AppSidebar />

        <main className="relative flex-1 min-w-0 min-h-screen pb-28 md:pb-0 overflow-x-clip flex flex-col">
          <MobileHeader />
          <div
            className={fullBleed ? "relative flex-1 w-full min-h-0" : "relative max-w-[1600px] mx-auto flex-1 w-full"}
          >
            <SubscriptionGate>{children}</SubscriptionGate>
          </div>
          {!fullBleed && <AppFooter />}
        </main>
      </div>

      <MobileNav />
      <FeedbackWidget />
    </div>
  );
};

export default AppLayout;

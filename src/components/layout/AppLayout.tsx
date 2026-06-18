import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';
import MobileHeader from './MobileHeader';
import TopBar from './TopBar';
import AppFooter from './AppFooter';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="relative flex min-h-screen w-full overflow-x-clip">
      <AppSidebar />

      <main className="relative flex-1 min-w-0 min-h-screen pb-28 md:pb-0 overflow-x-clip flex flex-col">
        <MobileHeader />
        <TopBar />
        <div className="relative max-w-[1600px] mx-auto flex-1 w-full">
          {children}
        </div>
        <AppFooter />
      </main>

      <MobileNav />
    </div>
  );
};

export default AppLayout;

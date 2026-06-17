import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Inbox, Users, UserCircle, Sparkles } from 'lucide-react';
import { useInboxUnreadCount } from '@/hooks/useInboxUnreadCount';

const items = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/copilot', icon: Sparkles, label: 'AI', accent: true },
  { to: '/customers', icon: Users, label: 'CRM' },
  { to: '/profile', icon: UserCircle, label: 'Profile' },
];

const MobileNav = () => {
  const { pathname } = useLocation();
  const inboxUnread = useInboxUnreadCount();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-pb px-3 pb-3 pointer-events-none">
      <div className="glass-floating glass-sheen px-2 py-2 flex items-center justify-around pointer-events-auto">
        {items.map(({ to, icon: Icon, label, accent }) => {
          const isActive = pathname === to;
          const badge = to === '/inbox' ? inboxUnread : 0;
          return (
            <NavLink
              key={to}
              to={to}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[52px] group"
            >
              {accent ? (
                <div className={cn(
                  'relative w-10 h-10 -mt-3 rounded-full flex items-center justify-center transition-all duration-300 bg-foreground text-background shadow-[0_8px_24px_-4px_hsl(var(--foreground)/0.4)]',
                  isActive && 'scale-110',
                )}>
                  <Icon className="w-5 h-5" />
                </div>
              ) : (
                <div className={cn(
                  'relative w-7 h-7 flex items-center justify-center transition-all',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}>
                  <Icon className="w-[20px] h-[20px]" />
                  {badge > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(211_100%_52%)]" />
                  )}
                </div>
              )}
              <span className={cn(
                'text-[10px] font-medium tracking-tight',
                isActive ? 'text-foreground' : 'text-muted-foreground',
                accent && 'mt-0.5',
              )}>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;

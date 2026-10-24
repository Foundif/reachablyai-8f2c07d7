import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LifeBuoy } from 'lucide-react';
import { MODULE_GROUPS } from '@/lib/modules';
import { useAuth } from '@/hooks/useAuth';
import { BrandMark } from '@/components/Brand';
import { useInboxUnreadCount } from '@/hooks/useInboxUnreadCount';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Legacy export for any older imports
export const MENU_GROUPS = MODULE_GROUPS;

const PIN_KEY = 'reachably.sidebar.pinned';

/** Custom pin glyph: a docked panel with a magnetic dot — filled when pinned, hollow when floating. */
const DockIcon = ({ pinned }: { pinned: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <rect x="3" y="4" width="18" height="16" rx="4" />
    <path d="M9 4v16" />
    <circle cx="15" cy="12" r="2.4" className="transition-all duration-300" fill={pinned ? 'currentColor' : 'none'} />
    {!pinned && <path d="M12.6 9.6 17.4 14.4" />}
  </svg>
);

const AppSidebar = () => {
  const [pinned, setPinned] = useState(() => localStorage.getItem(PIN_KEY) !== '0');
  const [hover, setHover] = useState(false);
  const { pathname } = useLocation();
  const { profile, canAccess } = useAuth();
  const inboxUnread = useInboxUnreadCount();
  const storeName = profile?.store_name?.trim() || 'My Workspace';
  const userName = profile?.full_name?.trim() || 'You';

  useEffect(() => { localStorage.setItem(PIN_KEY, pinned ? '1' : '0'); }, [pinned]);

  const open = pinned || hover;

  return (
    <aside
      className={cn('hidden md:block sticky top-0 h-screen z-40 shrink-0 transition-[width] duration-300 ease-out', pinned ? 'w-[248px]' : 'w-[72px]')}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn(
          'absolute inset-y-0 left-0 flex flex-col border-r bg-card transition-[width,box-shadow] duration-300 ease-out overflow-hidden',
          open ? 'w-[248px]' : 'w-[72px]',
          !pinned && hover && 'shadow-2xl',
        )}
      >
        <div className="flex items-center gap-2 px-4 h-16 shrink-0">
          <BrandMark size={32} className="shrink-0" />
          <span className={cn('font-semibold text-[17px] truncate transition-opacity', open ? 'opacity-100' : 'opacity-0')}>Reachably</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setPinned(p => !p)}
                aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
                className={cn('ml-auto rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all', open ? 'opacity-100' : 'opacity-0 pointer-events-none')}
              >
                <DockIcon pinned={pinned} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{pinned ? 'Unpin sidebar' : 'Pin sidebar'}</TooltipContent>
          </Tooltip>
        </div>

        <nav className="flex-1 px-3 py-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {MODULE_GROUPS.map((group, gi) => {
            const items = group.items.filter((i) => canAccess(i.to));
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                {gi > 0 && <div className="h-px mx-2 my-3 bg-border" />}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
                    const badge = item.to === '/inbox' ? inboxUnread : 0;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        title={!open ? item.label : undefined}
                        className={cn(
                          'group relative flex items-center gap-3 h-10 rounded-lg px-3 text-sm transition-colors',
                          isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {isActive && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />}
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        <span className={cn('truncate transition-opacity', open ? 'opacity-100' : 'opacity-0')}>{item.label}</span>
                        {badge > 0 && (
                          <span className={cn(
                            'ml-auto min-w-[22px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center',
                            !open && 'absolute right-1 top-0.5 min-w-[16px] h-4 px-1',
                          )}>
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                        {open && item.status === 'soon' && <span className="ml-auto text-[10px] text-primary">Soon</span>}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="px-3 pb-3 space-y-1 border-t pt-3">
          <NavLink to="/guide" className="flex items-center gap-3 h-10 rounded-lg px-3 text-sm text-foreground/80 hover:bg-muted">
            <LifeBuoy className="w-[18px] h-[18px] shrink-0" />
            <span className={cn('transition-opacity', open ? 'opacity-100' : 'opacity-0')}>Help</span>
          </NavLink>
          <NavLink to="/profile" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
            <span className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <span className={cn('min-w-0 transition-opacity', open ? 'opacity-100' : 'opacity-0')}>
              <span className="block text-sm font-medium truncate">{userName}</span>
              <span className="block text-xs text-muted-foreground truncate">{storeName}</span>
            </span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;

import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronsLeft, ChevronsRight, Crown } from 'lucide-react';
import { MODULE_GROUPS } from '@/lib/modules';
import { useAuth } from '@/hooks/useAuth';
import { BrandMark } from '@/components/Brand';
import { useInboxUnreadCount } from '@/hooks/useInboxUnreadCount';

// Legacy export for any older imports
export const MENU_GROUPS = MODULE_GROUPS;

const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const inboxUnread = useInboxUnreadCount();
  const storeName = profile?.store_name?.trim() || 'My Workspace';
  const tagline = (profile as any)?.tagline || 'WhatsApp Cloud';

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col sticky top-0 h-screen z-40 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
        collapsed ? 'w-[76px]' : 'w-[260px]',
      )}
    >
      <div className="relative m-3 h-[calc(100vh-1.5rem)] flex flex-col glass-elevated glass-sheen overflow-hidden">
        {/* Ambient aurora */}
        <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-foreground/10 blur-3xl animate-aurora" />
        <div className="pointer-events-none absolute -bottom-24 -right-10 h-56 w-56 rounded-full bg-foreground/5 blur-3xl animate-aurora" style={{ animationDelay: '4s' }} />

        {/* Brand — wordmark when expanded, icon when collapsed */}
        <div className="relative flex items-center px-4 pt-5 pb-4">
          {collapsed ? (
            <BrandMark size={36} className="mx-auto shrink-0" />
          ) : (
            <BrandMark variant="wordmark" fullWidth className="max-h-12" />
          )}
        </div>

        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Nav */}
        <nav className="relative flex-1 px-2 py-3 overflow-y-auto custom-scrollbar">
          {MODULE_GROUPS.map((group) => (
            <div key={group.label} className="mb-3">
              {!collapsed && (
                <div className="px-3 pt-2 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">{group.label}</span>
                </div>
              )}
              {collapsed && <div className="h-px mx-2 my-2 bg-border/50" />}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.to;
                  const badge = item.to === '/inbox' ? inboxUnread : 0;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-xl transition-all duration-300',
                        collapsed ? 'justify-center p-2 mx-1' : 'px-2.5 py-2',
                        !isActive && 'hover:bg-white/[0.04]',
                      )}
                    >
                      {isActive && !collapsed && (
                        <>
                          <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 via-secondary/15 to-transparent ring-1 ring-primary/30" />
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-gradient-to-b from-primary to-secondary shadow-[0_0_12px_hsl(211_100%_52%)]" />
                        </>
                      )}
                      <div className={cn(
                        'relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 shrink-0',
                        isActive
                          ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.6)]'
                          : 'text-muted-foreground group-hover:text-foreground',
                      )}>
                        <Icon className="w-[18px] h-[18px]" />
                      </div>
                      {!collapsed && (
                        <span className={cn(
                          'relative font-medium text-[13px] truncate',
                          isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                        )}>
                          {item.label}
                        </span>
                      )}
                      {!collapsed && item.status === 'soon' && (
                        <span className="relative ml-auto text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/20">
                          Soon
                        </span>
                      )}
                      {badge > 0 && (
                        <span className={cn(
                          'relative ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center',
                          collapsed && 'absolute right-0.5 top-0.5 ml-0',
                        )}>
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Trial / Upgrade CTA */}
        {!collapsed && (() => {
          const status = (profile as any)?.subscription_status || 'trial';
          if (status === 'pro' || status === 'growth' || status === 'active') return null;
          const start = (profile as any)?.trial_start_date ? new Date((profile as any).trial_start_date) : (profile?.created_at ? new Date(profile.created_at) : new Date());
          const end = (profile as any)?.trial_end_date ? new Date((profile as any).trial_end_date) : new Date(start.getTime() + 14 * 86400000);
          const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
          const left = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
          const used = Math.min(total, total - left);
          const pct = Math.min(100, Math.round((used / total) * 100));
          const expired = left <= 0;
          return (
            <div className="relative mx-3 mb-2 mt-1 rounded-2xl p-3 bg-gradient-to-br from-primary/15 via-secondary/10 to-transparent border border-primary/20">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-primary" />
                <p className="text-[12px] font-semibold">{expired ? 'Trial ended' : 'Free trial'}</p>
                <span className="ml-auto text-[10px] text-muted-foreground">{expired ? '0 days left' : `${left}/${total} days`}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-secondary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <button
                onClick={() => navigate('/pricing')}
                className="mt-2.5 w-full text-[11px] font-semibold py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition"
              >
                {expired ? 'Upgrade to continue' : 'Upgrade plan'}
              </button>
            </div>
          );
        })()}

        {/* Collapse */}
        <div className="relative p-2 border-t border-white/5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all"
          >
            {collapsed ? <ChevronsRight className="w-4 h-4" /> : (
              <><ChevronsLeft className="w-4 h-4" /><span className="text-xs font-medium">Collapse</span></>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;

import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LifeBuoy } from "lucide-react";
import { MODULE_GROUPS } from "@/lib/modules";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/Brand";
import { useInboxUnreadCount } from "@/hooks/useInboxUnreadCount";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const MENU_GROUPS = MODULE_GROUPS;

const PIN_KEY = "reachably.sidebar.pinned";

const DockIcon = ({ pinned }: { pinned: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-[18px] w-[18px]"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
  >
    <rect x="3" y="4" width="18" height="16" rx="4" />
    <path d="M9 4v16" />
    <circle cx="15" cy="12" r="2.4" className="transition-all duration-300" fill={pinned ? "currentColor" : "none"} />
    {!pinned && <path d="M12.6 9.6 17.4 14.4" />}
  </svg>
);

const getInitialPinnedState = () => {
  try {
    return localStorage.getItem(PIN_KEY) !== "0";
  } catch {
    return true;
  }
};

const AppSidebar = () => {
  const [pinned, setPinned] = useState(getInitialPinnedState);
  const [hover, setHover] = useState(false);

  const { pathname } = useLocation();
  const { profile, canAccess } = useAuth();
  const inboxUnread = useInboxUnreadCount();

  const storeName = profile?.store_name?.trim() || "My Workspace";
  const userName = profile?.full_name?.trim() || "You";
  const open = pinned || hover;

  useEffect(() => {
    try {
      localStorage.setItem(PIN_KEY, pinned ? "1" : "0");
    } catch {
      // Sidebar pinning still works for this session if storage is unavailable.
    }
  }, [pinned]);

  return (
    <aside
      className={cn(
        "relative hidden h-screen shrink-0 md:block",
        "transition-[width] duration-300 ease-out",
        pinned ? "w-[248px]" : "w-[72px]",
      )}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40",
          "flex min-h-0 flex-col overflow-hidden",
          "border-r border-border bg-card",
          "transition-[width,box-shadow] duration-300 ease-out",
          open ? "w-[248px]" : "w-[72px]",
          !pinned && hover && "shadow-2xl",
        )}
      >
        {/* Brand and pin control */}
        <div className="flex h-16 shrink-0 items-center gap-2 px-4">
          <BrandMark size={32} className="shrink-0" />

          <span
            className={cn(
              "truncate text-[17px] font-semibold transition-opacity",
              open ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            Reachably
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setPinned((previous) => !previous)}
                aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
                aria-pressed={pinned}
                tabIndex={open ? 0 : -1}
                className={cn(
                  "ml-auto rounded-lg p-1.5 text-muted-foreground",
                  "transition-colors hover:bg-primary/10 hover:text-primary",
                  open ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <DockIcon pinned={pinned} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{pinned ? "Unpin sidebar" : "Pin sidebar"}</TooltipContent>
          </Tooltip>
        </div>

        {/* Independently scrollable navigation */}
        <nav
          aria-label="Main navigation"
          className={cn("min-h-0 flex-1 overflow-x-hidden overflow-y-auto", "overscroll-contain px-3 py-2")}
        >
          {MODULE_GROUPS.map((group, groupIndex) => {
            const items = group.items.filter((item) => canAccess(item.to));

            if (items.length === 0) return null;

            return (
              <div key={group.label}>
                {groupIndex > 0 && <div className="mx-2 my-3 h-px bg-border" />}

                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

                    const badge = item.to === "/inbox" ? inboxUnread : 0;

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        title={!open ? item.label : undefined}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group relative flex h-10 items-center gap-3",
                          "rounded-lg px-3 text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground/80 hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {isActive && (
                          <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
                        )}

                        <Icon className="h-[18px] w-[18px] shrink-0" />

                        <span
                          className={cn(
                            "truncate transition-opacity",
                            open ? "opacity-100" : "pointer-events-none opacity-0",
                          )}
                        >
                          {item.label}
                        </span>

                        {badge > 0 && (
                          <span
                            className={cn(
                              "ml-auto flex h-5 min-w-[22px] items-center justify-center",
                              "rounded-full bg-primary px-1.5",
                              "text-[10px] font-bold text-primary-foreground",
                              !open && "absolute right-1 top-0.5 h-4 min-w-[16px] px-1",
                            )}
                          >
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}

                        {open && item.status === "soon" && (
                          <span className="ml-auto text-[10px] text-primary">Soon</span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Fixed bottom section */}
        <div className="shrink-0 space-y-1 border-t border-border px-3 pb-3 pt-3">
          <NavLink
            to="/guide"
            title={!open ? "Help" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm",
              "text-foreground/80 hover:bg-muted hover:text-foreground",
            )}
          >
            <LifeBuoy className="h-[18px] w-[18px] shrink-0" />
            <span className={cn("transition-opacity", open ? "opacity-100" : "opacity-0")}>Help</span>
          </NavLink>

          <NavLink
            to="/profile"
            title={!open ? `${userName} — ${storeName}` : undefined}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {userName.slice(0, 1).toUpperCase()}
            </span>

            <span className={cn("min-w-0 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")}>
              <span className="block truncate text-sm font-medium">{userName}</span>
              <span className="block truncate text-xs text-muted-foreground">{storeName}</span>
            </span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;

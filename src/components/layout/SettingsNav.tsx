import { NavLink, useLocation } from "react-router-dom";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SETTINGS_SECTIONS } from "@/lib/modules";
import { useAuth } from "@/hooks/useAuth";

const isActive = (pathname: string, to: string) => {
  if (to === "/settings/channels") return pathname.startsWith("/settings/channels") || pathname === "/whatsapp-settings" || pathname === "/instagram";
  if (to === "/templates") return pathname.startsWith("/templates");
  return pathname === to || pathname.startsWith(to + "/");
};

/** Turbodev-style second-level Settings navigation (desktop panel + mobile chips). */
const SettingsNav = () => {
  const { pathname } = useLocation();
  const { canAccess } = useAuth();
  const sections = SETTINGS_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => canAccess(i.access || i.to)) })).filter(
    (s) => s.items.length > 0,
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r bg-card/50 sticky top-0 h-screen overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-2 px-4 h-14 border-b">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold">Settings</span>
        </div>
        <nav className="p-3 space-y-4">
          {sections.map((s) => (
            <div key={s.label}>
              <p className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <div className="space-y-0.5">
                {s.items.map((i) => {
                  const Icon = i.icon;
                  const active = isActive(pathname, i.to);
                  return (
                    <NavLink
                      key={i.to}
                      to={i.to}
                      className={cn(
                        "flex items-center gap-2.5 h-8 px-2 rounded-md text-sm transition-colors",
                        active ? "bg-primary/10 text-primary font-medium" : "text-foreground/75 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{i.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar px-4 py-2 border-b bg-card/50">
        {sections.flatMap((s) => s.items).map((i) => {
          const Icon = i.icon;
          const active = isActive(pathname, i.to);
          return (
            <NavLink
              key={i.to}
              to={i.to}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs whitespace-nowrap transition-colors",
                active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground/80 hover:bg-muted",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {i.label}
            </NavLink>
          );
        })}
      </div>
    </>
  );
};

export default SettingsNav;

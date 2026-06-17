import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Menu, X, Search, Sparkles } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import { MODULE_GROUPS } from '@/lib/modules';
import { BrandMark } from '@/components/Brand';
import CommandPalette from './CommandPalette';

const MobileHeader = () => {
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <>
      <header className="md:hidden sticky top-0 z-50 safe-area-pt">
        <div className="mx-3 mt-3 mb-2 flex items-center gap-2 glass-elevated glass-sheen px-3 py-2.5 rounded-2xl">
          <BrandMark variant="wordmark" size={28} className="max-w-[140px]" />
          <button onClick={() => setPaletteOpen(true)} className="ml-auto p-2 rounded-xl hover:bg-white/[0.06] text-muted-foreground">
            <Search className="w-5 h-5" />
          </button>
          <NotificationBell />
          <button onClick={() => setOpen(!open)} className="p-2 rounded-xl hover:bg-white/[0.06] text-foreground">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" onClick={() => setOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-[82vw] max-w-[340px] glass-floating m-3 overflow-y-auto custom-scrollbar animate-slide-in-left">
            <div className="p-4 flex items-center gap-3 border-b border-white/5">
              <BrandMark variant="wordmark" size={32} className="max-w-[180px]" />
              <button onClick={() => setOpen(false)} className="ml-auto p-2 rounded-xl hover:bg-white/[0.06]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="p-2 pb-32">
              {MODULE_GROUPS.map((group) => (
                <div key={group.label} className="mb-2">
                  <div className="px-3 pt-3 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">{group.label}</span>
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map(({ to, icon: Icon, label, status }) => {
                      const isActive = location.pathname === to;
                      return (
                        <NavLink
                          key={to}
                          to={to}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                            isActive ? 'bg-gradient-to-r from-primary/20 to-secondary/15 text-foreground ring-1 ring-primary/30' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
                          )}
                        >
                          <Icon className="w-[18px] h-[18px]" />
                          <span className="text-sm font-medium flex-1">{label}</span>
                          {status === 'soon' && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/20">Soon</span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

          </div>
        </div>
      )}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
};

export default MobileHeader;

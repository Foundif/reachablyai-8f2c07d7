import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, Command } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import CommandPalette from './CommandPalette';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';


const TopBar = () => {
  const [open, setOpen] = useState(false);
  const [wsName, setWsName] = useState<string | null>(null);
  const [wsLogo, setWsLogo] = useState<string | null>(null);
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Resolve the active workspace name — for staff this is the owner's workspace name,
  // never a stale "My Salon" default from an old profile row.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const activeId = (profile as any)?.active_workspace_id;
      const { data: ws } = activeId
        ? await supabase.from('workspaces' as any).select('id,name').eq('id', activeId).maybeSingle()
        : await supabase.from('workspaces' as any).select('id,name').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
      const name = (ws as any)?.name;
      if (name && name.toLowerCase() !== 'my salon') setWsName(name);
      // Only show owner's uploaded logo on owners' screens, not staff, per user request.
      if (!(profile as any)?.is_staff) setWsLogo((profile as any)?.logo_url || null);
      else setWsLogo(null);
    })();
  }, [user, profile]);

  const displayName = wsName || profile?.store_name || 'My Workspace';

  return (
    <>
      <div className="hidden md:flex sticky top-3 z-30 mx-3 mb-2">
        <div className="flex-1 flex items-center gap-3 px-3 py-2 glass-elevated glass-sheen rounded-2xl">
          {/* Workspace switcher */}
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-foreground/[0.04] transition-all magnetic" onClick={() => navigate('/profile')}>
            {wsLogo ? (
              <img src={wsLogo} alt={displayName} className="w-6 h-6 rounded-md object-contain bg-card border border-border/40" />
            ) : (
              <div className="w-6 h-6 rounded-md bg-foreground text-background flex items-center justify-center text-[10px] font-bold">
                {(displayName?.[0] || 'W').toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold tracking-tight max-w-[200px] truncate">
              {displayName}
            </span>
          </button>

          <div className="h-6 w-px bg-border/60" />

          {/* Search */}
          <button
            onClick={() => setOpen(true)}
            className="flex-1 flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all text-left group"
          >
            <Search className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground/80">
              Search anything, jump anywhere…
            </span>
            <kbd className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-muted-foreground">
              <Command className="w-3 h-3" /> K
            </kbd>
          </button>

          {/* AI copilot */}
          <button
            onClick={() => navigate('/copilot')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-primary/15 to-secondary/15 hover:from-primary/25 hover:to-secondary/25 border border-primary/20 transition-all magnetic"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="hidden xl:inline text-sm font-medium">Ask Copilot</span>
          </button>

          <NotificationBell />
        </div>
      </div>

      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
};

export default TopBar;

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, X, ExternalLink, CheckCheck, Megaphone, Wrench, Zap, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

type Update = {
  id: string;
  title: string;
  body: string;
  category: string;
  image_url: string | null;
  icon: string | null;
  link_url: string | null;
  published_at: string;
};

const CATEGORY_ICON: Record<string, any> = {
  update: Sparkles,
  feature: Zap,
  fix: Wrench,
  announcement: Megaphone,
  offer: Gift,
};

const UpdatesInbox = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: rows }, { data: reads }] = await Promise.all([
      supabase.from('product_updates' as any).select('*').eq('is_published', true)
        .order('published_at', { ascending: false }).limit(50),
      supabase.from('product_update_reads' as any).select('update_id').eq('user_id', user.id),
    ]);
    setUpdates(((rows as any) || []) as Update[]);
    setReadIds(new Set(((reads as any) || []).map((r: any) => r.update_id)));
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const unread = updates.filter((u) => !readIds.has(u.id));

  const markRead = async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    setReadIds((prev) => new Set([...prev, ...ids]));
    await supabase.from('product_update_reads' as any)
      .upsert(ids.map((update_id) => ({ user_id: user.id, update_id })), { onConflict: 'user_id,update_id' });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
        title="What's new"
        aria-label="What's new"
      >
        <Sparkles className={cn('w-5 h-5', unread.length > 0 && 'text-primary')} />
        {unread.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-[420px] bg-card border-l border-border shadow-2xl flex flex-col animate-slide-in-right">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm flex-1">What's new in Reachably</h3>
              {unread.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={() => markRead(unread.map((u) => u.id))}>
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </Button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {updates.length === 0 ? (
                <div className="py-16 text-center px-6">
                  <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No updates yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    New features and improvements will show up here.
                  </p>
                </div>
              ) : (
                updates.map((u) => {
                  const Icon = CATEGORY_ICON[u.category] || Sparkles;
                  const isUnread = !readIds.has(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => markRead([u.id])}
                      className={cn(
                        'w-full text-left flex gap-3 px-4 py-4 border-b border-border/60 transition-colors',
                        isUnread ? 'bg-primary/5' : 'hover:bg-muted/40',
                      )}
                    >
                      {u.image_url ? (
                        <img src={u.image_url} alt="" loading="lazy"
                          className="w-14 h-14 rounded-xl object-cover border border-border flex-shrink-0" />
                      ) : (
                        <span className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                          {u.icon ? <span className="text-2xl">{u.icon}</span> : <Icon className="w-6 h-6" />}
                        </span>
                      )}

                      <span className="min-w-0 flex-1 block">
                        <span className="flex items-center gap-2">
                          <span className={cn('text-sm truncate', isUnread ? 'font-semibold' : 'font-medium')}>
                            {u.title}
                          </span>
                          {isUnread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                        </span>
                        <span className="block text-xs text-muted-foreground whitespace-pre-wrap mt-1">{u.body}</span>
                        <span className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                          {u.category}
                          <span>·</span>
                          {formatDistanceToNow(new Date(u.published_at), { addSuffix: true })}
                        </span>
                        {u.link_url && (
                          <span
                            onClick={(e) => { e.stopPropagation(); window.open(u.link_url!, '_blank'); }}
                            className="inline-flex items-center gap-1 mt-2 text-xs text-primary font-medium"
                          >
                            Learn more <ExternalLink className="w-3 h-3" />
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default UpdatesInbox;

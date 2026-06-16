import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enableNotificationSound, playNotificationSound, useNotifications, AppNotification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const TYPE_ICONS: Record<string, string> = {
  appointment_reminder: '📅',
  low_stock: '📦',
  daily_revenue: '💰',
  general: '🔔',
  whatsapp_inbound: '💬',
};

const NotificationItem = ({
  notification, onRead, onDelete,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) => (
  <div className={cn(
    'flex items-start gap-3 p-3 rounded-lg transition-colors border-b border-border/50 last:border-0',
    !notification.read ? 'bg-primary/5' : 'hover:bg-muted/30'
  )}>
    <span className="text-lg mt-0.5">{TYPE_ICONS[notification.type] || '🔔'}</span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className={cn('text-sm truncate', !notification.read ? 'font-semibold text-foreground' : 'text-foreground/80')}>
          {notification.title}
        </p>
        {!notification.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.message}</p>
      <p className="text-[10px] text-muted-foreground mt-1">
        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
      </p>
    </div>
    <div className="flex gap-1 flex-shrink-0">
      {!notification.read && (
        <button onClick={() => onRead(notification.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Mark read">
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
      <button onClick={() => onDelete(notification.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500" title="Delete">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

const NotificationBell = () => {
  const {
    notifications, unreadCount, markAsRead, markAllRead,
    deleteNotification, clearAll, requestBrowserPermission,
  } = useNotifications();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    requestBrowserPermission();
  }, [requestBrowserPermission]);

  return (
    <div className="relative">
      <button
        onClick={() => {
          enableNotificationSound();
          if (!open) playNotificationSound();
          setOpen(!open);
        }}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        title="Notifications"
      >
        <Bell className={cn('w-5 h-5', unreadCount > 0 ? 'text-primary' : 'text-muted-foreground')} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-xl z-50 max-h-[70vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Notifications</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
                    <CheckCheck className="w-3.5 h-3.5" />Read all
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={clearAll}>
                    Clear all
                  </Button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    New WhatsApp messages will appear here instantly
                  </p>
                </div>
              ) : (
                notifications.map(n => (
                  <NotificationItem key={n.id} notification={n} onRead={markAsRead} onDelete={deleteNotification} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;

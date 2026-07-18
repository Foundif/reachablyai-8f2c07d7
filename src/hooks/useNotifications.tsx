// Notifications table was removed with the old concept. Stubbed until rebuilt.
import { useState } from 'react';

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

export function useNotifications() {
  const [notifications] = useState<AppNotification[]>([]);
  return {
    notifications,
    unreadCount: 0,
    loading: false,
    markAsRead: async (_id: string) => {},
    markAllAsRead: async () => {},
    markAllRead: async () => {},
    deleteNotification: async (_id: string) => {},
    clearAll: async () => {},
    requestBrowserPermission: async () => {},
    refetch: async () => {},
  };
}

export const enableNotificationSound = () => {};
export const playNotificationSound = () => {};
export const isNotificationMuted = () => false;
export const setNotificationMuted = (_muted: boolean) => {};

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import alertSoundAsset from '@/assets/chatarly-message-alert.mp3.asset.json';
import { toast } from 'sonner';

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: any;
  created_at: string;
}

const NOTIFICATION_SOUND_URL = alertSoundAsset.url;

let audioInstance: HTMLAudioElement | null = null;
let audioUnlocked = false;

const ensureAudio = () => {
  if (!audioInstance) {
    audioInstance = new Audio(NOTIFICATION_SOUND_URL);
    audioInstance.volume = 0.65;
    audioInstance.preload = 'auto';
  }
  return audioInstance;
};

const unlockNotificationSound = () => {
  if (audioUnlocked) return;
  try {
    const audio = ensureAudio();
    audio.muted = true;
    audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        audioUnlocked = true;
      })
      .catch(() => {
        audio.muted = false;
      });
  } catch {}
};

export const playNotificationSound = () => {
  try {
    const audioInstance = ensureAudio();
    audioInstance.muted = false;
    audioInstance.volume = 0.9;
    audioInstance.currentTime = 0;
    audioInstance.play().catch(() => {
      toast.info('Click once anywhere to enable message alert sound');
    });
  } catch {}
};

export const enableNotificationSound = () => unlockNotificationSound();

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        setNotifications(data as AppNotification[]);
      }
    } catch {} finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    // Unlock audio on ANY first interaction (pointer, key, touch, or focus)
    const unlock = () => unlockNotificationSound();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });

    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newNotif = payload.new as AppNotification;
        setNotifications(prev => [newNotif, ...prev]);
        playNotificationSound();
        toast.message(newNotif.title, { description: newNotif.message });

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(newNotif.title, {
            body: newNotif.message,
            icon: '/icon-192.png',
            tag: newNotif.id,
          });
        }
      })
      .subscribe();

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);


  const markAsRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [user]);

  const deleteNotification = useCallback(async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifications([]);
  }, [user]);

  const requestBrowserPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  return {
    notifications, unreadCount, loading,
    markAsRead, markAllRead, deleteNotification, clearAll,
    requestBrowserPermission, refetch: fetchNotifications,
  };
};

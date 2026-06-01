
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { AppNotification, User } from '../types';
import NotificationToast from '../components/NotificationToast';

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  requestPermission: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode; currentUser: User; onNavigate: (page: any) => void }> = ({ children, currentUser, onNavigate }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Request browser permission on mount if default, or after user logs in
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      
      // Auto-prompt logically when user is signed in but we haven't asked yet
      if (currentUser && currentUser.id && Notification.permission === 'default') {
        Notification.requestPermission().then(perm => setPermission(perm));
      }
    }
  }, [currentUser]);

  // --- Notification Sound Preloading & Audio Unlock ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Preload the notification sound for instant playback
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0.5;
    audio.preload = 'auto';
    audioRef.current = audio;

    // Browsers require a user gesture before playing audio.
    // Unlock both HTMLAudioElement and AudioContext on first interaction.
    const unlockAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current!.pause();
          audioRef.current!.currentTime = 0;
        }).catch(() => {});
      }
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        audioCtxRef.current.resume();
      } catch {}
    };

    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Web Audio API fallback: synthesises a pleasant two-tone notification chime
  const playWebAudioChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      ctx.resume();
      const now = ctx.currentTime;

      // Tone 1: D5 (587 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.value = 587.33;
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Tone 2: A5 (880 Hz) — offset for a pleasing chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 880;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.01, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.3, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn('Web Audio chime failed:', e);
    }
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setPermission(perm);
    }
  };

  const addNotification = useCallback((data: Omit<AppNotification, 'id' | 'timestamp'>) => {
    const newNotif: AppNotification = {
      ...data,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    };

    setNotifications(prev => [newNotif, ...prev]);

    // 1. Play notification sound (preloaded audio with Web Audio fallback)
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Browser blocked preloaded audio — fall back to Web Audio API chime
            playWebAudioChime();
          });
        }
      } else {
        playWebAudioChime();
      }
    } catch (e) {
      playWebAudioChime();
    }

    // 2. Native Browser Notification (OS Popup)
    // Only pop the OS notification if the user has navigated away from our active tab
    if (permission === 'granted' && document.hidden) {
      try {
        const n = new Notification(newNotif.title, {
          body: newNotif.message,
          icon: '/icon-192.png', // Assumed existence or fallback
        });
        n.onclick = () => {
          window.focus();
          if (newNotif.type === 'message') onNavigate('MESSAGES');
          if (newNotif.type === 'order') onNavigate('PROFILE');
        };
      } catch (e) {
        console.warn('Native notification failed', e);
      }
    }
  }, [permission, onNavigate, playWebAudioChime]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // --- Realtime Subscriptions ---
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;

    // 1. Listen for Messages
    // Note: RLS ensures we only receive messages for conversations we are part of.
    const messageChannel = supabase.channel('notif-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new;
          
          // Don't notify for own messages
          if (newMsg.sender_id === currentUser.id) return;

          // Fetch sender info for better UX
          const { data: sender } = await supabase.from('profiles').select('name').eq('id', newMsg.sender_id).single();
          const senderName = sender?.name || 'Someone';

          addNotification({
            title: `Message from ${senderName}`,
            message: newMsg.content || (newMsg.image_url ? 'Sent a photo' : 'New message'),
            type: 'message',
            link: 'MESSAGES'
          });
        }
      )
      .subscribe();

    // 2. Listen for Order Updates
    const orderChannel = supabase.channel('notif-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `buyer_id=eq.${currentUser.id}` },
        (payload) => {
          const newOrder = payload.new;
          const oldOrder = payload.old;

          if (newOrder.status !== oldOrder.status) {
            addNotification({
              title: 'Order Update',
              message: `Your order #${newOrder.id.slice(0,6)} is now ${newOrder.status}`,
              type: 'order',
              link: 'PROFILE'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(orderChannel);
    };
  }, [currentUser.id, addNotification]);

  const handleToastClick = (n: AppNotification) => {
      removeNotification(n.id);
      if (n.type === 'message') onNavigate('MESSAGES');
      else if (n.type === 'order') onNavigate('PROFILE'); // Should optimally open wallet/orders tab
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, requestPermission }}>
      {children}
      
      {/* Global Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {/* pointer-events-auto applied inside the toast to allow clicks */}
        <div className="pointer-events-auto">
            {notifications.map(n => (
            <NotificationToast 
                key={n.id} 
                notification={n} 
                onClose={removeNotification} 
                onClick={handleToastClick}
            />
            ))}
        </div>
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification must be used within NotificationProvider");
  return context;
};

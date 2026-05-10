
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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

    // 1. Always attempt to play a pleasant Notification tone
    try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.4; // Slightly louder to ensure it catches attention
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                console.warn('Autoplay blocked for notification tone. We need a user interaction first.');
            });
        }
    } catch(e) {}

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
  }, [permission, onNavigate]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

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

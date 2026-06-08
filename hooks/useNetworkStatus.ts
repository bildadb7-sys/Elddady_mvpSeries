import { useState, useEffect } from 'react';
import { getOutboxQueue, clearOutboxItem } from '../utils/db';
import { api } from '../api';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await syncOutbox();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync if online
    if (navigator.onLine) {
      syncOutbox();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOutbox = async () => {
    setIsSyncing(true);
    try {
      const queue = await getOutboxQueue();
      for (const item of queue) {
        try {
          switch (item.action) {
            case 'toggleLike':
              await api.toggleLike(item.payload.productId);
              break;
            case 'postProduct':
              await api.postProduct(item.payload.data);
              break;
            // Add other actions as needed
          }
          if (item.id) {
            await clearOutboxItem(item.id);
          }
        } catch (error) {
          console.error(`Failed to sync action ${item.action}:`, error);
          // Depending on the error, we might want to keep it in the queue or drop it.
          // For now, if it fails, we keep it in the queue to retry later.
        }
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return { isOnline, isSyncing };
};

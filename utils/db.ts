import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ElddadyDB extends DBSchema {
  'api-cache': {
    key: string;
    value: {
      url: string;
      data: any;
      timestamp: number;
    };
  };
  'outbox': {
    key: number;
    value: {
      id?: number;
      action: string;
      payload: any;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<ElddadyDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<ElddadyDB>('elddady-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('api-cache')) {
          db.createObjectStore('api-cache', { keyPath: 'url' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
          outboxStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
};

export const setApiCache = async (url: string, data: any) => {
  const db = await initDB();
  await db.put('api-cache', { url, data, timestamp: Date.now() });
};

export const getApiCache = async (url: string) => {
  const db = await initDB();
  const entry = await db.get('api-cache', url);
  return entry ? entry.data : null;
};

export const addToOutbox = async (action: string, payload: any) => {
  const db = await initDB();
  await db.add('outbox', { action, payload, timestamp: Date.now() });
};

export const getOutboxQueue = async () => {
  const db = await initDB();
  return db.getAllFromIndex('outbox', 'by-timestamp');
};

export const clearOutboxItem = async (id: number) => {
  const db = await initDB();
  await db.delete('outbox', id);
};

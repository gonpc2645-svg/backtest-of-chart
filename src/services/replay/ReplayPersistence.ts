import { ReplaySession } from './types';

const DB_NAME = 'backtest_of_chart_sessions_v1';
const DB_VERSION = 1;
const STORE_NAME = 'replay_sessions';

export class ReplayPersistence {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.reject(new Error('IndexedDB is not supported in this environment.'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('instrumentId', 'instrumentId', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
    });

    return this.dbPromise;
  }

  public static async saveSession(session: ReplaySession): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record: ReplaySession = {
        ...session,
        updatedAt: Date.now(),
        // Always save with status PAUSED so on browser reload it NEVER auto-plays
        status: 'PAUSED',
      };

      await new Promise<void>((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[ReplayPersistence] Failed to persist session to IndexedDB:', err);
    }
  }

  public static async getSession(id: string): Promise<ReplaySession | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return await new Promise<ReplaySession | null>((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => {
          const session = req.result as ReplaySession | undefined;
          if (!session) return resolve(null);

          // Validate session schema integrity
          if (!session.id || !session.instrumentId || !session.cursor || !session.timeframe) {
            console.warn('[ReplayPersistence] Corrupt session record found, discarding:', id);
            return resolve(null);
          }

          // Ensure restored session is always in PAUSED state
          session.status = 'PAUSED';
          resolve(session);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[ReplayPersistence] Error reading session from IndexedDB:', err);
      return null;
    }
  }

  public static async getAllSessions(): Promise<ReplaySession[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return await new Promise<ReplaySession[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []) as ReplaySession[];
          list.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[ReplayPersistence] Error reading all sessions:', err);
      return [];
    }
  }

  public static async deleteSession(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[ReplayPersistence] Error deleting session:', err);
    }
  }
}

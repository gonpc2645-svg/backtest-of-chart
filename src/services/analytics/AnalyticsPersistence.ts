import { ANALYTICS_CALCULATION_VERSION } from './AnalyticsEngine';
import { SessionAnalyticsReport } from './AnalyticsTypes';

const DB_NAME = 'backtest_of_chart_analytics_v1';
const DB_VERSION = 1;
const STORE_NAME = 'analytics_reports';

export class AnalyticsPersistence {
  private static dbPromise: Promise<IDBDatabase> | null = null;
  private static memoryCache = new Map<string, SessionAnalyticsReport>();

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
          db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open Analytics IndexedDB.'));
    });

    return this.dbPromise;
  }

  public static async saveReport(report: SessionAnalyticsReport): Promise<void> {
    this.memoryCache.set(report.sessionId, report);

    if (typeof window === 'undefined' || !window.indexedDB) {
      return;
    }

    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record = {
        sessionId: report.sessionId,
        report,
        savedAt: Date.now(),
        version: ANALYTICS_CALCULATION_VERSION,
      };

      await new Promise<void>((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[AnalyticsPersistence] Failed to cache report in IndexedDB:', err);
    }
  }

  public static async getReport(sessionId: string): Promise<SessionAnalyticsReport | null> {
    if (this.memoryCache.has(sessionId)) {
      return this.memoryCache.get(sessionId)!;
    }

    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }

    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const record = await new Promise<any>((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (!record || record.version !== ANALYTICS_CALCULATION_VERSION) {
        return null;
      }

      this.memoryCache.set(sessionId, record.report);
      return record.report as SessionAnalyticsReport;
    } catch (err) {
      console.warn('[AnalyticsPersistence] Failed to retrieve cached report:', err);
      return null;
    }
  }

  public static clearCache(sessionId?: string): void {
    if (sessionId) {
      this.memoryCache.delete(sessionId);
    } else {
      this.memoryCache.clear();
    }
  }
}

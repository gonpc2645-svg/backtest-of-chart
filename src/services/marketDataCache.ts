import { ApiCandle } from './marketDataApi';

export type CachedDaySource =
  | 'DUKASCOPY_BI5'
  | 'FXCM_M1'
  | 'BINANCE_SPOT_1M'
  | 'BITGET_XAUTUSDT_1M'
  | 'YAHOO_1M'
  | 'YAHOO_5M'
  | 'YAHOO_1H';

export interface CachedUtcDayEntry {
  key: string; // `${instrumentId}::${date}`
  instrumentId: string;
  date: string; // YYYY-MM-DD
  source: CachedDaySource;
  resolution: '1m' | '5m' | '1h';
  isCanonicalM1: boolean;
  isWeekendOrHoliday?: boolean;
  note?: string;
  candles: ApiCandle[];
  fetchedAt: number;
}

const DB_NAME = 'backtest_of_chart_m1_days_v1';
const DB_VERSION = 1;
const STORE_NAME = 'utc_days';

export class MarketDataCache {
  private static dbPromise: Promise<IDBDatabase> | null = null;
  private static memoryCache = new Map<string, CachedUtcDayEntry>();

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.reject(new Error('IndexedDB unavailable'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('instrumentId', 'instrumentId', { unique: false });
          store.createIndex('fetchedAt', 'fetchedAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Failed to open MarketDataCache IndexedDB'));
    });

    return this.dbPromise;
  }

  public static isFresh(entry: CachedUtcDayEntry, dayEndMs: number): boolean {
    const now = Date.now();
    // Canonical historical finalized UTC days (>18h old) never go stale
    if (entry.isCanonicalM1 && dayEndMs < now - 18 * 3600000) {
      return true;
    }
    // Same-day unclosed canonical M1 refreshes after 2 minutes
    if (entry.isCanonicalM1) {
      return now - entry.fetchedAt < 2 * 60 * 1000;
    }
    // Non-canonical fallbacks (Bitget proxy / Yahoo) expire after 10 minutes so Dukascopy upgrades automatically
    return now - entry.fetchedAt < 10 * 60 * 1000;
  }

  public static async getDay(instrumentId: string, date: string, dayEndMs: number): Promise<CachedUtcDayEntry | null> {
    const key = `${instrumentId}::${date}`;
    const mem = this.memoryCache.get(key);
    if (mem && this.isFresh(mem, dayEndMs)) {
      return mem;
    }

    try {
      const db = await this.getDB();
      const entry = await new Promise<CachedUtcDayEntry | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as CachedUtcDayEntry) || null);
        req.onerror = () => resolve(null);
      });

      if (entry && this.isFresh(entry, dayEndMs)) {
        this.memoryCache.set(key, entry);
        return entry;
      }
      return null;
    } catch {
      return null;
    }
  }

  public static async putDay(entry: CachedUtcDayEntry): Promise<void> {
    this.memoryCache.set(entry.key, entry);
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // ignore IndexedDB quota/privacy failures
    }
  }

  public static async getInstrumentCachedCount(instrumentId: string): Promise<number> {
    try {
      const db = await this.getDB();
      return await new Promise<number>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const index = tx.objectStore(STORE_NAME).index('instrumentId');
        const req = index.getAll(instrumentId);
        req.onsuccess = () => {
          const rows = (req.result || []) as CachedUtcDayEntry[];
          const total = rows.reduce((sum, r) => sum + (r.candles?.length || 0), 0);
          resolve(total);
        };
        req.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }
}

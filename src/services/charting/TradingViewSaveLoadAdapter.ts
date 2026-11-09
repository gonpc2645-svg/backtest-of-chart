/**
 * BACKTEST OF CHART — PHASE 6
 * TradingView IExternalSaveLoadAdapter implementation using client IndexedDB.
 * Associated per Backtest Session, preserving drawings & chart layouts locally.
 * (Contains NO proprietary or restricted library code)
 */

export interface ChartMeta {
  id: string;
  name: string;
  symbol: string;
  resolution: string;
  timestamp: number;
  content: string;
}

export interface StudyTemplateMeta {
  name: string;
  content: string;
}

const DB_NAME = 'backtest_of_chart_chart_layouts_v1';
const DB_VERSION = 1;
const CHARTS_STORE = 'charts';
const TEMPLATES_STORE = 'study_templates';

export class TradingViewSaveLoadAdapter {
  private sessionId: string;
  private static dbPromise: Promise<IDBDatabase> | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.reject(new Error('IndexedDB is not supported in this environment.'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CHARTS_STORE)) {
          const store = db.createObjectStore(CHARTS_STORE, { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
        }
        if (!db.objectStoreNames.contains(TEMPLATES_STORE)) {
          db.createObjectStore(TEMPLATES_STORE, { keyPath: 'name' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open Chart Layouts IndexedDB.'));
    });

    return this.dbPromise;
  }

  public async getAllCharts(): Promise<any[]> {
    if (typeof window === 'undefined' || !window.indexedDB) return [];
    try {
      const db = await TradingViewSaveLoadAdapter.getDB();
      const tx = db.transaction(CHARTS_STORE, 'readonly');
      const store = tx.objectStore(CHARTS_STORE);

      const records = await new Promise<any[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      return records
        .filter((r) => r.sessionId === this.sessionId)
        .map((r) => ({
          id: r.id,
          name: r.name,
          image_url: '',
          modified_iso: new Date(r.timestamp).toISOString(),
          symbol: r.symbol,
          resolution: r.resolution,
        }));
    } catch {
      return [];
    }
  }

  public async removeChart(id: string): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    try {
      const db = await TradingViewSaveLoadAdapter.getDB();
      const tx = db.transaction(CHARTS_STORE, 'readwrite');
      const store = tx.objectStore(CHARTS_STORE);
      await new Promise<void>((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[SaveLoadAdapter] Failed to delete chart layout:', err);
    }
  }

  public async saveChart(chartData: {
    name: string;
    symbol: string;
    resolution: string;
    content: string;
    id?: string;
  }): Promise<string> {
    const id = chartData.id || `${this.sessionId}_chart_${Date.now()}`;
    if (typeof window === 'undefined' || !window.indexedDB) return id;

    try {
      const db = await TradingViewSaveLoadAdapter.getDB();
      const tx = db.transaction(CHARTS_STORE, 'readwrite');
      const store = tx.objectStore(CHARTS_STORE);

      const record = {
        id,
        sessionId: this.sessionId,
        name: chartData.name,
        symbol: chartData.symbol,
        resolution: chartData.resolution,
        content: chartData.content,
        timestamp: Date.now(),
      };

      await new Promise<void>((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      return id;
    } catch (err) {
      console.warn('[SaveLoadAdapter] Failed to save chart layout:', err);
      return id;
    }
  }

  public async getChartContent(id: string): Promise<string> {
    if (typeof window === 'undefined' || !window.indexedDB) return '';
    try {
      const db = await TradingViewSaveLoadAdapter.getDB();
      const tx = db.transaction(CHARTS_STORE, 'readonly');
      const store = tx.objectStore(CHARTS_STORE);

      const record = await new Promise<any>((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      return record ? record.content : '';
    } catch {
      return '';
    }
  }

  public async getAllStudyTemplates(): Promise<any[]> {
    if (typeof window === 'undefined' || !window.indexedDB) return [];
    try {
      const db = await TradingViewSaveLoadAdapter.getDB();
      const tx = db.transaction(TEMPLATES_STORE, 'readonly');
      const store = tx.objectStore(TEMPLATES_STORE);

      const records = await new Promise<any[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      return records.map((r) => ({ name: r.name }));
    } catch {
      return [];
    }
  }

  public async removeStudyTemplate(name: string): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    try {
      const db = await TradingViewSaveLoadAdapter.getDB();
      const tx = db.transaction(TEMPLATES_STORE, 'readwrite');
      const store = tx.objectStore(TEMPLATES_STORE);
      await new Promise<void>((resolve, reject) => {
        const req = store.delete(name);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[SaveLoadAdapter] Failed to delete study template:', err);
    }
  }

  public async saveStudyTemplate(templateData: { name: string; content: string }): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    try {
      const db = await TradingViewSaveLoadAdapter.getDB();
      const tx = db.transaction(TEMPLATES_STORE, 'readwrite');
      const store = tx.objectStore(TEMPLATES_STORE);
      await new Promise<void>((resolve, reject) => {
        const req = store.put(templateData);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[SaveLoadAdapter] Failed to save study template:', err);
    }
  }

  public async getStudyTemplateContent(name: string): Promise<string> {
    if (typeof window === 'undefined' || !window.indexedDB) return '';
    try {
      const db = await TradingViewSaveLoadAdapter.getDB();
      const tx = db.transaction(TEMPLATES_STORE, 'readonly');
      const store = tx.objectStore(TEMPLATES_STORE);

      const record = await new Promise<any>((resolve, reject) => {
        const req = store.get(name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      return record ? record.content : '';
    } catch {
      return '';
    }
  }
}

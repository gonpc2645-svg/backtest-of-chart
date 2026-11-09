import { TradingState, TradeRecord } from './TradingTypes';

const DB_NAME = 'backtest_of_chart_trading_sessions_v1';
const DB_VERSION = 1;
const STORE_NAME = 'trading_sessions';

export class TradingPersistence {
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
          db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open Trading IndexedDB.'));
    });

    return this.dbPromise;
  }

  public static async saveTradingState(sessionId: string, state: TradingState): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return;
    }
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record = {
        sessionId,
        state,
        updatedAt: Date.now(),
        version: 1,
      };

      await new Promise<void>((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[TradingPersistence] Failed to save trading state to IndexedDB:', err);
    }
  }

  public static async getTradingState(sessionId: string): Promise<TradingState | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return await new Promise<TradingState | null>((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => {
          const res = req.result;
          if (!res || !res.state) return resolve(null);
          resolve(res.state as TradingState);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[TradingPersistence] Error loading trading state from IndexedDB:', err);
      return null;
    }
  }

  public static async deleteTradingState(sessionId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const req = store.delete(sessionId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[TradingPersistence] Error deleting trading state from IndexedDB:', err);
    }
  }

  /**
   * Generates and downloads a JSON export of the current trading session.
   */
  public static exportSessionJson(sessionId: string, state: TradingState): void {
    const payload = {
      project: 'BACKTEST OF CHART',
      phase: 4,
      version: 1,
      exportTimestamp: Date.now(),
      sessionId,
      state,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest_trading_session_${sessionId}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Validates and imports a previously exported trading session JSON.
   */
  public static parseAndValidateImportJson(rawJson: string): TradingState {
    let parsed: any;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new Error('Invalid JSON format. Please upload a valid Backtest of Chart session export.');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Malformed session file.');
    }

    const state = parsed.state || parsed;
    if (!state.account || typeof state.account.balance !== 'number' || !Array.isArray(state.positions)) {
      throw new Error('Incompatible trading session schema: missing required account or position data.');
    }

    return state as TradingState;
  }

  /**
   * Generates and downloads a CSV of closed trades history.
   */
  public static exportTradesCsv(sessionId: string, trades: TradeRecord[]): void {
    const headers = [
      'Trade ID',
      'Position ID',
      'Order ID',
      'Instrument',
      'Direction',
      'Quantity',
      'Entry Price',
      'Exit Price',
      'Entry Time (UTC)',
      'Exit Time (UTC)',
      'Realized P/L ($)',
      'Exit Reason',
      'OHLC Ambiguous',
    ];

    const rows = trades.map((t) => [
      t.id,
      t.positionId,
      t.orderId,
      t.instrumentId,
      t.direction,
      t.quantity,
      t.entryPrice,
      t.exitPrice,
      new Date(t.entryTime).toISOString(),
      new Date(t.exitTime).toISOString(),
      t.pnl.toFixed(2),
      t.exitReason,
      t.isAmbiguous ? 'YES' : 'NO',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const a = document.createElement('a');
    a.href = encodedUri;
    a.download = `trades_history_${sessionId}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

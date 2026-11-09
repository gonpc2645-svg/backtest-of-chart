import { MarketDataApi } from '../marketDataApi';
import { ReplayEngine } from '../replay/ReplayEngine';
import { TimeframeId } from '../replay/types';
import {
  Bar,
  DatafeedConfiguration,
  ErrorCallback,
  HistoryCallback,
  IDatafeedChartApi,
  LibrarySymbolInfo,
  OnReadyCallback,
  PeriodParams,
  ResolveCallback,
  SearchSymbolsCallback,
  SearchSymbolResultItem,
  SubscribeBarsCallback,
} from './TradingViewDatafeedTypes';

// Resolution to Timeframe mapping
export const RESOLUTION_TO_TIMEFRAME: Record<string, TimeframeId> = {
  '1': 'M1',
  '5': 'M5',
  '15': 'M15',
  '30': 'M30',
  '60': 'H1',
  '240': 'H4',
  '1D': 'D1',
  'D': 'D1',
};

export const TIMEFRAME_TO_RESOLUTION: Record<TimeframeId, string> = {
  M1: '1',
  M5: '5',
  M15: '15',
  M30: '30',
  H1: '60',
  H4: '240',
  D1: '1D',
};

const SUPPORTED_RESOLUTIONS = ['1', '5', '15', '30', '60', '240', '1D'];

export class BacktestDatafeed implements IDatafeedChartApi {
  private replayEngine: ReplayEngine | null = null;
  private subscribers = new Map<
    string,
    {
      symbolInfo: LibrarySymbolInfo;
      resolution: string;
      callback: SubscribeBarsCallback;
      onResetCache: () => void;
    }
  >();
  private m1Listener: ((m1: any) => void) | null = null;

  constructor(replayEngine?: ReplayEngine) {
    if (replayEngine) {
      this.setReplayEngine(replayEngine);
    }
  }

  public setReplayEngine(engine: ReplayEngine): void {
    this.replayEngine = engine;
    this.setupReplayListener();
  }

  public onReady(callback: OnReadyCallback): void {
    setTimeout(() => {
      const config: DatafeedConfiguration = {
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
        symbols_types: [
          { name: 'Crypto', value: 'crypto' },
          { name: 'Forex', value: 'forex' },
          { name: 'Metals', value: 'metals' },
          { name: 'Indices', value: 'indices' },
        ],
      };
      callback(config);
    }, 0);
  }

  public async searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResultReadyCallback: SearchSymbolsCallback
  ): Promise<void> {
    try {
      const categories = symbolType ? [symbolType] : ['crypto', 'forex', 'metals'];
      const results: SearchSymbolResultItem[] = [];

      for (const cat of categories) {
        const instruments = await MarketDataApi.getInstruments(cat, userInput).catch(() => []);
        for (const inst of instruments) {
          if (exchange && inst.provider !== exchange) continue;
          results.push({
            symbol: inst.providerSymbol,
            full_name: inst.id,
            description: inst.displayName,
            exchange: inst.provider,
            ticker: inst.id,
            type: inst.marketCategory,
          });
        }
      }

      onResultReadyCallback(results.slice(0, 30));
    } catch {
      onResultReadyCallback([]);
    }
  }

  public async resolveSymbol(
    symbolName: string,
    onResolve: ResolveCallback,
    onError: ErrorCallback
  ): Promise<void> {
    try {
      const instrumentId = symbolName.includes(':') ? symbolName : `BINANCE:${symbolName}`;
      const coverageRes = await MarketDataApi.getCoverage(instrumentId).catch(() => null);

      if (!coverageRes || !coverageRes.instrument) {
        onError(`Instrument not found: ${symbolName}`);
        return;
      }

      const inst = coverageRes.instrument;
      const isCrypto = inst.marketCategory === 'crypto';

      const symbolInfo: LibrarySymbolInfo = {
        name: inst.providerSymbol || inst.displayName,
        ticker: inst.id,
        description: inst.displayName,
        type: inst.marketCategory,
        session: isCrypto ? '24x7' : '0900-1700',
        exchange: inst.provider,
        listed_exchange: inst.provider,
        timezone: 'Etc/UTC',
        format: 'price',
        pricescale: isCrypto ? 100 : 100000,
        minmov: 1,
        has_intraday: true,
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        intraday_multipliers: ['1', '5', '15', '30', '60', '240'],
        has_daily: true,
        has_empty_bars: false,
        volume_precision: 4,
        data_status: 'streaming',
      };

      onResolve(symbolInfo);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  public async getBars(
    symbolInfo: LibrarySymbolInfo,
    _resolution: string,
    periodParams: PeriodParams,
    onHistoryCallback: HistoryCallback,
    onErrorCallback: ErrorCallback
  ): Promise<void> {
    try {
      const instrumentId = symbolInfo.ticker || `BINANCE:${symbolInfo.name}`;

      // 1. Determine Authoritative Replay Cursor (Zero Future Data Leakage)
      const currentCursor = this.replayEngine ? this.replayEngine.getCursor() : Date.now();

      // Convert seconds to ms
      const requestedFromMs = periodParams.from * 1000;
      const requestedToMs = periodParams.to * 1000;

      // Clamping end bound strictly to current replay cursor
      const effectiveToMs = Math.min(requestedToMs, currentCursor);

      if (effectiveToMs < requestedFromMs) {
        onHistoryCallback([], { noData: true });
        return;
      }

      // Fetch historical candles from our Phase 2 API
      const candlesRes = await MarketDataApi.getReplayCandles({
        instrumentId,
        from: requestedFromMs,
        cursor: effectiveToMs,
        limit: Math.min(periodParams.countBack || 500, 2000),
      });

      if (!candlesRes || !candlesRes.candles || candlesRes.candles.length === 0) {
        onHistoryCallback([], { noData: true });
        return;
      }

      // Filter candles strictly: timestamp <= effectiveToMs
      const validCandles = candlesRes.candles.filter((c: any) => c.timestamp <= effectiveToMs);

      if (validCandles.length === 0) {
        onHistoryCallback([], { noData: true });
        return;
      }

      // Convert to TradingView Bar format (Unix ms)
      const bars: Bar[] = validCandles.map((c: any) => ({
        time: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0,
      }));

      // Sort ascending
      bars.sort((a, b) => a.time - b.time);

      onHistoryCallback(bars, { noData: false });
    } catch (err) {
      onErrorCallback(err instanceof Error ? err.message : String(err));
    }
  }

  public subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    onRealtimeCallback: SubscribeBarsCallback,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void
  ): void {
    this.subscribers.set(subscriberUID, {
      symbolInfo,
      resolution,
      callback: onRealtimeCallback,
      onResetCache: onResetCacheNeededCallback,
    });
  }

  public unsubscribeBars(subscriberUID: string): void {
    this.subscribers.delete(subscriberUID);
  }

  private setupReplayListener(): void {
    if (!this.replayEngine || this.m1Listener) return;

    this.m1Listener = (m1: any) => {
      if (!m1) return;

      // Notify all active subscribers
      for (const sub of this.subscribers.values()) {
        // Check if subscriber resolution matches current engine bar
        const currentBar = this.replayEngine?.getCurrentCandle();
        if (currentBar) {
          sub.callback({
            time: currentBar.timestamp,
            open: currentBar.open,
            high: currentBar.high,
            low: currentBar.low,
            close: currentBar.close,
            volume: currentBar.volume || 0,
          });
        } else {
          sub.callback({
            time: m1.timestamp,
            open: m1.open,
            high: m1.high,
            low: m1.low,
            close: m1.close,
            volume: m1.volume || 0,
          });
        }
      }
    };

    this.replayEngine.on('m1Candle', this.m1Listener);

    // When replay steps backward, tell chart to reset cache
    this.replayEngine.on('stateChange', (st) => {
      if (st === 'READY') {
        for (const sub of this.subscribers.values()) {
          sub.onResetCache();
        }
      }
    });
  }

  public dispose(): void {
    if (this.replayEngine && this.m1Listener) {
      this.replayEngine.off('m1Candle', this.m1Listener);
      this.m1Listener = null;
    }
    this.subscribers.clear();
  }
}

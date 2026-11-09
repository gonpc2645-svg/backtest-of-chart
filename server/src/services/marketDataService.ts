import { TimeframeAggregator } from '../aggregation/timeframeAggregator.js';
import { DatabaseService } from '../database/connection.js';
import { BinanceAdapter } from '../providers/binanceAdapter.js';
import { DukascopyAdapter } from '../providers/dukascopyAdapter.js';
import { IProviderAdapter } from '../providers/IProviderAdapter.js';
import {
  AggregatedCandle,
  MarketCategory,
  MarketCategoryId,
  MarketDataCoverage,
  MarketInstrument,
  ProviderId,
  ProviderStatus,
  TimeframeId,
} from '../types/marketData.js';

export class MarketDataService {
  private static instance: MarketDataService | null = null;
  private db: DatabaseService;
  private adapters: Map<ProviderId, IProviderAdapter>;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.adapters = new Map();
    this.adapters.set('BINANCE', new BinanceAdapter());
    this.adapters.set('DUKASCOPY', new DukascopyAdapter());
  }

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  public getAdapter(providerId: ProviderId): IProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) throw new Error(`Unknown provider: ${providerId}`);
    return adapter;
  }

  public async getProvidersStatus(): Promise<ProviderStatus[]> {
    const statuses: ProviderStatus[] = [];
    for (const adapter of this.adapters.values()) {
      statuses.push(await adapter.getStatus());
    }
    return statuses;
  }

  public async getMarketCategories(): Promise<
    Array<{
      id: MarketCategoryId;
      name: string;
      code: string;
      intendedSource: ProviderId;
      status: 'AVAILABLE' | 'AWAITING_CREDENTIALS';
      instrumentCount: number;
      storedCandlesCount: number;
    }>
  > {
    const instruments = this.db.getInstruments();
    const stats = this.db.getDatabaseStats();

    const counts: Record<MarketCategoryId, number> = {
      crypto: 0,
      forex: 0,
      metals: 0,
      indices: 0,
    };

    for (const inst of instruments) {
      if (counts[inst.marketCategory] !== undefined) {
        counts[inst.marketCategory]++;
      }
    }

    return [
      {
        id: 'crypto',
        name: 'Cryptocurrency',
        code: 'CRP',
        intendedSource: 'BINANCE',
        status: counts.crypto > 0 ? 'AVAILABLE' : 'AVAILABLE',
        instrumentCount: counts.crypto,
        storedCandlesCount: stats.m1CandlesCount,
      },
      {
        id: 'forex',
        name: 'Forex',
        code: 'FX',
        intendedSource: 'DUKASCOPY',
        status: 'AWAITING_CREDENTIALS',
        instrumentCount: counts.forex,
        storedCandlesCount: 0,
      },
      {
        id: 'metals',
        name: 'Metals',
        code: 'MTL',
        intendedSource: 'DUKASCOPY',
        status: 'AWAITING_CREDENTIALS',
        instrumentCount: counts.metals,
        storedCandlesCount: 0,
      },
      {
        id: 'indices',
        name: 'Indices',
        code: 'IDX',
        intendedSource: 'DUKASCOPY',
        status: 'AWAITING_CREDENTIALS',
        instrumentCount: counts.indices,
        storedCandlesCount: 0,
      },
    ];
  }

  public getInstruments(category?: string, provider?: string): MarketInstrument[] {
    return this.db.getInstruments(category, provider);
  }

  public getInstrumentById(id: string): MarketInstrument | null {
    return this.db.getInstrumentById(id);
  }

  public getCoverage(instrumentId: string): MarketDataCoverage | null {
    return this.db.getCoverage(instrumentId);
  }

  public getCandles(
    instrumentId: string,
    timeframe: TimeframeId,
    fromTimestamp: number,
    toTimestamp: number,
    limit: number = 500
  ): {
    candles: AggregatedCandle[];
    instrument: MarketInstrument | null;
    coverage: MarketDataCoverage | null;
    m1CandlesRetrieved: number;
  } {
    const instrument = this.db.getInstrumentById(instrumentId);
    const coverage = this.db.getCoverage(instrumentId);

    // Retrieve canonical M1 candles from persistent disk database with timeframe-appropriate limit multiplier
    const multiplier =
      timeframe === 'D1' ? 1440 : timeframe === 'H4' ? 240 : timeframe === 'H1' ? 60 : timeframe === 'M30' ? 30 : timeframe === 'M15' ? 15 : timeframe === 'M5' ? 5 : 1;
    const m1Candles = this.db.getCandlesM1(instrumentId, fromTimestamp, toTimestamp, limit * multiplier);

    // Aggregate to requested timeframe
    const aggregated = TimeframeAggregator.aggregate(m1Candles, timeframe);

    // Slice to limit
    const trimmed = aggregated.slice(-limit);

    return {
      candles: trimmed,
      instrument,
      coverage,
      m1CandlesRetrieved: m1Candles.length,
    };
  }
}

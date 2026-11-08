export interface ApiProviderStatus {
  id: 'BINANCE' | 'DUKASCOPY';
  name: string;
  intendedMarkets: string[];
  connectionStatus: 'CONNECTED' | 'BLOCKED' | 'REQUIRES_OWNER_ACTION';
  officialDocumentationUrl: string;
  licenseTerms: string;
  redistributionTerms: string;
  statusMessage: string;
}

export interface ApiMarketCategory {
  id: 'crypto' | 'forex' | 'metals' | 'indices';
  name: string;
  code: string;
  intendedSource: 'BINANCE' | 'DUKASCOPY';
  status: 'AVAILABLE' | 'AWAITING_CREDENTIALS';
  instrumentCount: number;
  storedCandlesCount: number;
}

export interface ApiMarketInstrument {
  id: string;
  provider: 'BINANCE' | 'DUKASCOPY';
  providerSymbol: string;
  baseAsset: string;
  quoteAsset: string;
  marketCategory: 'crypto' | 'forex' | 'metals' | 'indices';
  displayName: string;
  tradingStatus: 'TRADING' | 'HALTED' | 'DELISTED' | 'PLANNED';
  priceBasis: 'LAST' | 'BID' | 'ASK';
  availabilityMetadata: {
    minPrice?: number;
    maxPrice?: number;
    tickSize?: number;
    lotSize?: number;
    description?: string;
    plannedIntegrationPhase?: string;
    licenseRequirement?: string;
    dataSourceUrl?: string;
  };
  lastSyncTimestamp: number;
}

export interface ApiCoverage {
  provider: 'BINANCE' | 'DUKASCOPY';
  instrumentId: string;
  priceBasis: 'LAST' | 'BID' | 'ASK';
  earliestVerifiedTimestamp: number | null;
  latestVerifiedTimestamp: number | null;
  totalCandlesCount: number;
  availableRanges: Array<{ start: number; end: number; count: number }>;
  missingIntervals: Array<{ start: number; end: number; missingMinutes: number }>;
  coverageStatus: 'EMPTY' | 'PARTIAL' | 'VERIFIED' | 'BLOCKED';
  lastVerificationTimestamp: number;
  notes?: string;
}

export interface ApiCandle {
  provider: 'BINANCE' | 'DUKASCOPY';
  instrumentId: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  volumeDefinition: string;
  priceBasis: string;
  timeframe: string;
  m1CandleCount: number;
  isIncomplete: boolean;
}

export class MarketDataApi {
  private static async request<T>(endpoint: string): Promise<T> {
    const res = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API error [${res.status}]: ${body || res.statusText}`);
    }
    return (await res.json()) as T;
  }

  public static async getProviders(): Promise<ApiProviderStatus[]> {
    const data = await this.request<{ success: boolean; providers: ApiProviderStatus[] }>('/api/market-data/providers');
    return data.providers;
  }

  public static async getMarkets(): Promise<ApiMarketCategory[]> {
    const data = await this.request<{ success: boolean; categories: ApiMarketCategory[] }>('/api/markets');
    return data.categories;
  }

  public static async getInstruments(market: string, query: string = ''): Promise<ApiMarketInstrument[]> {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    const data = await this.request<{ success: boolean; instruments: ApiMarketInstrument[] }>(
      `/api/markets/${market}/instruments${q}`
    );
    return data.instruments;
  }

  public static async getCoverage(instrumentId: string): Promise<{
    instrument: ApiMarketInstrument;
    coverage: ApiCoverage;
  }> {
    return await this.request<{
      success: boolean;
      instrument: ApiMarketInstrument;
      coverage: ApiCoverage;
    }>(`/api/market-data/coverage?instrument=${encodeURIComponent(instrumentId)}`);
  }

  public static async getCandles(
    instrumentId: string,
    timeframe: string,
    from: number,
    to: number,
    limit: number = 500
  ): Promise<{
    candles: ApiCandle[];
    candleCount: number;
    m1CandlesRetrieved: number;
    coverage: ApiCoverage | null;
  }> {
    const params = new URLSearchParams({
      instrument: instrumentId,
      timeframe,
      from: String(from),
      to: String(to),
      limit: String(limit),
    });
    return await this.request<{
      success: boolean;
      candles: ApiCandle[];
      candleCount: number;
      m1CandlesRetrieved: number;
      coverage: ApiCoverage | null;
    }>(`/api/market-data/candles?${params.toString()}`);
  }
}

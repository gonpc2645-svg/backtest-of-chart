export type ProviderId = 'BINANCE' | 'DUKASCOPY';

export type MarketCategoryId = 'crypto' | 'forex' | 'metals' | 'indices';

export type TimeframeId = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';

export type PriceBasis = 'LAST' | 'BID' | 'ASK';

export type TradingStatus = 'TRADING' | 'HALTED' | 'DELISTED' | 'PLANNED';

export type VolumeDefinition = 'BASE_ASSET_VOLUME' | 'TICK_VOLUME' | 'UNAVAILABLE';

export type CoverageStatus = 'EMPTY' | 'PARTIAL' | 'VERIFIED' | 'BLOCKED';

export type IngestionJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';

export interface MarketInstrument {
  id: string; // e.g. "BINANCE:BTCUSDT", "DUKASCOPY:EURUSD"
  provider: ProviderId;
  providerSymbol: string; // e.g. "BTCUSDT", "EURUSD"
  baseAsset: string;
  quoteAsset: string;
  marketCategory: MarketCategoryId;
  displayName: string;
  tradingStatus: TradingStatus;
  priceBasis: PriceBasis;
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

export interface CanonicalCandle {
  id?: number;
  provider: ProviderId;
  instrumentId: string;
  timestamp: number; // UTC Unix ms (aligned to resolution boundary)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  volumeDefinition: VolumeDefinition;
  priceBasis: PriceBasis;
  sourceInterval: string;
  sourceMetadata?: Record<string, unknown>;
  ingestedAt: number;
}

export interface AggregatedCandle extends CanonicalCandle {
  timeframe: TimeframeId;
  m1CandleCount: number;
  isIncomplete: boolean;
}

export interface CoverageRange {
  start: number; // UTC Unix ms
  end: number;   // UTC Unix ms
  count: number;
}

export interface MissingInterval {
  start: number;
  end: number;
  missingMinutes: number;
}

export interface MarketDataCoverage {
  provider: ProviderId;
  instrumentId: string;
  priceBasis: PriceBasis;
  earliestVerifiedTimestamp: number | null;
  latestVerifiedTimestamp: number | null;
  totalCandlesCount: number;
  availableRanges: CoverageRange[];
  missingIntervals: MissingInterval[];
  coverageStatus: CoverageStatus;
  lastVerificationTimestamp: number;
  notes?: string;
}

export interface IngestionJob {
  id: string;
  provider: ProviderId;
  instrumentId: string;
  requestedStartTimestamp: number;
  requestedEndTimestamp: number;
  jobStatus: IngestionJobStatus;
  downloadProgressPct: number;
  processedCandleCount: number;
  rejectedRecordCount: number;
  errorDetails: string | null;
  startedAt: number;
  completedAt: number | null;
}

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  intendedMarkets: MarketCategoryId[];
  connectionStatus: 'CONNECTED' | 'BLOCKED' | 'REQUIRES_OWNER_ACTION';
  officialDocumentationUrl: string;
  licenseTerms: string;
  redistributionTerms: string;
  activeSpotSymbolsCount?: number;
  verifiedStoredCandlesCount?: number;
  statusMessage: string;
}

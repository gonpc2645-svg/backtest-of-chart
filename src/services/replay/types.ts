import { ApiCandle } from '../marketDataApi';

export type ReplayState =
  | 'IDLE'
  | 'INITIALIZING'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ERROR'
  | 'DATA_GAP';

export type ReplaySpeed = 0.5 | 1 | 2 | 5 | 10 | 20;

export type TimeframeId = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';

export interface ReplayCandleData {
  time: number; // UTC Unix timestamp in seconds (Lightweight Charts requirement)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

export interface ReplaySession {
  id: string;
  provider: 'BINANCE' | 'DUKASCOPY';
  instrumentId: string;
  providerSymbol: string;
  displayName: string;
  marketCategory: 'crypto' | 'forex' | 'metals' | 'indices';
  timeframe: TimeframeId;
  startTimestamp: number; // UTC Unix ms
  endTimestamp: number;   // UTC Unix ms
  cursor: number;         // Current replay simulation position in UTC Unix ms
  speed: ReplaySpeed;
  status: ReplayState;
  skippedGaps: Array<{ start: number; end: number; missingMinutes: number }>;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface ReplayDataGap {
  start: number;
  end: number;
  missingMinutes: number;
}

export interface ReplayDataProvenance {
  sources: string[];
  resolution: '1m' | '5m' | '1h';
  isCanonicalM1: boolean;
  notes: string[];
  candleCount: number;
}

export interface ReplayEventListenerMap {
  stateChange: (state: ReplayState) => void;
  candleUpdate: (candle: ReplayCandleData, isNewBar: boolean) => void;
  cursorChange: (cursor: number, progressPct: number) => void;
  gapDetected: (gap: ReplayDataGap) => void;
  error: (errorMessage: string) => void;
  speedChange: (speed: ReplaySpeed) => void;
  timeframeChange: (timeframe: TimeframeId) => void;
  m1Candle: (m1: ApiCandle) => void;
  provenanceUpdate: (provenance: ReplayDataProvenance) => void;
}

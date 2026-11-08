import { CONFIG } from '../config/index.js';
import { TimeframeId } from '../types/marketData.js';

export interface ValidatedCandlesQuery {
  instrumentId: string;
  timeframe: TimeframeId;
  fromTimestamp: number;
  toTimestamp: number;
  limit: number;
}

export class RequestValidator {
  public static readonly ALLOWED_TIMEFRAMES: Set<TimeframeId> = new Set([
    'M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1',
  ]);

  public static validateCandlesQuery(query: Record<string, unknown>): {
    success: boolean;
    data?: ValidatedCandlesQuery;
    error?: string;
  } {
    const { instrument, timeframe, from, to, limit } = query;

    // 1. Validate instrument
    if (!instrument || typeof instrument !== 'string') {
      return { success: false, error: 'Query parameter "instrument" is required (e.g. BINANCE:BTCUSDT).' };
    }
    const cleanInstrument = instrument.trim().toUpperCase();
    if (!cleanInstrument.includes(':') || cleanInstrument.length > 50) {
      return { success: false, error: 'Invalid instrument format. Expected "PROVIDER:SYMBOL".' };
    }

    // 2. Validate timeframe
    const tf = (timeframe ? String(timeframe).toUpperCase() : 'M15') as TimeframeId;
    if (!this.ALLOWED_TIMEFRAMES.has(tf)) {
      return {
        success: false,
        error: `Invalid timeframe "${tf}". Supported: ${Array.from(this.ALLOWED_TIMEFRAMES).join(', ')}.`,
      };
    }

    // 3. Validate from and to timestamps
    let fromTs = from ? Number(from) : NaN;
    let toTs = to ? Number(to) : NaN;

    if (isNaN(fromTs) || fromTs <= 0) {
      return { success: false, error: 'Query parameter "from" must be a valid positive UTC Unix timestamp (ms).' };
    }
    if (isNaN(toTs) || toTs <= 0) {
      toTs = Date.now();
    }

    if (fromTs > toTs) {
      return { success: false, error: '"from" timestamp cannot be greater than "to" timestamp.' };
    }

    // Bounded range check
    const maxRangeMs = CONFIG.API_PROTECTION.MAX_QUERY_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (toTs - fromTs > maxRangeMs) {
      return {
        success: false,
        error: `Requested range exceeds maximum allowed limit of ${CONFIG.API_PROTECTION.MAX_QUERY_RANGE_DAYS} days.`,
      };
    }

    // 4. Validate limit
    let parsedLimit = limit ? Number(limit) : CONFIG.API_PROTECTION.DEFAULT_CANDLES_LIMIT;
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      parsedLimit = CONFIG.API_PROTECTION.DEFAULT_CANDLES_LIMIT;
    }
    if (parsedLimit > CONFIG.API_PROTECTION.MAX_CANDLES_PER_RESPONSE) {
      parsedLimit = CONFIG.API_PROTECTION.MAX_CANDLES_PER_RESPONSE;
    }

    return {
      success: true,
      data: {
        instrumentId: cleanInstrument,
        timeframe: tf,
        fromTimestamp: Math.floor(fromTs),
        toTimestamp: Math.floor(toTs),
        limit: Math.floor(parsedLimit),
      },
    };
  }
}

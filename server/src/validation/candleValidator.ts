import { CanonicalCandle } from '../types/marketData.js';

export interface CandleValidationResult {
  isValid: boolean;
  reason?: string;
}

export class CandleValidator {
  private static readonly M1_MS = 60 * 1000;

  /**
   * Validates a single canonical M1 candle against all market integrity rules.
   */
  public static validateM1Candle(candle: CanonicalCandle): CandleValidationResult {
    // 1. Timestamp checks
    if (typeof candle.timestamp !== 'number' || !Number.isInteger(candle.timestamp) || candle.timestamp <= 0) {
      return { isValid: false, reason: `Invalid timestamp: ${candle.timestamp}` };
    }

    // Must be aligned to M1 interval (60,000 ms)
    if (candle.timestamp % this.M1_MS !== 0) {
      return { isValid: false, reason: `Timestamp not aligned to 60s M1 boundary: ${candle.timestamp}` };
    }

    // Must not be in the distant future (grace period of 2 hours for clock skew)
    const maxFutureTime = Date.now() + 2 * 60 * 60 * 1000;
    if (candle.timestamp > maxFutureTime) {
      return { isValid: false, reason: `Timestamp is in the future: ${candle.timestamp}` };
    }

    // 2. Finite price checks
    if (!Number.isFinite(candle.open) || !Number.isFinite(candle.high) ||
        !Number.isFinite(candle.low) || !Number.isFinite(candle.close)) {
      return { isValid: false, reason: 'OHLC prices must be finite numbers' };
    }

    // 3. Positive price checks
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0) {
      return { isValid: false, reason: 'OHLC prices must be strictly positive' };
    }

    // 4. Mathematical integrity: High >= Open, High >= Close, High >= Low
    if (candle.high < candle.open) {
      return { isValid: false, reason: `High (${candle.high}) is less than Open (${candle.open})` };
    }
    if (candle.high < candle.close) {
      return { isValid: false, reason: `High (${candle.high}) is less than Close (${candle.close})` };
    }
    if (candle.high < candle.low) {
      return { isValid: false, reason: `High (${candle.high}) is less than Low (${candle.low})` };
    }

    // 5. Mathematical integrity: Low <= Open, Low <= Close
    if (candle.low > candle.open) {
      return { isValid: false, reason: `Low (${candle.low}) is greater than Open (${candle.open})` };
    }
    if (candle.low > candle.close) {
      return { isValid: false, reason: `Low (${candle.low}) is greater than Close (${candle.close})` };
    }

    // 6. Volume checks (when supplied)
    if (candle.volume !== null && candle.volume !== undefined) {
      if (!Number.isFinite(candle.volume) || candle.volume < 0) {
        return { isValid: false, reason: `Volume must be a non-negative finite number: ${candle.volume}` };
      }
    }

    // 7. Identity checks
    if (!candle.provider || !candle.instrumentId || !candle.priceBasis) {
      return { isValid: false, reason: 'Candle missing required identity fields (provider, instrumentId, priceBasis)' };
    }

    return { isValid: true };
  }

  /**
   * Validates a batch of candles, filtering out corrupted/invalid ones and detecting duplicates.
   */
  public static validateBatch(candles: CanonicalCandle[]): {
    validCandles: CanonicalCandle[];
    rejectedCount: number;
    rejectionReasons: string[];
  } {
    const validCandles: CanonicalCandle[] = [];
    const seenTimestamps = new Set<number>();
    const rejectionReasons: string[] = [];
    let rejectedCount = 0;

    for (const c of candles) {
      // Duplicate detection within the batch
      if (seenTimestamps.has(c.timestamp)) {
        rejectedCount++;
        rejectionReasons.push(`Duplicate timestamp in batch: ${c.timestamp}`);
        continue;
      }

      const val = this.validateM1Candle(c);
      if (!val.isValid) {
        rejectedCount++;
        rejectionReasons.push(`Record at ${c.timestamp} rejected: ${val.reason}`);
        continue;
      }

      seenTimestamps.add(c.timestamp);
      validCandles.push(c);
    }

    // Ensure sorted chronologically
    validCandles.sort((a, b) => a.timestamp - b.timestamp);

    return {
      validCandles,
      rejectedCount,
      rejectionReasons,
    };
  }
}

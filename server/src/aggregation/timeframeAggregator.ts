import { AggregatedCandle, CanonicalCandle, TimeframeId } from '../types/marketData.js';

export class TimeframeAggregator {
  public static readonly TIMEFRAME_MINUTES: Record<TimeframeId, number> = {
    M1: 1,
    M5: 5,
    M15: 15,
    M30: 30,
    H1: 60,
    H4: 240,
    D1: 1440,
  };

  /**
   * Aligns a timestamp down to the nearest UTC timeframe boundary.
   */
  public static alignToBoundary(timestamp: number, timeframe: TimeframeId): number {
    const minutes = this.TIMEFRAME_MINUTES[timeframe];
    const ms = minutes * 60 * 1000;

    if (timeframe === 'D1') {
      // Align to UTC 00:00:00
      const d = new Date(timestamp);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
    }

    return Math.floor(timestamp / ms) * ms;
  }

  /**
   * Aggregates a series of M1 candles into the requested timeframe.
   */
  public static aggregate(m1Candles: CanonicalCandle[], timeframe: TimeframeId): AggregatedCandle[] {
    if (m1Candles.length === 0) return [];
    if (timeframe === 'M1') {
      return m1Candles.map((c) => ({
        ...c,
        timeframe: 'M1',
        m1CandleCount: 1,
        isIncomplete: false,
      }));
    }

    const expectedCount = this.TIMEFRAME_MINUTES[timeframe];
    const buckets = new Map<number, CanonicalCandle[]>();

    for (const c of m1Candles) {
      const boundary = this.alignToBoundary(c.timestamp, timeframe);
      let list = buckets.get(boundary);
      if (!list) {
        list = [];
        buckets.set(boundary, list);
      }
      list.push(c);
    }

    const result: AggregatedCandle[] = [];
    const sortedBoundaries = Array.from(buckets.keys()).sort((a, b) => a - b);

    for (const boundary of sortedBoundaries) {
      const candlesInBucket = buckets.get(boundary)!;
      // Sort in bucket by timestamp
      candlesInBucket.sort((a, b) => a.timestamp - b.timestamp);

      const first = candlesInBucket[0];
      const last = candlesInBucket[candlesInBucket.length - 1];

      let maxHigh = -Infinity;
      let minLow = Infinity;
      let totalVolume: number | null = null;
      let hasVolume = false;

      for (const c of candlesInBucket) {
        if (c.high > maxHigh) maxHigh = c.high;
        if (c.low < minLow) minLow = c.low;
        if (c.volume !== null && c.volume !== undefined) {
          totalVolume = (totalVolume ?? 0) + c.volume;
          hasVolume = true;
        }
      }

      result.push({
        provider: first.provider,
        instrumentId: first.instrumentId,
        timestamp: boundary,
        open: first.open,
        high: maxHigh,
        low: minLow,
        close: last.close,
        volume: hasVolume ? totalVolume : null,
        volumeDefinition: first.volumeDefinition,
        priceBasis: first.priceBasis,
        sourceInterval: '1m',
        timeframe,
        m1CandleCount: candlesInBucket.length,
        isIncomplete: candlesInBucket.length < expectedCount,
        ingestedAt: first.ingestedAt,
      });
    }

    return result;
  }
}

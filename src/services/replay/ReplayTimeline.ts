import { ApiCandle, fetchHistoricalRangeM1 } from '../marketDataApi';
import { ReplayGapHandler } from './ReplayGapHandler';
import { ReplayDataGap, ReplayDataProvenance } from './types';

export class ReplayTimeline {
  private instrumentId: string;
  private startTimestamp: number;
  private endTimestamp: number;
  private cursor: number;
  private m1Candles: ApiCandle[] = [];
  private isFullyLoaded: boolean = false;
  private isLoading: boolean = false;
  private provenance: ReplayDataProvenance | null = null;

  constructor(instrumentId: string, startTimestamp: number, endTimestamp: number, initialCursor?: number) {
    this.instrumentId = instrumentId;
    this.startTimestamp = startTimestamp;
    this.endTimestamp = endTimestamp;
    this.cursor = initialCursor ?? startTimestamp;
  }

  public getProvenance(): ReplayDataProvenance | null {
    return this.provenance;
  }

  public getInstrumentId(): string {
    return this.instrumentId;
  }

  public getStartTimestamp(): number {
    return this.startTimestamp;
  }

  public getEndTimestamp(): number {
    return this.endTimestamp;
  }

  public getCursor(): number {
    return this.cursor;
  }

  public setCursor(newCursor: number): void {
    this.cursor = Math.max(this.startTimestamp, Math.min(newCursor, this.endTimestamp));
  }

  public getCandleCount(): number {
    return this.m1Candles.length;
  }

  public getCandleTimestampAt(index: number): number | null {
    if (this.m1Candles.length === 0) return null;
    const clamped = Math.max(0, Math.min(index, this.m1Candles.length - 1));
    return this.m1Candles[clamped].timestamp;
  }

  public getIsFullyLoaded(): boolean {
    return this.isFullyLoaded;
  }

  public isAtEnd(): boolean {
    if (this.m1Candles.length === 0) return true;
    const lastCandle = this.m1Candles[this.m1Candles.length - 1];
    return this.cursor >= lastCandle.timestamp || this.cursor >= this.endTimestamp;
  }

  public getProgressPct(): number {
    const totalRange = this.endTimestamp - this.startTimestamp;
    if (totalRange <= 0) return 100;
    const elapsed = this.cursor - this.startTimestamp;
    return Math.min(100, Math.max(0, Math.round((elapsed / totalRange) * 1000) / 10));
  }

  /**
   * Loads all genuine historical candles in [fromTimestamp, toTimestamp] day-by-day using persistent cache.
   */
  public async loadRange(fromTimestamp?: number, toTimestamp?: number): Promise<number> {
    if (this.isLoading) return 0;
    this.isLoading = true;

    const from = fromTimestamp ?? this.startTimestamp;
    const to = toTimestamp ?? this.endTimestamp;

    try {
      const rangeRes = await fetchHistoricalRangeM1(this.instrumentId, from, to);

      const map = new Map<number, ApiCandle>();
      for (const c of this.m1Candles) {
        map.set(c.timestamp, c);
      }
      for (const c of rangeRes.candles) {
        map.set(c.timestamp, c);
      }

      this.m1Candles = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
      this.provenance = {
        sources: rangeRes.sources,
        resolution: rangeRes.resolution,
        isCanonicalM1: rangeRes.isCanonicalM1,
        notes: rangeRes.notes,
        candleCount: this.m1Candles.length,
      };
      this.isFullyLoaded = true;
      return this.m1Candles.length;
    } finally {
      this.isLoading = false;
    }
  }

  public hasCandlesInPlaybackWindow(): boolean {
    return this.m1Candles.some((c) => c.timestamp >= this.startTimestamp && c.timestamp <= this.endTimestamp);
  }

  /**
   * Initializes buffer with existing M1 candles (e.g. from context).
   */
  public setInitialCandles(candles: ApiCandle[]): void {
    const map = new Map<number, ApiCandle>();
    for (const c of candles) {
      map.set(c.timestamp, c);
    }
    this.m1Candles = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Checks if the next upcoming candle has a gap relative to the current cursor.
   */
  public peekGap(): { nextCandle: ApiCandle; gap: ReplayDataGap | null } | null {
    const nextCandle = this.peekNextCandle();
    if (!nextCandle) return null;

    const gap = ReplayGapHandler.checkGap(this.cursor, nextCandle.timestamp);
    return { nextCandle, gap };
  }

  /**
   * Returns the next M1 candle strictly > cursor without modifying state.
   */
  public peekNextCandle(): ApiCandle | null {
    for (const c of this.m1Candles) {
      if (c.timestamp > this.cursor && c.timestamp <= this.endTimestamp) {
        return c;
      }
    }
    return null;
  }

  /**
   * Returns the canonical historical M1 candle at or immediately before current cursor.
   * STRICT ZERO FUTURE DATA LEAKAGE: Candles with timestamp > cursor are never returned.
   */
  public getCurrentCandle(): ApiCandle | null {
    for (let i = this.m1Candles.length - 1; i >= 0; i--) {
      if (this.m1Candles[i].timestamp <= this.cursor) {
        return this.m1Candles[i];
      }
    }
    return null;
  }

  /**
   * Advances the cursor forward to the very next M1 candle.
   * Returns the newly revealed M1 candle.
   */
  public advanceNext(): ApiCandle | null {
    const nextCandle = this.peekNextCandle();
    if (!nextCandle) return null;

    this.cursor = nextCandle.timestamp;
    return nextCandle;
  }

  /**
   * Steps the cursor backwards to the previous M1 candle.
   * Returns the previous cursor position.
   */
  public stepBackward(): number | null {
    let prevCandle: ApiCandle | null = null;
    for (let i = this.m1Candles.length - 1; i >= 0; i--) {
      const c = this.m1Candles[i];
      if (c.timestamp < this.cursor && c.timestamp >= this.startTimestamp) {
        prevCandle = c;
        break;
      }
    }

    if (!prevCandle) {
      // If we are at the first candle or before, reset to startTimestamp
      if (this.cursor !== this.startTimestamp) {
        this.cursor = this.startTimestamp;
        return this.cursor;
      }
      return null;
    }

    this.cursor = prevCandle.timestamp;
    return this.cursor;
  }

  /**
   * Strictly returns all M1 candles loaded with timestamp <= cursor.
   * ZERO FUTURE DATA LEAKAGE: Candles with timestamp > cursor are never returned.
   */
  public getRevealedCandles(): ApiCandle[] {
    return this.m1Candles.filter((c) => c.timestamp <= this.cursor);
  }

  /**
   * Returns all M1 candles in buffer up to an arbitrary timestamp <= cursor.
   */
  public getCandlesUpTo(timestamp: number): ApiCandle[] {
    const bound = Math.min(timestamp, this.cursor);
    return this.m1Candles.filter((c) => c.timestamp <= bound);
  }

  /**
   * Directly jumps cursor to a target timestamp within permitted bounds.
   */
  public seekTo(targetTimestampMs: number): void {
    const bounded = Math.max(this.startTimestamp, Math.min(targetTimestampMs, this.endTimestamp));
    // Find nearest M1 candle <= bounded
    let closestTs = this.startTimestamp;
    for (const c of this.m1Candles) {
      if (c.timestamp <= bounded) {
        closestTs = c.timestamp;
      } else {
        break;
      }
    }
    this.cursor = closestTs;
  }
}

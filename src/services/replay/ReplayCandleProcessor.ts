import { ReplayCandleData, TimeframeId } from './types';
import { ApiCandle } from '../marketDataApi';

export class ReplayCandleProcessor {
  private static readonly TIMEFRAME_MINUTES: Record<TimeframeId, number> = {
    M1: 1,
    M5: 5,
    M15: 15,
    M30: 30,
    H1: 60,
    H4: 240,
    D1: 1440,
  };

  /**
   * Aligns UTC millisecond timestamp down to the nearest UTC timeframe boundary.
   */
  public static alignToBoundaryMs(timestampMs: number, timeframe: TimeframeId): number {
    const minutes = this.TIMEFRAME_MINUTES[timeframe];
    const ms = minutes * 60 * 1000;

    if (timeframe === 'D1') {
      const d = new Date(timestampMs);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
    }

    return Math.floor(timestampMs / ms) * ms;
  }

  /**
   * Incrementally processes a single newly revealed M1 candle into the current chart candle series.
   * STRICT NO-FUTURE-LEAKAGE:
   * Only the current M1 candle and prior M1 candles are used!
   */
  public static processIncrementalM1(
    m1Candle: ApiCandle,
    timeframe: TimeframeId,
    currentBars: ReplayCandleData[]
  ): {
    updatedBars: ReplayCandleData[];
    activeBar: ReplayCandleData;
    isNewBar: boolean;
  } {
    const barBoundaryMs = this.alignToBoundaryMs(m1Candle.timestamp, timeframe);
    const barTimeSec = Math.floor(barBoundaryMs / 1000);

    const bars = [...currentBars];
    const lastBar = bars.length > 0 ? bars[bars.length - 1] : null;

    if (!lastBar || lastBar.time !== barTimeSec) {
      // New higher-timeframe bar begins with this M1's values
      const newBar: ReplayCandleData = {
        time: barTimeSec,
        open: m1Candle.open,
        high: m1Candle.high,
        low: m1Candle.low,
        close: m1Candle.close,
        volume: m1Candle.volume,
      };
      bars.push(newBar);
      return { updatedBars: bars, activeBar: newBar, isNewBar: true };
    }

    // Ongoing higher-timeframe bar updates incrementally:
    // High is max of seen so far, Low is min of seen so far, Close is current M1 close!
    const updatedBar: ReplayCandleData = {
      ...lastBar,
      high: Math.max(lastBar.high, m1Candle.high),
      low: Math.min(lastBar.low, m1Candle.low),
      close: m1Candle.close,
      volume: (lastBar.volume ?? 0) + (m1Candle.volume ?? 0),
    };

    bars[bars.length - 1] = updatedBar;
    return { updatedBars: bars, activeBar: updatedBar, isNewBar: false };
  }

  /**
   * Completely reconstructs chart bars strictly from all M1 candles up to the cursor (used during init and Previous Step).
   * ZERO FUTURE LEAKAGE GUARANTEE: Any M1 with timestamp > cursor is filtered out before aggregation!
   */
  public static reconstructBarsUpToCursor(
    m1Candles: ApiCandle[],
    timeframe: TimeframeId,
    cursorMs: number
  ): ReplayCandleData[] {
    const validM1s = m1Candles.filter((c) => c.timestamp <= cursorMs);
    validM1s.sort((a, b) => a.timestamp - b.timestamp);

    let bars: ReplayCandleData[] = [];
    for (const m1 of validM1s) {
      const res = this.processIncrementalM1(m1, timeframe, bars);
      bars = res.updatedBars;
    }

    return bars;
  }
}

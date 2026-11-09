import { ReplayDataGap } from './types';

export class ReplayGapHandler {
  private static readonly M1_MS = 60 * 1000;

  /**
   * Checks if there is a genuine historical gap between current cursor and next candle timestamp.
   */
  public static checkGap(currentCursor: number, nextCandleTimestamp: number): ReplayDataGap | null {
    const diff = nextCandleTimestamp - currentCursor;

    // Normal progression is exactly 60,000 ms (1 minute)
    if (diff > this.M1_MS) {
      const missingMinutes = Math.floor((diff - this.M1_MS) / this.M1_MS);
      return {
        start: currentCursor + this.M1_MS,
        end: nextCandleTimestamp - this.M1_MS,
        missingMinutes,
      };
    }

    return null;
  }
}

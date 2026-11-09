import { NormalizedTrade, RiskRewardMetrics } from './AnalyticsTypes';

export class RiskRewardCalculator {
  /**
   * Calculates realized R-Multiples for trades where an initial Stop Loss (and therefore initial risk R)
   * was explicitly defined on order entry.
   */
  public static calculate(trades: NormalizedTrade[]): RiskRewardMetrics {
    const tradesWithRisk = trades.filter((t) => t.initialRisk !== undefined && t.initialRisk > 0 && t.rMultiple !== undefined);

    if (tradesWithRisk.length === 0) {
      return {
        tradesWithDefinedRiskCount: 0,
        averageInitialRisk: null,
        averageRMultiple: null,
        largestRMultiple: null,
        lowestRMultiple: null,
      };
    }

    let totalRisk = 0;
    let totalR = 0;
    let largestR: number | null = null;
    let lowestR: number | null = null;

    for (const t of tradesWithRisk) {
      const risk = t.initialRisk!;
      const r = t.rMultiple!;

      totalRisk += risk;
      totalR += r;

      if (largestR === null || r > largestR) largestR = r;
      if (lowestR === null || r < lowestR) lowestR = r;
    }

    const count = tradesWithRisk.length;
    return {
      tradesWithDefinedRiskCount: count,
      averageInitialRisk: totalRisk / count,
      averageRMultiple: totalR / count,
      largestRMultiple: largestR,
      lowestRMultiple: lowestR,
    };
  }
}

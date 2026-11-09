import { NormalizedTrade } from './AnalyticsTypes';

export const MONETARY_EPSILON = 1e-6;

export class PerformanceMetricsCalculator {
  /**
   * Calculates all primary performance metrics from normalized closed trades.
   * Deterministic, zero NaN/Infinity edge case bugs, full edge-case coverage.
   */
  public static calculate(
    trades: NormalizedTrade[],
    initialBalance: number,
    currentBalance: number,
    currentEquity: number
  ) {
    const totalClosedTrades = trades.length;

    if (totalClosedTrades === 0) {
      return {
        initialBalance,
        currentBalance,
        currentEquity,
        netPnL: 0,
        grossProfit: 0,
        grossLoss: 0,
        totalClosedTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakevenTrades: 0,
        winRate: null,
        winRateExcludingBreakeven: null,
        lossRate: null,
        breakevenRate: null,
        profitFactor: null,
        expectancy: null,
        averageWin: null,
        averageLoss: null,
        largestWin: null,
        largestLoss: null,
        winLossRatio: null,
        averageHoldingDurationMs: null,
        averageWinnerDurationMs: null,
        averageLoserDurationMs: null,
      };
    }

    let netPnL = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let breakevenTrades = 0;

    let largestWin: number | null = null;
    let largestLoss: number | null = null;

    let totalDurationMs = 0;
    let winningDurationMs = 0;
    let losingDurationMs = 0;

    for (const trade of trades) {
      const pnl = trade.pnl;
      netPnL += pnl;
      totalDurationMs += trade.durationMs;

      if (pnl > MONETARY_EPSILON) {
        winningTrades++;
        grossProfit += pnl;
        winningDurationMs += trade.durationMs;
        if (largestWin === null || pnl > largestWin) {
          largestWin = pnl;
        }
      } else if (pnl < -MONETARY_EPSILON) {
        losingTrades++;
        const absLoss = Math.abs(pnl);
        grossLoss += absLoss;
        losingDurationMs += trade.durationMs;
        if (largestLoss === null || pnl < largestLoss) {
          largestLoss = pnl;
        }
      } else {
        breakevenTrades++;
      }
    }

    // Win rate formulas
    const winRate = (winningTrades / totalClosedTrades) * 100;
    const lossRate = (losingTrades / totalClosedTrades) * 100;
    const breakevenRate = (breakevenTrades / totalClosedTrades) * 100;

    const nonBreakevenCount = winningTrades + losingTrades;
    const winRateExcludingBreakeven =
      nonBreakevenCount > 0 ? (winningTrades / nonBreakevenCount) * 100 : null;

    // Profit Factor handling
    let profitFactor: number | null = null;
    if (grossLoss === 0) {
      if (grossProfit > 0) {
        profitFactor = Infinity; // Infinite: profit with zero loss
      } else {
        profitFactor = null; // Undefined: 0 profit and 0 loss
      }
    } else {
      profitFactor = grossProfit / grossLoss;
    }

    // Expectancy
    const expectancy = netPnL / totalClosedTrades;

    // Averages
    const averageWin = winningTrades > 0 ? grossProfit / winningTrades : null;
    const averageLoss = losingTrades > 0 ? grossLoss / losingTrades : null;

    const winLossRatio =
      averageWin !== null && averageLoss !== null && averageLoss > 0
        ? averageWin / averageLoss
        : null;

    // Durations
    const averageHoldingDurationMs = totalDurationMs / totalClosedTrades;
    const averageWinnerDurationMs =
      winningTrades > 0 ? winningDurationMs / winningTrades : null;
    const averageLoserDurationMs =
      losingTrades > 0 ? losingDurationMs / losingTrades : null;

    return {
      initialBalance,
      currentBalance,
      currentEquity,
      netPnL,
      grossProfit,
      grossLoss,
      totalClosedTrades,
      winningTrades,
      losingTrades,
      breakevenTrades,
      winRate,
      winRateExcludingBreakeven,
      lossRate,
      breakevenRate,
      profitFactor,
      expectancy,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      winLossRatio,
      averageHoldingDurationMs,
      averageWinnerDurationMs,
      averageLoserDurationMs,
    };
  }
}

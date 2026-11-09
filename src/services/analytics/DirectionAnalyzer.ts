import { DirectionMetrics, NormalizedTrade } from './AnalyticsTypes';
import { MONETARY_EPSILON } from './PerformanceMetricsCalculator';

export class DirectionAnalyzer {
  /**
   * Evaluates performance separated cleanly by trade direction (Long vs Short).
   */
  public static analyze(trades: NormalizedTrade[]): {
    longAnalysis: DirectionMetrics;
    shortAnalysis: DirectionMetrics;
  } {
    const longTrades = trades.filter((t) => t.direction === 'BUY');
    const shortTrades = trades.filter((t) => t.direction === 'SELL');

    return {
      longAnalysis: this.calculateForDirection('BUY', longTrades),
      shortAnalysis: this.calculateForDirection('SELL', shortTrades),
    };
  }

  private static calculateForDirection(
    direction: 'BUY' | 'SELL',
    trades: NormalizedTrade[]
  ): DirectionMetrics {
    const tradeCount = trades.length;

    if (tradeCount === 0) {
      return {
        direction,
        tradeCount: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakevenTrades: 0,
        winRate: null,
        netPnL: 0,
        grossProfit: 0,
        grossLoss: 0,
        profitFactor: null,
        averagePnL: null,
      };
    }

    let netPnL = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let breakevenTrades = 0;

    for (const t of trades) {
      netPnL += t.pnl;
      if (t.pnl > MONETARY_EPSILON) {
        winningTrades++;
        grossProfit += t.pnl;
      } else if (t.pnl < -MONETARY_EPSILON) {
        losingTrades++;
        grossLoss += Math.abs(t.pnl);
      } else {
        breakevenTrades++;
      }
    }

    const winRate = (winningTrades / tradeCount) * 100;
    let profitFactor: number | null = null;
    if (grossLoss === 0) {
      profitFactor = grossProfit > 0 ? Infinity : null;
    } else {
      profitFactor = grossProfit / grossLoss;
    }

    const averagePnL = netPnL / tradeCount;

    return {
      direction,
      tradeCount,
      winningTrades,
      losingTrades,
      breakevenTrades,
      winRate,
      netPnL,
      grossProfit,
      grossLoss,
      profitFactor,
      averagePnL,
    };
  }
}

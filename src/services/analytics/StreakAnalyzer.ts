import { NormalizedTrade, StreakMetrics } from './AnalyticsTypes';
import { MONETARY_EPSILON } from './PerformanceMetricsCalculator';

export class StreakAnalyzer {
  /**
   * Analyzes winning and losing streaks across chronologically ordered closed trades.
   *
   * Streak Policy:
   * - Win: pnl > MONETARY_EPSILON
   * - Loss: pnl < -MONETARY_EPSILON
   * - Breakeven: |pnl| <= MONETARY_EPSILON. A breakeven trade is NEITHER a win nor a loss,
   *   and strictly terminates the active winning or losing streak.
   */
  public static analyze(trades: NormalizedTrade[]): StreakMetrics {
    if (trades.length === 0) {
      return {
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        currentStreakType: 'NONE',
        currentStreakCount: 0,
      };
    }

    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;

    let currentWinStreak = 0;
    let currentLossStreak = 0;

    let activeType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
    let activeCount = 0;

    for (const trade of trades) {
      const pnl = trade.pnl;

      if (pnl > MONETARY_EPSILON) {
        // Winning trade
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > maxConsecutiveWins) {
          maxConsecutiveWins = currentWinStreak;
        }

        if (activeType === 'WIN') {
          activeCount++;
        } else {
          activeType = 'WIN';
          activeCount = 1;
        }
      } else if (pnl < -MONETARY_EPSILON) {
        // Losing trade
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxConsecutiveLosses) {
          maxConsecutiveLosses = currentLossStreak;
        }

        if (activeType === 'LOSS') {
          activeCount++;
        } else {
          activeType = 'LOSS';
          activeCount = 1;
        }
      } else {
        // Breakeven trade resets active streaks
        currentWinStreak = 0;
        currentLossStreak = 0;
        activeType = 'NONE';
        activeCount = 0;
      }
    }

    return {
      maxConsecutiveWins,
      maxConsecutiveLosses,
      currentStreakType: activeType,
      currentStreakCount: activeCount,
    };
  }
}

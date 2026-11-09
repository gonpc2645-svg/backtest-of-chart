import { NormalizedTrade, PeriodicPerformanceRecord } from './AnalyticsTypes';
import { MONETARY_EPSILON } from './PerformanceMetricsCalculator';

export class PerformancePeriodAnalyzer {
  /**
   * Groups closed trades chronologically into Daily, Weekly, and Monthly performance periods.
   */
  public static analyze(trades: NormalizedTrade[]): {
    dailyPerformance: PeriodicPerformanceRecord[];
    weeklyPerformance: PeriodicPerformanceRecord[];
    monthlyPerformance: PeriodicPerformanceRecord[];
  } {
    const dailyMap = new Map<string, NormalizedTrade[]>();
    const weeklyMap = new Map<string, NormalizedTrade[]>();
    const monthlyMap = new Map<string, NormalizedTrade[]>();

    for (const trade of trades) {
      const d = new Date(trade.exitTime);

      // 1. Daily key (UTC): YYYY-MM-DD
      const dayKey = d.toISOString().slice(0, 10);
      if (!dailyMap.has(dayKey)) dailyMap.set(dayKey, []);
      dailyMap.get(dayKey)!.push(trade);

      // 2. Weekly key (UTC): YYYY-Www
      const weekKey = this.getUtcWeekKey(d);
      if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, []);
      weeklyMap.get(weekKey)!.push(trade);

      // 3. Monthly key (UTC): YYYY-MM
      const monthKey = d.toISOString().slice(0, 7);
      if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, []);
      monthlyMap.get(monthKey)!.push(trade);
    }

    return {
      dailyPerformance: this.mapToRecords(dailyMap, 'Day'),
      weeklyPerformance: this.mapToRecords(weeklyMap, 'Week'),
      monthlyPerformance: this.mapToRecords(monthlyMap, 'Month'),
    };
  }

  private static mapToRecords(
    map: Map<string, NormalizedTrade[]>,
    type: 'Day' | 'Week' | 'Month'
  ): PeriodicPerformanceRecord[] {
    const keys = Array.from(map.keys()).sort();
    return keys.map((key) => {
      const periodTrades = map.get(key)!;
      let netPnL = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      let winCount = 0;
      let lossCount = 0;
      let breakevenCount = 0;

      for (const t of periodTrades) {
        netPnL += t.pnl;
        if (t.pnl > MONETARY_EPSILON) {
          winCount++;
          grossProfit += t.pnl;
        } else if (t.pnl < -MONETARY_EPSILON) {
          lossCount++;
          grossLoss += Math.abs(t.pnl);
        } else {
          breakevenCount++;
        }
      }

      const total = periodTrades.length;
      const winRate = total > 0 ? (winCount / total) * 100 : null;

      let periodLabel = key;
      if (type === 'Day') {
        periodLabel = key; // YYYY-MM-DD
      } else if (type === 'Month') {
        const [year, month] = key.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        periodLabel = `${monthNames[parseInt(month, 10) - 1]} ${year}`;
      } else if (type === 'Week') {
        periodLabel = `Week ${key}`;
      }

      return {
        periodKey: key,
        periodLabel,
        tradeCount: total,
        netPnL,
        grossProfit,
        grossLoss,
        winCount,
        lossCount,
        breakevenCount,
        winRate,
      };
    });
  }

  private static getUtcWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
}

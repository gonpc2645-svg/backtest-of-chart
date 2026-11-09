import { DistributionBin, NormalizedTrade } from './AnalyticsTypes';

export class TradeDistributionAnalyzer {
  /**
   * Generates a distribution histogram of realized trade P/L results.
   */
  public static analyze(trades: NormalizedTrade[]): DistributionBin[] {
    if (trades.length === 0) return [];

    const pnls = trades.map((t) => t.pnl);
    const min = Math.min(...pnls);
    const max = Math.max(...pnls);

    // If all trades have exactly the same P/L
    if (Math.abs(max - min) < 0.01) {
      return [
        {
          binLabel: `$${min.toFixed(2)}`,
          minPnL: min,
          maxPnL: max,
          count: trades.length,
          percentage: 100,
        },
      ];
    }

    // Determine 6 sensible intervals
    const binCount = 6;
    const step = (max - min) / binCount;
    const bins: DistributionBin[] = [];

    for (let i = 0; i < binCount; i++) {
      const bMin = min + i * step;
      const bMax = i === binCount - 1 ? max : min + (i + 1) * step;

      const formatNum = (n: number) => (n >= 0 ? `+$${n.toFixed(0)}` : `-$${Math.abs(n).toFixed(0)}`);
      const binLabel = `${formatNum(bMin)} to ${formatNum(bMax)}`;

      bins.push({
        binLabel,
        minPnL: bMin,
        maxPnL: bMax,
        count: 0,
        percentage: 0,
      });
    }

    for (const pnl of pnls) {
      let placed = false;
      for (let i = 0; i < bins.length; i++) {
        const bin = bins[i];
        if (i === bins.length - 1) {
          if (pnl >= bin.minPnL && pnl <= bin.maxPnL + 0.0001) {
            bin.count++;
            placed = true;
            break;
          }
        } else {
          if (pnl >= bin.minPnL && pnl < bin.maxPnL) {
            bin.count++;
            placed = true;
            break;
          }
        }
      }
      if (!placed && bins.length > 0) {
        bins[bins.length - 1].count++;
      }
    }

    const total = trades.length;
    for (const b of bins) {
      b.percentage = total > 0 ? (b.count / total) * 100 : 0;
    }

    return bins;
  }
}

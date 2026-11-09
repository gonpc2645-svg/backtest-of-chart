import { TradingEvent } from '../trading/TradingTypes';
import { BalanceCurvePoint, DrawdownAnalysis, DrawdownPoint, NormalizedTrade } from './AnalyticsTypes';

export class EquityDrawdownProcessor {
  /**
   * Generates Balance Curve, Drawdown series, and calculates peak-to-trough Drawdown metrics.
   */
  public static process(
    trades: NormalizedTrade[],
    initialBalance: number,
    sessionStartMs: number,
    _tradingEvents?: TradingEvent[],
    currentReplayCursor?: number,
    currentEquity?: number
  ): {
    balanceCurve: BalanceCurvePoint[];
    drawdownAnalysis: DrawdownAnalysis;
  } {
    const balanceCurve: BalanceCurvePoint[] = [];
    const drawdownCurve: DrawdownPoint[] = [];

    // 1. Initial Point
    const startTs = trades.length > 0 && trades[0].entryTime < sessionStartMs
      ? trades[0].entryTime
      : sessionStartMs;

    balanceCurve.push({
      timestamp: startTs,
      balance: initialBalance,
      equity: initialBalance,
      description: 'Initial Deposit',
    });

    drawdownCurve.push({
      timestamp: startTs,
      drawdownAmount: 0,
      drawdownPct: 0,
      peakBalance: initialBalance,
      currentBalance: initialBalance,
    });

    let runningBalance = initialBalance;
    let peakBalance = initialBalance;
    let peakTime = startTs;

    let maxDrawdownAmount = 0;
    let maxDrawdownPct = 0;
    let maxDdPeakTime: number | null = null;
    let maxDdTroughTime: number | null = null;
    let maxDdPeakValue = initialBalance;

    // 2. Iterate through chronological trades
    for (const trade of trades) {
      runningBalance += trade.pnl;
      const ts = trade.exitTime;

      balanceCurve.push({
        timestamp: ts,
        balance: runningBalance,
        pnl: trade.pnl,
        tradeId: trade.id,
        description: `Trade #${trade.id.slice(-6)} (${trade.direction}) P/L: $${trade.pnl.toFixed(2)}`,
      });

      if (runningBalance > peakBalance) {
        peakBalance = runningBalance;
        peakTime = ts;
      }

      const ddAmount = Math.max(0, peakBalance - runningBalance);
      const ddPct = peakBalance > 0 ? (ddAmount / peakBalance) * 100 : 0;

      drawdownCurve.push({
        timestamp: ts,
        drawdownAmount: ddAmount,
        drawdownPct: ddPct,
        peakBalance,
        currentBalance: runningBalance,
      });

      if (ddAmount > maxDrawdownAmount) {
        maxDrawdownAmount = ddAmount;
        maxDrawdownPct = ddPct;
        maxDdPeakTime = peakTime;
        maxDdTroughTime = ts;
        maxDdPeakValue = peakBalance;
      }
    }

    // 3. Current endpoint if replay cursor is ahead of last trade
    if (currentReplayCursor !== undefined && balanceCurve.length > 0) {
      const lastTs = balanceCurve[balanceCurve.length - 1].timestamp;
      if (currentReplayCursor > lastTs) {
        balanceCurve.push({
          timestamp: currentReplayCursor,
          balance: runningBalance,
          equity: currentEquity ?? runningBalance,
          description: 'Current Cursor Position',
        });

        const curDdAmount = Math.max(0, peakBalance - runningBalance);
        const curDdPct = peakBalance > 0 ? (curDdAmount / peakBalance) * 100 : 0;
        drawdownCurve.push({
          timestamp: currentReplayCursor,
          drawdownAmount: curDdAmount,
          drawdownPct: curDdPct,
          peakBalance,
          currentBalance: runningBalance,
        });
      }
    }

    // 4. Calculate Recovery Timestamp for Max Drawdown
    let recoveryTimestamp: number | null = null;
    if (maxDdTroughTime !== null && maxDrawdownAmount > 0) {
      // Find the first point after trough where balance >= maxDdPeakValue
      for (const pt of balanceCurve) {
        if (pt.timestamp > maxDdTroughTime && pt.balance >= maxDdPeakValue) {
          recoveryTimestamp = pt.timestamp;
          break;
        }
      }
    }

    // 5. Current Drawdown at the latest point
    const latestDd = drawdownCurve[drawdownCurve.length - 1];
    const currentDrawdownAmount = latestDd ? latestDd.drawdownAmount : 0;
    const currentDrawdownPct = latestDd ? latestDd.drawdownPct : 0;

    return {
      balanceCurve,
      drawdownAnalysis: {
        maxDrawdownAmount,
        maxDrawdownPct,
        currentDrawdownAmount,
        currentDrawdownPct,
        peakTimestamp: maxDdPeakTime,
        troughTimestamp: maxDdTroughTime,
        recoveryTimestamp,
        drawdownCurve,
        isRealizedBalanceOnly: true,
      },
    };
  }
}

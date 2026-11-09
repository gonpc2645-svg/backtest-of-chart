import { ReplaySession } from '../replay/types';
import { TradingState } from '../trading/TradingTypes';
import { SessionAnalyticsReport } from './AnalyticsTypes';
import { DirectionAnalyzer } from './DirectionAnalyzer';
import { EquityDrawdownProcessor } from './EquityDrawdownProcessor';
import { PerformanceMetricsCalculator } from './PerformanceMetricsCalculator';
import { PerformancePeriodAnalyzer } from './PerformancePeriodAnalyzer';
import { RiskRewardCalculator } from './RiskRewardCalculator';
import { StreakAnalyzer } from './StreakAnalyzer';
import { TradeDistributionAnalyzer } from './TradeDistributionAnalyzer';
import { TradeRecordNormalizer } from './TradeRecordNormalizer';

export const ANALYTICS_CALCULATION_VERSION = '1.0.0-phase5';

export class AnalyticsEngine {
  /**
   * Generates a comprehensive, deterministic performance report for a specific backtest session.
   *
   * Invariants:
   * 1. Zero future data leakage: only events and trades with exitTime <= replayCursor are evaluated.
   * 2. Source of truth is strictly the Phase 4 Trading Engine records.
   * 3. Zero fabricated statistics or placeholder values.
   */
  public static generateReport(
    session: ReplaySession,
    tradingState: TradingState,
    replayCursor?: number,
    contractSize: number = 1.0
  ): SessionAnalyticsReport {
    const cursor = replayCursor ?? session.cursor;

    // 1. Normalize Closed Trades & Open Positions bounded by cursor
    const closedTrades = TradeRecordNormalizer.normalizeClosedTrades(
      tradingState,
      cursor,
      contractSize
    );
    const openPositions = TradeRecordNormalizer.normalizeOpenPositions(
      tradingState,
      cursor
    );

    // 2. Primary Performance Metrics
    const initialBal = tradingState.account.initialBalance;
    const currentBal = tradingState.account.balance;
    const currentEq = tradingState.account.equity;

    const baseOverview = PerformanceMetricsCalculator.calculate(
      closedTrades,
      initialBal,
      currentBal,
      currentEq
    );

    // 3. Balance Curve & Peak-to-Trough Drawdown Analysis
    const { balanceCurve, drawdownAnalysis } = EquityDrawdownProcessor.process(
      closedTrades,
      initialBal,
      session.startTimestamp,
      tradingState.events,
      cursor,
      currentEq
    );

    // 4. Recovery Factor calculation
    let recoveryFactor: number | null = null;
    if (drawdownAnalysis.maxDrawdownAmount > 0) {
      recoveryFactor = baseOverview.netPnL / drawdownAnalysis.maxDrawdownAmount;
    } else if (baseOverview.netPnL > 0) {
      recoveryFactor = Infinity;
    }

    const overview = {
      ...baseOverview,
      maxDrawdownAmount: drawdownAnalysis.maxDrawdownAmount,
      maxDrawdownPct: drawdownAnalysis.maxDrawdownPct,
      currentDrawdownAmount: drawdownAnalysis.currentDrawdownAmount,
      currentDrawdownPct: drawdownAnalysis.currentDrawdownPct,
      recoveryFactor,
    };

    // 5. Streaks Analysis
    const streaks = StreakAnalyzer.analyze(closedTrades);

    // 6. Long vs Short Breakdown
    const { longAnalysis, shortAnalysis } = DirectionAnalyzer.analyze(closedTrades);

    // 7. Periodic Performance (Daily, Weekly, Monthly)
    const { dailyPerformance, weeklyPerformance, monthlyPerformance } =
      PerformancePeriodAnalyzer.analyze(closedTrades);

    // 8. Outcome Distribution
    const distributionBins = TradeDistributionAnalyzer.analyze(closedTrades);

    // 9. Risk / Reward R-Multiples
    const riskReward = RiskRewardCalculator.calculate(closedTrades);

    // 10. Execution Assumptions summary
    const assumptions = tradingState.executionAssumptions || {
      priceModel: 'LAST_PRICE',
      spreadPipsOrPts: 0,
      commissionPerLotOrUnit: 0,
      slippagePoints: 0,
      swapLong: 0,
      swapShort: 0,
    };

    return {
      sessionId: session.id,
      instrumentId: session.instrumentId,
      provider: session.provider,
      timeframe: session.timeframe,
      historicalStartMs: session.startTimestamp,
      historicalEndMs: session.endTimestamp,
      replayCursorMs: cursor,
      replayStatus: session.status,
      generatedAtMs: Date.now(),
      calculationVersion: ANALYTICS_CALCULATION_VERSION,
      executionAssumptions: {
        priceModel: assumptions.priceModel,
        spreadPipsOrPts: assumptions.spreadPipsOrPts,
        commissionPerLotOrUnit: assumptions.commissionPerLotOrUnit,
        slippagePoints: assumptions.slippagePoints,
        swapLong: assumptions.swapLong,
        swapShort: assumptions.swapShort,
        priceBasis: session.provider === 'BINANCE' ? 'LAST' : 'BID_ASK',
      },
      overview,
      streaks,
      longAnalysis,
      shortAnalysis,
      dailyPerformance,
      weeklyPerformance,
      monthlyPerformance,
      distributionBins,
      riskReward,
      balanceCurve,
      drawdownAnalysis,
      closedTrades,
      openPositions,
      pendingOrdersCount: tradingState.pendingOrders ? tradingState.pendingOrders.length : 0,
    };
  }
}

import { OrderDirection, PositionCloseReason, PriceModel } from '../trading/TradingTypes';

export interface PerformanceOverviewMetrics {
  initialBalance: number;
  currentBalance: number;
  currentEquity: number;
  netPnL: number;
  grossProfit: number;
  grossLoss: number;
  totalClosedTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number | null; // % (default denominator: all closed trades)
  winRateExcludingBreakeven: number | null; // % (denominator: wins + losses)
  lossRate: number | null; // %
  breakevenRate: number | null; // %
  profitFactor: number | null; // null if undefined, Infinity if no loss
  expectancy: number | null; // $ per trade
  averageWin: number | null; // $
  averageLoss: number | null; // $
  largestWin: number | null; // $
  largestLoss: number | null; // $
  winLossRatio: number | null; // AvgWin / AvgLoss
  averageHoldingDurationMs: number | null; // ms
  averageWinnerDurationMs: number | null; // ms
  averageLoserDurationMs: number | null; // ms
  maxDrawdownAmount: number; // $
  maxDrawdownPct: number; // %
  currentDrawdownAmount: number; // $
  currentDrawdownPct: number; // %
  recoveryFactor: number | null; // NetPnL / MaxDrawdownAmount
}

export interface StreakMetrics {
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  currentStreakType: 'WIN' | 'LOSS' | 'NONE';
  currentStreakCount: number;
}

export interface DirectionMetrics {
  direction: OrderDirection;
  tradeCount: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number | null;
  netPnL: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  averagePnL: number | null;
}

export interface PeriodicPerformanceRecord {
  periodKey: string; // e.g. "2026-11-07" (Day), "2026-W45" (Week), "2026-11" (Month)
  periodLabel: string;
  tradeCount: number;
  netPnL: number;
  grossProfit: number;
  grossLoss: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number | null;
}

export interface DistributionBin {
  binLabel: string;
  minPnL: number;
  maxPnL: number;
  count: number;
  percentage: number;
}

export interface BalanceCurvePoint {
  timestamp: number;
  balance: number;
  equity?: number;
  pnl?: number;
  tradeId?: string;
  description?: string;
}

export interface DrawdownPoint {
  timestamp: number;
  drawdownAmount: number;
  drawdownPct: number;
  peakBalance: number;
  currentBalance: number;
}

export interface DrawdownAnalysis {
  maxDrawdownAmount: number;
  maxDrawdownPct: number;
  currentDrawdownAmount: number;
  currentDrawdownPct: number;
  peakTimestamp: number | null;
  troughTimestamp: number | null;
  recoveryTimestamp: number | null;
  drawdownCurve: DrawdownPoint[];
  isRealizedBalanceOnly: boolean; // True if calculated from realized balance steps
}

export interface RiskRewardMetrics {
  tradesWithDefinedRiskCount: number;
  averageInitialRisk: number | null;
  averageRMultiple: number | null;
  largestRMultiple: number | null;
  lowestRMultiple: number | null;
}

export interface NormalizedTrade {
  id: string;
  positionId: string;
  orderId: string;
  instrumentId: string;
  direction: OrderDirection;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  durationMs: number;
  pnl: number;
  returnPct: number;
  exitReason: PositionCloseReason;
  isAmbiguous?: boolean;
  initialStopLoss?: number;
  initialRisk?: number;
  rMultiple?: number;
}

export interface OpenPositionSnapshot {
  id: string;
  instrumentId: string;
  direction: OrderDirection;
  quantity: number;
  entryPrice: number;
  entryTimestamp: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnL: number;
  usedMargin: number;
}

export interface SessionAnalyticsReport {
  sessionId: string;
  instrumentId: string;
  provider: string;
  timeframe: string;
  historicalStartMs: number;
  historicalEndMs: number;
  replayCursorMs: number;
  replayStatus: string;
  generatedAtMs: number;
  calculationVersion: string;
  executionAssumptions: {
    priceModel: PriceModel;
    spreadPipsOrPts: number;
    commissionPerLotOrUnit: number;
    slippagePoints: number;
    swapLong: number;
    swapShort: number;
    priceBasis: string;
  };
  overview: PerformanceOverviewMetrics;
  streaks: StreakMetrics;
  longAnalysis: DirectionMetrics;
  shortAnalysis: DirectionMetrics;
  dailyPerformance: PeriodicPerformanceRecord[];
  weeklyPerformance: PeriodicPerformanceRecord[];
  monthlyPerformance: PeriodicPerformanceRecord[];
  distributionBins: DistributionBin[];
  riskReward: RiskRewardMetrics;
  balanceCurve: BalanceCurvePoint[];
  drawdownAnalysis: DrawdownAnalysis;
  closedTrades: NormalizedTrade[];
  openPositions: OpenPositionSnapshot[];
  pendingOrdersCount: number;
}

export type TradeFilterResult = 'ALL' | 'WINNERS' | 'LOSERS' | 'BREAKEVEN';
export type TradeFilterDirection = 'ALL' | 'BUY' | 'SELL';

export interface TradeFilterCriteria {
  result: TradeFilterResult;
  direction: TradeFilterDirection;
  startDate?: number;
  endDate?: number;
  searchQuery?: string;
}

export type TradeSortField = 'exitTime' | 'entryTime' | 'pnl' | 'quantity' | 'durationMs' | 'returnPct';
export type SortOrder = 'ASC' | 'DESC';

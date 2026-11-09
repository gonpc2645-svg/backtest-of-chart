import { AnalyticsEngine } from '../../../src/services/analytics/AnalyticsEngine';
import { AnalyticsExportService } from '../../../src/services/analytics/AnalyticsExportService';
import { ReplaySession } from '../../../src/services/replay/types';
import {
  Order,
  Position,
  TradeRecord,
  TradingAccount,
  TradingState,
} from '../../../src/services/trading/TradingTypes';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✓ [PASS] ${msg}`);
}

function createBaseSession(): ReplaySession {
  return {
    id: 'test_session_analytics_001',
    provider: 'BINANCE',
    instrumentId: 'BINANCE:BTCUSDT',
    providerSymbol: 'BTCUSDT',
    displayName: 'Bitcoin / Tether USD Spot',
    marketCategory: 'crypto',
    timeframe: 'M15',
    startTimestamp: 1793987040000,
    endTimestamp: 1794100980000,
    cursor: 1794050000000,
    speed: 1,
    status: 'PAUSED',
    skippedGaps: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  };
}

function createBaseAccount(initialBalance = 10000): TradingAccount {
  return {
    currency: 'USD',
    initialBalance,
    balance: initialBalance,
    equity: initialBalance,
    usedMargin: 0,
    freeMargin: initialBalance,
    marginLevel: null,
    stopOutLevel: 50,
    leverage: 100,
    realizedPnL: 0,
    unrealizedPnL: 0,
    tradingMode: 'HEDGING',
    isLocked: false,
  };
}

function createBaseTradingState(initialBalance = 10000): TradingState {
  return {
    account: createBaseAccount(initialBalance),
    positions: [],
    closedPositions: [],
    pendingOrders: [],
    completedOrders: [],
    tradeRecords: [],
    events: [],
    executionAssumptions: {
      priceModel: 'LAST_PRICE',
      spreadPipsOrPts: 0,
      commissionPerLotOrUnit: 0,
      slippagePoints: 0,
      swapLong: 0,
      swapShort: 0,
    },
    updatedAt: Date.now(),
  };
}

function runAnalyticsTestSuite() {
  console.log('========================================================================');
  console.log('BACKTEST OF CHART — PHASE 5 ANALYTICS & PERFORMANCE REPORTING ENGINE');
  console.log('========================================================================\n');

  // ========================================================================
  // TEST GROUP 1: Zero Closed Trades (Empty Session)
  // ========================================================================
  console.log('[TEST GROUP 1] Empty Session & Zero Trades Edge Case');
  {
    const session = createBaseSession();
    const state = createBaseTradingState(10000);
    const report = AnalyticsEngine.generateReport(session, state);

    assert(report.overview.totalClosedTrades === 0, 'Total closed trades is 0');
    assert(report.overview.netPnL === 0, 'Net P/L is 0');
    assert(report.overview.grossProfit === 0, 'Gross Profit is 0');
    assert(report.overview.grossLoss === 0, 'Gross Loss is 0');
    assert(report.overview.winRate === null, 'Win Rate is null (N/A) for 0 trades');
    assert(report.overview.profitFactor === null, 'Profit Factor is null (N/A) for 0 trades');
    assert(report.overview.expectancy === null, 'Expectancy is null (N/A) for 0 trades');
    assert(report.overview.averageWin === null, 'Average Win is null');
    assert(report.overview.averageLoss === null, 'Average Loss is null');
    assert(report.overview.maxDrawdownAmount === 0, 'Max Drawdown Amount is 0');
    assert(report.overview.maxDrawdownPct === 0, 'Max Drawdown Pct is 0');
    assert(report.balanceCurve.length >= 1, 'Balance curve has initial anchor point');
    assert(report.distributionBins.length === 0, 'Distribution bins empty for 0 trades');
  }

  // ========================================================================
  // TEST GROUP 2: Single Winning Trade
  // ========================================================================
  console.log('\n[TEST GROUP 2] Single Winning Trade');
  {
    const session = createBaseSession();
    const state = createBaseTradingState(10000);
    state.tradeRecords = [
      {
        id: 'tr_1',
        positionId: 'pos_1',
        orderId: 'ord_1',
        instrumentId: 'BINANCE:BTCUSDT',
        direction: 'BUY',
        quantity: 0.1,
        entryPrice: 70000,
        exitPrice: 72000,
        entryTime: 1793990000000,
        exitTime: 1794000000000,
        pnl: 200,
        exitReason: 'MANUAL',
      },
    ];
    state.account.balance = 10200;
    state.account.equity = 10200;

    const report = AnalyticsEngine.generateReport(session, state);

    assert(report.overview.totalClosedTrades === 1, 'Total closed trades is 1');
    assert(report.overview.winningTrades === 1, 'Winning trades is 1');
    assert(report.overview.losingTrades === 0, 'Losing trades is 0');
    assert(report.overview.winRate === 100, 'Win Rate is exactly 100%');
    assert(report.overview.netPnL === 200, 'Net P/L is $200');
    assert(report.overview.grossProfit === 200, 'Gross profit is $200');
    assert(report.overview.grossLoss === 0, 'Gross loss is $0');
    assert(report.overview.profitFactor === Infinity, 'Profit Factor is Infinity (zero loss)');
    assert(report.overview.expectancy === 200, 'Expectancy is $200/trade');
    assert(report.overview.averageWin === 200, 'Average Win is $200');
    assert(report.overview.averageLoss === null, 'Average Loss is null (no losses)');
    assert(report.overview.maxDrawdownAmount === 0, 'Max Drawdown is 0 on purely winning trade');
    assert(report.streaks.maxConsecutiveWins === 1, 'Max consecutive wins is 1');
    assert(report.streaks.currentStreakType === 'WIN', 'Current streak type is WIN');
    assert(report.streaks.currentStreakCount === 1, 'Current streak count is 1');
  }

  // ========================================================================
  // TEST GROUP 3: Single Losing Trade
  // ========================================================================
  console.log('\n[TEST GROUP 3] Single Losing Trade');
  {
    const session = createBaseSession();
    const state = createBaseTradingState(10000);
    state.tradeRecords = [
      {
        id: 'tr_2',
        positionId: 'pos_2',
        orderId: 'ord_2',
        instrumentId: 'BINANCE:BTCUSDT',
        direction: 'SELL',
        quantity: 0.1,
        entryPrice: 70000,
        exitPrice: 71500,
        entryTime: 1793990000000,
        exitTime: 1794000000000,
        pnl: -150,
        exitReason: 'SL',
      },
    ];
    state.account.balance = 9850;
    state.account.equity = 9850;

    const report = AnalyticsEngine.generateReport(session, state);

    assert(report.overview.totalClosedTrades === 1, 'Total closed trades is 1');
    assert(report.overview.winningTrades === 0, 'Winning trades is 0');
    assert(report.overview.losingTrades === 1, 'Losing trades is 1');
    assert(report.overview.winRate === 0, 'Win Rate is 0%');
    assert(report.overview.netPnL === -150, 'Net P/L is -$150');
    assert(report.overview.grossProfit === 0, 'Gross Profit is $0');
    assert(report.overview.grossLoss === 150, 'Gross Loss is $150');
    assert(report.overview.profitFactor === 0, 'Profit Factor is 0 (0 / 150)');
    assert(report.overview.expectancy === -150, 'Expectancy is -$150/trade');
    assert(report.overview.maxDrawdownAmount === 150, 'Max Drawdown Amount is $150');
    assert(report.overview.maxDrawdownPct === 1.5, 'Max Drawdown Pct is 1.5% (150 / 10000)');
    assert(report.streaks.maxConsecutiveLosses === 1, 'Max consecutive losses is 1');
    assert(report.streaks.currentStreakType === 'LOSS', 'Current streak type is LOSS');
    assert(report.streaks.currentStreakCount === 1, 'Current streak count is 1');
  }

  // ========================================================================
  // TEST GROUP 4: Breakeven Trades & Streak Reset Policy
  // ========================================================================
  console.log('\n[TEST GROUP 4] Breakeven Trades & Streak Termination Policy');
  {
    const session = createBaseSession();
    const state = createBaseTradingState(10000);
    state.tradeRecords = [
      {
        id: 'tr_w1',
        positionId: 'pos_w1',
        orderId: 'ord_w1',
        instrumentId: 'BINANCE:BTCUSDT',
        direction: 'BUY',
        quantity: 0.1,
        entryPrice: 70000,
        exitPrice: 70500,
        entryTime: 1793990000000,
        exitTime: 1793991000000,
        pnl: 50,
        exitReason: 'MANUAL',
      },
      {
        id: 'tr_be',
        positionId: 'pos_be',
        orderId: 'ord_be',
        instrumentId: 'BINANCE:BTCUSDT',
        direction: 'BUY',
        quantity: 0.1,
        entryPrice: 70000,
        exitPrice: 70000,
        entryTime: 1793992000000,
        exitTime: 1793993000000,
        pnl: 0,
        exitReason: 'MANUAL',
      },
      {
        id: 'tr_w2',
        positionId: 'pos_w2',
        orderId: 'ord_w2',
        instrumentId: 'BINANCE:BTCUSDT',
        direction: 'BUY',
        quantity: 0.1,
        entryPrice: 70000,
        exitPrice: 70800,
        entryTime: 1793994000000,
        exitTime: 1793995000000,
        pnl: 80,
        exitReason: 'MANUAL',
      },
    ];

    const report = AnalyticsEngine.generateReport(session, state);

    assert(report.overview.totalClosedTrades === 3, 'Total closed trades is 3');
    assert(report.overview.winningTrades === 2, 'Winning trades is 2');
    assert(report.overview.breakevenTrades === 1, 'Breakeven trades is 1');
    assert(report.overview.losingTrades === 0, 'Losing trades is 0');
    // Default denominator includes breakeven: 2 / 3 = 66.67%
    assert(Math.abs(report.overview.winRate! - 66.666666) < 0.01, 'Win Rate over all trades is ~66.67%');
    // Denominator excluding breakeven: 2 / 2 = 100%
    assert(report.overview.winRateExcludingBreakeven === 100, 'Win Rate excluding breakeven is 100%');
    // Breakeven trade in between broken the streak: max streak was 1, not 2
    assert(report.streaks.maxConsecutiveWins === 1, 'Breakeven trade terminated active winning streak (max 1)');
    assert(report.streaks.currentStreakCount === 1, 'Current streak count is 1');
  }

  // ========================================================================
  // TEST GROUP 5: Mixed Portfolio (Wins, Losses, Partial Closes, Long vs Short)
  // ========================================================================
  console.log('\n[TEST GROUP 5] Mixed Trades & Long vs Short Analysis');
  {
    const session = createBaseSession();
    const state = createBaseTradingState(10000);

    state.tradeRecords = [
      // 1. Long Win: +$300
      {
        id: 'tr_m1',
        positionId: 'pos_m1',
        orderId: 'ord_m1',
        instrumentId: 'BINANCE:BTCUSDT',
        direction: 'BUY',
        quantity: 0.1,
        entryPrice: 70000,
        exitPrice: 73000,
        entryTime: 1793990000000,
        exitTime: 1793992000000,
        pnl: 300,
        exitReason: 'TP',
      },
      // 2. Short Loss: -$100
      {
        id: 'tr_m2',
        positionId: 'pos_m2',
        orderId: 'ord_m2',
        instrumentId: 'BINANCE:BTCUSDT',
        direction: 'SELL',
        quantity: 0.1,
        entryPrice: 73000,
        exitPrice: 74000,
        entryTime: 1793993000000,
        exitTime: 1793995000000,
        pnl: -100,
        exitReason: 'SL',
      },
      // 3. Long Partial Close: +$150
      {
        id: 'tr_m3_p1',
        positionId: 'pos_m3',
        orderId: 'ord_m3',
        instrumentId: 'BINANCE:BTCUSDT',
        direction: 'BUY',
        quantity: 0.05,
        entryPrice: 72000,
        exitPrice: 75000,
        entryTime: 1793996000000,
        exitTime: 1793998000000,
        pnl: 150,
        exitReason: 'PARTIAL',
      },
      // 4. Short Win: +$200
      {
        id: 'tr_m4',
        positionId: 'pos_m4',
        orderId: 'ord_m4',
        instrumentId: 'BINANCE:BTCUSDT',
        direction: 'SELL',
        quantity: 0.1,
        entryPrice: 75000,
        exitPrice: 73000,
        entryTime: 1793999000000,
        exitTime: 1794002000000,
        pnl: 200,
        exitReason: 'MANUAL',
      },
    ];

    state.account.balance = 10000 + 300 - 100 + 150 + 200; // 10550
    state.account.equity = 10550;

    const report = AnalyticsEngine.generateReport(session, state);

    assert(report.overview.totalClosedTrades === 4, 'Total closed trades is 4');
    assert(report.overview.winningTrades === 3, 'Winning trades is 3');
    assert(report.overview.losingTrades === 1, 'Losing trades is 1');
    assert(report.overview.netPnL === 550, 'Net P/L is $550');
    assert(report.overview.grossProfit === 650, 'Gross profit is $650 (300 + 150 + 200)');
    assert(report.overview.grossLoss === 100, 'Gross loss is $100');
    assert(report.overview.profitFactor === 6.5, 'Profit Factor is 6.5 (650 / 100)');
    assert(report.overview.expectancy === 137.5, 'Expectancy is $137.5/trade (550 / 4)');
    assert(report.overview.largestWin === 300, 'Largest win is $300');
    assert(report.overview.largestLoss === -100, 'Largest loss is -$100');

    // Directional Breakdown
    assert(report.longAnalysis.tradeCount === 2, 'Long trade count is 2');
    assert(report.longAnalysis.netPnL === 450, 'Long Net P/L is $450 (300 + 150)');
    assert(report.longAnalysis.winRate === 100, 'Long Win Rate is 100%');

    assert(report.shortAnalysis.tradeCount === 2, 'Short trade count is 2');
    assert(report.shortAnalysis.netPnL === 100, 'Short Net P/L is $100 (200 - 100)');
    assert(report.shortAnalysis.winRate === 50, 'Short Win Rate is 50%');
    assert(report.shortAnalysis.profitFactor === 2, 'Short Profit Factor is 2 (200 / 100)');
  }

  // ========================================================================
  // TEST GROUP 6: Peak-to-Trough Drawdown & Recovery Factor
  // ========================================================================
  console.log('\n[TEST GROUP 6] Drawdown Calculation, Valley & Recovery');
  {
    const session = createBaseSession();
    const state = createBaseTradingState(10000);

    // Initial: 10,000
    // Trade 1: +$1,000 -> Peak = 11,000 (t=100)
    // Trade 2: -$1,500 -> Balance = 9,500 (t=200) -> DD = 1,500 (13.64%)
    // Trade 3: -$500   -> Balance = 9,000 (t=300) -> DD = 2,000 (18.18%) -> Max DD Trough
    // Trade 4: +$1,200 -> Balance = 10,200 (t=400) -> DD = 800 (not recovered)
    // Trade 5: +$1,500 -> Balance = 11,700 (t=500) -> Recovered past 11,000 at t=500!
    state.tradeRecords = [
      { id: 't1', positionId: 'p1', orderId: 'o1', instrumentId: 'BTC', direction: 'BUY', quantity: 0.1, entryPrice: 10, exitPrice: 11, entryTime: 50, exitTime: 100, pnl: 1000, exitReason: 'TP' },
      { id: 't2', positionId: 'p2', orderId: 'o2', instrumentId: 'BTC', direction: 'BUY', quantity: 0.1, entryPrice: 10, exitPrice: 9, entryTime: 150, exitTime: 200, pnl: -1500, exitReason: 'SL' },
      { id: 't3', positionId: 'p3', orderId: 'o3', instrumentId: 'BTC', direction: 'BUY', quantity: 0.1, entryPrice: 10, exitPrice: 9, entryTime: 250, exitTime: 300, pnl: -500, exitReason: 'SL' },
      { id: 't4', positionId: 'p4', orderId: 'o4', instrumentId: 'BTC', direction: 'BUY', quantity: 0.1, entryPrice: 10, exitPrice: 11, entryTime: 350, exitTime: 400, pnl: 1200, exitReason: 'TP' },
      { id: 't5', positionId: 'p5', orderId: 'o5', instrumentId: 'BTC', direction: 'BUY', quantity: 0.1, entryPrice: 10, exitPrice: 12, entryTime: 450, exitTime: 500, pnl: 1500, exitReason: 'TP' },
    ];
    state.account.balance = 11700;
    state.account.equity = 11700;

    const report = AnalyticsEngine.generateReport(session, state);

    assert(report.drawdownAnalysis.maxDrawdownAmount === 2000, 'Max Drawdown Amount is exactly $2,000');
    // Peak was 11,000, trough was 9,000: (2,000 / 11,000) * 100 = 18.1818%
    assert(Math.abs(report.drawdownAnalysis.maxDrawdownPct - 18.181818) < 0.01, 'Max Drawdown Pct is ~18.18%');
    assert(report.drawdownAnalysis.peakTimestamp === 100, 'Peak timestamp correctly identified at t=100');
    assert(report.drawdownAnalysis.troughTimestamp === 300, 'Trough timestamp correctly identified at t=300');
    assert(report.drawdownAnalysis.recoveryTimestamp === 500, 'Recovery timestamp correctly identified at t=500');
    assert(report.drawdownAnalysis.currentDrawdownAmount === 0, 'Current drawdown is $0 (at new all-time high)');
    // Recovery factor = Net PnL (1700) / Max DD (2000) = 0.85
    assert(report.overview.recoveryFactor === 0.85, 'Recovery Factor is 0.85 (1700 / 2000)');
  }

  // ========================================================================
  // TEST GROUP 7: Zero Future Data Leakage (Cursor Bound)
  // ========================================================================
  console.log('\n[TEST GROUP 7] Zero Future Data Leakage via Replay Cursor');
  {
    const session = createBaseSession();
    // Cursor is set to t=250
    session.cursor = 250;

    const state = createBaseTradingState(10000);
    state.tradeRecords = [
      // Trade before cursor: t=100
      { id: 'past_1', positionId: 'p_p1', orderId: 'o_p1', instrumentId: 'BTC', direction: 'BUY', quantity: 0.1, entryPrice: 70000, exitPrice: 71000, entryTime: 50, exitTime: 100, pnl: 100, exitReason: 'TP' },
      // Trade after cursor: t=300 (FUTURE)
      { id: 'future_1', positionId: 'p_f1', orderId: 'o_f1', instrumentId: 'BTC', direction: 'BUY', quantity: 0.1, entryPrice: 71000, exitPrice: 73000, entryTime: 260, exitTime: 300, pnl: 200, exitReason: 'TP' },
    ];

    const report = AnalyticsEngine.generateReport(session, state);

    assert(report.overview.totalClosedTrades === 1, 'Future trade at t=300 is strictly excluded');
    assert(report.closedTrades.length === 1, 'Only 1 closed trade normalized');
    assert(report.closedTrades[0].id === 'past_1', 'Only past trade is present in report');
    assert(report.overview.netPnL === 100, 'Net P/L reflects only past trade ($100)');
  }

  // ========================================================================
  // TEST GROUP 8: Risk/Reward & R-Multiple Calculation
  // ========================================================================
  console.log('\n[TEST GROUP 8] Risk / Reward & Realized R-Multiples');
  {
    const session = createBaseSession();
    const state = createBaseTradingState(10000);

    // Initial Order with SL at 69,000 (Entry at 70,000 -> Risk = $1,000 per 1.0 unit = $100 for 0.1 unit)
    const order1: Order = {
      id: 'ord_rr1',
      sessionId: session.id,
      instrumentId: 'BINANCE:BTCUSDT',
      direction: 'BUY',
      orderType: 'MARKET',
      quantity: 0.1,
      requestedPrice: 70000,
      stopLoss: 69000,
      takeProfit: 73000,
      status: 'FILLED',
      createdAt: 1000,
      executionAssumptions: state.executionAssumptions,
    };
    state.completedOrders.push(order1);

    // Trade exit at 72,000: PnL = +$200. Initial Risk = $100 -> R-Multiple = +2.0R
    state.tradeRecords = [
      {
        id: 'tr_rr1',
        positionId: 'pos_rr1',
        orderId: 'ord_rr1',
        instrumentId: 'BINANCE:BTCUSDT',
        direction: 'BUY',
        quantity: 0.1,
        entryPrice: 70000,
        exitPrice: 72000,
        entryTime: 1000,
        exitTime: 2000,
        pnl: 200,
        exitReason: 'MANUAL',
      },
    ];

    const report = AnalyticsEngine.generateReport(session, state);

    assert(report.riskReward.tradesWithDefinedRiskCount === 1, '1 trade with defined initial risk');
    assert(report.riskReward.averageInitialRisk === 100, 'Average initial risk is $100');
    assert(report.riskReward.averageRMultiple === 2.0, 'Average R-Multiple is +2.0R');
    assert(report.closedTrades[0].rMultiple === 2.0, 'Normalized trade has rMultiple = 2.0');
  }

  // ========================================================================
  // TEST GROUP 9: Periodic Aggregation (Daily, Weekly, Monthly)
  // ========================================================================
  console.log('\n[TEST GROUP 9] Periodic Aggregation (Daily, Weekly, Monthly)');
  {
    const session = createBaseSession();
    const state = createBaseTradingState(10000);

    // Trade A: 2026-11-07 10:00:00 UTC (1794045600000) -> +$100
    // Trade B: 2026-11-07 15:00:00 UTC (1794063600000) -> +$50
    // Trade C: 2026-11-08 10:00:00 UTC (1794132000000) -> -$80
    state.tradeRecords = [
      { id: 't_p1', positionId: 'p1', orderId: 'o1', instrumentId: 'BTC', direction: 'BUY', quantity: 0.1, entryPrice: 10, exitPrice: 11, entryTime: 1794040000000, exitTime: 1794045600000, pnl: 100, exitReason: 'TP' },
      { id: 't_p2', positionId: 'p2', orderId: 'o2', instrumentId: 'BTC', direction: 'BUY', quantity: 0.1, entryPrice: 10, exitPrice: 10.5, entryTime: 1794050000000, exitTime: 1794063600000, pnl: 50, exitReason: 'TP' },
      { id: 't_p3', positionId: 'p3', orderId: 'o3', instrumentId: 'BTC', direction: 'SELL', quantity: 0.1, entryPrice: 10, exitPrice: 10.8, entryTime: 1794120000000, exitTime: 1794132000000, pnl: -80, exitReason: 'SL' },
    ];
    session.cursor = 1794200000000;

    const report = AnalyticsEngine.generateReport(session, state);

    assert(report.dailyPerformance.length === 2, '2 distinct days aggregated');
    assert(report.dailyPerformance[0].periodKey === '2026-11-07', 'First day key is 2026-11-07');
    assert(report.dailyPerformance[0].tradeCount === 2, 'First day has 2 trades');
    assert(report.dailyPerformance[0].netPnL === 150, 'First day Net P/L is $150 (100 + 50)');

    assert(report.dailyPerformance[1].periodKey === '2026-11-08', 'Second day key is 2026-11-08');
    assert(report.dailyPerformance[1].tradeCount === 1, 'Second day has 1 trade');
    assert(report.dailyPerformance[1].netPnL === -80, 'Second day Net P/L is -$80');

    assert(report.monthlyPerformance.length === 1, 'All trades fall in 1 month (2026-11)');
    assert(report.monthlyPerformance[0].tradeCount === 3, 'Monthly trade count is 3');
    assert(report.monthlyPerformance[0].netPnL === 70, 'Monthly Net P/L is $70 (150 - 80)');
  }

  // ========================================================================
  // TEST GROUP 10: Export Formats Integrity
  // ========================================================================
  console.log('\n[TEST GROUP 10] CSV and JSON Report Generation');
  {
    const session = createBaseSession();
    const state = createBaseTradingState(10000);
    state.tradeRecords = [
      { id: 'tr_exp1', positionId: 'p1', orderId: 'o1', instrumentId: 'BINANCE:BTCUSDT', direction: 'BUY', quantity: 0.1, entryPrice: 70000, exitPrice: 71000, entryTime: 1794000000000, exitTime: 1794001000000, pnl: 100, exitReason: 'TP' },
    ];

    const report = AnalyticsEngine.generateReport(session, state);

    const tradesCsv = AnalyticsExportService.exportTradesToCsv(report);
    assert(tradesCsv.includes('Trade ID') && tradesCsv.includes('tr_exp1'), 'Trades CSV contains header and trade ID');
    assert(tradesCsv.includes('100.00'), 'Trades CSV contains PnL value');

    const summaryCsv = AnalyticsExportService.exportSummaryToCsv(report);
    assert(summaryCsv.includes('Net Realized P/L ($)') && summaryCsv.includes('100.00'), 'Summary CSV contains Net PnL');
    assert(summaryCsv.includes('Win Rate (%)') && summaryCsv.includes('100.00'), 'Summary CSV contains Win Rate');

    const jsonReport = AnalyticsExportService.exportReportToJson(report);
    const parsed = JSON.parse(jsonReport);
    assert(parsed.sessionId === session.id, 'JSON report parses with matching sessionId');
    assert(parsed.overview.netPnL === 100, 'JSON report maintains numeric integrity of metrics');
  }

  console.log('\n========================================================================');
  console.log('ALL PHASE 5 ANALYTICS ENGINE UNIT TESTS PASSED (100% Deterministic)');
  console.log('========================================================================\n');
}

runAnalyticsTestSuite();

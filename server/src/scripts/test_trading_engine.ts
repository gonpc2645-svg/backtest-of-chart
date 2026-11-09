import { AccountManager } from '../../../src/services/trading/AccountManager.js';
import { ExecutionCostModel } from '../../../src/services/trading/ExecutionCostModel.js';
import { InstrumentSpecificationService } from '../../../src/services/trading/InstrumentSpecificationService.js';
import { OrderExecutionEngine } from '../../../src/services/trading/OrderExecutionEngine.js';
import { OrderValidator } from '../../../src/services/trading/OrderValidator.js';
import { PositionCalculator } from '../../../src/services/trading/PositionCalculator.js';
import { PositionManager } from '../../../src/services/trading/PositionManager.js';
import { ProtectionManager } from '../../../src/services/trading/ProtectionManager.js';
import { TradingEngine } from '../../../src/services/trading/TradingEngine.js';
import { ApiCandle, ApiMarketInstrument } from '../../../src/services/marketDataApi.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`✗ [FAIL] ${testName} - ${details || 'Condition failed'}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runTradingEngineTestSuite() {
  console.log('========================================================================');
  console.log('BACKTEST OF CHART — PHASE 4 SIMULATED TRADING ENGINE VERIFICATION');
  console.log('========================================================================\n');

  // Mock instruments
  const btcInstrument: ApiMarketInstrument = {
    id: 'BINANCE:BTCUSDT',
    provider: 'BINANCE',
    providerSymbol: 'BTCUSDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    marketCategory: 'crypto',
    displayName: 'BTC / USDT Spot',
    tradingStatus: 'TRADING',
    priceBasis: 'LAST',
    availabilityMetadata: {
      tickSize: 0.01,
      lotSize: 0.001,
      minPrice: 1000,
      maxPrice: 200000,
    },
    lastSyncTimestamp: Date.now(),
  };

  const dukascopyInstrument: ApiMarketInstrument = {
    id: 'DUKASCOPY:EURUSD',
    provider: 'DUKASCOPY',
    providerSymbol: 'EURUSD',
    baseAsset: 'EUR',
    quoteAsset: 'USD',
    marketCategory: 'forex',
    displayName: 'EUR/USD Forex',
    tradingStatus: 'PLANNED', // Ingestion planned/blocked pending owner AWS S3
    priceBasis: 'BID',
    availabilityMetadata: {},
    lastSyncTimestamp: Date.now(),
  };

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Instrument Specification & Protection Against Fake Specs
  // -------------------------------------------------------------------------
  console.log('[TEST GROUP 1] Instrument Specification & Verification');
  const btcSpec = InstrumentSpecificationService.getSpecification(btcInstrument);
  assert(btcSpec.tradingSupported === true, 'Binance BTCUSDT trading is supported');
  assert(btcSpec.contractSize === 1.0, 'Crypto contract size is 1.0 unit per coin');
  assert(btcSpec.quantityStep === 0.001, 'Quantity step correctly derived (0.001)');
  assert(btcSpec.priceBasis === 'LAST', 'Binance Spot price basis is strictly LAST');

  const dukasSpec = InstrumentSpecificationService.getSpecification(dukascopyInstrument);
  assert(dukasSpec.tradingSupported === false, 'Dukascopy trading disabled when data ingestion is planned/pending');
  assert(dukasSpec.unsupportedReason !== undefined, 'Explicit explanation provided for unsupported Dukascopy pair');

  // -------------------------------------------------------------------------
  // TEST GROUP 2: Order Validation Rules
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 2] Order Validation & Margin Guard');
  const marketPrice = 76000;
  const freeMargin = 10000;
  const leverage = 100;

  // Invalid quantity (below min)
  const valMinQty = OrderValidator.validateCreateOrder(
    { direction: 'BUY', orderType: 'MARKET', quantity: 0.0001 },
    btcSpec,
    marketPrice,
    freeMargin,
    leverage
  );
  assert(!valMinQty.valid, 'Rejects quantity below minQuantity (0.0001 < 0.001)');

  // Invalid Limit price
  const valBadLimit = OrderValidator.validateCreateOrder(
    { direction: 'BUY', orderType: 'LIMIT', quantity: 0.1, requestedPrice: 77000 },
    btcSpec,
    marketPrice,
    freeMargin,
    leverage
  );
  assert(!valBadLimit.valid, 'Rejects Buy Limit placed above market price (77000 > 76000)');

  // Invalid Stop price
  const valBadStop = OrderValidator.validateCreateOrder(
    { direction: 'BUY', orderType: 'STOP', quantity: 0.1, requestedPrice: 75000 },
    btcSpec,
    marketPrice,
    freeMargin,
    leverage
  );
  assert(!valBadStop.valid, 'Rejects Buy Stop placed below market price (75000 < 76000)');

  // Invalid Stop Loss on Buy
  const valBadSL = OrderValidator.validateCreateOrder(
    { direction: 'BUY', orderType: 'MARKET', quantity: 0.1, stopLoss: 77000 },
    btcSpec,
    marketPrice,
    freeMargin,
    leverage
  );
  assert(!valBadSL.valid, 'Rejects Long Stop Loss placed above entry (77000 >= 76000)');

  // Insufficient margin
  const hugeQty = 50.0; // 50 BTC * $76000 = $3,800,000 -> / 100 leverage = $38,000 margin required
  const valMargin = OrderValidator.validateCreateOrder(
    { direction: 'BUY', orderType: 'MARKET', quantity: hugeQty },
    btcSpec,
    marketPrice,
    freeMargin,
    leverage
  );
  assert(!valMargin.valid, 'Rejects order when required margin exceeds free margin ($38,000 > $10,000)');

  // Valid order
  const valOk = OrderValidator.validateCreateOrder(
    { direction: 'BUY', orderType: 'MARKET', quantity: 0.1, stopLoss: 75000, takeProfit: 78000 },
    btcSpec,
    marketPrice,
    freeMargin,
    leverage
  );
  assert(valOk.valid, 'Accepts valid Market Buy order with SL and TP');
  assert(valOk.requiredMargin === 76.0, 'Calculates required margin accurately ($76.00)');

  // -------------------------------------------------------------------------
  // TEST GROUP 3: Market Orders & Hedging Mode Execution
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 3] Market Orders & Independent Long/Short Positions (Hedging)');
  const engine = new TradingEngine('test_sess_1', btcInstrument);
  const now = 1794050000000;

  // Open Long
  const buyRes = engine.placeOrder(
    { direction: 'BUY', orderType: 'MARKET', quantity: 0.1, stopLoss: 75000, takeProfit: 78000 },
    76000,
    now
  );
  assert(buyRes.success, 'Market Buy order filled successfully');
  assert(engine.getPositions().length === 1, 'Long position created');

  // Open Short simultaneously (Hedging mode)
  const sellRes = engine.placeOrder(
    { direction: 'SELL', orderType: 'MARKET', quantity: 0.2, stopLoss: 77000, takeProfit: 74000 },
    76000,
    now + 1000
  );
  assert(sellRes.success, 'Market Sell order filled successfully');
  assert(engine.getPositions().length === 2, 'Hedging mode: simultaneous Long & Short positions active');

  const longPos = engine.getPositions().find((p) => p.direction === 'BUY')!;
  const shortPos = engine.getPositions().find((p) => p.direction === 'SELL')!;
  assert(longPos.quantity === 0.1, 'Long quantity intact (0.1)');
  assert(shortPos.quantity === 0.2, 'Short quantity intact (0.2)');

  // Account margin check
  const acct = engine.getAccount();
  const expectedUsedMargin = Number((76.0 + 152.0).toFixed(2));
  assert(acct.usedMargin === expectedUsedMargin, 'Total used margin reflects both positions ($228.00)');
  assert(acct.freeMargin === Number((10000 - 228.0).toFixed(2)), 'Free margin reduced accurately');

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Partial and Full Position Closing
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 4] Partial and Full Position Closing');
  // Close 0.05 BTC of Short position (half of 0.2) at price 75000 (profit = (76000 - 75000) * 0.05 = $50)
  const partRes = engine.closePosition(shortPos.id, 75000, now + 2000, 0.05);
  assert(partRes.success, 'Partial close executed successfully');
  const updatedShort = engine.getPositions().find((p) => p.id === shortPos.id)!;
  assert(updatedShort.quantity === 0.15, 'Remaining short quantity is 0.15');
  assert(updatedShort.realizedPnL === 50.0, 'Realized P/L of $50 recorded on partial close');

  // Full close of Long position at 75500 (loss = (75500 - 76000) * 0.1 = -$50)
  const fullRes = engine.closePosition(longPos.id, 75500, now + 3000);
  assert(fullRes.success, 'Full close executed successfully');
  assert(engine.getPositions().length === 1, 'Closed position removed from open positions list');
  assert(engine.getState().closedPositions.length === 1, 'Closed position stored in historical positions ledger');
  assert(engine.getState().tradeRecords.length === 2, 'Two trade records created in trade history');

  // -------------------------------------------------------------------------
  // TEST GROUP 5: Pending Orders (Limit & Stop) & Gap Execution
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 5] Pending Orders & Favorable/Adverse Gaps');
  // Place Buy Limit at 74000
  const limitRes = engine.placeOrder(
    { direction: 'BUY', orderType: 'LIMIT', quantity: 0.1, requestedPrice: 74000 },
    75000,
    now + 4000
  );
  assert(limitRes.success, 'Buy Limit order queued');
  assert(engine.getPendingOrders().length === 1, 'Pending order registered');

  // Place Buy Stop at 77000
  const stopRes = engine.placeOrder(
    { direction: 'BUY', orderType: 'STOP', quantity: 0.1, requestedPrice: 77000 },
    75000,
    now + 4000
  );
  assert(stopRes.success, 'Buy Stop order queued');
  assert(engine.getPendingOrders().length === 2, 'Two pending orders registered');

  // Incoming M1 candle gaps down to 73800 and trades 73500 - 74100
  const m1GapDown: ApiCandle = {
    provider: 'BINANCE',
    instrumentId: 'BINANCE:BTCUSDT',
    timestamp: now + 60000,
    open: 73800, // Gapped down below 74000
    high: 74100,
    low: 73500,
    close: 73900,
    volume: 5.0,
    volumeDefinition: 'BASE_ASSET_VOLUME',
    priceBasis: 'LAST',
    timeframe: '1m',
    m1CandleCount: 1,
    isIncomplete: false,
  };

  engine.onTick(m1GapDown);

  // Buy Limit should be filled at favorable opening price 73800 (price improvement)
  const filledLimit = engine.getState().completedOrders.find((o) => o.id === limitRes.orderId)!;
  assert(filledLimit.status === 'FILLED', 'Buy Limit filled on M1 candle');
  assert(filledLimit.filledPrice === 73800, 'Price Improvement: Buy Limit filled at 73800 (gap open) instead of 74000');

  // Buy Stop should still be pending
  const stillPendingStop = engine.getPendingOrders().find((o) => o.id === stopRes.orderId);
  assert(stillPendingStop !== undefined, 'Buy Stop remains pending as high (74100) did not reach 77000');

  // Cancel Buy Stop
  const cancelOk = engine.cancelPendingOrder(stopRes.orderId!, now + 120000);
  assert(cancelOk, 'Pending order cancelled cleanly');
  assert(engine.getPendingOrders().length === 0, 'No remaining pending orders');

  // -------------------------------------------------------------------------
  // TEST GROUP 6: Protection Execution: Same-Candle Ambiguity & Gap Beyond SL
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 6] Protection Engine: Same-Candle Ambiguity & Adverse Gaps');
  // Open Long with SL=73500 and TP=74500
  const protOrder = engine.placeOrder(
    { direction: 'BUY', orderType: 'MARKET', quantity: 0.1, stopLoss: 73500, takeProfit: 74500 },
    73900,
    now + 180000
  );
  const protPos = engine.getPositions().find((p) => p.orderId === protOrder.orderId)!;

  // Case 6A: Same-Candle Ambiguity (both SL=73500 and TP=74500 touched in same candle)
  const m1Ambiguous: ApiCandle = {
    provider: 'BINANCE',
    instrumentId: 'BINANCE:BTCUSDT',
    timestamp: now + 240000,
    open: 74000,
    high: 75000, // Touches TP 74500
    low: 73000,  // Touches SL 73500
    close: 74200,
    volume: 10.0,
    volumeDefinition: 'BASE_ASSET_VOLUME',
    priceBasis: 'LAST',
    timeframe: '1m',
    m1CandleCount: 1,
    isIncomplete: false,
  };

  const protResults = ProtectionManager.evaluateProtections([protPos], m1Ambiguous);
  assert(protResults.length === 1, 'Protection trigger detected');
  assert(protResults[0].reason === 'SL', 'Conservative SL-first rule applied on same-candle ambiguity');
  assert(protResults[0].isAmbiguous === true, 'Marked as OHLC-ambiguous in execution record');

  // Case 6B: Gap beyond Stop Loss
  // New candle opens at 73200 (gapped below SL 73500)
  const m1GapSL: ApiCandle = {
    provider: 'BINANCE',
    instrumentId: 'BINANCE:BTCUSDT',
    timestamp: now + 300000,
    open: 73200, // 300 points below SL 73500
    high: 73400,
    low: 73000,
    close: 73100,
    volume: 8.0,
    volumeDefinition: 'BASE_ASSET_VOLUME',
    priceBasis: 'LAST',
    timeframe: '1m',
    m1CandleCount: 1,
    isIncomplete: false,
  };

  const gapProtResults = ProtectionManager.evaluateProtections([protPos], m1GapSL);
  assert(gapProtResults[0].exitPrice === 73200, 'Adverse Gap: Stop Loss filled at candle open (73200), not guaranteed requested SL');

  // -------------------------------------------------------------------------
  // TEST GROUP 7: Margin Stop-Out Execution
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 7] Margin Stop-Out Engine (Threshold: 50%)');
  const stopOutEngine = new TradingEngine('test_stopout', btcInstrument);
  // Reconfigure with small balance $1000 and 1:100 leverage
  stopOutEngine.configureAccount({ initialBalance: 1000, leverage: 100, stopOutLevel: 50 });

  // Open maximum position: 1.0 BTC at $76,000 -> required margin = $760. Free margin = $240.
  stopOutEngine.placeOrder(
    { direction: 'BUY', orderType: 'MARKET', quantity: 1.0 },
    76000,
    now
  );

  // Severe market crash candle: Price plunges to 75300 (Loss = -$700)
  // Equity = $1000 - $700 = $300. Used Margin = $760.
  // Margin Level = (300 / 760) * 100 = 39.47% <= 50% STOP-OUT!
  const m1Crash: ApiCandle = {
    provider: 'BINANCE',
    instrumentId: 'BINANCE:BTCUSDT',
    timestamp: now + 60000,
    open: 75800,
    high: 75800,
    low: 75200,
    close: 75300,
    volume: 50.0,
    volumeDefinition: 'BASE_ASSET_VOLUME',
    priceBasis: 'LAST',
    timeframe: '1m',
    m1CandleCount: 1,
    isIncomplete: false,
  };

  stopOutEngine.onTick(m1Crash);

  assert(stopOutEngine.getPositions().length === 0, 'Stop-Out automatically closed distressed position');
  const closedStopOut = stopOutEngine.getState().closedPositions[0];
  assert(closedStopOut.closeReason === 'STOP_OUT', 'Close reason recorded as STOP_OUT');
  const stopOutEvent = stopOutEngine.getState().events.find((e) => e.type === 'STOP_OUT');
  assert(stopOutEvent !== undefined, 'STOP_OUT event recorded in immutable trading ledger');

  // -------------------------------------------------------------------------
  // TEST GROUP 8: Reset Account Invariant
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 8] Account Reset');
  stopOutEngine.resetAccount(10000, 100, now + 120000);
  assert(stopOutEngine.getAccount().balance === 10000, 'Account balance restored to initial $10,000');
  assert(stopOutEngine.getAccount().equity === 10000, 'Account equity restored to $10,000');
  assert(stopOutEngine.getPositions().length === 0, 'Open positions cleared');
  assert(stopOutEngine.getAccount().isLocked === false, 'Account settings unlocked for new configuration');

  console.log('\n========================================================================');
  console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} (100% Deterministic & Verified)`);
  console.log('========================================================================\n');
}

runTradingEngineTestSuite().catch((err) => {
  console.error('Trading Engine test suite failed:', err);
  process.exit(1);
});

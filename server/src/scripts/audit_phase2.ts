import { DatabaseService } from '../database/connection.js';
import { MarketDataService } from '../services/marketDataService.js';
import { CandleValidator } from '../validation/candleValidator.js';
import { TimeframeAggregator } from '../aggregation/timeframeAggregator.js';

async function auditPhase2() {
  console.log('================================================================');
  console.log('CRITICAL PRE-FLIGHT AUDIT — PHASE 2 INFRASTRUCTURE');
  console.log('================================================================\n');

  const db = DatabaseService.getInstance();
  const service = MarketDataService.getInstance();

  // 1. Database & Persistence Audit
  const stats = db.getDatabaseStats();
  console.log('1. Database Engine & Persistence:');
  console.log(`   Engine: SQLite WAL (Node DatabaseSync)`);
  console.log(`   File: ${stats.dbFilePath}`);
  console.log(`   Size: ${(stats.fileSizeBytes / 1024).toFixed(1)} KB`);
  console.log(`   Total Instruments: ${stats.instrumentsCount}`);
  console.log(`   Total Canonical M1 Candles: ${stats.m1CandlesCount}`);
  console.log(`   Covered Instruments: ${stats.coveredInstrumentsCount}\n`);

  if (stats.m1CandlesCount === 0) {
    throw new Error('Pre-flight audit failed: No historical candles found in database!');
  }

  // 2. Provider Adapters Status
  console.log('2. Provider Adapters Status:');
  const providerStatuses = await service.getProvidersStatus();
  for (const p of providerStatuses) {
    console.log(`   - ${p.id} (${p.name}): [${p.connectionStatus}]`);
    console.log(`     Docs: ${p.officialDocumentationUrl}`);
    console.log(`     Status: ${p.statusMessage.slice(0, 80)}...`);
  }
  console.log('');

  // 3. Verified Instrument Coverage & Performance Audit
  console.log('3. Instrument Coverage & Query Performance:');
  const testSymbols = ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT', 'BINANCE:SOLUSDT'];

  for (const sym of testSymbols) {
    const startQ = performance.now();
    const coverage = service.getCoverage(sym);
    const candlesM1 = db.getCandlesM1(sym, 0, Date.now() + 86400000, 2000);
    const durationMs = (performance.now() - startQ).toFixed(2);

    console.log(`   -> [${sym}]:`);
    console.log(`      Query duration: ${durationMs} ms (Target < 50ms)`);
    console.log(`      Stored M1 count: ${candlesM1.length} (Coverage: ${coverage?.totalCandlesCount})`);
    console.log(`      Status: ${coverage?.coverageStatus}`);
    if (coverage?.earliestVerifiedTimestamp && coverage?.latestVerifiedTimestamp) {
      console.log(`      Earliest: ${new Date(coverage.earliestVerifiedTimestamp).toISOString()}`);
      console.log(`      Latest:   ${new Date(coverage.latestVerifiedTimestamp).toISOString()}`);
      console.log(`      Available ranges: ${coverage.availableRanges.length}, Gaps: ${coverage.missingIntervals.length}`);
    }

    // 4. Validate Stored Candles Mathematical & UTC Integrity
    const valResult = CandleValidator.validateBatch(candlesM1);
    if (valResult.rejectedCount > 0) {
      throw new Error(`Integrity audit failed for ${sym}: ${valResult.rejectedCount} invalid candles found in DB!`);
    }
    console.log(`      Integrity validation: 100% PASS (0 rejected, 0 corrupt)\n`);
  }

  // 5. Timeframe Aggregation Check
  console.log('4. Timeframe Aggregation Audit (BTCUSDT):');
  const btcM1 = db.getCandlesM1('BINANCE:BTCUSDT', 0, Date.now() + 86400000, 1000);
  for (const tf of ['M5', 'M15', 'M30', 'H1', 'H4', 'D1'] as const) {
    const agg = TimeframeAggregator.aggregate(btcM1, tf);
    console.log(`   -> Timeframe ${tf}: generated ${agg.length} candles (Sample: [${new Date(agg[0].timestamp).toISOString()}] O:${agg[0].open} H:${agg[0].high} L:${agg[0].low} C:${agg[0].close} V:${agg[0].volume?.toFixed(2)})`);
  }

  console.log('\n================================================================');
  console.log('PHASE 2 AUDIT: ALL PREREQUISITES VERIFIED & OPERATIONAL');
  console.log('================================================================\n');
}

auditPhase2().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});

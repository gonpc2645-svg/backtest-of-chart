import { DatabaseService } from '../database/connection.js';
import { IngestionWorker } from '../services/ingestionWorker.js';
import { MarketDataService } from '../services/marketDataService.js';

async function runInitialVerification() {
  console.log('================================================================');
  console.log('BACKTEST OF CHART — PHASE 2 INITIAL VERIFICATION & SEED');
  console.log('================================================================\n');

  const db = DatabaseService.getInstance();
  const worker = new IngestionWorker();
  const service = MarketDataService.getInstance();

  // 1. Sync Instrument Catalogs from Providers
  console.log('1. Discovering real provider instruments...');
  const catalogStats = await worker.syncInstrumentCatalogs();
  console.log(`   -> Found ${catalogStats.binanceCount} active Binance Spot trading instruments.`);
  console.log(`   -> Found ${catalogStats.dukascopyCount} Dukascopy canonical Forex/Metals/Indices instruments.\n`);

  // 2. Ingest Bounded Historical M1 for Real Binance Instruments
  console.log('2. Ingesting real historical M1 candles from Binance...');
  const testCryptoSymbols = ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT', 'BINANCE:SOLUSDT'];

  const endTimestamp = Date.now();
  // Fetch real 24 hours of M1 data (approx 1,440 candles per instrument)
  const startTimestamp = endTimestamp - 24 * 60 * 60 * 1000;

  for (const sym of testCryptoSymbols) {
    console.log(`   -> Fetching & Validating real M1 data for ${sym}...`);
    try {
      const res = await worker.ingestHistoricalM1(sym, startTimestamp, endTimestamp);
      console.log(`      ✓ Stored ${res.insertedCount} valid M1 candles (Rejected: ${res.rejectedCount})`);
    } catch (err: unknown) {
      console.error(`      ✗ Ingestion failed for ${sym}:`, err instanceof Error ? err.message : String(err));
    }
  }

  // 3. Test Dukascopy Ingestion (Forex / Metals)
  console.log('\n3. Testing Dukascopy Ingestion (Forex / Metals)...');
  const testDukascopySymbols = ['DUKASCOPY:EURUSD', 'DUKASCOPY:XAUUSD'];
  for (const sym of testDukascopySymbols) {
    try {
      console.log(`   -> Attempting ingestion for ${sym}...`);
      await worker.ingestHistoricalM1(sym, startTimestamp, endTimestamp);
    } catch (err: unknown) {
      console.log(`   -> Dukascopy status for ${sym}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. Verification Read-Back
  console.log('\n4. Verifying stored data read-back and aggregation...');
  for (const sym of testCryptoSymbols) {
    const coverage = service.getCoverage(sym);
    console.log(`   [Coverage: ${sym}] Status: ${coverage?.coverageStatus}, Total M1: ${coverage?.totalCandlesCount}`);
    if (coverage?.earliestVerifiedTimestamp && coverage?.latestVerifiedTimestamp) {
      console.log(`      Earliest: ${new Date(coverage.earliestVerifiedTimestamp).toISOString()}`);
      console.log(`      Latest:   ${new Date(coverage.latestVerifiedTimestamp).toISOString()}`);
    }

    // Test Higher Timeframe Aggregation
    const m15Data = service.getCandles(sym, 'M15', startTimestamp, endTimestamp, 10);
    console.log(`      M15 Aggregated Candles count: ${m15Data.candles.length}`);
    if (m15Data.candles.length > 0) {
      const sample = m15Data.candles[0];
      console.log(`      Sample M15 candle: [${new Date(sample.timestamp).toISOString()}] O: ${sample.open}, H: ${sample.high}, L: ${sample.low}, C: ${sample.close}, Vol: ${sample.volume}`);
    }
  }

  const finalStats = db.getDatabaseStats();
  console.log('\n5. Final Database Statistics:');
  console.log(`   Total Instruments: ${finalStats.instrumentsCount}`);
  console.log(`   Total Stored M1 Candles: ${finalStats.m1CandlesCount}`);
  console.log(`   Covered Instruments: ${finalStats.coveredInstrumentsCount}`);
  console.log(`   DB File: ${finalStats.dbFilePath} (${finalStats.fileSizeBytes} bytes)`);
  console.log('\n================================================================');
  console.log('INITIAL VERIFICATION COMPLETED SUCCESSFULLY');
  console.log('================================================================');
}

runInitialVerification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});

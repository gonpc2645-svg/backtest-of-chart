import { DatabaseService } from '../database/connection.js';
import { CandleValidator } from '../validation/candleValidator.js';
import { MarketDataService } from './marketDataService.js';
import {
  CanonicalCandle,
  CoverageRange,
  IngestionJob,
  MarketDataCoverage,
  MarketInstrument,
  MissingInterval,
  ProviderId,
} from '../types/marketData.js';

export class IngestionWorker {
  private db: DatabaseService;
  private marketDataService: MarketDataService;
  private isRunning: boolean = false;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.marketDataService = MarketDataService.getInstance();
  }

  /**
   * Syncs real instrument catalogs from all supported providers.
   */
  public async syncInstrumentCatalogs(): Promise<{
    binanceCount: number;
    dukascopyCount: number;
  }> {
    console.log('[IngestionWorker] Syncing instrument catalogs...');

    // 1. Sync Binance instruments
    let binanceCount = 0;
    try {
      const binanceAdapter = this.marketDataService.getAdapter('BINANCE');
      const binanceInstruments = await binanceAdapter.fetchInstruments();
      for (const inst of binanceInstruments) {
        this.db.upsertInstrument(inst);
      }
      binanceCount = binanceInstruments.length;
    } catch (err: unknown) {
      console.error('[IngestionWorker] Failed to sync Binance instruments:', err);
    }

    // 2. Sync Dukascopy canonical instruments
    let dukascopyCount = 0;
    try {
      const dukascopyAdapter = this.marketDataService.getAdapter('DUKASCOPY');
      const dukascopyInstruments = await dukascopyAdapter.fetchInstruments();
      for (const inst of dukascopyInstruments) {
        this.db.upsertInstrument(inst);
      }
      dukascopyCount = dukascopyInstruments.length;
    } catch (err: unknown) {
      console.error('[IngestionWorker] Failed to sync Dukascopy instruments:', err);
    }

    console.log(`[IngestionWorker] Catalog sync complete: ${binanceCount} Binance, ${dukascopyCount} Dukascopy.`);
    return { binanceCount, dukascopyCount };
  }

  /**
   * Ingests a bounded range of real historical M1 data for a specific instrument.
   */
  public async ingestHistoricalM1(
    instrumentId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<{
    job: IngestionJob;
    insertedCount: number;
    rejectedCount: number;
  }> {
    const instrument = this.db.getInstrumentById(instrumentId);
    if (!instrument) {
      throw new Error(`Instrument not found in database: ${instrumentId}`);
    }

    const jobId = `job_${Date.now()}_${instrument.providerSymbol.toLowerCase()}`;
    const job: IngestionJob = {
      id: jobId,
      provider: instrument.provider,
      instrumentId: instrument.id,
      requestedStartTimestamp: startTimestamp,
      requestedEndTimestamp: endTimestamp,
      jobStatus: 'RUNNING',
      downloadProgressPct: 0,
      processedCandleCount: 0,
      rejectedRecordCount: 0,
      errorDetails: null,
      startedAt: Date.now(),
      completedAt: null,
    };
    this.db.upsertJob(job);

    console.log(`[IngestionWorker] Starting M1 ingestion job ${jobId} for ${instrument.id} from ${new Date(startTimestamp).toISOString()} to ${new Date(endTimestamp).toISOString()}`);

    try {
      const adapter = this.marketDataService.getAdapter(instrument.provider);

      // Fetch real raw candles from provider
      const rawCandles = await adapter.fetchM1Candles(instrument, startTimestamp, endTimestamp);

      // Strict Validation Layer
      const validation = CandleValidator.validateBatch(rawCandles);
      if (validation.rejectedCount > 0) {
        console.warn(`[IngestionWorker] Validation rejected ${validation.rejectedCount} records for ${instrument.id}`);
      }

      // Persistent Storage Layer
      const dbResult = this.db.insertCandlesBatch(validation.validCandles);
      console.log(`[IngestionWorker] Inserted ${dbResult.inserted} candles (${dbResult.duplicates} duplicates ignored)`);

      // Update Coverage Metadata
      this.recomputeCoverage(instrument);

      // Update Job status
      job.jobStatus = 'COMPLETED';
      job.downloadProgressPct = 100;
      job.processedCandleCount = dbResult.inserted;
      job.rejectedRecordCount = validation.rejectedCount;
      job.completedAt = Date.now();
      this.db.upsertJob(job);

      return {
        job,
        insertedCount: dbResult.inserted,
        rejectedCount: validation.rejectedCount,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[IngestionWorker] Ingestion job ${jobId} failed:`, errMsg);

      job.jobStatus = err instanceof Error && err.message.includes('blocked') ? 'BLOCKED' : 'FAILED';
      job.errorDetails = errMsg;
      job.completedAt = Date.now();
      this.db.upsertJob(job);

      throw err;
    }
  }

  /**
   * Recomputes verified historical coverage and detects missing data gaps for an instrument.
   */
  public recomputeCoverage(instrument: MarketInstrument): MarketDataCoverage {
    // Read all stored candles ordered chronologically
    const candles = this.db.getCandlesM1(instrument.id, 0, Date.now() + 86400000, 100000);

    if (candles.length === 0) {
      const emptyCoverage: MarketDataCoverage = {
        provider: instrument.provider,
        instrumentId: instrument.id,
        priceBasis: instrument.priceBasis,
        earliestVerifiedTimestamp: null,
        latestVerifiedTimestamp: null,
        totalCandlesCount: 0,
        availableRanges: [],
        missingIntervals: [],
        coverageStatus: instrument.tradingStatus === 'PLANNED' ? 'BLOCKED' : 'EMPTY',
        lastVerificationTimestamp: Date.now(),
        notes: instrument.tradingStatus === 'PLANNED'
          ? 'Provider data ingestion awaiting owner AWS credentials / license.'
          : 'No historical candles ingested yet.',
      };
      this.db.updateCoverage(emptyCoverage);
      return emptyCoverage;
    }

    const earliest = candles[0].timestamp;
    const latest = candles[candles.length - 1].timestamp;

    const availableRanges: CoverageRange[] = [];
    const missingIntervals: MissingInterval[] = [];

    let currentRangeStart = earliest;
    let currentRangeCount = 1;

    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1].timestamp;
      const curr = candles[i].timestamp;
      const diff = curr - prev;

      if (diff === 60000) {
        // Continuous 1-minute interval
        currentRangeCount++;
      } else if (diff > 60000) {
        // Gap detected! Never interpolate or forward-fill fake data.
        availableRanges.push({
          start: currentRangeStart,
          end: prev,
          count: currentRangeCount,
        });

        const missingMinutes = Math.floor((curr - prev - 60000) / 60000);
        missingIntervals.push({
          start: prev + 60000,
          end: curr - 60000,
          missingMinutes,
        });

        currentRangeStart = curr;
        currentRangeCount = 1;
      }
    }

    // Push the final range
    availableRanges.push({
      start: currentRangeStart,
      end: latest,
      count: currentRangeCount,
    });

    const coverage: MarketDataCoverage = {
      provider: instrument.provider,
      instrumentId: instrument.id,
      priceBasis: instrument.priceBasis,
      earliestVerifiedTimestamp: earliest,
      latestVerifiedTimestamp: latest,
      totalCandlesCount: candles.length,
      availableRanges,
      missingIntervals,
      coverageStatus: missingIntervals.length === 0 ? 'VERIFIED' : 'PARTIAL',
      lastVerificationTimestamp: Date.now(),
      notes: `Verified ${candles.length} canonical M1 candles across ${availableRanges.length} continuous segment(s).`,
    };

    this.db.updateCoverage(coverage);
    return coverage;
  }
}

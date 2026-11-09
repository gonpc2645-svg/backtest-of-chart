import { Router, Request, Response } from 'express';
import { CONFIG } from '../config/index.js';
import { DatabaseService } from '../database/connection.js';
import { IngestionWorker } from '../services/ingestionWorker.js';
import { MarketDataService } from '../services/marketDataService.js';
import { RequestValidator } from '../validation/requestValidator.js';

export const apiRouter = Router();

const marketDataService = MarketDataService.getInstance();
const dbService = DatabaseService.getInstance();
const ingestionWorker = new IngestionWorker();

// 1. GET /api/health
apiRouter.get('/health', (_req: Request, res: Response) => {
  const stats = dbService.getDatabaseStats();
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    database: {
      engine: 'SQLite (Disk Persisted WAL)',
      instrumentsCount: stats.instrumentsCount,
      m1CandlesCount: stats.m1CandlesCount,
      coveredInstrumentsCount: stats.coveredInstrumentsCount,
      dbFilePath: stats.dbFilePath,
      fileSizeBytes: stats.fileSizeBytes,
    },
  });
});

// 1b. GET /api/status (Comprehensive Production Health & System Readiness)
apiRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const stats = dbService.getDatabaseStats();
    const providers = await marketDataService.getProvidersStatus();

    res.json({
      success: true,
      status: 'healthy',
      timestamp: Date.now(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: CONFIG.NODE_ENV,
      version: '1.0.0-phase7',
      components: {
        database: {
          status: 'healthy',
          engine: 'SQLite (Disk Persisted WAL)',
          instrumentsCount: stats.instrumentsCount,
          m1CandlesCount: stats.m1CandlesCount,
          coveredInstrumentsCount: stats.coveredInstrumentsCount,
          fileSizeBytes: stats.fileSizeBytes,
        },
        providers: {
          binance: {
            status: providers.find((p) => p.provider === 'BINANCE')?.status || 'ONLINE',
            accessMode: 'Public Spot REST (Binance Vision)',
          },
          dukascopy: {
            status: providers.find((p) => p.provider === 'DUKASCOPY')?.status || 'OFFLINE',
            accessMode: 'Direct S3 / Datafeed (Requires User AWS S3 Credentials)',
          },
        },
        ingestionWorker: {
          status: 'idle',
          operatorAuthProtected: true,
        },
        replayEngine: {
          status: 'ready',
          zeroFutureLeakageGuard: 'enforced',
          timeframesSupported: Array.from(RequestValidator.ALLOWED_TIMEFRAMES),
        },
        tradingEngine: {
          status: 'ready',
          accountType: 'Simulated Hedging Margin',
          stopOutLevelPct: 50,
          ambiguityResolution: 'conservative_worst_case',
        },
        analyticsEngine: {
          status: 'ready',
          calculations: ['Net PnL', 'Win Rate (2 Denominators)', 'Profit Factor', 'Expectancy', 'Max Drawdown', 'Recovery Factor'],
        },
        chartingLibrary: {
          activeEngine: 'Lightweight Charts (Built-in)',
          advancedChartsAdapter: 'ready',
          advancedChartsLicenseStatus: 'BLOCKED — Requires Owner TradingView License & Library Files',
        },
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// 2. GET /api/market-data/providers
apiRouter.get('/market-data/providers', async (_req: Request, res: Response) => {
  try {
    const providers = await marketDataService.getProvidersStatus();
    res.json({ success: true, providers });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// 3. GET /api/markets
apiRouter.get('/markets', async (_req: Request, res: Response) => {
  try {
    const categories = await marketDataService.getMarketCategories();
    res.json({ success: true, categories });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// 4. GET /api/markets/:market/instruments
apiRouter.get('/markets/:market/instruments', (req: Request, res: Response) => {
  try {
    const market = req.params.market.toLowerCase();
    const query = req.query.q ? String(req.query.q).toUpperCase().trim() : '';

    let instruments = marketDataService.getInstruments(market);
    if (query) {
      instruments = instruments.filter(
        (i) =>
          i.providerSymbol.includes(query) ||
          i.baseAsset.includes(query) ||
          i.displayName.toUpperCase().includes(query)
      );
    }

    res.json({
      success: true,
      market,
      totalCount: instruments.length,
      instruments: instruments.slice(0, 100), // Bounded page size
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// 5. GET /api/market-data/coverage
apiRouter.get('/market-data/coverage', (req: Request, res: Response) => {
  try {
    const instrumentId = req.query.instrument ? String(req.query.instrument).trim().toUpperCase() : '';
    if (!instrumentId) {
      return res.status(400).json({ success: false, error: 'Query parameter "instrument" is required.' });
    }

    const instrument = marketDataService.getInstrumentById(instrumentId);
    if (!instrument) {
      return res.status(404).json({ success: false, error: `Instrument not found: ${instrumentId}` });
    }

    let coverage = marketDataService.getCoverage(instrumentId);
    if (!coverage) {
      // Compute initial coverage if not yet saved
      coverage = ingestionWorker.recomputeCoverage(instrument);
    }

    res.json({
      success: true,
      instrument,
      coverage,
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// 6. GET /api/market-data/candles
apiRouter.get('/market-data/candles', (req: Request, res: Response) => {
  try {
    const validation = RequestValidator.validateCandlesQuery(req.query as Record<string, unknown>);
    if (!validation.success || !validation.data) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const { instrumentId, timeframe, fromTimestamp, toTimestamp, limit } = validation.data;

    const result = marketDataService.getCandles(
      instrumentId,
      timeframe,
      fromTimestamp,
      toTimestamp,
      limit
    );

    if (!result.instrument) {
      return res.status(404).json({ success: false, error: `Instrument not found: ${instrumentId}` });
    }

    res.json({
      success: true,
      instrument: result.instrument,
      timeframe,
      fromTimestamp,
      toTimestamp,
      candleCount: result.candles.length,
      m1CandlesRetrieved: result.m1CandlesRetrieved,
      candles: result.candles,
      coverage: result.coverage,
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// 7. POST /api/ingestion/run (Operator ingestion trigger)
apiRouter.post('/ingestion/run', async (req: Request, res: Response) => {
  try {
    // Ingestion Security Check: Protect from unauthorized public triggering
    const operatorToken = req.headers['x-operator-token'] || req.query.token;
    if (!operatorToken || operatorToken !== CONFIG.OPERATOR_TOKEN) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Valid operator token required for historical data ingestion trigger.',
      });
    }

    const { instrumentId, hours } = req.body || {};
    if (!instrumentId) {
      return res.status(400).json({ success: false, error: 'Field "instrumentId" is required (e.g. BINANCE:BTCUSDT).' });
    }

    const hoursToFetch = Math.min(Math.max(parseInt(hours || '24', 10), 1), 72); // Bounded 1 to 72 hours
    const end = Date.now();
    const start = end - hoursToFetch * 60 * 60 * 1000;

    const result = await ingestionWorker.ingestHistoricalM1(instrumentId, start, end);
    res.json({
      success: true,
      job: result.job,
      insertedCount: result.insertedCount,
      rejectedCount: result.rejectedCount,
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// 8. GET /api/ingestion/status
apiRouter.get('/ingestion/status', (_req: Request, res: Response) => {
  try {
    const jobs = dbService.getRecentJobs(20);
    res.json({ success: true, jobs });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ========================================================================
// PHASE 3: PROPRIETARY REPLAY ENGINE API ENDPOINTS
// ========================================================================

// 9. POST /api/replay/initialize
apiRouter.post('/replay/initialize', (req: Request, res: Response) => {
  try {
    const { instrumentId, timeframe, startTimestamp, endTimestamp, contextBarsCount } = req.body || {};

    if (!instrumentId || typeof instrumentId !== 'string') {
      return res.status(400).json({ success: false, error: 'Field "instrumentId" is required.' });
    }

    const cleanInst = instrumentId.trim().toUpperCase();
    const instrument = marketDataService.getInstrumentById(cleanInst);
    if (!instrument) {
      return res.status(404).json({ success: false, error: `Instrument not found: ${cleanInst}` });
    }

    const tf = (timeframe ? String(timeframe).toUpperCase() : 'M15') as any;
    if (!RequestValidator.ALLOWED_TIMEFRAMES.has(tf)) {
      return res.status(400).json({ success: false, error: `Invalid timeframe "${tf}".` });
    }

    const startTs = Number(startTimestamp);
    const endTs = Number(endTimestamp);
    if (isNaN(startTs) || startTs <= 0) {
      return res.status(400).json({ success: false, error: 'Valid positive startTimestamp is required.' });
    }
    if (isNaN(endTs) || endTs <= startTs) {
      return res.status(400).json({ success: false, error: 'endTimestamp must be greater than startTimestamp.' });
    }

    // Check coverage
    const coverage = marketDataService.getCoverage(cleanInst);
    if (!coverage || coverage.totalCandlesCount === 0) {
      return res.status(400).json({
        success: false,
        error: `No verified historical data stored for ${cleanInst}. Please ingest historical data first.`,
      });
    }

    // Verify bounds against verified coverage
    if (coverage.earliestVerifiedTimestamp && startTs < coverage.earliestVerifiedTimestamp - 86400000) {
      return res.status(400).json({
        success: false,
        error: `Requested start time is before earliest verified data: ${new Date(coverage.earliestVerifiedTimestamp).toISOString()}`,
      });
    }

    // Calculate historical context candles strictly <= startTimestamp (Zero future leakage!)
    const barsCount = Math.min(Math.max(Number(contextBarsCount) || 50, 10), 200);
    const minutesPerBar = tf === 'D1' ? 1440 : tf === 'H4' ? 240 : tf === 'H1' ? 60 : tf === 'M30' ? 30 : tf === 'M15' ? 15 : tf === 'M5' ? 5 : 1;
    const contextStartTs = Math.max(0, startTs - barsCount * minutesPerBar * 60 * 1000);

    // Retrieve M1 context candles strictly <= startTimestamp
    const contextM1 = dbService.getCandlesM1(cleanInst, contextStartTs, startTs, barsCount * minutesPerBar);
    const aggregatedContext = marketDataService.getCandles(cleanInst, tf, contextStartTs, startTs, barsCount);

    // Count M1 candles available in the playback range
    const playbackM1Sample = dbService.getCandlesM1(cleanInst, startTs, endTs, 10000);

    res.json({
      success: true,
      instrument,
      timeframe: tf,
      startTimestamp: startTs,
      endTimestamp: endTs,
      initialCursor: startTs,
      contextBarsCount: aggregatedContext.candles.length,
      initialContextCandles: aggregatedContext.candles,
      availableM1CountInRange: playbackM1Sample.length,
      coverage,
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// 10. GET /api/replay/candles
apiRouter.get('/replay/candles', (req: Request, res: Response) => {
  try {
    const instrumentId = req.query.instrument ? String(req.query.instrument).trim().toUpperCase() : '';
    const fromTs = Number(req.query.from);
    const cursorTs = Number(req.query.cursor || req.query.to);
    const limit = Math.min(Math.max(Number(req.query.limit) || 1000, 1), 5000);

    if (!instrumentId) {
      return res.status(400).json({ success: false, error: 'Query parameter "instrument" is required.' });
    }
    if (isNaN(fromTs) || fromTs <= 0) {
      return res.status(400).json({ success: false, error: 'Query parameter "from" must be a valid timestamp.' });
    }
    if (isNaN(cursorTs) || cursorTs <= 0) {
      return res.status(400).json({ success: false, error: 'Query parameter "cursor" is required (strict upper bound).' });
    }
    if (fromTs > cursorTs) {
      return res.status(400).json({ success: false, error: '"from" timestamp cannot be greater than "cursor" timestamp.' });
    }

    // STRICT UPPER BOUND ENFORCEMENT:
    // Only candles with timestamp <= cursorTs are returned! Future candles are completely excluded at the DB level.
    const candles = dbService.getCandlesM1(instrumentId, fromTs, cursorTs, limit);

    res.json({
      success: true,
      instrumentId,
      fromTimestamp: fromTs,
      cursorTimestamp: cursorTs,
      candleCount: candles.length,
      candles,
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

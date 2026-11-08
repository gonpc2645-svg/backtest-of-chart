import { Router, Request, Response } from 'express';
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

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../config/index.js';
import { CanonicalCandle, MarketDataCoverage, MarketInstrument, IngestionJob } from '../types/marketData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private db: DatabaseSync;
  private isPostgresActive: boolean = false;

  private constructor() {
    const dbPath = CONFIG.DATABASE.SQLITE_PATH;
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    // Optimize performance and durability for financial candles
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    this.runMigrations();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private runMigrations(): void {
    const schemaSqlPath = path.resolve(__dirname, 'schema.sql');
    let schemaSql = '';
    if (fs.existsSync(schemaSqlPath)) {
      schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
    } else {
      // Fallback inline schema
      schemaSql = `
        CREATE TABLE IF NOT EXISTS market_instruments (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          provider_symbol TEXT NOT NULL,
          base_asset TEXT NOT NULL,
          quote_asset TEXT NOT NULL,
          market_category TEXT NOT NULL,
          display_name TEXT NOT NULL,
          trading_status TEXT NOT NULL,
          price_basis TEXT NOT NULL,
          availability_metadata TEXT,
          last_sync_timestamp INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS historical_candles_m1 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider TEXT NOT NULL,
          instrument_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          open REAL NOT NULL,
          high REAL NOT NULL,
          low REAL NOT NULL,
          close REAL NOT NULL,
          volume REAL,
          volume_definition TEXT NOT NULL,
          price_basis TEXT NOT NULL,
          source_interval TEXT NOT NULL DEFAULT '1m',
          source_metadata TEXT,
          ingested_at INTEGER NOT NULL,
          UNIQUE(provider, instrument_id, price_basis, timestamp)
        );
        CREATE TABLE IF NOT EXISTS market_data_coverage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider TEXT NOT NULL,
          instrument_id TEXT NOT NULL,
          price_basis TEXT NOT NULL,
          earliest_verified_timestamp INTEGER,
          latest_verified_timestamp INTEGER,
          total_candles_count INTEGER NOT NULL DEFAULT 0,
          available_ranges TEXT NOT NULL DEFAULT '[]',
          missing_intervals TEXT NOT NULL DEFAULT '[]',
          coverage_status TEXT NOT NULL DEFAULT 'EMPTY',
          last_verification_timestamp INTEGER NOT NULL,
          notes TEXT,
          UNIQUE(provider, instrument_id, price_basis)
        );
        CREATE TABLE IF NOT EXISTS data_ingestion_jobs (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          instrument_id TEXT NOT NULL,
          requested_start_timestamp INTEGER NOT NULL,
          requested_end_timestamp INTEGER NOT NULL,
          job_status TEXT NOT NULL,
          download_progress_pct REAL NOT NULL DEFAULT 0.0,
          processed_candle_count INTEGER NOT NULL DEFAULT 0,
          rejected_record_count INTEGER NOT NULL DEFAULT 0,
          error_details TEXT,
          started_at INTEGER NOT NULL,
          completed_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS fetched_day_cache (
          instrument_id TEXT NOT NULL,
          utc_date TEXT NOT NULL,
          source TEXT NOT NULL,
          resolution TEXT NOT NULL,
          is_canonical_m1 INTEGER NOT NULL DEFAULT 1,
          candle_count INTEGER NOT NULL DEFAULT 0,
          note TEXT,
          fetched_at INTEGER NOT NULL,
          PRIMARY KEY (instrument_id, utc_date)
        );
        CREATE TABLE IF NOT EXISTS auth_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          full_name TEXT,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS auth_sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        );
      `;
    }

    this.db.exec(schemaSql);

    // Purge any legacy synthetic DUKASCOPY rows created before genuine .bi5 / FXCM verification metadata existed
    try {
      this.db.exec(`DELETE FROM historical_candles_m1 WHERE provider = 'DUKASCOPY' AND source_metadata IS NULL;`);
    } catch {
      // ignore if table not ready
    }
  }

  // --- Instrument Operations ---

  public upsertInstrument(instrument: MarketInstrument): void {
    const stmt = this.db.prepare(`
      INSERT INTO market_instruments (
        id, provider, provider_symbol, base_asset, quote_asset,
        market_category, display_name, trading_status, price_basis,
        availability_metadata, last_sync_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        trading_status = excluded.trading_status,
        display_name = excluded.display_name,
        availability_metadata = excluded.availability_metadata,
        last_sync_timestamp = excluded.last_sync_timestamp
    `);

    stmt.run(
      instrument.id,
      instrument.provider,
      instrument.providerSymbol,
      instrument.baseAsset,
      instrument.quoteAsset,
      instrument.marketCategory,
      instrument.displayName,
      instrument.tradingStatus,
      instrument.priceBasis,
      JSON.stringify(instrument.availabilityMetadata),
      instrument.lastSyncTimestamp
    );
  }

  public getInstruments(category?: string, provider?: string): MarketInstrument[] {
    let sql = 'SELECT * FROM market_instruments WHERE 1=1';
    const params: unknown[] = [];

    if (category) {
      sql += ' AND market_category = ?';
      params.push(category);
    }
    if (provider) {
      sql += ' AND provider = ?';
      params.push(provider);
    }

    sql += ' ORDER BY provider ASC, base_asset ASC';
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: String(r.id),
      provider: r.provider as MarketInstrument['provider'],
      providerSymbol: String(r.provider_symbol),
      baseAsset: String(r.base_asset),
      quoteAsset: String(r.quote_asset),
      marketCategory: r.market_category as MarketInstrument['marketCategory'],
      displayName: String(r.display_name),
      tradingStatus: r.trading_status as MarketInstrument['tradingStatus'],
      priceBasis: r.price_basis as MarketInstrument['priceBasis'],
      availabilityMetadata: r.availability_metadata ? JSON.parse(String(r.availability_metadata)) : {},
      lastSyncTimestamp: Number(r.last_sync_timestamp),
    }));
  }

  public getInstrumentById(id: string): MarketInstrument | null {
    const row = this.db.prepare('SELECT * FROM market_instruments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: String(row.id),
      provider: row.provider as MarketInstrument['provider'],
      providerSymbol: String(row.provider_symbol),
      baseAsset: String(row.base_asset),
      quoteAsset: String(row.quote_asset),
      marketCategory: row.market_category as MarketInstrument['marketCategory'],
      displayName: String(row.display_name),
      tradingStatus: row.trading_status as MarketInstrument['tradingStatus'],
      priceBasis: row.price_basis as MarketInstrument['priceBasis'],
      availabilityMetadata: row.availability_metadata ? JSON.parse(String(row.availability_metadata)) : {},
      lastSyncTimestamp: Number(row.last_sync_timestamp),
    };
  }

  // --- Candle Batch Operations ---

  public insertCandlesBatch(
    candles: CanonicalCandle[],
    replaceExisting: boolean = false
  ): { inserted: number; duplicates: number } {
    if (candles.length === 0) return { inserted: 0, duplicates: 0 };

    const conflictAction = replaceExisting ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
    const stmt = this.db.prepare(`
      ${conflictAction} INTO historical_candles_m1 (
        provider, instrument_id, timestamp, open, high, low, close,
        volume, volume_definition, price_basis, source_interval,
        source_metadata, ingested_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    this.db.exec('BEGIN TRANSACTION;');
    try {
      for (const c of candles) {
        const result = stmt.run(
          c.provider,
          c.instrumentId,
          c.timestamp,
          c.open,
          c.high,
          c.low,
          c.close,
          c.volume,
          c.volumeDefinition,
          c.priceBasis,
          c.sourceInterval || '1m',
          c.sourceMetadata ? JSON.stringify(c.sourceMetadata) : null,
          c.ingestedAt || Date.now()
        );
        if (result.changes > 0) inserted++;
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return {
      inserted,
      duplicates: candles.length - inserted,
    };
  }

  public getFetchedDayMeta(instrumentId: string, utcDate: string): {
    instrumentId: string;
    utcDate: string;
    source: string;
    resolution: string;
    isCanonicalM1: boolean;
    candleCount: number;
    note?: string;
    fetchedAt: number;
  } | null {
    const row = this.db
      .prepare('SELECT * FROM fetched_day_cache WHERE instrument_id = ? AND utc_date = ?')
      .get(instrumentId, utcDate) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      instrumentId: String(row.instrument_id),
      utcDate: String(row.utc_date),
      source: String(row.source),
      resolution: String(row.resolution),
      isCanonicalM1: Number(row.is_canonical_m1) === 1,
      candleCount: Number(row.candle_count),
      note: row.note ? String(row.note) : undefined,
      fetchedAt: Number(row.fetched_at),
    };
  }

  public upsertFetchedDayMeta(meta: {
    instrumentId: string;
    utcDate: string;
    source: string;
    resolution: string;
    isCanonicalM1: boolean;
    candleCount: number;
    note?: string;
    fetchedAt: number;
  }): void {
    this.db
      .prepare(`
        INSERT INTO fetched_day_cache (
          instrument_id, utc_date, source, resolution,
          is_canonical_m1, candle_count, note, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(instrument_id, utc_date) DO UPDATE SET
          source = excluded.source,
          resolution = excluded.resolution,
          is_canonical_m1 = excluded.is_canonical_m1,
          candle_count = excluded.candle_count,
          note = excluded.note,
          fetched_at = excluded.fetched_at
      `)
      .run(
        meta.instrumentId,
        meta.utcDate,
        meta.source,
        meta.resolution,
        meta.isCanonicalM1 ? 1 : 0,
        meta.candleCount,
        meta.note || null,
        meta.fetchedAt
      );
  }

  public getCandlesM1(
    instrumentId: string,
    fromTimestamp: number,
    toTimestamp: number,
    limit: number = 5000
  ): CanonicalCandle[] {
    const rows = this.db.prepare(`
      SELECT * FROM historical_candles_m1
      WHERE instrument_id = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
      LIMIT ?
    `).all(instrumentId, fromTimestamp, toTimestamp, limit) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: Number(r.id),
      provider: r.provider as CanonicalCandle['provider'],
      instrumentId: String(r.instrument_id),
      timestamp: Number(r.timestamp),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: r.volume !== null && r.volume !== undefined ? Number(r.volume) : null,
      volumeDefinition: r.volume_definition as CanonicalCandle['volumeDefinition'],
      priceBasis: r.price_basis as CanonicalCandle['priceBasis'],
      sourceInterval: String(r.source_interval),
      sourceMetadata: r.source_metadata ? JSON.parse(String(r.source_metadata)) : undefined,
      ingestedAt: Number(r.ingested_at),
    }));
  }

  // --- Coverage Operations ---

  public updateCoverage(coverage: MarketDataCoverage): void {
    const stmt = this.db.prepare(`
      INSERT INTO market_data_coverage (
        provider, instrument_id, price_basis, earliest_verified_timestamp,
        latest_verified_timestamp, total_candles_count, available_ranges,
        missing_intervals, coverage_status, last_verification_timestamp, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, instrument_id, price_basis) DO UPDATE SET
        earliest_verified_timestamp = excluded.earliest_verified_timestamp,
        latest_verified_timestamp = excluded.latest_verified_timestamp,
        total_candles_count = excluded.total_candles_count,
        available_ranges = excluded.available_ranges,
        missing_intervals = excluded.missing_intervals,
        coverage_status = excluded.coverage_status,
        last_verification_timestamp = excluded.last_verification_timestamp,
        notes = excluded.notes
    `);

    stmt.run(
      coverage.provider,
      coverage.instrumentId,
      coverage.priceBasis,
      coverage.earliestVerifiedTimestamp,
      coverage.latestVerifiedTimestamp,
      coverage.totalCandlesCount,
      JSON.stringify(coverage.availableRanges),
      JSON.stringify(coverage.missingIntervals),
      coverage.coverageStatus,
      coverage.lastVerificationTimestamp,
      coverage.notes || null
    );
  }

  public getCoverage(instrumentId: string): MarketDataCoverage | null {
    const row = this.db.prepare(`
      SELECT * FROM market_data_coverage WHERE instrument_id = ?
    `).get(instrumentId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      provider: row.provider as MarketDataCoverage['provider'],
      instrumentId: String(row.instrument_id),
      priceBasis: row.price_basis as MarketDataCoverage['priceBasis'],
      earliestVerifiedTimestamp: row.earliest_verified_timestamp ? Number(row.earliest_verified_timestamp) : null,
      latestVerifiedTimestamp: row.latest_verified_timestamp ? Number(row.latest_verified_timestamp) : null,
      totalCandlesCount: Number(row.total_candles_count),
      availableRanges: row.available_ranges ? JSON.parse(String(row.available_ranges)) : [],
      missingIntervals: row.missing_intervals ? JSON.parse(String(row.missing_intervals)) : [],
      coverageStatus: row.coverage_status as MarketDataCoverage['coverageStatus'],
      lastVerificationTimestamp: Number(row.last_verification_timestamp),
      notes: row.notes ? String(row.notes) : undefined,
    };
  }

  // --- Ingestion Job Tracking ---

  public upsertJob(job: IngestionJob): void {
    const stmt = this.db.prepare(`
      INSERT INTO data_ingestion_jobs (
        id, provider, instrument_id, requested_start_timestamp,
        requested_end_timestamp, job_status, download_progress_pct,
        processed_candle_count, rejected_record_count, error_details,
        started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        job_status = excluded.job_status,
        download_progress_pct = excluded.download_progress_pct,
        processed_candle_count = excluded.processed_candle_count,
        rejected_record_count = excluded.rejected_record_count,
        error_details = excluded.error_details,
        completed_at = excluded.completed_at
    `);

    stmt.run(
      job.id,
      job.provider,
      job.instrumentId,
      job.requestedStartTimestamp,
      job.requestedEndTimestamp,
      job.jobStatus,
      job.downloadProgressPct,
      job.processedCandleCount,
      job.rejectedRecordCount,
      job.errorDetails,
      job.startedAt,
      job.completedAt
    );
  }

  public getRecentJobs(limit: number = 20): IngestionJob[] {
    const rows = this.db.prepare(`
      SELECT * FROM data_ingestion_jobs ORDER BY started_at DESC LIMIT ?
    `).all(limit) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: String(r.id),
      provider: r.provider as IngestionJob['provider'],
      instrumentId: String(r.instrument_id),
      requestedStartTimestamp: Number(r.requested_start_timestamp),
      requestedEndTimestamp: Number(r.requested_end_timestamp),
      jobStatus: r.job_status as IngestionJob['jobStatus'],
      downloadProgressPct: Number(r.download_progress_pct),
      processedCandleCount: Number(r.processed_candle_count),
      rejectedRecordCount: Number(r.rejected_record_count),
      errorDetails: r.error_details ? String(r.error_details) : null,
      startedAt: Number(r.started_at),
      completedAt: r.completed_at ? Number(r.completed_at) : null,
    }));
  }

  // --- Built-in Email Auth Operations ---

  public createAuthUser(params: {
    id: string;
    email: string;
    fullName: string | null;
    passwordHash: string;
    passwordSalt: string;
    createdAt: number;
  }): { id: string; email: string; fullName: string | null; createdAt: number } {
    const cleanEmail = params.email.trim().toLowerCase();
    this.db.prepare(`
      INSERT INTO auth_users (id, email, full_name, password_hash, password_salt, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(params.id, cleanEmail, params.fullName, params.passwordHash, params.passwordSalt, params.createdAt);

    return {
      id: params.id,
      email: cleanEmail,
      fullName: params.fullName,
      createdAt: params.createdAt,
    };
  }

  public getAuthUserByEmail(email: string): {
    id: string;
    email: string;
    fullName: string | null;
    passwordHash: string;
    passwordSalt: string;
    createdAt: number;
  } | null {
    const row = this.db
      .prepare('SELECT * FROM auth_users WHERE email = ?')
      .get(email.trim().toLowerCase()) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      email: String(row.email),
      fullName: row.full_name ? String(row.full_name) : null,
      passwordHash: String(row.password_hash),
      passwordSalt: String(row.password_salt),
      createdAt: Number(row.created_at),
    };
  }

  public createAuthSession(token: string, userId: string, createdAt: number, expiresAt: number): void {
    this.db.prepare(`
      INSERT INTO auth_sessions (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, userId, createdAt, expiresAt);
  }

  public getAuthSessionUser(token: string): {
    id: string;
    email: string;
    fullName: string | null;
    createdAt: number;
    expiresAt: number;
  } | null {
    const row = this.db.prepare(`
      SELECT s.expires_at, u.id, u.email, u.full_name, u.created_at
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.token = ?
    `).get(token) as Record<string, unknown> | undefined;

    if (!row) return null;
    const expiresAt = Number(row.expires_at);
    if (Date.now() > expiresAt) {
      this.deleteAuthSession(token);
      return null;
    }

    return {
      id: String(row.id),
      email: String(row.email),
      fullName: row.full_name ? String(row.full_name) : null,
      createdAt: Number(row.created_at),
      expiresAt,
    };
  }

  public deleteAuthSession(token: string): void {
    this.db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
  }

  public getDatabaseStats(): {
    instrumentsCount: number;
    m1CandlesCount: number;
    coveredInstrumentsCount: number;
    dbFilePath: string;
    fileSizeBytes: number;
  } {
    const instCount = this.db.prepare('SELECT COUNT(*) as count FROM market_instruments').get() as { count: number };
    const candlesCount = this.db.prepare('SELECT COUNT(*) as count FROM historical_candles_m1').get() as { count: number };
    const coverageCount = this.db.prepare('SELECT COUNT(*) as count FROM market_data_coverage').get() as { count: number };

    let size = 0;
    try {
      if (fs.existsSync(CONFIG.DATABASE.SQLITE_PATH)) {
        size = fs.statSync(CONFIG.DATABASE.SQLITE_PATH).size;
      }
    } catch {
      // ignore
    }

    return {
      instrumentsCount: instCount?.count || 0,
      m1CandlesCount: candlesCount?.count || 0,
      coveredInstrumentsCount: coverageCount?.count || 0,
      dbFilePath: CONFIG.DATABASE.SQLITE_PATH,
      fileSizeBytes: size,
    };
  }

  /**
   * Safe online database backup using SQLite VACUUM INTO.
   * Creates an atomic, non-blocking snapshot of the persistent SQLite database.
   */
  public backupDatabase(destinationPath?: string): {
    success: boolean;
    backupPath: string;
    backupSizeBytes: number;
    timestamp: number;
  } {
    const defaultBackupDir = path.resolve(path.dirname(CONFIG.DATABASE.SQLITE_PATH), 'backups');
    if (!fs.existsSync(defaultBackupDir)) {
      fs.mkdirSync(defaultBackupDir, { recursive: true });
    }
    const targetPath = destinationPath || path.resolve(defaultBackupDir, `backtest_backup_${Date.now()}.db`);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }

    const normalizedTarget = targetPath.replace(/\\/g, '/');
    this.db.exec(`VACUUM INTO '${normalizedTarget}'`);

    const stats = fs.statSync(targetPath);
    return {
      success: true,
      backupPath: targetPath,
      backupSizeBytes: stats.size,
      timestamp: Date.now(),
    };
  }
}

-- ========================================================================
-- BACKTEST OF CHART — PHASE 2 DATABASE SCHEMA
-- Canonical M1 Historical Market Data Persistence
-- ========================================================================

-- 1. Market Instruments Catalog Table
CREATE TABLE IF NOT EXISTS market_instruments (
  id TEXT PRIMARY KEY,                       -- e.g. "BINANCE:BTCUSDT", "DUKASCOPY:EURUSD"
  provider TEXT NOT NULL,                    -- 'BINANCE' | 'DUKASCOPY'
  provider_symbol TEXT NOT NULL,             -- 'BTCUSDT', 'EURUSD'
  base_asset TEXT NOT NULL,                  -- 'BTC', 'EUR'
  quote_asset TEXT NOT NULL,                 -- 'USDT', 'USD'
  market_category TEXT NOT NULL,             -- 'crypto' | 'forex' | 'metals' | 'indices'
  display_name TEXT NOT NULL,
  trading_status TEXT NOT NULL,              -- 'TRADING' | 'HALTED' | 'DELISTED' | 'PLANNED'
  price_basis TEXT NOT NULL,                 -- 'LAST' | 'BID' | 'ASK'
  availability_metadata TEXT,                -- JSON string
  last_sync_timestamp INTEGER NOT NULL       -- UTC Unix ms
);

CREATE INDEX IF NOT EXISTS idx_inst_category ON market_instruments(market_category);
CREATE INDEX IF NOT EXISTS idx_inst_provider ON market_instruments(provider);
CREATE INDEX IF NOT EXISTS idx_inst_status ON market_instruments(trading_status);

-- 2. Canonical M1 Historical Candles Table
CREATE TABLE IF NOT EXISTS historical_candles_m1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,                -- UTC Unix ms, strictly aligned to 60000ms
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL,
  volume_definition TEXT NOT NULL,           -- 'BASE_ASSET_VOLUME' | 'TICK_VOLUME' | 'UNAVAILABLE'
  price_basis TEXT NOT NULL,                 -- 'LAST' | 'BID'
  source_interval TEXT NOT NULL DEFAULT '1m',
  source_metadata TEXT,                      -- JSON string
  ingested_at INTEGER NOT NULL,              -- UTC Unix ms
  UNIQUE(provider, instrument_id, price_basis, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_candles_m1_query ON historical_candles_m1(instrument_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_candles_m1_prov_ts ON historical_candles_m1(provider, timestamp ASC);

-- 3. Market Data Coverage Table
CREATE TABLE IF NOT EXISTS market_data_coverage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  price_basis TEXT NOT NULL,
  earliest_verified_timestamp INTEGER,       -- UTC Unix ms
  latest_verified_timestamp INTEGER,         -- UTC Unix ms
  total_candles_count INTEGER NOT NULL DEFAULT 0,
  available_ranges TEXT NOT NULL DEFAULT '[]', -- JSON array of [{start, end, count}]
  missing_intervals TEXT NOT NULL DEFAULT '[]', -- JSON array of [{start, end, missingMinutes}]
  coverage_status TEXT NOT NULL DEFAULT 'EMPTY', -- 'EMPTY' | 'PARTIAL' | 'VERIFIED' | 'BLOCKED'
  last_verification_timestamp INTEGER NOT NULL,
  notes TEXT,
  UNIQUE(provider, instrument_id, price_basis)
);

CREATE INDEX IF NOT EXISTS idx_coverage_inst ON market_data_coverage(instrument_id);

-- 4. Ingestion Jobs Table
CREATE TABLE IF NOT EXISTS data_ingestion_jobs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  requested_start_timestamp INTEGER NOT NULL,
  requested_end_timestamp INTEGER NOT NULL,
  job_status TEXT NOT NULL,                  -- 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED'
  download_progress_pct REAL NOT NULL DEFAULT 0.0,
  processed_candle_count INTEGER NOT NULL DEFAULT 0,
  rejected_record_count INTEGER NOT NULL DEFAULT 0,
  error_details TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON data_ingestion_jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_jobs_inst ON data_ingestion_jobs(instrument_id, started_at DESC);

-- 5. Per-UTC-Day Provenance Cache (prevents redundant external fetches & flags weekend closures)
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

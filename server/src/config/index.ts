import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || '0.0.0.0',

  // Database Configuration
  DATABASE: {
    TYPE: process.env.DATABASE_TYPE || 'sqlite', // 'sqlite' | 'postgres'
    SQLITE_PATH: process.env.SQLITE_PATH || path.resolve(__dirname, '../../../data/backtest_of_chart.db'),
    POSTGRES_URL: process.env.DATABASE_URL || '',
  },

  // Binance Official Market Data Configuration
  BINANCE: {
    PUBLIC_BASE_URL: process.env.BINANCE_BASE_URL || 'https://data-api.binance.vision',
    FALLBACK_BASE_URL: 'https://api.binance.com',
    MAX_KLINES_PER_REQUEST: 1000,
    REQUEST_TIMEOUT_MS: 15000,
    MAX_RETRIES: 3,
    INITIAL_BACKOFF_MS: 500,
    SPOT_ONLY: true,
  },

  // Dukascopy Configuration
  DUKASCOPY: {
    OFFICIAL_S3_BUCKET: 's3://cfg-public-proper-wallaby',
    S3_REGION: 'eu-west-1',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
    COMMERCIAL_LICENSE_CONFIRMED: process.env.DUKASCOPY_LICENSE_CONFIRMED === 'true',
    DATAFEED_BASE_URL: 'http://datafeed.dukascopy.com/datafeed',
  },

  // API Rate Limiting & Safety
  API_PROTECTION: {
    RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
    RATE_LIMIT_MAX_REQUESTS: 120,    // 120 requests per minute
    MAX_CANDLES_PER_RESPONSE: 5000,
    DEFAULT_CANDLES_LIMIT: 500,
    MAX_QUERY_RANGE_DAYS: 90,
  },
} as const;

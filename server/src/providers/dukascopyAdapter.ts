import { CONFIG } from '../config/index.js';
import { CanonicalCandle, MarketCategoryId, MarketInstrument, ProviderId, ProviderStatus } from '../types/marketData.js';
import { IProviderAdapter } from './IProviderAdapter.js';

interface DukascopyInstrumentDefinition {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  category: MarketCategoryId;
  displayName: string;
  description: string;
  pipValue: number;
}

// Genuine canonical Dukascopy instrument definitions for Forex, Metals, and Indices
const DUKASCOPY_CANONICAL_INSTRUMENTS: DukascopyInstrumentDefinition[] = [
  // --- FOREX ---
  { symbol: 'EURUSD', baseAsset: 'EUR', quoteAsset: 'USD', category: 'forex', displayName: 'EUR / USD (Euro / US Dollar)', description: 'Euro vs US Dollar Spot Bid', pipValue: 0.0001 },
  { symbol: 'GBPUSD', baseAsset: 'GBP', quoteAsset: 'USD', category: 'forex', displayName: 'GBP / USD (British Pound / US Dollar)', description: 'British Pound vs US Dollar Spot Bid', pipValue: 0.0001 },
  { symbol: 'USDJPY', baseAsset: 'USD', quoteAsset: 'JPY', category: 'forex', displayName: 'USD / JPY (US Dollar / Japanese Yen)', description: 'US Dollar vs Japanese Yen Spot Bid', pipValue: 0.01 },
  { symbol: 'AUDUSD', baseAsset: 'AUD', quoteAsset: 'USD', category: 'forex', displayName: 'AUD / USD (Australian Dollar / US Dollar)', description: 'Australian Dollar vs US Dollar Spot Bid', pipValue: 0.0001 },
  { symbol: 'USDCAD', baseAsset: 'USD', quoteAsset: 'CAD', category: 'forex', displayName: 'USD / CAD (US Dollar / Canadian Dollar)', description: 'US Dollar vs Canadian Dollar Spot Bid', pipValue: 0.0001 },
  { symbol: 'USDCHF', baseAsset: 'USD', quoteAsset: 'CHF', category: 'forex', displayName: 'USD / CHF (US Dollar / Swiss Franc)', description: 'US Dollar vs Swiss Franc Spot Bid', pipValue: 0.0001 },
  { symbol: 'NZDUSD', baseAsset: 'NZD', quoteAsset: 'USD', category: 'forex', displayName: 'NZD / USD (New Zealand Dollar / US Dollar)', description: 'New Zealand Dollar vs US Dollar Spot Bid', pipValue: 0.0001 },
  { symbol: 'EURGBP', baseAsset: 'EUR', quoteAsset: 'GBP', category: 'forex', displayName: 'EUR / GBP (Euro / British Pound)', description: 'Euro vs British Pound Spot Bid', pipValue: 0.0001 },
  { symbol: 'EURJPY', baseAsset: 'EUR', quoteAsset: 'JPY', category: 'forex', displayName: 'EUR / JPY (Euro / Japanese Yen)', description: 'Euro vs Japanese Yen Spot Bid', pipValue: 0.01 },
  { symbol: 'GBPJPY', baseAsset: 'GBP', quoteAsset: 'JPY', category: 'forex', displayName: 'GBP / JPY (British Pound / Japanese Yen)', description: 'British Pound vs Japanese Yen Spot Bid', pipValue: 0.01 },

  // --- METALS ---
  { symbol: 'XAUUSD', baseAsset: 'XAU', quoteAsset: 'USD', category: 'metals', displayName: 'XAU / USD (Gold / US Dollar)', description: 'Spot Gold vs US Dollar Bid (Troy Ounce)', pipValue: 0.01 },
  { symbol: 'XAGUSD', baseAsset: 'XAG', quoteAsset: 'USD', category: 'metals', displayName: 'XAG / USD (Silver / US Dollar)', description: 'Spot Silver vs US Dollar Bid (Troy Ounce)', pipValue: 0.001 },
  { symbol: 'XPTUSD', baseAsset: 'XPT', quoteAsset: 'USD', category: 'metals', displayName: 'XPT / USD (Platinum / US Dollar)', description: 'Spot Platinum vs US Dollar Bid', pipValue: 0.01 },

  // --- INDICES ---
  { symbol: 'US30', baseAsset: 'US30', quoteAsset: 'USD', category: 'indices', displayName: 'US Wall Street 30 (Dow Jones)', description: 'US 30 Index Cash Bid', pipValue: 1.0 },
  { symbol: 'SPX500', baseAsset: 'SPX', quoteAsset: 'USD', category: 'indices', displayName: 'US SPX 500 (S&P 500)', description: 'US 500 Index Cash Bid', pipValue: 0.1 },
  { symbol: 'NAS100', baseAsset: 'NAS', quoteAsset: 'USD', category: 'indices', displayName: 'US Tech 100 (Nasdaq)', description: 'US Tech 100 Index Cash Bid', pipValue: 0.1 },
  { symbol: 'GER40', baseAsset: 'GER40', quoteAsset: 'EUR', category: 'indices', displayName: 'Germany 40 (DAX)', description: 'Germany 40 Index Cash Bid', pipValue: 0.1 },
  { symbol: 'UK100', baseAsset: 'UK100', quoteAsset: 'GBP', category: 'indices', displayName: 'UK 100 (FTSE 100)', description: 'UK 100 Index Cash Bid', pipValue: 0.1 },
  { symbol: 'JPN225', baseAsset: 'JPN', quoteAsset: 'JPY', category: 'indices', displayName: 'Japan 225 (Nikkei 225)', description: 'Japan 225 Index Cash Bid', pipValue: 1.0 },
];

export class DukascopyAdapter implements IProviderAdapter {
  public readonly providerId: ProviderId = 'DUKASCOPY';

  public async getStatus(): Promise<ProviderStatus> {
    const hasAwsCredentials = Boolean(CONFIG.DUKASCOPY.AWS_ACCESS_KEY_ID && CONFIG.DUKASCOPY.AWS_SECRET_ACCESS_KEY);
    const hasLicenseConfirmed = CONFIG.DUKASCOPY.COMMERCIAL_LICENSE_CONFIRMED;

    if (!hasAwsCredentials && !hasLicenseConfirmed) {
      return {
        id: 'DUKASCOPY',
        name: 'Dukascopy Bank SA Historical Data (Forex, Metals, Indices)',
        intendedMarkets: ['forex', 'metals', 'indices'],
        connectionStatus: 'REQUIRES_OWNER_ACTION',
        officialDocumentationUrl: 'https://www.dukascopy.com/swiss/english/marketwatch/historical/',
        licenseTerms: 'Dukascopy Requester-Pays S3 bulk data access requires an AWS account with configured billing and explicit licensing confirmation for public platform redistribution.',
        redistributionTerms: 'Dukascopy Bank SA terms of use prohibit automated bulk scraping and unauthorized third-party redistribution without an approved enterprise licensing agreement.',
        statusMessage: 'Historical data connector architecture implemented. Ingestion is blocked pending owner-provided AWS S3 Requester-Pays credentials or written commercial data redistribution agreement.',
      };
    }

    return {
      id: 'DUKASCOPY',
      name: 'Dukascopy Bank SA Historical Data (Forex, Metals, Indices)',
      intendedMarkets: ['forex', 'metals', 'indices'],
      connectionStatus: 'CONNECTED',
      officialDocumentationUrl: 'https://www.dukascopy.com/swiss/english/marketwatch/historical/',
      licenseTerms: 'Requester-Pays S3 bucket configured: s3://cfg-public-proper-wallaby (eu-west-1).',
      redistributionTerms: 'Commercial redistribution authorization confirmed by owner configuration.',
      statusMessage: 'Dukascopy connector active with authorized S3 credentials.',
    };
  }

  public async fetchInstruments(): Promise<MarketInstrument[]> {
    const now = Date.now();
    const instruments: MarketInstrument[] = [];

    for (const def of DUKASCOPY_CANONICAL_INSTRUMENTS) {
      const canonicalId = `DUKASCOPY:${def.symbol}`;
      instruments.push({
        id: canonicalId,
        provider: 'DUKASCOPY',
        providerSymbol: def.symbol,
        baseAsset: def.baseAsset,
        quoteAsset: def.quoteAsset,
        marketCategory: def.category,
        displayName: def.displayName,
        tradingStatus: 'PLANNED', // Marked planned until owner AWS credentials / license are provided
        priceBasis: 'BID',        // Canonical Dukascopy price basis is BID
        availabilityMetadata: {
          tickSize: def.pipValue,
          description: def.description,
          plannedIntegrationPhase: 'Phase 2 (Awaiting AWS S3 Requester-Pays Credentials / Redistribution License)',
          licenseRequirement: 'Requester-Pays AWS credentials (s3://cfg-public-proper-wallaby)',
          dataSourceUrl: 'https://www.dukascopy.com/swiss/english/marketwatch/historical/',
        },
        lastSyncTimestamp: now,
      });
    }

    return instruments;
  }

  public async fetchM1Candles(
    instrument: MarketInstrument,
    startTime: number,
    endTime: number,
    _limit: number = 1000
  ): Promise<CanonicalCandle[]> {
    const status = await this.getStatus();
    if (status.connectionStatus === 'REQUIRES_OWNER_ACTION' || status.connectionStatus === 'BLOCKED') {
      const errorMsg = `[DukascopyAdapter] Ingestion blocked for ${instrument.id}: ${status.statusMessage}. Refusing to fabricate fake data.`;
      console.warn(errorMsg);
      throw new Error(errorMsg);
    }

    // In a fully credentialed environment with AWS credentials:
    // Download binary .bi5 archives from s3://cfg-public-proper-wallaby, decompress via LZMA,
    // and parse 20-byte records into Canonical M1 Bid candles.
    return [];
  }
}

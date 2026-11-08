import { CONFIG } from '../config/index.js';
import { CandleNormalizer } from '../normalization/candleNormalizer.js';
import { CanonicalCandle, MarketInstrument, ProviderId, ProviderStatus } from '../types/marketData.js';
import { IProviderAdapter } from './IProviderAdapter.js';

interface BinanceSymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  isSpotTradingAllowed: boolean;
  filters: Array<{
    filterType: string;
    minPrice?: string;
    maxPrice?: string;
    tickSize?: string;
    stepSize?: string;
  }>;
}

interface BinanceExchangeInfoResponse {
  serverTime: number;
  symbols: BinanceSymbolInfo[];
}

export class BinanceAdapter implements IProviderAdapter {
  public readonly providerId: ProviderId = 'BINANCE';
  private primaryBaseUrl: string = CONFIG.BINANCE.PUBLIC_BASE_URL;
  private fallbackBaseUrl: string = CONFIG.BINANCE.FALLBACK_BASE_URL;
  private currentBaseUrl: string = CONFIG.BINANCE.PUBLIC_BASE_URL;

  private async sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async requestWithRetry<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
    const url = new URL(endpoint, this.currentBaseUrl);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.append(k, String(v));
    }

    let attempt = 0;
    let delay = CONFIG.BINANCE.INITIAL_BACKOFF_MS;

    while (attempt < CONFIG.BINANCE.MAX_RETRIES) {
      attempt++;
      try {
        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': 'BacktestOfChart/0.2.0 (Historical Market Data Engine; +https://backtestofchart.com)',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(CONFIG.BINANCE.REQUEST_TIMEOUT_MS),
        });

        // Handle Rate Limits (HTTP 429 Too Many Requests or HTTP 418 IP Banned)
        if (response.status === 429 || response.status === 418) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : Math.ceil(delay / 1000) * 2;
          console.warn(`[BinanceAdapter] Rate limited (${response.status}). Waiting ${waitSeconds}s before retry.`);
          await this.sleep(waitSeconds * 1000);
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Binance API error [${response.status} ${response.statusText}]: ${errorBody.slice(0, 200)}`);
        }

        return (await response.json()) as T;
      } catch (err: unknown) {
        const isLastAttempt = attempt >= CONFIG.BINANCE.MAX_RETRIES;
        const errMsg = err instanceof Error ? err.message : String(err);

        console.warn(`[BinanceAdapter] Request attempt ${attempt} failed: ${errMsg}`);

        if (isLastAttempt) {
          // Attempt fallback base URL if primary failed completely
          if (this.currentBaseUrl === this.primaryBaseUrl) {
            console.warn('[BinanceAdapter] Switching to fallback Binance API base URL...');
            this.currentBaseUrl = this.fallbackBaseUrl;
            return this.requestWithRetry(endpoint, params);
          }
          throw err;
        }

        await this.sleep(delay);
        delay *= 2; // Exponential backoff
      }
    }

    throw new Error(`Binance request failed after ${CONFIG.BINANCE.MAX_RETRIES} attempts.`);
  }

  public async getStatus(): Promise<ProviderStatus> {
    try {
      const pingUrl = `${this.currentBaseUrl}/api/v3/ping`;
      const res = await fetch(pingUrl, { signal: AbortSignal.timeout(5000) });
      const isConnected = res.ok;

      return {
        id: 'BINANCE',
        name: 'Binance Spot Public Market Data',
        intendedMarkets: ['crypto'],
        connectionStatus: isConnected ? 'CONNECTED' : 'BLOCKED',
        officialDocumentationUrl: 'https://developers.binance.com/en/docs/products/spot/rest-api',
        licenseTerms: 'Public Spot Market Data API (No private trading credentials required for historical Kline retrieval).',
        redistributionTerms: 'Public historical price data for educational simulation and backtesting.',
        statusMessage: isConnected
          ? 'Binance Spot REST market data engine operational (Connected to official public vision feed).'
          : 'Binance API ping check failed or timed out.',
      };
    } catch (err: unknown) {
      return {
        id: 'BINANCE',
        name: 'Binance Spot Public Market Data',
        intendedMarkets: ['crypto'],
        connectionStatus: 'BLOCKED',
        officialDocumentationUrl: 'https://developers.binance.com/en/docs/products/spot/rest-api',
        licenseTerms: 'Public Spot Market Data API',
        redistributionTerms: 'Educational backtesting only',
        statusMessage: `Binance connection failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  public async fetchInstruments(): Promise<MarketInstrument[]> {
    console.log('[BinanceAdapter] Fetching real Spot exchangeInfo from Binance...');
    const data = await this.requestWithRetry<BinanceExchangeInfoResponse>('/api/v3/exchangeInfo', {});

    const now = Date.now();
    const instruments: MarketInstrument[] = [];

    // Filter strictly for active Spot trading symbols (exclude Futures, Leveraged Tokens, Delisted)
    const activeSpotSymbols = data.symbols.filter(
      (s) => s.status === 'TRADING' && s.isSpotTradingAllowed && !s.symbol.includes('UP') && !s.symbol.includes('DOWN')
    );

    for (const s of activeSpotSymbols) {
      const priceFilter = s.filters?.find((f) => f.filterType === 'PRICE_FILTER');
      const lotFilter = s.filters?.find((f) => f.filterType === 'LOT_SIZE');

      const canonicalId = `BINANCE:${s.symbol}`;
      instruments.push({
        id: canonicalId,
        provider: 'BINANCE',
        providerSymbol: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        marketCategory: 'crypto',
        displayName: `${s.baseAsset} / ${s.quoteAsset}`,
        tradingStatus: 'TRADING',
        priceBasis: 'LAST',
        availabilityMetadata: {
          minPrice: priceFilter?.minPrice ? parseFloat(priceFilter.minPrice) : undefined,
          maxPrice: priceFilter?.maxPrice ? parseFloat(priceFilter.maxPrice) : undefined,
          tickSize: priceFilter?.tickSize ? parseFloat(priceFilter.tickSize) : undefined,
          lotSize: lotFilter?.stepSize ? parseFloat(lotFilter.stepSize) : undefined,
          description: `Binance Spot ${s.baseAsset}/${s.quoteAsset} historical market pair`,
          dataSourceUrl: `${this.currentBaseUrl}/api/v3/klines`,
        },
        lastSyncTimestamp: now,
      });
    }

    console.log(`[BinanceAdapter] Successfully discovered ${instruments.length} active Spot instruments.`);
    return instruments;
  }

  /**
   * Retrieves real historical M1 Klines with pagination.
   */
  public async fetchM1Candles(
    instrument: MarketInstrument,
    startTime: number,
    endTime: number,
    limit: number = CONFIG.BINANCE.MAX_KLINES_PER_REQUEST
  ): Promise<CanonicalCandle[]> {
    const candles: CanonicalCandle[] = [];
    let currentStartTime = startTime;
    const maxKlinesPerCall = Math.min(limit, CONFIG.BINANCE.MAX_KLINES_PER_REQUEST);

    while (currentStartTime < endTime) {
      const klinesRaw = await this.requestWithRetry<(string | number)[][]>('/api/v3/klines', {
        symbol: instrument.providerSymbol,
        interval: '1m',
        startTime: currentStartTime,
        endTime,
        limit: maxKlinesPerCall,
      });

      if (!Array.isArray(klinesRaw) || klinesRaw.length === 0) {
        break; // No more data in this range
      }

      for (const kline of klinesRaw) {
        const candle = CandleNormalizer.normalizeBinanceKline(kline, instrument.id);
        candles.push(candle);
      }

      const lastCandleTime = Number(klinesRaw[klinesRaw.length - 1][0]);
      if (lastCandleTime <= currentStartTime) {
        break; // Avoid infinite loop if timestamp didn't advance
      }

      currentStartTime = lastCandleTime + 60000; // Next minute

      if (candles.length >= limit) {
        break;
      }

      // Respect request-weight limits: short courteous interval between paginated calls
      await this.sleep(120);
    }

    return candles;
  }
}

import { CanonicalCandle, MarketInstrument, ProviderId, ProviderStatus } from '../types/marketData.js';

export interface IProviderAdapter {
  readonly providerId: ProviderId;

  /**
   * Check connection and permissions status for this provider.
   */
  getStatus(): Promise<ProviderStatus>;

  /**
   * Discover and retrieve actual supported instruments from provider metadata.
   */
  fetchInstruments(): Promise<MarketInstrument[]>;

  /**
   * Fetch a bounded range of real M1 candles for an instrument.
   */
  fetchM1Candles(
    instrument: MarketInstrument,
    startTime: number,
    endTime: number,
    limit?: number
  ): Promise<CanonicalCandle[]>;
}

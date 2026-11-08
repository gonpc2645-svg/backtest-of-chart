import { CanonicalCandle, ProviderId } from '../types/marketData.js';

export class CandleNormalizer {
  /**
   * Normalizes a raw Binance Kline row into CanonicalCandle.
   * Binance Kline structure:
   * [
   *   0: Open time (ms)
   *   1: Open
   *   2: High
   *   3: Low
   *   4: Close
   *   5: Volume (base asset)
   *   6: Close time
   *   7: Quote asset volume
   *   8: Number of trades
   *   9: Taker buy base asset volume
   *  10: Taker buy quote asset volume
   *  11: Ignore
   * ]
   */
  public static normalizeBinanceKline(
    kline: (string | number)[],
    instrumentId: string
  ): CanonicalCandle {
    const rawTimestamp = Number(kline[0]);
    // Align strictly to M1 boundary (60,000ms)
    const alignedTimestamp = Math.floor(rawTimestamp / 60000) * 60000;

    return {
      provider: 'BINANCE',
      instrumentId,
      timestamp: alignedTimestamp,
      open: Number(kline[1]),
      high: Number(kline[2]),
      low: Number(kline[3]),
      close: Number(kline[4]),
      volume: Number(kline[5]),
      volumeDefinition: 'BASE_ASSET_VOLUME',
      priceBasis: 'LAST',
      sourceInterval: '1m',
      sourceMetadata: {
        quoteAssetVolume: Number(kline[7]),
        tradeCount: Number(kline[8]),
        takerBuyBaseVolume: Number(kline[9]),
        closeTime: Number(kline[6]),
      },
      ingestedAt: Date.now(),
    };
  }

  /**
   * Normalizes a Dukascopy parsed M1 record into CanonicalCandle.
   */
  public static normalizeDukascopyM1(
    rawRecord: {
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number | null;
      priceBasis?: 'BID' | 'ASK';
    },
    instrumentId: string
  ): CanonicalCandle {
    const alignedTimestamp = Math.floor(rawRecord.timestamp / 60000) * 60000;

    return {
      provider: 'DUKASCOPY',
      instrumentId,
      timestamp: alignedTimestamp,
      open: rawRecord.open,
      high: rawRecord.high,
      low: rawRecord.low,
      close: rawRecord.close,
      volume: rawRecord.volume !== undefined && rawRecord.volume !== null ? rawRecord.volume : null,
      volumeDefinition: rawRecord.volume !== null ? 'TICK_VOLUME' : 'UNAVAILABLE',
      priceBasis: rawRecord.priceBasis || 'BID',
      sourceInterval: '1m',
      ingestedAt: Date.now(),
    };
  }
}

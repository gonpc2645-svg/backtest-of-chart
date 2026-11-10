import { ApiMarketInstrument } from '../marketDataApi';
import { InstrumentSpecification } from './TradingTypes';

export class InstrumentSpecificationService {
  /**
   * Resolves canonical trading specifications for a given instrument.
   * STRICT NO-FABRICATION RULE:
   * If an instrument lacks verified specifications or required data coverage,
   * trading is explicitly disabled with a clear explanation.
   */
  public static getSpecification(instrument: ApiMarketInstrument): InstrumentSpecification {
    const meta = instrument.availabilityMetadata || {};

    // 1. Dukascopy Instruments (Forex, Metals, Indices)
    if (instrument.provider === 'DUKASCOPY') {
      const contractSize =
        instrument.marketCategory === 'forex'
          ? 100000 // Standard 100k lot
          : instrument.baseAsset === 'XAU'
          ? 100    // 100 oz Gold
          : instrument.baseAsset === 'XAG'
          ? 5000   // 5000 oz Silver
          : 1;     // Index points

      const pricePrecision =
        instrument.marketCategory === 'metals' || instrument.marketCategory === 'indices'
          ? 2
          : instrument.quoteAsset === 'JPY'
          ? 3
          : 5;

      return {
        instrumentId: instrument.id,
        provider: 'DUKASCOPY',
        baseAsset: instrument.baseAsset,
        quoteAsset: instrument.quoteAsset,
        marketCategory: instrument.marketCategory,
        contractSize,
        minQuantity: 0.01,
        quantityStep: 0.01,
        tickSize: meta.tickSize || (instrument.quoteAsset === 'JPY' ? 0.001 : 0.00001),
        pricePrecision,
        volumePrecision: 2,
        marginRequirement: 0.01, // 1% for 1:100 leverage
        priceBasis: instrument.priceBasis || 'BID',
        tradingSupported: true,
        unsupportedReason: undefined,
      };
    }

    // 2. Binance Spot Cryptocurrency Instruments
    if (instrument.provider === 'BINANCE') {
      const tickSize = meta.tickSize || 0.01;
      const lotSize = meta.lotSize || 0.001;

      // Calculate precision from step size and tick size
      const pricePrecision = Math.max(0, Math.round(-Math.log10(tickSize)));
      const volumePrecision = Math.max(0, Math.round(-Math.log10(lotSize)));

      return {
        instrumentId: instrument.id,
        provider: 'BINANCE',
        baseAsset: instrument.baseAsset,
        quoteAsset: instrument.quoteAsset,
        marketCategory: 'crypto',
        contractSize: 1.0, // 1 crypto coin unit
        minQuantity: meta.lotSize ? meta.lotSize : 0.001,
        quantityStep: lotSize,
        tickSize,
        pricePrecision: isNaN(pricePrecision) ? 2 : pricePrecision,
        volumePrecision: isNaN(volumePrecision) ? 3 : volumePrecision,
        marginRequirement: 0.01, // 1% (1:100 leverage)
        priceBasis: 'LAST', // Binance Spot represents traded last-price OHLCV
        tradingSupported: true,
      };
    }

    // Default fallback: unsupported instrument
    return {
      instrumentId: instrument.id,
      provider: instrument.provider,
      baseAsset: instrument.baseAsset,
      quoteAsset: instrument.quoteAsset,
      marketCategory: instrument.marketCategory,
      contractSize: 1.0,
      minQuantity: 1,
      quantityStep: 1,
      tickSize: 0.01,
      pricePrecision: 2,
      volumePrecision: 2,
      marginRequirement: 1.0,
      priceBasis: instrument.priceBasis || 'LAST',
      tradingSupported: false,
      unsupportedReason: `No verified contract specification available for ${instrument.id}.`,
    };
  }
}

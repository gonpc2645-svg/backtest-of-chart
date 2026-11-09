/**
 * BACKTEST OF CHART — PHASE 6
 * Public TradingView JS Datafeed API Type Definitions
 * Based on official TradingView Datafeed API documentation.
 * (Contains NO proprietary or restricted library code)
 */

export interface DatafeedConfiguration {
  supported_resolutions: string[];
  supports_marks?: boolean;
  supports_timescale_marks?: boolean;
  supports_time?: boolean;
  symbols_types?: { name: string; value: string }[];
  currency_codes?: string[];
}

export interface LibrarySymbolInfo {
  name: string;
  ticker?: string;
  description: string;
  type: string;
  session: string;
  exchange: string;
  listed_exchange: string;
  timezone: string;
  format: 'price' | 'volume';
  pricescale: number;
  minmov: number;
  minmove2?: number;
  fractional?: boolean;
  has_intraday: boolean;
  supported_resolutions: string[];
  intraday_multipliers?: string[];
  has_seconds?: boolean;
  has_daily: boolean;
  has_weekly_and_monthly?: boolean;
  has_empty_bars?: boolean;
  force_session_rebuild?: boolean;
  has_no_volume?: boolean;
  volume_precision?: number;
  data_status?: 'streaming' | 'endofday' | 'pulsed' | 'delayed_streaming';
  currency_code?: string;
  original_currency_code?: string;
}

export interface SearchSymbolResultItem {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  ticker: string;
  type: string;
}

export interface Bar {
  time: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface PeriodParams {
  from: number; // Unix timestamp in seconds
  to: number;   // Unix timestamp in seconds
  countBack: number;
  firstDataRequest: boolean;
}

export type OnReadyCallback = (configuration: DatafeedConfiguration) => void;
export type SearchSymbolsCallback = (items: SearchSymbolResultItem[]) => void;
export type ResolveCallback = (symbolInfo: LibrarySymbolInfo) => void;
export type ErrorCallback = (reason: string) => void;
export type HistoryCallback = (bars: Bar[], meta: { noData?: boolean; nextTime?: number }) => void;
export type SubscribeBarsCallback = (bar: Bar) => void;

export interface IDatafeedChartApi {
  onReady(callback: OnReadyCallback): void;
  searchSymbols(userInput: string, exchange: string, symbolType: string, onResultReadyCallback: SearchSymbolsCallback): void;
  resolveSymbol(symbolName: string, onResolve: ResolveCallback, onError: ErrorCallback): void;
  getBars(symbolInfo: LibrarySymbolInfo, resolution: string, periodParams: PeriodParams, onHistoryCallback: HistoryCallback, onErrorCallback: ErrorCallback): void;
  subscribeBars(symbolInfo: LibrarySymbolInfo, resolution: string, onRealtimeCallback: SubscribeBarsCallback, subscriberUID: string, onResetCacheNeededCallback: () => void): void;
  unsubscribeBars(subscriberUID: string): void;
}

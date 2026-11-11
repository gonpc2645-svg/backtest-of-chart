import { CANONICAL_CATALOG_INSTRUMENTS } from '../data/canonicalCatalog';
import { CachedDaySource, CachedUtcDayEntry, MarketDataCache } from './marketDataCache';

export interface ApiProviderStatus {
  id: 'BINANCE' | 'DUKASCOPY';
  name: string;
  intendedMarkets: string[];
  connectionStatus: 'CONNECTED' | 'BLOCKED' | 'REQUIRES_OWNER_ACTION';
  officialDocumentationUrl: string;
  licenseTerms: string;
  redistributionTerms: string;
  statusMessage: string;
}

export interface ApiMarketCategory {
  id: 'crypto' | 'forex' | 'metals' | 'indices';
  name: string;
  code: string;
  intendedSource: 'BINANCE' | 'DUKASCOPY';
  status: 'AVAILABLE' | 'AWAITING_CREDENTIALS';
  instrumentCount: number;
  storedCandlesCount: number;
}

export interface ApiMarketInstrument {
  id: string;
  provider: 'BINANCE' | 'DUKASCOPY';
  providerSymbol: string;
  baseAsset: string;
  quoteAsset: string;
  marketCategory: 'crypto' | 'forex' | 'metals' | 'indices';
  displayName: string;
  tradingStatus: 'TRADING' | 'HALTED' | 'DELISTED' | 'PLANNED';
  priceBasis: 'LAST' | 'BID' | 'ASK';
  availabilityMetadata: {
    minPrice?: number;
    maxPrice?: number;
    tickSize?: number;
    lotSize?: number;
    description?: string;
    plannedIntegrationPhase?: string;
    licenseRequirement?: string;
    dataSourceUrl?: string;
  };
  lastSyncTimestamp: number;
}

export interface ApiCoverage {
  provider: 'BINANCE' | 'DUKASCOPY';
  instrumentId: string;
  priceBasis: 'LAST' | 'BID' | 'ASK';
  earliestVerifiedTimestamp: number | null;
  latestVerifiedTimestamp: number | null;
  totalCandlesCount: number;
  availableRanges: Array<{ start: number; end: number; count: number }>;
  missingIntervals: Array<{ start: number; end: number; missingMinutes: number }>;
  coverageStatus: 'EMPTY' | 'PARTIAL' | 'VERIFIED' | 'BLOCKED';
  lastVerificationTimestamp: number;
  notes?: string;
}

export interface ApiCandle {
  provider: 'BINANCE' | 'DUKASCOPY';
  instrumentId: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  volumeDefinition: string;
  priceBasis: string;
  timeframe: string;
  m1CandleCount: number;
  isIncomplete: boolean;
}

export interface HistoricalRangeResult {
  candles: ApiCandle[];
  sources: CachedDaySource[];
  resolution: '1m' | '5m' | '1h';
  isCanonicalM1: boolean;
  notes: string[];
}

const YAHOO_FALLBACK_SYMBOLS: Record<string, string> = {
  XAUUSD: 'GC=F',
  XAGUSD: 'SI=F',
  XPTUSD: 'PL=F',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'JPY=X',
  AUDUSD: 'AUDUSD=X',
  USDCAD: 'CAD=X',
  USDCHF: 'CHF=X',
  NZDUSD: 'NZDUSD=X',
  EURGBP: 'EURGBP=X',
  EURJPY: 'EURJPY=X',
  GBPJPY: 'GBPJPY=X',
  US30: 'YM=F',
  SPX500: 'ES=F',
  NAS100: 'NQ=F',
  GER40: '^GDAXI',
  UK100: '^FTSE',
  JPN225: '^N225',
};

const inFlightDayRequests = new Map<string, Promise<CachedUtcDayEntry>>();
let expressDownUntilMs = 0;

function isLocalHostname(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function getBinanceBaseUrl(): string {
  return isLocalHostname() ? '/binance-api' : 'https://data-api.binance.vision';
}

function resolveInstrument(instrumentId: string): ApiMarketInstrument {
  const clean = instrumentId.trim().toUpperCase();
  const found =
    CANONICAL_CATALOG_INSTRUMENTS.find((i) => i.id === clean) ||
    CANONICAL_CATALOG_INSTRUMENTS.find((i) => i.providerSymbol === (clean.split(':')[1] || clean));
  if (!found) {
    throw new Error(`Unknown instrument: ${instrumentId}`);
  }
  return found;
}

function mapRawToApiCandle(
  inst: ApiMarketInstrument,
  raw: { timestamp: number; open: number; high: number; low: number; close: number; volume: number | null }
): ApiCandle {
  return {
    provider: inst.provider,
    instrumentId: inst.id,
    timestamp: Math.floor(raw.timestamp / 60000) * 60000,
    open: Number(raw.open),
    high: Number(raw.high),
    low: Number(raw.low),
    close: Number(raw.close),
    volume: raw.volume !== null && raw.volume !== undefined && Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : null,
    volumeDefinition:
      inst.provider === 'BINANCE' ? 'BASE_ASSET_VOLUME' : raw.volume !== null ? 'TICK_VOLUME' : 'UNAVAILABLE',
    priceBasis: inst.priceBasis,
    timeframe: 'M1',
    m1CandleCount: 1,
    isIncomplete: false,
  };
}

async function fetchJsonSafe<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) {
    throw new Error(`Non-JSON response (${res.status}) from ${url}`);
  }
  const data = (await res.json()) as T & { success?: boolean; error?: string };
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status} from ${url}`);
  }
  return data;
}

async function fetchBinanceDayClientSide(inst: ApiMarketInstrument, dateStr: string): Promise<CachedUtcDayEntry | null> {
  const dayStart = Date.parse(`${dateStr}T00:00:00Z`);
  if (isNaN(dayStart) || dayStart >= Date.now()) return null;
  const dayEnd = Math.min(dayStart + 86400000 - 1, Date.now());

  const base = getBinanceBaseUrl();
  const byTs = new Map<number, ApiCandle>();
  let cursor = dayStart;
  let guard = 0;

  while (cursor <= dayEnd && guard < 4) {
    guard++;
    const url = `${base}/api/v3/klines?symbol=${encodeURIComponent(
      inst.providerSymbol
    )}&interval=1m&startTime=${cursor}&endTime=${dayEnd}&limit=1000`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) return null;
    const rows = (await res.json()) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) break;

    let lastTs = cursor;
    for (const r of rows) {
      if (!Array.isArray(r)) continue;
      const ts = Math.floor(Number(r[0]) / 60000) * 60000;
      lastTs = ts;
      if (ts < dayStart || ts >= dayStart + 86400000) continue;
      const o = Number(r[1]);
      const h = Number(r[2]);
      const l = Number(r[3]);
      const c = Number(r[4]);
      const v = Number(r[5]);
      if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c) || o <= 0 || l <= 0) {
        continue;
      }
      byTs.set(ts, mapRawToApiCandle(inst, { timestamp: ts, open: o, high: Math.max(o, h, l, c), low: Math.min(o, h, l, c), close: c, volume: v }));
    }

    if (rows.length < 1000 || lastTs < cursor) break;
    cursor = lastTs + 60000;
  }

  return {
    key: `${inst.id}::${dateStr}`,
    instrumentId: inst.id,
    date: dateStr,
    source: 'BINANCE_SPOT_1M',
    resolution: '1m',
    isCanonicalM1: true,
    candles: Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp),
    fetchedAt: Date.now(),
  };
}

async function fetchBitgetXautDayClientSide(inst: ApiMarketInstrument, dateStr: string): Promise<CachedUtcDayEntry | null> {
  const dayStart = Date.parse(`${dateStr}T00:00:00Z`);
  if (isNaN(dayStart) || dayStart >= Date.now()) return null;
  const dayEnd = Math.min(dayStart + 86400000, Date.now() + 60000);

  const byTs = new Map<number, ApiCandle>();
  let cursorEnd = dayEnd;
  let guard = 0;

  while (cursorEnd > dayStart && guard < 20) {
    guard++;
    const isRecent = Date.now() - cursorEnd < 3 * 86400000;
    const endpoint = isRecent ? 'candles' : 'history-candles';
    const url = `https://api.bitget.com/api/v2/spot/market/${endpoint}?symbol=XAUTUSDT&granularity=1min&endTime=${cursorEnd}&limit=200`;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      const json = (await res.json()) as { data?: string[][] };
      const rows = json?.data;
      if (!Array.isArray(rows) || rows.length === 0) break;

      let earliest = cursorEnd;
      for (const r of rows) {
        const ts = Math.floor(Number(r[0]) / 60000) * 60000;
        if (ts < earliest) earliest = ts;
        if (ts < dayStart || ts >= dayStart + 86400000) continue;
        const o = Number(r[1]);
        const h = Number(r[2]);
        const l = Number(r[3]);
        const c = Number(r[4]);
        const v = Number(r[5]);
        if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c) || o <= 0 || l <= 0) {
          continue;
        }
        byTs.set(
          ts,
          mapRawToApiCandle(inst, {
            timestamp: ts,
            open: o,
            high: Math.max(o, h, l, c),
            low: Math.min(o, h, l, c),
            close: c,
            volume: Number.isFinite(v) ? v : null,
          })
        );
      }
      if (earliest >= cursorEnd) break;
      cursorEnd = earliest;
    } catch {
      break;
    }
  }

  const dow = new Date(dayStart).getUTCDay();
  if (dow === 6) return null;
  const effectiveMinTs = dow === 0 ? dayStart + 22 * 3600000 : dayStart;

  const candles = Array.from(byTs.values())
    .filter((c) => c.timestamp >= effectiveMinTs)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (candles.length === 0) return null;

  return {
    key: `${inst.id}::${dateStr}`,
    instrumentId: inst.id,
    date: dateStr,
    source: 'BITGET_XAUTUSDT_1M',
    resolution: '1m',
    isCanonicalM1: false,
    note: 'Spot Gold 1m via Bitget XAUT/USDT (secondary feed)',
    candles,
    fetchedAt: Date.now(),
  };
}

async function fetchYahooDayViaLocalViteProxy(inst: ApiMarketInstrument, dateStr: string): Promise<CachedUtcDayEntry | null> {
  if (!isLocalHostname()) return null;
  const yahooSym = YAHOO_FALLBACK_SYMBOLS[inst.providerSymbol];
  if (!yahooSym) return null;

  const dayStart = Date.parse(`${dateStr}T00:00:00Z`);
  if (isNaN(dayStart) || dayStart >= Date.now()) return null;
  const dayEnd = dayStart + 86400000;
  const ageDays = Math.max(0, (Date.now() - dayStart) / 86400000);

  const attempts: Array<{ interval: string; res: '1m' | '5m' | '1h'; src: CachedDaySource }> =
    ageDays <= 7
      ? [
          { interval: '1m', res: '1m', src: 'YAHOO_1M' },
          { interval: '5m', res: '5m', src: 'YAHOO_5M' },
        ]
      : ageDays <= 58
      ? [
          { interval: '5m', res: '5m', src: 'YAHOO_5M' },
          { interval: '1h', res: '1h', src: 'YAHOO_1H' },
        ]
      : [{ interval: '1h', res: '1h', src: 'YAHOO_1H' }];

  const p1 = Math.max(0, Math.floor((dayStart - 3600000) / 1000));
  const p2 = Math.floor((dayEnd + 3600000) / 1000);

  for (const att of attempts) {
    try {
      const json = await fetchJsonSafe<any>(
        `/yahoo-api/v8/finance/chart/${encodeURIComponent(yahooSym)}?period1=${p1}&period2=${p2}&interval=${att.interval}`
      );
      const result = json?.chart?.result?.[0];
      const timestamps: number[] = result?.timestamp || [];
      const q = result?.indicators?.quote?.[0];
      if (!q || timestamps.length === 0) continue;

      const candles: ApiCandle[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const ts = Math.floor((timestamps[i] * 1000) / 60000) * 60000;
        if (ts < dayStart || ts >= dayEnd) continue;
        const o = q.open?.[i];
        const h = q.high?.[i];
        const l = q.low?.[i];
        const c = q.close?.[i];
        const v = q.volume?.[i];
        if (
          typeof o !== 'number' ||
          typeof h !== 'number' ||
          typeof l !== 'number' ||
          typeof c !== 'number' ||
          !Number.isFinite(o) ||
          !Number.isFinite(h) ||
          !Number.isFinite(l) ||
          !Number.isFinite(c) ||
          o <= 0 ||
          l <= 0
        ) {
          continue;
        }
        candles.push(
          mapRawToApiCandle(inst, {
            timestamp: ts,
            open: o,
            high: Math.max(o, h, l, c),
            low: Math.min(o, h, l, c),
            close: c,
            volume: typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null,
          })
        );
      }

      if (candles.length > 0) {
        return {
          key: `${inst.id}::${dateStr}`,
          instrumentId: inst.id,
          date: dateStr,
          source: att.src,
          resolution: att.res,
          isCanonicalM1: false,
          note: `Real ${att.res} candles via Yahoo Finance (${yahooSym})`,
          candles,
          fetchedAt: Date.now(),
        };
      }
    } catch {
      // try next
    }
  }
  return null;
}

interface BackendDayPayload {
  success: boolean;
  instrumentId: string;
  date: string;
  source: CachedDaySource;
  resolution: '1m' | '5m' | '1h';
  isCanonicalM1: boolean;
  isWeekendOrHoliday?: boolean;
  note?: string;
  candles: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | null;
  }>;
}

async function fetchDayFromBackendOrNetlify(
  inst: ApiMarketInstrument,
  dateStr: string
): Promise<CachedUtcDayEntry | null> {
  const qs = `instrument=${encodeURIComponent(inst.id)}&date=${encodeURIComponent(dateStr)}`;
  const candidateUrls: string[] = [];

  if (typeof window === 'undefined') {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    candidateUrls.push(`${baseUrl}/api/market-data/day?${qs}`);
  } else if (isLocalHostname()) {
    if (Date.now() >= expressDownUntilMs) {
      candidateUrls.push(`/api/market-data/day?${qs}`);
    }
    candidateUrls.push(`/.netlify/functions/market-candles?${qs}`);
  } else {
    candidateUrls.push(`/.netlify/functions/market-candles?${qs}`);
  }

  for (const url of candidateUrls) {
    try {
      const data = await fetchJsonSafe<BackendDayPayload>(url);
      if (data && data.success && Array.isArray(data.candles)) {
        return {
          key: `${inst.id}::${dateStr}`,
          instrumentId: inst.id,
          date: dateStr,
          source: data.source,
          resolution: data.resolution,
          isCanonicalM1: Boolean(data.isCanonicalM1),
          isWeekendOrHoliday: data.isWeekendOrHoliday,
          note: data.note,
          candles: data.candles.map((c) => mapRawToApiCandle(inst, c)),
          fetchedAt: Date.now(),
        };
      }
    } catch (err) {
      if (url.startsWith('/api/market-data/day')) {
        expressDownUntilMs = Date.now() + 30_000;
      }
      console.warn(`[MarketDataApi] Day endpoint ${url} failed:`, err instanceof Error ? err.message : String(err));
    }
  }
  return null;
}

async function fetchRealUtcDay(
  inst: ApiMarketInstrument,
  dateStr: string
): Promise<{ entry: CachedUtcDayEntry; fromCache: boolean }> {
  const dayStart = Date.parse(`${dateStr}T00:00:00Z`);
  if (isNaN(dayStart)) {
    throw new Error(`Invalid UTC date "${dateStr}"`);
  }
  const dayEnd = dayStart + 86400000;

  if (typeof window !== 'undefined') {
    const cached = await MarketDataCache.getDay(inst.id, dateStr, dayEnd);
    if (cached) {
      return { entry: cached, fromCache: true };
    }
  }

  const inflightKey = `${inst.id}::${dateStr}`;
  const existing = inFlightDayRequests.get(inflightKey);
  if (existing) {
    const entry = await existing;
    return { entry, fromCache: true };
  }

  const work = (async (): Promise<CachedUtcDayEntry> => {
    // 1. Binance Crypto direct CORS first
    if (inst.provider === 'BINANCE') {
      const direct = await fetchBinanceDayClientSide(inst, dateStr);
      if (direct) {
        if (typeof window !== 'undefined') await MarketDataCache.putDay(direct);
        return direct;
      }
    }

    // 2. Backend Express / Netlify Serverless Function (Dukascopy BI5 -> FXCM M1 -> Bitget -> Yahoo)
    const remote = await fetchDayFromBackendOrNetlify(inst, dateStr);
    if (remote) {
      if (typeof window !== 'undefined') await MarketDataCache.putDay(remote);
      return remote;
    }

    // 3. Direct client-side emergency fallbacks (e.g. running `npm run dev` without Express)
    if (inst.providerSymbol === 'XAUUSD') {
      const bitgetGold = await fetchBitgetXautDayClientSide(inst, dateStr);
      if (bitgetGold) {
        if (typeof window !== 'undefined') await MarketDataCache.putDay(bitgetGold);
        return bitgetGold;
      }
    }

    const yahoo = await fetchYahooDayViaLocalViteProxy(inst, dateStr);
    if (yahoo) {
      if (typeof window !== 'undefined') await MarketDataCache.putDay(yahoo);
      return yahoo;
    }

    throw new Error(
      `No genuine historical market data could be retrieved for ${inst.providerSymbol} on ${dateStr} UTC.`
    );
  })().finally(() => {
    inFlightDayRequests.delete(inflightKey);
  });

  inFlightDayRequests.set(inflightKey, work);
  const entry = await work;
  return { entry, fromCache: false };
}

function enumerateUtcDates(fromTs: number, toTs: number, maxDays: number = 62): string[] {
  const fromDate = new Date(fromTs);
  let cur = Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate());
  const toDate = new Date(toTs);
  const end = Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate());

  const dates: string[] = [];
  while (cur <= end) {
    if (dates.length >= maxDays) {
      throw new Error(`Date range exceeds ${maxDays} days. Please select a narrower range (up to 60 days per session).`);
    }
    dates.push(new Date(cur).toISOString().slice(0, 10));
    cur += 86400000;
  }
  return dates;
}

const RES_RANK: Record<'1m' | '5m' | '1h', number> = { '1m': 1, '5m': 2, '1h': 3 };

export async function fetchHistoricalRangeM1(
  instrumentId: string,
  fromTs: number,
  toTs: number
): Promise<HistoricalRangeResult> {
  const inst = resolveInstrument(instrumentId);
  const alignedFrom = Math.floor(fromTs / 60000) * 60000;
  const alignedTo = Math.floor(toTs / 60000) * 60000;
  if (alignedTo < alignedFrom) {
    return { candles: [], sources: [], resolution: '1m', isCanonicalM1: true, notes: [] };
  }

  const dates = enumerateUtcDates(alignedFrom, alignedTo);
  const byTs = new Map<number, ApiCandle>();
  const sourceSet = new Set<CachedDaySource>();
  const notesSet = new Set<string>();
  let worstRes: '1m' | '5m' | '1h' = '1m';
  let allCanonical = true;
  let lastError: string | null = null;
  let daysWithSuccess = 0;

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i];
    try {
      const { entry, fromCache } = await fetchRealUtcDay(inst, dateStr);
      daysWithSuccess++;
      if (entry.candles.length > 0) {
        sourceSet.add(entry.source);
        if (!entry.isCanonicalM1) allCanonical = false;
        if (RES_RANK[entry.resolution] > RES_RANK[worstRes]) {
          worstRes = entry.resolution;
        }
        if (entry.note) notesSet.add(entry.note);

        for (const c of entry.candles) {
          if (c.timestamp >= alignedFrom && c.timestamp <= alignedTo) {
            byTs.set(c.timestamp, c);
          }
        }
      }
      if (!fromCache && i < dates.length - 1) {
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const candles = Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);

  if (candles.length === 0) {
    if (daysWithSuccess === 0 && lastError) {
      throw new Error(lastError);
    }
    throw new Error(
      `No genuine market candles exist for ${inst.providerSymbol} between ${dates[0]} and ${
        dates[dates.length - 1]
      } UTC (selected range may fall on a weekend/holiday closure or future date).`
    );
  }

  return {
    candles,
    sources: Array.from(sourceSet),
    resolution: worstRes,
    isCanonicalM1: allCanonical,
    notes: Array.from(notesSet),
  };
}

export async function fetchRealHistoricalM1Candles(
  instrumentId: string,
  fromTs: number,
  toTs: number,
  limit: number = 10000
): Promise<ApiCandle[]> {
  const res = await fetchHistoricalRangeM1(instrumentId, fromTs, toTs);
  return res.candles.slice(0, limit);
}

export class MarketDataApi {
  private static async request<T>(endpoint: string): Promise<T> {
    const baseUrl = typeof window === 'undefined' ? process.env.API_BASE_URL || 'http://localhost:3001' : '';
    const res = await fetch(baseUrl + endpoint, {
      headers: { Accept: 'application/json' },
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      throw new Error(`Endpoint ${endpoint} did not return JSON`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API error [${res.status}]: ${body || res.statusText}`);
    }
    return (await res.json()) as T;
  }

  public static async getProviders(): Promise<ApiProviderStatus[]> {
    const data = await this.request<{ success: boolean; providers: ApiProviderStatus[] }>('/api/market-data/providers');
    return data.providers;
  }

  public static async getMarkets(): Promise<ApiMarketCategory[]> {
    const canonical: ApiMarketCategory[] = [
      { id: 'crypto', name: 'Cryptocurrency', code: 'CRP', intendedSource: 'BINANCE', status: 'AVAILABLE', instrumentCount: 5, storedCandlesCount: 0 },
      { id: 'forex', name: 'Forex', code: 'FX', intendedSource: 'DUKASCOPY', status: 'AVAILABLE', instrumentCount: 10, storedCandlesCount: 0 },
      { id: 'metals', name: 'Metals', code: 'MTL', intendedSource: 'DUKASCOPY', status: 'AVAILABLE', instrumentCount: 3, storedCandlesCount: 0 },
      { id: 'indices', name: 'Indices', code: 'IDX', intendedSource: 'DUKASCOPY', status: 'AVAILABLE', instrumentCount: 6, storedCandlesCount: 0 },
    ];
    if (typeof window !== 'undefined' && (!isLocalHostname() || Date.now() < expressDownUntilMs)) {
      return canonical;
    }
    try {
      const data = await this.request<{ success: boolean; categories: ApiMarketCategory[] }>('/api/markets');
      return data.categories;
    } catch {
      expressDownUntilMs = Date.now() + 30_000;
      return canonical;
    }
  }

  public static async getInstruments(market: string, query: string = ''): Promise<ApiMarketInstrument[]> {
    const qNorm = query.trim().toUpperCase();
    const canonical = CANONICAL_CATALOG_INSTRUMENTS.filter(
      (i) =>
        i.marketCategory === market &&
        (!qNorm || i.providerSymbol.includes(qNorm) || i.displayName.toUpperCase().includes(qNorm))
    );
    if (typeof window !== 'undefined' && (!isLocalHostname() || Date.now() < expressDownUntilMs)) {
      return canonical;
    }
    try {
      const q = query ? `?q=${encodeURIComponent(query)}` : '';
      const data = await this.request<{ success: boolean; instruments: ApiMarketInstrument[] }>(
        `/api/markets/${market}/instruments${q}`
      );
      return data.instruments;
    } catch {
      expressDownUntilMs = Date.now() + 30_000;
      return canonical;
    }
  }

  public static async getCoverage(instrumentId: string): Promise<{
    instrument: ApiMarketInstrument;
    coverage: ApiCoverage;
  }> {
    const inst = resolveInstrument(instrumentId);
    if (typeof window === 'undefined' || (isLocalHostname() && Date.now() >= expressDownUntilMs)) {
      try {
        return await this.request<{
          success: boolean;
          instrument: ApiMarketInstrument;
          coverage: ApiCoverage;
        }>(`/api/market-data/coverage?instrument=${encodeURIComponent(inst.id)}`);
      } catch {
        if (typeof window === 'undefined') throw new Error(`Coverage request failed for ${inst.id}`);
        expressDownUntilMs = Date.now() + 30_000;
      }
    }

    const cachedCount = await MarketDataCache.getInstrumentCachedCount(inst.id);
    return {
      instrument: inst,
      coverage: {
        provider: inst.provider,
        instrumentId: inst.id,
        priceBasis: inst.priceBasis,
        earliestVerifiedTimestamp: null,
        latestVerifiedTimestamp: null,
        totalCandlesCount: cachedCount,
        availableRanges: [],
        missingIntervals: [],
        coverageStatus: 'VERIFIED',
        lastVerificationTimestamp: Date.now(),
        notes:
          inst.provider === 'BINANCE'
            ? 'On-demand Binance Spot 1m historical archive (2019–present).'
            : 'On-demand Dukascopy BI5 institutional 1m historical archive (with FXCM/Spot fallback).',
      },
    };
  }

  public static async getCandles(
    instrumentId: string,
    timeframe: string,
    from: number,
    to: number,
    limit: number = 10000
  ): Promise<{
    candles: ApiCandle[];
    candleCount: number;
    m1CandlesRetrieved: number;
    coverage: ApiCoverage | null;
  }> {
    if (typeof window === 'undefined') {
      const params = new URLSearchParams({
        instrument: instrumentId,
        timeframe,
        from: String(from),
        to: String(to),
        limit: String(limit),
      });
      return this.request(`/api/market-data/candles?${params.toString()}`);
    }

    const res = await fetchHistoricalRangeM1(instrumentId, from, to);
    const sliced = res.candles.slice(0, limit);
    return {
      candles: sliced,
      candleCount: sliced.length,
      m1CandlesRetrieved: sliced.length,
      coverage: null,
    };
  }

  public static async initReplaySession(params: {
    instrumentId: string;
    timeframe: string;
    startTimestamp: number;
    endTimestamp: number;
    contextBarsCount?: number;
  }): Promise<{
    instrument: ApiMarketInstrument;
    timeframe: string;
    startTimestamp: number;
    endTimestamp: number;
    initialCursor: number;
    contextBarsCount: number;
    initialContextCandles: ApiCandle[];
    availableM1CountInRange: number;
    coverage: ApiCoverage;
  }> {
    if (typeof window === 'undefined') {
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
      const res = await fetch(baseUrl + '/api/replay/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`API error [${res.status}]: ${body || res.statusText}`);
      }
      return (await res.json()) as any;
    }

    const covRes = await this.getCoverage(params.instrumentId);
    return {
      instrument: covRes.instrument,
      timeframe: params.timeframe,
      startTimestamp: params.startTimestamp,
      endTimestamp: params.endTimestamp,
      initialCursor: params.startTimestamp,
      contextBarsCount: 0,
      initialContextCandles: [],
      availableM1CountInRange: Math.max(1, Math.floor((params.endTimestamp - params.startTimestamp) / 60000)),
      coverage: covRes.coverage,
    };
  }

  public static async getReplayCandles(params: {
    instrumentId: string;
    from: number;
    cursor: number;
    limit?: number;
  }): Promise<{
    instrumentId: string;
    fromTimestamp: number;
    cursorTimestamp: number;
    candleCount: number;
    candles: ApiCandle[];
  }> {
    if (typeof window === 'undefined') {
      const q = new URLSearchParams({
        instrument: params.instrumentId,
        from: String(params.from),
        cursor: String(params.cursor),
        limit: String(params.limit || 2000),
      });
      return this.request(`/api/replay/candles?${q.toString()}`);
    }

    const res = await fetchHistoricalRangeM1(params.instrumentId, params.from, params.cursor);
    const candles = params.limit ? res.candles.slice(0, params.limit) : res.candles;
    return {
      instrumentId: params.instrumentId,
      fromTimestamp: params.from,
      cursorTimestamp: params.cursor,
      candleCount: candles.length,
      candles,
    };
  }
}

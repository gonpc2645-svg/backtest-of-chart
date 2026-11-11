import https from 'node:https';
import http from 'node:http';
import zlib from 'node:zlib';
import * as lzmaNs from 'lzma';

const lzma = {
  decompress: (
    typeof lzmaNs.decompress === 'function'
      ? lzmaNs.decompress
      : (lzmaNs as unknown as { default: { decompress: typeof lzmaNs.decompress } }).default.decompress
  ) as (data: Buffer | Uint8Array | number[]) => number[] | Uint8Array | Buffer | string,
};

export type HistoricalDataSource =
  | 'DUKASCOPY_BI5'
  | 'FXCM_M1'
  | 'BINANCE_SPOT_1M'
  | 'BITGET_XAUTUSDT_1M'
  | 'YAHOO_1M'
  | 'YAHOO_5M'
  | 'YAHOO_1H';

export type HistoricalResolution = '1m' | '5m' | '1h';

export interface ProviderCandle {
  timestamp: number; // UTC Unix ms aligned to minute
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface DayFetchResult {
  instrumentId: string;
  date: string; // YYYY-MM-DD (UTC)
  source: HistoricalDataSource;
  resolution: HistoricalResolution;
  isCanonicalM1: boolean;
  candles: ProviderCandle[];
  isWeekendOrHoliday?: boolean;
  note?: string;
}

interface DukascopyInstrumentMeta {
  dukascopySymbol: string;
  pointScale: number;
  decimals: number;
  fxcmSymbol?: string;
  yahooSymbols: string[];
  bitgetGoldSymbol?: string;
}

const DUKASCOPY_META: Record<string, DukascopyInstrumentMeta> = {
  // Forex (non-JPY)
  EURUSD: { dukascopySymbol: 'EURUSD', pointScale: 100000, decimals: 5, fxcmSymbol: 'EURUSD', yahooSymbols: ['EURUSD=X'] },
  GBPUSD: { dukascopySymbol: 'GBPUSD', pointScale: 100000, decimals: 5, fxcmSymbol: 'GBPUSD', yahooSymbols: ['GBPUSD=X'] },
  AUDUSD: { dukascopySymbol: 'AUDUSD', pointScale: 100000, decimals: 5, fxcmSymbol: 'AUDUSD', yahooSymbols: ['AUDUSD=X'] },
  USDCAD: { dukascopySymbol: 'USDCAD', pointScale: 100000, decimals: 5, fxcmSymbol: 'USDCAD', yahooSymbols: ['CAD=X'] },
  USDCHF: { dukascopySymbol: 'USDCHF', pointScale: 100000, decimals: 5, fxcmSymbol: 'USDCHF', yahooSymbols: ['CHF=X'] },
  NZDUSD: { dukascopySymbol: 'NZDUSD', pointScale: 100000, decimals: 5, fxcmSymbol: 'NZDUSD', yahooSymbols: ['NZDUSD=X'] },
  EURGBP: { dukascopySymbol: 'EURGBP', pointScale: 100000, decimals: 5, fxcmSymbol: 'EURGBP', yahooSymbols: ['EURGBP=X'] },

  // Forex (JPY)
  USDJPY: { dukascopySymbol: 'USDJPY', pointScale: 1000, decimals: 3, fxcmSymbol: 'USDJPY', yahooSymbols: ['JPY=X'] },
  EURJPY: { dukascopySymbol: 'EURJPY', pointScale: 1000, decimals: 3, fxcmSymbol: 'EURJPY', yahooSymbols: ['EURJPY=X'] },
  GBPJPY: { dukascopySymbol: 'GBPJPY', pointScale: 1000, decimals: 3, fxcmSymbol: 'GBPJPY', yahooSymbols: ['GBPJPY=X'] },

  // Metals
  XAUUSD: {
    dukascopySymbol: 'XAUUSD',
    pointScale: 1000,
    decimals: 3,
    bitgetGoldSymbol: 'XAUTUSDT',
    yahooSymbols: ['GC=F'],
  },
  XAGUSD: { dukascopySymbol: 'XAGUSD', pointScale: 1000, decimals: 3, yahooSymbols: ['SI=F'] },
  XPTUSD: { dukascopySymbol: 'XPTUSD', pointScale: 1000, decimals: 3, yahooSymbols: ['PL=F'] },

  // Indices
  US30: { dukascopySymbol: 'USA30IDXUSD', pointScale: 1000, decimals: 2, yahooSymbols: ['^DJI', 'YM=F'] },
  SPX500: { dukascopySymbol: 'USA500IDXUSD', pointScale: 1000, decimals: 2, yahooSymbols: ['^GSPC', 'ES=F'] },
  NAS100: { dukascopySymbol: 'USATECHIDXUSD', pointScale: 1000, decimals: 2, yahooSymbols: ['^IXIC', 'NQ=F'] },
  GER40: { dukascopySymbol: 'DEUIDXEUR', pointScale: 1000, decimals: 2, yahooSymbols: ['^GDAXI'] },
  UK100: { dukascopySymbol: 'GBRIDXGBP', pointScale: 1000, decimals: 2, yahooSymbols: ['^FTSE'] },
  JPN225: { dukascopySymbol: 'JPNIDXJPY', pointScale: 1000, decimals: 2, yahooSymbols: ['^N225'] },
};

// Track per-process cooldown if Dukascopy returns 429/503 so we don't keep pounding their rate limit
let dukascopyCooldownUntilMs = 0;
let dukascopyQueueTail: Promise<void> = Promise.resolve();

function runSerializedDukascopy<T>(fn: () => Promise<T>): Promise<T> {
  const next = dukascopyQueueTail.then(async () => {
    const res = await fn();
    await new Promise((r) => setTimeout(r, 150));
    return res;
  });
  dukascopyQueueTail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export function parseUtcDateStr(dateStr: string): { year: number; month: number; day: number; dayStartMs: number; dow: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1..12
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dayStartMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const check = new Date(dayStartMs);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day, dayStartMs, dow: check.getUTCDay() };
}

function getRequestBufferIPv4(
  urlStr: string,
  headers: Record<string, string> = {},
  timeoutMs: number = 9000,
  redirectsLeft: number = 3
): Promise<{ status: number; body: Buffer; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const transport = parsed.protocol === 'http:' ? http : https;
    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        family: 4, // Force IPv4 to avoid Windows/Node Happy Eyeballs IPv6 hangs
        headers: {
          'User-Agent': 'BacktestOfChart/1.0 (+https://backtestofchart.netlify.app)',
          Accept: '*/*',
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode || 0;
        if ((status === 301 || status === 302 || status === 307 || status === 308) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const nextUrl = new URL(res.headers.location, urlStr).toString();
          getRequestBufferIPv4(nextUrl, headers, timeoutMs, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status,
            body: Buffer.concat(chunks),
            headers: res.headers as Record<string, string | string[] | undefined>,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms: ${parsed.hostname}`));
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

export function decodeDukascopyBi5Candles(
  compressedBuf: Buffer,
  dayStartMs: number,
  pointScale: number,
  decimals: number
): ProviderCandle[] {
  if (!compressedBuf || compressedBuf.length === 0) return [];
  const decompressed = lzma.decompress(compressedBuf);
  const raw = Buffer.from(Uint8Array.from(decompressed as number[]));
  if (raw.length < 24) return [];

  const round = (v: number) => Number(v.toFixed(decimals));
  const byTs = new Map<number, ProviderCandle>();

  for (let offset = 0; offset + 24 <= raw.length; offset += 24) {
    const secOffset = raw.readInt32BE(offset);
    if (secOffset < 0 || secOffset >= 86400) continue;

    const rawOpen = raw.readInt32BE(offset + 4);
    const rawClose = raw.readInt32BE(offset + 8);
    const rawLow = raw.readInt32BE(offset + 12);
    const rawHigh = raw.readInt32BE(offset + 16);
    const volume = raw.readFloatBE(offset + 20);

    // Strip zero-volume flat market-closed maintenance / holiday bars
    if (!Number.isFinite(volume) || volume <= 0) continue;

    const open = round(rawOpen / pointScale);
    const close = round(rawClose / pointScale);
    const low = round(rawLow / pointScale);
    const high = round(rawHigh / pointScale);

    if (
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      open <= 0 ||
      low <= 0 ||
      high < low
    ) {
      continue;
    }

    const safeHigh = Math.max(open, high, low, close);
    const safeLow = Math.min(open, high, low, close);
    const ts = Math.floor((dayStartMs + secOffset * 1000) / 60000) * 60000;

    byTs.set(ts, {
      timestamp: ts,
      open,
      high: safeHigh,
      low: safeLow,
      close,
      volume: Number(volume.toFixed(4)),
    });
  }

  return Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchDukascopyBi5ForDay(
  symbol: string,
  meta: DukascopyInstrumentMeta,
  dateStr: string
): Promise<{ status: 'OK' | 'NOT_FOUND' | 'RATE_LIMITED' | 'ERROR'; candles: ProviderCandle[]; error?: string }> {
  const parsed = parseUtcDateStr(dateStr);
  if (!parsed) return { status: 'ERROR', candles: [], error: `Invalid date: ${dateStr}` };
  // Saturday has no Dukascopy FX/Metals/Indices session
  if (parsed.dow === 6) return { status: 'OK', candles: [] };

  if (Date.now() < dukascopyCooldownUntilMs) {
    return { status: 'RATE_LIMITED', candles: [], error: 'Dukascopy cooldown active after prior 429/503' };
  }

  const mm0 = String(parsed.month - 1).padStart(2, '0');
  const dd = String(parsed.day).padStart(2, '0');
  const url = `https://datafeed.dukascopy.com/datafeed/${meta.dukascopySymbol}/${parsed.year}/${mm0}/${dd}/BID_candles_min_1.bi5`;

  return runSerializedDukascopy(async () => {
    if (Date.now() < dukascopyCooldownUntilMs) {
      return { status: 'RATE_LIMITED', candles: [], error: 'Dukascopy cooldown active after prior 429/503' };
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await getRequestBufferIPv4(url, {}, attempt === 0 ? 9000 : 12000);
        if (res.status === 429 || res.status === 503) {
          dukascopyCooldownUntilMs = Date.now() + 60 * 1000;
          return { status: 'RATE_LIMITED', candles: [], error: `Dukascopy HTTP ${res.status}` };
        }
        if (res.status === 404) {
          return { status: 'NOT_FOUND', candles: [] };
        }
        if (res.status !== 200) {
          return { status: 'ERROR', candles: [], error: `Dukascopy HTTP ${res.status} for ${symbol}` };
        }
        if (res.body.length === 0) {
          return { status: 'OK', candles: [] };
        }
        const candles = decodeDukascopyBi5Candles(res.body, parsed.dayStartMs, meta.pointScale, meta.decimals);
        return { status: 'OK', candles };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt === 0 && msg.includes('timed out')) {
          continue;
        }
        return { status: 'ERROR', candles: [], error: msg };
      }
    }
    return { status: 'ERROR', candles: [], error: `Dukascopy request exhausted for ${symbol}` };
  });
}

function getIsoWeekOfDate(utcMs: number): { isoYear: number; isoWeek: number } {
  const d = new Date(utcMs);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // Thursday of ISO week
  const isoYear = target.getUTCFullYear();
  const jan4 = Date.UTC(isoYear, 0, 4);
  const isoWeek = 1 + Math.round(((target.getTime() - jan4) / 86400000 - 3 + ((new Date(jan4).getUTCDay() + 6) % 7)) / 7);
  return { isoYear, isoWeek };
}

async function fetchFxcmM1ForDay(
  fxcmSymbol: string,
  dateStr: string
): Promise<{ status: 'OK' | 'NOT_FOUND' | 'ERROR'; candles: ProviderCandle[] }> {
  const parsed = parseUtcDateStr(dateStr);
  if (!parsed) return { status: 'ERROR', candles: [] };
  if (parsed.dow === 6) return { status: 'OK', candles: [] };
  if (parsed.year < 2019) return { status: 'NOT_FOUND', candles: [] };

  // Trading week runs Sunday ~22:00 UTC -> Friday ~22:00 UTC.
  // For Mon..Fri, align to Monday of the trading week; for Sunday, align to Monday = +1 day.
  const mondayOffsetDays = parsed.dow === 0 ? 1 : 1 - parsed.dow;
  const tradingMondayMs = parsed.dayStartMs + mondayOffsetDays * 86400000;
  const { isoYear, isoWeek } = getIsoWeekOfDate(tradingMondayMs);

  const mmStr = String(parsed.month).padStart(2, '0');
  const ddStr = String(parsed.day).padStart(2, '0');
  const targetPrefix = `${mmStr}/${ddStr}/${parsed.year} `;

  // FXCM numbers weekly files starting either at ISO week or ISO week - 1 (observed around Jan 2026)
  const candidates: Array<{ year: number; week: number }> = [
    { year: isoYear, week: isoWeek },
    ...(isoWeek > 1 ? [{ year: isoYear, week: isoWeek - 1 }] : []),
    { year: isoYear, week: isoWeek + 1 },
  ];

  for (const cand of candidates) {
    const url = `https://candledata.fxcorporate.com/m1/${fxcmSymbol}/${cand.year}/${cand.week}.csv.gz`;
    try {
      const res = await getRequestBufferIPv4(url, {}, 9000);
      if (res.status !== 200 || res.body.length < 30) continue;

      const text = zlib.gunzipSync(res.body).toString('utf8').replace(/\0/g, '');
      const lines = text.split(/\r?\n/);
      // Quick date boundary check so we accept only the matching week file
      let sawSameYearMonth = false;
      const byTs = new Map<number, ProviderCandle>();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        if (!line.startsWith(targetPrefix)) {
          if (!sawSameYearMonth && line.includes(`/${parsed.year} `)) {
            sawSameYearMonth = true;
          }
          continue;
        }
        const parts = line.split(',');
        if (parts.length < 5) continue;
        const timePart = parts[0].slice(11); // "HH:MM:SS.000"
        const hh = Number(timePart.slice(0, 2));
        const mm = Number(timePart.slice(3, 5));
        if (!Number.isInteger(hh) || !Number.isInteger(mm)) continue;

        const o = Number(parts[1]);
        const h = Number(parts[2]);
        const l = Number(parts[3]);
        const c = Number(parts[4]);
        if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c) || o <= 0 || l <= 0) {
          continue;
        }

        const ts = Date.UTC(parsed.year, parsed.month - 1, parsed.day, hh, mm, 0, 0);
        byTs.set(ts, {
          timestamp: ts,
          open: o,
          high: Math.max(o, h, l, c),
          low: Math.min(o, h, l, c),
          close: c,
          volume: null,
        });
      }

      if (byTs.size > 0) {
        return { status: 'OK', candles: Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp) };
      }
      // If the week file covered this Sunday-Friday period (e.g. had lines right after Jan 1 or holiday)
      const firstDateStr = lines[1]?.slice(0, 10);
      const lastDateStr = lines[lines.length - 1]?.slice(0, 10) || lines[lines.length - 2]?.slice(0, 10);
      if (firstDateStr && lastDateStr) {
        const parseUs = (s: string) => {
          const p = s.split('/');
          return p.length === 3 ? Date.UTC(Number(p[2]), Number(p[0]) - 1, Number(p[1])) : NaN;
        };
        const firstMs = parseUs(firstDateStr);
        const lastMs = parseUs(lastDateStr);
        if (Number.isFinite(firstMs) && Number.isFinite(lastMs) && parsed.dayStartMs >= firstMs && parsed.dayStartMs <= lastMs) {
          return { status: 'OK', candles: [] };
        }
      }
    } catch {
      // Try next candidate
    }
  }

  return { status: 'NOT_FOUND', candles: [] };
}

export async function fetchBitgetXautM1ForDay(dateStr: string): Promise<ProviderCandle[]> {
  const parsed = parseUtcDateStr(dateStr);
  if (!parsed) return [];
  const dayStart = parsed.dayStartMs;
  const dayEnd = Math.min(dayStart + 86400000, Date.now() + 60000);
  if (dayStart >= Date.now()) return [];

  const byTs = new Map<number, ProviderCandle>();
  let cursorEnd = dayEnd;
  let safety = 0;

  while (cursorEnd > dayStart && safety < 20) {
    safety++;
    const isRecent = Date.now() - cursorEnd < 3 * 86400000;
    const endpoint = isRecent ? 'candles' : 'history-candles';
    const url = `https://api.bitget.com/api/v2/spot/market/${endpoint}?symbol=XAUTUSDT&granularity=1min&endTime=${cursorEnd}&limit=200`;

    try {
      const res = await getRequestBufferIPv4(url, { Accept: 'application/json' }, 8000);
      if (res.status !== 200) break;
      const json = JSON.parse(res.body.toString('utf8')) as { code?: string; data?: string[][] };
      const rows = json?.data;
      if (!Array.isArray(rows) || rows.length === 0) break;

      let earliestInBatch = cursorEnd;
      for (const r of rows) {
        const ts = Math.floor(Number(r[0]) / 60000) * 60000;
        if (ts < earliestInBatch) earliestInBatch = ts;
        if (ts < dayStart || ts >= dayStart + 86400000) continue;

        const o = Number(r[1]);
        const h = Number(r[2]);
        const l = Number(r[3]);
        const c = Number(r[4]);
        const v = Number(r[5]);
        if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c) || o <= 0 || l <= 0) {
          continue;
        }
        byTs.set(ts, {
          timestamp: ts,
          open: o,
          high: Math.max(o, h, l, c),
          low: Math.min(o, h, l, c),
          close: c,
          volume: Number.isFinite(v) ? v : null,
        });
      }

      if (earliestInBatch >= cursorEnd) break;
      cursorEnd = earliestInBatch;
    } catch {
      break;
    }
  }

  const effectiveMinTs = parsed.dow === 0 ? dayStart + 22 * 3600000 : dayStart;

  return Array.from(byTs.values())
    .filter((c) => c.timestamp >= effectiveMinTs)
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchYahooForDay(
  yahooSymbols: string[],
  dateStr: string,
  decimals: number
): Promise<{ candles: ProviderCandle[]; resolution: HistoricalResolution; source: HistoricalDataSource } | null> {
  const parsed = parseUtcDateStr(dateStr);
  if (!parsed) return null;
  const dayStart = parsed.dayStartMs;
  const dayEnd = dayStart + 86400000;
  const ageDays = Math.max(0, (Date.now() - dayStart) / 86400000);

  const attempts: Array<{ interval: string; res: HistoricalResolution; src: HistoricalDataSource }> =
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
  const round = (v: number) => Number(v.toFixed(decimals));

  for (const sym of yahooSymbols) {
    for (const att of attempts) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${p1}&period2=${p2}&interval=${att.interval}`;
      try {
        const res = await getRequestBufferIPv4(
          url,
          {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/json',
          },
          8000
        );
        if (res.status !== 200) continue;
        const json = JSON.parse(res.body.toString('utf8')) as {
          chart?: {
            result?: Array<{
              timestamp?: number[];
              indicators?: { quote?: Array<{ open?: number[]; high?: number[]; low?: number[]; close?: number[]; volume?: number[] }> };
            }>;
          };
        };
        const result = json?.chart?.result?.[0];
        const timestamps = result?.timestamp || [];
        const quote = result?.indicators?.quote?.[0];
        if (!quote || timestamps.length === 0) continue;

        const candles: ProviderCandle[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          const ts = Math.floor((timestamps[i] * 1000) / 60000) * 60000;
          if (ts < dayStart || ts >= dayEnd) continue;
          const o = quote.open?.[i];
          const h = quote.high?.[i];
          const l = quote.low?.[i];
          const c = quote.close?.[i];
          const v = quote.volume?.[i];
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
          candles.push({
            timestamp: ts,
            open: round(o),
            high: round(Math.max(o, h, l, c)),
            low: round(Math.min(o, h, l, c)),
            close: round(c),
            volume: typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null,
          });
        }

        if (candles.length > 0) {
          return { candles, resolution: att.res, source: att.src };
        }
      } catch {
        // try next
      }
    }
  }
  return null;
}

export async function fetchBinanceSpotM1ForDay(symbol: string, dateStr: string): Promise<ProviderCandle[]> {
  const parsed = parseUtcDateStr(dateStr);
  if (!parsed) return [];
  const dayStart = parsed.dayStartMs;
  const dayEnd = Math.min(dayStart + 86400000 - 1, Date.now());
  if (dayStart >= Date.now()) return [];

  const byTs = new Map<number, ProviderCandle>();
  let cursor = dayStart;
  let guard = 0;

  while (cursor <= dayEnd && guard < 4) {
    guard++;
    const url = `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(
      symbol
    )}&interval=1m&startTime=${cursor}&endTime=${dayEnd}&limit=1000`;
    try {
      const res = await getRequestBufferIPv4(url, { Accept: 'application/json' }, 8000);
      if (res.status !== 200) break;
      const rows = JSON.parse(res.body.toString('utf8')) as unknown[];
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
        byTs.set(ts, {
          timestamp: ts,
          open: o,
          high: Math.max(o, h, l, c),
          low: Math.min(o, h, l, c),
          close: c,
          volume: Number.isFinite(v) ? v : null,
        });
      }

      if (rows.length < 1000 || lastTs < cursor) break;
      cursor = lastTs + 60000;
    } catch {
      break;
    }
  }

  return Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export async function fetchRealUtcDayFromProviders(instrumentId: string, dateStr: string): Promise<DayFetchResult> {
  const cleanId = instrumentId.trim().toUpperCase();
  const parsed = parseUtcDateStr(dateStr);
  if (!parsed) {
    throw new Error(`Invalid UTC date "${dateStr}". Expected YYYY-MM-DD.`);
  }
  if (parsed.dayStartMs > Date.now() + 3600000) {
    return {
      instrumentId: cleanId,
      date: dateStr,
      source: cleanId.startsWith('BINANCE:') ? 'BINANCE_SPOT_1M' : 'DUKASCOPY_BI5',
      resolution: '1m',
      isCanonicalM1: true,
      candles: [],
      note: 'Requested date is in the future.',
    };
  }

  const parts = cleanId.split(':');
  const provider = parts.length === 2 ? parts[0] : 'DUKASCOPY';
  const symbol = parts.length === 2 ? parts[1] : cleanId;

  // 1. Binance Crypto Spot
  if (provider === 'BINANCE') {
    const candles = await fetchBinanceSpotM1ForDay(symbol, dateStr);
    return {
      instrumentId: `${provider}:${symbol}`,
      date: dateStr,
      source: 'BINANCE_SPOT_1M',
      resolution: '1m',
      isCanonicalM1: true,
      candles,
    };
  }

  // 2. Dukascopy Institutional Feed (Forex, Metals, Indices)
  const meta = DUKASCOPY_META[symbol];
  if (!meta) {
    throw new Error(`Unsupported instrument: ${cleanId}`);
  }

  // Saturday -> weekend closure (returns clean empty array without network spam)
  if (parsed.dow === 6) {
    return {
      instrumentId: `DUKASCOPY:${symbol}`,
      date: dateStr,
      source: 'DUKASCOPY_BI5',
      resolution: '1m',
      isCanonicalM1: true,
      candles: [],
      isWeekendOrHoliday: true,
      note: 'Market closed on Saturday.',
    };
  }

  const dukaRes = await fetchDukascopyBi5ForDay(symbol, meta, dateStr);
  if (dukaRes.status === 'OK') {
    // Wait: on Sunday late open, Dukascopy might have 60-120 bars; on holidays/weekends 0 bars
    if (dukaRes.candles.length > 0 || parsed.dow === 0) {
      return {
        instrumentId: `DUKASCOPY:${symbol}`,
        date: dateStr,
        source: 'DUKASCOPY_BI5',
        resolution: '1m',
        isCanonicalM1: true,
        candles: dukaRes.candles,
        isWeekendOrHoliday: dukaRes.candles.length === 0,
      };
    }
    // Weekday with 0 active candles on Dukascopy (holiday closure)
    return {
      instrumentId: `DUKASCOPY:${symbol}`,
      date: dateStr,
      source: 'DUKASCOPY_BI5',
      resolution: '1m',
      isCanonicalM1: true,
      candles: [],
      isWeekendOrHoliday: true,
      note: 'Market closed (holiday or no active session).',
    };
  }

  // Fallback A (Forex): FXCM Public M1 Archive (genuine institutional Bid M1)
  if (meta.fxcmSymbol) {
    const fxcmRes = await fetchFxcmM1ForDay(meta.fxcmSymbol, dateStr);
    if (fxcmRes.status === 'OK') {
      return {
        instrumentId: `DUKASCOPY:${symbol}`,
        date: dateStr,
        source: 'FXCM_M1',
        resolution: '1m',
        isCanonicalM1: true,
        candles: fxcmRes.candles,
        isWeekendOrHoliday: fxcmRes.candles.length === 0,
        note:
          dukaRes.status === 'RATE_LIMITED'
            ? 'Loaded via FXCM Institutional M1 archive while Dukascopy rate limit recovers.'
            : 'Loaded via FXCM Institutional M1 archive.',
      };
    }
  }

  // Fallback B (XAUUSD Spot Gold): Bitget XAUTUSDT 1m (physical gold-backed 1m spot market)
  if (meta.bitgetGoldSymbol) {
    const bitgetCandles = await fetchBitgetXautM1ForDay(dateStr);
    if (bitgetCandles.length > 0) {
      return {
        instrumentId: `DUKASCOPY:${symbol}`,
        date: dateStr,
        source: 'BITGET_XAUTUSDT_1M',
        resolution: '1m',
        isCanonicalM1: false,
        candles: bitgetCandles,
        note: `Spot Gold 1m via Bitget XAUT/USDT (${dukaRes.error || 'Dukascopy day unavailable'}).`,
      };
    }
  }

  // Fallback C: Yahoo Finance real historical candles (honest resolution, zero fake subdivision)
  if (meta.yahooSymbols.length > 0) {
    const yahooRes = await fetchYahooForDay(meta.yahooSymbols, dateStr, meta.decimals);
    if (yahooRes && yahooRes.candles.length > 0) {
      return {
        instrumentId: `DUKASCOPY:${symbol}`,
        date: dateStr,
        source: yahooRes.source,
        resolution: yahooRes.resolution,
        isCanonicalM1: false,
        candles: yahooRes.candles,
        note: `Loaded real ${yahooRes.resolution} candles from Yahoo Finance (${dukaRes.error || 'Dukascopy unavailable for this day'}).`,
      };
    }
  }

  throw new Error(
    `Unable to retrieve real historical candles for ${symbol} on ${dateStr} (${dukaRes.error || 'no data returned by providers'}).`
  );
}

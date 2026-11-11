import { fetchRealUtcDayFromProviders, parseUtcDateStr } from '../../shared/historicalProvider';

interface NetlifyEvent {
  httpMethod: string;
  queryStringParameters?: Record<string, string | undefined>;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function handler(event: NetlifyEvent) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const instrument = (event.queryStringParameters?.instrument || '').trim().toUpperCase();
    const date = (event.queryStringParameters?.date || '').trim();

    if (!instrument) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, error: 'Query parameter "instrument" is required.' }),
      };
    }

    const parsedDate = parseUtcDateStr(date);
    if (!parsedDate) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, error: 'Query parameter "date" (YYYY-MM-DD UTC) is required.' }),
      };
    }

    const result = await fetchRealUtcDayFromProviders(instrument, date);
    const dayEndMs = parsedDate.dayStartMs + 86400000;
    const isImmutableHistorical = result.isCanonicalM1 && dayEndMs < Date.now() - 18 * 3600000;

    const cacheHeaders: Record<string, string> = isImmutableHistorical
      ? {
          'Cache-Control': 'public, max-age=86400',
          'Netlify-CDN-Cache-Control': 'public, max-age=31536000, durable',
        }
      : {
          'Cache-Control': 'public, max-age=180',
          'Netlify-CDN-Cache-Control': 'public, max-age=180',
        };

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        ...cacheHeaders,
      },
      body: JSON.stringify({
        success: true,
        ...result,
      }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 502,
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({ success: false, error: message }),
    };
  }
}

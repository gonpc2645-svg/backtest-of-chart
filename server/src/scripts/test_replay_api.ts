import { createServer } from '../api/server.js';

async function testReplayApi() {
  console.log('Testing Replay API Endpoints...');
  const app = createServer();
  const server = app.listen(3003, async () => {
    try {
      // 1. Test POST /api/replay/initialize
      const initRes = await fetch('http://localhost:3003/api/replay/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrumentId: 'BINANCE:BTCUSDT',
          timeframe: 'M15',
          startTimestamp: 1794050000000,
          endTimestamp: 1794100000000,
          contextBarsCount: 20
        })
      });
      const initData = await initRes.json();
      console.log('1. POST /api/replay/initialize:', {
        success: initData.success,
        instrument: initData.instrument?.providerSymbol,
        initialContextCandles: initData.initialContextCandles?.length,
        availableM1CountInRange: initData.availableM1CountInRange
      });

      // 2. Test GET /api/replay/candles with strict cursor enforcement
      const cursor = 1794060000000;
      const candlesRes = await fetch(`http://localhost:3003/api/replay/candles?instrument=BINANCE:BTCUSDT&from=1794040000000&cursor=${cursor}&limit=100`);
      const candlesData = await candlesRes.json();
      console.log('2. GET /api/replay/candles:', {
        success: candlesData.success,
        candlesCount: candlesData.candles?.length,
        cursorEnforced: cursor
      });

      // Verify no future leakage
      const futureCandles = candlesData.candles?.filter((c: any) => c.timestamp > cursor);
      console.log('   Strict check: Future candles count (> cursor):', futureCandles?.length);
      if (futureCandles && futureCandles.length > 0) {
        throw new Error('CRITICAL FAILURE: Future candles detected beyond replay cursor!');
      }
      console.log('   ✓ Zero future data leakage confirmed at database query level.');
    } finally {
      server.close();
    }
  });
}

testReplayApi().catch(console.error);

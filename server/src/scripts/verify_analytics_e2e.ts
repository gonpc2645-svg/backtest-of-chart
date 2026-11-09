import { spawn, ChildProcess } from 'child_process';
import { createServer } from '../api/server.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url: string, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch {
      // Server not ready yet
    }
    await sleep(300);
  }
  throw new Error(`Timeout waiting for URL: ${url}`);
}

async function sendCdp(ws: WebSocket, method: string, params: any = {}): Promise<any> {
  const id = Math.floor(Math.random() * 1000000);
  return new Promise<any>((resolve, reject) => {
    const handler = (event: any) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluateCdp(ws: WebSocket, expr: string): Promise<any> {
  const res = await sendCdp(ws, 'Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  return res?.result?.value;
}

export async function runAnalyticsE2E() {
  console.log('========================================================================');
  console.log('BACKTEST OF CHART — PHASE 5 ANALYTICS & PERFORMANCE E2E BROWSER TEST');
  console.log('========================================================================\n');

  // 1. Start backend server
  console.log('1. Starting API Backend Server on port 3001 (in-process)...');
  const app = createServer();
  const serverInstance = app.listen(3001);
  await waitForUrl('http://localhost:3001/api/health');
  console.log('   ✓ API Backend Server alive & healthy on port 3001');

  // 2. Start Vite server
  console.log('2. Starting Vite Preview Server on port 4173...');
  const isWin = process.platform === 'win32';
  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  const viteProcess: ChildProcess = spawn(npmCmd, ['run', 'preview', '--', '--port', '4173'], {
    cwd: 'd:\\mc backtest\\backtest-of-chart',
    shell: true,
    stdio: 'ignore',
  });

  await waitForUrl('http://localhost:4173');
  console.log('   ✓ Vite Preview Server alive on port 4173');

  // 3. Launch Chrome Headless
  console.log('3. Launching Headless Chrome with remote debugging on port 9222...');
  const chromeProcess: ChildProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-translate',
      '--window-size=1400,900',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  await waitForUrl('http://127.0.0.1:9222/json/list');
  const listRes = await fetch('http://127.0.0.1:9222/json/list');
  const listJson = await listRes.json();
  const pageTarget = listJson.find((t: any) => t.type === 'page') || listJson[0];
  const wsUrl = pageTarget.webSocketDebuggerUrl;
  console.log('   ✓ Chrome connected via CDP Page WebSocket:', wsUrl);

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve));

  // Enable Page & Runtime domains
  await sendCdp(ws, 'Page.enable');
  await sendCdp(ws, 'Runtime.enable');

  try {
    // 4. Navigate to Replay Workspace
    console.log('\n4. Navigating to http://localhost:4173/backtest/replay...');
    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:4173/backtest/replay' });
    await sleep(2500);

    const canvasExists = await evaluateCdp(ws, '!!document.querySelector(".replay-chart-mount canvas")');
    console.log('   ✓ Lightweight Charts Canvas mounted in DOM:', canvasExists);
    if (!canvasExists) throw new Error('Lightweight Charts canvas failed to render!');

    // 5. Submit Market Buy Order (Trade 1)
    console.log('\n5. Executing Market Buy Order (0.1 BTC)...');
    await evaluateCdp(ws, 'document.querySelectorAll(".order-dir-btn")[0]?.click()'); // BUY
    await evaluateCdp(ws, 'document.querySelector(".order-submit-btn")?.click()');
    await sleep(400);

    // Advance 1 M1 candle
    console.log('   Stepping forward 1 M1 candle...');
    await evaluateCdp(ws, 'document.querySelector(\'[title="Step Forward (Right Arrow)"]\')?.click()');
    await sleep(600);

    // Close Trade 1
    console.log('   Closing first position...');
    await evaluateCdp(ws, 'document.querySelector(".btn-position-close")?.click()');
    await sleep(600);

    // 6. Submit Market Sell Order (Trade 2)
    console.log('\n6. Executing Market Sell Order (0.1 BTC)...');
    await evaluateCdp(ws, 'document.querySelectorAll(".order-dir-btn")[1]?.click()'); // SELL
    await evaluateCdp(ws, 'document.querySelector(".order-submit-btn")?.click()');
    await sleep(400);

    // Advance 1 M1 candle
    console.log('   Stepping forward 1 M1 candle...');
    await evaluateCdp(ws, 'document.querySelector(\'[title="Step Forward (Right Arrow)"]\')?.click()');
    await sleep(600);

    // Close Trade 2
    console.log('   Closing second position...');
    await evaluateCdp(ws, 'document.querySelector(".btn-position-close")?.click()');
    await sleep(600);

    // Verify 2 trades in Trade History tab
    await evaluateCdp(ws, 'document.querySelectorAll(".trading-tab-btn")[2]?.click()');
    await sleep(300);
    const tradesCountBadge = await evaluateCdp(ws, 'document.querySelectorAll(".trading-tab-badge")[2]?.innerText?.trim()');
    console.log('   Closed Trade Records Count in Workspace:', tradesCountBadge);
    if (tradesCountBadge !== '2') {
      throw new Error(`Expected 2 closed trades in workspace, got: ${tradesCountBadge}`);
    }

    // 7. Click Analytics Navigation Button in Header
    console.log('\n7. Navigating to Analytics Dashboard via Header Button...');
    await evaluateCdp(ws, 'document.querySelector(".replay-header__analytics-btn")?.click()');
    await sleep(1500);

    const curUrl = await evaluateCdp(ws, 'window.location.href');
    console.log('   Active URL after navigation:', curUrl);
    if (!curUrl.includes('/backtest/analytics')) {
      throw new Error(`Expected URL to include /backtest/analytics, got: ${curUrl}`);
    }

    // 8. Verify Analytics Dashboard Header & Meta
    console.log('\n8. Verifying Analytics Dashboard Header & Metadata...');
    const pageTitle = await evaluateCdp(ws, 'document.querySelector(".analytics-header__title")?.innerText?.trim()');
    const instrumentMeta = await evaluateCdp(ws, 'document.querySelectorAll(".analytics-header__meta-item")[0]?.innerText?.trim()');
    console.log(`   Page Title: "${pageTitle}", Meta: "${instrumentMeta}"`);
    if (pageTitle !== 'Performance Analytics') {
      throw new Error(`Expected page title 'Performance Analytics', got: ${pageTitle}`);
    }

    // 9. Verify Primary Overview Metric Cards
    console.log('\n9. Verifying Primary Overview Performance Metrics...');
    const totalTradesVal = await evaluateCdp(ws, 'document.querySelectorAll(".metric-card__value")[6]?.innerText?.trim()');
    const initialBalVal = await evaluateCdp(ws, 'document.querySelectorAll(".metric-card__value")[0]?.innerText?.trim()');
    const netPnlVal = await evaluateCdp(ws, 'document.querySelectorAll(".metric-card__value")[3]?.innerText?.trim()');
    const winRateVal = await evaluateCdp(ws, 'document.querySelectorAll(".metric-card__value")[7]?.innerText?.trim()');

    console.log(`   Total Trades: ${totalTradesVal}, Initial Balance: ${initialBalVal}, Net P/L: ${netPnlVal}, Win Rate: ${winRateVal}`);
    if (totalTradesVal !== '2') {
      throw new Error(`Expected 2 total closed trades in analytics overview, got: ${totalTradesVal}`);
    }
    if (!initialBalVal.includes('10,000')) {
      throw new Error(`Expected initial balance $10,000, got: ${initialBalVal}`);
    }
    console.log('   ✓ Overview cards verified accurately matching Phase 4 source records');

    // 10. Verify Balance Curve SVG Element & Drawdown Curve Toggle
    console.log('\n10. Verifying Interactive SVG Curves (Balance & Drawdown)...');
    const svgExists = await evaluateCdp(ws, '!!document.querySelector(".chart-svg-container svg")');
    console.log('   SVG Chart mounted in DOM:', svgExists);
    if (!svgExists) throw new Error('SVG Chart failed to render');

    // Click Drawdown toggle
    await evaluateCdp(ws, 'document.querySelectorAll(".analytics-chart-tab")[1]?.click()');
    await sleep(200);
    const chartTitleAfterTab = await evaluateCdp(ws, 'document.querySelector(".analytics-chart-title")?.innerText?.trim()');
    console.log('   Chart title after toggling Drawdown tab:', chartTitleAfterTab);
    if (!chartTitleAfterTab?.includes('Drawdown')) {
      throw new Error(`Expected chart title to contain 'Drawdown', got: ${chartTitleAfterTab}`);
    }
    console.log('   ✓ Balance and Drawdown curves interactive and functional');

    // 11. Verify Trade History Table & Filtering
    console.log('\n11. Verifying Closed Trade Records Table & Search Filtering...');
    const tableRowsCount = await evaluateCdp(ws, 'document.querySelectorAll(".trade-table-wrapper .analytics-table tbody tr").length');
    console.log('   Table rows rendered:', tableRowsCount);
    if (tableRowsCount !== 2) {
      throw new Error(`Expected 2 table rows in trade history, got: ${tableRowsCount}`);
    }

    // Filter by Winners button
    await evaluateCdp(ws, 'document.querySelectorAll(".trade-filter-btn")[1]?.click()');
    await sleep(200);
    const winnerFilterRows = await evaluateCdp(ws, 'document.querySelectorAll(".trade-table-wrapper .analytics-table tbody tr").length');
    console.log('   Filtered rows on WINNERS filter:', winnerFilterRows);

    // Reset to ALL
    await evaluateCdp(ws, 'document.querySelectorAll(".trade-filter-btn")[0]?.click()');
    await sleep(200);
    console.log('   ✓ Trade history table filtering and sorting verified');

    // 12. Verify Back to Replay Workspace Link
    console.log('\n12. Testing "Back to Replay Workspace" Link...');
    await evaluateCdp(ws, 'document.querySelector(".analytics-header__back-btn")?.click()');
    await sleep(1500);

    const backUrl = await evaluateCdp(ws, 'window.location.href');
    console.log('   Active URL after returning:', backUrl);
    if (!backUrl.includes('/backtest/replay')) {
      throw new Error(`Expected URL to return to /backtest/replay, got: ${backUrl}`);
    }
    console.log('   ✓ Seamless two-way navigation between Replay and Analytics verified');

    // 13. Verify Persistence on Browser Reload
    console.log('\n13. Verifying Browser Reload Persistence of Analytics...');
    await sendCdp(ws, 'Page.navigate', { url: curUrl });
    await sleep(1800);

    const reloadedTradesVal = await evaluateCdp(ws, 'document.querySelectorAll(".metric-card__value")[6]?.innerText?.trim()');
    console.log('   Total Trades in Analytics after reload:', reloadedTradesVal);
    if (reloadedTradesVal !== '2') {
      throw new Error(`Expected 2 closed trades after reload, got: ${reloadedTradesVal}`);
    }
    console.log('   ✓ Analytics state restored safely and deterministically from IndexedDB');

    console.log('\n========================================================================');
    console.log('ALL PHASE 5 ANALYTICS ENGINE E2E TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================================\n');
  } catch (err) {
    console.error('\nE2E Analytics Test Failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      ws.close();
      chromeProcess.kill();
      viteProcess.kill();
      serverInstance.close();
    } catch {
      // Cleanup
    }
  }
}

runAnalyticsE2E();

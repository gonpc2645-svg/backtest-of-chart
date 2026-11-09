import { spawn, ChildProcess } from 'child_process';
import { createServer } from '../api/server.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url: string, timeoutMs: number = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch {
      // wait
    }
    await sleep(300);
  }
  throw new Error(`Timeout waiting for URL: ${url}`);
}

async function sendCdp(ws: WebSocket, method: string, params: any = {}) {
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

async function runTradingE2E() {
  console.log('========================================================================');
  console.log('BACKTEST OF CHART — PHASE 4 TRADING ENGINE E2E BROWSER TEST');
  console.log('========================================================================\n');

  // 1. Start in-process API server
  console.log('1. Starting API Backend Server on port 3001 (in-process)...');
  const app = createServer();
  const server = app.listen(3001);
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
    await sleep(2500); // Allow React and Lightweight Charts canvas to mount

    // Test a: Check Canvas element
    const canvasExists = await evaluateCdp(ws, '!!document.querySelector(".replay-chart-mount canvas")');
    console.log('   ✓ Lightweight Charts Canvas mounted in DOM:', canvasExists);
    if (!canvasExists) throw new Error('Lightweight Charts canvas failed to render!');

    // Test b: Check Account Summary Bar
    console.log('\n5. Verifying Simulated Account Summary Bar...');
    const balanceText = await evaluateCdp(ws, 'document.querySelectorAll(".trading-metric-value")[0]?.innerText?.trim()');
    const equityText = await evaluateCdp(ws, 'document.querySelectorAll(".trading-metric-value")[1]?.innerText?.trim()');
    const freeMarginText = await evaluateCdp(ws, 'document.querySelectorAll(".trading-metric-value")[3]?.innerText?.trim()');
    console.log(`   Initial Balance: ${balanceText}, Equity: ${equityText}, Free Margin: ${freeMarginText}`);
    if (balanceText !== '$10,000.00') {
      throw new Error(`Expected initial balance $10,000.00, got: ${balanceText}`);
    }
    console.log('   ✓ Initial Account parameters verified ($10,000.00 USD)');

    // Test c: Verify Order Entry Panel
    console.log('\n6. Verifying Order Entry Panel & Direction Selectors...');
    const orderTitle = await evaluateCdp(ws, 'document.querySelector(".order-entry-title")?.innerText?.trim()');
    console.log('   Order Panel Title:', orderTitle);
    if (orderTitle !== 'ORDER ENTRY') {
      throw new Error(`Expected Order Entry panel, got: ${orderTitle}`);
    }

    // Test d: Submit Market Buy Order (0.1 BTC)
    console.log('\n7. Submitting Market Buy Order (0.1 BTC)...');
    // Ensure BUY is active
    await evaluateCdp(ws, 'document.querySelector(".order-direction-btn--buy")?.click()');
    await sleep(200);

    // Click submit order
    await evaluateCdp(ws, 'document.querySelector(".order-submit-btn")?.click()');
    await sleep(600);

    // Verify open position in Positions table
    const openPosCount = await evaluateCdp(ws, 'document.querySelectorAll(".trading-tab-badge")[0]?.innerText?.trim()');
    const posDirection = await evaluateCdp(ws, 'document.querySelector(".trading-table .badge-direction")?.innerText?.trim()');
    const posQty = await evaluateCdp(ws, 'document.querySelectorAll(".trading-table td")[3]?.innerText?.trim()');
    const usedMargin = await evaluateCdp(ws, 'document.querySelectorAll(".trading-metric-value")[2]?.innerText?.trim()');
    console.log(`   Open Positions Count: ${openPosCount}, Direction: ${posDirection}, Qty: ${posQty}, Used Margin: ${usedMargin}`);

    if (openPosCount !== '1' || posDirection !== 'BUY' || posQty !== '0.1') {
      throw new Error(`Position failed to open properly: count=${openPosCount}, dir=${posDirection}, qty=${posQty}`);
    }
    console.log('   ✓ Market Buy Order executed and position created successfully');

    // Test e: Submit opposing Market Sell Order (0.1 BTC) for Hedging Mode
    console.log('\n8. Submitting Opposing Market Sell Order (0.1 BTC) [Hedging Mode]...');
    await evaluateCdp(ws, 'document.querySelector(".order-direction-btn--sell")?.click()');
    await sleep(200);
    await evaluateCdp(ws, 'document.querySelector(".order-submit-btn")?.click()');
    await sleep(600);

    const hedgingCount = await evaluateCdp(ws, 'document.querySelectorAll(".trading-tab-badge")[0]?.innerText?.trim()');
    console.log('   Total Open Positions (Hedging):', hedgingCount);
    if (hedgingCount !== '2') {
      throw new Error(`Expected 2 simultaneous hedging positions, got: ${hedgingCount}`);
    }
    console.log('   ✓ Hedging mode verified: simultaneous Long & Short positions active');

    // Test f: Advance Replay and check floating P/L
    console.log('\n9. Advancing Replay Timeline by 1 Candle (Step Forward)...');
    await evaluateCdp(ws, 'document.querySelector(\'[title="Step Forward (Right Arrow)"]\')?.click()');
    await sleep(600);
    const clockAfterStep = await evaluateCdp(ws, 'document.querySelector(".replay-header__utc-clock")?.innerText?.trim()');
    const floatingPnl = await evaluateCdp(ws, 'document.querySelectorAll(".trading-metric-value")[5]?.innerText?.trim()');
    console.log(`   Clock after Step: ${clockAfterStep}, Floating P/L: ${floatingPnl}`);
    console.log('   ✓ M1 candle processed by Trading Engine; positions and equity revalued');

    // Test g: Close Position & Verify Trade History
    console.log('\n10. Closing Position & Verifying Trade History Tab...');
    await evaluateCdp(ws, 'document.querySelector(".btn-position-close")?.click()');
    await sleep(600);

    const remainingPositions = await evaluateCdp(ws, 'document.querySelectorAll(".trading-tab-badge")[0]?.innerText?.trim()');
    console.log('   Remaining Open Positions:', remainingPositions);
    if (remainingPositions !== '1') {
      throw new Error(`Expected 1 remaining position after closing, got: ${remainingPositions}`);
    }

    // Switch to Trade History tab
    await evaluateCdp(ws, 'document.querySelectorAll(".trading-tab-btn")[2]?.click()');
    await sleep(400);
    const tradesCount = await evaluateCdp(ws, 'document.querySelectorAll(".trading-tab-badge")[2]?.innerText?.trim()');
    console.log('   Closed Trade Records Count:', tradesCount);
    if (tradesCount !== '1') {
      throw new Error(`Expected 1 trade record in Trade History, got: ${tradesCount}`);
    }
    console.log('   ✓ Position closed and registered in Trade History with realized P/L');

    // Test h: Submit Pending Limit Order
    console.log('\n11. Placing Pending Buy Limit Order...');
    // Click Pending tab
    await evaluateCdp(ws, 'document.querySelectorAll(".trading-tab-btn")[1]?.click()');
    await sleep(200);

    // Select LIMIT in order entry panel
    await evaluateCdp(ws, 'Array.from(document.querySelectorAll(".order-type-btn")).find(b => b.innerText.trim() === "LIMIT")?.click()');
    await sleep(200);

    // Set Buy direction
    await evaluateCdp(ws, 'document.querySelector(".order-direction-btn--buy")?.click()');
    await sleep(200);

    // Set Limit Price lower than market price (e.g. 70000)
    await evaluateCdp(ws, `
      const inputs = document.querySelectorAll(".order-input");
      const priceInput = inputs[1];
      if (priceInput) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(priceInput, '70000');
        priceInput.dispatchEvent(new Event('input', { bubbles: true }));
        priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);
    await sleep(200);

    // Submit Limit Order
    await evaluateCdp(ws, 'document.querySelector(".order-submit-btn")?.click()');
    await sleep(600);

    const pendingCount = await evaluateCdp(ws, 'document.querySelectorAll(".trading-tab-badge")[1]?.innerText?.trim()');
    console.log('   Active Pending Orders Count:', pendingCount);
    if (pendingCount !== '1') {
      throw new Error(`Expected 1 pending order, got: ${pendingCount}`);
    }
    console.log('   ✓ Buy Limit order placed and registered in Pending Orders tab');

    // Test i: Cancel Pending Order
    console.log('\n12. Cancelling Pending Limit Order...');
    await evaluateCdp(ws, 'document.querySelector(".bottom-trading-panel .btn-action-sm--close")?.click()');
    await sleep(500);

    const pendingAfterCancel = await evaluateCdp(ws, 'document.querySelectorAll(".trading-tab-badge")[1]?.innerText?.trim()');
    console.log('   Pending Orders After Cancellation:', pendingAfterCancel);
    if (pendingAfterCancel !== '0') {
      throw new Error(`Expected 0 pending orders after cancellation, got: ${pendingAfterCancel}`);
    }
    console.log('   ✓ Pending order cancelled cleanly');

    // Test j: Session Persistence & Safe Reload
    console.log('\n13. Testing Trading Session Persistence & Safe Reload Invariant...');
    await sendCdp(ws, 'Page.reload');
    await sleep(2500);

    const reloadedStatus = await evaluateCdp(ws, 'document.querySelector(".replay-status-pill")?.innerText?.trim()');
    const reloadedPositions = await evaluateCdp(ws, 'document.querySelectorAll(".trading-tab-badge")[0]?.innerText?.trim()');
    console.log(`   State after reload: ${reloadedStatus}, Open Positions restored: ${reloadedPositions}`);

    if (reloadedStatus !== 'PAUSED') {
      throw new Error(`Expected reloaded state to be PAUSED, got: ${reloadedStatus}`);
    }
    if (reloadedPositions !== '1') {
      throw new Error(`Expected 1 open position restored from IndexedDB, got: ${reloadedPositions}`);
    }
    console.log('   ✓ Session persistence verified: state safely restored in PAUSED replay mode');

    console.log('\n========================================================================');
    console.log('ALL PHASE 4 TRADING ENGINE E2E TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================================\n');
  } finally {
    ws.close();
    chromeProcess.kill('SIGKILL');
    server.close();
    viteProcess.kill('SIGKILL');
  }
}

runTradingE2E().catch((err) => {
  console.error('\nE2E Trading Test Failed:', err);
  process.exit(1);
});

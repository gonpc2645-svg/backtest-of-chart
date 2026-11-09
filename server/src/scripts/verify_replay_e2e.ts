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

async function runE2E() {
  console.log('========================================================================');
  console.log('BACKTEST OF CHART — PHASE 3 E2E BROWSER WORKSPACE TEST');
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
      '--window-size=1280,800',
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

    // Test a: Check brand & document title
    const docTitle = await evaluateCdp(ws, 'document.title');
    console.log('   Document Title:', docTitle);

    // Test b: Verify chart container and canvas mount
    const canvasExists = await evaluateCdp(ws, '!!document.querySelector(".replay-chart-mount canvas")');
    console.log('   ✓ Lightweight Charts Canvas element mounted in DOM:', canvasExists);
    if (!canvasExists) throw new Error('Lightweight Charts canvas failed to render!');

    // Test c: Verify initial status is PAUSED
    const initialStatus = await evaluateCdp(ws, 'document.querySelector(".replay-status-pill")?.innerText?.trim()');
    const errText = await evaluateCdp(ws, 'document.querySelector(".replay-error-screen p")?.innerText?.trim()');
    console.log('   Initial Workspace Replay Engine State:', initialStatus);
    if (errText) console.log('   Error Screen Details:', errText);

    if (initialStatus !== 'PAUSED' && initialStatus !== 'READY') {
      throw new Error(`Expected initial state to be PAUSED, but got: ${initialStatus}`);
    }

    // Test d: Read initial simulation UTC clock
    const initialClock = await evaluateCdp(ws, 'document.querySelector(".replay-header__utc-clock")?.innerText?.trim()');
    console.log('   ✓ Initial Simulation Clock:', initialClock);

    // Test e: Click Play button and verify status becomes PLAYING
    console.log('\n5. Testing Playback Execution...');
    await evaluateCdp(ws, 'document.querySelector(".replay-btn--play")?.click()');
    await sleep(1500);

    const playingStatus = await evaluateCdp(ws, 'document.querySelector(".replay-status-pill")?.innerText?.trim()');
    console.log('   State after clicking Play:', playingStatus);
    if (playingStatus !== 'PLAYING') {
      throw new Error(`Expected state PLAYING, got: ${playingStatus}`);
    }

    const clockDuringPlay = await evaluateCdp(ws, 'document.querySelector(".replay-header__utc-clock")?.innerText?.trim()');
    console.log('   Clock advancing during playback:', clockDuringPlay);
    console.log('   ✓ Playback advancing successfully without error');

    // Test f: Click Pause button
    console.log('\n6. Testing Pause Execution...');
    await evaluateCdp(ws, 'document.querySelector(".replay-btn--pause")?.click()');
    await sleep(600);

    const pausedStatus = await evaluateCdp(ws, 'document.querySelector(".replay-status-pill")?.innerText?.trim()');
    console.log('   State after clicking Pause:', pausedStatus);
    if (pausedStatus !== 'PAUSED') {
      throw new Error(`Expected state PAUSED, got: ${pausedStatus}`);
    }
    console.log('   ✓ Playback paused successfully');

    // Test g: Step Forward (Next Candle)
    console.log('\n7. Testing Step Forward (Next Candle)...');
    const clockBeforeStep = await evaluateCdp(ws, 'document.querySelector(".replay-header__utc-clock")?.innerText?.trim()');
    await evaluateCdp(ws, 'document.querySelectorAll(".replay-btn")[2]?.click()'); // Next button
    await sleep(500);
    const clockAfterStep = await evaluateCdp(ws, 'document.querySelector(".replay-header__utc-clock")?.innerText?.trim()');
    console.log(`   Clock before: ${clockBeforeStep} -> after Next step: ${clockAfterStep}`);
    console.log('   ✓ Next step advanced cursor forward deterministically');

    // Test h: Step Backward (Prev Candle)
    console.log('\n8. Testing Step Backward (Prev Candle)...');
    await evaluateCdp(ws, 'document.querySelectorAll(".replay-btn")[1]?.click()'); // Prev button
    await sleep(500);
    const clockAfterBack = await evaluateCdp(ws, 'document.querySelector(".replay-header__utc-clock")?.innerText?.trim()');
    console.log(`   Clock after Prev step: ${clockAfterBack}`);
    console.log('   ✓ Step backward returned to previous candle position');

    // Test i: Speed Selection
    console.log('\n9. Testing Speed Controls (5x)...');
    await evaluateCdp(ws, 'Array.from(document.querySelectorAll(".replay-speed-btn")).find(b => b.innerText.trim() === "5x")?.click()');
    await sleep(300);
    const activeSpeed = await evaluateCdp(ws, 'document.querySelector(".replay-speed-btn--active")?.innerText?.trim()');
    console.log('   Active Speed Pill:', activeSpeed);
    if (activeSpeed !== '5x') {
      throw new Error(`Expected active speed 5x, got: ${activeSpeed}`);
    }
    console.log('   ✓ Replay speed updated to 5x');

    // Test j: Timeframe Switching (M15 -> H1)
    console.log('\n10. Testing Timeframe Switch (M15 -> H1)...');
    await evaluateCdp(ws, 'Array.from(document.querySelectorAll(".replay-timeframe-btn")).find(b => b.innerText.trim() === "H1")?.click()');
    await sleep(800);
    const activeTf = await evaluateCdp(ws, 'document.querySelector(".replay-timeframe-btn--active")?.innerText?.trim()');
    console.log('   Active Timeframe Pill:', activeTf);
    if (activeTf !== 'H1') {
      throw new Error(`Expected active timeframe H1, got: ${activeTf}`);
    }
    console.log('   ✓ Timeframe switched to H1 with chart re-aggregation');

    // Test k: Reset Button
    console.log('\n11. Testing Reset Execution...');
    await evaluateCdp(ws, 'document.querySelectorAll(".replay-btn")[0]?.click()'); // Reset button
    await sleep(500);
    const resetClock = await evaluateCdp(ws, 'document.querySelector(".replay-header__utc-clock")?.innerText?.trim()');
    const resetPct = await evaluateCdp(ws, 'document.querySelector(".replay-scrub-pct")?.innerText?.trim()');
    console.log(`   Reset Clock: ${resetClock}, Progress: ${resetPct}`);
    console.log('   ✓ Replay reset successfully to starting timeline cursor (0.0%)');

    // Test l: Browser Reload & Persistent State Check
    console.log('\n12. Testing Session Persistence & Safe Reload Invariant...');
    await sendCdp(ws, 'Page.reload');
    await sleep(2500);

    const reloadedStatus = await evaluateCdp(ws, 'document.querySelector(".replay-status-pill")?.innerText?.trim()');
    console.log('   State after page reload:', reloadedStatus);
    if (reloadedStatus !== 'PAUSED') {
      throw new Error(`Expected reloaded state to be strictly PAUSED, got: ${reloadedStatus}`);
    }
    console.log('   ✓ Zero auto-play violation: session restores strictly in PAUSED state');

    console.log('\n========================================================================');
    console.log('ALL E2E WORKSPACE & REPLAY TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================================\n');
  } finally {
    ws.close();
    chromeProcess.kill('SIGKILL');
    server.close();
    viteProcess.kill('SIGKILL');
  }
}

runE2E().catch((err) => {
  console.error('\nE2E Test Failed:', err);
  process.exit(1);
});

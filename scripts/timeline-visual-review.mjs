import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { serveProductionArtifact } from './production-artifact-server.mjs';

const root = process.cwd();
const distDir = resolve(root, 'dist');
const outputDir = resolve(root, process.env.HOPSCOTCH_TIMELINE_REVIEW_DIR?.trim() || 'artifacts/timeline-visual-review');
const reportPath = join(outputDir, 'timeline-report.json');
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const routes = [
  { id: 'journey', path: '/journey', ready: '.journey-visual-workspace' },
  { id: 'failure', path: '/labs/failure', ready: '.failure-visual-workspace' },
  { id: 'tcp', path: '/labs/tcp', ready: '.tcp-visual-workspace' },
  { id: 'dns', path: '/labs/dns', ready: '.dns-visual-workspace' },
  { id: 'tls', path: '/labs/tls', ready: '.tls-visual-workspace' },
  { id: 'http', path: '/labs/http2-vs-http3', ready: '.http-visual-workspace' },
];

const viewports = [
  { id: 'wide', width: 1600, height: 950 },
  { id: 'mobile', width: 390, height: 844 },
];

function executableFromPath(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function findChrome() {
  const explicit = process.env.CHROME_PATH?.trim();
  if (explicit && existsSync(explicit)) return explicit;
  for (const command of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    const candidate = executableFromPath(command);
    if (candidate) return candidate;
  }
  for (const candidate of ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome/Chromium not found.');
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function waitForDevTools(port, timeoutMs = 10000) {
  const deadline = performance.now() + timeoutMs;
  let lastError = null;
  while (performance.now() < deadline) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await sleep(100);
    }
  }
  throw new Error(`Chrome DevTools did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function launchChrome(chromePath) {
  const attempts = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const port = await freePort();
    const userDataDir = mkdtempSync(join(tmpdir(), `hopscotch-timeline-${attempt}-`));
    const state = { stderr: '', exitCode: null };
    const chrome = spawn(chromePath, [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--mute-audio',
      '--remote-debugging-address=127.0.0.1',
      `--remote-debugging-port=${port}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', (chunk) => { state.stderr = `${state.stderr}${chunk}`.slice(-12000); });
    chrome.once('exit', (code) => { state.exitCode = code; });
    try {
      await waitForDevTools(port);
      return { chrome, port, userDataDir, attempts };
    } catch (error) {
      if (!chrome.killed) chrome.kill('SIGKILL');
      attempts.push({ attempt, error: error instanceof Error ? error.message : String(error), exitCode: state.exitCode, stderrTail: state.stderr || null });
      rmSync(userDataDir, { recursive: true, force: true });
    }
  }
  throw new Error(`Chrome failed to launch after 3 attempts: ${JSON.stringify(attempts)}`);
}

class CdpClient {
  constructor(url) {
    this.nextId = 0;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolvePromise, reject) => {
      this.socket.addEventListener('open', resolvePromise, { once: true });
      this.socket.addEventListener('error', () => reject(new Error(`Unable to open CDP WebSocket ${url}`)), { once: true });
    });
    this.socket.addEventListener('message', async (message) => {
      const raw = typeof message.data === 'string' ? message.data : Buffer.from(await message.data.arrayBuffer()).toString('utf8');
      const payload = JSON.parse(raw);
      if (payload.id === undefined) return;
      const waiter = this.pending.get(payload.id);
      if (!waiter) return;
      this.pending.delete(payload.id);
      if (payload.error) waiter.reject(new Error(`${waiter.method}: ${payload.error.message}`));
      else waiter.resolve(payload.result ?? {});
    });
  }

  async call(method, params = {}) {
    await this.ready;
    const id = ++this.nextId;
    const promise = new Promise((resolvePromise, reject) => this.pending.set(id, { resolve: resolvePromise, reject, method }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime evaluation failed';
      throw new Error(text);
    }
    return result.result?.value;
  }

  close() {
    try { this.socket.close(); } catch { /* noop */ }
  }
}

async function waitForExpression(cdp, expression, timeoutMs = 8000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await cdp.evaluate(expression)) return;
    await sleep(40);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function navigate(cdp, origin, route, viewport) {
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width <= 480,
  });
  await cdp.call('Page.navigate', { url: `${origin}${route.path}` });
  await waitForExpression(cdp, `Boolean(document.querySelector(${JSON.stringify(route.ready)}))`);
  await waitForExpression(cdp, `Boolean(document.querySelector('.visual-time-rail__speed'))`);
  await sleep(1450);
}

async function resetAndSetSpeed(cdp, speed) {
  return cdp.evaluate(`(()=>{
    const controls=document.querySelector('.visual-time-rail__controls');
    const reset=controls?.querySelectorAll('button')[1];
    const speedSelect=controls?.querySelector('.visual-time-rail__speed');
    if(!reset||!speedSelect) return false;
    reset.click();
    speedSelect.value=${JSON.stringify(String(speed))};
    speedSelect.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);
}

async function playAndMeasure(cdp, speed) {
  assert.equal(await resetAndSetSpeed(cdp, speed), true, `Unable to reset/set ${speed}×.`);
  await sleep(80);
  const start = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  assert.equal(await cdp.evaluate(`(()=>{const play=document.querySelector('.visual-time-rail__controls button');if(!play)return false;play.click();return true})()`), true);
  await sleep(1000);
  const end = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  assert.equal(await cdp.evaluate(`(()=>{const play=document.querySelector('.visual-time-rail__controls button');if(!play)return false;play.click();return true})()`), true);
  await sleep(120);
  return Math.max(0, end - start);
}

async function assertPauseAndScrub(cdp) {
  const before = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  await sleep(450);
  const after = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  assert.ok(Math.abs(after - before) <= 20, `Paused timeline drifted ${Math.abs(after - before)} ms.`);

  const scrub = await cdp.evaluate(`(()=>{
    const input=document.querySelector('input[aria-label="Scenario time"]');
    if(!input)return null;
    const target=Math.round(Number(input.max)*0.5/10)*10;
    input.value=String(target);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return {target,value:Number(input.value)};
  })()`);
  assert.ok(scrub, 'Timeline range input is missing.');
  await sleep(100);
  const actual = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  assert.ok(Math.abs(actual - scrub.target) <= 20, `Scrub expected ${scrub.target}, got ${actual}.`);
  await sleep(300);
  const stable = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  assert.ok(Math.abs(stable - actual) <= 20, 'Scrubbing unexpectedly resumed playback.');
}

async function captureRepresentativeState(cdp, route, viewport) {
  const state = await cdp.evaluate(`(()=>{
    const rail=document.querySelector('.visual-time-rail');
    const controls=document.querySelector('.visual-time-rail__controls');
    const speed=document.querySelector('.visual-time-rail__speed');
    const track=document.querySelector('.visual-time-rail__track');
    const workspace=document.querySelector('.visual-workspace');
    const toolbar=document.querySelector('.visual-workspace__toolbar');
    const hud=document.querySelector('.visual-workspace__hud');
    const pick=(element)=>{if(!element)return null;const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const intersects=(a,b)=>Boolean(a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);
    const boxes={rail:pick(rail),controls:pick(controls),speed:pick(speed),track:pick(track),workspace:pick(workspace),toolbar:pick(toolbar),hud:pick(hud)};
    return {
      boxes,
      controlsTrackOverlap:intersects(boxes.controls,boxes.track),
      speedTrackOverlap:intersects(boxes.speed,boxes.track),
      scrollWidth:document.documentElement.scrollWidth,
      innerWidth,
      scrollHeight:document.documentElement.scrollHeight,
      innerHeight,
      speedValue:speed?.value??null,
      speedOptions:speed?[...speed.options].map((option)=>option.value):[],
    };
  })()`);
  assert.deepEqual(state.speedOptions, ['0.5', '1', '1.5', '2'], `${route.id}/${viewport.id} speed choices changed.`);
  assert.equal(state.controlsTrackOverlap, false, `${route.id}/${viewport.id} playback controls overlap the timeline track.`);
  assert.equal(state.speedTrackOverlap, false, `${route.id}/${viewport.id} speed control overlaps the timeline track.`);
  assert.ok(state.scrollWidth <= state.innerWidth + 1, `${route.id}/${viewport.id} horizontally overflows (${state.scrollWidth} > ${state.innerWidth}).`);

  await cdp.evaluate(`(()=>{
    const danger=document.querySelector('.visual-time-rail__events .tone-danger')||document.querySelector('.visual-time-rail__events .tone-warning');
    if(danger){danger.click();return true}
    const input=document.querySelector('input[aria-label="Scenario time"]');
    if(!input)return false;
    input.value=String(Math.round(Number(input.max)*0.5/10)*10);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);
  await sleep(420);
  return state;
}

async function screenshot(cdp, path) {
  const result = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(path, Buffer.from(result.data, 'base64'));
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const { server, origin } = await serveProductionArtifact(distDir);
  const chromePath = findChrome();
  const launched = await launchChrome(chromePath);
  let cdp;
  const report = { generatedAt: new Date().toISOString(), chromePath, launchAttempts: launched.attempts, profiles: [], failures: [] };
  try {
    const pages = await fetchJson(`http://127.0.0.1:${launched.port}/json/list`);
    const page = pages.find((candidate) => candidate.type === 'page');
    assert.ok(page?.webSocketDebuggerUrl, 'No debuggable page target found.');
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');

    for (const route of routes) {
      for (const viewport of viewports) {
        const profile = { route: route.id, viewport: viewport.id, width: viewport.width, height: viewport.height, failures: [] };
        try {
          await navigate(cdp, origin, route, viewport);
          if (viewport.id === 'wide') {
            const oneXDeltaMs = await playAndMeasure(cdp, 1);
            const twoXDeltaMs = await playAndMeasure(cdp, 2);
            assert.ok(oneXDeltaMs > 40, `${route.id} 1× did not advance.`);
            assert.ok(oneXDeltaMs < 900, `${route.id} 1× advanced ${oneXDeltaMs} model ms in one real second; presentation pacing is too fast.`);
            assert.ok(twoXDeltaMs > oneXDeltaMs * 1.55, `${route.id} 2× (${twoXDeltaMs}) did not materially outrun 1× (${oneXDeltaMs}).`);
            profile.oneXDeltaMs = oneXDeltaMs;
            profile.twoXDeltaMs = twoXDeltaMs;
            await assertPauseAndScrub(cdp);
          } else {
            await resetAndSetSpeed(cdp, 1);
            await sleep(100);
          }
          profile.layout = await captureRepresentativeState(cdp, route, viewport);
          const filename = `${route.id}-${viewport.id}.png`;
          await screenshot(cdp, join(outputDir, filename));
          profile.screenshot = filename;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          profile.failures.push(message);
          report.failures.push(`${route.id}/${viewport.id}: ${message}`);
        }
        report.profiles.push(profile);
      }
    }
  } finally {
    cdp?.close();
    if (!launched.chrome.killed) launched.chrome.kill('SIGKILL');
    rmSync(launched.userDataDir, { recursive: true, force: true });
    await new Promise((resolvePromise) => server.close(resolvePromise));
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  if (report.failures.length > 0) throw new Error(`Timeline visual review failed:\n${report.failures.join('\n')}`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

await main();

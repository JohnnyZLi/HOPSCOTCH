import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { serveProductionArtifact } from './production-artifact-server.mjs';

const root = process.cwd();
const distDir = resolve(root, 'dist');
const artifactDir = resolve(root, 'artifacts/home-visual-review');
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function executableFromPath(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function findChrome() {
  const explicit = process.env.CHROME_PATH?.trim();
  if (explicit) return explicit;
  for (const command of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    const found = executableFromPath(command);
    if (found) return found;
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
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return address.port;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
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

async function launchChrome() {
  const port = await freePort();
  const userDataDir = mkdtempSync(join(tmpdir(), 'hopscotch-home-review-'));
  const chrome = spawn(findChrome(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  chrome.stderr.setEncoding('utf8');
  chrome.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-16000); });
  try {
    await waitForDevTools(port);
    return { chrome, port, userDataDir, stderr: () => stderr };
  } catch (error) {
    chrome.kill('SIGKILL');
    rmSync(userDataDir, { recursive: true, force: true });
    throw error;
  }
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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime evaluation failed');
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
    await sleep(50);
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

function overlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function capture(cdp, name) {
  const geometry = await cdp.evaluate(`(()=>{
    const rect=(selector)=>{const element=document.querySelector(selector);if(!element)return null;const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return {viewport:{width:innerWidth,height:innerHeight},layerCard:rect('.layer-card'),scaleRail:rect('.scale-rail'),actionDeck:rect('.home-action-deck'),actionGrid:rect('.home-action-grid'),timeline:rect('.timeline-preview'),hero:rect('.hero-copy')};
  })()`);
  assert.ok(geometry.layerCard && geometry.scaleRail && geometry.actionGrid && geometry.timeline);
  assert.equal(overlap(geometry.layerCard, geometry.scaleRail), false, `${name}: layer card overlaps scale rail`);
  assert.equal(overlap(geometry.layerCard, geometry.actionGrid), false, `${name}: layer card overlaps launch-card grid`);
  assert.ok(geometry.layerCard.bottom <= geometry.actionGrid.top - 16, `${name}: layer card is not visually separated from launch-card row (${geometry.layerCard.bottom.toFixed(1)} vs ${geometry.actionGrid.top.toFixed(1)})`);
  assert.ok(geometry.layerCard.bottom <= geometry.timeline.top - 24, `${name}: layer card encroaches on timeline`);
  const screenshot = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(resolve(artifactDir, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
  return geometry;
}

mkdirSync(artifactDir, { recursive: true });
const { server, origin } = await serveProductionArtifact(distDir);
const chromeState = await launchChrome();
let cdp = null;
try {
  const target = await fetchJson(`http://127.0.0.1:${chromeState.port}/json/new?${encodeURIComponent(origin)}`, { method: 'PUT' });
  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 947, deviceScaleFactor: 1, mobile: false });
  await cdp.call('Page.navigate', { url: origin });
  await waitForExpression(cdp, `Boolean(document.querySelector('.overview-scene') && document.querySelector('.layer-card') && document.querySelector('.home-action-grid'))`);
  await cdp.evaluate(`document.fonts?.ready ?? Promise.resolve()`);
  await sleep(700);
  const internet = await capture(cdp, 'home-internet');
  const selected = await cdp.evaluate(`(()=>{const button=[...document.querySelectorAll('.scale-rail button')].find((candidate)=>candidate.textContent?.includes('Application'));if(!button)return false;button.click();return true;})()`);
  assert.equal(selected, true, 'Application scale button was not found');
  await waitForExpression(cdp, `document.querySelector('.layer-card h2')?.textContent === 'Application'`);
  await sleep(500);
  const application = await capture(cdp, 'home-application');
  writeFileSync(resolve(artifactDir, 'geometry.json'), JSON.stringify({ internet, application }, null, 2));
  console.log(`Home visual review captured at ${artifactDir}`);
  console.log(JSON.stringify({ internet, application }, null, 2));
} finally {
  cdp?.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
  if (!chromeState.chrome.killed) chromeState.chrome.kill('SIGKILL');
  rmSync(chromeState.userDataDir, { recursive: true, force: true });
}

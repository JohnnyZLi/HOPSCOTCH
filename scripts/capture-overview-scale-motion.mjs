import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { serveProductionArtifact } from './production-artifact-server.mjs';

const root = process.cwd();
const artifactDir = resolve(root, 'artifacts/overview-scale-motion');
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
    try { return await fetchJson(`http://127.0.0.1:${port}/json/version`); }
    catch (error) { lastError = error; await sleep(100); }
  }
  throw new Error(`Chrome DevTools did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function launchChrome() {
  const port = await freePort();
  const userDataDir = mkdtempSync(join(tmpdir(), 'hopscotch-scale-motion-'));
  const chrome = spawn(findChrome(), [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-default-apps', '--disable-extensions', '--disable-sync',
    '--metrics-recording-only', '--mute-audio', '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`, '--remote-allow-origins=*', `--user-data-dir=${userDataDir}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  await waitForDevTools(port);
  return { chrome, port, userDataDir };
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
  close() { try { this.socket.close(); } catch { /* noop */ } }
}

async function waitForExpression(cdp, expression, timeoutMs = 8000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await cdp.evaluate(expression)) return;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function capture(cdp, name) {
  const state = await cdp.evaluate(`(()=>{
    const rect=(selector)=>{const e=document.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const style=(selector)=>{const e=document.querySelector(selector);if(!e)return null;const s=getComputedStyle(e);return {opacity:s.opacity,transform:s.transform,filter:s.filter};};
    return {
      layer: document.querySelector('.app-shell')?.getAttribute('data-layer'),
      direction: document.querySelector('.app-shell')?.getAttribute('data-scale-direction'),
      marker: rect('.scale-active-marker'),
      card: rect('.layer-card'),
      wave: style('.scale-depth-wave'),
      network: style('.network-field'),
      grid: style('.grid-field'),
    };
  })()`);
  const screenshot = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(resolve(artifactDir, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
  return state;
}

async function clickScale(cdp, label) {
  const clicked = await cdp.evaluate(`(()=>{const button=[...document.querySelectorAll('.scale-rail button')].find((candidate)=>candidate.textContent?.includes(${JSON.stringify(label)}));if(!button)return false;button.click();return true;})()`);
  assert.equal(clicked, true, `${label} scale button not found`);
}

mkdirSync(artifactDir, { recursive: true });
const { server, origin } = await serveProductionArtifact(resolve(root, 'dist'));
const chromeState = await launchChrome();
let cdp = null;
try {
  const target = await fetchJson(`http://127.0.0.1:${chromeState.port}/json/new?${encodeURIComponent(origin)}`, { method: 'PUT' });
  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 947, deviceScaleFactor: 1, mobile: false });
  await cdp.call('Page.navigate', { url: origin });
  await waitForExpression(cdp, `Boolean(document.querySelector('.overview-scene') && document.querySelector('.scale-active-marker'))`);
  await cdp.evaluate(`document.fonts?.ready ?? Promise.resolve()`);
  await sleep(800);

  const states = {};
  states['internet-rest'] = await capture(cdp, '00-internet-rest');
  await clickScale(cdp, 'Packet');
  await sleep(70); states['inward-070'] = await capture(cdp, '01-inward-070');
  await sleep(150); states['inward-220'] = await capture(cdp, '02-inward-220');
  await sleep(300); states['inward-520'] = await capture(cdp, '03-inward-520');
  await sleep(430); states['packet-rest'] = await capture(cdp, '04-packet-rest');

  await clickScale(cdp, 'Internet');
  await sleep(70); states['outward-070'] = await capture(cdp, '05-outward-070');
  await sleep(150); states['outward-220'] = await capture(cdp, '06-outward-220');
  await sleep(300); states['outward-520'] = await capture(cdp, '07-outward-520');
  await sleep(430); states['internet-restored'] = await capture(cdp, '08-internet-restored');

  writeFileSync(resolve(artifactDir, 'state.json'), JSON.stringify(states, null, 2));
  console.log(JSON.stringify(states, null, 2));
} finally {
  cdp?.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
  if (!chromeState.chrome.killed) chromeState.chrome.kill('SIGKILL');
  rmSync(chromeState.userDataDir, { recursive: true, force: true });
}

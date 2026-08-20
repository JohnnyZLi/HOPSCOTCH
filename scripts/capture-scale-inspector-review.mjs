import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { serveProductionArtifact } from './production-artifact-server.mjs';

const root = process.cwd();
const distDir = resolve(root, 'dist');
const artifactDir = resolve(root, 'artifacts/scale-inspector-review');
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function executableFromPath(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}
function findChrome() {
  const explicit = process.env.CHROME_PATH?.trim();
  if (explicit && existsSync(explicit)) return explicit;
  for (const command of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    const found = executableFromPath(command);
    if (found) return found;
  }
  throw new Error('Chrome/Chromium not found.');
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolvePromise, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolvePromise); });
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
async function launchChrome() {
  const port = await freePort();
  const userDataDir = mkdtempSync(join(tmpdir(), 'hopscotch-scale-review-'));
  const chrome = spawn(findChrome(), ['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-default-apps','--disable-extensions','--disable-sync','--metrics-recording-only','--mute-audio','--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${port}`,'--remote-allow-origins=*',`--user-data-dir=${userDataDir}`,'about:blank'], { stdio: ['ignore','ignore','pipe'] });
  const deadline = performance.now() + 10000;
  while (performance.now() < deadline) {
    try { await fetchJson(`http://127.0.0.1:${port}/json/version`); return { chrome, port, userDataDir }; } catch { await sleep(100); }
  }
  chrome.kill('SIGKILL'); rmSync(userDataDir, { recursive: true, force: true });
  throw new Error('Chrome DevTools did not become ready.');
}
class CdpClient {
  constructor(url) {
    this.nextId = 0; this.pending = new Map(); this.socket = new WebSocket(url);
    this.ready = new Promise((resolvePromise, reject) => { this.socket.addEventListener('open', resolvePromise, { once: true }); this.socket.addEventListener('error', () => reject(new Error(`Unable to open CDP WebSocket ${url}`)), { once: true }); });
    this.socket.addEventListener('message', async (message) => { const raw = typeof message.data === 'string' ? message.data : Buffer.from(await message.data.arrayBuffer()).toString('utf8'); const payload = JSON.parse(raw); if (payload.id === undefined) return; const waiter = this.pending.get(payload.id); if (!waiter) return; this.pending.delete(payload.id); payload.error ? waiter.reject(new Error(`${waiter.method}: ${payload.error.message}`)) : waiter.resolve(payload.result ?? {}); });
  }
  async call(method, params = {}) { await this.ready; const id = ++this.nextId; const promise = new Promise((resolvePromise, reject) => this.pending.set(id, { resolve: resolvePromise, reject, method })); this.socket.send(JSON.stringify({ id, method, params })); return promise; }
  async evaluate(expression) { const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime evaluation failed'); return result.result?.value; }
  close() { try { this.socket.close(); } catch {} }
}
async function waitForExpression(cdp, expression, timeoutMs = 8000) { const deadline = performance.now() + timeoutMs; while (performance.now() < deadline) { if (await cdp.evaluate(expression)) return; await sleep(50); } throw new Error(`Timed out waiting for ${expression}`); }
function overlap(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
async function capture(cdp, scale) {
  const geometry = await cdp.evaluate(`(()=>{const rect=(el)=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,cx:(r.left+r.right)/2,cy:(r.top+r.bottom)/2};};const inspector=document.querySelector('.scale-inspector');const card=document.querySelector('.layer-card');const active=document.querySelector('.scale-rail button.active');const rail=document.querySelector('.scale-rail');const actions=document.querySelector('.home-action-grid');const timeline=document.querySelector('.timeline-preview');const hero=document.querySelector('.hero-copy');return {scale:inspector?.dataset.activeScale,card:rect(card),active:rect(active),rail:rect(rail),actions:rect(actions),timeline:rect(timeline),hero:rect(hero)};})()`);
  assert.equal(geometry.scale, scale, `${scale}: inspector state mismatch`);
  assert.ok(Math.abs(geometry.card.cy - geometry.active.cy) <= 2.5, `${scale}: flyout is not attached to active row (${geometry.card.cy} vs ${geometry.active.cy})`);
  assert.equal(overlap(geometry.card, geometry.rail), false, `${scale}: flyout overlaps rail`);
  assert.equal(overlap(geometry.card, geometry.actions), false, `${scale}: flyout overlaps launch cards`);
  assert.equal(overlap(geometry.card, geometry.timeline), false, `${scale}: flyout overlaps timeline`);
  assert.equal(overlap(geometry.card, geometry.hero), false, `${scale}: flyout overlaps hero`);
  assert.ok(geometry.actions.top - geometry.card.bottom >= 24, `${scale}: flyout lacks launch-row breathing room`);
  const screenshot = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(resolve(artifactDir, `scale-${scale}.png`), Buffer.from(screenshot.data, 'base64'));
  return geometry;
}

mkdirSync(artifactDir, { recursive: true });
const { server, origin } = await serveProductionArtifact(distDir);
const chromeState = await launchChrome();
let cdp;
try {
  const target = await fetchJson(`http://127.0.0.1:${chromeState.port}/json/new?${encodeURIComponent(origin)}`, { method: 'PUT' });
  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.call('Page.enable'); await cdp.call('Runtime.enable');
  await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 947, deviceScaleFactor: 1, mobile: false });
  await cdp.call('Page.navigate', { url: origin });
  await waitForExpression(cdp, `Boolean(document.querySelector('.scale-inspector') && document.querySelector('.home-action-grid'))`);
  await cdp.evaluate(`document.fonts?.ready ?? Promise.resolve()`); await sleep(650);
  const scales = ['internet','routing','transport','application','packet'];
  const geometry = {};
  for (const scale of scales) {
    if (scale !== 'internet') {
      const clicked = await cdp.evaluate(`(()=>{const button=[...document.querySelectorAll('.scale-rail button')].find((candidate)=>candidate.textContent?.toLowerCase().includes(${JSON.stringify(scale)}));if(!button)return false;button.click();return true;})()`);
      assert.equal(clicked, true, `${scale}: button not found`);
      await waitForExpression(cdp, `document.querySelector('.scale-inspector')?.dataset.activeScale === ${JSON.stringify(scale)}`);
      await sleep(350);
    }
    geometry[scale] = await capture(cdp, scale);
  }
  writeFileSync(resolve(artifactDir, 'geometry.json'), JSON.stringify(geometry, null, 2));
  console.log(JSON.stringify(geometry, null, 2));
} finally {
  cdp?.close(); await new Promise((resolvePromise) => server.close(resolvePromise)); if (!chromeState.chrome.killed) chromeState.chrome.kill('SIGKILL'); rmSync(chromeState.userDataDir, { recursive: true, force: true });
}

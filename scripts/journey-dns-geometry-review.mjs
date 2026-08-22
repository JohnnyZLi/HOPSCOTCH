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
const outputDir = resolve(root, 'artifacts/journey-dns-geometry-review');
const reportPath = join(outputDir, 'report.json');
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
    const candidate = executableFromPath(command);
    if (candidate) return candidate;
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
    try { return await fetchJson(`http://127.0.0.1:${port}/json/version`); }
    catch (error) { lastError = error; await sleep(100); }
  }
  throw new Error(`Chrome DevTools did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function launchChrome(chromePath) {
  const port = await freePort();
  const userDataDir = mkdtempSync(join(tmpdir(), 'hopscotch-dns-geometry-'));
  const chrome = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-default-apps', '--disable-extensions', '--disable-sync', '--mute-audio',
    '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, '--remote-allow-origins=*',
    `--user-data-dir=${userDataDir}`, 'about:blank',
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
    const result = new Promise((resolvePromise, reject) => this.pending.set(id, { resolve: resolvePromise, reject, method }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime evaluation failed');
    return result.result?.value;
  }

  close() { try { this.socket.close(); } catch { /* noop */ } }
}

async function waitForExpression(cdp, expression, timeoutMs = 15000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await cdp.evaluate(expression)) return;
    await sleep(30);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function screenshot(cdp, filename) {
  const result = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(join(outputDir, filename), Buffer.from(result.data, 'base64'));
}

async function measureDns(cdp, origin, width, height) {
  await cdp.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 680 });
  await cdp.call('Page.navigate', { url: `${origin}/journey` });
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-visual-workspace'))`);
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-cinematic-stage .dns-chain'))`, 20000);
  await sleep(260);

  const geometry = await cdp.evaluate(`(()=>{
    const chain=document.querySelector('.journey-cinematic-stage .dns-chain');
    if(!chain)return null;
    const chainRect=chain.getBoundingClientRect();
    const pseudo=getComputedStyle(chain,'::before');
    const lineTop=parseFloat(pseudo.top);
    const lineHeight=parseFloat(pseudo.height)||1;
    const lineCenterY=chainRect.top+lineTop+(lineHeight/2);
    const rings=[...chain.querySelectorAll(':scope > div > i')].map((ring,index)=>{
      const rect=ring.getBoundingClientRect();
      const centerY=rect.top+(rect.height/2);
      return {index,top:rect.top,height:rect.height,centerY,delta:Math.abs(centerY-lineCenterY)};
    });
    return {
      viewport:{innerWidth,innerHeight,devicePixelRatio},
      chain:{top:chainRect.top,height:chainRect.height},
      pseudo:{top:pseudo.top,height:pseudo.height,content:pseudo.content},
      lineCenterY,
      rings,
      maxDelta:Math.max(...rings.map((ring)=>ring.delta)),
      scrollWidth:document.documentElement.scrollWidth,
    };
  })()`);

  assert.ok(geometry, `${width}x${height}: DNS chain was not measurable.`);
  assert.equal(geometry.rings.length, 5, `${width}x${height}: expected five DNS node rings.`);
  assert.notEqual(geometry.pseudo.content, 'none', `${width}x${height}: DNS connector pseudo-element is missing.`);
  assert.ok(geometry.maxDelta <= 2, `${width}x${height}: DNS connector misses node centers by ${geometry.maxDelta.toFixed(2)}px.`);
  assert.ok(geometry.scrollWidth <= width + 1, `${width}x${height}: Journey horizontally overflows.`);

  await screenshot(cdp, `journey-dns-${width}x${height}.png`);
  return geometry;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const { server, origin } = await serveProductionArtifact(distDir);
  const launched = await launchChrome(findChrome());
  let cdp;
  const report = { generatedAt: new Date().toISOString(), failures: [], viewports: {} };

  try {
    const pages = await fetchJson(`http://127.0.0.1:${launched.port}/json/list`);
    const page = pages.find((candidate) => candidate.type === 'page');
    assert.ok(page?.webSocketDebuggerUrl, 'No debuggable page target found.');
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');

    report.viewports['1600x950'] = await measureDns(cdp, origin, 1600, 950);
    report.viewports['390x844'] = await measureDns(cdp, origin, 390, 844);
  } catch (error) {
    report.failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
  } finally {
    cdp?.close();
    if (!launched.chrome.killed) launched.chrome.kill('SIGKILL');
    rmSync(launched.userDataDir, { recursive: true, force: true });
    await new Promise((resolvePromise) => server.close(resolvePromise));
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (report.failures.length > 0) throw new Error(`Journey DNS geometry review failed:\n${report.failures.join('\n')}`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

await main();

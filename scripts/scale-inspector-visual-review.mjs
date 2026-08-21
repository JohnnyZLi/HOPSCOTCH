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
const outputDir = resolve(root, 'artifacts/scale-inspector-visual-review');
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
  const attempts = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const port = await freePort();
    const userDataDir = mkdtempSync(join(tmpdir(), `hopscotch-scale-inspector-${attempt}-`));
    const chrome = spawn(chromePath, [
      '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-default-apps', '--disable-extensions', '--disable-sync', '--mute-audio',
      '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, '--remote-allow-origins=*',
      `--user-data-dir=${userDataDir}`, 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8000); });
    try {
      await waitForDevTools(port);
      return { chrome, port, userDataDir, attempts };
    } catch (error) {
      if (!chrome.killed) chrome.kill('SIGKILL');
      attempts.push({ attempt, error: error instanceof Error ? error.message : String(error), stderrTail: stderr || null });
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

async function waitForExpression(cdp, expression, timeoutMs = 8000) {
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

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const { server, origin } = await serveProductionArtifact(distDir);
  const launched = await launchChrome(findChrome());
  let cdp;
  const report = { generatedAt: new Date().toISOString(), launchAttempts: launched.attempts, failures: [] };

  try {
    const pages = await fetchJson(`http://127.0.0.1:${launched.port}/json/list`);
    const page = pages.find((candidate) => candidate.type === 'page');
    assert.ok(page?.webSocketDebuggerUrl, 'No debuggable page target found.');
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 950, deviceScaleFactor: 1, mobile: false });
    await cdp.call('Page.navigate', { url: `${origin}/` });
    await waitForExpression(cdp, `Boolean(document.querySelector('.scale-rail'))`);
    await sleep(900);

    const clickedAt = performance.now();
    assert.equal(await cdp.evaluate(`(()=>{const button=[...document.querySelectorAll('.scale-rail button')].find((item)=>item.textContent?.includes('Routing'));if(!button)return false;button.click();return true})()`), true, 'Routing scale button not found.');

    let descriptionReadableMs = null;
    let statusReadableMs = null;
    const sampleDeadline = performance.now() + 700;
    while (performance.now() < sampleDeadline && (descriptionReadableMs === null || statusReadableMs === null)) {
      const state = await cdp.evaluate(`(()=>{const p=document.querySelector('.layer-card-copy p');const status=document.querySelector('.layer-card-copy small');return {description:p?.textContent??'',descriptionOpacity:p?Number(getComputedStyle(p).opacity):0,status:status?.textContent??'',statusOpacity:status?Number(getComputedStyle(status).opacity):0}})()`);
      const elapsed = performance.now() - clickedAt;
      if (descriptionReadableMs === null && state.description.includes('Build a weighted graph') && state.descriptionOpacity >= 0.85) descriptionReadableMs = elapsed;
      if (statusReadableMs === null && state.status.includes('DYNAMIC NETWORK BUILDER READY') && state.statusOpacity >= 0.85) statusReadableMs = elapsed;
      await sleep(15);
    }

    assert.ok(descriptionReadableMs !== null && descriptionReadableMs <= 390, `Routing description was not readable quickly enough (${descriptionReadableMs ?? 'never'} ms).`);
    assert.ok(statusReadableMs !== null && statusReadableMs <= 470, `Routing READY status was not readable quickly enough (${statusReadableMs ?? 'never'} ms).`);
    await sleep(180);

    const geometry = await cdp.evaluate(`(()=>{
      const card=document.querySelector('.layer-card');
      const copy=document.querySelector('.layer-card-copy');
      const description=copy?.querySelector('p');
      const rule=copy?.querySelector('.card-rule');
      const status=copy?.querySelector('small');
      const rail=document.querySelector('.scale-rail');
      const box=(element)=>{if(!element)return null;const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
      const style=copy?getComputedStyle(copy):null;
      return {
        activeScale:document.querySelector('.scale-inspector')?.getAttribute('data-active-scale')??null,
        card:box(card),copy:box(copy),description:box(description),rule:box(rule),status:box(status),rail:box(rail),
        padding:style?{top:parseFloat(style.paddingTop),right:parseFloat(style.paddingRight),bottom:parseFloat(style.paddingBottom),left:parseFloat(style.paddingLeft)}:null,
        descriptionText:description?.textContent??'',statusText:status?.textContent??'',
        scrollWidth:document.documentElement.scrollWidth,innerWidth,
      };
    })()`);

    assert.equal(geometry.activeScale, 'routing');
    assert.ok(geometry.card && geometry.card.width >= 340 && geometry.card.width <= 360, `Card width is ${geometry.card?.width}.`);
    assert.ok(geometry.padding && geometry.padding.left >= 22 && geometry.padding.right >= 22 && geometry.padding.top >= 20 && geometry.padding.bottom >= 18, `Unexpected card padding: ${JSON.stringify(geometry.padding)}`);
    assert.ok(geometry.rule && geometry.description && geometry.rule.top - geometry.description.bottom >= 16, 'Divider is still too close to description text.');
    assert.ok(geometry.rule && geometry.status && geometry.status.top - geometry.rule.bottom >= 12, 'READY status is still too close to divider.');
    assert.ok(geometry.card && geometry.rail && geometry.card.right <= geometry.rail.left - 20, 'Scale detail card collides with the scale rail.');
    assert.ok(geometry.scrollWidth <= geometry.innerWidth + 1, 'Overview horizontally overflows.');

    report.descriptionReadableMs = Math.round(descriptionReadableMs);
    report.statusReadableMs = Math.round(statusReadableMs);
    report.geometry = geometry;
    await screenshot(cdp, 'routing-scale-settled.png');
    report.screenshot = 'routing-scale-settled.png';
  } catch (error) {
    report.failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
  } finally {
    cdp?.close();
    if (!launched.chrome.killed) launched.chrome.kill('SIGKILL');
    rmSync(launched.userDataDir, { recursive: true, force: true });
    await new Promise((resolvePromise) => server.close(resolvePromise));
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (report.failures.length > 0) throw new Error(`Scale inspector visual review failed:\n${report.failures.join('\n')}`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

await main();

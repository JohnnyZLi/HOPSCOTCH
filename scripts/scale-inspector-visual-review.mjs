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
const outputDir = resolve(root, 'artifacts/kinetic-overview-visual-review');
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
    await waitForExpression(cdp, `Boolean(document.querySelector('.kinetic-instrument') && document.querySelector('.corner-navigator'))`);
    await sleep(900);
    await screenshot(cdp, 'kinetic-opening.png');

    const clickedAt = performance.now();
    assert.equal(await cdp.evaluate(`(()=>{const button=[...document.querySelectorAll('.kinetic-phase-buttons button')].find((item)=>item.textContent?.includes('Assemble'));if(!button)return false;button.click();return true})()`), true, 'Assemble phase button not found.');

    let phaseReadableMs = null;
    const sampleDeadline = performance.now() + 800;
    while (performance.now() < sampleDeadline && phaseReadableMs === null) {
      const state = await cdp.evaluate(`(()=>{const readout=document.querySelector('.kinetic-readout');return {text:readout?.textContent??'',opacity:readout?Number(getComputedStyle(readout).opacity):0}})()`);
      const elapsed = performance.now() - clickedAt;
      if (state.text.includes('Assemble') && state.opacity >= 0.85) phaseReadableMs = elapsed;
      await sleep(15);
    }
    assert.ok(phaseReadableMs !== null && phaseReadableMs <= 450, `Assemble readout was not readable quickly enough (${phaseReadableMs ?? 'never'} ms).`);
    await sleep(900);

    const geometry = await cdp.evaluate(`(()=>{
      const box=(element)=>{if(!element)return null;const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
      return {
        instrument:box(document.querySelector('.kinetic-instrument')),
        readout:box(document.querySelector('.kinetic-readout')),
        packet:box(document.querySelector('.kinetic-packet')),
        visibleLayers:[...document.querySelectorAll('.kinetic-packet-layer')].filter((element)=>Number(getComputedStyle(element).opacity)>.45).length,
        activePhases:document.querySelectorAll('.kinetic-phase-buttons button.active').length,
        readoutText:document.querySelector('.kinetic-readout')?.textContent??'',
        scrollWidth:document.documentElement.scrollWidth,innerWidth,
      };
    })()`);

    assert.match(geometry.readoutText, /Assemble/);
    assert.equal(geometry.activePhases, 1, 'Exactly one journey phase must be selected.');
    assert.equal(geometry.visibleLayers, 5, 'All five packet envelopes must become visible during assembly.');
    assert.ok(geometry.instrument && geometry.instrument.right <= geometry.innerWidth, 'Compact instrument escapes the viewport.');
    assert.ok(geometry.scrollWidth <= geometry.innerWidth + 1, 'Overview horizontally overflows.');

    report.phaseReadableMs = Math.round(phaseReadableMs);
    report.geometry = geometry;
    await screenshot(cdp, 'kinetic-assembly.png');

    assert.equal(await cdp.evaluate(`(()=>{const button=document.querySelector('.corner-navigator');if(!button)return false;button.click();return true})()`), true, 'Corner navigator not found.');
    await waitForExpression(cdp, `Boolean(document.querySelector('.explore-panel'))`);
    await sleep(450);
    const navigation = await cdp.evaluate(`(()=>{const panel=document.querySelector('.explore-panel');const r=panel?.getBoundingClientRect();return {panel:r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null,rows:document.querySelectorAll('.explore-row').length,legacyCards:document.querySelectorAll('.explore-card,.explore-featured-card').length,activeTag:document.activeElement?.className??'',innerWidth,innerHeight}})()`);
    assert.ok(navigation.panel && navigation.panel.left >= 0 && navigation.panel.top >= 0 && navigation.panel.bottom <= navigation.innerHeight, 'Navigation drawer escapes the viewport.');
    assert.equal(navigation.rows, 13, 'All workspaces must remain available as simple rows.');
    assert.equal(navigation.legacyCards, 0, 'Legacy navigation cards returned.');
    assert.match(String(navigation.activeTag), /explore-close/, 'Navigation did not move focus inside the dialog.');
    report.navigation = navigation;
    await screenshot(cdp, 'corner-navigation-open.png');
    report.screenshots = ['kinetic-opening.png', 'kinetic-assembly.png', 'corner-navigation-open.png'];
  } catch (error) {
    report.failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
  } finally {
    cdp?.close();
    if (!launched.chrome.killed) launched.chrome.kill('SIGKILL');
    rmSync(launched.userDataDir, { recursive: true, force: true });
    await new Promise((resolvePromise) => server.close(resolvePromise));
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (report.failures.length > 0) throw new Error(`Kinetic overview visual review failed:\n${report.failures.join('\n')}`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

await main();

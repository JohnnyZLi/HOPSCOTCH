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
const outputDir = resolve(root, 'artifacts/dns-workspace-geometry-review');
const reportPath = join(outputDir, 'report.json');
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const actors = ['stub', 'recursive', 'root', 'tld', 'authoritative', 'cache'];
const links = [
  ['stub', 'recursive'],
  ['recursive', 'root'],
  ['recursive', 'tld'],
  ['recursive', 'authoritative'],
  ['recursive', 'cache'],
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

async function stopChrome(chrome) {
  if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill('SIGKILL');
  if (chrome.exitCode === null) {
    await new Promise((resolvePromise) => {
      const finish = () => resolvePromise();
      chrome.once('exit', finish);
      if (chrome.exitCode !== null) {
        chrome.removeListener('exit', finish);
        resolvePromise();
      }
    });
  }
}

async function launchChrome(chromePath) {
  const attempts = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const port = await freePort();
    const userDataDir = mkdtempSync(join(tmpdir(), `hopscotch-dns-workspace-${attempt}-`));
    const state = { stderr: '', exitCode: null };
    const chrome = spawn(chromePath, [
      '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-default-apps', '--disable-extensions', '--disable-sync', '--mute-audio',
      '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, '--remote-allow-origins=*',
      `--user-data-dir=${userDataDir}`, 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', (chunk) => { state.stderr = `${state.stderr}${chunk}`.slice(-12000); });
    chrome.once('exit', (code) => { state.exitCode = code; });
    try {
      await waitForDevTools(port);
      return { chrome, port, userDataDir, attempts };
    } catch (error) {
      await stopChrome(chrome);
      attempts.push({
        attempt,
        error: error instanceof Error ? error.message : String(error),
        exitCode: state.exitCode,
        stderrTail: state.stderr || null,
      });
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
      await sleep(120);
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

async function chooseCacheMode(cdp, mode) {
  if (mode === 'miss') return;
  const opened = await cdp.evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find((candidate)=>candidate.textContent?.trim().toLowerCase()==='configure');if(!button)return false;button.click();return true;})()`);
  assert.equal(opened, true, 'Unable to open DNS Configure drawer.');
  await waitForExpression(cdp, `Boolean(document.querySelector('.dns-config-drawer .dns-mode-toggle'))`);
  const changed = await cdp.evaluate(`(()=>{const button=[...document.querySelectorAll('.dns-config-drawer .dns-mode-toggle button')].find((candidate)=>candidate.textContent?.trim()==='CACHE HIT');if(!button)return false;button.click();return true;})()`);
  assert.equal(changed, true, 'Unable to select DNS cache-hit mode.');
  await waitForExpression(cdp, `document.querySelector('.visual-identity strong')?.textContent?.toLowerCase().includes('cache hit')===true`);
}

async function measureDns(cdp, origin, width, height, mode) {
  await cdp.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 680 });
  await cdp.call('Page.navigate', { url: `${origin}/labs/dns` });
  await waitForExpression(cdp, `Boolean(document.querySelector('.dns-visual-workspace .dns-workspace-map'))`);
  await waitForExpression(cdp, `document.querySelectorAll('.dns-workspace-map [data-dns-anchor]').length===6`);
  await waitForExpression(cdp, `document.querySelectorAll('.dns-link-layer line').length===5`);
  await waitForExpression(cdp, `!document.querySelector('.visual-entrance')`, 5000);
  await chooseCacheMode(cdp, mode);
  await sleep(300);

  const geometry = await cdp.evaluate(`(()=>{
    const actorIds=${JSON.stringify(actors)};
    const linkPairs=${JSON.stringify(links)};
    const map=document.querySelector('.dns-workspace-map');
    const layer=document.querySelector('.dns-link-layer');
    if(!map||!layer)return null;
    const mapRect=map.getBoundingClientRect();
    const layerRect=layer.getBoundingClientRect();
    const anchorData=Object.fromEntries(actorIds.map((actor)=>{
      const anchor=map.querySelector('[data-dns-anchor="'+actor+'"]');
      const card=map.querySelector('[data-dns-actor="'+actor+'"]');
      if(!anchor||!card)return [actor,null];
      const anchorRect=anchor.getBoundingClientRect();
      const cardRect=card.getBoundingClientRect();
      const anchorCenter={x:anchorRect.left+anchorRect.width/2-layerRect.left,y:anchorRect.top+anchorRect.height/2-layerRect.top};
      const cardCenter={x:cardRect.left+cardRect.width/2-layerRect.left,y:cardRect.top+cardRect.height/2-layerRect.top};
      return [actor,{anchorCenter,cardCenter,centerDelta:Math.hypot(anchorCenter.x-cardCenter.x,anchorCenter.y-cardCenter.y)}];
    }));
    const linkData=linkPairs.map(([from,to])=>{
      const line=layer.querySelector('[data-dns-link="'+from+'-'+to+'"]');
      if(!line||!anchorData[from]||!anchorData[to])return null;
      const start={x:line.x1.baseVal.value,y:line.y1.baseVal.value};
      const end={x:line.x2.baseVal.value,y:line.y2.baseVal.value};
      const startDelta=Math.hypot(start.x-anchorData[from].anchorCenter.x,start.y-anchorData[from].anchorCenter.y);
      const endDelta=Math.hypot(end.x-anchorData[to].anchorCenter.x,end.y-anchorData[to].anchorCenter.y);
      return {from,to,start,end,startDelta,endDelta};
    });
    return {
      viewport:{innerWidth,innerHeight,devicePixelRatio},
      mode:document.querySelector('.visual-identity strong')?.textContent?.toLowerCase().includes('cache hit')?'hit':'miss',
      map:{left:mapRect.left,top:mapRect.top,width:mapRect.width,height:mapRect.height},
      layer:{left:layerRect.left,top:layerRect.top,width:layerRect.width,height:layerRect.height},
      anchors:anchorData,
      links:linkData,
      maxActorCenterDelta:Math.max(...Object.values(anchorData).map((entry)=>entry?.centerDelta??Infinity)),
      maxEndpointDelta:Math.max(...linkData.flatMap((entry)=>entry?[entry.startDelta,entry.endDelta]:[Infinity])),
      scrollWidth:document.documentElement.scrollWidth,
    };
  })()`);

  assert.ok(geometry, `${width}x${height} ${mode}: DNS workspace was not measurable.`);
  assert.equal(geometry.mode, mode, `${width}x${height}: expected cache ${mode} mode.`);
  assert.ok(geometry.maxActorCenterDelta <= 0.75, `${width}x${height} ${mode}: anchor drifts from actor center by ${geometry.maxActorCenterDelta.toFixed(2)}px.`);
  assert.ok(geometry.maxEndpointDelta <= 0.75, `${width}x${height} ${mode}: connector endpoint misses anchor by ${geometry.maxEndpointDelta.toFixed(2)}px.`);
  assert.ok(geometry.scrollWidth <= width + 1, `${width}x${height} ${mode}: DNS workspace horizontally overflows.`);

  await screenshot(cdp, `dns-${mode}-${width}x${height}.png`);
  return geometry;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const { server, origin } = await serveProductionArtifact(distDir);
  const launched = await launchChrome(findChrome());
  let cdp;
  const report = { generatedAt: new Date().toISOString(), chromeLaunchAttempts: launched.attempts, failures: [], states: {} };

  try {
    const pages = await fetchJson(`http://127.0.0.1:${launched.port}/json/list`);
    const page = pages.find((candidate) => candidate.type === 'page');
    assert.ok(page?.webSocketDebuggerUrl, 'No debuggable page target found.');
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');

    report.states['desktop-miss'] = await measureDns(cdp, origin, 1600, 950, 'miss');
    report.states['desktop-hit'] = await measureDns(cdp, origin, 1600, 950, 'hit');
    report.states['mobile-miss'] = await measureDns(cdp, origin, 390, 844, 'miss');
    report.states['mobile-hit'] = await measureDns(cdp, origin, 390, 844, 'hit');
  } catch (error) {
    report.failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
  } finally {
    cdp?.close();
    await stopChrome(launched.chrome);
    rmSync(launched.userDataDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
    await new Promise((resolvePromise) => server.close(resolvePromise));
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (report.failures.length > 0) throw new Error(`DNS workspace geometry review failed:\n${report.failures.join('\n')}`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

await main();

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { serveProductionArtifact } from './production-artifact-server.mjs';

const root = process.cwd();
const distDir = resolve(root, 'dist');
const reportPath = resolve(root, process.env.HOPSCOTCH_FIREFOX_REPORT_PATH?.trim() || 'artifacts/firefox-compatibility.json');
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function executableFromPath(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function findExecutable(commands, fallbackPaths = []) {
  for (const command of commands) {
    const found = executableFromPath(command);
    if (found) return found;
  }
  return fallbackPaths.find((candidate) => existsSync(candidate)) ?? null;
}

function configuredExecutable(environmentKey, commands, fallbackPaths = []) {
  const explicit = process.env[environmentKey]?.trim();
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`${environmentKey} does not exist: ${explicit}`);
    return explicit;
  }
  return findExecutable(commands, fallbackPaths);
}

function commandVersion(executable) {
  if (!executable) return null;
  const result = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 10000 });
  return (result.stdout || result.stderr || '').trim() || null;
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

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text || null; }
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

async function waitForDriver(port, timeoutMs = 10000) {
  const deadline = performance.now() + timeoutMs;
  let lastError = null;
  while (performance.now() < deadline) {
    try {
      return await requestJson(`http://127.0.0.1:${port}/status`);
    } catch (error) {
      lastError = error;
      await sleep(100);
    }
  }
  throw new Error(`GeckoDriver did not become ready within ${timeoutMs} ms: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

class BidiClient {
  constructor(url) {
    this.nextId = 0;
    this.pending = new Map();
    this.events = [];
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolvePromise, reject) => {
      this.socket.addEventListener('open', resolvePromise, { once: true });
      this.socket.addEventListener('error', () => reject(new Error(`Unable to open Firefox BiDi WebSocket ${url}`)), { once: true });
    });
    this.socket.addEventListener('message', async (message) => {
      const raw = typeof message.data === 'string' ? message.data : Buffer.from(await message.data.arrayBuffer()).toString('utf8');
      const payload = JSON.parse(raw);
      if (payload.id !== undefined) {
        const waiter = this.pending.get(payload.id);
        if (!waiter) return;
        this.pending.delete(payload.id);
        if (payload.type === 'error') waiter.reject(new Error(`${waiter.method}: ${payload.error} ${payload.message ?? ''}`.trim()));
        else waiter.resolve(payload.result ?? {});
        return;
      }
      this.events.push(payload);
    });
  }

  async call(method, params = {}) {
    await this.ready;
    const id = ++this.nextId;
    const promise = new Promise((resolvePromise, reject) => this.pending.set(id, { resolve: resolvePromise, reject, method }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  clearEvents() { this.events.length = 0; }
  close() { try { this.socket.close(); } catch { /* noop */ } }
}

function query(parameters) {
  const search = new URLSearchParams(parameters);
  return `?${search.toString()}`;
}

const maxModifierSet = 'dns-failure,route-failure,route-leak,server-failure,single-loss,latency-spike,congestion,partition';
const profiles=['/','/journey','/labs/failure','/labs/tcp','/labs/dns','/labs/tls','/labs/http2-vs-http3','/labs/packet','/labs/builder','/internet/as-routing','/internet/physical','/internet/observed','/measured','/capture'].flatMap(path=>[1440,390].map(width=>({id:path+'-'+width,path,query:'',width,height:width===390?844:1000})));

async function main() {
  if (typeof WebSocket === 'undefined') throw new Error('Node 24 WebSocket support is required.');
  const firefox = configuredExecutable('FIREFOX_PATH', ['firefox', 'firefox-esr'], [
    '/Applications/Firefox.app/Contents/MacOS/firefox',
    '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
    '/usr/bin/firefox',
    '/usr/bin/firefox-esr',
  ]);
  const geckodriver = configuredExecutable('GECKODRIVER_PATH', ['geckodriver'], ['/usr/local/bin/geckodriver', '/opt/homebrew/bin/geckodriver', '/usr/bin/geckodriver']);
  if (!firefox) throw new Error('Firefox executable is not available.');
  if (!geckodriver) throw new Error('GeckoDriver executable is not available.');

  const report = {
    schema: 'hopscotch.firefox-compatibility',
    version: 1,
    generatedAt: new Date().toISOString(),
    browser: { path: firefox, version: commandVersion(firefox) },
    driver: { path: geckodriver, version: commandVersion(geckodriver) },
    bidiLogCapture: false,
    profiles: [],
    failures: [],
  };

  const port = await freePort();
  let driverStderr = '';
  let driver = null;
  let sessionId = null;
  let bidi = null;
  let bidiContext = null;
  let production = null;
  try {
    production = await serveProductionArtifact(distDir);
    driver = spawn(geckodriver, ['--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'ignore', 'pipe'] });
    driver.stderr.setEncoding('utf8');
    driver.stderr.on('data', (chunk) => { driverStderr = `${driverStderr}${chunk}`.slice(-24000); });
    await waitForDriver(port);
    const session = await requestJson(`http://127.0.0.1:${port}/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        capabilities: {
          alwaysMatch: {
            browserName: 'firefox',
            acceptInsecureCerts: true,
            webSocketUrl: true,
            'moz:firefoxOptions': {
              args: ['-headless'],
              prefs: { 'ui.prefersReducedMotion': 1 },
            },
          },
        },
      }),
    });
    sessionId = session?.value?.sessionId ?? null;
    const capabilities = session?.value?.capabilities ?? {};
    if (!sessionId) throw new Error(`Firefox did not return a WebDriver session id: ${JSON.stringify(session)}`);
    report.browser.capabilities = capabilities;

    if (capabilities.webSocketUrl) {
      try {
        bidi = new BidiClient(capabilities.webSocketUrl);
        await bidi.call('session.subscribe', { events: ['log.entryAdded'] });
        const tree = await bidi.call('browsingContext.getTree');
        bidiContext = tree.contexts?.[0]?.context ?? null;
        if (!bidiContext) throw new Error('Firefox BiDi did not expose a top-level browsing context.');
        report.bidiLogCapture = true;
      } catch (error) {
        report.bidiLogCaptureError = error instanceof Error ? error.message : String(error);
        bidi?.close();
        bidi = null;
      }
    }

    const webdriver = async (method, path, body = undefined) => requestJson(`http://127.0.0.1:${port}/session/${sessionId}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const execute = async (script, args = []) => (await webdriver('POST', '/execute/sync', { script, args }))?.value;

    for (const profile of profiles) {
      bidi?.clearEvents();
      await webdriver('POST', '/window/rect', { width: profile.width, height: profile.height, x: 0, y: 0 });
      if (bidi && bidiContext) {
        await bidi.call('browsingContext.setViewport', { context: bidiContext, viewport: { width: profile.width, height: profile.height }, devicePixelRatio: 1 });
      }
      await webdriver('POST', '/url', { url: `${production.origin}${profile.path ?? '/'}${profile.query}` });

      const deadline = performance.now() + 8000;
      let ready = false;
      while (performance.now() < deadline) {
        ready = Boolean(await execute('return Boolean(document.querySelector(arguments[0]));', ['.review-runtime .rv-shell']));
        if (ready) break;
        await sleep(50);
      }
      if (!ready) throw new Error(`${profile.id} timed out waiting for ${profile.readySelector}.`);
      await sleep(650);

      const structural=await execute(`const root=document.querySelector('.review-runtime');return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,header:root.querySelector('.rv-header').getBoundingClientRect().width,title:root.querySelector('h2').textContent,legacy:document.querySelectorAll('.visual-workspace,.reviewed-primary,.kinetic-overview').length,source:root.causalStudy?.snapshot().frames.map(f=>({id:f.id,at:f.at})),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};`);
      if(structural.scrollWidth>structural.width+1||structural.header<=0||!structural.title||structural.legacy!==0)throw Error(profile.id+' complete composition is clipped or retained legacy presentation: '+JSON.stringify(structural));
      if(!structural.reduced)throw Error(profile.id+' did not honor reduced motion');
      if(profile.path==='/labs/tcp'){const canonical=(await import('../src/protocol/tcp.ts')).tcpScenario.events.map(e=>({id:e.id,at:e.atMs}));assert.deepEqual(structural.source,canonical);}
      if(bidi?.events.some(event=>event.method==='log.entryAdded'&&event.params?.type==='javascript'&&event.params?.level==='error'))throw Error(profile.id+' Firefox JavaScript error');
      report.profiles.push({id:profile.id,...structural});
    }
  } catch (error) {
    report.failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
  } finally {
    if (sessionId) {
      try { await fetch(`http://127.0.0.1:${port}/session/${sessionId}`, { method: 'DELETE' }); } catch { /* cleanup */ }
    }
    bidi?.close();
    if (driver && !driver.killed) driver.kill('SIGKILL');
    if (production) await new Promise((resolvePromise) => production.server.close(resolvePromise));
    report.driver.stderrTail = driverStderr || null;
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(`HOPSCOTCH Firefox compatibility (${report.browser.version})`);
  console.log(`GeckoDriver: ${report.driver.version}`);
  console.log(`BiDi log capture: ${report.bidiLogCapture ? 'enabled' : 'unavailable'}`);
  for (const profile of report.profiles) {
    console.log(`${profile.id}: DOM ${profile.elementCount} · ${profile.innerWidth}px viewport · renderer ${profile.rendererText ?? 'n/a'} · errors ${profile.errorLogEvents}`);
  }
  console.log(`Report: ${reportPath}`);
  if (report.failures.length > 0) {
    for (const failure of report.failures) console.error(failure);
    process.exitCode = 1;
  } else {
    console.log('Firefox production semantic compatibility passed.');
  }
}

await main();

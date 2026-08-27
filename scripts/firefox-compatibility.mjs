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
const profiles = [
  {
    id: 'firefox-protocol-tcp',
    width: 1440,
    height: 1000,
    path: '/labs/tcp',
    query: '',
    readySelector: '.tcp-visual-workspace',
    expected: ['TCP recovery', 'CLIENT SEQUENCE SPACE', 'CONGESTION WINDOW', 'PROVENANCE'],
    protocolWorkspace: true,
  },
  {
    id: 'firefox-protocol-dns-mobile',
    width: 390,
    height: 844,
    path: '/labs/dns',
    query: '',
    readySelector: '.dns-visual-workspace',
    expected: ['www.example.test', 'NAMESPACE', 'STUB'],
    protocolWorkspace: true,
  },
  {
    id: 'firefox-protocol-tls',
    width: 1280,
    height: 900,
    path: '/labs/tls',
    query: '',
    readySelector: '.tls-visual-workspace',
    expected: ['TLS 1.3 handshake', 'SYMBOLIC KEY SCHEDULE', 'WIRE VISIBILITY', 'PROVENANCE'],
    protocolWorkspace: true,
  },
  {
    id: 'firefox-protocol-http-mobile',
    width: 390,
    height: 844,
    path: '/labs/http2-vs-http3',
    query: '',
    readySelector: '.http-visual-workspace',
    expected: ['HTTP/2', 'HTTP/3', 'SAME LOSS', 'SYNCHRONIZED A/B'],
    protocolWorkspace: true,
  },
  {
    id: 'firefox-max-composed-terminal',
    width: 1440,
    height: 1000,
    query: query({ journey: '2', host: 'example.test', transport: 'quic-h3', dns: 'cache-miss', mods: maxModifierSet, t: '999999' }),
    readySelector: '.journey-visual-workspace',
    expected: ['DNS FAIL + ROUTE + LEAK + SERVER + LOSS + LATENCY + CONGESTION + PARTITION', 'NO ROUTE', 'NETWORK UNREACHABLE', 'ACTIVE PATH NONE', 'ROUTE CANDIDATES 0'],
  },
  {
    id: 'firefox-route-leak',
    width: 1440,
    height: 1000,
    query: query({ journey: '1', host: 'example.test', transport: 'tcp-h2', dns: 'cache-miss', impairment: 'route-leak', t: '4810' }),
    readySelector: '.journey-visual-workspace',
    expected: ['POLICY-ANOMALY', 'ACTIVE LOCAL_PREF\n300', 'REACHABLE\nYES', 'POLICY COMPLIANT\nNO'],
  },
  {
    id: 'firefox-route-leak-mobile',
    width: 390,
    height: 844,
    query: query({ journey: '1', host: 'example.test', transport: 'tcp-h2', dns: 'cache-miss', impairment: 'route-leak', t: '4810' }),
    readySelector: '.journey-visual-workspace',
    expected: ['POLICY-ANOMALY', 'REACHABLE\nYES', 'POLICY COMPLIANT\nNO'],
  },
  {
    id: 'firefox-as-canvas',
    width: 1440,
    height: 1000,
    query: query({ stress: 'as-density' }),
    readySelector: '.internet-scale',
    expected: ['AS routing', 'SIMULATED BEST PATH'],
    stress: { asNodes: 160, asRelationships: 220 },
  },
  {
    id: 'firefox-builder-ceiling',
    width: 1440,
    height: 1000,
    query: query({ stress: 'builder-density' }),
    readySelector: '.builder-workspace',
    expected: ['32 NODES · 96 LINKS', 'PATH', 'YES · COST', 'FORWARDING', 'NO ROUTE'],
    stress: { builderNodes: 32, builderLinks: 96 },
  },
  {
    id: 'firefox-physical',
    width: 1440,
    height: 1000,
    query: query({ stress: 'physical-density' }),
    readySelector: '.physical-globe',
    expected: ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA'],
    physical: true,
  },
];

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
        ready = Boolean(await execute('return Boolean(document.querySelector(arguments[0]));', [profile.readySelector]));
        if (ready) break;
        await sleep(50);
      }
      if (!ready) throw new Error(`${profile.id} timed out waiting for ${profile.readySelector}.`);
      await sleep(650);

      const bodyText = await execute('return document.body.innerText;');
      for (const expected of profile.expected) {
        if (!bodyText.includes(expected)) throw new Error(`${profile.id} did not reach expected semantic text ${JSON.stringify(expected)}.`);
      }
      const structural = await execute(`return {
        elementCount: document.getElementsByTagName('*').length,
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollY,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        asNodes: Number(document.querySelector('.internet-scale')?.getAttribute('data-node-count') ?? 0),
        asRelationships: Number(document.querySelector('.internet-scale')?.getAttribute('data-relationship-count') ?? 0),
        builderNodes: Number(document.querySelector('.builder-workspace')?.getAttribute('data-node-count') ?? 0),
        builderLinks: Number(document.querySelector('.builder-workspace')?.getAttribute('data-link-count') ?? 0),
        physicalPoints: Number(document.querySelector('.physical-globe')?.getAttribute('data-point-count') ?? 0),
        webglCanvas: Boolean(document.querySelector('.globe-render-host canvas')),
        rendererText: document.querySelector('.physical-stage-meta > div:first-child strong')?.innerText ?? null,
        fallbackText: document.querySelector('.globe-fallback')?.innerText ?? null,
        protocol: (() => {
          const stage = document.querySelector('.protocol-visual-workspace .visual-workspace__stage')?.getBoundingClientRect();
          const scene = document.querySelector('.protocol-cinematic-stage')?.getBoundingClientRect();
          return {
            active: Boolean(stage && scene),
            stageWidth: stage?.width ?? 0,
            stageHeight: stage?.height ?? 0,
            sceneWidth: scene?.width ?? 0,
            sceneHeight: scene?.height ?? 0,
            drawerTabs: document.querySelectorAll('.protocol-visual-workspace .visual-drawer-tabs button').length,
            timeRail: Boolean(document.querySelector('.protocol-visual-workspace .visual-time-rail')),
            permanentInspectors: document.querySelectorAll('.tcp-inspector,.dns-inspector,.tls-inspector,.http-inspector').length,
          };
        })(),
      };`);

      if (structural.innerWidth !== profile.width) throw new Error(`${profile.id} viewport width ${structural.innerWidth}; expected ${profile.width}.`);
      if (structural.scrollWidth > structural.innerWidth) throw new Error(`${profile.id} horizontally overflows: ${structural.scrollWidth} > ${structural.innerWidth}.`);
      if (structural.scrollY !== 0) throw new Error(`${profile.id} moved document scrollY to ${structural.scrollY}.`);
      if (!structural.reducedMotion) throw new Error(`${profile.id} did not honor Firefox reduced-motion preference.`);
      if (profile.protocolWorkspace) {
        if (!structural.protocol.active) throw new Error(`${profile.id} did not render a protocol scene inside the shared visual workspace.`);
        if (structural.protocol.sceneWidth < structural.protocol.stageWidth * 0.98 || structural.protocol.sceneHeight < structural.protocol.stageHeight * 0.98) throw new Error(`${profile.id} scene does not occupy the shared visual stage.`);
        if (structural.protocol.drawerTabs < 3 || !structural.protocol.timeRail) throw new Error(`${profile.id} did not expose the expected drawers and Time Rail.`);
        if (structural.protocol.permanentInspectors !== 0) throw new Error(`${profile.id} retained a permanent legacy inspector.`);
      }
      if (profile.stress) {
        for (const [key, value] of Object.entries(profile.stress)) {
          if (structural[key] !== value) throw new Error(`${profile.id} structural ${key}=${structural[key]}; expected ${value}.`);
        }
      }
      if (profile.physical) {
        if (structural.physicalPoints !== 2000) throw new Error(`${profile.id} physical point fixture drifted to ${structural.physicalPoints}.`);
        const rendered = structural.rendererText === 'WEBGL 2' && structural.webglCanvas;
        const fallback = structural.rendererText === 'FALLBACK' && !structural.webglCanvas && /WEBGL 2 UNAVAILABLE/.test(structural.fallbackText ?? '');
        if (!rendered && !fallback) throw new Error(`${profile.id} reached neither valid WebGL nor valid fallback state: ${JSON.stringify(structural)}.`);
      }

      await sleep(50);
      const logEvents = bidi?.events.filter((event) => event.method === 'log.entryAdded' && event.params?.level === 'error') ?? [];
      const unexpectedLogs = profile.physical && structural.rendererText === 'FALLBACK'
        ? logEvents.filter((event) => !/(webgl|renderer|context)/i.test(JSON.stringify(event)))
        : logEvents;
      if (unexpectedLogs.length > 0) throw new Error(`${profile.id} emitted ${unexpectedLogs.length} unexpected Firefox error log event(s).`);

      report.profiles.push({ id: profile.id, viewport: { width: profile.width, height: profile.height }, ...structural, errorLogEvents: logEvents.length });
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

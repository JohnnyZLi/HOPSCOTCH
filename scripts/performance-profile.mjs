import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import net from 'node:net';
import { performance } from 'node:perf_hooks';

const enforce = process.argv.includes('--enforce');
const compatibility = process.argv.includes('--compatibility');
const gpuMode = process.env.HOPSCOTCH_GPU_MODE?.trim() || 'default';
if (!['default', 'swiftshader', 'disabled'].includes(gpuMode)) throw new Error(`Unsupported HOPSCOTCH_GPU_MODE: ${gpuMode}`);
const root = process.cwd();
const distDir = resolve(root, 'dist');
const budgetPath = resolve(root, 'config/performance-budget.json');
const reportPath = resolve(root, process.env.HOPSCOTCH_REPORT_PATH?.trim() || 'artifacts/performance-profile.json');
const measuredFixturePath = resolve(root, 'scripts/fixtures/measured-workspace-v2.json');
const measuredInvalidFixturePath = resolve(root, 'scripts/fixtures/measured-workspace-invalid.json');
const budgetDocument = JSON.parse(readFileSync(budgetPath, 'utf8'));
const budgets = budgetDocument.budgets;
const stressBudgets = budgetDocument.stressBudgets ?? {};
const stressConfig = budgetDocument.stress;

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function executableFromPath(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function findChrome() {
  const explicit = process.env.CHROME_PATH?.trim();
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`CHROME_PATH does not exist: ${explicit}`);
    return explicit;
  }

  const commandCandidates = process.platform === 'win32'
    ? ['chrome', 'msedge']
    : ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'];
  for (const command of commandCandidates) {
    const found = executableFromPath(command);
    if (found) return found;
  }

  const pathCandidates = process.platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ]
    : process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  for (const candidate of pathCandidates) if (existsSync(candidate)) return candidate;
  throw new Error('Chrome/Chromium not found. Set CHROME_PATH to an installed Chrome-compatible browser.');
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

async function waitForDevTools(port, timeoutMs = 12000) {
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
  throw new Error(`Chrome DevTools did not become ready within ${timeoutMs} ms: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}


function chromeGpuArgs(mode) {
  if (mode === 'swiftshader') return ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  if (mode === 'disabled') return ['--disable-webgl', '--disable-webgl2'];
  return [];
}

async function launchChrome(chromePath, maxAttempts = 3) {
  const attempts = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const port = await freePort();
    const userDataDir = mkdtempSync(join(tmpdir(), `hopscotch-perf-${attempt}-`));
    const chromeArgs = [
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
    ];
    chromeArgs.splice(chromeArgs.length - 1, 0, ...chromeGpuArgs(gpuMode));
    const state = { stderr: '', exitCode: null, exitSignal: null, spawnError: null };
    const chrome = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', (chunk) => { state.stderr = `${state.stderr}${chunk}`.slice(-24000); });
    chrome.once('exit', (code, signal) => { state.exitCode = code; state.exitSignal = signal; });
    chrome.once('error', (error) => { state.spawnError = error instanceof Error ? error.message : String(error); });
    try {
      const version = await waitForDevTools(port, 8000);
      return { chrome, port, userDataDir, version, state, attempts, args: chromeArgs };
    } catch (error) {
      await sleep(100);
      if (!chrome.killed) chrome.kill('SIGKILL');
      attempts.push({
        attempt,
        port,
        error: error instanceof Error ? error.message : String(error),
        exitCode: state.exitCode,
        exitSignal: state.exitSignal,
        spawnError: state.spawnError,
        stderrTail: state.stderr || null,
      });
      rmSync(userDataDir, { recursive: true, force: true });
    }
  }
  const launchError = new Error(`Chrome DevTools did not start after ${maxAttempts} attempts.`);
  launchError.launchAttempts = attempts;
  throw launchError;
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 0;
    this.pending = new Map();
    this.events = [];
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolvePromise, reject) => {
      this.socket.addEventListener('open', resolvePromise, { once: true });
      this.socket.addEventListener('error', () => reject(new Error(`Unable to open CDP WebSocket ${url}`)), { once: true });
    });
    this.socket.addEventListener('message', async (message) => {
      const raw = typeof message.data === 'string'
        ? message.data
        : Buffer.from(await message.data.arrayBuffer()).toString('utf8');
      const payload = JSON.parse(raw);
      if (payload.id !== undefined) {
        const waiter = this.pending.get(payload.id);
        if (!waiter) return;
        this.pending.delete(payload.id);
        if (payload.error) waiter.reject(new Error(`${waiter.method}: ${payload.error.message}`));
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

  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime evaluation failed';
      throw new Error(text);
    }
    return result.result?.value;
  }

  clearEvents() {
    this.events.length = 0;
  }

  async close() {
    try { this.socket.close(); } catch { /* noop */ }
  }
}

function readProductionArtifact() {
  const indexPath = join(distDir, 'index.html');
  if (!existsSync(indexPath)) throw new Error('dist/index.html is missing. Run `npm run build` first.');
  let html = readFileSync(indexPath, 'utf8');
  const scriptMatch = html.match(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*><\/script>/i);
  const cssMatch = html.match(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/i);
  if (!scriptMatch || !cssMatch) throw new Error('Unable to resolve generated Vite JS/CSS assets from dist/index.html.');
  const scriptPath = join(distDir, scriptMatch[1].replace(/^\//, ''));
  const cssPath = join(distDir, cssMatch[1].replace(/^\//, ''));
  const script = readFileSync(scriptPath);
  const css = readFileSync(cssPath);
  const scriptText = script.toString('utf8');
  const inlineStyle = `<style>${css.toString('utf8').replaceAll('</style>', '<\\/style>')}</style>`;
  html = html
    .replace(scriptMatch[0], '')
    .replace(cssMatch[0], inlineStyle)
    .replace(/<link\b[^>]*\brel="icon"[^>]*>/i, '');
  return {
    html,
    scriptText,
    bundle: {
      scriptFile: scriptMatch[1],
      styleFile: cssMatch[1],
      jsBytes: script.length,
      jsGzipBytes: gzipSync(script, { level: 9 }).length,
      cssBytes: css.length,
      cssGzipBytes: gzipSync(css, { level: 9 }).length,
    },
  };
}

function query(parameters) {
  const search = new URLSearchParams(parameters);
  return `?${search.toString()}`;
}

const maxModifierSet = 'dns-failure,route-failure,route-leak,server-failure,single-loss,latency-spike,congestion,partition';
const profiles = [
  {
    id: 'max-composed-terminal',
    width: 1440,
    height: 1000,
    reducedMotion: false,
    query: query({ journey: '2', host: 'example.test', transport: 'quic-h3', dns: 'cache-miss', mods: maxModifierSet, t: '999999' }),
    expected: ['DNS FAIL + ROUTE + LEAK + SERVER + LOSS + LATENCY + CONGESTION + PARTITION', 'NO ROUTE', 'NETWORK UNREACHABLE', 'ACTIVE PATH NONE', 'ROUTE CANDIDATES 0'],
  },
  {
    id: 'route-leak-desktop',
    width: 1440,
    height: 1000,
    reducedMotion: false,
    query: query({ journey: '1', host: 'example.test', transport: 'tcp-h2', dns: 'cache-miss', impairment: 'route-leak', t: '4810' }),
    expected: ['POLICY-ANOMALY', 'ACTIVE LOCAL_PREF\n300', 'REACHABLE\nYES', 'POLICY COMPLIANT\nNO', 'DOWN → PEER · LOCAL_PREF 300'],
  },
  {
    id: 'route-leak-mobile',
    width: 390,
    height: 844,
    reducedMotion: false,
    query: query({ journey: '1', host: 'example.test', transport: 'tcp-h2', dns: 'cache-miss', impairment: 'route-leak', t: '4810' }),
    expected: ['POLICY-ANOMALY', 'REACHABLE\nYES', 'POLICY COMPLIANT\nNO'],
    assertMobileGrid: true,
  },
  {
    id: 'route-leak-quic-reduced-motion',
    width: 1440,
    height: 1000,
    reducedMotion: true,
    query: query({ journey: '1', host: 'example.test', transport: 'quic-h3', dns: 'cache-hit', impairment: 'route-leak', t: '3120' }),
    expected: ['QUIC + H3', 'POLICY-RESTORED', 'ACTIVE LOCAL_PREF\n200', 'REACHABLE\nYES', 'POLICY COMPLIANT\nYES'],
  },
];

profiles.push(
  { id: 'stress-as-canvas', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'as-density' }), readySelector: '.internet-scale', expected: ['POLICY MAKES', 'SIMULATED WINNER'], stressExpected: { profile: 'as-density', asNodes: 160, asRelationships: 220 } },
  { id: 'stress-builder-ceiling', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'builder-density' }), readySelector: '.builder-workspace', expected: ['32 NODES · 96 LINKS', 'ROUTE INSTALLED'], stressExpected: { profile: 'builder-density', builderNodes: 32, builderLinks: 96 } },
  { id: 'stress-physical-webgl', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'physical-density' }), readySelector: '.physical-globe', expected: gpuMode === 'disabled' ? ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'FALLBACK', 'WEBGL 2 UNAVAILABLE'] : ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'WEBGL 2'], stressExpected: { profile: 'physical-density', physicalPoints: 2000, webgl: gpuMode !== 'disabled' }, allowExpectedWebglFailure: gpuMode === 'disabled' },
);

if (compatibility) profiles.push(
  { id: 'measured-workspace-desktop', width: 1440, height: 1000, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine', 'NOT PROMOTED TO LOCAL MEASURED'] },
  { id: 'measured-workspace-mobile', width: 390, height: 844, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine'], assertMeasuredMobile: true },
  { id: 'measured-workspace-reduced-motion', width: 1280, height: 900, reducedMotion: true, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine'] },
  { id: 'measured-sidecars-desktop', width: 1440, height: 1000, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredSidecars: true, expected: ['ONE REQUEST.', 'BREAK THE PATH.'] },
  { id: 'measured-sidecars-mobile', width: 390, height: 844, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredSidecars: true, expected: ['ONE REQUEST.', 'BREAK THE PATH.'] },
  { id: 'measured-sidecars-reduced-motion', width: 1280, height: 900, reducedMotion: true, query: '', readySelector: '.overview-scene', measuredSidecars: true, expected: ['ONE REQUEST.', 'BREAK THE PATH.'] },
);

async function waitForExpression(cdp, expression, timeoutMs = 5000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await cdp.evaluate(expression)) return;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

async function setFileInput(cdp, selector, filePath) {
  const document = await cdp.call('DOM.getDocument', { depth: 1 });
  const result = await cdp.call('DOM.querySelector', { nodeId: document.root.nodeId, selector });
  if (!result.nodeId) throw new Error(`Unable to find file input ${selector}.`);
  await cdp.call('DOM.setFileInputFiles', { nodeId: result.nodeId, files: [filePath] });
}

async function exerciseLoopbackBridgeWorkspace(cdp, profile) {
  const bridgeReport = JSON.parse(readFileSync(measuredFixturePath, 'utf8'));
  const handshake = {
    schema: 'hopscotch.network-diagnostics-bridge',
    version: 1,
    application: 'Network Diagnostics Suite',
    reportSchemaVersion: '2.0',
    reportPath: '/api/hopscotch/v1/report',
    bridgeVersion: '0.1.0-ci',
    capabilities: ['report-v2'],
  };

  await cdp.evaluate(`(()=>{
    const handshake=${JSON.stringify(handshake)};
    const report=${JSON.stringify(bridgeReport)};
    const originalFetch=globalThis.fetch;
    const mock={mode:'network-error',calls:[],handshake,report,originalFetch};
    globalThis.__hopscotchBridgeMock=mock;
    globalThis.fetch=async(input,init={})=>{
      const url=typeof input==='string'?input:(input?.url??String(input));
      mock.calls.push({url,method:init.method??null,mode:init.mode??null,credentials:init.credentials??null,cache:init.cache??null,redirect:init.redirect??null});
      if(mock.mode==='network-error')throw new TypeError('Failed to fetch');
      if(url.endsWith('/api/hopscotch/v1/handshake')){
        const body=mock.mode==='bad-handshake'?{...handshake,schema:'wrong.bridge'}:handshake;
        return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
      }
      if(url.endsWith('/api/hopscotch/v1/report')){
        const body=mock.mode==='invalid-report'?{schemaVersion:'99.0'}:report;
        return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
      }
      throw new Error('Unexpected bridge URL: '+url);
    };
    return true;
  })()`);

  const setOrigin = async (value) => {
    const changed = await cdp.evaluate(`(()=>{
      const input=document.querySelector('.measured-bridge-origin input');
      if(!input)return false;
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
      setter?.call(input,${JSON.stringify(value)});
      input.dispatchEvent(new Event('input',{bubbles:true}));
      return true;
    })()`);
    if (!changed) throw new Error(`${profile.id} could not set the loopback bridge origin.`);
  };

  const setMode = async (mode) => cdp.evaluate(`(()=>{globalThis.__hopscotchBridgeMock.mode=${JSON.stringify(mode)};return true})()`);
  const callCount = async () => cdp.evaluate(`globalThis.__hopscotchBridgeMock.calls.length`);
  const workspaceState = async () => cdp.evaluate(`(()=>({
    status:document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')??null,
    measured:document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')??null,
    text:document.querySelector('.measured-workspace')?.innerText??'',
    innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    scrollY,
  }))()`);
  const assertViewport = async (label) => {
    const state = await workspaceState();
    if (state.scrollWidth > state.innerWidth) throw new Error(`${profile.id} ${label} horizontally overflows: ${state.scrollWidth} > ${state.innerWidth}.`);
    if (state.scrollY !== 0) throw new Error(`${profile.id} ${label} moved document scrollY to ${state.scrollY}.`);
    return state;
  };

  await setOrigin('http://192.168.1.50:8765');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'CONNECT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')==='unavailable'`, 8000);
  if (await callCount() !== 0) throw new Error(`${profile.id} non-loopback input reached fetch instead of failing before network access.`);
  let state = await assertViewport('private-LAN rejection');
  if (state.measured !== 'false') throw new Error(`${profile.id} private-LAN rejection changed measured state.`);

  await setOrigin('http://127.0.0.1:8765');
  await setMode('network-error');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'CONNECT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')==='unavailable'`, 8000);
  if (await callCount() !== 1) throw new Error(`${profile.id} network-error connect did not perform exactly one handshake attempt.`);
  state = await assertViewport('network-error bridge');
  if (state.measured !== 'false') throw new Error(`${profile.id} network-error connect changed measured state.`);

  await setMode('bad-handshake');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'CONNECT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')==='rejected'`, 8000);
  if (await callCount() !== 2) throw new Error(`${profile.id} bad-handshake connect did not perform exactly one request.`);
  state = await assertViewport('bad-handshake bridge');
  if (state.measured !== 'false') throw new Error(`${profile.id} rejected handshake changed measured state.`);

  await setMode('good');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'CONNECT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')==='connected'`, 8000);
  if (await callCount() !== 3) throw new Error(`${profile.id} successful Connect performed more than the one handshake request.`);
  state = await assertViewport('connected bridge');
  if (state.measured !== 'false') throw new Error(`${profile.id} Connect created measured truth before Refresh Report.`);
  if (!state.text.includes('Network Diagnostics Suite') || !state.text.includes('0.1.0-ci')) throw new Error(`${profile.id} did not show validated bridge identity/version after Connect.`);

  await measuredClickButton(cdp, '.measured-bridge-actions button', 'REFRESH REPORT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await waitForExpression(cdp, `document.body.innerText.includes('Network Diagnostics Engine')`, 8000);
  if (await callCount() !== 4) throw new Error(`${profile.id} first Refresh Report did not perform exactly one report request.`);
  state = await assertViewport('valid bridge refresh');
  if (state.status !== 'connected') throw new Error(`${profile.id} valid report refresh changed bridge connection state.`);
  if (!state.text.includes('LOCAL BRIDGE · REPORT V2')) throw new Error(`${profile.id} valid bridge refresh was not identified as the local bridge report.`);

  await setMode('invalid-report');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'REFRESH REPORT');
  await waitForExpression(cdp, `document.body.innerText.includes('PREVIOUS VALID MEASUREMENT REMAINS ACTIVE.')`, 8000);
  if (await callCount() !== 5) throw new Error(`${profile.id} invalid report refresh did not perform exactly one request.`);
  state = await assertViewport('invalid bridge refresh');
  if (state.status !== 'connected' || state.measured !== 'true') throw new Error(`${profile.id} invalid report refresh discarded connection or previous valid measurement.`);
  if (!state.text.includes('Network Diagnostics Engine')) throw new Error(`${profile.id} invalid report refresh lost the previous valid report.`);

  await measuredClickButton(cdp, '.measured-heading-actions button', 'CLEAR');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='false'`, 8000);
  state = await assertViewport('clear while connected');
  if (state.status !== 'connected') throw new Error(`${profile.id} Clear silently disconnected the bridge.`);

  await setMode('good');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'REFRESH REPORT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  if (await callCount() !== 6) throw new Error(`${profile.id} re-refresh after Clear did not issue exactly one report request.`);
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'DISCONNECT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')==='disconnected'`, 8000);
  state = await assertViewport('disconnect with measured report');
  if (state.measured !== 'true') throw new Error(`${profile.id} Disconnect erased the last valid measured report.`);

  await measuredClickButton(cdp, '.measured-heading-actions button', 'CLEAR');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='false'`, 8000);
  state = await assertViewport('bridge flow reset');
  if (state.status !== 'disconnected') throw new Error(`${profile.id} Clear mutated disconnected bridge state.`);

  const requests = await cdp.evaluate(`globalThis.__hopscotchBridgeMock.calls`);
  for (const request of requests) {
    if (!request.url.endsWith('/api/hopscotch/v1/handshake') && !request.url.endsWith('/api/hopscotch/v1/report')) {
      throw new Error(`${profile.id} bridge browser flow used an unexpected URL: ${request.url}`);
    }
    if (request.credentials !== 'omit' || request.mode !== 'cors' || request.cache !== 'no-store' || request.redirect !== 'error') {
      throw new Error(`${profile.id} bridge browser request lost bounded CORS/no-credential/no-cache/no-redirect options.`);
    }
  }

  await cdp.evaluate(`(()=>{const mock=globalThis.__hopscotchBridgeMock;if(mock?.originalFetch)globalThis.fetch=mock.originalFetch;delete globalThis.__hopscotchBridgeMock;return true})()`);
  return {
    privateLanRejectedBeforeFetch: true,
    networkFailureSurfaced: true,
    badHandshakeRejected: true,
    connectDidNotMeasure: true,
    validRefreshLoaded: true,
    invalidRefreshPreservedPrevious: true,
    clearKeptConnection: true,
    disconnectKeptMeasurement: true,
    requestCount: requests.length,
  };
}

async function exerciseMeasuredWorkspace(cdp, profile) {
  const opened = await cdp.evaluate(`(()=>{
    const button=[...document.querySelectorAll('button')].find((candidate)=>candidate.textContent?.trim()==='Inspect measured report');
    if(!button)return false;
    button.click();
    return true;
  })()`);
  if (!opened) throw new Error(`${profile.id} could not find the measured workspace entry point.`);
  await waitForExpression(cdp, `Boolean(document.querySelector('.measured-workspace'))`);
  await waitForExpression(cdp, `document.body.innerText.includes('NO LOCAL MEASUREMENT LOADED')`);

  const bridgeInteraction = await exerciseLoopbackBridgeWorkspace(cdp, profile);

  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await waitForExpression(cdp, `document.body.innerText.includes('Network Diagnostics Engine') && document.querySelectorAll('.measured-target-selector button').length > 1`, 8000);
  const selectedThroughput = await cdp.evaluate(`(()=>{
    const button=[...document.querySelectorAll('.measured-target-selector button')].find((candidate)=>candidate.textContent?.includes('speed.example.test'));
    if(!button)return false;
    button.click();
    return true;
  })()`);
  if (!selectedThroughput) throw new Error(`${profile.id} could not select the transfer target scope.`);
  await waitForExpression(cdp, `document.body.innerText.includes('500 Mbps')`, 8000);
  const loaded = await cdp.evaluate(`(()=>({
    text:document.body.innerText,
    innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    scrollY,
    factCount:document.querySelectorAll('.measured-fact').length,
    categoryCount:document.querySelectorAll('.measured-categories button').length,
    loaded:document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded'),
  }))()`);
  if (loaded.scrollWidth > loaded.innerWidth) throw new Error(`${profile.id} measured workspace overflows after valid import: ${loaded.scrollWidth} > ${loaded.innerWidth}.`);
  if (loaded.scrollY !== 0) throw new Error(`${profile.id} measured workspace moved document scrollY to ${loaded.scrollY}.`);
  if (loaded.categoryCount !== 7) throw new Error(`${profile.id} expected 7 measured categories, found ${loaded.categoryCount}.`);
  if (loaded.factCount <= 0) throw new Error(`${profile.id} rendered no measured facts after valid import.`);
  for (const forbidden of ['DERIVED FINDING MUST NOT BECOME A FACT','BROWSER EDGE MUST NOT BECOME A FACT','UNKNOWN FIELD MUST NOT BECOME A FACT']) {
    if (loaded.text.includes(forbidden)) throw new Error(`${profile.id} leaked excluded report content into the visible measured workspace: ${forbidden}`);
  }

  await setFileInput(cdp, '.measured-file-input', measuredInvalidFixturePath);
  await waitForExpression(cdp, `document.body.innerText.includes('IMPORT REJECTED')`, 8000);
  const rejected = await cdp.evaluate(`(()=>({
    loaded:document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded'),
    text:document.body.innerText,
  }))()`);
  if (rejected.loaded !== 'true') throw new Error(`${profile.id} invalid replacement cleared the previous valid measured state.`);
  if (!rejected.text.includes('THE PREVIOUS VALID REPORT REMAINS ACTIVE.')) throw new Error(`${profile.id} did not preserve/restate previous-valid-report behavior.`);
  if (!rejected.text.includes('Network Diagnostics Engine')) throw new Error(`${profile.id} lost the previous valid report after a rejected replacement.`);

  const cleared = await cdp.evaluate(`(()=>{
    const button=document.querySelector('.measured-clear');
    if(!button)return false;
    button.click();
    return true;
  })()`);
  if (!cleared) throw new Error(`${profile.id} could not find the measured Clear action.`);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='false'`);
  await waitForExpression(cdp, `document.body.innerText.includes('NO LOCAL MEASUREMENT LOADED')`);

  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await waitForExpression(cdp, `document.body.innerText.includes('Network Diagnostics Engine')`, 8000);
  return {
    bridge: bridgeInteraction,
    validFactCount: loaded.factCount,
    categoryCount: loaded.categoryCount,
    targetScopeSelectionVerified: true,
    rejectedReplacementPreserved: true,
    clearReturnedToEmpty: true,
  };
}

async function measuredClickButton(cdp, selector, text) {
  const clicked = await cdp.evaluate(`(()=>{
    const button=[...document.querySelectorAll(${JSON.stringify(selector)})].find((candidate)=>candidate.textContent?.includes(${JSON.stringify(text)}));
    if(!button)return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Unable to click ${selector} containing ${JSON.stringify(text)}.`);
}

async function measuredViewportState(cdp) {
  return cdp.evaluate(`(()=>({
    innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    scrollY,
    sidecar:document.querySelector('.journey-measured-sidecar')?.innerText ?? null,
    compatibility:document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility') ?? null,
    scene:document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-scene') ?? null,
    activeEvent:document.querySelector('.journey-event.current strong')?.textContent ?? null,
  }))()`);
}

function assertMeasuredViewport(profile, state, label) {
  if (state.scrollWidth > state.innerWidth) throw new Error(`${profile.id} ${label} horizontally overflows: ${state.scrollWidth} > ${state.innerWidth}.`);
  if (state.scrollY !== 0) throw new Error(`${profile.id} ${label} moved document scrollY to ${state.scrollY}.`);
}

async function exerciseMeasuredJourneySidecars(cdp, profile) {
  await measuredClickButton(cdp, 'button', 'Inspect measured report');
  await waitForExpression(cdp, `Boolean(document.querySelector('.measured-workspace'))`);
  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await measuredClickButton(cdp, '.measured-heading-actions button', 'EXIT LAB');
  await waitForExpression(cdp, `Boolean(document.querySelector('.overview-scene'))`);
  await measuredClickButton(cdp, 'button', 'Play URL journey');
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-workspace'))`, 8000);

  await measuredClickButton(cdp, '.journey-event', 'Default gateway selected');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='local-context'`, 8000);
  const routing = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, routing, 'routing sidecar');
  if (routing.scene !== 'routing' || routing.activeEvent !== 'Default gateway selected') throw new Error(`${profile.id} did not bind LOCAL CONTEXT to the routing phase.`);
  if (!routing.sidecar?.includes('LOCAL MEASURED') || !routing.sidecar.includes('LOCAL CONTEXT') || !routing.sidecar.includes('SIMULATED STORY UNCHANGED')) throw new Error(`${profile.id} routing sidecar lost provenance/boundary language.`);

  await measuredClickButton(cdp, '.journey-event', 'Stub asks recursive resolver');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='matched-target'`, 8000);
  const dns = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, dns, 'DNS sidecar');
  if (dns.scene !== 'dns' || !dns.sidecar?.includes('MATCHED TARGET') || !dns.sidecar.includes('8 ms')) throw new Error(`${profile.id} DNS sidecar did not expose exact-target measured DNS context.`);

  await measuredClickButton(cdp, '.journey-event', 'TCP connection established');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='matched-target'`, 8000);
  const transport = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, transport, 'transport sidecar');
  if (transport.scene !== 'transport' || !transport.sidecar?.includes('MATCHED TARGET')) throw new Error(`${profile.id} transport sidecar did not expose exact-target context.`);
  if (transport.sidecar.includes('500 Mbps')) throw new Error(`${profile.id} leaked other-target speed-test throughput into matched Journey transport evidence.`);
  if (!transport.sidecar.includes('OTHER-TARGET FACT')) throw new Error(`${profile.id} did not disclose that other-target transport facts were hidden.`);

  const changedHost = await cdp.evaluate(`(()=>{
    const input=document.querySelector('.journey-config input');
    const form=document.querySelector('.journey-config');
    if(!input||!form)return false;
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    setter?.call(input,'other.test');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    form.requestSubmit();
    return true;
  })()`);
  if (!changedHost) throw new Error(`${profile.id} could not change Journey hostname for mismatch validation.`);
  await waitForExpression(cdp, `document.querySelector('.journey-config input')?.value==='other.test'`, 8000);
  await measuredClickButton(cdp, '.journey-event', 'TCP connection established');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='other-target'`, 8000);
  const mismatch = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, mismatch, 'mismatched transport sidecar');
  if (!mismatch.sidecar?.includes('NO COMPATIBLE TRANSPORT TARGET') || !mismatch.sidecar.includes('OTHER TARGET')) throw new Error(`${profile.id} mismatched target did not fail closed visibly.`);
  if (mismatch.sidecar.includes('500 Mbps') || mismatch.sidecar.includes('24 ms') || mismatch.sidecar.includes('17 ms')) throw new Error(`${profile.id} rendered mismatched measured values as Journey evidence.`);

  await measuredClickButton(cdp, '.journey-heading-actions button', 'EXIT JOURNEY');
  await waitForExpression(cdp, `Boolean(document.querySelector('.overview-scene'))`);
  await measuredClickButton(cdp, 'button', 'Inspect measured report');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await measuredClickButton(cdp, '.measured-clear', 'CLEAR');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='false'`, 8000);
  await measuredClickButton(cdp, '.measured-heading-actions button', 'EXIT LAB');
  await waitForExpression(cdp, `Boolean(document.querySelector('.overview-scene'))`);
  await measuredClickButton(cdp, 'button', 'Play URL journey');
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-workspace'))`, 8000);
  await measuredClickButton(cdp, '.journey-event', 'Default gateway selected');
  await sleep(120);
  if (await cdp.evaluate(`Boolean(document.querySelector('.journey-measured-sidecar'))`)) throw new Error(`${profile.id} measured sidecar survived explicit Lab 09 Clear.`);
  const cleared = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, cleared, 'cleared Journey');

  return {
    routingCompatibility: routing.compatibility,
    dnsCompatibility: dns.compatibility,
    transportCompatibility: transport.compatibility,
    mismatchCompatibility: mismatch.compatibility,
    otherTargetValuesHidden: true,
    clearRemovedSidecars: true,
  };
}

async function loadProfile(cdp, artifact, profile) {
  cdp.clearEvents();
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: profile.width,
    height: profile.height,
    deviceScaleFactor: 1,
    mobile: profile.width <= 520,
  });
  await cdp.call('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: profile.reducedMotion ? 'reduce' : 'no-preference' }],
  });
  await cdp.call('Page.navigate', { url: `about:blank${profile.query}` });
  await sleep(50);
  const frameTree = await cdp.call('Page.getFrameTree');
  const frameId = frameTree.frameTree.frame.id;
  const startedAt = performance.now();
  await cdp.call('Page.setDocumentContent', { frameId, html: artifact.html });
  await cdp.evaluate(`(()=>{try{sessionStorage.setItem('__hopscotch_perf__','1');sessionStorage.removeItem('__hopscotch_perf__')}catch{const values=new Map();Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()}})}})()`);
  await cdp.evaluate(artifact.scriptText);
  await waitForExpression(cdp, `Boolean(document.querySelector(${JSON.stringify(profile.readySelector ?? '.journey-workspace')}))`);
  await sleep(550);
  const measuredInteraction = profile.measuredWorkspace
    ? await exerciseMeasuredWorkspace(cdp, profile)
    : profile.measuredSidecars
      ? await exerciseMeasuredJourneySidecars(cdp, profile)
      : null;
  const readyMs = performance.now() - startedAt;
  const bodyText = await cdp.evaluate('document.body.innerText');
  for (const expected of profile.expected) {
    if (!bodyText.includes(expected)) throw new Error(`${profile.id} did not reach expected semantic text: ${JSON.stringify(expected)}`);
  }
  if (profile.reducedMotion && !(await cdp.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'))) {
    throw new Error(`${profile.id} did not enable reduced motion.`);
  }

  await cdp.call('HeapProfiler.collectGarbage');
  const heap = await cdp.call('Runtime.getHeapUsage');
  const performanceMetrics = Object.fromEntries((await cdp.call('Performance.getMetrics')).metrics.map((metric) => [metric.name, metric.value]));
  const structural = await cdp.evaluate(`(()=>{
    const controls=[...document.querySelectorAll('.journey-modifier-profile button')].map((button,index)=>{const rect=button.getBoundingClientRect();return {index:index+1,text:button.innerText,x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)}});
    return {
      elementCount: document.getElementsByTagName('*').length,
      eventCount: document.querySelectorAll('.journey-event').length,
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollY,
      modifierControls: controls,
      heading: document.querySelector('.journey-heading-actions > span')?.innerText ?? null,
      measured: {
        loaded: document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded') ?? null,
        categoryButtons: document.querySelectorAll('.measured-categories button').length,
        visibleFacts: document.querySelectorAll('.measured-fact').length,
      },
      stress: {
        profile: document.querySelector('[data-stress-profile]')?.getAttribute('data-stress-profile') ?? null,
        asNodes: Number(document.querySelector('.internet-scale')?.getAttribute('data-node-count') ?? 0),
        asRelationships: Number(document.querySelector('.internet-scale')?.getAttribute('data-relationship-count') ?? 0),
        builderNodes: Number(document.querySelector('.builder-workspace')?.getAttribute('data-node-count') ?? 0),
        builderLinks: Number(document.querySelector('.builder-workspace')?.getAttribute('data-link-count') ?? 0),
        physicalPoints: Number(document.querySelector('.physical-globe')?.getAttribute('data-point-count') ?? 0),
        webgl: Boolean(document.querySelector('.globe-render-host canvas')),
        canvasBackingWidth: document.querySelector('.internet-scale canvas,.globe-render-host canvas')?.width ?? 0,
        canvasBackingHeight: document.querySelector('.internet-scale canvas,.globe-render-host canvas')?.height ?? 0,
      },
    };
  })()`);

  if (structural.scrollWidth > structural.innerWidth) throw new Error(`${profile.id} horizontally overflows: ${structural.scrollWidth} > ${structural.innerWidth}`);
  if (structural.scrollY !== 0) throw new Error(`${profile.id} unexpectedly moved document scrollY to ${structural.scrollY}.`);

  if (profile.stressExpected) {
    for (const [key, value] of Object.entries(profile.stressExpected)) {
      if (structural.stress[key] !== value) throw new Error(`${profile.id} stress invariant ${key}=${JSON.stringify(structural.stress[key])}; expected ${JSON.stringify(value)}.`);
    }
    if ((structural.stress.asNodes > 0 || structural.stress.webgl) && (structural.stress.canvasBackingWidth <= 0 || structural.stress.canvasBackingHeight <= 0)) throw new Error(`${profile.id} renderer canvas has invalid backing dimensions.`);
  }

  if (profile.assertMeasuredMobile) {
    if (structural.measured.loaded !== 'true') throw new Error(`${profile.id} mobile measured workspace did not remain loaded.`);
    if (structural.measured.categoryButtons !== 7) throw new Error(`${profile.id} mobile measured category count ${structural.measured.categoryButtons}; expected 7.`);
    if (structural.measured.visibleFacts <= 0) throw new Error(`${profile.id} mobile measured workspace rendered no facts.`);
  }

  if (profile.assertMobileGrid) {
    if (structural.modifierControls.length !== 10) throw new Error(`Expected 10 GOD MODE controls, found ${structural.modifierControls.length}.`);
    const rows = new Map();
    for (const button of structural.modifierControls) {
      const row = rows.get(button.y) ?? [];
      row.push(button);
      rows.set(button.y, row);
    }
    const rowSizes = [...rows.values()].map((row) => row.length).sort((a, b) => a - b);
    if (JSON.stringify(rowSizes) !== JSON.stringify([2, 4, 4])) throw new Error(`Unexpected mobile GOD MODE rows: ${JSON.stringify(rowSizes)}`);
    const finalRow = [...rows.entries()].sort((a, b) => a[0] - b[0]).at(-1)[1];
    if (finalRow.map((button) => button.text).join('|') !== 'PARTITION|LEAK') throw new Error(`Unexpected final mobile row: ${finalRow.map((button) => button.text).join('|')}`);
  }

  const pageErrors = cdp.events.filter((event) =>
    event.method === 'Runtime.exceptionThrown'
    || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
    || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error'));
  const unexpectedPageErrors = profile.allowExpectedWebglFailure
    ? pageErrors.filter((event) => !/(webgl|webglrenderer|context)/i.test(JSON.stringify(event)))
    : pageErrors;
  if (unexpectedPageErrors.length > 0) throw new Error(`${profile.id} emitted ${unexpectedPageErrors.length} unexpected runtime/console error event(s).`);

  return {
    id: profile.id,
    viewport: { width: profile.width, height: profile.height },
    reducedMotion: profile.reducedMotion,
    readyMs: Number(readyMs.toFixed(2)),
    elementCount: structural.elementCount,
    eventCount: structural.eventCount,
    scrollWidth: structural.scrollWidth,
    innerWidth: structural.innerWidth,
    scrollY: structural.scrollY,
    modifierControls: structural.modifierControls.length,
    heading: structural.heading,
    stress: structural.stress,
    measured: measuredInteraction,
    heapUsedBytes: heap.usedSize,
    diagnostic: {
      scriptDurationSeconds: performanceMetrics.ScriptDuration ?? null,
      layoutDurationSeconds: performanceMetrics.LayoutDuration ?? null,
      recalcStyleDurationSeconds: performanceMetrics.RecalcStyleDuration ?? null,
      taskDurationSeconds: performanceMetrics.TaskDuration ?? null,
    },
  };
}

async function seekStress(cdp, artifact, cycles = stressConfig.seekCycles, id = 'max-composed-seek-stress') {
  const profile = {
    id,
    width: 1440,
    height: 1000,
    reducedMotion: false,
    query: query({ journey: '2', host: 'example.test', transport: 'quic-h3', dns: 'cache-miss', mods: maxModifierSet, t: '0' }),
    expected: ['DNS FAIL + ROUTE + LEAK + SERVER + LOSS + LATENCY + CONGESTION + PARTITION'],
  };
  await loadProfile(cdp, artifact, profile);
  await cdp.call('HeapProfiler.collectGarbage');
  const before = await cdp.call('Runtime.getHeapUsage');
  const beforeState = await cdp.evaluate(`(()=>({
    eventCount:document.querySelectorAll('.journey-event').length,
    heading:document.querySelector('.journey-heading-actions > span')?.innerText ?? null,
    scrollY,
    elementCount:document.getElementsByTagName('*').length,
  }))()`);
  const startedAt = performance.now();
  const stressResult = await cdp.evaluate(`(async()=>{
    const cycles=${Number(cycles)};
    const buttons=[...document.querySelectorAll('.journey-event')];
    for(let cycle=0;cycle<cycles;cycle+=1){
      for(const button of buttons){
        button.click();
        await new Promise((resolve)=>requestAnimationFrame(()=>resolve()));
      }
    }
    await new Promise((resolve)=>setTimeout(resolve,${Number(stressConfig.settleMs)}));
    return {
      eventCount:document.querySelectorAll('.journey-event').length,
      heading:document.querySelector('.journey-heading-actions > span')?.innerText ?? null,
      scrollY,
      elementCount:document.getElementsByTagName('*').length,
    };
  })()`);
  const elapsedMs = performance.now() - startedAt;
  await cdp.call('HeapProfiler.collectGarbage');
  const after = await cdp.call('Runtime.getHeapUsage');
  if (stressResult.eventCount !== beforeState.eventCount) throw new Error(`Seek stress mutated event count ${beforeState.eventCount} → ${stressResult.eventCount}.`);
  if (stressResult.heading !== beforeState.heading) throw new Error('Seek stress mutated canonical scenario identity/heading.');
  if (stressResult.scrollY !== 0) throw new Error(`Seek stress moved document scrollY to ${stressResult.scrollY}.`);
  return {
    cycles,
    eventsPerCycle: beforeState.eventCount,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    beforeHeapUsedBytes: before.usedSize,
    afterHeapUsedBytes: after.usedSize,
    heapGrowthBytes: after.usedSize - before.usedSize,
    finalElementCount: stressResult.elementCount,
    scrollY: stressResult.scrollY,
  };
}

function addBudgetFailure(failures, condition, message) {
  if (!condition) failures.push(message);
}

async function main() {
  if (typeof WebSocket === 'undefined') throw new Error('Node 24 WebSocket support is required.');
  const artifact = readProductionArtifact();
  const chromePath = findChrome();
  let launch = null;
  let cdp = null;
  const report = {
    schema: 'hopscotch.performance-profile',
    version: 1,
    generatedAt: new Date().toISOString(),
    enforce,
    compatibility,
    gpuMode,
    budgetDocument,
    browser: { path: chromePath },
    bundle: artifact.bundle,
    profiles: [],
    seekStress: null,
    highDensitySeekStress: null,
    failures: [],
  };

  try {
    launch = await launchChrome(chromePath);
    report.browser.version = launch.version.Browser ?? null;
    report.browser.launchAttempts = launch.attempts;
    report.browser.args = launch.args;
    const targets = await fetchJson(`http://127.0.0.1:${launch.port}/json`);
    const page = targets.find((target) => target.type === 'page');
    if (!page?.webSocketDebuggerUrl) throw new Error('Chrome did not expose a page CDP target.');
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('DOM.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Log.enable');
    await cdp.call('Performance.enable');
    await cdp.call('HeapProfiler.enable');

    for (const profile of profiles) report.profiles.push(await loadProfile(cdp, artifact, profile));
    if (!compatibility) {
      report.seekStress = await seekStress(cdp, artifact);
      report.highDensitySeekStress = await seekStress(cdp, artifact, stressBudgets.highDensitySeek?.cycles ?? 12, 'high-density-seek-stress');

    addBudgetFailure(report.failures, artifact.bundle.jsGzipBytes <= budgets.maxJsGzipBytes, `JS gzip ${artifact.bundle.jsGzipBytes} exceeds ${budgets.maxJsGzipBytes}.`);
    addBudgetFailure(report.failures, artifact.bundle.cssGzipBytes <= budgets.maxCssGzipBytes, `CSS gzip ${artifact.bundle.cssGzipBytes} exceeds ${budgets.maxCssGzipBytes}.`);
    for (const profile of report.profiles) {
      const stressProfileId = profile.stress?.profile;
      if (stressProfileId) {
        const stressBudget = stressBudgets[stressProfileId];
        addBudgetFailure(report.failures, Boolean(stressBudget), `${profile.id} is missing a versioned stress budget.`);
        if (stressBudget) {
          addBudgetFailure(report.failures, profile.elementCount <= stressBudget.maxDomElements, `${profile.id} DOM ${profile.elementCount} exceeds stress budget ${stressBudget.maxDomElements}.`);
          addBudgetFailure(report.failures, profile.heapUsedBytes <= stressBudget.maxHeapUsedBytes, `${profile.id} heap ${profile.heapUsedBytes} exceeds stress budget ${stressBudget.maxHeapUsedBytes}.`);
        }
        continue;
      }
      addBudgetFailure(report.failures, profile.elementCount <= budgets.maxDomElements, `${profile.id} DOM ${profile.elementCount} exceeds ${budgets.maxDomElements}.`);
      addBudgetFailure(report.failures, profile.heapUsedBytes <= budgets.maxHeapUsedBytes, `${profile.id} heap ${profile.heapUsedBytes} exceeds ${budgets.maxHeapUsedBytes}.`);
    }
    addBudgetFailure(report.failures, report.seekStress.finalElementCount <= budgets.maxDomElements, `seek stress DOM ${report.seekStress.finalElementCount} exceeds ${budgets.maxDomElements}.`);
    addBudgetFailure(report.failures, report.seekStress.heapGrowthBytes <= budgets.maxHeapGrowthBytes, `seek stress heap growth ${report.seekStress.heapGrowthBytes} exceeds ${budgets.maxHeapGrowthBytes}.`);
    const highDensitySeekBudget = stressBudgets.highDensitySeek;
    addBudgetFailure(report.failures, Boolean(highDensitySeekBudget), 'High-density seek stress is missing a versioned stress budget.');
    if (highDensitySeekBudget) {
      addBudgetFailure(report.failures, report.highDensitySeekStress.cycles === highDensitySeekBudget.cycles, `high-density seek cycles ${report.highDensitySeekStress.cycles} do not match budget contract ${highDensitySeekBudget.cycles}.`);
      addBudgetFailure(report.failures, report.highDensitySeekStress.eventsPerCycle === highDensitySeekBudget.eventsPerCycle, `high-density seek event count ${report.highDensitySeekStress.eventsPerCycle} does not match budget contract ${highDensitySeekBudget.eventsPerCycle}.`);
      addBudgetFailure(report.failures, report.highDensitySeekStress.heapGrowthBytes <= highDensitySeekBudget.maxHeapGrowthBytes, `high-density seek heap growth ${report.highDensitySeekStress.heapGrowthBytes} exceeds stress budget ${highDensitySeekBudget.maxHeapGrowthBytes}.`);
    }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'launchAttempts' in error) report.browser.launchAttempts = error.launchAttempts;
    report.fatalError = error instanceof Error ? error.stack ?? error.message : String(error);
  } finally {
    if (cdp) {
      try { await cdp.call('Browser.close'); } catch { /* noop */ }
      await cdp.close();
    }
    if (launch?.chrome && !launch.chrome.killed) launch.chrome.kill('SIGKILL');
    if (launch?.userDataDir) rmSync(launch.userDataDir, { recursive: true, force: true });
    report.browser.stderrTail = launch?.state.stderr || null;
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(`HOPSCOTCH production ${compatibility ? 'compatibility' : 'performance'} profile (${report.browser.version ?? 'browser unknown'})`);
  console.log(`GPU mode: ${gpuMode}`);
  console.log(`Bundle: JS ${report.bundle.jsGzipBytes} gzip bytes · CSS ${report.bundle.cssGzipBytes} gzip bytes`);
  for (const profile of report.profiles) {
    console.log(`${profile.id}: DOM ${profile.elementCount} · heap ${(profile.heapUsedBytes / 1048576).toFixed(2)} MiB · ready ${profile.readyMs.toFixed(0)} ms · events ${profile.eventCount}`);
  }
  if (report.seekStress) {
    console.log(`seek stress: ${report.seekStress.cycles} × ${report.seekStress.eventsPerCycle} events · heap growth ${(report.seekStress.heapGrowthBytes / 1048576).toFixed(2)} MiB · ${report.seekStress.elapsedMs.toFixed(0)} ms diagnostic`);
  }
  if (report.highDensitySeekStress) {
    console.log(`high-density seek stress: ${report.highDensitySeekStress.cycles} × ${report.highDensitySeekStress.eventsPerCycle} events · heap growth ${(report.highDensitySeekStress.heapGrowthBytes / 1048576).toFixed(2)} MiB · ${report.highDensitySeekStress.elapsedMs.toFixed(0)} ms diagnostic`);
  }
  console.log(`Report: ${reportPath}`);
  if (report.fatalError) {
    console.error(report.fatalError);
    process.exitCode = 1;
  } else if (report.failures.length > 0) {
    console.error('Performance budget violations:');
    for (const failure of report.failures) console.error(`- ${failure}`);
    if (enforce) process.exitCode = 1;
  } else {
    console.log(compatibility ? `Compatibility semantic profile passed for GPU mode ${gpuMode}.` : 'Stable performance and high-density stress budgets passed.');
  }
}

await main();

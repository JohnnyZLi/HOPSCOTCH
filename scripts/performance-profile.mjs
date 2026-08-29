import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { serveProductionArtifact } from './production-artifact-server.mjs';

const enforce = process.argv.includes('--enforce');
const compatibility = process.argv.includes('--compatibility');
const phase3VisualReview = process.argv.includes('--visual-review');
const phase4VisualReview = process.argv.includes('--phase4-visual-review');
const visualReview = phase3VisualReview || phase4VisualReview;
const gpuMode = process.env.HOPSCOTCH_GPU_MODE?.trim() || 'default';
if (!['default', 'swiftshader', 'disabled'].includes(gpuMode)) throw new Error(`Unsupported HOPSCOTCH_GPU_MODE: ${gpuMode}`);
const root = process.cwd();
const distDir = resolve(root, 'dist');
const budgetPath = resolve(root, 'config/performance-budget.json');
const defaultVisualDirectory = phase4VisualReview ? 'artifacts/phase4-visual-review' : 'artifacts/phase3-visual-review';
const reportPath = resolve(root, process.env.HOPSCOTCH_REPORT_PATH?.trim() || (visualReview ? `${defaultVisualDirectory}/${phase4VisualReview ? 'evidence-report.json' : 'worlds-report.json'}` : 'artifacts/performance-profile.json'));
const visualReviewDirectory = resolve(root, process.env.HOPSCOTCH_VISUAL_REVIEW_DIR?.trim() || defaultVisualDirectory);
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
  const html = readFileSync(indexPath, 'utf8');
  const scriptMatch = html.match(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*><\/script>/i);
  const cssMatch = html.match(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/i);
  if (!scriptMatch || !cssMatch) throw new Error('Unable to resolve generated Vite JS/CSS assets from dist/index.html.');
  const scriptPath = join(distDir, scriptMatch[1].replace(/^\//, ''));
  const cssPath = join(distDir, cssMatch[1].replace(/^\//, ''));
  const script = readFileSync(scriptPath);
  const css = readFileSync(cssPath);
  return {
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
  { id: 'stress-as-canvas', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'as-density' }), readySelector: '.internet-scale', expected: ['AS routing', 'SIMULATED BEST PATH'], stressExpected: { profile: 'as-density', asNodes: 160, asRelationships: 220 } },
  { id: 'stress-builder-ceiling', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'builder-density' }), readySelector: '.builder-workspace', expected: ['32 NODES · 96 LINKS', 'PATH', 'YES · COST', 'FORWARDING', 'NO ROUTE'], stressExpected: { profile: 'builder-density', builderNodes: 32, builderLinks: 96 } },
  { id: 'stress-physical-webgl', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'physical-density' }), readySelector: '.physical-globe', expected: gpuMode === 'disabled' ? ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'FALLBACK', 'WEBGL 2 UNAVAILABLE'] : ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'WEBGL 2'], stressExpected: { profile: 'physical-density', physicalPoints: 2000, webgl: gpuMode !== 'disabled' }, allowExpectedWebglFailure: gpuMode === 'disabled' },
);

if (compatibility) profiles.push(
{ id: 'protocol-tcp-desktop', width: 1440, height: 1000, reducedMotion: false, path: '/labs/tcp', query: '', readySelector: '.tcp-visual-workspace', protocolWorkspace: true, expected: ['TCP recovery', 'CLIENT SEQUENCE SPACE', 'CONGESTION WINDOW', 'PROVENANCE'] },
{ id: 'protocol-dns-mobile', width: 390, height: 844, reducedMotion: false, path: '/labs/dns', query: '', readySelector: '.dns-visual-workspace', protocolWorkspace: true, expected: ['www.example.test', 'NAMESPACE', 'STUB'] },
{ id: 'protocol-tls-reduced-motion', width: 1280, height: 900, reducedMotion: true, path: '/labs/tls', query: '', readySelector: '.tls-visual-workspace', protocolWorkspace: true, expected: ['TLS 1.3 handshake', 'SYMBOLIC KEY SCHEDULE', 'WIRE VISIBILITY', 'PROVENANCE'] },
{ id: 'protocol-http-desktop', width: 1440, height: 1000, reducedMotion: false, path: '/labs/http2-vs-http3', query: '', readySelector: '.http-visual-workspace', protocolWorkspace: true, expected: ['HTTP loss comparison', 'HTTP/2', 'HTTP/3', 'SAME LOSS', 'PROVENANCE'] },
{ id: 'builder-ospf-desktop', width: 1440, height: 1000, reducedMotion: false, query: '', readySelector: '.kinetic-overview', builderOspf: true, expected: ['ETHERNET FABRIC', 'ROUTED · VLAN 10 → 20', 'VLAN 20', 'DERIVED FDB', 'ARP CACHE', 'STP', 'FORWARDING'] },
{ id: 'builder-ospf-mobile', width: 390, height: 844, reducedMotion: false, query: '', readySelector: '.kinetic-overview', builderOspf: true, expected: ['ETHERNET FABRIC', 'ROUTED · VLAN 10 → 20', 'VLAN 20', 'ARP CACHE', 'STP', 'FORWARDING'] },
{ id: 'measured-workspace-desktop', width: 1440, height: 1000, reducedMotion: false, query: '', readySelector: '.kinetic-overview', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine'] },
  { id: 'measured-workspace-mobile', width: 390, height: 844, reducedMotion: false, query: '', readySelector: '.kinetic-overview', measuredWorkspace: true, expected: ['LOCAL MEASURED', 'Network Diagnostics Engine'], assertMeasuredMobile: true },
  { id: 'measured-workspace-reduced-motion', width: 1280, height: 900, reducedMotion: true, query: '', readySelector: '.kinetic-overview', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine'] },
  { id: 'measured-sidecars-desktop', width: 1440, height: 1000, reducedMotion: false, query: '', readySelector: '.kinetic-overview', measuredSidecars: true, expected: ['192.0.2.1'] },
  { id: 'measured-sidecars-mobile', width: 390, height: 844, reducedMotion: false, query: '', readySelector: '.kinetic-overview', measuredSidecars: true, expected: ['192.0.2.1'] },
  { id: 'measured-sidecars-reduced-motion', width: 1280, height: 900, reducedMotion: true, query: '', readySelector: '.kinetic-overview', measuredSidecars: true, expected: ['192.0.2.1'] },
);

if (phase3VisualReview) {
  const visualViewports = [
    { id: 'ultrawide', width: 2560, height: 1200 },
    { id: 'wide', width: 1600, height: 950 },
    { id: 'laptop', width: 1366, height: 768 },
    { id: 'narrow', width: 900, height: 820 },
    { id: 'mobile', width: 390, height: 844 },
  ];
  const visualWorlds = [
    { id: 'as-routing', path: '/internet/as-routing', query: '', readySelector: '.as-visual-workspace', expected: ['SIMULATED BEST PATH', 'SOURCE'], workspaceSelector: '.as-visual-workspace', stageSelector: '.visual-workspace__stage', worldSelector: '.internet-canvas-wrap', toolbarSelector: '.visual-workspace__toolbar', hudSelector: '.visual-workspace__hud', inspectButtonSelector: '.as-visual-workspace .visual-drawer-tabs button', drawerSelector: '.as-visual-workspace .visual-drawer' },
    { id: 'physical-atlas', path: '/', query: query({ stress: 'physical-density' }), readySelector: '.physical-visual-workspace', expected: ['SIMULATED STRESS POINTS', 'WEBGL 2', 'VISIBLE'], workspaceSelector: '.physical-visual-workspace', stageSelector: '.visual-workspace__stage', worldSelector: '.globe-viewport', toolbarSelector: '.visual-workspace__toolbar', hudSelector: '.visual-workspace__hud', inspectButtonSelector: '.physical-visual-workspace .visual-drawer-tabs button', drawerSelector: '.physical-visual-workspace .visual-drawer', drawerSurfaceSelector: '.physical-drawer-panel > section' },
    { id: 'packet-microscope', path: '/labs/packet', query: '', readySelector: '.packet-visual-workspace', expected: ['FRAME', 'BYTES', 'ETHERNET'], workspaceSelector: '.packet-visual-workspace', stageSelector: '.visual-workspace__stage', worldSelector: '.packet-stage', semanticSelector: '[data-simulated-packet-mechanism="true"]', semanticMinWidthRatio: 0.55, semanticMinHeightRatio: 0.28, motionSelector: '.simulated-packet-scan', toolbarSelector: '.visual-workspace__toolbar', hudSelector: '.visual-workspace__hud', inspectButtonSelector: '.packet-visual-workspace .visual-drawer-tabs button', drawerSelector: '.packet-visual-workspace .visual-drawer' },
    { id: 'network-builder', path: '/labs/builder', query: '', readySelector: '.builder-visual-workspace', expected: ['Network builder', 'PATH', 'FORWARDING', 'OSPF', 'GRAPH'], workspaceSelector: '.builder-visual-workspace', stageSelector: '.builder-stage', worldSelector: '.builder-canvas', semanticSelector: '.builder-node-anchor', semanticMinWidthRatio: 0.72, semanticMinHeightRatio: 0.34, motionSelector: '.builder-route-signal-track', hiddenHitSelector: '.builder-link .hit', toolbarSelector: '.builder-world-toolbar', hudSelector: '.builder-stage-meta', inspectRevealSelector: '.builder-command-toggle', inspectButtonSelector: '.builder-tool-inspect', drawerSelector: '.builder-context-drawer.open', drawerTitleSelector: '.builder-context-drawer__header > div' },
  ];
  profiles.splice(0, profiles.length, ...visualWorlds.flatMap((world) => visualViewports.map((viewport) => ({
    ...world,
    ...viewport,
    id: `${world.id}-${viewport.id}`,
    reducedMotion: false,
    visualReview: true,
    inspectReview: viewport.id === 'wide' || viewport.id === 'mobile',
  }))));
}

if (phase4VisualReview) {
  const evidenceViewports = [
    { id: 'ultrawide', width: 2560, height: 1200 },
    { id: 'wide', width: 1600, height: 950 },
    { id: 'laptop', width: 1366, height: 768 },
    { id: 'narrow', width: 900, height: 820 },
    { id: 'mobile', width: 390, height: 844 },
  ];
  const evidenceWorlds = [
    { id: 'internet-evidence', path: '/internet/observed', query: '', readySelector: '.observed-internet', phase4Observed: true, expected: ['NO ROUTE CLAIM', 'NO CONTINUOUS OBSERVATION', 'PUBLIC COLLECTOR'] },
    { id: 'measured-network', path: '/measured', query: '', readySelector: '.measured-workspace', phase4Measured: true, expected: ['LOCAL MEASURED', 'Network Diagnostics Engine', 'NO CROSS-TARGET MERGE'] },
  ];
  profiles.splice(0, profiles.length, ...evidenceWorlds.flatMap((world) => evidenceViewports.map((viewport) => ({
    ...world,
    ...viewport,
    id: `${world.id}-${viewport.id}`,
    reducedMotion: false,
    visualReview: true,
    phase4VisualReview: true,
    inspectReview: viewport.id === 'wide' || viewport.id === 'mobile',
  }))));
}

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

async function exerciseBuilderOspf(cdp, profile) {
  await openOverviewWorkspace(cdp, 'builder');
  await waitForExpression(cdp, `Boolean(document.querySelector('.builder-workspace'))`, 8000);

  const state = async () => cdp.evaluate(`(()=>({
    innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    scrollY,
    text:document.body.innerText,
    meta:document.querySelector('.builder-stage-meta')?.innerText??'',
    ospf:document.querySelector('.builder-ospf-summary')?.innerText??'',
    forwarding:document.querySelector('.builder-forwarding')?.innerText??'',
    routeTable:document.querySelector('.builder-ipv4-route-table')?.innerText??'',
    ospfRoutes:document.querySelectorAll('.builder-ipv4-route-table .source-ospf').length,
  }))()`);
  const assertViewport = (value, label) => {
    if (value.scrollWidth > value.innerWidth) throw new Error(`${profile.id} ${label} horizontally overflows: ${value.scrollWidth} > ${value.innerWidth}.`);
    if (value.scrollY !== 0) throw new Error(`${profile.id} ${label} moved document scrollY to ${value.scrollY}.`);
  };

  const initial = await state();
  assertViewport(initial, 'default Builder');
  if (!initial.meta.includes('OSPF') || !initial.meta.includes('OFF')) throw new Error(`${profile.id} did not start with OSPF disabled.`);
  if (!initial.meta.includes('FORWARDING') || !initial.meta.includes('NO ROUTE')) throw new Error(`${profile.id} OSPF-off default fabricated forwarding reachability.`);

  const initialEdgeSelected = await cdp.evaluate(`(()=>{
    const node=[...document.querySelectorAll('.builder-node')].find((candidate)=>candidate.querySelector('strong')?.textContent?.trim()==='EDGE');
    if(!node)return false;
    node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,isPrimary:true,pointerType:'mouse'}));
    return true;
  })()`);
  if (!initialEdgeSelected) throw new Error(`${profile.id} could not select EDGE before enabling OSPF.`);
  await waitForExpression(cdp, `Boolean(document.querySelector('.builder-ospf-section button'))`, 8000);
  await measuredClickButton(cdp, '.builder-ospf-section button', 'ENABLE ALL');
  await waitForExpression(cdp, `document.querySelector('.builder-stage-meta')?.innerText.includes('4 RTR · 5 FULL')`, 8000);
  await waitForExpression(cdp, `!document.querySelector('.builder-forwarding')?.classList.contains('unreachable')`, 8000);

  const edgeSelected = await cdp.evaluate(`(()=>{
    const node=[...document.querySelectorAll('.builder-node')].find((candidate)=>candidate.querySelector('strong')?.textContent?.trim()==='EDGE');
    if(!node)return false;
    node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,isPrimary:true,pointerType:'mouse'}));
    return true;
  })()`);
  if (!edgeSelected) throw new Error(`${profile.id} could not select EDGE for OSPF route-table inspection.`);
  await waitForExpression(cdp, `document.querySelectorAll('.builder-ipv4-route-table .source-ospf').length > 0`, 8000);
  const converged = await state();
  assertViewport(converged, 'converged OSPF');
  if (!converged.routeTable.includes('10.0.0.4/30') || !converged.routeTable.includes('via 10.0.0.10')) throw new Error(`${profile.id} EDGE did not install the primary OSPF path via R1.`);

  const selectedLink = await cdp.evaluate(`(()=>{
    const link=document.querySelector('.builder-link[data-link-id="edge-r1"]');
    if(!link)return false;
    link.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    return true;
  })()`);
  if (!selectedLink) throw new Error(`${profile.id} could not select edge-r1.`);
  await waitForExpression(cdp, `document.querySelector('.builder-link-section .control-title')?.innerText.includes('EDGE ↔ R1')`, 8000);
  await measuredClickButton(cdp, '.builder-link-section button', 'FAIL LINK');
  await waitForExpression(cdp, `document.querySelector('.builder-ospf-summary')?.innerText.includes('4 FULL') && document.querySelector('.builder-ospf-summary')?.innerText.includes('1 DOWN')`, 8000);
  await waitForExpression(cdp, `document.querySelector('.builder-forwarding')?.innerText.includes('EDGE → R2 → CORE')`, 8000);
  await waitForExpression(cdp, `document.querySelector('.builder-ipv4-route-table')?.innerText.includes('via 10.0.0.14')`, 8000);

  const failed = await state();
  assertViewport(failed, 'OSPF failover');
  if (!failed.meta.includes('REACHABLE')) throw new Error(`${profile.id} OSPF failover did not preserve L3 reachability.`);
  if (!failed.routeTable.includes('10.0.0.4/30') || !failed.routeTable.includes('via 10.0.0.14')) throw new Error(`${profile.id} EDGE did not reconverge the app subnet through R2.`);
  if (!failed.routeTable.includes('AD 110')) throw new Error(`${profile.id} OSPF route lost its administrative-distance teaching state.`);

  // Lab 11D: the same routed failure state must be observable by an active traceroute.
  await measuredClickButton(cdp, '.builder-probe-section button', 'TRACEROUTE');
  await waitForExpression(cdp, `document.querySelector('.builder-probe-panel')?.innerText.includes('TRACEROUTE') && document.querySelector('.builder-probe-panel')?.innerText.includes('ECHO REPLY')`, 8000);
  const probe = await cdp.evaluate(`(()=>({
    panel:document.querySelector('.builder-probe-panel')?.innerText??'',
    path:document.querySelector('.builder-probe-path')?.innerText??'',
    activeLinks:document.querySelectorAll('.builder-link.probe-active').length,
  }))()`);
  if (!probe.path.includes('EDGE') || !probe.path.includes('R2') || !probe.path.includes('CORE') || !probe.path.includes('APP')) throw new Error(`${profile.id} traceroute did not consume the OSPF failover path through R2.`);
  if (probe.path.includes('R1')) throw new Error(`${profile.id} traceroute retained failed R1 in the active request path.`);
  if (probe.activeLinks < 4) throw new Error(`${profile.id} did not visually mark the traceroute forwarding path.`);
  const probeMetrics = await cdp.evaluate(`document.querySelector('.builder-probe-metrics')?.innerText??''`);
  if (!probeMetrics.includes('RTT MS') || !probeMetrics.includes('PATH MTU') || /—\s*RTT MS/.test(probeMetrics)) throw new Error(`${profile.id} traceroute did not expose link-derived RTT/MTU metrics.`);

  // Lab 11J: evaluate policy while the OSPF failover path is still live.
  const aclEdgeSelected = await cdp.evaluate(`(()=>{
    const node=[...document.querySelectorAll('.builder-node')].find((candidate)=>candidate.querySelector('strong')?.textContent?.trim()==='EDGE');
    if(!node)return false;
    node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,isPrimary:true,pointerType:'mouse'}));
    return true;
  })()`);
  if (!aclEdgeSelected) throw new Error(`${profile.id} could not select EDGE for ACL policy testing.`);
  await waitForExpression(cdp, `document.querySelector('.builder-acl-section .control-title')?.innerText.includes('0 RULES')`, 8000);
  await measuredClickButton(cdp, '.builder-acl-section button', 'ADD ACL RULE');
  await waitForExpression(cdp, `document.querySelector('.builder-policy-panel')?.classList.contains('denied')`, 8000);
  const deniedPolicy = await cdp.evaluate(`(()=>({policy:document.querySelector('.builder-policy-panel')?.innerText??'',forwarding:document.querySelector('.builder-forwarding')?.innerText??'',rules:document.querySelectorAll('.builder-acl-rules>div').length}))()`);
  if (!deniedPolicy.policy.includes('DENIED') || !deniedPolicy.forwarding.includes('EDGE → R2 → CORE') || deniedPolicy.rules !== 1) throw new Error(`${profile.id} ACL denial did not remain separate from OSPF forwarding truth.`);
  await measuredClickButton(cdp, '.builder-probe-section button', 'PING');
  await waitForExpression(cdp, `document.querySelector('.builder-probe-panel')?.innerText.includes('PING') && document.querySelector('.builder-probe-panel')?.classList.contains('failed')`, 8000);
  const aclPing = await cdp.evaluate(`document.querySelector('.builder-probe-panel')?.innerText??''`);
  if (!/ACL|POLICY|DENIED/i.test(aclPing)) throw new Error(`${profile.id} Ping did not surface ACL policy denial.`);
  const deletedAcl = await cdp.evaluate(`(()=>{const button=document.querySelector('.builder-acl-rules button');if(!button)return false;button.click();return true})()`);
  if (!deletedAcl) throw new Error(`${profile.id} could not remove the temporary ACL rule.`);
  await waitForExpression(cdp, `!document.querySelector('.builder-policy-panel')?.classList.contains('denied')`, 8000);
  await measuredClickButton(cdp, '.builder-probe-section button', 'PING');
  await waitForExpression(cdp, `document.querySelector('.builder-probe-panel')?.innerText.includes('PING') && document.querySelector('.builder-probe-panel')?.classList.contains('success')`, 8000);

  // Restore a TTL-scoped traceroute selection before jumping into Lab 02 so the cross-link contract remains stable.
  await measuredClickButton(cdp, '.builder-probe-section button', 'TRACEROUTE');
  await waitForExpression(cdp, `document.querySelector('.builder-probe-panel')?.innerText.includes('TRACEROUTE') && document.querySelector('.builder-probe-panel')?.innerText.includes('ECHO REPLY')`, 8000);

  // Cross-link one TTL-scoped probe into the actual Packet Microscope and return.
  await measuredClickButton(cdp, '.builder-probe-section button', 'OPEN ICMP PACKET');
  await waitForExpression(cdp, `Boolean(document.querySelector('.packet-microscope'))`, 8000);
  const packetText = await cdp.evaluate(`document.querySelector('.packet-microscope')?.innerText??''`);
  if (!packetText.includes('BUILDER IPV4 · ICMP TRACE TTL') || !packetText.includes('ICMP') || !packetText.includes('TTL')) throw new Error(`${profile.id} probe packet did not seed the Packet Microscope ICMP state.`);
  await measuredClickButton(cdp, '.packet-visual-workspace .interactive-world-toolbar__actions button', 'RETURN TO BUILDER');
  await waitForExpression(cdp, `Boolean(document.querySelector('.builder-workspace'))`, 8000);

  // Lab 11N foundation: IPv6 is an independent FIB. Addressing exists by default, but routed reachability
  // appears only after explicit IPv6 route state is installed. The existing failed EDGE↔R1 link means the
  // weighted-path helper must choose the live R2 side without borrowing IPv4 OSPF state.
  const ipv6Before = await cdp.evaluate(`document.querySelector('.builder-ipv6-section')?.innerText??''`);
  if (!ipv6Before.includes('IPV6 · DUAL STACK') || !ipv6Before.includes('ENABLED · NO ROUTE') || !ipv6Before.includes('2001:db8:') || !ipv6Before.includes('LINK-LOCAL fe80:')) throw new Error(`${profile.id} IPv6 foundation did not expose independent enabled addressing before route installation.`);
  await measuredClickButton(cdp, '.builder-ipv6-section button', 'INSTALL IPV6 STATIC PATH');
  await waitForExpression(cdp, `document.querySelector('.builder-ipv6-section')?.innerText.includes('ENABLED · REACHABLE')`, 8000);
  const ipv6FamilySelected = await cdp.evaluate(`(()=>{
    const select=document.querySelector('.builder-probe-section select');
    if(!select)return false;
    select.value='ipv6';
    select.dispatchEvent(new Event('change',{bubbles:true}));
    return select.value==='ipv6';
  })()`);
  if (!ipv6FamilySelected) throw new Error(`${profile.id} could not select the IPv6 active-probe family.`);
  await sleep(60);
  await measuredClickButton(cdp, '.builder-probe-section button', 'TRACEROUTE');
  await waitForExpression(cdp, `document.querySelector('.builder-probe-panel')?.innerText.includes('TRACEROUTE') && document.querySelector('.builder-probe-panel')?.innerText.includes('ECHO REPLY')`, 8000);
  const ipv6ProbeText = await cdp.evaluate(`document.querySelector('.builder-probe-section')?.innerText??''`);
  if (!ipv6ProbeText.includes('ICMPV6') || !ipv6ProbeText.includes('IPV6') || !ipv6ProbeText.includes('HOP LIMIT')) throw new Error(`${profile.id} IPv6 traceroute did not expose ICMPv6/Hop-Limit teaching state.`);
  await measuredClickButton(cdp, '.builder-probe-section button', 'OPEN ICMP PACKET');
  await waitForExpression(cdp, `Boolean(document.querySelector('.packet-microscope'))`, 8000);
  const packet6Text = await cdp.evaluate(`document.querySelector('.packet-microscope')?.innerText??''`);
  if (!packet6Text.includes('BUILDER IPV6 · ICMPV6 TRACE HOP LIMIT') || !packet6Text.includes('IPv6') || !packet6Text.includes('ICMPv6') || !packet6Text.toLowerCase().includes('2001:db8:')) throw new Error(`${profile.id} IPv6 probe packet did not seed actual Builder ICMPv6 state into the Packet Microscope.`);
  await measuredClickButton(cdp, '.packet-visual-workspace .interactive-world-toolbar__actions button', 'RETURN TO BUILDER');
  await waitForExpression(cdp, `Boolean(document.querySelector('.builder-workspace'))`, 8000);
  const ipv4FamilyRestored = await cdp.evaluate(`(()=>{
    const select=document.querySelector('.builder-probe-section select');
    if(!select)return false;
    select.value='ipv4';
    select.dispatchEvent(new Event('change',{bubbles:true}));
    return select.value==='ipv4';
  })()`);
  if (!ipv4FamilyRestored) throw new Error(`${profile.id} could not restore IPv4 probe family for downstream policy contracts.`);
  await sleep(60);

  // Labs 11E-H: first show ARP resolution, STP blocking, same-VLAN switching, and MAC learning.
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'SEND FRAME / PACKET');
  await waitForExpression(cdp, `document.querySelector('.builder-ethernet-stage')?.innerText.includes('SWITCHED · VLAN 10')`, 8000);
  const switched = await cdp.evaluate(`(()=>({
    stage:document.querySelector('.builder-ethernet-stage')?.innerText??'',
    fdb:document.querySelector('.builder-fdb')?.innerText??'',
    flowLinks:document.querySelectorAll('.builder-lan-canvas g.flow').length,
  }))()`);
  if (!switched.stage.includes('FLOOD THEN LEARN') || !switched.fdb.includes('SW1 · V10') || !switched.fdb.includes('SW2 · V10')) throw new Error(`${profile.id} same-VLAN flow did not expose VLAN-scoped FDB learning.`);
  if (!switched.stage.includes('ARP REQUEST → REPLY') || !switched.stage.includes('SW1 ROOT') || !switched.stage.includes('1 BLOCKED')) throw new Error(`${profile.id} first LAN flow did not expose ARP + STP truth.`);
  if (switched.flowLinks < 3) throw new Error(`${profile.id} same-VLAN path did not highlight the LAN links.`);
  if (await cdp.evaluate(`document.querySelectorAll('.builder-lan-canvas g.stp-blocked').length`) !== 1) throw new Error(`${profile.id} did not visually mark exactly one VLAN-10 STP blocked segment.`);

  // Repeating the same flow must hit the session-only ARP cache rather than replay address resolution.
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'SEND FRAME / PACKET');
  await waitForExpression(cdp, `document.querySelector('.builder-ethernet-stage')?.innerText.includes('ARP CACHE HIT')`, 8000);

  const setSelect = async (index, value) => cdp.evaluate(`(()=>{
    const section=document.querySelector('.builder-ethernet-section');
    const select=section?.querySelectorAll('select')[${index}];
    if(!select)return false;
    select.value=${JSON.stringify(value)};
    select.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);
  if (!(await setSelect(2, 'lan-sw1-sw2'))) throw new Error(`${profile.id} could not select the primary SW1↔SW2 trunk for STP failover.`);
  await sleep(60);
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'FAIL LAN LINK');
  await waitForExpression(cdp, `document.querySelector('.builder-lan-truth')?.innerText.includes('0 BLOCKED')`, 8000);
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'SEND FRAME / PACKET');
  await waitForExpression(cdp, `document.querySelector('.builder-ethernet-stage')?.innerText.includes('SWITCHED · VLAN 10')`, 8000);
  const stpFailover = await cdp.evaluate(`document.querySelector('.builder-ethernet-stage')?.innerText??''`);
  if (!stpFailover.includes('SW3') || !stpFailover.includes('PC-B')) throw new Error(`${profile.id} VLAN-10 traffic did not reconverge through SW3 after primary trunk failure.`);
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'RESTORE LAN LINK');
  await waitForExpression(cdp, `document.querySelector('.builder-lan-truth')?.innerText.includes('1 BLOCKED')`, 8000);

  if (!(await setSelect(1, 'lan-c'))) throw new Error(`${profile.id} could not choose PC-C for inter-VLAN flow.`);
  await sleep(80);
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'SEND FRAME / PACKET');
  await waitForExpression(cdp, `document.querySelector('.builder-ethernet-stage')?.innerText.includes('ROUTED · VLAN 10 → 20')`, 8000);
  let routed = await cdp.evaluate(`document.querySelector('.builder-ethernet-stage')?.innerText??''`);
  if (!routed.includes('RTR') || !routed.includes('VLAN 20') || !routed.includes('TTL 64 → 63')) throw new Error(`${profile.id} inter-VLAN flow lost router-on-a-stick or TTL truth.`);
  if ((routed.match(/ARP REQUEST → REPLY/g)??[]).length < 2 || !routed.includes('10.10.0.1') || !routed.includes('10.20.0.10')) throw new Error(`${profile.id} inter-VLAN flow did not resolve gateway-side and destination-side ARP independently.`);

  // Block VLAN 20 on the switch trunk: VLAN 20 must fail while VLAN 10 remains usable.
  if (!(await setSelect(2, 'lan-sw1-sw2'))) throw new Error(`${profile.id} could not select SW1↔SW2 trunk.`);
  await sleep(80);
  const trunkEdited = await cdp.evaluate(`(()=>{
    const input=document.querySelector('.builder-ethernet-section input'); if(!input)return false;
    input.value='10'; input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})); return true;
  })()`);
  if (!trunkEdited) throw new Error(`${profile.id} could not edit trunk allow-list.`);
  await sleep(100);
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'SEND FRAME / PACKET');
  await waitForExpression(cdp, `document.querySelector('.builder-ethernet-stage')?.classList.contains('failed')`, 8000);
  const blocked = await cdp.evaluate(`document.querySelector('.builder-ethernet-stage')?.innerText??''`);
  if (!blocked.includes('UNREACHABLE') || !blocked.includes('VLAN 20')) throw new Error(`${profile.id} trunk filter did not isolate VLAN 20.`);

  if (!(await setSelect(1, 'lan-b'))) throw new Error(`${profile.id} could not return destination to PC-B.`);
  await sleep(60);
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'SEND FRAME / PACKET');
  await waitForExpression(cdp, `document.querySelector('.builder-ethernet-stage')?.innerText.includes('SWITCHED · VLAN 10')`, 8000);

  // Restore the trunk, rerun inter-VLAN routing, and leave the final screenshot on the successful routed state.
  const trunkRestored = await cdp.evaluate(`(()=>{
    const input=document.querySelector('.builder-ethernet-section input'); if(!input)return false;
    input.value='10, 20'; input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})); return true;
  })()`);
  if (!trunkRestored) throw new Error(`${profile.id} could not restore trunk allow-list.`);
  if (!(await setSelect(1, 'lan-c'))) throw new Error(`${profile.id} could not restore PC-C destination.`);
  await sleep(100);
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'SEND FRAME / PACKET');
  await waitForExpression(cdp, `document.querySelector('.builder-ethernet-stage')?.innerText.includes('ROUTED · VLAN 10 → 20')`, 8000);
  const depthFinal = await state();
  assertViewport(depthFinal, 'active probes + Ethernet/VLAN fabric');

  mkdirSync(dirname(reportPath), { recursive: true });
  const screenshot = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true });
  writeFileSync(join(dirname(reportPath), `builder-ospf-${profile.id}.png`), Buffer.from(screenshot.data, 'base64'));
  writeFileSync(join(dirname(reportPath), `builder-depth-${profile.id}.png`), Buffer.from(screenshot.data, 'base64'));
  return {
    defaultNoRoute: true,
    enabledRouters: 4,
    initialFullAdjacencies: 5,
    failedAdjacencies: 1,
    failoverNextHop: '10.0.0.14',
    ospfRouteCount: failed.ospfRoutes,
    scrollWidth: failed.scrollWidth,
    innerWidth: depthFinal.innerWidth,
    activeProbeFailover: true,
    packetMicroscopeIcmp: true,
    ipv6Foundation: true,
    packetMicroscopeIcmpv6: true,
    sameVlanSwitching: true,
    trunkIsolation: true,
    interVlanRouting: true,
    arpResolutionAndCache: true,
    stpBlockingAndFailover: true,
    linkDerivedProbeMetrics: true,
    aclPolicyIsolation: true,
  };
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

  await measuredClickButton(cdp, '.measured-heading .visual-drawer-tabs button', 'SETUP');
  await waitForExpression(cdp, `Boolean(document.querySelector('.measured-workspace .visual-drawer'))`);

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

  await measuredClickButton(cdp, '.measured-workspace .visual-drawer__close', '×');
  await waitForExpression(cdp, `!document.querySelector('.measured-workspace .visual-drawer')`);
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
  await openOverviewWorkspace(cdp, 'measured');
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

  await measuredClickButton(cdp, '.measured-heading .visual-drawer-tabs button', 'PROVENANCE');
  await waitForExpression(cdp, `document.body.innerText.includes('NOT PROMOTED TO LOCAL MEASURED')`, 8000);
  await measuredClickButton(cdp, '.measured-workspace .visual-drawer__close', '×');
  await waitForExpression(cdp, `!document.querySelector('.measured-workspace .visual-drawer')`);

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
    contextualProvenanceVerified: true,
    rejectedReplacementPreserved: true,
    clearReturnedToEmpty: true,
  };
}

async function measuredClickButton(cdp, selector, text) {
  const clicked = await cdp.evaluate(`(()=>{
    const needle=${JSON.stringify(text)}.toLocaleUpperCase();
    const button=[...document.querySelectorAll(${JSON.stringify(selector)})].find((candidate)=>candidate.textContent?.toLocaleUpperCase().includes(needle));
    if(!button)return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Unable to click ${selector} containing ${JSON.stringify(text)}.`);
}

async function openOverviewWorkspace(cdp, destination) {
  const opened = await cdp.evaluate(`(()=>{
    const button=document.querySelector('.corner-navigator');
    if(!button)return false;
    button.click();
    return true;
  })()`);
  if (!opened) throw new Error(`Unable to open corner navigation for ${destination}.`);
  await waitForExpression(cdp, `Boolean(document.querySelector('#explore-dialog'))`, 8000);

  const destinationSelector = `[data-explore-destination="${destination}"]`;
  const selected = await cdp.evaluate(`(()=>{
    const row=document.querySelector(${JSON.stringify(destinationSelector)});
    if(!row)return false;
    row.click();
    return true;
  })()`);
  if (!selected) throw new Error(`Unable to select ${destination} from corner navigation.`);
  await waitForExpression(cdp, `!document.querySelector('#explore-dialog')`, 8000);
}

async function openJourneyDrawer(cdp, label) {
  await measuredClickButton(cdp, '.visual-drawer-tabs button', label);
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-visual-workspace .visual-drawer'))`, 8000);
  await waitForExpression(cdp, `(()=>{
    const drawer=document.querySelector('.journey-visual-workspace .visual-drawer')?.getBoundingClientRect();
    const stage=document.querySelector('.journey-visual-workspace .visual-workspace__stage')?.getBoundingClientRect();
    return Boolean(drawer&&stage&&drawer.left>=stage.left-1&&drawer.right<=stage.right+1);
  })()`, 8000);
  await sleep(80);
}

async function closeJourneyDrawer(cdp) {
  const closed = await cdp.evaluate(`(()=>{
    const button=document.querySelector('.journey-visual-workspace .visual-drawer__close');
    if(!button)return false;
    button.click();
    return true;
  })()`);
  if (!closed) throw new Error('Unable to close the active Journey drawer.');
  await waitForExpression(cdp, `!document.querySelector('.journey-visual-workspace .visual-drawer')`, 8000);
}

async function selectJourneyEvent(cdp, title) {
  await openJourneyDrawer(cdp, 'Events');
  await measuredClickButton(cdp, '.journey-event', title);
  await waitForExpression(cdp, `document.querySelector('.journey-callout-overlay h2')?.textContent?.includes(${JSON.stringify(title)})`, 8000);
  await closeJourneyDrawer(cdp);
}

async function inspectJourneyDrawerArchitecture(cdp, profile) {
  const before = await cdp.evaluate(`(()=>{
    const stage=document.querySelector('.journey-visual-workspace .visual-workspace__stage')?.getBoundingClientRect();
    const exit=[...document.querySelectorAll('.journey-visual-tools .visual-tool-button')].find((button)=>button.textContent?.includes('Exit'))?.getBoundingClientRect();
    return {stage:stage?{x:stage.x,y:stage.y,width:stage.width,height:stage.height}:null,exit:exit?{x:exit.x,y:exit.y,width:exit.width,height:exit.height}:null};
  })()`);
  if (!before.stage) throw new Error(`${profile.id} is missing the Journey visual stage.`);
  if (!before.exit || before.exit.width <= 0 || before.exit.height <= 0) throw new Error(`${profile.id} does not expose a visible Journey Exit action.`);
  if (before.exit.x < before.stage.x || before.exit.x + before.exit.width > before.stage.x + before.stage.width + 1) throw new Error(`${profile.id} Journey Exit action is outside the visible stage.`);

  await openJourneyDrawer(cdp, 'Configure');
  const opened = await cdp.evaluate(`(()=>{
    const stage=document.querySelector('.journey-visual-workspace .visual-workspace__stage')?.getBoundingClientRect();
    const drawer=document.querySelector('.journey-visual-workspace .visual-drawer')?.getBoundingClientRect();
    const modifierProfile=document.querySelector('.journey-modifier-profile');
    const controls=[...document.querySelectorAll('.journey-modifier-profile button')].map((button,index)=>{const rect=button.getBoundingClientRect();return {index:index+1,text:button.innerText,x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)}});
    return {
      stage:stage?{x:stage.x,y:stage.y,width:stage.width,height:stage.height}:null,
      drawer:drawer?{x:drawer.x,y:drawer.y,width:drawer.width,height:drawer.height}:null,
      controls,
      modifierColumns:modifierProfile?getComputedStyle(modifierProfile).gridTemplateColumns.split(' ').filter(Boolean).length:0,
      modal:document.querySelector('.journey-visual-workspace .visual-drawer')?.getAttribute('aria-modal'),
    };
  })()`);
  if (!opened.stage || !opened.drawer) throw new Error(`${profile.id} did not render the Config drawer over the Journey stage.`);
  if (opened.modal !== 'true') throw new Error(`${profile.id} Journey drawer lost modal accessibility semantics.`);
  if (opened.controls.length !== 10) throw new Error(`${profile.id} expected 10 GOD MODE controls, found ${opened.controls.length}.`);
  for (const key of ['x', 'y', 'width', 'height']) {
    if (Math.abs(opened.stage[key] - before.stage[key]) > 1) throw new Error(`${profile.id} Config drawer changed stage ${key}: ${before.stage[key]} → ${opened.stage[key]}.`);
  }
  if (profile.width <= 680) {
    for (const key of ['x', 'y', 'width', 'height']) {
      if (Math.abs(opened.drawer[key] - opened.stage[key]) > 1) throw new Error(`${profile.id} mobile drawer did not cover the full stage ${key}.`);
    }
  } else if (opened.drawer.x < opened.stage.x || opened.drawer.x + opened.drawer.width > opened.stage.x + opened.stage.width + 1) {
    throw new Error(`${profile.id} desktop drawer escaped the visual stage.`);
  }
  await closeJourneyDrawer(cdp);
  const after = await cdp.evaluate(`(()=>{const stage=document.querySelector('.journey-visual-workspace .visual-workspace__stage')?.getBoundingClientRect();return stage?{x:stage.x,y:stage.y,width:stage.width,height:stage.height}:null})()`);
  if (!after) throw new Error(`${profile.id} lost the Journey stage after closing Config.`);
  for (const key of ['x', 'y', 'width', 'height']) {
    if (Math.abs(after[key] - before.stage[key]) > 1) throw new Error(`${profile.id} stage did not recover after closing Config (${key}).`);
  }
  return { modifierControls: opened.controls, modifierColumns: opened.modifierColumns, modal: true, stagePreserved: true, mobileFullStage: profile.width <= 680 };
}

async function measuredViewportState(cdp) {
  return cdp.evaluate(`(()=>({
    innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    scrollY,
    sidecar:document.querySelector('.journey-measured-sidecar')?.innerText ?? null,
    compatibility:document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility') ?? null,
    scene:document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-scene') ?? null,
    activeEvent:document.querySelector('.journey-callout-overlay h2')?.textContent ?? null,
  }))()`);
}

function assertMeasuredViewport(profile, state, label) {
  if (state.scrollWidth > state.innerWidth) throw new Error(`${profile.id} ${label} horizontally overflows: ${state.scrollWidth} > ${state.innerWidth}.`);
  if (state.scrollY !== 0) throw new Error(`${profile.id} ${label} moved document scrollY to ${state.scrollY}.`);
}

async function exerciseMeasuredJourneySidecars(cdp, profile) {
  await openOverviewWorkspace(cdp, 'measured');
  await waitForExpression(cdp, `Boolean(document.querySelector('.measured-workspace'))`);
  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await measuredClickButton(cdp, '.measured-heading-actions button', 'Exit');
  await waitForExpression(cdp, `Boolean(document.querySelector('.kinetic-overview'))`);
  await openOverviewWorkspace(cdp, 'journey');
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-visual-workspace'))`, 8000);

  await selectJourneyEvent(cdp, 'Default gateway selected');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='local-context'`, 8000);
  const routing = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, routing, 'routing sidecar');
  if (routing.scene !== 'routing' || routing.activeEvent !== 'Default gateway selected') throw new Error(`${profile.id} did not bind LOCAL CONTEXT to the routing phase.`);
  if (!routing.sidecar?.includes('LOCAL MEASURED') || !routing.sidecar.includes('LOCAL CONTEXT') || !routing.sidecar.includes('SIMULATED STORY UNCHANGED')) throw new Error(`${profile.id} routing sidecar lost provenance/boundary language.`);

  await selectJourneyEvent(cdp, 'Stub asks recursive resolver');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='matched-target'`, 8000);
  const dns = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, dns, 'DNS sidecar');
  if (dns.scene !== 'dns' || !dns.sidecar?.includes('MATCHED TARGET') || !dns.sidecar.includes('8 ms')) throw new Error(`${profile.id} DNS sidecar did not expose exact-target measured DNS context.`);

  await selectJourneyEvent(cdp, 'TCP connection established');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='matched-target'`, 8000);
  const transport = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, transport, 'transport sidecar');
  if (transport.scene !== 'transport' || !transport.sidecar?.includes('MATCHED TARGET')) throw new Error(`${profile.id} transport sidecar did not expose exact-target context.`);
  if (transport.sidecar.includes('500 Mbps')) throw new Error(`${profile.id} leaked other-target speed-test throughput into matched Journey transport evidence.`);
  if (!transport.sidecar.includes('OTHER-TARGET FACT')) throw new Error(`${profile.id} did not disclose that other-target transport facts were hidden.`);

  await openJourneyDrawer(cdp, 'Configure');
  const changedHost = await cdp.evaluate(`(()=>{
    const input=document.querySelector('.journey-drawer-form input');
    const form=document.querySelector('.journey-drawer-form');
    if(!input||!form)return false;
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    setter?.call(input,'other.test');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    form.requestSubmit();
    return true;
  })()`);
  if (!changedHost) throw new Error(`${profile.id} could not change Journey hostname for mismatch validation.`);
  await waitForExpression(cdp, `document.querySelector('.journey-drawer-form input')?.value==='other.test'`, 8000);
  await closeJourneyDrawer(cdp);
  await selectJourneyEvent(cdp, 'TCP connection established');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='other-target'`, 8000);
  const mismatch = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, mismatch, 'mismatched transport sidecar');
  if (!mismatch.sidecar?.includes('NO COMPATIBLE TRANSPORT TARGET') || !mismatch.sidecar.includes('OTHER TARGET')) throw new Error(`${profile.id} mismatched target did not fail closed visibly.`);
  if (mismatch.sidecar.includes('500 Mbps') || mismatch.sidecar.includes('24 ms') || mismatch.sidecar.includes('17 ms')) throw new Error(`${profile.id} rendered mismatched measured values as Journey evidence.`);

  await measuredClickButton(cdp, '.journey-visual-tools .visual-tool-button', 'Exit');
  await waitForExpression(cdp, `Boolean(document.querySelector('.kinetic-overview'))`);
  await openOverviewWorkspace(cdp, 'measured');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await measuredClickButton(cdp, '.measured-clear', 'CLEAR');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='false'`, 8000);
  await measuredClickButton(cdp, '.measured-heading-actions button', 'Exit');
  await waitForExpression(cdp, `Boolean(document.querySelector('.kinetic-overview'))`);
  await openOverviewWorkspace(cdp, 'journey');
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-visual-workspace'))`, 8000);
  await selectJourneyEvent(cdp, 'Default gateway selected');
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

async function exercisePhase4ObservedInternet(cdp, profile) {
  const snapshot = {
    schema: 'hopscotch.internet-evidence', version: 1, generatedAt: '2026-08-20T22:00:00.000Z',
    edge: { provenance: 'EDGE OBSERVED', availability: 'available', asn: 13335, organization: 'Cloudflare, Inc.', colo: 'LHR', country: 'GB', region: 'England', city: 'London', transportRttMs: 17, transport: 'QUIC', observedAt: '2026-08-20T22:00:00.000Z', note: 'Observed at the edge serving this explicit HOPSCOTCH request.' },
    destination: { provenance: 'INFERRED', availability: 'available', hostname: 'cloudflare.com', addresses: ['104.16.132.229', '104.16.133.229', '2606:4700::6810:84e5'], selectedAddress: '104.16.132.229', note: 'DNS resolution provides destination context, not a measured forwarding path.' },
    routing: { provenance: 'PUBLIC COLLECTOR', availability: 'available', prefix: '104.16.128.0/20', originAsns: [13335], note: 'Public route-origin context seen from independent collector vantage points.' },
    collectorPaths: [
      { provenance: 'PUBLIC COLLECTOR', availability: 'available', sourceId: 'rrc00-peer-64500', targetPrefix: '104.16.128.0/20', asPath: [64500, 3356, 13335], note: 'Independent RIS vantage; not the browser path.' },
      { provenance: 'PUBLIC COLLECTOR', availability: 'available', sourceId: 'rrc10-peer-64496', targetPrefix: '104.16.128.0/20', asPath: [64496, 1299, 13335], note: 'Independent RIS vantage; not the browser path.' },
      { provenance: 'PUBLIC COLLECTOR', availability: 'available', sourceId: 'rrc21-peer-64497', targetPrefix: '104.16.128.0/20', asPath: [64497, 174, 13335], note: 'Independent RIS vantage; not the browser path.' },
    ],
    bridge: { provenance: 'INFERRED', availability: 'partial', sourceAsn: 13335, destinationOriginAsns: [13335], note: 'No continuous observation joins the request edge, the browser forwarding path, and these public collector routes.' },
    warnings: ['Collector paths are independent route observations and do not identify the current browser path.'],
  };
  await cdp.evaluate(`(()=>{
    const originalFetch=globalThis.fetch;
    const snapshot=${JSON.stringify(snapshot)};
    globalThis.__hopscotchObservedFetch=originalFetch;
    globalThis.fetch=async(input)=>{
      const url=typeof input==='string'?input:(input?.url??String(input));
      if(url.includes('/api/internet/snapshot'))return new Response(JSON.stringify(snapshot),{status:200,headers:{'content-type':'application/json'}});
      return originalFetch(input);
    };
    return true;
  })()`);
  await measuredClickButton(cdp, '.observed-toolbar-controls .visual-drawer-tabs button', 'QUERY');
  await waitForExpression(cdp, `Boolean(document.querySelector('.observed-query button'))`, 8000);
  await measuredClickButton(cdp, '.observed-query button', 'BUILD EVIDENCE SNAPSHOT');
  await waitForExpression(cdp, `Boolean(document.querySelector('.observed-main'))`, 8000);
  await waitForExpression(cdp, `document.querySelectorAll('.evidence-card').length===3`, 8000);
  await cdp.evaluate(`(()=>{if(globalThis.__hopscotchObservedFetch)globalThis.fetch=globalThis.__hopscotchObservedFetch;delete globalThis.__hopscotchObservedFetch;return true})()`);
  const state = await cdp.evaluate(`(()=>({cards:document.querySelectorAll('.evidence-card').length,collectors:document.querySelectorAll('.collector-paths article').length,drawer:document.querySelector('.observed-internet')?.getAttribute('data-inspect-mode'),text:document.querySelector('.observed-internet')?.innerText??''}))()`);
  if (state.cards !== 3 || state.drawer !== 'idle' || !state.text.includes('NO CONTINUOUS OBSERVATION')) throw new Error(`${profile.id} did not build the bounded evidence-island scene.`);
  return state;
}

async function exercisePhase4MeasuredNetwork(cdp, profile) {
  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await waitForExpression(cdp, `document.querySelectorAll('.measured-fact').length>0`, 8000);
  const state = await cdp.evaluate(`(()=>({facts:document.querySelectorAll('.measured-fact').length,categories:document.querySelectorAll('.measured-categories button').length,permanentProvenance:document.querySelectorAll('.measured-main > .measured-provenance-panel').length,source:document.querySelector('.capture-source strong')?.textContent??null}))()`);
  if (state.facts <= 0 || state.categories !== 7 || state.permanentProvenance !== 0) throw new Error(`${profile.id} did not reach the Phase 4 measured analysis layout.`);
  return state;
}

async function dispatchKey(cdp, key, code, modifiers = 0) {
  const windowsVirtualKeyCode = key === 'Tab' ? 9 : key === 'Escape' ? 27 : 0;
  await cdp.call('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, modifiers, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode });
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode });
}

async function capturePhase4EvidenceReview(cdp, profile) {
  mkdirSync(visualReviewDirectory, { recursive: true });
  await waitForExpression(cdp, `!document.querySelector('.visual-entrance')`, 5000);
  await sleep(120);
  const observed = profile.phase4Observed === true;
  const geometry = await cdp.evaluate(`(()=>{
    const rect=(selector)=>{const value=document.querySelector(selector)?.getBoundingClientRect();return value?{left:value.left,top:value.top,right:value.right,bottom:value.bottom,width:value.width,height:value.height}:null};
    const scrollGeometry=(selector)=>{const value=document.querySelector(selector);return value?{clientWidth:value.clientWidth,scrollWidth:value.scrollWidth}:null};
    const toolbar=rect(${JSON.stringify(observed ? '.observed-internet .visual-workspace__toolbar' : '.measured-heading')});
    const hud=rect(${JSON.stringify(observed ? '.observed-internet .visual-workspace__hud' : '.measured-capture-strip')});
    return {
      viewport:{width:innerWidth,height:innerHeight},
      workspace:rect(${JSON.stringify(observed ? '.observed-internet' : '.measured-workspace')}),
      stage:rect(${JSON.stringify(observed ? '.observed-internet .visual-workspace__stage' : '.measured-main')}),
      world:rect(${JSON.stringify(observed ? '.observed-main' : '.measured-scene')}),
      categories:rect('.measured-categories'),toolbar,hud,
      stageScroll:scrollGeometry(${JSON.stringify(observed ? '.observed-main' : '.measured-main')}),
      worldScroll:scrollGeometry(${JSON.stringify(observed ? '.evidence-flow' : '.measured-scene')}),
      toolbarHudOverlap:Boolean(toolbar&&hud&&toolbar.left<hud.right&&toolbar.right>hud.left&&toolbar.top<hud.bottom&&toolbar.bottom>hud.top),
      scrollWidth:document.documentElement.scrollWidth,scrollY,
      permanentProvenance:document.querySelectorAll('.measured-main > .measured-provenance-panel').length,
      collectorPanelInWorld:document.querySelectorAll('.observed-main > .collector-panel').length,
    };
  })()`);
  if (!geometry.workspace || !geometry.stage || !geometry.world) throw new Error(`${profile.id} is missing Phase 4 evidence geometry: ${JSON.stringify(geometry)}.`);
  if (geometry.viewport.width - geometry.workspace.width > 26) throw new Error(`${profile.id} retains a restrictive outer width cap.`);
  if (geometry.world.width < geometry.stage.width * (observed ? 0.94 : 0.68)) throw new Error(`${profile.id} central evidence content is too narrow: ${JSON.stringify(geometry)}.`);
  if (geometry.world.height < geometry.stage.height * (observed ? 0.62 : 0.72)) throw new Error(`${profile.id} central evidence content is too short: ${JSON.stringify(geometry)}.`);
  if (geometry.scrollWidth > geometry.viewport.width || geometry.scrollY !== 0) throw new Error(`${profile.id} overflows or moves the document viewport.`);
  if (profile.width <= 680 && geometry.stageScroll && geometry.stageScroll.scrollWidth > geometry.stageScroll.clientWidth + 1) throw new Error(`${profile.id} mobile evidence stage retains a horizontal scroll rail: ${JSON.stringify(geometry.stageScroll)}.`);
  if (profile.width <= 680 && geometry.worldScroll && geometry.worldScroll.scrollWidth > geometry.worldScroll.clientWidth + 1) throw new Error(`${profile.id} mobile evidence world exceeds its readable width: ${JSON.stringify(geometry.worldScroll)}.`);
  if (observed && geometry.collectorPanelInWorld !== 0) throw new Error(`${profile.id} retained a permanent collector panel in the world.`);
  if (!observed && geometry.permanentProvenance !== 0) throw new Error(`${profile.id} retained a permanent provenance column.`);
  if (observed && geometry.toolbarHudOverlap) throw new Error(`${profile.id} toolbar collides with its truth HUD.`);

  const capture = async (suffix = '') => {
    const screenshot = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const path = join(visualReviewDirectory, `${profile.id}${suffix}.png`);
    writeFileSync(path, Buffer.from(screenshot.data, 'base64'));
    return path;
  };
  const screenshotPath = await capture();
  let inspect = null;
  let setupScreenshotPath = null;
  if (profile.inspectReview) {
    const openerSelector = observed ? '.observed-internet .visual-drawer-tabs button:nth-child(2)' : '.measured-heading .visual-drawer-tabs button:nth-child(2)';
    const openerText = observed ? 'COLLECTORS' : 'PROVENANCE';
    await cdp.evaluate(`document.querySelector(${JSON.stringify(openerSelector)})?.focus()`);
    await measuredClickButton(cdp, openerSelector, openerText);
    await waitForExpression(cdp, `Boolean(document.querySelector(${JSON.stringify(observed ? '.observed-internet .visual-drawer' : '.measured-workspace .visual-drawer')}))`, 8000);
    const drawerSelector = observed ? '.observed-internet .visual-drawer' : '.measured-workspace .visual-drawer';
    const initialFocus = await cdp.evaluate(`document.activeElement?.classList.contains('visual-drawer__close')===true`);
    if (profile.width <= 680) {
      const headerCollision = await cdp.evaluate(`(()=>{
        const corner=document.querySelector('.corner-navigator')?.getBoundingClientRect();
        const title=document.querySelector(${JSON.stringify(`${drawerSelector} .visual-drawer__header > div`)})?.getBoundingClientRect();
        return Boolean(corner&&title&&corner.left<title.right&&corner.right>title.left&&corner.top<title.bottom&&corner.bottom>title.top);
      })()`);
      if (headerCollision) throw new Error(`${profile.id} contextual drawer title collides with corner navigation.`);
    }
    await dispatchKey(cdp, 'Tab', 'Tab', 8);
    const shiftTabContained = await cdp.evaluate(`document.querySelector(${JSON.stringify(drawerSelector)})?.contains(document.activeElement)===true`);
    await dispatchKey(cdp, 'Tab', 'Tab');
    const tabContained = await cdp.evaluate(`document.querySelector(${JSON.stringify(drawerSelector)})?.contains(document.activeElement)===true`);
    const inspectScreenshotPath = await capture('-context');
    await dispatchKey(cdp, 'Escape', 'Escape');
    await waitForExpression(cdp, `!document.querySelector(${JSON.stringify(drawerSelector)})`, 8000);
    const restored = await cdp.evaluate(`document.activeElement===document.querySelector(${JSON.stringify(openerSelector)})`);
    if (!initialFocus || !shiftTabContained || !tabContained || !restored) throw new Error(`${profile.id} contextual drawer focus lifecycle failed.`);
    inspect = { initialFocus, shiftTabContained, tabContained, restored, screenshotPath: inspectScreenshotPath };

    if (!observed) {
      const setupSelector = '.measured-heading .visual-drawer-tabs button:nth-child(1)';
      await measuredClickButton(cdp, setupSelector, 'SETUP');
      await waitForExpression(cdp, `Boolean(document.querySelector('.measured-workspace .visual-drawer'))`);
      setupScreenshotPath = await capture('-setup');
      await dispatchKey(cdp, 'Escape', 'Escape');
      await waitForExpression(cdp, `!document.querySelector('.measured-workspace .visual-drawer')`);
    }
  }
  return { geometry, screenshotPath, inspect, setupScreenshotPath };
}

async function captureVisualReview(cdp, profile) {
  mkdirSync(visualReviewDirectory, { recursive: true });
  await sleep(900);
  const geometry = await cdp.evaluate(`(()=>{
    const rect=(selector)=>{const value=document.querySelector(selector)?.getBoundingClientRect();return value?{left:value.left,top:value.top,right:value.right,bottom:value.bottom,width:value.width,height:value.height}:null};
    const semanticRects=${JSON.stringify(profile.semanticSelector ?? '')}?[...document.querySelectorAll(${JSON.stringify(profile.semanticSelector ?? '')})].map((value)=>value.getBoundingClientRect()).filter((value)=>value.width>0&&value.height>0):[];
    const semanticBounds=semanticRects.length===0?null:{left:Math.min(...semanticRects.map((value)=>value.left)),top:Math.min(...semanticRects.map((value)=>value.top)),right:Math.max(...semanticRects.map((value)=>value.right)),bottom:Math.max(...semanticRects.map((value)=>value.bottom))};
    const toolbar=rect(${JSON.stringify(profile.toolbarSelector)});
    const hud=rect(${JSON.stringify(profile.hudSelector)});
    return {
      viewport:{width:innerWidth,height:innerHeight},
      workspace:rect(${JSON.stringify(profile.workspaceSelector)}),
      stage:rect(${JSON.stringify(profile.stageSelector)}),
      world:rect(${JSON.stringify(profile.worldSelector)}),
      toolbar,
      hud,
      semanticBounds:semanticBounds?{...semanticBounds,width:semanticBounds.right-semanticBounds.left,height:semanticBounds.bottom-semanticBounds.top}:null,
      toolbarHudOverlap:Boolean(toolbar&&hud&&toolbar.left<hud.right&&toolbar.right>hud.left&&toolbar.top<hud.bottom&&toolbar.bottom>hud.top),
    };
  })()`);
  if (!geometry.workspace || !geometry.stage || !geometry.world) throw new Error(`${profile.id} is missing visual review geometry: ${JSON.stringify(geometry)}.`);
  const outerGutter = geometry.viewport.width - geometry.workspace.width;
  if (outerGutter > 26) throw new Error(`${profile.id} leaves ${outerGutter.toFixed(1)}px of outer desktop gutter.`);
  if (geometry.world.width < geometry.stage.width * 0.96 || geometry.world.height < geometry.stage.height * 0.9) throw new Error(`${profile.id} world does not own its stage: ${JSON.stringify(geometry)}.`);
  if (geometry.toolbarHudOverlap) throw new Error(`${profile.id} toolbar collides with its persistent HUD.`);
  if (profile.semanticMinWidthRatio && (!geometry.semanticBounds || geometry.semanticBounds.width < geometry.world.width * profile.semanticMinWidthRatio)) throw new Error(`${profile.id} semantic content is compressed horizontally inside its stage: ${JSON.stringify(geometry)}.`);
  if (profile.semanticMinHeightRatio && (!geometry.semanticBounds || geometry.semanticBounds.height < geometry.world.height * profile.semanticMinHeightRatio)) throw new Error(`${profile.id} semantic content is compressed vertically inside its stage: ${JSON.stringify(geometry)}.`);
  if (profile.hiddenHitSelector) {
    const hitTarget = await cdp.evaluate(`(()=>{const value=document.querySelector(${JSON.stringify(profile.hiddenHitSelector)});if(!value)return null;const stroke=getComputedStyle(value).stroke;const channels=stroke.match(/[\\d.]+/g)?.map(Number)??[];return {stroke,transparent:stroke==='none'||stroke==='transparent'||(channels.length>=4&&channels[3]===0)}})()`);
    if (!hitTarget?.transparent) throw new Error(`${profile.id} exposes an interaction hit target as visible topology: ${JSON.stringify(hitTarget)}.`);
  }
  if (profile.motionSelector) {
    const motionStart = await cdp.evaluate(`(()=>{const value=document.querySelector(${JSON.stringify(profile.motionSelector)})?.getBoundingClientRect();return value?{left:value.left,top:value.top}:null})()`);
    await sleep(180);
    const motionEnd = await cdp.evaluate(`(()=>{const value=document.querySelector(${JSON.stringify(profile.motionSelector)})?.getBoundingClientRect();return value?{left:value.left,top:value.top}:null})()`);
    if (!motionStart || !motionEnd || Math.hypot(motionEnd.left - motionStart.left, motionEnd.top - motionStart.top) < 1) throw new Error(`${profile.id} semantic route signal is absent or static: ${JSON.stringify({ motionStart, motionEnd })}.`);
    if (motionEnd.left < geometry.world.left || motionEnd.left > geometry.world.right || motionEnd.top < geometry.world.top || motionEnd.top > geometry.world.bottom) throw new Error(`${profile.id} semantic route signal escaped its topology: ${JSON.stringify({ motionEnd, world: geometry.world })}.`);
  }

  const capture = async (suffix = '') => {
    const screenshot = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const path = join(visualReviewDirectory, `${profile.id}${suffix}.png`);
    writeFileSync(path, Buffer.from(screenshot.data, 'base64'));
    return path;
  };
  const screenshotPath = await capture();
  let inspect = null;
  if (profile.inspectReview) {
    if (profile.inspectRevealSelector) {
      await measuredClickButton(cdp, profile.inspectRevealSelector, 'NETWORK TOOLS');
      await waitForExpression(cdp, `document.querySelector(${JSON.stringify(profile.inspectRevealSelector)})?.getAttribute('aria-expanded')==='true'`, 8000);
    }
    await cdp.evaluate(`document.querySelector(${JSON.stringify(profile.inspectButtonSelector)})?.focus()`);
    await measuredClickButton(cdp, profile.inspectButtonSelector, 'INSPECT');
    await waitForExpression(cdp, `Boolean(document.querySelector(${JSON.stringify(profile.drawerSelector)}))`, 8000);
    await sleep(120);
    const initialFocus = await cdp.evaluate(`(()=>({
      inside:Boolean(document.querySelector(${JSON.stringify(profile.drawerSelector)})?.contains(document.activeElement)),
      label:document.activeElement?.getAttribute('aria-label')??document.activeElement?.textContent?.trim()??null,
    }))()`);
    if (!initialFocus.inside || !String(initialFocus.label).toUpperCase().includes('CLOSE')) throw new Error(`${profile.id} drawer did not focus its close control: ${JSON.stringify(initialFocus)}.`);
    if (profile.drawerSurfaceSelector) {
      const drawerSurface = await cdp.evaluate(`(()=>{
        const surface=document.querySelector(${JSON.stringify(profile.drawerSurfaceSelector)});
        if(!surface)return null;
        const channels=getComputedStyle(surface).backgroundColor.match(/[\\d.]+/g)?.map(Number)??[];
        const linear=channels.slice(0,3).map((channel)=>{const normalized=channel/255;return normalized<=.04045?normalized/12.92:((normalized+.055)/1.055)**2.4});
        return {background:getComputedStyle(surface).backgroundColor,alpha:channels.length>=4?channels[3]:1,luminance:.2126*linear[0]+.7152*linear[1]+.0722*linear[2]};
      })()`);
      if (!drawerSurface || (drawerSurface.alpha > .08 && drawerSurface.luminance < .45)) throw new Error(`${profile.id} drawer retains an opaque legacy-dark inner surface: ${JSON.stringify(drawerSurface)}.`);
    }
    if (profile.width <= 680) {
      const mobileHeader = await cdp.evaluate(`(()=>{
        const rect=(selector)=>{const value=document.querySelector(selector)?.getBoundingClientRect();return value?{left:value.left,top:value.top,right:value.right,bottom:value.bottom,width:value.width,height:value.height}:null};
        const drawer=document.querySelector(${JSON.stringify(profile.drawerSelector)});
        const title=rect(${JSON.stringify(profile.drawerTitleSelector ?? `${profile.drawerSelector} .visual-drawer__header > div`)});
        const topElement=title?document.elementFromPoint((title.left+title.right)/2,(title.top+title.bottom)/2):null;
        const channels=drawer?getComputedStyle(drawer).backgroundColor.match(/[\\d.]+/g)?.map(Number)??[]:[];
        return {corner:rect('.corner-navigator'),title,backgroundAlpha:channels.length>=4?channels[3]:1,titleOnTop:Boolean(drawer&&topElement&&drawer.contains(topElement))};
      })()`);
      if (mobileHeader.corner && mobileHeader.title && mobileHeader.corner.left < mobileHeader.title.right && mobileHeader.corner.right > mobileHeader.title.left && mobileHeader.corner.top < mobileHeader.title.bottom && mobileHeader.corner.bottom > mobileHeader.title.top) throw new Error(`${profile.id} mobile drawer title collides with corner navigation.`);
      if (!mobileHeader.titleOnTop || mobileHeader.backgroundAlpha < .99) throw new Error(`${profile.id} mobile drawer is not an opaque top-layer surface: ${JSON.stringify(mobileHeader)}.`);
    }
    await dispatchKey(cdp, 'Tab', 'Tab', 8);
    const shiftTabContained = await cdp.evaluate(`document.querySelector(${JSON.stringify(profile.drawerSelector)})?.contains(document.activeElement)===true`);
    if (!shiftTabContained) throw new Error(`${profile.id} drawer let Shift+Tab escape its modal focus scope.`);
    await dispatchKey(cdp, 'Tab', 'Tab');
    const tabContained = await cdp.evaluate(`document.querySelector(${JSON.stringify(profile.drawerSelector)})?.contains(document.activeElement)===true`);
    if (!tabContained) throw new Error(`${profile.id} drawer let Tab escape its modal focus scope.`);
    const inspectScreenshotPath = await capture('-inspect');
    await dispatchKey(cdp, 'Escape', 'Escape');
    await waitForExpression(cdp, `!document.querySelector(${JSON.stringify(profile.drawerSelector)})`, 8000);
    const restored = await cdp.evaluate(`document.activeElement===document.querySelector(${JSON.stringify(profile.inspectButtonSelector)})`);
    if (!restored) throw new Error(`${profile.id} drawer did not restore focus to its opener.`);
    inspect = { initialFocus, shiftTabContained, tabContained, restored, screenshotPath: inspectScreenshotPath };
  }
  return { geometry, screenshotPath, inspect };
}

async function loadProfile(cdp, origin, profile) {
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
  const startedAt = performance.now();
  await cdp.call('Page.navigate', { url: `${origin}${profile.path ?? '/'}${profile.query}` });
  await waitForExpression(cdp, `Boolean(document.querySelector(${JSON.stringify(profile.readySelector ?? '.journey-visual-workspace')}))`);
  await sleep(550);
  const phase4Interaction = profile.phase4Observed
    ? await exercisePhase4ObservedInternet(cdp, profile)
    : profile.phase4Measured
      ? await exercisePhase4MeasuredNetwork(cdp, profile)
      : null;
  const builderOspfInteraction = profile.builderOspf ? await exerciseBuilderOspf(cdp, profile) : null;
  const measuredInteraction = profile.measuredWorkspace
    ? await exerciseMeasuredWorkspace(cdp, profile)
    : profile.measuredSidecars
      ? await exerciseMeasuredJourneySidecars(cdp, profile)
      : null;
  const readyMs = performance.now() - startedAt;
  for (const expected of profile.expected) {
    await waitForExpression(cdp, `document.body.innerText.toLocaleUpperCase().includes(${JSON.stringify(expected.toLocaleUpperCase())})`, 8000);
  }
  const bodyText = await cdp.evaluate('document.body.innerText');
  for (const expected of profile.expected) {
    if (!bodyText.toLocaleUpperCase().includes(expected.toLocaleUpperCase())) throw new Error(`${profile.id} did not reach expected semantic text: ${JSON.stringify(expected)}`);
  }
  if (profile.reducedMotion && !(await cdp.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'))) {
    throw new Error(`${profile.id} did not enable reduced motion.`);
  }

  const visualReviewResult = profile.phase4VisualReview
    ? await capturePhase4EvidenceReview(cdp, profile)
    : profile.visualReview
      ? await captureVisualReview(cdp, profile)
      : null;

  const hasJourneyWorkspace = await cdp.evaluate(`Boolean(document.querySelector('.journey-visual-workspace'))`);
  if (hasJourneyWorkspace) {
    await waitForExpression(cdp, `!document.querySelector('.visual-entrance')`, 8000);
    await sleep(80);
  }
  const journeyDrawer = hasJourneyWorkspace ? await inspectJourneyDrawerArchitecture(cdp, profile) : null;

  await cdp.call('HeapProfiler.collectGarbage');
  const heap = await cdp.call('Runtime.getHeapUsage');
  const performanceMetrics = Object.fromEntries((await cdp.call('Performance.getMetrics')).metrics.map((metric) => [metric.name, metric.value]));
  const structural = await cdp.evaluate(`(()=>{
    return {
      elementCount: document.getElementsByTagName('*').length,
      eventCount: document.querySelectorAll('.visual-time-rail__events button').length,
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollY,
      heading: document.querySelector('.visual-identity > strong')?.textContent ?? null,
      measured: {
        loaded: document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded') ?? null,
        categoryButtons: document.querySelectorAll('.measured-categories button').length,
        visibleFacts: document.querySelectorAll('.measured-fact').length,
      },
      protocol: (()=>{
        const stage=document.querySelector('.protocol-visual-workspace .visual-workspace__stage')?.getBoundingClientRect();
        const scene=document.querySelector('.protocol-cinematic-stage')?.getBoundingClientRect();
        return {
          active:Boolean(stage&&scene),
          stageWidth:stage?.width??0,
          stageHeight:stage?.height??0,
          sceneWidth:scene?.width??0,
          sceneHeight:scene?.height??0,
          drawerTabs:document.querySelectorAll('.protocol-visual-workspace .visual-drawer-tabs button').length,
          timeRail:Boolean(document.querySelector('.protocol-visual-workspace .visual-time-rail')),
          permanentInspectors:document.querySelectorAll('.tcp-inspector,.dns-inspector,.tls-inspector,.http-inspector').length,
        };
      })(),
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
  structural.modifierControls = journeyDrawer?.modifierControls ?? [];
  structural.drawerArchitecture = journeyDrawer;

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

  if (profile.protocolWorkspace) {
    if (!structural.protocol.active) throw new Error(`${profile.id} did not render a protocol scene inside the shared visual workspace.`);
    if (structural.protocol.sceneWidth < structural.protocol.stageWidth * 0.98 || structural.protocol.sceneHeight < structural.protocol.stageHeight * 0.98) throw new Error(`${profile.id} scene does not occupy the visual stage: ${JSON.stringify(structural.protocol)}.`);
    if (structural.protocol.drawerTabs < 3) throw new Error(`${profile.id} exposed only ${structural.protocol.drawerTabs} on-demand workspace tools.`);
    if (!structural.protocol.timeRail) throw new Error(`${profile.id} did not render the shared Time Rail.`);
    if (structural.protocol.permanentInspectors !== 0) throw new Error(`${profile.id} retained ${structural.protocol.permanentInspectors} permanent legacy inspector(s).`);
  }

  if (profile.assertMobileGrid) {
    if (structural.modifierControls.length !== 10) throw new Error(`Expected 10 GOD MODE controls, found ${structural.modifierControls.length}.`);
    if (structural.drawerArchitecture?.modifierColumns !== 3) throw new Error(`Expected a three-column mobile GOD MODE grid, found ${structural.drawerArchitecture?.modifierColumns ?? 0} columns.`);
    for (const button of structural.modifierControls) {
      if (button.width < 40 || button.height < 32) throw new Error(`Mobile GOD MODE control ${button.text} is too small: ${button.width}×${button.height}.`);
    }
    const finalControl = structural.modifierControls.at(-1);
    if (finalControl?.text !== 'LEAK') throw new Error(`Unexpected final mobile control: ${finalControl?.text ?? 'missing'}`);
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
    drawerArchitecture: structural.drawerArchitecture,
    stress: structural.stress,
    measured: measuredInteraction,
    phase4Evidence: phase4Interaction,
    protocol: structural.protocol,
    builderOspf: builderOspfInteraction,
    visualReview: visualReviewResult,
    heapUsedBytes: heap.usedSize,
    diagnostic: {
      scriptDurationSeconds: performanceMetrics.ScriptDuration ?? null,
      layoutDurationSeconds: performanceMetrics.LayoutDuration ?? null,
      recalcStyleDurationSeconds: performanceMetrics.RecalcStyleDuration ?? null,
      taskDurationSeconds: performanceMetrics.TaskDuration ?? null,
    },
  };
}

async function seekStress(cdp, origin, cycles = stressConfig.seekCycles, id = 'max-composed-seek-stress') {
  const profile = {
    id,
    width: 1440,
    height: 1000,
    reducedMotion: false,
    query: query({ journey: '2', host: 'example.test', transport: 'quic-h3', dns: 'cache-miss', mods: maxModifierSet, t: '0' }),
    expected: ['DNS FAIL + ROUTE + LEAK + SERVER + LOSS + LATENCY + CONGESTION + PARTITION'],
  };
  await loadProfile(cdp, origin, profile);
  await cdp.call('HeapProfiler.collectGarbage');
  const before = await cdp.call('Runtime.getHeapUsage');
  const beforeState = await cdp.evaluate(`(()=>({
    eventCount:document.querySelectorAll('.visual-time-rail__events button').length,
    heading:document.querySelector('.visual-identity > strong')?.textContent ?? null,
    scrollY,
    elementCount:document.getElementsByTagName('*').length,
  }))()`);
  const startedAt = performance.now();
  const stressResult = await cdp.evaluate(`(async()=>{
    const cycles=${Number(cycles)};
    const buttons=[...document.querySelectorAll('.visual-time-rail__events button')];
    for(let cycle=0;cycle<cycles;cycle+=1){
      for(const button of buttons){
        button.click();
        await new Promise((resolve)=>requestAnimationFrame(()=>resolve()));
      }
    }
    await new Promise((resolve)=>setTimeout(resolve,${Number(stressConfig.settleMs)}));
    return {
      eventCount:document.querySelectorAll('.visual-time-rail__events button').length,
      heading:document.querySelector('.visual-identity > strong')?.textContent ?? null,
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
  let production = null;
  const report = {
    schema: phase4VisualReview ? 'hopscotch.phase4-evidence-visual-review' : phase3VisualReview ? 'hopscotch.phase3-visual-review' : 'hopscotch.performance-profile',
    version: 1,
    generatedAt: new Date().toISOString(),
    enforce,
    compatibility,
    visualReview,
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
    production = await serveProductionArtifact(distDir);
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

    for (const profile of profiles) report.profiles.push(await loadProfile(cdp, production.origin, profile));
    if (!compatibility && !visualReview) {
      report.seekStress = await seekStress(cdp, production.origin);
      report.highDensitySeekStress = await seekStress(cdp, production.origin, stressBudgets.highDensitySeek?.cycles ?? 12, 'high-density-seek-stress');

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
    if (launch?.userDataDir) rmSync(launch.userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    if (production) await new Promise((resolvePromise) => production.server.close(resolvePromise));
    report.browser.stderrTail = launch?.state.stderr || null;
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(`HOPSCOTCH production ${phase4VisualReview ? 'Phase 4 visual review' : phase3VisualReview ? 'Phase 3 visual review' : compatibility ? 'compatibility' : 'performance'} profile (${report.browser.version ?? 'browser unknown'})`);
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
    console.log(phase4VisualReview ? 'Phase 4 evidence production visual review capture and geometry checks passed.' : phase3VisualReview ? 'Phase 3 production visual review capture and geometry checks passed.' : compatibility ? `Compatibility semantic profile passed for GPU mode ${gpuMode}.` : 'Stable performance and high-density stress budgets passed.');
  }
}

await main();

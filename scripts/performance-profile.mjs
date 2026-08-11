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

async function waitForExpression(cdp, expression, timeoutMs = 5000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await cdp.evaluate(expression)) return;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
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

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  dnsQuery,
  dnsResponse,
  pcapCapture,
  pcapngSection,
  tcpIpv4Frame,
  tlsClientHello,
  udpIpv4Frame,
} from './capture-fixtures.mjs';
import { serveProductionArtifact } from './production-artifact-server.mjs';

const root = process.cwd();
const distDir = resolve(root, 'dist');
const reportPath = resolve(root, process.env.HOPSCOTCH_CAPTURE_BROWSER_REPORT_PATH?.trim() || 'artifacts/capture-browser.json');
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function executableFromPath(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function findChrome() {
  const explicit = process.env.CHROME_PATH?.trim();
  if (explicit) return explicit;
  for (const command of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    const found = executableFromPath(command);
    if (found) return found;
  }
  for (const candidate of ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome/Chromium not found. Set CHROME_PATH to an installed Chrome-compatible browser.');
}

async function freePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return address.port;
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

class CdpClient {
  constructor(url) {
    this.nextId = 0;
    this.pending = new Map();
    this.events = [];
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolvePromise, reject) => {
      this.socket.addEventListener('open', resolvePromise, { once: true });
      this.socket.addEventListener('error', () => reject(new Error(`Unable to open ${url}`)), { once: true });
    });
    this.socket.addEventListener('message', async (message) => {
      const raw = typeof message.data === 'string' ? message.data : Buffer.from(await message.data.arrayBuffer()).toString('utf8');
      const payload = JSON.parse(raw);
      if (payload.id !== undefined) {
        const pending = this.pending.get(payload.id);
        if (!pending) return;
        this.pending.delete(payload.id);
        if (payload.error) pending.reject(new Error(`${pending.method}: ${payload.error.message}`));
        else pending.resolve(payload.result ?? {});
      } else this.events.push(payload);
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

  close() { try { this.socket.close(); } catch { /* cleanup */ } }
}

async function waitForExpression(cdp, expression, timeoutMs = 8000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await cdp.evaluate(expression)) return;
    await sleep(40);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function setFileInput(cdp, selector, filePath) {
  const document = await cdp.call('DOM.getDocument', { depth: 1 });
  const result = await cdp.call('DOM.querySelector', { nodeId: document.root.nodeId, selector });
  if (!result.nodeId) throw new Error(`Unable to find ${selector}`);
  await cdp.call('DOM.setFileInputFiles', { nodeId: result.nodeId, files: [filePath] });
}

async function clickText(cdp, selector, text) {
  const clicked = await cdp.evaluate(`(()=>{const target=[...document.querySelectorAll(${JSON.stringify(selector)})].find((candidate)=>candidate.textContent?.includes(${JSON.stringify(text)}));if(!target)return false;target.click();return true})()`);
  if (!clicked) throw new Error(`Unable to click ${selector} containing ${JSON.stringify(text)}`);
}

function makeFixtures(directory) {
  const aToB = (payload = new Uint8Array(), options = {}) => tcpIpv4Frame(payload, {
    sourceAddress: '192.0.2.10', destinationAddress: '198.51.100.42', sourcePort: 50000, destinationPort: 443, ...options,
  });
  const bToA = (payload = new Uint8Array(), options = {}) => tcpIpv4Frame(payload, {
    sourceAddress: '198.51.100.42', destinationAddress: '192.0.2.10', sourcePort: 443, destinationPort: 50000, ...options,
  });
  const dnsRequest = udpIpv4Frame(dnsQuery({ id: 0x5151 }), { sourceAddress: '192.0.2.10', destinationAddress: '192.0.2.53', sourcePort: 53000, destinationPort: 53 });
  const dnsReply = udpIpv4Frame(dnsResponse({ id: 0x5151 }), { sourceAddress: '192.0.2.53', destinationAddress: '192.0.2.10', sourcePort: 53, destinationPort: 53000 });
  const records = [
    { bytes: aToB(new Uint8Array(), { sequence: 1000, flags: 0x02 }), fraction: 0 },
    { bytes: bToA(new Uint8Array(), { sequence: 9000, acknowledgment: 1001, flags: 0x12 }), fraction: 100_000 },
    { bytes: aToB(new Uint8Array(), { sequence: 1001, acknowledgment: 9001, flags: 0x10 }), fraction: 200_000 },
    { bytes: aToB(tlsClientHello({ serverName: 'example.test', alpn: ['h2'] }), { sequence: 1001, acknowledgment: 9001, flags: 0x18 }), fraction: 300_000 },
    { bytes: dnsRequest, fraction: 400_000 },
    { bytes: dnsReply, fraction: 500_000 },
  ];
  const pcapPath = join(directory, 'track-t-fixture.pcap');
  const pcapngPath = join(directory, 'track-t-fixture.pcapng');
  const invalidPath = join(directory, 'track-t-invalid.pcap');
  writeFileSync(pcapPath, pcapCapture(records));
  writeFileSync(pcapngPath, pcapngSection({
    interfaces: [{ linkType: 1, snapLength: 262144, tsresol: 9 }],
    packets: [{ bytes: dnsRequest, ticks: 1_000_000_000n }, { bytes: dnsReply, ticks: 1_100_000_000n }],
  }));
  writeFileSync(invalidPath, Uint8Array.of(0x0a, 0x0d, 0x0d));
  return { pcapPath, pcapngPath, invalidPath };
}

async function exerciseProfile(cdp, origin, fixtures, profile) {
  cdp.events.length = 0;
  await cdp.call('Emulation.setDeviceMetricsOverride', { width: profile.width, height: profile.height, deviceScaleFactor: 1, mobile: profile.width <= 520 });
  await cdp.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: profile.reducedMotion ? 'reduce' : 'no-preference' }] });
  await cdp.call('Page.navigate', { url: `${origin}/capture` });
  await waitForExpression(cdp, `Boolean(document.querySelector('.capture-replay'))`);
  await waitForExpression(cdp, `document.body.innerText.includes('DROP PCAP / PCAPNG')`);

  await setFileInput(cdp, '.capture-file-input', fixtures.pcapPath);
  await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-capture-loaded')==='true'`);
  await waitForExpression(cdp, `document.querySelectorAll('.capture-event-rail button').length >= 3`);

  const loaded = await cdp.evaluate(`(()=>({
    pathname:location.pathname,
    text:document.body.innerText,
    innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    flowCount:document.querySelectorAll('.capture-flow-list button').length,
    eventCount:document.querySelectorAll('.capture-event-rail button').length,
    byteCount:document.querySelectorAll('.capture-hex-grid > span').length,
    elementCount:document.getElementsByTagName('*').length,
    reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
  }))()`);
  if (loaded.pathname !== '/capture') throw new Error(`${profile.id} lost the canonical capture route.`);
  if (loaded.scrollWidth > loaded.innerWidth) throw new Error(`${profile.id} capture workspace overflows ${loaded.scrollWidth} > ${loaded.innerWidth}.`);
  if (loaded.flowCount < 2 || loaded.eventCount < 3) throw new Error(`${profile.id} did not expose the synthetic conversations/events.`);
  if (loaded.byteCount > 256) throw new Error(`${profile.id} rendered more than one bounded byte page.`);
  if (loaded.elementCount > 1600) throw new Error(`${profile.id} capture DOM is unexpectedly dense: ${loaded.elementCount}.`);
  if (!loaded.text.includes('CAPTURED + INFERRED') || !loaded.text.includes('WHY HOPSCOTCH SAID THIS')) throw new Error(`${profile.id} lost provenance or lineage.`);
  if (loaded.reducedMotion !== profile.reducedMotion) throw new Error(`${profile.id} reduced-motion emulation was not preserved.`);

  await cdp.evaluate(`document.querySelectorAll('.capture-event-rail button')[1]?.click()`);
  await clickText(cdp, '.capture-time-controls button', '▶');
  await sleep(80);
  const pause = await cdp.evaluate(`Boolean([...document.querySelectorAll('.capture-time-controls button')].find((button)=>button.getAttribute('aria-label')==='Pause capture replay'))`);
  if (pause) await clickText(cdp, '.capture-time-controls button', 'Ⅱ');
  const scrubbed = await cdp.evaluate(`(()=>{const input=document.querySelector('.capture-scrubber input');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,input.max);input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  if (!scrubbed) throw new Error(`${profile.id} could not scrub capture time.`);
  await clickText(cdp, '.capture-open-microscope', 'OPEN READ-ONLY PACKET MICROSCOPE');
  await waitForExpression(cdp, `document.querySelector('.packet-microscope')?.getAttribute('data-packet-provenance')==='CAPTURED'`);
  await clickText(cdp, '.packet-field-list button', 'Sequence Number');
  await waitForExpression(cdp, `document.querySelectorAll('.packet-byte.highlighted').length > 0`);
  const microscope = await cdp.evaluate(`(()=>({
    provenance:document.querySelector('.packet-microscope')?.getAttribute('data-packet-provenance'),
    rangeControls:document.querySelectorAll('.packet-microscope input[type="range"]').length,
    highlighted:document.querySelectorAll('.packet-byte.highlighted').length,
    text:document.querySelector('.packet-microscope')?.innerText??'',
  }))()`);
  if (microscope.provenance !== 'CAPTURED' || microscope.rangeControls !== 0 || microscope.highlighted <= 0 || !microscope.text.includes('CAPTURED · READ ONLY')) {
    throw new Error(`${profile.id} captured Packet Microscope crossed the read-only boundary.`);
  }
  await clickText(cdp, '.packet-origin-strip button', 'RETURN TO CAPTURE');
  await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-capture-loaded')==='true'`);

  await setFileInput(cdp, '.capture-file-input', fixtures.invalidPath);
  await waitForExpression(cdp, `document.body.innerText.includes('REPLACEMENT REJECTED')`);
  const preserved = await cdp.evaluate(`document.querySelector('.capture-replay')?.getAttribute('data-capture-loaded')==='true'&&document.body.innerText.includes('The previous valid capture remains active.')`);
  if (!preserved) throw new Error(`${profile.id} malformed replacement corrupted the valid capture session.`);

  await setFileInput(cdp, '.capture-file-input', fixtures.pcapngPath);
  await waitForExpression(cdp, `document.body.innerText.includes('track-t-fixture.pcapng') && document.body.innerText.includes('PCAPNG')`);
  await clickText(cdp, '.capture-clear', 'CLEAR');
  await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-capture-loaded')==='false'`);

  const errors = cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown'
    || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
    || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error'));
  if (errors.length > 0) throw new Error(`${profile.id} emitted ${errors.length} runtime/console error(s): ${JSON.stringify(errors.slice(0, 2))}`);
  return { id: profile.id, viewport: { width: profile.width, height: profile.height }, reducedMotion: profile.reducedMotion, ...loaded, malformedReplacementPreserved: true, pcapngReplacementVerified: true, capturedMicroscopeVerified: true };
}

async function main() {
  if (typeof WebSocket === 'undefined') throw new Error('Node 24 WebSocket support is required.');
  const chromePath = findChrome();
  const fixtureDirectory = mkdtempSync(join(tmpdir(), 'hopscotch-capture-fixtures-'));
  const userDataDirectory = mkdtempSync(join(tmpdir(), 'hopscotch-capture-chrome-'));
  const fixtures = makeFixtures(fixtureDirectory);
  const production = await serveProductionArtifact(distDir);
  const debuggingPort = await freePort();
  const chrome = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-default-apps', '--disable-extensions', '--disable-sync', '--mute-audio',
    `--remote-debugging-port=${debuggingPort}`, '--remote-debugging-address=127.0.0.1', '--remote-allow-origins=*', `--user-data-dir=${userDataDirectory}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  chrome.stderr.setEncoding('utf8');
  chrome.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-16000); });
  const report = { schema: 'hopscotch.capture-browser', version: 1, browser: { path: chromePath }, profiles: [], failures: [] };
  let cdp = null;
  try {
    const version = await waitForDevTools(debuggingPort);
    report.browser.version = version.Browser ?? null;
    const targets = await fetchJson(`http://127.0.0.1:${debuggingPort}/json`);
    const page = targets.find((target) => target.type === 'page');
    if (!page?.webSocketDebuggerUrl) throw new Error('Chrome did not expose a page target.');
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('DOM.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Log.enable');
    for (const profile of [
      { id: 'capture-desktop', width: 1440, height: 1000, reducedMotion: false },
      { id: 'capture-mobile', width: 390, height: 844, reducedMotion: false },
      { id: 'capture-reduced-motion', width: 1280, height: 900, reducedMotion: true },
    ]) report.profiles.push(await exerciseProfile(cdp, production.origin, fixtures, profile));
  } catch (error) {
    report.failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
  } finally {
    if (cdp) { try { await cdp.call('Browser.close'); } catch { /* cleanup */ } cdp.close(); }
    if (!chrome.killed) chrome.kill('SIGKILL');
    await new Promise((resolvePromise) => production.server.close(resolvePromise));
    report.browser.stderrTail = stderr || null;
    rmSync(fixtureDirectory, { recursive: true, force: true });
    rmSync(userDataDirectory, { recursive: true, force: true });
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`HOPSCOTCH capture production browser check (${report.browser.version ?? 'unknown browser'})`);
  for (const profile of report.profiles) console.log(`${profile.id}: ${profile.flowCount} flows · ${profile.eventCount} events · ${profile.byteCount} visible bytes · DOM ${profile.elementCount}`);
  console.log(`Report: ${reportPath}`);
  if (report.failures.length > 0) { for (const failure of report.failures) console.error(failure); process.exitCode = 1; }
  else console.log('Capture browser check passed: PCAP/PCAPNG import, rejected replacement preservation, time controls, lineage, read-only microscopy, desktop/mobile/reduced motion, and console health.');
}

await main();

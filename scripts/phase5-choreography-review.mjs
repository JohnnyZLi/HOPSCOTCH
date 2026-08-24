import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { serveProductionArtifact } from './production-artifact-server.mjs';

const distDir = resolve(process.cwd(), 'dist');
const outputDir = resolve(process.cwd(), 'artifacts/phase5-choreography-review');
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
  const userDataDir = mkdtempSync(join(tmpdir(), 'hopscotch-phase5-choreo-'));
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

async function waitForExpression(cdp, expression, timeoutMs = 10000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await cdp.evaluate(expression)) return;
    await sleep(35);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function screenshot(cdp, filename) {
  const result = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(join(outputDir, filename), Buffer.from(result.data, 'base64'));
}

function eventSelector(title) {
  return JSON.stringify(title);
}

async function seekEvent(cdp, title) {
  const sought = await cdp.evaluate(`(()=>{
    const title=${eventSelector(title)};
    const marker=[...document.querySelectorAll('.visual-time-rail__events button')].find((button)=>(button.getAttribute('aria-label')||'').startsWith(title+' at '));
    if(!marker)return false;
    marker.click();
    return true;
  })()`);
  assert.equal(sought, true, `Could not seek to Journey event: ${title}`);
  await sleep(45);
}

async function metric(cdp, selector) {
  return cdp.evaluate(`(()=>{
    const el=document.querySelector(${JSON.stringify(selector)});
    if(!el)return null;
    const r=el.getBoundingClientRect();
    const s=getComputedStyle(el);
    return {
      selector:${JSON.stringify(selector)},
      left:r.left,top:r.top,width:r.width,height:r.height,
      centerX:r.left+r.width/2,centerY:r.top+r.height/2,
      transform:s.transform,opacity:s.opacity,
      transitionDuration:s.transitionDuration,
      animationName:s.animationName,
      animationDuration:s.animationDuration,
    };
  })()`);
}

function numericDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY) + Math.abs(a.width - b.width) + Math.abs(a.height - b.height);
}

function changed(a, b) {
  if (!a || !b) return false;
  return a.transform !== b.transform || a.opacity !== b.opacity || numericDistance(a, b) > 0.5;
}

async function transitionEvidence(cdp, spec, report) {
  await seekEvent(cdp, spec.from);
  await sleep(spec.settleBefore ?? 1750);
  const before = await metric(cdp, spec.selector);
  assert.ok(before, `${spec.id}: target missing before transition: ${spec.selector}`);

  await seekEvent(cdp, spec.to);
  await sleep(spec.earlyMs ?? 90);
  const early = await metric(cdp, spec.selector);
  await screenshot(cdp, `${spec.id}-early.png`);

  await sleep((spec.midMs ?? 650) - (spec.earlyMs ?? 90));
  const mid = await metric(cdp, spec.selector);
  await screenshot(cdp, `${spec.id}-mid.png`);

  await sleep((spec.endMs ?? 1750) - (spec.midMs ?? 650));
  const end = await metric(cdp, spec.selector);
  await screenshot(cdp, `${spec.id}-settled.png`);

  assert.ok(early && mid && end, `${spec.id}: target disappeared during transition.`);
  assert.ok(changed(before, mid), `${spec.id}: target did not move/change from its previous deterministic state.`);
  assert.ok(changed(early, mid) || changed(mid, end), `${spec.id}: target snapped directly to a static state; no measurable in-transition choreography.`);
  if (spec.minCenterTravel) {
    const travel = Math.max(numericDistance(before, mid), numericDistance(before, end));
    assert.ok(travel >= spec.minCenterTravel, `${spec.id}: expected at least ${spec.minCenterTravel}px of visual travel, measured ${travel.toFixed(2)}.`);
  }

  report.transitions.push({ id: spec.id, from: spec.from, to: spec.to, selector: spec.selector, before, early, mid, end });
}

async function animationEvidence(cdp, spec, report) {
  await seekEvent(cdp, spec.event);
  await sleep(spec.earlyMs ?? 110);
  const early = await metric(cdp, spec.selector);
  await screenshot(cdp, `${spec.id}-early.png`);
  await sleep((spec.midMs ?? 760) - (spec.earlyMs ?? 110));
  const mid = await metric(cdp, spec.selector);
  await screenshot(cdp, `${spec.id}-mid.png`);
  await sleep((spec.endMs ?? 1600) - (spec.midMs ?? 760));
  const end = await metric(cdp, spec.selector);
  await screenshot(cdp, `${spec.id}-settled.png`);
  assert.ok(early && mid && end, `${spec.id}: animated target missing.`);
  assert.ok(changed(early, mid) || changed(mid, end), `${spec.id}: keyframed target did not visibly animate.`);
  assert.notEqual(early.animationName, 'none', `${spec.id}: expected a real CSS animation name.`);
  report.animations.push({ id: spec.id, event: spec.event, selector: spec.selector, early, mid, end });
}

async function assertCinematicChrome(cdp, report) {
  await seekEvent(cdp, 'TCP segment assembles');
  await sleep(300);
  const chrome = await cdp.evaluate(`(()=>{
    const opacity=(selector)=>{const el=document.querySelector(selector);return el?Number(getComputedStyle(el).opacity):null};
    const hero=document.querySelector('[data-phase5c-hero]');
    const r=hero?.getBoundingClientRect();
    return {
      hero:r?{width:r.width,height:r.height}:null,
      toolbar:opacity('.visual-workspace__toolbar'),
      hud:opacity('.visual-workspace__hud'),
      callout:opacity('.journey-callout-overlay'),
      timeline:opacity('.visual-time-rail'),
      viewport:{width:innerWidth,height:innerHeight},
    };
  })()`);
  assert.ok(chrome.hero && chrome.hero.width > chrome.viewport.width * .55 && chrome.hero.height > chrome.viewport.height * .45, `Hero does not dominate the stage: ${JSON.stringify(chrome)}`);
  assert.ok(chrome.toolbar !== null && chrome.toolbar <= .08, `Toolbar still visually dominates hero playback: ${JSON.stringify(chrome)}`);
  assert.ok(chrome.hud !== null && chrome.hud <= .08, `HUD still visually dominates hero playback: ${JSON.stringify(chrome)}`);
  assert.ok(chrome.callout !== null && chrome.callout <= .08, `Narration card still substitutes for animation: ${JSON.stringify(chrome)}`);
  assert.ok(chrome.timeline !== null && chrome.timeline <= .35, `Timeline did not recede during hero playback: ${JSON.stringify(chrome)}`);
  report.chrome = chrome;
}

async function auditReducedMotion(cdp, origin, report) {
  await cdp.call('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const query = new URLSearchParams({ journey: '1', host: 'example.test', transport: 'tcp-h2', dns: 'cache-miss', impairment: 'clean' });
  await cdp.call('Page.navigate', { url: `${origin}/journey?${query.toString()}` });
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-visual-workspace'))`);
  await sleep(180);
  await seekEvent(cdp, 'IPv4 envelope assembles');
  await sleep(100);
  const reduced = await cdp.evaluate(`(()=>{
    const hero=document.querySelector('[data-phase5-packet-object="true"]');
    const target=document.querySelector('.phase5c-network-wing.wing-left');
    return hero&&target?{reduceMotion:hero.classList.contains('reduce-motion'),transition:getComputedStyle(target).transitionDuration,animation:getComputedStyle(target).animationDuration}:null;
  })()`);
  assert.ok(reduced?.reduceMotion, 'Reduced-motion hero class was not applied.');
  assert.ok(reduced.transition === '0s' || reduced.transition === '1e-05s', `Reduced-motion layer still has transition ${reduced.transition}.`);
  report.reducedMotion = reduced;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const { server, origin } = await serveProductionArtifact(distDir);
  const launched = await launchChrome(findChrome());
  let cdp;
  const report = { generatedAt: new Date().toISOString(), transitions: [], animations: [], chrome: null, reducedMotion: null, failures: [] };

  try {
    const pages = await fetchJson(`http://127.0.0.1:${launched.port}/json/list`);
    const page = pages.find((candidate) => candidate.type === 'page');
    assert.ok(page?.webSocketDebuggerUrl, 'No debuggable page target found.');
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 950, deviceScaleFactor: 1, mobile: false });
    await cdp.call('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    const query = new URLSearchParams({ journey: '1', host: 'example.test', transport: 'tcp-h2', dns: 'cache-miss', impairment: 'clean' });
    await cdp.call('Page.navigate', { url: `${origin}/journey?${query.toString()}` });
    await waitForExpression(cdp, `Boolean(document.querySelector('.journey-visual-workspace'))`);
    await waitForExpression(cdp, `document.querySelectorAll('.visual-time-rail__events button').length > 20`);
    await waitForExpression(cdp, `!document.querySelector('.visual-entrance')`, 5000);

    await assertCinematicChrome(cdp, report);

    const transitions = [
      { id: '01-protection-closes', from: 'Application data isolated', to: 'TLS record closes', selector: '.phase5c-security' },
      { id: '02-transport-drops-in', from: 'TLS record closes', to: 'TCP segment assembles', selector: '.phase5c-transport' },
      { id: '03-ipv4-wings-close', from: 'TCP segment assembles', to: 'IPv4 envelope assembles', selector: '.phase5c-network-wing.wing-left', minCenterTravel: 45 },
      { id: '04-ethernet-clamps-close', from: 'IPv4 envelope assembles', to: 'Hop-local Ethernet envelope closes', selector: '.phase5c-ether-clamp.clamp-header', minCenterTravel: 45 },
      { id: '05-frame-collapses', from: 'Hop-local Ethernet envelope closes', to: 'Structured frame ready at the NIC', selector: '.phase5c-collapse-spine', minCenterTravel: 20 },
      { id: '07-packet-reaches-switch', from: 'Symbols cross the access link', to: 'Switch isolates destination MAC', selector: '.phase5b-data-unit', minCenterTravel: 35 },
      { id: '08-destination-mac-lifts', from: 'Symbols cross the access link', to: 'Switch isolates destination MAC', selector: '.phase5c-mac-token', minCenterTravel: 30 },
      { id: '09-switch-forwards-frame', from: 'Switch isolates destination MAC', to: 'MAC table selects Gi0/24', selector: '.phase5b-data-unit', minCenterTravel: 30 },
      { id: '10-router-peels-l2', from: 'MAC table selects Gi0/24', to: 'Router terminates the incoming Ethernet envelope', selector: '.shell-lan .phase5c-frame-rail.rail-a', minCenterTravel: 30 },
      { id: '11-ttl-rolls', from: 'Router terminates the incoming Ethernet envelope', to: 'TTL decrements: 64 → 63', selector: '.phase5c-ttl-rotor .ttl-after' },
      { id: '12-route-fans-out', from: 'TTL decrements: 64 → 63', to: 'Destination IP selects the next hop', selector: '.phase5c-route-fan .candidate-b', minCenterTravel: 20 },
      { id: '13-wan-l2-closes', from: 'Destination IP selects the next hop', to: 'A new Ethernet envelope assembles', selector: '.shell-wan .phase5c-frame-rail.rail-a', minCenterTravel: 30 },
    ];
    for (const spec of transitions) await transitionEvidence(cdp, spec, report);

    await animationEvidence(cdp, {
      id: '06-symbols-travel-access-link',
      event: 'Symbols cross the access link',
      selector: '.phase5b-serialization > i:first-child',
      earlyMs: 80,
      midMs: 700,
      endMs: 1500,
    }, report);
    await animationEvidence(cdp, {
      id: '14-symbols-travel-wan-link',
      event: 'The re-encapsulated packet continues',
      selector: '.phase5b-serialization > i:first-child',
      earlyMs: 80,
      midMs: 650,
      endMs: 1350,
    }, report);

    await auditReducedMotion(cdp, origin, report);
  } catch (error) {
    report.failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
  } finally {
    cdp?.close();
    if (!launched.chrome.killed) launched.chrome.kill('SIGKILL');
    rmSync(launched.userDataDir, { recursive: true, force: true });
    await new Promise((resolvePromise) => server.close(resolvePromise));
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (report.failures.length > 0) throw new Error(`Phase 5 choreography review failed:\n${report.failures.join('\n')}`);
  process.stdout.write(`${JSON.stringify({ transitions: report.transitions.length, animations: report.animations.length, chrome: report.chrome, reducedMotion: report.reducedMotion }, null, 2)}\n`);
}

await main();

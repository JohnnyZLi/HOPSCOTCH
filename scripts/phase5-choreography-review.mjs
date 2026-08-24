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
  const attempts = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const port = await freePort();
    const userDataDir = mkdtempSync(join(tmpdir(), `hopscotch-phase5-choreo-${attempt}-`));
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
      if (!chrome.killed) chrome.kill('SIGKILL');
      attempts.push({ attempt, error: error instanceof Error ? error.message : String(error), exitCode: state.exitCode, stderrTail: state.stderr || null });
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
    }
  }
  throw new Error(`Chrome failed to launch after 3 attempts: ${JSON.stringify(attempts)}`);
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

async function waitForHero(cdp, hero, settleMs = 0) {
  await waitForExpression(cdp, `Boolean(document.querySelector('[data-phase5c-hero="${hero}"]'))`, 5000);
  if (settleMs > 0) await sleep(settleMs);
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
      transform:s.transform,opacity:s.opacity,filter:s.filter,
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

function centerDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY);
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

async function navigateJourney(cdp, origin, dns = 'cache-miss', transport = 'tcp-h2') {
  const query = new URLSearchParams({ journey: '1', host: 'example.test', transport, dns, impairment: 'clean', t: '0' });
  await cdp.call('Page.navigate', { url: `${origin}/journey?${query.toString()}` });
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-visual-workspace'))`);
  await waitForExpression(cdp, `document.querySelectorAll('.visual-time-rail__events button').length > 15`);
  await waitForExpression(cdp, `Boolean(document.querySelector('[data-journey-causal-world="true"]'))`);
}

function assertChromeRange(frame, context) {
  assert.ok(frame.toolbar !== null && frame.toolbar >= .24 && frame.toolbar <= .66, `${context}: toolbar should be quiet but discoverable: ${JSON.stringify(frame)}`);
  assert.ok(frame.hud !== null && frame.hud >= .14 && frame.hud <= .52, `${context}: HUD should be quiet but legible: ${JSON.stringify(frame)}`);
  assert.ok(frame.callout !== null && frame.callout <= .08, `${context}: narration card still substitutes for animation: ${JSON.stringify(frame)}`);
  assert.ok(frame.timeline !== null && frame.timeline >= .38 && frame.timeline <= .74, `${context}: timeline should recede without disappearing: ${JSON.stringify(frame)}`);
}

async function assertVisualHandoff(cdp, report) {
  await seekEvent(cdp, 'GET / on example.test');
  await sleep(1100);
  const beforeObject = await metric(cdp, '.causal-object');
  const beforeCore = await metric(cdp, '.causal-object__payload');
  assert.ok(beforeObject && beforeCore, 'HTTP request mechanism is missing before packet handoff.');

  await seekEvent(cdp, 'Application data isolated');
  await sleep(100);
  const earlyObject = await metric(cdp, '.causal-object');
  const earlyCore = await metric(cdp, '.causal-mechanism-core');
  const earlyPacket = await metric(cdp, '.phase5c-application');
  const earlyCamera = await metric(cdp, '.causal-camera');
  await screenshot(cdp, '00h-handoff-early.png');

  await sleep(430);
  const midObject = await metric(cdp, '.causal-object');
  const midCore = await metric(cdp, '.causal-mechanism-core');
  const midPacket = await metric(cdp, '.phase5c-application');
  const midCamera = await metric(cdp, '.causal-camera');
  await screenshot(cdp, '00h-handoff-mid.png');

  await sleep(760);
  const settledObject = await metric(cdp, '.causal-object');
  const settledPacket = await metric(cdp, '.phase5c-application');
  const settledCamera = await metric(cdp, '.causal-camera');
  await screenshot(cdp, '00h-handoff-settled.png');

  for (const [label, camera] of [['early', earlyCamera], ['mid', midCamera], ['settled', settledCamera]]) {
    assert.ok(camera, `Handoff ${label}: causal camera disappeared.`);
    assert.ok(Number(camera.opacity) >= .95, `Handoff ${label}: causal camera faded instead of remaining visible: ${JSON.stringify(camera)}`);
    assert.ok(camera.filter === 'none' || camera.filter === 'blur(0px)', `Handoff ${label}: causal camera blurred instead of morphing: ${JSON.stringify(camera)}`);
  }
  assert.ok(earlyObject && midObject && settledObject && earlyPacket && midPacket && settledPacket, 'Handoff lost either the causal object or the Phase 5 application object.');
  assert.ok(Number(earlyObject.opacity) >= .75 && Number(midObject.opacity) >= .75, 'Persistent causal mechanism became visually absent during handoff.');
  assert.ok(earlyCore && midCore && Number(midCore.opacity) >= .2, `Mechanical scaffold is not visible during the packet handoff: ${JSON.stringify({ earlyCore, midCore })}`);
  assert.ok(centerDistance(midCore, midPacket) <= 280, `Packet hero appears disconnected from the causal core instead of growing from it: ${centerDistance(midCore, midPacket).toFixed(1)}px.`);
  assert.ok(changed(beforeObject, midObject), 'Causal object did not physically reshape into the packet-stage scaffold.');

  await seekEvent(cdp, 'TCP segment assembles');
  await sleep(1050);
  const transportScaffold = await metric(cdp, '.causal-mechanism-core');
  assert.ok(transportScaffold && Number(transportScaffold.opacity) <= .2, `Handoff scaffold should dissolve as packet assembly takes over: ${JSON.stringify(transportScaffold)}`);

  report.handoff = { beforeObject, beforeCore, earlyObject, earlyCore, earlyPacket, midObject, midCore, midPacket, settledObject, settledPacket, transportScaffold };
}

async function assertOpeningCausalWorld(cdp, origin, report) {
  const firstFrame = await cdp.evaluate(`(()=>{
    const world=document.querySelector('[data-journey-causal-world="true"]');
    const object=document.querySelector('[data-causal-object="request-01"]');
    const opacity=(selector)=>{const el=document.querySelector(selector);return el?Number(getComputedStyle(el).opacity):null};
    if(world)world.dataset.persistenceProbe='opening-world';
    const style=object?getComputedStyle(object):null;
    return {
      event:world?.getAttribute('data-causal-event')??null,
      entrance:Boolean(document.querySelector('.visual-entrance')),
      objectAnimation:style?.animationName??null,
      objectDuration:style?.animationDuration??null,
      toolbar:opacity('.visual-workspace__toolbar'),
      hud:opacity('.visual-workspace__hud'),
      callout:opacity('.journey-callout-overlay'),
      timeline:opacity('.visual-time-rail'),
    };
  })()`);
  assert.equal(firstFrame.event, 'intent', `Journey did not begin with the intent object: ${JSON.stringify(firstFrame)}`);
  assert.equal(firstFrame.entrance, false, 'A full-stage title interstitial still obscures time-zero choreography.');
  assert.equal(firstFrame.objectAnimation, 'causal-object-enter', `The first causal object has no time-zero entrance animation: ${JSON.stringify(firstFrame)}`);
  assertChromeRange(firstFrame, 'Opening');
  const firstMechanism = await metric(cdp, '.causal-mechanism-node.node-name');
  assert.ok(firstMechanism && Number(firstMechanism.opacity) >= .9 && firstMechanism.width >= 70, `Opening is not object-first: ${JSON.stringify(firstMechanism)}`);
  await screenshot(cdp, '00-opening-intent.png');

  await transitionEvidence(cdp, {
    id: '00a-cache-opens',
    from: 'Navigate to example.test',
    to: 'DNS cache miss',
    selector: '.causal-cache__lid',
    settleBefore: 80,
    earlyMs: 80,
    midMs: 520,
    endMs: 1180,
  }, report);
  await animationEvidence(cdp, {
    id: '00b-query-travels',
    event: 'Stub asks recursive resolver',
    selector: '.causal-dns-query',
    earlyMs: 70,
    midMs: 460,
    endMs: 1040,
  }, report);
  await animationEvidence(cdp, {
    id: '00c-answer-returns',
    event: 'example.test → 203.0.113.42',
    selector: '.causal-dns-answer',
    earlyMs: 70,
    midMs: 560,
    endMs: 1240,
  }, report);
  await seekEvent(cdp, 'example.test → 203.0.113.42');
  await sleep(1200);
  const addressNode = await metric(cdp, '.causal-mechanism-node.node-address');
  assert.ok(addressNode && Number(addressNode.opacity) >= .8, `DNS answer did not visibly dock into the persistent mechanism: ${JSON.stringify(addressNode)}`);
  await screenshot(cdp, '00c2-address-docked.png');

  await transitionEvidence(cdp, {
    id: '00d-route-locks',
    from: 'Destination enters the routing table',
    to: 'Default gateway selected',
    selector: '.route-selected',
    settleBefore: 160,
    earlyMs: 70,
    midMs: 560,
    endMs: 1240,
  }, report);
  await seekEvent(cdp, 'Default gateway selected');
  await sleep(850);
  const routeNode = await metric(cdp, '.causal-mechanism-node.node-route');
  const routeTarget = await metric(cdp, '.causal-route-target');
  assert.ok(routeNode && Number(routeNode.opacity) >= .8 && routeTarget, `Routing did not add a mechanical next-hop stage: ${JSON.stringify({ routeNode, routeTarget })}`);
  await screenshot(cdp, '00d2-route-mechanism.png');

  await animationEvidence(cdp, {
    id: '00e-syn-travels',
    event: 'SYN leaves the client',
    selector: '.causal-tcp-flight',
    earlyMs: 70,
    midMs: 460,
    endMs: 1040,
  }, report);
  await seekEvent(cdp, 'TCP connection established');
  await sleep(700);
  const sessionNode = await metric(cdp, '.causal-mechanism-node.node-session');
  assert.ok(sessionNode && Number(sessionNode.opacity) >= .8, `Established connection did not become part of the persistent mechanism: ${JSON.stringify(sessionNode)}`);

  await transitionEvidence(cdp, {
    id: '00f-clienthello-unfolds',
    from: 'TCP connection established',
    to: 'ClientHello',
    selector: '.causal-client-hello',
    settleBefore: 120,
    earlyMs: 70,
    midMs: 520,
    endMs: 1120,
  }, report);
  await transitionEvidence(cdp, {
    id: '00g-payload-becomes-opaque',
    from: 'Certificate identity validated',
    to: 'Application traffic keys ready',
    selector: '.payload-cipher',
    settleBefore: 120,
    earlyMs: 70,
    midMs: 500,
    endMs: 1080,
  }, report);
  const protectionNode = await metric(cdp, '.causal-mechanism-node.node-protection');
  assert.ok(protectionNode && Number(protectionNode.opacity) >= .8, `TLS protection did not physically enclose the persistent mechanism: ${JSON.stringify(protectionNode)}`);

  await assertVisualHandoff(cdp, report);
  const handoffState = await cdp.evaluate(`(()=>{
    const world=document.querySelector('[data-journey-causal-world="true"]');
    return {
      persistent:world?.dataset.persistenceProbe==='opening-world',
      event:world?.getAttribute('data-causal-event')??null,
      packetHero:Boolean(world?.querySelector('[data-phase5c-hero="assembly"]')),
    };
  })()`);
  assert.equal(handoffState.persistent, true, `Causal world remounted before packet choreography: ${JSON.stringify(handoffState)}`);

  await navigateJourney(cdp, origin, 'cache-hit');
  await seekEvent(cdp, 'DNS cache hit');
  await sleep(120);
  const cacheHit = await cdp.evaluate(`(()=>{
    const answer=document.querySelector('.causal-dns-answer');
    return {
      cache:document.querySelector('.causal-cache')?.getAttribute('data-causal-cache')??null,
      query:Boolean(document.querySelector('.causal-dns-query')),
      skip:Boolean(document.querySelector('.causal-dns-skip')),
      answerAnimation:answer?getComputedStyle(answer).animationName:null,
      upstreamEvents:[...document.querySelectorAll('.visual-time-rail__events button')].filter((button)=>/recursive resolver|Root referral|TLD referral/.test(button.getAttribute('aria-label')||'')).length,
    };
  })()`);
  assert.deepEqual(cacheHit, { cache: 'hit', query: false, skip: true, answerAnimation: 'dns-answer-hit', upstreamEvents: 0 }, `Cache-hit choreography did not visibly skip upstream resolution: ${JSON.stringify(cacheHit)}`);
  await screenshot(cdp, '00i-cache-hit-skip.png');
  report.opening = { firstFrame, cacheHit, firstMechanism, addressNode, routeNode, routeTarget, sessionNode, protectionNode };

  await navigateJourney(cdp, origin, 'cache-miss');
}

async function assertQuicCausalWorld(cdp, origin, report) {
  await navigateJourney(cdp, origin, 'cache-miss', 'quic-h3');
  await seekEvent(cdp, 'QUIC Initial leaves the client');
  await sleep(160);
  const initial = await metric(cdp, '.causal-tcp-flight');
  const quicWorld = await cdp.evaluate(`Boolean(document.querySelector('.causal-tcp-world.is-quic'))`);
  assert.equal(quicWorld, true, 'QUIC opening did not use the causal transport mechanism.');
  assert.ok(initial && initial.animationName !== 'none', `QUIC Initial is not visibly traveling: ${JSON.stringify(initial)}`);
  await screenshot(cdp, '00q1-quic-initial.png');

  await seekEvent(cdp, 'Server Initial + Handshake arrive');
  await sleep(520);
  await screenshot(cdp, '00q2-quic-server-initial.png');

  await seekEvent(cdp, '1-RTT keys ready');
  await sleep(720);
  const cipher = await metric(cdp, '.payload-cipher');
  const protection = await metric(cdp, '.causal-mechanism-node.node-protection');
  assert.ok(cipher && Number(cipher.opacity) >= .7, `QUIC 1-RTT keys did not make the payload visibly protected: ${JSON.stringify(cipher)}`);
  assert.ok(protection && Number(protection.opacity) >= .7, `QUIC protection did not become part of the mechanism: ${JSON.stringify(protection)}`);
  await screenshot(cdp, '00q3-quic-1rtt.png');

  await seekEvent(cdp, 'GET / on example.test');
  await sleep(750);
  await screenshot(cdp, '00q4-http3-request.png');

  await seekEvent(cdp, 'Application data isolated');
  await waitForHero(cdp, 'assembly', 350);
  const applicationLayer = await cdp.evaluate(`(()=>{
    const el=document.querySelector('[data-phase5-layer="application"]');
    return el?{text:el.textContent,visible:el.getAttribute('data-visible')}:null;
  })()`);
  assert.ok(applicationLayer && /HTTP\/3|GET/.test(applicationLayer.text ?? ''), `QUIC handoff did not preserve HTTP/3 application meaning: ${JSON.stringify(applicationLayer)}`);
  await screenshot(cdp, '00q5-quic-packet-handoff.png');

  await navigateJourney(cdp, origin, 'cache-hit', 'quic-h3');
  await seekEvent(cdp, 'DNS cache hit');
  await sleep(250);
  const quicCacheHit = await cdp.evaluate(`({query:Boolean(document.querySelector('.causal-dns-query')),skip:Boolean(document.querySelector('.causal-dns-skip'))})`);
  assert.deepEqual(quicCacheHit, { query: false, skip: true }, `QUIC cache-hit path did not visibly skip upstream DNS: ${JSON.stringify(quicCacheHit)}`);
  await screenshot(cdp, '00q6-quic-cache-hit.png');

  report.quic = { initial, cipher, protection, applicationLayer, quicCacheHit };
  await navigateJourney(cdp, origin, 'cache-miss', 'tcp-h2');
}

async function assertCinematicChrome(cdp, report) {
  await seekEvent(cdp, 'TCP segment assembles');
  await waitForHero(cdp, 'assembly', 420);
  const chrome = await cdp.evaluate(`(()=>{
    const opacity=(selector)=>{const el=document.querySelector(selector);return el?Number(getComputedStyle(el).opacity):null};
    const hero=document.querySelector('[data-phase5c-hero="assembly"]');
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
  assertChromeRange(chrome, 'Phase 5');
  report.chrome = chrome;
}

async function auditReducedMotion(cdp, origin, report) {
  await cdp.call('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const query = new URLSearchParams({ journey: '1', host: 'example.test', transport: 'tcp-h2', dns: 'cache-miss', impairment: 'clean', t: '0' });
  await cdp.call('Page.navigate', { url: `${origin}/journey?${query.toString()}` });
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-visual-workspace'))`);
  await sleep(180);
  await seekEvent(cdp, 'IPv4 envelope assembles');
  await waitForHero(cdp, 'assembly', 80);
  const reduced = await cdp.evaluate(`(()=>{
    const hero=document.querySelector('[data-phase5-packet-object="true"]');
    const target=document.querySelector('.phase5c-network-wing.wing-left');
    const mechanism=document.querySelector('.causal-mechanism-node');
    return hero&&target&&mechanism?{reduceMotion:hero.classList.contains('reduce-motion'),transition:getComputedStyle(target).transitionDuration,animation:getComputedStyle(target).animationDuration,mechanismTransition:getComputedStyle(mechanism).transitionDuration}:null;
  })()`);
  assert.ok(reduced?.reduceMotion, 'Reduced-motion hero class was not applied.');
  assert.ok(reduced.transition === '0s' || reduced.transition === '1e-05s', `Reduced-motion layer still has transition ${reduced.transition}.`);
  assert.ok(reduced.mechanismTransition.split(',').every((value) => value.trim() === '0s' || value.trim() === '1e-05s'), `Reduced-motion mechanism still transitions: ${reduced.mechanismTransition}.`);
  report.reducedMotion = reduced;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const { server, origin } = await serveProductionArtifact(distDir);
  const launched = await launchChrome(findChrome());
  let cdp;
  const report = { generatedAt: new Date().toISOString(), opening: null, handoff: null, quic: null, transitions: [], animations: [], chrome: null, reducedMotion: null, failures: [], chromeLaunchAttempts: launched.attempts };

  try {
    const pages = await fetchJson(`http://127.0.0.1:${launched.port}/json/list`);
    const page = pages.find((candidate) => candidate.type === 'page');
    assert.ok(page?.webSocketDebuggerUrl, 'No debuggable page target found.');
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 950, deviceScaleFactor: 1, mobile: false });
    await cdp.call('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await navigateJourney(cdp, origin);

    await assertOpeningCausalWorld(cdp, origin, report);
    await assertQuicCausalWorld(cdp, origin, report);
    await assertCinematicChrome(cdp, report);

    const transitions = [
      { id: '01-protection-closes', from: 'Application data isolated', to: 'TLS 1.3 application data closes', selector: '.phase5c-security' },
      { id: '02-transport-drops-in', from: 'TLS 1.3 application data closes', to: 'TCP segment assembles', selector: '.phase5c-transport' },
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
    await stopChrome(launched.chrome);
    rmSync(launched.userDataDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
    await new Promise((resolvePromise) => server.close(resolvePromise));
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (report.failures.length > 0) throw new Error(`Phase 5 choreography review failed:\n${report.failures.join('\n')}`);
  process.stdout.write(`${JSON.stringify({ opening: report.opening, handoff: report.handoff, quic: report.quic, transitions: report.transitions.length, animations: report.animations.length, chrome: report.chrome, reducedMotion: report.reducedMotion, chromeLaunchAttempts: report.chromeLaunchAttempts }, null, 2)}\n`);
}

await main();

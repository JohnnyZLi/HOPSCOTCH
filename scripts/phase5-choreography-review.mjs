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
    let paintedOpacity = r.width > 0 && r.height > 0 ? 1 : 0;
    for (let node = el; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      paintedOpacity *= style.display === 'none' || style.visibility === 'hidden' ? 0 : Number(style.opacity);
    }
    return {
      paintedOpacity,
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
  if (spec.constantSize) {
    const sizes = await cdp.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(spec.selector)});
      const animation = element?.getAnimations().find((animation) => animation instanceof CSSAnimation);
      if (!animation) return [];
      const originalTime = animation.currentTime;
      const duration = animation.effect.getComputedTiming().duration;
      animation.pause();
      const sizes = [.2, .5, .8].map((progress) => {
        animation.currentTime = duration * progress;
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      animation.currentTime = originalTime;
      animation.play();
      return sizes;
    })()`);
    assert.equal(sizes.length, 3, `${spec.id}: wire animation is missing.`);
    for (const dimension of ['width', 'height']) {
      const values = sizes.map((size) => size[dimension]);
      assert.ok(Math.min(...values) > 0 && Math.max(...values) - Math.min(...values) <= 1, `${spec.id}: wire symbols changed size in flight: ${JSON.stringify(sizes)}`);
    }
  }
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
  await cdp.call('Page.navigate', { url: origin + '/journey?' + query.toString() });
  await waitForExpression(cdp, "Boolean(document.querySelector('.journey-visual-workspace'))");
  await waitForExpression(cdp, "document.querySelectorAll('.visual-time-rail__events button').length > 15");
  await waitForExpression(cdp, "Boolean(document.querySelector('.journey-reviewed-scene .review-runtime')?.causalStudy?.snapshot().plan)");
}

function assertChromeRange(frame, context) {
  assert.equal(frame.toolbar, 1, context + ': toolbar text must not be faded by its container.');
  assert.equal(frame.hud, 1, context + ': metadata must retain full text contrast.');
  assert.ok(frame.callout !== null && frame.callout <= .08, context + ': narration card still substitutes for animation: ' + JSON.stringify(frame));
  assert.equal(frame.timeline, 1, context + ': playback controls must retain full contrast.');
}

function readReviewedDOM() {
  const root = document.querySelector('.journey-reviewed-scene .review-runtime');
  const snapshot = root?.causalStudy?.snapshot();
  if (!snapshot?.at || !snapshot.plan) return null;
  const frame = snapshot.frames[snapshot.at.index];
  const actor = [...root.querySelectorAll('.rv-actors > .rv-actor')].find(node=>node.dataset.identity===frame.id)
    ?? root.querySelector('.rv-actor[aria-hidden="false"]');
  const rect = node => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height, centerX:r.left+r.width/2, centerY:r.top+r.height/2};
  };
  const opacity = node => {
    let result = 1;
    for (; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      result *= style.display === 'none' || style.visibility === 'hidden' ? 0 : Number(style.opacity);
    }
    return result;
  };
  const values = [...(actor?.querySelectorAll('.rv-field-value') ?? [])];
  const glyphs = values.flatMap(value => {
    const range = document.createRange();
    range.selectNodeContents(value);
    return [...range.getClientRects()].map(r => ({left:r.left, top:r.top, right:r.right, bottom:r.bottom}));
  });
  const lens = root.querySelector('.rv-lens');
  const lensBox = rect(lens);
  return {
    id:frame.id, title:frame.title, objectTitle:actor?.querySelector('.rv-actor-title')?.textContent, phase:snapshot.at.kind, local:frame.local, protocol:frame.protocol,
    sourceUnchanged:frame.event?.id===frame.id && frame.event?.atMs===frame.at,
    sourceAt:frame.at, canonicalTime:Number(document.querySelector('input[aria-label="Scenario time"]')?.value),
    budget:(snapshot.plan.starts[snapshot.at.index+1]??snapshot.plan.total)-snapshot.plan.starts[snapshot.at.index],
    actor:rect(actor), actorOpacity:opacity(actor), actorCount:root.querySelectorAll('.rv-actors > .rv-actor').length,
    faceOpacity:actor ? Number(getComputedStyle(actor.querySelector('.rv-actor-face')).opacity) : 0,
    fields:[...(actor?.querySelectorAll('.rv-field')??[])].filter(n=>!n.hidden).map(n=>({id:n.dataset.field,label:n.querySelector('.rv-field-label').textContent,value:n.querySelector('.rv-field-value').textContent})),
    sourceFields:frame.fields.map(f=>({id:f.id,label:f.label,value:String(f.value)})),
    fonts:values.map(value=>parseFloat(getComputedStyle(value).fontSize)),
    lens:lensBox, lensOpacity:opacity(lens),
    lensTouchesSource:Boolean(lensBox && glyphs.some(g=>g.left<lensBox.right && g.right>lensBox.left && g.top<lensBox.bottom && g.bottom>lensBox.top)),
    hiddenNative:document.querySelector('.journey-scene-transition')?.dataset.reviewedSuppressed==='true',
    persistent:root.dataset.persistenceProbe==='reviewed-journey',
  };
}

async function reviewedSnapshot(cdp) {
  return cdp.evaluate('(' + readReviewedDOM.toString() + ')()');
}

function assertReviewedSource(sample, context) {
  assert.ok(sample?.actor, context + ': the source object is missing.');
  assert.equal(sample.sourceUnchanged, true, context + ': event identity or canonical timestamp changed.');
  assert.deepEqual(sample.fields, sample.sourceFields, context + ': rendered fields disagree with the canonical projection.');
  assert.ok(sample.fonts.length && sample.fonts.every(size=>size>=12), context + ': source values are not readable.');
  assert.ok(sample.actorCount<=2, context + ': stale event carriers remain attached.');
}

async function seekReviewed(cdp, title) {
  await seekEvent(cdp, title);
  await waitForExpression(cdp, "(function(){const s=document.querySelector('.journey-reviewed-scene .review-runtime')?.causalStudy?.snapshot();return Boolean(s?.at && s.frames[s.at.index].title===" + JSON.stringify(title) + ");})()");
  const sample = await reviewedSnapshot(cdp);
  assertReviewedSource(sample, title);
  assert.ok(sample.actorOpacity>=.75, title + ': the selected source object is not painted.');
  assert.equal(sample.hiddenNative, true, title + ': a replaced scene still paints under the source object.');
  return sample;
}

async function assertReviewedWirePlayback(cdp, title, id, report) {
  const selected = await seekReviewed(cdp, title);
  assert.equal(selected.local, false, title + ': a wire exchange was presented as a local decision.');
  await screenshot(cdp,id+'-source-selection.png');
  await cdp.evaluate("(()=>{const rate=[...document.querySelectorAll('.visual-time-rail button')].find(b=>b.textContent.trim()==='2×');if(rate)rate.click();const play=document.querySelector('.visual-time-rail__controls button');if(play?.getAttribute('aria-label')==='Play scenario')play.click();})()");
  const deadline = performance.now()+Math.min(25000,selected.budget/2+2000);
  const samples=[], phases=[];
  let completed=false;
  while (performance.now()<deadline) {
    const sample = await reviewedSnapshot(cdp);
    if (sample && sample.id!==selected.id) {completed=true;break;}
    if (sample) {
      assertReviewedSource(sample,title);
      if (phases.at(-1)!==sample.phase) phases.push(sample.phase);
      if (sample.phase==='read' && sample.lensOpacity>.8 && sample.faceOpacity>.95) {
        assert.equal(sample.lensTouchesSource,true,title + ': the painted reader misses the rendered source glyphs: '+JSON.stringify(sample));
      }
      samples.push(sample);
    }
    await sleep(35);
  }
  await cdp.evaluate("(()=>{const play=document.querySelector('.visual-time-rail__controls button');if(play?.getAttribute('aria-label')==='Pause scenario')play.click();})()");
  assert.equal(completed,true,title + ': playback did not complete its measured source interval: '+JSON.stringify(phases));
  assert.equal(phases.filter(phase=>phase==='open').length,1,title + ': the wire object did not have exactly one receive-side opening.');
  for (const phase of ['construct','travel','open','read','release']) assert.ok(phases.includes(phase),title + ': missing live '+phase+' phase: '+JSON.stringify(phases));
  assert.ok(phases.indexOf('construct')<phases.indexOf('travel') && phases.indexOf('travel')<phases.indexOf('open') && phases.indexOf('open')<phases.indexOf('read'),title + ': wire lifecycle order changed.');
  const travel=samples.filter(sample=>sample.phase==='travel');
  assert.ok(travel.length>=2,title + ': flight has no intermediate geometry samples.');
  assert.ok(Math.max(...travel.map(sample=>centerDistance(travel[0].actor,sample.actor)))>=30,title + ': the compact packet does not visibly travel.');
  for (const dimension of ['width','height']) {
    const sizes=travel.map(sample=>sample.actor[dimension]);
    assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1,title + ': compact wire size changes during travel.');
  }
  report.animations.push({id,event:title,phases,samples});
}

async function assertVisualHandoff(cdp, report) {
  const before=await seekReviewed(cdp,'GET / on example.test');
  assert.match(before.fields.map(field=>field.value).join(' '),/GET/,'The source request lost its HTTP method.');
  await seekEvent(cdp,'Application data isolated');
  await waitForHero(cdp,'assembly',120);
  const early=await metric(cdp,'.phase5c-application');
  await screenshot(cdp,'00h-handoff-early.png');
  await sleep(430);
  const mid=await metric(cdp,'.phase5c-application');
  await screenshot(cdp,'00h-handoff-mid.png');
  await sleep(760);
  const settled=await metric(cdp,'.phase5c-application');
  await screenshot(cdp,'00h-handoff-settled.png');
  for (const [label,packet] of [['early',early],['mid',mid],['settled',settled]]) {
    assert.ok(packet?.paintedOpacity>=.75,'Handoff '+label+': the native packet disappears.');
    assert.ok(packet.filter==='none'||packet.filter==='blur(0px)','Handoff '+label+': packet is blurred.');
  }
  const ownership=await cdp.evaluate("(()=>{const host=document.querySelector('.journey-reviewed-scene');return {hidden:host?.getAttribute('aria-hidden'),inert:host?.inert,carriers:host?.querySelectorAll('.rv-actor').length};})()");
  assert.deepEqual(ownership,{hidden:'true',inert:true,carriers:0},'Handoff leaves duplicate active review carriers.');
  assert.ok(centerDistance(before.actor,mid)<=280,'Packet handoff is disconnected from the preceding source request.');
  report.handoff={before,early,mid,settled,ownership};
}

async function assertOpeningCausalWorld(cdp, origin, report) {
  const opening=await seekReviewed(cdp,'Navigate to example.test');
  assert.match(opening.fields.map(field=>field.value).join(' '),/example\.test/,'Intent lost its canonical hostname.');
  await cdp.evaluate("document.querySelector('.journey-reviewed-scene .review-runtime').dataset.persistenceProbe='reviewed-journey'");
  const stages=[];
  for (const title of ['DNS cache miss','example.test → 203.0.113.42','Default gateway selected','TCP connection established','ClientHello','Application traffic keys ready']) {
    const sample=await seekReviewed(cdp,title);
    assert.equal(sample.persistent,true,title+': the shared renderer remounted during source selection.');
    stages.push(sample);
  }
  await assertReviewedWirePlayback(cdp,'Stub asks recursive resolver','00b-query-travels',report);
  await assertReviewedWirePlayback(cdp,'SYN leaves the client','00e-syn-travels',report);
  await assertVisualHandoff(cdp,report);
  await navigateJourney(cdp,origin,'cache-hit');
  const cacheHit=await seekReviewed(cdp,'DNS cache hit');
  assert.equal(cacheHit.local,true,'A cache hit fabricates a wire exchange.');
  const upstreamEvents=await cdp.evaluate("[...document.querySelectorAll('.visual-time-rail__events button')].filter(b=>/recursive resolver|Root referral|TLD referral/.test(b.getAttribute('aria-label')||'')).length");
  assert.equal(upstreamEvents,0,'A cache hit fabricates upstream DNS traversal.');
  await screenshot(cdp,'00i-cache-hit-skip.png');
  report.opening={opening,stages,cacheHit,upstreamEvents};
  await navigateJourney(cdp,origin,'cache-miss');
}

async function assertQuicCausalWorld(cdp, origin, report) {
  await navigateJourney(cdp,origin,'cache-miss','quic-h3');
  const initial=await seekReviewed(cdp,'QUIC Initial leaves the client');
  assert.match(initial.protocol,/QUIC/i,'QUIC Initial lost its transport identity.');
  await assertReviewedWirePlayback(cdp,'QUIC Initial leaves the client','00q1-quic-initial',report);
  const protection=await seekReviewed(cdp,'1-RTT keys ready');
  const request=await seekReviewed(cdp,'GET / on example.test');
  assert.match(request.objectTitle??'',/HTTP\/3|h3/,'The QUIC request lost its rendered HTTP/3 identity.');
  assert.match(request.fields.map(field=>field.value).join(' '),/GET/,'The QUIC request lost its application method.');
  await seekEvent(cdp,'Application data isolated');
  await waitForHero(cdp,'assembly',350);
  const applicationLayer=await cdp.evaluate("(()=>{const el=document.querySelector('[data-phase5-layer=\"application\"]');return el?{text:el.textContent,visible:el.getAttribute('data-visible')}:null;})()");
  assert.ok(applicationLayer&&/HTTP\/3|GET/.test(applicationLayer.text??''),'Native QUIC packet handoff lost HTTP/3 application meaning.');
  await screenshot(cdp,'00q5-quic-packet-handoff.png');
  await navigateJourney(cdp,origin,'cache-hit','quic-h3');
  const cacheHit=await seekReviewed(cdp,'DNS cache hit');
  assert.equal(cacheHit.local,true,'QUIC cache-hit path fabricates a DNS exchange.');
  const upstreamEvents=await cdp.evaluate("[...document.querySelectorAll('.visual-time-rail__events button')].filter(b=>/recursive resolver|Root referral|TLD referral/.test(b.getAttribute('aria-label')||'')).length");
  assert.equal(upstreamEvents,0,'QUIC cache-hit path fabricates upstream traversal.');
  report.quic={initial,protection,request,applicationLayer,cacheHit,upstreamEvents};
  await navigateJourney(cdp,origin,'cache-miss','tcp-h2');
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
      constantSize: true,
      event: 'Symbols cross the access link',
      selector: '.phase5b-serialization > i:first-child',
      earlyMs: 80,
      midMs: 700,
      endMs: 1500,
    }, report);
    await animationEvidence(cdp, {
      id: '14-symbols-travel-wan-link',
      constantSize: true,
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

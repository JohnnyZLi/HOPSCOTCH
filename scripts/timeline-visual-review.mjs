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
const outputDir = resolve(root, process.env.HOPSCOTCH_TIMELINE_REVIEW_DIR?.trim() || 'artifacts/timeline-visual-review');
const reportPath = join(outputDir, 'timeline-report.json');
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const routes = [
  { id: 'journey', path: '/journey', ready: '.journey-visual-workspace' },
  { id: 'failure', path: '/labs/failure', ready: '.failure-visual-workspace' },
  { id: 'tcp', path: '/labs/tcp', ready: '.tcp-visual-workspace' },
  { id: 'dns', path: '/labs/dns', ready: '.dns-visual-workspace' },
  { id: 'tls', path: '/labs/tls', ready: '.tls-visual-workspace' },
  { id: 'http', path: '/labs/http2-vs-http3', ready: '.http-visual-workspace' },
];

const viewports = [
  { id: 'wide', width: 1600, height: 950 },
  { id: 'compact', width: 1024, height: 768 },
  { id: 'mobile', width: 390, height: 844 },
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
  for (const candidate of ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(candidate)) return candidate;
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
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await sleep(100);
    }
  }
  throw new Error(`Chrome DevTools did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function launchChrome(chromePath) {
  const attempts = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const port = await freePort();
    const userDataDir = mkdtempSync(join(tmpdir(), `hopscotch-timeline-${attempt}-`));
    const state = { stderr: '', exitCode: null };
    const chrome = spawn(chromePath, [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--mute-audio',
      '--remote-debugging-address=127.0.0.1',
      `--remote-debugging-port=${port}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
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
      rmSync(userDataDir, { recursive: true, force: true });
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
    const promise = new Promise((resolvePromise, reject) => this.pending.set(id, { resolve: resolvePromise, reject, method }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime evaluation failed';
      throw new Error(text);
    }
    return result.result?.value;
  }

  close() {
    try { this.socket.close(); } catch { /* noop */ }
  }
}

async function waitForExpression(cdp, expression, timeoutMs = 8000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await cdp.evaluate(expression)) return;
    await sleep(40);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function navigate(cdp, origin, route, viewport) {
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width <= 480,
  });
  await cdp.call('Page.navigate', { url: `${origin}${route.path}` });
  await waitForExpression(cdp, `Boolean(document.querySelector(${JSON.stringify(route.ready)}))`);
  await waitForExpression(cdp, `Boolean(document.querySelector('.visual-time-rail__speed'))`);
  await sleep(1450);
}

async function resetAndSetSpeed(cdp, speed) {
  return cdp.evaluate(`(()=>{
    const controls=document.querySelector('.visual-time-rail__controls');
    const reset=controls?.querySelectorAll('button')[1];
    const speedSelect=controls?.querySelector('.visual-time-rail__speed');
    if(!reset||!speedSelect) return false;
    reset.click();
    speedSelect.value=${JSON.stringify(String(speed))};
    speedSelect.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);
}

async function playAndMeasure(cdp, speed) {
  assert.equal(await resetAndSetSpeed(cdp, speed), true, `Unable to reset/set ${speed}×.`);
  await sleep(80);
  const start = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  assert.equal(await cdp.evaluate(`(()=>{const play=document.querySelector('.visual-time-rail__controls button');if(!play)return false;play.click();return true})()`), true);
  await sleep(1000);
  const end = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  assert.equal(await cdp.evaluate(`(()=>{const play=document.querySelector('.visual-time-rail__controls button');if(!play)return false;play.click();return true})()`), true);
  await sleep(120);
  return Math.max(0, end - start);
}

async function measureRailStability(cdp, sampleMs = 1800) {
  const stability = await cdp.evaluate(`(async()=>{
    const control=()=>document.querySelector('.visual-time-rail__controls button');
    const rail=document.querySelector('.visual-time-rail');
    const track=document.querySelector('.visual-time-rail__track');
    if(!control()||!rail||!track)return null;
    if(control().getAttribute('aria-label')==='Pause scenario')control().click();
    const samples=[];
    const pick=(element)=>{const rect=element.getBoundingClientRect();return {left:rect.left,right:rect.right,width:rect.width}};
    control().click();
    await new Promise((resolvePromise)=>{
      const started=performance.now();
      const sample=(now)=>{
        samples.push({rail:pick(rail),track:pick(track),scrollX,scrollWidth:document.documentElement.scrollWidth,transform:getComputedStyle(rail).transform});
        if(now-started>=${sampleMs})resolvePromise();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    if(control().getAttribute('aria-label')==='Pause scenario')control().click();
    const span=(path)=>{
      const values=samples.map((sample)=>path(sample));
      return Math.max(...values)-Math.min(...values);
    };
    return {
      sampleCount:samples.length,
      rail:{left:span((sample)=>sample.rail.left),right:span((sample)=>sample.rail.right),width:span((sample)=>sample.rail.width)},
      track:{left:span((sample)=>sample.track.left),right:span((sample)=>sample.track.right),width:span((sample)=>sample.track.width)},
      scrollX:span((sample)=>sample.scrollX),
      scrollWidth:span((sample)=>sample.scrollWidth),
      transforms:[...new Set(samples.map((sample)=>sample.transform))],
    };
  })()`);
  assert.ok(stability && stability.sampleCount >= 30, `Timeline stability sampling failed: ${JSON.stringify(stability)}.`);
  for (const [surface, spans] of Object.entries({ rail: stability.rail, track: stability.track })) {
    for (const [axis, delta] of Object.entries(spans)) {
      assert.ok(delta <= 1, `${surface} ${axis} moved ${delta}px during playback: ${JSON.stringify(stability)}.`);
    }
  }
  assert.ok(stability.scrollX <= 1 && stability.scrollWidth <= 1, `Playback changed horizontal document geometry: ${JSON.stringify(stability)}.`);
  assert.deepEqual(stability.transforms, ['none'], `Timeline rail regained a composited transform: ${JSON.stringify(stability.transforms)}.`);
  return stability;
}

async function assertPauseAndScrub(cdp) {
  const before = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  await sleep(450);
  const after = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  assert.ok(Math.abs(after - before) <= 20, `Paused timeline drifted ${Math.abs(after - before)} ms.`);

  const scrub = await cdp.evaluate(`(()=>{
    const input=document.querySelector('input[aria-label="Scenario time"]');
    if(!input)return null;
    const target=Math.round(Number(input.max)*0.5/10)*10;
    input.value=String(target);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return {target,value:Number(input.value)};
  })()`);
  assert.ok(scrub, 'Timeline range input is missing.');
  await sleep(100);
  const actual = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  assert.ok(Math.abs(actual - scrub.target) <= 20, `Scrub expected ${scrub.target}, got ${actual}.`);
  await sleep(300);
  const stable = Number(await cdp.evaluate(`document.querySelector('input[aria-label="Scenario time"]')?.value??0`));
  assert.ok(Math.abs(stable - actual) <= 20, 'Scrubbing unexpectedly resumed playback.');
}

async function captureRepresentativeState(cdp, route, viewport) {
  const state = await cdp.evaluate(`(()=>{
    const rail=document.querySelector('.visual-time-rail');
    const controls=document.querySelector('.visual-time-rail__controls');
    const speed=document.querySelector('.visual-time-rail__speed');
    const track=document.querySelector('.visual-time-rail__track');
    const workspace=document.querySelector('.visual-workspace');
    const toolbar=document.querySelector('.visual-workspace__toolbar');
    const hud=document.querySelector('.visual-workspace__hud');
    const pick=(element)=>{if(!element)return null;const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const intersects=(a,b)=>Boolean(a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);
    const toolbarActions=[...(toolbar?.querySelectorAll('button')??[])].map((element)=>({label:element.textContent?.trim()??'',box:pick(element),clientWidth:element.clientWidth,scrollWidth:element.scrollWidth}));
    const toolbarTabStrips=[...(toolbar?.querySelectorAll('.visual-drawer-tabs')??[])].map((element)=>({box:pick(element),clientWidth:element.clientWidth,scrollWidth:element.scrollWidth}));
    const toolbarActionOverlap=toolbarActions.some((action,index)=>toolbarActions.slice(index+1).some((candidate)=>intersects(action.box,candidate.box)));
    const milestoneLabels=[...(rail?.querySelectorAll('.visual-time-rail__milestones span')??[])].map((element)=>{const style=getComputedStyle(element);const range=document.createRange();range.selectNodeContents(element);return {label:element.textContent?.trim()??'',box:pick(range),cellBox:pick(element),clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,display:style.display,overflowX:style.overflowX}}).filter((label)=>label.display!=='none'&&label.box.width>0&&label.box.height>0);
    const milestoneOverlap=milestoneLabels.some((label,index)=>milestoneLabels.slice(index+1).some((candidate)=>intersects(label.box,candidate.box)));
    const surface=(element)=>{if(!element)return null;const style=getComputedStyle(element);const color=style.backgroundColor;const alpha=color==='transparent'?0:color.startsWith('rgba')?Number(color.slice(color.lastIndexOf(',')+1,-1).trim()):1;return {backgroundAlpha:alpha,backgroundImage:style.backgroundImage,borderRadius:style.borderRadius,borderTopWidth:style.borderTopWidth,borderRightWidth:style.borderRightWidth,borderBottomWidth:style.borderBottomWidth,borderLeftWidth:style.borderLeftWidth}};
    const boxes={rail:pick(rail),controls:pick(controls),speed:pick(speed),track:pick(track),workspace:pick(workspace),toolbar:pick(toolbar),hud:pick(hud)};
    return {
      boxes,
      controlsTrackOverlap:intersects(boxes.controls,boxes.track),
      speedTrackOverlap:intersects(boxes.speed,boxes.track),
      scrollWidth:document.documentElement.scrollWidth,
      innerWidth,
      scrollHeight:document.documentElement.scrollHeight,
      innerHeight,
      speedValue:speed?.value??null,
      speedOptions:speed?[...speed.options].map((option)=>option.value):[],
      toolbarActions,
      toolbarTabStrips,
      toolbarActionOverlap,
      milestoneLabels,
      milestoneOverlap,
      httpSurfaces:document.querySelector('.http-visual-workspace')?{
        lane:surface(document.querySelector('.http-lane')),
        transport:surface(document.querySelector('.http-transport-rail')),
        stream:surface(document.querySelector('.http-stream-row')),
        lossLabel:pick(document.querySelector('.http-divergence-axis span')),
        h2Footer:pick(document.querySelector('.lane-h2 > footer')),
        h3Header:pick(document.querySelector('.lane-h3 > header')),
      }:null,
    };
  })()`);
  assert.deepEqual(state.speedOptions, ['0.5', '1', '1.5', '2'], `${route.id}/${viewport.id} speed choices changed.`);
  assert.ok(state.boxes.rail && state.boxes.rail.left >= -1 && state.boxes.rail.right <= state.innerWidth + 1, `${route.id}/${viewport.id} timeline rail escapes the viewport: ${JSON.stringify(state.boxes.rail)}.`);
  assert.equal(state.controlsTrackOverlap, false, `${route.id}/${viewport.id} playback controls overlap the timeline track.`);
  assert.equal(state.speedTrackOverlap, false, `${route.id}/${viewport.id} speed control overlaps the timeline track.`);
  assert.equal(state.milestoneOverlap, false, `${route.id}/${viewport.id} milestone labels overlap: ${JSON.stringify(state.milestoneLabels)}.`);
  if (viewport.id !== 'mobile') {
    assert.ok(state.milestoneLabels.every((label) => label.scrollWidth <= label.clientWidth + 1 || label.overflowX === 'visible'), `${route.id}/${viewport.id} milestone label is clipped: ${JSON.stringify(state.milestoneLabels)}.`);
    assert.ok(state.milestoneLabels.every((label) => label.box.left >= state.boxes.track.left - 1 && label.box.right <= state.boxes.track.right + 1), `${route.id}/${viewport.id} milestone label escapes the track: ${JSON.stringify(state.milestoneLabels)}.`);
  }
  assert.ok(state.scrollWidth <= state.innerWidth + 1, `${route.id}/${viewport.id} horizontally overflows (${state.scrollWidth} > ${state.innerWidth}).`);
  if (route.id === 'journey') {
    const tabStrip = state.toolbarTabStrips[0];
    const drawerActions = state.toolbarActions.slice(0, 4);
    assert.equal(state.toolbarActions.length, 5, `journey/${viewport.id} must expose four drawer actions and Exit.`);
    assert.equal(state.toolbarActionOverlap, false, `journey/${viewport.id} toolbar actions overlap: ${JSON.stringify(state.toolbarActions)}.`);
    assert.ok(state.toolbarActions.every((action) => action.scrollWidth <= action.clientWidth + 1), `journey/${viewport.id} toolbar label is clipped: ${JSON.stringify(state.toolbarActions)}.`);
    assert.ok(tabStrip && drawerActions.every((action) => action.box.left >= tabStrip.box.left - 1 && action.box.right <= tabStrip.box.right + 1), `journey/${viewport.id} drawer action is clipped by its tab strip: ${JSON.stringify({ tabStrip, drawerActions })}.`);
  }
  if (route.id === 'http') {
    const { lane, transport, stream, lossLabel, h2Footer, h3Header } = state.httpSurfaces ?? {};
    assert.ok(lane && transport && stream, `http/${viewport.id} transport surfaces are missing.`);
    for (const [name, surface] of Object.entries({ lane, transport, stream })) {
      assert.equal(surface.backgroundAlpha, 0, `http/${viewport.id} ${name} regained an opaque card background.`);
      assert.equal(surface.backgroundImage, 'none', `http/${viewport.id} ${name} regained a card gradient.`);
      assert.equal(surface.borderRadius, '0px', `http/${viewport.id} ${name} regained rounded panel chrome.`);
    }
    assert.deepEqual([lane.borderTopWidth, lane.borderRightWidth, lane.borderBottomWidth, lane.borderLeftWidth], ['0px', '0px', '0px', '0px'], `http/${viewport.id} lane regained a panel border.`);
    assert.deepEqual([transport.borderRightWidth, transport.borderLeftWidth], ['0px', '0px'], `http/${viewport.id} transport rail regained side borders.`);
    assert.deepEqual([stream.borderRightWidth, stream.borderLeftWidth], ['0px', '0px'], `http/${viewport.id} stream regained panel side borders.`);
    if (viewport.id === 'mobile') {
      assert.ok(lossLabel && h2Footer && h3Header, 'http/mobile shared-loss geometry is missing.');
      assert.ok(h2Footer.bottom <= lossLabel.top - 8, `http/mobile HTTP/2 delivery collides with the shared-loss label: ${JSON.stringify({ h2Footer, lossLabel })}.`);
      assert.ok(h3Header.top >= lossLabel.bottom + 8, `http/mobile HTTP/3 heading collides with the shared-loss label: ${JSON.stringify({ h3Header, lossLabel })}.`);
    }
  }

  await cdp.evaluate(`(()=>{
    const danger=document.querySelector('.visual-time-rail__events .tone-danger')||document.querySelector('.visual-time-rail__events .tone-warning');
    if(danger){danger.click();return true}
    const input=document.querySelector('input[aria-label="Scenario time"]');
    if(!input)return false;
    input.value=String(Math.round(Number(input.max)*0.5/10)*10);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);
  await sleep(420);
  return state;
}

async function screenshot(cdp, path) {
  const result = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(path, Buffer.from(result.data, 'base64'));
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const { server, origin } = await serveProductionArtifact(distDir);
  const chromePath = findChrome();
  const launched = await launchChrome(chromePath);
  let cdp;
  const report = { generatedAt: new Date().toISOString(), chromePath, launchAttempts: launched.attempts, profiles: [], failures: [] };
  try {
    const pages = await fetchJson(`http://127.0.0.1:${launched.port}/json/list`);
    const page = pages.find((candidate) => candidate.type === 'page');
    assert.ok(page?.webSocketDebuggerUrl, 'No debuggable page target found.');
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');

    for (const route of routes) {
      for (const viewport of viewports) {
        const profile = { route: route.id, viewport: viewport.id, width: viewport.width, height: viewport.height, failures: [] };
        try {
          await navigate(cdp, origin, route, viewport);
          if (viewport.id === 'wide') {
            const oneXDeltaMs = await playAndMeasure(cdp, 1);
            const twoXDeltaMs = await playAndMeasure(cdp, 2);
            assert.ok(oneXDeltaMs > 40, `${route.id} 1× did not advance.`);
            assert.ok(oneXDeltaMs < 900, `${route.id} 1× advanced ${oneXDeltaMs} model ms in one real second; presentation pacing is too fast.`);
            assert.ok(twoXDeltaMs > oneXDeltaMs * 1.55, `${route.id} 2× (${twoXDeltaMs}) did not materially outrun 1× (${oneXDeltaMs}).`);
            profile.oneXDeltaMs = oneXDeltaMs;
            profile.twoXDeltaMs = twoXDeltaMs;
            await assertPauseAndScrub(cdp);
          } else {
            await resetAndSetSpeed(cdp, 1);
            await sleep(100);
          }
          if (viewport.id === 'wide' || (route.id === 'journey' && viewport.id === 'compact')) {
            profile.railStability = await measureRailStability(cdp);
          }
          profile.layout = await captureRepresentativeState(cdp, route, viewport);
          const filename = `${route.id}-${viewport.id}.png`;
          await screenshot(cdp, join(outputDir, filename));
          profile.screenshot = filename;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          profile.failures.push(message);
          report.failures.push(`${route.id}/${viewport.id}: ${message}`);
        }
        report.profiles.push(profile);
      }
    }
  } finally {
    cdp?.close();
    if (!launched.chrome.killed) launched.chrome.kill('SIGKILL');
    rmSync(launched.userDataDir, { recursive: true, force: true });
    await new Promise((resolvePromise) => server.close(resolvePromise));
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  if (report.failures.length > 0) throw new Error(`Timeline visual review failed:\n${report.failures.join('\n')}`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

await main();

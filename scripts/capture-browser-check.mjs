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
const phase3VisualReview = process.argv.includes('--visual-review');
const phase4VisualReview = process.argv.includes('--phase4-visual-review');
const visualReview = phase3VisualReview || phase4VisualReview;
const defaultVisualDirectory = phase4VisualReview ? 'artifacts/phase4-visual-review' : 'artifacts/phase3-visual-review';
const defaultVisualReport = phase4VisualReview ? `${defaultVisualDirectory}/capture-report.json` : `${defaultVisualDirectory}/captured-report.json`;
const reportPath = resolve(root, process.env.HOPSCOTCH_CAPTURE_BROWSER_REPORT_PATH?.trim() || (visualReview ? defaultVisualReport : 'artifacts/capture-browser.json'));
const visualReviewDirectory = resolve(root, process.env.HOPSCOTCH_VISUAL_REVIEW_DIR?.trim() || defaultVisualDirectory);
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function waitForChildExit(child, timeoutMs = 2000) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolvePromise) => {
    let timeout = null;
    const finish = () => {
      if (timeout !== null) clearTimeout(timeout);
      child.off('exit', finish);
      resolvePromise();
    };
    child.once('exit', finish);
    timeout = setTimeout(finish, timeoutMs);
  });
}

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
  const clicked = await cdp.evaluate(`(()=>{const needle=${JSON.stringify(text)}.toLocaleUpperCase();const target=[...document.querySelectorAll(${JSON.stringify(selector)})].find((candidate)=>candidate.textContent?.toLocaleUpperCase().includes(needle));if(!target)return false;target.click();return true})()`);
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
  const pcapPath = join(directory, 'track-h-fixture.pcap');
  const pcapngPath = join(directory, 'track-h-fixture.pcapng');
  const invalidPath = join(directory, 'track-h-invalid.pcap');
  writeFileSync(pcapPath, pcapCapture(records));
  writeFileSync(pcapngPath, pcapngSection({
    interfaces: [{ linkType: 1, snapLength: 262144, tsresol: 9 }],
    packets: [{ bytes: dnsRequest, ticks: 1_000_000_000n }, { bytes: dnsReply, ticks: 1_100_000_000n }],
  }));
  writeFileSync(invalidPath, Uint8Array.of(0x0a, 0x0d, 0x0d));
  return { pcapPath, pcapngPath, invalidPath };
}

async function captureReplayPhase4VisualReview(cdp, profile) {
  await waitForExpression(cdp, `!document.querySelector('.capture-replay .visual-entrance')`, 5000);
  await sleep(140);
  mkdirSync(visualReviewDirectory, { recursive: true });

  const geometry = await cdp.evaluate(`(()=>{
    const rect=(selector)=>{const value=document.querySelector(selector)?.getBoundingClientRect();return value?{left:value.left,top:value.top,right:value.right,bottom:value.bottom,width:value.width,height:value.height}:null};
    return {
      viewport:{width:innerWidth,height:innerHeight},workspace:rect('.capture-replay'),grid:rect('.capture-workspace-grid'),replay:rect('.capture-cinematic-stage'),toolbar:rect('.capture-heading'),summary:rect('.capture-summary'),
      scrollWidth:document.documentElement.scrollWidth,scrollY,mode:document.querySelector('.capture-replay')?.getAttribute('data-capture-mode'),drawer:document.querySelector('.capture-replay')?.getAttribute('data-context-drawer'),
    };
  })()`);
  if (!geometry.workspace || !geometry.grid || !geometry.replay) throw new Error(`${profile.id} Capture Replay is missing Phase 4 geometry.`);
  if (geometry.viewport.width - geometry.workspace.width > 26) throw new Error(`${profile.id} Capture Replay retains a restrictive outer width cap.`);
  if (geometry.replay.width < geometry.grid.width * 0.98 || geometry.replay.height < geometry.grid.height * 0.98) throw new Error(`${profile.id} replay does not own the analysis stage: ${JSON.stringify(geometry)}.`);
  if (geometry.grid.height < geometry.workspace.height * 0.52) throw new Error(`${profile.id} replay stage is too small inside the workspace: ${JSON.stringify(geometry)}.`);
  if (geometry.scrollWidth > geometry.viewport.width || geometry.scrollY !== 0) throw new Error(`${profile.id} Capture Replay overflows the viewport.`);

  const screenshot = async (suffix) => {
    const result = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const path = join(visualReviewDirectory, `${profile.id}-${suffix}.png`);
    writeFileSync(path, Buffer.from(result.data, 'base64'));
    return path;
  };

  const replayScreenshot = await screenshot('replay');
  let flowsScreenshot = null;
  let analysisScreenshot = null;
  let focusLifecycle = null;
  if (profile.inspectReview) {
    await clickText(cdp, '.capture-heading-actions .capture-action', 'FLOWS');
    await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-context-drawer')==='flows'`);
    await sleep(80);
    const initialFocus = await cdp.evaluate(`document.activeElement?.classList.contains('capture-drawer-close')===true`);
    const flowDrawerGeometry = await cdp.evaluate(`(()=>{
      const corner=document.querySelector('.corner-navigator')?.getBoundingClientRect();
      const drawer=document.querySelector('.capture-flow-browser');
      const drawerRect=drawer?.getBoundingClientRect();
      const titleElement=document.querySelector('.capture-flow-browser > header > div');
      const title=titleElement?.getBoundingClientRect();
      const topElement=title?document.elementFromPoint((title.left+title.right)/2,(title.top+title.bottom)/2):null;
      const channels=drawer?getComputedStyle(drawer).backgroundColor.match(/[\\d.]+/g)?.map(Number)??[]:[];
      const rgb=(value)=>{const values=value.match(/[\\d.]+/g)?.map(Number)??[];return values.slice(0,3).map((channel)=>{const normalized=channel/255;return normalized<=.04045?normalized/12.92:((normalized+.055)/1.055)**2.4})};
      const contrast=(foreground,background)=>{const a=rgb(foreground);const b=rgb(background);const first=.2126*a[0]+.7152*a[1]+.0722*a[2];const second=.2126*b[0]+.7152*b[1]+.0722*b[2];return (Math.max(first,second)+.05)/(Math.min(first,second)+.05)};
      const titleContrast=titleElement&&drawer?contrast(getComputedStyle(titleElement.querySelector('strong')??titleElement).color,getComputedStyle(drawer).backgroundColor):0;
      return {width:drawerRect?.width??0,backgroundAlpha:channels.length>=4?channels[3]:1,titleContrast,collision:Boolean(corner&&title&&corner.left<title.right&&corner.right>title.left&&corner.top<title.bottom&&corner.bottom>title.top),titleOnTop:Boolean(drawer&&topElement&&drawer.contains(topElement))};
    })()`);
    if (!flowDrawerGeometry.titleOnTop || flowDrawerGeometry.backgroundAlpha < .99 || flowDrawerGeometry.titleContrast < 4.5) throw new Error(`${profile.id} flow drawer is not an opaque, legible top-layer surface: ${JSON.stringify(flowDrawerGeometry)}.`);
    if (profile.width <= 680 && flowDrawerGeometry.collision) throw new Error(`${profile.id} flow drawer title collides with corner navigation.`);
    if (profile.width <= 680 && flowDrawerGeometry.width < profile.width * .98) throw new Error(`${profile.id} flow drawer does not own the mobile stage.`);
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8 });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', modifiers: 8 });
    const shiftTabContained = await cdp.evaluate(`document.querySelector('.capture-flow-browser')?.contains(document.activeElement)===true`);
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
    const tabContained = await cdp.evaluate(`document.querySelector('.capture-flow-browser')?.contains(document.activeElement)===true`);
    flowsScreenshot = await screenshot('flows');
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
    await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-context-drawer')==='none'`);
    const restored = await cdp.evaluate(`document.activeElement?.textContent?.toLocaleUpperCase().includes('FLOWS')===true`);
    if (!initialFocus || !shiftTabContained || !tabContained || !restored) throw new Error(`${profile.id} Capture Replay drawer focus lifecycle failed.`);
    focusLifecycle = { initialFocus, shiftTabContained, tabContained, restored };
  }

  await clickText(cdp, '.capture-mode-switch button', 'FRAME SPECIMEN');
  await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-capture-mode')==='frame'`);
  await sleep(80);
  const frameGeometry = await cdp.evaluate(`(()=>{
    const rect=(selector)=>{const value=document.querySelector(selector)?.getBoundingClientRect();return value?{width:value.width,height:value.height,left:value.left,right:value.right,top:value.top,bottom:value.bottom}:null};
    const sections=['.capture-specimen-mode-banner','.capture-frame-heading','.capture-frame-nav','.capture-frame-facts','.capture-byte-inspector','.capture-protocol-stack','.capture-field-list','.capture-lineage','.capture-open-microscope'].map((selector)=>({selector,rect:rect('.capture-evidence-inspector.is-frame-stage > '+selector)})).filter((entry)=>entry.rect&&entry.rect.width>0&&entry.rect.height>0);
    const heading=rect('.capture-evidence-inspector.is-frame-stage > .capture-frame-heading > div:first-child');
    const badge=rect('.capture-evidence-inspector.is-frame-stage .capture-frame-heading-actions');
    return {grid:rect('.capture-workspace-grid'),frame:rect('.capture-evidence-inspector.is-frame-stage'),sections,heading,badge,bytes:document.querySelectorAll('.capture-evidence-inspector.is-frame-stage .capture-hex-grid > span').length,scrollWidth:document.documentElement.scrollWidth};
  })()`);
  if (!frameGeometry.grid || !frameGeometry.frame || frameGeometry.bytes <= 0) throw new Error(`${profile.id} frame mode did not promote an exact-byte specimen.`);
  if (frameGeometry.frame.width < frameGeometry.grid.width * 0.98 || frameGeometry.frame.height < frameGeometry.grid.height * 0.98 || frameGeometry.scrollWidth > profile.width) throw new Error(`${profile.id} frame specimen does not own the stage: ${JSON.stringify(frameGeometry)}.`);
  if (profile.width <= 540) {
    for (let index = 1; index < frameGeometry.sections.length; index += 1) {
      const previous = frameGeometry.sections[index - 1];
      const current = frameGeometry.sections[index];
      if (current.rect.top < previous.rect.bottom - 1) throw new Error(`${profile.id} frame specimen sections overlap: ${previous.selector} → ${current.selector}.`);
    }
    if (frameGeometry.heading && frameGeometry.badge && frameGeometry.heading.left < frameGeometry.badge.right && frameGeometry.heading.right > frameGeometry.badge.left && frameGeometry.heading.top < frameGeometry.badge.bottom && frameGeometry.heading.bottom > frameGeometry.badge.top) throw new Error(`${profile.id} frame heading collides with its provenance badge.`);
  }
  const frameScreenshot = await screenshot('frame-specimen');

  if (profile.inspectReview) {
    await clickText(cdp, '.capture-heading-actions .capture-action', 'ANALYSIS');
    await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-context-drawer')==='analysis'`);
    await sleep(100);
    const analysisDrawerGeometry = await cdp.evaluate(`(()=>{
      const corner=document.querySelector('.corner-navigator')?.getBoundingClientRect();
      const drawer=document.querySelector('.capture-analysis-drawer');
      const drawerRect=drawer?.getBoundingClientRect();
      const titleElement=document.querySelector('.capture-analysis-drawer > header > div');
      const title=titleElement?.getBoundingClientRect();
      const topElement=title?document.elementFromPoint((title.left+title.right)/2,(title.top+title.bottom)/2):null;
      const channels=drawer?getComputedStyle(drawer).backgroundColor.match(/[\\d.]+/g)?.map(Number)??[]:[];
      const header=document.querySelector('.capture-analysis-drawer > header');
      const rgb=(value)=>{const values=value.match(/[\\d.]+/g)?.map(Number)??[];return values.slice(0,3).map((channel)=>{const normalized=channel/255;return normalized<=.04045?normalized/12.92:((normalized+.055)/1.055)**2.4})};
      const contrast=(foreground,background)=>{const a=rgb(foreground);const b=rgb(background);const first=.2126*a[0]+.7152*a[1]+.0722*a[2];const second=.2126*b[0]+.7152*b[1]+.0722*b[2];return (Math.max(first,second)+.05)/(Math.min(first,second)+.05)};
      const titleContrast=titleElement&&header?contrast(getComputedStyle(titleElement.querySelector('strong')??titleElement).color,getComputedStyle(header).backgroundColor):0;
      return {width:drawerRect?.width??0,backgroundAlpha:channels.length>=4?channels[3]:1,titleContrast,collision:Boolean(corner&&title&&corner.left<title.right&&corner.right>title.left&&corner.top<title.bottom&&corner.bottom>title.top),titleOnTop:Boolean(drawer&&topElement&&drawer.contains(topElement))};
    })()`);
    if (!analysisDrawerGeometry.titleOnTop || analysisDrawerGeometry.backgroundAlpha < .99 || analysisDrawerGeometry.titleContrast < 4.5) throw new Error(`${profile.id} analysis drawer is not an opaque, legible top-layer surface: ${JSON.stringify(analysisDrawerGeometry)}.`);
    if (profile.width <= 680 && analysisDrawerGeometry.collision) throw new Error(`${profile.id} analysis drawer title collides with corner navigation.`);
    if (profile.width <= 680 && analysisDrawerGeometry.width < profile.width * .98) throw new Error(`${profile.id} analysis drawer does not own the mobile stage.`);
    analysisScreenshot = await screenshot('analysis');
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
    await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-context-drawer')==='none'`);
  }

  await clickText(cdp, '.capture-mode-switch button', 'REPLAY');
  await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-capture-mode')==='replay'`);
  return { geometry, frameGeometry, replayScreenshot, flowsScreenshot, frameScreenshot, analysisScreenshot, focusLifecycle };
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
    inspectorText:document.querySelector('.capture-evidence-inspector')?.textContent??'',
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
  if (!loaded.text.includes('CAPTURED + INFERRED') || !loaded.inspectorText.includes('WHY HOPSCOTCH SAID THIS')) throw new Error(`${profile.id} lost provenance or lineage.`);
  if (!loaded.text.includes('track-h-fixture.pcap') || /track-t-fixture/i.test(loaded.text)) throw new Error(`${profile.id} Capture Replay exposed stale Track T fixture identity.`);
  if (loaded.reducedMotion !== profile.reducedMotion) throw new Error(`${profile.id} reduced-motion emulation was not preserved.`);

  const captureReplayVisualReview = phase4VisualReview ? await captureReplayPhase4VisualReview(cdp, profile) : null;

  await cdp.evaluate(`document.querySelectorAll('.capture-event-rail button')[1]?.click()`);
  await clickText(cdp, '.capture-time-controls button', '▶');
  await sleep(80);
  const pause = await cdp.evaluate(`Boolean([...document.querySelectorAll('.capture-time-controls button')].find((button)=>button.getAttribute('aria-label')==='Pause capture replay'))`);
  if (pause) await clickText(cdp, '.capture-time-controls button', 'Ⅱ');
  const scrubbed = await cdp.evaluate(`(()=>{const input=document.querySelector('.capture-scrubber input');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,input.max);input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  if (!scrubbed) throw new Error(`${profile.id} could not scrub capture time.`);
  await clickText(cdp, '.capture-heading-actions .capture-action', 'FRAME DETAILS');
  await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-context-drawer')==='inspect'`);
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
  if (!microscope.text.toLocaleUpperCase().includes('PACKET EVIDENCE') || /TRACK T · PACKET EVIDENCE/i.test(microscope.text)) throw new Error(`${profile.id} captured Packet Microscope exposed stale product-track identity.`);

  if (profile.visualReview) {
    await waitForExpression(cdp, `!document.querySelector('.packet-visual-workspace .visual-entrance')`, 5000);
    await sleep(120);
    mkdirSync(visualReviewDirectory, { recursive: true });
    const geometry = await cdp.evaluate(`(()=>{
      const rect=(selector)=>{const value=document.querySelector(selector)?.getBoundingClientRect();return value?{left:value.left,top:value.top,right:value.right,bottom:value.bottom,width:value.width,height:value.height}:null};
      const toolbar=rect('.packet-visual-workspace .visual-workspace__toolbar');
      const hud=rect('.packet-visual-workspace .visual-workspace__hud');
      return {viewport:{width:innerWidth,height:innerHeight},workspace:rect('.packet-visual-workspace'),stage:rect('.packet-visual-workspace .visual-workspace__stage'),world:rect('.packet-visual-workspace .packet-stage'),toolbar,hud,scrollWidth:document.documentElement.scrollWidth,toolbarHudOverlap:Boolean(toolbar&&hud&&toolbar.left<hud.right&&toolbar.right>hud.left&&toolbar.top<hud.bottom&&toolbar.bottom>hud.top)};
    })()`);
    if (!geometry.workspace || !geometry.stage || !geometry.world) throw new Error(`${profile.id} captured microscope is missing visual review geometry.`);
    if (geometry.viewport.width - geometry.workspace.width > 26) throw new Error(`${profile.id} captured microscope retains a restrictive outer width cap.`);
    if (geometry.world.width < geometry.stage.width * 0.96 || geometry.world.height < geometry.stage.height * 0.9) throw new Error(`${profile.id} captured packet specimen does not own its stage.`);
    if (geometry.scrollWidth > geometry.viewport.width || geometry.toolbarHudOverlap) throw new Error(`${profile.id} captured microscope overflows or collides: ${JSON.stringify(geometry)}.`);
    const captureScreenshot = async (suffix = '') => {
      const screenshot = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      const path = join(visualReviewDirectory, `${profile.id}${suffix}.png`);
      writeFileSync(path, Buffer.from(screenshot.data, 'base64'));
      return path;
    };
    const screenshotPath = await captureScreenshot();
    let inspectScreenshotPath = null;
    if (profile.inspectReview) {
      await clickText(cdp, '.packet-visual-workspace .visual-drawer-tabs button', 'INSPECT');
      await waitForExpression(cdp, `Boolean(document.querySelector('.packet-visual-workspace .visual-drawer'))`);
      await sleep(120);
      inspectScreenshotPath = await captureScreenshot('-inspect');
      await clickText(cdp, '.packet-visual-workspace .visual-drawer__close', '×');
      await waitForExpression(cdp, `!document.querySelector('.packet-visual-workspace .visual-drawer')`);
    }
    const errors = cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown'
      || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
      || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error'));
    if (errors.length > 0) throw new Error(`${profile.id} emitted ${errors.length} runtime/console error(s): ${JSON.stringify(errors.slice(0, 2))}`);
    return { id: profile.id, viewport: { width: profile.width, height: profile.height }, reducedMotion: profile.reducedMotion, ...loaded, capturedMicroscopeVerified: true, captureReplayVisualReview, visualReview: { geometry, screenshotPath, inspectScreenshotPath } };
  }
  await clickText(cdp, '.packet-origin-strip button', 'RETURN TO CAPTURE');
  await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-capture-loaded')==='true'`);

  await setFileInput(cdp, '.capture-file-input', fixtures.invalidPath);
  await waitForExpression(cdp, `document.body.innerText.includes('REPLACEMENT REJECTED')`);
  const preserved = await cdp.evaluate(`document.querySelector('.capture-replay')?.getAttribute('data-capture-loaded')==='true'&&document.body.innerText.includes('The previous valid capture remains active.')`);
  if (!preserved) throw new Error(`${profile.id} malformed replacement corrupted the valid capture session.`);

  await setFileInput(cdp, '.capture-file-input', fixtures.pcapngPath);
  await waitForExpression(cdp, `document.body.innerText.includes('track-h-fixture.pcapng') && document.body.innerText.includes('PCAPNG')`);
  await clickText(cdp, '.capture-clear', 'CLEAR');
  await waitForExpression(cdp, `document.querySelector('.capture-replay')?.getAttribute('data-capture-loaded')==='false'`);

  const errors = cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown'
    || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
    || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error'));
  if (errors.length > 0) throw new Error(`${profile.id} emitted ${errors.length} runtime/console error(s): ${JSON.stringify(errors.slice(0, 2))}`);
  return { id: profile.id, viewport: { width: profile.width, height: profile.height }, reducedMotion: profile.reducedMotion, ...loaded, malformedReplacementPreserved: true, pcapngReplacementVerified: true, capturedMicroscopeVerified: true, captureReplayVisualReview };
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
  const report = { schema: phase4VisualReview ? 'hopscotch.phase4-capture-visual-review' : phase3VisualReview ? 'hopscotch.phase3-captured-visual-review' : 'hopscotch.capture-browser', version: 1, browser: { path: chromePath }, profiles: [], failures: [] };
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
    const profiles = visualReview ? [
      { id: phase4VisualReview ? 'capture-replay-ultrawide' : 'captured-packet-ultrawide', width: 2560, height: 1200, reducedMotion: false, visualReview: true, inspectReview: false },
      { id: phase4VisualReview ? 'capture-replay-wide' : 'captured-packet-wide', width: 1600, height: 950, reducedMotion: false, visualReview: true, inspectReview: true },
      { id: phase4VisualReview ? 'capture-replay-laptop' : 'captured-packet-laptop', width: 1366, height: 768, reducedMotion: false, visualReview: true, inspectReview: false },
      { id: phase4VisualReview ? 'capture-replay-narrow' : 'captured-packet-narrow', width: 900, height: 820, reducedMotion: false, visualReview: true, inspectReview: false },
      { id: phase4VisualReview ? 'capture-replay-mobile' : 'captured-packet-mobile', width: 390, height: 844, reducedMotion: false, visualReview: true, inspectReview: true },
    ] : [
      { id: 'capture-desktop', width: 1440, height: 1000, reducedMotion: false },
      { id: 'capture-mobile', width: 390, height: 844, reducedMotion: false },
      { id: 'capture-reduced-motion', width: 1280, height: 900, reducedMotion: true },
    ];
    for (const profile of profiles) report.profiles.push(await exerciseProfile(cdp, production.origin, fixtures, profile));
  } catch (error) {
    report.failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
  } finally {
    if (cdp) { try { await cdp.call('Browser.close'); } catch { /* cleanup */ } cdp.close(); }
    await waitForChildExit(chrome);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill('SIGKILL');
      await waitForChildExit(chrome);
    }
    await new Promise((resolvePromise) => production.server.close(resolvePromise));
    report.browser.stderrTail = stderr || null;
    rmSync(fixtureDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    rmSync(userDataDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`HOPSCOTCH capture production browser check (${report.browser.version ?? 'unknown browser'})`);
  for (const profile of report.profiles) console.log(`${profile.id}: ${profile.flowCount} flows · ${profile.eventCount} events · ${profile.byteCount} visible bytes · DOM ${profile.elementCount}`);
  console.log(`Report: ${reportPath}`);
  if (report.failures.length > 0) { for (const failure of report.failures) console.error(failure); process.exitCode = 1; }
  else console.log(phase4VisualReview ? 'Capture Replay Phase 4 production visual review passed.' : visualReview ? 'Captured Packet Microscope production visual review passed.' : 'Capture browser check passed: PCAP/PCAPNG import, rejected replacement preservation, time controls, lineage, read-only microscopy, desktop/mobile/reduced motion, and console health.');
}

await main();

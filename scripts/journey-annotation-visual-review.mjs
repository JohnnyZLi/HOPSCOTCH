import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { serveProductionArtifact } from './production-artifact-server.mjs';

const distDir = resolve(process.cwd(), 'dist');
const outputDir = resolve(process.cwd(), process.env.HOPSCOTCH_JOURNEY_ANNOTATION_REVIEW_DIR?.trim() || 'artifacts/journey-annotation-visual-review');
const reportPath = join(outputDir, 'report.json');
const viewports = [
  { id: 'wide', width: 1600, height: 950, reducedMotion: false },
  { id: 'compact', width: 1180, height: 800, reducedMotion: false },
  { id: 'mobile', width: 390, height: 844, reducedMotion: false },
  { id: 'reduced', width: 1180, height: 800, reducedMotion: true },
];
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const rectsIntersect = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);

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
    const candidate = executableFromPath(command);
    if (candidate) return candidate;
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
    const userDataDir = mkdtempSync(join(tmpdir(), `hopscotch-journey-annotation-${attempt}-`));
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

async function screenshot(cdp, path) {
  const result = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  writeFileSync(path, Buffer.from(result.data, 'base64'));
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'event';
}

async function navigate(cdp, origin, viewport) {
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width <= 480,
  });
  await cdp.call('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: viewport.reducedMotion ? 'reduce' : 'no-preference' }],
  });
  await cdp.call('Page.navigate', { url: `${origin}/journey` });
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-visual-workspace'))`);
  await waitForExpression(cdp, `document.querySelectorAll('.visual-time-rail__events button').length > 0`);
  await sleep(1450);
}

async function inspectState(cdp) {
  return cdp.evaluate(`(()=>{
    const pick=(element)=>{if(!element)return null;const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const intersects=(a,b)=>Boolean(a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);
    const textBox=(element)=>{if(!element)return null;const range=document.createRange();range.selectNodeContents(element);return pick(range)};
    const labelMetrics=(root,selectors)=>selectors.flatMap((selector)=>[...root.querySelectorAll(selector)].filter((element)=>{
      if(!element.getClientRects().length)return false;
      for(let node=element;node&&node!==root;node=node.parentElement){const style=getComputedStyle(node);if(Number(style.opacity)<.9||style.visibility==='hidden')return false;}
      return true;
    }).map((element)=>{const range=document.createRange();range.selectNodeContents(element);return {selector,text:element.textContent.trim(),rect:textBox(element),lineCount:range.getClientRects().length,fontSize:parseFloat(getComputedStyle(element).fontSize)}}));
    const pseudoContentMetrics=(element)=>{if(!element)return null;const style=getComputedStyle(element,'::before');const content=style.content.replace(/^["']|["']$/g,'');const canvas=document.createElement('canvas');const context=canvas.getContext('2d');if(!context)return null;context.font=style.font;const spacing=Number.parseFloat(style.letterSpacing)||0;const textWidth=context.measureText(content).width+Math.max(0,content.length-1)*spacing;const laneWidth=element.getBoundingClientRect().width;return {content,textWidth,laneWidth,fits:textWidth<=laneWidth+1}};
    const callout=document.querySelector('.journey-callout-overlay');
    const scene=document.querySelector('.journey-scene-transition');
    const stage=document.querySelector('.visual-workspace__stage');
    const hud=document.querySelector('.visual-workspace__hud');
    const toolbar=document.querySelector('.visual-workspace__toolbar');
    const rail=document.querySelector('.visual-time-rail');
    const depth=document.querySelector('.journey-depth-overlay');
    const causalObject=document.querySelector('[data-causal-object="request-01"]');
    const packetObject=document.querySelector('[data-phase5-packet-object="true"]');
    const physicalObject=document.querySelector('[data-phase5b-physical="true"]');
    const boxes={callout:pick(callout),scene:pick(scene),stage:pick(stage),hud:pick(hud),toolbar:pick(toolbar),rail:pick(rail),depth:pick(depth)};
    const captionElement=document.querySelector('.causal-annotation:not([hidden])');
    const caption=captionElement?{
      rect:pick(captionElement),
      title:captionElement.querySelector('strong')?.textContent,
      event:captionElement.getAttribute('data-caption-event'),
      currentEvent:document.querySelector('[data-causal-event]')?.getAttribute('data-causal-event'),
      titleSize:parseFloat(getComputedStyle(captionElement.querySelector('strong')).fontSize),
      summarySize:parseFloat(getComputedStyle(captionElement.querySelector('p')).fontSize),
      railOverlap:intersects(pick(captionElement),boxes.rail),
      hudOverlap:intersects(pick(captionElement),boxes.hud),
    }:null;
    const railSurface=rail?(()=>{const style=getComputedStyle(rail);const workspace=document.querySelector('.journey-visual-workspace');const plate=workspace?getComputedStyle(workspace,'::after'):null;const alpha=(color)=>color==='transparent'?0:color.startsWith('rgba')?Number(color.slice(color.lastIndexOf(',')+1,-1).trim()):1;return {opacity:Number(style.opacity),backgroundAlpha:alpha(style.backgroundColor),plate:plate?{content:plate.content,backgroundAlpha:alpha(plate.backgroundColor),width:Number.parseFloat(plate.width),height:Number.parseFloat(plate.height),zIndex:Number(plate.zIndex)}:null}})():null;
    const markers=[...document.querySelectorAll('.visual-time-rail__events button')].map((button)=>{const r=button.getBoundingClientRect();return {label:button.getAttribute('aria-label')||'',width:r.width,height:r.height}});
    const hudValues=[...document.querySelectorAll('.visual-workspace__hud strong')].map((value)=>{const rect=value.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(value);const lineTops=new Set([...range.getClientRects()].map((line)=>Math.round(line.top*10)/10));return {text:value.textContent?.trim()||'',clientWidth:value.clientWidth,scrollWidth:value.scrollWidth,whiteSpace:getComputedStyle(value).whiteSpace,visible:rect.width>0&&rect.height>0,lineCount:lineTops.size}});
    const causal=causalObject?(()=>{const style=getComputedStyle(causalObject);const color=style.backgroundColor;const backgroundAlpha=color==='transparent'?0:color.startsWith('rgba')?Number(color.slice(color.lastIndexOf(',')+1,-1).trim()):1;return {backgroundAlpha,backgroundImage:style.backgroundImage,borderRadius:style.borderRadius,borderWidths:[style.borderTopWidth,style.borderRightWidth,style.borderBottomWidth,style.borderLeftWidth],protectionNodeCount:causalObject.querySelectorAll('.node-protection').length}})():null;
    const packet=packetObject?{
      stage:packetObject.getAttribute('data-phase5-stage')||'',
      signature:packetObject.getAttribute('data-phase5-signature')||'',
      rect:pick(packetObject),
      reduceMotion:packetObject.classList.contains('reduce-motion'),
      cameraTransition:getComputedStyle(packetObject.querySelector('.phase5-packet-camera')).transitionDuration,
      wingOffsets:[...packetObject.querySelectorAll('.phase5c-network-wing')].map((wing)=>new DOMMatrix(getComputedStyle(wing).transform).m41),
      labels:labelMetrics(packetObject,['.phase5c-application > span','.phase5c-application > strong','.phase5c-application > small','.phase5c-security > strong','.phase5c-security > small','.phase5c-transport-head > small','.phase5c-transport-head > b','.phase5c-transport > strong','.phase5c-ip-identity > small','.phase5c-ip-identity > strong','.phase5c-ttl > small','.phase5c-ttl > b']),
      layers:[...packetObject.querySelectorAll('[data-phase5-layer]')].map((layer)=>({
        id:layer.getAttribute('data-phase5-layer')||'',
        visible:layer.getAttribute('data-visible')==='true',
        active:layer.classList.contains('is-active'),
        rect:pick(layer),
        tabIndex:layer.tabIndex,
      })),
    }:null;
    const readableText=(root)=>{
      if(!root)return [];
      const stage=root.dataset.phase5bStage;
      const selectors=['.phase5b-device.is-active > strong','.journey-forwarding-caption strong','.journey-forwarding-caption span'];
      if(!['link-transmit','next-link'].includes(stage))selectors.push('.phase5b-ip-core > small','.phase5b-ip-core > b','.phase5b-ip-core > em','.phase5b-transport-core > small','.phase5b-transport-core > b','.phase5c-ttl-rotor > small');
      if(['switch-inspect','switch-forward'].includes(stage))selectors.push('.phase5c-cam-title','.phase5c-cam-bank .is-match b','.phase5c-cam-bank .is-match em');
      if(stage==='router-route')selectors.push('.phase5c-route-lock');
      const rgb=(color)=>color.match(/[\\d.]+/g)?.map(Number)||[0,0,0];
      const luminance=(c)=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      return selectors.flatMap(selector=>[...root.querySelectorAll(selector)].map(el=>{
        const style=getComputedStyle(el),rect=pick(el),fg=rgb(style.color);
        let opacity=1,bg=[217,212,207];
        const ancestors=[];for(let n=el;n;n=n.parentElement){ancestors.unshift(n);opacity*=Number(getComputedStyle(n).opacity);}
        for(const n of ancestors){const c=rgb(getComputedStyle(n).backgroundColor),a=c[3]??1;bg=bg.map((v,i)=>v*(1-a)+c[i]*a);}
        const alpha=(fg[3]??1)*opacity,paint=bg.map((v,i)=>v*(1-alpha)+fg[i]*alpha),a=luminance(paint),b=luminance(bg);
        return {selector,text:el.textContent,rect,fontSize:parseFloat(style.fontSize)*rect.height/(el.offsetHeight||rect.height),contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      }));
    };
    const physical=physicalObject?{
      readability:readableText(physicalObject),
      stage:physicalObject.getAttribute('data-phase5b-stage')||'',
      signature:physicalObject.getAttribute('data-phase5b-signature')||'',
      l2:physicalObject.getAttribute('data-phase5b-l2')||'',
      ttl:physicalObject.getAttribute('data-phase5b-ttl')||'',
      checksum:physicalObject.getAttribute('data-phase5b-checksum')||'',
      selectedField:physicalObject.getAttribute('data-phase5b-selected-field')||'',
      incomingFrame:physicalObject.getAttribute('data-phase5b-incoming-frame')||'',
      outgoingFrame:physicalObject.getAttribute('data-phase5b-outgoing-frame')||'',
      rect:pick(physicalObject),
      reduceMotion:physicalObject.classList.contains('reduce-motion'),
      cameraTransition:getComputedStyle(physicalObject.querySelector('.phase5b-camera')).transitionDuration,
      instrument:pick(physicalObject.querySelector('.phase5b-instrument')),
      dataUnit:pick(physicalObject.querySelector('.phase5b-data-unit')),
      dataUnitTabIndex:physicalObject.querySelector('.phase5b-data-unit')?.tabIndex??-1,
      ipSurface:getComputedStyle(physicalObject.querySelector('.phase5b-ip-core')).backgroundColor,
      dataUnitSurface:getComputedStyle(physicalObject.querySelector('.phase5b-data-unit')).backgroundColor,
      labels:labelMetrics(physicalObject,['.phase5b-ip-core > small','.phase5b-ip-core > b','.phase5b-ip-core > em','.phase5c-ttl-rotor > small','.phase5c-ttl-rotor > i','.phase5b-transport-core > small','.phase5b-transport-core > b']),
      serialization:(()=>{const rect=pick(physicalObject.querySelector('.phase5b-serialization'));return rect?{...rect,top:rect.top-14,height:rect.height+14}:null})(),
      serializationLabel:pseudoContentMetrics(physicalObject.querySelector('.phase5b-serialization')),
      activeDevices:[...physicalObject.querySelectorAll('.phase5b-device.is-active')].map((device)=>device.getAttribute('data-device')||''),
      activePaths:[...physicalObject.querySelectorAll('.phase5b-path.is-active')].map((path)=>path.getAttribute('data-locus')||''),
      macOpacity:getComputedStyle(physicalObject.querySelector('.phase5b-mac-projection')).opacity,
      macProjection:pick(physicalObject.querySelector('.phase5b-mac-projection')),
      routeOpacity:getComputedStyle(physicalObject.querySelector('.phase5b-route-projection')).opacity,
      routeProjection:pick(physicalObject.querySelector('.phase5b-route-projection')),
      routeNodes:[...physicalObject.querySelectorAll('.phase5c-route-node')].map((node)=>({label:node.textContent,rect:pick(node)})),
      destinationToken:pick(physicalObject.querySelector('.phase5c-ip-token')),
    }:null;
    return {
      title:callout?.querySelector('h2')?.textContent?.trim()||'',
      boxes,
      calloutSceneOverlap:intersects(boxes.callout,boxes.scene),
      calloutHudOverlap:intersects(boxes.callout,boxes.hud),
      calloutToolbarOverlap:intersects(boxes.callout,boxes.toolbar),
      calloutRailOverlap:intersects(boxes.callout,boxes.rail),
      sceneDepthOverlap:intersects(boxes.scene,boxes.depth),
      railSurface,
      markers,
      hudValues,
      causal,
      caption,
      packet,
      physical,
      innerWidth,
      innerHeight,
      scrollWidth:document.documentElement.scrollWidth,
      scrollHeight:document.documentElement.scrollHeight,
    };
  })()`);
}

async function auditPhysicalInspector(cdp, viewport, events) {
  const ttlIndex = events.find((event) => event.physical?.stage === 'router-ttl')?.index;
  assert.ok(Number.isInteger(ttlIndex), `${viewport.id}: router TTL event is missing.`);
  const sought = await cdp.evaluate(`(()=>{const marker=document.querySelectorAll('.visual-time-rail__events button')[${ttlIndex}];if(!marker)return false;marker.click();return true})()`);
  assert.equal(sought, true, `${viewport.id}: could not seek to the router TTL mutation.`);
  await waitForExpression(cdp, `document.querySelector('[data-phase5b-physical="true"]')?.getAttribute('data-phase5b-stage')==='router-ttl'`);
  const opened = await cdp.evaluate(`(()=>{const unit=document.querySelector('.phase5b-data-unit');if(!unit)return false;unit.click();return true})()`);
  assert.equal(opened, true, `${viewport.id}: could not inspect the routed IPv4 object.`);
  await waitForExpression(cdp, `Boolean(document.querySelector('[data-phase5b-inspector="true"]'))`);
  await sleep(260);
  const inspector = await cdp.evaluate(`(()=>{
    const physical=document.querySelector('[data-phase5b-inspector="true"]');
    const packet=document.querySelector('[data-phase5-inspector="true"]');
    if(!physical||!packet)return null;
    return {
      physicalText:physical.textContent||'',
      protocol:packet.querySelector('h3')?.textContent?.trim()||'',
      fields:[...packet.querySelectorAll('.journey-packet-inspector__fields > div')].map((field)=>({
        label:field.querySelector('span')?.textContent?.trim()||'',
        value:field.querySelector('strong')?.textContent?.trim()||'',
        range:field.querySelector('small')?.textContent?.trim()||'',
      })),
      playbackLabel:document.querySelector('.visual-time-rail__transport button')?.getAttribute('aria-label')||'',
    };
  })()`);
  assert.ok(inspector, `${viewport.id}: physical forwarding inspector did not render.`);
  assert.match(inspector.physicalText, /DEVICE READS\s*TTL/i, `${viewport.id}: TTL decision field is missing from physical inspector.`);
  assert.match(inspector.physicalText, /ETHERNET TERMINATED AT ROUTER/i, `${viewport.id}: router L2 termination is missing from inspector.`);
  assert.equal(inspector.protocol, 'IPv4', `${viewport.id}: router object inspection did not select IPv4.`);
  assert.ok(inspector.fields.some((field) => field.label === 'TTL' && field.value === '63' && field.range === 'B22'), `${viewport.id}: routed TTL byte lineage drifted: ${JSON.stringify(inspector.fields)}`);
  assert.ok(inspector.fields.some((field) => field.label === 'Header Checksum' && field.value === '0xF323' && field.range === 'B24–25'), `${viewport.id}: routed checksum lineage drifted: ${JSON.stringify(inspector.fields)}`);
  assert.equal(inspector.playbackLabel, 'Play scenario', `${viewport.id}: physical inspection did not pause playback.`);
  await screenshot(cdp, join(outputDir, `${viewport.id}-physical-router-ttl-inspector.png`));
  await cdp.evaluate(`document.querySelector('.visual-drawer__close')?.click()`);
  await sleep(180);
  return inspector;
}

async function auditDrawer(cdp, viewport) {
  const opened = await cdp.evaluate(`(()=>{const button=document.querySelector('.visual-drawer-tabs button');if(!button)return false;button.click();return true})()`);
  assert.equal(opened, true, `${viewport.id}: could not open shared drawer.`);
  await waitForExpression(cdp, `Boolean(document.querySelector('.visual-drawer'))`);
  await sleep(260);
  const drawer = await cdp.evaluate(`(()=>{
    const el=document.querySelector('.visual-drawer');
    if(!el)return null;
    const r=el.getBoundingClientRect();const s=getComputedStyle(el);
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,backgroundColor:s.backgroundColor,backdropFilter:s.backdropFilter};
  })()`);
  assert.ok(drawer, `${viewport.id}: drawer did not render.`);
  if (viewport.id === 'mobile') {
    assert.ok(drawer.left <= 1 && Math.abs(drawer.width - viewport.width) <= 1, `mobile drawer is not stage-width: ${JSON.stringify(drawer)}`);
    assert.ok(!/rgba\([^)]*,\s*0(?:\.\d+)?\)/.test(drawer.backgroundColor), `mobile drawer is transparent: ${drawer.backgroundColor}`);
    assert.equal(drawer.backdropFilter, 'none', `mobile drawer should not rely on background bleed-through blur: ${drawer.backdropFilter}`);
  }
  await cdp.evaluate(`document.querySelector('.visual-drawer__close')?.click()`);
  await sleep(180);
  return drawer;
}

async function auditPacketInspector(cdp, viewport, events) {
  const explodedIndex = events.find((event) => event.packet?.stage === 'exploded')?.index;
  assert.ok(Number.isInteger(explodedIndex), `${viewport.id}: exploded packet event is missing.`);
  const sought = await cdp.evaluate(`(()=>{
    const marker=document.querySelectorAll('.visual-time-rail__events button')[${explodedIndex}];
    if(!marker)return false;
    marker.click();
    return true;
  })()`);
  assert.equal(sought, true, `${viewport.id}: could not seek to the exploded packet.`);
  await waitForExpression(cdp, `document.querySelector('[data-phase5-packet-object="true"]')?.getAttribute('data-phase5-stage')==='exploded'`);
  const opened = await cdp.evaluate(`(()=>{const layer=document.querySelector('[data-phase5-layer="network"]');if(!layer)return false;layer.click();return true})()`);
  assert.equal(opened, true, `${viewport.id}: could not select the IPv4 packet shell.`);
  await waitForExpression(cdp, `Boolean(document.querySelector('[data-phase5-inspector="true"]'))`);
  await sleep(260);
  const inspector = await cdp.evaluate(`(()=>{
    const panel=document.querySelector('[data-phase5-inspector="true"]');
    if(!panel)return null;
    return {
      protocol:panel.querySelector('h3')?.textContent?.trim()||'',
      identity:panel.querySelector('.journey-packet-inspector__identity small')?.textContent?.trim()||'',
      fields:[...panel.querySelectorAll('.journey-packet-inspector__fields > div')].map((field)=>({
        label:field.querySelector('span')?.textContent?.trim()||'',
        value:field.querySelector('strong')?.textContent?.trim()||'',
        range:field.querySelector('small')?.textContent?.trim()||'',
      })),
      playbackLabel:document.querySelector('.visual-time-rail__transport button')?.getAttribute('aria-label')||'',
    };
  })()`);
  assert.ok(inspector, `${viewport.id}: packet inspector did not render.`);
  assert.equal(inspector.protocol, 'IPv4', `${viewport.id}: selecting the network shell did not select IPv4.`);
  assert.equal(inspector.identity, 'FRAME BYTES 14–33', `${viewport.id}: IPv4 layer byte range drifted.`);
  assert.ok(inspector.fields.some((field) => field.label === 'TTL' && field.value === '64' && field.range === 'B22'), `${viewport.id}: TTL did not retain exact byte lineage: ${JSON.stringify(inspector.fields)}`);
  assert.equal(inspector.playbackLabel, 'Play scenario', `${viewport.id}: packet inspection did not pause playback.`);
  await screenshot(cdp, join(outputDir, `${viewport.id}-packet-network-inspector.png`));
  await cdp.evaluate(`document.querySelector('.visual-drawer__close')?.click()`);
  await sleep(180);
  return inspector;
}

// Sample actual painted frames, including the interval before a settled screenshot.
// An outgoing world's state has already advanced, so fading it can reveal unrelated props.
function startTransitionMonitor() {
  const report = { frames: 0, events: {}, eventOrder: [], playbackRegressions: [], leaks: [] };
  window.journeyTransitionReport = report;
  const painted = (element) => {
    if (!element || !element.getClientRects().length) return false;
    let opacity = 1;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      opacity *= Number(style.opacity);
    }
    return opacity > .01;
  };
  const sample = () => {
    const world = document.querySelector('[data-journey-causal-world]');
    if (world) {
      const phase = world.dataset.causalPhase;
      const event = world.dataset.causalEvent;
      report.frames++;
      report.events[event] = (report.events[event] || 0) + 1;
      if (!report.eventOrder.includes(event)) report.eventOrder.push(event);
      if (window.journeyMonitorPlayback) {
        if (report.eventOrder.indexOf(event) < report.eventOrder.indexOf(window.journeyPreviousPlaybackEvent)) {
          report.playbackRegressions.push({ from: window.journeyPreviousPlaybackEvent, to: event });
        }
        window.journeyPreviousPlaybackEvent = event;
      }
      const removedEnvelope = world.querySelector('.phase5b-physical.l2-none .shell-lan');
      if (removedEnvelope && painted(removedEnvelope) && report.leaks.length < 30) {
        const color = getComputedStyle(removedEnvelope).backgroundColor;
        const components = color.match(/[\d.]+/g)?.map(Number) || [];
        const alpha = color.startsWith('rgba') ? components[3] : 1;
        if (alpha > .01) report.leaks.push({ frame: report.frames, event, phase, selector: '.l2-none .shell-lan', reason: 'Removed Ethernet envelope repainted its background' });
      }
      const owners = [
        ['.causal-dns-world', ['dns']], ['.causal-route-world', ['route', 'path']],
        ['.causal-tcp-world', ['tcp']], ['.causal-tls-world', ['tls']],
        ['.causal-http-flight', ['http']], ['.causal-response-flight', ['response']],
      ];
      if (world.querySelector('[data-phase5-packet-object], [data-phase5b-physical]')) owners.push(['.causal-camera', []]);
      for (const [selector, phases] of owners) {
        if (!phases.includes(phase) && painted(world.querySelector(selector)) && report.leaks.length < 30) {
          report.leaks.push({ frame: report.frames, event, phase, selector });
        }
      }
    }
    window.journeyTransitionFrame = requestAnimationFrame(sample);
  };
  sample();
}

async function auditTransitions(cdp, viewport, events) {
  // Fast reverse seeks interrupt in-flight animations and used to resurrect old frames.
  for (const event of [...events].reverse()) {
    await cdp.evaluate(`document.querySelectorAll('.visual-time-rail__events button')[${event.index}].click()`);
    await sleep(40);
  }
  let playbackEvents = [];
  if (viewport.id === 'wide' || viewport.id === 'mobile') {
    const firstPacket = events.find((event) => event.packet);
    await cdp.evaluate(`(() => {
      document.querySelectorAll('.visual-time-rail__events button')[${firstPacket.index - 1}].click();
      document.querySelector('[data-playback-speed="2"]').click();
      window.journeyTransitionReport.events = {};
    })()`);
    await sleep(40);
    await cdp.evaluate(`(() => {
      window.journeyPreviousPlaybackEvent = document.querySelector('[data-journey-causal-world]').dataset.causalEvent;
      window.journeyMonitorPlayback = true;
      document.querySelector('.visual-time-rail__transport button[aria-label="Play scenario"]').click();
    })()`);
    await waitForExpression(cdp, `document.querySelector('[data-causal-phase="response"]') !== null`, 45000);
    await cdp.evaluate(`document.querySelector('.visual-time-rail__transport button[aria-label="Pause scenario"]')?.click()`);
    playbackEvents = await cdp.evaluate(`Object.keys(window.journeyTransitionReport.events)`);
    assert.ok(playbackEvents.length >= 10, `${viewport.id}: playback skipped the packet handoffs: ${playbackEvents}`);
  }
  const report = await cdp.evaluate(`(() => {
    cancelAnimationFrame(window.journeyTransitionFrame);
    return window.journeyTransitionReport;
  })()`);
  writeFileSync(join(outputDir, `${viewport.id}-transitions.json`), JSON.stringify({ ...report, playbackEvents }, null, 2));
  assert.ok(report.frames >= 100, `${viewport.id}: transition monitor did not sample enough frames.`);
  assert.deepEqual(report.playbackRegressions, [], `${viewport.id}: playback briefly returned to an earlier event: ${JSON.stringify(report.playbackRegressions)}`);
  assert.deepEqual(report.leaks, [], `${viewport.id}: inactive geometry flashed during a transition: ${JSON.stringify(report.leaks)}`);
  return { frames: report.frames, playbackEvents, playbackRegressions: report.playbackRegressions, leaks: report.leaks };
}

async function auditViewport(cdp, origin, viewport) {
  await navigate(cdp, origin, viewport);
  const labels = await cdp.evaluate(`[...document.querySelectorAll('.visual-time-rail__events button')].map((button)=>button.getAttribute('aria-label')||'')`);
  assert.ok(labels.length >= 8, `${viewport.id}: expected canonical Journey events, found ${labels.length}.`);
  await cdp.evaluate(`(${startTransitionMonitor.toString()})()`);
  const events = [];
  const labelCollisions = [];
  const visualFailures = [];

  for (let index = 0; index < labels.length; index += 1) {
    const clicked = await cdp.evaluate(`(()=>{const button=document.querySelectorAll('.visual-time-rail__events button')[${index}];if(!button)return false;button.click();return true})()`);
    assert.equal(clicked, true, `${viewport.id}: could not click event ${index}.`);
    await sleep(620);
    const state = await inspectState(cdp);
    await screenshot(cdp, join(outputDir, `${viewport.id}-${String(index + 1).padStart(2, '0')}-${slug(state.title || labels[index])}.png`));
    try {
    assert.ok(state.boxes.callout && state.boxes.scene && state.boxes.stage, `${viewport.id}/${labels[index]}: missing callout/scene/stage.`);
    assert.equal(state.calloutSceneOverlap, false, `${viewport.id}/${labels[index]}: callout overlaps protected scene.`);
    assert.equal(state.calloutHudOverlap, false, `${viewport.id}/${labels[index]}: callout overlaps HUD.`);
    assert.equal(state.calloutToolbarOverlap, false, `${viewport.id}/${labels[index]}: callout overlaps toolbar.`);
    assert.equal(state.calloutRailOverlap, false, `${viewport.id}/${labels[index]}: callout overlaps Time Machine.`);
    assert.ok((state.railSurface?.plate?.backgroundAlpha ?? 0) >= .99, `${viewport.id}/${labels[index]}: Time Machine has no opaque isolation plate: ${JSON.stringify(state.railSurface)}.`);
    assert.equal(state.railSurface?.plate?.zIndex, 16, `${viewport.id}/${labels[index]}: Time Machine isolation plate left the rail stacking layer: ${JSON.stringify(state.railSurface)}.`);
    assert.ok(Math.abs((state.railSurface?.plate?.width ?? 0) - state.boxes.rail.width) <= 1 && Math.abs((state.railSurface?.plate?.height ?? 0) - state.boxes.rail.height) <= 1, `${viewport.id}/${labels[index]}: Time Machine isolation plate does not cover the rail: ${JSON.stringify({rail:state.boxes.rail,surface:state.railSurface})}.`);
    assert.ok(state.boxes.callout.left >= state.boxes.stage.left - 1 && state.boxes.callout.right <= state.boxes.stage.right + 1, `${viewport.id}/${labels[index]}: callout escapes stage horizontally.`);
    assert.ok(state.boxes.callout.top >= state.boxes.stage.top - 1 && state.boxes.callout.bottom <= state.boxes.stage.bottom + 1, `${viewport.id}/${labels[index]}: callout escapes stage vertically.`);
    assert.ok(state.scrollWidth <= state.innerWidth + 1, `${viewport.id}/${labels[index]}: horizontal overflow ${state.scrollWidth} > ${state.innerWidth}.`);
    assert.ok(state.markers.every((marker) => marker.width >= 14 && marker.height >= 18), `${viewport.id}/${labels[index]}: timeline hit target regressed: ${JSON.stringify(state.markers)}`);
    if (viewport.id === 'mobile') {
      assert.ok(state.hudValues.filter((value) => value.visible).every((value) => value.scrollWidth <= value.clientWidth + 1), `${viewport.id}/${labels[index]}: HUD value is clipped horizontally: ${JSON.stringify(state.hudValues)}.`);
      assert.ok(state.hudValues.filter((value) => value.visible).every((value) => value.lineCount <= 2), `${viewport.id}/${labels[index]}: HUD value wraps into an orphan line: ${JSON.stringify(state.hudValues)}.`);
    }
    if (state.causal) {
      if (state.caption) {
        assert.equal(state.caption.event,state.caption.currentEvent,`${viewport.id}: stale event caption.`);
        assert.ok(state.caption.titleSize>=16&&state.caption.summarySize>=14,`${viewport.id}: caption text is too small.`);
        assert.ok(state.caption.rect.left>=0&&state.caption.rect.right<=viewport.width&&state.caption.rect.top>=0&&state.caption.rect.bottom<=viewport.height,`${viewport.id}: caption is clipped.`);
        assert.equal(state.caption.railOverlap,false,`${viewport.id}: caption overlaps playback controls.`);
        assert.equal(state.caption.hudOverlap,false,`${viewport.id}: caption overlaps the HUD.`);
      }
      assert.equal(state.causal.backgroundAlpha, 0, `${viewport.id}/${labels[index]}: the request mechanism regained an opaque card background.`);
      assert.equal(state.causal.backgroundImage, 'none', `${viewport.id}/${labels[index]}: the request mechanism regained a card gradient.`);
      assert.equal(state.causal.borderRadius, '0px', `${viewport.id}/${labels[index]}: the request mechanism regained rounded card chrome.`);
      assert.deepEqual(state.causal.borderWidths, ['0px', '0px', '0px', '0px'], `${viewport.id}/${labels[index]}: the request mechanism regained a panel border.`);
      assert.equal(state.causal.protectionNodeCount, 1, `${viewport.id}/${labels[index]}: the TLS protection node is duplicated.`);
    }
    if (state.packet) {
      if (state.packet.stage === 'link') assert.ok(state.packet.wingOffsets.length === 2 && state.packet.wingOffsets.every((offset) => Math.abs(offset) <= 1), `${viewport.id}/${labels[index]}: IPv4 brackets never closed: ${JSON.stringify(state.packet.wingOffsets)}`);
      if (!['collapsed', 'exploded'].includes(state.packet.stage)) {
        for (const [i, label] of state.packet.labels.entries()) {
          for (const other of state.packet.labels.slice(i + 1)) if (rectsIntersect(label.rect, other.rect)) labelCollisions.push({stage: state.packet.stage, label, other});
        }
      }
      const requestLabel = state.packet.labels.find((label) => label.selector === '.phase5c-application > small');
      const requestTitle = state.packet.labels.find((label) => label.selector === '.phase5c-application > strong');
      if (requestLabel && requestTitle) assert.ok(requestTitle.fontSize >= requestLabel.fontSize * 2, `${viewport.id}/${labels[index]}: application typography lost its hierarchy.`);
      const visibleLayers = state.packet.layers.filter((layer) => layer.visible);
      assert.ok(['application', 'security', 'transport', 'network', 'link', 'collapsed', 'exploded'].includes(state.packet.stage), `${viewport.id}/${labels[index]}: invalid Phase 5 packet stage ${state.packet.stage}.`);
      assert.ok(state.packet.signature.length > 20, `${viewport.id}/${labels[index]}: deterministic packet signature missing.`);
      assert.equal(visibleLayers.filter((layer) => layer.active).length, 1, `${viewport.id}/${labels[index]}: packet object must expose exactly one active layer.`);
      assert.ok(visibleLayers.every((layer) => layer.rect && layer.rect.width >= 44 && layer.rect.height >= 44 && layer.tabIndex === 0), `${viewport.id}/${labels[index]}: visible packet layer is not keyboard/touch inspectable: ${JSON.stringify(visibleLayers)}`);
      assert.ok(state.packet.layers.filter((layer) => !layer.visible).every((layer) => layer.tabIndex === -1), `${viewport.id}/${labels[index]}: hidden packet layers entered the tab order.`);
      if (viewport.reducedMotion) {
        assert.equal(state.packet.reduceMotion, true, `${viewport.id}/${labels[index]}: reduced-motion state was not rendered.`);
        assert.ok(state.packet.cameraTransition === '1e-05s' || state.packet.cameraTransition === '0s', `${viewport.id}/${labels[index]}: camera still has a long reduced-motion transition: ${state.packet.cameraTransition}`);
      }
    }
    if (state.physical) {
      assert.ok(state.physical.labels.every((label) => label.lineCount === 1), `${viewport.id}/${labels[index]}: packet field wraps onto another line: ${JSON.stringify(state.physical.labels)}`);
      assert.match(state.physical.ipSurface, /^rgb\(/, `${viewport.id}/${labels[index]}: IP packet surface is translucent: ${state.physical.ipSurface}`);
      assert.equal(state.physical.dataUnitSurface, 'rgba(0, 0, 0, 0)', `${viewport.id}/${labels[index]}: physical inspection target draws a duplicate packet sheet.`);
      for (const [i, label] of state.physical.labels.entries()) {
        for (const other of state.physical.labels.slice(i + 1)) if (rectsIntersect(label.rect, other.rect)) labelCollisions.push({stage: state.physical.stage, label, other});
      }
      const ttlLabel = state.physical.labels.find((label) => label.selector === '.phase5c-ttl-rotor > small');
      const ttlValue = state.physical.labels.find((label) => label.selector === '.phase5c-ttl-rotor > i');
      if (ttlLabel && ttlValue) assert.ok(ttlValue.fontSize >= ttlLabel.fontSize * 2, `${viewport.id}/${labels[index]}: TTL typography lost its hierarchy.`);
      if (['router-route', 'router-reencapsulate'].includes(state.physical.stage)) {
        const nodes = state.physical.routeNodes;
        assert.equal(nodes.length, 3, `${viewport.id}/${labels[index]}: expected three route candidates.`);
        assert.ok(nodes.every((node) => node.rect.top >= 0 && node.rect.bottom <= state.innerHeight), `${viewport.id}/${labels[index]}: route candidate escapes viewport: ${JSON.stringify(nodes)}.`);
        assert.ok(nodes.every((node, index) => nodes.slice(index + 1).every((other) => !rectsIntersect(node.rect, other.rect))), `${viewport.id}/${labels[index]}: route candidates overlap: ${JSON.stringify(nodes)}.`);
        if (state.physical.stage === 'router-route') {
          assert.ok(nodes.every((node) => !rectsIntersect(node.rect, state.physical.destinationToken)), `${viewport.id}/${labels[index]}: destination token covers a route candidate.`);
        }
      }
      assert.ok(state.physical.readability.length > 0, `${viewport.id}: forwarding readability evidence is missing.`);
      for (const label of state.physical.readability) {
        assert.ok(label.fontSize >= 11.5, `${viewport.id}/${labels[index]}: undersized forwarding label: ${JSON.stringify(label)}`);
        assert.ok(label.contrast >= 4.5, `${viewport.id}/${labels[index]}: low-contrast forwarding label: ${JSON.stringify(label)}`);
        assert.ok(label.rect.left >= 0 && label.rect.right <= state.innerWidth && label.rect.top >= 0 && label.rect.bottom <= state.innerHeight, `${viewport.id}/${labels[index]}: forwarding label escaped the viewport: ${JSON.stringify(label)}`);
      }
      assert.ok(['nic-serialize', 'link-transmit', 'switch-inspect', 'switch-forward', 'router-decapsulate', 'router-ttl', 'router-route', 'router-reencapsulate', 'next-link'].includes(state.physical.stage), `${viewport.id}/${labels[index]}: invalid Phase 5B stage ${state.physical.stage}.`);
      assert.ok(state.physical.signature.length > 40, `${viewport.id}/${labels[index]}: deterministic physical signature missing.`);
      assert.ok(state.physical.dataUnit && state.physical.dataUnit.width >= 44 && state.physical.dataUnit.height >= 44 && state.physical.dataUnitTabIndex === 0, `${viewport.id}/${labels[index]}: physical data unit is not keyboard/touch inspectable.`);
      assert.equal(state.physical.activeDevices.length + state.physical.activePaths.length, 1, `${viewport.id}/${labels[index]}: expected exactly one active physical locus.`);
      if (state.physical.stage === 'link-transmit' || state.physical.stage === 'next-link') {
        assert.equal(rectsIntersect(state.physical.dataUnit, state.physical.serialization), false, `${viewport.id}/${labels[index]}: serialized symbols collide with the structured data unit.`);
        assert.equal(state.physical.serializationLabel?.fits, true, `${viewport.id}/${labels[index]}: serialization label does not fit its visual lane: ${JSON.stringify(state.physical.serializationLabel)}.`);
      }
      if (state.physical.stage === 'switch-inspect' || state.physical.stage === 'switch-forward') {
        assert.equal(state.physical.macOpacity, '1', `${viewport.id}/${labels[index]}: switch MAC projection is not visible.`);
        assert.equal(rectsIntersect(state.physical.instrument, state.physical.macProjection), false, `${viewport.id}/${labels[index]}: MAC projection collides with the physical instrument.`);
      }
      if (state.physical.stage === 'router-route' || state.physical.stage === 'router-reencapsulate') {
        assert.equal(state.physical.routeOpacity, '1', `${viewport.id}/${labels[index]}: router route projection is not visible.`);
        assert.equal(rectsIntersect(state.physical.instrument, state.physical.routeProjection), false, `${viewport.id}/${labels[index]}: route projection collides with the physical instrument.`);
      }
      if (viewport.reducedMotion) {
        assert.equal(state.physical.reduceMotion, true, `${viewport.id}/${labels[index]}: reduced-motion physical state was not rendered.`);
        assert.ok(state.physical.cameraTransition === '1e-05s' || state.physical.cameraTransition === '0s', `${viewport.id}/${labels[index]}: physical camera still has a long reduced-motion transition: ${state.physical.cameraTransition}`);
      }
    }
    } catch (error) {
      visualFailures.push(error instanceof Error ? error.message : String(error));
    }
    events.push({ index, label: labels[index], ...state });
  }

  writeFileSync(join(outputDir, `${viewport.id}-states.json`), JSON.stringify({ events, visualFailures }, null, 2));
  assert.deepEqual(visualFailures, [], `${viewport.id}: visual failures: ${JSON.stringify(visualFailures)}`);
  assert.deepEqual(labelCollisions, [], `${viewport.id}: packet labels overlap: ${JSON.stringify(labelCollisions)}`);
  const phase5Events = events.filter((event) => event.packet);
  assert.ok(phase5Events.length >= 8, `${viewport.id}: expected the complete Phase 5 assembly and inspection sequence, found ${phase5Events.length}.`);
  assert.deepEqual([...new Set(phase5Events.map((event) => event.packet.stage))], ['application', 'security', 'transport', 'network', 'link', 'collapsed', 'exploded'], `${viewport.id}: Phase 5 packet stages are incomplete.`);
  const physicalEvents = events.filter((event) => event.physical);
  assert.equal(physicalEvents.length, 9, `${viewport.id}: expected nine Phase 5B physical states.`);
  assert.deepEqual(physicalEvents.map((event) => event.physical.stage), ['nic-serialize', 'link-transmit', 'switch-inspect', 'switch-forward', 'router-decapsulate', 'router-ttl', 'router-route', 'router-reencapsulate', 'next-link'], `${viewport.id}: Phase 5B forwarding stages are incomplete.`);
  const physicalByStage = Object.fromEntries(physicalEvents.map((event) => [event.physical.stage, event.physical]));
  assert.equal(physicalByStage['switch-inspect'].incomingFrame, physicalByStage['switch-forward'].incomingFrame, `${viewport.id}: switch forwarding changed the frame signature.`);
  assert.equal(physicalByStage['router-decapsulate'].l2, 'none', `${viewport.id}: router did not terminate L2.`);
  assert.equal(physicalByStage['router-decapsulate'].ttl, '64', `${viewport.id}: router mutated TTL before the explicit TTL state.`);
  assert.equal(physicalByStage['router-ttl'].ttl, '63', `${viewport.id}: router TTL mutation did not render.`);
  assert.equal(physicalByStage['router-ttl'].checksum, '0xF323', `${viewport.id}: routed checksum did not update.`);
  assert.equal(physicalByStage['router-reencapsulate'].l2, 'wan', `${viewport.id}: router did not construct the next-hop L2 envelope.`);
  assert.notEqual(physicalByStage['router-reencapsulate'].incomingFrame, physicalByStage['router-reencapsulate'].outgoingFrame, `${viewport.id}: next-hop Ethernet envelope did not change.`);
  const transitions = await auditTransitions(cdp, viewport, events);
  const physicalInspector = await auditPhysicalInspector(cdp, viewport, events);
  const packetInspector = await auditPacketInspector(cdp, viewport, events);
  const drawer = await auditDrawer(cdp, viewport);
  return { viewport, eventCount: labels.length, phase5EventCount: phase5Events.length, physicalEventCount: physicalEvents.length, physicalInspector, packetInspector, drawer, transitions, events };
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
    for (const viewport of viewports) {
      try {
        report.profiles.push(await auditViewport(cdp, origin, viewport));
      } catch (error) {
        report.failures.push({ viewport: viewport.id, error: error instanceof Error ? error.stack ?? error.message : String(error) });
      }
    }
  } finally {
    if (cdp) cdp.close();
    if (!launched.chrome.killed) launched.chrome.kill('SIGKILL');
    rmSync(launched.userDataDir, { recursive: true, force: true });
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    chromePath: report.chromePath,
    profiles: report.profiles.map((profile) => ({ viewport: profile.viewport, eventCount: profile.eventCount, phase5EventCount: profile.phase5EventCount, physicalEventCount: profile.physicalEventCount, physicalInspector: profile.physicalInspector, packetInspector: profile.packetInspector })),
    failures: report.failures,
    reportPath,
  }, null, 2));
  assert.deepEqual(report.failures, [], `Journey annotation visual review failed: ${JSON.stringify(report.failures)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

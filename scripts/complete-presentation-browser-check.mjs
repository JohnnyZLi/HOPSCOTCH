import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {serveProductionArtifact} from './production-artifact-server.mjs';
import {findChrome,launchChrome,fetchJson,CdpClient,sleep} from './browser-validation-runtime.mjs';
import {WORKSPACE_CATALOG} from '../src/workspace-catalog.ts';
import {tcpScenario,tcpStateAt} from '../src/protocol/tcp.ts';
import {dnsScenario,dnsStateAt} from '../src/protocol/dns.ts';
import {tlsEvents,tlsStateAt} from '../src/protocol/tls.ts';
import {buildJourneyScenario} from '../src/journey/model.ts';
import {buildPacket,defaultPacketConfig} from '../src/packet/model.ts';
import {runBuilderProbe} from '../src/builder/probes.ts';
import {encodeJourneyQuery,createPortableJourneyScenario} from '../src/journey/scenario.ts';
import {ethernetFrame,ipv4Packet,tcpSegment,pcapCapture,pcapngSection} from './capture-fixtures.mjs';

const flags=new Set(process.argv.slice(2));if(flags.has('--phase4-visual-review'))flags.add('--phase4');if(flags.has('--visual-review'))flags.add('--phase3');const mode=['phase3','phase4','timeline','journey','choreography','overview','capture','geometry'].find(value=>flags.has('--'+value))??'performance';
const dirs={phase3:'phase3-visual-review',phase4:'phase4-visual-review',timeline:'timeline-visual-review',journey:'journey-annotation-visual-review',choreography:'journey-choreography-review',overview:'overview-browser-review',capture:'capture-browser',geometry:'dns-workspace-geometry-review'};
const output=resolve(process.env.HOPSCOTCH_VISUAL_REVIEW_DIR||join('artifacts',dirs[mode]??'complete-presentation-performance')),reportPath=resolve(process.env.HOPSCOTCH_REPORT_PATH||(mode==='performance'?'artifacts/performance-profile.json':mode==='capture'?'artifacts/capture-browser.json':join(output,'report.json')));
const budgets=JSON.parse(readFileSync('config/performance-budget.json','utf8'));
const report={schema:'hopscotch.complete-presentation-validation',version:1,mode,gpuMode:process.env.HOPSCOTCH_GPU_MODE||'default',generatedAt:new Date().toISOString(),profiles:[],failures:[]};
mkdirSync(output,{recursive:true});mkdirSync(dirname(reportPath),{recursive:true});
let production,launch,cdp;
async function wait(expression,timeoutMs=15000){const end=performance.now()+timeoutMs;while(performance.now()<end){if(await cdp.evaluate(expression))return;await sleep(50);}const context=await cdp.evaluate("({error:document.querySelector('.rv-error')?.textContent,context:document.querySelector('.wb-context')?.textContent})");throw Error('Timed out: '+expression+' · '+JSON.stringify(context));}
async function settled(){await cdp.evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))).then(()=>Promise.allSettled(document.getAnimations().filter(a=>a.effect.getComputedTiming().iterations!==Infinity).map(a=>a.finished))).then(()=>new Promise(resolve=>requestAnimationFrame(resolve)))');}
async function open(path,width=1440,height=1000,theme='light',reduced=false){
 await cdp.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await cdp.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
 cdp.clearEvents();await cdp.call('Page.navigate',{url:production.origin+path});await wait("Boolean(document.querySelector('.review-runtime')?.causalStudy||document.querySelector('.review-runtime')?.builderStudy||document.querySelector('.review-runtime')?.evidenceStudy||document.querySelector('.review-runtime')?.connectedStudy||document.querySelector('.workspace-error'))");
 assert.equal(await cdp.evaluate("Boolean(document.querySelector('.workspace-error'))"),false,'A complete composition failed to mount.');
 await cdp.evaluate(`(()=>{const picker=document.querySelector('.rv-theme');picker.value=${JSON.stringify(theme)};picker.dispatchEvent(new Event('change',{bubbles:true}));})()`);await settled();
 const hasLifecycle=await cdp.evaluate("Boolean(document.querySelector('.review-runtime').causalStudy)");if(hasLifecycle)await wait("Boolean(document.querySelector('.review-runtime').causalStudy.snapshot().plan)");
 const hasAs=await cdp.evaluate("document.querySelector('.review-runtime').evidenceStudy?.snapshot().workspace==='internet'");if(hasAs)await wait("Boolean(document.querySelector('.review-runtime').evidenceStudy.snapshot().graphPlan)",60000);
 const hasBuilder=await cdp.evaluate("Boolean(document.querySelector('.review-runtime').builderStudy)");if(hasBuilder)await wait("Boolean(document.querySelector('.review-runtime').builderStudy.snapshot().graphPlan)",60000);
}
async function screenshot(name){const capture=await cdp.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(output,name+'.png'),Buffer.from(capture.data,'base64'));}
async function geometry(name){
 const value=await cdp.evaluate(`(()=>{const root=document.querySelector('.review-runtime'),style=getComputedStyle(root),box=n=>{const r=n?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null;},visible=n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0&&!n.closest('[hidden]'),stage=root.querySelector('.rv-stage,.wb-map,.ev-content,.cx-specimen'),console=root.querySelector('.rv-console'),buttons=[...root.querySelectorAll('button,input,select,summary')].filter(n=>visible(n)&&!n.closest('.rv-network-world,.ev-as-nodes,[aria-hidden="true"],[inert]'));return {theme:root.dataset.theme,scrollWidth:document.documentElement.scrollWidth,width:innerWidth,elements:document.getElementsByTagName('*').length,stage:box(stage),console:box(console),header:box(root.querySelector('.rv-header')),title:root.querySelector('h2')?.textContent,legacy:document.querySelectorAll('.kinetic-overview,.visual-workspace,.reviewed-primary,.journey-stage').length,overflow:buttons.filter(n=>{const r=n.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(n=>n.textContent||n.getAttribute('aria-label')),font:style.fontFamily,material:root.surfacePainter?.stats(),source:root.querySelector('.rv-model-time')?.textContent};})()`);
 assert.equal(value.legacy,0,name+' retained legacy presentation');assert.ok(value.scrollWidth<=value.width+1,name+' page overflows');assert.deepEqual(value.overflow,[],name+' controls overflow');assert.ok(value.header?.w>0,name+' approved header hidden');assert.ok(value.title?.length,name+' approved title missing');
 const errors=cdp.events.filter(event=>event.method==='Runtime.exceptionThrown');assert.deepEqual(errors,[],name+' runtime exception');const profile={id:name,...value};if(mode==='performance'){await cdp.call('HeapProfiler.collectGarbage');profile.heap=(await cdp.call('Runtime.getHeapUsage')).usedSize;}report.profiles.push(profile);return value;
}
async function sourceSemantics(){
 for(const id of ['tcp','dns','tls']){
  await open(WORKSPACE_CATALOG[id].path,1440,1000,'light');
  const expected=id==='tcp'?tcpScenario.events:id==='dns'?dnsScenario('miss').events:tlsEvents;
  const frames=await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.snapshot().frames.map(f=>({id:f.id,at:f.at,local:f.local,lost:f.lost}))");assert.deepEqual(frames.map(f=>[f.id,f.at]),expected.map(event=>[event.id,event.atMs]),id+' source events changed');
  const checks=await cdp.evaluate(`(()=>{const root=document.querySelector('.review-runtime'),api=root.causalStudy,initial=api.snapshot();return initial.frames.map((frame,index)=>{api.seek(initial.plan.commits[index]);const snap=api.snapshot();return {index,id:frame.id,at:frame.at,selected:snap.at.index,clock:root.querySelector('.rv-model-time').textContent,caption:root.querySelector('.rv-caption-title').textContent,lostOpens:Boolean(frame.lost&&initial.plan.phases.some(phase=>phase.index===index&&phase.kind==='open'))};});})()`);
  for(const check of checks){assert.equal(check.selected,check.index);assert.ok(check.clock.includes(check.id+' · '+check.at+' ms'));assert.ok(check.caption.length);assert.equal(check.lostOpens,false,'Loss must not open a receive inspector');}
  if(id==='tcp'){
   const terminal=tcpStateAt(expected.at(-1).atMs),actual=await cdp.evaluate("({ack:document.querySelector('.rv-ack').textContent,expected:document.querySelector('.rv-expected').textContent})");assert.equal(actual.ack,String(terminal.highestAck));assert.equal(actual.expected,String(terminal.expectedAck));
  }else if(id==='dns'){
   const terminal=dnsStateAt('miss',expected.at(-1).atMs),actual=await cdp.evaluate("document.querySelector('.rv-dns-answer').textContent");assert.equal(actual,terminal.answer?.value||'Not available');
  }else{const terminal=tlsStateAt(expected.at(-1).atMs),actual=await cdp.evaluate("document.querySelector('.rv-tls-channel').textContent");assert.equal(actual,terminal.applicationReady?'Ready':'Not ready');}
 }
 await open(WORKSPACE_CATALOG.packet.path);const exact=buildPacket(defaultPacketConfig).bytes,actual=await cdp.evaluate("[...document.querySelectorAll('.rv-bytes button')].map(n=>parseInt(n.textContent,16))");assert.deepEqual(actual,exact,'Simulated packet bytes differ from canonical buildPacket');
}
function readReviewedDOM() {
  const root = document.querySelector('.review-runtime');
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
  const lens = root.querySelector('.rv-lens');
  const readerValue = actor?.querySelector('[data-field="'+CSS.escape(lens?.dataset.readerField ?? '')+'"] .rv-field-value');
  const glyphs = (readerValue ? [readerValue] : values).flatMap(value => {
    const range = document.createRange();
    range.selectNodeContents(value);
    return [...range.getClientRects()].map(r => ({left:r.left, top:r.top, right:r.right, bottom:r.bottom}));
  });
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
    lens:lensBox, lensOpacity:opacity(lens), lensPhase:lens?.dataset.readerPhase, lensField:lens?.dataset.readerField,
    lensTouchesSource:Boolean(lensBox && glyphs.some(g=>g.left<lensBox.right && g.right>lensBox.left && g.top<lensBox.bottom && g.bottom>lensBox.top)),
    hiddenNative:document.querySelector('.journey-scene-transition')?.dataset.reviewedSuppressed==='true',
    persistent:root.dataset.persistenceProbe==='reviewed-journey',
  };
}

async function wirePlayback(){
 await open(WORKSPACE_CATALOG.tcp.path);
 await cdp.evaluate("(()=>{const root=document.querySelector('.review-runtime');root.causalStudy.seek(0);root.querySelector('.rv-speed').value='2';root.querySelector('.rv-speed').dispatchEvent(new Event('change',{bubbles:true}));root.querySelector('.rv-play').click();})()");
 const samples=[],phases=[];let complete=false,id=null;const deadline=performance.now()+25000;
 while(performance.now()<deadline){
  const sample=await cdp.evaluate('('+readReviewedDOM.toString()+')()');
  if(sample){id??=sample.id;if(sample.id!==id){complete=true;break;}
   assert.ok(sample.actor);assert.equal(sample.sourceUnchanged,true);assert.deepEqual(sample.fields,sample.sourceFields);assert.ok(sample.fonts.every(size=>size>=12));assert.ok(sample.actorCount<=2);
   if(phases.at(-1)!==sample.phase)phases.push(sample.phase);
   if(sample.phase==='read'&&sample.lensPhase!=='travel'&&sample.lensOpacity>.8&&sample.faceOpacity>.95)assert.equal(sample.lensTouchesSource,true,'Painted scanner misses the intended source glyphs: '+JSON.stringify(sample));
   samples.push(sample);
  }
  await sleep(35);
 }
 await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.pause()");
 assert.equal(complete,true,'Playback must complete its measured packet interval');assert.equal(phases.filter(p=>p==='open').length,1,'Exactly one receive opening is allowed');
 for(const phase of ['construct','travel','open','read','release'])assert.ok(phases.includes(phase),'Missing live '+phase+' phase');
 assert.ok(phases.indexOf('construct')<phases.indexOf('travel')&&phases.indexOf('travel')<phases.indexOf('open')&&phases.indexOf('open')<phases.indexOf('read'));
 const travel=samples.filter(s=>s.phase==='travel');assert.ok(travel.length>=2);assert.ok(Math.max(...travel.map(s=>Math.hypot(s.actor.centerX-travel[0].actor.centerX,s.actor.centerY-travel[0].actor.centerY)))>=30,'Packet must visibly travel');
 for(const dimension of ['width','height'])assert.ok(Math.max(...travel.map(s=>s.actor[dimension]))-Math.min(...travel.map(s=>s.actor[dimension]))<=1,'Wire size must remain stable');
 assert.ok(samples.some(s=>s.phase==='read'&&s.lensPhase==='read'&&s.lensOpacity>.8&&s.faceOpacity>.95),'An actual visible glyph scan must be sampled');
 report.wirePlayback={id,phases,samples};await screenshot('wire-after-playback');
}

async function movingLifecycle(){
 await open(WORKSPACE_CATALOG.tcp.path,1440,1000,'light');
 const before=await cdp.evaluate("(()=>{const root=document.querySelector('.review-runtime'),api=root.causalStudy;api.seek(0);root.querySelector('.rv-play').click();return {clock:api.snapshot().clock,identity:api.snapshot().frames[0].id};})()");await sleep(300);const after=await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.snapshot().clock");assert.ok(after>before.clock,'Play must advance presentation time');
 await cdp.evaluate("document.querySelector('.rv-play').click()");const paused=await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.save()");await sleep(180);assert.deepEqual(await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.save()"),paused,'Pause must retain the exact rendered phase');
 await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.restore(document.querySelector('.review-runtime').causalStudy.save())");const restored=await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.save()");assert.equal(restored.position.id,paused.position.id);assert.equal(restored.position.kind,paused.position.kind);assert.ok(Math.abs(restored.position.p-paused.position.p)<1e-6,'Restoring an anchor changed its phase');
 await screenshot('tcp-moving-paused');await geometry('tcp-moving-paused');
}
async function importFile(selector,path){const document=await cdp.call('DOM.getDocument'),match=await cdp.call('DOM.querySelector',{nodeId:document.root.nodeId,selector});assert.ok(match.nodeId,'Import input is missing');await cdp.call('DOM.setFileInputFiles',{nodeId:match.nodeId,files:[resolve(path)]});}
async function captureSemantics(){
 const frame=ethernetFrame(ipv4Packet(tcpSegment(new Uint8Array([65,66,67])))),pcap=pcapCapture([{bytes:frame,originalLength:frame.length,seconds:1,microseconds:0},{bytes:frame,originalLength:frame.length,seconds:1,microseconds:1000}]),path=join(output,'capture-fixture.pcap');writeFileSync(path,pcap);
 await open(WORKSPACE_CATALOG.capture.path);await importFile('.ev-capture-file',path);await wait("document.querySelector('.review-runtime').evidenceStudy.snapshot().capture.frames.length===2");
 const data=await cdp.evaluate("(()=>{const api=document.querySelector('.review-runtime').evidenceStudy,s=api.snapshot();api.inspectByte(14);const n=api.snapshot();return {bytes:s.captureBytes,length:s.capture.frames[0].record.capturedLength,frame:n.frameIndex,byte:n.byte,field:n.fieldId,layer:n.layerIndex,clock:document.querySelector('.ev-clock').textContent};})()");assert.deepEqual(data.bytes,[...Array(2)].map(()=>Array.from(frame)));assert.equal(data.length,frame.length);assert.equal(data.byte,14);assert.ok(data.field);assert.ok(data.layer>0);assert.ok(data.clock.includes('Captured time'));
 await settled();await screenshot('capture-exact-bytes');await geometry('capture-exact-bytes');
 const saved=await cdp.evaluate("document.querySelector('.review-runtime').evidenceStudy.snapshot().captureBytes");writeFileSync(join(output,'invalid.pcap'),'invalid');await importFile('.ev-capture-file',join(output,'invalid.pcap'));await wait("document.querySelector('.review-runtime').evidenceStudy.snapshot().mode==='error'");assert.deepEqual(await cdp.evaluate("document.querySelector('.review-runtime').evidenceStudy.snapshot().captureBytes"),saved,'Invalid capture replaced retained bytes');
 // PCAPNG uses the same production worker, decode, and byte-range paths.
 const ng=pcapngSection({packets:[{bytes:frame,originalLength:frame.length}]});writeFileSync(join(output,'capture-fixture.pcapng'),ng);await importFile('.ev-capture-file',join(output,'capture-fixture.pcapng'));await wait("document.querySelector('.review-runtime').evidenceStudy.snapshot().capture.metadata.format==='pcapng'");
}
async function measuredSemantics(){
 await open(WORKSPACE_CATALOG.measured.path);assert.equal(await cdp.evaluate("document.querySelector('.review-runtime').evidenceStudy.snapshot().measured"),null);await importFile('.ev-measured-file','scripts/fixtures/measured-workspace-v2.json');await wait("Boolean(document.querySelector('.review-runtime').evidenceStudy.snapshot().measured)");const before=await cdp.evaluate("document.querySelector('.review-runtime').evidenceStudy.snapshot().measured");assert.equal(before.availability.total,94);await screenshot('measured-import');await geometry('measured-import');await importFile('.ev-measured-file','scripts/fixtures/measured-workspace-invalid.json');await wait("document.querySelector('.review-runtime').evidenceStudy.snapshot().mode==='error'");assert.deepEqual(await cdp.evaluate("document.querySelector('.review-runtime').evidenceStudy.snapshot().measured"),before,'Invalid measured report replaced valid session evidence');
}
async function builderSemantics(){
 await open(WORKSPACE_CATALOG.builder.path);
 const start=await cdp.evaluate("document.querySelector('.review-runtime').builderStudy.snapshot().input");
 const expected=runBuilderProbe(start.graph,start.addressing,start.routing,'ping',start.sourceId,start.destinationId,1,start.linkProfiles,start.acl,start.nat,start.natSessions);
 const initial=await cdp.evaluate("document.querySelector('.review-runtime').builderStudy.runPing()");
 assert.deepEqual(initial,expected,'Builder must show the actual canonical forwarding result, including an unconfigured boundary');
 const result=await cdp.evaluate("(()=>{const api=document.querySelector('.review-runtime').builderStudy;api.apply(next=>({...next,routing:{...next.routing,ospf:{...next.routing.ospf,enabledRouterIds:next.graph.nodes.filter(n=>n.kind==='router').map(n=>n.id)}}}),'OSPF enabled');const probe=api.runPing(),output=api.runCommand('show route'),saved=api.save();api.restore(saved);const restored=api.save();return {success:probe.success,output,retained:JSON.stringify(saved.input)===JSON.stringify(restored.input),events:restored.input.events.length,cli:restored.cliResult};})()");
 assert.equal(start.graph.nodes.length,6);assert.equal(result.success,true,'Configured OSPF must deliver the probe');assert.equal(result.retained,true);assert.ok(result.events>0);assert.ok(result.output?.length);assert.ok(result.cli.count>0);await settled();await screenshot('builder-live');await geometry('builder-live');
}
async function navigationContinuity(){
 await open(WORKSPACE_CATALOG.tcp.path);
 const before=await cdp.evaluate("(()=>{const api=document.querySelector('.review-runtime').causalStudy,p=api.snapshot().plan.phases.find(p=>p.kind==='read');api.seek((p.start+p.end)/2);return api.save();})()");
 await cdp.evaluate("(()=>{const picker=document.querySelector('.rv-scene-picker');picker.value='dns';picker.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait("document.querySelector('.review-runtime')?.causalStudy?.snapshot().sceneId==='dns'");
 await cdp.evaluate("(()=>{const picker=document.querySelector('.rv-scene-picker');picker.value='tcp';picker.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait("document.querySelector('.review-runtime')?.causalStudy?.snapshot().sceneId==='tcp'&&Boolean(document.querySelector('.review-runtime').causalStudy.snapshot().plan)");await settled();
 const after=await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.save()");assert.equal(after.sceneId,before.sceneId);assert.equal(after.position.id,before.position.id);assert.equal(after.position.kind,before.position.kind);assert.ok(Math.abs(after.position.p-before.position.p)<1e-6,'Protocol return must retain its exact phase');
 await open(WORKSPACE_CATALOG.builder.path);const builder=await cdp.evaluate("(()=>{const api=document.querySelector('.review-runtime').builderStudy;api.runCommand('ping app');api.selectPage('cli');return api.save();})()");
 await cdp.evaluate(`document.querySelector('.app-navigation a[href="/"]').click()`);await wait("Boolean(document.querySelector('.review-runtime')?.connectedStudy)");
 await cdp.evaluate(`document.querySelector('.app-navigation a[href="${WORKSPACE_CATALOG.builder.path}"]').click()`);await wait("Boolean(document.querySelector('.review-runtime')?.builderStudy)");await settled();const restored=await cdp.evaluate("document.querySelector('.review-runtime').builderStudy.save()");assert.deepEqual(restored.input,builder.input,'Builder return must not repeat a probe');assert.equal(restored.cliTranscript,builder.cliTranscript);assert.equal(restored.page,builder.page);
 await open(WORKSPACE_CATALOG.journey.path);const journey=await cdp.evaluate("(()=>{const root=document.querySelector('.review-runtime'),api=root.causalStudy,s=api.snapshot(),frame=s.frames.find(f=>f.event.detailLab);api.presentSource(frame.at,s.frames.at(-1).at,true);return api.save();})()");
 await cdp.evaluate("document.querySelector('.journey-context-actions button').click()");await wait("Boolean(document.querySelector('.app-return'))");await cdp.evaluate("document.querySelector('.app-return').click()");await wait("document.querySelector('.review-runtime')?.causalStudy?.snapshot().sceneId==='journey'&&Boolean(document.querySelector('.review-runtime').causalStudy.snapshot().plan)");await settled();const returned=await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.save()");assert.equal(returned.position.id,journey.position.id);assert.equal(returned.position.kind,journey.position.kind);assert.ok(Math.abs(returned.position.p-journey.position.p)<1e-6);assert.equal(await cdp.evaluate("document.querySelectorAll('.review-runtime').length"),1,'Only the active presentation may be mounted');
 await cdp.evaluate("(()=>{const picker=document.querySelector('.rv-theme');picker.value='dark';picker.dispatchEvent(new Event('change',{bubbles:true}));})()");production.setNavigationIsolation(false);try{await cdp.call('Page.reload');await wait("Boolean(document.querySelector('.review-runtime')?.causalStudy?.snapshot().plan)");assert.equal(await cdp.evaluate("document.documentElement.dataset.theme"),'dark');assert.equal(await cdp.evaluate("document.querySelector('.rv-theme').value"),'dark');}finally{production.setNavigationIsolation(true);}report.navigationContinuity=true;
}
async function captureContinuity(){
 await open(WORKSPACE_CATALOG.capture.path);await importFile('.ev-capture-file',join(output,'capture-fixture.pcap'));await wait("document.querySelector('.review-runtime').evidenceStudy.snapshot().capture.frames.length===2");const saved=await cdp.evaluate("(()=>{const api=document.querySelector('.review-runtime').evidenceStudy;api.inspectByte(14);return api.snapshot();})()");
 await cdp.evaluate("(()=>{const picker=document.querySelector('.ev-workspace');picker.value='measured';picker.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait("document.querySelector('.review-runtime')?.evidenceStudy?.snapshot().workspace==='measured'");
 await cdp.evaluate("(()=>{const picker=document.querySelector('.ev-workspace');picker.value='capture';picker.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait("document.querySelector('.review-runtime')?.evidenceStudy?.snapshot().workspace==='capture'");await settled();const restored=await cdp.evaluate("document.querySelector('.review-runtime').evidenceStudy.snapshot()");assert.deepEqual(restored.captureBytes,saved.captureBytes);for(const key of ['byte','frameIndex','fieldId','layerIndex'])assert.equal(restored[key],saved[key],'Capture selection '+key+' changed on return');report.captureContinuity=true;
}
async function viewportMatrix(){
 const ids=mode==='phase4'?['measured','capture','observed','physical','internet']:mode==='timeline'||mode==='geometry'?mode==='geometry'?['dns']:['journey','failure','tcp','dns','tls','http']:mode==='overview'?['home']:['home','journey','tcp','dns','tls','http','failure','packet','builder','internet'];
 const viewports=mode==='performance'?[['wide',1440,1000],['mobile',390,844]]:[['wide',1440,1000],['laptop',1280,800],['tablet',1024,768],['mobile',390,844],['small-mobile',320,720]];
 for(const id of ids)for(const [size,width,height]of viewports)for(const theme of ['light','dark']){
  const name=id+'-'+size+'-'+theme;await open(id==='home'?'/':WORKSPACE_CATALOG[id].path,width,height,theme);if(mode==='phase4'&&id==='measured'){await importFile('.ev-measured-file','scripts/fixtures/measured-workspace-v2.json');await wait("Boolean(document.querySelector('.review-runtime').evidenceStudy.snapshot().measured)");await settled();}if(mode==='phase4'&&id==='capture'){await importFile('.ev-capture-file',join(output,'capture-fixture.pcap'));await wait("document.querySelector('.review-runtime').evidenceStudy.snapshot().capture.frames.length===2");await settled();}await geometry(name);if(mode!=='performance')await screenshot(name);
 }
}
async function journeyMatrix(){
 const variants=[['tcp-h2','clean',[]],['quic-h3','single-loss',['single-loss']],['tcp-h2','route-failure',['route-failure']]];
 for(const [transportProfile,impairmentProfile,modifierIds]of variants){const scenario=buildJourneyScenario('example.test',{transportProfile,dnsProfile:'cache-miss',impairmentProfile,modifierIds}),indices=Array.from({length:15},(_,i)=>Math.round(i*(scenario.events.length-1)/14));await open('/journey'+encodeJourneyQuery(createPortableJourneyScenario({hostname:'example.test',config:{transportProfile,dnsProfile:'cache-miss',impairmentProfile,modifierIds},timeMs:0})));for(const index of indices){const event=scenario.events[index];await cdp.evaluate(`(()=>{const api=document.querySelector('.review-runtime').causalStudy;api.presentSource(${event.atMs},${scenario.durationMs},true);})()`);await settled();const actual=await cdp.evaluate("document.querySelector('.rv-model-time').textContent");assert.ok(actual.includes(event.id+' · '+event.atMs+' ms'));await screenshot('journey-'+transportProfile+'-'+impairmentProfile+'-'+index);await geometry('journey-'+transportProfile+'-'+impairmentProfile+'-'+index);}}
}
async function performanceBudgets(){
 const assets=readdirSync('dist/assets'),sum=extension=>assets.filter(name=>name.endsWith(extension)).reduce((total,name)=>total+gzipSync(readFileSync(join('dist/assets',name)),{level:9}).length,0);report.bundle={jsGzipBytes:sum('.js'),cssGzipBytes:sum('.css')};assert.ok(report.bundle.jsGzipBytes<=budgets.budgets.maxJsGzipBytes,'JS bundle budget exceeded');assert.ok(report.bundle.cssGzipBytes<=budgets.budgets.maxCssGzipBytes,'CSS bundle budget exceeded');
 for(const profile of ['as-density','builder-density','physical-density']){
  await open('/?stress='+profile);await settled();const value=await geometry(profile),budget=budgets.stressBudgets[profile];await cdp.call('HeapProfiler.collectGarbage');const heap=await cdp.call('Runtime.getHeapUsage');assert.ok(value.elements<=budget.maxDomElements,profile+' DOM '+value.elements+' exceeds '+budget.maxDomElements);assert.ok(heap.usedSize<=budget.maxHeapUsedBytes,profile+' heap exceeds budget');const counts=await cdp.evaluate("(()=>{const root=document.querySelector('.review-runtime'),b=root.builderStudy?.snapshot(),e=root.evidenceStudy?.snapshot();return {nodes:b?.input.graph.nodes.length,links:b?.input.graph.links.length,asNodes:root.reviewData.internet?.graph.nodes.length,asLinks:root.reviewData.internet?.graph.relationships.length,points:root.reviewData.physical?.facilities.length};})()");if(profile==='as-density'){assert.equal(counts.asNodes,160);assert.equal(counts.asLinks,220);}if(profile==='builder-density'){assert.equal(counts.nodes,32);assert.equal(counts.links,96);}if(profile==='physical-density')assert.equal(counts.points,2000);report.profiles.at(-1).heap=heap.usedSize;report.profiles.at(-1).counts=counts;
 }
 const config={transportProfile:'quic-h3',dnsProfile:'cache-miss',impairmentProfile:'composed',modifierIds:['dns-failure','route-failure','route-leak','server-failure','single-loss','latency-spike','congestion','partition']};await open('/journey'+encodeJourneyQuery(createPortableJourneyScenario({hostname:'example.test',config,timeMs:0})));await cdp.call('HeapProfiler.collectGarbage');const initial=await cdp.call('Runtime.getHeapUsage');const growth=await cdp.evaluate(`(()=>{const api=document.querySelector('.review-runtime').causalStudy,plan=api.snapshot().plan;for(let cycle=0;cycle<${budgets.stressBudgets.highDensitySeek.cycles};cycle++)for(const clock of plan.commits)api.seek(clock);return {events:plan.commits.length,cycles:${budgets.stressBudgets.highDensitySeek.cycles}};})()`);await settled();await cdp.call('HeapProfiler.collectGarbage');const end=await cdp.call('Runtime.getHeapUsage');assert.equal(growth.events,budgets.stressBudgets.highDensitySeek.eventsPerCycle);assert.ok(end.usedSize-initial.usedSize<=budgets.stressBudgets.highDensitySeek.maxHeapGrowthBytes,'Repeated seek heap growth exceeds existing budget');report.highDensitySeekStress={...growth,heapGrowthBytes:end.usedSize-initial.usedSize};
 for(const profile of report.profiles.filter(p=>!p.id.includes('density'))){assert.ok(profile.elements<=budgets.budgets.maxDomElements,profile.id+' DOM budget exceeded: '+profile.elements);assert.ok(profile.heap<=budgets.budgets.maxHeapUsedBytes,profile.id+' heap budget exceeded: '+profile.heap);}
 await open('/journey');await cdp.call('HeapProfiler.collectGarbage');const seekBefore=await cdp.call('Runtime.getHeapUsage');const ordinarySeek=await cdp.evaluate(`(()=>{const api=document.querySelector('.review-runtime').causalStudy,plan=api.snapshot().plan,before=JSON.stringify(api.snapshot().frames.map(f=>[f.id,f.at]));for(let cycle=0;cycle<${budgets.stress.seekCycles};cycle++)for(const clock of plan.commits)api.seek(clock);return {cycles:${budgets.stress.seekCycles},events:plan.commits.length,unchanged:before===JSON.stringify(api.snapshot().frames.map(f=>[f.id,f.at]))};})()`);await cdp.call('HeapProfiler.collectGarbage');const seekAfter=await cdp.call('Runtime.getHeapUsage');assert.equal(ordinarySeek.unchanged,true);assert.ok(seekAfter.usedSize-seekBefore.usedSize<=budgets.budgets.maxHeapGrowthBytes,'Regular seek heap growth exceeds existing budget');report.seekStress={...ordinarySeek,heapGrowthBytes:seekAfter.usedSize-seekBefore.usedSize};
}
try{
 production=await serveProductionArtifact(resolve('dist'));launch=await launchChrome(findChrome());const targets=await fetchJson('http://127.0.0.1:'+launch.port+'/json'),target=targets.find(t=>t.type==='page');cdp=new CdpClient(target.webSocketDebuggerUrl);for(const domain of ['Page','DOM','Runtime','Log','HeapProfiler'])await cdp.call(domain+'.enable');report.browser=launch.version;
 const task=async(name,run)=>{try{await run();}catch(error){report.failures.push(name+': '+(error.stack||String(error)));await screenshot(name+'-failure').catch(()=>{});}};
 await task('canonical-source',sourceSemantics);if(mode==='choreography')await task('wire-playback',wirePlayback);await task('moving-lifecycle',movingLifecycle);if(['capture','phase4','performance'].includes(mode)){await task('capture',captureSemantics);await task('measured',measuredSemantics);}if(['phase3','performance'].includes(mode))await task('builder',builderSemantics);if(mode==='phase3')await task('navigation',navigationContinuity);if(mode==='phase4')await task('capture-return',captureContinuity);
 if(mode==='journey'||mode==='choreography')await task('journey',journeyMatrix);else await task('viewports',viewportMatrix);if(mode==='performance')await task('performance-budgets',performanceBudgets);if(report.failures.length)process.exitCode=1;
}catch(error){report.failures.push(error.stack||String(error));process.exitCode=1;}
finally{writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');await cdp?.close();if(launch?.chrome&&!launch.chrome.killed)launch.chrome.kill('SIGKILL');if(launch?.userDataDir)rmSync(launch.userDataDir,{recursive:true,force:true});await new Promise(resolve=>production?.server.close(resolve)||resolve());console.log(JSON.stringify({mode,profiles:report.profiles.length,failures:report.failures,report:reportPath}));}

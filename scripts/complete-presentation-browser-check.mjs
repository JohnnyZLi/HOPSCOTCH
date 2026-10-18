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
async function settled(){await cdp.evaluate(`(async()=>{
 await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 let timeout;
 try{await Promise.race([
  Promise.allSettled(document.getAnimations().filter(a=>a.effect.getComputedTiming().iterations!==Infinity).map(a=>a.finished)),
  new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('UI animations did not settle: '+JSON.stringify(document.getAnimations().map(a=>({target:a.effect.target?.outerHTML.slice(0,180),playState:a.playState,pending:a.pending,currentTime:a.currentTime,timing:a.effect.getComputedTiming()}))))),15000);})
 ]);}finally{clearTimeout(timeout);}
 await new Promise(resolve=>requestAnimationFrame(resolve));
})()`);}
async function open(path,width=1440,height=1000,theme='light',reduced=false){
 console.log('Checking',path,width+'x'+height,theme,reduced?'reduced-motion':'');
 await cdp.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await cdp.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
 cdp.clearEvents();await cdp.call('Page.navigate',{url:production.origin+path});await wait("Boolean(document.querySelector('.review-runtime')?.causalStudy||document.querySelector('.review-runtime')?.builderStudy||document.querySelector('.review-runtime')?.evidenceStudy||document.querySelector('.review-runtime')?.homeStudy||document.querySelector('.workspace-error'))");
 assert.equal(await cdp.evaluate("Boolean(document.querySelector('.workspace-error'))"),false,'A complete composition failed to mount.');
 await wait("Boolean(document.querySelector('.review-runtime')?.homeStudy||document.querySelector('.review-runtime')?.workspaceSurface||document.querySelector('.workspace-error'))");
 await cdp.evaluate(`(()=>{const root=document.querySelector('.review-runtime'),picker=root.querySelector('.rv-theme');if(picker){picker.value=${JSON.stringify(theme)};picker.dispatchEvent(new Event('change',{bubbles:true}));}else{root.querySelector('[data-appearance-value='+${JSON.stringify(theme)}+']').click();}})()`);await settled();
 await wait("document.querySelectorAll('.lh-wallpaper').length===2&&[...document.querySelectorAll('.lh-wallpaper')].every(image=>image.complete&&image.naturalWidth>0)");await settled();
 const hasLifecycle=await cdp.evaluate("Boolean(document.querySelector('.review-runtime').causalStudy)");if(hasLifecycle)await wait("Boolean(document.querySelector('.review-runtime').causalStudy.snapshot().plan)");
 const hasAs=await cdp.evaluate("document.querySelector('.review-runtime').evidenceStudy?.snapshot().workspace==='internet'");if(hasAs)await wait("Boolean(document.querySelector('.review-runtime').evidenceStudy.snapshot().graphPlan)",60000);
 const hasBuilder=await cdp.evaluate("Boolean(document.querySelector('.review-runtime').builderStudy)");if(hasBuilder)await wait("Boolean(document.querySelector('.review-runtime').builderStudy.snapshot().graphPlan)",60000);
}
async function screenshot(name){const capture=await cdp.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(output,name+'.png'),Buffer.from(capture.data,'base64'));}
async function geometry(name){
 const value=await cdp.evaluate(`(()=>{const root=document.querySelector('.review-runtime'),style=getComputedStyle(root),box=n=>{const r=n?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null;},visible=n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0&&!n.closest('[hidden]'),stage=root.querySelector('.rv-stage,.wb-map,.ev-content,.lh-launcher'),console=root.querySelector('.rv-console'),buttons=[...root.querySelectorAll('button,input,select,summary')].filter(n=>visible(n)&&!n.closest('.rv-network-world,.ev-as-nodes,[aria-hidden="true"],[inert]'));return {theme:root.dataset.theme,scrollWidth:document.documentElement.scrollWidth,width:innerWidth,elements:document.getElementsByTagName('*').length,stage:box(stage),console:box(console),header:box(root.querySelector('.rv-header,.lh-header')),title:root.querySelector('h1,h2')?.textContent,titleInIntro:Boolean(root.homeStudy||root.querySelector('.ws-intro h2')),legacy:document.querySelectorAll('.kinetic-overview,.visual-workspace,.reviewed-primary,.journey-stage').length,overflow:buttons.filter(n=>{const r=n.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(n=>n.textContent||n.getAttribute('aria-label')),font:style.fontFamily,material:root.surfacePainter?.stats()??root.recordMaterial?.stats(),source:root.querySelector('.rv-model-time')?.textContent};})()`);
 assert.equal(value.legacy,0,name+' retained legacy presentation');assert.ok(value.scrollWidth<=value.width+1,name+' page overflows');assert.deepEqual(value.overflow,[],name+' controls overflow');assert.ok(value.header?.w>0,name+' approved header hidden');assert.ok(value.title?.length,name+' approved title missing');assert.equal(value.titleInIntro,true,name+' primary heading must precede its subtitle in the shared intro');
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
   assert.ok(sample.actor);assert.equal(sample.sourceUnchanged,true);assert.deepEqual([...sample.fields].sort((a,b)=>a.id.localeCompare(b.id)),[...sample.sourceFields].sort((a,b)=>a.id.localeCompare(b.id)));assert.ok(sample.fonts.every(size=>size>=12));assert.ok(sample.actorCount<=2);
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
 const handoffs=await cdp.evaluate(`(()=>{const root=document.querySelector('.review-runtime'),api=root.causalStudy,plan=api.snapshot().plan,rect=node=>{const range=document.createRange();range.selectNodeContents(node);return range.getBoundingClientRect();},samples=[];for(const phase of plan.phases.filter(p=>p.kind==='retain'&&plan.prepared[p.index].transfer))for(const fraction of [0,.2,.4,.6,.7,.8,.9,.99]){api.seek(phase.start+(phase.end-phase.start)*fraction);const prepared=plan.prepared[phase.index],target=root.querySelector(prepared.transferTarget),receiver=rect(target),glyphs=[...root.querySelectorAll('.rv-transfer .hs-transfer-new')].filter(n=>Number(getComputedStyle(n).opacity)>.5),overlap=glyphs.some(n=>{const r=rect(n);return r.left<receiver.right&&r.right>receiver.left&&r.top<receiver.bottom&&r.bottom>receiver.top;});samples.push({id:api.snapshot().frames[phase.index].id,fraction,overlap,opacity:Number(getComputedStyle(target).opacity),value:target.textContent,after:prepared.transfer.after});}return samples;})()`);
 assert.ok(handoffs.some(sample=>sample.overlap&&sample.value!==sample.after),'A changing value must reach its actual receiver footprint');for(const sample of handoffs)if(sample.overlap&&sample.value!==sample.after)assert.equal(sample.opacity,0,'Old receiver value overlaps an arriving value: '+JSON.stringify(sample));report.receiverHandoffs=handoffs;
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
 assert.equal(start.graph.nodes.length,6);assert.equal(result.success,true,'Configured OSPF must deliver the probe');assert.equal(result.retained,true);assert.ok(result.events>0);assert.ok(result.output?.length);assert.ok(result.cli.count>0);
 const transcript=await cdp.evaluate("document.querySelector('.wb-output').textContent");await cdp.evaluate("document.querySelector('.wb-pages [data-page=cli]').click()");
 for(const group of result.cli.groups){
  const selector='.wb-command-result details[data-disclosure-key="cli-route-'+group.id+'"]';
  await cdp.evaluate(`(()=>{const detail=document.querySelector(${JSON.stringify(selector)});if(!document.querySelector('.review-runtime').disclosures.wanted(detail))detail.querySelector('summary').click();})()`);
  await wait(`document.querySelector(${JSON.stringify(selector)}).querySelectorAll('tbody tr:not(.rv-row-note)').length===${group.rows.length}`);
  await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).querySelector('summary').click()`);
  await wait(`!document.querySelector(${JSON.stringify(selector)}).querySelector('table')`);
 }
 assert.equal(await cdp.evaluate("document.querySelector('.wb-output').textContent"),transcript,'Inspecting CLI groups must retain the complete transcript');await settled();await screenshot('builder-live');await geometry('builder-live');
}
async function navigationContinuity(){
 await open(WORKSPACE_CATALOG.tcp.path);
 const before=await cdp.evaluate("(()=>{const api=document.querySelector('.review-runtime').causalStudy,p=api.snapshot().plan.phases.find(p=>p.kind==='read');api.seek((p.start+p.end)/2);return api.save();})()");
 await cdp.evaluate("(()=>{const picker=document.querySelector('.rv-scene-picker');picker.value='dns';picker.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait("document.querySelector('.review-runtime')?.causalStudy?.snapshot().sceneId==='dns'");
 await cdp.evaluate("(()=>{const picker=document.querySelector('.rv-scene-picker');picker.value='tcp';picker.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait("document.querySelector('.review-runtime')?.causalStudy?.snapshot().sceneId==='tcp'&&Boolean(document.querySelector('.review-runtime').causalStudy.snapshot().plan)");await settled();
 const after=await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.save()");assert.equal(after.sceneId,before.sceneId);assert.equal(after.position.id,before.position.id);assert.equal(after.position.kind,before.position.kind);assert.ok(Math.abs(after.position.p-before.position.p)<1e-6,'Protocol return must retain its exact phase');
 await open(WORKSPACE_CATALOG.builder.path);const builder=await cdp.evaluate("(()=>{const api=document.querySelector('.review-runtime').builderStudy;api.runCommand('ping app');api.selectPage('cli');return api.save();})()");
 await cdp.evaluate(`document.querySelector('.lh-brand[href="/"]').click()`);await wait("Boolean(document.querySelector('.review-runtime')?.homeStudy)");
 await cdp.evaluate(`document.querySelector('.lh-navigation a[href="${WORKSPACE_CATALOG.builder.path}"]').click()`);await wait("Boolean(document.querySelector('.review-runtime')?.builderStudy)");await settled();const restored=await cdp.evaluate("document.querySelector('.review-runtime').builderStudy.save()");assert.deepEqual(restored.input,builder.input,'Builder return must not repeat a probe');assert.equal(restored.cliTranscript,builder.cliTranscript);assert.equal(restored.page,builder.page);
 await open(WORKSPACE_CATALOG.journey.path);const journey=await cdp.evaluate("(()=>{const root=document.querySelector('.review-runtime'),api=root.causalStudy,s=api.snapshot(),frame=s.frames.find(f=>f.event.detailLab);api.presentSource(frame.at,s.frames.at(-1).at,true);return api.save();})()");
 await cdp.evaluate("document.querySelector('.rv-playback-settings > summary').click()");await settled();await cdp.evaluate("document.querySelector('.journey-context-actions > button').click()");await wait("Boolean(document.querySelector('.app-return'))");await cdp.evaluate("document.querySelector('.app-return').click()");await wait("document.querySelector('.review-runtime')?.causalStudy?.snapshot().sceneId==='journey'&&Boolean(document.querySelector('.review-runtime').causalStudy.snapshot().plan)");await settled();const returned=await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.save()");assert.equal(returned.position.id,journey.position.id);assert.equal(returned.position.kind,journey.position.kind);assert.ok(Math.abs(returned.position.p-journey.position.p)<1e-6);assert.equal(await cdp.evaluate("document.querySelectorAll('.review-runtime').length"),1,'Only the active presentation may be mounted');
 await cdp.evaluate("(()=>{const picker=document.querySelector('.rv-theme');picker.value='dark';picker.dispatchEvent(new Event('change',{bubbles:true}));})()");production.setNavigationIsolation(false);try{await cdp.call('Page.reload');await wait("Boolean(document.querySelector('.review-runtime')?.causalStudy?.snapshot().plan)");assert.equal(await cdp.evaluate("document.documentElement.dataset.theme"),'dark');assert.equal(await cdp.evaluate("document.querySelector('.rv-theme').value"),'dark');}finally{production.setNavigationIsolation(true);}report.navigationContinuity=true;
}
async function captureContinuity(){
 await open(WORKSPACE_CATALOG.capture.path);await importFile('.ev-capture-file',join(output,'capture-fixture.pcap'));await wait("document.querySelector('.review-runtime').evidenceStudy.snapshot().capture.frames.length===2");const saved=await cdp.evaluate("(()=>{const api=document.querySelector('.review-runtime').evidenceStudy;api.inspectByte(14);return api.snapshot();})()");
 await cdp.evaluate("(()=>{const picker=document.querySelector('.ev-workspace');picker.value='measured';picker.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait("document.querySelector('.review-runtime')?.evidenceStudy?.snapshot().workspace==='measured'");
 await cdp.evaluate("(()=>{const picker=document.querySelector('.ev-workspace');picker.value='capture';picker.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait("document.querySelector('.review-runtime')?.evidenceStudy?.snapshot().workspace==='capture'");await settled();const restored=await cdp.evaluate("document.querySelector('.review-runtime').evidenceStudy.snapshot()");assert.deepEqual(restored.captureBytes,saved.captureBytes);for(const key of ['byte','frameIndex','fieldId','layerIndex'])assert.equal(restored[key],saved[key],'Capture selection '+key+' changed on return');report.captureContinuity=true;
}
async function recoveredStudies(){
 for(const [width,height,theme]of [[1280,900,'light'],[1280,900,'dark'],[390,844,'light'],[390,844,'dark']]){
  await open('/labs/tcp',width,height,theme,true);
  const tcp=await cdp.evaluate(`(()=>{const root=document.querySelector('.review-runtime'),fields=root.querySelector('.rv-actor-face .rv-fields'),flag=fields.querySelector('[data-field=flags]'),seq=fields.querySelector('[data-field=seq]'),ack=fields.querySelector('[data-field=ack]'),rect=n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,bottom:b.bottom};};return {title:root.querySelector('.rv-actor-title').textContent,owners:[...root.querySelectorAll('.rv-peer-state h3')].map(n=>n.textContent),fieldBox:rect(fields),flag:rect(flag),seq:rect(seq),ack:rect(ack),receiver:root.querySelector('.rv-expected').closest('.rv-peer-state')?.querySelector('h3').textContent};})()`);
  const fit=await cdp.evaluate("(()=>{const s=document.querySelector('.review-runtime').causalStudy.snapshot(),g=s.plan.prepared[s.at.index];return {focus:g.focus.h,full:g.fullHeight};})()");assert.equal(fit.focus,fit.full,'The complete TCP segment stays visible in the study');
  assert.equal(tcp.title,'TCP segment');assert.deepEqual(tcp.owners,['Client TCP','Server TCP']);assert.equal(tcp.receiver,'Server TCP');
  assert.ok(Math.abs(tcp.flag.width-tcp.fieldBox.width)<1,'Flags lead the packet across its full reading width');assert.ok(tcp.flag.bottom<=tcp.seq.y+1,'Sequence follows the leading flags');assert.ok(Math.abs(tcp.seq.y-tcp.ack.y)<1,'Sequence and acknowledgment remain a pair when measured width permits');
  await screenshot('tcp-recovered-study-'+width+'-'+theme);
 }
 await open('/journey',1280,900,'light',true);
 const retained=await cdp.evaluate(`(()=>{const root=document.querySelector('.review-runtime'),api=root.causalStudy,s=api.snapshot(),states=[];let carrier;
 for(const transit of ['router-decapsulate','router-ttl','router-reencapsulate']){const index=s.frames.findIndex(f=>f.assembly?.transit===transit),phase=s.plan.phases.find(p=>p.index===index&&p.kind==='hold');api.seek(phase.start);const f=api.snapshot().frames[index],node=root.querySelector('.rv-actor'),g=s.plan.prepared[index],head=root.querySelector('.rv-envelope-header'),tail=root.querySelector('.rv-envelope-trailer');if(!carrier)carrier=node;
 states.push({transit,sameCarrier:node===carrier,identity:node.dataset.identity,label:node.getAttribute('aria-label'),expectedLabel:f.objectTitle+' · '+f.id,compact:node.querySelector('.rv-capsule').lastChild.textContent,expectedCompact:f.compactTitle||f.objectTitle,fields:f.fields.map(({id,value})=>({id,value})),projected:f.assembly.projection.layers.find(l=>l.id==='network').fields.map(({id,value})=>({id,value})),outerVisible:!head.hidden&&!tail.hidden,envelope:f.assembly.envelope.present,headerParent:head.parentElement===root.querySelector('.rv-envelopes'),contact:Math.abs(parseFloat(head.style.top)+parseFloat(head.style.height)-g.focus.y)<1,title:root.querySelector('.rv-actor-title').textContent,miniPackets:node.querySelectorAll('.rv-layer-piece').length});}
 return states;})()`);
 for(const state of retained){assert.equal(state.label,state.expectedLabel,'A reused carrier announces the current physical object');assert.equal(state.compact,state.expectedCompact,'The wire capsule identifies its current object');assert.ok(state.sameCarrier,'A routed packet keeps its actual DOM carrier');assert.deepEqual(state.fields,state.projected,'Routed fields come from the current canonical packet projection');assert.equal(state.outerVisible,state.envelope);assert.ok(state.headerParent);assert.equal(state.title,'IPv4 packet');assert.equal(state.miniPackets,0);if(state.envelope)assert.ok(state.contact,'The new outer header seats against the retained IP packet');}
 await screenshot('journey-recovered-router-frame');report.recoveredStudies=retained;
}
async function workspaceMenus(){
 for(const [width,height,theme]of [[1280,800,'light'],[1280,800,'dark'],[390,844,'light'],[390,844,'dark']]){
  await open('/journey',width,height,theme,true);
  const shell=await cdp.evaluate(`(()=>{const root=document.querySelector('.review-runtime'),stage=root.querySelector('.rv-stage').getBoundingClientRect(),console=root.querySelector('.rv-console').getBoundingClientRect();return {headers:root.querySelectorAll('header').length,oldNav:document.querySelectorAll('.app-navigation').length,native:[...root.querySelectorAll('select')].filter(n=>n.getBoundingClientRect().width>0).length,stageLeft:stage.left,stageRight:stage.right,stageTop:stage.top,stageBottom:stage.bottom,consoleLeft:console.left,consoleTop:console.top,consoleBottom:console.bottom,theme:root.dataset.theme};})()`);
  assert.equal(shell.headers,1);assert.equal(shell.oldNav,0);assert.equal(shell.native,0,'Workspace selectors must use the custom menu');assert.ok(shell.consoleTop>=shell.stageBottom,'Playback follows the scene in the recovered study composition');assert.equal(shell.theme,theme);
  assert.ok(shell.consoleBottom>shell.consoleTop,'Playback remains a readable flow region');
  const initial=await cdp.evaluate(`(()=>{const s=document.querySelector('.review-runtime').causalStudy.snapshot(),g=s.plan.prepared[s.at.index];return {focus:g.focus.h,full:g.fullHeight};})()`);
  assert.equal(initial.focus,initial.full,'The opening local operation must fit without clipping its heading or fields');
  const owners=await cdp.evaluate(`(()=>{const root=document.querySelector('.review-runtime'),scene=root.querySelector('.rv-stage'),console=root.querySelector('.rv-console'),inspector=root.querySelector('.rv-scene-details'),style=getComputedStyle(root.querySelector('.rv-composition'));return {retainedInScene:scene.contains(root.querySelector('.rv-retained-dock')),inspectorOutsidePlayback:!console.contains(inspector)&&root.querySelector('.rv-main').contains(inspector),columns:style.gridTemplateColumns};})()`);
  assert.ok(owners.retainedInScene,'Retained values stay within the reviewed scene');assert.ok(owners.inspectorOutsidePlayback,'Full inspection stays below the primary composition');assert.equal(owners.columns,'none','The primary scene no longer shares a generic sidebar grid');

  await screenshot('journey-shared-surface-'+width+'-'+theme);
  // The densest source object preserves the reference column alignment and playback position.
  const before=await cdp.evaluate(`(()=>{const api=document.querySelector('.review-runtime').causalStudy,s=api.snapshot(),saved=api.save(),index=s.plan.prepared.reduce((best,g,i)=>g.fullHeight>s.plan.prepared[best].fullHeight?i:best,0),phase=s.plan.phases.find(p=>p.index===index&&p.kind==='read');if(phase)api.seek((phase.start+phase.end)/2);return saved;})()`);await settled();
  const dense=await cdp.evaluate(`(()=>{const root=document.querySelector('.review-runtime'),bar=root.querySelector('.rv-console').getBoundingClientRect(),s=root.causalStudy.snapshot(),g=s.plan.prepared[s.at.index];return {top:bar.top,stageLeft:root.querySelector('.rv-stage').getBoundingClientRect().left,bottom:bar.bottom,focusHeight:g.focus.h,fullHeight:g.fullHeight,event:s.frames[s.at.index].id};})()`);
  assert.equal(dense.stageLeft,shell.stageLeft,'Scene alignment must stay stable when optional content crosses the fold');assert.ok(Math.abs(dense.top-shell.consoleTop)<1,'Playback must retain its reference position across source states');assert.ok(dense.bottom>dense.top,'Dense playback remains readable');assert.ok(dense.focusHeight>0&&dense.focusHeight<=dense.fullHeight);
  await screenshot('journey-dense-reading-'+width+'-'+theme);
  await cdp.evaluate(`document.querySelector('.review-runtime').causalStudy.restore(${JSON.stringify(before)})`);await settled();
  const headerHeight=await cdp.evaluate("document.querySelector('.lh-header').getBoundingClientRect().height");
  await cdp.evaluate("document.querySelector('.lh-theme').click()");await settled();
  assert.equal(await cdp.evaluate("document.querySelector('.lh-header').getBoundingClientRect().height"),headerHeight);
  await cdp.evaluate("document.querySelector('.ws-scene-picker .ws-select-trigger').click()");await settled();
  const scene=await cdp.evaluate(`(()=>{const panel=document.querySelector('.ws-scene-picker .ws-select-panel'),b=panel.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,current:panel.querySelector('[aria-pressed=true]')?.textContent,appearance:document.querySelector('.lh-appearance').open};})()`);
  assert.equal(scene.appearance,false);assert.match(scene.current,/Journey/);assert.ok(scene.left>=0&&scene.right<=width&&scene.top>=0&&scene.bottom<=height,'Scene menu must stay in the viewport');
  await screenshot('journey-scene-menu-'+width+'-'+theme);
  await cdp.evaluate("(()=>{const select=document.querySelector('.rv-scene-picker'),index=[...select.options].findIndex(o=>o.value==='dns');document.querySelector('.ws-scene-picker [data-select-index=\"'+index+'\"]').click();})()");
  await wait("location.pathname==='/labs/dns'&&Boolean(document.querySelector('.review-runtime')?.workspaceSurface)&&document.querySelector('.review-runtime')?.causalStudy?.snapshot().sceneId==='dns'");
  await settled();assert.equal(await cdp.evaluate("document.querySelector('.review-runtime').dataset.theme"),theme,'Custom scene navigation preserves appearance');
 }
 await open('/journey',390,844,'light',true);
 await cdp.evaluate("document.querySelector('.rv-playback-settings summary').click()");await settled();
 await cdp.evaluate("document.querySelector('.rv-speed + .ws-select summary').click()");await settled();
 await cdp.evaluate("document.querySelector('.rv-speed + .ws-select [data-select-index=\"2\"]').click()");await settled();
 assert.equal(await cdp.evaluate("document.querySelector('.rv-speed').value"),'2','Custom speed choice must update the existing playback control');
 assert.equal(await cdp.evaluate("document.activeElement.id"),await cdp.evaluate("document.querySelector('.rv-speed + .ws-select summary').id"),'Selection restores trigger focus');
 await cdp.evaluate("document.querySelector('.rv-event-picker + .ws-select summary').click()");await settled();
 await cdp.evaluate("document.querySelector('.rv-event-picker + .ws-select [data-select-index=\"1\"]').click()");await settled();
 assert.equal(await cdp.evaluate("document.querySelector('.review-runtime').causalStudy.snapshot().at.index"),1,'Custom event selection seeks the canonical event');
 await cdp.evaluate("document.querySelector('.journey-configuration summary').click()");await settled();
 await cdp.evaluate("(()=>{const select=document.querySelector('select[aria-label=Transport]');select.nextElementSibling.querySelector('summary').click();})()");await settled();
 await cdp.evaluate("document.querySelector('select[aria-label=Transport]').nextElementSibling.querySelector('[data-select-index=\"1\"]').click()");await settled();
 assert.equal(await cdp.evaluate("document.querySelector('select[aria-label=Transport]').value"),'quic-h3');
 await cdp.evaluate("document.querySelector('.journey-configuration button[type=submit]').click()");
 await wait("location.search.includes('quic-h3')&&Boolean(document.querySelector('.review-runtime')?.workspaceSurface)");await settled();
 await geometry('journey-edited-custom-controls');
 report.workspaceMenus=true;
}
async function homeMenus(){
 await open('/',390,844);
 const read=()=>cdp.evaluate(`(()=>{const root=document.querySelector('.review-runtime'),nav=root.querySelector('.lh-menu'),appearance=root.querySelector('.lh-appearance'),panel=root.querySelector('.lh-menu-panel'),rect=n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};return {header:rect(root.querySelector('.lh-header')),trigger:rect(nav.querySelector('summary')),panel:rect(panel),position:getComputedStyle(panel).position,nav:nav.open,appearance:appearance.open,theme:root.dataset.theme,globalTheme:document.documentElement.dataset.theme,preference:root.dataset.appearance,label:root.querySelector('[data-appearance-label]').textContent,selected:[...root.querySelectorAll('[aria-pressed=true]')].map(n=>n.dataset.appearanceValue),nativeSelects:root.querySelectorAll('select').length,focus:document.activeElement.id};})()`);
 const closed=await read();assert.equal(closed.nativeSelects,0);
 await cdp.evaluate(`document.querySelector('.lh-menu summary').click()`);await settled();
 const opened=await read();assert.equal(opened.nav,true);assert.equal(opened.position,'absolute');assert.equal(opened.header.height,closed.header.height,'Popup must not expand the header');assert.equal(opened.trigger.height,closed.trigger.height,'Popup must not stretch the trigger');assert.ok(opened.panel.left>=18&&opened.panel.right<=372);assert.ok(Math.abs(opened.panel.top-opened.trigger.bottom-8)<1);
 await screenshot('home-navigation-mobile');
 await cdp.evaluate(`document.querySelector('.lh-theme').click()`);await settled();
 const appearance=await read();assert.equal(appearance.nav,false);assert.equal(appearance.appearance,true);
 await cdp.evaluate(`document.querySelector('[data-appearance-value=dark]').click()`);await settled();
 const dark=await read();assert.equal(dark.theme,'dark');assert.equal(dark.globalTheme,'dark');assert.equal(dark.label,'Dark');assert.deepEqual(dark.selected,['dark']);assert.equal(dark.appearance,false);
 await cdp.evaluate(`document.querySelector('.lh-theme').click()`);await settled();await screenshot('home-appearance-mobile-dark');
 await cdp.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await settled();
 assert.equal((await read()).appearance,false);assert.equal((await read()).focus,'hopscotch-home-appearance-trigger');
 await cdp.evaluate(`document.querySelector('.lh-menu summary').click();document.querySelector('.lh-main').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);await settled();assert.equal((await read()).nav,false);
 await cdp.evaluate(`document.querySelector('.lh-menu summary').focus();document.querySelector('.lh-menu summary').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);await settled();
 assert.equal(await cdp.evaluate(`document.activeElement===document.querySelector('.lh-menu-panel a')`),true);
 await cdp.evaluate(`(()=>{window.homeResizeFocusTrace=[];const sample=event=>window.homeResizeFocusTrace.push({event:event.type,target:event.target?.tagName+':'+event.target?.id,related:event.relatedTarget?.tagName+':'+event.relatedTarget?.id,active:document.activeElement?.tagName+':'+document.activeElement?.id,open:document.querySelector('.lh-menu').open,expanded:document.querySelector('.lh-menu summary').getAttribute('aria-expanded')});for(const type of ['focusin','focusout'])document.addEventListener(type,sample,true);window.addEventListener('resize',sample,{once:true});})()`);
 await cdp.call('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});await settled();
 try{await wait("document.activeElement?.id==='hopscotch-home-appearance-trigger'",2000);}catch(error){throw Error(error.message+' · Focus events: '+JSON.stringify(await cdp.evaluate('window.homeResizeFocusTrace')));}
 assert.equal((await read()).nav,false,'A hidden responsive trigger must close its menu');assert.equal((await read()).focus,'hopscotch-home-appearance-trigger');
 await open('/',390,844,'light',true);await cdp.evaluate(`document.querySelector('.lh-theme').click();document.querySelector('[data-appearance-value=system]').click()`);await settled();
 assert.equal((await read()).preference,'system');assert.equal((await read()).label,'System');
 await cdp.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:'prefers-reduced-motion',value:'reduce'}]});await settled();assert.equal((await read()).theme,'dark','System appearance must react to a system change');
 await cdp.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});await settled();assert.equal((await read()).theme,'light');
 report.homeMenus=true;
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
 await task('canonical-source',sourceSemantics);if(mode==='overview'){await task('home-menus',homeMenus);await task('workspace-menus',workspaceMenus);await task('recovered-studies',recoveredStudies);}if(mode==='choreography')await task('wire-playback',wirePlayback);await task('moving-lifecycle',movingLifecycle);if(['capture','phase4','performance'].includes(mode)){await task('capture',captureSemantics);await task('measured',measuredSemantics);}if(['phase3','performance'].includes(mode))await task('builder',builderSemantics);if(mode==='phase3')await task('navigation',navigationContinuity);if(mode==='phase4')await task('capture-return',captureContinuity);
 if(mode==='journey'||mode==='choreography')await task('journey',journeyMatrix);else await task('viewports',viewportMatrix);if(mode==='performance')await task('performance-budgets',performanceBudgets);if(report.failures.length)process.exitCode=1;
}catch(error){report.failures.push(error.stack||String(error));process.exitCode=1;}
finally{writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');await cdp?.close();if(launch?.chrome&&!launch.chrome.killed)launch.chrome.kill('SIGKILL');if(launch?.userDataDir)rmSync(launch.userDataDir,{recursive:true,force:true});await new Promise(resolve=>production?.server.close(resolve)||resolve());console.log(JSON.stringify({mode,profiles:report.profiles.length,failures:report.failures,report:reportPath}));}

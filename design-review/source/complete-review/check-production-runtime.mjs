import assert from 'node:assert/strict';
import fs from 'node:fs';
import {environment} from './check-complete.mjs';
import {frameCamera} from './shared-geometry.js';
const data=JSON.parse(fs.readFileSync('complete-review/source-data.json','utf8'));
for(const failGL of [false,true]){
 const env=await environment('motion',390,{artifactPath:'../../public/review/lifecycle.html',failGL}),canvas=env.document.createElement('canvas'),ctx=canvas.getContext('2d');let transform=[2,0,0,2,0,0],drawn=0;
 ctx.setTransform=(...matrix)=>{transform=matrix;};ctx.drawImage=()=>{assert.deepEqual(transform,[1,0,0,1,0,0],'Pixel-addressed morph composition must not inherit a previous high-DPI fallback transform');drawn++;};canvas.getContext=()=>ctx;
 env.root.surfacePainter.prepare(350,260);env.root.surfacePainter.morph(canvas,{w:225,h:152},20,.5,{w:100,h:44,r:16},{w:350,h:260});assert(drawn>0);
 env.root.causalStudy.dispose();
}
console.log('PASS morph pixel coordinates after high-DPI GL/fallback history');
{
 const env=await environment('motion',390,{artifactPath:'../../public/review/lifecycle.html'}),painter=env.root.surfacePainter,canvas=env.document.createElement('canvas');
 const closed={w:100,h:44,r:16},expanded={w:350,h:260};painter.prepare(350,260);const before=painter.stats().draws;
 for(let i=1;i<60;i++){const p=i/60;painter.morph(canvas,{w:100+250*p,h:44+216*p},16+8*p,p,closed,expanded);}
 assert(painter.stats().draws-before<=2,'A full shape morph must render endpoint optics once, not read back a new shader frame for every pose');
 assert.equal(parseFloat(canvas.style.width),350);assert.equal(parseFloat(canvas.style.height),260,'Morph backing remains bounded by prepared layout');
 assert(canvas.width<=700&&canvas.height<=520,'Prepared backing respects the existing two-times pixel-density ceiling');
 env.root.causalStudy.dispose();console.log('PASS bounded glass morph shader work and stable backing');
}
{
 const env=await environment('motion',390,{artifactPath:'../../public/review/lifecycle.html'}),api=env.root.causalStudy,source=JSON.stringify(env.root.reviewData);
 for(const scene of ['journey','tcp','dns','tls','packetOps']){
  api.select(scene);await env.flush();
  const read=api.snapshot().plan.phases.find(p=>p.kind==='read');
  for(const [step,count,speed]of [[1000/120,120,1],[1000/60,60,1],[1000/30,30,1],[1000/20,20,1],[1000/15,15,1],[1000/10,10,1],[1000/5,5,1],[1000/60,30,2],[1000/60,120,.5]]){
   api.seek(read.start);env.q('.rv-speed').value=String(speed);api.play();env.frame(17);
   const start=api.snapshot().clock;for(let i=0;i<count;i++)env.frame(step);
   assert.ok(Math.abs(api.snapshot().clock-start-step*count*speed)<.001,'Normal display rates and selected speed retain the same presentation duration');api.pause();
  }
  const boundaryAdvances=[];for(const gap of [249.9,250.1]){api.seek(read.start);api.play();env.frame(17);const before=api.snapshot().clock;env.frame(gap);boundaryAdvances.push(api.snapshot().clock-before);api.pause();}
  assert(Math.abs(boundaryAdvances[1]-boundaryAdvances[0])<1,'Sub-millisecond frame jitter cannot create a large clock discontinuity');
  env.q('.rv-speed').value='1';api.seek(0);api.play();env.frame(17);env.frame(17);
  const before=api.snapshot();env.frame(2000);const after=api.snapshot();
  assert.ok(after.clock-before.clock>0&&after.clock-before.clock<=50,'A delayed frame must not skip the object lifecycle');
  assert.equal(after.at.kind,before.at.kind);assert.equal(after.at.index,before.at.index);
  env.frame(17);assert.ok(Math.abs(api.snapshot().clock-after.clock-17)<.001,'Excess stall time must not become catch-up debt');
  api.pause();const held=api.snapshot().clock;env.frame(5000);api.play();env.frame(5000);assert.equal(api.snapshot().clock,held,'Resume establishes a fresh frame timestamp');env.frame(17);assert.equal(api.snapshot().clock,held+17);api.pause();
  api.next();const next=api.snapshot();assert.equal(env.q('.rv-caption-title').textContent,next.frames[next.at.index].title);assert.equal(env.root.querySelectorAll('.rv-status-copy').length,0,'Stepping commits the caption with the card');
  api.seek(0);const pending=api.snapshot();if(!pending.frames[pending.at.index].local)assert.notEqual(env.q('.rv-caption-title').textContent,pending.frames[pending.at.index].title,'A source outcome cannot be announced before its wire message arrives');
  api.seek(read.start+100);assert.equal(env.q('.rv-caption-title').textContent,api.snapshot().frames[api.snapshot().at.index].title,'Receipt reveals the canonical source caption');assert.equal(env.root.querySelectorAll('.rv-status-copy').length,0,'Scrubbing cannot leave an outgoing caption over the selected card');
 }
 assert.equal(JSON.stringify(env.root.reviewData),source,'Frame-delay handling must not alter source events or bytes');api.dispose();
 console.log('PASS visible playback clock, frame-rate parity, stall recovery, resume and caption settlement');
}
{
 const env=await environment('motion',390,{artifactPath:'../../public/review/lifecycle.html'}),api=env.root.causalStudy;
 api.select('journey');env.q('.rv-caption-detail').hidden=true;api.appearance();await env.flush();
 const before=api.snapshot().plan.phases.filter(p=>p.kind==='hold').map(p=>p.end-p.start);
 for(const f of api.snapshot().frames)f.summary+=' Hidden mobile explanation.'.repeat(100);
 api.appearance();await env.flush();
 assert.deepEqual(api.snapshot().plan.phases.filter(p=>p.kind==='hold').map(p=>p.end-p.start),before,'Collapsed/mobile-hidden explanation text cannot add invisible playback pauses');
 env.q('.rv-caption-detail').hidden=false;api.appearance();await env.flush();
 assert(api.snapshot().plan.phases.some(p=>p.kind==='hold'&&p.end-p.start>10000),'Revealed explanation text must earn its own real reading exposure');
 api.dispose();console.log('PASS caption visibility, hidden-copy invariance and revealed-copy exposure');
}
{
 const env=await environment('motion',1280,{artifactPath:'../../public/review/lifecycle.html'}),api=env.root.causalStudy;
 for(const scene of ['journey','tcp','dns','tls','packetOps','packet','provider']){
  api.select(scene);await env.flush();const before=api.snapshot(),holds=before.plan.phases.filter(p=>p.kind==='hold').map(p=>p.end-p.start);
  for(const frame of before.frames)frame.records.push({label:'Hidden audit metadata',value:'Unseen provenance '.repeat(500)});
  api.appearance();await env.flush();const after=api.snapshot();
  assert.deepEqual(after.plan.phases.filter(p=>p.kind==='hold').map(p=>p.end-p.start),holds,'Hidden source disclosure must not extend visible playback: '+scene);
  if(scene==='journey')assert.equal(holds[0],180,'An already-read face only needs the shared transition beat, not a new outcome pause');
  const seenByCarrier=new Map();
  for(const [index,g]of after.plan.prepared.entries()){
   const f=after.frames[index],identity=f.assembly?.identity||f.identity,key=identity?identity+'|'+(f.assembly?.layer||f.protocol):null,seen=seenByCarrier.get(key)||new Map(),expected=[];
   for(const id of f.readIds||[]){const field=f.fields.find(field=>field.id===id),value=JSON.stringify([field?.label,field?.value]);if(!key||seen.get(id)!==value)expected.push(id);seen.set(id,value);}if(key)seenByCarrier.set(key,seen);
   assert.deepEqual(Array.from(g.targets,t=>t.id),expected,'Only new or changed facts on the same retained carrier receive another scan; distinct messages retain their own source-selected fields');
  }

  for(const [index,g]of after.plan.prepared.entries()){
   assert.equal(g.attention.retained.credit,0,'New receiver values cannot borrow earlier scan exposure');
   if(!after.frames[index].lost)assert.equal(g.attention.face.credit,g.read.total,'The visible face earns its measured scanning exposure');
   const measured=env.root.motionPlanner.makePlan(g.targets,g.lens),scans=plan=>plan.phases.filter(p=>p.kind==='read').map(p=>({id:p.id,line:p.line,duration:Math.round((p.end-p.start)*1e6)/1e6,a:p.a,b:p.b}));
   assert.deepEqual(scans(g.read),scans(measured),'Every glyph sweep keeps its original geometry and duration');
   assert.equal(g.read.phases.filter(p=>p.kind==='acquire').length,g.targets.some(t=>t.lines.length)?1:0,'Acquire once per continuous card read');
   assert(!g.read.phases.some(p=>p.kind==='release'||p.kind==='result'),'A continuous scan has no stationary per-line resets or duplicate outcome wait');
   for(const p of g.read.phases.filter(p=>p.kind==='travel'))assert.equal(p.fa+p.fb,2,'Focus stays engaged between actual glyph rows');
   const finish=g.read.phases.find(p=>p.kind==='finish');if(finish)assert.equal(finish.fa,1,'The final focus release starts at the last readable pose');
   const retain=after.plan.phases.find(p=>p.index===index&&p.kind==='retain');
   assert.equal(Boolean(retain),Boolean(g.transfer),'Only an actual receiver transfer may reserve a retain phase');
   if(g.transfer)assert(Math.abs(retain.end-retain.start-g.transfer.duration)<.001,'Receiver handoff motion must not be sped up');
  }
  for(const phase of after.plan.phases.filter(p=>['focus','modify','layerChange'].includes(p.kind))){
   for(const fraction of [.1,.5,.9]){api.seek(phase.start+(phase.end-phase.start)*fraction);const actor=env.root.querySelectorAll('.rv-actor').find(n=>Number(n.style.opacity)>.99);assert(actor,'A handoff retains its physical carrier throughout the morph');if(phase.kind==='focus'){const faces=env.root.querySelectorAll('.rv-actor-face').filter(n=>n.style.visibility!=='hidden');assert(faces.some(n=>Number(n.style.opacity)>0),'Layer handoff never leaves an empty text plane');}}
  }
  for(let i=1;i<after.frames.length;i++){
   const start=after.plan.starts[i],phase=after.plan.phases.find(p=>p.index===i);
   if(phase.kind!=='construct')continue;
   api.seek(start-.01);const previous=parseFloat(env.q('.rv-stage').style.height);api.seek(start+.01);
   assert(Math.abs(parseFloat(env.q('.rv-stage').style.height)-previous)<=1,'A new card cannot abruptly move the playback panel');
  }
 }
 api.select('tcp');await env.flush();const s=api.snapshot(),target=s.frames.find((f,i)=>i>0&&f.state.highestAck!==s.frames[i-1].state.highestAck);
 target.state.highestAck='123456789012345678901234567890';api.appearance();await env.flush();
 const i=api.snapshot().frames.indexOf(target),g=api.snapshot().plan.prepared[i];
 assert(g.attention.retained.hold>2000,'A newly revealed long receiver value still gets its own reading time');
 assert(g.attention.hold>=g.attention.retained.hold);api.dispose();
 console.log('PASS visible-content pacing, hidden-metadata invariance, fresh receiver exposure and continuous scene boundaries');
}

{
 const {buildJourneyScenario,journeyStateAt}=await import('../../../src/journey/model.ts'),{projectJourneyPacketVisual}=await import('../../../src/journey/packet-visual.ts'),{projectJourneyPhysicalState}=await import('../../../src/journey/physical-journey.ts');
 const scenario=buildJourneyScenario('example.test',{transportProfile:'tcp-h2',dnsProfile:'cache-miss',impairmentProfile:'clean'}),journey={context:{hostname:scenario.hostname,requestId:scenario.id,destinationAddress:scenario.destinationAddress},frames:scenario.events.map(event=>{const state=journeyStateAt(scenario,event.atMs);if(!event.kind.startsWith('packet.'))return {event,state};const physical=event.kind==='packet.transit'?projectJourneyPhysicalState({profile:scenario.transportProfile,destinationAddress:scenario.destinationAddress,stage:state.packetTransitStage}):null,envelope=physical?(physical.l2Envelope==='wan'?physical.outgoing:physical.incoming):null,packetVisual=projectJourneyPacketVisual({hostname:scenario.hostname,destinationAddress:scenario.destinationAddress,profile:scenario.transportProfile,stage:state.packetAssemblyStage,selectedLayerId:physical?'network':undefined,ttl:physical?.currentTtl,sourceMac:envelope?.sourceMac,destinationMac:envelope?.destinationMac});return {event,state,physical,packetVisual};})};
 const source={bootstrapScene:'journey',referenceModels:[],journey},before=JSON.stringify(source),env=await environment('motion',390,{artifactPath:'../../public/review/lifecycle.html',integratedData:source}),api=env.context.integratedMount.api,s=api.snapshot(),at=transit=>s.frames.findIndex(f=>f.assembly?.transit===transit),ttl=at('router-ttl'),repeat=at('switch-forward');
 assert.deepEqual(Array.from(s.plan.prepared[ttl].targets,t=>t.id),Array.from(s.frames[ttl].fields.filter(f=>s.frames[ttl-1].fields.find(old=>old.id===f.id)?.value!==f.value),f=>f.id),'The production physical TTL step scans only its changed TTL and checksum');
 assert.equal(s.plan.prepared[repeat].read.total,0,'The production physical forward step cannot rescan an unchanged IPv4 header');assert.equal(s.plan.prepared[repeat].lastReadingY,s.plan.prepared[repeat-1].lastReadingY,'Forwarding preserves the retained reading position');
 api.seek(s.plan.commits[1]);assert.equal(env.q('.rv-envelopes').hidden,true,'A local resolver operation has no Ethernet envelope');
 env.resizes.forEach(callback=>callback());await env.flush();assert.equal(env.q('.rv-envelopes').hidden,true,'An unchanged layout callback must preserve the hidden envelope instead of exposing unpositioned measurement pieces');
 api.seek(s.plan.total);const actor=env.root.querySelectorAll('.rv-actor').find(n=>Number(n.style.opacity)>.99);assert.equal(actor.querySelector('.rv-reading-window').scrollTop,0,'Completed local outcomes settle at their leading facts');
 assert.equal(JSON.stringify(source),before,'Reading continuity cannot mutate canonical events or packet projections');env.context.integratedMount.dispose();console.log('PASS production physical packet reading continuity and final outcome settlement');
}

{
 const env=await environment('workbench',390,{artifactPath:'../../public/review/builder.html'}),api=env.root.builderStudy;api.selectPage('systems');const animation=env.animationJobs.at(-1),count=env.animationJobs.length;api.selectPage('systems');assert.equal(env.animationJobs.length,count,'Reselecting the active pane must not allocate another entrance');assert.equal(animation.cancelled,false,'Reselecting the active pane must not snap an in-flight entrance to its end');api.selectPage('cli');assert.equal(animation.cancelled,true,'Changing panes still cancels the outgoing motion');
 const evidence=await environment('evidence',390,{artifactPath:'../../public/review/evidence.html'}),study=evidence.root.evidenceStudy;study.select('capture');study.selectFrame(2);const saved=study.snapshot(),before=evidence.animationJobs.length;study.select('capture');assert.equal(evidence.animationJobs.length,before,'Reselecting an evidence workspace must not restart its content entrance');assert.equal(study.snapshot().frameIndex,2);study.select('measured');study.select('capture',{...saved,cam:saved.camera});assert.equal(study.snapshot().frameIndex,2,'Explicit session restoration still applies saved evidence selection, including restoration of an already-mounted workspace');study.selectFrame(0);study.select('capture',{...saved,cam:saved.camera});assert.equal(study.snapshot().frameIndex,2);console.log('PASS repeated workspace selection, in-flight motion continuity and evidence session restoration');
}

{
 const env=await environment('motion',390,{artifactPath:'../../public/review/lifecycle.html',integratedData:{bootstrapScene:'dns',referenceModels:[],dns:data.dns},layoutReady:false});
 const api=env.context.integratedMount.api;
 assert.equal(api.snapshot().plan,null,'A mount without measured layout must wait, not guess or throw.');
 env.reveal();await env.flush();assert(api.snapshot().plan,'A revealed mount prepares its measured plan.');
 api.presentSource(650,4500,true);assert.equal(api.snapshot().frames[api.snapshot().at.index].at,650);
 env.context.integratedMount.dispose();console.log('PASS lazy source mount waits for measurable layout');
}
for(const width of [320,390,1024,1440])for(const scene of ['tcp','dns','tls','journey','provider']){
 const source={bootstrapScene:scene,referenceModels:[],[scene]:data[scene]};
 const before=JSON.stringify(source);
 const env=await environment('motion',width,{artifactPath:'../../public/review/lifecycle.html',integratedData:source});
 const mount=env.context.integratedMount,api=mount.api,frames=api.snapshot().frames;
 assert(frames.length>0);assert(mount.stats().observers>0);
 const firstPlan=api.snapshot().plan;
 for(const g of firstPlan.prepared){assert(g.focus.h>0&&g.focus.h<=g.fullHeight,'Reading window stays within the complete measured source face');assert(g.windowHeight>0,'Reading area retains a visible body below the pinned heading');assert.equal(g.focus.h,g.contentTop+g.windowHeight+g.bottomPadding,'Viewport and pinned heading share the measured card bounds');}
 assert(firstPlan.starts.every((start,i)=>Number.isFinite((firstPlan.starts[i+1]??firstPlan.total)-start)), 'Every source event needs a finite measured attention budget.');
 for(const geometry of firstPlan.prepared)for(const field of Object.values(geometry.transferFields||{}))assert(['x','y','w','h'].every(key=>Number.isFinite(field[key])), 'Detached source cards retain finite measured glyph-transfer geometry.');
 let peakAttached=0;const nativeStyle=env.context.getComputedStyle;
 env.context.getComputedStyle=(node)=>{peakAttached=Math.max(peakAttached,env.root.querySelectorAll('.rv-actor').length);return nativeStyle(node);};
 api.appearance();await env.flush();env.context.getComputedStyle=nativeStyle;
 assert(peakAttached<=2, 'Remeasurement must not reconnect the entire source history.');
 for(const [index,frame]of frames.entries()){
  if(frame.at!==null){api.presentSource(frame.at,scene==='journey'?data.journey.duration:scene==='tcp'?4500:4500,true);assert.equal(api.snapshot().at.index,index);assert.equal(env.q('.rv-model-time').textContent,'Source event · '+frame.id+' · '+frame.at+' ms');}
  else{const plan=api.snapshot().plan;api.seek(plan.starts[index]);}
  assert(Number.isFinite(api.snapshot().clock));
  assert(env.root.querySelectorAll('.rv-actor').length<=2, 'Only the selected object and an outgoing handoff may remain attached.');
 }
 assert.equal(JSON.stringify(source),before);
 const bounds={left:-120,right:800,top:-40,bottom:450},viewport={w:width,h:640},camera=frameCamera(bounds,viewport);
 for(const [x,y]of [[bounds.left,bounds.top],[bounds.right,bounds.bottom]]){assert(camera.x+x*camera.z>=0);assert(camera.x+x*camera.z<=viewport.w);assert(camera.y+y*camera.z>=0);assert(camera.y+y*camera.z<=viewport.h);}
 mount.dispose();assert.deepEqual(JSON.parse(JSON.stringify(mount.stats())),{disposed:true,frames:0,observers:0,listeners:0});assert.equal(env.root.children.length,0);assert.equal(env.root.causalStudy,undefined,'Disposed hosts must not retain the renderer plan/cache through API properties.');assert.equal(env.root.reviewData,undefined);await env.flush();
 console.log('PASS integrated runtime, canonical selection and disposal',scene,width);
}

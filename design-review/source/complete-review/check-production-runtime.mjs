import assert from 'node:assert/strict';
import fs from 'node:fs';
import {environment} from './check-complete.mjs';
import {frameCamera} from './shared-geometry.js';
const data=JSON.parse(fs.readFileSync('complete-review/source-data.json','utf8'));
{
 const env=await environment('motion',390,{artifactPath:'../../public/review/lifecycle.html'}),api=env.root.causalStudy,source=JSON.stringify(env.root.reviewData);
 for(const scene of ['journey','tcp','dns','tls','packetOps']){
  api.select(scene);await env.flush();
  const read=api.snapshot().plan.phases.find(p=>p.kind==='read');
  for(const [step,count,speed]of [[1000/120,120,1],[1000/60,60,1],[1000/30,30,1],[1000/60,30,2],[1000/60,120,.5]]){
   api.seek(read.start);env.q('.rv-speed').value=String(speed);api.play();env.frame(17);
   const start=api.snapshot().clock;for(let i=0;i<count;i++)env.frame(step);
   assert.ok(Math.abs(api.snapshot().clock-start-step*count*speed)<.001,'Normal display rates and selected speed retain the same presentation duration');api.pause();
  }
  env.q('.rv-speed').value='1';api.seek(0);api.play();env.frame(17);env.frame(17);
  const before=api.snapshot();env.frame(2000);const after=api.snapshot();
  assert.ok(after.clock-before.clock>0&&after.clock-before.clock<=50,'A delayed frame must not skip the object lifecycle');
  assert.equal(after.at.kind,before.at.kind);assert.equal(after.at.index,before.at.index);
  env.frame(17);assert.ok(Math.abs(api.snapshot().clock-after.clock-17)<.001,'Excess stall time must not become catch-up debt');
  api.pause();const held=api.snapshot().clock;env.frame(5000);api.play();env.frame(5000);assert.equal(api.snapshot().clock,held,'Resume establishes a fresh frame timestamp');env.frame(17);assert.equal(api.snapshot().clock,held+17);api.pause();
  api.next();const next=api.snapshot();assert.equal(env.q('.rv-caption-title').textContent,next.frames[next.at.index].title);assert.equal(env.root.querySelectorAll('.rv-status-copy').length,0,'Stepping commits the caption with the card');
  api.seek(read.start+100);assert.equal(env.root.querySelectorAll('.rv-status-copy').length,0,'Scrubbing cannot leave an outgoing caption over the selected card');
 }
 assert.equal(JSON.stringify(env.root.reviewData),source,'Frame-delay handling must not alter source events or bytes');api.dispose();
 console.log('PASS visible playback clock, frame-rate parity, stall recovery, resume and caption settlement');
}
{
 const env=await environment('motion',1280,{artifactPath:'../../public/review/lifecycle.html'}),api=env.root.causalStudy;
 for(const scene of ['journey','tcp','dns','tls','packetOps','packet','provider']){
  api.select(scene);await env.flush();const before=api.snapshot(),holds=before.plan.phases.filter(p=>p.kind==='hold').map(p=>p.end-p.start);
  for(const frame of before.frames)frame.records.push({label:'Hidden audit metadata',value:'Unseen provenance '.repeat(500)});
  api.appearance();await env.flush();const after=api.snapshot();
  assert.deepEqual(after.plan.phases.filter(p=>p.kind==='hold').map(p=>p.end-p.start),holds,'Hidden source disclosure must not extend visible playback: '+scene);
  if(scene==='journey')assert.equal(holds[0],180,'An already-read face only needs the shared transition beat, not a new outcome pause');
  for(const [index,g]of after.plan.prepared.entries()){
   assert.equal(g.attention.retained.credit,0,'New receiver values cannot borrow earlier scan exposure');
   if(!after.frames[index].lost)assert.equal(g.attention.face.credit,g.read.total,'The visible face earns its measured scanning exposure');
   const measured=env.root.motionPlanner.makePlan(g.targets,g.lens),scans=plan=>plan.phases.filter(p=>p.kind==='read').map(p=>({id:p.id,line:p.line,duration:Math.round((p.end-p.start)*1e6)/1e6,a:p.a,b:p.b}));
   assert.deepEqual(scans(g.read),scans(measured),'Every glyph sweep keeps its original geometry and duration');
   assert(g.read.phases.filter(p=>p.kind==='result').length<=1,'Settle once for the entire card');
   const retain=after.plan.phases.find(p=>p.index===index&&p.kind==='retain');
   assert.equal(Boolean(retain),Boolean(g.transfer),'Only an actual receiver transfer may reserve a retain phase');
   if(g.transfer)assert(Math.abs(retain.end-retain.start-g.transfer.duration)<.001,'Receiver handoff motion must not be sped up');
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
 for(const g of firstPlan.prepared)assert.equal(g.focus.h,g.fullHeight,'A reading window must retain its entire source face.');
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

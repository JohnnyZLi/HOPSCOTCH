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

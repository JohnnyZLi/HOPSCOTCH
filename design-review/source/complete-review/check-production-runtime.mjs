import assert from 'node:assert/strict';
import fs from 'node:fs';
import {environment} from './check-complete.mjs';
import {frameCamera} from './shared-geometry.js';
const data=JSON.parse(fs.readFileSync('complete-review/source-data.json','utf8'));
for(const width of [320,390,1024,1440])for(const scene of ['tcp','dns','tls','journey','provider']){
 const source={bootstrapScene:scene,referenceModels:[],[scene]:data[scene]};
 const before=JSON.stringify(source);
 const env=await environment('motion',width,{artifactPath:'../../public/review/lifecycle.html',integratedData:source});
 const mount=env.context.integratedMount,api=mount.api,frames=api.snapshot().frames;
 assert(frames.length>0);assert(mount.stats().observers>0);
 const firstPlan=api.snapshot().plan;
 assert(firstPlan.starts.every((start,i)=>Number.isFinite((firstPlan.starts[i+1]??firstPlan.total)-start)), 'Every source event needs a finite measured attention budget.');
 for(const [index,frame]of frames.entries()){
  if(frame.at!==null){api.presentSource(frame.at,scene==='journey'?data.journey.duration:scene==='tcp'?4500:4500,true);assert.equal(api.snapshot().at.index,index);assert.equal(env.q('.rv-model-time').textContent,'Source event · '+frame.id+' · '+frame.at+' ms');}
  else{const plan=api.snapshot().plan;api.seek(plan.starts[index]);}
  assert(Number.isFinite(api.snapshot().clock));
 }
 assert.equal(JSON.stringify(source),before);
 const bounds={left:-120,right:800,top:-40,bottom:450},viewport={w:width,h:640},camera=frameCamera(bounds,viewport);
 for(const [x,y]of [[bounds.left,bounds.top],[bounds.right,bounds.bottom]]){assert(camera.x+x*camera.z>=0);assert(camera.x+x*camera.z<=viewport.w);assert(camera.y+y*camera.z>=0);assert(camera.y+y*camera.z<=viewport.h);}
 mount.dispose();assert.deepEqual(JSON.parse(JSON.stringify(mount.stats())),{disposed:true,frames:0,observers:0,listeners:0});assert.equal(env.root.children.length,0);await env.flush();
 console.log('PASS integrated runtime, canonical selection and disposal',scene,width);
}

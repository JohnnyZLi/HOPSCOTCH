import fs from 'node:fs';
import {environment} from './check-complete.mjs';
const models=[],clean=x=>JSON.parse(JSON.stringify(x));
const auditDir=process.env.HOPSCOTCH_AUDIT_DIR||'complete-review/second-audit';fs.mkdirSync(auditDir,{recursive:true});
for(const width of [390,1024]){
 const e=await environment('motion',width),api=e.root.causalStudy;
 for(const id of ['tcp','packet','packetOps','failure','dns','tls','http','journey','provider']){
  api.select(id);await e.flush();const s=api.snapshot(),indexes=id==='tcp'?[0,1,Math.floor(s.frames.length/2),s.frames.length-1]:id==='packetOps'?[0,3,s.frames.length-1]:id==='failure'?[0,s.frames.length-1]:[Math.floor(s.frames.length/2)];
  for(const index of [...new Set(indexes)]){
   const g=s.plan.prepared[index],phase=s.plan.phases.find(p=>p.index===index&&(['failure','http'].includes(id)?p.kind==='transition':id==='packetOps'?['modify','fitAttach','fitDetach'].includes(p.kind):p.kind==='read'))||s.plan.phases.find(p=>p.index===index&&p.kind==='hold')||s.plan.phases.find(p=>p.index===index);
   const time=(phase.start+phase.end)/2;api.seek(time);const sample=api.sample(time),at=sample.at;
   models.push({type:'motion',id,width,title:e.q('.rv-title').textContent,summary:e.q('.rv-subtitle').textContent,frame:clean(s.frames[index]),index,phase:clean(at),paletteHue:e.root.presentation.palette[e.root.presentation.protocol(s.frames[index].protocol)]||0,pose:clean(sample.pose),prepared:{focus:g.focus,lens:g.lens,targets:g.targets,fit:g.fit,transfer:g.transfer,transferTarget:g.transferTarget},geometry:{stageH:parseFloat(e.q('.rv-stage').style.height),pathY:s.plan.pathY,ports:s.plan.ports,compactW:s.plan.compactW,compactH:s.plan.compactH,envelopeH:s.plan.envelopeH,trailerH:s.plan.trailerH},lens:at.kind==='read'?clean(e.root.motionPlanner.samplePlan(g.read,at.elapsed)):null,state:clean(s.frames[Math.max(0,index-1)].state),allFrames:s.frames.map(f=>({id:f.id,title:f.title}))});
  }
 }
 console.log('Collected causal families',width);
}
fs.writeFileSync(auditDir+'/causal-compositions.json',JSON.stringify({kind:'Fresh source state and synthetic glyph/geometry sample; native analytical motion poses, not browser animation captures',manifest:JSON.parse(fs.readFileSync('complete-review/source-manifest.json')),models},null,2));console.log('Causal selections',models.length);

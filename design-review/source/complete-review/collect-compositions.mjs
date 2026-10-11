import fs from 'node:fs';import {environment} from './check-complete.mjs';
const scenes=[];const clean=x=>JSON.parse(JSON.stringify(x));
for(const width of [390,1024]){
 const e=await environment('motion',width),api=e.root.causalStudy;
 for(const id of ['tcp','packet','packetOps','failure','dns','tls','http','journey','provider']){
  api.select(id);await e.flush();const s=api.snapshot(),wanted=id==='tcp'?['syn','synack','data-2-loss','dup-ack-3','retransmit','final-ack']:id==='packetOps'?['assemble','ttl','append','remove','detach']:id==='failure'?['primary-link-fails',s.frames.at(-1).id]:id==='tls'?['server-hello','certificate-validation']:id==='dns'?['root-referral','deliver-answer']:id==='journey'?['tcp-synack','tls-serverhello','packet-assembly-security']:[s.frames[Math.min(s.frames.length-1,Math.floor(s.frames.length*.5))].id];
  for(const identity of wanted){const index=s.frames.findIndex(f=>f.id===identity);if(index<0)continue;const phase=s.plan.phases.find(p=>p.index===index&&(id==='packetOps'?p.kind==='modify'||p.kind==='fitAttach'||p.kind==='fitDetach':id==='failure'||id==='http'?p.kind==='transition':p.kind==='read'))||s.plan.phases.find(p=>p.index===index&&p.kind==='hold'),time=(phase.start+phase.end)/2;api.seek(time);const sample=api.sample(time),at=sample.at,g=s.plan.prepared[index],lens=at.kind==='read'?e.root.motionPlanner.samplePlan(g.read,at.elapsed):null;
   scenes.push({type:'motion',width,id,frame:clean(s.frames[index]),index,phase:clean(at),pose:clean(sample.pose),prepared:{focus:g.focus,lens:g.lens,targets:g.targets,fit:g.fit},geometry:{stageH:parseFloat(e.q('.rv-stage').style.height),pathY:s.plan.pathY,ports:s.plan.ports,compactW:s.plan.compactW,compactH:s.plan.compactH,envelopeH:s.plan.envelopeH,trailerH:s.plan.trailerH},lens:clean(lens),state:clean(s.frames[Math.max(0,index-1)].state),allFrames:clean(s.frames)});
  }
 }
 const b=await environment('workbench',width),ba=b.root.builderStudy;for(let i=0;i<30&&ba.snapshot().graphPending;i++)await b.flush();
 scenes.push({type:'builder',width,id:'topology',plan:clean(ba.snapshot().graphPlan),selected:clean(ba.snapshot().selected),title:b.q('.wb-device-title').textContent,sections:b.q('.wb-sections').textContent,values:clean(b.root.reviewData.builder.devices.find(x=>x.device?.id==='edge')||{})});
 for(const system of ba.snapshot().systems){ba.selectPage('systems');ba.selectSystem(system.id,0);scenes.push({type:'builder',width,id:system.id,title:b.q('.wb-system-title').textContent,summary:b.q('.wb-system-summary').textContent,headings:b.q('.wb-systems-content').querySelectorAll('summary').map(n=>n.textContent),rows:b.q('.wb-systems-content').querySelectorAll('tbody').flatMap(body=>body.children.map(row=>row.children.map(c=>c.textContent)))});}
 ba.selectPage('cli');ba.runCommand('show route');scenes.push({type:'builder',width,id:'terminal',title:'CLI',text:b.q('.wb-output').textContent,cli:clean(ba.snapshot().cliResult),selected:clean(ba.snapshot().selected)});
 const v=await environment('evidence',width),va=v.root.evidenceStudy;
 for(const id of ['measured','capture','observed','physical','internet']){
  va.select(id);await v.flush();for(let i=0;i<30&&va.snapshot().graphPending;i++)await v.flush();const s=va.snapshot();
  scenes.push({type:'evidence',width,id,title:v.q('.ev-title').textContent,summary:v.q('.ev-subtitle').textContent,source:v.q('.ev-source-note').textContent,detailTitle:v.q('.ev-detail-title').textContent,detailFacts:v.q('.ev-detail-content').querySelectorAll('.rv-fact').map(n=>n.children.map(c=>c.textContent)),detail:v.q('.ev-detail-content').textContent,globe:id==='physical'?v.q('.ev-globe').children.map(n=>({tag:n.tag,attrs:n.attrs,text:n.textContent})):null,plan:id==='internet'?clean(s.graphPlan):null,camera:id==='internet'?clean(s.camera):null,active:id==='internet'?clean(va.paths()[s.asPath]?.relationshipIds||[]):[],snapshot:{measured:clean(s.measured),capture:clean(s.capture),frameIndex:s.frameIndex,captureBytes:clean(s.captureBytes),facilityId:s.facilityId,category:s.category},observed:clean(v.root.reviewData.observed)});
  if(id!=='internet'){
   const base=clean(scenes.at(-1));for(const mode of ['empty','error']){va.setState(mode);await v.flush();scenes.push({...base,mode,emptyTitle:mode==='empty'?v.q('.ev-content h3').textContent:'',emptyDetail:mode==='empty'?v.q('.ev-content p').textContent:'',errorDetail:mode==='error'?v.q('.ev-error p').textContent:'',source:v.q('.ev-source-note').textContent});}va.setState('populated');
  }
 }
}
fs.writeFileSync('complete-review/composition-models.json',JSON.stringify(scenes));console.log(scenes.length,'source-derived compositions');

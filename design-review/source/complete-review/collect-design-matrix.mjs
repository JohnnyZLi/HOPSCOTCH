import fs from 'node:fs';
import {environment} from './check-complete.mjs';
const clean=x=>JSON.parse(JSON.stringify(x)),models=[];
function visible(n){while(n){if(n.hidden)return false;const p=n.parentElement;if(p?.tag==='details'&&!p.open&&p.children[0]!==n)return false;n=p;}return true;}
function dom(container){return {headings:container.querySelectorAll('summary').filter(visible).map(n=>n.textContent),rows:container.querySelectorAll('tbody').filter(visible).flatMap(n=>n.children.filter(visible).map(row=>row.children.map(c=>c.textContent))),text:container.children.filter(visible).map(n=>n.textContent).join('\n')};}
function motionModel(e,api,s,index,variant=null){
 const g=s.plan.prepared[index],phase=s.plan.phases.find(p=>p.index===index&&(['failure','http'].includes(s.sceneId)?p.kind==='transition':s.sceneId==='packetOps'?['modify','fitAttach','fitDetach'].includes(p.kind):p.kind==='read'))||s.plan.phases.find(p=>p.index===index&&p.kind==='hold')||s.plan.phases.find(p=>p.index===index);
 const time=(phase.start+phase.end)/2;api.seek(time);const sample=api.sample(time),at=sample.at;
 const result={type:'motion',width:e.width,id:s.sceneId,variant,title:e.q('.rv-title').textContent,summary:e.q('.rv-subtitle').textContent,frame:clean(s.frames[index]),index,phase:clean(at),pose:clean(sample.pose),prepared:{focus:g.focus,lens:g.lens,targets:g.targets,fit:g.fit,transfer:g.transfer,transferTarget:g.transferTarget},geometry:{stageH:parseFloat(e.q('.rv-stage').style.height),pathY:s.plan.pathY,ports:s.plan.ports,compactW:s.plan.compactW,compactH:s.plan.compactH,envelopeH:s.plan.envelopeH,trailerH:s.plan.trailerH},lens:at.kind==='read'?clean(e.root.motionPlanner.samplePlan(g.read,at.elapsed)):null,state:clean(s.frames[Math.max(0,index-1)].state),allFrames:s.frames.map(f=>({id:f.id,title:f.title}))};
 if(variant!==null)result.frame.id+='-variant-'+variant;
 return result;
}
for(const width of [390,1024]){
 const e=await environment('motion',width),api=e.root.causalStudy;
 for(const id of ['tcp','packetOps','failure','dns','tls','http','journey','provider']){
  api.select(id);await e.flush();const s=api.snapshot();for(let i=0;i<s.frames.length;i++)models.push(motionModel(e,api,s,i));
 }
 api.select('packet');await e.flush();for(let v=0;v<e.root.reviewData.packetVariants.length;v++){e.change('.rv-local-controls select',v);await e.flush();const s=api.snapshot();for(let i=0;i<s.frames.length;i++)models.push(motionModel(e,api,s,i,v));}
 api.select('dns');await e.flush();e.change('.rv-local-controls select','hit');await e.flush();let s=api.snapshot();for(let i=0;i<s.frames.length;i++){const m=motionModel(e,api,s,i);m.frame.id+='-cache-hit';models.push(m);}
 const b=await environment('workbench',width),ba=b.root.builderStudy;for(let i=0;i<40&&ba.snapshot().graphPending;i++)await b.flush();
 const old=JSON.parse(fs.readFileSync('complete-review/composition-models.json'));models.push(...old.filter(m=>m.type==='builder'&&m.width===width));
 for(const system of ba.snapshot().systems){ba.selectPage('systems');ba.selectSystem(system.id,0);const count=b.q('.wb-system-detail').children.length;for(let i=1;i<count;i++){ba.selectSystem(system.id,i);const view=dom(b.q('.wb-systems-content'));models.push({type:'builder',width,id:system.id,mode:'detail-'+i,title:b.q('.wb-system-title').textContent,summary:b.q('.wb-system-summary').textContent,...view});}}
 for(const page of ['history','challenge','scenario']){ba.selectPage(page);const view=dom(b.q('.wb-'+page));models.push({type:'builder',width,id:page,mode:'page',title:page==='history'?'Canonical history':page==='challenge'?b.q('.wb-challenge-title').textContent:'Scenario configuration',summary:'Configuration, runtime evidence and canonical history retain their distinct roles.',...view});}
 const ev=await environment('evidence',width),va=ev.root.evidenceStudy;
 for(const id of ['measured','capture','observed','physical','internet']){
  va.select(id);await ev.flush();for(let i=0;i<40&&va.snapshot().graphPending;i++)await ev.flush();
  for(const mode of ['populated','empty','loading','partial','error']){
   va.setState(mode);await ev.flush();const s=va.snapshot(),content=dom(ev.q('.ev-content'));
   models.push({type:'evidence',width,id,mode,title:ev.q('.ev-title').textContent,summary:ev.q('.ev-subtitle').textContent,source:ev.q('.ev-source-note').textContent,detailTitle:ev.q('.ev-detail-title').textContent,detailFacts:ev.q('.ev-detail-content').querySelectorAll('.rv-fact').map(n=>n.children.map(c=>c.textContent)),detail:ev.q('.ev-detail-content').textContent,emptyTitle:mode==='empty'?ev.q('.ev-content h3').textContent:'',emptyDetail:mode==='empty'?ev.q('.ev-content p').textContent:'',errorDetail:mode==='error'?ev.q('.ev-error p').textContent:'',globe:id==='physical'&&mode!=='empty'?ev.q('.ev-globe').children.map(n=>({tag:n.tag,attrs:n.attrs,text:n.textContent})):null,plan:id==='internet'?clean(s.graphPlan):null,camera:id==='internet'?clean(s.camera):null,active:id==='internet'?clean(va.paths()[s.asPath]?.relationshipIds||[]):[],snapshot:{measured:clean(s.measured),capture:clean(s.capture),frameIndex:s.frameIndex,captureBytes:clean(s.captureBytes),facilityId:s.facilityId,category:s.category,layerIndex:s.layerIndex,byteWindow:clean(s.byteWindow)},displayRows:content.rows,observed:clean(ev.root.reviewData.observed)});
  }
 }
 console.log('Collected design matrix',width,models.length);
}
fs.writeFileSync('complete-review/design-composition-models.json',JSON.stringify(models));
console.log('TOTAL',models.length,'source states; each is rendered in Light and Dark');

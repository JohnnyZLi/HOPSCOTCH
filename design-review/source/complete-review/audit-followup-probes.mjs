import fs from 'node:fs';
import {environment} from './check-complete.mjs';
const findings=[];
async function probe(name,fn){try{findings.push({name,...await fn()});}catch(e){findings.push({name,error:e.message});}}
await probe('Reply labels and positions',async()=>{
 const e=await environment('motion',390),a=e.root.causalStudy;
 const rows=[];
 for(const scene of ['tcp','tls','dns','journey']){
  a.select(scene);await e.flush();const s=a.snapshot();
  for(const f of s.frames.filter(f=>f.event?.direction==='server-to-client'||['root-referral','tcp-synack','tls-serverhello'].includes(f.id))){
   const p=s.plan.phases.find(p=>p.index===s.frames.indexOf(f)&&p.kind==='travel');if(!p)continue;
   a.seek(p.start+1);rows.push({scene,event:f.id,from:f.from,to:f.to,labels:e.q('.rv-endpoints').children.map(n=>n.textContent),depart:a.sample(p.start).pose.box.x});
  }
 }
 return {rows};
});
await probe('Filtered measurement selection',async()=>{
 const e=await environment('evidence',390),a=e.root.evidenceStudy;
 e.change('.ev-category','dns');const s=a.snapshot();return{category:s.category,selectedCategory:s.measured.factsById[s.selectedFact]?.category};
});
await probe('Capture field focus and disclosure',async()=>{
 const e=await environment('evidence',390),a=e.root.evidenceStudy;a.select('capture');await e.flush();
 const detail=e.q('.rv-bytes').parentElement;detail.open=true;const b=e.q('.rv-bytes').children[34];b.focus();b.click();
 return{byte:a.snapshot().byte,connectedFocus:!!e.document.activeElement?.parentElement,open:e.q('.rv-bytes').parentElement.open??false,field:a.snapshot().fieldId};
});
await probe('Empty valid capture',async()=>{
 const e=await environment('evidence',390),a=e.root.evidenceStudy;a.select('capture');await e.flush();
 const b=new Uint8Array(24),v=new DataView(b.buffer);v.setUint32(0,0xa1b2c3d4,true);v.setUint16(4,2,true);v.setUint16(6,4,true);v.setUint32(16,65535,true);v.setUint32(20,1,true);
 const success=await a.importCaptureBuffer(b);return{success,count:a.snapshot().capture.frames.length,title:e.q('.ev-detail-title').textContent,clock:e.q('.ev-clock').textContent,caption:e.q('.ev-caption-title').textContent};
});
await probe('Builder cross-plane search',async()=>{
 const e=await environment('workbench',390),a=e.root.builderStudy;
 const ref=e.root.reviewData.builder.options.find(r=>r.plane==='ethernet');e.change('.wb-device',ref.plane+':'+ref.id);for(let i=0;i<30&&a.snapshot().graphPending;i++)await e.flush();
 const input=e.q('.wb-search');input.value='app';input.dispatchEvent({type:'input',target:input});return{selected:a.snapshot().selected,graphIds:a.snapshot().graphPlan.nodes.map(n=>n.id)};
});
await probe('Builder removed selection on undo and history',async()=>{
 const e=await environment('workbench',390),a=e.root.builderStudy;e.click('.wb-copy');e.click('.wb-paste');
 const s=a.snapshot(),pasted=s.input.graph.nodes.find(n=>!e.root.reviewData.builder.input.graph.nodes.some(x=>x.id===n.id));a.choose({plane:'routed',id:pasted.id});a.undo();
 return{selected:a.snapshot().selected,present:a.snapshot().input.graph.nodes.some(n=>n.id===a.snapshot().selected.id)};
});
fs.writeFileSync('complete-review/audit-followup-after.json',JSON.stringify(findings,null,2));
for(const f of findings)console.log(JSON.stringify(f));

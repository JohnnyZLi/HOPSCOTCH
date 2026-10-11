import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
for(const width of [320,390,1024,1440]){
 const e=await environment('motion',width),api=e.root.causalStudy;
 for(const scene of ['tcp','packet','packetOps','dns','tls','journey','provider']){
  api.select(scene);await e.flush();const s=api.snapshot(),source=JSON.stringify(e.root.reviewData);
  for(const f of s.frames){
   for(const id of f.readIds||[]){const value=f.fields.find(x=>x.id===id)?.value;check(value!==null&&value!==undefined&&String(value).trim()!==''&&String(value).trim()!=='—','A scan target must contain a source value');}
  }
  const final=s.frames.at(-1);
  if(final.local&&final.kind!=='assembly'&&final.kind!=='anatomy')check(!s.plan.phases.some(p=>p.index===s.frames.length-1&&p.kind==='release'),'A final local result cannot be released as a wire buffer');
  for(const phase of s.plan.phases.filter(p=>['construct','open','release','focus'].includes(p.kind))){
   for(const fraction of [.1,.35,.5,.65,.9]){
    api.seek(phase.start+(phase.end-phase.start)*fraction);
    for(const actor of e.root.querySelectorAll('.rv-actor')){
     const face=actor.querySelector('.rv-actor-face'),capsule=actor.querySelector('.rv-capsule');
     if(face&&capsule)check(!(face.style.visibility==='visible'&&Number(face.style.opacity)>0&&capsule.style.visibility==='visible'&&Number(capsule.style.opacity)>0),'Expanded fields and compact text cannot be visible together');
    }
   }
  }
  check(JSON.stringify(e.root.reviewData)===source,'Text transitions and scan selection cannot modify model data');
 }
 api.select('dns');await e.flush();let dns=api.snapshot();check(dns.frames.at(-1).local,'DNS complete is an outcome projection rather than a duplicate reply');check(dns.frames.some(f=>f.readIds.some(id=>String(f.fields.find(x=>x.id===id).value)==='false')),'Real false values remain inspectable');
 api.select('tcp');await e.flush();let tcp=api.snapshot();check(tcp.frames.some(f=>!f.local&&f.fields.some(x=>x.value==='0 B')),'Real zero packet lengths remain present');check(tcp.plan.phases.some(p=>p.index===tcp.frames.length-1&&p.kind==='release'),'A final physical ACK still releases its processed buffer');api.dispose();
}
const e=await environment('workbench',390),text='DEVICE INTERFACE ADDRESS\napp eth0 10.0.0.6\nclient eth0 10.0.0.1',record=e.root.presentation.record({output:text},'CLI');
const field=record.querySelector('.rv-semantic-field');check(field.dataset.multiline==='true','Multiline source text receives a full row');check(field.querySelector('dd').textContent===text,'Source output retains its exact line breaks');
fs.writeFileSync('complete-review/live-animation-readability-contract.json',JSON.stringify({kind:'Emitted runtime regression contracts, separate from real browser evidence',checks,widths:[320,390,1024,1440]},null,2));console.log('PASS live animation readability',checks);

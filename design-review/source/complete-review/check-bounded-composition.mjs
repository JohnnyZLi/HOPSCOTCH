import assert from 'node:assert/strict';
import fs from 'node:fs';
import {environment} from './check-complete.mjs';
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
for(const width of [320,390,1024,1440]){
 const e=await environment('motion',width),api=e.root.causalStudy,source=JSON.stringify(e.root.reviewData);
 for(const scene of ['tcp','tls']){
  api.select(scene);await e.flush();let snapshot=api.snapshot();
  for(const g of snapshot.plan.prepared){check(g.focus.h<=g.fullHeight,'Viewport never invents card content height');check(g.focus.h>0,'Readable viewport remains positive');}
  if(scene==='tcp'){for(const selector of ['.rv-ack','.rv-expected'])check(e.q(selector).closest('.rv-retained-dock'),'Live transfer receiver belongs to the primary scene');for(const g of snapshot.plan.prepared.filter(g=>g.transfer))check(['.rv-ack','.rv-expected'].includes(g.transferTarget),'All numeric transfers address a labelled live destination');}
  const selected=snapshot.plan.phases.find(p=>p.kind==='read'&&p.index>0);api.seek((selected.start+selected.end)/2);const before=api.snapshot();
  e.viewport(640);await e.flush();const after=api.snapshot();eq(after.frames[after.at.index].id,before.frames[before.at.index].id,'Height reflow preserves event identity');check(Math.abs(after.at.p-before.at.p)<1e-6,'Height reflow preserves reading progress');
  for(const g of after.plan.prepared.filter(g=>g.transfer)){check(g.retainOffset>=0&&g.retainOffset<=Math.max(0,g.fullHeight-g.focus.h),'Retaining a cropped source value keeps its camera inside the same card');}
  for(const phase of after.plan.phases.filter(p=>p.kind==='read')){
   const destination=(phase.start+phase.end)/2;api.seek(destination);const actor=e.root.querySelectorAll('.rv-actor').find(n=>Number(n.style.opacity)>.99),face=actor.querySelector('.rv-actor-face'),expected=face.style.transform;const lensCanvas=e.q('.rv-lens-copy').querySelector('canvas'),offset=-Number(face.style.transform.match(/translateY\(([-\d.]+)px\)/)?.[1]||0);if(lensCanvas)check(Math.abs((parseFloat(lensCanvas.style.top)||0)-offset)<1e-6,'Scanner background follows the same view offset as the source fields');
   api.seek(0);api.seek(destination);eq(face.style.transform,expected,'Reader camera is derived from position, independent of seek history');
  }
  eq(JSON.stringify(e.root.reviewData),source,'Viewport composition cannot change source events, bytes or timestamps');
 }
 for(const scene of ['packet','packetOps','dns','journey','provider']){api.select(scene);await e.flush();check(e.root.disclosures.wanted(e.q('.rv-scene-details')),'Other scenes retain their existing visible state records');check(e.q('.rv-caption-detail').parentElement===e.q('.rv-caption'),'Other scenes retain their visible caption');check(e.q('.rv-event-picker').closest('.rv-controls'),'Other scenes retain their event controls');}
 api.dispose();
}
fs.writeFileSync('complete-review/bounded-composition-contract.json',JSON.stringify({kind:'Synthetic emitted-runtime contracts; not browser/compositor acceptance',checks,widths:[320,390,1024,1440],browserVerified:false},null,2));console.log('PASS bounded composition',checks);

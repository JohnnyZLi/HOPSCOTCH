import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
const plain=x=>JSON.parse(JSON.stringify(x));let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
const e=await environment('connected',390),p=e.root.presentation,r=e.root.layoutReservation;
for(const preset of ['clean',...e.root.entryDomain.SCENARIO_PRESET_CARDS.map(p=>p.id)]){
 e.root.connectedStudy.launch(preset);const s=e.root.connectedStudy.snapshot(),source=JSON.stringify(s.scenario),entries=s.scenario.events.map(v=>({at:v.atMs,facts:[{text:v.title},{text:v.summary}]})),t=p.attentionTimeline(entries,s.scenario.durationMs);
 for(let i=0;i<entries.length;i++){let segment=t.segments[i];ok(segment.wallEnd-segment.wallStart+1e-6>=e.root.pacing.reading(entries[i].facts).budget,'Every event receives the shared content-derived reading budget');ok(Math.abs(t.sourceAt(segment.wallStart)-entries[i].at)<1e-7,'Presentation boundary maps to the exact source event');}
 let last=-1;for(let wall=0;wall<=t.wallDuration;wall+=137){const src=t.sourceAt(wall);ok(src>=last&&src<=s.scenario.durationMs,'Source projection is monotonic and bounded');ok(Math.abs(t.wallAt(src)-wall)<1e-6,'Arbitrary seek time round-trips without losing presentation position');last=src;}
 ok(t.sourceAt(t.wallDuration)===s.scenario.durationMs,'Completion retains the canonical endpoint');ok(JSON.stringify(e.root.connectedStudy.snapshot().scenario)===source,'Pacing cannot change source events');
}
const cam={x:0,y:0,z:1},before={w:1000,h:600},anchor={x:930,y:300,w:64,h:44},next=r.resizeCamera(cam,before,{w:320,h:400},anchor);
ok(next.x+anchor.x-anchor.w/2>=0&&next.x+anchor.x+anchor.w/2<=320,'Visible selection stays visible after a narrow resize');
assert.deepEqual(plain(r.resizeCamera(cam,before,before,anchor)),cam);checks++;
assert.deepEqual(plain(r.resizeCamera(cam,before,{w:0,h:400},anchor)),cam);checks++;
assert.deepEqual(plain(r.resizeCamera(cam,before,{w:320,h:400},{...anchor,x:1300})),plain(r.resizeCamera(cam,before,{w:320,h:400})));checks++;
const title=e.q('.cx-caption-title'),detail=e.q('.cx-caption-detail');e.root.reviewUI.status(title,detail,'First caption','First detail');let mark=e.animationJobs.length;e.root.reviewUI.status(title,detail,'Replacement caption','Replacement detail');let jobs=e.animationJobs.slice(mark),out=jobs.find(j=>j.target.className.includes('rv-status-copy')),incoming=jobs.filter(j=>j.target===title||j.target===detail);
ok(Boolean(out)&&incoming.length===2,'Both caption lines participate in the shared handoff');for(const j of incoming)ok(j.options.delay>=out.options.duration&&j.options.fill==='both','Incoming text remains hidden until outgoing text has disappeared');
e.root.reviewUI.status(title,detail,'Interrupted caption','Latest detail');e.root.reviewUI.settle();ok(!title.parentElement.querySelector('.rv-status-copy'),'Interrupted and disposed handoffs release their old copy');
fs.writeFileSync('complete-review/live-audit-fixes-contract.json',JSON.stringify({kind:'Emitted runtime contracts; browser evidence is separate',checks,presets:1+e.root.entryDomain.SCENARIO_PRESET_CARDS.length},null,2));console.log('PASS live audit fixes',checks);

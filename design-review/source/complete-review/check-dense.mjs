import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const result={kind:'Actual emitted native disclosure/table runtime; synthetic geometry and fonts only',cases:[]};
for(const width of [320,390,736,1024,1440]){
 const b=await environment('workbench',width),api=b.root.builderStudy;api.selectPage('systems');
 for(const system of api.snapshot().systems)for(let index=0;index<system.details.length;index++){
  api.selectSystem(system.id,index);const content=b.q('.wb-systems-content'),details=content.querySelectorAll('details');for(const detail of details)detail.open=true;
  const keys=details.map(d=>d.querySelector('summary').textContent);api.renderSystems();eq(content.querySelectorAll('details').map(d=>d.open),keys.map(()=>true),'Opened records survive reconstruction');
  for(const td of content.querySelectorAll('td'))if(!td.attrs.colspan)ok(Boolean(td.dataset.columnName),'Mobile cells retain a semantic column label');
  if(details.length){api.selectSystem('scenario',0);api.selectSystem(system.id,index);eq(content.querySelectorAll('details').map(d=>d.open),keys.map(()=>true),'Returning to a system retains its own disclosure state');}
 }
 // Same-named Why disclosures remain separate, rather than opening together.
 const host=b.document.createElement('section');b.root.append(host);function draw(){host.replaceChildren();for(let i=0;i<3;i++){const block=b.document.createElement('section'),detail=b.document.createElement('details'),summary=b.document.createElement('summary');summary.textContent='Why';detail.append(summary);block.append(detail);host.append(block);}}
 draw();host.querySelectorAll('details')[1].open=true;b.root.layoutReservation.retainInteraction(host,draw);eq(host.querySelectorAll('details').map(d=>Boolean(d.open)),[false,true,false]);
 const e=await environment('evidence',width),a=e.root.evidenceStudy;a.select('measured');for(const category of Object.keys(a.snapshot().measured.factIdsByCategory)){e.change('.ev-category',category);for(const td of e.q('.ev-content').querySelectorAll('td'))ok(td.dataset.columnName);}
 a.select('capture');a.loadCapture('pcap');const detail=e.q('.ev-content').querySelector('details');detail.open=true;a.inspectByte(22);ok(e.q('.ev-content').querySelector('details').open,'Byte inspection retains its native disclosure');a.select('measured');a.select('capture');ok(e.q('.ev-content').querySelector('details').open,'Cross-workspace return retains disclosure context');
 result.cases.push({width,systems:api.snapshot().systems.length});console.log('PASS dense width',width);
}
result.checks=checks;result.source_manifest=JSON.parse(fs.readFileSync('complete-review/source-manifest.json'));fs.writeFileSync('complete-review/dense-functional-audit.json',JSON.stringify(result,null,2));console.log('PASS dense',checks);

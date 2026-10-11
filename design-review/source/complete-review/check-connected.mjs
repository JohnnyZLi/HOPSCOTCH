import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},plain=x=>JSON.parse(JSON.stringify(x));
const evidence={widths:[320,390,736,1024,1440],cases:[],kind:'Emitted runtime with synthetic DOM/font/WebGL; no browser layout or motion-pixel certification'};
for(const width of evidence.widths){
 const e=await environment('connected',width),api=e.root.connectedStudy,domain=e.root.entryDomain;
 eq(api.snapshot().view,'overview');eq(e.root.dataset.theme,'light');ok(e.q('.cx-specimen').textContent.includes('192.0.2.10'),'Entry packet is an actual source specimen');
 api.openCatalog();eq(e.q('.cx-catalog-content').querySelectorAll('.cx-row').length,13);const search=e.q('.cx-search');search.value='CAPTURED';search.dispatchEvent({type:'input',target:search});ok(e.q('.cx-catalog-content').textContent.includes('Capture Replay'),'Search covers provenance boundaries');search.value='unmatched-unmatched';search.dispatchEvent({type:'input',target:search});ok(e.q('.cx-search-count').textContent.startsWith('0'),'Empty search is explicit');api.returnContext();eq(api.snapshot().view,'overview');
 for(const id of domain.WORKSPACE_IDS){ok(api.openWorkspace(id));await e.flush();ok(e.q('.cx-title').textContent,'Every source route has a useful entry state');eq(domain.resolveAppRoute(domain.WORKSPACE_CATALOG[id].path).destination,id);eq(api.snapshot().destination,id);if(!['journey','capture'].includes(id)){const model=e.root.reviewData.referenceModels.find(m=>m.id===id);for(const record of model.frames[0].records||[])ok(e.q('.cx-inspector-content').textContent.includes(record.label)&&e.q('.cx-inspector-content').textContent.includes(String(record.value)),'Source context records are rendered, without empty inspector blocks');}}
 for(const preset of ['clean',...domain.SCENARIO_PRESET_CARDS.map(p=>p.id)]){
  api.launch(preset);const start=api.snapshot(),source=plain(start.scenario);
  for(const event of start.scenario.events){
   api.seek(event.atMs);eq(api.snapshot().state.activeEvent.id,event.id,'Canonical event lookup is exact');eq(e.q('.cx-caption-title').textContent,event.title);
   if(event.detailLab){
    const anchor=plain(api.snapshot()),portable=plain(anchor.portable);ok(api.openDetail(event.detailLab));await e.flush();eq(api.snapshot().stack.at(-1).eventId,event.id);ok(e.q('.cx-inspector-content').textContent.includes('own source model'),'Independent detail clocks are labelled');api.appearance();eq(plain(api.snapshot().portable),portable);
    ok(api.returnContext());await e.flush();eq(api.snapshot().clock,anchor.clock);eq(api.snapshot().state.activeEvent.id,event.id);eq(api.snapshot().playing,false,'Return is paused');eq(plain(api.snapshot().portable),portable);eq(plain(api.snapshot().scenario),source);
   }
  }
  api.seek(Math.min(7123,start.scenario.durationMs));const original=plain(api.snapshot()),share=e.q('.cx-share').value;
  api.openCatalog();api.returnContext();eq(api.snapshot().clock,original.clock,'Explore does not reset the current model');ok(api.importScenario(share));eq(api.snapshot().clock,original.clock);eq(plain(api.snapshot().portable),{...original.portable,timeMs:original.clock});
  const retained=plain(api.snapshot());ok(!api.importScenario('{broken JSON'));eq(api.snapshot().clock,retained.clock);eq(plain(api.snapshot().portable),retained.portable);ok(!e.q('.cx-error').hidden,'Invalid imports retain their cause and current scenario');
 }
 const v2={schema:'hopscotch.url-journey',version:2,hostname:'example.test',transportProfile:'tcp-h2',dnsProfile:'cache-miss',modifiers:['route-failure','single-loss'],timeMs:12234,name:'Composed review'};ok(api.importScenario(JSON.stringify(v2)));api.openDetail('builder');api.returnContext();eq(api.snapshot().portable.version,2);eq(plain(api.snapshot().portable.modifiers),plain(domain.normalizePortableJourneyScenario(v2).modifiers));
 const canonical=plain(api.snapshot().state);e.change('.rv-theme','dark');await e.flush();eq(plain(api.snapshot().state),canonical,'Dark presentation cannot alter canonical state');
 api.openWorkspace('capture');for(const conversation of e.root.reviewData.captureMulti.conversations){
  api.chooseConversation(conversation.id);for(const ref of conversation.frameReferences){
   ok(api.chooseFrame(ref.frameId));const before=plain(api.snapshot().captureSelection),frame=e.root.reviewData.captureMulti.frames.find(f=>f.record.id===ref.frameId);
   ok(api.openMicroscope());await e.flush();const bytes=e.root.reviewData.captureMultiBytes[e.root.reviewData.captureMulti.frames.indexOf(frame)];
   for(const index of [0,14,22,bytes.length-1]){ok(api.selectByte(index));eq(api.snapshot().captureSelection.byte,index);eq(e.q('.cx-inspector-content').textContent.includes(bytes[index].toString(16).padStart(2,'0').toUpperCase()),true);
    const field=frame.layers.flatMap(l=>l.fields).find(f=>f.id===api.snapshot().captureSelection.fieldId);
    for(const button of e.q('.rv-bytes').children){const offset=Number(button.dataset.byte);eq(button.dataset.inField,String(field?.byteRanges.some(r=>offset>=r.offset&&offset<r.offset+r.length)||false),'All visible bytes receive the selected source field range');}
   }
   ok(!api.selectByte(-1));ok(!api.selectByte(bytes.length));api.returnContext();await e.flush();eq(plain(api.snapshot().captureSelection),before,'Return restores exact conversation/frame/layer/field/byte window');
  }
 }
 // Interrupt a shared-anchor transfer with another route, then settle old jobs.
 api.launch();api.seek(4550);api.openDetail('tcp');api.openHome();for(const a of e.animationJobs)if(!a.cancelled)a.finish();await e.flush();eq(api.snapshot().view,'overview');eq(e.root.querySelectorAll('.cx-transfer-ghost').length,0);eq(api.snapshot().animations,0,'Superseded effects release their temporary objects');
 evidence.cases.push({width,scenarios:9,routes:13,captureFrames:e.root.reviewData.captureMulti.frames.length});api.dispose();console.log('PASS connected width',width);
}
const reduced=await environment('connected',390,{reduced:true}),ra=reduced.root.connectedStudy;ra.launch();ra.play();eq(ra.snapshot().clock,ra.snapshot().scenario.events[1].atMs);eq(ra.snapshot().playing,false);ra.openDetail('dns');eq(reduced.animationJobs.length,0,'Reduced motion uses exact states without transition effects');ra.returnContext();
const fallback=await environment('connected',390,{failGL:true});ok(fallback.root.connectedStudy);fallback.root.connectedStudy.launch();await fallback.flush();ok(fallback.q('.cx-object').textContent.includes('Navigate'),'No WebGL still exposes source meaning');
evidence.checks=checks;evidence.source_manifest=JSON.parse(fs.readFileSync('complete-review/source-manifest.json'));fs.writeFileSync('complete-review/connected-functional-audit.json',JSON.stringify(evidence,null,2));console.log('PASS connected',checks);

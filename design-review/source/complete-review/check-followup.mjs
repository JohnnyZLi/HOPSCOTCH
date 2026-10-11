import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment,motionAudit,auditCount} from './check-complete.mjs';
let checks=0;
const ok=(x,m)=>{assert.ok(x,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const plain=x=>JSON.parse(JSON.stringify(x));
async function settled(e,api){for(let i=0;i<40&&api.snapshot().graphPending;i++)await e.flush();}
function captureFile(payload){
 const b=new Uint8Array(24+(payload.length?16+payload.length:0)),v=new DataView(b.buffer);v.setUint32(0,0xa1b2c3d4,true);v.setUint16(4,2,true);v.setUint16(6,4,true);v.setUint32(16,65535,true);v.setUint32(20,1,true);
 if(payload.length){v.setUint32(24,1,true);v.setUint32(32,payload.length,true);v.setUint32(36,payload.length,true);b.set(payload,40);}return b;
}
for(const width of [320,390,736,1024,1440]){
 const m=await environment('motion',width),ma=m.root.causalStudy;eq(m.q('.rv-ack').closest('.rv-client-record'),m.q('.rv-client-record'),'Sender ACK belongs to the client record');eq(m.q('.rv-expected').closest('.rv-server-record'),m.q('.rv-server-record'),'Expected byte belongs to the server record');
 const first=ma.snapshot();for(const [i,g]of first.plan.prepared.entries())if(g.transfer){const f=first.frames[i];eq(g.transfer.after,String(f.state[g.transferStateKey]),'Transfer lands in its exact source state');eq(g.transfer.before,String(f.fields.find(x=>x.id===g.transferFieldId).value),'Transfer starts with the exact contributing packet field');if(g.transferStateKey==='highestAck'){eq(g.transferFieldId,'ack');eq(Number(g.transfer.before),Number(g.transfer.after),'ACK retention cannot claim unrelated sequence arithmetic');}}
 const replyIndex=first.frames.findIndex(f=>f.id==='synack');eq(first.plan.prepared[replyIndex].transferTarget,'.rv-ack');eq(first.plan.prepared[replyIndex].transfer.before,'1001');eq(first.plan.prepared[replyIndex].transfer.after,'1001');
 for(const id of ['handshake-complete','final-ack'])ok(!first.plan.prepared[first.frames.findIndex(f=>f.id===id)].transfer,'An unchanged data-space record does not receive an unrelated opposite-space ACK');

 for(const id of ['tcp','tls','dns','journey']){
  ma.select(id);await m.flush();const s=ma.snapshot();
  for(const p of s.plan.phases.filter(p=>p.kind==='travel')){
   const f=s.frames[p.index];for(const t of [p.start+1,p.end-1]){
    ma.seek(t);const pose=ma.sample(t).pose,labels=m.q('.rv-endpoints').children.map(n=>n.textContent);
    eq(labels,plain(f.endpoints),'A reply cannot swap its physical peers');
    eq(labels[f.forward?0:1],f.from,'Departure label is the source actor');
    eq(labels[f.forward?1:0],f.to,'Arrival label is the destination actor');
    if(t===p.start+1)ok(f.forward?pose.box.x<s.plan.width/2:pose.box.x>s.plan.width/2,'Travel starts beside its labeled sender');
   }
  }
  const read=s.plan.phases.find(p=>p.kind==='read');ma.seek(read.start+(read.end-read.start)*.5);const reads=m.reads;ma.seek(read.start+(read.end-read.start)*.51);eq(m.reads,reads,'A prepared read has no per-frame geometry measurement');
 }
 const b=await environment('workbench',width),ba=b.root.builderStudy;await settled(b,ba);
 const ref=b.root.reviewData.builder.options.find(r=>r.plane==='ethernet');b.change('.wb-device',ref.plane+':'+ref.id);await settled(b,ba);ok(b.q('.wb-copy').disabled,'Unavailable plane authoring is explicit');
 const input=b.q('.wb-search');input.value='app';input.dispatchEvent({type:'input',target:input});await settled(b,ba);
 eq(plain(ba.snapshot().selected),{plane:'routed',id:'app'},'Exact device wins over an incident interface substring');ok(ba.snapshot().graphPlan.nodes.some(n=>n.id==='app'),'Cross-plane search uses the new source topology');
 let state=ba.snapshot(),world={x:(state.viewport.w/2-state.camera.x)/state.camera.z,y:(state.viewport.h/2-state.camera.y)/state.camera.z};b.click('.wb-in');state=ba.snapshot();ok(Math.abs((state.viewport.w/2-state.camera.x)/state.camera.z-world.x)<1e-7,'Zoom retains the world center');ok(Math.abs((state.viewport.h/2-state.camera.y)/state.camera.z-world.y)<1e-7);
 ba.choose({plane:'routed',id:'edge'});b.click('.wb-copy');b.click('.wb-paste');const pasted=ba.snapshot().input.graph.nodes.find(n=>!b.root.reviewData.builder.input.graph.nodes.some(old=>old.id===n.id));ba.choose({plane:'routed',id:pasted.id});ba.undo();ok(ba.snapshot().input.graph.nodes.some(n=>n.id===ba.snapshot().selected.id),'Undo reconciles a removed selection');ba.undo(true);ba.choose({plane:'routed',id:pasted.id});ba.inspectHistory(0);ok(ba.snapshot().input.graph.nodes.some(n=>n.id===ba.snapshot().selected.id),'History reconciles a removed selection');ba.live();
 for(const target of ['route','interfaces','arp','mac']){const output=ba.runCommand('show '+target),result=ba.snapshot().cliResult,projection=b.root.reviewDomain.projectBuilderCliState(ba.snapshot().input),key={route:'routes',interfaces:'interfaces',arp:'arpEntries',mac:'macEntries'}[target];ok(output);eq(result.count,projection[key].length,'The readable CLI retains every canonical source record');eq(result.groups.reduce((n,g)=>n+g.rows.length,0),result.count);ok(b.q('.wb-output').textContent.includes(output),'Exact source output remains inspectable');}
 const valid=plain(ba.snapshot().cliResult);ba.runCommand('invalid command');eq(plain(ba.snapshot().cliResult),valid,'A command error retains the prior readable result');
 const e=await environment('evidence',width),a=e.root.evidenceStudy;
 for(const category of Object.keys(a.snapshot().measured.factIdsByCategory)){e.change('.ev-category',category);const s=a.snapshot();if(s.selectedFact)eq(s.measured.factsById[s.selectedFact].category,category,'Selected fact follows its category');}
 a.select('capture');await e.flush();e.q('.rv-bytes').closest('details').open=true;const byte=e.q('.rv-bytes').children.find(n=>n.dataset.byte==='34');byte.focus();byte.click();
 eq(a.snapshot().layerIndex,2,'A TCP byte opens TCP');eq(e.document.activeElement.dataset.byte,'34','Byte focus survives a layer transition');ok(e.document.activeElement.isConnected,'Retained focus names a current native control');ok(e.q('.rv-bytes').closest('details').open,'Exact bytes stay disclosed');
 const field=e.q('.ev-packet .ev-fact-button');field.focus();field.click();eq(e.document.activeElement.dataset.fieldId,field.dataset.fieldId,'The same semantic field retains focus');ok(e.document.activeElement.isConnected);ok(e.q('.rv-bytes').closest('details').open);
 const payload=new Uint8Array(2048);payload.set(e.root.reviewData.captureMultiBytes[0]);ok(await a.importCaptureBuffer(captureFile(payload)),'Large valid frame imports through the actual parser');
 for(const i of [0,54,127,1023,2047]){a.inspectByte(i);const s=a.snapshot();eq(s.captureBytes[0][i],payload[i],'The window retains exact frame-relative bytes');eq(s.byte,i);ok(e.q('.rv-bytes').children.length<=s.byteWindow.capacity,'Only a width-derived bounded window is mounted');ok(e.q('.rv-bytes').children.some(n=>n.dataset.byte===String(i)),'Any selected byte is revealed');}
 const sourceBytes=plain(a.snapshot().captureBytes);e.change('.rv-theme','dark');await e.flush();eq(plain(a.snapshot().captureBytes),sourceBytes,'Appearance cannot change captured bytes');eq(a.snapshot().byte,2047);
 ok(await a.importCaptureBuffer(captureFile([])),'An empty valid PCAP is accepted');eq(a.snapshot().capture.frames.length,0);eq(e.q('.ev-detail-title').textContent,'Capture scope');eq(e.q('.ev-clock').textContent,'No captured frame timestamp');ok(!e.root.querySelector('.ev-packet'),'Zero frames have no stale anatomy');ok(!e.q('.ev-caption-title').textContent.includes('Frame #1'));
 // Native file-read promises can fail or become obsolete before parser work.
 a.loadCapture('pcap');let resolve;const held=new Promise(r=>{resolve=r;});const file=e.q('.ev-capture-file');file.files=[{arrayBuffer:()=>held}];file.dispatchEvent({type:'change',target:file});eq(a.snapshot().mode,'loading');a.setState('empty');resolve(captureFile(payload));await e.flush();eq(a.snapshot().mode,'empty','Clear cancels an outstanding file read');
 file.files=[{arrayBuffer:()=>Promise.reject(Error('File read failed'))}];file.dispatchEvent({type:'change',target:file});await e.flush();eq(a.snapshot().mode,'error');ok(e.q('.ev-error p').textContent.includes('File read failed'),'Native read failure is visible');a.inspectByte(34);ok(e.q('.ev-error p').textContent.includes('File read failed'),'Retained evidence inspection preserves the error cause');
 a.loadCapture('pcap');let release;const delayed=new Promise(r=>{release=r;});file.files=[{arrayBuffer:()=>delayed}];file.dispatchEvent({type:'change',target:file});a.loadCapture('pcapng');release(captureFile(payload));await e.flush();eq(a.snapshot().capture.frames.length,2,'Loading a reference cancels a stale import');
 a.select('internet');await settled(e,a);const relationship=e.root.reviewData.internet.graph.relationships.at(-1).id;e.change('.ev-as-link',relationship);e.click('.ev-controls button');await settled(e,a);eq(e.q('.ev-as-link').value,relationship,'Toggled relationship retains its selection');
 console.log('PASS follow-up',width);
}
for(const width of [320,390,736,1024,1440])await motionAudit(width,{scenes:['tcp']});await motionAudit(390,{reduced:true,scenes:['tcp']});
const manifest=JSON.parse(fs.readFileSync('complete-review/source-manifest.json','utf8'));
fs.writeFileSync('complete-review/followup-causal-final-audit.json',JSON.stringify({kind:'Actual emitted scripts in synthetic DOM/font/WebGL; not browser, phone or hardware verification',checks,fullMotionChecks:auditCount(),widths:[320,390,736,1024,1440],source_manifest:manifest},null,2));
console.log('TOTAL',checks,'focused assertions');

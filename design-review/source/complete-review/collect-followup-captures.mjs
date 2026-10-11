import fs from 'node:fs';
import {environment} from './check-complete.mjs';
const models=JSON.parse(fs.readFileSync('complete-review/composition-models.json','utf8')),clean=x=>JSON.parse(JSON.stringify(x));
function file(payload){const b=new Uint8Array(24+(payload.length?16+payload.length:0)),v=new DataView(b.buffer);v.setUint32(0,0xa1b2c3d4,true);v.setUint16(4,2,true);v.setUint16(6,4,true);v.setUint32(16,65535,true);v.setUint32(20,1,true);if(payload.length){v.setUint32(24,1,true);v.setUint32(32,payload.length,true);v.setUint32(36,payload.length,true);b.set(payload,40);}return b;}
for(const width of [390,1024]){
 const e=await environment('evidence',width),a=e.root.evidenceStudy;a.select('capture');
 for(const kind of ['zero','large']){
  const payload=new Uint8Array(kind==='large'?2048:0);if(payload.length)payload.set(e.root.reviewData.captureMultiBytes[0]);await a.importCaptureBuffer(file(payload));if(payload.length)a.inspectByte(2047);const s=a.snapshot();
  models.push({extraCapture:true,type:'evidence',width,id:'capture',mode:kind,title:e.q('.ev-title').textContent,summary:e.q('.ev-subtitle').textContent,source:e.q('.ev-source-note').textContent,detailTitle:e.q('.ev-detail-title').textContent,detailFacts:e.q('.ev-detail-content').querySelectorAll('.rv-fact').map(n=>n.children.map(c=>c.textContent)),clock:e.q('.ev-clock').textContent,snapshot:{capture:clean(s.capture),frameIndex:s.frameIndex,layerIndex:s.layerIndex,captureBytes:clean(s.captureBytes),byteWindow:clean(s.byteWindow)}});
 }
}
fs.writeFileSync('complete-review/composition-models.json',JSON.stringify(models));console.log('Four source-parser empty/large capture compositions added');

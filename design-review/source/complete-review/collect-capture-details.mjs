import fs from 'node:fs';import {environment} from './check-complete.mjs';
const clean=v=>JSON.parse(JSON.stringify(v)),models=JSON.parse(fs.readFileSync('complete-review/composition-models.json','utf8'));
for(const width of [390,1024]){
 const e=await environment('evidence',width),api=e.root.evidenceStudy;api.select('capture');
 for(const kind of ['pcapng','truncated']){
  api.loadCapture(kind);e.change('.ev-layer','1');const s=api.snapshot();
  models.push({extraCapture:true,type:'evidence',width,id:'capture',mode:kind,title:e.q('.ev-title').textContent,summary:e.q('.ev-subtitle').textContent,source:e.q('.ev-source-note').textContent,detailTitle:e.q('.ev-detail-title').textContent,detailFacts:e.q('.ev-detail-content').querySelectorAll('.rv-fact').map(n=>n.children.map(c=>c.textContent)),snapshot:{capture:clean(s.capture),frameIndex:s.frameIndex,layerIndex:s.layerIndex,captureBytes:clean(s.captureBytes)}});
 }
}
fs.writeFileSync('complete-review/composition-models.json',JSON.stringify(models));console.log('Four actual captured IPv4 detail references added');

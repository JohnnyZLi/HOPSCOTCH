import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
const dir='complete-review/scanner-lifecycle-20261007';
const manifest=JSON.parse(fs.readFileSync('complete-review/source-manifest.json'));
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-6,message);
function declarations(css,selector){
 const rule=css.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]+)\\}'))?.[1];
 assert.ok(rule,selector+' has an owning rule');
 return Object.fromEntries(rule.split(';').filter(Boolean).map(d=>d.split(':').map(s=>s.trim())));
}
const before=fs.readFileSync(dir+'/before/review.css','utf8'),after=fs.readFileSync('complete-review/review.css','utf8');
const regression={before:[],after:[],cases:[],captures:[],manifest,kind:'Source CSS origin contract and actual emitted runtime in synthetic glyph geometry. No browser CSS/compositor verification.'};
// Independently check the CSS coordinate-space contract. The DOM harness does
// not implement CSS static positioning and must not be used to certify it.
for(const selector of ['.rv-actor','.rv-lens-copy']){
 const previous=declarations(before,selector),current=declarations(after,selector);
 const origin=d=>d.left==='0'&&d.top==='0';
 assert.equal(origin(previous),false,'Old source reproduces missing absolute origin');
 assert.equal(origin(current),true,'Translated absolute children have explicit shared origins');
 regression.before.push({selector,explicitOrigin:false});regression.after.push({selector,explicitOrigin:true});
}
const emitted='/workspace/hopscotch-causal-lifecycle.html',html=fs.readFileSync(emitted,'utf8');
const runtime=fs.readFileSync('complete-review/motion.js','utf8').replaceAll('__ROOT__','hop-causal-review'),previous=fs.readFileSync(dir+'/before/motion.js','utf8').replaceAll('__ROOT__','hop-causal-review');
assert.ok(html.includes(runtime));
// Execute the previous actual runtime for the before case, restoring exact
// emitted bytes before any after check. Never reinterpret old tests as passing.
try{
 fs.writeFileSync(emitted,html.replace(runtime,previous));
 const e=await environment('motion',390);await e.flush();const s=e.root.causalStudy.snapshot();
 const phases=s.plan.phases.filter(p=>p.index===0).map(p=>p.kind);
 assert.ok(phases.includes('fold'),'Previous wire construction expands and folds before sending');
 const construct=s.plan.phases.find(p=>p.kind==='construct');
 assert.ok(e.root.causalStudy.sample(construct.end-1).pose.detail>.99);
 regression.before.push({wirePhases:phases,expandedBeforeSending:true});
 e.root.causalStudy.dispose();
}finally{fs.writeFileSync(emitted,html);}
for(const width of [320,390,736,1024,1440]){
 const e=await environment('motion',width),api=e.root.causalStudy,source=JSON.stringify(e.root.reviewData);
 for(const scene of ['tcp','dns','tls','journey','provider','packet','packetOps']){
  api.select(scene);await e.flush();let s=api.snapshot();
  for(let index=0;index<s.frames.length;index++){
   const f=s.frames[index],ps=s.plan.phases.filter(p=>p.index===index),g=s.plan.prepared[index];
   if(f.local===false&&ps.some(p=>p.kind==='construct')){
    assert.equal(ps.some(p=>p.kind==='fold'),false,'Wire packet does not fold before transmission');
    assert.equal(ps.filter(p=>p.kind==='open').length,f.lost?0:1,'Only receipt opens a delivered wire packet');
    const construct=ps.find(p=>p.kind==='construct'),travel=ps.find(p=>p.kind==='travel');
    for(const p of [construct,travel])for(const t of [0,.25,.5,.999])near(api.sample(p.start+(p.end-p.start)*t).pose.detail,0,'Outgoing/travelling packet stays compact');
    if(!f.lost){assert.ok(ps.findIndex(p=>p.kind==='open')<ps.findIndex(p=>p.kind==='read'));assert.ok(ps.findIndex(p=>p.kind==='read')<ps.findIndex(p=>p.kind==='retain'));assert.ok(ps.findIndex(p=>p.kind==='retain')<ps.findIndex(p=>p.kind==='release'));}
   }
   for(const p of ps.filter(p=>p.kind==='read')){
    for(const rp of g.read.phases){
     const time=p.start+(rp.start+rp.end)/2;api.seek(time);const pose=api.sample(time).pose,point=e.root.motionPlanner.samplePlan(g.read,time-p.start),lens=e.q('.rv-lens');
     const cx=parseFloat(lens.style.left)+parseFloat(lens.style.width)/2,cy=parseFloat(lens.style.top)+parseFloat(lens.style.height)/2;
     near(cx,pose.box.x+point.x,'Lens x shares the displayed actor coordinate space');near(cy,pose.box.y+point.y,'Lens y shares the displayed actor coordinate space');
     if(rp.kind==='read'){
      const line=g.targets.find(t=>t.id===rp.id).lines[rp.line];
      near(point.y,line.y+line.h/2,'Reading follows glyph centre rather than label or cell margin');
      assert.ok(point.x>=line.x-1e-6&&point.x<=line.x+line.w+1e-6,'Reading centre stays in measured glyph run');
      near(pose.detail,1,'Scanner only runs on fully open fields');
      if(scene==='tcp'&&index<2&&width===390)regression.captures.push({width,frame:f.id,phase:rp.kind,pose,focus:g.focus,targets:g.targets,lens:{x:parseFloat(lens.style.left),y:parseFloat(lens.style.top),w:parseFloat(lens.style.width),h:parseFloat(lens.style.height)}});
     }
    }
   }
  }
  regression.cases.push({width,scene,frames:s.frames.length,wirePhases:s.plan.phases.filter(p=>p.index===0).map(p=>p.kind)});
 }
 api.select('tcp');await e.flush();let s=api.snapshot(),p=s.plan.phases.find(p=>p.kind==='read');api.seek(p.start+(p.end-p.start)*.4);const held=api.snapshot();
 e.change('.rv-theme','dark');await e.flush();e.font(1.4);await e.flush();
 const resized=api.snapshot();assert.equal(resized.frames[resized.at.index].id,held.frames[held.at.index].id);assert.equal(resized.at.kind,'read');near(resized.at.p,held.at.p,'Theme/font reflow preserves reading progress');
 const reads=e.reads;for(let i=0;i<30;i++)api.seek(resized.clock+i);assert.equal(e.reads,reads,'Prepared scanner performs no layout reads while playing');
 assert.equal(JSON.stringify(e.root.reviewData),source,'Presentation changes retain exact source model');api.dispose();
}
fs.writeFileSync(dir+'/regression.json',JSON.stringify(regression,null,2));console.log('PASS scanner origin, compact send/single receive opening, measured glyph following, theme/font reflow, cached playback, source preservation across 35 scene/width cases');

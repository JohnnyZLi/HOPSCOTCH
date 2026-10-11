import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
const dir='complete-review/related-motion-20261007',plain=x=>JSON.parse(JSON.stringify(x));
const baseline=fs.readFileSync(dir+'/before/review.css','utf8'),css=fs.readFileSync('complete-review/review.css','utf8');
const rule=(text,selector)=>text.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]+)\\}'))?.[1]||'';
assert.ok(!rule(baseline,'.rv-transfer').includes('top:0'));
assert.ok(rule(css,'.rv-transfer').includes('left:0;top:0'));
const report={kind:'Source coordinate ownership plus emitted runtime boundary and visible-pose history invariance in synthetic DOM/glyph geometry. Not browser pixel verification.',manifest:JSON.parse(fs.readFileSync('complete-review/source-manifest.json')),cases:[],before:{transferMissingOrigin:true,payloadSeek:'Halfway appended chunks retain translateY(3px) at settled hold in previous runtime'}};
function visible(e){
 const styles=['opacity','visibility','transform','width','height','borderRadius','left','top'];
 const get=n=>({text:n.textContent,styles:Object.fromEntries(styles.map(k=>[k,n.style[k]||'']))});
 const actors=e.root.querySelectorAll('.rv-actor').filter(n=>Number(n.style.opacity)>.01);
 const faces=actors.flatMap(n=>n.querySelectorAll('.rv-actor-face')).filter(n=>n.style.visibility!=='hidden'&&Number(n.style.opacity)>.01);
 const active=faces.map(n=>({pose:get(n),chunks:n.querySelectorAll('.rv-payload-chunk').map(get)}));
 const lens=e.q('.rv-lens');return {actors:actors.map(n=>({styles:get(n).styles,capsules:n.querySelectorAll('.rv-capsule').filter(c=>c.style.visibility!=='hidden'&&Number(c.style.opacity)>.01).map(get)})),faces:active,lens:Number(lens.style.opacity)>.01?get(lens):null};
}
for(const width of [320,390,1024,1440]){
 const e=await environment('motion',width),a=e.root.causalStudy,source=JSON.stringify(e.root.reviewData);
 for(const scene of ['tcp','packet','packetOps','dns','tls','journey','provider']){
  a.select(scene);await e.flush();const s=a.snapshot();let boundaries=0,poses=0;
  // Compare neighbouring phases while the same physical object is visible.
  for(let i=0;i<s.plan.phases.length-1;i++){
   const before=s.plan.phases[i],after=s.plan.phases[i+1];if(before.index!==after.index)continue;
   const p=a.sample(before.end-.0001).pose,q=a.sample(after.start+.0001).pose;
   if(p.opacity>.2&&q.opacity>.2){for(const key of ['x','y','w','h'])assert.ok(Math.abs(p.box[key]-q.box[key])<.02,scene+' visible box boundary '+before.kind+'→'+after.kind+' '+key);assert.ok(Math.abs(p.detail-q.detail)<.02,scene+' detail boundary');boundaries++;}
  }
  // A target pose must be determined by its timeline position, independent of
  // whether the user arrived by scrubbing backwards or forwards through edits.
  const phases=s.plan.phases.filter(p=>['hold','read'].includes(p.kind));
  const destinations=phases.length>12?[...phases.slice(0,4),...phases.slice(-4)]:phases;
  for(const target of destinations){
   const t=(target.start+target.end)/2;a.seek(t);const expected=visible(e);
   const detour=s.plan.phases.find(p=>p.index===target.index&&p.kind==='modify')||s.plan.phases[Math.max(0,s.plan.phases.indexOf(target)-1)];
   a.seek((detour.start+detour.end)/2);a.seek(t);assert.deepEqual(visible(e),expected,scene+' visible pose independent of prior edit frames');poses++;
  }
  report.cases.push({width,scene,boundaries,historyComparisons:poses});
 }
 // Exercise the original payload failure explicitly; settled active chunks
 // must not inherit a midpoint translation, including reverse seeks.
 a.select('packetOps');await e.flush();const s=a.snapshot(),p=s.plan.phases.find(p=>p.kind==='modify'&&s.frames[p.index].operation==='append'),hold=s.plan.phases.find(q=>q.index===p.index&&q.kind==='hold');
 a.seek((p.start+p.end)/2);assert.ok(e.root.querySelectorAll('.rv-payload-chunk').some(c=>c.style.transform==='translateY(3px)'));
 a.seek(hold.start+1);const faces=e.root.querySelectorAll('.rv-actor-face').filter(n=>n.style.visibility==='visible'&&Number(n.style.opacity)>.99);
 for(const f of faces)for(const c of f.querySelectorAll('.rv-payload-chunk'))assert.equal(c.style.transform,'none');
 const clock=a.snapshot().clock;for(let i=0;i<5;i++)a.play();e.frame(100);e.frame(100);
 assert.ok(Math.abs(a.snapshot().clock-clock-100)<1e-6,'Repeated play requests do not multiply the animation clock');
 a.pause();const paused=a.snapshot().clock;e.frame(1000);assert.equal(a.snapshot().clock,paused,'Pause leaves no advancing animation callback');
 assert.equal(JSON.stringify(e.root.reviewData),source);a.dispose();console.log('PASS related motion width',width);
}
fs.writeFileSync(dir+'/contracts.json',JSON.stringify(report,null,2));console.log('PASS translated overlay ownership, visible phase boundaries, deterministic seek poses and source preservation across 28 scene/width cases');

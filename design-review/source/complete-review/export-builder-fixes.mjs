import fs from 'node:fs';
import {environment} from './check-complete.mjs';
const cases=[];
for(const width of [390,736,1024]){
 const e=await environment('workbench',width),api=e.root.builderStudy;
 for(let i=0;i<40&&api.snapshot().graphPending;i++)await e.flush();
 api.runPing();for(const a of e.animationJobs)if(!a.cancelled)a.finish();await e.flush();
 const d=e.q('.wb-canvas').querySelector('details');d.querySelector('.rv-disclosure-inner').fixtureRect={left:0,top:0,width:width-32,height:180};
 e.root.disclosures.set(d,true);e.frame(80);const mid=e.root.disclosures.snapshot(d);await e.flush();
 cases.push({width,plan:api.snapshot().graphPlan,camera:api.snapshot().camera,viewport:api.snapshot().viewport,crossings:e.root.networkScene.crossings(api.snapshot().graphPlan.links),status:{title:e.q('.wb-caption-title').textContent,detail:e.q('.wb-caption-detail').textContent,source:e.q('.wb-revision').textContent},disclosure:{title:d.querySelector('summary').textContent.replace(/^›/,''),mid,settled:e.root.disclosures.snapshot(d)},manifest:JSON.parse(fs.readFileSync('complete-review/source-manifest.json'))});
}
fs.writeFileSync('complete-review/builder-fix-compositions.json',JSON.stringify(cases,null,2));console.log('Exported actual Builder runtime states');

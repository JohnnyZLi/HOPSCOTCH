import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';

let checks=0;
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const cases=[];
for(const width of [390,1024])for(const theme of ['light','dark']){
 const e=await environment('connected',width),api=e.root.connectedStudy;
 e.change('.rv-theme',theme);api.launch();await e.flush();
 const sceneObserver=e.resizeObservers.find(o=>o.targets.has(e.q('.rv-main')));
 ok(sceneObserver,'Connected has a scene-size observer');
 const held=JSON.stringify(api.snapshot().portable),source=JSON.stringify(e.root.reviewData),removed=[];
 const removeFont=e.document.fonts.removeEventListener;
 e.document.fonts.removeEventListener=(type,fn)=>{removed.push({type,name:fn.name});removeFont(type,fn);};
 api.dispose();
 eq(sceneObserver.targets.size,0,'Disposing Connected disconnects its scene observer');
 ok(removed.some(r=>r.type==='loadingdone'&&r.name==='fontPaint'),'Disposal releases the named scene font listener');
 const draws=api.snapshot().material.draws;
 const stale=e.animationJobs.length;
 e.font(1.5);e.root.dispatchEvent(new e.context.CustomEvent('review-material-change'));
 api.appearance();
 await e.flush();
 eq(api.snapshot().material.draws,draws,'Late size/font/material signals cannot repaint a disposed study');
 eq(e.animationJobs.length,stale,'Detached size/font/material callbacks cannot create transitions');
 eq(JSON.stringify(api.snapshot().portable),held,'Cleanup preserves the request anchor');
 eq(JSON.stringify(e.root.reviewData),source,'Cleanup preserves exact source fixtures');
 api.dispose();
 eq(sceneObserver.targets.size,0,'Disposal is idempotent');
 cases.push({width,theme,checks:'observer disconnect, late font/material callbacks, no new transitions, exact source and idempotence'});
}
const dir=process.env.HOPSCOTCH_AUDIT_DIR||'complete-review/reaudit-20261006';
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(dir+'/cleanup-contracts.json',JSON.stringify({kind:'Emitted controller with synthetic event and observer delivery; no browser claim',checks,cases,manifest:JSON.parse(fs.readFileSync('complete-review/source-manifest.json'))},null,2));
console.log('PASS re-audit cleanup',checks);

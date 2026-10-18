import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
let count=0;const ok=(v,m)=>{assert.ok(v,m);count++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);count++;};
const pages={motion:'lifecycle',workbench:'builder',evidence:'evidence',connected:'connected'};
for(const kind of ['motion','workbench','evidence','connected']){
 const e=await environment(kind,390,{artifactPath:'../../public/review/'+pages[kind]+'.html'}),host=e.document.createElement('div'),title=e.document.createElement('strong'),detail=e.document.createElement('p');
 host.className='rv-caption';host.setAttribute('aria-live','polite');host.append(title,detail);e.root.append(host);
 const ui=e.root.reviewUI;
 ui.status(title,detail,'Initial','One result');eq(host.querySelectorAll('.rv-status-copy').length,0);
 ui.status(title,detail,'Next','Another result');eq(host.querySelectorAll('.rv-status-copy').length,1);
 const copy=host.querySelector('.rv-status-copy');eq(copy.getAttribute('aria-hidden'),'true');ok(copy.inert);ok(!copy.getAttribute('aria-live'));
 const superseded=e.animationJobs.filter(a=>host.contains(a.target));
 ui.status(title,detail,'Latest','Exact live content');eq(host.querySelectorAll('.rv-status-copy').length,1,'Rapid results keep one outgoing visual copy');eq(title.textContent,'Latest');
 const jobs=[...superseded,...e.animationJobs.filter(a=>host.contains(a.target))];
 for(const media of [...e.media]){media.matches=true;[...media.events].forEach(f=>f());}
 eq(host.querySelectorAll('.rv-status-copy').length,0,'Enabling reduced motion settles pending status visuals immediately');
 eq(host.style.height,'','Settlement releases the temporary caption height');eq(title.textContent,'Latest');ok(jobs.every(a=>a.cancelled),'Superseded and preference-settled caption effects are released');
 const existing=e.q('.rv-console');eq(existing.getAttribute('data-ui-surface'),'chrome','Every study uses the shared status surface role');
 for(const media of [...e.media])media.matches=false;
 ui.status(title,detail,'Finished effect','An unresolved native completion promise');
 const stranded=e.animationJobs.filter(a=>host.contains(a.target)&&!a.cancelled);for(const animation of stranded)animation.playState='finished';
 await e.flush();eq(host.querySelectorAll('.rv-status-copy').length,0,'Finished effects settle even when their native promise never resolves');ok(stranded.every(a=>a.cancelled),'Settlement releases every finished effect');
 ui.status(title,detail,'Disposal','An interrupted result');ok(host.querySelector('.rv-status-copy'));ui.settle();eq(host.querySelectorAll('.rv-status-copy').length,0,'Owner disposal removes pending visual copies');
 ui.status(title,detail,'Disconnected','A detached receiver');const detached=e.animationJobs.filter(a=>host.contains(a.target));host.remove();
 for(const observer of e.mutations)if(observer.targets.some(t=>t.target===e.root&&t.options.childList))observer.callback([{target:e.root,addedNodes:[],removedNodes:[host]}]);
 eq(host.querySelectorAll('.rv-status-copy').length,0,'Removing a receiver releases its inert visual copy');ok(detached.every(a=>a.cancelled),'Detached receiver effects are canceled');
 console.log('PASS shared lifecycle',kind);
}
fs.writeFileSync('complete-review/second-audit/lifecycle.json',JSON.stringify({kind:'Actual shared controller in synthetic DOM; pending animation preference/lifecycle and semantic-surface regressions',count},null,2));
console.log('PASS lifecycle contracts',count);

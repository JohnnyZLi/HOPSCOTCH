import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
const dir='complete-review/related-motion-20261007';
const emitted=fs.readFileSync('/workspace/hopscotch-causal-lifecycle.html','utf8'),css=emitted.match(/<style>([\s\S]*?)<\/style>/)[1];
function owners(text){
 const map=new Map();
 for(const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g))for(const selector of match[1].split(',')){
  const cls=selector.match(/^\s*#[\w-]+\s+\.([\w-]+)\s*$/)?.[1];if(!cls)continue;
  const props=map.get(cls)||{};for(const d of match[2].split(';')){const i=d.indexOf(':');if(i>0)props[d.slice(0,i).trim()]=d.slice(i+1).trim();}map.set(cls,props);
 }
 return map;
}
const policy=owners(css),seen=new Set();
function check(e,policy){
 const misses=[];
 for(const n of e.q('.rv-stage').querySelectorAll('*')){
  if(!n.style.transform?.includes('translate'))continue;
  const props=Object.assign({},...n.className.split(/\s+/).map(c=>policy.get(c)||{}));
  if((n.style.position||props.position)!=='absolute')continue;
  const anchored=axis=>[axis,...(axis==='left'?['right']:['bottom'])].some(k=>{const v=n.style[k]??props[k];return v!==undefined&&v!==''&&v!=='auto';})||Boolean(props.inset||n.style.inset);
  seen.add(n.className);if(!anchored('left')||!anchored('top'))misses.push(n.className);
 }
 return misses;
}
const e=await environment('motion',390),a=e.root.causalStudy;await e.flush();let s=a.snapshot(),p=s.plan.phases.find(p=>p.kind==='retain');a.seek((p.start+p.end)/2);
const previous=new Map([...policy].map(([key,value])=>[key,{...value}]));delete previous.get('rv-transfer').left;delete previous.get('rv-transfer').top;
assert.ok(check(e,previous).some(cls=>cls.includes('rv-transfer')),'Generic sweep identifies the old numeric overlay without a per-field case');
let samples=0;
for(const id of ['tcp','packet','packetOps','dns','tls','journey','provider']){
 a.select(id);await e.flush();s=a.snapshot();
 for(const p of s.plan.phases){a.seek((p.start+p.end)/2);assert.deepEqual(check(e,policy),[],id+' translated absolute nodes own both origin axes');samples++;}
}
a.dispose();fs.writeFileSync(dir+'/origin-sweep.json',JSON.stringify({kind:'Source declaration ownership sweep over actual emitted runtime nodes; not a CSS engine or browser layout result',manifest:JSON.parse(fs.readFileSync('complete-review/source-manifest.json')),samples,owners:[...seen]},null,2));console.log('PASS generic translated-origin sweep',samples,'phase samples across',seen.size,'owner classes');

import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
let count=0;const cases=[],ok=(v,m)=>{assert.ok(v,m);count++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);count++;},plain=x=>JSON.parse(JSON.stringify(x));
function graph(n,pairs,long=false){return {nodes:Array.from({length:n},(_,i)=>({id:'N'+i,label:long&&i%3===0?'Transit router · west campus · 2001:db8:1234:5678::42':'R'+i})),links:pairs.map(([a,b],i)=>({id:'link'+i,a:'N'+a,b:'N'+b}))};}
const ring=Array.from({length:12},(_,i)=>[i,(i+1)%12]),star=Array.from({length:15},(_,i)=>[0,i+1]),grid=[];
for(let i=0;i<16;i++){if(i%4<3)grid.push([i,i+1]);if(i<12)grid.push([i,i+4]);}
for(const [width,scale]of [[320,1],[390,1.7],[736,1],[1024,2],[1440,1]]){
 const e=await environment('workbench',width,{scale});
 for(const [name,g]of [['ring',graph(12,ring)],['star',graph(16,star,true)],['grid',graph(16,grid,true)],['disconnected',graph(6,[[0,1],[2,3]])]]){
  const measure=e.root.networkScene.measure('wb-node cursor-interaction',e.q('.wb-map').clientWidth);
  const measured=new Map(g.nodes.map(n=>[n.id,measure.box(n.label)]));
  let plan;try{plan=await e.root.networkPlanner.buildAsync(g,measure);}finally{measure.dispose();}
  eq(plain(e.root.networkScene.endpointAudit(plan)),[],'All adapted ports stay on flat rounded boundaries');
  for(const field of ['shared','collisions','duplicatePorts','contacts','shallow'])eq(plan.report[field],0,name+' '+field);
  for(const n of plan.nodes){ok(n.w>=measured.get(n.id).w,'Planner contains measured label width');ok(n.h>=measured.get(n.id).h,'Planner contains measured multi-line label height');}
  eq(e.root.querySelectorAll('.rv-node-measure').length,0,'Temporary measurement nodes are released');
  cases.push({width,scale,name,nodes:plan.nodes.length,links:plan.links.length,report:plain(plan.report)});
 }
 // A controller sees real event shapes and natural-height changes, including
 // nested records. Metrics are explicit synthetic fixtures, never browser QA.
 const host=e.document.createElement('section'),d=e.document.createElement('details'),summary=e.document.createElement('summary'),button=e.document.createElement('button');summary.textContent='Why';d.append(summary,button);host.append(d);e.root.append(host);e.root.disclosures.upgrade(host);
 const inner=d.querySelector('.rv-disclosure-inner');inner.fixtureRect={left:0,top:0,width:200,height:130};
 const activate=target=>summary.dispatchEvent({type:'click',button:0,target,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}});
 activate(summary);e.frame(40);const p=e.root.disclosures.snapshot(d).progress;ok(p>0&&p<1);activate(summary.querySelector('.rv-disclosure-icon'));eq(e.root.disclosures.snapshot(d).progress,p,'Icon activation reverses the same motion');await e.flush();ok(!d.open);
 e.root.disclosures.set(d,true,false);button.focus();activate(summary);eq(e.document.activeElement,summary,'Closing content returns its focused control to the native summary');await e.flush();ok(d.querySelector('.rv-disclosure-body').inert);
 e.root.disclosures.set(d,true,false);inner.fixtureRect.height=360;for(const observe of e.resizes)observe([{target:inner}]);eq(e.root.disclosures.snapshot(d).targetHeight,360,'Changed content height is observed rather than bucketed');
 console.log('PASS adaptation',width,scale);
}
fs.writeFileSync('complete-review/second-audit/adaptation.json',JSON.stringify({kind:'20 synthetic graph/content-metric stress cases and native-event-shape controller contracts; no platform layout certification',count,cases},null,2));console.log('PASS adaptation contracts',count);

import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
let count=0;const ok=(v,m)=>{assert.ok(v,m);count++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);count++;},plain=x=>JSON.parse(JSON.stringify(x));
const cases=[];async function settle(e){for(let i=0;i<60&&e.root.builderStudy?.snapshot().graphPending;i++)await e.flush();}
for(const width of [320,390,736,1024,1440]){
 const e=await environment('workbench',width);await settle(e);const api=e.root.builderStudy,s=api.snapshot(),plan=s.graphPlan;
 ok(plan,'Builder produces geometry');eq(plain(e.root.networkScene.endpointAudit(plan)),[],'Every port touches a straight part of its actual rounded node outline');
 const edges=e.q('.wb-edges'),layer=e.q('.wb-node-layer'),world=edges.parentElement;
 eq(world,layer.parentElement,'Edges and nodes have the same world owner');eq(world.style.width,plan.width+'px');eq(world.style.height,plan.height+'px');eq(edges.style.width,'100%');eq(edges.style.maxWidth,'none','Host responsive SVG rule cannot independently shrink edges');
 const box=edges.attrs.viewBox.split(' ').map(Number);eq(box,[0,0,plan.width,plan.height]);ok(!edges.style.transform&&!layer.style.transform,'The one parent owns the camera transform');
 for(const link of plan.links)for(const [id,point]of [[link.a,link.points[0]],[link.b,link.points.at(-1)]]){
  const n=plan.nodes.find(n=>n.id===id),button=layer.children.find(n=>n.dataset.node===id);eq(Number.parseFloat(button.style.width),n.w);eq(Number.parseFloat(button.style.height),n.h);eq(Number.parseFloat(button.style.left),n.x-n.w/2);eq(Number.parseFloat(button.style.top),n.y-n.h/2);
 }
 ok(!edges.children.some(n=>n.attrs['stroke-width']==='5'),'No full-connection knockout paint');
 const reads=e.reads;e.click('.wb-in');ok(e.reads-reads<10,'Camera changes do not clone or measure panes/nodes');
 const camera=plain(api.snapshot().camera);api.apply(next=>next,'GEOMETRY RETAINED');await settle(e);eq(plain(api.snapshot().camera),camera,'A source update retains the user camera');
 const detail=e.root.querySelectorAll('details')[0],ui=e.root.disclosures,inner=detail.querySelector('.rv-disclosure-inner');inner.fixtureRect={left:0,top:0,width:width-32,height:120};
 ui.set(detail,true);e.frame(60);const opening=plain(ui.snapshot(detail));ok(opening.progress>0&&opening.progress<1);eq(detail.querySelector('summary').attrs['aria-expanded'],'true');
 ui.set(detail,false);eq(plain(ui.snapshot(detail)).progress,opening.progress,'Reversal starts at the current arrow/content pose');ok(!ui.wanted(detail),'Closing intent is false while native details stays mounted');await e.flush();ok(!detail.open);eq(detail.querySelector('summary').attrs['aria-expanded'],'false');ok(detail.querySelector('.rv-disclosure-body').hidden);
 // Same semantic content is rebuilt during closing: preserve intent and progress.
 const host=e.document.createElement('section');e.root.append(host);function draw(){host.replaceChildren();const d=e.document.createElement('details');d.dataset.disclosureKey='same-fact';const summary=e.document.createElement('summary');summary.textContent='Why';d.append(summary,e.document.createElement('p'));host.append(d);}
 draw();ui.upgrade(host);let d=host.querySelector('details');d.querySelector('.rv-disclosure-inner').fixtureRect={left:0,top:0,width:200,height:200};ui.set(d,true,false);ui.set(d,false);e.frame(50);const closing=ui.snapshot(d);e.root.layoutReservation.retainInteraction(host,draw,'same-context');d=host.querySelector('details');const held=ui.snapshot(d);ok(!held.wanted);ok(held.moving);ok(Math.abs(held.progress-closing.progress)<1e-8,'Reconstruction preserves motion progress');await e.flush();ok(!d.open);
 // External native property changes are captured before a queued toggle event.
 d.open=true;e.root.layoutReservation.retainInteraction(host,draw,'same-context');ok(host.querySelector('details').open);
 api.runProbe('traceroute');eq(e.q('.wb-caption-title').textContent,'Trace completed');api.runPing();eq(e.q('.wb-caption-title').textContent,'Ping delivered');
 for(const theme of ['light','dark']){e.change('.rv-theme',theme);eq(e.root.dataset.theme,theme);eq(plain(e.root.networkScene.endpointAudit(api.snapshot().graphPlan)),[]);}
 cases.push({width,nodes:plan.nodes.length,links:plan.links.length});console.log('PASS shared Builder',width);
}
for(const reduced of [false,true]){
 const e=await environment('workbench',390,{reduced}),d=e.root.querySelectorAll('details')[0];e.root.disclosures.set(d,true);if(reduced){eq(e.root.disclosures.snapshot(d).progress,1);ok(!e.root.disclosures.snapshot(d).moving);}else{e.frame(30);const media=e.media.find(m=>m.events.length&&m===e.media[0]);media.matches=true;media.events.forEach(f=>f());ok(!e.root.disclosures.snapshot(d).moving,'Motion preference changes settle active disclosures');}
}
for(const kind of ['connected','motion','evidence','workbench']){
 const e=await environment(kind,736);eq(e.q('.rv-header').children.map(n=>n.className),['rv-header-identity','rv-header-tools'],'One header slot structure is used everywhere');
 const h=fs.readFileSync({connected:'/workspace/hopscotch-connected-workspaces.html',motion:'/workspace/hopscotch-causal-lifecycle.html',evidence:'/workspace/hopscotch-evidence-workspaces.html',workbench:'/workspace/hopscotch-builder-workbench.html'}[kind],'utf8');ok(/--hs-route-line:#[0-9a-f]+/.test(h));ok(/--hs-route-line:#7b9bbd/.test(h));
 if(kind==='evidence'){e.root.evidenceStudy.select('internet');for(let i=0;i<40&&e.root.evidenceStudy.snapshot().graphPending;i++)await e.flush();eq(e.q('.ev-as-svg').parentElement,e.q('.ev-as-nodes').parentElement);eq(plain(e.root.networkScene.endpointAudit(e.root.evidenceStudy.snapshot().graphPlan)),[]);}
}
fs.writeFileSync('complete-review/shared-builder-audit.json',JSON.stringify({kind:'Emitted-runtime geometry, interruption, native-state, camera and reuse contracts in synthetic DOM; not browser compositing acceptance',count,cases,manifest:JSON.parse(fs.readFileSync('complete-review/source-manifest.json'))},null,2));console.log('PASS shared contracts',count);

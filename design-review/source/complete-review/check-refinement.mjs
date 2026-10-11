import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const cases=[];
for(const kind of ['workbench','evidence','connected'])for(const theme of ['light','dark']){
 const e=await environment(kind,390),api=e.root[kind==='workbench'?'builderStudy':kind==='evidence'?'evidenceStudy':'connectedStudy'];e.change('.rv-theme',theme);
 if(kind==='connected')api.openWorkspace('capture');if(kind==='evidence')api.select('capture');await e.flush();
 const container=e.q(kind==='workbench'?'.wb-viewport':kind==='evidence'?'.ev-layout':'.cx-content-layout'),toggle=e.q(kind==='workbench'?'.wb-mobile-panes':kind==='evidence'?'.ev-mobile-panes':'.cx-mobile-panes');
 const before=JSON.stringify(e.root.reviewData);container.fixtureStyle={fontSize:'14px',paddingLeft:'0px',paddingRight:'0px',columnGap:'24px','--rv-primary-min':'32em','--rv-detail-min':'20em'};
 for(const width of [400,751,752,980]){container.fixtureRect={left:0,top:0,width,height:600};const r=e.root.layoutReservation.fit(container);eq(r.mode,width<752?'exclusive':'parallel','Measured content fit works independently of the outer phone viewport');eq(toggle.hidden,r.mode==='parallel');}
 toggle.children[1].click();const pane=container.dataset.pane;container.fixtureStyle.fontSize='22px';e.root.layoutReservation.fit(container);eq(container.dataset.layoutMode,'exclusive','Larger type requests one readable pane without a device breakpoint');eq(container.dataset.pane,pane,'Pane identity survives type-driven layout changes');
 container.fixtureStyle.fontSize='14px';container.fixtureStyle.paddingLeft='130px';container.fixtureStyle.paddingRight='130px';e.root.layoutReservation.fit(container);eq(container.dataset.layoutMode,'exclusive','Padding does not count as available reading space');eq(JSON.stringify(e.root.reviewData),before,'Pane adaptation does not mutate source data');
 const reads=e.reads;for(let i=0;i<8;i++)e.root.layoutReservation.fit(container);ok(e.reads-reads<50,'Unchanged fit avoids reservation-clone work');
 container.fixtureStyle.paddingLeft='0px';container.fixtureStyle.paddingRight='0px';container.fixtureStyle.fontSize='14px';e.root.layoutReservation.fit(container);const focused=e.q(kind==='workbench'?'.wb-workbench':kind==='evidence'?'.ev-inspector':'.cx-inspector');focused.focus();container.fixtureStyle.fontSize='22px';e.root.layoutReservation.fit(container);eq(container.dataset.pane,toggle.children[1].dataset.pane,'Parallel-to-exclusive reflow keeps the focused pane visible');eq(e.document.activeElement,focused,'Reflow retains focus');
 e.root.layoutReservation.dispose();eq(e.root.layoutReservation.stats().bindings,0);ok(!e.root.layoutReservation.stats().pending);e.root.layoutReservation.refresh();ok(!e.root.layoutReservation.stats().pending,'Disposed layout owner cannot schedule new work');
 cases.push({kind,theme,fit:'container, type, padding, selection retention, bounded work'});
}
{
 const e=await environment('workbench',1024),a=e.root.builderStudy;for(let i=0;i<30&&a.snapshot().graphPending;i++)await e.flush();
 const state=a.snapshot(),input=state.input,trace=e.root.reviewDomain.traceBuilderForwarding(input.graph,input.addressing,input.routing,input.sourceId,input.destinationId),path=e.root.networkScene.traceState(trace,input.graph);
 eq(path.linkIds,trace.hops.map(h=>h.linkId));ok(path.nodeIds.includes(input.sourceId)&&path.nodeIds.includes(input.destinationId));eq(path.boundary,null);
 const source=JSON.stringify(input);e.click('.wb-show-path');eq(JSON.stringify(a.snapshot().input),source,'Showing the path changes the camera, never the model');ok(a.snapshot().camera.z>=.85,'Path overview preserves readable label scale');
 for(const line of e.q('.wb-edges').querySelectorAll('[data-edge]'))if(path.linkIds.includes(line.dataset.edge))eq(line.dataset.networkState,'path','Crossing overpasses share the complete connection state');
 const stopped={reachable:false,hops:trace.hops.slice(0,1),failureNodeId:'edge'};eq(e.root.networkScene.traceState(stopped,input.graph).boundary,'edge','Boundary comes from the trace, not the last successful hop');
 const unknown={reachable:false,hops:[],failureNodeId:'missing'};eq(e.root.networkScene.traceState(unknown,input.graph).boundary,null,'Unknown failure does not fabricate a node');
 a.loadChallenge(0);for(let i=0;i<30&&a.snapshot().graphPending;i++)await e.flush();const next=a.snapshot().input,failed=e.root.reviewDomain.traceBuilderForwarding(next.graph,next.addressing,next.routing,next.sourceId,next.destinationId);ok(!failed.reachable);const stop=e.root.networkScene.traceState(failed,next.graph);eq(e.root.querySelectorAll('.wb-node').filter(n=>n.dataset.boundary==='true').map(n=>n.dataset.node),stop.boundary?[stop.boundary]:[],'Broken challenge marks the actual first stopped boundary');
}
{
 const e=await environment('motion',1024),a=e.root.causalStudy;
 for(const scene of ['tcp','tls','dns','packet','packetOps','provider']){
  a.select(scene);await e.flush();const s=a.snapshot();
  for(let i=0;i<s.frames.length;i++){const f=s.frames[i],p=s.plan.phases.find(p=>p.index===i&&p.kind==='hold')||s.plan.phases.find(p=>p.index===i);a.seek((p.start+p.end)/2);const actor=e.root.querySelectorAll('.rv-actor')[['packet','packetOps'].includes(scene)?0:i];ok(actor,scene+' actor exists, including packets correctly hidden after loss');const physical=f.physical||f.local===false;eq(actor.dataset.materialRole,physical?'packet':'operation');if(!physical)eq(actor.getAttribute('data-ui-surface'),undefined,'Moving operations avoid stale static material canvases');}
 }
 const main=e.q('.rv-main').children,console=e.q('.rv-console'),secondary=e.q('.rv-state-secondary');ok(main.indexOf(console)<main.indexOf(secondary),'Playback remains above retained state and deep evidence');
 const host=e.root.presentation.record({version:4,ttl:64,source:'2001:db8:1234:5678::1',checksum:'0x03F1',enabled:false,nested:{id:'route',prefix:'198.51.100.0/24'}},'Packet');e.root.append(host);ok(host.textContent.includes('0x03F1')&&host.textContent.includes('2001:db8:1234:5678::1'),'Semantic records retain exact numeric and address formatting');ok(host.textContent.includes('No'));eq(e.root.presentation.label('tcpChecksum'),'TCP checksum');
 const ds=host.querySelectorAll('details');eq(new Set(ds.map(d=>d.dataset.disclosureKey)).size,ds.length,'Nested record identities do not collide');
}
const preserved={'domain.bundle.js':'428e415ba73a47bb247ec0bb255aeadd5feda1503c8e5140094f5b3feda3e58d','evidence-domain.bundle.js':'6bdda42d427e5743b42f564d71b6bf6029c613258276dcc82aa07ddf1d70dbf4','entry-domain.bundle.js':'7e12f09a35235d6bcb358121961717ab81b6871d7f86d6b97a69a2058fac0360','source-data.json':'3d727d60ec4605973a5fc2ff73958c2f720d0c1060b9a219cb573d9d98fe019e'};
for(const [name,digest]of Object.entries(preserved))eq(crypto.createHash('sha256').update(fs.readFileSync('complete-review/'+name)).digest('hex'),digest,'Domain/source inputs remain byte-identical');
const auditDir=process.env.HOPSCOTCH_AUDIT_DIR||'complete-review/refinement-audit';fs.mkdirSync(auditDir,{recursive:true});fs.writeFileSync(auditDir+'/contracts.json',JSON.stringify({kind:'Actual emitted runtime in explicit synthetic DOM/type geometry; no browser pixel claim',checks,cases,preserved,manifest:JSON.parse(fs.readFileSync('complete-review/source-manifest.json'))},null,2));console.log('PASS refinement',checks);

import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import { defaultBuilderLayout } from '../src/builder/model.ts';
import {
  builderOspfState,
  createDefaultBuilderRoutingConfig,
  routeTableForBuilderRouter,
  selectBuilderRoute,
  setBuilderOspfEverywhere,
  setBuilderOspfLinkArea,
  traceBuilderForwarding,
  upsertBuilderOspfSummary,
} from '../src/builder/routing.ts';
import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';

const graph={
  nodes:[
    {id:'client',label:'CLIENT',kind:'endpoint'}, {id:'r1',label:'R1',kind:'router'}, {id:'abr1',label:'ABR1',kind:'router'},
    {id:'abr2',label:'ABR2',kind:'router'}, {id:'r2',label:'R2',kind:'router'}, {id:'app',label:'APP',kind:'endpoint'},
  ],
  links:[
    {id:'client-r1',a:'client',b:'r1',cost:1,failed:false},
    {id:'r1-abr1',a:'r1',b:'abr1',cost:10,failed:false},
    {id:'abr1-abr2',a:'abr1',b:'abr2',cost:5,failed:false},
    {id:'abr2-r2',a:'abr2',b:'r2',cost:10,failed:false},
    {id:'r2-app',a:'r2',b:'app',cost:1,failed:false},
  ],
};
const layout={client:{x:5,y:50},r1:{x:20,y:50},abr1:{x:38,y:50},abr2:{x:62,y:50},r2:{x:80,y:50},app:{x:95,y:50}};
const addressing=createDefaultBuilderAddressing(graph);
let routing=setBuilderOspfEverywhere(graph,addressing,createDefaultBuilderRoutingConfig(),true);
routing=setBuilderOspfLinkArea(graph,addressing,routing,'client-r1','1');
routing=setBuilderOspfLinkArea(graph,addressing,routing,'r1-abr1','1');
routing=setBuilderOspfLinkArea(graph,addressing,routing,'abr1-abr2','0');
routing=setBuilderOspfLinkArea(graph,addressing,routing,'abr2-r2','2');
routing=setBuilderOspfLinkArea(graph,addressing,routing,'r2-app','2');

assert.equal(routing.ospf.linkAreas['r1-abr1'],'0.0.0.1');
assert.equal(routing.ospf.linkAreas['abr2-r2'],'0.0.0.2');
assert.equal(routing.ospf.linkAreas['abr1-abr2'],undefined,'Area 0 is the implicit/default persisted assignment');
const state=builderOspfState(graph,addressing,routing);
assert.deepEqual(state.areaIds,['0.0.0.0','0.0.0.1','0.0.0.2']);
assert.deepEqual(state.abrRouterIds,['abr1','abr2']);
assert.equal(state.adjacencies.find((entry)=>entry.linkId==='r1-abr1')?.areaId,'0.0.0.1');
assert.equal(state.adjacencies.find((entry)=>entry.linkId==='abr1-abr2')?.areaId,'0.0.0.0');
assert.equal(state.adjacencies.find((entry)=>entry.linkId==='abr2-r2')?.areaId,'0.0.0.2');
assert.deepEqual(state.areaComponents['0.0.0.0'],[['abr1','abr2']]);
assert.deepEqual(state.areaComponents['0.0.0.1'],[['abr1','r1']]);
assert.deepEqual(state.areaComponents['0.0.0.2'],[['abr2','r2']]);

const appIf=interfacesForBuilderNode(addressing,'app')[0];
assert.ok(appIf);
const appPrefix=addressing.segments[appIf.linkId].cidr;
const r1App=selectBuilderRoute(routeTableForBuilderRouter(graph,addressing,routing,'r1'),appIf.address);
assert.equal(r1App?.source,'ospf');
assert.equal(r1App?.ospfRouteType,'inter-area');
assert.equal(r1App?.ospfAreaId,'0.0.0.2');
assert.equal(r1App?.linkId,'r1-abr1');
assert.equal(r1App?.metric,26);
assert.match(r1App?.stateNote??'',/O IA/);
const abr2App=selectBuilderRoute(routeTableForBuilderRouter(graph,addressing,routing,'abr2'),appIf.address);
assert.equal(abr2App?.ospfRouteType,'intra-area');
assert.equal(abr2App?.prefix,appPrefix);
assert.equal(abr2App?.metric,11);
assert.match(abr2App?.stateNote??'',/OSPF O · AREA 0\.0\.0\.2/);

const trace=traceBuilderForwarding(graph,addressing,routing,'client','app');
assert.equal(trace.reachable,true);
assert.deepEqual(trace.hops.map((hop)=>hop.nodeId),['client','r1','abr1','abr2','r2']);

routing=upsertBuilderOspfSummary(graph,addressing,routing,{abrRouterId:'abr2',fromAreaId:'2',prefix:'10.0.0.0/24',metric:20,description:'Area 2 range'});
const summarized=selectBuilderRoute(routeTableForBuilderRouter(graph,addressing,routing,'r1'),appIf.address);
assert.equal(summarized?.prefix,'10.0.0.0/24');
assert.equal(summarized?.ospfRouteType,'inter-area');
assert.equal(summarized?.ospfSummaryId,routing.ospf.summaries[0].id);
assert.equal(summarized?.ospfAbrRouterId,'abr2');
assert.equal(summarized?.metric,35);
assert.ok(!routeTableForBuilderRouter(graph,addressing,routing,'r1').some((entry)=>entry.source==='ospf'&&entry.ospfRouteType==='inter-area'&&entry.prefix===appPrefix),'covered Area 2 specific must be suppressed across summarizing ABR');
assert.equal(selectBuilderRoute(routeTableForBuilderRouter(graph,addressing,routing,'abr2'),appIf.address)?.prefix,appPrefix,'ABR inside Area 2 must retain the specific intra-area route');
assert.equal(traceBuilderForwarding(graph,addressing,routing,'client','app').reachable,true,'summary must remain forwarding-capable at the remote router while destination-side ABR keeps specifics');

const failed={...graph,links:graph.links.map((link)=>link.id==='abr1-abr2'?{...link,failed:true}:{...link})};
assert.equal(selectBuilderRoute(routeTableForBuilderRouter(failed,addressing,routing,'r1'),appIf.address),null,'inter-area knowledge must not teleport across a failed Area 0 backbone');
assert.equal(traceBuilderForwarding(failed,addressing,routing,'client','app').reachable,false);

const scenario=createBuilderScenario('Multi-area OSPF',graph,'client','app',layout,addressing,routing);
assert.equal(scenario.version,9,'multi-area fields are an additive routing config extension inside scenario v9');
const restored=deserializeBuilderScenario(serializeBuilderScenario(scenario));
assert.equal(restored.routing.ospf.linkAreas['r1-abr1'],'0.0.0.1');
assert.equal(restored.routing.ospf.linkAreas['abr2-r2'],'0.0.0.2');
assert.equal(restored.routing.ospf.summaries.length,1);
assert.equal(restored.routing.ospf.summaries[0].prefix,'10.0.0.0/24');

console.log('Builder OSPF multi-area contract passed: per-link area membership, ABR detection, Area 0 hierarchy, O vs O IA preference, inter-area forwarding, ABR summarization, backbone failure isolation, and scenario-v9 persistence.');

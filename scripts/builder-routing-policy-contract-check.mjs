import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import {
  builderBgpState,
  createBuilderBgpWithdrawalScenario,
  createDefaultBuilderBgpConfig,
  setBuilderBgpRouterAsn,
  snapshotBuilderBgpWithdrawal,
  updateBuilderBgpSession,
  upsertBuilderBgpOrigin,
  upsertBuilderBgpPolicy,
  upsertBuilderBgpSession,
} from '../src/builder/bgp.ts';
import { builderIsisState } from '../src/builder/isis.ts';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import {
  builderRedistributionHazards,
  cloneBuilderRoutingPolicyConfig,
  upsertBuilderEcmpProfile,
  upsertBuilderIsisRouter,
  upsertBuilderOspfTimer,
  upsertBuilderPbrRule,
  upsertBuilderRedistributionRule,
  upsertBuilderRouteSummary,
} from '../src/builder/routing-policy.ts';
import {
  builderOspfState,
  createDefaultBuilderRoutingConfig,
  routeTableForBuilderRouter,
  selectBuilderRoute,
  setBuilderOspfEverywhere,
  setBuilderRoutingPolicyConfig,
  traceBuilderForwarding,
  upsertBuilderStaticRoute,
  validateBuilderRoutingConfig,
} from '../src/builder/routing.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
const addressing = createDefaultBuilderAddressing(graph);
const defaultRouting = validateBuilderRoutingConfig(graph, addressing, createDefaultBuilderRoutingConfig());
assert.deepEqual(defaultRouting.policy, cloneBuilderRoutingPolicyConfig(defaultRouting.policy));

// General redistribution is configured outside protocol-native state and preserves source/rule/tag provenance.
let staticRouting = upsertBuilderStaticRoute(graph, addressing, defaultRouting, {
  routerId: 'edge', prefix: '203.0.113.0/24', nextHop: '10.0.0.10', metric: 7,
});
staticRouting = setBuilderOspfEverywhere(graph, addressing, staticRouting, true);
let policy = cloneBuilderRoutingPolicyConfig(staticRouting.policy);
policy = upsertBuilderRedistributionRule(policy, {
  id: 'redist-static-ospf', routerId: 'edge', source: 'static', target: 'ospf', prefix: '203.0.113.0/24', metric: 30, routeTag: 417, enabled: true, allowFeedback: false, description: 'Track F contract',
});
staticRouting = setBuilderRoutingPolicyConfig(graph, addressing, staticRouting, policy);
const r1External = routeTableForBuilderRouter(graph, addressing, staticRouting, 'r1').find((entry) => entry.prefix === '203.0.113.0/24' && entry.source === 'ospf' && entry.redistributionRuleId === 'redist-static-ospf');
assert.ok(r1External, 'general redistribution must project a native static route into OSPF');
assert.equal(r1External.redistributedFrom, 'static');
assert.equal(r1External.routeTag, 417);
assert.equal(r1External.ospfExternalLsaType, 5);

let hazardPolicy = cloneBuilderRoutingPolicyConfig(defaultRouting.policy);
hazardPolicy = upsertBuilderRedistributionRule(hazardPolicy, { id:'ospf-to-bgp',routerId:'edge',source:'ospf',target:'bgp',prefix:'0.0.0.0/0',metric:20,routeTag:501,enabled:true,allowFeedback:false,description:'hazard A' });
hazardPolicy = upsertBuilderRedistributionRule(hazardPolicy, { id:'bgp-to-ospf',routerId:'edge',source:'bgp',target:'ospf',prefix:'0.0.0.0/0',metric:20,routeTag:502,enabled:true,allowFeedback:false,description:'hazard B' });
const hazards = builderRedistributionHazards(hazardPolicy);
assert.equal(hazards.length, 1);
assert.equal(hazards[0].severity, 'LOOP RISK');
assert.match(hazards[0].detail, /keeps redistributed routes out of native-source inputs/i);

// PBR changes the actual next hop only after normal destination FIB selection is preserved in the hop record.
let ospfRouting = setBuilderOspfEverywhere(graph, addressing, createDefaultBuilderRoutingConfig(), true);
const baselineTrace = traceBuilderForwarding(graph, addressing, ospfRouting, 'client', 'app', graph, { protocol:'tcp',sourceAddress:'10.0.0.1',destinationAddress:'10.0.0.6',sourcePort:42000,destinationPort:443 });
assert.equal(baselineTrace.reachable, true);
const baselineEdge = baselineTrace.hops.find((hop) => hop.nodeId === 'edge');
assert.equal(baselineEdge?.nextNodeId, 'r1');
let pbrPolicy = cloneBuilderRoutingPolicyConfig(ospfRouting.policy);
pbrPolicy = upsertBuilderPbrRule(pbrPolicy, { id:'pbr-edge-r2',routerId:'edge',order:10,sourcePrefix:'10.0.0.0/30',destinationPrefix:'10.0.0.4/30',protocol:'tcp',sourcePort:null,destinationPort:443,nextHop:'10.0.0.14',enabled:true,description:'steer HTTPS over R2' });
ospfRouting = setBuilderRoutingPolicyConfig(graph, addressing, ospfRouting, pbrPolicy);
const pbrTrace = traceBuilderForwarding(graph, addressing, ospfRouting, 'client', 'app', graph, { protocol:'tcp',sourceAddress:'10.0.0.1',destinationAddress:'10.0.0.6',sourcePort:42000,destinationPort:443 });
assert.equal(pbrTrace.reachable, true);
const pbrEdge = pbrTrace.hops.find((hop) => hop.nodeId === 'edge');
assert.equal(pbrEdge?.pbrRuleId, 'pbr-edge-r2');
assert.equal(pbrEdge?.nextNodeId, 'r2');
assert.equal(pbrEdge?.fibRouteSource, 'ospf');
assert.equal(pbrEdge?.fibNextHop, baselineEdge?.nextHop, 'PBR must preserve the destination-based FIB next hop as a separate fact');
assert.notEqual(pbrEdge?.nextHop, pbrEdge?.fibNextHop);

// ECMP hash depth: L3 ignores transport ports; L4 admits them into deterministic per-flow selection and respects maxPaths.
const ecmpGraph = cloneBuilderGraph(graph);
ecmpGraph.links = ecmpGraph.links.map((link) => link.id === 'edge-r2' ? { ...link, cost: 10 } : link.id === 'r2-core' ? { ...link, cost: 10 } : link);
const ecmpAddressing = createDefaultBuilderAddressing(ecmpGraph);
let ecmpRouting = setBuilderOspfEverywhere(ecmpGraph, ecmpAddressing, createDefaultBuilderRoutingConfig(), true);
let ecmpPolicy = upsertBuilderEcmpProfile(ecmpRouting.policy, { routerId:'edge',hashMode:'l3',maxPaths:2 });
ecmpRouting = setBuilderRoutingPolicyConfig(ecmpGraph, ecmpAddressing, ecmpRouting, ecmpPolicy);
const l3a = traceBuilderForwarding(ecmpGraph, ecmpAddressing, ecmpRouting, 'client', 'app', ecmpGraph, {protocol:'tcp',sourceAddress:'10.0.0.1',destinationAddress:'10.0.0.6',sourcePort:40000,destinationPort:443});
const l3b = traceBuilderForwarding(ecmpGraph, ecmpAddressing, ecmpRouting, 'client', 'app', ecmpGraph, {protocol:'tcp',sourceAddress:'10.0.0.1',destinationAddress:'10.0.0.6',sourcePort:40001,destinationPort:443});
const l3EdgeA=l3a.hops.find((hop)=>hop.nodeId==='edge'),l3EdgeB=l3b.hops.find((hop)=>hop.nodeId==='edge');
assert.equal(l3EdgeA?.ecmpCandidateCount,2);assert.equal(l3EdgeA?.ecmpSelectedIndex,l3EdgeB?.ecmpSelectedIndex,'L3 hash mode must ignore source-port changes');
ecmpPolicy = upsertBuilderEcmpProfile(ecmpRouting.policy, { routerId:'edge',hashMode:'l4',maxPaths:2 });
ecmpRouting = setBuilderRoutingPolicyConfig(ecmpGraph, ecmpAddressing, ecmpRouting, ecmpPolicy);
const firstL4 = traceBuilderForwarding(ecmpGraph, ecmpAddressing, ecmpRouting, 'client', 'app', ecmpGraph, {protocol:'tcp',sourceAddress:'10.0.0.1',destinationAddress:'10.0.0.6',sourcePort:40000,destinationPort:443}).hops.find((hop)=>hop.nodeId==='edge');
let l4Different = false;
for(let port=40001;port<40150;port+=1){const hop=traceBuilderForwarding(ecmpGraph,ecmpAddressing,ecmpRouting,'client','app',ecmpGraph,{protocol:'tcp',sourceAddress:'10.0.0.1',destinationAddress:'10.0.0.6',sourcePort:port,destinationPort:443}).hops.find((entry)=>entry.nodeId==='edge');if(hop?.ecmpSelectedIndex!==firstL4?.ecmpSelectedIndex){l4Different=true;break;}}
assert.equal(l4Different,true,'L4 hash mode must allow transport ports to affect equal-best path selection');

// Summaries install an explicit low-preference discard aggregate while more-specific native routes remain preferred.
let summaryRouting = setBuilderOspfEverywhere(graph,addressing,createDefaultBuilderRoutingConfig(),true);
let summaryPolicy=upsertBuilderRouteSummary(summaryRouting.policy,{id:'core-summary',routerId:'core',source:'connected',prefix:'10.0.0.0/24',advertiseInto:'none',metric:10,discard:true,description:'intentional aggregate'});
summaryRouting=setBuilderRoutingPolicyConfig(graph,addressing,summaryRouting,summaryPolicy);
const coreTable=routeTableForBuilderRouter(graph,addressing,summaryRouting,'core');
const aggregate=selectBuilderRoute(coreTable,'10.0.0.200');
assert.equal(aggregate?.source,'summary');assert.equal(aggregate?.summaryDiscard,true);assert.equal(aggregate?.administrativeDistance,254);assert.equal(aggregate?.outgoingInterface,'Null0');
assert.notEqual(selectBuilderRoute(coreTable,'10.0.0.6')?.source,'summary','more-specific connected route must beat the discard aggregate');

// OSPF timer mismatch removes only the OSPF adjacency/control edge; the physical Builder link stays up.
let timerRouting=setBuilderOspfEverywhere(graph,addressing,createDefaultBuilderRoutingConfig(),true);
let timerPolicy=upsertBuilderOspfTimer(timerRouting.policy,{id:'edge-r1-timer',routerId:'edge',linkId:'edge-r1',helloIntervalMs:5000,deadIntervalMs:20000});
timerRouting=setBuilderRoutingPolicyConfig(graph,addressing,timerRouting,timerPolicy);
assert.equal(graph.links.find((link)=>link.id==='edge-r1')?.failed,false);
const timerState=builderOspfState(graph,addressing,timerRouting);
const timerAdj=timerState.adjacencies.find((entry)=>entry.linkId==='edge-r1');
assert.equal(timerAdj?.state,'DOWN');assert.equal(timerAdj?.reason,'HELLO/DEAD TIMER MISMATCH');
const timerTrace=traceBuilderForwarding(graph,addressing,timerRouting,'client','app');
assert.equal(timerTrace.reachable,true);assert.ok(timerTrace.hops.some((hop)=>hop.nodeId==='r2'),'OSPF should reconverge over the still-valid alternate control path');

// Bounded IS-IS is another control plane over the same graph/addressing/link costs and contributes to the same RIB/FIB.
let isisRouting=createDefaultBuilderRoutingConfig();let isisPolicy=cloneBuilderRoutingPolicyConfig(isisRouting.policy);
for(const routerId of ['edge','r1','r2','core'])isisPolicy=upsertBuilderIsisRouter(isisPolicy,{routerId,enabled:true,areaId:'49.0001',level:'L2'});
isisRouting=setBuilderRoutingPolicyConfig(graph,addressing,isisRouting,isisPolicy);
const isisState=builderIsisState(graph,addressing,isisRouting.policy.isis);
assert.equal(isisState.enabledRouterIds.length,4);assert.ok(isisState.adjacencies.some((entry)=>entry.linkId==='edge-r1'&&entry.state==='UP'));
const isisRoute=routeTableForBuilderRouter(graph,addressing,isisRouting,'edge').find((entry)=>entry.source==='isis'&&entry.prefix===addressing.segments['core-app'].cidr);
assert.ok(isisRoute);assert.equal(isisRoute.administrativeDistance,115);
const isisTrace=traceBuilderForwarding(graph,addressing,isisRouting,'client','app');
assert.equal(isisTrace.reachable,true);assert.ok(isisTrace.hops.some((hop)=>hop.routeSource==='isis'));

// BGP route reflection extends the existing iBGP engine instead of bypassing split horizon.
const rrGraph={nodes:[{id:'r1',label:'R1',kind:'router'},{id:'r2',label:'R2',kind:'router'},{id:'r3',label:'R3',kind:'router'}],links:[{id:'r1-r2',a:'r1',b:'r2',cost:10,failed:false},{id:'r2-r3',a:'r2',b:'r3',cost:10,failed:false}]};
const rrAddressing=createDefaultBuilderAddressing(rrGraph);let rrBgp=createDefaultBuilderBgpConfig();
for(const id of ['r1','r2','r3'])rrBgp=setBuilderBgpRouterAsn(rrGraph,rrBgp,id,64500);
rrBgp=upsertBuilderBgpSession(rrGraph,rrBgp,'r1-r2','peer');rrBgp=upsertBuilderBgpSession(rrGraph,rrBgp,'r2-r3','peer');rrBgp=upsertBuilderBgpOrigin(rrGraph,rrBgp,{routerId:'r1',prefix:'203.0.113.0/24',med:0,communities:[],description:'RR test'});
let rrState=builderBgpState(rrGraph,rrAddressing,rrBgp);assert.equal(rrState.bestRoutes.some((route)=>route.routerId==='r3'&&route.prefix==='203.0.113.0/24'),false,'plain iBGP split horizon must remain the default');
const r12=rrBgp.sessions.find((entry)=>entry.linkId==='r1-r2'),r23=rrBgp.sessions.find((entry)=>entry.linkId==='r2-r3');assert.ok(r12&&r23);
rrBgp=updateBuilderBgpSession(rrGraph,rrBgp,r12.id,{routeReflectorClientRouterId:'r1'});rrBgp=updateBuilderBgpSession(rrGraph,rrBgp,r23.id,{routeReflectorClientRouterId:'r3'});rrState=builderBgpState(rrGraph,rrAddressing,rrBgp);
assert.equal(rrState.bestRoutes.some((route)=>route.routerId==='r3'&&route.prefix==='203.0.113.0/24'),true,'route reflector must make client-to-client iBGP propagation explicit');

// Community matching/removal, well-known export scope, AS prepend, and hold-timer withdrawal all stay in the canonical BGP state engine.
const bgpGraph={nodes:[{id:'a',label:'A',kind:'router'},{id:'b',label:'B',kind:'router'}],links:[{id:'a-b',a:'a',b:'b',cost:10,failed:false}]};
const bgpAddressing=createDefaultBuilderAddressing(bgpGraph);let bgp=createDefaultBuilderBgpConfig();bgp=setBuilderBgpRouterAsn(bgpGraph,bgp,'a',64501);bgp=setBuilderBgpRouterAsn(bgpGraph,bgp,'b',64502);bgp=upsertBuilderBgpSession(bgpGraph,bgp,'a-b','peer');const ab=bgp.sessions.find((entry)=>entry.linkId==='a-b');assert.ok(ab);
bgp=upsertBuilderBgpOrigin(bgpGraph,bgp,{routerId:'a',prefix:'198.51.100.0/24',med:0,communities:['64501:100'],description:'community policy'});
bgp=upsertBuilderBgpPolicy(bgpGraph,bgp,{routerId:'a',direction:'export',sessionId:ab.id,order:10,action:'permit',prefix:'198.51.100.0/24',setLocalPref:null,setMed:null,addCommunity:'64501:200',matchCommunity:'64501:100',removeCommunity:'64501:100',prependAsCount:2,allowRelationshipLeak:false,description:'community + prepend'});
let bgpState=builderBgpState(bgpGraph,bgpAddressing,bgp);const bRoute=bgpState.bestRoutes.find((route)=>route.routerId==='b'&&route.prefix==='198.51.100.0/24');assert.ok(bRoute);assert.ok(bRoute.communities.includes('64501:200'));assert.equal(bRoute.communities.includes('64501:100'),false);assert.ok(bRoute.asPath.filter((asn)=>asn===64501).length>=3,'export AS prepend must add deterministic sender-AS copies before normal eBGP prepend');
let noExport=upsertBuilderBgpOrigin(bgpGraph,bgp,{routerId:'a',prefix:'192.0.2.0/24',med:0,communities:['NO_EXPORT'],description:'well-known'});assert.equal(builderBgpState(bgpGraph,bgpAddressing,noExport).bestRoutes.some((route)=>route.routerId==='b'&&route.prefix==='192.0.2.0/24'),false,'NO_EXPORT must not cross eBGP');
const withdrawal=createBuilderBgpWithdrawalScenario(bgpGraph,bgpAddressing,bgp,ab.id);const before=snapshotBuilderBgpWithdrawal(withdrawal,withdrawal.holdTimeMs-1),after=snapshotBuilderBgpWithdrawal(withdrawal,withdrawal.holdTimeMs);assert.equal(before.stale,true);assert.equal(after.stale,false);assert.ok(after.visibleEvents.some((event)=>event.kind==='ROUTE_WITHDRAWN'));

// Product wiring stays lazy because Track E left essentially no startup budget headroom.
const networkBuilder=readFileSync('src/NetworkBuilder.tsx','utf8');const panel=readFileSync('src/BuilderRoutingPolicyPanel.tsx','utf8');const bgpPanel=readFileSync('src/BuilderBgpPanel.tsx','utf8');const timingPanel=readFileSync('src/BuilderOspfTimingPanel.tsx','utf8');
assert.match(networkBuilder,/lazy\(\(\)=>import\('\.\/BuilderRoutingPolicyPanel\.tsx'\)/);assert.match(networkBuilder,/lazy\(\(\)=>import\('\.\/BuilderBgpPanel\.tsx'\)/);assert.doesNotMatch(networkBuilder,/^import \{ BuilderBgpPanel \}/m);assert.match(panel,/FIB STAYS VISIBLE/);assert.match(panel,/REDISTRIBUTION CONSUMES ONLY NATIVE PROTOCOL ROUTES/);assert.match(bgpPanel,/ROUTE REFLECTOR CLIENT/);assert.match(bgpPanel,/WITHDRAWAL TIMING/);assert.match(timingPanel,/CONFIGURED INTERFACE TIMERS DRIVE FAILURE DETECTION/);

console.log('Track F routing-policy contract passed: native-route redistribution provenance + loop hazards, PBR/FIB separation, configurable ECMP hashing, summary discard, OSPF timer control-plane separation, bounded IS-IS, BGP route reflection/community scope/prepend/withdrawal timing, and lazy product integration.');

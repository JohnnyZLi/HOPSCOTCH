import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere, traceBuilderForwarding } from '../src/builder/routing.ts';
import { createBuilderOspfLinkFailureScenario, DEFAULT_BUILDER_OSPF_TIMING, snapshotBuilderOspfConvergence, validateBuilderOspfTimingProfile } from '../src/builder/ospf-timing.ts';

const graph=cloneBuilderGraph(defaultBuilderGraph);
const addressing=createDefaultBuilderAddressing(graph);
let routing=createDefaultBuilderRoutingConfig();
routing=setBuilderOspfEverywhere(graph,addressing,routing,true);
const baseline=traceBuilderForwarding(graph,addressing,routing,'client','app');
assert.equal(baseline.reachable,true,'OSPF baseline must reach APP before the failure');
assert.ok(baseline.hops.some((hop)=>hop.nextNodeId==='r1'),'default SPF path should prefer R1 before failure');

const scenario=createBuilderOspfLinkFailureScenario(graph,addressing,routing,'client','app','edge-r1');
assert.equal(scenario.deadAtMs,DEFAULT_BUILDER_OSPF_TIMING.deadIntervalMs);
assert.ok(scenario.deadAtMs<scenario.spfCompleteAtMs);
assert.ok(scenario.spfCompleteAtMs<scenario.ribInstallAtMs);
assert.ok(scenario.ribInstallAtMs<scenario.fibInstallAtMs);
assert.deepEqual(scenario.events.map((event)=>event.kind),['LINK_DOWN','HELLO_MISSED','DEAD_TIMER_EXPIRED','ADJACENCY_DOWN','LSA_ORIGINATED','LSA_FLOODED','SPF_SCHEDULED','SPF_COMPLETE','RIB_UPDATED','FIB_UPDATED','TRAFFIC_RECOVERED']);

const immediate=snapshotBuilderOspfConvergence(scenario,0);
assert.equal(immediate.controlUsesFailedTopology,false,'neighbor remains logically FULL until dead timer');
assert.equal(immediate.fibUsesFailedTopology,false);
assert.equal(immediate.fibTrace.reachable,false,'physical link is down while the old FIB still points at it');
assert.match(immediate.fibTrace.failureReason ?? '',/LINK DOWN/i);
assert.equal(immediate.controlState.adjacencies.find((adj)=>adj.linkId==='edge-r1')?.state,'FULL');

const beforeDead=snapshotBuilderOspfConvergence(scenario,scenario.deadAtMs-1);
assert.equal(beforeDead.controlState.adjacencies.find((adj)=>adj.linkId==='edge-r1')?.state,'FULL');
const dead=snapshotBuilderOspfConvergence(scenario,scenario.deadAtMs);
assert.equal(dead.controlUsesFailedTopology,true);
assert.equal(dead.controlState.adjacencies.find((adj)=>adj.linkId==='edge-r1')?.state,'DOWN');
assert.equal(dead.fibTrace.reachable,false,'adjacency loss does not instantly rewrite forwarding state');

const rib=snapshotBuilderOspfConvergence(scenario,scenario.ribInstallAtMs);
assert.equal(rib.ribUsesFailedTopology,true);
assert.equal(rib.fibUsesFailedTopology,false);
assert.equal(rib.fibTrace.reachable,false,'RIB convergence precedes FIB programming');

const recovered=snapshotBuilderOspfConvergence(scenario,scenario.fibInstallAtMs);
assert.equal(recovered.fibUsesFailedTopology,true);
assert.equal(recovered.fibTrace.reachable,true,'traffic recovers only after the FIB consumes the new topology');
assert.ok(recovered.fibTrace.hops.some((hop)=>hop.nextNodeId==='r2'),'reconverged forwarding must use R2 after edge-r1 fails');
assert.equal(recovered.visibleEvents.at(-1)?.kind,'TRAFFIC_RECOVERED');

assert.throws(()=>createBuilderOspfLinkFailureScenario(graph,addressing,routing,'client','app','client-edge'),/router-router/i);
assert.throws(()=>validateBuilderOspfTimingProfile({...DEFAULT_BUILDER_OSPF_TIMING,deadIntervalMs:1000,helloIntervalMs:2000}),/dead interval/i);
console.log('Builder OSPF timing contract passed: physical failure, stale FULL state, dead timer, LSA/SPF, distinct RIB/FIB install, and R2 traffic recovery.');

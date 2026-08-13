import assert from 'node:assert/strict';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import {
  builderEcmpRoutesForDestination,
  createDefaultBuilderRoutingConfig,
  routeTableForBuilderRouter,
  selectBuilderRouteWithDecision,
  setBuilderOspfEverywhere,
  traceBuilderForwarding,
  upsertBuilderStaticRoute,
} from '../src/builder/routing.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
for (const link of graph.links) {
  if (link.id === 'edge-r2' || link.id === 'r2-core') link.cost = 10;
}
const addressing = createDefaultBuilderAddressing(graph);
let routing = setBuilderOspfEverywhere(graph, addressing, createDefaultBuilderRoutingConfig(), true);
const appInterface = interfacesForBuilderNode(addressing, 'app')[0];
assert.ok(appInterface, 'APP must have an IPv4 interface');
const appPrefix = addressing.segments[appInterface.linkId].cidr;
const appAddress = appInterface.address;

const edgeTable = routeTableForBuilderRouter(graph, addressing, routing, 'edge');
const ecmp = builderEcmpRoutesForDestination(edgeTable, appAddress);
assert.equal(ecmp.length, 2, 'equal EDGE→R1→CORE and EDGE→R2→CORE paths must install two equal OSPF next hops');
assert.deepEqual(new Set(ecmp.map((entry) => entry.linkId)), new Set(['edge-r1', 'edge-r2']));
assert.ok(ecmp.every((entry) => entry.source === 'ospf' && entry.prefix === appPrefix && entry.administrativeDistance === 110));
assert.equal(new Set(ecmp.map((entry) => entry.metric)).size, 1, 'ECMP members must have identical metric');
assert.ok(ecmp.every((entry) => entry.stateNote.includes('ECMP 2-WAY')));

const observed = new Map();
for (let index = 0; index < 256 && observed.size < 2; index += 1) {
  const key = `tcp|client|app|${49152 + index}|443`;
  const decision = selectBuilderRouteWithDecision(edgeTable, appAddress, key);
  assert.equal(decision.candidates.length, 2);
  assert.ok(decision.route);
  assert.ok(decision.flowHash != null);
  observed.set(decision.route.linkId, key);
  const repeated = selectBuilderRouteWithDecision(edgeTable, appAddress, key);
  assert.equal(repeated.route?.id, decision.route.id, 'same flow key must stay pinned to the same ECMP member');
  assert.equal(repeated.flowHash, decision.flowHash);
}
assert.deepEqual(new Set(observed.keys()), new Set(['edge-r1', 'edge-r2']), 'bounded deterministic sample must exercise both ECMP members');

for (const [linkId, key] of observed) {
  const trace = traceBuilderForwarding(graph, addressing, routing, 'client', 'app', graph, key);
  assert.equal(trace.reachable, true);
  const nodes = [trace.sourceNodeId, ...trace.hops.map((hop) => hop.nextNodeId).filter(Boolean)];
  assert.ok(nodes.includes(linkId === 'edge-r1' ? 'r1' : 'r2'));
  const edgeHop = trace.hops.find((hop) => hop.nodeId === 'edge');
  assert.equal(edgeHop?.ecmpCandidateCount, 2);
  assert.equal(edgeHop?.linkId, linkId);
  assert.ok(edgeHop?.ecmpFlowHash != null);
}

const reversed = cloneBuilderGraph(graph);
reversed.links.reverse();
for (const [linkId, key] of observed) {
  const original = traceBuilderForwarding(graph, addressing, routing, 'client', 'app', graph, key);
  const reordered = traceBuilderForwarding(reversed, addressing, routing, 'client', 'app', reversed, key);
  assert.equal(reordered.hops.find((hop) => hop.nodeId === 'edge')?.linkId, original.hops.find((hop) => hop.nodeId === 'edge')?.linkId, 'link-array order must not change flow hashing');
}

const failed = cloneBuilderGraph(graph);
failed.links.find((link) => link.id === 'edge-r1').failed = true;
const failedTable = routeTableForBuilderRouter(failed, addressing, routing, 'edge');
const survivors = builderEcmpRoutesForDestination(failedTable, appAddress);
assert.equal(survivors.length, 1);
assert.equal(survivors[0].linkId, 'edge-r2');
for (const key of observed.values()) {
  const trace = traceBuilderForwarding(failed, addressing, routing, 'client', 'app', failed, key);
  assert.equal(trace.reachable, true);
  assert.equal(trace.hops.find((hop) => hop.nodeId === 'edge')?.linkId, 'edge-r2', 'all flows must converge onto the surviving member after OSPF recomputation');
}

const r1Address = addressing.segments['edge-r1'].interfaces.find((entry) => entry.nodeId === 'r1')?.address;
assert.ok(r1Address);
routing = upsertBuilderStaticRoute(graph, addressing, routing, { routerId: 'edge', prefix: appPrefix, nextHop: r1Address, metric: 1 });
const staticTable = routeTableForBuilderRouter(graph, addressing, routing, 'edge');
const staticWinner = selectBuilderRouteWithDecision(staticTable, appAddress, observed.values().next().value ?? 'flow').route;
assert.equal(staticWinner?.source, 'static', 'AD 1 static route must outrank the OSPF ECMP set');
assert.equal(staticWinner?.linkId, 'edge-r1');

console.log('Builder OSPF ECMP contract passed: equal-cost next-hop installation, deterministic per-flow hashing, stable ordering, member failure convergence, and static-route AD precedence.');

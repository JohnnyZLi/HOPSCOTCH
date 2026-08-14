import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderIpv6Config, routeTableForBuilderIpv6Router, setBuilderOspfv3Everywhere, traceBuilderIpv6Forwarding } from '../src/builder/ipv6.ts';
import {
  advanceBuilderOspfv3Depth,
  builderOspfv3DepthRouteOverlay,
  builderOspfv3DepthSummary,
  createDefaultBuilderIpv6RoutingDepthState,
  evaluateBuilderIpv6TracePolicy,
  reconcileBuilderIpv6RoutingDepthState,
  setBuilderOspfv3LinkArea,
  upsertBuilderIpv6PolicyRule,
} from '../src/builder/ipv6-routing-depth.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
const ipv4 = createDefaultBuilderAddressing(graph);
const ipv6 = setBuilderOspfv3Everywhere(graph, ipv4, createDefaultBuilderIpv6Config(graph, ipv4), true);
let depth = createDefaultBuilderIpv6RoutingDepthState(graph);

// Build a deterministic Area 0 backbone with a nonzero edge/stub area.
const edgeRouter = graph.nodes.find((node) => node.id === 'edge') ?? graph.nodes.find((node) => node.kind === 'router');
assert.ok(edgeRouter);
const edgeStub = graph.links.find((link) => [link.a, link.b].includes(edgeRouter.id) && graph.nodes.find((node) => node.id === (link.a === edgeRouter.id ? link.b : link.a))?.kind === 'endpoint');
assert.ok(edgeStub);
depth = setBuilderOspfv3LinkArea(graph, depth, edgeStub.id, 10);
const summary = builderOspfv3DepthSummary(graph, ipv6, depth);
assert.ok((summary.routerAreas[edgeRouter.id] ?? []).includes(0));
assert.ok((summary.routerAreas[edgeRouter.id] ?? []).includes(10));
assert.ok(summary.abrRouterIds.includes(edgeRouter.id));
const overlay = builderOspfv3DepthRouteOverlay(graph, ipv6, depth);
const remoteRouter = graph.nodes.find((node) => node.kind === 'router' && node.id !== edgeRouter.id);
assert.ok(remoteRouter);
const interArea = overlay[remoteRouter.id]?.find((route) => route.prefix === ipv6.addressing.segments[edgeStub.id].prefix);
assert.ok(interArea, 'remote router should learn Area 10 prefix through Area 0');
assert.match(interArea.stateNote, /O6 IA/);

// Physical failure precedes control-plane knowledge and FIB replacement.
const failLink = graph.links.find((link) => link.id === 'edge-r1') ?? graph.links.find((link) => graph.nodes.find((node) => node.id === link.a)?.kind === 'router' && graph.nodes.find((node) => node.id === link.b)?.kind === 'router');
assert.ok(failLink);
const failedGraph = cloneBuilderGraph(graph);
failedGraph.links.find((link) => link.id === failLink.id).failed = true;
depth = reconcileBuilderIpv6RoutingDepthState(failedGraph, depth);
let timed = builderOspfv3DepthSummary(failedGraph, ipv6, depth).adjacencies.find((entry) => entry.linkId === failLink.id);
assert.equal(timed?.phase, 'STALE FULL');
let staleOverlay = builderOspfv3DepthRouteOverlay(failedGraph, ipv6, depth);
const staleRoute = staleOverlay[edgeRouter.id]?.find((route) => route.linkId === failLink.id);
assert.ok(staleRoute || Object.values(staleOverlay).flat().some((route) => route.linkId === failLink.id), 'at least one stale OSPFv3 route should still point at failed link before dead/FIB timing');
depth = advanceBuilderOspfv3Depth(failedGraph, depth, 41_000);
timed = builderOspfv3DepthSummary(failedGraph, ipv6, depth).adjacencies.find((entry) => entry.linkId === failLink.id);
assert.equal(timed?.phase, 'DOWN');
depth = advanceBuilderOspfv3Depth(failedGraph, depth, 1_000);
const convergedOverlay = builderOspfv3DepthRouteOverlay(failedGraph, ipv6, depth);
assert.ok(!Object.values(convergedOverlay).flat().some((route) => route.linkId === failLink.id), 'after FIB timing no OSPFv3 route may use the failed link');

// IPv6 policy independently denies forward and reverse ICMPv6 directions.
const endpoints = graph.nodes.filter((node) => node.kind === 'endpoint');
assert.ok(endpoints.length >= 2);
const source = endpoints[0], destination = endpoints[1];
const trace = traceBuilderIpv6Forwarding(graph, ipv6, source.id, destination.id, overlay);
assert.equal(trace.reachable, true);
const routerHop = trace.hops.find((hop) => graph.nodes.find((node) => node.id === hop.nodeId)?.kind === 'router');
assert.ok(routerHop);
const sourceAddress = trace.sourceAddress, destinationAddress = trace.destinationAddress;
assert.ok(sourceAddress && destinationAddress);
depth = upsertBuilderIpv6PolicyRule(graph, depth, { routerId: routerHop.nodeId, order: 10, action: 'deny', sourcePrefix: `${sourceAddress}/128`, destinationPrefix: `${destinationAddress}/128`, icmpType: 'echo-request', description: 'contract forward deny' });
const forwardDeny = evaluateBuilderIpv6TracePolicy(graph, ipv6, trace, depth.policy, 'echo-request');
assert.equal(forwardDeny?.action, 'deny');
const reverse = traceBuilderIpv6Forwarding(graph, ipv6, destination.id, source.id, overlay);
assert.equal(evaluateBuilderIpv6TracePolicy(graph, ipv6, reverse, depth.policy, 'echo-reply'), null, 'echo-reply remains permitted until separately denied');
depth = upsertBuilderIpv6PolicyRule(graph, depth, { routerId: reverse.hops.find((hop) => graph.nodes.find((node) => node.id === hop.nodeId)?.kind === 'router')?.nodeId ?? routerHop.nodeId, order: 20, action: 'deny', sourcePrefix: `${destinationAddress}/128`, destinationPrefix: `${sourceAddress}/128`, icmpType: 'echo-reply', description: 'contract reverse deny' });
assert.equal(evaluateBuilderIpv6TracePolicy(graph, ipv6, reverse, depth.policy, 'echo-reply')?.action, 'deny');

console.log('Builder advanced OSPFv3/policy contract passed: ABR/Area 0 inter-area O6 IA, timed stale→FIB convergence, and independent ICMPv6 policy directions.');

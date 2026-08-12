import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph, findShortestPath } from '../src/builder/model.ts';
import {
  createDefaultBuilderRoutingConfig,
  deleteBuilderStaticRoute,
  installStaticRoutesForWeightedPath,
  nextHopOptionsForBuilderRouter,
  reconcileBuilderRoutingConfig,
  routeTableForBuilderRouter,
  selectBuilderRoute,
  traceBuilderForwarding,
  upsertBuilderStaticRoute,
  validateBuilderRoutingConfig,
} from '../src/builder/routing.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
const addressing = createDefaultBuilderAddressing(graph);
const emptyRouting = createDefaultBuilderRoutingConfig();
const weighted = findShortestPath(graph, 'client', 'app');
assert.deepEqual(weighted.nodeIds, ['client', 'edge', 'r1', 'core', 'app']);
assert.equal(weighted.totalCost, 22);

const emptyTrace = traceBuilderForwarding(graph, addressing, emptyRouting, 'client', 'app');
assert.equal(emptyTrace.reachable, false, 'physical graph reachability must not fabricate an IP route');
assert.equal(emptyTrace.failureNodeId, 'edge');
assert.equal(emptyTrace.failureReason, 'NO MATCHING ROUTE');
assert.deepEqual(emptyTrace.hops.map((hop) => hop.nodeId), ['client']);
assert.equal(emptyTrace.hops[0].routeSource, 'default-gateway');
assert.equal(emptyTrace.hops[0].nextHop, '10.0.0.2');

const installed = installStaticRoutesForWeightedPath(graph, addressing, emptyRouting, 'client', 'app');
assert.equal(installed.prefix, '10.0.0.4/30');
assert.deepEqual(installed.installedRouterIds, ['edge', 'r1']);
assert.deepEqual(installed.weightedPathNodeIds, weighted.nodeIds);
assert.equal(installed.routing.staticRoutes.length, 2);
assert.deepEqual(installed.routing.staticRoutes.map((route) => [route.routerId, route.prefix, route.nextHop, route.metric]), [
  ['edge', '10.0.0.4/30', '10.0.0.10', 10],
  ['r1', '10.0.0.4/30', '10.0.0.18', 10],
]);

const routedTrace = traceBuilderForwarding(graph, addressing, installed.routing, 'client', 'app');
assert.equal(routedTrace.reachable, true);
assert.deepEqual(routedTrace.hops.map((hop) => hop.nodeId), ['client', 'edge', 'r1', 'core']);
assert.deepEqual(routedTrace.hops.map((hop) => hop.routeSource), ['default-gateway', 'static', 'static', 'connected']);
assert.deepEqual(routedTrace.hops.map((hop) => hop.nextHop), ['10.0.0.2', '10.0.0.10', '10.0.0.18', '10.0.0.6']);

const edgeTable = routeTableForBuilderRouter(graph, addressing, installed.routing, 'edge');
const appRoute = selectBuilderRoute(edgeTable, '10.0.0.6');
assert.equal(appRoute?.source, 'static');
assert.equal(appRoute?.prefix, '10.0.0.4/30');
assert.equal(appRoute?.nextHop, '10.0.0.10');
assert.equal(appRoute?.administrativeDistance, 1);
assert.equal(appRoute?.metric, 10);

const connectedWins = upsertBuilderStaticRoute(graph, addressing, installed.routing, {
  routerId: 'edge',
  prefix: '10.0.0.0/30',
  nextHop: '10.0.0.10',
  metric: 1,
});
const clientSubnetSelection = selectBuilderRoute(routeTableForBuilderRouter(graph, addressing, connectedWins, 'edge'), '10.0.0.1');
assert.equal(clientSubnetSelection?.source, 'connected', 'connected AD 0 must beat static AD 1 at the same prefix length');

const defaultOnly = upsertBuilderStaticRoute(graph, addressing, emptyRouting, {
  routerId: 'edge', prefix: '0.0.0.0/0', nextHop: '10.0.0.14', metric: 1,
});
const withSpecific = upsertBuilderStaticRoute(graph, addressing, defaultOnly, {
  routerId: 'edge', prefix: '10.0.0.4/30', nextHop: '10.0.0.10', metric: 999,
});
assert.equal(selectBuilderRoute(routeTableForBuilderRouter(graph, addressing, withSpecific, 'edge'), '10.0.0.6')?.nextHop, '10.0.0.10', 'longest prefix must beat lower metric default route');

assert.deepEqual(nextHopOptionsForBuilderRouter(graph, addressing, 'edge').map((option) => option.address), ['10.0.0.1', '10.0.0.10', '10.0.0.14']);
assert.throws(
  () => upsertBuilderStaticRoute(graph, addressing, emptyRouting, { routerId: 'edge', prefix: '203.0.113.0/24', nextHop: '203.0.113.1', metric: 1 }),
  /directly connected neighbor/,
);
assert.throws(
  () => upsertBuilderStaticRoute(graph, addressing, emptyRouting, { routerId: 'client', prefix: '0.0.0.0/0', nextHop: '10.0.0.2', metric: 1 }),
  /router node/,
);
assert.throws(
  () => upsertBuilderStaticRoute(graph, addressing, emptyRouting, { routerId: 'edge', prefix: '10.0.0.0/33', nextHop: '10.0.0.10', metric: 1 }),
  /\/0 through \/32/,
);

const failedGraph = cloneBuilderGraph(graph);
failedGraph.links = failedGraph.links.map((link) => link.id === 'edge-r1' ? { ...link, failed: true } : link);
const alternateWeighted = findShortestPath(failedGraph, 'client', 'app');
assert.deepEqual(alternateWeighted.nodeIds, ['client', 'edge', 'r2', 'core', 'app']);
assert.equal(alternateWeighted.totalCost, 52);
const failedStaticTrace = traceBuilderForwarding(failedGraph, addressing, installed.routing, 'client', 'app');
assert.equal(failedStaticTrace.reachable, false, 'static routes must not silently reconverge onto the weighted alternate');
assert.equal(failedStaticTrace.failureNodeId, 'edge');
assert.equal(failedStaticTrace.failureReason, 'NO MATCHING ROUTE');
const inactiveEdgeStatic = routeTableForBuilderRouter(failedGraph, addressing, installed.routing, 'edge').find((route) => route.source === 'static' && route.prefix === '10.0.0.4/30');
assert.equal(inactiveEdgeStatic?.active, false);
assert.equal(inactiveEdgeStatic?.stateNote, 'NEXT-HOP LINK DOWN');

const reinstalled = installStaticRoutesForWeightedPath(failedGraph, addressing, installed.routing, 'client', 'app');
assert.deepEqual(reinstalled.installedRouterIds, ['edge', 'r2']);
assert.equal(reinstalled.routing.staticRoutes.find((route) => route.routerId === 'edge' && route.prefix === '10.0.0.4/30')?.nextHop, '10.0.0.14');
assert.equal(reinstalled.routing.staticRoutes.find((route) => route.routerId === 'r2' && route.prefix === '10.0.0.4/30')?.nextHop, '10.0.0.26');
const restoredTrace = traceBuilderForwarding(failedGraph, addressing, reinstalled.routing, 'client', 'app');
assert.equal(restoredTrace.reachable, true);
assert.deepEqual(restoredTrace.hops.map((hop) => hop.nodeId), ['client', 'edge', 'r2', 'core']);

const loopRouting = upsertBuilderStaticRoute(graph, addressing, emptyRouting, { routerId: 'edge', prefix: '10.0.0.4/30', nextHop: '10.0.0.10', metric: 1 });
const loopRouting2 = upsertBuilderStaticRoute(graph, addressing, loopRouting, { routerId: 'r1', prefix: '10.0.0.4/30', nextHop: '10.0.0.9', metric: 1 });
const loopTrace = traceBuilderForwarding(graph, addressing, loopRouting2, 'client', 'app');
assert.equal(loopTrace.reachable, false);
assert.equal(loopTrace.failureReason, 'FORWARDING LOOP');

const removed = deleteBuilderStaticRoute(graph, addressing, installed.routing, installed.routing.staticRoutes[0].id);
assert.equal(removed.staticRoutes.length, 1);
const reconciled = reconcileBuilderRoutingConfig(graph, addressing, installed.routing);
assert.deepEqual(reconciled, validateBuilderRoutingConfig(graph, addressing, installed.routing));

console.log('Builder static-routing contract passed: graph path != IP forwarding, connected/static LPM selection, explicit static installation, link-down non-convergence, reroute, and loop detection.');

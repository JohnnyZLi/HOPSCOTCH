import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph, defaultBuilderLayout, findShortestPath } from '../src/builder/model.ts';
import {
  builderOspfState,
  createDefaultBuilderRoutingConfig,
  routeTableForBuilderRouter,
  selectBuilderRoute,
  setBuilderOspfEverywhere,
  setBuilderOspfRouterEnabled,
  traceBuilderForwarding,
  upsertBuilderStaticRoute,
} from '../src/builder/routing.ts';
import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
const addressing = createDefaultBuilderAddressing(graph);
const baseRouting = createDefaultBuilderRoutingConfig();
const weighted = findShortestPath(graph, 'client', 'app');
assert.deepEqual(weighted.nodeIds, ['client', 'edge', 'r1', 'core', 'app']);
assert.equal(weighted.totalCost, 22);
assert.equal(traceBuilderForwarding(graph, addressing, baseRouting, 'client', 'app').failureReason, 'NO MATCHING ROUTE');

const ospfRouting = setBuilderOspfEverywhere(graph, addressing, baseRouting, true);
assert.deepEqual(ospfRouting.ospf.enabledRouterIds, ['core', 'edge', 'r1', 'r2']);
const ospf = builderOspfState(graph, addressing, ospfRouting);
assert.equal(ospf.areaId, '0.0.0.0');
assert.equal(ospf.fullAdjacencyCount, 5);
assert.equal(ospf.downAdjacencyCount, 0);
assert.equal(ospf.components.length, 1);
assert.deepEqual(ospf.components[0], ['core', 'edge', 'r1', 'r2']);
assert.ok(ospf.advertisements.some((entry) => entry.routerId === 'core' && entry.prefix === '10.0.0.4/30'));

const edgeAppRoute = selectBuilderRoute(routeTableForBuilderRouter(graph, addressing, ospfRouting, 'edge'), '10.0.0.6');
assert.equal(edgeAppRoute?.source, 'ospf');
assert.equal(edgeAppRoute?.prefix, '10.0.0.4/30');
assert.equal(edgeAppRoute?.nextHop, '10.0.0.10');
assert.equal(edgeAppRoute?.administrativeDistance, 110);
assert.equal(edgeAppRoute?.metric, 21);

const ospfTrace = traceBuilderForwarding(graph, addressing, ospfRouting, 'client', 'app');
assert.equal(ospfTrace.reachable, true);
assert.deepEqual(ospfTrace.hops.map((hop) => hop.nodeId), ['client', 'edge', 'r1', 'core']);
assert.deepEqual(ospfTrace.hops.map((hop) => hop.routeSource), ['default-gateway', 'ospf', 'ospf', 'connected']);

const failedGraph = cloneBuilderGraph(graph);
failedGraph.links = failedGraph.links.map((link) => link.id === 'edge-r1' ? { ...link, failed: true } : link);
const failedWeighted = findShortestPath(failedGraph, 'client', 'app');
assert.deepEqual(failedWeighted.nodeIds, ['client', 'edge', 'r2', 'core', 'app']);
assert.equal(failedWeighted.totalCost, 52);
const failedState = builderOspfState(failedGraph, addressing, ospfRouting);
assert.equal(failedState.fullAdjacencyCount, 4);
assert.equal(failedState.downAdjacencyCount, 1);
const failedEdgeRoute = selectBuilderRoute(routeTableForBuilderRouter(failedGraph, addressing, ospfRouting, 'edge'), '10.0.0.6');
assert.equal(failedEdgeRoute?.source, 'ospf');
assert.equal(failedEdgeRoute?.nextHop, '10.0.0.14');
assert.equal(failedEdgeRoute?.metric, 51);
const failedTrace = traceBuilderForwarding(failedGraph, addressing, ospfRouting, 'client', 'app');
assert.equal(failedTrace.reachable, true, 'OSPF must reconverge without an explicit static reinstall');
assert.deepEqual(failedTrace.hops.map((hop) => hop.nodeId), ['client', 'edge', 'r2', 'core']);

const costGraph = cloneBuilderGraph(graph);
costGraph.links = costGraph.links.map((link) => link.id === 'edge-r1' ? { ...link, cost: 100 } : link);
const costEdgeRoute = selectBuilderRoute(routeTableForBuilderRouter(costGraph, addressing, ospfRouting, 'edge'), '10.0.0.6');
assert.equal(costEdgeRoute?.nextHop, '10.0.0.14', 'OSPF SPF must react to Builder link-cost edits');
assert.equal(costEdgeRoute?.metric, 51);

const staticOverride = upsertBuilderStaticRoute(graph, addressing, ospfRouting, {
  routerId: 'edge', prefix: '10.0.0.4/30', nextHop: '10.0.0.14', metric: 999,
});
const staticSelection = selectBuilderRoute(routeTableForBuilderRouter(graph, addressing, staticOverride, 'edge'), '10.0.0.6');
assert.equal(staticSelection?.source, 'static');
assert.equal(staticSelection?.administrativeDistance, 1);
assert.equal(staticSelection?.nextHop, '10.0.0.14');

assert.throws(() => setBuilderOspfRouterEnabled(graph, addressing, baseRouting, 'client', true), /router nodes/);
const edgeOnly = setBuilderOspfRouterEnabled(graph, addressing, baseRouting, 'edge', true);
assert.deepEqual(edgeOnly.ospf.enabledRouterIds, ['edge']);
assert.equal(selectBuilderRoute(routeTableForBuilderRouter(graph, addressing, edgeOnly, 'edge'), '10.0.0.6'), null, 'one isolated OSPF router cannot learn a remote prefix');

const scenario = createBuilderScenario('OSPF topology', graph, 'client', 'app', defaultBuilderLayout, addressing, ospfRouting);
assert.equal(scenario.version, 9);
const restored = deserializeBuilderScenario(serializeBuilderScenario(scenario));
assert.deepEqual(restored.routing.ospf.enabledRouterIds, ['core', 'edge', 'r1', 'r2']);

const now = '2026-08-12T00:00:00.000Z';
const legacyV4 = {
  schema: 'hopscotch.builder', version: 4, name: 'Legacy static topology', graph, addressing,
  routing: { staticRoutes: [] }, sourceId: 'client', destinationId: 'app', layout: defaultBuilderLayout,
  createdAt: now, updatedAt: now,
};
const migratedV4 = deserializeBuilderScenario(JSON.stringify(legacyV4));
assert.equal(migratedV4.version, 9);
assert.deepEqual(migratedV4.routing.ospf.enabledRouterIds, []);
assert.deepEqual(migratedV4.nat.boundaries, []);

console.log('Builder OSPF contract passed: explicit Area 0 enablement, adjacencies, advertisements, deterministic SPF, automatic failure/cost reconvergence, AD precedence, forwarding, and schema-v8 persistence.');

import assert from 'node:assert/strict';
import { BUILDER_LIMITS, findShortestPath } from '../src/builder/model.ts';
import { enumeratePolicyPaths } from '../src/internet/asModel.ts';
import {
  denseAsStressGraph,
  denseBuilderStressGraph,
  denseBuilderStressLayout,
  densePhysicalStressFacilities,
  STRESS_AS_DESTINATION,
  STRESS_AS_NODE_COUNT,
  STRESS_AS_RELATIONSHIP_COUNT,
  STRESS_AS_SOURCE,
  STRESS_BUILDER_DESTINATION,
  STRESS_BUILDER_LINK_COUNT,
  STRESS_BUILDER_NODE_COUNT,
  STRESS_BUILDER_SOURCE,
  STRESS_FACILITY_COUNT,
} from '../src/stress/fixtures.ts';

async function loadBuilderScenarioForNodeContract() {
  return import(`${new URL('../src/builder/scenario.ts', import.meta.url).href}?stress-contract=${Date.now()}`);
}

assert.equal(BUILDER_LIMITS.maxNodes, 32);
assert.equal(BUILDER_LIMITS.maxLinks, 96);

assert.equal(denseAsStressGraph.nodes.length, STRESS_AS_NODE_COUNT);
assert.equal(denseAsStressGraph.relationships.length, STRESS_AS_RELATIONSHIP_COUNT);
assert.equal(new Set(denseAsStressGraph.nodes.map((node) => node.asn)).size, STRESS_AS_NODE_COUNT);
assert.equal(new Set(denseAsStressGraph.relationships.map((relationship) => relationship.id)).size, STRESS_AS_RELATIONSHIP_COUNT);
const asCandidates = enumeratePolicyPaths(denseAsStressGraph, STRESS_AS_SOURCE, STRESS_AS_DESTINATION);
assert.ok(asCandidates.length > 0, 'dense AS fixture must retain at least one policy-compliant route');
assert.deepEqual(asCandidates[0].asns, Array.from({ length: 8 }, (_, index) => STRESS_AS_SOURCE + index));
assert.deepEqual(asCandidates[0].hops.map((hop) => hop.traversal), ['up', 'up', 'peer', 'down', 'down', 'down', 'down']);
assert.equal(asCandidates[0].relationshipIds.length, 7);

assert.equal(denseBuilderStressGraph.nodes.length, STRESS_BUILDER_NODE_COUNT);
assert.equal(denseBuilderStressGraph.links.length, STRESS_BUILDER_LINK_COUNT);
assert.equal(new Set(denseBuilderStressGraph.nodes.map((node) => node.id)).size, STRESS_BUILDER_NODE_COUNT);
assert.equal(new Set(denseBuilderStressGraph.links.map((link) => link.id)).size, STRESS_BUILDER_LINK_COUNT);
assert.equal(Object.keys(denseBuilderStressLayout).length, STRESS_BUILDER_NODE_COUNT);
const builderRoute = findShortestPath(denseBuilderStressGraph, STRESS_BUILDER_SOURCE, STRESS_BUILDER_DESTINATION);
assert.equal(builderRoute.reachable, true);
assert.ok(builderRoute.nodeIds.length >= 2);

const {
  createBuilderScenario,
  deserializeBuilderScenario,
  serializeBuilderScenario,
} = await loadBuilderScenarioForNodeContract();
const builderScenario = createBuilderScenario(
  'Lab 08B max-density fixture',
  denseBuilderStressGraph,
  STRESS_BUILDER_SOURCE,
  STRESS_BUILDER_DESTINATION,
  denseBuilderStressLayout,
);
const restoredBuilder = deserializeBuilderScenario(serializeBuilderScenario(builderScenario));
assert.equal(restoredBuilder.graph.nodes.length, STRESS_BUILDER_NODE_COUNT);
assert.equal(restoredBuilder.graph.links.length, STRESS_BUILDER_LINK_COUNT);
assert.equal(restoredBuilder.version, 3);
assert.equal(Object.keys(restoredBuilder.addressing.segments).length, STRESS_BUILDER_LINK_COUNT);
assert.equal(findShortestPath(restoredBuilder.graph, restoredBuilder.sourceId, restoredBuilder.destinationId).reachable, true);

const overflowGraph = {
  ...denseBuilderStressGraph,
  nodes: [...denseBuilderStressGraph.nodes, { id: 'stress-overflow-node', label: 'OVER LIMIT', kind: 'router', builtin: false }],
};
assert.throws(
  () => createBuilderScenario('Too many nodes', overflowGraph, STRESS_BUILDER_SOURCE, STRESS_BUILDER_DESTINATION, denseBuilderStressLayout),
  /nodes/i,
  'Builder schema must reject a graph above the product node ceiling.',
);
const overflowLinksGraph = {
  ...denseBuilderStressGraph,
  links: [...denseBuilderStressGraph.links, { id: 'stress-overflow-link', a: STRESS_BUILDER_SOURCE, b: STRESS_BUILDER_DESTINATION, cost: 9, failed: false }],
};
assert.throws(
  () => createBuilderScenario('Too many links', overflowLinksGraph, STRESS_BUILDER_SOURCE, STRESS_BUILDER_DESTINATION, denseBuilderStressLayout),
  /links/i,
  'Builder schema must reject a graph above the product link ceiling.',
);

assert.equal(densePhysicalStressFacilities.length, STRESS_FACILITY_COUNT);
assert.equal(new Set(densePhysicalStressFacilities.map((facility) => facility.id)).size, STRESS_FACILITY_COUNT);
assert.ok(densePhysicalStressFacilities.every((facility) => facility.latitude >= -90 && facility.latitude <= 90));
assert.ok(densePhysicalStressFacilities.every((facility) => facility.longitude >= -180 && facility.longitude <= 180));
assert.ok(densePhysicalStressFacilities.every((facility) => facility.city === 'TEST FIXTURE' && facility.country === 'SIMULATED'));
assert.equal(densePhysicalStressFacilities[0].name, 'SIMULATED STRESS FACILITY 0001');
assert.equal(densePhysicalStressFacilities.at(-1)?.name, `SIMULATED STRESS FACILITY ${String(STRESS_FACILITY_COUNT).padStart(4, '0')}`);

console.log(`High-density fixture contract passed: ${STRESS_AS_NODE_COUNT}/${STRESS_AS_RELATIONSHIP_COUNT} AS graph, ${STRESS_BUILDER_NODE_COUNT}/${STRESS_BUILDER_LINK_COUNT} Builder ceiling + schema round trip, ${STRESS_FACILITY_COUNT} simulated WebGL points.`);

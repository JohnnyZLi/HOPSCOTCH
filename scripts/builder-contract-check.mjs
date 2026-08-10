import assert from 'node:assert/strict';
import {
  cloneBuilderGraph,
  cloneBuilderLayout,
  defaultBuilderGraph,
  defaultBuilderLayout,
  findShortestPath,
} from '../src/builder/model.ts';
import {
  createBuilderScenario,
  deserializeBuilderScenario,
  serializeBuilderScenario,
} from '../src/builder/scenario.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
assert.equal(findShortestPath(graph, 'client', 'app').totalCost, 22);
assert.deepEqual(findShortestPath(graph, 'client', 'app').nodeIds, ['client', 'edge', 'r1', 'core', 'app']);

graph.links.find((link) => link.id === 'r1-core').failed = true;
assert.equal(findShortestPath(graph, 'client', 'app').totalCost, 52);
assert.deepEqual(findShortestPath(graph, 'client', 'app').nodeIds, ['client', 'edge', 'r2', 'core', 'app']);

graph.links.find((link) => link.id === 'edge-r2').cost = 5;
assert.equal(findShortestPath(graph, 'client', 'app').totalCost, 27);

graph.links.find((link) => link.id === 'r2-core').failed = true;
assert.equal(findShortestPath(graph, 'client', 'app').reachable, false);

const dynamic = cloneBuilderGraph(defaultBuilderGraph);
dynamic.nodes.push({ id: 'r3', label: 'R3', kind: 'router' });
dynamic.links.push(
  { id: 'edge-r3', a: 'edge', b: 'r3', cost: 2, failed: false },
  { id: 'r3-core', a: 'r3', b: 'core', cost: 2, failed: false },
);
const dynamicRoute = findShortestPath(dynamic, 'client', 'app');
assert.equal(dynamicRoute.totalCost, 6);
assert.deepEqual(dynamicRoute.nodeIds, ['client', 'edge', 'r3', 'core', 'app']);

const dynamicLayout = cloneBuilderLayout(defaultBuilderLayout);
dynamicLayout.r3 = { x: 36, y: 24 };
const dynamicScenario = createBuilderScenario('Dynamic', dynamic, 'client', 'app', dynamicLayout);
assert.equal(dynamicScenario.version, 2);
assert.equal(dynamicScenario.graph.nodes.length, 7);
assert.equal(deserializeBuilderScenario(serializeBuilderScenario(dynamicScenario)).graph.nodes.length, 7);

const resetGraph = cloneBuilderGraph(defaultBuilderGraph);
const staleLayout = { ...dynamicLayout, ghost: { x: 50, y: 50 } };
const resetScenario = createBuilderScenario('Reset', resetGraph, 'client', 'app', staleLayout);
assert.equal('r3' in resetScenario.layout, false);
assert.equal('ghost' in resetScenario.layout, false);
assert.equal(Object.keys(resetScenario.layout).length, 6);

const v1 = {
  schema: 'hopscotch.builder',
  version: 1,
  name: 'Legacy',
  nodes: cloneBuilderGraph(defaultBuilderGraph).nodes,
  links: cloneBuilderGraph(defaultBuilderGraph).links.map((link) => link.id === 'r1-core' ? { ...link, failed: true } : link.id === 'edge-r2' ? { ...link, cost: 5 } : link),
  sourceId: 'client',
  destinationId: 'app',
  layout: cloneBuilderLayout(defaultBuilderLayout),
  createdAt: '2026-08-10T00:00:00Z',
  updatedAt: '2026-08-10T00:00:00Z',
};
const migrated = deserializeBuilderScenario(JSON.stringify(v1));
assert.equal(migrated.version, 2);
assert.equal(findShortestPath(migrated.graph, migrated.sourceId, migrated.destinationId).totalCost, 27);

const broken = structuredClone(v1);
broken.links[0].b = 'ghost';
assert.throws(() => deserializeBuilderScenario(JSON.stringify(broken)), /does not exist/);

console.log('Builder contract checks passed.');

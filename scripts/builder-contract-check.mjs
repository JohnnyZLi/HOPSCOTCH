import assert from 'node:assert/strict';
import {
  cloneBuilderGraph,
  defaultBuilderGraph,
  findShortestPath,
} from '../src/builder/model.ts';

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

console.log('Builder route-model contract checks passed.');

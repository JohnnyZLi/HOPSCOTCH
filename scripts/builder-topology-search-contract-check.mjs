import assert from 'node:assert/strict';
import {
  getBuilderTopologyZoomTarget,
  searchBuilderTopology,
} from '../src/builder/topology-search.ts';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const graph = {
  nodes: [
    { id: 'substring-device', label: 'West Alpha appliance', kind: 'router' },
    { id: 'prefix-by-label', label: 'Alpha branch', kind: 'router' },
    { id: 'exact-by-name', label: 'Named device', name: 'ALPHA', kind: 'router' },
    { id: 'alpha-prefix-id', label: 'ID prefix', kind: 'endpoint' },
    { id: 'exact-by-label', label: 'Alpha', kind: 'endpoint' },
    { id: 'alpha', label: 'Stable ID exact', kind: 'endpoint' },
  ],
  links: [],
};

const layout = {
  'exact-by-name': { x: 50, y: 10 },
  alpha: { x: 10, y: 20 },
  'prefix-by-label': { x: 70, y: 30 },
  'alpha-prefix-id': { x: 30, y: 40 },
  'substring-device': { x: 90, y: 50 },
  'exact-by-label': { x: 40, y: 60 },
  stale: { x: 99, y: 99 },
};

const originalGraph = structuredClone(graph);
const originalLayout = structuredClone(layout);
deepFreeze(graph);
deepFreeze(layout);

assert.deepEqual(searchBuilderTopology(graph, layout, ''), []);
assert.deepEqual(searchBuilderTopology(graph, layout, '  \n\t  '), []);

const results = searchBuilderTopology(graph, layout, '  aLpHa  ');
assert.deepEqual(
  results.map(({ deviceId, matchKind, matchedField }) => ({ deviceId, matchKind, matchedField })),
  [
    { deviceId: 'alpha', matchKind: 'exact', matchedField: 'id' },
    { deviceId: 'exact-by-label', matchKind: 'exact', matchedField: 'label' },
    { deviceId: 'exact-by-name', matchKind: 'exact', matchedField: 'name' },
    { deviceId: 'alpha-prefix-id', matchKind: 'prefix', matchedField: 'id' },
    { deviceId: 'prefix-by-label', matchKind: 'prefix', matchedField: 'label' },
    { deviceId: 'substring-device', matchKind: 'substring', matchedField: 'label' },
  ],
  'exact, prefix, and substring ranks must be stable with device ID as the tie break',
);
assert.deepEqual(results[0].zoomTarget, { deviceId: 'alpha', x: 10, y: 20 });
assert.equal(results.find((result) => result.deviceId === 'exact-by-name')?.name, 'ALPHA');

const reorderedGraph = {
  ...graph,
  nodes: [...graph.nodes].reverse(),
  links: [...graph.links].reverse(),
};
const reorderedLayout = Object.fromEntries(Object.entries(layout).reverse());
assert.deepEqual(
  searchBuilderTopology(reorderedGraph, reorderedLayout, 'alpha'),
  results,
  'graph array and layout insertion order must not affect search output',
);

assert.deepEqual(
  getBuilderTopologyZoomTarget(graph, layout, 'exact-by-label'),
  { deviceId: 'exact-by-label', x: 40, y: 60 },
);
assert.equal(getBuilderTopologyZoomTarget(graph, layout, 'stale'), null, 'layout-only stale IDs must fail closed');
assert.equal(getBuilderTopologyZoomTarget(graph, layout, 'missing'), null, 'nonexistent IDs must fail closed');
assert.deepEqual(searchBuilderTopology(graph, layout, 'stale'), [], 'layout-only stale IDs must not become results');

const graphWithoutAlpha = { ...graph, nodes: graph.nodes.filter((node) => node.id !== 'alpha') };
assert.equal(
  getBuilderTopologyZoomTarget(graphWithoutAlpha, layout, results[0].deviceId),
  null,
  'a result selected before graph deletion must fail closed when resolved again',
);

const layoutWithoutAlpha = Object.fromEntries(Object.entries(layout).filter(([id]) => id !== 'alpha'));
assert.equal(getBuilderTopologyZoomTarget(graph, layoutWithoutAlpha, 'alpha'), null, 'missing layout must fail closed');
assert.equal(
  getBuilderTopologyZoomTarget(graph, { ...layout, alpha: { x: Number.NaN, y: 20 } }, 'alpha'),
  null,
  'invalid layout coordinates must fail closed',
);

assert.deepEqual(graph, originalGraph, 'search and target resolution must not mutate graph truth');
assert.deepEqual(layout, originalLayout, 'search and target resolution must not mutate layout truth');

console.log('Builder topology search contract passed: deterministic case-insensitive ranking, reordered-input stability, zoom targeting, stale-ID failure, and immutable inputs.');

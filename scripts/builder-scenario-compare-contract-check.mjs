import assert from 'node:assert/strict';
import {
  compareBuilderScenarios,
  isBuilderScenarioDiffEmpty,
} from '../src/builder/scenario-compare.ts';
import {
  createBuilderScenario,
  deserializeBuilderScenario,
  serializeBuilderScenario,
} from '../src/builder/scenario.ts';
import {
  cloneBuilderGraph,
  defaultBuilderGraph,
  defaultBuilderLayout,
} from '../src/builder/model.ts';

const EMPTY_DIFF = {
  devices: [],
  links: [],
  configurationObjects: [],
  fields: [],
};

function validatedScenario(scenario) {
  return deserializeBuilderScenario(serializeBuilderScenario(scenario));
}

function reverseInsertionOrder(value) {
  if (Array.isArray(value)) return value.toReversed().map(reverseInsertionOrder);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .toReversed()
      .map(([key, child]) => [key, reverseInsertionOrder(child)]),
  );
}

function aclRule(id, action, description) {
  return {
    id,
    routerId: 'edge',
    order: id === 'm-change' ? 20 : 10,
    action,
    protocol: 'tcp',
    sourcePrefix: '10.0.0.0/8',
    destinationPrefix: '198.51.100.0/24',
    destinationPort: 443,
    description,
  };
}

const unchanged = createBuilderScenario(
  'Unchanged',
  cloneBuilderGraph(defaultBuilderGraph),
  'client',
  'app',
  structuredClone(defaultBuilderLayout),
);
const unchangedBytes = JSON.stringify(unchanged);
assert.deepEqual(compareBuilderScenarios(unchanged, unchanged), EMPTY_DIFF);
assert.equal(JSON.stringify(unchanged), unchangedBytes, 'comparing the same snapshot must not mutate it');

const reordered = reverseInsertionOrder(unchanged);
reordered.name = 'Metadata-only rename';
reordered.createdAt = '2000-01-01T00:00:00.000Z';
reordered.updatedAt = '2099-01-01T00:00:00.000Z';
reordered.layout.client = { x: 99, y: 1 };
reordered.ethernet.layout['lan-a'] = { x: 1, y: 99 };
reordered.runtimeArtifacts = {
  probes: [{ id: 'session-probe', status: 'failed' }],
  natTranslations: [{ id: 'session-nat', expiresAfterSequence: 12 }],
};
const reorderedBytes = JSON.stringify(reordered);
assert.deepEqual(
  compareBuilderScenarios(unchanged, reordered),
  EMPTY_DIFF,
  'array/map insertion order, layout, metadata, and session artifacts are outside canonical configuration diff truth',
);
assert.equal(JSON.stringify(unchanged), unchangedBytes, 'before input must remain byte-for-byte unchanged');
assert.equal(JSON.stringify(reordered), reorderedBytes, 'after input must remain byte-for-byte unchanged');

const beforeGraph = cloneBuilderGraph(defaultBuilderGraph);
beforeGraph.nodes.push({ id: 'z-device', label: 'Z DEVICE', kind: 'endpoint' });
beforeGraph.links.push({ id: 'z-link', a: 'core', b: 'z-device', cost: 8, failed: false });
const beforeLayout = { ...structuredClone(defaultBuilderLayout), 'z-device': { x: 82, y: 82 } };
const before = createBuilderScenario('Before', beforeGraph, 'client', 'z-device', beforeLayout);
before.acl.rules = [
  aclRule('z-remove', 'deny', 'Removed rule'),
  aclRule('m-change', 'permit', 'Old description'),
];

const afterGraph = cloneBuilderGraph(defaultBuilderGraph);
afterGraph.nodes.find((node) => node.id === 'r1').label = 'R1 PRIMARY';
afterGraph.nodes.push({ id: 'a-device', label: 'A DEVICE', kind: 'endpoint' });
afterGraph.links.find((link) => link.id === 'edge-r2').cost = 25;
afterGraph.links.push({ id: 'a-link', a: 'core', b: 'a-device', cost: 3, failed: false });
const afterLayout = { ...structuredClone(defaultBuilderLayout), 'a-device': { x: 82, y: 18 } };
const after = createBuilderScenario('After', afterGraph, 'client', 'a-device', afterLayout);
after.acl.rules = [
  aclRule('m-change', 'deny', 'New description'),
  aclRule('a-add', 'permit', 'Added rule'),
];

const validBefore = validatedScenario(before);
const validAfter = validatedScenario(after);
const validBeforeBytes = JSON.stringify(validBefore);
const validAfterBytes = JSON.stringify(validAfter);
const diff = compareBuilderScenarios(validBefore, validAfter);

assert.deepEqual(
  diff.devices.map(({ collectionPath, id, change }) => [collectionPath.join('.'), id, change]),
  [
    ['graph.nodes', 'a-device', 'added'],
    ['graph.nodes', 'r1', 'changed'],
    ['graph.nodes', 'z-device', 'removed'],
  ],
  'device changes must be matched and sorted by stable ID',
);
assert.deepEqual(
  diff.links.map(({ collectionPath, id, change }) => [collectionPath.join('.'), id, change]),
  [
    ['graph.links', 'a-link', 'added'],
    ['graph.links', 'edge-r2', 'changed'],
    ['graph.links', 'z-link', 'removed'],
  ],
  'link changes must be matched and sorted by stable ID',
);
assert.deepEqual(
  diff.configurationObjects.map(({ collectionPath, id, change }) => [collectionPath.join('.'), id, change]),
  [
    ['acl.rules', 'a-add', 'added'],
    ['acl.rules', 'm-change', 'changed'],
    ['acl.rules', 'z-remove', 'removed'],
  ],
  'stable configuration objects must retain IDs and deterministic ordering',
);

const r1Change = diff.devices.find((change) => change.id === 'r1');
assert.deepEqual(r1Change.fields, [
  { path: ['label'], change: 'changed', before: 'R1', after: 'R1 PRIMARY' },
]);
const linkChange = diff.links.find((change) => change.id === 'edge-r2');
assert.deepEqual(linkChange.fields, [
  { path: ['cost'], change: 'changed', before: 30, after: 25 },
]);
const aclChange = diff.configurationObjects.find((change) => change.id === 'm-change');
assert.deepEqual(aclChange.fields, [
  { path: ['action'], change: 'changed', before: 'permit', after: 'deny' },
  { path: ['description'], change: 'changed', before: 'Old description', after: 'New description' },
]);
assert.equal(
  diff.devices.some((change) => change.id === 'a-device' && change.change === 'changed'),
  false,
  'different stable IDs must remain an add/remove pair rather than invented equivalence',
);

const reorderedDiff = compareBuilderScenarios(
  reverseInsertionOrder(validBefore),
  reverseInsertionOrder(validAfter),
);
assert.deepEqual(reorderedDiff, diff, 'diff content and ordering must not depend on input insertion order');
assert.equal(JSON.stringify(validBefore), validBeforeBytes, 'comparison must not mutate the before snapshot');
assert.equal(JSON.stringify(validAfter), validAfterBytes, 'comparison must not mutate the after snapshot');
assert.equal(isBuilderScenarioDiffEmpty(diff), false);
assert.equal(isBuilderScenarioDiffEmpty(EMPTY_DIFF), true);

console.log('Builder scenario compare contract passed: canonical-only, reorder-stable, ID-preserving, and immutable.');

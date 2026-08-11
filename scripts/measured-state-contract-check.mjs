import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createMeasuredStateStore,
  measuredAvailability,
  measuredFactById,
  measuredFactsByCategory,
  measuredFactsByTarget,
  measuredFreshnessAt,
  measuredLatestObservationAt,
  projectMeasuredSnapshot,
  replaceActiveMeasuredSnapshot,
} from '../src/measurement/state.ts';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';

const fixture = {
  schema: 'hopscotch.native-measurement',
  version: 1,
  provenance: 'LOCAL MEASURED',
  generatedAt: '2026-08-11T21:10:03.000Z',
  source: {
    adapter: 'network-diagnostics-suite',
    adapterVersion: '2.0.0',
    platform: 'macos',
    tool: 'hopscotch-native-bridge',
    toolVersion: '0.1.0',
  },
  capture: {
    startedAt: '2026-08-11T21:10:00.000Z',
    completedAt: '2026-08-11T21:10:02.000Z',
  },
  scope: {
    vantage: 'local-host',
    completeness: 'bounded',
    globalComplete: false,
    target: { kind: 'hostname', value: 'example.test' },
    limitations: [
      'Facts describe one local host and capture interval only.',
      'Traceroute hops do not prove the return path or global topology.',
    ],
  },
  facts: [
    { id: 'if-up', provenance: 'LOCAL MEASURED', category: 'interface', subject: 'en0 link state', availability: 'available', observedAt: '2026-08-11T21:10:00.200Z', target: { kind: 'interface', value: 'en0' }, value: true, unit: null, note: 'Local interface was reported up by the adapter.' },
    { id: 'route-default', provenance: 'LOCAL MEASURED', category: 'route', subject: 'selected local next hop', availability: 'available', observedAt: '2026-08-11T21:10:00.400Z', target: { kind: 'hostname', value: 'example.test' }, value: '192.0.2.1', unit: null, note: 'Local route lookup result for this target only.' },
    { id: 'trace-hop-count', provenance: 'LOCAL MEASURED', category: 'traceroute', subject: 'responding hop count', availability: 'partial', observedAt: '2026-08-11T21:10:01.200Z', target: { kind: 'hostname', value: 'example.test' }, value: 8, unit: 'hops', note: 'Eight responding hops were observed; non-response does not imply absence.' },
    { id: 'icmp-unavailable', provenance: 'LOCAL MEASURED', category: 'icmp', subject: 'echo response', availability: 'unavailable', observedAt: '2026-08-11T21:10:01.500Z', target: { kind: 'ip', value: '198.51.100.7' }, value: null, unit: null, note: 'No echo response was observed during the bounded attempt.' },
    { id: 'transport-rtt', provenance: 'LOCAL MEASURED', category: 'transport', subject: 'connection RTT sample', availability: 'available', observedAt: '2026-08-11T21:10:01.800Z', target: { kind: 'service', value: 'https://example.test:443' }, value: 23.4, unit: 'ms', note: 'One local transport timing sample.' },
  ],
  warnings: ['No packet capture was requested in this fixture.'],
};

const originalJson = JSON.stringify(fixture);
const state = projectMeasuredSnapshot(fixture);
assert.equal(JSON.stringify(fixture), originalJson, 'projection must not mutate the input snapshot');
assert.equal(state.schema, 'hopscotch.measured-state');
assert.equal(state.version, 1);
assert.equal(state.provenance, 'LOCAL MEASURED');
assert.equal(state.snapshot.scope.vantage, 'local-host');
assert.equal(state.snapshot.scope.globalComplete, false);
assert.deepEqual(state.snapshot.source, fixture.source);
assert.deepEqual(state.snapshot.capture, fixture.capture);
assert.deepEqual(state.snapshot.scope, fixture.scope);

assert.deepEqual(state.factIdsByCategory.interface, ['if-up']);
assert.deepEqual(state.factIdsByCategory.route, ['route-default']);
assert.deepEqual(state.factIdsByCategory.traceroute, ['trace-hop-count']);
assert.deepEqual(state.factIdsByCategory.transport, ['transport-rtt']);
assert.deepEqual(measuredFactsByCategory(state, 'route').map((fact) => fact.id), ['route-default']);
assert.equal(measuredFactById(state, 'transport-rtt')?.value, 23.4);
assert.equal(measuredFactById(state, 'missing'), null);
assert.deepEqual(state.availability, { available: 3, partial: 1, unavailable: 1, total: 5 });
assert.deepEqual(measuredAvailability(state, 'partial').map((fact) => fact.id), ['trace-hop-count']);
assert.deepEqual(measuredAvailability(state, 'unavailable').map((fact) => fact.id), ['icmp-unavailable']);
assert.equal(measuredLatestObservationAt(state), '2026-08-11T21:10:01.800Z');

assert.deepEqual(measuredFreshnessAt(state, '2026-08-11T21:10:32.000Z'), {
  classification: 'fresh',
  ageMs: 30_000,
  captureCompletedAt: '2026-08-11T21:10:02.000Z',
  evaluatedAt: '2026-08-11T21:10:32.000Z',
});
assert.equal(measuredFreshnessAt(state, '2026-08-11T21:12:02.000Z').classification, 'aging');
assert.equal(measuredFreshnessAt(state, '2026-08-11T21:20:02.000Z').classification, 'stale');
assert.equal(measuredFreshnessAt(state, '2026-08-11T21:09:59.000Z').classification, 'clock-skew');
assert.throws(() => measuredFreshnessAt(state, '2026-08-11T21:12:02.000Z', { freshForMs: 10_000, staleAfterMs: 5_000 }), /staleAfterMs/);

const exampleTarget = { kind: 'hostname', value: 'example.test' };
assert.deepEqual(measuredFactsByTarget(state, exampleTarget).map((fact) => fact.id), ['route-default', 'trace-hop-count']);
assert.deepEqual(measuredFactsByTarget(state, null), []);

const secondFixture = structuredClone(fixture);
secondFixture.scope.target = { kind: 'hostname', value: 'api.example.test' };
secondFixture.facts[1].target = { kind: 'hostname', value: 'api.example.test' };
secondFixture.facts[2].target = { kind: 'hostname', value: 'api.example.test' };
secondFixture.facts[4].target = { kind: 'service', value: 'https://api.example.test:443' };
const secondState = projectMeasuredSnapshot(secondFixture);
assert.notEqual(secondState.measurementKey, state.measurementKey, 'different target snapshots must retain distinct identities');
assert.equal(measuredFactsByTarget(state, { kind: 'hostname', value: 'api.example.test' }).length, 0, 'target-specific facts must not leak across measured states');
assert.equal(measuredFactsByTarget(secondState, exampleTarget).length, 0, 'separate snapshots must not be merged into a global fact view');

const projected = projectMeasuredSnapshot(fixture);
projected.snapshot.scope.limitations.push('projection-local mutation');
projected.snapshot.facts[0].target.value = 'en9';
assert.equal(fixture.scope.limitations.length, 2, 'projected limitations must not alias the input');
assert.equal(fixture.facts[0].target.value, 'en0', 'projected fact targets must not alias the input');

const journeyConfig = {
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  impairmentProfile: 'composed',
  modifierIds: ['route-leak', 'latency-spike'],
};
const journeyBefore = buildJourneyScenario('example.test', journeyConfig);
const journeyStateBefore = journeyStateAt(journeyBefore, 5_500);
const journeyBytesBefore = JSON.stringify({ scenario: journeyBefore, timeMs: 5_500, state: journeyStateBefore });

let store = createMeasuredStateStore();
assert.equal(store.active, null);
store = replaceActiveMeasuredSnapshot(store, fixture);
assert.equal(store.active?.measurementKey, state.measurementKey);
const firstKey = store.active.measurementKey;
store = replaceActiveMeasuredSnapshot(store, secondFixture);
assert.notEqual(store.active?.measurementKey, firstKey);
assert.equal(store.active?.measurementKey, secondState.measurementKey);
assert.deepEqual(store.active?.availability, secondState.availability);

const journeyAfter = buildJourneyScenario('example.test', journeyConfig);
const journeyStateAfter = journeyStateAt(journeyAfter, 5_500);
assert.deepEqual(journeyAfter, journeyBefore, 'measured-state replacement cannot change canonical Journey construction');
assert.deepEqual(journeyStateAfter, journeyStateBefore, 'measured-state replacement cannot change reducer state at the same timestamp');
assert.equal(JSON.stringify({ scenario: journeyBefore, timeMs: 5_500, state: journeyStateBefore }), journeyBytesBefore, 'active Journey data must remain byte-identical while measured state changes');

assert.equal(measuredFactById(state, 'icmp-unavailable')?.availability, 'unavailable');
assert.equal(measuredFactById(state, 'icmp-unavailable')?.value, null, 'unavailable measured state must not be filled from simulation');
assert.equal(measuredFactById(state, 'trace-hop-count')?.availability, 'partial', 'partial measured state must remain partial');

const contaminated = structuredClone(fixture);
contaminated.journey = { modifierIds: ['partition'], events: [] };
assert.throws(() => projectMeasuredSnapshot(contaminated), /unsupported field/, '09A validation must still guard the measured-state entry point');

const measuredStateSource = readFileSync(new URL('../src/measurement/state.ts', import.meta.url), 'utf8');
assert.doesNotMatch(measuredStateSource, /from ['"][^'"]*journey/i, 'measured-state model must not import Journey model code');
assert.doesNotMatch(measuredStateSource, /JourneyEvent|JourneyScenario|JourneyModifier|JourneyState/, 'measured-state public model must not expose Journey types');
for (const forbiddenKey of ['events', 'modifierIds', 'impairmentProfile', 'timeMs', 'journeyFailed']) {
  assert.equal(Object.hasOwn(state, forbiddenKey), false, `measured state must not expose Journey field ${forbiddenKey}`);
}

console.log('Measured state separation contract passed: LOCAL MEASURED projection remains deterministic, target-bounded, and unable to mutate simulated Journey truth.');

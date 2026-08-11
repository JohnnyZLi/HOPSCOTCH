import assert from 'node:assert/strict';
import {
  deserializeNativeMeasurementSnapshot,
  parseNativeMeasurementSnapshot,
  serializeNativeMeasurementSnapshot,
} from '../src/measurement/native.ts';

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
    { id: 'transport-rtt', provenance: 'LOCAL MEASURED', category: 'transport', subject: 'connection RTT sample', availability: 'available', observedAt: '2026-08-11T21:10:01.800Z', target: { kind: 'service', value: 'https://example.test:443' }, value: 23.4, unit: 'ms', note: 'One local transport timing sample.' },
  ],
  warnings: ['No packet capture was requested in this fixture.'],
};

const parsed = parseNativeMeasurementSnapshot(fixture);
assert.equal(parsed.provenance, 'LOCAL MEASURED');
assert.equal(parsed.scope.vantage, 'local-host');
assert.equal(parsed.scope.completeness, 'bounded');
assert.equal(parsed.scope.globalComplete, false);
assert.equal(parsed.facts.length, 4);
assert.deepEqual(deserializeNativeMeasurementSnapshot(serializeNativeMeasurementSnapshot(parsed)), parsed);

const clone = () => structuredClone(fixture);
const rejects = (mutate, pattern) => {
  const candidate = clone();
  mutate(candidate);
  assert.throws(() => parseNativeMeasurementSnapshot(candidate), pattern);
};

rejects((v) => { v.provenance = 'SIMULATED'; }, /LOCAL MEASURED/);
rejects((v) => { v.scope.vantage = 'global-internet'; }, /local-host/);
rejects((v) => { v.scope.completeness = 'complete'; }, /bounded/);
rejects((v) => { v.scope.globalComplete = true; }, /globalComplete/);
rejects((v) => { v.scope.limitations = []; }, /must not be empty/);
rejects((v) => { v.capture.completedAt = '2026-08-11T21:09:59.000Z'; }, /must not precede/);
rejects((v) => { v.generatedAt = '2026-08-11T21:10:01.000Z'; }, /generatedAt/);
rejects((v) => { v.facts[0].provenance = 'INFERRED'; }, /LOCAL MEASURED/);
rejects((v) => { v.facts[0].observedAt = '2026-08-11T21:10:04.000Z'; }, /capture interval/);
rejects((v) => { v.facts[1].id = v.facts[0].id; }, /Duplicate measured fact id/);
rejects((v) => { v.facts[2].unit = 'ms'; v.facts[2].value = 'eight'; }, /numeric value/);
rejects((v) => { v.facts[3].value = -2; }, /non-negative/);
rejects((v) => { v.facts[0].availability = 'unavailable'; }, /value must be null/);
rejects((v) => { v.facts[0].value = { journey: { modifiers: ['route-failure'] } }; }, /structured model\/Journey state/);
rejects((v) => { v.journey = { events: [] }; }, /unsupported field/);
rejects((v) => { v.source.adapter = ''; }, /source.adapter/);
rejects((v) => { v.source.tool = ''; }, /source.tool/);
rejects((v) => { v.facts[0].category = 'bgp-global-view'; }, /category is unsupported/);

const unavailable = clone();
unavailable.facts.push({ id: 'icmp-unavailable', provenance: 'LOCAL MEASURED', category: 'icmp', subject: 'echo response', availability: 'unavailable', observedAt: '2026-08-11T21:10:01.500Z', target: { kind: 'ip', value: '198.51.100.7' }, value: null, unit: null, note: 'No echo response was observed during the bounded attempt.' });
assert.equal(parseNativeMeasurementSnapshot(unavailable).facts.at(-1)?.availability, 'unavailable');

console.log('Native measurement provenance contract passed: LOCAL MEASURED remains bounded to local vantage, target, adapter, and capture time.');

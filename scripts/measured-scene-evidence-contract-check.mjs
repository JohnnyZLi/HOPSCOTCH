import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  measuredCompatibilityLabel,
  measuredEvidenceForScene,
  measuredTargetCompatibility,
} from '../src/measurement/sceneEvidence.ts';
import { projectMeasuredSnapshot } from '../src/measurement/state.ts';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';

const query = { scene: 'transport', hostname: 'Example.Test.', destinationAddress: '203.0.113.42' };
assert.equal(measuredTargetCompatibility({ kind: 'hostname', value: 'example.test' }, query), 'matched-target');
assert.equal(measuredTargetCompatibility({ kind: 'hostname', value: 'EXAMPLE.TEST.' }, query), 'matched-target');
assert.equal(measuredTargetCompatibility({ kind: 'service', value: 'https://example.test:443/path' }, query), 'matched-target');
assert.equal(measuredTargetCompatibility({ kind: 'service', value: 'example.test:443' }, query), 'matched-target');
assert.equal(measuredTargetCompatibility({ kind: 'ip', value: '203.0.113.42' }, query), 'matched-target');
assert.equal(measuredTargetCompatibility({ kind: 'service', value: 'https://speed.example.test' }, query), 'other-target');
assert.equal(measuredTargetCompatibility({ kind: 'hostname', value: 'other.example.test' }, query), 'other-target');
assert.equal(measuredTargetCompatibility(null, query), 'local-context');
assert.equal(measuredTargetCompatibility({ kind: 'interface', value: 'en0' }, query), 'local-context');
assert.equal(measuredTargetCompatibility({ kind: 'prefix', value: '0.0.0.0/0' }, query), 'local-context');

const routingQuery = { scene: 'routing', hostname: 'example.test', destinationAddress: '203.0.113.42' };
assert.equal(measuredTargetCompatibility({ kind: 'prefix', value: '203.0.113.0/24' }, routingQuery), 'matched-target');
assert.equal(measuredTargetCompatibility({ kind: 'prefix', value: '0.0.0.0/0' }, routingQuery), 'local-context', 'default route is local context, not proof of the Journey forwarding path');
assert.equal(measuredTargetCompatibility({ kind: 'prefix', value: '198.51.100.0/24' }, routingQuery), 'other-target');
assert.equal(measuredTargetCompatibility({ kind: 'interface', value: 'en0' }, routingQuery), 'local-context');
assert.equal(measuredTargetCompatibility({ kind: 'hostname', value: 'example.test' }, routingQuery), 'other-target');

const dnsQuery = { scene: 'dns', hostname: 'example.test', destinationAddress: '203.0.113.42' };
assert.equal(measuredTargetCompatibility({ kind: 'hostname', value: 'example.test' }, dnsQuery), 'matched-target');
assert.equal(measuredTargetCompatibility({ kind: 'service', value: 'https://example.test:443' }, dnsQuery), 'matched-target');
assert.equal(measuredTargetCompatibility({ kind: 'ip', value: '192.0.2.53' }, dnsQuery), 'local-context', 'resolver IP is local DNS context, not a destination match');
assert.equal(measuredTargetCompatibility({ kind: 'hostname', value: 'other.test' }, dnsQuery), 'other-target');

for (const ambiguous of [
  { kind: 'hostname', value: 'https://example.test' },
  { kind: 'hostname', value: 'example test' },
  { kind: 'service', value: 'https://[2001:db8::1' },
  { kind: 'ip', value: '999.1.1.1' },
]) assert.equal(measuredTargetCompatibility(ambiguous, query), 'other-target', `ambiguous target ${JSON.stringify(ambiguous)} must fail closed`);

assert.equal(measuredCompatibilityLabel('matched-target'), 'MATCHED TARGET');
assert.equal(measuredCompatibilityLabel('local-context'), 'LOCAL CONTEXT');
assert.equal(measuredCompatibilityLabel('other-target'), 'OTHER TARGET');

const snapshot = projectMeasuredSnapshot({
  schema: 'hopscotch.native-measurement',
  version: 1,
  provenance: 'LOCAL MEASURED',
  generatedAt: '2026-08-11T23:30:03.000Z',
  source: { adapter: 'lab09e-fixture', adapterVersion: '1', platform: 'linux', tool: 'fixture', toolVersion: '1' },
  capture: { startedAt: '2026-08-11T23:30:00.000Z', completedAt: '2026-08-11T23:30:02.000Z' },
  scope: {
    vantage: 'local-host', completeness: 'bounded', globalComplete: false, target: null,
    limitations: ['Lab 09E target compatibility fixture; facts are one local capture only.'],
  },
  facts: [
    { id: 'route-default', provenance: 'LOCAL MEASURED', category: 'route', subject: 'default route', availability: 'available', observedAt: '2026-08-11T23:30:02.000Z', target: { kind: 'prefix', value: '0.0.0.0/0' }, value: true, unit: null, note: 'Default route context.' },
    { id: 'route-specific', provenance: 'LOCAL MEASURED', category: 'route', subject: 'documentation route', availability: 'available', observedAt: '2026-08-11T23:30:02.000Z', target: { kind: 'prefix', value: '203.0.113.0/24' }, value: 10, unit: 'count', note: 'Specific prefix route.' },
    { id: 'interface', provenance: 'LOCAL MEASURED', category: 'interface', subject: 'interface state', availability: 'available', observedAt: '2026-08-11T23:30:02.000Z', target: { kind: 'interface', value: 'en0' }, value: true, unit: null, note: 'Local interface context.' },
    { id: 'dns-resolver', provenance: 'LOCAL MEASURED', category: 'dns', subject: 'resolver latency', availability: 'available', observedAt: '2026-08-11T23:30:02.000Z', target: { kind: 'ip', value: '192.0.2.53' }, value: 8, unit: 'ms', note: 'Local resolver context.' },
    { id: 'dns-target', provenance: 'LOCAL MEASURED', category: 'dns', subject: 'service DNS duration', availability: 'available', observedAt: '2026-08-11T23:30:02.000Z', target: { kind: 'service', value: 'https://example.test:443' }, value: 12, unit: 'ms', note: 'Exact target DNS duration.' },
    { id: 'transport-target', provenance: 'LOCAL MEASURED', category: 'transport', subject: 'target TLS duration', availability: 'available', observedAt: '2026-08-11T23:30:02.000Z', target: { kind: 'service', value: 'https://example.test:443' }, value: 24, unit: 'ms', note: 'Exact target transport context.' },
    { id: 'transport-other', provenance: 'LOCAL MEASURED', category: 'transport', subject: 'speed test throughput', availability: 'available', observedAt: '2026-08-11T23:30:02.000Z', target: { kind: 'service', value: 'https://speed.example.test' }, value: 500000000, unit: 'bits-per-second', note: 'Other-target throughput.' },
    { id: 'icmp-ignored', provenance: 'LOCAL MEASURED', category: 'icmp', subject: 'ping', availability: 'available', observedAt: '2026-08-11T23:30:02.000Z', target: { kind: 'ip', value: '203.0.113.42' }, value: 20, unit: 'ms', note: 'Not part of first sidecar scenes.' },
  ],
  warnings: [],
});

const routing = measuredEvidenceForScene(snapshot, routingQuery);
assert.deepEqual(routing.matchedTarget.map((fact) => fact.id), ['route-specific']);
assert.deepEqual(routing.localContext.map((fact) => fact.id), ['route-default', 'interface']);
assert.deepEqual(routing.otherTarget.map((fact) => fact.id), []);

const dns = measuredEvidenceForScene(snapshot, dnsQuery);
assert.deepEqual(dns.matchedTarget.map((fact) => fact.id), ['dns-target']);
assert.deepEqual(dns.localContext.map((fact) => fact.id), ['dns-resolver']);
assert.deepEqual(dns.otherTarget.map((fact) => fact.id), []);

const transport = measuredEvidenceForScene(snapshot, query);
assert.deepEqual(transport.matchedTarget.map((fact) => fact.id), ['transport-target']);
assert.deepEqual(transport.localContext.map((fact) => fact.id), []);
assert.deepEqual(transport.otherTarget.map((fact) => fact.id), ['transport-other']);
assert.equal(transport.matchedTarget.some((fact) => fact.id === 'transport-other'), false, 'category equality alone must never create a target match');

const journeyConfig = { transportProfile: 'quic-h3', dnsProfile: 'cache-hit', impairmentProfile: 'composed', modifierIds: ['route-leak', 'latency-spike'] };
const before = buildJourneyScenario('example.test', journeyConfig);
const stateBefore = journeyStateAt(before, 5500);
const bytesBefore = JSON.stringify({ scenario: before, state: stateBefore });
measuredEvidenceForScene(snapshot, routingQuery);
measuredEvidenceForScene(snapshot, dnsQuery);
measuredEvidenceForScene(snapshot, query);
const after = buildJourneyScenario('example.test', journeyConfig);
const stateAfter = journeyStateAt(after, 5500);
assert.deepEqual(after, before, 'measured evidence classification must not alter Journey construction');
assert.deepEqual(stateAfter, stateBefore, 'measured evidence classification must not alter Journey reducer state');
assert.equal(JSON.stringify({ scenario: after, state: stateAfter }), bytesBefore);

const source = readFileSync(new URL('../src/measurement/sceneEvidence.ts', import.meta.url), 'utf8');
assert.doesNotMatch(source, /from ['"][^'"]*journey/i, 'measured scene compatibility model must not import Journey model code');
assert.doesNotMatch(source, /JourneyEvent|JourneyScenario|JourneyModifier|JourneyState/, 'measured scene compatibility model must expose no Journey model types');

console.log('Measured scene evidence contract passed: target matching fails closed and scene classification cannot modify simulated Journey truth.');

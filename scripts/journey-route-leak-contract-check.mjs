import assert from 'node:assert/strict';
import { readJourneyBrowserConfig, writeJourneyBrowserConfig } from '../src/journey/browser.ts';
import { enumeratePolicyPaths, simulatedAsGraph, traversalFor } from '../src/internet/asModel.ts';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';
import { normalizeJourneyModifierIds } from '../src/journey/modifiers.ts';
import {
  createPortableJourneyScenario,
  decodeJourneyQuery,
  encodeJourneyQuery,
  parseJourneyScenarioJson,
  serializeJourneyScenario,
} from '../src/journey/scenario.ts';

const config = (transportProfile, dnsProfile, modifierIds) => ({
  transportProfile,
  dnsProfile,
  impairmentProfile: modifierIds.length > 1 ? 'composed' : modifierIds[0] ?? 'clean',
  modifierIds,
});

function event(scenario, id) {
  const found = scenario.events.find((candidate) => candidate.id === id);
  assert.ok(found, `missing event ${id}`);
  return found;
}

function assertStrict(scenario) {
  assert.equal(new Set(scenario.events.map((current) => current.id)).size, scenario.events.length);
  assert.equal(new Set(scenario.events.map((current) => current.atMs)).size, scenario.events.length);
  assert.ok(scenario.events.every((current, index) => index === 0 || current.atMs > scenario.events[index - 1].atMs));
}

function eventSignature(scenario) {
  return scenario.events.map((current) => [current.id, current.atMs, current.kind, current.policyMetrics ?? null]);
}

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

function traversal(asns) {
  const result = [];
  for (let index = 0; index < asns.length - 1; index += 1) {
    const from = asns[index];
    const to = asns[index + 1];
    const relationship = simulatedAsGraph.relationships.find((candidate) => traversalFor(candidate, from, to) !== null);
    assert.ok(relationship, `missing AS relationship ${from} → ${to}`);
    result.push(traversalFor(relationship, from, to));
  }
  return result;
}

const legitimatePath = [64504, 65540, 65538];
const leakedPath = [64504, 64500, 65538];
const policyCandidates = enumeratePolicyPaths(simulatedAsGraph, 64504, 65538);
const legitimateCandidate = policyCandidates.find((candidate) => candidate.asns.join(',') === legitimatePath.join(','));
assert.ok(legitimateCandidate, 'Lab 05 model must contain the legitimate AS64504 → AS65540 → AS65538 path.');
assert.equal(legitimateCandidate.localPreference, 200);
assert.deepEqual(traversal(legitimatePath), ['peer', 'down']);
assert.deepEqual(traversal(leakedPath), ['down', 'peer']);
assert.equal(policyCandidates.some((candidate) => candidate.asns.join(',') === leakedPath.join(',')), false, 'down → peer leaked path must not pass the normal valley-free enumerator');

assert.deepEqual(normalizeJourneyModifierIds(['route-leak']), ['route-leak']);
assert.deepEqual(
  normalizeJourneyModifierIds(['partition', 'congestion', 'single-loss', 'server-failure', 'route-leak', 'route-failure', 'dns-failure', 'latency-spike']),
  ['dns-failure', 'route-failure', 'route-leak', 'server-failure', 'single-loss', 'latency-spike', 'congestion', 'partition'],
);

for (const dnsProfile of ['cache-miss', 'cache-hit']) {
  for (const transportProfile of ['tcp-h2', 'quic-h3']) {
    const clean = buildJourneyScenario('example.test', config(transportProfile, dnsProfile, []));
    const scenario = buildJourneyScenario('example.test', config(transportProfile, dnsProfile, ['route-leak']));
    const repeat = buildJourneyScenario('example.test', config(transportProfile, dnsProfile, ['route-leak']));
    assert.deepEqual(scenario.modifierIds, ['route-leak']);
    assert.equal(scenario.impairmentProfile, 'route-leak');
    assert.equal(scenario.durationMs, clean.durationMs + 1600);
    assert.deepEqual(eventSignature(scenario), eventSignature(repeat));
    assertStrict(scenario);

    const basePath = event(scenario, 'as-path');
    const advertised = event(scenario, 'route-leak-advertised');
    const selected = event(scenario, 'route-leak-selected');
    const anomaly = event(scenario, 'route-leak-anomaly');
    const withdrawn = event(scenario, 'route-leak-withdrawn');
    const restored = event(scenario, 'route-leak-restored');
    const physical = event(scenario, 'physical-context');
    const firstTransport = scenario.events.find((current) => current.kind === 'transport.segment');
    assert.ok(firstTransport);
    assert.ok(basePath.atMs < advertised.atMs);
    assert.ok(advertised.atMs < selected.atMs && selected.atMs < anomaly.atMs && anomaly.atMs < withdrawn.atMs && withdrawn.atMs < restored.atMs);
    assert.ok(restored.atMs < physical.atMs && physical.atMs < firstTransport.atMs);
    assert.equal(firstTransport.atMs, clean.events.find((current) => current.kind === 'transport.segment').atMs + 1600);

    for (const current of [advertised, selected, anomaly, withdrawn, restored]) {
      assert.deepEqual(current.policyMetrics?.legitimatePathAsns, legitimatePath);
      assert.deepEqual(current.policyMetrics?.leakedPathAsns, leakedPath);
      assert.deepEqual(current.policyMetrics?.legitimateTraversal, ['peer', 'down']);
      assert.deepEqual(current.policyMetrics?.leakedTraversal, ['down', 'peer']);
      assert.equal(current.policyMetrics?.legitimateLocalPreference, 200);
      assert.equal(current.policyMetrics?.leakedLocalPreference, 300);
      assert.equal(current.policyMetrics?.leakSourceAsn, 64500);
      assert.equal(current.policyMetrics?.decisionAsn, 64504);
      assert.equal(current.policyMetrics?.destinationAsn, 65538);
      assert.equal(current.policyMetrics?.learnedFrom, 'peer');
      assert.equal(current.policyMetrics?.exportedTo, 'provider');
      assert.equal(current.policyMetrics?.reachable, true);
    }
    assert.equal(advertised.policyMetrics?.activeLocalPreference, 200);
    assert.equal(advertised.policyMetrics?.selectedPathPolicyCompliant, true);
    assert.equal(advertised.policyMetrics?.exportPolicyCompliant, false);
    assert.deepEqual(selected.policyMetrics?.activePathAsns, leakedPath);
    assert.equal(selected.policyMetrics?.activeLocalPreference, 300);
    assert.equal(selected.policyMetrics?.selectedPathPolicyCompliant, false);
    assert.equal(selected.policyMetrics?.exportPolicyCompliant, false);
    assert.deepEqual(restored.policyMetrics?.activePathAsns, legitimatePath);
    assert.equal(restored.policyMetrics?.activeLocalPreference, 200);
    assert.equal(restored.policyMetrics?.selectedPathPolicyCompliant, true);
    assert.equal(restored.policyMetrics?.exportPolicyCompliant, true);

    const selectedState = journeyStateAt(scenario, selected.atMs);
    assert.equal(selectedState.route, 'internet-path-ready');
    assert.equal(selectedState.transport, 'closed');
    assert.equal(selectedState.policy, 'leaked');
    assert.equal(selectedState.impairmentState, 'policy-leak');
    assert.equal(selectedState.policyMetrics?.reachable, true);
    assert.equal(selectedState.policyMetrics?.selectedPathPolicyCompliant, false);

    const anomalyState = journeyStateAt(scenario, anomaly.atMs);
    assert.equal(anomalyState.route, 'internet-path-ready');
    assert.equal(anomalyState.policy, 'anomaly');
    assert.equal(anomalyState.impairmentState, 'policy-anomaly');
    assert.equal(anomalyState.policyMetrics?.reachable, true);

    const restoredState = journeyStateAt(scenario, restored.atMs);
    assert.equal(restoredState.policy, 'restored');
    assert.equal(restoredState.impairmentState, 'policy-restored');
    assert.deepEqual(restoredState.policyMetrics?.activePathAsns, legitimatePath);
    assert.equal(journeyStateAt(scenario, physical.atMs).impairmentState, 'normalized');

    const forbiddenKinds = new Set([
      'route.failure', 'route.invalidated', 'route.recompute', 'route.alternate-installed',
      'route.partition', 'route.partition-recompute', 'route.unreachable',
      'transport.loss', 'transport.loss-detected', 'transport.retransmit', 'transport.stalled',
      'server.unavailable', 'http.service-unavailable', 'journey.failed',
    ]);
    assert.equal(scenario.events.some((current) => forbiddenKinds.has(current.kind)), false);
    assert.equal(scenario.events.some((current) => current.transportMetrics?.timerLabel === 'RTO' || current.transportMetrics?.timerLabel === 'PTO'), false);
  }
}

const composedIds = ['dns-failure', 'route-failure', 'route-leak', 'server-failure', 'single-loss', 'latency-spike', 'congestion', 'partition'];
const composed = buildJourneyScenario('example.test', config('quic-h3', 'cache-miss', [...composedIds].reverse()));
const composedCanonical = buildJourneyScenario('example.test', config('quic-h3', 'cache-miss', composedIds));
assert.deepEqual(composed.modifierIds, composedIds);
assert.deepEqual(eventSignature(composed), eventSignature(composedCanonical));
assert.ok(event(composed, 'route-alternate-installed').atMs < event(composed, 'route-leak-advertised').atMs);
assert.ok(event(composed, 'route-leak-restored').atMs < event(composed, 'quic-initial').atMs);
assert.ok(event(composed, 'route-leak-restored').atMs < event(composed, 'server-service-unavailable').atMs);
assert.ok(event(composed, 'server-get-retry').atMs < event(composed, 'quic-loss').atMs);
assert.ok(event(composed, 'quic-recovered').atMs < event(composed, 'quic-latency-start').atMs);
assert.ok(event(composed, 'quic-latency-clear').atMs < event(composed, 'quic-congestion-queue-start').atMs);
assert.ok(event(composed, 'quic-congestion-cleared').atMs < event(composed, 'partition-cut').atMs);
assert.equal(composed.events.some((current) => current.kind === 'journey.complete'), false);
assert.equal(composed.events.some((current) => current.kind === 'journey.failed'), true);
assertStrict(composed);

const outageComposition = buildJourneyScenario('example.test', config('tcp-h2', 'cache-hit', ['route-leak', 'path-outage', 'partition']));
assert.deepEqual(outageComposition.modifierIds, ['route-leak', 'path-outage', 'partition']);
assert.ok(event(outageComposition, 'route-leak-restored').atMs < event(outageComposition, 'tcp-syn').atMs);
assert.ok(event(outageComposition, 'tcp-outage-recovered').atMs < event(outageComposition, 'partition-cut').atMs);

const portableSingle = createPortableJourneyScenario({
  name: 'Reachable but leaked',
  hostname: 'example.test',
  config: config('tcp-h2', 'cache-hit', ['route-leak']),
  timeMs: 5000,
});
assert.equal(portableSingle.version, 1);
assert.equal(portableSingle.impairmentProfile, 'route-leak');
const portableSingleQuery = decodeJourneyQuery(encodeJourneyQuery(portableSingle));
assert.equal(portableSingleQuery?.impairmentProfile, 'route-leak');
assert.equal(parseJourneyScenarioJson(serializeJourneyScenario(portableSingle)).impairmentProfile, 'route-leak');

const portableComposed = createPortableJourneyScenario({
  hostname: 'example.test',
  config: config('quic-h3', 'cache-miss', ['route-leak', 'server-failure']),
  timeMs: 9000,
});
assert.equal(portableComposed.version, 2);
assert.deepEqual(portableComposed.modifiers, ['route-leak', 'server-failure']);
assert.deepEqual(decodeJourneyQuery(encodeJourneyQuery(portableComposed))?.modifiers, ['route-leak', 'server-failure']);
assert.deepEqual(parseJourneyScenarioJson(serializeJourneyScenario(portableComposed)).modifiers, ['route-leak', 'server-failure']);

const singleStorage = memoryStorage();
writeJourneyBrowserConfig(config('tcp-h2', 'cache-hit', ['route-leak']), singleStorage);
assert.equal(readJourneyBrowserConfig(singleStorage).impairmentProfile, 'route-leak');

const composedStorage = memoryStorage();
writeJourneyBrowserConfig(config('quic-h3', 'cache-miss', ['server-failure', 'route-leak']), composedStorage);
assert.deepEqual(readJourneyBrowserConfig(composedStorage).modifierIds, ['route-leak', 'server-failure']);

console.log('Journey route-leak contract passed: Lab 05 policy reuse, reachable policy anomaly, deterministic selection/restoration, composition, sharing, and persistence.');

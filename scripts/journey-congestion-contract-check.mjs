import assert from 'node:assert/strict';
import { readJourneyBrowserConfig, writeJourneyBrowserConfig } from '../src/journey/browser.ts';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';
import { normalizeJourneyModifierIds } from '../src/journey/modifiers.ts';
import { createPortableJourneyScenario, decodeJourneyQuery, encodeJourneyQuery } from '../src/journey/scenario.ts';

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

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

assert.deepEqual(normalizeJourneyModifierIds(['congestion']), ['congestion']);
assert.deepEqual(
  normalizeJourneyModifierIds(['congestion', 'single-loss', 'latency-spike', 'path-outage']),
  ['single-loss', 'path-outage', 'latency-spike', 'congestion'],
);

for (const transportProfile of ['tcp-h2', 'quic-h3']) {
  const scenario = buildJourneyScenario('example.test', config(transportProfile, 'cache-hit', ['congestion']));
  assert.deepEqual(scenario.modifierIds, ['congestion']);
  assert.equal(scenario.impairmentProfile, 'congestion');
  assertStrict(scenario);

  const prefix = transportProfile === 'tcp-h2' ? 'tcp' : 'quic';
  const queueStart = event(scenario, `${prefix}-congestion-queue-start`);
  const queueHigh = event(scenario, `${prefix}-congestion-queue-high`);
  const ecn = event(scenario, `${prefix}-congestion-ecn`);
  const response = event(scenario, `${prefix}-congestion-response`);
  const cleared = event(scenario, `${prefix}-congestion-cleared`);

  assert.ok(queueStart.atMs < queueHigh.atMs && queueHigh.atMs < ecn.atMs && ecn.atMs < response.atMs && response.atMs < cleared.atMs);
  assert.ok(queueStart.congestionMetrics.queueOccupancyPackets < queueHigh.congestionMetrics.queueOccupancyPackets);
  assert.ok(queueHigh.congestionMetrics.queueDelayMs > queueStart.congestionMetrics.queueDelayMs);
  assert.equal(ecn.congestionMetrics.droppedPackets, 0);
  assert.ok(ecn.congestionMetrics.ecnCeMarks > 0);
  assert.ok(response.congestionMetrics.congestionWindowPackets < ecn.congestionMetrics.congestionWindowPackets);
  assert.ok(cleared.congestionMetrics.queueOccupancyPackets < response.congestionMetrics.queueOccupancyPackets);
  assert.ok(cleared.congestionMetrics.queueDelayMs < response.congestionMetrics.queueDelayMs);
  assert.equal(cleared.congestionMetrics.droppedPackets, 0);
  assert.equal(scenario.events.some((current) => current.kind === 'transport.loss' || current.kind === 'transport.loss-detected' || current.kind === 'transport.retransmit'), false);

  const responseState = journeyStateAt(scenario, response.atMs);
  assert.equal(responseState.impairmentState, 'congestion-responding');
  assert.equal(responseState.congestionMetrics?.congestionWindowPackets, 6);
  assert.equal(responseState.congestionMetrics?.droppedPackets, 0);
  assert.equal(responseState.transportMetrics?.lossDetected, false);

  if (transportProfile === 'tcp-h2') {
    assert.equal(ecn.congestionMetrics.signal, 'CE');
    assert.equal(response.congestionMetrics.signal, 'ECE/CWR');
    assert.match(response.detail, /TCP sequence gap|no TCP sequence gap/i);
  } else {
    assert.equal(ecn.congestionMetrics.signal, 'CE');
    assert.equal(response.congestionMetrics.signal, 'ACK_ECN');
    assert.match(response.detail, /packet-number gap/i);
  }
}

const composed = buildJourneyScenario('example.test', config('quic-h3', 'cache-hit', ['congestion', 'latency-spike', 'path-outage', 'single-loss']));
assert.deepEqual(composed.modifierIds, ['single-loss', 'path-outage', 'latency-spike', 'congestion']);
assert.ok(event(composed, 'quic-recovered').atMs < event(composed, 'path-outage-primary-fails').atMs);
assert.ok(event(composed, 'quic-outage-recovered').atMs < event(composed, 'quic-latency-start').atMs);
assert.ok(event(composed, 'quic-latency-clear').atMs < event(composed, 'quic-congestion-queue-start').atMs);
assertStrict(composed);

const portableSingle = createPortableJourneyScenario({
  name: 'ECN queue growth',
  hostname: 'example.test',
  config: config('tcp-h2', 'cache-miss', ['congestion']),
  timeMs: 9000,
});
assert.equal(portableSingle.version, 1);
assert.equal(portableSingle.impairmentProfile, 'congestion');
const singleQuery = encodeJourneyQuery(portableSingle);
assert.equal(decodeJourneyQuery(singleQuery)?.version, 1);

const portableComposed = createPortableJourneyScenario({
  hostname: 'example.test',
  config: config('quic-h3', 'cache-hit', ['latency-spike', 'congestion']),
  timeMs: 9000,
});
assert.equal(portableComposed.version, 2);
assert.deepEqual(portableComposed.modifiers, ['latency-spike', 'congestion']);
assert.deepEqual(decodeJourneyQuery(encodeJourneyQuery(portableComposed))?.modifiers, ['latency-spike', 'congestion']);

const storage = memoryStorage();
writeJourneyBrowserConfig(config('tcp-h2', 'cache-hit', ['congestion']), storage);
assert.equal(readJourneyBrowserConfig(storage).impairmentProfile, 'congestion');

console.log('Journey congestion contract passed: queue growth, ECN feedback, cwnd response, no-drop semantics, composition, sharing, and persistence.');

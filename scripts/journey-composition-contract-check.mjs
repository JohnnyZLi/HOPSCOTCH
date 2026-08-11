import assert from 'node:assert/strict';
import { readJourneyBrowserConfig, seedJourneyBrowserScenario, writeJourneyBrowserConfig } from '../src/journey/browser.ts';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';
import { normalizeJourneyModifierIds } from '../src/journey/modifiers.ts';
import { createPortableJourneyScenario } from '../src/journey/scenario.ts';

const config = (transportProfile, dnsProfile, modifierIds) => ({
  transportProfile,
  dnsProfile,
  impairmentProfile: modifierIds.length > 1 ? 'composed' : modifierIds[0] ?? 'clean',
  modifierIds,
});

function projection(scenario) {
  return scenario.events.map(({ id, atMs, kind, phase }) => ({ id, atMs, kind, phase }));
}

function eventTimes(scenario, ids) {
  return ids.map((id) => {
    const found = scenario.events.find((event) => event.id === id);
    assert.ok(found, `missing event ${id}`);
    return found.atMs;
  });
}

function validateCanonicalScenario(scenario, expectedModifiers, expectedCount, expectedDuration) {
  assert.deepEqual(scenario.modifierIds, expectedModifiers);
  assert.deepEqual(scenario.appliedModifierIds, expectedModifiers);
  assert.equal(scenario.impairmentProfile, expectedModifiers.length > 1 ? 'composed' : expectedModifiers[0] ?? 'clean');
  assert.equal(scenario.events.length, expectedCount);
  assert.equal(scenario.durationMs, expectedDuration);
  assert.equal(new Set(scenario.events.map((event) => event.id)).size, scenario.events.length);
  assert.equal(new Set(scenario.events.map((event) => event.atMs)).size, scenario.events.length);
  assert.ok(scenario.events.every((event, index) => index === 0 || event.atMs > scenario.events[index - 1].atMs));
  const start = journeyStateAt(scenario, 0);
  assert.deepEqual(start.modifierIds, expectedModifiers);
  assert.equal(start.impairmentState, expectedModifiers.length ? 'armed' : 'clean');
}

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    snapshot() { return Object.fromEntries(values); },
  };
}

assert.deepEqual(normalizeJourneyModifierIds([]), []);
assert.deepEqual(normalizeJourneyModifierIds(['single-loss']), ['single-loss']);
assert.deepEqual(
  normalizeJourneyModifierIds(['latency-spike', 'route-failure', 'single-loss', 'route-failure']),
  ['route-failure', 'single-loss', 'latency-spike'],
);
assert.throws(() => normalizeJourneyModifierIds(['unknown']), /unknown journey modifier/i);

const routeLossA = buildJourneyScenario('example.test', config('quic-h3', 'cache-hit', ['route-failure', 'single-loss']));
const routeLossB = buildJourneyScenario('example.test', config('quic-h3', 'cache-hit', ['single-loss', 'route-failure']));
validateCanonicalScenario(routeLossA, ['route-failure', 'single-loss'], 31, 15800);
assert.equal(routeLossA.id, routeLossB.id);
assert.deepEqual(projection(routeLossA), projection(routeLossB));
assert.deepEqual(eventTimes(routeLossA, ['route-primary-fails', 'route-primary-invalidated', 'route-spf-recompute', 'route-alternate-installed']), [1500, 1780, 2160, 2520]);
assert.deepEqual(eventTimes(routeLossA, ['quic-loss', 'quic-gap', 'quic-retransmit', 'quic-recovered']), [8810, 9050, 9350, 9700]);
assert.equal(routeLossA.events.find((event) => event.id === 'quic-initial').atMs, 4200);
assert.match(routeLossA.events.find((event) => event.id === 'quic-retransmit').title, /4113/);

const routeLatency = buildJourneyScenario('example.test', config('quic-h3', 'cache-hit', ['latency-spike', 'route-failure']));
validateCanonicalScenario(routeLatency, ['route-failure', 'latency-spike'], 30, 15400);
assert.deepEqual(eventTimes(routeLatency, ['route-primary-fails', 'route-primary-invalidated', 'route-spf-recompute', 'route-alternate-installed']), [1500, 1780, 2160, 2520]);
assert.deepEqual(eventTimes(routeLatency, ['quic-latency-start', 'quic-rtt-update', 'quic-latency-clear']), [8810, 9150, 9550]);
assert.equal(routeLatency.events.find((event) => event.id === 'quic-rtt-update').transportMetrics.timerMs, 264.4);
assert.ok(!routeLatency.events.some((event) => event.kind === 'transport.loss' || event.kind === 'transport.retransmit'));

const lossLatency = buildJourneyScenario('example.test', config('quic-h3', 'cache-hit', ['latency-spike', 'single-loss']));
validateCanonicalScenario(lossLatency, ['single-loss', 'latency-spike'], 30, 15600);
assert.deepEqual(eventTimes(lossLatency, ['quic-loss', 'quic-gap', 'quic-retransmit', 'quic-recovered']), [7410, 7650, 7950, 8300]);
assert.deepEqual(eventTimes(lossLatency, ['quic-latency-start', 'quic-rtt-update', 'quic-latency-clear']), [8460, 8800, 9200]);
assert.ok(lossLatency.events.find((event) => event.id === 'quic-recovered').atMs < lossLatency.events.find((event) => event.id === 'quic-latency-start').atMs);

const triple = buildJourneyScenario('example.test', config('quic-h3', 'cache-hit', ['latency-spike', 'route-failure', 'single-loss']));
validateCanonicalScenario(triple, ['route-failure', 'single-loss', 'latency-spike'], 34, 17000);
assert.deepEqual(eventTimes(triple, ['route-primary-fails', 'route-primary-invalidated', 'route-spf-recompute', 'route-alternate-installed']), [1500, 1780, 2160, 2520]);
assert.deepEqual(eventTimes(triple, ['quic-loss', 'quic-gap', 'quic-retransmit', 'quic-recovered']), [8810, 9050, 9350, 9700]);
assert.deepEqual(eventTimes(triple, ['quic-latency-start', 'quic-rtt-update', 'quic-latency-clear']), [9860, 10200, 10600]);
assert.equal(triple.events.find((event) => event.id === 'packet-frame').atMs, 12120);

const tcpTriple = buildJourneyScenario('example.test', config('tcp-h2', 'cache-miss', ['single-loss', 'latency-spike', 'route-failure']));
validateCanonicalScenario(tcpTriple, ['route-failure', 'single-loss', 'latency-spike'], 41, 19200);
assert.deepEqual(eventTimes(tcpTriple, ['route-primary-fails', 'route-primary-invalidated', 'route-spf-recompute', 'route-alternate-installed']), [3720, 4000, 4380, 4740]);
assert.deepEqual(eventTimes(tcpTriple, ['tcp-loss', 'tcp-gap', 'tcp-retransmit', 'tcp-recovered']), [11110, 11350, 11650, 12000]);
assert.deepEqual(eventTimes(tcpTriple, ['tcp-latency-start', 'tcp-rtt-update', 'tcp-latency-clear']), [12160, 12500, 12900]);
assert.equal(tcpTriple.events.find((event) => event.id === 'packet-frame').atMs, 14320);

// Legacy callers remain exact when modifierIds is omitted.
const legacyLoss = buildJourneyScenario('example.test', { transportProfile: 'quic-h3', dnsProfile: 'cache-hit', impairmentProfile: 'single-loss' });
validateCanonicalScenario(legacyLoss, ['single-loss'], 27, 14400);
assert.deepEqual(eventTimes(legacyLoss, ['quic-loss', 'quic-gap', 'quic-retransmit', 'quic-recovered']), [7410, 7650, 7950, 8300]);

// Browser persistence stores the canonical set and migrates the old single-profile key.
const composedStorage = memoryStorage();
writeJourneyBrowserConfig(config('quic-h3', 'cache-hit', ['latency-spike', 'route-failure', 'single-loss']), composedStorage);
assert.deepEqual(readJourneyBrowserConfig(composedStorage), {
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  impairmentProfile: 'composed',
  modifierIds: ['route-failure', 'single-loss', 'latency-spike'],
});
assert.equal(composedStorage.snapshot()['hopscotch.journey.modifiers'], '["route-failure","single-loss","latency-spike"]');

const legacyStorage = memoryStorage({
  'hopscotch.journey.transport-profile': 'quic-h3',
  'hopscotch.journey.dns-profile': 'cache-hit',
  'hopscotch.journey.impairment-profile': 'route-failure',
});
assert.deepEqual(readJourneyBrowserConfig(legacyStorage), {
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  impairmentProfile: 'route-failure',
});

const portableTriple = createPortableJourneyScenario({
  name: 'Triple fault',
  hostname: 'example.test',
  config: config('tcp-h2', 'cache-miss', ['latency-spike', 'single-loss', 'route-failure']),
  timeMs: 12500,
});
const importedStorage = memoryStorage();
seedJourneyBrowserScenario(portableTriple, importedStorage);
assert.deepEqual(readJourneyBrowserConfig(importedStorage), {
  transportProfile: 'tcp-h2',
  dnsProfile: 'cache-miss',
  impairmentProfile: 'composed',
  modifierIds: ['route-failure', 'single-loss', 'latency-spike'],
});

console.log('Journey composition contract passed: canonical modifier sets, legacy compatibility, pair/triple composition, and browser persistence migration.');

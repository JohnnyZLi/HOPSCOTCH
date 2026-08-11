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

assert.deepEqual(normalizeJourneyModifierIds(['dns-failure']), ['dns-failure']);
assert.deepEqual(
  normalizeJourneyModifierIds(['congestion', 'dns-failure', 'single-loss', 'latency-spike', 'route-failure']),
  ['dns-failure', 'route-failure', 'single-loss', 'latency-spike', 'congestion'],
);

for (const transportProfile of ['tcp-h2', 'quic-h3']) {
  const cleanMiss = buildJourneyScenario('example.test', config(transportProfile, 'cache-miss', []));
  const miss = buildJourneyScenario('example.test', config(transportProfile, 'cache-miss', ['dns-failure']));
  assert.deepEqual(miss.modifierIds, ['dns-failure']);
  assert.equal(miss.impairmentProfile, 'dns-failure');
  assert.equal(miss.durationMs, cleanMiss.durationMs + 1200);
  assertStrict(miss);

  const recursive = event(miss, 'dns-recursive');
  const timeout = event(miss, 'dns-primary-timeout');
  const retry = event(miss, 'dns-secondary-retry');
  const root = event(miss, 'dns-root');
  assert.ok(recursive.atMs < timeout.atMs && timeout.atMs < retry.atMs && retry.atMs < root.atMs);
  assert.equal(timeout.kind, 'dns.timeout');
  assert.notEqual(timeout.kind, 'dns.answer');
  assert.notEqual(timeout.kind, 'dns.referral');
  assert.equal(retry.kind, 'dns.retry');
  assert.match(timeout.detail, /absence of a response/i);
  assert.match(retry.detail, /secondary recursive resolver/i);
  assert.equal(root.atMs, event(cleanMiss, 'dns-root').atMs + 1200);
  assert.equal(event(miss, 'route-lookup').atMs, event(cleanMiss, 'route-lookup').atMs + 1200);

  const timeoutState = journeyStateAt(miss, timeout.atMs);
  assert.equal(timeoutState.dns, 'timeout');
  assert.equal(timeoutState.impairmentState, 'dns-failed');
  assert.equal(timeoutState.resolvedAddress, null);
  const retryState = journeyStateAt(miss, retry.atMs);
  assert.equal(retryState.dns, 'retrying');
  assert.equal(retryState.impairmentState, 'dns-retrying');
  const rootState = journeyStateAt(miss, root.atMs);
  assert.equal(rootState.dns, 'resolving');
  assert.equal(rootState.impairmentState, 'normalized');

  assert.equal(miss.events.some((current) => current.kind === 'transport.loss' || current.kind === 'transport.loss-detected' || current.kind === 'transport.retransmit'), false);
}

const cleanHit = buildJourneyScenario('example.test', config('tcp-h2', 'cache-hit', []));
const hit = buildJourneyScenario('example.test', config('tcp-h2', 'cache-hit', ['dns-failure']));
assert.equal(hit.durationMs, cleanHit.durationMs);
assertStrict(hit);
const masked = event(hit, 'dns-outage-masked');
assert.equal(masked.kind, 'dns.failure-masked');
assert.match(masked.title, /cache hit masks/i);
assert.match(masked.detail, /no upstream query/i);
assert.equal(hit.events.some((current) => current.kind === 'dns.query' || current.kind === 'dns.timeout' || current.kind === 'dns.retry'), false);
const maskedState = journeyStateAt(hit, masked.atMs);
assert.equal(maskedState.dns, 'cached');
assert.equal(maskedState.impairmentState, 'dns-masked');
assert.equal(maskedState.resolvedAddress, hit.destinationAddress);
assert.equal(journeyStateAt(hit, event(hit, 'route-lookup').atMs).impairmentState, 'normalized');

const composed = buildJourneyScenario('example.test', config('quic-h3', 'cache-miss', ['congestion', 'dns-failure', 'route-failure', 'single-loss', 'latency-spike']));
assert.deepEqual(composed.modifierIds, ['dns-failure', 'route-failure', 'single-loss', 'latency-spike', 'congestion']);
assert.ok(event(composed, 'dns-secondary-retry').atMs < event(composed, 'route-primary-fails').atMs);
assert.ok(event(composed, 'route-alternate-installed').atMs < event(composed, 'quic-loss').atMs);
assert.ok(event(composed, 'quic-recovered').atMs < event(composed, 'quic-latency-start').atMs);
assert.ok(event(composed, 'quic-latency-clear').atMs < event(composed, 'quic-congestion-queue-start').atMs);
assertStrict(composed);

const singlePortable = createPortableJourneyScenario({
  name: 'DNS retry',
  hostname: 'example.test',
  config: config('tcp-h2', 'cache-miss', ['dns-failure']),
  timeMs: 1800,
});
assert.equal(singlePortable.version, 1);
assert.equal(singlePortable.impairmentProfile, 'dns-failure');
assert.equal(decodeJourneyQuery(encodeJourneyQuery(singlePortable))?.impairmentProfile, 'dns-failure');

const composedPortable = createPortableJourneyScenario({
  hostname: 'example.test',
  config: config('quic-h3', 'cache-miss', ['dns-failure', 'congestion']),
  timeMs: 9000,
});
assert.equal(composedPortable.version, 2);
assert.deepEqual(composedPortable.modifiers, ['dns-failure', 'congestion']);
assert.deepEqual(decodeJourneyQuery(encodeJourneyQuery(composedPortable))?.modifiers, ['dns-failure', 'congestion']);

const storage = memoryStorage();
writeJourneyBrowserConfig(config('tcp-h2', 'cache-hit', ['dns-failure']), storage);
assert.equal(readJourneyBrowserConfig(storage).impairmentProfile, 'dns-failure');

console.log('Journey DNS-failure contract passed: timeout/retry semantics, cache masking, composition, sharing, and persistence.');

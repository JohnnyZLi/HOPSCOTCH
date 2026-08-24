import assert from 'node:assert/strict';
import { readJourneyBrowserConfig, writeJourneyBrowserConfig } from '../src/journey/browser.ts';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';
import { normalizeJourneyModifierIds } from '../src/journey/modifiers.ts';
import { createPortableJourneyScenario } from '../src/journey/scenario.ts';

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

assert.deepEqual(normalizeJourneyModifierIds(['path-outage']), ['path-outage']);
assert.deepEqual(normalizeJourneyModifierIds(['latency-spike', 'path-outage', 'single-loss']), ['single-loss', 'path-outage', 'latency-spike']);
assert.throws(() => normalizeJourneyModifierIds(['route-failure', 'path-outage']), /mutually exclusive/i);

const tcp = buildJourneyScenario('example.test', config('tcp-h2', 'cache-hit', ['path-outage']));
assert.deepEqual(tcp.modifierIds, ['path-outage']);
assert.equal(tcp.impairmentProfile, 'path-outage');
assert.equal(tcp.durationMs, 23100);
assert.deepEqual(
  ['path-outage-primary-fails', 'path-outage-route-invalidated', 'path-outage-spf-recompute', 'path-outage-alternate-installed', 'tcp-outage-rto', 'tcp-outage-retransmit', 'tcp-outage-recovered'].map((id) => event(tcp, id).atMs),
  [14920, 15120, 15380, 15660, 15920, 16140, 16500],
);
assert.equal(event(tcp, 'tcp-outage-rto').transportMetrics.timerLabel, 'RTO');
assert.equal(event(tcp, 'tcp-outage-rto').transportMetrics.timerMs, 1000);
assert.equal(journeyStateAt(tcp, event(tcp, 'tcp-outage-rto').atMs).transportMetrics?.timerMs, 1000);
assert.match(event(tcp, 'tcp-outage-rto').detail, /not the duplicate-ACK fast-retransmit story/i);
assert.ok(event(tcp, 'path-outage-alternate-installed').atMs < event(tcp, 'tcp-outage-retransmit').atMs);
assertStrict(tcp);

const quic = buildJourneyScenario('example.test', config('quic-h3', 'cache-hit', ['path-outage']));
assert.deepEqual(quic.modifierIds, ['path-outage']);
assert.equal(quic.durationMs, 23100);
assert.deepEqual(
  ['path-outage-primary-fails', 'quic-outage-pto1', 'quic-outage-probe', 'path-outage-spf-recompute', 'quic-outage-pto2', 'path-outage-alternate-installed', 'quic-outage-retransmit', 'quic-outage-recovered'].map((id) => event(quic, id).atMs),
  [14660, 14800, 14970, 15120, 15260, 15400, 15580, 15820],
);
assert.equal(event(quic, 'quic-outage-pto1').transportMetrics.timerLabel, 'PTO');
assert.equal(event(quic, 'quic-outage-pto1').transportMetrics.timerMs, 89);
assert.equal(journeyStateAt(quic, event(quic, 'quic-outage-pto1').atMs).transportMetrics?.timerMs, 89);
assert.ok(event(quic, 'quic-outage-probe').atMs < event(quic, 'path-outage-alternate-installed').atMs);
assert.ok(event(quic, 'path-outage-alternate-installed').atMs < event(quic, 'quic-outage-retransmit').atMs);
assert.match(event(quic, 'quic-outage-retransmit').title, /new packet 4216/i);
assert.doesNotMatch(event(quic, 'quic-outage-retransmit').detail, /TCP/);
assertStrict(quic);

const composed = buildJourneyScenario('example.test', config('quic-h3', 'cache-hit', ['latency-spike', 'single-loss', 'path-outage']));
assert.deepEqual(composed.modifierIds, ['single-loss', 'path-outage', 'latency-spike']);
assert.ok(event(composed, 'quic-recovered').atMs < event(composed, 'path-outage-primary-fails').atMs);
assert.ok(event(composed, 'quic-outage-recovered').atMs < event(composed, 'quic-latency-start').atMs);
assertStrict(composed);

const portableSingle = createPortableJourneyScenario({ name: 'Mid-transfer outage', hostname: 'example.test', config: config('tcp-h2', 'cache-miss', ['path-outage']), timeMs: 9000 });
assert.equal(portableSingle.version, 1);
assert.equal(portableSingle.impairmentProfile, 'path-outage');
const portableComposed = createPortableJourneyScenario({ hostname: 'example.test', config: config('quic-h3', 'cache-hit', ['path-outage', 'latency-spike']), timeMs: 8000 });
assert.equal(portableComposed.version, 2);
assert.deepEqual(portableComposed.modifiers, ['path-outage', 'latency-spike']);

const storage = memoryStorage();
writeJourneyBrowserConfig(config('tcp-h2', 'cache-hit', ['path-outage']), storage);
assert.equal(readJourneyBrowserConfig(storage).impairmentProfile, 'path-outage');

console.log('Journey path-outage contract passed: cross-layer routing failure, TCP RTO recovery, QUIC PTO recovery, composition, sharing, and persistence.');

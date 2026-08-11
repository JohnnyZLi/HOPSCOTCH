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

function countKind(scenario, kind) {
  return scenario.events.filter((candidate) => candidate.kind === kind).length;
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

assert.deepEqual(normalizeJourneyModifierIds(['partition']), ['partition']);
assert.deepEqual(
  normalizeJourneyModifierIds(['partition', 'congestion', 'server-failure', 'dns-failure', 'single-loss', 'latency-spike']),
  ['dns-failure', 'server-failure', 'single-loss', 'latency-spike', 'congestion', 'partition'],
);

for (const transportProfile of ['tcp-h2', 'quic-h3']) {
  const clean = buildJourneyScenario('example.test', config(transportProfile, 'cache-hit', []));
  const scenario = buildJourneyScenario('example.test', config(transportProfile, 'cache-hit', ['partition']));
  assert.deepEqual(scenario.modifierIds, ['partition']);
  assert.equal(scenario.impairmentProfile, 'partition');
  assert.equal(scenario.durationMs, clean.durationMs);
  assertStrict(scenario);

  const cut = event(scenario, 'partition-cut');
  const recompute = event(scenario, 'partition-recompute');
  const unreachable = event(scenario, 'partition-unreachable');
  const stalled = event(scenario, 'partition-transport-stalled');
  const failed = event(scenario, 'partition-terminal');
  assert.ok(cut.atMs < recompute.atMs && recompute.atMs < unreachable.atMs && unreachable.atMs < stalled.atMs && stalled.atMs < failed.atMs);
  assert.equal(failed.atMs, event(clean, 'complete').atMs);

  for (const current of [cut, recompute, unreachable, stalled, failed]) {
    assert.deepEqual(current.routeMetrics?.failedLinkIds, ['r1-core', 'r2-core']);
    assert.equal(current.routeMetrics?.candidateRouteCount, 0);
    assert.equal(current.routeMetrics?.recoveryAvailable, false);
    assert.equal(current.routeMetrics?.activePath, 'none');
  }

  assert.equal(countKind(scenario, 'response.ready'), 0);
  assert.equal(countKind(scenario, 'transfer.complete'), 0);
  assert.equal(countKind(scenario, 'journey.complete'), 0);
  assert.equal(countKind(scenario, 'journey.failed'), 1);

  const unreachableState = journeyStateAt(scenario, unreachable.atMs);
  assert.equal(unreachableState.route, 'unreachable');
  assert.equal(unreachableState.impairmentState, 'unreachable');
  assert.equal(unreachableState.routeMetrics?.activePath, 'none');
  assert.equal(unreachableState.routeMetrics?.candidateRouteCount, 0);

  const stalledState = journeyStateAt(scenario, stalled.atMs);
  assert.equal(stalledState.transport, 'stalled');
  assert.notEqual(stalledState.transport, 'closed');
  assert.equal(stalledState.route, 'unreachable');

  const failedState = journeyStateAt(scenario, failed.atMs);
  assert.equal(failedState.route, 'unreachable');
  assert.equal(failedState.transport, 'stalled');
  assert.equal(failedState.http, 'stalled');
  assert.equal(failedState.responseReady, false);
  assert.equal(failedState.journeyComplete, false);
  assert.equal(failedState.journeyFailed, true);
  assert.equal(failedState.failureReason, 'network-unreachable');

  assert.equal(scenario.events.some((current) => current.atMs > unreachable.atMs && current.kind === 'route.alternate-installed'), false);
  assert.equal(scenario.events.some((current) => current.atMs > unreachable.atMs && current.kind === 'transport.recovered'), false);
  assert.equal(scenario.events.some((current) => current.atMs > cut.atMs && current.kind === 'transport.retransmit'), false);
  assert.equal(scenario.events.some((current) => current.atMs >= cut.atMs && (current.transportMetrics?.timerLabel === 'RTO' || current.transportMetrics?.timerLabel === 'PTO')), false);
  assert.match(stalled.detail, /does not mean the connection is already closed|not.*closed/i);
  assert.match(failed.detail, /no route|unreachable/i);
}

const composedPrior = buildJourneyScenario('example.test', config('quic-h3', 'cache-miss', ['dns-failure', 'route-failure', 'server-failure', 'single-loss', 'latency-spike', 'congestion']));
const composed = buildJourneyScenario('example.test', config('quic-h3', 'cache-miss', ['partition', 'congestion', 'server-failure', 'dns-failure', 'route-failure', 'single-loss', 'latency-spike']));
assert.deepEqual(composed.modifierIds, ['dns-failure', 'route-failure', 'server-failure', 'single-loss', 'latency-spike', 'congestion', 'partition']);
assert.equal(event(composed, 'partition-terminal').atMs, event(composedPrior, 'complete').atMs);
assert.ok(event(composed, 'dns-secondary-retry').atMs < event(composed, 'route-primary-fails').atMs);
assert.ok(event(composed, 'route-alternate-installed').atMs < event(composed, 'server-service-unavailable').atMs);
assert.ok(event(composed, 'server-get-retry').atMs < event(composed, 'quic-loss').atMs);
assert.ok(event(composed, 'quic-recovered').atMs < event(composed, 'quic-latency-start').atMs);
assert.ok(event(composed, 'quic-latency-clear').atMs < event(composed, 'quic-congestion-queue-start').atMs);
assert.ok(event(composed, 'quic-congestion-cleared').atMs < event(composed, 'partition-cut').atMs);
assert.equal(countKind(composed, 'journey.complete'), 0);
assert.equal(countKind(composed, 'journey.failed'), 1);
assertStrict(composed);

const outageThenPartition = buildJourneyScenario('example.test', config('tcp-h2', 'cache-hit', ['path-outage', 'partition']));
assert.deepEqual(outageThenPartition.modifierIds, ['path-outage', 'partition']);
assert.ok(event(outageThenPartition, 'tcp-outage-recovered').atMs < event(outageThenPartition, 'partition-cut').atMs);
assert.equal(journeyStateAt(outageThenPartition, event(outageThenPartition, 'partition-terminal').atMs).failureReason, 'network-unreachable');

const portableSingle = createPortableJourneyScenario({
  name: 'Terminal partition',
  hostname: 'example.test',
  config: config('tcp-h2', 'cache-hit', ['partition']),
  timeMs: 12000,
});
assert.equal(portableSingle.version, 1);
assert.equal(portableSingle.impairmentProfile, 'partition');
assert.equal(decodeJourneyQuery(encodeJourneyQuery(portableSingle))?.impairmentProfile, 'partition');

const portableComposed = createPortableJourneyScenario({
  hostname: 'example.test',
  config: config('quic-h3', 'cache-miss', ['server-failure', 'partition']),
  timeMs: 14000,
});
assert.equal(portableComposed.version, 2);
assert.deepEqual(portableComposed.modifiers, ['server-failure', 'partition']);
assert.deepEqual(decodeJourneyQuery(encodeJourneyQuery(portableComposed))?.modifiers, ['server-failure', 'partition']);

const storage = memoryStorage();
writeJourneyBrowserConfig(config('tcp-h2', 'cache-hit', ['partition']), storage);
assert.equal(readJourneyBrowserConfig(storage).impairmentProfile, 'partition');

console.log('Journey partition contract passed: dual-path cut, zero-route SPF, stalled transport, terminal failure, composition, sharing, and persistence.');

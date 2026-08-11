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

function firstKind(scenario, kind) {
  const found = scenario.events.find((candidate) => candidate.kind === kind);
  assert.ok(found, `missing kind ${kind}`);
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

assert.deepEqual(normalizeJourneyModifierIds(['server-failure']), ['server-failure']);
assert.deepEqual(
  normalizeJourneyModifierIds(['congestion', 'server-failure', 'dns-failure', 'single-loss', 'latency-spike', 'route-failure']),
  ['dns-failure', 'route-failure', 'server-failure', 'single-loss', 'latency-spike', 'congestion'],
);

for (const transportProfile of ['tcp-h2', 'quic-h3']) {
  const clean = buildJourneyScenario('example.test', config(transportProfile, 'cache-hit', []));
  const scenario = buildJourneyScenario('example.test', config(transportProfile, 'cache-hit', ['server-failure']));
  assert.deepEqual(scenario.modifierIds, ['server-failure']);
  assert.equal(scenario.impairmentProfile, 'server-failure');
  assert.equal(scenario.durationMs, clean.durationMs + 1700);
  assertStrict(scenario);

  const request = firstKind(scenario, 'http.request');
  const unavailable = event(scenario, 'server-service-unavailable');
  const service503 = event(scenario, 'server-http-503');
  const wait = event(scenario, 'server-retry-wait');
  const ready = event(scenario, 'server-service-ready');
  const retry = event(scenario, 'server-get-retry');
  const successfulHeaders = firstKind(scenario, 'http.response');
  const cleanHeaders = firstKind(clean, 'http.response');

  assert.ok(request.atMs < unavailable.atMs && unavailable.atMs < service503.atMs && service503.atMs < wait.atMs && wait.atMs < ready.atMs && ready.atMs < retry.atMs && retry.atMs < successfulHeaders.atMs);
  assert.equal(retry.atMs - service503.atMs, 1000);
  assert.equal(successfulHeaders.atMs, cleanHeaders.atMs + 1700);
  assert.equal(firstKind(scenario, 'http.data').atMs, firstKind(clean, 'http.data').atMs + 1700);

  for (const current of [unavailable, service503, wait, ready, retry]) {
    assert.equal(current.serverMetrics?.requestMethod, 'GET');
    assert.equal(current.serverMetrics?.idempotent, true);
    assert.equal(current.serverMetrics?.retrySafe, true);
    assert.equal(current.serverMetrics?.transportReused, true);
    assert.equal(current.serverMetrics?.retryAfterMs, 1000);
  }
  assert.equal(service503.serverMetrics?.statusCode, 503);
  assert.match(service503.title + service503.summary, /503|Service Unavailable/i);
  assert.match(retry.detail, /idempotent/i);
  assert.match(retry.detail, /arbitrary requests/i);

  const statusState = journeyStateAt(scenario, service503.atMs);
  assert.equal(statusState.server, 'unavailable');
  assert.equal(statusState.http, 'service-unavailable');
  assert.equal(statusState.impairmentState, 'server-unavailable');
  assert.equal(statusState.transport, 'established');
  assert.equal(statusState.tls, 'application-keys');

  const waitState = journeyStateAt(scenario, wait.atMs);
  assert.equal(waitState.server, 'waiting');
  assert.equal(waitState.http, 'retry-wait');
  assert.equal(waitState.impairmentState, 'server-waiting');
  assert.equal(waitState.transport, 'established');

  const retryState = journeyStateAt(scenario, retry.atMs);
  assert.equal(retryState.server, 'ready');
  assert.equal(retryState.http, 'request-sent');
  assert.equal(retryState.impairmentState, 'server-ready');
  assert.equal(retryState.transport, 'established');
  assert.equal(retryState.tls, 'application-keys');
  assert.equal(retryState.serverMetrics?.transportReused, true);

  const successState = journeyStateAt(scenario, successfulHeaders.atMs);
  assert.equal(successState.server, 'healthy');
  assert.equal(successState.http, 'headers');
  assert.equal(successState.impairmentState, 'normalized');

  assert.equal(countKind(scenario, 'transport.segment'), countKind(clean, 'transport.segment'));
  assert.equal(countKind(scenario, 'transport.established'), countKind(clean, 'transport.established'));
  assert.equal(countKind(scenario, 'tls.message'), countKind(clean, 'tls.message'));
  assert.equal(countKind(scenario, 'tls.keys'), countKind(clean, 'tls.keys'));
  assert.equal(countKind(scenario, 'transport.loss'), 0);
  assert.equal(countKind(scenario, 'transport.loss-detected'), 0);
  assert.equal(countKind(scenario, 'transport.retransmit'), 0);
  assert.equal(scenario.events.some((current) => current.transportMetrics?.timerLabel === 'RTO' || current.transportMetrics?.timerLabel === 'PTO'), false);
}

const composed = buildJourneyScenario('example.test', config('quic-h3', 'cache-miss', ['congestion', 'dns-failure', 'server-failure', 'route-failure', 'single-loss', 'latency-spike']));
assert.deepEqual(composed.modifierIds, ['dns-failure', 'route-failure', 'server-failure', 'single-loss', 'latency-spike', 'congestion']);
assert.ok(event(composed, 'dns-secondary-retry').atMs < event(composed, 'route-primary-fails').atMs);
assert.ok(event(composed, 'route-alternate-installed').atMs < event(composed, 'server-service-unavailable').atMs);
assert.ok(event(composed, 'server-get-retry').atMs < event(composed, 'quic-loss').atMs);
assert.ok(event(composed, 'quic-recovered').atMs < event(composed, 'quic-latency-start').atMs);
assert.ok(event(composed, 'quic-latency-clear').atMs < event(composed, 'quic-congestion-queue-start').atMs);
assertStrict(composed);

const portableSingle = createPortableJourneyScenario({
  name: 'Service unavailable',
  hostname: 'example.test',
  config: config('tcp-h2', 'cache-hit', ['server-failure']),
  timeMs: 9000,
});
assert.equal(portableSingle.version, 1);
assert.equal(portableSingle.impairmentProfile, 'server-failure');
assert.equal(decodeJourneyQuery(encodeJourneyQuery(portableSingle))?.impairmentProfile, 'server-failure');

const portableComposed = createPortableJourneyScenario({
  hostname: 'example.test',
  config: config('quic-h3', 'cache-miss', ['server-failure', 'congestion']),
  timeMs: 11000,
});
assert.equal(portableComposed.version, 2);
assert.deepEqual(portableComposed.modifiers, ['server-failure', 'congestion']);
assert.deepEqual(decodeJourneyQuery(encodeJourneyQuery(portableComposed))?.modifiers, ['server-failure', 'congestion']);

const storage = memoryStorage();
writeJourneyBrowserConfig(config('tcp-h2', 'cache-hit', ['server-failure']), storage);
assert.equal(readJourneyBrowserConfig(storage).impairmentProfile, 'server-failure');

console.log('Journey server-failure contract passed: HTTP 503/Retry-After, safe GET retry, connection reuse, composition, sharing, and persistence.');

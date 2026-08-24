import assert from 'node:assert/strict';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';
import {
  createPortableJourneyScenario,
  decodeJourneyQuery,
  encodeJourneyQuery,
  parseJourneyScenarioJson,
  serializeJourneyScenario,
} from '../src/journey/scenario.ts';
import { readJourneyBrowserConfig, writeJourneyBrowserConfig } from '../src/journey/browser.ts';

const transports = ['tcp-h2', 'quic-h3'];
const dnsProfiles = ['cache-miss', 'cache-hit'];
const impairments = ['clean', 'single-loss', 'latency-spike', 'route-failure'];
const scenarios = new Map();
const key = (t, d, i) => `${t}:${d}:${i}`;

for (const transportProfile of transports) {
  for (const dnsProfile of dnsProfiles) {
    for (const impairmentProfile of impairments) {
      const config = { transportProfile, dnsProfile, impairmentProfile };
      const scenario = buildJourneyScenario('Example.Test.', config);
      scenarios.set(key(transportProfile, dnsProfile, impairmentProfile), scenario);
      assert.equal(scenario.hostname, 'example.test');
      assert.equal(scenario.events[0].atMs, 0);
      assert.equal(new Set(scenario.events.map((event) => event.id)).size, scenario.events.length);
      assert.ok(scenario.events.every((event, index) => index === 0 || event.atMs > scenario.events[index - 1].atMs));
      assert.ok(scenario.events.every((event) => event.atMs <= scenario.durationMs));
      assert.equal(journeyStateAt(scenario, 0).impairmentState, impairmentProfile === 'clean' ? 'clean' : 'armed');
      assert.equal(journeyStateAt(scenario, scenario.durationMs).journeyComplete, true);

      const portable = createPortableJourneyScenario({
        name: 'God mode contract',
        hostname: 'example.test',
        config,
        timeMs: Math.floor(scenario.durationMs * 0.61),
      });
      assert.deepEqual(parseJourneyScenarioJson(serializeJourneyScenario(portable)), portable);
      assert.deepEqual(decodeJourneyQuery(encodeJourneyQuery(portable)), portable);
    }
  }
}

const expected = {
  'tcp-h2:cache-miss:clean': [45, 23100],
  'quic-h3:cache-miss:clean': [43, 23100],
  'tcp-h2:cache-hit:clean': [40, 20900],
  'quic-h3:cache-hit:clean': [38, 20900],
  'tcp-h2:cache-miss:single-loss': [49, 24700],
  'quic-h3:cache-miss:single-loss': [47, 24700],
  'tcp-h2:cache-hit:single-loss': [44, 22500],
  'quic-h3:cache-hit:single-loss': [42, 22500],
  'tcp-h2:cache-miss:latency-spike': [48, 24300],
  'quic-h3:cache-miss:latency-spike': [46, 24300],
  'tcp-h2:cache-hit:latency-spike': [43, 22100],
  'quic-h3:cache-hit:latency-spike': [41, 22100],
  'tcp-h2:cache-miss:route-failure': [49, 24500],
  'quic-h3:cache-miss:route-failure': [47, 24500],
  'tcp-h2:cache-hit:route-failure': [44, 22300],
  'quic-h3:cache-hit:route-failure': [42, 22300],
};
for (const [scenarioKey, [eventCount, durationMs]] of Object.entries(expected)) {
  const scenario = scenarios.get(scenarioKey);
  assert.equal(scenario.events.length, eventCount, `${scenarioKey} event count`);
  assert.equal(scenario.durationMs, durationMs, `${scenarioKey} duration`);
}

// Lab 06D loss regression: moving modifier application over the full Journey must not shift old loss truth.
const tcpMissLoss = scenarios.get(key('tcp-h2', 'cache-miss', 'single-loss'));
assert.deepEqual(
  ['tcp-loss', 'tcp-gap', 'tcp-retransmit', 'tcp-recovered'].map((id) => tcpMissLoss.events.find((event) => event.id === id).atMs),
  [17120, 17360, 17660, 18010],
);
const quicHitLoss = scenarios.get(key('quic-h3', 'cache-hit', 'single-loss'));
assert.deepEqual(
  ['quic-loss', 'quic-gap', 'quic-retransmit', 'quic-recovered'].map((id) => quicHitLoss.events.find((event) => event.id === id).atMs),
  [14660, 14900, 15200, 15550],
);
assert.match(quicHitLoss.events.find((event) => event.id === 'quic-retransmit').title, /4113/);

// Lab 07A latency regression is now permanently covered.
const tcpLatency = scenarios.get(key('tcp-h2', 'cache-miss', 'latency-spike'));
const tcpRtt = tcpLatency.events.find((event) => event.id === 'tcp-rtt-update');
assert.equal(tcpRtt.atMs, 17460);
assert.deepEqual(tcpRtt.transportMetrics, {
  baselineRttMs: 32,
  latestRttMs: 220,
  smoothedRttMs: 55.5,
  rttVarMs: 53,
  timerLabel: 'RTO',
  timerMs: 1000,
  lossDetected: false,
});
assert.ok(!tcpLatency.events.some((event) => event.kind === 'transport.loss' || event.kind === 'transport.retransmit'));
const quicLatency = scenarios.get(key('quic-h3', 'cache-hit', 'latency-spike'));
const quicRtt = quicLatency.events.find((event) => event.id === 'quic-rtt-update');
assert.equal(quicRtt.atMs, 15000);
assert.equal(quicRtt.transportMetrics.adjustedRttMs, 195);
assert.equal(quicRtt.transportMetrics.smoothedRttMs, 52.4);
assert.equal(quicRtt.transportMetrics.rttVarMs, 46.8);
assert.equal(quicRtt.transportMetrics.timerLabel, 'PTO');
assert.equal(quicRtt.transportMetrics.timerMs, 264.4);
assert.equal(quicRtt.transportMetrics.lossDetected, false);
assert.ok(!quicLatency.events.some((event) => event.kind === 'transport.loss' || event.kind === 'transport.retransmit'));

function validateRouteScenario(scenario, expectedTimes, expectedTransportAt) {
  assert.deepEqual(scenario.appliedModifierIds, ['route-failure']);
  const routeIds = ['route-primary-fails', 'route-primary-invalidated', 'route-spf-recompute', 'route-alternate-installed'];
  const routeEvents = routeIds.map((id) => scenario.events.find((event) => event.id === id));
  assert.deepEqual(routeEvents.map((event) => event.atMs), expectedTimes);
  assert.ok(routeEvents.every((event) => event.detailLab === 'failure'));
  assert.ok(routeEvents.every((event) => event.provenance === 'SIMULATED'));
  assert.equal(routeEvents[0].routeMetrics.primaryPathCost, 22);
  assert.equal(routeEvents[0].routeMetrics.alternatePathCost, 52);
  assert.equal(routeEvents[0].routeMetrics.activePath, 'none');
  assert.equal(routeEvents[3].routeMetrics.activePath, 'alternate');
  assert.equal(routeEvents[3].routeMetrics.failedLinkId, 'r1-core');
  const firstTransport = scenario.events.find((event) => event.kind === 'transport.segment');
  assert.equal(firstTransport.atMs, expectedTransportAt);
  assert.ok(routeEvents[3].atMs < firstTransport.atMs);
  assert.ok(!scenario.events.some((event) => event.kind.startsWith('transport.loss') || event.kind === 'transport.retransmit' || event.kind.startsWith('transport.latency') || event.kind === 'transport.rtt-update'));
  assert.equal(journeyStateAt(scenario, routeEvents[0].atMs).route, 'failed');
  assert.equal(journeyStateAt(scenario, routeEvents[0].atMs).impairmentState, 'route-failed');
  assert.equal(journeyStateAt(scenario, routeEvents[2].atMs).route, 'recomputing');
  assert.equal(journeyStateAt(scenario, routeEvents[2].atMs).impairmentState, 'route-recomputing');
  const ready = journeyStateAt(scenario, routeEvents[3].atMs);
  assert.equal(ready.route, 'alternate-ready');
  assert.equal(ready.impairmentState, 'route-ready');
  assert.equal(ready.routeMetrics.activePath, 'alternate');
}

for (const transport of transports) {
  validateRouteScenario(scenarios.get(key(transport, 'cache-miss', 'route-failure')), [3720, 4000, 4380, 4740], 6400);
  validateRouteScenario(scenarios.get(key(transport, 'cache-hit', 'route-failure')), [1500, 1780, 2160, 2520], 4200);
}

// Route trace is transport-independent for a given DNS path.
for (const dns of dnsProfiles) {
  const tcp = scenarios.get(key('tcp-h2', dns, 'route-failure'));
  const quic = scenarios.get(key('quic-h3', dns, 'route-failure'));
  const routeProjection = (scenario) => scenario.events.filter((event) => event.kind.startsWith('route.')).map(({ id, atMs, kind, phase, routeMetrics }) => ({ id, atMs, kind, phase, routeMetrics }));
  assert.deepEqual(routeProjection(tcp), routeProjection(quic));
}

// Browser persistence accepts every schema-v1 impairment profile.
const storageMap = new Map();
const storage = {
  getItem(key) { return storageMap.get(key) ?? null; },
  setItem(key, value) { storageMap.set(key, value); },
};
for (const impairmentProfile of impairments) {
  const config = { transportProfile: 'quic-h3', dnsProfile: 'cache-hit', impairmentProfile };
  writeJourneyBrowserConfig(config, storage);
  assert.deepEqual(readJourneyBrowserConfig(storage), config);
}

console.log('GOD MODE Journey contract passed: 16 scenarios, legacy regressions, latency estimators, route convergence, sharing, and browser persistence.');

import assert from 'node:assert/strict';
import {
  buildJourneyScenario,
  journeyStateAt,
  normalizeJourneyHostname,
} from '../src/journey/model.ts';

const configs = [
  { transportProfile: 'tcp-h2', dnsProfile: 'cache-miss' },
  { transportProfile: 'quic-h3', dnsProfile: 'cache-miss' },
  { transportProfile: 'tcp-h2', dnsProfile: 'cache-hit' },
  { transportProfile: 'quic-h3', dnsProfile: 'cache-hit' },
];

function validateCommon(scenario) {
  assert.equal(scenario.hostname, 'example.test');
  assert.equal(scenario.destinationAddress, '203.0.113.42');
  assert.equal(scenario.events[0].atMs, 0);
  assert.ok(scenario.events.every((event, index) => index === 0 || event.atMs > scenario.events[index - 1].atMs));
  assert.ok(scenario.events.every((event) => event.atMs <= scenario.durationMs));
  assert.equal(new Set(scenario.events.map((event) => event.id)).size, scenario.events.length);
  assert.deepEqual(new Set(scenario.events.map((event) => event.scale)), new Set(['internet', 'routing', 'transport', 'application', 'packet']));
  assert.ok(scenario.events.every((event) => event.provenance));

  const start = journeyStateAt(scenario, 0);
  assert.equal(start.scale, 'application');
  assert.equal(start.dns, 'idle');
  assert.equal(start.transport, 'closed');
  assert.equal(start.transportProfile, scenario.transportProfile);
  assert.equal(start.dnsProfile, scenario.dnsProfile);

  const end = journeyStateAt(scenario, scenario.durationMs);
  assert.equal(end.journeyComplete, true);
  assert.equal(end.scale, 'application');
  assert.equal(end.completedEventIds.length, scenario.events.length);
  assert.equal(end.resolvedAddress, '203.0.113.42');
}

const scenarios = new Map();
for (const config of configs) {
  const scenario = buildJourneyScenario('Example.Test.', config);
  validateCommon(scenario);
  scenarios.set(`${config.transportProfile}:${config.dnsProfile}`, scenario);
}

const tcpMiss = scenarios.get('tcp-h2:cache-miss');
const quicMiss = scenarios.get('quic-h3:cache-miss');
const tcpHit = scenarios.get('tcp-h2:cache-hit');
const quicHit = scenarios.get('quic-h3:cache-hit');

assert.equal(tcpMiss.events.length, 30);
assert.equal(quicMiss.events.length, 28);
assert.equal(tcpHit.events.length, 25);
assert.equal(quicHit.events.length, 23);
assert.equal(tcpMiss.durationMs, 15000);
assert.equal(quicMiss.durationMs, 15000);
assert.equal(tcpHit.durationMs, 12800);
assert.equal(quicHit.durationMs, 12800);

for (const miss of [tcpMiss, quicMiss]) {
  const ids = miss.events.map((event) => event.id);
  assert.ok(ids.includes('dns-recursive'));
  assert.ok(ids.includes('dns-root'));
  assert.ok(ids.includes('dns-tld'));
  assert.ok(ids.includes('dns-answer'));
  assert.ok(ids.includes('dns-store'));
  assert.ok(!ids.includes('dns-hit'));
  assert.equal(journeyStateAt(miss, 900).dns, 'resolving');
  const cached = journeyStateAt(miss, 2800);
  assert.equal(cached.dns, 'cached');
  assert.equal(cached.resolvedAddress, '203.0.113.42');
  assert.equal(cached.dnsTtlSeconds, 300);
  assert.equal(journeyStateAt(miss, 3800).dnsTtlSeconds, 299);
}

for (const hit of [tcpHit, quicHit]) {
  const ids = hit.events.map((event) => event.id);
  assert.ok(ids.includes('dns-hit'));
  assert.ok(!ids.includes('dns-recursive'));
  assert.ok(!ids.includes('dns-root'));
  assert.ok(!ids.includes('dns-tld'));
  assert.ok(!ids.includes('dns-answer'));
  assert.ok(!ids.includes('dns-store'));

  const cached = journeyStateAt(hit, 420);
  assert.equal(cached.dns, 'cached');
  assert.equal(cached.resolvedAddress, '203.0.113.42');
  assert.equal(cached.dnsTtlSeconds, 258);
  assert.equal(journeyStateAt(hit, 1420).dnsTtlSeconds, 257);

  const route = journeyStateAt(hit, 900);
  assert.equal(route.route, 'lookup');
  assert.equal(route.scale, 'routing');
  const internet = journeyStateAt(hit, 2320);
  assert.equal(internet.route, 'internet-path-ready');
  assert.equal(internet.scale, 'internet');
}

// Transport branch remains independent from DNS branch.
for (const dnsProfile of ['cache-miss', 'cache-hit']) {
  const tcp = scenarios.get(`tcp-h2:${dnsProfile}`);
  const quic = scenarios.get(`quic-h3:${dnsProfile}`);
  const tcpProtocols = tcp.events.map((event) => event.protocol).join(' | ');
  const quicProtocols = quic.events.map((event) => event.protocol).join(' | ');
  assert.match(tcpProtocols, /TCP/);
  assert.match(tcpProtocols, /HTTP\/2/);
  assert.doesNotMatch(tcpProtocols, /QUIC/);
  assert.doesNotMatch(tcpProtocols, /HTTP\/3/);
  assert.match(quicProtocols, /QUIC/);
  assert.match(quicProtocols, /HTTP\/3/);
  assert.doesNotMatch(quicProtocols, /HTTP\/2/);
  assert.ok(!quic.events.some((event) => event.protocol === 'TCP'));
}

// Miss profile preserves the existing Lab 06B transport timing.
let tcpState = journeyStateAt(tcpMiss, 5700);
assert.equal(tcpState.transport, 'established');
assert.equal(tcpState.protocol, 'TCP');
tcpState = journeyStateAt(tcpMiss, 7700);
assert.equal(tcpState.tls, 'application-keys');
tcpState = journeyStateAt(tcpMiss, 9700);
assert.equal(tcpState.http, 'streaming');
tcpState = journeyStateAt(tcpMiss, 10700);
assert.equal(tcpState.packet, 'headers');

let quicState = journeyStateAt(quicMiss, 5800);
assert.equal(quicState.transport, 'handshake');
assert.equal(quicState.tls, 'handshake-keys');
quicState = journeyStateAt(quicMiss, 7000);
assert.equal(quicState.transport, 'established');
assert.equal(quicState.tls, 'application-keys');
quicState = journeyStateAt(quicMiss, 9500);
assert.equal(quicState.http, 'streaming');
assert.equal(quicState.protocol, 'HTTP/3');

// Cache hit shifts the downstream causal chain exactly 2.2 seconds earlier.
assert.equal(tcpHit.events.find((event) => event.id === 'tcp-syn').atMs, 2800);
assert.equal(quicHit.events.find((event) => event.id === 'quic-initial').atMs, 2800);
assert.equal(tcpHit.events.find((event) => event.id === 'packet-frame').atMs, 7920);
assert.equal(quicHit.events.find((event) => event.id === 'packet-frame').atMs, 7920);
assert.equal(tcpHit.events.find((event) => event.id === 'complete').atMs, 12300);
assert.equal(quicHit.events.find((event) => event.id === 'complete').atMs, 12300);

assert.equal(normalizeJourneyHostname('cloudflare.com'), 'cloudflare.com');
assert.throws(() => normalizeJourneyHostname('https://cloudflare.com/x'), /hostname only/i);
assert.throws(() => normalizeJourneyHostname('203.0.113.42'), /hostname instead of an IP/i);
assert.throws(() => normalizeJourneyHostname('localhost'), /at least one dot/i);

console.log('Journey matrix contract passed: TCP/H2 + QUIC/H3 × DNS cache miss + cache hit.');
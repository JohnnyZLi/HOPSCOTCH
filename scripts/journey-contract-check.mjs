import assert from 'node:assert/strict';
import {
  buildJourneyScenario,
  journeyStateAt,
  normalizeJourneyHostname,
} from '../src/journey/model.ts';

const transportProfiles = ['tcp-h2', 'quic-h3'];
const dnsProfiles = ['cache-miss', 'cache-hit'];
const impairmentProfiles = ['clean', 'single-loss'];
const scenarios = new Map();

function key(config) {
  return `${config.transportProfile}:${config.dnsProfile}:${config.impairmentProfile}`;
}

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
  assert.equal(start.impairmentProfile, scenario.impairmentProfile);
  assert.equal(start.impairmentState, scenario.impairmentProfile === 'clean' ? 'clean' : 'armed');

  const end = journeyStateAt(scenario, scenario.durationMs);
  assert.equal(end.journeyComplete, true);
  assert.equal(end.scale, 'application');
  assert.equal(end.completedEventIds.length, scenario.events.length);
  assert.equal(end.resolvedAddress, '203.0.113.42');
  assert.equal(end.impairmentState, scenario.impairmentProfile === 'clean' ? 'clean' : 'recovered');
}

for (const transportProfile of transportProfiles) {
  for (const dnsProfile of dnsProfiles) {
    for (const impairmentProfile of impairmentProfiles) {
      const config = { transportProfile, dnsProfile, impairmentProfile };
      const scenario = buildJourneyScenario('Example.Test.', config);
      validateCommon(scenario);
      scenarios.set(key(config), scenario);
    }
  }
}

const tcpMiss = scenarios.get('tcp-h2:cache-miss:clean');
const quicMiss = scenarios.get('quic-h3:cache-miss:clean');
const tcpHit = scenarios.get('tcp-h2:cache-hit:clean');
const quicHit = scenarios.get('quic-h3:cache-hit:clean');
const tcpMissLoss = scenarios.get('tcp-h2:cache-miss:single-loss');
const quicMissLoss = scenarios.get('quic-h3:cache-miss:single-loss');
const tcpHitLoss = scenarios.get('tcp-h2:cache-hit:single-loss');
const quicHitLoss = scenarios.get('quic-h3:cache-hit:single-loss');

// Lab 06C clean branches are regression fixtures.
assert.equal(tcpMiss.events.length, 45);
assert.equal(quicMiss.events.length, 43);
assert.equal(tcpHit.events.length, 40);
assert.equal(quicHit.events.length, 38);
assert.equal(tcpMiss.durationMs, 23100);
assert.equal(quicMiss.durationMs, 23100);
assert.equal(tcpHit.durationMs, 20900);
assert.equal(quicHit.durationMs, 20900);
assert.deepEqual(tcpMiss.events.map(({ id, atMs }) => ({ id, atMs })), [
  ['intent',0],['dns-cache',420],['dns-recursive',850],['dns-root',1320],['dns-tld',1810],['dns-answer',2310],['dns-store',2700],['route-lookup',3140],['gateway',3560],['as-path',4050],['physical-context',4520],['tcp-syn',5000],['tcp-synack',5320],['tcp-ack',5620],['tls-clienthello',6070],['tls-serverhello',6470],['tls-encrypted',6840],['tls-certificate',7210],['tls-finished',7610],['h2-settings',8070],['h2-request',8540],['packet-assembly-application',8840],['packet-assembly-security',9300],['packet-assembly-transport',9760],['packet-assembly-network',10220],['packet-assembly-link',10680],['packet-assembly-collapsed',11140],['packet-transit-nic',11600],['packet-transit-link',12080],['packet-transit-switch-inspect',12560],['packet-transit-switch-forward',13040],['packet-transit-router-decapsulate',13520],['packet-transit-router-ttl',14000],['packet-transit-router-route',14480],['packet-transit-router-reencapsulate',14960],['packet-transit-next-link',15440],['h2-headers',16420],['h2-data',16960],['packet-frame',17680],['packet-headers',18360],['transfer-complete',19160],['response-ready',19980],['pullback-route',20800],['pullback-internet',21650],['complete',22650],
].map(([id,atMs])=>({id,atMs})));

for (const clean of [tcpMiss, quicMiss, tcpHit, quicHit]) {
  const assembly = clean.events.filter((event) => event.kind === 'packet.assembly');
  assert.deepEqual(assembly.map((event) => event.phase), ['application', 'security', 'transport', 'network', 'link', 'collapsed']);
  assert.ok(assembly.every((event) => event.provenance === 'SIMULATED'));
  assert.ok(assembly[0].atMs > clean.events.find((event) => event.kind === 'http.request').atMs);
  assert.ok(assembly.at(-1).atMs < clean.events.find((event) => event.kind === 'http.response').atMs);
  assert.equal(journeyStateAt(clean, assembly.at(-1).atMs).packetAssemblyStage, 'collapsed');
  const transit = clean.events.filter((event) => event.kind === 'packet.transit');
  assert.deepEqual(transit.map((event) => event.phase), ['nic-serialize', 'link-transmit', 'switch-inspect', 'switch-forward', 'router-decapsulate', 'router-ttl', 'router-route', 'router-reencapsulate', 'next-link']);
  assert.ok(transit[0].atMs > assembly.at(-1).atMs);
  assert.ok(transit.at(-1).atMs < clean.events.find((event) => event.kind === 'http.response').atMs);
  assert.equal(journeyStateAt(clean, transit.at(-1).atMs).packetTransitStage, 'next-link');
}

for (const miss of [tcpMiss, quicMiss, tcpMissLoss, quicMissLoss]) {
  const ids = miss.events.map((event) => event.id);
  assert.ok(ids.includes('dns-recursive'));
  assert.ok(ids.includes('dns-root'));
  assert.ok(ids.includes('dns-tld'));
  assert.ok(ids.includes('dns-answer'));
  assert.ok(ids.includes('dns-store'));
  assert.ok(!ids.includes('dns-hit'));
}

for (const hit of [tcpHit, quicHit, tcpHitLoss, quicHitLoss]) {
  const ids = hit.events.map((event) => event.id);
  assert.ok(ids.includes('dns-hit'));
  assert.ok(!ids.includes('dns-recursive'));
  assert.ok(!ids.includes('dns-root'));
  assert.ok(!ids.includes('dns-tld'));
  assert.ok(!ids.includes('dns-answer'));
  assert.ok(!ids.includes('dns-store'));
  const cached = journeyStateAt(hit, 420);
  assert.equal(cached.dns, 'cached');
  assert.equal(cached.dnsTtlSeconds, 258);
}

// Clean transport protocol exclusivity remains intact for both DNS profiles.
for (const dnsProfile of dnsProfiles) {
  const tcp = scenarios.get(`tcp-h2:${dnsProfile}:clean`);
  const quic = scenarios.get(`quic-h3:${dnsProfile}:clean`);
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

// Loss profile adds four canonical events and exactly 1.6 seconds without changing the pre-loss chain.
for (const dnsProfile of dnsProfiles) {
  for (const transportProfile of transportProfiles) {
    const clean = scenarios.get(`${transportProfile}:${dnsProfile}:clean`);
    const loss = scenarios.get(`${transportProfile}:${dnsProfile}:single-loss`);
    assert.equal(loss.events.length, clean.events.length + 4);
    assert.equal(loss.durationMs, clean.durationMs + 1600);
    const cleanDataIndex = clean.events.findIndex((event) => event.kind === 'http.data');
    const lossDataIndex = loss.events.findIndex((event) => event.kind === 'http.data');
    assert.deepEqual(loss.events.slice(0, lossDataIndex + 1), clean.events.slice(0, cleanDataIndex + 1));
    assert.equal(loss.events.filter((event) => event.kind.startsWith('transport.loss')).length, 2);
    assert.equal(loss.events.filter((event) => event.kind === 'transport.retransmit').length, 1);
    assert.equal(loss.events.filter((event) => event.kind === 'transport.recovered').length, 1);
    assert.equal(loss.events.find((event) => event.id === 'packet-frame').atMs, clean.events.find((event) => event.id === 'packet-frame').atMs + 1600);
    assert.equal(loss.events.find((event) => event.id === 'complete').atMs, clean.events.find((event) => event.id === 'complete').atMs + 1600);
  }
}

assert.equal(tcpMissLoss.events.length, 49);
assert.equal(quicMissLoss.events.length, 47);
assert.equal(tcpHitLoss.events.length, 44);
assert.equal(quicHitLoss.events.length, 42);
assert.equal(tcpMissLoss.durationMs, 24700);
assert.equal(quicMissLoss.durationMs, 24700);
assert.equal(tcpHitLoss.durationMs, 22500);
assert.equal(quicHitLoss.durationMs, 22500);

// TCP loss semantics are TCP-only and deterministic.
for (const tcpLoss of [tcpMissLoss, tcpHitLoss]) {
  const loss = tcpLoss.events.find((event) => event.id === 'tcp-loss');
  const detected = tcpLoss.events.find((event) => event.id === 'tcp-gap');
  const retransmit = tcpLoss.events.find((event) => event.id === 'tcp-retransmit');
  const recovered = tcpLoss.events.find((event) => event.id === 'tcp-recovered');
  assert.match(loss.summary, /SEQ 2461–3920/);
  assert.match(detected.title, /duplicate ACK 2461/i);
  assert.match(retransmit.title, /Fast retransmit/i);
  assert.match(recovered.summary, /2461 to 8301/);
  assert.ok(!tcpLoss.events.some((event) => /packet 4108|packet 4113|ACK ranges/i.test(`${event.title} ${event.summary} ${event.detail}`)));
  assert.equal(journeyStateAt(tcpLoss, loss.atMs).impairmentState, 'lost');
  assert.equal(journeyStateAt(tcpLoss, detected.atMs).impairmentState, 'detected');
  assert.equal(journeyStateAt(tcpLoss, retransmit.atMs).impairmentState, 'recovering');
  assert.equal(journeyStateAt(tcpLoss, recovered.atMs).impairmentState, 'recovered');
}

// QUIC loss semantics use packet-number/ACK-range/STREAM state and never resurrect the lost packet number.
for (const quicLoss of [quicMissLoss, quicHitLoss]) {
  const loss = quicLoss.events.find((event) => event.id === 'quic-loss');
  const detected = quicLoss.events.find((event) => event.id === 'quic-gap');
  const retransmit = quicLoss.events.find((event) => event.id === 'quic-retransmit');
  const recovered = quicLoss.events.find((event) => event.id === 'quic-recovered');
  assert.match(loss.title, /packet 4108/i);
  assert.match(loss.summary, /STREAM offset 4096–5555/);
  assert.match(detected.summary, /4105–4107 and 4109–4112/);
  assert.match(retransmit.title, /packet 4113/i);
  assert.match(retransmit.detail, /never retransmits packet number 4108/i);
  assert.match(recovered.summary, /STREAM range/i);
  assert.ok(!quicLoss.events.some((event) => /duplicate ACK 2461|SEQ 2461|fast retransmit/i.test(`${event.title} ${event.summary} ${event.detail}`)));
  assert.equal(journeyStateAt(quicLoss, loss.atMs).impairmentState, 'lost');
  assert.equal(journeyStateAt(quicLoss, detected.atMs).impairmentState, 'detected');
  assert.equal(journeyStateAt(quicLoss, retransmit.atMs).impairmentState, 'recovering');
  assert.equal(journeyStateAt(quicLoss, recovered.atMs).impairmentState, 'recovered');
}

// Cache hit still shifts the entire downstream causal chain 2.2 seconds earlier in both clean and loss profiles.
assert.equal(tcpHit.events.find((event) => event.id === 'tcp-syn').atMs, 2800);
assert.equal(quicHit.events.find((event) => event.id === 'quic-initial').atMs, 2800);
assert.equal(tcpHitLoss.events.find((event) => event.id === 'tcp-loss').atMs, tcpMissLoss.events.find((event) => event.id === 'tcp-loss').atMs - 2200);
assert.equal(quicHitLoss.events.find((event) => event.id === 'quic-loss').atMs, quicMissLoss.events.find((event) => event.id === 'quic-loss').atMs - 2200);

assert.equal(normalizeJourneyHostname('cloudflare.com'), 'cloudflare.com');
assert.throws(() => normalizeJourneyHostname('https://cloudflare.com/x'), /hostname only/i);
assert.throws(() => normalizeJourneyHostname('203.0.113.42'), /hostname instead of an IP/i);
assert.throws(() => normalizeJourneyHostname('localhost'), /at least one dot/i);

console.log('Journey contract passed: transport × DNS × impairment matrix with deterministic TCP/QUIC loss recovery.');

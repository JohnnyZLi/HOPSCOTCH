import assert from 'node:assert/strict';
import {
  buildJourneyScenario,
  journeyStateAt,
  normalizeJourneyHostname,
} from '../src/journey/model.ts';

function validateScenario(scenario) {
  assert.equal(scenario.hostname, 'example.test');
  assert.equal(scenario.destinationAddress, '203.0.113.42');
  assert.ok(scenario.events.length >= 20);
  assert.equal(scenario.events[0].atMs, 0);
  assert.ok(scenario.events.every((event, index) => index === 0 || event.atMs > scenario.events[index - 1].atMs));
  assert.ok(scenario.events.every((event) => event.atMs <= scenario.durationMs));
  assert.equal(new Set(scenario.events.map((event) => event.id)).size, scenario.events.length);
  assert.deepEqual(new Set(scenario.events.map((event) => event.scale)), new Set(['internet', 'routing', 'transport', 'application', 'packet']));
  assert.ok(scenario.events.every((event) => event.provenance));
  assert.ok(scenario.events.filter((event) => event.detailLab).length >= 12);

  let state = journeyStateAt(scenario, 0);
  assert.equal(state.scale, 'application');
  assert.equal(state.dns, 'idle');
  assert.equal(state.transport, 'closed');
  assert.equal(state.transportProfile, scenario.transportProfile);

  state = journeyStateAt(scenario, 900);
  assert.equal(state.dns, 'resolving');
  state = journeyStateAt(scenario, 2800);
  assert.equal(state.dns, 'cached');
  assert.equal(state.resolvedAddress, '203.0.113.42');
  state = journeyStateAt(scenario, 3600);
  assert.equal(state.scale, 'routing');
  assert.equal(state.route, 'gateway-ready');
  state = journeyStateAt(scenario, 4600);
  assert.equal(state.scale, 'internet');
  assert.equal(state.route, 'internet-path-ready');
  assert.equal(state.provenance, 'INFERRED');
  state = journeyStateAt(scenario, 12100);
  assert.equal(state.responseReady, true);
  assert.equal(state.http, 'complete');
  assert.equal(state.transport, 'complete');
  state = journeyStateAt(scenario, 15000);
  assert.equal(state.journeyComplete, true);
  assert.equal(state.scale, 'application');
  assert.equal(state.completedEventIds.length, scenario.events.length);
}

const tcp = buildJourneyScenario('Example.Test.', 'tcp-h2');
const quic = buildJourneyScenario('Example.Test.', 'quic-h3');
validateScenario(tcp);
validateScenario(quic);

assert.equal(tcp.transportProfile, 'tcp-h2');
assert.equal(quic.transportProfile, 'quic-h3');
assert.deepEqual(tcp.events.slice(0, 11), quic.events.slice(0, 11));

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
assert.ok(quic.events.some((event) => event.phase === 'quic-initial'));
assert.ok(quic.events.some((event) => event.phase === 'handshake-keys'));
assert.ok(quic.events.some((event) => event.phase === 'application-keys'));
assert.ok(quic.events.some((event) => event.protocol === 'QUIC' && event.kind === 'transport.established'));

let tcpState = journeyStateAt(tcp, 5700);
assert.equal(tcpState.transport, 'established');
assert.equal(tcpState.protocol, 'TCP');
tcpState = journeyStateAt(tcp, 7700);
assert.equal(tcpState.tls, 'application-keys');
assert.equal(tcpState.scale, 'application');
tcpState = journeyStateAt(tcp, 9700);
assert.equal(tcpState.http, 'streaming');
tcpState = journeyStateAt(tcp, 10700);
assert.equal(tcpState.packet, 'headers');
assert.match(tcpState.protocol, /TCP/);

let quicState = journeyStateAt(quic, 5800);
assert.equal(quicState.transport, 'handshake');
assert.equal(quicState.tls, 'handshake-keys');
assert.match(quicState.protocol, /QUIC/);
quicState = journeyStateAt(quic, 7000);
assert.equal(quicState.transport, 'established');
assert.equal(quicState.tls, 'application-keys');
quicState = journeyStateAt(quic, 9500);
assert.equal(quicState.http, 'streaming');
assert.equal(quicState.protocol, 'HTTP/3');
quicState = journeyStateAt(quic, 10700);
assert.equal(quicState.packet, 'headers');
assert.match(quicState.protocol, /QUIC/);

assert.equal(normalizeJourneyHostname('cloudflare.com'), 'cloudflare.com');
assert.throws(() => normalizeJourneyHostname('https://cloudflare.com/x'), /hostname only/i);
assert.throws(() => normalizeJourneyHostname('203.0.113.42'), /hostname instead of an IP/i);
assert.throws(() => normalizeJourneyHostname('localhost'), /at least one dot/i);

console.log(`Journey branch contract passed: TCP/H2 ${tcp.events.length} events; QUIC/H3 ${quic.events.length} events.`);

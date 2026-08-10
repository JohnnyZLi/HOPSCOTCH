import assert from 'node:assert/strict';
import {
  buildJourneyScenario,
  journeyStateAt,
  normalizeJourneyHostname,
} from '../src/journey/model.ts';

const scenario = buildJourneyScenario('Example.Test.');
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

state = journeyStateAt(scenario, 900);
assert.equal(state.dns, 'resolving');
assert.equal(state.scale, 'application');

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

state = journeyStateAt(scenario, 5700);
assert.equal(state.scale, 'transport');
assert.equal(state.transport, 'established');

state = journeyStateAt(scenario, 7700);
assert.equal(state.tls, 'application-keys');
assert.equal(state.scale, 'application');

state = journeyStateAt(scenario, 9700);
assert.equal(state.http, 'streaming');

state = journeyStateAt(scenario, 10700);
assert.equal(state.scale, 'packet');
assert.equal(state.packet, 'headers');

state = journeyStateAt(scenario, 12100);
assert.equal(state.responseReady, true);
assert.equal(state.http, 'complete');
assert.equal(state.transport, 'complete');

state = journeyStateAt(scenario, 15000);
assert.equal(state.journeyComplete, true);
assert.equal(state.scale, 'application');
assert.equal(state.completedEventIds.length, scenario.events.length);

assert.equal(normalizeJourneyHostname('cloudflare.com'), 'cloudflare.com');
assert.throws(() => normalizeJourneyHostname('https://cloudflare.com/x'), /hostname only/i);
assert.throws(() => normalizeJourneyHostname('203.0.113.42'), /hostname instead of an IP/i);
assert.throws(() => normalizeJourneyHostname('localhost'), /at least one dot/i);

console.log(`Journey contract checks passed with ${scenario.events.length} canonical events.`);

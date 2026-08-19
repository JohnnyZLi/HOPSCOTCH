import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createBuilderTrafficScenario,
  evaluateBuilderPmtu,
  runBuilderTrafficScenario,
} from '../src/builder/data-plane.ts';

const profiles = {
  'edge-a': { latencyMs: 4, jitterMs: 0, bandwidthMbps: 20, lossPercent: 0, mtuBytes: 1500, queuePackets: 24 },
  'core-b': { latencyMs: 6, jitterMs: 0, bandwidthMbps: 10, lossPercent: 0, mtuBytes: 1400, queuePackets: 18 },
};
const path = ['edge-a', 'core-b'];

const single = runBuilderTrafficScenario(profiles, createBuilderTrafficScenario('single', path, profiles, 'tcp'));
assert.equal(single.provenance, 'SIMULATED');
assert.equal(single.links.length, 2);
assert.ok(single.flows[0].deliveredRateMbps > 0);
assert.ok(single.flows[0].estimatedRttMs >= 20, 'RTT observation must include canonical path latency plus queue/serialization delay');
assert.ok(single.links.every((link) => link.peakQueuePackets <= link.queueCapacityPackets), 'queue occupancy cannot exceed configured packet capacity');

const competing = runBuilderTrafficScenario(profiles, createBuilderTrafficScenario('competing', path, profiles));
assert.equal(competing.flows.length, 3);
assert.ok(competing.links.some((link) => link.ecnMarks > 0 || link.tailDrops > 0), 'competing traffic must create real queue pressure at the canonical bottleneck');
const delivered = competing.flows.map((flow) => flow.deliveredRateMbps);
const max = Math.max(...delivered), min = Math.min(...delivered);
assert.ok(min > 0 && max / min < 1.35, `deterministic round-robin admission/scheduling must share the bottleneck; got ${delivered.join(', ')}`);
assert.ok(competing.flows.filter((flow) => flow.transport !== 'udp').some((flow) => flow.recovery === 'ECN BACKOFF' || flow.recovery === 'LOSS RECOVERY'), 'TCP/QUIC recovery must be driven by actual queue feedback');
assert.ok(competing.events.some((event) => event.kind === 'TRANSPORT_BACKOFF'));

const udp = runBuilderTrafficScenario(profiles, createBuilderTrafficScenario('udp-cbr', path, profiles));
assert.equal(udp.flows[0].transport, 'udp');
assert.ok(udp.flows[0].recovery === 'UDP UNRESPONSIVE' || udp.flows[0].recovery === 'NONE');
if (udp.flows[0].droppedPackets > 0 || udp.flows[0].ecnMarks > 0) assert.equal(udp.flows[0].recovery, 'UDP UNRESPONSIVE', 'UDP must not invent congestion-window backoff');

const burst = runBuilderTrafficScenario(profiles, createBuilderTrafficScenario('burst', path, profiles));
assert.ok(burst.events.some((event) => event.kind === 'QUEUE_GROWTH' || event.kind === 'TAIL_DROP'));

const ipv4Fragment = evaluateBuilderPmtu({ profiles, linkIds: path, family: 'ipv4', packetBytes: 3000, destinationKey: 'app', df: false });
assert.equal(ipv4Fragment.outcome, 'FRAGMENTED');
assert.ok(ipv4Fragment.fragments.length > 1);
assert.ok(ipv4Fragment.fragments.every((fragment) => fragment.packetBytes <= 1400));
assert.equal(ipv4Fragment.cacheEntry, null, 'router fragmentation is not PMTU discovery');

const ipv4Df = evaluateBuilderPmtu({ profiles, linkIds: path, family: 'ipv4', packetBytes: 3000, destinationKey: 'app', df: true });
assert.equal(ipv4Df.outcome, 'ICMP_FRAG_NEEDED');
assert.equal(ipv4Df.transportEffect, 'RETRY SMALLER');
assert.equal(ipv4Df.cacheEntry?.mtuBytes, 1400);
assert.equal(ipv4Df.cacheEntry?.learnedFrom, 'ICMP FRAG NEEDED');

const ipv6 = evaluateBuilderPmtu({ profiles, linkIds: path, family: 'ipv6', packetBytes: 2000, destinationKey: '2001:db8::10' });
assert.equal(ipv6.outcome, 'ICMPV6_PACKET_TOO_BIG');
assert.equal(ipv6.fragments.length, 0, 'IPv6 routers must never fragment');
assert.equal(ipv6.cacheEntry?.mtuBytes, 1400);

const blackHole = evaluateBuilderPmtu({ profiles, linkIds: path, family: 'ipv4', packetBytes: 3000, destinationKey: 'app', df: true, suppressControlMessage: true });
assert.equal(blackHole.outcome, 'BLACK_HOLE');
assert.equal(blackHole.transportEffect, 'TIMEOUT NO PROGRESS');
assert.equal(blackHole.cacheEntry, null);

const applicationPanel = readFileSync('src/BuilderApplicationPanel.tsx', 'utf8');
const composite = readFileSync('src/BuilderApplicationDataPlaneWorkspace.tsx', 'utf8');
const panel = readFileSync('src/BuilderDataPlanePanel.tsx', 'utf8');
const networkBuilder = readFileSync('src/NetworkBuilder.tsx', 'utf8');
assert.match(applicationPanel, /BuilderApplicationDataPlaneWorkspace/);
assert.match(composite, /BuilderDataPlanePanel/);
assert.match(composite, /transaction=\{transaction\}/);
assert.match(panel, /RUN A SUCCESSFUL APPLICATION TRANSACTION FIRST/);
assert.match(panel, /canonical path produced by the application transaction/i);
assert.match(panel, /DROP ICMP\/PTB/);
assert.doesNotMatch(networkBuilder, /builder\/data-plane|BuilderDataPlanePanel/, 'Track E must remain behind the already-lazy application workspace boundary');

console.log('Track E data-plane contract passed: canonical-path packet queues, deterministic fair admission/scheduling, ECN/tail-drop transport feedback, traffic generators, bandwidth observations, IPv4 fragmentation, IPv4/IPv6 PMTUD, explicit black holes, and lazy Builder integration.');

import assert from 'node:assert/strict';
import { buildConversationIndex, parseCaptureSession } from '../src/capture/session.ts';
import {
  dnsQuery,
  dnsResponse,
  pcapCapture,
  tcpIpv4Frame,
  udpIpv4Frame,
} from './capture-fixtures.mjs';

const encoder = new TextEncoder();
const aToB = (payload = new Uint8Array(), options = {}) => tcpIpv4Frame(payload, {
  sourceAddress: '192.0.2.10', destinationAddress: '198.51.100.42',
  sourcePort: 50000, destinationPort: 443,
  ...options,
});
const bToA = (payload = new Uint8Array(), options = {}) => tcpIpv4Frame(payload, {
  sourceAddress: '198.51.100.42', destinationAddress: '192.0.2.10',
  sourcePort: 443, destinationPort: 50000,
  ...options,
});

const records = [
  { bytes: aToB(new Uint8Array(), { sequence: 1000, acknowledgment: 0, flags: 0x02 }), fraction: 0 },
  { bytes: bToA(new Uint8Array(), { sequence: 9000, acknowledgment: 1001, flags: 0x12 }), fraction: 1000 },
  { bytes: aToB(new Uint8Array(), { sequence: 1001, acknowledgment: 9001, flags: 0x10 }), fraction: 2000 },
  { bytes: aToB(encoder.encode('DATA'), { sequence: 1001, acknowledgment: 9001, flags: 0x18 }), fraction: 3000 },
  { bytes: bToA(new Uint8Array(), { sequence: 9001, acknowledgment: 1005, flags: 0x10 }), fraction: 4000 },
  { bytes: bToA(new Uint8Array(), { sequence: 9001, acknowledgment: 1005, flags: 0x10 }), fraction: 4000 },
  { bytes: aToB(encoder.encode('DATA'), { sequence: 1001, acknowledgment: 9001, flags: 0x18 }), fraction: 6000 },
  { bytes: aToB(encoder.encode('GAP'), { sequence: 1010, acknowledgment: 9001, flags: 0x18 }), fraction: 7000 },
  { bytes: aToB(new Uint8Array(), { sequence: 1013, acknowledgment: 9001, flags: 0x11 }), fraction: 8000 },
  { bytes: bToA(new Uint8Array(), { sequence: 9001, acknowledgment: 1014, flags: 0x14 }), fraction: 9000 },
  { bytes: udpIpv4Frame(dnsQuery({ id: 0x7777 }), { sourceAddress: '192.0.2.10', destinationAddress: '192.0.2.53', sourcePort: 53000, destinationPort: 53 }), fraction: 10_000 },
  { bytes: udpIpv4Frame(dnsResponse({ id: 0x7777 }), { sourceAddress: '192.0.2.53', destinationAddress: '192.0.2.10', sourcePort: 53, destinationPort: 53000 }), fraction: 11_000 },
  { bytes: tcpIpv4Frame(encoder.encode('capture started late'), { sourceAddress: '203.0.113.10', destinationAddress: '203.0.113.20', sourcePort: 61000, destinationPort: 8443, sequence: 4000, acknowledgment: 5000, flags: 0x18 }), fraction: 12_000 },
];
const input = pcapCapture(records);
const session = parseCaptureSession(input);

assert.equal(session.metadata.frameCount, records.length);
assert.equal(session.metadata.conversationCount, 3);
assert.equal(session.frames[0].record.relativeTimeNanoseconds, 0n);
assert.equal(session.frames[0].record.timestamp.originalSeconds, 1_700_000_000);
assert.equal(session.frames[0].record.provenance, 'CAPTURED');
assert.ok(session.frames.every((frame) => frame.provenance === 'CAPTURED'));

const tcp = session.conversations.find((conversation) => conversation.endpointA.port === 50000 || conversation.endpointB.port === 50000);
assert.ok(tcp);
assert.equal(tcp.protocol, 'TCP');
assert.equal(tcp.frameCount, 10);
assert.deepEqual(tcp.directionCounts, { A_TO_B: 6, B_TO_A: 4 });
assert.equal(tcp.observedInitiator, tcp.endpointA.port === 50000 ? 'A' : 'B');
assert.equal(tcp.captureStartedMidConversation, false);
assert.equal(tcp.oneDirectionOnly, false);
assert.equal(tcp.provenance, 'INFERRED');

const dns = session.conversations.find((conversation) => conversation.protocol === 'DNS');
assert.ok(dns);
assert.equal(dns.frameCount, 2);
assert.deepEqual(dns.directionCounts, { A_TO_B: 1, B_TO_A: 1 });
assert.equal(dns.applicationProtocol, 'DNS');
assert.equal(dns.observedInitiator, dns.endpointA.port === 53000 ? 'A' : 'B');

const late = session.conversations.find((conversation) => conversation.endpointA.port === 61000 || conversation.endpointB.port === 61000);
assert.ok(late);
assert.equal(late.captureStartedMidConversation, true);
assert.equal(late.oneDirectionOnly, true);
assert.equal(late.observedInitiator, null);

const tcpEvents = session.eventsForConversation(tcp.id);
const kinds = tcpEvents.map((event) => event.kind);
for (const expected of [
  'tcp.syn', 'tcp.syn-ack', 'tcp.ack', 'tcp.established-observed', 'tcp.data',
  'tcp.duplicate-ack-observed', 'tcp.retransmission-observed', 'tcp.sequence-gap-visible', 'tcp.fin', 'tcp.rst',
]) assert.ok(kinds.includes(expected), `missing ${expected}`);

const directSyn = tcpEvents.find((event) => event.kind === 'tcp.syn');
const established = tcpEvents.find((event) => event.kind === 'tcp.established-observed');
const duplicateAck = tcpEvents.find((event) => event.kind === 'tcp.duplicate-ack-observed');
const retransmission = tcpEvents.find((event) => event.kind === 'tcp.retransmission-observed');
const gap = tcpEvents.find((event) => event.kind === 'tcp.sequence-gap-visible');
assert.equal(directSyn.provenance, 'CAPTURED');
assert.equal(established.provenance, 'INFERRED');
assert.equal(established.supportingFrameIds.length, 3);
assert.equal(duplicateAck.provenance, 'INFERRED');
assert.equal(retransmission.provenance, 'INFERRED');
assert.equal(retransmission.supportingFrameIds.length, 2);
assert.match(retransmission.title, /OBSERVED RETRANSMISSION/);
assert.doesNotMatch(`${retransmission.summary} ${retransmission.detail} ${retransmission.uncertainty}`, /network dropped|packet loss occurred/i);
assert.match(gap.title, /CAPTURE-VISIBLE SEQUENCE GAP/);
assert.match(gap.uncertainty, /does not claim/i);

const equalTimeEvents = tcpEvents.filter((event) => event.relativeTimeNanoseconds === 4_000_000n);
assert.deepEqual(equalTimeEvents.map((event) => event.primaryFrameId), ['frame-000005', 'frame-000006', 'frame-000006']);
assert.deepEqual(equalTimeEvents.map((event) => event.kind), ['tcp.ack', 'tcp.ack', 'tcp.duplicate-ack-observed']);

const projectionA = session.projectionAt(tcp.id, 4_000_000n);
const projectionB = session.projectionAt(tcp.id, 4_000_000n);
assert.deepEqual(projectionA, projectionB, 'same conversation + same capture time must reconstruct identical semantic projection');
assert.equal(projectionA.currentEvent.kind, 'tcp.duplicate-ack-observed');
assert.deepEqual(projectionA.completedEventIds, projectionB.completedEventIds);
assert.equal(session.eventBefore(tcp.id, projectionA.currentEvent.id).id, equalTimeEvents[1].id);
assert.equal(session.eventAfter(tcp.id, projectionA.currentEvent.id).relativeTimeNanoseconds, 6_000_000n);
assert.equal(session.eventAtOrBefore(tcp.id, 4_000_000n)?.id, projectionA.currentEvent.id);
assert.equal(session.frameByNumber(1)?.record.id, 'frame-000001');
assert.equal(session.conversationForFrame('frame-000001')?.id, tcp.id);
assert.equal(session.eventsForConversation(tcp.id), session.eventsForConversation(tcp.id), 'indexed event projection should retain stable array identity');

const lineage = session.lineage(retransmission.id);
assert.ok(lineage);
assert.equal(lineage.eventId, retransmission.id);
assert.equal(lineage.conversationId, tcp.id);
assert.equal(lineage.provenance, 'INFERRED');
assert.equal(lineage.frameIds.length, 2);
assert.ok(lineage.fields.length >= 2);
for (const lineageField of lineage.fields) {
  const frame = session.frame(lineageField.frameId);
  assert.ok(frame);
  assert.equal(lineageField.provenance, 'CAPTURED');
  for (const byteRange of lineageField.byteRanges) {
    assert.ok(byteRange.offset >= 0 && byteRange.offset + byteRange.length <= frame.record.bytes.length);
  }
}
assert.ok(lineage.fields.some((lineageField) => lineageField.fieldId === 'tcp.sequence' && lineageField.bytes.includes('00 00 03 E9')));

const reorderedFrames = [...session.frames].reverse();
const reorderedInputIds = reorderedFrames.map((frame) => frame.record.id);
const rebuilt = buildConversationIndex(reorderedFrames);
assert.deepEqual(rebuilt.map(({ id, key, frameReferences }) => ({ id, key, frames: frameReferences.map((entry) => entry.frameId) })), session.conversations.map(({ id, key, frameReferences }) => ({ id, key, frames: frameReferences.map((entry) => entry.frameId) })));
assert.deepEqual(reorderedFrames.map((frame) => frame.record.id), reorderedInputIds, 'conversation reconstruction cannot mutate caller frame order');

const repeated = parseCaptureSession(input);
assert.equal(repeated.metadata.captureId, session.metadata.captureId);
assert.deepEqual(repeated.conversations.map(({ id, key }) => ({ id, key })), session.conversations.map(({ id, key }) => ({ id, key })));
assert.deepEqual(repeated.events.map(({ id, kind, primaryFrameId }) => ({ id, kind, primaryFrameId })), session.events.map(({ id, kind, primaryFrameId }) => ({ id, kind, primaryFrameId })));

for (const truth of [
  ...session.frames.map((frame) => frame.provenance),
  ...session.conversations.map((conversation) => conversation.provenance),
  ...session.events.map((event) => event.provenance),
]) assert.ok(truth === 'CAPTURED' || truth === 'INFERRED', `captured replay truth leaked into ${truth}`);

const dnsEvents = session.eventsForConversation(dns.id);
assert.deepEqual(dnsEvents.map((event) => event.kind), ['dns.query', 'dns.response']);
assert.doesNotMatch(dnsEvents[0].detail, /failed/i, 'no captured DNS answer at query time cannot be relabeled failure');

const genericUdp = parseCaptureSession(pcapCapture([{ bytes: udpIpv4Frame(encoder.encode('opaque datagram'), { sourcePort: 40000, destinationPort: 40001 }) }]));
assert.deepEqual(genericUdp.events.map((event) => event.kind), ['udp.datagram']);
assert.equal(genericUdp.events[0].provenance, 'CAPTURED');

const outOfOrderHandshake = parseCaptureSession(pcapCapture([
  { bytes: bToA(new Uint8Array(), { sequence: 9000, acknowledgment: 1001, flags: 0x12 }), fraction: 0 },
  { bytes: aToB(new Uint8Array(), { sequence: 1000, acknowledgment: 0, flags: 0x02 }), fraction: 1000 },
  { bytes: aToB(new Uint8Array(), { sequence: 1001, acknowledgment: 9001, flags: 0x10 }), fraction: 2000 },
]));
assert.ok(!outOfOrderHandshake.events.some((event) => event.kind === 'tcp.established-observed'), 'source-order-inconsistent handshakes cannot become observed establishment');

const sparseFrames = Array.from({ length: 4097 }, (_, index) => ({
  bytes: aToB(Uint8Array.of(index & 0xff), { sequence: 20_000 + (index * 2), acknowledgment: 9001, flags: 0x18 }),
  fraction: index,
}));
sparseFrames.push({ bytes: aToB(Uint8Array.of(0), { sequence: 20_000, acknowledgment: 9001, flags: 0x18 }), fraction: 4098 });
const boundedLargeFlow = parseCaptureSession(pcapCapture(sparseFrames, { nanoseconds: true }));
assert.equal(boundedLargeFlow.metadata.frameCount, sparseFrames.length);
assert.ok(boundedLargeFlow.warnings.some((warning) => /4,096 disjoint-range ceiling/.test(warning)));
assert.ok(boundedLargeFlow.events.some((event) => event.primaryFrameId === 'frame-004098' && event.kind === 'tcp.retransmission-observed'), 'exact repeat lookup must remain active after bounded overlap indexing saturates');

console.log('Track T flow contract passed: normalized bidirectional conversations, capture-bounded TCP semantics, stable equal-time replay, CAPTURED/INFERRED provenance, and event→frame→field→byte lineage.');

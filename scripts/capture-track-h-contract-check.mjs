import assert from 'node:assert/strict';
import {
  buildCaptureRttSummary,
  buildCaptureTrafficOverview,
  buildCapturedProtocolTheater,
  compareCaptureSessions,
  readTcpStreamWindow,
  reconstructTcpConversation,
} from '../src/capture/analysis.ts';
import {
  buildJourneyCounterfactual,
  compareCaptureConversationToSimulation,
} from '../src/capture/counterfactual.ts';
import {
  parseCaptureSidecarEvidenceJson,
  parseNetworkConfiguration,
} from '../src/capture/evidence.ts';
import { parseCaptureSessionAsync } from '../src/capture/parse-async.ts';
import { parseCaptureSession } from '../src/capture/session.ts';
import { hydrateCaptureSessionWire, serializeCaptureSessionWire } from '../src/capture/wire.ts';
import { pcapCapture, tcpIpv4Frame, udpIpv4Frame } from './capture-fixtures.mjs';

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

const capture = pcapCapture([
  { bytes: aToB(new Uint8Array(), { sequence: 1000, acknowledgment: 0, flags: 0x02 }), fraction: 0 },
  { bytes: bToA(new Uint8Array(), { sequence: 9000, acknowledgment: 1001, flags: 0x12 }), fraction: 1000 },
  { bytes: aToB(new Uint8Array(), { sequence: 1001, acknowledgment: 9001, flags: 0x10 }), fraction: 2000 },
  { bytes: aToB(encoder.encode('HELLO'), { sequence: 1001, acknowledgment: 9001, flags: 0x18 }), fraction: 3000 },
  { bytes: bToA(new Uint8Array(), { sequence: 9001, acknowledgment: 1006, flags: 0x10 }), fraction: 7000 },
  { bytes: aToB(encoder.encode('HELLO'), { sequence: 1001, acknowledgment: 9001, flags: 0x18 }), fraction: 8000 },
  { bytes: aToB(encoder.encode('XYZW'), { sequence: 1004, acknowledgment: 9001, flags: 0x18 }), fraction: 9000 },
  { bytes: aToB(encoder.encode('LATE'), { sequence: 1012, acknowledgment: 9001, flags: 0x18 }), fraction: 10_000 },
  { bytes: aToB(encoder.encode('MID'), { sequence: 1008, acknowledgment: 9001, flags: 0x18 }), fraction: 11_000 },
  { bytes: bToA(new Uint8Array(), { sequence: 9001, acknowledgment: 1016, flags: 0x10 }), fraction: 15_000 },
]);
const session = parseCaptureSession(capture);
const conversation = session.conversations.find((entry) => entry.protocol === 'TCP');
assert.ok(conversation);

const reconstruction = reconstructTcpConversation(session, conversation.id);
assert.ok(reconstruction);
const forward = reconstruction.directions.A_TO_B;
assert.equal(forward.firstSequenceNumber, 1001);
assert.ok(forward.uniqueCapturedBytes >= 12);
assert.equal(forward.retransmissionCount, 1, 'exact repeated payload range must remain a retransmission observation');
assert.ok(forward.overlapCount >= 1, 'partial sequence overlap must be explicit');
assert.ok(forward.outOfOrderCount >= 1, 'late fill of a sequence-space hole must be labeled out-of-order');
assert.ok(forward.gaps.length >= 1, 'missing sequence-space bytes must remain holes');
assert.equal(reconstruction.provenance, 'INFERRED');
const streamWindow = readTcpStreamWindow(session, reconstruction, 'A_TO_B', 0n, 32);
assert.ok(streamWindow.pieces.some((piece) => piece.textPreview.includes('HELLO')));
assert.equal(streamWindow.completeForRequestedWindow, false, 'a requested stream window containing uncaptured bytes cannot become complete');
assert.ok(streamWindow.gaps.length > 0);
assert.ok(streamWindow.pieces.every((piece) => piece.provenance === 'CAPTURED'));

const rtt = buildCaptureRttSummary(session, conversation.id);
assert.ok(rtt);
assert.ok(rtt.observations.length >= 2, 'SYN/data sequence consumption with visible ACKs should yield bounded observations');
assert.ok(rtt.observations.every((entry) => entry.durationNanoseconds >= 0n && entry.provenance === 'INFERRED'));
assert.ok(rtt.p50Ms !== null);
assert.match(rtt.observations[0].uncertainty, /vantage|capture/i);

const theater = buildCapturedProtocolTheater(session, conversation.id);
assert.ok(theater);
assert.equal(theater.stages.find((stage) => stage.id === 'tcp-syn')?.state, 'OBSERVED');
assert.equal(theater.stages.find((stage) => stage.id === 'tcp-established')?.state, 'OBSERVED');
assert.equal(theater.stages.find((stage) => stage.id === 'tcp-close')?.state, 'NOT_OBSERVED_IN_CAPTURE');
assert.match(theater.boundary, /never fabricates/i);

const lateCapture = parseCaptureSession(pcapCapture([
  { bytes: aToB(encoder.encode('started late'), { sequence: 6000, acknowledgment: 7000, flags: 0x18 }), fraction: 0 },
]));
const lateConversation = lateCapture.conversations[0];
assert.ok(lateConversation);
assert.equal(reconstructTcpConversation(lateCapture, lateConversation.id)?.evidenceState, 'CAPTURE_STARTED_MID_CONVERSATION');
const lateTheater = buildCapturedProtocolTheater(lateCapture, lateConversation.id);
assert.ok(lateTheater);
assert.equal(lateTheater.stages.find((stage) => stage.id === 'tcp-syn')?.state, 'CAPTURE_STARTED_MID_CONVERSATION');

const traffic = buildCaptureTrafficOverview(session, 16);
assert.equal(traffic.bins.length, 16);
assert.equal(traffic.bins.reduce((sum, bin) => sum + bin.frameCount, 0), session.metadata.frameCount);
assert.ok(traffic.protocols.some((entry) => entry.protocol === 'TCP'));
assert.ok(traffic.endpoints.some((entry) => entry.endpoint.includes('192.0.2.10')));
assert.match(traffic.boundary, /do not infer routers|do not infer/i);

const comparisonCapture = parseCaptureSession(pcapCapture([
  { bytes: aToB(new Uint8Array(), { sequence: 1000, acknowledgment: 0, flags: 0x02 }), fraction: 0 },
  { bytes: bToA(new Uint8Array(), { sequence: 9000, acknowledgment: 1001, flags: 0x12 }), fraction: 1000 },
  { bytes: aToB(new Uint8Array(), { sequence: 1001, acknowledgment: 9001, flags: 0x10 }), fraction: 2000 },
  { bytes: aToB(encoder.encode('HELLO'), { sequence: 1001, acknowledgment: 9001, flags: 0x18 }), fraction: 3000 },
]));
const comparison = compareCaptureSessions(session, comparisonCapture);
assert.equal(comparison.frameDelta, comparisonCapture.metadata.frameCount - session.metadata.frameCount);
assert.ok(comparison.flows.some((flow) => flow.status === 'matched'));
assert.match(comparison.boundary, /does not claim why/i);

const wire = serializeCaptureSessionWire(session);
const hydrated = hydrateCaptureSessionWire(wire);
assert.equal(hydrated.metadata.captureId, session.metadata.captureId);
assert.equal(hydrated.metadata.frameCount, session.metadata.frameCount);
assert.equal(hydrated.frameByNumber(4)?.record.bytes.hex(), session.frameByNumber(4)?.record.bytes.hex());
assert.deepEqual(hydrated.events.map(({ id, kind }) => ({ id, kind })), session.events.map(({ id, kind }) => ({ id, kind })));
const asyncFallback = await parseCaptureSessionAsync(capture);
assert.equal(asyncFallback.metadata.captureId, session.metadata.captureId, 'Node/non-Worker fallback must preserve the same canonical parser result');

const sidecar = parseCaptureSidecarEvidenceJson(JSON.stringify({
  schema: 'hopscotch.capture-sidecar-evidence', version: 1, sourceLabel: 'lab-router', snapshots: [
    { kind: 'traceroute', label: 'client to service', observedAt: '2026-08-18T22:00:00Z', hops: [{ hop: 1, address: '192.0.2.1', rttMs: [1.2, 1.4], label: 'gateway' }, { hop: 2, address: null, rttMs: [], label: null }] },
    { kind: 'route-table', label: 'router routes', entries: [{ prefix: '203.0.113.0/24', nextHop: '198.51.100.1', interface: 'eth0', metric: 10, protocol: 'ospf' }] },
    { kind: 'interface-snapshot', label: 'interfaces', interfaces: [{ name: 'eth0', state: 'up', mtu: 1500, addresses: ['198.51.100.2/24'], mac: '02:00:00:00:00:01' }] },
    { kind: 'device-state', label: 'facts', facts: [{ key: 'hostname', value: 'R1' }] },
  ],
}));
assert.equal(sidecar.snapshots.length, 4);
assert.ok(sidecar.snapshots.every((snapshot) => snapshot.provenance === 'IMPORTED EVIDENCE'));
assert.throws(() => parseCaptureSidecarEvidenceJson('{"schema":"wrong"}'), /schema\/version/i);

const cisco = parseNetworkConfiguration(`interface GigabitEthernet0/1\n description uplink\n ip address 192.0.2.1 255.255.255.0\n switchport access vlan 20\nexit\nip route 203.0.113.0 255.255.255.0 192.0.2.254\nrouter ospf 1\n network 192.0.2.0 0.0.0.255 area 0\n`, 'cisco');
assert.ok(cisco.facts.some((entry) => entry.category === 'address'));
assert.ok(cisco.facts.some((entry) => entry.category === 'route'));
assert.ok(cisco.facts.some((entry) => entry.category === 'ospf'));
assert.ok(cisco.facts.every((entry) => entry.provenance === 'PARSED CONFIG'));
assert.match(cisco.boundary, /not runtime state/i);
const juniper = parseNetworkConfiguration(`set interfaces ge-0/0/0 unit 0 family inet address 192.0.2.1/24\nset routing-options static route 203.0.113.0/24 next-hop 192.0.2.254\nset protocols ospf area 0 interface ge-0/0/0.0\nset protocols bgp group TRANSIT neighbor 198.51.100.1\n`, 'juniper');
assert.ok(juniper.facts.some((entry) => entry.category === 'address'));
assert.ok(juniper.facts.some((entry) => entry.category === 'bgp'));
const frr = parseNetworkConfiguration(`interface eth0\n ip address 192.0.2.1/24\nexit\nrouter bgp 64500\n neighbor 198.51.100.1 remote-as 64501\n`, 'frr');
assert.ok(frr.facts.some((entry) => entry.category === 'bgp'));

const counterfactual = buildJourneyCounterfactual('tcp-single-loss');
assert.equal(counterfactual.provenance, 'SIMULATED');
const capturedVsSimulated = compareCaptureConversationToSimulation(session, conversation.id, counterfactual);
assert.ok(capturedVsSimulated);
assert.ok(capturedVsSimulated.facts.every((entry) => entry.simulatedProvenance === 'SIMULATED'));
assert.ok(capturedVsSimulated.facts.every((entry) => entry.capturedProvenance === 'CAPTURED' || entry.capturedProvenance === 'INFERRED'));
assert.match(capturedVsSimulated.boundary, /separate provenance/i);

const opaqueUdp = parseCaptureSession(pcapCapture([{ bytes: udpIpv4Frame(encoder.encode('opaque'), { sourcePort: 443, destinationPort: 53000 }) }]));
const udpConversation = opaqueUdp.conversations[0];
assert.ok(udpConversation);
const quicCounterfactual = buildJourneyCounterfactual('quic-clean');
const udpVsQuic = compareCaptureConversationToSimulation(opaqueUdp, udpConversation.id, quicCounterfactual);
assert.equal(udpVsQuic?.facts.find((entry) => entry.id === 'transport')?.status, 'UNKNOWN', 'UDP/443 cannot be promoted to captured QUIC without evidence');

console.log('Track H closeout contract passed: bounded stream reconstruction with explicit holes, capture-visible RTT, truthful Protocol Theater states, evidence-only aggregates, deterministic capture comparison, worker-wire parity, sidecar/runtime evidence, PARSED CONFIG provenance, and captured-vs-SIMULATED separation.');
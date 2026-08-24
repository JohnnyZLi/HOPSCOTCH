import type {
  JourneyEvent,
  JourneyEventKind,
  JourneyImpairmentProfile,
  JourneyCongestionMetrics,
  JourneyModifierId,
  JourneyProvenance,
  JourneyPolicyMetrics,
  JourneyRouteMetrics,
  JourneyServerMetrics,
  JourneyScale,
  JourneyScenarioConfig,
  JourneyTransportMetrics,
  JourneyTransportProfile,
  JourneyZoomDirection,
} from './model.ts';
import { enumeratePolicyPaths, simulatedAsGraph, traversalFor } from '../internet/asModel.ts';

export interface JourneyModifierContext {
  config: JourneyScenarioConfig;
}

export interface JourneyModifierResult {
  events: JourneyEvent[];
  addedDurationMs: number;
  appliedModifierIds: JourneyModifierId[];
}

interface JourneyModifier {
  id: JourneyModifierId;
  order: number;
  apply(events: JourneyEvent[], context: JourneyModifierContext): JourneyModifierResult;
}

const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['dns-failure', 'route-failure', 'route-leak', 'server-failure', 'single-loss', 'path-outage', 'latency-spike', 'congestion', 'partition'];
const JOURNEY_MODIFIER_SET = new Set<JourneyModifierId>(JOURNEY_MODIFIER_ORDER);

export function normalizeJourneyModifierIds(values: readonly unknown[]): JourneyModifierId[] {
  const selected = new Set<JourneyModifierId>();
  for (const value of values) {
    if (typeof value !== 'string' || !JOURNEY_MODIFIER_SET.has(value as JourneyModifierId)) {
      throw new Error(`Unknown Journey modifier: ${String(value)}.`);
    }
    selected.add(value as JourneyModifierId);
  }
  if (selected.has('route-failure') && selected.has('path-outage')) {
    throw new Error('Journey modifiers route-failure and path-outage are mutually exclusive.');
  }
  return JOURNEY_MODIFIER_ORDER.filter((id) => selected.has(id));
}

export function resolveJourneyModifierIds(config: JourneyScenarioConfig): JourneyModifierId[] {
  if (config.modifierIds !== undefined) return normalizeJourneyModifierIds(config.modifierIds);
  if (config.impairmentProfile === 'clean') return [];
  if (config.impairmentProfile === 'composed') throw new Error('Composed Journey config requires modifierIds.');
  return normalizeJourneyModifierIds([config.impairmentProfile]);
}

export function impairmentProfileForModifiers(modifierIds: readonly JourneyModifierId[]): JourneyImpairmentProfile {
  const normalized = normalizeJourneyModifierIds(modifierIds);
  if (normalized.length === 0) return 'clean';
  if (normalized.length === 1) return normalized[0];
  return 'composed';
}

function modifierEvent(input: {
  id: string;
  atMs: number;
  kind: JourneyEventKind;
  scale: JourneyScale;
  zoom: JourneyZoomDirection;
  protocol: string;
  phase: string;
  title: string;
  summary: string;
  detail: string;
  actor: string;
  target?: string;
  detailLab?: JourneyEvent['detailLab'];
  provenance?: JourneyProvenance;
  transportMetrics?: JourneyTransportMetrics;
  congestionMetrics?: JourneyCongestionMetrics;
  serverMetrics?: JourneyServerMetrics;
  policyMetrics?: JourneyPolicyMetrics;
  routeMetrics?: JourneyRouteMetrics;
}): JourneyEvent {
  const { provenance = 'SIMULATED', ...eventInput } = input;
  return { ...eventInput, provenance };
}

function requireRouteAnchors(events: JourneyEvent[], modifierId: string) {
  const gateway = events.find((current) => current.kind === 'route.gateway');
  const asPath = events.find((current) => current.id === 'as-path');
  const transportStart = events.find((current) => current.kind === 'transport.segment');
  if (!gateway || !asPath || !transportStart) throw new Error(`${modifierId} requires gateway, AS-path, and transport-start events.`);
  if (!(gateway.atMs < asPath.atMs && asPath.atMs < transportStart.atMs)) throw new Error(`${modifierId} requires gateway < AS path < transport start.`);
  return { gateway, asPath, transportStart };
}

function requireResponseAnchors(events: JourneyEvent[], modifierId: string) {
  const data = events.find((current) => current.kind === 'http.data');
  const packetFrame = events.find((current) => current.id === 'packet-frame');
  if (!data || !packetFrame) throw new Error(`${modifierId} requires response data and packet-frame events.`);
  return { data, packetFrame };
}

function shiftPostAnchor(events: JourneyEvent[], anchorMs: number, deltaMs: number): JourneyEvent[] {
  return events.map((current) => current.atMs >= anchorMs ? { ...current, atMs: current.atMs + deltaMs } : current);
}

function tcpLossEvents(dataAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({ id: 'tcp-loss', atMs: dataAtMs + 160, kind: 'transport.loss', scale: 'packet', zoom: 'in', protocol: 'TCP', phase: 'loss', title: 'TCP data segment is lost', summary: 'SEQ 2461–3920 disappears before the receiver.', detail: 'Later TCP bytes can arrive, but cumulative delivery cannot advance beyond the missing receive-next byte.', actor: 'network path', target: 'TCP receiver', detailLab: 'tcp' }),
    modifierEvent({ id: 'tcp-gap', atMs: dataAtMs + 400, kind: 'transport.loss-detected', scale: 'transport', zoom: 'out', protocol: 'TCP', phase: 'gap-detected', title: 'Three duplicate ACK 2461 signals expose the gap', summary: 'Repeated cumulative ACK 2461 tells the sender later bytes arrived beyond a missing range.', detail: 'Three duplicate ACKs trigger the curated fast-retransmit path; the application remains blocked behind the TCP byte gap.', actor: 'TCP receiver', target: 'TCP sender', detailLab: 'tcp' }),
    modifierEvent({ id: 'tcp-retransmit', atMs: dataAtMs + 700, kind: 'transport.retransmit', scale: 'packet', zoom: 'in', protocol: 'TCP', phase: 'retransmit', title: 'Fast retransmit sends SEQ 2461–3920 again', summary: 'The sender retransmits the missing TCP byte range without waiting for the normal retransmission timeout.', detail: 'The repair is a new transmission of the missing byte range; transport sequence semantics remain TCP-specific.', actor: 'TCP sender', target: 'TCP receiver', detailLab: 'tcp' }),
    modifierEvent({ id: 'tcp-recovered', atMs: dataAtMs + 1050, kind: 'transport.recovered', scale: 'application', zoom: 'out', protocol: 'HTTP/2', phase: 'loss-recovered', title: 'HTTP/2 delivery resumes', summary: 'The repaired gap lets the cumulative ACK advance from 2461 to 8301 and releases buffered response bytes.', detail: 'HTTP/2 did not repair the loss itself; TCP restored the ordered byte stream underneath it.', actor: 'TCP receiver', target: 'HTTP/2', detailLab: 'http' }),
  ];
}

function quicLossEvents(dataAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({ id: 'quic-loss', atMs: dataAtMs + 160, kind: 'transport.loss', scale: 'packet', zoom: 'in', protocol: 'QUIC', phase: 'loss', title: 'QUIC packet 4108 is lost', summary: 'Packet 4108 carried STREAM offset 4096–5555 and disappears before the receiver.', detail: 'The QUIC packet number is lost permanently; recovery retransmits the STREAM data in a different packet number.', actor: 'network path', target: 'QUIC receiver', detailLab: 'http' }),
    modifierEvent({ id: 'quic-gap', atMs: dataAtMs + 400, kind: 'transport.loss-detected', scale: 'transport', zoom: 'out', protocol: 'QUIC', phase: 'gap-detected', title: 'ACK ranges expose packet-number gap 4108', summary: 'ACK ranges 4105–4107 and 4109–4112 show that packet 4108 is missing.', detail: 'QUIC loss detection works from packet-number/ACK-range state, not TCP cumulative duplicate ACK semantics.', actor: 'QUIC receiver', target: 'QUIC sender', detailLab: 'http' }),
    modifierEvent({ id: 'quic-retransmit', atMs: dataAtMs + 700, kind: 'transport.retransmit', scale: 'packet', zoom: 'in', protocol: 'QUIC', phase: 'retransmit', title: 'STREAM range is retransmitted in packet 4113', summary: 'STREAM offset 4096–5555 is sent again inside new QUIC packet number 4113.', detail: 'QUIC never retransmits packet number 4108. The data is retransmitted, but the new packet has a new packet number.', actor: 'QUIC sender', target: 'QUIC receiver', detailLab: 'http' }),
    modifierEvent({ id: 'quic-recovered', atMs: dataAtMs + 1050, kind: 'transport.recovered', scale: 'application', zoom: 'out', protocol: 'HTTP/3', phase: 'loss-recovered', title: 'HTTP/3 request stream resumes', summary: 'The repaired STREAM range closes the ordering gap on this HTTP/3 request stream.', detail: 'The affected stream can advance after its missing range arrives; no TCP sequence or cumulative-ACK state exists in this branch.', actor: 'QUIC receiver', target: 'HTTP/3', detailLab: 'http' }),
  ];
}

const singleLossModifier: JourneyModifier = {
  id: 'single-loss',
  order: 100,
  apply(events, context) {
    const { data, packetFrame } = requireResponseAnchors(events, 'single-loss');
    const addedDurationMs = 1600;
    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);
    const injected = context.config.transportProfile === 'tcp-h2'
      ? tcpLossEvents(data.atMs)
      : quicLossEvents(data.atMs);
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['single-loss'],
    };
  },
};


const PRIMARY_ROUTE: JourneyRouteMetrics = { primaryPathCost: 22, alternatePathCost: 52, activePath: 'primary' };
const BROKEN_ROUTE: JourneyRouteMetrics = { primaryPathCost: 22, alternatePathCost: 52, activePath: 'none', failedLinkId: 'r1-core' };
const ALTERNATE_ROUTE: JourneyRouteMetrics = { primaryPathCost: 22, alternatePathCost: 52, activePath: 'alternate', failedLinkId: 'r1-core' };

function routeFailureEvents(gatewayAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({ id: 'route-primary-fails', atMs: gatewayAtMs + 160, kind: 'route.failure', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-failure', title: 'Primary R1 → CORE link fails', summary: 'The selected cost-22 route breaks after the gateway has already been chosen.', detail: 'This failure occurs before TCP SYN or QUIC Initial. HOPSCOTCH isolates routing convergence here instead of inventing transport timeout behavior.', actor: 'R1', target: 'CORE', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'route-primary-invalidated', atMs: gatewayAtMs + 440, kind: 'route.invalidated', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-invalidated', title: 'Installed primary route is invalidated', summary: 'Forwarding through the failed R1 → CORE edge is no longer viable.', detail: 'The physical failure is immediate; a replacement path is not installed until the control plane recomputes the surviving graph.', actor: 'edge router', target: 'routing table', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'route-spf-recompute', atMs: gatewayAtMs + 820, kind: 'route.recompute', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-recompute', title: 'SPF evaluates the surviving graph', summary: 'The cost-52 route through R2 becomes the lowest-cost viable path.', detail: 'The primary route cost was 22. Once its failed edge is removed, EDGE → R2 → CORE is more expensive but reachable.', actor: 'edge router', target: 'SPF engine', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'route-alternate-installed', atMs: gatewayAtMs + 1180, kind: 'route.alternate-installed', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-alternate-ready', title: 'Alternate cost-52 route installed', summary: 'Forwarding can continue through R2 before the transport handshake begins.', detail: 'Recovery comes from routing around the failed link. The failed R1 → CORE edge remains down.', actor: 'routing table', target: 'R2 next hop', detailLab: 'failure', routeMetrics: ALTERNATE_ROUTE }),
  ];
}

const routeFailureModifier: JourneyModifier = {
  id: 'route-failure',
  order: 90,
  apply(events) {
    const { gateway, asPath, transportStart } = requireRouteAnchors(events, 'route-failure');
    const addedDurationMs = 1400;
    const shifted = shiftPostAnchor(events, asPath.atMs, addedDurationMs);
    const injected = routeFailureEvents(gateway.atMs);
    const nextEvents = [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs);
    const firstTransport = nextEvents.find((current) => current.kind === 'transport.segment');
    const alternate = nextEvents.find((current) => current.kind === 'route.alternate-installed');
    if (!firstTransport || !alternate || alternate.atMs >= firstTransport.atMs) throw new Error('route-failure must converge before transport begins.');
    if (transportStart.atMs + addedDurationMs !== firstTransport.atMs) throw new Error('route-failure shifted transport by an unexpected amount.');
    return { events: nextEvents, addedDurationMs, appliedModifierIds: ['route-failure'] };
  },
};


function latestTransportRecovery(events: JourneyEvent[]): JourneyEvent | undefined {
  return events
    .filter((current) => current.kind === 'transport.recovered')
    .sort((a, b) => b.atMs - a.atMs)[0];
}

function pathOutageRouteEvents(baseAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({ id: 'path-outage-primary-fails', atMs: baseAtMs + 160, kind: 'route.failure', scale: 'routing', zoom: 'out', protocol: 'OSPF teaching model', phase: 'path-outage', title: 'The active path fails mid-transfer', summary: 'R1 → CORE disappears while response bytes are already in flight.', detail: 'Unlike the pre-transport ROUTE modifier, this failure crosses an established transport flow. In-flight delivery can be lost before the control plane installs the alternate path.', actor: 'R1', target: 'CORE', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'path-outage-inflight-loss', atMs: baseAtMs + 200, kind: 'transport.loss', scale: 'packet', zoom: 'in', protocol: 'IP forwarding', phase: 'outage-loss', title: 'In-flight response data loses its forwarding path', summary: 'One response flight disappears with the failed next hop.', detail: 'Routing failure is the cause; transport loss is the consequence. HOPSCOTCH keeps those two causal layers separate in the event log.', actor: 'failed network path', target: 'transport receiver', detailLab: 'packet', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'path-outage-route-invalidated', atMs: baseAtMs + 360, kind: 'route.invalidated', scale: 'routing', zoom: 'out', protocol: 'OSPF teaching model', phase: 'outage-invalidated', title: 'The installed primary route is invalidated', summary: 'Forwarding through R1 → CORE is no longer viable.', detail: 'Transport remains established, but the forwarding table currently has no usable path for the affected destination.', actor: 'edge router', target: 'routing table', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'path-outage-spf-recompute', atMs: baseAtMs + 620, kind: 'route.recompute', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'outage-recompute', title: 'SPF recomputes around the failed link', summary: 'The surviving cost-52 path through R2 becomes the best reachable route.', detail: 'The transport connection is not recreated. Routing is repairing reachability underneath the still-existing connection.', actor: 'edge router', target: 'SPF engine', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'path-outage-alternate-installed', atMs: baseAtMs + 900, kind: 'route.alternate-installed', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'outage-route-ready', title: 'Alternate path installed under the live connection', summary: 'R2 → CORE restores forwarding at cost 52.', detail: 'Routing convergence restores reachability, but it does not repair data already lost during the outage. The transport protocol still has to detect and recover that missing delivery.', actor: 'routing table', target: 'R2 next hop', detailLab: 'failure', routeMetrics: ALTERNATE_ROUTE }),
  ];
}

function tcpPathOutageEvents(baseAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({ id: 'tcp-outage-rto', atMs: baseAtMs + 1160, kind: 'transport.loss-detected', scale: 'transport', zoom: 'in', protocol: 'TCP', phase: 'outage-rto', title: 'ACK silence reaches the TCP retransmission timeout', summary: 'No cumulative ACK advances for the missing response bytes; the teaching RTO reaches its 1 s minimum.', detail: 'This is not the duplicate-ACK fast-retransmit story used by the single-loss modifier. The path outage suppresses useful feedback long enough that the sender relies on its retransmission timer.', actor: 'TCP retransmission timer', target: 'TCP sender', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, timerLabel: 'RTO', timerMs: 1000, lossDetected: true } }),
    modifierEvent({ id: 'tcp-outage-retransmit', atMs: baseAtMs + 1380, kind: 'transport.retransmit', scale: 'packet', zoom: 'in', protocol: 'TCP', phase: 'outage-retransmit', title: 'TCP retransmits the missing byte range over R2', summary: 'SEQ 2461–3920 is sent again after the alternate route exists.', detail: 'The TCP sequence space does not change just because IP forwarding changed underneath it. The same missing byte range is retransmitted over the newly available route.', actor: 'TCP sender', target: 'TCP receiver', detailLab: 'tcp', routeMetrics: ALTERNATE_ROUTE }),
    modifierEvent({ id: 'tcp-outage-recovered', atMs: baseAtMs + 1740, kind: 'transport.recovered', scale: 'application', zoom: 'out', protocol: 'HTTP/2', phase: 'outage-recovered', title: 'HTTP/2 delivery resumes on the surviving route', summary: 'The retransmitted TCP bytes close the gap and cumulative delivery advances again.', detail: 'The HTTP/2 connection survives because TCP recovered after IP reachability returned; no new TCP or TLS handshake was required.', actor: 'TCP receiver', target: 'HTTP/2', detailLab: 'http', routeMetrics: ALTERNATE_ROUTE }),
  ];
}

function quicPathOutageEvents(baseAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({ id: 'quic-outage-pto1', atMs: baseAtMs + 300, kind: 'transport.loss-detected', scale: 'transport', zoom: 'in', protocol: 'QUIC', phase: 'outage-pto', title: 'QUIC PTO fires before routing has recovered', summary: 'ACK progress stops and QUIC reaches a probe timeout while the primary route is still unusable.', detail: 'QUIC reacts earlier than the TCP 1 s teaching RTO, but a transport timer cannot repair missing IP reachability.', actor: 'QUIC PTO timer', target: 'QUIC sender', detailLab: 'http', transportMetrics: { baselineRttMs: 32, smoothedRttMs: 32, rttVarMs: 8, ackDelayMs: 25, timerLabel: 'PTO', timerMs: 89, lossDetected: true } }),
    modifierEvent({ id: 'quic-outage-probe', atMs: baseAtMs + 470, kind: 'transport.retransmit', scale: 'packet', zoom: 'in', protocol: 'QUIC', phase: 'outage-probe', title: 'A QUIC probe cannot make forward progress', summary: 'Probe traffic is generated, but the forwarding path is still broken.', detail: 'This probe does not prove recovery. HOPSCOTCH keeps the route at NONE until SPF installs the alternate path.', actor: 'QUIC sender', target: 'failed network path', detailLab: 'http', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'quic-outage-pto2', atMs: baseAtMs + 760, kind: 'transport.loss-detected', scale: 'transport', zoom: 'out', protocol: 'QUIC', phase: 'outage-pto-backoff', title: 'QUIC remains in PTO backoff during convergence', summary: 'The connection still has no ACK progress while SPF is finishing the alternate route.', detail: 'Probe timeout backoff is transport state; route recomputation is control-plane state. They advance independently until reachability returns.', actor: 'QUIC loss detector', target: 'QUIC sender', detailLab: 'http', transportMetrics: { baselineRttMs: 32, smoothedRttMs: 32, rttVarMs: 8, ackDelayMs: 25, timerLabel: 'PTO', timerMs: 178, lossDetected: true } }),
    modifierEvent({ id: 'quic-outage-retransmit', atMs: baseAtMs + 1080, kind: 'transport.retransmit', scale: 'packet', zoom: 'in', protocol: 'QUIC', phase: 'outage-retransmit', title: 'Missing STREAM data is sent in new packet 4216', summary: 'STREAM offset 4096–5555 is retransmitted after R2 becomes active.', detail: 'QUIC does not reuse the lost packet number. The STREAM data moves in a new QUIC packet number over the restored IP path.', actor: 'QUIC sender', target: 'QUIC receiver', detailLab: 'http', routeMetrics: ALTERNATE_ROUTE }),
    modifierEvent({ id: 'quic-outage-recovered', atMs: baseAtMs + 1320, kind: 'transport.recovered', scale: 'application', zoom: 'out', protocol: 'HTTP/3', phase: 'outage-recovered', title: 'HTTP/3 stream resumes over the alternate path', summary: 'The new QUIC packet closes the missing STREAM range and request-stream delivery advances.', detail: 'The QUIC connection and TLS 1.3 state survive the routing outage; neither a TCP connection nor a new TLS handshake is introduced.', actor: 'QUIC receiver', target: 'HTTP/3', detailLab: 'http', routeMetrics: ALTERNATE_ROUTE }),
  ];
}

const pathOutageModifier: JourneyModifier = {
  id: 'path-outage',
  order: 105,
  apply(events, context) {
    const { data, packetFrame } = requireResponseAnchors(events, 'path-outage');
    const priorRecovery = latestTransportRecovery(events);
    const baseAtMs = priorRecovery?.atMs ?? data.atMs;
    const addedDurationMs = 2200;
    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);
    const injected = [
      ...pathOutageRouteEvents(baseAtMs),
      ...(context.config.transportProfile === 'tcp-h2' ? tcpPathOutageEvents(baseAtMs) : quicPathOutageEvents(baseAtMs)),
    ];
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['path-outage'],
    };
  },
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function tcpEstimator(sampleRttMs: number, previousSmoothedRttMs = 32, previousRttVarMs = 8): JourneyTransportMetrics {
  const rttVarMs = (3 / 4) * previousRttVarMs + (1 / 4) * Math.abs(previousSmoothedRttMs - sampleRttMs);
  const smoothedRttMs = (7 / 8) * previousSmoothedRttMs + (1 / 8) * sampleRttMs;
  const calculatedRtoMs = smoothedRttMs + Math.max(1, 4 * rttVarMs);
  return {
    baselineRttMs: 32,
    latestRttMs: sampleRttMs,
    smoothedRttMs: round1(smoothedRttMs),
    rttVarMs: round1(rttVarMs),
    timerLabel: 'RTO',
    timerMs: Math.max(1000, Math.ceil(calculatedRtoMs)),
    lossDetected: false,
  };
}

function quicEstimator(sampleRttMs: number, previousSmoothedRttMs = 32, previousRttVarMs = 8): JourneyTransportMetrics {
  const maxAckDelayMs = 25;
  const minRttMs = 32;
  const adjustedRttMs = sampleRttMs >= minRttMs + maxAckDelayMs ? sampleRttMs - maxAckDelayMs : sampleRttMs;
  const rttVarMs = (3 / 4) * previousRttVarMs + (1 / 4) * Math.abs(previousSmoothedRttMs - adjustedRttMs);
  const smoothedRttMs = (7 / 8) * previousSmoothedRttMs + (1 / 8) * adjustedRttMs;
  const ptoMs = smoothedRttMs + Math.max(4 * rttVarMs, 1) + maxAckDelayMs;
  return {
    baselineRttMs: 32,
    latestRttMs: sampleRttMs,
    adjustedRttMs: round1(adjustedRttMs),
    smoothedRttMs: round1(smoothedRttMs),
    rttVarMs: round1(rttVarMs),
    ackDelayMs: maxAckDelayMs,
    timerLabel: 'PTO',
    timerMs: round1(ptoMs),
    lossDetected: false,
  };
}

function latencyEvents(transportProfile: JourneyTransportProfile, dataAtMs: number): JourneyEvent[] {
  if (transportProfile === 'tcp-h2') {
    const slow = tcpEstimator(220);
    const recovery = tcpEstimator(46, slow.smoothedRttMs, slow.rttVarMs);
    return [
      modifierEvent({ id: 'tcp-latency-start', atMs: dataAtMs + 160, kind: 'transport.latency', scale: 'transport', zoom: 'out', protocol: 'TCP', phase: 'latency-spike', title: 'RTT spike stretches the TCP ACK clock', summary: 'A simulated queueing delay raises the next RTT sample from 32 ms to 220 ms; no TCP segment is lost.', detail: 'Feedback arrives later, so delivery pacing slows. There is no sequence gap, duplicate-ACK loss signal, or retransmission in this modifier.', actor: 'network queue', target: 'TCP sender', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, latestRttMs: 220, lossDetected: false } }),
      modifierEvent({ id: 'tcp-rtt-update', atMs: dataAtMs + 500, kind: 'transport.rtt-update', scale: 'transport', zoom: 'hold', protocol: 'TCP', phase: 'rtt-estimator', title: 'TCP RTT estimator absorbs the slow sample', summary: `SRTT rises to ${slow.smoothedRttMs} ms and RTTVAR to ${slow.rttVarMs} ms; the RFC 6298 teaching RTO remains at its 1 s minimum.`, detail: 'The timer estimator expands because the observed round trip became slower and more variable. No loss-driven congestion response is inferred from RTT alone.', actor: 'TCP RTT estimator', target: 'retransmission timer', detailLab: 'tcp', transportMetrics: slow }),
      modifierEvent({ id: 'tcp-latency-clear', atMs: dataAtMs + 900, kind: 'transport.latency-cleared', scale: 'application', zoom: 'out', protocol: 'HTTP/2', phase: 'latency-normalized', title: 'Queue drains; HTTP/2 pacing normalizes', summary: `A later 46 ms RTT sample begins pulling the estimator back down; SRTT is now about ${recovery.smoothedRttMs} ms.`, detail: 'The response continues without fast retransmit or a packet-loss event. RTT estimators decay over subsequent samples rather than snapping instantly to baseline.', actor: 'network queue', target: 'HTTP/2', detailLab: 'http', transportMetrics: recovery }),
    ];
  }

  const slow = quicEstimator(220);
  const recovery = quicEstimator(46, slow.smoothedRttMs, slow.rttVarMs);
  return [
    modifierEvent({ id: 'quic-latency-start', atMs: dataAtMs + 160, kind: 'transport.latency', scale: 'transport', zoom: 'out', protocol: 'QUIC', phase: 'latency-spike', title: 'A QUIC ACK arrives late', summary: 'A simulated queueing delay raises latest_rtt from 32 ms to 220 ms; no QUIC packet-number gap exists.', detail: 'The response waits longer for feedback, but latency alone is not modeled as packet loss or a retransmission trigger.', actor: 'network queue', target: 'QUIC sender', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 220, ackDelayMs: 25, lossDetected: false } }),
    modifierEvent({ id: 'quic-rtt-update', atMs: dataAtMs + 500, kind: 'transport.rtt-update', scale: 'transport', zoom: 'hold', protocol: 'QUIC', phase: 'rtt-estimator', title: 'QUIC RTT and PTO estimates expand', summary: `After ACK-delay adjustment, smoothed RTT is about ${slow.smoothedRttMs} ms, RTTVAR ${slow.rttVarMs} ms, and PTO about ${slow.timerMs} ms.`, detail: 'QUIC updates RTT/PTO estimation from ACK timing. This event contains no packet-threshold/time-threshold loss declaration and no loss-driven congestion-window reduction.', actor: 'QUIC RTT estimator', target: 'PTO timer', detailLab: 'http', transportMetrics: slow }),
    modifierEvent({ id: 'quic-latency-clear', atMs: dataAtMs + 900, kind: 'transport.latency-cleared', scale: 'application', zoom: 'out', protocol: 'HTTP/3', phase: 'latency-normalized', title: 'Queue drains; HTTP/3 pacing normalizes', summary: `A later 46 ms sample begins reducing the estimator; smoothed RTT is now about ${recovery.smoothedRttMs} ms.`, detail: 'No STREAM retransmission was needed. The connection simply observes faster feedback again while estimator history decays over later samples.', actor: 'network queue', target: 'HTTP/3', detailLab: 'http', transportMetrics: recovery }),
  ];
}

const latencySpikeModifier: JourneyModifier = {
  id: 'latency-spike',
  order: 110,
  apply(events, context) {
    const { data, packetFrame } = requireResponseAnchors(events, 'latency-spike');
    const recovered = latestTransportRecovery(events);
    const latencyBaseAtMs = recovered?.atMs ?? data.atMs;
    const addedDurationMs = 1200;
    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);
    return {
      events: [...shifted, ...latencyEvents(context.config.transportProfile, latencyBaseAtMs)].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['latency-spike'],
    };
  },
};



function latestTransportEpisodeEnd(events: JourneyEvent[]): JourneyEvent | undefined {
  return events
    .filter((current) => current.kind === 'transport.recovered' || current.kind === 'transport.latency-cleared')
    .sort((a, b) => b.atMs - a.atMs)[0];
}

function congestionMetrics(input: Partial<JourneyCongestionMetrics> = {}): JourneyCongestionMetrics {
  return {
    bottleneckRateMbps: 100,
    offeredRateMbps: 160,
    queueCapacityPackets: 32,
    queueOccupancyPackets: 8,
    queueDelayMs: 24,
    ecnCeMarks: 0,
    congestionWindowPackets: 12,
    slowStartThresholdPackets: 24,
    signal: 'NONE',
    droppedPackets: 0,
    ...input,
  };
}

function tcpCongestionEvents(baseAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({ id: 'tcp-congestion-queue-start', atMs: baseAtMs + 160, kind: 'transport.queue-growth', scale: 'transport', zoom: 'out', protocol: 'TCP', phase: 'queue-growth', title: 'A bottleneck queue starts to build', summary: 'The sender offers about 160 Mb/s to a 100 Mb/s bottleneck, so packets begin waiting instead of disappearing.', detail: 'Queueing raises delay before it creates a transport loss signal. TCP still has a contiguous sequence space and no retransmission is justified.', actor: 'bottleneck queue', target: 'TCP flow', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, latestRttMs: 56, lossDetected: false }, congestionMetrics: congestionMetrics() }),
    modifierEvent({ id: 'tcp-congestion-queue-high', atMs: baseAtMs + 420, kind: 'transport.queue-growth', scale: 'transport', zoom: 'hold', protocol: 'TCP', phase: 'queue-high', title: 'Queueing delay grows before any drop', summary: 'The queue reaches 24 of 32 packets and contributes roughly 96 ms of delay.', detail: 'This is a congestion precursor, not packet loss. The receiver can still acknowledge a complete TCP byte stream.', actor: 'bottleneck queue', target: 'TCP ACK clock', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, latestRttMs: 128, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 24, queueDelayMs: 96 }) }),
    modifierEvent({ id: 'tcp-congestion-ecn', atMs: baseAtMs + 680, kind: 'transport.ecn-mark', scale: 'packet', zoom: 'in', protocol: 'IP ECN', phase: 'ecn-ce', title: 'ECN marks congestion without dropping the packet', summary: 'Three packets arrive with the IP CE codepoint while the queue approaches capacity.', detail: 'The curated bottleneck is ECN-capable: CE is an explicit congestion signal carried on delivered packets, not a missing TCP sequence range.', actor: 'ECN-capable bottleneck', target: 'TCP receiver', detailLab: 'packet', transportMetrics: { baselineRttMs: 32, latestRttMs: 136, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 26, queueDelayMs: 104, ecnCeMarks: 3, signal: 'CE' }) }),
    modifierEvent({ id: 'tcp-congestion-response', atMs: baseAtMs + 900, kind: 'transport.congestion-response', scale: 'transport', zoom: 'out', protocol: 'TCP ECN', phase: 'ecn-response', title: 'TCP ECE feedback cuts the congestion window', summary: 'ECE feedback causes the teaching cwnd to fall from 12 to 6 packets; the sender answers with CWR.', detail: 'There is no TCP sequence gap and no retransmission. Congestion control reduces sending pressure because ECN reported congestion before a drop was needed.', actor: 'TCP sender', target: 'bottleneck queue', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, latestRttMs: 104, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 20, queueDelayMs: 72, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: 6, signal: 'ECE/CWR' }) }),
    modifierEvent({ id: 'tcp-congestion-cleared', atMs: baseAtMs + 1320, kind: 'transport.congestion-cleared', scale: 'application', zoom: 'out', protocol: 'HTTP/2', phase: 'queue-drained', title: 'The queue drains after TCP backs off', summary: 'With offered load below the bottleneck rate, occupancy falls to four packets and response pacing steadies.', detail: 'HTTP/2 continues on the same TCP/TLS connection. No packet was dropped and no repair transmission was required in this ECN episode.', actor: 'bottleneck queue', target: 'HTTP/2', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 44, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 4, queueDelayMs: 12, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: 6, signal: 'NONE' }) }),
  ];
}

function quicCongestionEvents(baseAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({ id: 'quic-congestion-queue-start', atMs: baseAtMs + 160, kind: 'transport.queue-growth', scale: 'transport', zoom: 'out', protocol: 'QUIC', phase: 'queue-growth', title: 'A bottleneck queue starts to build', summary: 'The QUIC sender offers about 160 Mb/s to a 100 Mb/s bottleneck, so packets spend longer waiting in the queue.', detail: 'Queueing changes ACK timing first. There is no packet-number gap, PTO recovery, or STREAM retransmission in this congestion-only episode.', actor: 'bottleneck queue', target: 'QUIC flow', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 56, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ slowStartThresholdPackets: undefined }) }),
    modifierEvent({ id: 'quic-congestion-queue-high', atMs: baseAtMs + 420, kind: 'transport.queue-growth', scale: 'transport', zoom: 'hold', protocol: 'QUIC', phase: 'queue-high', title: 'Queueing delay grows before any drop', summary: 'The queue reaches 24 of 32 packets and latest_rtt rises as feedback spends longer in the path.', detail: 'The QUIC packet-number space remains contiguous from the receiver perspective. Higher RTT by itself is not a QUIC loss declaration.', actor: 'bottleneck queue', target: 'QUIC ACK timing', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 128, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 24, queueDelayMs: 96, slowStartThresholdPackets: undefined }) }),
    modifierEvent({ id: 'quic-congestion-ecn', atMs: baseAtMs + 680, kind: 'transport.ecn-mark', scale: 'packet', zoom: 'in', protocol: 'IP ECN', phase: 'ecn-ce', title: 'ECN marks QUIC packets instead of dropping them', summary: 'The receiver observes three additional CE-marked packets while all packet numbers still arrive.', detail: 'The packet remains delivered. ACK_ECN can report increasing CE counters without inventing a packet-number gap or STREAM loss.', actor: 'ECN-capable bottleneck', target: 'QUIC receiver', detailLab: 'packet', transportMetrics: { baselineRttMs: 32, latestRttMs: 136, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 26, queueDelayMs: 104, ecnCeMarks: 3, signal: 'CE', slowStartThresholdPackets: undefined }) }),
    modifierEvent({ id: 'quic-congestion-response', atMs: baseAtMs + 900, kind: 'transport.congestion-response', scale: 'transport', zoom: 'out', protocol: 'QUIC ACK_ECN', phase: 'ecn-response', title: 'ACK_ECN feedback reduces the QUIC congestion window', summary: 'Validated CE-counter growth causes the teaching congestion window to fall from 12 to 6 packets.', detail: 'There is no QUIC packet-number gap, retransmission, or PTO recovery here. The sender reduces in-flight pressure because ACK_ECN explicitly reported congestion.', actor: 'QUIC sender', target: 'bottleneck queue', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 104, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 20, queueDelayMs: 72, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: undefined, signal: 'ACK_ECN' }) }),
    modifierEvent({ id: 'quic-congestion-cleared', atMs: baseAtMs + 1320, kind: 'transport.congestion-cleared', scale: 'application', zoom: 'out', protocol: 'HTTP/3', phase: 'queue-drained', title: 'The queue drains after QUIC backs off', summary: 'Offered load falls below the bottleneck rate, occupancy returns to four packets, and request-stream pacing steadies.', detail: 'HTTP/3 continues on the same QUIC/TLS state. No packet or STREAM data was lost, so there is nothing to retransmit.', actor: 'bottleneck queue', target: 'HTTP/3', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 44, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 4, queueDelayMs: 12, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: undefined, signal: 'NONE' }) }),
  ];
}

const congestionModifier: JourneyModifier = {
  id: 'congestion',
  order: 120,
  apply(events, context) {
    const { data, packetFrame } = requireResponseAnchors(events, 'congestion');
    const priorEpisode = latestTransportEpisodeEnd(events);
    const baseAtMs = priorEpisode?.atMs ?? data.atMs;
    const addedDurationMs = 1700;
    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);
    const injected = context.config.transportProfile === 'tcp-h2'
      ? tcpCongestionEvents(baseAtMs)
      : quicCongestionEvents(baseAtMs);
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['congestion'],
    };
  },
};



function dnsFailureMissEvents(recursiveAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({
      id: 'dns-primary-timeout',
      atMs: recursiveAtMs + 600,
      kind: 'dns.timeout',
      scale: 'application',
      zoom: 'hold',
      protocol: 'DNS',
      phase: 'resolver-timeout',
      title: 'Primary recursive resolver does not answer',
      summary: 'The first recursive A-query attempt produces no DNS response before the teaching timeout.',
      detail: 'A timeout is the absence of a response. HOPSCOTCH does not turn silence into NXDOMAIN or SERVFAIL, because neither response was received.',
      actor: 'primary recursive resolver',
      target: 'stub resolver',
      detailLab: 'dns',
    }),
    modifierEvent({
      id: 'dns-secondary-retry',
      atMs: recursiveAtMs + 900,
      kind: 'dns.retry',
      scale: 'application',
      zoom: 'hold',
      protocol: 'DNS',
      phase: 'resolver-retry',
      title: 'Stub retries through a secondary recursive resolver',
      summary: 'The same logical A question is sent through the configured secondary recursive path after the primary attempt times out.',
      detail: 'This curated retry uses a new transaction context and a secondary recursive resolver. It is not a replayed DNS answer and does not imply that every operating system uses identical fallback timing.',
      actor: 'stub resolver',
      target: 'secondary recursive resolver',
      detailLab: 'dns',
    }),
  ];
}

function dnsFailureMaskedEvent(cacheHitAtMs: number): JourneyEvent {
  return modifierEvent({
    id: 'dns-outage-masked',
    atMs: cacheHitAtMs + 180,
    kind: 'dns.failure-masked',
    scale: 'application',
    zoom: 'hold',
    protocol: 'DNS',
    phase: 'outage-masked',
    title: 'Cache hit masks the upstream DNS outage',
    summary: 'The local cached answer is already usable, so the unavailable upstream resolver path is never consulted.',
    detail: 'No upstream query is required, so HOPSCOTCH does not fabricate a timeout packet, DNS retry, or resolver delay. The cached TTL continues to age normally.',
    actor: 'local DNS cache',
    target: 'application',
    detailLab: 'dns',
  });
}

const dnsFailureModifier: JourneyModifier = {
  id: 'dns-failure',
  order: 70,
  apply(events, context) {
    if (context.config.dnsProfile === 'cache-hit') {
      const cacheHit = events.find((current) => current.kind === 'dns.cache-hit');
      const routeLookup = events.find((current) => current.kind === 'route.lookup');
      if (!cacheHit || !routeLookup || cacheHit.atMs >= routeLookup.atMs) throw new Error('dns-failure cache-hit path requires cache hit before route lookup.');
      const masked = dnsFailureMaskedEvent(cacheHit.atMs);
      if (masked.atMs >= routeLookup.atMs) throw new Error('dns-failure masked event must remain before route lookup.');
      return {
        events: [...events, masked].sort((a, b) => a.atMs - b.atMs),
        addedDurationMs: 0,
        appliedModifierIds: ['dns-failure'],
      };
    }

    const recursive = events.find((current) => current.id === 'dns-recursive');
    const root = events.find((current) => current.id === 'dns-root');
    if (!recursive || !root || recursive.atMs >= root.atMs) throw new Error('dns-failure cache-miss path requires recursive query before root referral.');
    const addedDurationMs = 1200;
    const shifted = shiftPostAnchor(events, root.atMs, addedDurationMs);
    const injected = dnsFailureMissEvents(recursive.atMs);
    if (!(recursive.atMs < injected[0].atMs && injected[0].atMs < injected[1].atMs && injected[1].atMs < root.atMs + addedDurationMs)) {
      throw new Error('dns-failure must order query < timeout < retry < root referral.');
    }
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['dns-failure'],
    };
  },
};



function serverMetrics(input: Partial<JourneyServerMetrics> = {}): JourneyServerMetrics {
  return {
    statusCode: 503,
    retryAfterMs: 1000,
    requestMethod: 'GET',
    idempotent: true,
    retrySafe: true,
    transportReused: true,
    ...input,
  };
}

function serverFailureEvents(requestAtMs: number, frameReadyAtMs: number, transportProfile: JourneyTransportProfile): JourneyEvent[] {
  const protocol = transportProfile === 'quic-h3' ? 'HTTP/3' : 'HTTP/2';
  const detailLab = 'http' as const;
  const responseBaseMs = Math.max(requestAtMs, frameReadyAtMs);
  return [
    modifierEvent({
      id: 'server-service-unavailable',
      atMs: responseBaseMs + 180,
      kind: 'server.unavailable',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'service-unavailable',
      title: 'The application service becomes temporarily unavailable',
      summary: 'The request reached a healthy network endpoint, but the application service cannot produce the successful representation yet.',
      detail: 'DNS, IP routing, the established transport connection, and TLS keys remain valid. This failure lives at the HTTP/application boundary.',
      actor: 'application service',
      target: 'HTTP request',
      detailLab,
      serverMetrics: serverMetrics(),
    }),
    modifierEvent({
      id: 'server-http-503',
      atMs: responseBaseMs + 340,
      kind: 'http.service-unavailable',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'http-503',
      title: 'HTTP 503 Service Unavailable returns',
      summary: 'The reachable server returns a real HTTP 503 response with Retry-After: 1.',
      detail: 'Unlike DNS timeout silence, this is an application-layer response. The server is reachable enough to return status and retry guidance on the existing connection.',
      actor: 'HTTP server',
      target: 'browser',
      detailLab,
      serverMetrics: serverMetrics(),
    }),
    modifierEvent({
      id: 'server-retry-wait',
      atMs: responseBaseMs + 520,
      kind: 'http.retry-wait',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'retry-wait',
      title: 'Client honors Retry-After before replaying the GET',
      summary: 'The teaching client waits one second instead of hammering the unavailable service.',
      detail: 'The connection remains established during the wait. Retry safety comes from this canonical GET being idempotent; arbitrary requests must not be assumed safe to replay.',
      actor: 'browser',
      target: 'HTTP server',
      detailLab,
      serverMetrics: serverMetrics(),
    }),
    modifierEvent({
      id: 'server-service-ready',
      atMs: responseBaseMs + 1240,
      kind: 'server.recovered',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'service-ready',
      title: 'The application service becomes ready again',
      summary: 'Server-side availability recovers while the original client transport and TLS session remain usable.',
      detail: 'No DNS lookup, route change, TCP/QUIC handshake, or TLS handshake is needed to represent this service recovery.',
      actor: 'application service',
      target: 'HTTP endpoint',
      detailLab,
      serverMetrics: serverMetrics({ statusCode: undefined }),
    }),
    modifierEvent({
      id: 'server-get-retry',
      atMs: responseBaseMs + 1340,
      kind: 'http.retry',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'safe-get-retry',
      title: 'The idempotent GET is retried on the same connection',
      summary: 'Exactly one second after the 503, the canonical GET / is replayed using the already-established transport and TLS state.',
      detail: 'This teaching retry is safe because GET is idempotent. HOPSCOTCH does not imply arbitrary requests, especially non-idempotent writes, can always be retried automatically.',
      actor: 'browser',
      target: 'HTTP server',
      detailLab,
      serverMetrics: serverMetrics({ statusCode: undefined }),
    }),
  ];
}


function routeLeakTraversal(asns: number[]): Array<'up' | 'peer' | 'down'> {
  const traversals: Array<'up' | 'peer' | 'down'> = [];
  for (let index = 0; index < asns.length - 1; index += 1) {
    const from = asns[index];
    const to = asns[index + 1];
    const relationship = simulatedAsGraph.relationships.find((candidate) => traversalFor(candidate, from, to) !== null);
    if (!relationship) throw new Error(`route-leak teaching path is missing AS${from} → AS${to} from the Lab 05 graph.`);
    const traversal = traversalFor(relationship, from, to);
    if (!traversal) throw new Error(`route-leak cannot derive traversal AS${from} → AS${to}.`);
    traversals.push(traversal);
  }
  return traversals;
}

function routeLeakMetricStates() {
  const legitimatePathAsns = [64504, 65540, 65538];
  const leakedPathAsns = [64504, 64500, 65538];
  const legitimate = enumeratePolicyPaths(simulatedAsGraph, 64504, 65538)
    .find((candidate) => candidate.asns.join(',') === legitimatePathAsns.join(','));
  if (!legitimate) throw new Error('route-leak requires the existing policy-compliant AS64504 → AS65540 → AS65538 candidate.');
  const legitimateTraversal = routeLeakTraversal(legitimatePathAsns);
  const leakedTraversal = routeLeakTraversal(leakedPathAsns);
  if (legitimateTraversal.join(',') !== 'peer,down') throw new Error('route-leak legitimate path no longer matches the Lab 05 peer → down teaching policy.');
  if (leakedTraversal.join(',') !== 'down,peer') throw new Error('route-leak leaked path must expose the down → peer valley violation.');
  if (enumeratePolicyPaths(simulatedAsGraph, 64504, 65538).some((candidate) => candidate.asns.join(',') === leakedPathAsns.join(','))) {
    throw new Error('route-leak leaked path unexpectedly passed the normal valley-free enumerator.');
  }
  const common = {
    legitimatePathAsns,
    leakedPathAsns,
    legitimateTraversal,
    leakedTraversal,
    legitimateLocalPreference: legitimate.localPreference,
    leakedLocalPreference: 300,
    leakSourceAsn: 64500,
    decisionAsn: 64504,
    destinationAsn: 65538,
    learnedFrom: 'peer' as const,
    exportedTo: 'provider' as const,
    reachable: true,
  };
  const normal: JourneyPolicyMetrics = {
    ...common,
    activePathAsns: legitimatePathAsns,
    activeLocalPreference: legitimate.localPreference,
    selectedPathPolicyCompliant: true,
    exportPolicyCompliant: true,
  };
  const advertised: JourneyPolicyMetrics = {
    ...normal,
    exportPolicyCompliant: false,
  };
  const leaked: JourneyPolicyMetrics = {
    ...common,
    activePathAsns: leakedPathAsns,
    activeLocalPreference: 300,
    selectedPathPolicyCompliant: false,
    exportPolicyCompliant: false,
  };
  return { normal, advertised, leaked, restored: normal };
}

function routeLeakEvents(asPathAtMs: number): JourneyEvent[] {
  const metrics = routeLeakMetricStates();
  return [
    modifierEvent({
      id: 'route-leak-advertised',
      atMs: asPathAtMs + 180,
      kind: 'internet.route-leak-advertised',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'route-leak-advertised',
      title: 'AS64500 leaks a peer-learned route to its provider',
      summary: 'A route learned from peer AS65538 is incorrectly exported upward to provider AS64504.',
      detail: 'The export itself violates the curated valley-free teaching policy. Forwarding has not failed: the legitimate AS64504 → AS65540 → AS65538 path is still selected at this instant.',
      actor: 'AS64500',
      target: 'AS64504',
      detailLab: 'internet',
      policyMetrics: metrics.advertised,
    }),
    modifierEvent({
      id: 'route-leak-selected',
      atMs: asPathAtMs + 460,
      kind: 'internet.route-leak-selected',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'route-leak-selected',
      title: 'AS64504 selects the leaked customer advertisement',
      summary: 'The deterministic teaching LOCAL_PREF changes from peer-learned 200 to customer-learned 300.',
      detail: 'AS64504 now forwards through AS64500 → AS65538. This is a curated policy demonstration, not a claim that every network implements identical BGP preference rules.',
      actor: 'AS64504 decision process',
      target: 'AS64500',
      detailLab: 'internet',
      policyMetrics: metrics.leaked,
    }),
    modifierEvent({
      id: 'route-leak-anomaly',
      atMs: asPathAtMs + 760,
      kind: 'internet.policy-anomaly',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'policy-anomaly',
      title: 'Reachable path violates the valley-free export policy',
      summary: 'The selected path is AS64504 → AS64500 → AS65538: physically connected, but its down → peer relationship sequence is policy-invalid.',
      detail: 'This is the core lesson: reachability and policy correctness are separate dimensions. HOPSCOTCH keeps REACHABLE = YES while POLICY COMPLIANT = NO.',
      actor: 'policy monitor',
      target: 'selected AS path',
      detailLab: 'internet',
      policyMetrics: metrics.leaked,
    }),
    modifierEvent({
      id: 'route-leak-withdrawn',
      atMs: asPathAtMs + 1080,
      kind: 'internet.route-leak-withdrawn',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'route-leak-withdrawn',
      title: 'The leaked advertisement is filtered and withdrawn',
      summary: 'AS64504 stops accepting the bad customer advertisement after the policy anomaly is contained.',
      detail: 'Containment removes the policy-invalid route; it does not require a local OSPF failure, packet retransmission, or transport reset.',
      actor: 'AS64504 policy filter',
      target: 'AS64500 advertisement',
      detailLab: 'internet',
      policyMetrics: metrics.leaked,
    }),
    modifierEvent({
      id: 'route-leak-restored',
      atMs: asPathAtMs + 1320,
      kind: 'internet.policy-restored',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'policy-restored',
      title: 'Policy-compliant peer path is selected again',
      summary: 'AS64504 returns to AS64504 → AS65540 → AS65538 with teaching LOCAL_PREF 200.',
      detail: 'Reachability existed throughout the episode. What changed was which advertisement was considered policy-acceptable and therefore selected.',
      actor: 'AS64504 decision process',
      target: 'AS65540 peer route',
      detailLab: 'internet',
      policyMetrics: metrics.restored,
    }),
  ];
}

const routeLeakModifier: JourneyModifier = {
  id: 'route-leak',
  order: 92,
  apply(events) {
    const { asPath, transportStart } = requireRouteAnchors(events, 'route-leak');
    const physical = events.find((current) => current.id === 'physical-context');
    if (!physical || asPath.atMs >= physical.atMs || physical.atMs >= transportStart.atMs) {
      throw new Error('route-leak requires AS path < physical context < transport start.');
    }
    const addedDurationMs = 1600;
    const shifted = shiftPostAnchor(events, physical.atMs, addedDurationMs);
    const injected = routeLeakEvents(asPath.atMs);
    const nextEvents = [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs);
    const restored = nextEvents.find((current) => current.kind === 'internet.policy-restored');
    const firstTransport = nextEvents.find((current) => current.kind === 'transport.segment');
    if (!restored || !firstTransport || restored.atMs >= firstTransport.atMs) throw new Error('route-leak must restore policy before transport begins.');
    if (firstTransport.atMs !== transportStart.atMs + addedDurationMs) throw new Error('route-leak shifted transport by an unexpected amount.');
    return { events: nextEvents, addedDurationMs, appliedModifierIds: ['route-leak'] };
  },
};

const serverFailureModifier: JourneyModifier = {
  id: 'server-failure',
  order: 95,
  apply(events, context) {
    const request = events.find((current) => current.kind === 'http.request');
    const frameReady = events.find((current) => current.id === 'packet-assembly-collapsed');
    const response = events.find((current) => current.kind === 'http.response');
    if (!request || !frameReady || !response || request.atMs >= frameReady.atMs || frameReady.atMs >= response.atMs) throw new Error('server-failure requires an assembled HTTP request before the successful response.');
    const addedDurationMs = 1700;
    const shifted = shiftPostAnchor(events, response.atMs, addedDurationMs);
    const injected = serverFailureEvents(request.atMs, frameReady.atMs, context.config.transportProfile);
    const retry = injected.find((current) => current.kind === 'http.retry');
    if (!retry || retry.atMs >= response.atMs + addedDurationMs) throw new Error('server-failure retry must finish before successful response headers.');
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['server-failure'],
    };
  },
};



function latestPartitionTrigger(events: JourneyEvent[]): JourneyEvent {
  const preferredKinds = new Set<JourneyEventKind>([
    'http.data',
    'transport.recovered',
    'transport.latency-cleared',
    'transport.congestion-cleared',
  ]);
  const candidates = events.filter((current) => preferredKinds.has(current.kind)).sort((a, b) => b.atMs - a.atMs);
  if (!candidates[0]) throw new Error('partition requires response-path activity before terminalizing the Journey.');
  return candidates[0];
}

function partitionRouteMetrics(): JourneyRouteMetrics {
  return {
    primaryPathCost: 22,
    alternatePathCost: 52,
    activePath: 'none',
    failedLinkId: 'r1-core',
    failedLinkIds: ['r1-core', 'r2-core'],
    candidateRouteCount: 0,
    recoveryAvailable: false,
  };
}

function partitionEvents(triggerAtMs: number, terminalAtMs: number, transportProfile: JourneyTransportProfile): JourneyEvent[] {
  const metrics = partitionRouteMetrics();
  const transportProtocol = transportProfile === 'quic-h3' ? 'QUIC' : 'TCP';
  const stalledDetail = transportProfile === 'quic-h3'
    ? 'The QUIC connection had valid 1-RTT state before the cut. With no IP route, probes cannot create reachability; stalled does not mean the connection is already closed.'
    : 'The TCP connection was established before the cut. With no IP route, bytes cannot make progress; stalled does not mean the connection is already closed.';
  const injected = [
    modifierEvent({
      id: 'partition-cut',
      atMs: triggerAtMs + 220,
      kind: 'route.partition',
      scale: 'routing',
      zoom: 'out',
      protocol: 'IP',
      phase: 'partition-cut',
      title: 'Both routed exits disappear across the partition',
      summary: 'R1 → CORE and R2 → CORE are both unavailable, so the installed forwarding path is no longer usable.',
      detail: 'This is not the recoverable ROUTE or OUTAGE story. The teaching topology has lost both of its destination-facing exits at once.',
      actor: 'network partition',
      target: 'R1 / R2 uplinks',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-recompute',
      atMs: triggerAtMs + 520,
      kind: 'route.partition-recompute',
      scale: 'routing',
      zoom: 'hold',
      protocol: 'OSPF-style SPF',
      phase: 'partition-recompute',
      title: 'SPF runs with zero surviving candidates',
      summary: 'The route calculation sees no primary or alternate path capable of reaching the destination.',
      detail: 'Recomputation is still meaningful even when it cannot produce a route. Candidate route count is explicitly zero.',
      actor: 'routing process',
      target: 'forwarding table',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-unreachable',
      atMs: triggerAtMs + 820,
      kind: 'route.unreachable',
      scale: 'routing',
      zoom: 'hold',
      protocol: 'IP',
      phase: 'unreachable',
      title: 'Destination is unreachable: no route is installed',
      summary: 'Active path becomes NONE and forwarding cannot choose a next hop toward the destination.',
      detail: 'The terminal truth is routing reachability. HOPSCOTCH does not invent a third path or silently restore one of the failed links.',
      actor: 'forwarding table',
      target: 'destination prefix',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-transport-stalled',
      atMs: triggerAtMs + 1080,
      kind: 'transport.stalled',
      scale: 'transport',
      zoom: 'in',
      protocol: transportProtocol,
      phase: 'transport-stalled',
      title: `${transportProtocol} state remains, but IP progress stops`,
      summary: 'The existing transport state is stalled because there is no forwarding path on which packets can travel.',
      detail: stalledDetail,
      actor: `${transportProtocol} sender`,
      target: 'unreachable IP path',
      detailLab: transportProfile === 'quic-h3' ? 'http' : 'tcp',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-terminal',
      atMs: terminalAtMs,
      kind: 'journey.failed',
      scale: 'application',
      zoom: 'out',
      protocol: 'URL',
      phase: 'network-unreachable',
      title: 'Journey ends without a route to the destination',
      summary: 'The request cannot reach response-ready because the simulated network remains partitioned.',
      detail: 'No route exists and no recovery event follows. Earlier DNS, TLS, HTTP, and transport history remains inspectable when the time machine is rewound.',
      actor: 'network stack',
      target: 'browser',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
  ];
  if (injected[injected.length - 2].atMs >= terminalAtMs) throw new Error('partition terminal boundary must follow routing and transport stall events.');
  return injected;
}

const partitionModifier: JourneyModifier = {
  id: 'partition',
  order: 130,
  apply(events, context) {
    const trigger = latestPartitionTrigger(events);
    const complete = events.find((current) => current.kind === 'journey.complete');
    if (!complete) throw new Error('partition requires the pre-terminal Journey completion boundary.');
    const injected = partitionEvents(trigger.atMs, complete.atMs, context.config.transportProfile);
    const cutAtMs = injected[0].atMs;
    const kept = events.filter((current) => current.atMs < cutAtMs);
    return {
      events: [...kept, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs: 0,
      appliedModifierIds: ['partition'],
    };
  },
};

const modifiers: JourneyModifier[] = [dnsFailureModifier, routeFailureModifier, routeLeakModifier, serverFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier, partitionModifier]
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

export function applyJourneyModifiers(
  baseEvents: JourneyEvent[],
  config: JourneyScenarioConfig,
): JourneyModifierResult {
  let events = baseEvents.map((current) => ({ ...current }));
  let addedDurationMs = 0;
  const appliedModifierIds: JourneyModifierId[] = [];
  const selectedModifierIds = new Set(resolveJourneyModifierIds(config));

  for (const modifier of modifiers) {
    if (!selectedModifierIds.has(modifier.id)) continue;
    const result = modifier.apply(events, { config });
    events = result.events;
    addedDurationMs += result.addedDurationMs;
    appliedModifierIds.push(...result.appliedModifierIds);
  }

  if (new Set(events.map((event) => event.id)).size !== events.length) throw new Error('Journey modifiers produced duplicate event IDs.');
  if (new Set(events.map((event) => event.atMs)).size !== events.length) throw new Error('Journey modifiers produced duplicate event timestamps.');
  if (!events.every((event, index) => index === 0 || event.atMs > events[index - 1].atMs)) throw new Error('Journey modifier events must remain strictly ordered.');

  return { events, addedDurationMs, appliedModifierIds };
}

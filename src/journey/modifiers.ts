import type {
  JourneyEvent,
  JourneyEventKind,
  JourneyImpairmentProfile,
  JourneyModifierId,
  JourneyProvenance,
  JourneyRouteMetrics,
  JourneyScale,
  JourneyScenarioConfig,
  JourneyTransportMetrics,
  JourneyTransportProfile,
  JourneyZoomDirection,
} from './model.ts';

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

const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['route-failure', 'single-loss', 'path-outage', 'latency-spike'];
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

const modifiers: JourneyModifier[] = [routeFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier]
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

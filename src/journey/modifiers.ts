import type {
  JourneyEvent,
  JourneyEventKind,
  JourneyImpairmentProfile,
  JourneyProvenance,
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
  appliedModifierIds: string[];
}

interface JourneyModifier {
  id: string;
  order: number;
  appliesTo(profile: JourneyImpairmentProfile): boolean;
  apply(events: JourneyEvent[], context: JourneyModifierContext): JourneyModifierResult;
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
}): JourneyEvent {
  return {
    provenance: 'SIMULATED',
    ...input,
  };
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
  appliesTo: (profile) => profile === 'single-loss',
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
  appliesTo: (profile) => profile === 'latency-spike',
  apply(events, context) {
    const { data, packetFrame } = requireResponseAnchors(events, 'latency-spike');
    const addedDurationMs = 1200;
    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);
    return {
      events: [...shifted, ...latencyEvents(context.config.transportProfile, data.atMs)].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['latency-spike'],
    };
  },
};

const modifiers: JourneyModifier[] = [singleLossModifier, latencySpikeModifier]
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

export function applyJourneyModifiers(
  baseEvents: JourneyEvent[],
  config: JourneyScenarioConfig,
): JourneyModifierResult {
  let events = baseEvents.map((current) => ({ ...current }));
  let addedDurationMs = 0;
  const appliedModifierIds: string[] = [];

  for (const modifier of modifiers) {
    if (!modifier.appliesTo(config.impairmentProfile)) continue;
    const result = modifier.apply(events, { config });
    events = result.events;
    addedDurationMs += result.addedDurationMs;
    appliedModifierIds.push(...result.appliedModifierIds);
  }

  return { events, addedDurationMs, appliedModifierIds };
}

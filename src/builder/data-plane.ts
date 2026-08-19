import { builderPathCharacteristics, type BuilderLinkProfiles } from './link-characteristics.ts';

export type BuilderTrafficTransport = 'tcp' | 'quic' | 'udp';
export type BuilderTrafficPattern = 'single' | 'bulk-tcp' | 'competing' | 'udp-cbr' | 'burst';
export type BuilderEcnSignal = 'NONE' | 'CE' | 'ECE/CWR' | 'ACK_ECN';
export type BuilderPmtuFamily = 'ipv4' | 'ipv6';
export type BuilderPmtuOutcome = 'DELIVERED' | 'FRAGMENTED' | 'ICMP_FRAG_NEEDED' | 'ICMPV6_PACKET_TOO_BIG' | 'BLACK_HOLE';

export interface BuilderTrafficFlowSpec {
  id: string;
  transport: BuilderTrafficTransport;
  pathLinkIds: string[];
  offeredRateMbps: number;
  packetBytes: number;
  ecnCapable: boolean;
  burst?: { onMs: number; offMs: number };
}

export interface BuilderTrafficScenario {
  id: string;
  pattern: BuilderTrafficPattern;
  durationMs: number;
  tickMs: number;
  flows: BuilderTrafficFlowSpec[];
}

export interface BuilderQueueSample {
  atMs: number;
  linkId: string;
  occupancyPackets: number;
  capacityPackets: number;
  utilization: number;
  ecnMarks: number;
  tailDrops: number;
}

export interface BuilderLinkDataPlaneObservation {
  linkId: string;
  bandwidthMbps: number;
  mtuBytes: number;
  queueCapacityPackets: number;
  peakQueuePackets: number;
  peakQueueDelayMs: number;
  ecnMarks: number;
  tailDrops: number;
  transmittedPackets: number;
  transmittedBytes: number;
  utilization: number;
}

export interface BuilderFlowDataPlaneObservation {
  id: string;
  transport: BuilderTrafficTransport;
  offeredRateMbps: number;
  deliveredRateMbps: number;
  deliveredPackets: number;
  droppedPackets: number;
  ecnMarks: number;
  averageQueueDelayMs: number;
  averageSerializationDelayMs: number;
  estimatedRttMs: number;
  congestionWindowPackets: number | null;
  congestionSignal: BuilderEcnSignal;
  recovery: 'NONE' | 'ECN BACKOFF' | 'LOSS RECOVERY' | 'UDP UNRESPONSIVE';
  finalSendingRateMbps: number;
  backoffEvents: number;
}

export interface BuilderDataPlaneEvent {
  id: string;
  atMs: number;
  kind: 'QUEUE_GROWTH' | 'ECN_MARK' | 'TAIL_DROP' | 'TRANSPORT_BACKOFF' | 'TRANSPORT_RECOVERY' | 'QUEUE_DRAINED';
  flowId: string | null;
  linkId: string;
  summary: string;
}

export interface BuilderTrafficRun {
  scenario: BuilderTrafficScenario;
  queueSamples: BuilderQueueSample[];
  links: BuilderLinkDataPlaneObservation[];
  flows: BuilderFlowDataPlaneObservation[];
  events: BuilderDataPlaneEvent[];
  bottleneckLinkId: string | null;
  summary: string;
  provenance: 'SIMULATED';
}

export interface BuilderPmtuFragment { offsetBytes: number; packetBytes: number; moreFragments: boolean }
export interface BuilderPmtuCacheEntry { family: BuilderPmtuFamily; destinationKey: string; mtuBytes: number; learnedFrom: 'LOCAL PATH' | 'ICMP FRAG NEEDED' | 'ICMPV6 PACKET TOO BIG' }
export interface BuilderPmtuResult {
  family: BuilderPmtuFamily;
  packetBytes: number;
  pathMtuBytes: number;
  limitingLinkId: string;
  df: boolean;
  controlMessageDelivered: boolean;
  outcome: BuilderPmtuOutcome;
  fragments: BuilderPmtuFragment[];
  cacheEntry: BuilderPmtuCacheEntry | null;
  transportEffect: 'NONE' | 'RETRY SMALLER' | 'TIMEOUT NO PROGRESS';
  summary: string;
  provenance: 'SIMULATED';
}

interface PacketToken {
  flowId: string;
  bytes: number;
  queuedAtMs: number;
  hopIndex: number;
  ecnMarked: boolean;
}

interface LinkRuntime {
  queues: Map<string, PacketToken[]>;
  rrCursor: number;
  peakPackets: number;
  queueDelayTotalMs: number;
  queueDelaySamples: number;
  ecnMarks: number;
  tailDrops: number;
  txPackets: number;
  txBytes: number;
}

const MAX_FLOWS = 16;
const MAX_LINKS = 32;
const MAX_DURATION_MS = 10_000;
const MAX_PACKET_BYTES = 9216;
const MAX_QUEUE_SAMPLES = 8000;
const DEFAULT_TICK_MS = 20;

function stableId(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619) >>> 0; }
  return hash.toString(16).padStart(8, '0');
}

function validateFlow(profiles: BuilderLinkProfiles, flow: BuilderTrafficFlowSpec): BuilderTrafficFlowSpec {
  if (!/^[a-zA-Z0-9_.:-]+$/.test(flow.id)) throw new Error(`Traffic flow id ${flow.id} is invalid.`);
  if (!['tcp', 'quic', 'udp'].includes(flow.transport)) throw new Error(`Traffic flow ${flow.id} transport is invalid.`);
  if (!Number.isFinite(flow.offeredRateMbps) || flow.offeredRateMbps <= 0 || flow.offeredRateMbps > 1_000_000) throw new Error(`Traffic flow ${flow.id} offered rate is invalid.`);
  if (!Number.isInteger(flow.packetBytes) || flow.packetBytes < 64 || flow.packetBytes > MAX_PACKET_BYTES) throw new Error(`Traffic flow ${flow.id} packet size must be 64–${MAX_PACKET_BYTES} bytes.`);
  if (flow.pathLinkIds.length === 0 || flow.pathLinkIds.length > MAX_LINKS) throw new Error(`Traffic flow ${flow.id} needs 1–${MAX_LINKS} canonical path links.`);
  for (const linkId of flow.pathLinkIds) if (!profiles[linkId]) throw new Error(`Traffic flow ${flow.id} references unknown link profile ${linkId}.`);
  if (flow.burst && (!Number.isInteger(flow.burst.onMs) || !Number.isInteger(flow.burst.offMs) || flow.burst.onMs < 1 || flow.burst.offMs < 1)) throw new Error(`Traffic flow ${flow.id} burst timing is invalid.`);
  return { ...flow, pathLinkIds: [...flow.pathLinkIds], burst: flow.burst ? { ...flow.burst } : undefined };
}

export function validateBuilderTrafficScenario(profiles: BuilderLinkProfiles, input: BuilderTrafficScenario): BuilderTrafficScenario {
  if (!input || !/^[a-zA-Z0-9_.:-]+$/.test(input.id)) throw new Error('Traffic scenario id is invalid.');
  if (!['single', 'bulk-tcp', 'competing', 'udp-cbr', 'burst'].includes(input.pattern)) throw new Error('Traffic scenario pattern is invalid.');
  if (!Number.isInteger(input.durationMs) || input.durationMs < 100 || input.durationMs > MAX_DURATION_MS) throw new Error(`Traffic duration must be 100–${MAX_DURATION_MS} ms.`);
  if (!Number.isInteger(input.tickMs) || input.tickMs < 5 || input.tickMs > 100) throw new Error('Traffic tick must be 5–100 ms.');
  if (!Array.isArray(input.flows) || input.flows.length < 1 || input.flows.length > MAX_FLOWS) throw new Error(`Traffic scenarios support 1–${MAX_FLOWS} flows.`);
  const ids = new Set<string>();
  const flows = input.flows.map((flow) => { const next = validateFlow(profiles, flow); if (ids.has(next.id)) throw new Error(`Duplicate traffic flow ${next.id}.`); ids.add(next.id); return next; });
  return { ...input, flows };
}

function activeAt(flow: BuilderTrafficFlowSpec, atMs: number): boolean {
  if (!flow.burst) return true;
  const period = flow.burst.onMs + flow.burst.offMs;
  return atMs % period < flow.burst.onMs;
}

function queueLength(runtime: LinkRuntime): number { let total = 0; for (const queue of runtime.queues.values()) total += queue.length; return total; }
function queueDelayMs(packetsAhead: number, packetBytes: number, bandwidthMbps: number): number { return packetsAhead * packetBytes * 8 / (bandwidthMbps * 1_000_000) * 1000; }
function serializationDelayMs(bytes: number, bandwidthMbps: number): number { return bytes * 8 / (bandwidthMbps * 1_000_000) * 1000; }

function enqueuePacket(args: {
  token: PacketToken;
  linkId: string;
  runtime: LinkRuntime;
  profiles: BuilderLinkProfiles;
  atMs: number;
  flow: BuilderTrafficFlowSpec;
  events: BuilderDataPlaneEvent[];
  flowDrops: Map<string, number>;
  flowMarks: Map<string, number>;
}) {
  const { token, linkId, runtime, profiles, atMs, flow, events, flowDrops, flowMarks } = args;
  const profile = profiles[linkId];
  const occupancy = queueLength(runtime);
  if (occupancy >= profile.queuePackets) {
    runtime.tailDrops += 1;
    flowDrops.set(flow.id, (flowDrops.get(flow.id) ?? 0) + 1);
    events.push({ id: `drop:${linkId}:${flow.id}:${atMs}:${runtime.tailDrops}`, atMs, kind: 'TAIL_DROP', flowId: flow.id, linkId, summary: `${linkId} tail-dropped ${flow.id} at ${profile.queuePackets}/${profile.queuePackets} packets.` });
    return false;
  }
  const markThreshold = Math.max(1, Math.ceil(profile.queuePackets * 0.75));
  if (flow.ecnCapable && occupancy >= markThreshold) {
    token.ecnMarked = true;
    runtime.ecnMarks += 1;
    flowMarks.set(flow.id, (flowMarks.get(flow.id) ?? 0) + 1);
    events.push({ id: `ecn:${linkId}:${flow.id}:${atMs}:${runtime.ecnMarks}`, atMs, kind: 'ECN_MARK', flowId: flow.id, linkId, summary: `${linkId} CE-marked ${flow.id} at ${occupancy}/${profile.queuePackets} packets.` });
  }
  const queue = runtime.queues.get(flow.id) ?? [];
  queue.push(token);
  runtime.queues.set(flow.id, queue);
  runtime.peakPackets = Math.max(runtime.peakPackets, occupancy + 1);
  return true;
}

function dequeueRoundRobin(runtime: LinkRuntime, flowIds: string[], bitBudget: number): PacketToken[] {
  const sent: PacketToken[] = [];
  if (flowIds.length === 0) return sent;
  let idlePasses = 0;
  while (bitBudget >= 64 * 8 && idlePasses < flowIds.length) {
    const index = runtime.rrCursor % flowIds.length;
    runtime.rrCursor = (runtime.rrCursor + 1) % flowIds.length;
    const flowId = flowIds[index];
    const queue = runtime.queues.get(flowId);
    const packet = queue?.[0];
    if (!packet || packet.bytes * 8 > bitBudget) { idlePasses += 1; continue; }
    idlePasses = 0;
    queue!.shift();
    bitBudget -= packet.bytes * 8;
    sent.push(packet);
  }
  return sent;
}

export function runBuilderTrafficScenario(profiles: BuilderLinkProfiles, input: BuilderTrafficScenario): BuilderTrafficRun {
  const scenario = validateBuilderTrafficScenario(profiles, input);
  const allLinkIds = [...new Set(scenario.flows.flatMap((flow) => flow.pathLinkIds))].sort();
  const runtime = new Map<string, LinkRuntime>(allLinkIds.map((id) => [id, { queues: new Map(), rrCursor: 0, peakPackets: 0, queueDelayTotalMs: 0, queueDelaySamples: 0, ecnMarks: 0, tailDrops: 0, txPackets: 0, txBytes: 0 }]));
  const generatedRemainder = new Map<string, number>();
  const flowDelivered = new Map<string, number>();
  const flowDeliveredBytes = new Map<string, number>();
  const flowDrops = new Map<string, number>();
  const flowMarks = new Map<string, number>();
  const flowQueueDelay = new Map<string, number>();
  const flowQueueSamples = new Map<string, number>();
  const flowSerialization = new Map<string, number>();
  const flowRateFactor = new Map<string, number>(scenario.flows.map((flow) => [flow.id, 1]));
  const flowLastMarks = new Map<string, number>();
  const flowLastDrops = new Map<string, number>();
  const flowBackoffs = new Map<string, number>();
  const queueSamples: BuilderQueueSample[] = [];
  const events: BuilderDataPlaneEvent[] = [];
  const flowById = new Map(scenario.flows.map((flow) => [flow.id, flow]));

  for (let atMs = 0; atMs < scenario.durationMs; atMs += scenario.tickMs) {
    const pending = scenario.flows.map((flow) => {
      if (!activeAt(flow, atMs)) return { flow, packets: 0 };
      const rateFactor = flow.transport === 'udp' ? 1 : (flowRateFactor.get(flow.id) ?? 1);
      const packetsExact = flow.offeredRateMbps * rateFactor * 1_000_000 / 8 * (scenario.tickMs / 1000) / flow.packetBytes + (generatedRemainder.get(flow.id) ?? 0);
      const packets = Math.min(2000, Math.floor(packetsExact));
      generatedRemainder.set(flow.id, packetsExact - packets);
      return { flow, packets };
    });
    let pendingPackets = pending.reduce((sum, entry) => sum + entry.packets, 0);
    while (pendingPackets > 0) {
      for (const entry of pending) {
        if (entry.packets <= 0) continue;
        const flow = entry.flow;
        const firstLinkId = flow.pathLinkIds[0];
        enqueuePacket({ token: { flowId: flow.id, bytes: flow.packetBytes, queuedAtMs: atMs, hopIndex: 0, ecnMarked: false }, linkId: firstLinkId, runtime: runtime.get(firstLinkId)!, profiles, atMs, flow, events, flowDrops, flowMarks });
        entry.packets -= 1;
        pendingPackets -= 1;
      }
    }

    for (const linkId of allLinkIds) {
      const profile = profiles[linkId];
      const state = runtime.get(linkId)!;
      const before = queueLength(state);
      if (before > 0 && before >= Math.max(1, Math.ceil(profile.queuePackets * 0.5)) && !events.some((event) => event.kind === 'QUEUE_GROWTH' && event.linkId === linkId)) events.push({ id: `queue:${linkId}:${atMs}`, atMs, kind: 'QUEUE_GROWTH', flowId: null, linkId, summary: `${linkId} queue reached ${before}/${profile.queuePackets} packets.` });
      const bitBudget = profile.bandwidthMbps * 1_000_000 * (scenario.tickMs / 1000);
      const candidates = scenario.flows.filter((flow) => flow.pathLinkIds.includes(linkId)).map((flow) => flow.id).sort();
      const sent = dequeueRoundRobin(state, candidates, bitBudget);
      for (const token of sent) {
        const flow = flowById.get(token.flowId)!;
        const qDelay = Math.max(0, atMs - token.queuedAtMs);
        state.queueDelayTotalMs += qDelay; state.queueDelaySamples += 1;
        flowQueueDelay.set(flow.id, (flowQueueDelay.get(flow.id) ?? 0) + qDelay);
        flowQueueSamples.set(flow.id, (flowQueueSamples.get(flow.id) ?? 0) + 1);
        const serial = serializationDelayMs(token.bytes, profile.bandwidthMbps);
        flowSerialization.set(flow.id, (flowSerialization.get(flow.id) ?? 0) + serial);
        state.txPackets += 1; state.txBytes += token.bytes;
        const nextHopIndex = token.hopIndex + 1;
        if (nextHopIndex < flow.pathLinkIds.length) {
          const nextLinkId = flow.pathLinkIds[nextHopIndex];
          enqueuePacket({ token: { ...token, queuedAtMs: atMs, hopIndex: nextHopIndex }, linkId: nextLinkId, runtime: runtime.get(nextLinkId)!, profiles, atMs, flow, events, flowDrops, flowMarks });
        } else {
          flowDelivered.set(flow.id, (flowDelivered.get(flow.id) ?? 0) + 1);
          flowDeliveredBytes.set(flow.id, (flowDeliveredBytes.get(flow.id) ?? 0) + token.bytes);
        }
      }
      const after = queueLength(state);
      if (before > 0 && after === 0) events.push({ id: `drain:${linkId}:${atMs}`, atMs, kind: 'QUEUE_DRAINED', flowId: null, linkId, summary: `${linkId} queue drained.` });
      if (queueSamples.length < MAX_QUEUE_SAMPLES) queueSamples.push({ atMs, linkId, occupancyPackets: after, capacityPackets: profile.queuePackets, utilization: Math.min(1, state.txBytes * 8 / (profile.bandwidthMbps * 1_000_000 * Math.max(scenario.tickMs, atMs + scenario.tickMs) / 1000)), ecnMarks: state.ecnMarks, tailDrops: state.tailDrops });
    }

    for (const flow of scenario.flows) {
      if (flow.transport === 'udp') continue;
      const marks = flowMarks.get(flow.id) ?? 0;
      const drops = flowDrops.get(flow.id) ?? 0;
      const priorMarks = flowLastMarks.get(flow.id) ?? 0;
      const priorDrops = flowLastDrops.get(flow.id) ?? 0;
      const currentFactor = flowRateFactor.get(flow.id) ?? 1;
      if (marks > priorMarks || drops > priorDrops) {
        const nextFactor = Math.max(0.25, currentFactor * 0.5);
        flowRateFactor.set(flow.id, nextFactor);
        flowBackoffs.set(flow.id, (flowBackoffs.get(flow.id) ?? 0) + 1);
        events.push({ id: `backoff:${flow.id}:${atMs}`, atMs: atMs + scenario.tickMs, kind: 'TRANSPORT_BACKOFF', flowId: flow.id, linkId: flow.pathLinkIds[0], summary: `${flow.id} reduced sending pressure to ${(nextFactor * 100).toFixed(0)}% after ${marks - priorMarks} new CE marks and ${drops - priorDrops} new drops.` });
      } else if (currentFactor < 1) {
        const nextFactor = Math.min(1, currentFactor + 0.05);
        flowRateFactor.set(flow.id, nextFactor);
        if (nextFactor === 1) events.push({ id: `recover:${flow.id}:${atMs}`, atMs: atMs + scenario.tickMs, kind: 'TRANSPORT_RECOVERY', flowId: flow.id, linkId: flow.pathLinkIds[0], summary: `${flow.id} returned to its configured offered rate after clean queue feedback.` });
      }
      flowLastMarks.set(flow.id, marks);
      flowLastDrops.set(flow.id, drops);
    }
  }

  const links: BuilderLinkDataPlaneObservation[] = allLinkIds.map((linkId) => {
    const profile = profiles[linkId]; const state = runtime.get(linkId)!;
    const durationSeconds = scenario.durationMs / 1000;
    const utilization = durationSeconds <= 0 ? 0 : Math.min(1, state.txBytes * 8 / durationSeconds / (profile.bandwidthMbps * 1_000_000));
    return { linkId, bandwidthMbps: profile.bandwidthMbps, mtuBytes: profile.mtuBytes, queueCapacityPackets: profile.queuePackets, peakQueuePackets: state.peakPackets, peakQueueDelayMs: queueDelayMs(state.peakPackets, Math.min(profile.mtuBytes, 1500), profile.bandwidthMbps), ecnMarks: state.ecnMarks, tailDrops: state.tailDrops, transmittedPackets: state.txPackets, transmittedBytes: state.txBytes, utilization };
  });

  const flows: BuilderFlowDataPlaneObservation[] = scenario.flows.map((flow) => {
    const deliveredPackets = flowDelivered.get(flow.id) ?? 0;
    const deliveredBytes = flowDeliveredBytes.get(flow.id) ?? 0;
    const droppedPackets = flowDrops.get(flow.id) ?? 0;
    const ecnMarks = flowMarks.get(flow.id) ?? 0;
    const samples = flowQueueSamples.get(flow.id) ?? 0;
    const avgQueue = samples ? (flowQueueDelay.get(flow.id) ?? 0) / samples : 0;
    const avgSerialization = samples ? (flowSerialization.get(flow.id) ?? 0) / samples : 0;
    const path = builderPathCharacteristics(profiles, flow.pathLinkIds);
    const deliveredRateMbps = deliveredBytes * 8 / (scenario.durationMs / 1000) / 1_000_000;
    const signal: BuilderEcnSignal = ecnMarks > 0 ? (flow.transport === 'tcp' ? 'ECE/CWR' : flow.transport === 'quic' ? 'ACK_ECN' : 'CE') : 'NONE';
    const recovery = flow.transport === 'udp' && (ecnMarks > 0 || droppedPackets > 0) ? 'UDP UNRESPONSIVE' : droppedPackets > 0 ? 'LOSS RECOVERY' : ecnMarks > 0 ? 'ECN BACKOFF' : 'NONE';
    const cwnd = flow.transport === 'udp' ? null : droppedPackets > 0 || ecnMarks > 0 ? 6 : 12;
    return { id: flow.id, transport: flow.transport, offeredRateMbps: flow.offeredRateMbps, deliveredRateMbps, deliveredPackets, droppedPackets, ecnMarks, averageQueueDelayMs: avgQueue, averageSerializationDelayMs: avgSerialization, estimatedRttMs: 2 * path.oneWayLatencyMs + avgQueue + avgSerialization, congestionWindowPackets: cwnd, congestionSignal: signal, recovery, finalSendingRateMbps: flow.offeredRateMbps * (flow.transport === 'udp' ? 1 : (flowRateFactor.get(flow.id) ?? 1)), backoffEvents: flowBackoffs.get(flow.id) ?? 0 };
  });

  const bottleneck = links.slice().sort((a, b) => b.utilization - a.utilization || b.peakQueuePackets - a.peakQueuePackets || a.linkId.localeCompare(b.linkId))[0] ?? null;
  return { scenario, queueSamples, links, flows, events: events.sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id)), bottleneckLinkId: bottleneck?.linkId ?? null, summary: bottleneck ? `${scenario.pattern.toUpperCase()} · bottleneck ${bottleneck.linkId} ${(bottleneck.utilization * 100).toFixed(0)}% · ${bottleneck.ecnMarks} CE · ${bottleneck.tailDrops} drops` : 'No data-plane links.', provenance: 'SIMULATED' };
}

export function createBuilderTrafficScenario(pattern: BuilderTrafficPattern, pathLinkIds: string[], profiles: BuilderLinkProfiles, transport: BuilderTrafficTransport = 'tcp'): BuilderTrafficScenario {
  if (pathLinkIds.length === 0) throw new Error('Traffic generator requires a canonical Builder path.');
  const path = builderPathCharacteristics(profiles, pathLinkIds);
  const rate = Math.max(1, path.bottleneckMbps ?? 100);
  const base = (id: string, chosenTransport: BuilderTrafficTransport, offeredRateMbps: number, ecnCapable: boolean, burst?: BuilderTrafficFlowSpec['burst']): BuilderTrafficFlowSpec => ({ id, transport: chosenTransport, pathLinkIds: [...pathLinkIds], offeredRateMbps, packetBytes: Math.min(1400, path.pathMtuBytes ?? 1500), ecnCapable, burst });
  let flows: BuilderTrafficFlowSpec[];
  if (pattern === 'single') flows = [base('flow-1', transport, rate * 0.35, true)];
  else if (pattern === 'bulk-tcp') flows = [base('bulk-1', 'tcp', rate * 1.8, true)];
  else if (pattern === 'competing') flows = [base('tcp-a', 'tcp', rate * 0.9, true), base('tcp-b', 'tcp', rate * 0.9, true), base('quic-c', 'quic', rate * 0.9, true)];
  else if (pattern === 'udp-cbr') flows = [base('udp-cbr', 'udp', rate * 1.35, false)];
  else flows = [base('burst-udp', 'udp', rate * 2.2, false, { onMs: 120, offMs: 180 })];
  return validateBuilderTrafficScenario(profiles, { id: `track-e:${pattern}:${stableId(pathLinkIds.join('|'))}`, pattern, durationMs: 2000, tickMs: DEFAULT_TICK_MS, flows });
}

function limitingLink(profiles: BuilderLinkProfiles, linkIds: string[]): { linkId: string; mtuBytes: number } {
  if (linkIds.length === 0) throw new Error('PMTU evaluation requires a canonical path.');
  let selected = { linkId: linkIds[0], mtuBytes: profiles[linkIds[0]]?.mtuBytes ?? 1500 };
  for (const linkId of linkIds) { const mtuBytes = profiles[linkId]?.mtuBytes ?? 1500; if (mtuBytes < selected.mtuBytes) selected = { linkId, mtuBytes }; }
  return selected;
}

function ipv4Fragments(packetBytes: number, mtuBytes: number): BuilderPmtuFragment[] {
  const headerBytes = 20;
  const payloadBytes = Math.max(0, packetBytes - headerBytes);
  const fragmentPayload = Math.max(8, Math.floor((mtuBytes - headerBytes) / 8) * 8);
  const fragments: BuilderPmtuFragment[] = [];
  for (let offset = 0; offset < payloadBytes; offset += fragmentPayload) {
    const payload = Math.min(fragmentPayload, payloadBytes - offset);
    fragments.push({ offsetBytes: offset, packetBytes: headerBytes + payload, moreFragments: offset + payload < payloadBytes });
  }
  return fragments;
}

export function evaluateBuilderPmtu(args: { profiles: BuilderLinkProfiles; linkIds: string[]; family: BuilderPmtuFamily; packetBytes: number; destinationKey: string; df?: boolean; suppressControlMessage?: boolean }): BuilderPmtuResult {
  const { profiles, linkIds, family, packetBytes, destinationKey } = args;
  if (!Number.isInteger(packetBytes) || packetBytes < (family === 'ipv6' ? 1280 : 68) || packetBytes > 65535) throw new Error('PMTU packet size is invalid.');
  const limit = limitingLink(profiles, linkIds);
  const df = family === 'ipv6' ? true : args.df !== false;
  if (packetBytes <= limit.mtuBytes) return { family, packetBytes, pathMtuBytes: limit.mtuBytes, limitingLinkId: limit.linkId, df, controlMessageDelivered: false, outcome: 'DELIVERED', fragments: [], cacheEntry: { family, destinationKey, mtuBytes: limit.mtuBytes, learnedFrom: 'LOCAL PATH' }, transportEffect: 'NONE', summary: `${packetBytes} B fits path MTU ${limit.mtuBytes} B.`, provenance: 'SIMULATED' };
  if (family === 'ipv4' && !df) {
    const fragments = ipv4Fragments(packetBytes, limit.mtuBytes);
    return { family, packetBytes, pathMtuBytes: limit.mtuBytes, limitingLinkId: limit.linkId, df, controlMessageDelivered: false, outcome: 'FRAGMENTED', fragments, cacheEntry: null, transportEffect: 'NONE', summary: `IPv4 packet fragmented into ${fragments.length} fragments at ${limit.linkId}; DF is clear.`, provenance: 'SIMULATED' };
  }
  if (args.suppressControlMessage) return { family, packetBytes, pathMtuBytes: limit.mtuBytes, limitingLinkId: limit.linkId, df, controlMessageDelivered: false, outcome: 'BLACK_HOLE', fragments: [], cacheEntry: null, transportEffect: 'TIMEOUT NO PROGRESS', summary: `${family.toUpperCase()} PMTUD black hole at ${limit.linkId}: packet exceeds ${limit.mtuBytes} B and the required control message is not delivered.`, provenance: 'SIMULATED' };
  const outcome: BuilderPmtuOutcome = family === 'ipv4' ? 'ICMP_FRAG_NEEDED' : 'ICMPV6_PACKET_TOO_BIG';
  const learnedFrom: BuilderPmtuCacheEntry['learnedFrom'] = family === 'ipv4' ? 'ICMP FRAG NEEDED' : 'ICMPV6 PACKET TOO BIG';
  return { family, packetBytes, pathMtuBytes: limit.mtuBytes, limitingLinkId: limit.linkId, df, controlMessageDelivered: true, outcome, fragments: [], cacheEntry: { family, destinationKey, mtuBytes: limit.mtuBytes, learnedFrom }, transportEffect: 'RETRY SMALLER', summary: `${outcome.replaceAll('_', ' ')} from ${limit.linkId}; PMTU cache learns ${limit.mtuBytes} B and transport can retry smaller.`, provenance: 'SIMULATED' };
}

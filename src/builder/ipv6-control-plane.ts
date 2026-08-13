import type { BuilderAddressing } from './addressing.ts';
import type { BuilderLinkProfiles } from './link-characteristics.ts';
import type { BuilderGraph } from './model.ts';
import {
  applyBuilderIpv6Slaac,
  builderIpv6SolicitedNodeMulticast,
  builderIpv6SolicitedNodeMulticastMac,
  primaryBuilderIpv6Address,
  traceBuilderIpv6Forwarding,
  type BuilderIpv6Config,
  type BuilderIpv6ForwardingTrace,
} from './ipv6.ts';

export interface BuilderIpv6NeighborCacheEntry {
  id: string;
  nodeId: string;
  linkId: string;
  address: string;
  mac: string;
  targetNodeId: string;
  learnedSequence: number;
  source: 'NS/NA' | 'RA';
}

export interface BuilderIpv6NdResolution {
  id: string;
  sequence: number;
  nodeId: string;
  targetNodeId: string;
  linkId: string;
  targetAddress: string;
  solicitedNodeMulticast: string;
  multicastMac: string;
  targetMac: string;
  cacheHit: boolean;
  detail: string;
}

export interface BuilderIpv6RaEvent {
  id: string;
  sequence: number;
  endpointId: string;
  routerId: string | null;
  linkId: string | null;
  success: boolean;
  rsDestination: 'ff02::2';
  raSource: string | null;
  prefix: string | null;
  slaacAddress: string | null;
  routerLifetimeSeconds: number;
  preferredLifetimeSeconds: number;
  validLifetimeSeconds: number;
  detail: string;
}

export interface BuilderIpv6PmtuCacheEntry {
  id: string;
  sourceNodeId: string;
  destinationNodeId: string;
  pathMtuBytes: number;
  learnedFromNodeId: string;
  linkId: string;
  learnedSequence: number;
}

export interface BuilderIpv6PmtuEvent {
  id: string;
  sequence: number;
  sourceNodeId: string;
  destinationNodeId: string;
  requestedBytes: number;
  effectivePacketBytes: number;
  mtuBytes: number;
  linkId: string;
  responderNodeId: string;
  delivered: boolean;
  reverseTrace: BuilderIpv6ForwardingTrace | null;
  detail: string;
}

export interface BuilderIpv6ControlState {
  neighborCache: BuilderIpv6NeighborCacheEntry[];
  ndHistory: BuilderIpv6NdResolution[];
  raHistory: BuilderIpv6RaEvent[];
  pmtuCache: BuilderIpv6PmtuCacheEntry[];
  pmtuHistory: BuilderIpv6PmtuEvent[];
  clock: number;
}

export interface BuilderIpv6NeighborResolutionResult {
  success: boolean;
  state: BuilderIpv6ControlState;
  resolutions: BuilderIpv6NdResolution[];
  failureReason: string | null;
}

export interface BuilderIpv6PmtuCheckResult {
  blocked: boolean;
  cacheHit: boolean;
  requestedBytes: number;
  effectivePacketBytes: number;
  state: BuilderIpv6ControlState;
  event: BuilderIpv6PmtuEvent | null;
}

function stableMac(nodeId: string, linkId: string): string {
  const text = `${nodeId}:${linkId}:nd6`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return [0x02, 0x48, 0x36, (hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff]
    .map((byte) => byte.toString(16).padStart(2, '0')).join(':');
}

function cloneTrace(trace: BuilderIpv6ForwardingTrace | null): BuilderIpv6ForwardingTrace | null {
  return trace ? { ...trace, hops: trace.hops.map((hop) => ({ ...hop })) } : null;
}

function cloneState(state: BuilderIpv6ControlState): BuilderIpv6ControlState {
  return {
    neighborCache: state.neighborCache.map((entry) => ({ ...entry })),
    ndHistory: state.ndHistory.map((entry) => ({ ...entry })),
    raHistory: state.raHistory.map((entry) => ({ ...entry })),
    pmtuCache: state.pmtuCache.map((entry) => ({ ...entry })),
    pmtuHistory: state.pmtuHistory.map((entry) => ({ ...entry, reverseTrace: cloneTrace(entry.reverseTrace) })),
    clock: state.clock,
  };
}

export function createBuilderIpv6ControlState(): BuilderIpv6ControlState {
  return { neighborCache: [], ndHistory: [], raHistory: [], pmtuCache: [], pmtuHistory: [], clock: 0 };
}

export function clearBuilderIpv6NeighborCache(state: BuilderIpv6ControlState): BuilderIpv6ControlState {
  return { ...cloneState(state), neighborCache: [], ndHistory: [] };
}

export function clearBuilderIpv6PmtuCache(state: BuilderIpv6ControlState): BuilderIpv6ControlState {
  return { ...cloneState(state), pmtuCache: [], pmtuHistory: [] };
}

function interfaceOnLink(config: BuilderIpv6Config, linkId: string, nodeId: string) {
  return config.addressing.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nodeId) ?? null;
}

export function resolveBuilderIpv6TraceNeighbors(
  graph: BuilderGraph,
  config: BuilderIpv6Config,
  trace: BuilderIpv6ForwardingTrace,
  current: BuilderIpv6ControlState = createBuilderIpv6ControlState(),
  sequence = current.clock + 1,
  maxHops = trace.hops.length,
): BuilderIpv6NeighborResolutionResult {
  let state = cloneState(current);
  state.clock = Math.max(state.clock, sequence);
  const resolutions: BuilderIpv6NdResolution[] = [];
  const hops = trace.hops.slice(0, Math.max(0, maxHops));

  for (const [index, hop] of hops.entries()) {
    if (!hop.linkId || !hop.nextNodeId) continue;
    const link = graph.links.find((candidate) => candidate.id === hop.linkId);
    if (!link || link.failed) {
      return { success: false, state, resolutions, failureReason: `Neighbor Discovery cannot use failed link ${hop.linkId}.` };
    }
    const targetInterface = interfaceOnLink(config, hop.linkId, hop.nextNodeId);
    if (!targetInterface) {
      return { success: false, state, resolutions, failureReason: `${hop.nextNodeId} has no IPv6 interface on ${hop.linkId}.` };
    }
    const targetAddress = hop.nextHop ?? targetInterface.globalAddress;
    if (targetAddress !== targetInterface.globalAddress && targetAddress !== targetInterface.linkLocalAddress) {
      return { success: false, state, resolutions, failureReason: `${targetAddress} is not assigned to ${hop.nextNodeId} on ${hop.linkId}.` };
    }

    const id = `${hop.nodeId}|${hop.linkId}|${targetAddress}`;
    const prior = state.neighborCache.find((entry) => entry.id === id);
    const cacheHit = Boolean(prior && sequence - prior.learnedSequence <= 8);
    const targetMac = prior?.mac ?? stableMac(hop.nextNodeId, hop.linkId);
    const solicitedNodeMulticast = builderIpv6SolicitedNodeMulticast(targetAddress);
    const multicastMac = builderIpv6SolicitedNodeMulticastMac(targetAddress);
    const resolution: BuilderIpv6NdResolution = {
      id: `nd6:${sequence}:${index}:${id}`,
      sequence,
      nodeId: hop.nodeId,
      targetNodeId: hop.nextNodeId,
      linkId: hop.linkId,
      targetAddress,
      solicitedNodeMulticast,
      multicastMac,
      targetMac,
      cacheHit,
      detail: cacheHit
        ? `${hop.nodeLabel} used its neighbor cache for ${targetAddress} → ${targetMac}.`
        : `${hop.nodeLabel} sent Neighbor Solicitation to ${solicitedNodeMulticast} (${multicastMac}); ${hop.nextNodeId.toUpperCase()} returned Neighbor Advertisement with ${targetMac}.`,
    };
    resolutions.push(resolution);

    if (!cacheHit) {
      state.neighborCache = [
        ...state.neighborCache.filter((entry) => entry.id !== id),
        { id, nodeId: hop.nodeId, linkId: hop.linkId, address: targetAddress, mac: targetMac, targetNodeId: hop.nextNodeId, learnedSequence: sequence, source: 'NS/NA' as const },
      ].slice(-96);
    }
  }

  state.ndHistory = [...state.ndHistory, ...resolutions].slice(-96);
  return { success: true, state, resolutions, failureReason: null };
}

export function runBuilderIpv6RouterSolicitation(
  graph: BuilderGraph,
  ipv4: BuilderAddressing,
  config: BuilderIpv6Config,
  endpointId: string,
  current: BuilderIpv6ControlState = createBuilderIpv6ControlState(),
): { config: BuilderIpv6Config; state: BuilderIpv6ControlState; event: BuilderIpv6RaEvent } {
  const sequence = current.clock + 1;
  let state = cloneState(current);
  state.clock = sequence;
  const endpoint = graph.nodes.find((node) => node.id === endpointId);
  const links = graph.links.filter((link) => !link.failed && (link.a === endpointId || link.b === endpointId)).sort((a, b) => a.id.localeCompare(b.id));
  const candidate = endpoint?.kind === 'endpoint' ? links.map((link) => {
    const routerId = link.a === endpointId ? link.b : link.a;
    const router = graph.nodes.find((node) => node.id === routerId);
    return router?.kind === 'router' && config.autoconfig.raEnabledRouterIds.includes(routerId) ? { link, routerId } : null;
  }).find((entry): entry is { link: BuilderGraph['links'][number]; routerId: string } => Boolean(entry)) : null;

  if (!config.enabled || !endpoint || endpoint.kind !== 'endpoint' || !candidate) {
    const event: BuilderIpv6RaEvent = {
      id: `ra6:${sequence}:${endpointId}`,
      sequence,
      endpointId,
      routerId: null,
      linkId: null,
      success: false,
      rsDestination: 'ff02::2',
      raSource: null,
      prefix: null,
      slaacAddress: null,
      routerLifetimeSeconds: 0,
      preferredLifetimeSeconds: 0,
      validLifetimeSeconds: 0,
      detail: !config.enabled ? 'IPv6 is disabled; Router Solicitation cannot run.' : 'No live directly connected router is advertising a prefix to this endpoint.',
    };
    state.raHistory = [...state.raHistory, event].slice(-24);
    return { config, state, event };
  }

  const nextConfig = applyBuilderIpv6Slaac(graph, ipv4, config, endpointId, candidate.routerId, candidate.link.id);
  const segment = nextConfig.addressing.segments[candidate.link.id];
  const routerInterface = segment.interfaces.find((entry) => entry.nodeId === candidate.routerId)!;
  const endpointInterface = segment.interfaces.find((entry) => entry.nodeId === endpointId)!;
  const cacheId = `${endpointId}|${candidate.link.id}|${routerInterface.linkLocalAddress}`;
  state.neighborCache = [
    ...state.neighborCache.filter((entry) => entry.id !== cacheId),
    { id: cacheId, nodeId: endpointId, linkId: candidate.link.id, address: routerInterface.linkLocalAddress, mac: stableMac(candidate.routerId, candidate.link.id), targetNodeId: candidate.routerId, learnedSequence: sequence, source: 'RA' as const },
  ].slice(-96);
  const event: BuilderIpv6RaEvent = {
    id: `ra6:${sequence}:${endpointId}:${candidate.routerId}`,
    sequence,
    endpointId,
    routerId: candidate.routerId,
    linkId: candidate.link.id,
    success: true,
    rsDestination: 'ff02::2',
    raSource: routerInterface.linkLocalAddress,
    prefix: segment.prefix,
    slaacAddress: endpointInterface.globalAddress,
    routerLifetimeSeconds: 1800,
    preferredLifetimeSeconds: 1800,
    validLifetimeSeconds: 3600,
    detail: `${endpoint.label} sent RS to ff02::2. ${candidate.routerId.toUpperCase()} advertised ${segment.prefix}; SLAAC installed ${endpointInterface.globalAddress} and default router ${routerInterface.linkLocalAddress}%${candidate.link.id}.`,
  };
  state.raHistory = [...state.raHistory, event].slice(-24);
  return { config: nextConfig, state, event };
}

export function checkBuilderIpv6Pmtu(
  graph: BuilderGraph,
  config: BuilderIpv6Config,
  trace: BuilderIpv6ForwardingTrace,
  profiles: BuilderLinkProfiles,
  requestedBytes: number,
  current: BuilderIpv6ControlState = createBuilderIpv6ControlState(),
  sequence = current.clock + 1,
  maxHops = trace.hops.length,
): BuilderIpv6PmtuCheckResult {
  let state = cloneState(current);
  state.clock = Math.max(state.clock, sequence);
  const requested = Math.max(80, Math.min(9216, Math.round(requestedBytes)));
  const cacheId = `${trace.sourceNodeId}|${trace.destinationNodeId}`;
  const cached = state.pmtuCache.find((entry) => entry.id === cacheId) ?? null;
  const effectivePacketBytes = Math.min(requested, cached?.pathMtuBytes ?? requested);
  const hops = trace.hops.slice(0, Math.max(0, maxHops));
  const constrainedIndex = hops.findIndex((hop) => hop.linkId && (profiles[hop.linkId]?.mtuBytes ?? 1500) < effectivePacketBytes);
  if (constrainedIndex < 0) {
    return { blocked: false, cacheHit: Boolean(cached && requested > cached.pathMtuBytes), requestedBytes: requested, effectivePacketBytes, state, event: null };
  }

  const hop = hops[constrainedIndex];
  const linkId = hop.linkId!;
  const mtuBytes = profiles[linkId]?.mtuBytes ?? 1500;
  const responderNodeId = hop.nodeId;
  const responder = graph.nodes.find((node) => node.id === responderNodeId);
  const reverseTrace = responder?.kind === 'router' ? traceBuilderIpv6Forwarding(graph, config, responderNodeId, trace.sourceNodeId) : null;
  const delivered = responder?.kind === 'endpoint' || Boolean(reverseTrace?.reachable);
  const event: BuilderIpv6PmtuEvent = {
    id: `ptb6:${sequence}:${cacheId}:${linkId}`,
    sequence,
    sourceNodeId: trace.sourceNodeId,
    destinationNodeId: trace.destinationNodeId,
    requestedBytes: requested,
    effectivePacketBytes,
    mtuBytes,
    linkId,
    responderNodeId,
    delivered,
    reverseTrace,
    detail: responder?.kind === 'router'
      ? delivered
        ? `${responder.label} cannot forward ${effectivePacketBytes} bytes onto ${linkId} (MTU ${mtuBytes}); ICMPv6 Packet Too Big returns to ${trace.sourceNodeId.toUpperCase()} and updates PMTU state.`
        : `${responder.label} detects MTU ${mtuBytes} on ${linkId}, but Packet Too Big has no IPv6 reverse route to ${trace.sourceNodeId.toUpperCase()}.`
      : `The source interface on ${linkId} has MTU ${mtuBytes}; the local IPv6 stack constrains the packet before transmission.`,
  };

  if (delivered) {
    const entry: BuilderIpv6PmtuCacheEntry = { id: cacheId, sourceNodeId: trace.sourceNodeId, destinationNodeId: trace.destinationNodeId, pathMtuBytes: mtuBytes, learnedFromNodeId: responderNodeId, linkId, learnedSequence: sequence };
    state.pmtuCache = [...state.pmtuCache.filter((item) => item.id !== cacheId), entry].slice(-32);
  }
  state.pmtuHistory = [...state.pmtuHistory, event].slice(-32);
  return { blocked: true, cacheHit: Boolean(cached), requestedBytes: requested, effectivePacketBytes, state, event };
}

export function primaryBuilderIpv6PtbSource(config: BuilderIpv6Config, event: BuilderIpv6PmtuEvent): string | null {
  return primaryBuilderIpv6Address(config.addressing, event.responderNodeId);
}

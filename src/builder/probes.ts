import { interfacesForBuilderNode, type BuilderAddressing } from './addressing.ts';
import { traceBuilderForwarding, type BuilderForwardingTrace, type BuilderRoutingConfig } from './routing.ts';
import type { BuilderGraph } from './model.ts';

export type BuilderProbeKind = 'ping' | 'traceroute';
export type BuilderProbeStatus = 'echo-reply' | 'time-exceeded' | 'timeout' | 'unreachable';

export interface BuilderProbePacketSeed {
  id: string;
  label: string;
  sourceAddress: string;
  destinationAddress: string;
  sourceMac: string;
  destinationMac: string;
  ttl: number;
}

export interface BuilderProbeAttempt {
  index: number;
  ttl: number;
  status: BuilderProbeStatus;
  responderNodeId: string | null;
  responderAddress: string | null;
  requestNodeIds: string[];
  requestLinkIds: string[];
  responseNodeIds: string[];
  responseLinkIds: string[];
  detail: string;
  packet: BuilderProbePacketSeed | null;
}

export interface BuilderProbeResult {
  id: string;
  sequence: number;
  kind: BuilderProbeKind;
  plane: 'ROUTED IPV4';
  sourceNodeId: string;
  destinationNodeId: string;
  sourceAddress: string | null;
  destinationAddress: string | null;
  success: boolean;
  attempts: BuilderProbeAttempt[];
  summary: string;
  snapshotNote: string;
}

function nodeLabel(graph: BuilderGraph, nodeId: string): string {
  return graph.nodes.find((node) => node.id === nodeId)?.label ?? nodeId.toUpperCase();
}

function nodePath(trace: BuilderForwardingTrace): string[] {
  return [trace.sourceNodeId, ...trace.hops.map((hop) => hop.nextNodeId).filter((id): id is string => Boolean(id))]
    .filter((id, index, all) => index === 0 || id !== all[index - 1]);
}

function linkPath(trace: BuilderForwardingTrace): string[] {
  return trace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []);
}

function primaryAddress(addressing: BuilderAddressing, nodeId: string): string | null {
  return interfacesForBuilderNode(addressing, nodeId)[0]?.address ?? null;
}

function inboundAddress(addressing: BuilderAddressing, nodeId: string, linkId: string | undefined): string | null {
  if (!linkId) return primaryAddress(addressing, nodeId);
  return addressing.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nodeId)?.address
    ?? primaryAddress(addressing, nodeId);
}

function stableMac(nodeId: string, salt = ''): string {
  const text = `${nodeId}:${salt}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const bytes = [0x02, 0x48, 0x4f, (hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff];
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(':');
}

function packetSeed(
  id: string,
  label: string,
  sourceNodeId: string,
  destinationNodeId: string,
  sourceAddress: string | null,
  destinationAddress: string | null,
  ttl: number,
): BuilderProbePacketSeed | null {
  if (!sourceAddress || !destinationAddress) return null;
  return {
    id,
    label,
    sourceAddress,
    destinationAddress,
    sourceMac: stableMac(sourceNodeId, 'probe'),
    destinationMac: stableMac(destinationNodeId, 'probe'),
    ttl,
  };
}

function reverseTrace(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  fromNodeId: string,
  sourceNodeId: string,
): BuilderForwardingTrace {
  return traceBuilderForwarding(graph, addressing, routing, fromNodeId, sourceNodeId);
}

function runPing(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  sourceNodeId: string,
  destinationNodeId: string,
  sequence: number,
): BuilderProbeResult {
  const request = traceBuilderForwarding(graph, addressing, routing, sourceNodeId, destinationNodeId);
  const sourceAddress = primaryAddress(addressing, sourceNodeId);
  const destinationAddress = request.destinationAddress ?? primaryAddress(addressing, destinationNodeId);
  let reply: BuilderForwardingTrace | null = null;
  let status: BuilderProbeStatus;
  let responderNodeId: string | null;
  let detail: string;

  if (!request.reachable) {
    status = 'unreachable';
    responderNodeId = request.failureNodeId;
    detail = request.failureReason ?? 'Forward request could not be delivered.';
  } else {
    reply = reverseTrace(graph, addressing, routing, destinationNodeId, sourceNodeId);
    if (reply.reachable) {
      status = 'echo-reply';
      responderNodeId = destinationNodeId;
      detail = `ICMP Echo Request and Echo Reply both have valid forwarding paths. No synthetic RTT is invented from routing cost.`;
    } else {
      status = 'timeout';
      responderNodeId = destinationNodeId;
      detail = `Echo Request reached ${nodeLabel(graph, destinationNodeId)}, but the Echo Reply cannot return: ${reply.failureReason ?? 'reverse path unavailable'}.`;
    }
  }

  const attempt: BuilderProbeAttempt = {
    index: 0,
    ttl: 64,
    status,
    responderNodeId,
    responderAddress: responderNodeId ? primaryAddress(addressing, responderNodeId) : null,
    requestNodeIds: nodePath(request),
    requestLinkIds: linkPath(request),
    responseNodeIds: reply ? nodePath(reply) : [],
    responseLinkIds: reply ? linkPath(reply) : [],
    detail,
    packet: packetSeed(`probe-${sequence}-echo`, 'ICMP ECHO REQUEST', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, 64),
  };

  return {
    id: `probe-${sequence}-ping`,
    sequence,
    kind: 'ping',
    plane: 'ROUTED IPV4',
    sourceNodeId,
    destinationNodeId,
    sourceAddress,
    destinationAddress,
    success: status === 'echo-reply',
    attempts: [attempt],
    summary: status === 'echo-reply'
      ? `${nodeLabel(graph, destinationNodeId)} replied to ICMP Echo over the current route table.`
      : status === 'timeout'
        ? `Request arrived, but the reverse ICMP path is unavailable.`
        : `${nodeLabel(graph, request.failureNodeId ?? sourceNodeId)} stopped the Echo Request: ${request.failureReason ?? 'unreachable'}.`,
    snapshotNote: 'Probe history is a session snapshot. Later topology/routing edits do not rewrite an earlier result.',
  };
}

function runTraceroute(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  sourceNodeId: string,
  destinationNodeId: string,
  sequence: number,
): BuilderProbeResult {
  const forward = traceBuilderForwarding(graph, addressing, routing, sourceNodeId, destinationNodeId);
  const sourceAddress = primaryAddress(addressing, sourceNodeId);
  const destinationAddress = forward.destinationAddress ?? primaryAddress(addressing, destinationNodeId);
  const nodes = nodePath(forward);
  const links = linkPath(forward);
  const attempts: BuilderProbeAttempt[] = [];
  let ttl = 1;

  for (let nodeIndex = 1; nodeIndex < nodes.length; nodeIndex += 1) {
    const nodeId = nodes[nodeIndex];
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.kind !== 'router') continue;
    const response = reverseTrace(graph, addressing, routing, nodeId, sourceNodeId);
    const incomingLinkId = links[nodeIndex - 1];
    const responderAddress = inboundAddress(addressing, nodeId, incomingLinkId);
    attempts.push({
      index: attempts.length,
      ttl,
      status: response.reachable ? 'time-exceeded' : 'timeout',
      responderNodeId: nodeId,
      responderAddress,
      requestNodeIds: nodes.slice(0, nodeIndex + 1),
      requestLinkIds: links.slice(0, nodeIndex),
      responseNodeIds: response.reachable ? nodePath(response) : [],
      responseLinkIds: response.reachable ? linkPath(response) : [],
      detail: response.reachable
        ? `${nodeLabel(graph, nodeId)} decrements TTL to zero and returns ICMP Time Exceeded on its own reverse forwarding path.`
        : `${nodeLabel(graph, nodeId)} expires TTL, but its ICMP Time Exceeded cannot return to the source: ${response.failureReason ?? 'reverse path unavailable'}.`,
      packet: packetSeed(`probe-${sequence}-ttl-${ttl}`, `ICMP TRACE TTL ${ttl}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, ttl),
    });
    ttl += 1;
  }

  if (forward.reachable) {
    const reply = reverseTrace(graph, addressing, routing, destinationNodeId, sourceNodeId);
    attempts.push({
      index: attempts.length,
      ttl,
      status: reply.reachable ? 'echo-reply' : 'timeout',
      responderNodeId: destinationNodeId,
      responderAddress: destinationAddress,
      requestNodeIds: nodes,
      requestLinkIds: links,
      responseNodeIds: reply.reachable ? nodePath(reply) : [],
      responseLinkIds: reply.reachable ? linkPath(reply) : [],
      detail: reply.reachable
        ? `${nodeLabel(graph, destinationNodeId)} receives the ICMP Echo probe before TTL expires and returns Echo Reply.`
        : `${nodeLabel(graph, destinationNodeId)} receives the final probe, but Echo Reply cannot return: ${reply.failureReason ?? 'reverse path unavailable'}.`,
      packet: packetSeed(`probe-${sequence}-ttl-${ttl}`, `ICMP TRACE TTL ${ttl}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, ttl),
    });
  } else {
    attempts.push({
      index: attempts.length,
      ttl,
      status: 'unreachable',
      responderNodeId: forward.failureNodeId,
      responderAddress: forward.failureNodeId ? primaryAddress(addressing, forward.failureNodeId) : null,
      requestNodeIds: nodes,
      requestLinkIds: links,
      responseNodeIds: [],
      responseLinkIds: [],
      detail: `${nodeLabel(graph, forward.failureNodeId ?? sourceNodeId)} cannot continue the probe: ${forward.failureReason ?? 'no route'}.`,
      packet: packetSeed(`probe-${sequence}-ttl-${ttl}`, `ICMP TRACE TTL ${ttl}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, ttl),
    });
  }

  const success = forward.reachable && attempts.at(-1)?.status === 'echo-reply';
  return {
    id: `probe-${sequence}-traceroute`,
    sequence,
    kind: 'traceroute',
    plane: 'ROUTED IPV4',
    sourceNodeId,
    destinationNodeId,
    sourceAddress,
    destinationAddress,
    success,
    attempts,
    summary: success
      ? `ICMP traceroute reached ${nodeLabel(graph, destinationNodeId)} after ${Math.max(0, attempts.length - 1)} routed hop${attempts.length - 1 === 1 ? '' : 's'}.`
      : `Traceroute terminated without a returning destination Echo Reply.`,
    snapshotNote: 'TTL is decremented only at routers. Link cost is routing cost, not fabricated latency.',
  };
}

export function runBuilderProbe(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  kind: BuilderProbeKind,
  sourceNodeId: string,
  destinationNodeId: string,
  sequence = 1,
): BuilderProbeResult {
  return kind === 'ping'
    ? runPing(graph, addressing, routing, sourceNodeId, destinationNodeId, sequence)
    : runTraceroute(graph, addressing, routing, sourceNodeId, destinationNodeId, sequence);
}

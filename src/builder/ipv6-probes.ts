import type { BuilderGraph } from './model.ts';
import { builderPathCharacteristics, builderRoundTripCharacteristics, createDefaultBuilderLinkProfiles, deterministicBuilderPathDrop, type BuilderLinkProfiles } from './link-characteristics.ts';
import { interfacesForBuilderNodeIpv6, primaryBuilderIpv6Address, traceBuilderIpv6Forwarding, type BuilderIpv6Config, type BuilderIpv6ForwardingTrace } from './ipv6.ts';
import type { BuilderNatSessionTable } from './nat.ts';
import type { BuilderProbeAttempt, BuilderProbePacketSeed, BuilderProbeResult, BuilderProbeStatus } from './probes.ts';

const IPV6_PROBE_PACKET_BYTES = 94;

function labelFor(graph: BuilderGraph, nodeId: string): string { return graph.nodes.find((node) => node.id === nodeId)?.label ?? nodeId.toUpperCase(); }
function nodePath(trace: BuilderIpv6ForwardingTrace): string[] { return [trace.sourceNodeId, ...trace.hops.map((hop) => hop.nextNodeId).filter((id): id is string => Boolean(id))].filter((id, index, all) => index === 0 || id !== all[index - 1]); }
function linkPath(trace: BuilderIpv6ForwardingTrace): string[] { return trace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []); }
function inboundAddress(config: BuilderIpv6Config, nodeId: string, linkId: string | undefined): string | null {
  if (!linkId) return primaryBuilderIpv6Address(config.addressing, nodeId);
  return config.addressing.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nodeId)?.globalAddress ?? primaryBuilderIpv6Address(config.addressing, nodeId);
}
function stableMac(nodeId: string, salt = ''): string { const text = `${nodeId}:${salt}`; let hash = 0x811c9dc5; for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193) >>> 0; } return [0x02, 0x48, 0x4f, (hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff].map((byte) => byte.toString(16).padStart(2, '0')).join(':'); }
function packetSeed(id: string, label: string, sourceNodeId: string, destinationNodeId: string, sourceAddress: string | null, destinationAddress: string | null, hopLimit: number): BuilderProbePacketSeed | null {
  if (!sourceAddress || !destinationAddress) return null;
  return { id, label, family: 'ipv6', sourceAddress, destinationAddress, sourceMac: stableMac(sourceNodeId, 'probe6'), destinationMac: stableMac(destinationNodeId, 'probe6'), ttl: hopLimit };
}
function metrics(profiles: BuilderLinkProfiles, requestLinkIds: string[], responseLinkIds: string[], hasResponse: boolean) {
  const path = builderPathCharacteristics(profiles, [...requestLinkIds, ...responseLinkIds]);
  const round = builderRoundTripCharacteristics(profiles, requestLinkIds, responseLinkIds);
  return { simulatedRttMs: hasResponse ? Number(round.rttMs.toFixed(2)) : null, jitterMs: Number(path.jitterMs.toFixed(2)), bottleneckMbps: path.bottleneckMbps, pathMtuBytes: path.pathMtuBytes, pathLossPercent: Number(path.lossPercent.toFixed(4)) };
}

function ping(graph: BuilderGraph, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string, sequence: number, profiles: BuilderLinkProfiles, natSessions: BuilderNatSessionTable): BuilderProbeResult {
  const request = traceBuilderIpv6Forwarding(graph, config, sourceNodeId, destinationNodeId);
  const sourceAddress = request.sourceAddress ?? primaryBuilderIpv6Address(config.addressing, sourceNodeId);
  const destinationAddress = request.destinationAddress ?? primaryBuilderIpv6Address(config.addressing, destinationNodeId);
  const requestLinks = linkPath(request);
  const requestPhysical = builderPathCharacteristics(profiles, requestLinks);
  let reply: BuilderIpv6ForwardingTrace | null = null;
  let status: BuilderProbeStatus = 'unreachable';
  let responderNodeId: string | null = null;
  let detail = '';
  let dropLinkId: string | null = null;

  if (!request.reachable) { responderNodeId = request.failureNodeId; detail = request.failureReason ?? 'IPv6 Echo Request could not be delivered.'; }
  else if ((requestPhysical.pathMtuBytes ?? IPV6_PROBE_PACKET_BYTES) < IPV6_PROBE_PACKET_BYTES) {
    responderNodeId = request.hops.find((hop) => profiles[hop.linkId ?? '']?.mtuBytes < IPV6_PROBE_PACKET_BYTES)?.nodeId ?? sourceNodeId;
    detail = `ICMPv6 teaching probe is ${IPV6_PROBE_PACKET_BYTES} bytes but path MTU is ${requestPhysical.pathMtuBytes}. ICMPv6 Packet Too Big generation is deferred rather than fabricated.`;
  } else if ((dropLinkId = deterministicBuilderPathDrop(profiles, requestLinks, `ping6:${sequence}:request`))) {
    status = 'timeout'; detail = `ICMPv6 Echo Request was deterministically dropped on ${dropLinkId}.`;
  } else {
    reply = traceBuilderIpv6Forwarding(graph, config, destinationNodeId, sourceNodeId);
    const responseLinks = linkPath(reply);
    if (!reply.reachable) { status = 'timeout'; responderNodeId = destinationNodeId; detail = `Echo Request reached ${labelFor(graph, destinationNodeId)}, but the ICMPv6 Echo Reply cannot return: ${reply.failureReason ?? 'reverse IPv6 route unavailable'}.`; }
    else if ((dropLinkId = deterministicBuilderPathDrop(profiles, responseLinks, `ping6:${sequence}:reply`))) { status = 'timeout'; responderNodeId = destinationNodeId; detail = `ICMPv6 Echo Reply was deterministically dropped on ${dropLinkId}.`; }
    else { status = 'echo-reply'; responderNodeId = destinationNodeId; detail = 'ICMPv6 Echo Request and Echo Reply both follow the IPv6 FIB and explicit routed-link characteristics. Neighbor Discovery and IPv6 firewall/NAT policy are not fabricated in this foundation slice.'; }
  }
  const responseLinks = reply ? linkPath(reply) : [];
  const m = metrics(profiles, requestLinks, responseLinks, status === 'echo-reply');
  const attempt: BuilderProbeAttempt = { index: 0, ttl: 64, status, responderNodeId, responderAddress: responderNodeId ? primaryBuilderIpv6Address(config.addressing, responderNodeId) : null, requestNodeIds: nodePath(request), requestLinkIds: requestLinks, responseNodeIds: reply ? nodePath(reply) : [], responseLinkIds: responseLinks, detail, packet: packetSeed(`probe6-${sequence}-echo`, 'ICMPV6 ECHO REQUEST', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, 64), ...m, dropLinkId, natDetail: null };
  return { id: `probe6-${sequence}-ping`, sequence, kind: 'ping', plane: 'ROUTED IPV6', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, success: status === 'echo-reply', attempts: [attempt], summary: status === 'echo-reply' ? `${labelFor(graph, destinationNodeId)} replied over IPv6 · simulated RTT ${m.simulatedRttMs} ms · path MTU ${m.pathMtuBytes}.` : status === 'timeout' ? 'IPv6 request/reply forwarding exists only partially; reverse routing or deterministic link behavior prevented a reply.' : `${labelFor(graph, responderNodeId ?? request.failureNodeId ?? sourceNodeId)} stopped the IPv6 Echo Request.`, snapshotNote: 'IPv6 probes use a separate IPv6 FIB. RTT/loss/MTU reuse physical link characteristics. ND, RA/SLAAC, Packet Too Big, OSPFv3, IPv6 ACL, and IPv6 NAT are intentionally deferred.', natApplied: false, natTranslationId: null, natSessions };
}

function traceroute(graph: BuilderGraph, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string, sequence: number, profiles: BuilderLinkProfiles, natSessions: BuilderNatSessionTable): BuilderProbeResult {
  const forward = traceBuilderIpv6Forwarding(graph, config, sourceNodeId, destinationNodeId);
  const sourceAddress = forward.sourceAddress ?? primaryBuilderIpv6Address(config.addressing, sourceNodeId);
  const destinationAddress = forward.destinationAddress ?? primaryBuilderIpv6Address(config.addressing, destinationNodeId);
  const nodes = nodePath(forward);
  const links = linkPath(forward);
  const attempts: BuilderProbeAttempt[] = [];
  if (!forward.reachable) {
    const requestLinks = links;
    const m = metrics(profiles, requestLinks, [], false);
    attempts.push({ index: 0, ttl: 1, status: 'unreachable', responderNodeId: forward.failureNodeId, responderAddress: forward.failureNodeId ? primaryBuilderIpv6Address(config.addressing, forward.failureNodeId) : null, requestNodeIds: nodes, requestLinkIds: requestLinks, responseNodeIds: [], responseLinkIds: [], detail: forward.failureReason ?? 'IPv6 forwarding is unavailable.', packet: packetSeed(`probe6-${sequence}-ttl-1`, 'ICMPV6 TRACE HOP LIMIT 1', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, 1), ...m, dropLinkId: null, natDetail: null });
    return { id: `probe6-${sequence}-traceroute`, sequence, kind: 'traceroute', plane: 'ROUTED IPV6', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, success: false, attempts, summary: 'IPv6 traceroute terminated before a complete forward route existed.', snapshotNote: 'Hop Limit expires only at routers. IPv6 return messages require their own IPv6 FIB path. ND and ICMPv6 Packet Too Big remain deferred.', natApplied: false, natTranslationId: null, natSessions };
  }

  let hopLimit = 1;
  for (let nodeIndex = 1; nodeIndex < nodes.length; nodeIndex += 1) {
    const nodeId = nodes[nodeIndex];
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.kind !== 'router') continue;
    const requestLinks = links.slice(0, nodeIndex);
    const packet = packetSeed(`probe6-${sequence}-hop-${hopLimit}`, `ICMPV6 TRACE HOP LIMIT ${hopLimit}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hopLimit);
    const physical = builderPathCharacteristics(profiles, requestLinks);
    if ((physical.pathMtuBytes ?? IPV6_PROBE_PACKET_BYTES) < IPV6_PROBE_PACKET_BYTES) {
      const m = metrics(profiles, requestLinks, [], false);
      attempts.push({ index: attempts.length, ttl: hopLimit, status: 'unreachable', responderNodeId: nodeId, responderAddress: inboundAddress(config, nodeId, links[nodeIndex - 1]), requestNodeIds: nodes.slice(0, nodeIndex + 1), requestLinkIds: requestLinks, responseNodeIds: [], responseLinkIds: [], detail: `IPv6 traceroute packet exceeds path MTU ${physical.pathMtuBytes}; Packet Too Big behavior is deferred.`, packet, ...m, dropLinkId: null, natDetail: null });
      break;
    }
    const requestDrop = deterministicBuilderPathDrop(profiles, requestLinks, `trace6:${sequence}:${hopLimit}:request`);
    if (requestDrop) {
      const m = metrics(profiles, requestLinks, [], false);
      attempts.push({ index: attempts.length, ttl: hopLimit, status: 'timeout', responderNodeId: null, responderAddress: null, requestNodeIds: nodes.slice(0, nodeIndex + 1), requestLinkIds: requestLinks, responseNodeIds: [], responseLinkIds: [], detail: `Hop-Limit-${hopLimit} probe was dropped on ${requestDrop}.`, packet, ...m, dropLinkId: requestDrop, natDetail: null });
      hopLimit += 1; continue;
    }
    const response = traceBuilderIpv6Forwarding(graph, config, nodeId, sourceNodeId);
    const responseLinks = linkPath(response);
    const responseDrop = response.reachable ? deterministicBuilderPathDrop(profiles, responseLinks, `trace6:${sequence}:${hopLimit}:reply`) : null;
    const ok = response.reachable && !responseDrop;
    const m = metrics(profiles, requestLinks, responseLinks, ok);
    attempts.push({ index: attempts.length, ttl: hopLimit, status: ok ? 'time-exceeded' : 'timeout', responderNodeId: nodeId, responderAddress: inboundAddress(config, nodeId, links[nodeIndex - 1]), requestNodeIds: nodes.slice(0, nodeIndex + 1), requestLinkIds: requestLinks, responseNodeIds: response.reachable ? nodePath(response) : [], responseLinkIds: responseLinks, detail: ok ? `${labelFor(graph, nodeId)} decremented Hop Limit to zero; ICMPv6 Time Exceeded returned through the IPv6 FIB.` : responseDrop ? `ICMPv6 Time Exceeded was dropped on ${responseDrop}.` : `${labelFor(graph, nodeId)} cannot return ICMPv6 Time Exceeded: ${response.failureReason ?? 'reverse IPv6 route unavailable'}.`, packet, ...m, dropLinkId: responseDrop, natDetail: null });
    hopLimit += 1;
  }

  const destinationRequestLinks = links;
  const destinationPacket = packetSeed(`probe6-${sequence}-hop-${hopLimit}`, `ICMPV6 TRACE HOP LIMIT ${hopLimit}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hopLimit);
  const reply = traceBuilderIpv6Forwarding(graph, config, destinationNodeId, sourceNodeId);
  const responseLinks = linkPath(reply);
  const requestDrop = deterministicBuilderPathDrop(profiles, destinationRequestLinks, `trace6:${sequence}:${hopLimit}:destination-request`);
  const replyDrop = !requestDrop && reply.reachable ? deterministicBuilderPathDrop(profiles, responseLinks, `trace6:${sequence}:${hopLimit}:destination-reply`) : null;
  const success = !requestDrop && reply.reachable && !replyDrop;
  const m = metrics(profiles, destinationRequestLinks, responseLinks, success);
  attempts.push({ index: attempts.length, ttl: hopLimit, status: success ? 'echo-reply' : 'timeout', responderNodeId: destinationNodeId, responderAddress: primaryBuilderIpv6Address(config.addressing, destinationNodeId), requestNodeIds: nodes, requestLinkIds: destinationRequestLinks, responseNodeIds: reply.reachable ? nodePath(reply) : [], responseLinkIds: responseLinks, detail: success ? `${labelFor(graph, destinationNodeId)} returned ICMPv6 Echo Reply; Hop Limit was sufficient to reach the destination.` : requestDrop ? `Final IPv6 Echo Request was dropped on ${requestDrop}.` : replyDrop ? `Final ICMPv6 Echo Reply was dropped on ${replyDrop}.` : `Destination received the probe, but the ICMPv6 Echo Reply cannot return: ${reply.failureReason ?? 'reverse route unavailable'}.`, packet: destinationPacket, ...m, dropLinkId: requestDrop ?? replyDrop, natDetail: null });
  return { id: `probe6-${sequence}-traceroute`, sequence, kind: 'traceroute', plane: 'ROUTED IPV6', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, success, attempts, summary: success ? `ICMPv6 traceroute reached ${labelFor(graph, destinationNodeId)} after ${Math.max(0, attempts.length - 1)} routed hop${attempts.length - 1 === 1 ? '' : 's'}.` : 'IPv6 traceroute terminated without a returning destination Echo Reply.', snapshotNote: 'Hop Limit decrements only at routers. Each ICMPv6 Time Exceeded response consumes independent IPv6 reverse forwarding. ND/SLAAC/Packet Too Big/OSPFv3 are not inferred.', natApplied: false, natTranslationId: null, natSessions };
}

export function runBuilderIpv6Probe(
  graph: BuilderGraph,
  config: BuilderIpv6Config,
  kind: 'ping' | 'traceroute',
  sourceNodeId: string,
  destinationNodeId: string,
  sequence = 1,
  profiles: BuilderLinkProfiles = createDefaultBuilderLinkProfiles(graph),
  natSessions: BuilderNatSessionTable = [],
): BuilderProbeResult {
  return kind === 'ping' ? ping(graph, config, sourceNodeId, destinationNodeId, sequence, profiles, natSessions) : traceroute(graph, config, sourceNodeId, destinationNodeId, sequence, profiles, natSessions);
}

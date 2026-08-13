import type { BuilderGraph } from './model.ts';
import { builderPathCharacteristics, builderRoundTripCharacteristics, createDefaultBuilderLinkProfiles, deterministicBuilderPathDrop, type BuilderLinkProfiles } from './link-characteristics.ts';
import { primaryBuilderIpv6Address, traceBuilderIpv6Forwarding, type BuilderIpv6Config, type BuilderIpv6ForwardingTrace } from './ipv6.ts';
import { checkBuilderIpv6Pmtu, createBuilderIpv6ControlState, resolveBuilderIpv6TraceNeighbors, type BuilderIpv6ControlState } from './ipv6-control-plane.ts';
import type { BuilderNatSessionTable } from './nat.ts';
import type { BuilderProbeAttempt, BuilderProbePacketSeed, BuilderProbeResult, BuilderProbeStatus } from './probes.ts';

const DEFAULT_IPV6_PROBE_PACKET_BYTES = 1280;

export interface BuilderIpv6ProbeResult extends BuilderProbeResult {
  ipv6ControlState: BuilderIpv6ControlState;
  requestedPacketBytes: number;
  effectivePacketBytes: number;
}

function labelFor(graph: BuilderGraph, nodeId: string): string { return graph.nodes.find((node) => node.id === nodeId)?.label ?? nodeId.toUpperCase(); }
function nodePath(trace: BuilderIpv6ForwardingTrace): string[] { return [trace.sourceNodeId, ...trace.hops.map((hop) => hop.nextNodeId).filter((id): id is string => Boolean(id))].filter((id, index, all) => index === 0 || id !== all[index - 1]); }
function linkPath(trace: BuilderIpv6ForwardingTrace): string[] { return trace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []); }
function inboundAddress(config: BuilderIpv6Config, nodeId: string, linkId: string | undefined): string | null {
  if (!linkId) return primaryBuilderIpv6Address(config.addressing, nodeId);
  return config.addressing.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nodeId)?.globalAddress ?? primaryBuilderIpv6Address(config.addressing, nodeId);
}
function stableMac(nodeId: string, salt = ''): string { const text = `${nodeId}:${salt}`; let hash = 0x811c9dc5; for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193) >>> 0; } return [0x02, 0x48, 0x4f, (hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff].map((byte) => byte.toString(16).padStart(2, '0')).join(':'); }
function packetSeed(id: string, label: string, sourceNodeId: string, destinationNodeId: string, sourceAddress: string | null, destinationAddress: string | null, hopLimit: number, packetBytes = DEFAULT_IPV6_PROBE_PACKET_BYTES, icmpType = 128, icmpCode = 0, icmpMtu?: number): BuilderProbePacketSeed | null {
  if (!sourceAddress || !destinationAddress) return null;
  return { id, label, family: 'ipv6', sourceAddress, destinationAddress, sourceMac: stableMac(sourceNodeId, 'probe6'), destinationMac: stableMac(destinationNodeId, 'probe6'), ttl: hopLimit, icmpType, icmpCode, icmpMtu, payloadBytes: Math.max(0, Math.min(4096, packetBytes - 48)) };
}
function metrics(profiles: BuilderLinkProfiles, requestLinkIds: string[], responseLinkIds: string[], hasResponse: boolean) {
  const path = builderPathCharacteristics(profiles, [...requestLinkIds, ...responseLinkIds]);
  const round = builderRoundTripCharacteristics(profiles, requestLinkIds, responseLinkIds);
  return { simulatedRttMs: hasResponse ? Number(round.rttMs.toFixed(2)) : null, jitterMs: Number(path.jitterMs.toFixed(2)), bottleneckMbps: path.bottleneckMbps, pathMtuBytes: path.pathMtuBytes, pathLossPercent: Number(path.lossPercent.toFixed(4)) };
}
function ndSummary(resolutions: ReturnType<typeof resolveBuilderIpv6TraceNeighbors>['resolutions']): string {
  if (resolutions.length === 0) return 'ND: no next-hop resolution required.';
  const misses = resolutions.filter((entry) => !entry.cacheHit).length;
  const hits = resolutions.length - misses;
  return misses === 0 ? `ND: ${hits} cache hit${hits === 1 ? '' : 's'}.` : `ND: ${misses} NS/NA exchange${misses === 1 ? '' : 's'}${hits ? ` + ${hits} cache hit${hits === 1 ? '' : 's'}` : ''}.`;
}

function packetTooBigAttempt(
  graph: BuilderGraph,
  config: BuilderIpv6Config,
  sequence: number,
  sourceNodeId: string,
  destinationNodeId: string,
  forward: BuilderIpv6ForwardingTrace,
  profiles: BuilderLinkProfiles,
  pmtu: ReturnType<typeof checkBuilderIpv6Pmtu>,
  current: BuilderIpv6ControlState,
): { attempt: BuilderProbeAttempt; state: BuilderIpv6ControlState } {
  const event = pmtu.event!;
  let state = current;
  if (event.reverseTrace?.reachable) state = resolveBuilderIpv6TraceNeighbors(graph, config, event.reverseTrace, state, sequence).state;
  const responseLinks = event.reverseTrace?.reachable ? linkPath(event.reverseTrace) : [];
  const constrainedIndex = forward.hops.findIndex((hop) => hop.linkId === event.linkId);
  const requestLinks = linkPath(forward).slice(0, Math.max(1, constrainedIndex + 1));
  const ptbSource = inboundAddress(config, event.responderNodeId, event.linkId);
  const sourceAddress = primaryBuilderIpv6Address(config.addressing, sourceNodeId);
  const delivered = event.delivered;
  const m = metrics(profiles, requestLinks, responseLinks, delivered);
  return {
    state,
    attempt: {
      index: 0,
      ttl: 64,
      status: delivered ? 'packet-too-big' : 'timeout',
      responderNodeId: event.responderNodeId,
      responderAddress: ptbSource,
      requestNodeIds: nodePath(forward),
      requestLinkIds: requestLinks,
      responseNodeIds: event.reverseTrace?.reachable ? nodePath(event.reverseTrace) : [],
      responseLinkIds: responseLinks,
      detail: event.detail,
      packet: delivered ? packetSeed(`probe6-${sequence}-ptb`, `ICMPV6 PACKET TOO BIG · MTU ${event.mtuBytes}`, event.responderNodeId, sourceNodeId, ptbSource, sourceAddress, 64, 56, 2, 0, event.mtuBytes) : null,
      ...m,
      dropLinkId: null,
      natDetail: null,
    },
  };
}

function ping(
  graph: BuilderGraph,
  config: BuilderIpv6Config,
  sourceNodeId: string,
  destinationNodeId: string,
  sequence: number,
  profiles: BuilderLinkProfiles,
  natSessions: BuilderNatSessionTable,
  currentControl: BuilderIpv6ControlState,
  requestedPacketBytes: number,
): BuilderIpv6ProbeResult {
  const request = traceBuilderIpv6Forwarding(graph, config, sourceNodeId, destinationNodeId);
  const sourceAddress = request.sourceAddress ?? primaryBuilderIpv6Address(config.addressing, sourceNodeId);
  const destinationAddress = request.destinationAddress ?? primaryBuilderIpv6Address(config.addressing, destinationNodeId);
  const requestLinks = linkPath(request);
  const requested = Math.max(80, Math.min(9216, Math.round(requestedPacketBytes)));
  let effectivePacketBytes = requested;
  let control = currentControl;
  let reply: BuilderIpv6ForwardingTrace | null = null;
  let status: BuilderProbeStatus = 'unreachable';
  let responderNodeId: string | null = null;
  let detail = '';
  let dropLinkId: string | null = null;

  if (!request.reachable) {
    responderNodeId = request.failureNodeId;
    detail = request.failureReason ?? 'IPv6 Echo Request could not be delivered.';
  } else {
    const ndRequest = resolveBuilderIpv6TraceNeighbors(graph, config, request, control, sequence);
    control = ndRequest.state;
    if (!ndRequest.success) {
      responderNodeId = request.failureNodeId ?? sourceNodeId;
      detail = `Neighbor Discovery failed before the Echo Request could traverse the IPv6 FIB path: ${ndRequest.failureReason}`;
    } else {
      const pmtu = checkBuilderIpv6Pmtu(graph, config, request, profiles, requested, control, sequence);
      control = pmtu.state;
      effectivePacketBytes = pmtu.effectivePacketBytes;
      if (pmtu.blocked && pmtu.event) {
        const ptb = packetTooBigAttempt(graph, config, sequence, sourceNodeId, destinationNodeId, request, profiles, pmtu, control);
        control = ptb.state;
        return {
          id: `probe6-${sequence}-ping`, sequence, kind: 'ping', plane: 'ROUTED IPV6', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress,
          success: false,
          attempts: [ptb.attempt],
          summary: ptb.attempt.status === 'packet-too-big'
            ? `ICMPv6 Packet Too Big returned · learned PMTU ${pmtu.event.mtuBytes} bytes. Rerun to use the PMTU cache.`
            : `Oversized IPv6 packet hit MTU ${pmtu.event.mtuBytes}, but Packet Too Big could not return.`,
          snapshotNote: 'IPv6 probes resolve routed next hops with Neighbor Discovery. Transit routers never fragment IPv6 packets; returning Packet Too Big messages update session-only PMTU state.',
          natApplied: false, natTranslationId: null, natSessions,
          ipv6ControlState: control, requestedPacketBytes: requested, effectivePacketBytes,
        };
      }

      const requestDrop = deterministicBuilderPathDrop(profiles, requestLinks, `ping6:${sequence}:request:${effectivePacketBytes}`);
      if (requestDrop) {
        status = 'timeout'; dropLinkId = requestDrop;
        detail = `ICMPv6 Echo Request was deterministically dropped on ${requestDrop}. ${ndSummary(ndRequest.resolutions)}`;
      } else {
        reply = traceBuilderIpv6Forwarding(graph, config, destinationNodeId, sourceNodeId);
        if (!reply.reachable) {
          status = 'timeout'; responderNodeId = destinationNodeId;
          detail = `Echo Request reached ${labelFor(graph, destinationNodeId)}, but the ICMPv6 Echo Reply cannot return: ${reply.failureReason ?? 'reverse IPv6 route unavailable'}.`;
        } else {
          const ndReply = resolveBuilderIpv6TraceNeighbors(graph, config, reply, control, sequence);
          control = ndReply.state;
          if (!ndReply.success) {
            status = 'timeout'; responderNodeId = destinationNodeId;
            detail = `Echo Request arrived, but reverse Neighbor Discovery failed: ${ndReply.failureReason}`;
          } else {
            const responseLinks = linkPath(reply);
            const replyDrop = deterministicBuilderPathDrop(profiles, responseLinks, `ping6:${sequence}:reply:${effectivePacketBytes}`);
            if (replyDrop) {
              status = 'timeout'; responderNodeId = destinationNodeId; dropLinkId = replyDrop;
              detail = `ICMPv6 Echo Reply was deterministically dropped on ${replyDrop}.`;
            } else {
              status = 'echo-reply'; responderNodeId = destinationNodeId;
              detail = `ICMPv6 Echo Request and Reply both passed IPv6 FIB + ND resolution. ${ndSummary(ndRequest.resolutions)} ${ndSummary(ndReply.resolutions)}${pmtu.cacheHit ? ` PMTU cache constrained ${requested} requested bytes to ${effectivePacketBytes}.` : ''}`;
            }
          }
        }
      }
    }
  }

  const responseLinks = reply ? linkPath(reply) : [];
  const m = metrics(profiles, requestLinks, responseLinks, status === 'echo-reply');
  const attempt: BuilderProbeAttempt = {
    index: 0, ttl: 64, status, responderNodeId,
    responderAddress: responderNodeId ? primaryBuilderIpv6Address(config.addressing, responderNodeId) : null,
    requestNodeIds: nodePath(request), requestLinkIds: requestLinks,
    responseNodeIds: reply ? nodePath(reply) : [], responseLinkIds: responseLinks,
    detail,
    packet: packetSeed(`probe6-${sequence}-echo`, 'ICMPV6 ECHO REQUEST', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, 64, effectivePacketBytes),
    ...m, dropLinkId, natDetail: null,
  };
  return {
    id: `probe6-${sequence}-ping`, sequence, kind: 'ping', plane: 'ROUTED IPV6', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress,
    success: status === 'echo-reply', attempts: [attempt],
    summary: status === 'echo-reply'
      ? `${labelFor(graph, destinationNodeId)} replied over IPv6 · ${effectivePacketBytes} bytes · simulated RTT ${m.simulatedRttMs} ms · path MTU ${m.pathMtuBytes}.`
      : status === 'timeout' ? 'IPv6 request/reply forwarding exists only partially; ND, reverse routing, or link behavior prevented a reply.'
      : `${labelFor(graph, responderNodeId ?? request.failureNodeId ?? sourceNodeId)} stopped the IPv6 Echo Request.`,
    snapshotNote: 'IPv6 probes consume independent IPv6 FIB, Neighbor Discovery, and PMTU session state. OSPFv3 contributes routes only when explicitly enabled.',
    natApplied: false, natTranslationId: null, natSessions,
    ipv6ControlState: control, requestedPacketBytes: requested, effectivePacketBytes,
  };
}

function traceroute(
  graph: BuilderGraph,
  config: BuilderIpv6Config,
  sourceNodeId: string,
  destinationNodeId: string,
  sequence: number,
  profiles: BuilderLinkProfiles,
  natSessions: BuilderNatSessionTable,
  currentControl: BuilderIpv6ControlState,
  requestedPacketBytes: number,
): BuilderIpv6ProbeResult {
  const forward = traceBuilderIpv6Forwarding(graph, config, sourceNodeId, destinationNodeId);
  const sourceAddress = forward.sourceAddress ?? primaryBuilderIpv6Address(config.addressing, sourceNodeId);
  const destinationAddress = forward.destinationAddress ?? primaryBuilderIpv6Address(config.addressing, destinationNodeId);
  const nodes = nodePath(forward);
  const links = linkPath(forward);
  const attempts: BuilderProbeAttempt[] = [];
  const requested = Math.max(80, Math.min(9216, Math.round(requestedPacketBytes)));
  let control = currentControl;

  if (!forward.reachable) {
    const m = metrics(profiles, links, [], false);
    attempts.push({ index: 0, ttl: 1, status: 'unreachable', responderNodeId: forward.failureNodeId, responderAddress: forward.failureNodeId ? primaryBuilderIpv6Address(config.addressing, forward.failureNodeId) : null, requestNodeIds: nodes, requestLinkIds: links, responseNodeIds: [], responseLinkIds: [], detail: forward.failureReason ?? 'IPv6 forwarding is unavailable.', packet: packetSeed(`probe6-${sequence}-ttl-1`, 'ICMPV6 TRACE HOP LIMIT 1', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, 1, requested), ...m, dropLinkId: null, natDetail: null });
    return { id: `probe6-${sequence}-traceroute`, sequence, kind: 'traceroute', plane: 'ROUTED IPV6', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, success: false, attempts, summary: 'IPv6 traceroute terminated before a complete forward route existed.', snapshotNote: 'Hop Limit expires only at routers. ND is resolved per attempted hop and every returning ICMPv6 message consumes its own IPv6 reverse path.', natApplied: false, natTranslationId: null, natSessions, ipv6ControlState: control, requestedPacketBytes: requested, effectivePacketBytes: requested };
  }

  const pmtu = checkBuilderIpv6Pmtu(graph, config, forward, profiles, requested, control, sequence);
  control = pmtu.state;
  const effectivePacketBytes = pmtu.effectivePacketBytes;
  if (pmtu.blocked && pmtu.event) {
    const ptb = packetTooBigAttempt(graph, config, sequence, sourceNodeId, destinationNodeId, forward, profiles, pmtu, control);
    return { id: `probe6-${sequence}-traceroute`, sequence, kind: 'traceroute', plane: 'ROUTED IPV6', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, success: false, attempts: [ptb.attempt], summary: ptb.attempt.status === 'packet-too-big' ? `Traceroute packet triggered ICMPv6 Packet Too Big · PMTU ${pmtu.event.mtuBytes}.` : 'Traceroute packet exceeded path MTU and the PTB error could not return.', snapshotNote: 'IPv6 routers do not fragment. A returning PTB terminates this oversized traceroute attempt and records session PMTU state.', natApplied: false, natTranslationId: null, natSessions, ipv6ControlState: ptb.state, requestedPacketBytes: requested, effectivePacketBytes };
  }

  let hopLimit = 1;
  for (let nodeIndex = 1; nodeIndex < nodes.length; nodeIndex += 1) {
    const nodeId = nodes[nodeIndex];
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.kind !== 'router') continue;
    const requestLinks = links.slice(0, nodeIndex);
    const packet = packetSeed(`probe6-${sequence}-hop-${hopLimit}`, `ICMPV6 TRACE HOP LIMIT ${hopLimit}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hopLimit, effectivePacketBytes);
    const ndRequest = resolveBuilderIpv6TraceNeighbors(graph, config, forward, control, sequence, nodeIndex);
    control = ndRequest.state;
    if (!ndRequest.success) {
      const m = metrics(profiles, requestLinks, [], false);
      attempts.push({ index: attempts.length, ttl: hopLimit, status: 'unreachable', responderNodeId: nodeId, responderAddress: inboundAddress(config, nodeId, links[nodeIndex - 1]), requestNodeIds: nodes.slice(0, nodeIndex + 1), requestLinkIds: requestLinks, responseNodeIds: [], responseLinkIds: [], detail: `Neighbor Discovery failed before Hop-Limit-${hopLimit}: ${ndRequest.failureReason}`, packet, ...m, dropLinkId: null, natDetail: null });
      break;
    }
    const requestDrop = deterministicBuilderPathDrop(profiles, requestLinks, `trace6:${sequence}:${hopLimit}:request:${effectivePacketBytes}`);
    if (requestDrop) {
      const m = metrics(profiles, requestLinks, [], false);
      attempts.push({ index: attempts.length, ttl: hopLimit, status: 'timeout', responderNodeId: null, responderAddress: null, requestNodeIds: nodes.slice(0, nodeIndex + 1), requestLinkIds: requestLinks, responseNodeIds: [], responseLinkIds: [], detail: `Hop-Limit-${hopLimit} probe was dropped on ${requestDrop}.`, packet, ...m, dropLinkId: requestDrop, natDetail: null });
      hopLimit += 1;
      continue;
    }

    const response = traceBuilderIpv6Forwarding(graph, config, nodeId, sourceNodeId);
    const ndResponse = response.reachable ? resolveBuilderIpv6TraceNeighbors(graph, config, response, control, sequence) : null;
    if (ndResponse) control = ndResponse.state;
    const responseLinks = linkPath(response);
    const responseDrop = response.reachable && ndResponse?.success ? deterministicBuilderPathDrop(profiles, responseLinks, `trace6:${sequence}:${hopLimit}:reply`) : null;
    const ok = Boolean(response.reachable && ndResponse?.success && !responseDrop);
    const m = metrics(profiles, requestLinks, responseLinks, ok);
    attempts.push({ index: attempts.length, ttl: hopLimit, status: ok ? 'time-exceeded' : 'timeout', responderNodeId: nodeId, responderAddress: inboundAddress(config, nodeId, links[nodeIndex - 1]), requestNodeIds: nodes.slice(0, nodeIndex + 1), requestLinkIds: requestLinks, responseNodeIds: response.reachable ? nodePath(response) : [], responseLinkIds: responseLinks, detail: ok ? `${labelFor(graph, nodeId)} decremented Hop Limit to zero; ICMPv6 Time Exceeded returned after ND resolution. ${ndSummary(ndRequest.resolutions)} ${ndSummary(ndResponse?.resolutions ?? [])}` : responseDrop ? `ICMPv6 Time Exceeded was dropped on ${responseDrop}.` : `${labelFor(graph, nodeId)} cannot return ICMPv6 Time Exceeded: ${ndResponse?.failureReason ?? response.failureReason ?? 'reverse IPv6 path unavailable'}.`, packet, ...m, dropLinkId: responseDrop, natDetail: null });
    hopLimit += 1;
  }

  const ndDestination = resolveBuilderIpv6TraceNeighbors(graph, config, forward, control, sequence);
  control = ndDestination.state;
  const reply = traceBuilderIpv6Forwarding(graph, config, destinationNodeId, sourceNodeId);
  const ndReply = reply.reachable ? resolveBuilderIpv6TraceNeighbors(graph, config, reply, control, sequence) : null;
  if (ndReply) control = ndReply.state;
  const responseLinks = linkPath(reply);
  const requestDrop = ndDestination.success ? deterministicBuilderPathDrop(profiles, links, `trace6:${sequence}:${hopLimit}:destination-request`) : null;
  const replyDrop = !requestDrop && reply.reachable && ndReply?.success ? deterministicBuilderPathDrop(profiles, responseLinks, `trace6:${sequence}:${hopLimit}:destination-reply`) : null;
  const success = Boolean(ndDestination.success && !requestDrop && reply.reachable && ndReply?.success && !replyDrop);
  const m = metrics(profiles, links, responseLinks, success);
  attempts.push({ index: attempts.length, ttl: hopLimit, status: success ? 'echo-reply' : 'timeout', responderNodeId: destinationNodeId, responderAddress: primaryBuilderIpv6Address(config.addressing, destinationNodeId), requestNodeIds: nodes, requestLinkIds: links, responseNodeIds: reply.reachable ? nodePath(reply) : [], responseLinkIds: responseLinks, detail: success ? `${labelFor(graph, destinationNodeId)} returned ICMPv6 Echo Reply; Hop Limit was sufficient and ND completed in both directions.${pmtu.cacheHit ? ` PMTU cache constrained ${requested} requested bytes to ${effectivePacketBytes}.` : ''}` : requestDrop ? `Final IPv6 Echo Request was dropped on ${requestDrop}.` : replyDrop ? `Final ICMPv6 Echo Reply was dropped on ${replyDrop}.` : `Destination probe could not complete ND/reverse forwarding: ${ndDestination.failureReason ?? ndReply?.failureReason ?? reply.failureReason ?? 'unknown IPv6 failure'}.`, packet: packetSeed(`probe6-${sequence}-hop-${hopLimit}`, `ICMPV6 TRACE HOP LIMIT ${hopLimit}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hopLimit, effectivePacketBytes), ...m, dropLinkId: requestDrop ?? replyDrop, natDetail: null });

  return { id: `probe6-${sequence}-traceroute`, sequence, kind: 'traceroute', plane: 'ROUTED IPV6', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, success, attempts, summary: success ? `ICMPv6 traceroute reached ${labelFor(graph, destinationNodeId)} after ${Math.max(0, attempts.length - 1)} routed hop${attempts.length - 1 === 1 ? '' : 's'} · ND/PMTU state active.` : 'IPv6 traceroute terminated without a returning destination Echo Reply.', snapshotNote: 'Hop Limit decrements only at routers. Each request/reply next hop uses Neighbor Discovery. PMTU state can constrain requested packet size. OSPFv3 routes are ordinary IPv6 FIB inputs at AD 110.', natApplied: false, natTranslationId: null, natSessions, ipv6ControlState: control, requestedPacketBytes: requested, effectivePacketBytes };
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
  controlState: BuilderIpv6ControlState = createBuilderIpv6ControlState(),
  requestedPacketBytes = DEFAULT_IPV6_PROBE_PACKET_BYTES,
): BuilderIpv6ProbeResult {
  return kind === 'ping'
    ? ping(graph, config, sourceNodeId, destinationNodeId, sequence, profiles, natSessions, controlState, requestedPacketBytes)
    : traceroute(graph, config, sourceNodeId, destinationNodeId, sequence, profiles, natSessions, controlState, requestedPacketBytes);
}

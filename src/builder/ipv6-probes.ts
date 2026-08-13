import type { BuilderGraph } from './model.ts';
import { builderPathCharacteristics, builderRoundTripCharacteristics, createDefaultBuilderLinkProfiles, deterministicBuilderPathDrop, type BuilderLinkProfiles } from './link-characteristics.ts';
import { primaryBuilderIpv6Address, traceBuilderIpv6Forwarding, type BuilderIpv6Config, type BuilderIpv6ForwardingTrace } from './ipv6.ts';
import { checkBuilderIpv6Pmtu, resolveBuilderIpv6TraceNeighbors, type BuilderIpv6ControlState } from './ipv6-control-plane.ts';
import { getBuilderIpv6ProbePacketBytes, getBuilderIpv6SessionState, setBuilderIpv6SessionState } from './ipv6-session.ts';
import type { BuilderNatSessionTable } from './nat.ts';
import type { BuilderProbeAttempt, BuilderProbePacketSeed, BuilderProbeResult, BuilderProbeStatus } from './probes.ts';

export interface BuilderIpv6ProbeResult extends BuilderProbeResult {
  ipv6ControlState: BuilderIpv6ControlState;
  requestedPacketBytes: number;
  effectivePacketBytes: number;
}

function labelFor(graph: BuilderGraph, nodeId: string): string {
  return graph.nodes.find((node) => node.id === nodeId)?.label ?? nodeId.toUpperCase();
}

function nodePath(trace: BuilderIpv6ForwardingTrace): string[] {
  return [trace.sourceNodeId, ...trace.hops.map((hop) => hop.nextNodeId).filter((id): id is string => Boolean(id))]
    .filter((id, index, all) => index === 0 || id !== all[index - 1]);
}

function linkPath(trace: BuilderIpv6ForwardingTrace): string[] {
  return trace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []);
}

function inboundAddress(config: BuilderIpv6Config, nodeId: string, linkId?: string): string | null {
  return linkId
    ? config.addressing.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nodeId)?.globalAddress ?? primaryBuilderIpv6Address(config.addressing, nodeId)
    : primaryBuilderIpv6Address(config.addressing, nodeId);
}

function stableMac(nodeId: string, salt = ''): string {
  const text = `${nodeId}:${salt}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return [0x02, 0x48, 0x4f, (hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff]
    .map((byte) => byte.toString(16).padStart(2, '0')).join(':');
}

function packetSeed(id: string, label: string, sourceNodeId: string, destinationNodeId: string, sourceAddress: string | null, destinationAddress: string | null, hopLimit: number): BuilderProbePacketSeed | null {
  if (!sourceAddress || !destinationAddress) return null;
  return { id, label, family: 'ipv6', sourceAddress, destinationAddress, sourceMac: stableMac(sourceNodeId, 'probe6'), destinationMac: stableMac(destinationNodeId, 'probe6'), ttl: hopLimit };
}

function metrics(profiles: BuilderLinkProfiles, requestLinkIds: string[], responseLinkIds: string[], hasResponse: boolean) {
  const path = builderPathCharacteristics(profiles, [...requestLinkIds, ...responseLinkIds]);
  const round = builderRoundTripCharacteristics(profiles, requestLinkIds, responseLinkIds);
  return {
    simulatedRttMs: hasResponse ? Number(round.rttMs.toFixed(2)) : null,
    jitterMs: Number(path.jitterMs.toFixed(2)),
    bottleneckMbps: path.bottleneckMbps,
    pathMtuBytes: path.pathMtuBytes,
    pathLossPercent: Number(path.lossPercent.toFixed(4)),
  };
}

function ndSummary(resolutions: ReturnType<typeof resolveBuilderIpv6TraceNeighbors>['resolutions']): string {
  if (resolutions.length === 0) return 'ND: no next-hop resolution required.';
  const misses = resolutions.filter((entry) => !entry.cacheHit).length;
  const hits = resolutions.length - misses;
  return misses === 0
    ? `ND: ${hits} cache hit${hits === 1 ? '' : 's'}.`
    : `ND: ${misses} NS/NA exchange${misses === 1 ? '' : 's'}${hits ? ` + ${hits} cache hit${hits === 1 ? '' : 's'}` : ''}.`;
}

function finish(result: BuilderIpv6ProbeResult): BuilderIpv6ProbeResult {
  setBuilderIpv6SessionState(result.ipv6ControlState);
  return result;
}

function ptbResult(graph: BuilderGraph, config: BuilderIpv6Config, kind: 'ping' | 'traceroute', sourceNodeId: string, destinationNodeId: string, sequence: number, forward: BuilderIpv6ForwardingTrace, profiles: BuilderLinkProfiles, natSessions: BuilderNatSessionTable, requestedBytes: number, effectivePacketBytes: number, control: BuilderIpv6ControlState, event: NonNullable<ReturnType<typeof checkBuilderIpv6Pmtu>['event']>): BuilderIpv6ProbeResult {
  let nextControl = control;
  if (event.reverseTrace?.reachable) nextControl = resolveBuilderIpv6TraceNeighbors(graph, config, event.reverseTrace, nextControl, sequence).state;
  const constrainedIndex = forward.hops.findIndex((hop) => hop.linkId === event.linkId);
  const requestLinks = linkPath(forward).slice(0, Math.max(1, constrainedIndex + 1));
  const responseLinks = event.reverseTrace?.reachable ? linkPath(event.reverseTrace) : [];
  const sourceAddress = forward.sourceAddress ?? primaryBuilderIpv6Address(config.addressing, sourceNodeId);
  const destinationAddress = forward.destinationAddress ?? primaryBuilderIpv6Address(config.addressing, destinationNodeId);
  const responseOk = event.delivered;
  const m = metrics(profiles, requestLinks, responseLinks, responseOk);
  const attempt: BuilderProbeAttempt = {
    index: 0,
    ttl: 64,
    status: responseOk ? 'unreachable' : 'timeout',
    responderNodeId: event.responderNodeId,
    responderAddress: inboundAddress(config, event.responderNodeId, event.linkId),
    requestNodeIds: nodePath(forward),
    requestLinkIds: requestLinks,
    responseNodeIds: event.reverseTrace?.reachable ? nodePath(event.reverseTrace) : [],
    responseLinkIds: responseLinks,
    detail: event.detail,
    packet: packetSeed(`probe6-${sequence}-pmtu`, `ICMPV6 PMTU TRIGGER · ${requestedBytes} BYTES`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, 64),
    ...m,
    dropLinkId: null,
    natDetail: null,
  };
  return finish({
    id: `probe6-${sequence}-${kind}`,
    sequence,
    kind,
    plane: 'ROUTED IPV6',
    sourceNodeId,
    destinationNodeId,
    sourceAddress,
    destinationAddress,
    success: false,
    attempts: [attempt],
    summary: responseOk
      ? `ICMPv6 PACKET TOO BIG · ${labelFor(graph, event.responderNodeId)} reported MTU ${event.mtuBytes}. PMTU cached; rerun to send ${event.mtuBytes} bytes.`
      : `IPv6 packet exceeded MTU ${event.mtuBytes}, but Packet Too Big had no usable reverse IPv6 path.`,
    snapshotNote: 'IPv6 routers do not fragment transit packets. Packet Too Big is generated at the constraining hop and updates session-only PMTU state only when the error can return.',
    natApplied: false,
    natTranslationId: null,
    natSessions,
    ipv6ControlState: nextControl,
    requestedPacketBytes: requestedBytes,
    effectivePacketBytes,
  });
}

function runPing(graph: BuilderGraph, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string, sequence: number, profiles: BuilderLinkProfiles, natSessions: BuilderNatSessionTable, currentControl: BuilderIpv6ControlState, requestedPacketBytes: number): BuilderIpv6ProbeResult {
  const request = traceBuilderIpv6Forwarding(graph, config, sourceNodeId, destinationNodeId);
  const sourceAddress = request.sourceAddress ?? primaryBuilderIpv6Address(config.addressing, sourceNodeId);
  const destinationAddress = request.destinationAddress ?? primaryBuilderIpv6Address(config.addressing, destinationNodeId);
  const requestLinks = linkPath(request);
  const requested = Math.max(80, Math.min(9216, Math.round(requestedPacketBytes)));
  let control = currentControl;
  let reply: BuilderIpv6ForwardingTrace | null = null;
  let status: BuilderProbeStatus = 'unreachable';
  let responderNodeId: string | null = null;
  let detail = '';
  let dropLinkId: string | null = null;
  let effectivePacketBytes = requested;

  if (!request.reachable) {
    responderNodeId = request.failureNodeId;
    detail = request.failureReason ?? 'IPv6 Echo Request could not be delivered.';
  } else {
    const ndRequest = resolveBuilderIpv6TraceNeighbors(graph, config, request, control, sequence);
    control = ndRequest.state;
    if (!ndRequest.success) {
      responderNodeId = request.failureNodeId ?? sourceNodeId;
      detail = `Neighbor Discovery failed: ${ndRequest.failureReason}`;
    } else {
      const pmtu = checkBuilderIpv6Pmtu(graph, config, request, profiles, requested, control, sequence);
      control = pmtu.state;
      effectivePacketBytes = pmtu.effectivePacketBytes;
      if (pmtu.blocked && pmtu.event) return ptbResult(graph, config, 'ping', sourceNodeId, destinationNodeId, sequence, request, profiles, natSessions, requested, effectivePacketBytes, control, pmtu.event);
      if ((dropLinkId = deterministicBuilderPathDrop(profiles, requestLinks, `ping6:${sequence}:request:${effectivePacketBytes}`))) {
        status = 'timeout';
        detail = `ICMPv6 Echo Request was deterministically dropped on ${dropLinkId}. ${ndSummary(ndRequest.resolutions)}`;
      } else {
        reply = traceBuilderIpv6Forwarding(graph, config, destinationNodeId, sourceNodeId);
        if (!reply.reachable) {
          status = 'timeout'; responderNodeId = destinationNodeId;
          detail = `Echo Request reached ${labelFor(graph, destinationNodeId)}, but the Echo Reply cannot return: ${reply.failureReason ?? 'reverse IPv6 route unavailable'}.`;
        } else {
          const ndReply = resolveBuilderIpv6TraceNeighbors(graph, config, reply, control, sequence);
          control = ndReply.state;
          const responseLinks = linkPath(reply);
          const replyDrop = ndReply.success ? deterministicBuilderPathDrop(profiles, responseLinks, `ping6:${sequence}:reply:${effectivePacketBytes}`) : null;
          if (!ndReply.success) {
            status = 'timeout'; responderNodeId = destinationNodeId; detail = `Echo Request arrived, but reverse Neighbor Discovery failed: ${ndReply.failureReason}`;
          } else if (replyDrop) {
            status = 'timeout'; responderNodeId = destinationNodeId; dropLinkId = replyDrop; detail = `ICMPv6 Echo Reply was deterministically dropped on ${replyDrop}.`;
          } else {
            status = 'echo-reply'; responderNodeId = destinationNodeId;
            detail = `ICMPv6 Echo Request and Reply passed IPv6 FIB + ND. ${ndSummary(ndRequest.resolutions)} ${ndSummary(ndReply.resolutions)}${pmtu.cacheHit ? ` PMTU cache constrained ${requested} requested bytes to ${effectivePacketBytes}.` : ''}`;
          }
        }
      }
    }
  }

  const responseLinks = reply ? linkPath(reply) : [];
  const m = metrics(profiles, requestLinks, responseLinks, status === 'echo-reply');
  return finish({
    id: `probe6-${sequence}-ping`, sequence, kind: 'ping', plane: 'ROUTED IPV6', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress,
    success: status === 'echo-reply',
    attempts: [{ index: 0, ttl: 64, status, responderNodeId, responderAddress: responderNodeId ? primaryBuilderIpv6Address(config.addressing, responderNodeId) : null, requestNodeIds: nodePath(request), requestLinkIds: requestLinks, responseNodeIds: reply ? nodePath(reply) : [], responseLinkIds: responseLinks, detail, packet: packetSeed(`probe6-${sequence}-echo`, 'ICMPV6 ECHO REQUEST', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, 64), ...m, dropLinkId, natDetail: null }],
    summary: status === 'echo-reply' ? `${labelFor(graph, destinationNodeId)} replied over IPv6 · ${effectivePacketBytes} bytes · simulated RTT ${m.simulatedRttMs} ms · path MTU ${m.pathMtuBytes}.` : status === 'timeout' ? 'IPv6 request/reply state is only partially usable; ND, reverse routing, or link behavior prevented a reply.' : `${labelFor(graph, responderNodeId ?? request.failureNodeId ?? sourceNodeId)} stopped the IPv6 Echo Request.`,
    snapshotNote: 'IPv6 probes consume the independent IPv6 FIB plus session Neighbor Discovery and PMTU state. OSPFv3 contributes O6 routes only when explicitly enabled.',
    natApplied: false, natTranslationId: null, natSessions, ipv6ControlState: control, requestedPacketBytes: requested, effectivePacketBytes,
  });
}

function runTraceroute(graph: BuilderGraph, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string, sequence: number, profiles: BuilderLinkProfiles, natSessions: BuilderNatSessionTable, currentControl: BuilderIpv6ControlState, requestedPacketBytes: number): BuilderIpv6ProbeResult {
  const forward = traceBuilderIpv6Forwarding(graph, config, sourceNodeId, destinationNodeId);
  const sourceAddress = forward.sourceAddress ?? primaryBuilderIpv6Address(config.addressing, sourceNodeId);
  const destinationAddress = forward.destinationAddress ?? primaryBuilderIpv6Address(config.addressing, destinationNodeId);
  const nodes = nodePath(forward);
  const links = linkPath(forward);
  const requested = Math.max(80, Math.min(9216, Math.round(requestedPacketBytes)));
  const attempts: BuilderProbeAttempt[] = [];
  let control = currentControl;

  if (!forward.reachable) {
    const m = metrics(profiles, links, [], false);
    return finish({ id: `probe6-${sequence}-traceroute`, sequence, kind: 'traceroute', plane: 'ROUTED IPV6', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, success: false, attempts: [{ index: 0, ttl: 1, status: 'unreachable', responderNodeId: forward.failureNodeId, responderAddress: forward.failureNodeId ? primaryBuilderIpv6Address(config.addressing, forward.failureNodeId) : null, requestNodeIds: nodes, requestLinkIds: links, responseNodeIds: [], responseLinkIds: [], detail: forward.failureReason ?? 'IPv6 forwarding is unavailable.', packet: packetSeed(`probe6-${sequence}-hop-1`, 'ICMPV6 TRACE HOP LIMIT 1', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, 1), ...m, dropLinkId: null, natDetail: null }], summary: 'IPv6 traceroute terminated before a complete forward route existed.', snapshotNote: 'Hop Limit expires only at routers. ND and each returning ICMPv6 message use independent next-hop resolution.', natApplied: false, natTranslationId: null, natSessions, ipv6ControlState: control, requestedPacketBytes: requested, effectivePacketBytes: requested });
  }

  const pmtu = checkBuilderIpv6Pmtu(graph, config, forward, profiles, requested, control, sequence);
  control = pmtu.state;
  const effectivePacketBytes = pmtu.effectivePacketBytes;
  if (pmtu.blocked && pmtu.event) return ptbResult(graph, config, 'traceroute', sourceNodeId, destinationNodeId, sequence, forward, profiles, natSessions, requested, effectivePacketBytes, control, pmtu.event);

  let hopLimit = 1;
  for (let nodeIndex = 1; nodeIndex < nodes.length; nodeIndex += 1) {
    const nodeId = nodes[nodeIndex];
    if (graph.nodes.find((node) => node.id === nodeId)?.kind !== 'router') continue;
    const requestLinks = links.slice(0, nodeIndex);
    const ndRequest = resolveBuilderIpv6TraceNeighbors(graph, config, forward, control, sequence, nodeIndex);
    control = ndRequest.state;
    const requestDrop = ndRequest.success ? deterministicBuilderPathDrop(profiles, requestLinks, `trace6:${sequence}:${hopLimit}:request`) : null;
    const response = traceBuilderIpv6Forwarding(graph, config, nodeId, sourceNodeId);
    const ndResponse = !requestDrop && response.reachable ? resolveBuilderIpv6TraceNeighbors(graph, config, response, control, sequence) : null;
    if (ndResponse) control = ndResponse.state;
    const responseLinks = response.reachable ? linkPath(response) : [];
    const responseDrop = ndResponse?.success ? deterministicBuilderPathDrop(profiles, responseLinks, `trace6:${sequence}:${hopLimit}:reply`) : null;
    const ok = Boolean(ndRequest.success && !requestDrop && response.reachable && ndResponse?.success && !responseDrop);
    const m = metrics(profiles, requestLinks, responseLinks, ok);
    attempts.push({ index: attempts.length, ttl: hopLimit, status: ok ? 'time-exceeded' : 'timeout', responderNodeId: ok ? nodeId : null, responderAddress: ok ? inboundAddress(config, nodeId, links[nodeIndex - 1]) : null, requestNodeIds: nodes.slice(0, nodeIndex + 1), requestLinkIds: requestLinks, responseNodeIds: response.reachable ? nodePath(response) : [], responseLinkIds: responseLinks, detail: ok ? `${labelFor(graph, nodeId)} decremented Hop Limit to zero; ICMPv6 Time Exceeded returned. ${ndSummary(ndRequest.resolutions)} ${ndSummary(ndResponse?.resolutions ?? [])}` : requestDrop ? `Hop-Limit-${hopLimit} request was dropped on ${requestDrop}.` : responseDrop ? `ICMPv6 Time Exceeded was dropped on ${responseDrop}.` : `Hop-Limit-${hopLimit} could not complete ND/reverse IPv6 forwarding.`, packet: packetSeed(`probe6-${sequence}-hop-${hopLimit}`, `ICMPV6 TRACE HOP LIMIT ${hopLimit}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hopLimit), ...m, dropLinkId: requestDrop ?? responseDrop, natDetail: null });
    hopLimit += 1;
  }

  const ndDestination = resolveBuilderIpv6TraceNeighbors(graph, config, forward, control, sequence);
  control = ndDestination.state;
  const reply = traceBuilderIpv6Forwarding(graph, config, destinationNodeId, sourceNodeId);
  const ndReply = reply.reachable ? resolveBuilderIpv6TraceNeighbors(graph, config, reply, control, sequence) : null;
  if (ndReply) control = ndReply.state;
  const responseLinks = reply.reachable ? linkPath(reply) : [];
  const requestDrop = ndDestination.success ? deterministicBuilderPathDrop(profiles, links, `trace6:${sequence}:${hopLimit}:destination-request`) : null;
  const replyDrop = !requestDrop && ndReply?.success ? deterministicBuilderPathDrop(profiles, responseLinks, `trace6:${sequence}:${hopLimit}:destination-reply`) : null;
  const success = Boolean(ndDestination.success && !requestDrop && reply.reachable && ndReply?.success && !replyDrop);
  const m = metrics(profiles, links, responseLinks, success);
  attempts.push({ index: attempts.length, ttl: hopLimit, status: success ? 'echo-reply' : 'timeout', responderNodeId: destinationNodeId, responderAddress: primaryBuilderIpv6Address(config.addressing, destinationNodeId), requestNodeIds: nodes, requestLinkIds: links, responseNodeIds: reply.reachable ? nodePath(reply) : [], responseLinkIds: responseLinks, detail: success ? `${labelFor(graph, destinationNodeId)} returned ICMPv6 Echo Reply. ${ndSummary(ndDestination.resolutions)} ${ndSummary(ndReply?.resolutions ?? [])}${pmtu.cacheHit ? ` PMTU cache constrained ${requested} requested bytes to ${effectivePacketBytes}.` : ''}` : requestDrop ? `Final IPv6 Echo Request was dropped on ${requestDrop}.` : replyDrop ? `Final Echo Reply was dropped on ${replyDrop}.` : 'Destination probe could not complete ND/reverse IPv6 forwarding.', packet: packetSeed(`probe6-${sequence}-hop-${hopLimit}`, `ICMPV6 TRACE HOP LIMIT ${hopLimit}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hopLimit), ...m, dropLinkId: requestDrop ?? replyDrop, natDetail: null });

  return finish({ id: `probe6-${sequence}-traceroute`, sequence, kind: 'traceroute', plane: 'ROUTED IPV6', sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, success, attempts, summary: success ? `ICMPv6 traceroute reached ${labelFor(graph, destinationNodeId)} after ${Math.max(0, attempts.length - 1)} routed hop${attempts.length - 1 === 1 ? '' : 's'} · ND/PMTU state active.` : 'IPv6 traceroute terminated without a returning destination Echo Reply.', snapshotNote: 'Hop Limit decrements only at routers. Each request/reply next hop uses Neighbor Discovery; cached PMTU can constrain the probe size. OSPFv3 routes are ordinary IPv6 FIB inputs at AD 110.', natApplied: false, natTranslationId: null, natSessions, ipv6ControlState: control, requestedPacketBytes: requested, effectivePacketBytes });
}

export function runBuilderIpv6Probe(graph: BuilderGraph, config: BuilderIpv6Config, kind: 'ping' | 'traceroute', sourceNodeId: string, destinationNodeId: string, sequence = 1, profiles: BuilderLinkProfiles = createDefaultBuilderLinkProfiles(graph), natSessions: BuilderNatSessionTable = [], controlState: BuilderIpv6ControlState = getBuilderIpv6SessionState(), requestedPacketBytes = getBuilderIpv6ProbePacketBytes()): BuilderIpv6ProbeResult {
  return kind === 'ping'
    ? runPing(graph, config, sourceNodeId, destinationNodeId, sequence, profiles, natSessions, controlState, requestedPacketBytes)
    : runTraceroute(graph, config, sourceNodeId, destinationNodeId, sequence, profiles, natSessions, controlState, requestedPacketBytes);
}

import { builderBgpState } from './bgp.ts';
import { pruneBuilderDhcpLeases, releaseBuilderDhcpLease, renewBuilderDhcpLease, runBuilderDhcpAcquire, type BuilderDhcpTransaction } from './dhcp.ts';
import { builderStpState } from './stp.ts';
import { createBuilderOspfLinkFailureScenario, type BuilderOspfConvergenceEventKind } from './ospf-timing.ts';
import { builderOspfState, routeTableForBuilderRouter } from './routing.ts';
import type { BuilderTimelineState } from './timeline.ts';
import type {
  BuilderDeviceRef,
  BuilderWorkbenchEvent,
  BuilderWorkbenchEventCategory,
  BuilderWorkbenchEventKind,
  BuilderWorkbenchEventProjection,
  BuilderWorkbenchEventSpec,
} from './device-workbench.ts';

function stable(value: unknown): string {
  return JSON.stringify(value);
}

function labelForRouted(state: BuilderTimelineState, id: string): string {
  return state.graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase();
}

function labelForEthernet(state: BuilderTimelineState, id: string): string {
  return state.ethernet.devices.find((device) => device.id === id)?.label ?? id.toUpperCase();
}

function routedRefs(...ids: Array<string | null | undefined>): BuilderDeviceRef[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))].map((id) => ({ plane: 'routed' as const, id }));
}

function ethernetRefs(...ids: Array<string | null | undefined>): BuilderDeviceRef[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))].map((id) => ({ plane: 'ethernet' as const, id }));
}

function spec(
  key: string,
  kind: BuilderWorkbenchEventKind,
  category: BuilderWorkbenchEventCategory,
  summary: string,
  detail: string,
  offsetMs: number,
  deviceRefs: BuilderDeviceRef[] = [],
  objectIds: string[] = [],
  causeKey?: string | null,
  projection?: BuilderWorkbenchEventProjection,
): BuilderWorkbenchEventSpec {
  return { key, kind, category, summary, detail, offsetMs, deviceRefs, objectIds, causeKey, projection };
}

function ospfEventKind(kind: BuilderOspfConvergenceEventKind): BuilderWorkbenchEventKind {
  if (kind === 'LINK_DOWN') return 'physical';
  if (kind === 'RIB_UPDATED') return 'rib';
  if (kind === 'FIB_UPDATED') return 'fib';
  if (kind === 'TRAFFIC_RECOVERED') return 'flow';
  return 'control-plane';
}

function ospfProjection(kind: BuilderOspfConvergenceEventKind): BuilderWorkbenchEventProjection | undefined {
  if (kind === 'LINK_DOWN') return { physical: 'after' };
  if (kind === 'DEAD_TIMER_EXPIRED') return { control: 'after' };
  if (kind === 'RIB_UPDATED') return { rib: 'after' };
  if (kind === 'FIB_UPDATED') return { fib: 'after' };
  return undefined;
}

function activeRouteFingerprint(state: BuilderTimelineState, routerId: string): string {
  try {
    const entries = routeTableForBuilderRouter(state.graph, state.addressing, state.routing, routerId)
      .filter((entry) => entry.active)
      .map((entry) => [
        entry.prefix,
        entry.source,
        entry.administrativeDistance,
        entry.metric,
        entry.nextHop,
        entry.outgoingInterface,
        entry.linkId,
      ])
      .sort((a, b) => stable(a).localeCompare(stable(b)));
    return stable(entries);
  } catch {
    return '[]';
  }
}

function activeRouteSummary(state: BuilderTimelineState, routerId: string): string {
  try {
    const entries = routeTableForBuilderRouter(state.graph, state.addressing, state.routing, routerId)
      .filter((entry) => entry.active)
      .map((entry) => entry.prefix + ' ' + entry.source.toUpperCase() + ' via ' + (entry.nextHop ?? 'CONNECTED') + ' @ ' + entry.linkId)
      .sort();
    return entries.length === 0 ? 'No active routes.' : entries.join(' | ');
  } catch {
    return 'No active routes.';
  }
}

function bgpFingerprint(state: BuilderTimelineState): string {
  try {
    const bgp = builderBgpState(state.graph, state.addressing, state.routing.bgp);
    return stable({
      sessions: bgp.sessions.map((entry) => [entry.id, entry.state, entry.reason]),
      bestRoutes: bgp.bestRoutes.map((entry) => [
        entry.routerId,
        entry.prefix,
        entry.learnedFromRouterId,
        entry.asPath,
        entry.localPref,
        entry.med,
        entry.nextHopAddress,
        entry.communities,
        entry.policyAnomaly,
      ]),
      leakedRouteIds: bgp.leakedRouteIds,
      multiOriginPrefixes: bgp.multiOriginPrefixes,
    });
  } catch {
    return 'unavailable';
  }
}

function bgpDetail(state: BuilderTimelineState): string {
  try {
    const bgp = builderBgpState(state.graph, state.addressing, state.routing.bgp);
    const established = bgp.sessions.filter((entry) => entry.state === 'ESTABLISHED').length;
    return established + '/' + bgp.sessions.length + ' sessions ESTABLISHED · ' + bgp.bestRoutes.length + ' BEST routes · ' + bgp.leakedRouteIds.length + ' policy anomalies.';
  } catch {
    return 'BGP state is unavailable for this transition.';
  }
}

function mapById<T extends { id: string }>(values: readonly T[]): Map<string, T> {
  return new Map(values.map((value) => [value.id, value]));
}

function newById<T extends { id: string }>(before: readonly T[], after: readonly T[]): T[] {
  const ids = new Set(before.map((entry) => entry.id));
  return after.filter((entry) => !ids.has(entry.id));
}

function changedById<T extends { id: string }>(before: readonly T[], after: readonly T[]): T[] {
  const prior = mapById(before);
  return after.filter((entry) => prior.has(entry.id) && stable(prior.get(entry.id)) !== stable(entry));
}

function deriveTopologyEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[], handledFailureLinks: Set<string>): void {
  const beforeNodes = new Map(before.graph.nodes.map((node) => [node.id, node]));
  const afterNodes = new Map(after.graph.nodes.map((node) => [node.id, node]));
  for (const id of [...new Set([...beforeNodes.keys(), ...afterNodes.keys()])].sort()) {
    const prior = beforeNodes.get(id);
    const next = afterNodes.get(id);
    if (!prior && next) output.push(spec('topology:node:add:' + id, 'physical', 'topology', 'NODE ADDED · ' + next.label, 'The canonical routed graph gained ' + next.label + ' (' + next.kind + ').', 1, routedRefs(id), [id]));
    else if (prior && !next) output.push(spec('topology:node:delete:' + id, 'physical', 'topology', 'NODE REMOVED · ' + prior.label, 'The canonical routed graph removed ' + prior.label + ' and its incident links.', 1, routedRefs(id), [id]));
  }

  const beforeLinks = new Map(before.graph.links.map((link) => [link.id, link]));
  const afterLinks = new Map(after.graph.links.map((link) => [link.id, link]));
  for (const id of [...new Set([...beforeLinks.keys(), ...afterLinks.keys()])].sort()) {
    if (handledFailureLinks.has(id)) continue;
    const prior = beforeLinks.get(id);
    const next = afterLinks.get(id);
    if (!prior && next) {
      output.push(spec('topology:link:add:' + id, 'physical', 'topology', 'LINK ADDED · ' + id.toUpperCase(), labelForRouted(after, next.a) + ' ↔ ' + labelForRouted(after, next.b) + ' joined the canonical graph at cost ' + next.cost + '.', 2, routedRefs(next.a, next.b), [id]));
      continue;
    }
    if (prior && !next) {
      output.push(spec('topology:link:delete:' + id, 'physical', 'topology', 'LINK REMOVED · ' + id.toUpperCase(), labelForRouted(before, prior.a) + ' ↔ ' + labelForRouted(before, prior.b) + ' left the canonical graph.', 2, routedRefs(prior.a, prior.b), [id]));
      continue;
    }
    if (!prior || !next) continue;
    if (prior.failed !== next.failed) {
      output.push(spec(
        'topology:link:state:' + id,
        'physical',
        'topology',
        'LINK ' + (next.failed ? 'DOWN' : 'UP') + ' · ' + id.toUpperCase(),
        labelForRouted(after, next.a) + ' ↔ ' + labelForRouted(after, next.b) + ' physical carrier is now ' + (next.failed ? 'DOWN' : 'UP') + '.',
        2,
        routedRefs(next.a, next.b),
        [id],
      ));
    }
    if (prior.cost !== next.cost) {
      output.push(spec('topology:link:cost:' + id, 'physical', 'topology', 'LINK COST · ' + id.toUpperCase(), 'Routing cost changed from ' + prior.cost + ' to ' + next.cost + '; physical latency remains independent.', 3, routedRefs(next.a, next.b), [id]));
    }
  }
}

function deriveOspfEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): Set<string> {
  const handledFailureLinks = new Set<string>();
  const beforeLinks = new Map(before.graph.links.map((link) => [link.id, link]));
  for (const next of after.graph.links) {
    const prior = beforeLinks.get(next.id);
    if (!prior || prior.failed || !next.failed) continue;
    const aRouter = before.graph.nodes.find((node) => node.id === prior.a)?.kind === 'router';
    const bRouter = before.graph.nodes.find((node) => node.id === prior.b)?.kind === 'router';
    const enabled = new Set(before.routing.ospf.enabledRouterIds);
    if (!aRouter || !bRouter || !enabled.has(prior.a) || !enabled.has(prior.b)) continue;
    try {
      const scenario = createBuilderOspfLinkFailureScenario(before.graph, before.addressing, before.routing, before.sourceId, before.destinationId, prior.id);
      let previousKey: string | null = null;
      for (const event of scenario.events) {
        const key = 'ospf:' + prior.id + ':' + event.id;
        output.push(spec(
          key,
          ospfEventKind(event.kind),
          event.kind === 'LINK_DOWN' ? 'topology' : 'routing',
          'OSPF · ' + event.kind.replaceAll('_', ' '),
          event.summary,
          event.atMs,
          routedRefs(prior.a, prior.b, before.sourceId, before.destinationId),
          [prior.id, event.kind],
          previousKey,
          ospfProjection(event.kind),
        ));
        previousKey = key;
      }
      handledFailureLinks.add(prior.id);
    } catch {
      // Not every failed routed link participates in the timed OSPF teaching model.
    }
  }

  let beforeOspf;
  let afterOspf;
  try {
    beforeOspf = builderOspfState(before.graph, before.addressing, before.routing);
    afterOspf = builderOspfState(after.graph, after.addressing, after.routing);
  } catch {
    return handledFailureLinks;
  }
  const priorAdjacencies = mapById(beforeOspf.adjacencies);
  for (const adjacency of afterOspf.adjacencies) {
    if (handledFailureLinks.has(adjacency.linkId)) continue;
    const prior = priorAdjacencies.get(adjacency.id);
    if (!prior || stable([prior.state, prior.cost, prior.areaId, prior.reason]) !== stable([adjacency.state, adjacency.cost, adjacency.areaId, adjacency.reason])) {
      output.push(spec(
        'ospf:adjacency:' + adjacency.id,
        'control-plane',
        'routing',
        'OSPF ADJACENCY · ' + adjacency.state,
        labelForRouted(after, adjacency.aRouterId) + ' ↔ ' + labelForRouted(after, adjacency.bRouterId) + ' · area ' + adjacency.areaId + ' · cost ' + adjacency.cost + ' · ' + adjacency.reason,
        12,
        routedRefs(adjacency.aRouterId, adjacency.bRouterId),
        [adjacency.id, adjacency.linkId],
      ));
    }
  }
  for (const adjacency of beforeOspf.adjacencies) {
    if (handledFailureLinks.has(adjacency.linkId) || afterOspf.adjacencies.some((entry) => entry.id === adjacency.id)) continue;
    output.push(spec('ospf:adjacency:removed:' + adjacency.id, 'control-plane', 'routing', 'OSPF ADJACENCY REMOVED', adjacency.id + ' is no longer part of the canonical OSPF topology.', 12, routedRefs(adjacency.aRouterId, adjacency.bRouterId), [adjacency.id, adjacency.linkId]));
  }
  return handledFailureLinks;
}

function deriveRouteEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[], skipForTimedOspf: boolean): void {
  if (skipForTimedOspf) return;
  const routerIds = [...new Set([
    ...before.graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id),
    ...after.graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id),
  ])].sort();
  let offset = 30;
  for (const routerId of routerIds) {
    const prior = activeRouteFingerprint(before, routerId);
    const next = activeRouteFingerprint(after, routerId);
    if (prior === next) continue;
    const label = after.graph.nodes.some((node) => node.id === routerId) ? labelForRouted(after, routerId) : labelForRouted(before, routerId);
    output.push(spec('rib:' + routerId, 'rib', 'routing', 'RIB UPDATED · ' + label, 'Active route selection changed. ' + activeRouteSummary(after, routerId), offset, routedRefs(routerId), [routerId]));
    output.push(spec('fib:' + routerId, 'fib', 'routing', 'FIB PROGRAMMED · ' + label, 'Forwarding now consumes the active route set selected for ' + label + '.', offset + 1, routedRefs(routerId), [routerId], 'rib:' + routerId));
    offset += 2;
  }
}

function deriveBgpEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {
  const prior = bgpFingerprint(before);
  const next = bgpFingerprint(after);
  if (prior === next) return;
  const refs = routedRefs(...after.routing.bgp.enabledRouterIds, ...before.routing.bgp.enabledRouterIds);
  output.push(spec('bgp:control-plane', 'control-plane', 'routing', 'BGP CONTROL PLANE CHANGED', bgpDetail(after), 24, refs, after.routing.bgp.sessions.map((entry) => entry.id)));
}

function mergeProjection(output: BuilderWorkbenchEventSpec[], startIndex: number, projection: BuilderWorkbenchEventProjection): void {
  const last=output.length>startIndex?output.length-1:-1;
  if(last<0)return;
  output[last]={...output[last],projection:{...(output[last].projection??{}),...projection}};
}

function deriveArpEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {
  const startIndex=output.length;
  const key = (entry: { ownerDeviceId: string; vlanId: number; address: string }) => entry.ownerDeviceId + ':' + entry.vlanId + ':' + entry.address;
  const prior = new Map(before.arpCache.map((entry) => [key(entry), entry]));
  const next = new Map(after.arpCache.map((entry) => [key(entry), entry]));
  let offset = 60;
  for (const [id, entry] of next) {
    const old = prior.get(id);
    if (!old || stable(old) !== stable(entry)) {
      output.push(spec('arp:' + id, 'resolution', 'neighbor', 'ARP LEARNED · ' + entry.address, labelForEthernet(after, entry.ownerDeviceId) + ' maps ' + entry.address + ' to ' + entry.mac + ' in VLAN ' + entry.vlanId + '.', offset++, ethernetRefs(entry.ownerDeviceId, entry.learnedFromDeviceId), [entry.address, entry.mac]));
    }
  }
  for (const [id, entry] of prior) {
    if (next.has(id)) continue;
    output.push(spec('arp:removed:' + id, 'resolution', 'neighbor', 'ARP ENTRY REMOVED · ' + entry.address, labelForEthernet(before, entry.ownerDeviceId) + ' no longer retains the mapping for ' + entry.address + '.', offset++, ethernetRefs(entry.ownerDeviceId), [entry.address]));
  }
  mergeProjection(output,startIndex,{arpCache:'after'});
}

function deriveEthernetEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {
  const startIndex=output.length;
  const beforeFlow = before.ethernetFlow;
  const afterFlow = after.ethernetFlow;
  if (afterFlow && stable(beforeFlow) !== stable(afterFlow)) {
    let offset = 90;
    for (const segment of afterFlow.segments) {
      output.push(spec(
        'ethernet:segment:' + segment.phase + ':' + segment.vlanId + ':' + segment.linkIds.join('-'),
        'forwarding',
        'switching',
        'L2 FORWARD · VLAN ' + segment.vlanId,
        segment.disposition + ' · ' + segment.nodeIds.map((id) => labelForEthernet(after, id)).join(' → ') + ' · links ' + (segment.linkIds.join(' → ') || 'local'),
        offset++,
        ethernetRefs(...segment.nodeIds),
        segment.linkIds,
      ));
    }
    const priorFdb = new Set((beforeFlow?.fdb ?? []).map((entry) => stable([entry.switchId, entry.vlanId, entry.mac, entry.linkId])));
    for (const entry of afterFlow.fdb) {
      const fingerprint = stable([entry.switchId, entry.vlanId, entry.mac, entry.linkId]);
      if (priorFdb.has(fingerprint)) continue;
      output.push(spec('fdb:' + entry.switchId + ':' + entry.vlanId + ':' + entry.mac, 'resolution', 'switching', 'FDB LEARNED · ' + entry.mac, labelForEthernet(after, entry.switchId) + ' learned ' + entry.mac + ' on ' + entry.linkId + ' in VLAN ' + entry.vlanId + '.', offset++, ethernetRefs(entry.switchId, entry.learnedFrom), [entry.mac, entry.linkId]));
    }
    output.push(spec('ethernet:flow:outcome', 'flow', 'switching', 'LAN FLOW · ' + (afterFlow.success ? 'DELIVERED' : 'FAILED'), afterFlow.summary, offset + 1, ethernetRefs(afterFlow.sourceId, afterFlow.destinationId, afterFlow.routedAt), afterFlow.segments.flatMap((segment) => segment.linkIds)));
  }

  const vlanIds = [...new Set([...before.ethernet.vlans.map((vlan) => vlan.id), ...after.ethernet.vlans.map((vlan) => vlan.id)])].sort((a, b) => a - b);
  let offset = 80;
  for (const vlanId of vlanIds) {
    try {
      const prior = builderStpState(before.ethernet, vlanId);
      const next = builderStpState(after.ethernet, vlanId);
      const priorFingerprint = stable([prior.rootBridgeId, prior.blockedLinkIds, prior.forwardingLinkIds, prior.enabled]);
      const nextFingerprint = stable([next.rootBridgeId, next.blockedLinkIds, next.forwardingLinkIds, next.enabled]);
      if (priorFingerprint === nextFingerprint) continue;
      output.push(spec('stp:vlan:' + vlanId, 'control-plane', 'switching', 'STP STATE CHANGED · VLAN ' + vlanId, 'Root ' + (next.rootBridgeLabel ?? 'NONE') + ' · blocked ' + (next.blockedLinkIds.join(', ') || 'none') + ' · forwarding ' + (next.forwardingLinkIds.join(', ') || 'none') + '.', offset++, ethernetRefs(next.rootBridgeId), [...next.blockedLinkIds, ...next.forwardingLinkIds]));
    } catch {
      // A VLAN can disappear as part of a valid configuration edit.
    }
  }
  mergeProjection(output,startIndex,{ethernetFlow:'after'});
}

function deriveNatEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {
  const startIndex=output.length;
  const prior = mapById(before.natSessions);
  const next = mapById(after.natSessions);
  let offset = 120;
  for (const [id, entry] of next) {
    const old = prior.get(id);
    if (!old || stable(old) !== stable(entry)) {
      output.push(spec('nat:' + id, 'translation', 'nat', 'NAT STATE · ' + entry.kind.toUpperCase(), entry.protocol.toUpperCase() + ' ' + entry.insideAddress + ':' + (entry.insidePort ?? '—') + ' ↔ ' + entry.outsideAddress + ':' + (entry.outsidePort ?? '—') + ' · remote ' + entry.remoteAddress + ':' + (entry.remotePort ?? '—'), offset++, routedRefs(entry.routerId), [entry.id, entry.insideAddress, entry.outsideAddress]));
    }
  }
  for (const [id, entry] of prior) {
    if (next.has(id)) continue;
    output.push(spec('nat:removed:' + id, 'translation', 'nat', 'NAT STATE REMOVED', entry.id + ' expired, was cleared, or was invalidated by configuration/topology change.', offset++, routedRefs(entry.routerId), [entry.id]));
  }
  mergeProjection(output,startIndex,{natSessions:'after'});
}

function dhcpActionClientId(before: BuilderTimelineState, after: BuilderTimelineState, action: BuilderWorkbenchEvent): string | null {
  for (const ref of action.deviceRefs) {
    if (ref.plane !== 'ethernet') continue;
    const device = before.ethernet.devices.find((entry) => entry.id === ref.id) ?? after.ethernet.devices.find((entry) => entry.id === ref.id);
    if (device?.kind === 'endpoint') return ref.id;
  }
  return null;
}

function replayDhcpAction(before: BuilderTimelineState, after: BuilderTimelineState, action: BuilderWorkbenchEvent): BuilderDhcpTransaction | null {
  const clientDeviceId = dhcpActionClientId(before, after, action);
  if (!clientDeviceId || after.dhcpSequence !== before.dhcpSequence + 1) return null;
  const summary = action.summary.toUpperCase();
  try {
    const transaction = summary === 'DHCP ACK' || summary === 'DHCP FAILED'
      ? runBuilderDhcpAcquire(before.ethernet, before.dhcp, before.dhcpLeases, clientDeviceId, before.dhcpSequence)
      : summary === 'DHCP RENEW' || summary === 'DHCP TIMEOUT'
        ? renewBuilderDhcpLease(before.ethernet, before.dhcp, before.dhcpLeases, clientDeviceId, before.dhcpSequence)
        : null;
    return transaction && stable(transaction.leases) === stable(after.dhcpLeases) ? transaction : null;
  } catch { return null; }
}

function appendDhcpTransactionEvents(transaction: BuilderDhcpTransaction, before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[], startOffset: number): number {
  let previousKey: string | null = null;
  const leaseChanged = stable(before.dhcpLeases) !== stable(after.dhcpLeases);
  for (let index = 0; index < transaction.events.length; index += 1) {
    const event = transaction.events[index];
    const last = index === transaction.events.length - 1;
    const commits = (transaction.success && event.kind === 'ACK') || (!transaction.success && last);
    const key = 'dhcp:transaction:' + transaction.id + ':' + String(index).padStart(2, '0') + ':' + event.kind.toLowerCase();
    const path = event.nodeIds.map((id) => labelForEthernet(after, id)).join(' → ');
    const failure = !transaction.success && last && transaction.failureReason ? ' · FAILED · ' + transaction.failureReason : '';
    output.push(spec(
      key, 'control-plane', 'dhcp', 'DHCP · ' + event.kind + ' · VLAN ' + event.vlanId,
      event.detail + (path ? ' · PATH ' + path : '') + (event.relayed ? ' · RELAYED' : '') + failure,
      startOffset + index, ethernetRefs(event.sourceDeviceId, event.destinationDeviceId, ...event.nodeIds),
      [transaction.id, ...event.linkIds, transaction.lease?.id ?? '', transaction.lease?.address ?? ''].filter(Boolean),
      previousKey,
      commits ? { ...(leaseChanged ? { dhcpLeases: 'after' as const } : {}), dhcpSequence: 'after' } : undefined,
    ));
    previousKey = key;
  }
  if (!transaction.success && transaction.events.length === 0) {
    output.push(spec(
      'dhcp:transaction:' + transaction.id + ':failed', 'control-plane', 'dhcp',
      'DHCP · FAILED · ' + labelForEthernet(after, transaction.clientDeviceId), transaction.failureReason ?? transaction.summary,
      startOffset, ethernetRefs(transaction.clientDeviceId), [transaction.id], undefined,
      { ...(leaseChanged ? { dhcpLeases: 'after' as const } : {}), dhcpSequence: 'after' },
    ));
  }
  return startOffset + Math.max(1, transaction.events.length) + 1;
}

function deriveDhcpRelease(before: BuilderTimelineState, after: BuilderTimelineState, action: BuilderWorkbenchEvent, output: BuilderWorkbenchEventSpec[], offset: number): boolean {
  if (action.summary.toUpperCase() !== 'DHCP RELEASE' || after.dhcpSequence !== before.dhcpSequence + 1) return false;
  const clientDeviceId = dhcpActionClientId(before, after, action);
  if (!clientDeviceId) return false;
  const result = releaseBuilderDhcpLease(before.dhcpLeases, clientDeviceId, before.dhcpSequence);
  if (stable(result.leases) !== stable(after.dhcpLeases)) return false;
  const lease = before.dhcpLeases.find((entry) => entry.clientDeviceId === clientDeviceId);
  output.push(lease && result.event
    ? spec('dhcp:release:' + lease.id, 'control-plane', 'dhcp', 'DHCP · RELEASE · ' + lease.address, result.event.detail, offset, ethernetRefs(clientDeviceId, lease.serverDeviceId), [lease.id, lease.address], undefined, { dhcpSequence: 'after', dhcpRemoveLeaseIds: [lease.id] })
    : spec('dhcp:release:none:' + clientDeviceId, 'control-plane', 'dhcp', 'DHCP · RELEASE · NO ACTIVE LEASE', labelForEthernet(after, clientDeviceId) + ' had no active lease.', offset, ethernetRefs(clientDeviceId), [clientDeviceId], undefined, { dhcpSequence: 'after' }));
  return true;
}

function deriveDhcpClockEvents(before: BuilderTimelineState, after: BuilderTimelineState, action: BuilderWorkbenchEvent, output: BuilderWorkbenchEventSpec[], startOffset: number): boolean {
  if (action.summary.toUpperCase() !== 'DHCP CLOCK' || after.dhcpSequence <= before.dhcpSequence || stable(pruneBuilderDhcpLeases(before.dhcpLeases, after.dhcpSequence)) !== stable(after.dhcpLeases)) return false;
  type Stage = { sequence: number; order: number; key: string; summary: string; detail: string; lease: BuilderTimelineState['dhcpLeases'][number]; remove: boolean };
  const stages: Stage[] = [];
  const crossed = (sequence: number) => before.dhcpSequence < sequence && after.dhcpSequence >= sequence;
  for (const lease of [...before.dhcpLeases].sort((a, b) => a.id.localeCompare(b.id))) {
    const client = labelForEthernet(before, lease.clientDeviceId);
    if (crossed(lease.renewAtSequence)) stages.push({ sequence: lease.renewAtSequence, order: 0, key: 't1', summary: 'DHCP · T1 REACHED · ' + lease.address, detail: client + ' reached T1; lease remains valid.', lease, remove: false });
    if (crossed(lease.rebindAtSequence)) stages.push({ sequence: lease.rebindAtSequence, order: 1, key: 't2', summary: 'DHCP · T2 REACHED · ' + lease.address, detail: client + ' reached T2; rebinding is now allowed.', lease, remove: false });
    const expiry = lease.expiresAtSequence + 1;
    if (crossed(expiry)) stages.push({ sequence: expiry, order: 2, key: 'expire', summary: 'DHCP · EXPIRE · ' + lease.address, detail: client + ' passed lease expiry; the address is no longer valid.', lease, remove: true });
  }
  stages.sort((a, b) => a.sequence - b.sequence || a.order - b.order || a.lease.id.localeCompare(b.lease.id));
  const causes = new Map<string, string>();
  let lastSequence = before.dhcpSequence;
  for (const stage of stages) {
    const key = 'dhcp:lifecycle:' + stage.lease.id + ':' + stage.key + ':' + stage.sequence;
    output.push(spec(
      key, 'control-plane', 'dhcp', stage.summary, stage.detail,
      startOffset + Math.max(1, stage.sequence - before.dhcpSequence),
      ethernetRefs(stage.lease.clientDeviceId, stage.lease.serverDeviceId), [stage.lease.id, stage.lease.address], causes.get(stage.lease.id),
      { dhcpSequence: stage.sequence, ...(stage.remove ? { dhcpRemoveLeaseIds: [stage.lease.id] } : {}) },
    ));
    causes.set(stage.lease.id, key);
    lastSequence = Math.max(lastSequence, stage.sequence);
  }
  if (lastSequence !== after.dhcpSequence || stages.length === 0) output.push(spec(
    'dhcp:clock:' + after.dhcpSequence, 'control-plane', 'dhcp', 'DHCP · CLOCK · SEQ ' + after.dhcpSequence,
    'DHCP sequence ' + before.dhcpSequence + ' → ' + after.dhcpSequence + '.', startOffset + Math.max(1, after.dhcpSequence - before.dhcpSequence) + 1,
    action.deviceRefs, ['dhcp-sequence-' + after.dhcpSequence], undefined, { dhcpSequence: 'after' },
  ));
  return true;
}

function deriveDhcpEvents(before: BuilderTimelineState, after: BuilderTimelineState, action: BuilderWorkbenchEvent, output: BuilderWorkbenchEventSpec[]): void {
  let offset = 140;
  const transaction = replayDhcpAction(before, after, action);
  if (transaction) { appendDhcpTransactionEvents(transaction, before, after, output, offset); return; }
  if (deriveDhcpRelease(before, after, action, output, offset) || deriveDhcpClockEvents(before, after, action, output, offset)) return;
  const prior = mapById(before.dhcpLeases);
  const next = mapById(after.dhcpLeases);
  for (const [id, entry] of next) {
    const old = prior.get(id);
    if (!old || stable(old) !== stable(entry)) output.push(spec(
      'dhcp:' + id, 'control-plane', 'dhcp', 'DHCP LEASE · ' + entry.address,
      labelForEthernet(after, entry.clientDeviceId) + ' holds ' + entry.address + ' from ' + labelForEthernet(after, entry.serverDeviceId) + '.',
      offset++, ethernetRefs(entry.clientDeviceId, entry.serverDeviceId), [entry.id, entry.address], undefined, { dhcpLeases: 'after', dhcpSequence: 'after' },
    ));
  }
  for (const [id, entry] of prior) if (!next.has(id)) output.push(spec(
    'dhcp:removed:' + id, 'control-plane', 'dhcp', 'DHCP LEASE REMOVED · ' + entry.address,
    labelForEthernet(before, entry.clientDeviceId) + ' no longer has lease ' + entry.id + ' after a configuration/topology change.',
    offset++, ethernetRefs(entry.clientDeviceId, entry.serverDeviceId), [entry.id, entry.address], undefined,
    { dhcpLeases: 'after', ...(before.dhcpSequence !== after.dhcpSequence ? { dhcpSequence: 'after' as const } : {}) },
  ));
}

function deriveIpv6Events(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {
  const startIndex=output.length;
  let offset = 160;
  for (const entry of newById(before.ipv6ControlState.ndHistory, after.ipv6ControlState.ndHistory)) {
    output.push(spec('ipv6:nd:' + entry.id, 'resolution', 'ipv6', 'ND · ' + (entry.cacheHit ? 'CACHE HIT' : 'NS / NA'), entry.detail, offset++, routedRefs(entry.nodeId, entry.targetNodeId), [entry.id, entry.linkId, entry.targetAddress]));
  }
  for (const entry of newById(before.ipv6ControlState.raHistory, after.ipv6ControlState.raHistory)) {
    output.push(spec('ipv6:ra:' + entry.id, 'control-plane', 'ipv6', 'RA / SLAAC · ' + (entry.success ? 'APPLIED' : 'FAILED'), entry.detail, offset++, routedRefs(entry.endpointId, entry.routerId), [entry.id, entry.linkId ?? '']));
  }
  for (const entry of newById(before.ipv6ControlState.pmtuHistory, after.ipv6ControlState.pmtuHistory)) {
    output.push(spec('ipv6:pmtu:' + entry.id, 'forwarding', 'ipv6', 'PMTU · ' + entry.mtuBytes + ' BYTES', entry.detail, offset++, routedRefs(entry.sourceNodeId, entry.destinationNodeId, entry.responderNodeId), [entry.id, entry.linkId]));
  }

  const priorNud = mapById(before.ipv6LifecycleState.nud);
  for (const entry of after.ipv6LifecycleState.nud) {
    const old = priorNud.get(entry.id);
    if (!old || old.state !== entry.state || old.probesSent !== entry.probesSent) {
      output.push(spec('ipv6:nud:' + entry.id, 'resolution', 'ipv6', 'NUD · ' + entry.state, entry.detail, offset++, routedRefs(entry.nodeId, entry.targetNodeId), [entry.id, entry.linkId, entry.address]));
    }
  }
  for (const entry of newById(before.ipv6LifecycleState.dadHistory, after.ipv6LifecycleState.dadHistory)) {
    output.push(spec('ipv6:dad:' + entry.id, 'resolution', 'ipv6', 'DAD · ' + entry.status, entry.detail, offset++, routedRefs(entry.nodeId, entry.duplicateNodeId), [entry.id, entry.linkId, entry.candidateAddress]));
  }
  for (const entry of newById(before.ipv6LifecycleState.dhcpHistory, after.ipv6LifecycleState.dhcpHistory)) {
    output.push(spec('ipv6:dhcpv6:' + entry.id, 'control-plane', 'ipv6', 'DHCPV6 · ' + entry.stages.join(' → '), entry.detail, offset++, routedRefs(entry.endpointId, entry.routerId), [entry.id, entry.linkId ?? '', entry.address ?? '']));
  }
  for (const entry of newById(before.ipv6LifecycleState.renumberHistory, after.ipv6LifecycleState.renumberHistory)) {
    output.push(spec('ipv6:renumber:' + entry.id, 'control-plane', 'ipv6', 'IPV6 RENUMBER · ' + entry.newPrefix, entry.detail, offset++, [], [entry.id, entry.linkId, entry.oldPrefix, entry.newPrefix]));
  }
  for (const entry of changedById(before.ipv6LifecycleState.prefixLifetimes, after.ipv6LifecycleState.prefixLifetimes)) {
    const old = before.ipv6LifecycleState.prefixLifetimes.find((candidate) => candidate.id === entry.id);
    if (old?.status === entry.status) continue;
    output.push(spec('ipv6:prefix:' + entry.id + ':' + entry.status, 'control-plane', 'ipv6', 'RA PREFIX · ' + entry.status, entry.prefix + ' on ' + labelForRouted(after, entry.endpointId) + ' changed from ' + (old?.status ?? 'NONE') + ' to ' + entry.status + '.', offset++, routedRefs(entry.endpointId, entry.routerId), [entry.id, entry.linkId, entry.prefix]));
  }
  mergeProjection(output,startIndex,{ipv6ControlState:'after',ipv6LifecycleState:'after'});
}

function deriveProbeEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {
  const startIndex=output.length;
  const priorIds = new Set(before.probeHistory.map((probe) => probe.id));
  const probes = after.probeHistory.filter((probe) => !priorIds.has(probe.id)).sort((a, b) => a.sequence - b.sequence);
  let probeOffset = 220;
  for (const probe of probes) {
    const seenForwarding = new Set<string>();
    for (const attempt of probe.attempts) {
      const directions: Array<{ name: string; nodes: string[]; links: string[] }> = [
        { name: 'REQUEST', nodes: attempt.requestNodeIds, links: attempt.requestLinkIds },
        { name: 'RESPONSE', nodes: attempt.responseNodeIds, links: attempt.responseLinkIds },
      ];
      for (const direction of directions) {
        for (let index = 0; index < direction.links.length; index += 1) {
          const linkId = direction.links[index];
          const from = direction.nodes[index] ?? null;
          const to = direction.nodes[index + 1] ?? null;
          const fingerprint = direction.name + ':' + linkId + ':' + from + ':' + to;
          if (seenForwarding.has(fingerprint)) continue;
          seenForwarding.add(fingerprint);
          output.push(spec(
            'probe:' + probe.id + ':' + fingerprint,
            'forwarding',
            'probe',
            probe.kind.toUpperCase() + ' · ' + direction.name + ' FORWARD',
            (from ? labelForRouted(after, from) : 'UNKNOWN') + ' → ' + (to ? labelForRouted(after, to) : 'UNKNOWN') + ' over ' + linkId + ' · TTL ' + attempt.ttl + '.',
            probeOffset++,
            routedRefs(from, to),
            [probe.id, linkId],
          ));
        }
      }
      if (/ACL|FIREWALL|POLICY/i.test(attempt.detail)) {
        output.push(spec('probe:' + probe.id + ':policy:' + attempt.index, 'policy', 'policy', probe.kind.toUpperCase() + ' · POLICY DECISION', attempt.detail, probeOffset++, routedRefs(attempt.responderNodeId, probe.sourceNodeId, probe.destinationNodeId), [probe.id]));
      }
      if (attempt.natDetail) {
        output.push(spec('probe:' + probe.id + ':nat:' + attempt.index, 'translation', 'nat', probe.kind.toUpperCase() + ' · NAT TRANSLATION', attempt.natDetail, probeOffset++, routedRefs(probe.sourceNodeId, probe.destinationNodeId), [probe.id, probe.natTranslationId ?? '']));
      }
      output.push(spec(
        'probe:' + probe.id + ':outcome:' + attempt.index,
        'flow',
        'probe',
        probe.kind.toUpperCase() + ' · ' + attempt.status.toUpperCase().replaceAll('-', ' '),
        attempt.detail,
        probeOffset++,
        routedRefs(probe.sourceNodeId, probe.destinationNodeId, attempt.responderNodeId),
        [probe.id, attempt.dropLinkId ?? ''],
      ));
    }
  }
  mergeProjection(output,startIndex,{probeHistory:'after'});
}

function applicationEventKind(stage: BuilderTimelineState['applicationHistory'][number]['stages'][number]): BuilderWorkbenchEventKind {
  if(stage.boundary==='L2'||stage.boundary==='RESOLUTION')return'resolution';
  if(stage.boundary==='ROUTING')return'fib';
  if(stage.boundary==='POLICY_NAT')return'policy';
  if(stage.boundary==='LINK')return'forwarding';
  if(stage.boundary==='TRANSPORT')return'transport';
  if(stage.boundary==='TLS'||stage.boundary==='APPLICATION')return'application';
  if(stage.boundary==='RESPONSE')return'flow';
  return'control-plane';
}

function deriveApplicationEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {
  const priorIds=new Set((before.applicationHistory??[]).map((transaction)=>transaction.id));
  const transactions=(after.applicationHistory??[]).filter((transaction)=>!priorIds.has(transaction.id));
  let offset=260;
  for(const transaction of transactions){
    const evaluated=transaction.stages.filter((stage)=>stage.status!=='NOT_REACHED');
    let previousKey:string|null=null;
    for(let index=0;index<evaluated.length;index+=1){
      const stage=evaluated[index];
      const final=index===evaluated.length-1;
      const key='application:'+transaction.id+':'+stage.id;
      output.push(spec(
        key,applicationEventKind(stage),'application',
        'APPLICATION · '+stage.label+' · '+stage.status,
        stage.summary+' · '+stage.detail,offset++,routedRefs(...stage.nodeIds),
        [transaction.id,stage.id,...stage.linkIds],previousKey,
        { ...(index===0?{applicationHistory:'after' as const}:{}), applicationStageOrder:final?null:stage.order },
      ));
      previousKey=key;
    }
  }
}

export function deriveBuilderCanonicalEventSpecs(
  before: BuilderTimelineState | null,
  after: BuilderTimelineState,
  action: BuilderWorkbenchEvent,
): BuilderWorkbenchEventSpec[] {
  if (!before || action.kind !== 'action') return [];
  const output: BuilderWorkbenchEventSpec[] = [];
  const handledFailureLinks = deriveOspfEvents(before, after, output);
  deriveTopologyEvents(before, after, output, handledFailureLinks);
  deriveBgpEvents(before, after, output);
  deriveRouteEvents(before, after, output, handledFailureLinks.size > 0);
  deriveArpEvents(before, after, output);
  deriveEthernetEvents(before, after, output);
  deriveNatEvents(before, after, output);
  deriveDhcpEvents(before, after, action, output);
  deriveIpv6Events(before, after, output);
  deriveProbeEvents(before, after, output);
  deriveApplicationEvents(before, after, output);

  const unique = output.filter((entry, index, all) => all.findIndex((candidate) => candidate.key === entry.key) === index);
  return unique
    .map((entry,index)=>({entry,index}))
    .sort((a,b)=>(a.entry.offsetMs??0)-(b.entry.offsetMs??0)||a.index-b.index)
    .map(({entry})=>entry)
    .slice(0,120);
}

import {
  interfacesForBuilderNode,
  normalizeBuilderIpv4,
  parseBuilderIpv4Cidr,
  type BuilderAddressing,
  type BuilderInterfaceAddress,
} from './addressing.ts';
import { findShortestPath, type BuilderGraph } from './model.ts';

export interface BuilderStaticRoute {
  id: string;
  routerId: string;
  prefix: string;
  nextHop: string;
  metric: number;
}

export interface BuilderRoutingConfig {
  staticRoutes: BuilderStaticRoute[];
}

export type BuilderRouteSource = 'connected' | 'static';

export interface BuilderRouteTableEntry {
  id: string;
  routerId: string;
  prefix: string;
  prefixLength: number;
  source: BuilderRouteSource;
  administrativeDistance: number;
  metric: number;
  nextHop: string | null;
  outgoingInterface: string;
  linkId: string;
  active: boolean;
  stateNote: string;
}

export interface BuilderForwardingHop {
  nodeId: string;
  nodeLabel: string;
  routeSource: 'endpoint-local' | 'default-gateway' | BuilderRouteSource;
  matchedPrefix: string | null;
  nextHop: string | null;
  outgoingInterface: string | null;
  linkId: string | null;
  nextNodeId: string | null;
}

export interface BuilderForwardingTrace {
  reachable: boolean;
  sourceNodeId: string;
  destinationNodeId: string;
  destinationAddress: string | null;
  hops: BuilderForwardingHop[];
  failureNodeId: string | null;
  failureReason: string | null;
  explanation: string;
}

export interface BuilderStaticPathInstallResult {
  routing: BuilderRoutingConfig;
  prefix: string;
  installedRouterIds: string[];
  weightedPathNodeIds: string[];
}

interface RoutePrefix {
  cidr: string;
  prefixLength: number;
  network: number;
  broadcast: number;
}

function ipv4ToInt(value: string): number {
  const normalized = normalizeBuilderIpv4(value);
  return normalized.split('.').reduce((result, part) => ((result << 8) | Number(part)) >>> 0, 0) >>> 0;
}

function intToIpv4(value: number): string {
  const normalized = value >>> 0;
  return [24, 16, 8, 0].map((shift) => (normalized >>> shift) & 255).join('.');
}

function parseRoutePrefix(value: string): RoutePrefix {
  const normalized = value.trim();
  const [addressText, prefixText, ...extra] = normalized.split('/');
  if (!addressText || !prefixText || extra.length > 0 || !/^\d{1,2}$/.test(prefixText)) {
    throw new Error(`Invalid IPv4 route prefix: ${value}.`);
  }
  const prefixLength = Number(prefixText);
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    throw new Error('Static route prefixes must be /0 through /32.');
  }
  const address = ipv4ToInt(addressText);
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  const network = (address & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { cidr: `${intToIpv4(network)}/${prefixLength}`, prefixLength, network, broadcast };
}

function prefixContains(prefix: RoutePrefix, address: string): boolean {
  const value = ipv4ToInt(address);
  return value >= prefix.network && value <= prefix.broadcast;
}

function nodeById(graph: BuilderGraph, nodeId: string) {
  return graph.nodes.find((node) => node.id === nodeId);
}

function linkById(graph: BuilderGraph, linkId: string) {
  return graph.links.find((link) => link.id === linkId);
}

function remoteInterfaceForNextHop(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routerId: string,
  nextHop: string,
): { linkId: string; local: BuilderInterfaceAddress; remote: BuilderInterfaceAddress } | null {
  const normalizedNextHop = normalizeBuilderIpv4(nextHop);
  for (const link of graph.links) {
    if (link.a !== routerId && link.b !== routerId) continue;
    const segment = addressing.segments[link.id];
    if (!segment) continue;
    const local = segment.interfaces.find((entry) => entry.nodeId === routerId);
    const remote = segment.interfaces.find((entry) => entry.nodeId !== routerId && entry.address === normalizedNextHop);
    if (local && remote) return { linkId: link.id, local, remote };
  }
  return null;
}

function interfaceOwner(addressing: BuilderAddressing, address: string): { nodeId: string; linkId: string; interfaceName: string } | null {
  const normalized = normalizeBuilderIpv4(address);
  for (const segment of Object.values(addressing.segments)) {
    const entry = segment.interfaces.find((candidate) => candidate.address === normalized);
    if (entry) return { nodeId: entry.nodeId, linkId: segment.linkId, interfaceName: entry.name };
  }
  return null;
}

function primaryInterfaceForNode(addressing: BuilderAddressing, nodeId: string) {
  return interfacesForBuilderNode(addressing, nodeId)[0] ?? null;
}

export function createDefaultBuilderRoutingConfig(): BuilderRoutingConfig {
  return { staticRoutes: [] };
}

export function validateBuilderRoutingConfig(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  value: BuilderRoutingConfig,
): BuilderRoutingConfig {
  if (!value || typeof value !== 'object' || !Array.isArray(value.staticRoutes)) throw new Error('Builder routing config must contain a staticRoutes array.');
  const routeIds = new Set<string>();
  const seenRouterPrefix = new Set<string>();
  const staticRoutes = value.staticRoutes.map((raw, index): BuilderStaticRoute => {
    if (!raw || typeof raw !== 'object') throw new Error(`Static route ${index + 1} is invalid.`);
    const id = String(raw.id ?? '').trim();
    if (!id || id.length > 120 || !/^[a-zA-Z0-9_.:-]+$/.test(id)) throw new Error(`Static route ${index + 1} has an invalid id.`);
    if (routeIds.has(id)) throw new Error(`Duplicate static route id ${id}.`);
    routeIds.add(id);
    const routerId = String(raw.routerId ?? '').trim();
    const router = nodeById(graph, routerId);
    if (!router || router.kind !== 'router') throw new Error(`Static route ${id} must belong to a router node.`);
    const prefix = parseRoutePrefix(String(raw.prefix ?? '')).cidr;
    const routeKey = `${routerId}\u0000${prefix}`;
    if (seenRouterPrefix.has(routeKey)) throw new Error(`${routerId} already has a static route for ${prefix}.`);
    seenRouterPrefix.add(routeKey);
    const nextHop = normalizeBuilderIpv4(String(raw.nextHop ?? ''));
    if (!remoteInterfaceForNextHop(graph, addressing, routerId, nextHop)) {
      throw new Error(`${routerId} static next hop ${nextHop} must be an interface on a directly connected neighbor.`);
    }
    const metric = Number(raw.metric);
    if (!Number.isInteger(metric) || metric < 1 || metric > 999) throw new Error(`Static route ${id} metric must be an integer from 1 to 999.`);
    return { id, routerId, prefix, nextHop, metric };
  });
  return { staticRoutes };
}

export function cloneBuilderRoutingConfig(value: BuilderRoutingConfig): BuilderRoutingConfig {
  return { staticRoutes: value.staticRoutes.map((route) => ({ ...route })) };
}

export function reconcileBuilderRoutingConfig(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  current: BuilderRoutingConfig,
): BuilderRoutingConfig {
  const retained = current.staticRoutes.filter((route) => {
    const router = nodeById(graph, route.routerId);
    if (!router || router.kind !== 'router') return false;
    try {
      parseRoutePrefix(route.prefix);
      return remoteInterfaceForNextHop(graph, addressing, route.routerId, route.nextHop) !== null;
    } catch {
      return false;
    }
  });
  const unique = new Map<string, BuilderStaticRoute>();
  for (const route of retained) {
    const key = `${route.routerId}\u0000${parseRoutePrefix(route.prefix).cidr}`;
    if (!unique.has(key)) unique.set(key, { ...route, prefix: parseRoutePrefix(route.prefix).cidr, nextHop: normalizeBuilderIpv4(route.nextHop) });
  }
  return validateBuilderRoutingConfig(graph, addressing, { staticRoutes: [...unique.values()] });
}

export function upsertBuilderStaticRoute(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  route: Omit<BuilderStaticRoute, 'id'> & { id?: string },
): BuilderRoutingConfig {
  const prefix = parseRoutePrefix(route.prefix).cidr;
  const nextHop = normalizeBuilderIpv4(route.nextHop);
  const id = route.id?.trim() || `static:${route.routerId}:${prefix}:${nextHop}`.replace(/\//g, ':');
  const next = cloneBuilderRoutingConfig(routing);
  next.staticRoutes = next.staticRoutes.filter((entry) => !(entry.routerId === route.routerId && parseRoutePrefix(entry.prefix).cidr === prefix));
  next.staticRoutes.push({ id, routerId: route.routerId, prefix, nextHop, metric: route.metric });
  return validateBuilderRoutingConfig(graph, addressing, next);
}

export function deleteBuilderStaticRoute(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  routeId: string,
): BuilderRoutingConfig {
  return validateBuilderRoutingConfig(graph, addressing, {
    staticRoutes: routing.staticRoutes.filter((route) => route.id !== routeId),
  });
}

export function routeTableForBuilderRouter(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  routerId: string,
): BuilderRouteTableEntry[] {
  const router = nodeById(graph, routerId);
  if (!router || router.kind !== 'router') return [];
  const entries: BuilderRouteTableEntry[] = [];
  for (const entry of interfacesForBuilderNode(addressing, routerId)) {
    const link = linkById(graph, entry.linkId);
    const parsed = parseBuilderIpv4Cidr(entry.cidr);
    entries.push({
      id: `connected:${routerId}:${entry.linkId}`,
      routerId,
      prefix: parsed.cidr,
      prefixLength: parsed.prefixLength,
      source: 'connected',
      administrativeDistance: 0,
      metric: 0,
      nextHop: null,
      outgoingInterface: entry.name,
      linkId: entry.linkId,
      active: Boolean(link && !link.failed),
      stateNote: link?.failed ? 'LINK DOWN' : 'DIRECTLY CONNECTED',
    });
  }
  for (const route of routing.staticRoutes.filter((entry) => entry.routerId === routerId)) {
    const attachment = remoteInterfaceForNextHop(graph, addressing, routerId, route.nextHop);
    const link = attachment ? linkById(graph, attachment.linkId) : null;
    const parsed = parseRoutePrefix(route.prefix);
    entries.push({
      id: route.id,
      routerId,
      prefix: parsed.cidr,
      prefixLength: parsed.prefixLength,
      source: 'static',
      administrativeDistance: 1,
      metric: route.metric,
      nextHop: route.nextHop,
      outgoingInterface: attachment?.local.name ?? '—',
      linkId: attachment?.linkId ?? '—',
      active: Boolean(attachment && link && !link.failed),
      stateNote: !attachment ? 'NEXT HOP INVALID' : link?.failed ? 'NEXT-HOP LINK DOWN' : 'STATIC',
    });
  }
  return entries.sort((left, right) =>
    right.prefixLength - left.prefixLength
    || left.administrativeDistance - right.administrativeDistance
    || left.metric - right.metric
    || left.id.localeCompare(right.id));
}

export function selectBuilderRoute(
  entries: readonly BuilderRouteTableEntry[],
  destinationAddress: string,
): BuilderRouteTableEntry | null {
  const matches = entries.filter((entry) => entry.active && prefixContains(parseRoutePrefix(entry.prefix), destinationAddress));
  return matches.sort((left, right) =>
    right.prefixLength - left.prefixLength
    || left.administrativeDistance - right.administrativeDistance
    || left.metric - right.metric
    || left.id.localeCompare(right.id))[0] ?? null;
}

function remoteNodeOnLink(graph: BuilderGraph, linkId: string, nodeId: string): string | null {
  const link = linkById(graph, linkId);
  if (!link) return null;
  if (link.a === nodeId) return link.b;
  if (link.b === nodeId) return link.a;
  return null;
}

function forwardingFailure(
  sourceNodeId: string,
  destinationNodeId: string,
  destinationAddress: string | null,
  hops: BuilderForwardingHop[],
  failureNodeId: string,
  failureReason: string,
): BuilderForwardingTrace {
  return {
    reachable: false,
    sourceNodeId,
    destinationNodeId,
    destinationAddress,
    hops,
    failureNodeId,
    failureReason,
    explanation: `${failureNodeId.toUpperCase()} stopped forwarding: ${failureReason}.`,
  };
}

export function traceBuilderForwarding(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  sourceNodeId: string,
  destinationNodeId: string,
): BuilderForwardingTrace {
  const source = nodeById(graph, sourceNodeId);
  const destination = nodeById(graph, destinationNodeId);
  if (!source || !destination) {
    return {
      reachable: false,
      sourceNodeId,
      destinationNodeId,
      destinationAddress: null,
      hops: [],
      failureNodeId: null,
      failureReason: 'SOURCE OR DESTINATION DOES NOT EXIST',
      explanation: 'Choose source and destination devices that still exist in the topology.',
    };
  }
  if (sourceNodeId === destinationNodeId) {
    return {
      reachable: true,
      sourceNodeId,
      destinationNodeId,
      destinationAddress: primaryInterfaceForNode(addressing, destinationNodeId)?.address ?? null,
      hops: [],
      failureNodeId: null,
      failureReason: null,
      explanation: 'Source and destination are the same device.',
    };
  }
  const destinationInterface = primaryInterfaceForNode(addressing, destinationNodeId);
  if (!destinationInterface) return forwardingFailure(sourceNodeId, destinationNodeId, null, [], destinationNodeId, 'DESTINATION HAS NO IPV4 INTERFACE');
  const destinationAddress = destinationInterface.address;
  const hops: BuilderForwardingHop[] = [];
  const visited = new Set<string>();
  let currentNodeId = sourceNodeId;

  for (let hopIndex = 0; hopIndex <= graph.nodes.length + 1; hopIndex += 1) {
    if (currentNodeId === destinationNodeId) {
      return {
        reachable: true,
        sourceNodeId,
        destinationNodeId,
        destinationAddress,
        hops,
        failureNodeId: null,
        failureReason: null,
        explanation: `${source.label} reaches ${destination.label} at ${destinationAddress} in ${hops.length} forwarding hop${hops.length === 1 ? '' : 's'}.`,
      };
    }
    if (visited.has(currentNodeId)) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'FORWARDING LOOP');
    visited.add(currentNodeId);
    const current = nodeById(graph, currentNodeId);
    if (!current) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'DEVICE DISAPPEARED');

    if (current.kind === 'endpoint') {
      const interfaces = interfacesForBuilderNode(addressing, currentNodeId);
      const direct = interfaces.find((entry) => prefixContains(parseRoutePrefix(entry.cidr), destinationAddress));
      if (direct) {
        const link = linkById(graph, direct.linkId);
        const owner = interfaceOwner(addressing, destinationAddress);
        if (!link || link.failed) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'DIRECT LINK DOWN');
        if (!owner || owner.linkId !== direct.linkId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'DESTINATION NOT PRESENT ON DIRECT SEGMENT');
        hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: 'endpoint-local', matchedPrefix: direct.cidr, nextHop: destinationAddress, outgoingInterface: direct.name, linkId: direct.linkId, nextNodeId: owner.nodeId });
        currentNodeId = owner.nodeId;
        continue;
      }
      const gateway = addressing.defaultGateways[currentNodeId] ?? null;
      if (!gateway) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'NO DEFAULT GATEWAY');
      const owner = interfaceOwner(addressing, gateway);
      const localAttachment = owner ? interfaces.find((entry) => entry.linkId === owner.linkId) : null;
      const link = owner ? linkById(graph, owner.linkId) : null;
      if (!owner || !localAttachment) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'DEFAULT GATEWAY IS NOT DIRECTLY CONNECTED');
      if (!link || link.failed) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'DEFAULT GATEWAY LINK DOWN');
      hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: 'default-gateway', matchedPrefix: '0.0.0.0/0', nextHop: gateway, outgoingInterface: localAttachment.name, linkId: owner.linkId, nextNodeId: owner.nodeId });
      currentNodeId = owner.nodeId;
      continue;
    }

    const table = routeTableForBuilderRouter(graph, addressing, routing, currentNodeId);
    const selected = selectBuilderRoute(table, destinationAddress);
    if (!selected) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'NO MATCHING ROUTE');
    let nextNodeId: string | null = null;
    let nextHop: string | null = selected.nextHop;
    if (selected.source === 'connected') {
      const owner = interfaceOwner(addressing, destinationAddress);
      if (!owner || owner.linkId !== selected.linkId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'CONNECTED PREFIX HAS NO DESTINATION NEIGHBOR');
      nextNodeId = owner.nodeId;
      nextHop = destinationAddress;
    } else {
      const owner = selected.nextHop ? interfaceOwner(addressing, selected.nextHop) : null;
      if (!owner || owner.linkId !== selected.linkId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'STATIC NEXT HOP INVALID');
      nextNodeId = owner.nodeId;
    }
    const link = linkById(graph, selected.linkId);
    if (!link || link.failed) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'OUTGOING LINK DOWN');
    hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: selected.source, matchedPrefix: selected.prefix, nextHop, outgoingInterface: selected.outgoingInterface, linkId: selected.linkId, nextNodeId });
    if (!nextNodeId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'NEXT HOP HAS NO DEVICE');
    currentNodeId = nextNodeId;
  }

  return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'HOP LIMIT EXCEEDED');
}

export function nextHopOptionsForBuilderRouter(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routerId: string,
): Array<{ address: string; nodeId: string; nodeLabel: string; interfaceName: string; linkId: string; linkFailed: boolean }> {
  const options: Array<{ address: string; nodeId: string; nodeLabel: string; interfaceName: string; linkId: string; linkFailed: boolean }> = [];
  for (const link of graph.links) {
    if (link.a !== routerId && link.b !== routerId) continue;
    const segment = addressing.segments[link.id];
    if (!segment) continue;
    const remote = segment.interfaces.find((entry) => entry.nodeId !== routerId);
    const node = remote ? nodeById(graph, remote.nodeId) : null;
    if (!remote || !node) continue;
    options.push({ address: remote.address, nodeId: remote.nodeId, nodeLabel: node.label, interfaceName: remote.name, linkId: link.id, linkFailed: link.failed });
  }
  return options.sort((a, b) => a.nodeLabel.localeCompare(b.nodeLabel) || a.address.localeCompare(b.address));
}

export function installStaticRoutesForWeightedPath(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  sourceNodeId: string,
  destinationNodeId: string,
): BuilderStaticPathInstallResult {
  const weighted = findShortestPath(graph, sourceNodeId, destinationNodeId);
  if (!weighted.reachable || weighted.nodeIds.length < 2) throw new Error('The current weighted graph has no path to install.');
  const destinationInterface = primaryInterfaceForNode(addressing, destinationNodeId);
  if (!destinationInterface) throw new Error('Destination has no IPv4 interface to route toward.');
  const destinationSegment = addressing.segments[destinationInterface.linkId];
  if (!destinationSegment) throw new Error('Destination IPv4 segment is missing.');
  const prefix = parseBuilderIpv4Cidr(destinationSegment.cidr).cidr;
  let nextRouting = cloneBuilderRoutingConfig(routing);
  const installedRouterIds: string[] = [];

  for (let index = 0; index < weighted.nodeIds.length - 1; index += 1) {
    const currentId = weighted.nodeIds[index];
    const nextId = weighted.nodeIds[index + 1];
    const current = nodeById(graph, currentId);
    if (!current) throw new Error(`Weighted path references missing device ${currentId}.`);
    if (current.kind === 'endpoint') {
      if (index !== 0) throw new Error(`Endpoint ${current.label} cannot forward transit traffic; change the graph path.`);
      continue;
    }
    const table = routeTableForBuilderRouter(graph, addressing, nextRouting, currentId);
    if (table.some((entry) => entry.source === 'connected' && entry.active && parseRoutePrefix(entry.prefix).cidr === prefix)) continue;
    const step = weighted.steps[index];
    if (!step || step.from !== currentId || step.to !== nextId) throw new Error(`Weighted path step ${index + 1} is inconsistent.`);
    const segment = addressing.segments[step.linkId];
    const remote = segment?.interfaces.find((entry) => entry.nodeId === nextId);
    if (!remote) throw new Error(`No next-hop interface exists for ${current.label} → ${nextId}.`);
    nextRouting = upsertBuilderStaticRoute(graph, addressing, nextRouting, {
      routerId: currentId,
      prefix,
      nextHop: remote.address,
      metric: step.cost,
    });
    installedRouterIds.push(currentId);
  }

  return { routing: nextRouting, prefix, installedRouterIds, weightedPathNodeIds: [...weighted.nodeIds] };
}

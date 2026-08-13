import type { BuilderAddressing } from './addressing.ts';
import { findShortestPath, type BuilderGraph, type BuilderLink } from './model.ts';

export interface BuilderIpv6InterfaceAddress {
  nodeId: string;
  name: string;
  globalAddress: string;
  linkLocalAddress: string;
}

export interface BuilderIpv6SegmentAddressing {
  linkId: string;
  prefix: string;
  interfaces: [BuilderIpv6InterfaceAddress, BuilderIpv6InterfaceAddress];
}

export interface BuilderIpv6DefaultGateway {
  address: string;
  linkId: string;
}

export interface BuilderIpv6Addressing {
  segments: Record<string, BuilderIpv6SegmentAddressing>;
  defaultGateways: Record<string, BuilderIpv6DefaultGateway | null>;
}

export interface BuilderIpv6StaticRoute {
  id: string;
  routerId: string;
  prefix: string;
  nextHop: string;
  linkId: string;
  metric: number;
  description: string;
}

export interface BuilderIpv6RoutingConfig {
  staticRoutes: BuilderIpv6StaticRoute[];
}

export interface BuilderIpv6Config {
  enabled: boolean;
  addressing: BuilderIpv6Addressing;
  routing: BuilderIpv6RoutingConfig;
}

export interface BuilderIpv6Cidr {
  cidr: string;
  address: string;
  prefixLength: number;
  networkAddress: string;
  addressValue: bigint;
  network: bigint;
}

export interface BuilderIpv6RouteTableEntry {
  id: string;
  routerId: string;
  prefix: string;
  prefixLength: number;
  source: 'connected' | 'static';
  administrativeDistance: 0 | 1;
  metric: number;
  nextHop: string | null;
  outgoingInterface: string;
  linkId: string;
  active: boolean;
  stateNote: string;
}

export interface BuilderIpv6NextHopOption {
  nodeId: string;
  nodeLabel: string;
  linkId: string;
  interfaceName: string;
  address: string;
  globalAddress: string;
  linkFailed: boolean;
}

export interface BuilderIpv6ForwardingHop {
  nodeId: string;
  nodeLabel: string;
  routeSource: 'endpoint-local' | 'default-router' | 'connected' | 'static';
  matchedPrefix: string | null;
  nextHop: string | null;
  outgoingInterface: string | null;
  linkId: string | null;
  nextNodeId: string | null;
}

export interface BuilderIpv6ForwardingTrace {
  reachable: boolean;
  sourceNodeId: string;
  destinationNodeId: string;
  sourceAddress: string | null;
  destinationAddress: string | null;
  hops: BuilderIpv6ForwardingHop[];
  failureNodeId: string | null;
  failureReason: string | null;
  explanation: string;
}

const MAX_IPV6_SEGMENTS = 0xffff;
const DOC_PREFIX_BASE = parseIpv6AddressValue('2001:db8::');
const LINK_LOCAL_NETWORK = parseIpv6AddressValue('fe80::');
const LINK_LOCAL_MASK = maskForPrefix(10);

function groupsFromIpv6(value: string): number[] {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized.includes('%')) throw new Error(`Invalid IPv6 address: ${value}.`);
  if (normalized.includes('.')) throw new Error('Embedded IPv4 notation is not supported in Builder IPv6 addresses.');
  if ((normalized.match(/::/g) ?? []).length > 1) throw new Error(`Invalid IPv6 address: ${value}.`);
  const hasCompression = normalized.includes('::');
  const [leftText, rightText = ''] = hasCompression ? normalized.split('::') : [normalized, ''];
  const parseSide = (text: string): number[] => text === '' ? [] : text.split(':').map((part) => {
    if (!/^[0-9a-f]{1,4}$/.test(part)) throw new Error(`Invalid IPv6 address: ${value}.`);
    return Number.parseInt(part, 16);
  });
  const left = parseSide(leftText);
  const right = parseSide(rightText);
  if (!hasCompression) {
    if (left.length !== 8) throw new Error(`Invalid IPv6 address: ${value}.`);
    return left;
  }
  const missing = 8 - left.length - right.length;
  if (missing < 1) throw new Error(`Invalid IPv6 address: ${value}.`);
  return [...left, ...Array.from({ length: missing }, () => 0), ...right];
}

function parseIpv6AddressValue(value: string): bigint {
  return groupsFromIpv6(value).reduce((result, group) => (result << 16n) | BigInt(group), 0n);
}

function groupsFromValue(value: bigint): number[] {
  const result: number[] = [];
  for (let index = 0; index < 8; index += 1) {
    const shift = BigInt((7 - index) * 16);
    result.push(Number((value >> shift) & 0xffffn));
  }
  return result;
}

function formatIpv6Value(value: bigint): string {
  const groups = groupsFromValue(value);
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length;) {
    if (groups[index] !== 0) { index += 1; continue; }
    let end = index;
    while (end < groups.length && groups[end] === 0) end += 1;
    const length = end - index;
    if (length >= 2 && length > bestLength) { bestStart = index; bestLength = length; }
    index = end;
  }
  const parts = groups.map((group) => group.toString(16));
  if (bestStart < 0) return parts.join(':');
  const before = parts.slice(0, bestStart).join(':');
  const after = parts.slice(bestStart + bestLength).join(':');
  return `${before}::${after}`;
}

function maskForPrefix(prefixLength: number): bigint {
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 128) throw new Error('IPv6 prefix length must be /0 through /128.');
  if (prefixLength === 0) return 0n;
  return ((1n << BigInt(prefixLength)) - 1n) << BigInt(128 - prefixLength);
}

export function normalizeBuilderIpv6(value: string): string {
  return formatIpv6Value(parseIpv6AddressValue(value));
}

export function parseBuilderIpv6Cidr(value: string): BuilderIpv6Cidr {
  const normalized = String(value ?? '').trim();
  const [addressText, prefixText, ...extra] = normalized.split('/');
  if (!addressText || prefixText == null || extra.length > 0 || !/^\d{1,3}$/.test(prefixText)) throw new Error(`Invalid IPv6 CIDR: ${value}.`);
  const prefixLength = Number(prefixText);
  const mask = maskForPrefix(prefixLength);
  const addressValue = parseIpv6AddressValue(addressText);
  const network = addressValue & mask;
  const address = formatIpv6Value(addressValue);
  const networkAddress = formatIpv6Value(network);
  return { cidr: `${networkAddress}/${prefixLength}`, address, prefixLength, networkAddress, addressValue, network };
}

export function builderIpv6PrefixContains(prefix: string, address: string): boolean {
  const parsed = parseBuilderIpv6Cidr(prefix);
  return (parseIpv6AddressValue(address) & maskForPrefix(parsed.prefixLength)) === parsed.network;
}

export function builderIpv6PrefixContainsPrefix(parentPrefix: string, childPrefix: string): boolean {
  const parent = parseBuilderIpv6Cidr(parentPrefix);
  const child = parseBuilderIpv6Cidr(childPrefix);
  return parent.prefixLength <= child.prefixLength && (child.network & maskForPrefix(parent.prefixLength)) === parent.network;
}

function isLinkLocal(value: string): boolean {
  return (parseIpv6AddressValue(value) & LINK_LOCAL_MASK) === (LINK_LOCAL_NETWORK & LINK_LOCAL_MASK);
}

function isMulticast(value: string): boolean {
  return (parseIpv6AddressValue(value) >> 120n) === 0xffn;
}

function nodeById(graph: BuilderGraph, nodeId: string) {
  return graph.nodes.find((node) => node.id === nodeId);
}

function linkById(graph: BuilderGraph, linkId: string): BuilderLink | undefined {
  return graph.links.find((link) => link.id === linkId);
}

function ipv4InterfaceName(ipv4: BuilderAddressing, linkId: string, nodeId: string): string {
  return ipv4.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nodeId)?.name ?? 'eth0';
}

function segmentNumberFromPrefix(prefix: string): number | null {
  const parsed = parseBuilderIpv6Cidr(prefix);
  if (parsed.prefixLength !== 64) return null;
  if (!builderIpv6PrefixContains('2001:db8::/32', parsed.networkAddress)) return null;
  return Number((parsed.network >> 64n) & 0xffffn);
}

function prefixForSegmentNumber(segmentNumber: number): string {
  if (!Number.isInteger(segmentNumber) || segmentNumber < 1 || segmentNumber > MAX_IPV6_SEGMENTS) throw new Error('IPv6 deterministic segment id is out of range.');
  const network = DOC_PREFIX_BASE | (BigInt(segmentNumber) << 64n);
  return `${formatIpv6Value(network)}/64`;
}

function addressInPrefix(prefix: string, hostId: bigint): string {
  const parsed = parseBuilderIpv6Cidr(prefix);
  if (parsed.prefixLength !== 64) throw new Error('Builder routed IPv6 segments must use /64 prefixes.');
  return formatIpv6Value(parsed.network | (hostId & 0xffffffffffffffffn));
}

function linkLocalFor(segmentNumber: number, slot: number): string {
  return formatIpv6Value(LINK_LOCAL_NETWORK | (BigInt(segmentNumber) << 16n) | BigInt(slot));
}

function nextFreeSegmentNumber(addressing: BuilderIpv6Addressing): number {
  const used = new Set(Object.values(addressing.segments).flatMap((segment) => {
    try { const number = segmentNumberFromPrefix(segment.prefix); return number == null ? [] : [number]; }
    catch { return []; }
  }));
  for (let index = 1; index <= MAX_IPV6_SEGMENTS; index += 1) if (!used.has(index)) return index;
  throw new Error('No free deterministic 2001:db8::/64 Builder segment remains.');
}

function makeSegment(ipv4: BuilderAddressing, addressing: BuilderIpv6Addressing, link: BuilderLink): BuilderIpv6SegmentAddressing {
  const segmentNumber = nextFreeSegmentNumber(addressing);
  const prefix = prefixForSegmentNumber(segmentNumber);
  return {
    linkId: link.id,
    prefix,
    interfaces: [
      { nodeId: link.a, name: ipv4InterfaceName(ipv4, link.id, link.a), globalAddress: addressInPrefix(prefix, 1n), linkLocalAddress: linkLocalFor(segmentNumber, 1) },
      { nodeId: link.b, name: ipv4InterfaceName(ipv4, link.id, link.b), globalAddress: addressInPrefix(prefix, 2n), linkLocalAddress: linkLocalFor(segmentNumber, 2) },
    ],
  };
}

function cloneInterface(entry: BuilderIpv6InterfaceAddress): BuilderIpv6InterfaceAddress { return { ...entry }; }
export function cloneBuilderIpv6Addressing(value: BuilderIpv6Addressing): BuilderIpv6Addressing {
  return {
    segments: Object.fromEntries(Object.entries(value.segments).map(([linkId, segment]) => [linkId, { ...segment, interfaces: [cloneInterface(segment.interfaces[0]), cloneInterface(segment.interfaces[1])] }])),
    defaultGateways: Object.fromEntries(Object.entries(value.defaultGateways).map(([nodeId, gateway]) => [nodeId, gateway ? { ...gateway } : null])),
  };
}

export function cloneBuilderIpv6Config(value: BuilderIpv6Config): BuilderIpv6Config {
  return { enabled: value.enabled, addressing: cloneBuilderIpv6Addressing(value.addressing), routing: { staticRoutes: value.routing.staticRoutes.map((route) => ({ ...route })) } };
}

function preferredDefaultGateway(graph: BuilderGraph, addressing: BuilderIpv6Addressing, endpointId: string): BuilderIpv6DefaultGateway | null {
  const links = graph.links.filter((link) => link.a === endpointId || link.b === endpointId).sort((a, b) => a.id.localeCompare(b.id));
  for (const link of links) {
    const neighborId = link.a === endpointId ? link.b : link.a;
    if (nodeById(graph, neighborId)?.kind !== 'router') continue;
    const neighbor = addressing.segments[link.id]?.interfaces.find((entry) => entry.nodeId === neighborId);
    if (neighbor) return { address: neighbor.linkLocalAddress, linkId: link.id };
  }
  return null;
}

export function validateBuilderIpv6Addressing(graph: BuilderGraph, ipv4: BuilderAddressing, value: BuilderIpv6Addressing): BuilderIpv6Addressing {
  if (!value || typeof value !== 'object' || !value.segments || !value.defaultGateways) throw new Error('Builder IPv6 addressing must contain segments and default gateways.');
  const linkIds = new Set(graph.links.map((link) => link.id));
  if (Object.keys(value.segments).length !== graph.links.length || Object.keys(value.segments).some((linkId) => !linkIds.has(linkId))) throw new Error('Builder IPv6 addressing must define exactly one /64 segment per routed graph link.');
  const segments: Record<string, BuilderIpv6SegmentAddressing> = {};
  const networks = new Map<bigint, string>();
  const globalOwners = new Map<string, string>();
  const linkLocalOwners = new Map<string, string>();
  for (const link of graph.links) {
    const raw = value.segments[link.id];
    if (!raw || raw.linkId !== link.id || !Array.isArray(raw.interfaces) || raw.interfaces.length !== 2) throw new Error(`IPv6 segment ${link.id} must contain two interfaces matching the graph link.`);
    const parsedPrefix = parseBuilderIpv6Cidr(raw.prefix);
    if (parsedPrefix.prefixLength !== 64) throw new Error(`Builder routed IPv6 segment ${link.id} must use a /64 prefix.`);
    const priorNetwork = networks.get(parsedPrefix.network);
    if (priorNetwork) throw new Error(`IPv6 segments ${priorNetwork} and ${link.id} overlap at ${parsedPrefix.cidr}.`);
    networks.set(parsedPrefix.network, link.id);
    const expected = new Set([link.a, link.b]);
    const seen = new Set<string>();
    const interfaces = raw.interfaces.map((entry): BuilderIpv6InterfaceAddress => {
      if (!expected.has(entry.nodeId) || seen.has(entry.nodeId)) throw new Error(`IPv6 segment ${link.id} interfaces must match ${link.a} and ${link.b} exactly.`);
      seen.add(entry.nodeId);
      const expectedName = ipv4InterfaceName(ipv4, link.id, entry.nodeId);
      if (entry.name !== expectedName) throw new Error(`${entry.nodeId} IPv6 interface on ${link.id} must share IPv4 interface name ${expectedName}.`);
      const globalAddress = normalizeBuilderIpv6(entry.globalAddress);
      const linkLocalAddress = normalizeBuilderIpv6(entry.linkLocalAddress);
      if (!builderIpv6PrefixContains(parsedPrefix.cidr, globalAddress)) throw new Error(`${entry.nodeId} global IPv6 address ${globalAddress} is not in ${parsedPrefix.cidr}.`);
      if (globalAddress === parsedPrefix.networkAddress || isLinkLocal(globalAddress) || isMulticast(globalAddress)) throw new Error(`${entry.nodeId} global IPv6 address ${globalAddress} is not a usable global/ULA interface address in this model.`);
      if (!isLinkLocal(linkLocalAddress)) throw new Error(`${entry.nodeId} link-local IPv6 address ${linkLocalAddress} must be within fe80::/10.`);
      const priorGlobal = globalOwners.get(globalAddress); if (priorGlobal) throw new Error(`IPv6 global address ${globalAddress} is already assigned to ${priorGlobal}.`); globalOwners.set(globalAddress, `${entry.nodeId} ${entry.name}`);
      const priorLinkLocal = linkLocalOwners.get(linkLocalAddress); if (priorLinkLocal) throw new Error(`Builder link-local address ${linkLocalAddress} is already assigned to ${priorLinkLocal}; this bounded model keeps them globally unique for unambiguous scoped next hops.`); linkLocalOwners.set(linkLocalAddress, `${entry.nodeId} ${entry.name}`);
      return { nodeId: entry.nodeId, name: expectedName, globalAddress, linkLocalAddress };
    }) as [BuilderIpv6InterfaceAddress, BuilderIpv6InterfaceAddress];
    segments[link.id] = { linkId: link.id, prefix: parsedPrefix.cidr, interfaces };
  }

  const defaultGateways: Record<string, BuilderIpv6DefaultGateway | null> = {};
  const endpointIds = new Set(graph.nodes.filter((node) => node.kind === 'endpoint').map((node) => node.id));
  for (const nodeId of Object.keys(value.defaultGateways)) if (!endpointIds.has(nodeId)) throw new Error(`IPv6 default router is only valid for endpoint nodes; ${nodeId} is not an endpoint.`);
  for (const endpointId of endpointIds) {
    const raw = value.defaultGateways[endpointId] ?? null;
    if (!raw) { defaultGateways[endpointId] = null; continue; }
    const link = linkById(graph, raw.linkId);
    if (!link || (link.a !== endpointId && link.b !== endpointId)) throw new Error(`${endpointId} IPv6 default router must be on a directly connected link.`);
    const neighborId = link.a === endpointId ? link.b : link.a;
    if (nodeById(graph, neighborId)?.kind !== 'router') throw new Error(`${endpointId} IPv6 default router must be a directly connected router.`);
    const neighbor = segments[link.id].interfaces.find((entry) => entry.nodeId === neighborId);
    const address = normalizeBuilderIpv6(raw.address);
    if (!neighbor || neighbor.linkLocalAddress !== address) throw new Error(`${endpointId} IPv6 default router ${address} must match the directly connected router link-local address on ${link.id}.`);
    defaultGateways[endpointId] = { address, linkId: link.id };
  }
  return { segments, defaultGateways };
}

function validateStaticRoutes(graph: BuilderGraph, addressing: BuilderIpv6Addressing, routes: readonly BuilderIpv6StaticRoute[]): BuilderIpv6StaticRoute[] {
  const ids = new Set<string>();
  const keys = new Set<string>();
  return routes.map((raw, index): BuilderIpv6StaticRoute => {
    const router = nodeById(graph, raw.routerId);
    if (!router || router.kind !== 'router') throw new Error(`IPv6 static route ${index + 1} references a non-router ${raw.routerId}.`);
    const prefix = parseBuilderIpv6Cidr(raw.prefix).cidr;
    const link = linkById(graph, raw.linkId);
    if (!link || (link.a !== raw.routerId && link.b !== raw.routerId)) throw new Error(`IPv6 static route ${raw.id || index + 1} must use a link attached to ${raw.routerId}.`);
    const neighborId = link.a === raw.routerId ? link.b : link.a;
    const neighbor = addressing.segments[link.id]?.interfaces.find((entry) => entry.nodeId === neighborId);
    const nextHop = normalizeBuilderIpv6(raw.nextHop);
    if (!neighbor || (neighbor.linkLocalAddress !== nextHop && neighbor.globalAddress !== nextHop)) throw new Error(`IPv6 static next hop ${nextHop} is not the neighbor address on ${link.id}.`);
    const metric = Number(raw.metric);
    if (!Number.isInteger(metric) || metric < 1 || metric > 999) throw new Error('IPv6 static route metric must be an integer from 1 to 999.');
    const id = String(raw.id ?? '').trim() || `ipv6-static:${raw.routerId}:${prefix}:${link.id}`.replace(/\//g, ':');
    if (ids.has(id)) throw new Error(`Duplicate IPv6 static route id ${id}.`); ids.add(id);
    const key = `${raw.routerId}\u0000${prefix}`; if (keys.has(key)) throw new Error(`${raw.routerId} already has an IPv6 static route for ${prefix}.`); keys.add(key);
    return { id, routerId: raw.routerId, prefix, nextHop, linkId: link.id, metric, description: String(raw.description ?? '').slice(0, 80) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.prefix.localeCompare(b.prefix) || a.id.localeCompare(b.id));
}

export function validateBuilderIpv6Config(graph: BuilderGraph, ipv4: BuilderAddressing, value: BuilderIpv6Config): BuilderIpv6Config {
  if (!value || typeof value !== 'object') throw new Error('Builder IPv6 config is invalid.');
  const addressing = validateBuilderIpv6Addressing(graph, ipv4, value.addressing);
  return { enabled: value.enabled === true, addressing, routing: { staticRoutes: validateStaticRoutes(graph, addressing, value.routing?.staticRoutes ?? []) } };
}

function baseAddressing(graph: BuilderGraph, ipv4: BuilderAddressing): BuilderIpv6Addressing {
  let addressing: BuilderIpv6Addressing = { segments: {}, defaultGateways: {} };
  for (const link of [...graph.links].sort((a, b) => a.id.localeCompare(b.id))) {
    const segment = makeSegment(ipv4, addressing, link);
    addressing = { ...addressing, segments: { ...addressing.segments, [link.id]: segment } };
  }
  for (const endpoint of graph.nodes.filter((node) => node.kind === 'endpoint')) addressing.defaultGateways[endpoint.id] = preferredDefaultGateway(graph, addressing, endpoint.id);
  return validateBuilderIpv6Addressing(graph, ipv4, addressing);
}

export function createDefaultBuilderIpv6Config(graph: BuilderGraph, ipv4: BuilderAddressing, enabled = true): BuilderIpv6Config {
  return { enabled, addressing: baseAddressing(graph, ipv4), routing: { staticRoutes: [] } };
}

export function createEmptyBuilderIpv6Config(graph: BuilderGraph, ipv4: BuilderAddressing): BuilderIpv6Config {
  return createDefaultBuilderIpv6Config(graph, ipv4, false);
}

export function reconcileBuilderIpv6Config(graph: BuilderGraph, ipv4: BuilderAddressing, current: BuilderIpv6Config): BuilderIpv6Config {
  const linkIds = new Set(graph.links.map((link) => link.id));
  let addressing: BuilderIpv6Addressing = {
    segments: Object.fromEntries(Object.entries(cloneBuilderIpv6Addressing(current.addressing).segments).filter(([linkId]) => linkIds.has(linkId))),
    defaultGateways: {},
  };
  for (const link of [...graph.links].sort((a, b) => a.id.localeCompare(b.id))) {
    const existing = addressing.segments[link.id];
    const endpointsMatch = existing && new Set(existing.interfaces.map((entry) => entry.nodeId)).size === 2 && existing.interfaces.every((entry) => entry.nodeId === link.a || entry.nodeId === link.b);
    if (!endpointsMatch) addressing.segments[link.id] = makeSegment(ipv4, addressing, link);
    else addressing.segments[link.id] = { ...existing, interfaces: existing.interfaces.map((entry) => ({ ...entry, name: ipv4InterfaceName(ipv4, link.id, entry.nodeId) })) as [BuilderIpv6InterfaceAddress, BuilderIpv6InterfaceAddress] };
  }
  for (const endpoint of graph.nodes.filter((node) => node.kind === 'endpoint')) {
    const prior = current.addressing.defaultGateways[endpoint.id] ?? null;
    addressing.defaultGateways[endpoint.id] = prior ? { ...prior } : null;
    try { validateBuilderIpv6Addressing(graph, ipv4, addressing); }
    catch { addressing.defaultGateways[endpoint.id] = preferredDefaultGateway(graph, addressing, endpoint.id); }
  }
  addressing = validateBuilderIpv6Addressing(graph, ipv4, addressing);
  const provisional = { enabled: current.enabled, addressing, routing: { staticRoutes: current.routing.staticRoutes.filter((route) => nodeById(graph, route.routerId)?.kind === 'router' && linkIds.has(route.linkId)) } };
  try { return validateBuilderIpv6Config(graph, ipv4, provisional); }
  catch {
    const staticRoutes = provisional.routing.staticRoutes.filter((route) => {
      try { validateStaticRoutes(graph, addressing, [route]); return true; } catch { return false; }
    });
    return validateBuilderIpv6Config(graph, ipv4, { ...provisional, routing: { staticRoutes } });
  }
}

export function interfacesForBuilderNodeIpv6(addressing: BuilderIpv6Addressing, nodeId: string): Array<BuilderIpv6InterfaceAddress & { linkId: string; prefix: string }> {
  return Object.values(addressing.segments).flatMap((segment) => segment.interfaces.filter((entry) => entry.nodeId === nodeId).map((entry) => ({ ...entry, linkId: segment.linkId, prefix: segment.prefix }))).sort((a, b) => a.name.localeCompare(b.name) || a.linkId.localeCompare(b.linkId));
}

export function primaryBuilderIpv6Address(addressing: BuilderIpv6Addressing, nodeId: string): string | null {
  return interfacesForBuilderNodeIpv6(addressing, nodeId)[0]?.globalAddress ?? null;
}

export function replaceBuilderIpv6DefaultGateway(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config, nodeId: string, gateway: BuilderIpv6DefaultGateway | null): BuilderIpv6Config {
  const next = cloneBuilderIpv6Config(config);
  next.addressing.defaultGateways[nodeId] = gateway ? { address: normalizeBuilderIpv6(gateway.address), linkId: gateway.linkId } : null;
  return validateBuilderIpv6Config(graph, ipv4, next);
}

export function nextHopOptionsForBuilderIpv6Router(graph: BuilderGraph, config: BuilderIpv6Config, routerId: string): BuilderIpv6NextHopOption[] {
  return graph.links.filter((link) => link.a === routerId || link.b === routerId).flatMap((link) => {
    const neighborId = link.a === routerId ? link.b : link.a;
    const neighbor = config.addressing.segments[link.id]?.interfaces.find((entry) => entry.nodeId === neighborId);
    const local = config.addressing.segments[link.id]?.interfaces.find((entry) => entry.nodeId === routerId);
    if (!neighbor || !local) return [];
    return [{ nodeId: neighborId, nodeLabel: nodeById(graph, neighborId)?.label ?? neighborId.toUpperCase(), linkId: link.id, interfaceName: local.name, address: neighbor.linkLocalAddress, globalAddress: neighbor.globalAddress, linkFailed: link.failed }];
  }).sort((a, b) => a.nodeLabel.localeCompare(b.nodeLabel) || a.linkId.localeCompare(b.linkId));
}

export function upsertBuilderIpv6StaticRoute(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config, input: Omit<BuilderIpv6StaticRoute, 'id'> & { id?: string }): BuilderIpv6Config {
  const prefix = parseBuilderIpv6Cidr(input.prefix).cidr;
  const id = input.id?.trim() || `ipv6-static:${input.routerId}:${prefix}`.replace(/\//g, ':');
  const next = cloneBuilderIpv6Config(config);
  next.routing.staticRoutes = [...next.routing.staticRoutes.filter((route) => route.id !== id && !(route.routerId === input.routerId && route.prefix === prefix)), { id, routerId: input.routerId, prefix, nextHop: input.nextHop, linkId: input.linkId, metric: input.metric, description: input.description }];
  return validateBuilderIpv6Config(graph, ipv4, next);
}

export function deleteBuilderIpv6StaticRoute(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config, routeId: string): BuilderIpv6Config {
  const next = cloneBuilderIpv6Config(config);
  next.routing.staticRoutes = next.routing.staticRoutes.filter((route) => route.id !== routeId);
  return validateBuilderIpv6Config(graph, ipv4, next);
}

export function clearBuilderIpv6StaticRoutes(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config): BuilderIpv6Config {
  return validateBuilderIpv6Config(graph, ipv4, { ...cloneBuilderIpv6Config(config), routing: { staticRoutes: [] } });
}

export function routeTableForBuilderIpv6Router(graph: BuilderGraph, config: BuilderIpv6Config, routerId: string): BuilderIpv6RouteTableEntry[] {
  if (!config.enabled || nodeById(graph, routerId)?.kind !== 'router') return [];
  const connected: BuilderIpv6RouteTableEntry[] = interfacesForBuilderNodeIpv6(config.addressing, routerId).map((entry) => {
    const link = linkById(graph, entry.linkId)!;
    return { id: `ipv6-connected:${routerId}:${entry.linkId}`, routerId, prefix: entry.prefix, prefixLength: 64, source: 'connected', administrativeDistance: 0, metric: 0, nextHop: null, outgoingInterface: entry.name, linkId: entry.linkId, active: !link.failed, stateNote: link.failed ? 'LINK DOWN' : 'DIRECT IPV6 /64' };
  });
  const statics: BuilderIpv6RouteTableEntry[] = config.routing.staticRoutes.filter((route) => route.routerId === routerId).map((route) => {
    const parsed = parseBuilderIpv6Cidr(route.prefix);
    const link = linkById(graph, route.linkId);
    const active = Boolean(link && !link.failed);
    const local = config.addressing.segments[route.linkId]?.interfaces.find((entry) => entry.nodeId === routerId);
    return { id: route.id, routerId, prefix: parsed.cidr, prefixLength: parsed.prefixLength, source: 'static', administrativeDistance: 1, metric: route.metric, nextHop: route.nextHop, outgoingInterface: local?.name ?? '—', linkId: route.linkId, active, stateNote: active ? (route.description || 'STATIC IPV6') : 'NEXT-HOP LINK DOWN' };
  });
  return [...connected, ...statics].sort((a, b) => b.prefixLength - a.prefixLength || a.administrativeDistance - b.administrativeDistance || a.metric - b.metric || a.id.localeCompare(b.id));
}

export function selectBuilderIpv6Route(entries: readonly BuilderIpv6RouteTableEntry[], destinationAddress: string): BuilderIpv6RouteTableEntry | null {
  return entries.filter((entry) => entry.active && builderIpv6PrefixContains(entry.prefix, destinationAddress)).sort((a, b) => b.prefixLength - a.prefixLength || a.administrativeDistance - b.administrativeDistance || a.metric - b.metric || a.id.localeCompare(b.id))[0] ?? null;
}

function failure(graph: BuilderGraph, sourceNodeId: string, destinationNodeId: string, sourceAddress: string | null, destinationAddress: string | null, hops: BuilderIpv6ForwardingHop[], failureNodeId: string | null, failureReason: string): BuilderIpv6ForwardingTrace {
  return { reachable: false, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, failureNodeId, failureReason, explanation: `${failureNodeId ? nodeById(graph, failureNodeId)?.label ?? failureNodeId : 'IPv6 forwarding'}: ${failureReason}` };
}

function ownerOfAddress(addressing: BuilderIpv6Addressing, address: string): { nodeId: string; linkId: string; interface: BuilderIpv6InterfaceAddress } | null {
  const normalized = normalizeBuilderIpv6(address);
  for (const segment of Object.values(addressing.segments)) {
    const found = segment.interfaces.find((entry) => entry.globalAddress === normalized || entry.linkLocalAddress === normalized);
    if (found) return { nodeId: found.nodeId, linkId: segment.linkId, interface: found };
  }
  return null;
}

export function traceBuilderIpv6Forwarding(graph: BuilderGraph, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string): BuilderIpv6ForwardingTrace {
  const sourceAddress = primaryBuilderIpv6Address(config.addressing, sourceNodeId);
  const destinationAddress = primaryBuilderIpv6Address(config.addressing, destinationNodeId);
  if (!config.enabled) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, [], sourceNodeId, 'IPv6 is disabled for this Builder scenario.');
  if (!nodeById(graph, sourceNodeId) || !nodeById(graph, destinationNodeId)) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, [], null, 'Source or destination node does not exist.');
  if (!sourceAddress || !destinationAddress) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, [], sourceNodeId, 'Source or destination has no global IPv6 interface address.');
  if (sourceNodeId === destinationNodeId) return { reachable: true, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops: [], failureNodeId: null, failureReason: null, explanation: 'IPv6 source and destination are the same node.' };
  const hops: BuilderIpv6ForwardingHop[] = [];
  const visited = new Set<string>();
  let currentNodeId = sourceNodeId;
  for (let step = 0; step < Math.max(8, graph.nodes.length * 2); step += 1) {
    if (currentNodeId === destinationNodeId) return { reachable: true, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, failureNodeId: null, failureReason: null, explanation: `IPv6 FIB forwarding reached ${nodeById(graph, destinationNodeId)?.label ?? destinationNodeId}.` };
    if (visited.has(currentNodeId)) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, 'IPv6 forwarding loop detected.');
    visited.add(currentNodeId);
    const current = nodeById(graph, currentNodeId)!;
    if (current.kind === 'endpoint') {
      const onLink = interfacesForBuilderNodeIpv6(config.addressing, currentNodeId).find((entry) => builderIpv6PrefixContains(entry.prefix, destinationAddress));
      if (onLink) {
        const link = linkById(graph, onLink.linkId);
        const owner = ownerOfAddress(config.addressing, destinationAddress);
        if (!link || link.failed) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `Direct IPv6 link ${onLink.linkId} is down.`);
        if (!owner || owner.linkId !== onLink.linkId) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `Destination ${destinationAddress} is on-link by prefix but is not assigned to the neighboring interface.`);
        hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: 'endpoint-local', matchedPrefix: onLink.prefix, nextHop: destinationAddress, outgoingInterface: onLink.name, linkId: onLink.linkId, nextNodeId: owner.nodeId });
        currentNodeId = owner.nodeId;
        continue;
      }
      const gateway = config.addressing.defaultGateways[currentNodeId] ?? null;
      if (!gateway) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, 'Off-link IPv6 destination has no configured default router.');
      const link = linkById(graph, gateway.linkId);
      const owner = ownerOfAddress(config.addressing, gateway.address);
      const local = config.addressing.segments[gateway.linkId]?.interfaces.find((entry) => entry.nodeId === currentNodeId);
      if (!link || link.failed) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `IPv6 default-router link ${gateway.linkId} is down.`);
      if (!owner || owner.linkId !== gateway.linkId || nodeById(graph, owner.nodeId)?.kind !== 'router') return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `IPv6 default router ${gateway.address} is unavailable.`);
      hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: 'default-router', matchedPrefix: '::/0', nextHop: gateway.address, outgoingInterface: local?.name ?? null, linkId: gateway.linkId, nextNodeId: owner.nodeId });
      currentNodeId = owner.nodeId;
      continue;
    }

    const selected = selectBuilderIpv6Route(routeTableForBuilderIpv6Router(graph, config, currentNodeId), destinationAddress);
    if (!selected) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `No active IPv6 route matches ${destinationAddress}.`);
    const link = linkById(graph, selected.linkId);
    if (!link || link.failed) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `Selected IPv6 route uses failed link ${selected.linkId}.`);
    let nextNodeId: string | null = null;
    let nextHop: string | null = selected.nextHop;
    if (selected.source === 'static') {
      const owner = selected.nextHop ? ownerOfAddress(config.addressing, selected.nextHop) : null;
      if (!owner || owner.linkId !== selected.linkId) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `Static IPv6 next hop ${selected.nextHop} cannot be resolved on ${selected.linkId}.`);
      nextNodeId = owner.nodeId;
    } else {
      const owner = ownerOfAddress(config.addressing, destinationAddress);
      if (!owner || owner.linkId !== selected.linkId) return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `Connected IPv6 route ${selected.prefix} does not contain the assigned destination interface on ${selected.linkId}.`);
      nextNodeId = owner.nodeId;
      nextHop = destinationAddress;
    }
    hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: selected.source, matchedPrefix: selected.prefix, nextHop, outgoingInterface: selected.outgoingInterface, linkId: selected.linkId, nextNodeId });
    currentNodeId = nextNodeId;
  }
  return failure(graph, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, 'IPv6 hop ceiling exceeded.');
}

function destinationPrefixForNode(config: BuilderIpv6Config, nodeId: string): string | null {
  return interfacesForBuilderNodeIpv6(config.addressing, nodeId)[0]?.prefix ?? null;
}

function installDirection(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string): BuilderIpv6Config {
  const path = findShortestPath(graph, sourceNodeId, destinationNodeId);
  if (!path.reachable || path.nodeIds.length < 2) throw new Error(`No live weighted graph path exists from ${sourceNodeId} to ${destinationNodeId}.`);
  const prefix = destinationPrefixForNode(config, destinationNodeId);
  if (!prefix) throw new Error(`${destinationNodeId} has no IPv6 destination prefix.`);
  let next = cloneBuilderIpv6Config(config);
  for (let index = 0; index < path.nodeIds.length - 1; index += 1) {
    const routerId = path.nodeIds[index];
    if (nodeById(graph, routerId)?.kind !== 'router') continue;
    const nextNodeId = path.nodeIds[index + 1];
    const linkId = path.linkIds[index];
    const neighbor = next.addressing.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nextNodeId);
    if (!neighbor) throw new Error(`Unable to resolve IPv6 next hop ${nextNodeId} on ${linkId}.`);
    const directlyConnected = builderIpv6PrefixContains(prefix, interfacesForBuilderNodeIpv6(next.addressing, routerId).find((entry) => entry.linkId === linkId)?.globalAddress ?? '::');
    if (nextNodeId === destinationNodeId && directlyConnected) continue;
    next = upsertBuilderIpv6StaticRoute(graph, ipv4, next, { routerId, prefix, nextHop: neighbor.linkLocalAddress, linkId, metric: 1, description: `Weighted-path snapshot toward ${nodeById(graph, destinationNodeId)?.label ?? destinationNodeId}` });
  }
  return next;
}

export function installBuilderIpv6BidirectionalStaticPath(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string): BuilderIpv6Config {
  if (!config.enabled) throw new Error('Enable IPv6 before installing an IPv6 static path.');
  return installDirection(graph, ipv4, installDirection(graph, ipv4, config, sourceNodeId, destinationNodeId), destinationNodeId, sourceNodeId);
}

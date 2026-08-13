from pathlib import Path

p = Path('src/builder/ipv6.ts')
s = p.read_text(encoding='utf-8')

def rep(old, new):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'expected 1 match, found {n}: {old[:120]!r}')
    s = s.replace(old, new, 1)

rep("export interface BuilderIpv6InterfaceAddress {\n  nodeId: string;\n  name: string;\n  globalAddress: string;\n  linkLocalAddress: string;\n}", "export interface BuilderIpv6InterfaceAddress {\n  nodeId: string;\n  name: string;\n  globalAddress: string;\n  linkLocalAddress: string;\n  addressOrigin: 'manual' | 'slaac';\n}")

rep("export interface BuilderIpv6RoutingConfig {\n  staticRoutes: BuilderIpv6StaticRoute[];\n}\n\nexport interface BuilderIpv6Config {\n  enabled: boolean;\n  addressing: BuilderIpv6Addressing;\n  routing: BuilderIpv6RoutingConfig;\n}", "export interface BuilderIpv6RoutingConfig {\n  staticRoutes: BuilderIpv6StaticRoute[];\n}\n\nexport interface BuilderIpv6AutoconfigConfig {\n  raEnabledRouterIds: string[];\n  slaacEndpointIds: string[];\n}\n\nexport interface BuilderOspfv3Config {\n  enabledRouterIds: string[];\n}\n\nexport interface BuilderIpv6Config {\n  enabled: boolean;\n  addressing: BuilderIpv6Addressing;\n  routing: BuilderIpv6RoutingConfig;\n  autoconfig: BuilderIpv6AutoconfigConfig;\n  ospfv3: BuilderOspfv3Config;\n}")

rep("  source: 'connected' | 'static';\n  administrativeDistance: 0 | 1;", "  source: 'connected' | 'static' | 'ospfv3';\n  administrativeDistance: 0 | 1 | 110;")
rep("  routeSource: 'endpoint-local' | 'default-router' | 'connected' | 'static';", "  routeSource: 'endpoint-local' | 'default-router' | 'connected' | 'static' | 'ospfv3';")

rep("      { nodeId: link.a, name: ipv4InterfaceName(ipv4, link.id, link.a), globalAddress: addressInPrefix(prefix, 1n), linkLocalAddress: linkLocalFor(segmentNumber, 1) },\n      { nodeId: link.b, name: ipv4InterfaceName(ipv4, link.id, link.b), globalAddress: addressInPrefix(prefix, 2n), linkLocalAddress: linkLocalFor(segmentNumber, 2) },", "      { nodeId: link.a, name: ipv4InterfaceName(ipv4, link.id, link.a), globalAddress: addressInPrefix(prefix, 1n), linkLocalAddress: linkLocalFor(segmentNumber, 1), addressOrigin: 'manual' },\n      { nodeId: link.b, name: ipv4InterfaceName(ipv4, link.id, link.b), globalAddress: addressInPrefix(prefix, 2n), linkLocalAddress: linkLocalFor(segmentNumber, 2), addressOrigin: 'manual' },")

rep("export function cloneBuilderIpv6Config(value: BuilderIpv6Config): BuilderIpv6Config {\n  return { enabled: value.enabled, addressing: cloneBuilderIpv6Addressing(value.addressing), routing: { staticRoutes: value.routing.staticRoutes.map((route) => ({ ...route })) } };\n}", "export function cloneBuilderIpv6Config(value: BuilderIpv6Config): BuilderIpv6Config {\n  return { enabled: value.enabled, addressing: cloneBuilderIpv6Addressing(value.addressing), routing: { staticRoutes: value.routing.staticRoutes.map((route) => ({ ...route })) }, autoconfig: { raEnabledRouterIds: [...value.autoconfig.raEnabledRouterIds], slaacEndpointIds: [...value.autoconfig.slaacEndpointIds] }, ospfv3: { enabledRouterIds: [...value.ospfv3.enabledRouterIds] } };\n}")

rep("      return { nodeId: entry.nodeId, name: expectedName, globalAddress, linkLocalAddress };", "      return { nodeId: entry.nodeId, name: expectedName, globalAddress, linkLocalAddress, addressOrigin: entry.addressOrigin === 'slaac' ? 'slaac' : 'manual' };")

rep("export function validateBuilderIpv6Config(graph: BuilderGraph, ipv4: BuilderAddressing, value: BuilderIpv6Config): BuilderIpv6Config {\n  if (!value || typeof value !== 'object') throw new Error('Builder IPv6 config is invalid.');\n  const addressing = validateBuilderIpv6Addressing(graph, ipv4, value.addressing);\n  return { enabled: value.enabled === true, addressing, routing: { staticRoutes: validateStaticRoutes(graph, addressing, value.routing?.staticRoutes ?? []) } };\n}", """function validateIpv6Autoconfig(graph: BuilderGraph, value: Partial<BuilderIpv6AutoconfigConfig> | undefined): BuilderIpv6AutoconfigConfig {
  const routers = new Set(graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id));
  const endpoints = new Set(graph.nodes.filter((node) => node.kind === 'endpoint').map((node) => node.id));
  const raEnabledRouterIds = [...new Set(value?.raEnabledRouterIds ?? [])].sort();
  const slaacEndpointIds = [...new Set(value?.slaacEndpointIds ?? [])].sort();
  if (raEnabledRouterIds.some((id) => !routers.has(id))) throw new Error('IPv6 RA enablement can reference routers only.');
  if (slaacEndpointIds.some((id) => !endpoints.has(id))) throw new Error('IPv6 SLAAC state can reference endpoints only.');
  return { raEnabledRouterIds, slaacEndpointIds };
}

function validateOspfv3Config(graph: BuilderGraph, value: Partial<BuilderOspfv3Config> | undefined): BuilderOspfv3Config {
  const routers = new Set(graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id));
  const enabledRouterIds = [...new Set(value?.enabledRouterIds ?? [])].sort();
  if (enabledRouterIds.some((id) => !routers.has(id))) throw new Error('OSPFv3 enablement can reference routers only.');
  return { enabledRouterIds };
}

export function validateBuilderIpv6Config(graph: BuilderGraph, ipv4: BuilderAddressing, value: BuilderIpv6Config): BuilderIpv6Config {
  if (!value || typeof value !== 'object') throw new Error('Builder IPv6 config is invalid.');
  const addressing = validateBuilderIpv6Addressing(graph, ipv4, value.addressing);
  return {
    enabled: value.enabled === true,
    addressing,
    routing: { staticRoutes: validateStaticRoutes(graph, addressing, value.routing?.staticRoutes ?? []) },
    autoconfig: validateIpv6Autoconfig(graph, value.autoconfig),
    ospfv3: validateOspfv3Config(graph, value.ospfv3),
  };
}""")

rep("export function createDefaultBuilderIpv6Config(graph: BuilderGraph, ipv4: BuilderAddressing, enabled = true): BuilderIpv6Config {\n  return { enabled, addressing: baseAddressing(graph, ipv4), routing: { staticRoutes: [] } };\n}", "export function createDefaultBuilderIpv6Config(graph: BuilderGraph, ipv4: BuilderAddressing, enabled = true): BuilderIpv6Config {\n  return { enabled, addressing: baseAddressing(graph, ipv4), routing: { staticRoutes: [] }, autoconfig: { raEnabledRouterIds: graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id).sort(), slaacEndpointIds: [] }, ospfv3: { enabledRouterIds: [] } };\n}")

rep("    else addressing.segments[link.id] = { ...existing, interfaces: existing.interfaces.map((entry) => ({ ...entry, name: ipv4InterfaceName(ipv4, link.id, entry.nodeId) })) as [BuilderIpv6InterfaceAddress, BuilderIpv6InterfaceAddress] };", "    else addressing.segments[link.id] = { ...existing, interfaces: existing.interfaces.map((entry) => ({ ...entry, name: ipv4InterfaceName(ipv4, link.id, entry.nodeId), addressOrigin: entry.addressOrigin === 'slaac' ? 'slaac' : 'manual' })) as [BuilderIpv6InterfaceAddress, BuilderIpv6InterfaceAddress] };")

rep("  const provisional = { enabled: current.enabled, addressing, routing: { staticRoutes: current.routing.staticRoutes.filter((route) => nodeById(graph, route.routerId)?.kind === 'router' && linkIds.has(route.linkId)) } };", "  const provisional = { enabled: current.enabled, addressing, routing: { staticRoutes: current.routing.staticRoutes.filter((route) => nodeById(graph, route.routerId)?.kind === 'router' && linkIds.has(route.linkId)) }, autoconfig: { raEnabledRouterIds: current.autoconfig.raEnabledRouterIds.filter((id) => nodeById(graph, id)?.kind === 'router'), slaacEndpointIds: current.autoconfig.slaacEndpointIds.filter((id) => nodeById(graph, id)?.kind === 'endpoint') }, ospfv3: { enabledRouterIds: current.ospfv3.enabledRouterIds.filter((id) => nodeById(graph, id)?.kind === 'router') } };")

anchor = "export function replaceBuilderIpv6DefaultGateway(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config, nodeId: string, gateway: BuilderIpv6DefaultGateway | null): BuilderIpv6Config {"
helpers = r'''export function builderIpv6SolicitedNodeMulticast(address: string): string {
  const low24 = parseIpv6AddressValue(address) & 0xffffffn;
  return formatIpv6Value(parseIpv6AddressValue('ff02::1:ff00:0') | low24);
}

export function builderIpv6SolicitedNodeMulticastMac(address: string): string {
  const low24 = Number(parseIpv6AddressValue(address) & 0xffffffn);
  return [0x33, 0x33, 0xff, (low24 >>> 16) & 0xff, (low24 >>> 8) & 0xff, low24 & 0xff].map((byte) => byte.toString(16).padStart(2, '0')).join(':');
}

function stableSlaacInterfaceId(endpointId: string, linkId: string): bigint {
  const text = `${endpointId}:${linkId}:slaac`;
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  hash = (hash & 0xfdffffffffffffffn) | 0x0200000000000000n;
  return hash === 0n || hash === 1n || hash === 2n ? hash + 0x100n : hash;
}

export function setBuilderIpv6RaRouterEnabled(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config, routerId: string, enabled: boolean): BuilderIpv6Config {
  if (nodeById(graph, routerId)?.kind !== 'router') throw new Error(`${routerId} is not a router.`);
  const next = cloneBuilderIpv6Config(config);
  next.autoconfig.raEnabledRouterIds = enabled ? [...new Set([...next.autoconfig.raEnabledRouterIds, routerId])].sort() : next.autoconfig.raEnabledRouterIds.filter((id) => id !== routerId);
  return validateBuilderIpv6Config(graph, ipv4, next);
}

export function applyBuilderIpv6Slaac(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config, endpointId: string, routerId: string, linkId: string): BuilderIpv6Config {
  if (!config.enabled) throw new Error('Enable IPv6 before running SLAAC.');
  if (nodeById(graph, endpointId)?.kind !== 'endpoint') throw new Error(`${endpointId} is not an endpoint.`);
  if (nodeById(graph, routerId)?.kind !== 'router') throw new Error(`${routerId} is not a router.`);
  if (!config.autoconfig.raEnabledRouterIds.includes(routerId)) throw new Error(`${routerId} is not sending Router Advertisements.`);
  const link = linkById(graph, linkId);
  if (!link || link.failed || ![link.a, link.b].includes(endpointId) || ![link.a, link.b].includes(routerId)) throw new Error(`${endpointId} and ${routerId} must share a live link.`);
  const next = cloneBuilderIpv6Config(config);
  const segment = next.addressing.segments[linkId];
  const endpointInterface = segment?.interfaces.find((entry) => entry.nodeId === endpointId);
  const routerInterface = segment?.interfaces.find((entry) => entry.nodeId === routerId);
  if (!segment || !endpointInterface || !routerInterface) throw new Error('SLAAC requires endpoint and router IPv6 interfaces on the same /64.');
  endpointInterface.globalAddress = addressInPrefix(segment.prefix, stableSlaacInterfaceId(endpointId, linkId));
  endpointInterface.addressOrigin = 'slaac';
  next.addressing.defaultGateways[endpointId] = { address: routerInterface.linkLocalAddress, linkId };
  next.autoconfig.slaacEndpointIds = [...new Set([...next.autoconfig.slaacEndpointIds, endpointId])].sort();
  return validateBuilderIpv6Config(graph, ipv4, next);
}

export function setBuilderOspfv3RouterEnabled(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config, routerId: string, enabled: boolean): BuilderIpv6Config {
  if (nodeById(graph, routerId)?.kind !== 'router') throw new Error(`${routerId} is not a router.`);
  const next = cloneBuilderIpv6Config(config);
  next.ospfv3.enabledRouterIds = enabled ? [...new Set([...next.ospfv3.enabledRouterIds, routerId])].sort() : next.ospfv3.enabledRouterIds.filter((id) => id !== routerId);
  return validateBuilderIpv6Config(graph, ipv4, next);
}

export function setBuilderOspfv3Everywhere(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config, enabled: boolean): BuilderIpv6Config {
  const next = cloneBuilderIpv6Config(config);
  next.ospfv3.enabledRouterIds = enabled ? graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id).sort() : [];
  return validateBuilderIpv6Config(graph, ipv4, next);
}

'''
rep(anchor, helpers + anchor)

route_anchor = "export function routeTableForBuilderIpv6Router(graph: BuilderGraph, config: BuilderIpv6Config, routerId: string): BuilderIpv6RouteTableEntry[] {"
ospf = r'''export interface BuilderOspfv3Adjacency {
  id: string;
  aRouterId: string;
  bRouterId: string;
  linkId: string;
  state: 'FULL' | 'DOWN';
  cost: number;
  reason: string;
}

export interface BuilderOspfv3Advertisement { routerId: string; prefix: string; linkId: string; }
export interface BuilderOspfv3State { enabledRouterIds: string[]; adjacencies: BuilderOspfv3Adjacency[]; advertisements: BuilderOspfv3Advertisement[]; fullAdjacencyCount: number; }

export function builderOspfv3State(graph: BuilderGraph, config: BuilderIpv6Config): BuilderOspfv3State {
  const enabled = new Set(config.enabled ? config.ospfv3.enabledRouterIds : []);
  const adjacencies = graph.links.flatMap((link): BuilderOspfv3Adjacency[] => {
    if (nodeById(graph, link.a)?.kind !== 'router' || nodeById(graph, link.b)?.kind !== 'router' || !enabled.has(link.a) || !enabled.has(link.b)) return [];
    return [{ id: `ospfv3:${link.id}`, aRouterId: link.a, bRouterId: link.b, linkId: link.id, state: link.failed ? 'DOWN' : 'FULL', cost: link.cost, reason: link.failed ? 'LINK DOWN' : 'LINK-LOCAL HELLO + DATABASE SYNC' }];
  }).sort((a, b) => a.linkId.localeCompare(b.linkId));
  const advertisements = [...enabled].flatMap((routerId) => interfacesForBuilderNodeIpv6(config.addressing, routerId).map((entry) => ({ routerId, prefix: entry.prefix, linkId: entry.linkId }))).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.prefix.localeCompare(b.prefix));
  return { enabledRouterIds: [...enabled].sort(), adjacencies, advertisements, fullAdjacencyCount: adjacencies.filter((entry) => entry.state === 'FULL').length };
}

function ospfv3RoutesForRouter(graph: BuilderGraph, config: BuilderIpv6Config, routerId: string): BuilderIpv6RouteTableEntry[] {
  const state = builderOspfv3State(graph, config);
  if (!state.enabledRouterIds.includes(routerId)) return [];
  const enabled = new Set(state.enabledRouterIds);
  const ospfGraph: BuilderGraph = {
    nodes: graph.nodes.filter((node) => node.kind === 'router' && enabled.has(node.id)),
    links: graph.links.filter((link) => !link.failed && enabled.has(link.a) && enabled.has(link.b) && nodeById(graph, link.a)?.kind === 'router' && nodeById(graph, link.b)?.kind === 'router'),
  };
  const localPrefixes = new Set(interfacesForBuilderNodeIpv6(config.addressing, routerId).map((entry) => entry.prefix));
  const best = new Map<string, BuilderIpv6RouteTableEntry>();
  for (const advertisement of state.advertisements) {
    if (advertisement.routerId === routerId || localPrefixes.has(advertisement.prefix)) continue;
    const path = findShortestPath(ospfGraph, routerId, advertisement.routerId);
    if (!path.reachable || path.nodeIds.length < 2 || path.linkIds.length < 1 || path.totalCost == null) continue;
    const firstLinkId = path.linkIds[0];
    const nextRouterId = path.nodeIds[1];
    const nextHop = config.addressing.segments[firstLinkId]?.interfaces.find((entry) => entry.nodeId === nextRouterId)?.linkLocalAddress;
    const local = config.addressing.segments[firstLinkId]?.interfaces.find((entry) => entry.nodeId === routerId);
    if (!nextHop || !local) continue;
    const advertisedLink = linkById(graph, advertisement.linkId);
    const otherNodeId = advertisedLink ? (advertisedLink.a === advertisement.routerId ? advertisedLink.b : advertisedLink.a) : null;
    const stubCost = otherNodeId && nodeById(graph, otherNodeId)?.kind === 'endpoint' ? advertisedLink?.cost ?? 0 : 0;
    const parsed = parseBuilderIpv6Cidr(advertisement.prefix);
    const candidate: BuilderIpv6RouteTableEntry = { id: `ospfv3-route:${routerId}:${parsed.cidr}:${nextRouterId}`, routerId, prefix: parsed.cidr, prefixLength: parsed.prefixLength, source: 'ospfv3', administrativeDistance: 110, metric: path.totalCost + stubCost, nextHop, outgoingInterface: local.name, linkId: firstLinkId, active: true, stateNote: `OSPFV3 AREA 0 · ADV ${advertisement.routerId.toUpperCase()}` };
    const prior = best.get(candidate.prefix);
    if (!prior || candidate.metric < prior.metric || (candidate.metric === prior.metric && (candidate.nextHop ?? '') < (prior.nextHop ?? ''))) best.set(candidate.prefix, candidate);
  }
  return [...best.values()];
}

'''
rep(route_anchor, ospf + route_anchor)
rep("  return [...connected, ...statics].sort((a, b) => b.prefixLength - a.prefixLength || a.administrativeDistance - b.administrativeDistance || a.metric - b.metric || a.id.localeCompare(b.id));", "  const ospfv3 = ospfv3RoutesForRouter(graph, config, routerId);\n  return [...connected, ...statics, ...ospfv3].sort((a, b) => b.prefixLength - a.prefixLength || a.administrativeDistance - b.administrativeDistance || a.metric - b.metric || a.id.localeCompare(b.id));")
rep("    if (selected.source === 'static') {", "    if (selected.source === 'static' || selected.source === 'ospfv3') {")

p.write_text(s, encoding='utf-8')
print('Patched IPv6 model for address origins, RA/SLAAC, and OSPFv3.')

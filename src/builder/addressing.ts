import type { BuilderGraph, BuilderLink } from './model.ts';

export interface BuilderInterfaceAddress {
  nodeId: string;
  name: string;
  address: string;
}

export interface BuilderSegmentAddressing {
  linkId: string;
  cidr: string;
  interfaces: [BuilderInterfaceAddress, BuilderInterfaceAddress];
}

export interface BuilderAddressing {
  segments: Record<string, BuilderSegmentAddressing>;
  defaultGateways: Record<string, string | null>;
}

export interface BuilderIpv4Cidr {
  cidr: string;
  address: string;
  prefixLength: number;
  networkAddress: string;
  broadcastAddress: string;
  network: number;
  broadcast: number;
}

const PRIVATE_PLAN_BASE = ipv4ToInt('10.0.0.0');
const MAX_POINT_TO_POINT_SEGMENTS = 16_384;

function ipv4ToInt(value: string): number {
  const parts = value.split('.');
  if (parts.length !== 4) throw new Error(`Invalid IPv4 address: ${value}.`);
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) throw new Error(`Invalid IPv4 address: ${value}.`);
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) throw new Error(`Invalid IPv4 address: ${value}.`);
    result = ((result << 8) | octet) >>> 0;
  }
  return result >>> 0;
}

function intToIpv4(value: number): string {
  const normalized = value >>> 0;
  return [24, 16, 8, 0].map((shift) => (normalized >>> shift) & 255).join('.');
}

function maskForPrefix(prefixLength: number): number {
  if (!Number.isInteger(prefixLength) || prefixLength < 8 || prefixLength > 30) {
    throw new Error('Builder IPv4 prefixes must be /8 through /30.');
  }
  return prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
}

export function parseBuilderIpv4Cidr(value: string): BuilderIpv4Cidr {
  const normalized = value.trim();
  const [addressText, prefixText, ...extra] = normalized.split('/');
  if (!addressText || !prefixText || extra.length > 0 || !/^\d{1,2}$/.test(prefixText)) {
    throw new Error(`Invalid IPv4 CIDR: ${value}.`);
  }
  const address = ipv4ToInt(addressText);
  const prefixLength = Number(prefixText);
  const mask = maskForPrefix(prefixLength);
  const network = (address & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return {
    cidr: `${intToIpv4(network)}/${prefixLength}`,
    address: intToIpv4(address),
    prefixLength,
    networkAddress: intToIpv4(network),
    broadcastAddress: intToIpv4(broadcast),
    network,
    broadcast,
  };
}

export function normalizeBuilderIpv4(value: string): string {
  return intToIpv4(ipv4ToInt(value.trim()));
}

export function builderIpv4IsUsableInCidr(address: string, cidr: string): boolean {
  const parsed = parseBuilderIpv4Cidr(cidr);
  const numeric = ipv4ToInt(address.trim());
  return numeric > parsed.network && numeric < parsed.broadcast;
}

function cidrsOverlap(left: string, right: string): boolean {
  const a = parseBuilderIpv4Cidr(left);
  const b = parseBuilderIpv4Cidr(right);
  return a.network <= b.broadcast && b.network <= a.broadcast;
}

function cloneInterface(value: BuilderInterfaceAddress): BuilderInterfaceAddress {
  return { nodeId: value.nodeId, name: value.name, address: value.address };
}

export function cloneBuilderAddressing(addressing: BuilderAddressing): BuilderAddressing {
  return {
    segments: Object.fromEntries(Object.entries(addressing.segments).map(([linkId, segment]) => [linkId, {
      linkId: segment.linkId,
      cidr: segment.cidr,
      interfaces: [cloneInterface(segment.interfaces[0]), cloneInterface(segment.interfaces[1])],
    }])),
    defaultGateways: { ...addressing.defaultGateways },
  };
}

function linkEndpoints(link: BuilderLink): Set<string> {
  return new Set([link.a, link.b]);
}

function validateInterfaceName(value: string, nodeId: string): string {
  const normalized = value.trim();
  if (!/^eth\d+$/.test(normalized)) throw new Error(`${nodeId} interface names must use ethN notation.`);
  return normalized;
}

export function validateBuilderAddressing(graph: BuilderGraph, value: BuilderAddressing): BuilderAddressing {
  if (!value || typeof value !== 'object' || !value.segments || !value.defaultGateways) throw new Error('Builder addressing must contain segments and default gateways.');
  const linkIds = new Set(graph.links.map((link) => link.id));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const segmentKeys = Object.keys(value.segments);
  if (segmentKeys.length !== graph.links.length || segmentKeys.some((linkId) => !linkIds.has(linkId))) {
    throw new Error('Builder addressing must define exactly one IPv4 segment for every graph link.');
  }

  const segments: Record<string, BuilderSegmentAddressing> = {};
  const cidrs: Array<{ linkId: string; cidr: string }> = [];
  const globalAddresses = new Map<string, string>();
  const interfaceNamesByNode = new Map<string, Set<string>>();

  for (const link of graph.links) {
    const raw = value.segments[link.id];
    if (!raw || raw.linkId !== link.id || !Array.isArray(raw.interfaces) || raw.interfaces.length !== 2) {
      throw new Error(`Link ${link.id} must have one two-interface IPv4 segment.`);
    }
    const parsedCidr = parseBuilderIpv4Cidr(raw.cidr);
    const expectedEndpoints = linkEndpoints(link);
    const seenEndpoints = new Set<string>();
    const interfaces = raw.interfaces.map((rawInterface): BuilderInterfaceAddress => {
      if (!expectedEndpoints.has(rawInterface.nodeId) || seenEndpoints.has(rawInterface.nodeId)) {
        throw new Error(`Segment ${link.id} interfaces must match graph endpoints ${link.a} and ${link.b} exactly.`);
      }
      seenEndpoints.add(rawInterface.nodeId);
      const name = validateInterfaceName(rawInterface.name, rawInterface.nodeId);
      const address = normalizeBuilderIpv4(rawInterface.address);
      if (!builderIpv4IsUsableInCidr(address, parsedCidr.cidr)) {
        throw new Error(`${rawInterface.nodeId} ${name} address ${address} is not a usable host in ${parsedCidr.cidr}.`);
      }
      const priorAddressOwner = globalAddresses.get(address);
      if (priorAddressOwner) throw new Error(`IPv4 address ${address} is already assigned to ${priorAddressOwner}.`);
      globalAddresses.set(address, `${rawInterface.nodeId} ${name}`);
      const names = interfaceNamesByNode.get(rawInterface.nodeId) ?? new Set<string>();
      if (names.has(name)) throw new Error(`${rawInterface.nodeId} has duplicate interface name ${name}.`);
      names.add(name);
      interfaceNamesByNode.set(rawInterface.nodeId, names);
      return { nodeId: rawInterface.nodeId, name, address };
    }) as [BuilderInterfaceAddress, BuilderInterfaceAddress];
    segments[link.id] = { linkId: link.id, cidr: parsedCidr.cidr, interfaces };
    cidrs.push({ linkId: link.id, cidr: parsedCidr.cidr });
  }

  for (let index = 0; index < cidrs.length; index += 1) {
    for (let other = index + 1; other < cidrs.length; other += 1) {
      if (cidrsOverlap(cidrs[index].cidr, cidrs[other].cidr)) {
        throw new Error(`IPv4 segments ${cidrs[index].linkId} (${cidrs[index].cidr}) and ${cidrs[other].linkId} (${cidrs[other].cidr}) overlap.`);
      }
    }
  }

  const defaultGateways: Record<string, string | null> = {};
  const endpointIds = graph.nodes.filter((node) => node.kind === 'endpoint').map((node) => node.id);
  for (const [nodeId] of Object.entries(value.defaultGateways)) {
    const node = nodeById.get(nodeId);
    if (!node || node.kind !== 'endpoint') throw new Error(`Default gateway is only valid for endpoint nodes; ${nodeId} is not an endpoint.`);
  }
  for (const nodeId of endpointIds) {
    const rawGateway = value.defaultGateways[nodeId] ?? null;
    if (rawGateway === null) {
      defaultGateways[nodeId] = null;
      continue;
    }
    const gateway = normalizeBuilderIpv4(rawGateway);
    const directlyConnectedRouterAddresses = graph.links.flatMap((link) => {
      if (link.a !== nodeId && link.b !== nodeId) return [];
      const neighborId = link.a === nodeId ? link.b : link.a;
      if (nodeById.get(neighborId)?.kind !== 'router') return [];
      const segment = segments[link.id];
      return segment.interfaces.filter((entry) => entry.nodeId === neighborId).map((entry) => entry.address);
    });
    if (!directlyConnectedRouterAddresses.includes(gateway)) {
      throw new Error(`${nodeId} default gateway ${gateway} must be the address of a directly connected router interface.`);
    }
    defaultGateways[nodeId] = gateway;
  }

  return { segments, defaultGateways };
}

function nextInterfaceName(addressing: BuilderAddressing, nodeId: string): string {
  const used = new Set(Object.values(addressing.segments).flatMap((segment) => segment.interfaces.filter((entry) => entry.nodeId === nodeId).map((entry) => entry.name)));
  let index = 0;
  while (used.has(`eth${index}`)) index += 1;
  return `eth${index}`;
}

function nextFreePrivateCidr(addressing: BuilderAddressing): string {
  const used = new Set(Object.values(addressing.segments).map((segment) => parseBuilderIpv4Cidr(segment.cidr).network));
  for (let index = 0; index < MAX_POINT_TO_POINT_SEGMENTS; index += 1) {
    const network = (PRIVATE_PLAN_BASE + index * 4) >>> 0;
    if (!used.has(network)) return `${intToIpv4(network)}/30`;
  }
  throw new Error('No free deterministic private /30 remains in the Builder address plan.');
}

function makeSegment(addressing: BuilderAddressing, link: BuilderLink): BuilderSegmentAddressing {
  const cidr = nextFreePrivateCidr(addressing);
  const parsed = parseBuilderIpv4Cidr(cidr);
  return {
    linkId: link.id,
    cidr,
    interfaces: [
      { nodeId: link.a, name: nextInterfaceName(addressing, link.a), address: intToIpv4(parsed.network + 1) },
      { nodeId: link.b, name: nextInterfaceName(addressing, link.b), address: intToIpv4(parsed.network + 2) },
    ],
  };
}

function preferredGatewayForEndpoint(graph: BuilderGraph, addressing: BuilderAddressing, nodeId: string): string | null {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const candidateLinks = graph.links.filter((link) => link.a === nodeId || link.b === nodeId).sort((a, b) => a.id.localeCompare(b.id));
  for (const link of candidateLinks) {
    const neighborId = link.a === nodeId ? link.b : link.a;
    if (nodeById.get(neighborId)?.kind !== 'router') continue;
    const neighbor = addressing.segments[link.id]?.interfaces.find((entry) => entry.nodeId === neighborId);
    if (neighbor) return neighbor.address;
  }
  return null;
}

export function createDefaultBuilderAddressing(graph: BuilderGraph): BuilderAddressing {
  let addressing: BuilderAddressing = { segments: {}, defaultGateways: {} };
  for (const link of [...graph.links].sort((a, b) => a.id.localeCompare(b.id))) {
    const segment = makeSegment(addressing, link);
    addressing = { ...addressing, segments: { ...addressing.segments, [link.id]: segment } };
  }
  for (const node of graph.nodes.filter((entry) => entry.kind === 'endpoint')) {
    addressing.defaultGateways[node.id] = preferredGatewayForEndpoint(graph, addressing, node.id);
  }
  return validateBuilderAddressing(graph, addressing);
}

export function reconcileBuilderAddressing(graph: BuilderGraph, current: BuilderAddressing): BuilderAddressing {
  const linkIds = new Set(graph.links.map((link) => link.id));
  let next: BuilderAddressing = {
    segments: Object.fromEntries(Object.entries(cloneBuilderAddressing(current).segments).filter(([linkId]) => linkIds.has(linkId))),
    defaultGateways: {},
  };
  for (const link of [...graph.links].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!next.segments[link.id]) next.segments[link.id] = makeSegment(next, link);
  }
  for (const node of graph.nodes.filter((entry) => entry.kind === 'endpoint')) {
    const prior = current.defaultGateways[node.id] ?? null;
    next.defaultGateways[node.id] = prior;
    try {
      validateBuilderAddressing(graph, next);
    } catch {
      next.defaultGateways[node.id] = preferredGatewayForEndpoint(graph, next, node.id);
    }
  }
  return validateBuilderAddressing(graph, next);
}

export function replaceBuilderSegmentCidr(graph: BuilderGraph, addressing: BuilderAddressing, linkId: string, cidr: string): BuilderAddressing {
  const current = addressing.segments[linkId];
  if (!current) throw new Error(`Unknown Builder segment ${linkId}.`);
  const parsed = parseBuilderIpv4Cidr(cidr);
  const next = cloneBuilderAddressing(addressing);
  next.segments[linkId] = {
    ...current,
    cidr: parsed.cidr,
    interfaces: [
      { ...current.interfaces[0], address: intToIpv4(parsed.network + 1) },
      { ...current.interfaces[1], address: intToIpv4(parsed.network + 2) },
    ],
  };
  for (const node of graph.nodes.filter((entry) => entry.kind === 'endpoint')) {
    const gateway = next.defaultGateways[node.id];
    if (gateway && current.interfaces.some((entry) => entry.address === gateway)) {
      next.defaultGateways[node.id] = preferredGatewayForEndpoint(graph, next, node.id);
    }
  }
  return validateBuilderAddressing(graph, next);
}

export function replaceBuilderInterfaceAddress(graph: BuilderGraph, addressing: BuilderAddressing, linkId: string, nodeId: string, address: string): BuilderAddressing {
  const segment = addressing.segments[linkId];
  if (!segment) throw new Error(`Unknown Builder segment ${linkId}.`);
  if (!segment.interfaces.some((entry) => entry.nodeId === nodeId)) throw new Error(`${nodeId} is not attached to segment ${linkId}.`);
  const normalized = normalizeBuilderIpv4(address);
  const next = cloneBuilderAddressing(addressing);
  next.segments[linkId] = {
    ...segment,
    interfaces: segment.interfaces.map((entry) => entry.nodeId === nodeId ? { ...entry, address: normalized } : { ...entry }) as [BuilderInterfaceAddress, BuilderInterfaceAddress],
  };
  for (const endpoint of graph.nodes.filter((entry) => entry.kind === 'endpoint')) {
    if (next.defaultGateways[endpoint.id] === segment.interfaces.find((entry) => entry.nodeId === nodeId)?.address) {
      next.defaultGateways[endpoint.id] = normalized;
    }
  }
  return validateBuilderAddressing(graph, next);
}

export function replaceBuilderDefaultGateway(graph: BuilderGraph, addressing: BuilderAddressing, nodeId: string, gateway: string | null): BuilderAddressing {
  const next = cloneBuilderAddressing(addressing);
  next.defaultGateways[nodeId] = gateway === null || gateway.trim() === '' ? null : normalizeBuilderIpv4(gateway);
  return validateBuilderAddressing(graph, next);
}

export function interfacesForBuilderNode(addressing: BuilderAddressing, nodeId: string): Array<BuilderInterfaceAddress & { linkId: string; cidr: string }> {
  return Object.values(addressing.segments)
    .flatMap((segment) => segment.interfaces.filter((entry) => entry.nodeId === nodeId).map((entry) => ({ ...entry, linkId: segment.linkId, cidr: segment.cidr })))
    .sort((a, b) => a.name.localeCompare(b.name) || a.linkId.localeCompare(b.linkId));
}

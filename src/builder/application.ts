import { interfacesForBuilderNode, replaceBuilderInterfaceAddress, type BuilderAddressing } from './addressing.ts';
import { traceBuilderPolicy, type BuilderAclConfig } from './acl.ts';
import { resolveBuilderArp, type BuilderArpCache, type BuilderArpResolution } from './arp.ts';
import { applyBuilderDhcpState, builderDhcpClientReady, runBuilderDhcpAcquire, type BuilderDhcpConfig, type BuilderDhcpLeaseTable, type BuilderDhcpTransaction } from './dhcp.ts';
import { builderEthernetPathForVlan, type BuilderEthernetConfig, type BuilderEthernetDevice } from './ethernet.ts';
import { resolveBuilderIpv6TraceNeighbors, type BuilderIpv6ControlState, type BuilderIpv6NdResolution } from './ipv6-control-plane.ts';
import { builderOspfv3DepthRouteOverlay, evaluateBuilderIpv6TracePolicy, type BuilderIpv6RoutingDepthState } from './ipv6-routing-depth.ts';
import { primaryBuilderIpv6Address, traceBuilderIpv6Forwarding, type BuilderIpv6Config, type BuilderIpv6ForwardingTrace } from './ipv6.ts';
import { builderPathCharacteristics, builderRoundTripCharacteristics, deterministicBuilderPathDrop, type BuilderLinkProfiles } from './link-characteristics.ts';
import type { BuilderGraph } from './model.ts';
import { runBuilderNatInboundFlow, runBuilderNatOutboundFlow, type BuilderNatConfig, type BuilderNatFlowResult, type BuilderNatSessionTable } from './nat.ts';
import { traceBuilderForwarding, type BuilderForwardingTrace, type BuilderRoutingConfig } from './routing.ts';
import { builderStpState, createDefaultBuilderStpConfig, type BuilderStpState } from './stp.ts';
import { buildJourneyScenario, type JourneyEvent, type JourneyTransportProfile } from '../journey/model.ts';
import { buildPacket, type PacketConfig, type PacketSnapshot } from '../packet/model.ts';

export type BuilderApplicationFamily = 'ipv4' | 'ipv6';
export type BuilderServiceKind = 'dns' | 'http' | 'https' | 'ssh' | 'tcp' | 'udp';
export type BuilderApplicationStageStatus = 'PASS' | 'FAIL' | 'NOT_REACHED';
export type BuilderApplicationTruthBoundary = 'ADDRESSING' | 'DNS' | 'L2' | 'RESOLUTION' | 'ROUTING' | 'POLICY_NAT' | 'LINK' | 'TRANSPORT' | 'TLS' | 'APPLICATION' | 'RESPONSE';
export type BuilderApplicationCamera = 'BUILDER' | 'PROTOCOL' | 'JOURNEY' | 'PACKET';

export interface BuilderHostedService {
  id: string;
  nodeId: string;
  kind: BuilderServiceKind;
  label: string;
  hostname: string | null;
  port: number;
  enabled: boolean;
  transportProfile: JourneyTransportProfile | null;
  responseBytes: number;
}

export interface BuilderApplicationStage {
  id: string;
  order: number;
  boundary: BuilderApplicationTruthBoundary;
  label: string;
  status: BuilderApplicationStageStatus;
  summary: string;
  detail: string;
  nodeIds: string[];
  linkIds: string[];
  provenance: 'SIMULATED';
}

export interface BuilderApplicationPacket {
  id: string;
  label: string;
  direction: 'REQUEST' | 'RESPONSE';
  vantage: 'SOURCE_ACCESS' | 'POST_NAT' | 'DESTINATION_ACCESS';
  config: PacketConfig;
  snapshot: PacketSnapshot;
  sourceStageId: string;
  provenance: 'SIMULATED';
}

export interface BuilderApplicationProjection {
  camera: BuilderApplicationCamera;
  label: string;
  eventIds: string[];
  packetIds: string[];
  provenance: 'SIMULATED';
}

export interface BuilderApplicationL2Evidence {
  sourceMode: 'CONFIGURED ETHERNET' | 'ROUTED ACCESS PROJECTION' | 'NONE';
  destinationMode: 'CONFIGURED ETHERNET' | 'ROUTED ACCESS PROJECTION' | 'NONE';
  sourceResolution: BuilderArpResolution | null;
  destinationResolution: BuilderArpResolution | null;
  sourceStp: BuilderStpState | null;
  destinationStp: BuilderStpState | null;
  sourceVlan: number | null;
  destinationVlan: number | null;
}

export interface BuilderApplicationTransaction {
  id: string;
  sequence: number;
  service: BuilderHostedService;
  family: BuilderApplicationFamily;
  sourceNodeId: string;
  destinationNodeId: string;
  sourceAddress: string | null;
  destinationAddress: string | null;
  success: boolean;
  firstBrokenBoundary: BuilderApplicationTruthBoundary | null;
  summary: string;
  stages: BuilderApplicationStage[];
  protocolEvents: JourneyEvent[];
  packets: BuilderApplicationPacket[];
  projections: BuilderApplicationProjection[];
  ipv4Forwarding: BuilderForwardingTrace | null;
  ipv6Forwarding: BuilderIpv6ForwardingTrace | null;
  natRequest: BuilderNatFlowResult | null;
  natResponse: BuilderNatFlowResult | null;
  l2: BuilderApplicationL2Evidence;
  dhcpTransaction: BuilderDhcpTransaction | null;
  arpCache: BuilderArpCache;
  natSessions: BuilderNatSessionTable;
  dhcpLeases: BuilderDhcpLeaseTable;
  ipv6ControlState: BuilderIpv6ControlState;
  boundary: string;
}

export interface BuilderApplicationContext {
  graph: BuilderGraph;
  addressing: BuilderAddressing;
  routing: BuilderRoutingConfig;
  ethernet: BuilderEthernetConfig;
  linkProfiles: BuilderLinkProfiles;
  acl: BuilderAclConfig;
  nat: BuilderNatConfig;
  natSessions: BuilderNatSessionTable;
  dhcp: BuilderDhcpConfig;
  dhcpLeases: BuilderDhcpLeaseTable;
  dhcpSequence: number;
  ipv6: BuilderIpv6Config;
  ipv6ControlState: BuilderIpv6ControlState;
  ipv6RoutingDepth: BuilderIpv6RoutingDepthState;
  arpCache: BuilderArpCache;
}

const MAX_SERVICES = 96;
const MAX_PROTOCOL_EVENTS = 48;
const DEFAULT_SOURCE_PORT = 49152;
const PACKET_PAYLOAD_BYTES = 96;

function stableHash(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619) >>> 0; }
  return hash >>> 0;
}

function stableMac(nodeId: string, salt: string): string {
  const hash = stableHash(`${nodeId}:${salt}`);
  return [0x02, 0x48, 0x44, (hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff].map((value) => value.toString(16).padStart(2, '0')).join(':');
}

function normalizeHostname(value: string | null): string | null {
  if (value == null || value.trim() === '') return null;
  const normalized = value.trim().toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(normalized) || !normalized.includes('.')) throw new Error(`Invalid Builder service hostname ${value}.`);
  return normalized;
}

function defaultPort(kind: BuilderServiceKind): number {
  if (kind === 'dns') return 53;
  if (kind === 'http') return 80;
  if (kind === 'https') return 443;
  if (kind === 'ssh') return 22;
  if (kind === 'tcp') return 9000;
  return 9001;
}

export function validateBuilderHostedServices(graph: BuilderGraph, services: readonly BuilderHostedService[]): BuilderHostedService[] {
  if (services.length > MAX_SERVICES) throw new Error(`Builder supports at most ${MAX_SERVICES} hosted services.`);
  const endpointIds = new Set(graph.nodes.filter((node) => node.kind === 'endpoint').map((node) => node.id));
  const ids = new Set<string>();
  return services.map((raw, index) => {
    if (!raw || !/^[a-zA-Z0-9_.:-]+$/.test(raw.id) || ids.has(raw.id)) throw new Error(`Hosted service ${index + 1} has an invalid or duplicate id.`);
    if (!endpointIds.has(raw.nodeId)) throw new Error(`Hosted service ${raw.id} must belong to a Builder endpoint.`);
    if (!['dns', 'http', 'https', 'ssh', 'tcp', 'udp'].includes(raw.kind)) throw new Error(`Hosted service ${raw.id} has an unsupported kind.`);
    if (!Number.isInteger(raw.port) || raw.port < 1 || raw.port > 65535) throw new Error(`Hosted service ${raw.id} port must be 1–65535.`);
    if (!Number.isInteger(raw.responseBytes) || raw.responseBytes < 0 || raw.responseBytes > 16 * 1024 * 1024) throw new Error(`Hosted service ${raw.id} responseBytes is outside the bounded 0–16 MiB range.`);
    const transportProfile: JourneyTransportProfile | null = raw.kind === 'https' ? (raw.transportProfile === 'quic-h3' ? 'quic-h3' : 'tcp-h2') : raw.transportProfile === 'quic-h3' ? 'quic-h3' : raw.transportProfile === 'tcp-h2' ? 'tcp-h2' : null;
    ids.add(raw.id);
    return { id: raw.id, nodeId: raw.nodeId, kind: raw.kind, label: String(raw.label || raw.kind.toUpperCase()).slice(0, 80), hostname: normalizeHostname(raw.hostname), port: raw.port, enabled: raw.enabled !== false, transportProfile, responseBytes: raw.responseBytes };
  }).sort((left, right) => left.nodeId.localeCompare(right.nodeId) || left.port - right.port || left.id.localeCompare(right.id));
}

export function createDefaultBuilderHostedServices(graph: BuilderGraph): BuilderHostedService[] {
  const preferred = graph.nodes.find((node) => node.id === 'app' && node.kind === 'endpoint') ?? graph.nodes.find((node) => node.kind === 'endpoint');
  if (!preferred) return [];
  const host = `${preferred.id}.hopscotch.test`;
  return validateBuilderHostedServices(graph, [
    { id: `${preferred.id}:dns`, nodeId: preferred.id, kind: 'dns', label: 'DNS', hostname: host, port: 53, enabled: true, transportProfile: null, responseBytes: 128 },
    { id: `${preferred.id}:http`, nodeId: preferred.id, kind: 'http', label: 'HTTP', hostname: host, port: 80, enabled: true, transportProfile: 'tcp-h2', responseBytes: 4096 },
    { id: `${preferred.id}:https-h2`, nodeId: preferred.id, kind: 'https', label: 'HTTPS · TCP/H2', hostname: host, port: 443, enabled: true, transportProfile: 'tcp-h2', responseBytes: 8192 },
    { id: `${preferred.id}:https-h3`, nodeId: preferred.id, kind: 'https', label: 'HTTPS · QUIC/H3', hostname: host, port: 443, enabled: true, transportProfile: 'quic-h3', responseBytes: 8192 },
    { id: `${preferred.id}:ssh`, nodeId: preferred.id, kind: 'ssh', label: 'SSH', hostname: host, port: 22, enabled: true, transportProfile: 'tcp-h2', responseBytes: 512 },
    { id: `${preferred.id}:tcp`, nodeId: preferred.id, kind: 'tcp', label: 'GENERIC TCP', hostname: host, port: 9000, enabled: true, transportProfile: 'tcp-h2', responseBytes: 1024 },
    { id: `${preferred.id}:udp`, nodeId: preferred.id, kind: 'udp', label: 'GENERIC UDP', hostname: host, port: 9001, enabled: true, transportProfile: null, responseBytes: 1024 },
  ]);
}

export function upsertBuilderHostedService(graph: BuilderGraph, services: readonly BuilderHostedService[], service: BuilderHostedService): BuilderHostedService[] {
  return validateBuilderHostedServices(graph, [...services.filter((candidate) => candidate.id !== service.id), service]);
}

export function cloneBuilderHostedServices(graph: BuilderGraph, services: readonly BuilderHostedService[]): BuilderHostedService[] {
  return validateBuilderHostedServices(graph, services);
}

export function reconcileBuilderHostedServices(graph: BuilderGraph, services: readonly BuilderHostedService[]): BuilderHostedService[] {
  const endpointIds = new Set(graph.nodes.filter((node) => node.kind === 'endpoint').map((node) => node.id));
  return validateBuilderHostedServices(graph, services.filter((service) => endpointIds.has(service.nodeId)));
}

function protocolFor(service: BuilderHostedService): 'tcp' | 'udp' {
  if (service.kind === 'dns' || service.kind === 'udp' || (service.kind === 'https' && service.transportProfile === 'quic-h3')) return 'udp';
  return 'tcp';
}

function nodeLabel(graph: BuilderGraph, id: string): string { return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase(); }
function forwardingNodes(trace: BuilderForwardingTrace): string[] { return [trace.sourceNodeId, ...trace.hops.map((hop) => hop.nextNodeId).filter((id): id is string => Boolean(id))].filter((id, index, all) => index === 0 || id !== all[index - 1]); }
function forwardingLinks(trace: BuilderForwardingTrace): string[] { return trace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []); }
function ipv6Nodes(trace: BuilderIpv6ForwardingTrace): string[] { return [trace.sourceNodeId, ...trace.hops.map((hop) => hop.nextNodeId).filter((id): id is string => Boolean(id))].filter((id, index, all) => index === 0 || id !== all[index - 1]); }
function ipv6Links(trace: BuilderIpv6ForwardingTrace): string[] { return trace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []); }

function endpointAccessLink(graph: BuilderGraph, endpointId: string): { linkId: string; routerId: string } | null {
  const routers = new Set(graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id));
  const candidate = graph.links.filter((link) => !link.failed && (link.a === endpointId || link.b === endpointId)).map((link) => ({ link, neighborId: link.a === endpointId ? link.b : link.a })).filter(({ neighborId }) => routers.has(neighborId)).sort((a, b) => a.link.id.localeCompare(b.link.id))[0];
  return candidate ? { linkId: candidate.link.id, routerId: candidate.neighborId } : null;
}

function projectionVlan(linkId: string): number { return 1000 + (stableHash(linkId) % 3000); }

function explicitAccessConfig(ethernet: BuilderEthernetConfig, endpointId: string, routerId: string, endpointAddress: string, routerAddress: string): { config: BuilderEthernetConfig; vlanId: number; mode: 'CONFIGURED ETHERNET' } | null {
  const endpoint = ethernet.devices.find((device) => device.id === endpointId && device.kind === 'endpoint');
  const router = ethernet.devices.find((device) => device.id === routerId && device.kind === 'router');
  const endpointIf = endpoint?.interfaces.find((entry) => entry.address === endpointAddress);
  const routerIf = router?.interfaces.find((entry) => entry.address === routerAddress && entry.vlanId === endpointIf?.vlanId);
  if (!endpoint || !router || !endpointIf || !routerIf) return null;
  return builderEthernetPathForVlan(ethernet, endpointId, routerId, endpointIf.vlanId) ? { config: ethernet, vlanId: endpointIf.vlanId, mode: 'CONFIGURED ETHERNET' } : null;
}

function projectedAccessConfig(graph: BuilderGraph, addressing: BuilderAddressing, endpointId: string, access: { linkId: string; routerId: string }): { config: BuilderEthernetConfig; vlanId: number; mode: 'ROUTED ACCESS PROJECTION' } | null {
  const segment = addressing.segments[access.linkId];
  const endpointAddress = segment?.interfaces.find((entry) => entry.nodeId === endpointId)?.address;
  const routerAddress = segment?.interfaces.find((entry) => entry.nodeId === access.routerId)?.address;
  if (!segment || !endpointAddress || !routerAddress) return null;
  const vlanId = projectionVlan(access.linkId);
  const endpoint: BuilderEthernetDevice = { id: endpointId, label: nodeLabel(graph, endpointId), kind: 'endpoint', mac: stableMac(endpointId, access.linkId), interfaces: [{ vlanId, address: endpointAddress, gateway: routerAddress }] };
  const router: BuilderEthernetDevice = { id: access.routerId, label: nodeLabel(graph, access.routerId), kind: 'router', mac: stableMac(access.routerId, access.linkId), interfaces: [{ vlanId, address: routerAddress }] };
  return { mode: 'ROUTED ACCESS PROJECTION', vlanId, config: { vlans: [{ id: vlanId, name: `ACCESS-${access.linkId}`.slice(0, 32), cidr: segment.cidr }], devices: [endpoint, router], links: [{ id: `access-${access.linkId}`, a: endpointId, b: access.routerId, mode: 'access', accessVlan: vlanId, failed: graph.links.find((link) => link.id === access.linkId)?.failed ?? false }], layout: { [endpointId]: { x: 15, y: 50 }, [access.routerId]: { x: 85, y: 50 } }, stp: createDefaultBuilderStpConfig() } };
}

function accessConfig(graph: BuilderGraph, addressing: BuilderAddressing, ethernet: BuilderEthernetConfig, endpointId: string): { config: BuilderEthernetConfig; vlanId: number; mode: 'CONFIGURED ETHERNET' | 'ROUTED ACCESS PROJECTION'; routerId: string; linkId: string } | null {
  const access = endpointAccessLink(graph, endpointId);
  if (!access) return null;
  const segment = addressing.segments[access.linkId];
  const endpointAddress = segment?.interfaces.find((entry) => entry.nodeId === endpointId)?.address;
  const routerAddress = segment?.interfaces.find((entry) => entry.nodeId === access.routerId)?.address;
  if (!endpointAddress || !routerAddress) return null;
  const explicit = explicitAccessConfig(ethernet, endpointId, access.routerId, endpointAddress, routerAddress);
  const resolved = explicit ?? projectedAccessConfig(graph, addressing, endpointId, access);
  return resolved ? { ...resolved, routerId: access.routerId, linkId: access.linkId } : null;
}

function stage(order: number, id: string, boundary: BuilderApplicationTruthBoundary, label: string, status: BuilderApplicationStageStatus, summary: string, detail: string, nodeIds: string[] = [], linkIds: string[] = []): BuilderApplicationStage {
  return { id, order, boundary, label, status, summary, detail, nodeIds: [...nodeIds], linkIds: [...linkIds], provenance: 'SIMULATED' };
}

function journeyProtocolEvents(service: BuilderHostedService): JourneyEvent[] {
  const profile = service.kind === 'https' && service.transportProfile === 'quic-h3' ? 'quic-h3' : 'tcp-h2';
  if (protocolFor(service) === 'udp' && service.kind !== 'https') return [];
  const hostname = service.hostname ?? 'service.hopscotch.test';
  const scenario = buildJourneyScenario(hostname, { transportProfile: profile, dnsProfile: 'cache-hit', impairmentProfile: 'clean' });
  const allowed = new Set(service.kind === 'https'
    ? ['transport.segment', 'transport.established', 'tls.message', 'tls.validation', 'tls.keys', 'http.control', 'http.request', 'http.response', 'http.data', 'packet.inspect', 'transfer.complete']
    : ['transport.segment', 'transport.established']);
  return scenario.events.filter((event) => allowed.has(event.kind)).slice(0, MAX_PROTOCOL_EVENTS).map((event) => ({ ...event, id: `builder:${service.id}:${event.id}`, provenance: 'SIMULATED' as const }));
}

function packetConfig(family: BuilderApplicationFamily, transport: 'tcp' | 'udp', sourceAddress: string, destinationAddress: string, sourcePort: number, destinationPort: number, sourceMac: string, destinationMac: string, payloadBytes = PACKET_PAYLOAD_BYTES): PacketConfig {
  return { family, transport, payloadBytes, ttl: 64, sourcePort, destinationPort, sourceMac, destinationMac, ...(family === 'ipv4' ? { sourceIpv4: sourceAddress, destinationIpv4: destinationAddress } : { sourceIpv6: sourceAddress, destinationIpv6: destinationAddress }) };
}

function packet(id: string, label: string, direction: BuilderApplicationPacket['direction'], vantage: BuilderApplicationPacket['vantage'], config: PacketConfig, sourceStageId: string): BuilderApplicationPacket {
  return { id, label, direction, vantage, config, snapshot: buildPacket(config), sourceStageId, provenance: 'SIMULATED' };
}

function notReached(order: number, id: string, boundary: BuilderApplicationTruthBoundary, label: string, cause: BuilderApplicationTruthBoundary): BuilderApplicationStage {
  return stage(order, id, boundary, label, 'NOT_REACHED', 'NOT REACHED', `${label} was not evaluated because ${cause.replace('_', ' ')} failed first.`);
}

function serviceApplicationDetail(service: BuilderHostedService): string {
  if (service.kind === 'dns') return `Deterministic DNS service returns the Builder destination address for ${service.hostname ?? service.nodeId}.`;
  if (service.kind === 'http') return `HTTP service accepts a deterministic request on TCP/${service.port} and returns ${service.responseBytes} bytes without TLS.`;
  if (service.kind === 'https') return `${service.transportProfile === 'quic-h3' ? 'HTTP/3 over QUIC' : 'HTTP/2 over TLS 1.3/TCP'} serves ${service.responseBytes} deterministic response bytes.`;
  if (service.kind === 'ssh') return `SSH service accepts a deterministic TCP/${service.port} transport session; HOPSCOTCH models reachability/session establishment, not cryptographic SSH internals.`;
  return `${service.kind.toUpperCase()} service exchanges ${service.responseBytes} deterministic response bytes on port ${service.port}.`;
}

export function runBuilderApplicationTransaction(context: BuilderApplicationContext, servicesInput: readonly BuilderHostedService[], sourceNodeId: string, serviceId: string, family: BuilderApplicationFamily = 'ipv4', sequence = 1): BuilderApplicationTransaction {
  const services = validateBuilderHostedServices(context.graph, servicesInput);
  const service = services.find((candidate) => candidate.id === serviceId);
  if (!service) throw new Error(`Unknown Builder hosted service ${serviceId}.`);
  const destinationNodeId = service.nodeId;
  if (sourceNodeId === destinationNodeId) throw new Error('Builder application source and service endpoint must be different nodes.');
  if (!context.graph.nodes.some((node) => node.id === sourceNodeId && node.kind === 'endpoint')) throw new Error('Builder application source must be an endpoint.');
  const stages: BuilderApplicationStage[] = [];
  const packets: BuilderApplicationPacket[] = [];
  const protocolEvents = service.enabled && Boolean(service.hostname || service.kind === 'dns') ? journeyProtocolEvents(service) : [];
  let firstBroken: BuilderApplicationTruthBoundary | null = null;
  let arpCache = context.arpCache.map((entry) => ({ ...entry }));
  let natSessions = context.natSessions.map((entry) => ({ ...entry }));
  let dhcpLeases = context.dhcpLeases.map((entry) => ({ ...entry, dnsServers: [...entry.dnsServers] }));
  let ipv6ControlState = context.ipv6ControlState;
  let dhcpTransaction: BuilderDhcpTransaction | null = null;
  let effectiveAddressing = context.addressing;
  let sourceAddress: string | null = family === 'ipv4' ? interfacesForBuilderNode(effectiveAddressing, sourceNodeId)[0]?.address ?? null : primaryBuilderIpv6Address(context.ipv6.addressing, sourceNodeId);
  let destinationAddress: string | null = family === 'ipv4' ? interfacesForBuilderNode(effectiveAddressing, destinationNodeId)[0]?.address ?? null : primaryBuilderIpv6Address(context.ipv6.addressing, destinationNodeId);
  let ipv4Forwarding: BuilderForwardingTrace | null = null;
  let ipv6Forwarding: BuilderIpv6ForwardingTrace | null = null;
  let natRequest: BuilderNatFlowResult | null = null;
  let natResponse: BuilderNatFlowResult | null = null;
  const l2: BuilderApplicationL2Evidence = { sourceMode: 'NONE', destinationMode: 'NONE', sourceResolution: null, destinationResolution: null, sourceStp: null, destinationStp: null, sourceVlan: null, destinationVlan: null };

  const actualEthernetSource = context.ethernet.devices.some((device) => device.id === sourceNodeId && device.kind === 'endpoint');
  if (family === 'ipv4' && actualEthernetSource && context.dhcp.clientDeviceIds.includes(sourceNodeId)) {
    if (!builderDhcpClientReady(context.dhcp, dhcpLeases, sourceNodeId, context.dhcpSequence)) {
      dhcpTransaction = runBuilderDhcpAcquire(context.ethernet, context.dhcp, dhcpLeases, sourceNodeId, context.dhcpSequence);
      dhcpLeases = dhcpTransaction.leases;
    }
    const runtime = applyBuilderDhcpState(context.ethernet, context.dhcp, dhcpLeases, context.dhcpSequence);
    const runtimeAddress = runtime.devices.find((device) => device.id === sourceNodeId)?.interfaces[0]?.address;
    const sourceInterface = interfacesForBuilderNode(context.addressing, sourceNodeId)[0];
    if (runtimeAddress && runtimeAddress !== '0.0.0.0' && sourceInterface) {
      try { effectiveAddressing = replaceBuilderInterfaceAddress(context.graph, context.addressing, sourceInterface.linkId, sourceNodeId, runtimeAddress); } catch { /* Ethernet DHCP may describe a separate LAN; never force it into routed truth. */ }
    }
    sourceAddress = interfacesForBuilderNode(effectiveAddressing, sourceNodeId)[0]?.address ?? null;
  }

  const addressReady = Boolean(sourceAddress && destinationAddress && (family === 'ipv4' || context.ipv6.enabled));
  const dhcpReady = family !== 'ipv4' || !actualEthernetSource || !context.dhcp.clientDeviceIds.includes(sourceNodeId) || builderDhcpClientReady(context.dhcp, dhcpLeases, sourceNodeId, context.dhcpSequence);
  if (!addressReady || !dhcpReady) firstBroken = 'ADDRESSING';
  stages.push(stage(1, 'addressing', 'ADDRESSING', 'DHCP / ADDRESSING', firstBroken ? 'FAIL' : 'PASS', firstBroken ? 'HOST CONFIGURATION NOT READY' : dhcpTransaction ? dhcpTransaction.summary : `${family.toUpperCase()} source and destination addresses are ready.`, firstBroken ? (dhcpTransaction?.failureReason ?? 'The source or destination has no usable address configuration.') : dhcpTransaction ? 'The application request consumed the existing DHCP DORA transaction before routing.' : 'This endpoint is statically addressed or already has valid session DHCP state.', [sourceNodeId, destinationNodeId]));

  if (!firstBroken) {
    const dnsOk = Boolean(service.hostname || service.kind === 'dns');
    if (!dnsOk) firstBroken = 'DNS';
    stages.push(stage(2, 'dns', 'DNS', 'SERVICE / DNS INTENT', dnsOk ? 'PASS' : 'FAIL', dnsOk ? `${service.hostname ?? service.nodeId} → ${destinationAddress}` : 'SERVICE NAME UNAVAILABLE', dnsOk ? `The canonical hosted-service catalog resolves the selected deterministic service to ${nodeLabel(context.graph, destinationNodeId)}. Listener availability is a later transport boundary; no public DNS evidence is implied.` : 'Canonical hosted-service configuration has no deterministic name mapping for this service.', [destinationNodeId]));
  } else stages.push(notReached(2, 'dns', 'DNS', 'SERVICE / DNS INTENT', firstBroken));

  const sourceAccess = accessConfig(context.graph, effectiveAddressing, context.ethernet, sourceNodeId);
  const destinationAccess = accessConfig(context.graph, effectiveAddressing, context.ethernet, destinationNodeId);
  if (!firstBroken) {
    if (family === 'ipv4') {
      if (!sourceAccess || !destinationAccess || !sourceAddress || !destinationAddress) firstBroken = 'L2';
      if (!firstBroken && sourceAccess && destinationAccess) {
        l2.sourceMode = sourceAccess.mode; l2.destinationMode = destinationAccess.mode; l2.sourceVlan = sourceAccess.vlanId; l2.destinationVlan = destinationAccess.vlanId;
        l2.sourceStp = builderStpState(sourceAccess.config, sourceAccess.vlanId); l2.destinationStp = builderStpState(destinationAccess.config, destinationAccess.vlanId);
        const sourceGateway = effectiveAddressing.defaultGateways[sourceNodeId] ?? effectiveAddressing.segments[sourceAccess.linkId]?.interfaces.find((entry) => entry.nodeId === sourceAccess.routerId)?.address ?? null;
        const destinationRouterAddress = effectiveAddressing.segments[destinationAccess.linkId]?.interfaces.find((entry) => entry.nodeId === destinationAccess.routerId)?.address ?? null;
        if (!sourceGateway || !destinationRouterAddress) firstBroken = 'RESOLUTION';
        else {
          const sourceResolution = resolveBuilderArp(sourceAccess.config, sourceNodeId, sourceAccess.vlanId, sourceGateway, arpCache); arpCache = sourceResolution.cache; l2.sourceResolution = sourceResolution.resolution;
          const destinationResolution = resolveBuilderArp(destinationAccess.config, destinationAccess.routerId, destinationAccess.vlanId, destinationAddress as string, arpCache); arpCache = destinationResolution.cache; l2.destinationResolution = destinationResolution.resolution;
          if (!sourceResolution.resolution.success || !destinationResolution.resolution.success) firstBroken = 'RESOLUTION';
        }
      }
      stages.push(stage(3, 'l2-resolution', firstBroken === 'L2' ? 'L2' : 'RESOLUTION', 'ETHERNET / VLAN / STP / ARP', firstBroken === 'L2' || firstBroken === 'RESOLUTION' ? 'FAIL' : 'PASS', firstBroken === 'L2' ? 'ACCESS SEGMENT UNAVAILABLE' : firstBroken === 'RESOLUTION' ? 'ARP RESOLUTION FAILED' : `${sourceAccess?.mode} · ${destinationAccess?.mode}`, firstBroken ? (l2.sourceResolution?.failureReason ?? l2.destinationResolution?.failureReason ?? 'The routed access segment cannot provide the required Layer-2 next-hop truth.') : `Source gateway and destination-host MACs resolve through the existing ARP engine. STP state is evaluated for both access broadcast domains; no switch or hidden topology is invented.`, [sourceNodeId, sourceAccess?.routerId ?? '', destinationAccess?.routerId ?? '', destinationNodeId].filter(Boolean), [sourceAccess?.linkId ?? '', destinationAccess?.linkId ?? ''].filter(Boolean)));
    } else {
      stages.push(stage(3, 'l2-resolution', 'RESOLUTION', 'ETHERNET / ND', 'PASS', 'ND DEFERRED TO FORWARDING TRACE', 'IPv6 next-hop Neighbor Discovery is resolved from the actual IPv6 forwarding trace. Routed access links still remain the Layer-2 boundaries; ARP is never used for IPv6.'));
    }
  } else stages.push(notReached(3, 'l2-resolution', 'RESOLUTION', family === 'ipv4' ? 'ETHERNET / VLAN / STP / ARP' : 'ETHERNET / ND', firstBroken));

  if (!firstBroken) {
    if (family === 'ipv4') {
      ipv4Forwarding = traceBuilderForwarding(context.graph, effectiveAddressing, context.routing, sourceNodeId, destinationNodeId, context.graph, `app|${service.id}|${sequence}`);
      if (!ipv4Forwarding.reachable) firstBroken = 'ROUTING';
      stages.push(stage(4, 'routing', 'ROUTING', 'ROUTING / FIB', ipv4Forwarding.reachable ? 'PASS' : 'FAIL', ipv4Forwarding.reachable ? forwardingNodes(ipv4Forwarding).map((id) => nodeLabel(context.graph, id)).join(' → ') : ipv4Forwarding.failureReason ?? 'NO ROUTE', ipv4Forwarding.explanation, forwardingNodes(ipv4Forwarding), forwardingLinks(ipv4Forwarding)));
    } else {
      const overlay = builderOspfv3DepthRouteOverlay(context.graph, context.ipv6, context.ipv6RoutingDepth);
      ipv6Forwarding = traceBuilderIpv6Forwarding(context.graph, context.ipv6, sourceNodeId, destinationNodeId, overlay);
      if (!ipv6Forwarding.reachable) firstBroken = 'ROUTING';
      else {
        const nd = resolveBuilderIpv6TraceNeighbors(context.graph, context.ipv6, ipv6Forwarding, ipv6ControlState, sequence); ipv6ControlState = nd.state;
        if (!nd.success) firstBroken = 'RESOLUTION';
        const resolutions: BuilderIpv6NdResolution[] = nd.resolutions;
        stages[2] = stage(3, 'l2-resolution', 'RESOLUTION', 'ETHERNET / ND', nd.success ? 'PASS' : 'FAIL', nd.success ? `${resolutions.length} NEXT-HOP ND RESOLUTION${resolutions.length === 1 ? '' : 'S'}` : nd.failureReason ?? 'ND FAILED', nd.success ? resolutions.map((entry) => entry.detail).join(' ') || 'No next-hop Neighbor Discovery exchange was required.' : nd.failureReason ?? 'Neighbor Discovery failed.', ipv6Nodes(ipv6Forwarding), ipv6Links(ipv6Forwarding));
      }
      stages.push(stage(4, 'routing', 'ROUTING', 'IPV6 ROUTING / FIB', ipv6Forwarding.reachable ? 'PASS' : 'FAIL', ipv6Forwarding.reachable ? ipv6Nodes(ipv6Forwarding).map((id) => nodeLabel(context.graph, id)).join(' → ') : ipv6Forwarding.failureReason ?? 'NO ROUTE', ipv6Forwarding.explanation, ipv6Nodes(ipv6Forwarding), ipv6Links(ipv6Forwarding)));
    }
  } else stages.push(notReached(4, 'routing', 'ROUTING', 'ROUTING / FIB', firstBroken));

  const transport = protocolFor(service);
  const sourcePort = DEFAULT_SOURCE_PORT + (stableHash(`${service.id}:${sequence}`) % 12000);
  if (!firstBroken) {
    if (family === 'ipv4') {
      natRequest = runBuilderNatOutboundFlow(context.graph, effectiveAddressing, context.routing, context.nat, natSessions, sourceNodeId, destinationNodeId, transport, sourcePort, service.port, sequence, context.acl);
      natSessions = natRequest.sessions;
      if (!natRequest.success) firstBroken = 'POLICY_NAT';
      stages.push(stage(5, 'policy-nat', 'POLICY_NAT', 'ACL / NAT', natRequest.success ? 'PASS' : 'FAIL', natRequest.success ? natRequest.translation ? `${natRequest.translation.kind.toUpperCase()} · ${natRequest.translatedTuple?.sourceAddress}:${natRequest.translatedTuple?.sourcePort}` : 'PERMITTED · NO TRANSLATION' : natRequest.failureReason ?? 'POLICY / NAT FAILED', natRequest.explanation, natRequest.forwarding ? forwardingNodes(natRequest.forwarding) : [], natRequest.forwarding ? forwardingLinks(natRequest.forwarding) : []));
    } else if (ipv6Forwarding) {
      const denied = evaluateBuilderIpv6TracePolicy(context.graph, context.ipv6, ipv6Forwarding, context.ipv6RoutingDepth.policy, 'any');
      if (denied) firstBroken = 'POLICY_NAT';
      stages.push(stage(5, 'policy-nat', 'POLICY_NAT', 'IPV6 POLICY / NAT', denied ? 'FAIL' : 'PASS', denied ? `DENIED · ${denied.routerId}` : 'PERMITTED · NO NAT66', denied?.detail ?? 'The existing IPv6 address policy permits the flow. Builder does not invent NAT66 state.', ipv6Nodes(ipv6Forwarding), ipv6Links(ipv6Forwarding)));
    }
  } else stages.push(notReached(5, 'policy-nat', 'POLICY_NAT', 'ACL / NAT', firstBroken));

  const requestLinks = family === 'ipv4' ? (natRequest?.forwarding ? forwardingLinks(natRequest.forwarding) : ipv4Forwarding ? forwardingLinks(ipv4Forwarding) : []) : ipv6Forwarding ? ipv6Links(ipv6Forwarding) : [];
  if (!firstBroken) {
    const characteristics = builderPathCharacteristics(context.linkProfiles, requestLinks);
    const packetBytes = family === 'ipv4' ? 14 + 20 + (transport === 'tcp' ? 20 : 8) + PACKET_PAYLOAD_BYTES : 14 + 40 + (transport === 'tcp' ? 20 : 8) + PACKET_PAYLOAD_BYTES;
    const dropLink = deterministicBuilderPathDrop(context.linkProfiles, requestLinks, `app:${service.id}:${sequence}:request`);
    if ((characteristics.pathMtuBytes ?? packetBytes) < packetBytes || dropLink) firstBroken = 'LINK';
    stages.push(stage(6, 'link', 'LINK', 'LINK CHARACTERISTICS', firstBroken === 'LINK' ? 'FAIL' : 'PASS', firstBroken === 'LINK' ? dropLink ? `DETERMINISTIC DROP · ${dropLink}` : `MTU ${characteristics.pathMtuBytes} < ${packetBytes}` : `${characteristics.oneWayLatencyMs.toFixed(2)} ms ONE WAY · MTU ${characteristics.pathMtuBytes ?? '—'} · ${characteristics.bottleneckMbps ?? '—'} Mb/s`, firstBroken === 'LINK' ? 'Canonical route/policy truth exists, but explicit link MTU/loss prevents this representative request unit from reaching transport.' : 'Latency, jitter, bandwidth, loss, MTU, and queue capacity come from the same Builder link profiles used by probes.', [], requestLinks));
  } else stages.push(notReached(6, 'link', 'LINK', 'LINK CHARACTERISTICS', firstBroken));

  if (!firstBroken) {
    const transportSummary = transport === 'tcp' ? (service.kind === 'https' && service.transportProfile === 'quic-h3' ? 'QUIC' : 'TCP') : service.kind === 'https' ? 'QUIC / UDP' : 'UDP';
    const listenerReady = service.enabled;
    if (!listenerReady) firstBroken = 'TRANSPORT';
    stages.push(stage(7, 'transport', 'TRANSPORT', 'TRANSPORT', listenerReady ? 'PASS' : 'FAIL', listenerReady ? `${transportSummary} SESSION READY` : `${transportSummary} LISTENER UNAVAILABLE`, listenerReady ? (protocolEvents.length ? `${protocolEvents.filter((event) => event.kind.startsWith('transport.')).map((event) => event.title).join(' → ')}. These events are reused from the canonical Request Journey protocol model.` : `${service.kind.toUpperCase()} uses deterministic UDP datagram semantics; no fake TCP state is created.`) : `${nodeLabel(context.graph, destinationNodeId)} has no enabled ${service.kind.toUpperCase()} listener on ${transport.toUpperCase()}/${service.port}. Lower-layer routing and policy already reached the endpoint; no established transport event or packet bytes are fabricated.`, [sourceNodeId, destinationNodeId], requestLinks));
  } else stages.push(notReached(7, 'transport', 'TRANSPORT', 'TRANSPORT', firstBroken));

  if (!firstBroken) {
    if (service.kind === 'https') stages.push(stage(8, 'tls', 'TLS', 'TLS / QUIC CRYPTO', 'PASS', service.transportProfile === 'quic-h3' ? 'TLS 1.3 INSIDE QUIC' : 'TLS 1.3 APPLICATION KEYS READY', protocolEvents.filter((event) => event.kind.startsWith('tls.')).map((event) => event.title).join(' → '), [sourceNodeId, destinationNodeId]));
    else stages.push(stage(8, 'tls', 'TLS', 'TLS / QUIC CRYPTO', 'PASS', 'NOT REQUIRED BY SERVICE', `${service.kind.toUpperCase()} does not require the Track D TLS stage; transport truth remains valid without inventing encryption.`));
  } else stages.push(notReached(8, 'tls', 'TLS', 'TLS / QUIC CRYPTO', firstBroken));

  if (!firstBroken) stages.push(stage(9, 'application', 'APPLICATION', 'APPLICATION SERVICE', 'PASS', `${service.label} · ${service.port}/${transport.toUpperCase()}`, serviceApplicationDetail(service), [destinationNodeId]));
  else stages.push(notReached(9, 'application', 'APPLICATION', 'APPLICATION SERVICE', firstBroken));

  if (!firstBroken && sourceAddress && destinationAddress) {
    let responseLinks: string[] = [];
    if (family === 'ipv4') {
      if (natRequest?.translation && natRequest.translatedTuple) {
        natResponse = runBuilderNatInboundFlow(context.graph, effectiveAddressing, context.routing, context.nat, natSessions, destinationNodeId, natRequest.translatedTuple.sourceAddress, transport, service.port, natRequest.translatedTuple.sourcePort, sequence + 1, context.acl);
        natSessions = natResponse.sessions;
        responseLinks = natResponse.forwarding ? forwardingLinks(natResponse.forwarding) : [];
        if (!natResponse.success) firstBroken = 'RESPONSE';
      } else {
        const responsePolicy = traceBuilderPolicy(context.graph, effectiveAddressing, context.routing, context.acl, destinationNodeId, sourceNodeId, transport, sourcePort, `app|${service.id}|${sequence}|response`);
        responseLinks = forwardingLinks(responsePolicy.forwarding);
        if (!responsePolicy.forwarding.reachable || !responsePolicy.permitted) firstBroken = 'RESPONSE';
      }
    } else {
      const overlay = builderOspfv3DepthRouteOverlay(context.graph, context.ipv6, context.ipv6RoutingDepth);
      const responseTrace = traceBuilderIpv6Forwarding(context.graph, context.ipv6, destinationNodeId, sourceNodeId, overlay);
      responseLinks = ipv6Links(responseTrace);
      const denied = responseTrace.reachable ? evaluateBuilderIpv6TracePolicy(context.graph, context.ipv6, responseTrace, context.ipv6RoutingDepth.policy, 'any') : null;
      if (!responseTrace.reachable || denied) firstBroken = 'RESPONSE';
      else { const nd = resolveBuilderIpv6TraceNeighbors(context.graph, context.ipv6, responseTrace, ipv6ControlState, sequence + 1); ipv6ControlState = nd.state; if (!nd.success) firstBroken = 'RESPONSE'; }
    }
    if (!firstBroken) {
      const responseDrop = deterministicBuilderPathDrop(context.linkProfiles, responseLinks, `app:${service.id}:${sequence}:response`);
      if (responseDrop) firstBroken = 'RESPONSE';
    }
    const round = builderRoundTripCharacteristics(context.linkProfiles, requestLinks, responseLinks);
    stages.push(stage(10, 'response', 'RESPONSE', 'RETURN PATH / RESPONSE', firstBroken === 'RESPONSE' ? 'FAIL' : 'PASS', firstBroken === 'RESPONSE' ? 'APPLICATION RESPONSE CANNOT RETURN' : `RESPONSE DELIVERED · RTT ${round.rttMs.toFixed(2)} ms`, firstBroken === 'RESPONSE' ? (natResponse?.explanation ?? 'Reverse forwarding, policy, Neighbor Discovery, translation state, or deterministic link behavior prevented response delivery.') : `The response reuses the reverse FIB/policy/NAT state; ${service.responseBytes} application bytes are delivered only after return-path truth succeeds.`, [destinationNodeId, sourceNodeId], responseLinks));
  } else stages.push(notReached(10, 'response', 'RESPONSE', 'RETURN PATH / RESPONSE', firstBroken ?? 'APPLICATION'));

  if (sourceAddress && destinationAddress && stages.find((entry) => entry.id === 'transport')?.status === 'PASS') {
    const requestTuple = natRequest?.originalTuple ?? { sourceAddress, sourcePort, destinationAddress, destinationPort: service.port };
    const sourceMac = l2.sourceResolution?.targetMac ? stableMac(sourceNodeId, 'application') : stableMac(sourceNodeId, 'application');
    const gatewayMac = l2.sourceResolution?.targetMac ?? stableMac(endpointAccessLink(context.graph, sourceNodeId)?.routerId ?? destinationNodeId, 'application');
    packets.push(packet(`app-packet:${sequence}:request-access`, `${service.label} REQUEST · SOURCE ACCESS`, 'REQUEST', 'SOURCE_ACCESS', packetConfig(family, transport, requestTuple.sourceAddress, requestTuple.destinationAddress, requestTuple.sourcePort ?? sourcePort, requestTuple.destinationPort ?? service.port, sourceMac, gatewayMac), 'transport'));
    if (family === 'ipv4' && natRequest?.translation && natRequest.translatedTuple) {
      packets.push(packet(`app-packet:${sequence}:post-nat`, `${service.label} REQUEST · POST NAT`, 'REQUEST', 'POST_NAT', packetConfig('ipv4', transport, natRequest.translatedTuple.sourceAddress, natRequest.translatedTuple.destinationAddress, natRequest.translatedTuple.sourcePort ?? sourcePort, natRequest.translatedTuple.destinationPort ?? service.port, stableMac(natRequest.routerId ?? sourceNodeId, 'nat-egress'), stableMac(destinationNodeId, 'nat-egress')), 'policy-nat'));
    }
    if (stages.find((entry) => entry.id === 'response')?.status === 'PASS') {
      packets.push(packet(`app-packet:${sequence}:response-access`, `${service.label} RESPONSE · DESTINATION ACCESS`, 'RESPONSE', 'DESTINATION_ACCESS', packetConfig(family, transport, destinationAddress, sourceAddress, service.port, sourcePort, stableMac(destinationNodeId, 'application'), stableMac(endpointAccessLink(context.graph, destinationNodeId)?.routerId ?? sourceNodeId, 'application'), Math.min(PACKET_PAYLOAD_BYTES, Math.max(1, service.responseBytes))), 'response'));
    }
  }

  const success = stages.at(-1)?.status === 'PASS' && firstBroken === null;
  const projections: BuilderApplicationProjection[] = [
    { camera: 'BUILDER', label: 'BUILDER CAUSAL STACK', eventIds: stages.map((entry) => entry.id), packetIds: packets.map((entry) => entry.id), provenance: 'SIMULATED' },
    { camera: 'PROTOCOL', label: 'CANONICAL PROTOCOL THEATER', eventIds: protocolEvents.map((entry) => entry.id), packetIds: packets.map((entry) => entry.id), provenance: 'SIMULATED' },
    { camera: 'JOURNEY', label: 'SHARED TRANSACTION JOURNEY', eventIds: [...stages.slice(0, 6).map((entry) => entry.id), ...protocolEvents.map((entry) => entry.id), ...stages.slice(9).map((entry) => entry.id)], packetIds: packets.map((entry) => entry.id), provenance: 'SIMULATED' },
    { camera: 'PACKET', label: 'EXACT PACKET BYTES', eventIds: packets.map((entry) => entry.sourceStageId), packetIds: packets.map((entry) => entry.id), provenance: 'SIMULATED' },
  ];
  const summary = success ? `${nodeLabel(context.graph, sourceNodeId)} → ${service.label} on ${nodeLabel(context.graph, destinationNodeId)} completed across one shared Builder transaction.` : `${nodeLabel(context.graph, sourceNodeId)} → ${service.label} stopped at ${firstBroken?.replace('_', ' ') ?? 'UNKNOWN'}; later truth boundaries remain NOT REACHED.`;
  return { id: `builder-app:${sequence}:${sourceNodeId}:${service.id}:${family}`, sequence, service, family, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, success, firstBrokenBoundary: firstBroken, summary, stages, protocolEvents, packets, projections, ipv4Forwarding, ipv6Forwarding, natRequest, natResponse, l2, dhcpTransaction, arpCache, natSessions, dhcpLeases, ipv6ControlState, boundary: 'Track D uses one causal transaction. Builder addressing/L2/resolution/FIB/policy/NAT/link truth gates canonical Journey transport/application events and exact Packet Microscope bytes. A failed layer leaves later layers NOT REACHED; no second transport or routing simulator is allowed.' };
}

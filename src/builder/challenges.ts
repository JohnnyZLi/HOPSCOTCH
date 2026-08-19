import { interfacesForBuilderNode, validateBuilderAddressing, type BuilderAddressing } from './addressing.ts';
import { upsertBuilderHostedService, type BuilderApplicationFamily, type BuilderApplicationTruthBoundary, type BuilderHostedService } from './application.ts';
import { setBuilderBgpRouterAsn, updateBuilderBgpSession, upsertBuilderBgpOrigin, upsertBuilderBgpPolicy, upsertBuilderBgpSession, type BuilderBgpPolicyRule } from './bgp.ts';
import { upsertBuilderAclRule, type BuilderAclConfig, type BuilderAclRule } from './acl.ts';
import { createBuilderAuthoringSnapshot, type BuilderAuthoringSnapshot } from './authoring.ts';
import { setBuilderDhcpClient, upsertBuilderDhcpPool, type BuilderDhcpConfig } from './dhcp.ts';
import { validateBuilderEthernetConfig, type BuilderEthernetConfig } from './ethernet.ts';
import { validateBuilderNatConfig, type BuilderNatConfig } from './nat.ts';
import { updateBuilderLinkProfile, type BuilderLinkProfiles } from './link-characteristics.ts';
import { setBuilderOspfv3Everywhere } from './ipv6.ts';
import { installStaticRoutesForWeightedPath, setBuilderOspfEverywhere, setBuilderOspfRouterEnabled, validateBuilderRoutingConfig, type BuilderRoutingConfig } from './routing.ts';
import { defaultBuilderScenario } from './scenario.ts';

export const BUILDER_CHALLENGE_SCHEMA = 'hopscotch.builder.challenge' as const;
export const BUILDER_CHALLENGE_VERSION = 1 as const;
export const BUILDER_CHALLENGE_EVIDENCE_LIMIT = 40;

export type BuilderChallengeBoundary = 'ADDRESSING' | 'DNS' | 'L2' | 'ROUTING' | 'POLICY' | 'TRANSPORT';
export type BuilderChallengeRepairStage = 'NONE' | 'PRIMARY_ONLY' | 'SECONDARY_ONLY' | 'ALL';
export type BuilderChallengeDevicePlane = 'routed' | 'ethernet';
export type BuilderChallengeEvidenceKind = 'ping' | 'traceroute' | 'ethernet-flow' | 'arp-resolution' | 'nat-flow' | 'dhcp-transaction' | 'ipv6-nd' | 'application-transaction' | 'inspect-config' | 'inspect-state' | 'inspect-events';
export type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled' | 'acl-deny' | 'nat-disabled' | 'dhcp-gateway' | 'ipv6-pmtu' | 'dns-name' | 'transport-listener' | 'bgp-import-policy' | 'multi-fault';

export interface BuilderGatewayChallengeFault {
  kind: 'missing-default-gateway';
  boundary: 'ADDRESSING';
  plane: 'routed';
  nodeId: string;
  expectedGateway: string;
}

export interface BuilderAccessVlanChallengeFault {
  kind: 'access-vlan-mismatch';
  boundary: 'L2';
  plane: 'ethernet';
  nodeId: string;
  linkId: string;
  expectedAccessVlan: number;
  brokenAccessVlan: number;
}

export interface BuilderTrunkVlanChallengeFault {
  kind: 'trunk-vlan-pruned';
  boundary: 'L2';
  plane: 'ethernet';
  nodeId: string;
  linkId: string;
  vlanId: number;
  expectedAllowedVlans: number[];
  brokenAllowedVlans: number[];
}

export interface BuilderStpChallengeFault {
  kind: 'stp-disabled-loop';
  boundary: 'L2';
  plane: 'ethernet';
  nodeId: string;
  vlanId: number;
  expectedEnabled: true;
}

export interface BuilderStaticRouteChallengeFault {
  kind: 'missing-static-route';
  boundary: 'ROUTING';
  plane: 'routed';
  nodeId: string;
  expectedRoute: { id: string; routerId: string; prefix: string; nextHop: string; metric: number };
}

export interface BuilderOspfDisabledChallengeFault {
  kind: 'ospf-router-disabled';
  boundary: 'ROUTING';
  plane: 'routed';
  nodeId: string;
  expectedEnabled: true;
}

export interface BuilderAclDenyChallengeFault {
  kind: 'acl-objective-deny';
  boundary: 'POLICY';
  plane: 'routed';
  nodeId: string;
  blockingRule: BuilderAclRule;
}

export interface BuilderNatDisabledChallengeFault {
  kind: 'nat-boundary-disabled';
  boundary: 'POLICY';
  plane: 'routed';
  nodeId: string;
  boundaryId: string;
  expectedEnabled: true;
}

export interface BuilderDhcpGatewayChallengeFault {
  kind: 'dhcp-gateway-option-missing';
  boundary: 'ADDRESSING';
  plane: 'ethernet';
  nodeId: string;
  poolId: string;
  clientDeviceId: string;
  expectedGateway: string;
}

export interface BuilderIpv6PmtuChallengeFault {
  kind: 'path-mtu-reduced';
  boundary: 'TRANSPORT';
  plane: 'routed';
  nodeId: string;
  linkId: string;
  expectedMtuBytes: number;
  brokenMtuBytes: number;
  packetBytes: number;
}

export interface BuilderDnsNameChallengeFault {
  kind: 'service-hostname-missing';
  boundary: 'DNS';
  plane: 'routed';
  nodeId: string;
  serviceId: string;
  expectedHostname: string;
}

export interface BuilderTransportListenerChallengeFault {
  kind: 'service-listener-disabled';
  boundary: 'TRANSPORT';
  plane: 'routed';
  nodeId: string;
  serviceId: string;
  expectedEnabled: true;
  port: number;
}

export interface BuilderBgpImportPolicyChallengeFault {
  kind: 'bgp-import-deny';
  boundary: 'POLICY';
  plane: 'routed';
  nodeId: string;
  sessionId: string;
  targetPrefix: string;
  blockingPolicy: BuilderBgpPolicyRule;
}

export type BuilderChallengeFault = BuilderGatewayChallengeFault | BuilderAccessVlanChallengeFault | BuilderTrunkVlanChallengeFault | BuilderStpChallengeFault | BuilderStaticRouteChallengeFault | BuilderOspfDisabledChallengeFault | BuilderAclDenyChallengeFault | BuilderNatDisabledChallengeFault | BuilderDhcpGatewayChallengeFault | BuilderIpv6PmtuChallengeFault | BuilderDnsNameChallengeFault | BuilderTransportListenerChallengeFault | BuilderBgpImportPolicyChallengeFault;

export interface BuilderChallengeVerification {
  kind: 'routed-probe' | 'ethernet-flow' | 'nat-translation' | 'dhcp-configuration' | 'ipv6-pmtu' | 'application-transaction';
  sourceId: string;
  destinationId: string;
  packetBytes?: number;
  serviceId?: string;
  family?: BuilderApplicationFamily;
}

export interface BuilderChallenge {
  schema: typeof BUILDER_CHALLENGE_SCHEMA;
  version: typeof BUILDER_CHALLENGE_VERSION;
  id: string;
  seed: string;
  family: BuilderChallengeFamily;
  title: string;
  objective: string;
  difficulty: 'FOUNDATION' | 'COMPOSED';
  healthy: BuilderAuthoringSnapshot;
  broken: BuilderAuthoringSnapshot;
  verification: BuilderChallengeVerification;
  fault: BuilderChallengeFault;
  secondaryFault?: BuilderChallengeFault;
}

export interface BuilderChallengeEvidenceInput {
  kind: BuilderChallengeEvidenceKind;
  deviceId?: string | null;
  devicePlane?: BuilderChallengeDevicePlane | null;
  sourceId?: string | null;
  destinationId?: string | null;
  success?: boolean | null;
  requestedBytes?: number | null;
  effectiveBytes?: number | null;
  pathMtuBytes?: number | null;
  ndResolutionCount?: number | null;
  serviceId?: string | null;
  applicationBoundary?: BuilderApplicationTruthBoundary | null;
  repairStage?: BuilderChallengeRepairStage;
  repaired: boolean;
  detail: string;
}

export interface BuilderChallengeEvidence extends BuilderChallengeEvidenceInput {
  id: string;
  sequence: number;
}

export interface BuilderChallengeHypothesis {
  boundary: BuilderChallengeBoundary;
  deviceId: string;
  secondaryBoundary?: BuilderChallengeBoundary;
  secondaryDeviceId?: string;
}

export interface BuilderChallengeScore {
  evidence: number;
  reasoning: number;
  repair: number;
  verification: number;
  total: number;
  repaired: boolean;
  verified: boolean;
  solved: boolean;
}

function normalizeSeed(seed: string): string {
  const normalized = seed.trim();
  if (!normalized) return 'gateway-001';
  return normalized.slice(0, 64);
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function defaultHealthySnapshot(): BuilderAuthoringSnapshot {
  const scenario = defaultBuilderScenario();
  const routing = setBuilderOspfEverywhere(scenario.graph, scenario.addressing, scenario.routing, true);
  return createBuilderAuthoringSnapshot({
    graph: scenario.graph,
    addressing: scenario.addressing,
    routing,
    ethernet: scenario.ethernet,
    linkProfiles: scenario.linkProfiles,
    acl: scenario.acl,
    nat: scenario.nat,
    dhcp: scenario.dhcp,
    ipv6: scenario.ipv6,
    services: scenario.services,
    sourceId: scenario.sourceId,
    destinationId: scenario.destinationId,
    layout: scenario.layout,
  });
}

function defaultStaticHealthySnapshot(): BuilderAuthoringSnapshot {
  const scenario = defaultBuilderScenario();
  let routing = setBuilderOspfEverywhere(scenario.graph, scenario.addressing, scenario.routing, false);
  routing = installStaticRoutesForWeightedPath(scenario.graph, scenario.addressing, routing, 'client', 'app').routing;
  routing = installStaticRoutesForWeightedPath(scenario.graph, scenario.addressing, routing, 'app', 'client').routing;
  return createBuilderAuthoringSnapshot({
    graph: scenario.graph,
    addressing: scenario.addressing,
    routing,
    ethernet: scenario.ethernet,
    linkProfiles: scenario.linkProfiles,
    acl: scenario.acl,
    nat: scenario.nat,
    dhcp: scenario.dhcp,
    ipv6: scenario.ipv6,
    services: scenario.services,
    sourceId: 'client',
    destinationId: 'app',
    layout: scenario.layout,
  });
}


function defaultBgpHealthySnapshot(): BuilderAuthoringSnapshot {
  const scenario = defaultBuilderScenario();
  let routing = setBuilderOspfEverywhere(scenario.graph, scenario.addressing, scenario.routing, false);
  let bgp = routing.bgp;
  bgp = setBuilderBgpRouterAsn(scenario.graph, bgp, 'edge', 64496);
  bgp = setBuilderBgpRouterAsn(scenario.graph, bgp, 'r1', 64500);
  bgp = setBuilderBgpRouterAsn(scenario.graph, bgp, 'core', 65538);

  bgp = upsertBuilderBgpSession(scenario.graph, bgp, 'edge-r1', 'customer-provider');
  const edgeR1 = bgp.sessions.find((entry) => entry.linkId === 'edge-r1');
  if (!edgeR1) throw new Error('The BGP policy challenge requires the canonical EDGE ↔ R1 peering link.');
  bgp = updateBuilderBgpSession(scenario.graph, bgp, edgeR1.id, { relationship: 'customer-provider', customerRouterId: 'edge' });

  bgp = upsertBuilderBgpSession(scenario.graph, bgp, 'r1-core', 'customer-provider');
  const r1Core = bgp.sessions.find((entry) => entry.linkId === 'r1-core');
  if (!r1Core) throw new Error('The BGP policy challenge requires the canonical R1 ↔ CORE peering link.');
  bgp = updateBuilderBgpSession(scenario.graph, bgp, r1Core.id, { relationship: 'customer-provider', customerRouterId: 'r1' });

  const clientPrefix = scenario.addressing.segments['client-edge']?.cidr;
  const appPrefix = scenario.addressing.segments['core-app']?.cidr;
  if (!clientPrefix || !appPrefix) throw new Error('The BGP policy challenge requires canonical CLIENT and APP edge prefixes.');
  bgp = upsertBuilderBgpOrigin(scenario.graph, bgp, { routerId: 'edge', prefix: clientPrefix, med: 0, communities: ['64496:100'], description: 'CLIENT edge prefix' });
  bgp = upsertBuilderBgpOrigin(scenario.graph, bgp, { routerId: 'core', prefix: appPrefix, med: 0, communities: ['65538:100'], description: 'APP edge prefix' });
  routing = validateBuilderRoutingConfig(scenario.graph, scenario.addressing, { ...routing, bgp });

  return createBuilderAuthoringSnapshot({
    graph: scenario.graph,
    addressing: scenario.addressing,
    routing,
    ethernet: scenario.ethernet,
    linkProfiles: scenario.linkProfiles,
    acl: scenario.acl,
    nat: scenario.nat,
    dhcp: scenario.dhcp,
    ipv6: scenario.ipv6,
    services: scenario.services,
    sourceId: 'client',
    destinationId: 'app',
    layout: scenario.layout,
  });
}

function ethernetDeviceLabel(snapshot: BuilderAuthoringSnapshot, id: string): string {
  return snapshot.ethernet.devices.find((device) => device.id === id)?.label ?? id.toUpperCase();
}

function withValidatedEthernet(snapshot: BuilderAuthoringSnapshot, mutate: (ethernet: BuilderEthernetConfig) => void): BuilderAuthoringSnapshot {
  const next = createBuilderAuthoringSnapshot(snapshot);
  mutate(next.ethernet);
  next.ethernet = validateBuilderEthernetConfig(next.ethernet);
  return next;
}

export function createDefaultGatewayChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const healthy = defaultHealthySnapshot();
  const endpoints = healthy.graph.nodes
    .filter((node) => node.kind === 'endpoint' && healthy.addressing.defaultGateways[node.id])
    .sort((left, right) => left.id.localeCompare(right.id));
  if (endpoints.length < 2) throw new Error('The gateway challenge requires at least two routed endpoints with canonical gateways.');

  const hash = hashSeed(seed);
  const target = endpoints[hash % endpoints.length];
  const destination = endpoints.find((endpoint) => endpoint.id !== target.id) ?? endpoints[0];
  const expectedGateway = healthy.addressing.defaultGateways[target.id];
  if (!expectedGateway) throw new Error(`Challenge endpoint ${target.id} has no healthy default gateway.`);

  healthy.sourceId = target.id;
  healthy.destinationId = destination.id;
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.addressing.defaultGateways[target.id] = null;
  broken.addressing = validateBuilderAddressing(broken.graph, broken.addressing);

  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: `gateway-${hash.toString(16).padStart(8, '0')}`,
    seed,
    family: 'gateway',
    title: 'REMOTE SERVICE UNREACHABLE',
    objective: `Restore IPv4 reachability from ${target.label} to ${destination.label}. Diagnose the failure with ordinary Builder evidence before repairing canonical configuration.`,
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    verification: { kind: 'routed-probe', sourceId: target.id, destinationId: destination.id },
    fault: {
      kind: 'missing-default-gateway',
      boundary: 'ADDRESSING',
      plane: 'routed',
      nodeId: target.id,
      expectedGateway,
    },
  };
}

export function createAccessVlanChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  const candidates = [
    { linkId: 'lan-a-sw1', nodeId: 'lan-sw1', endpointId: 'lan-a', peerId: 'lan-b' },
    { linkId: 'lan-b-sw2', nodeId: 'lan-sw2', endpointId: 'lan-b', peerId: 'lan-a' },
  ];
  const target = candidates[hash % candidates.length];
  const link = healthy.ethernet.links.find((entry) => entry.id === target.linkId);
  if (!link || link.mode !== 'access' || link.accessVlan !== 10) throw new Error('The access-VLAN challenge requires the canonical VLAN 10 edge ports.');
  const broken = withValidatedEthernet(healthy, (ethernet) => {
    const targetLink = ethernet.links.find((entry) => entry.id === target.linkId);
    if (!targetLink) throw new Error(`Missing challenge link ${target.linkId}.`);
    targetLink.accessVlan = 20;
  });

  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: `vlan-${hash.toString(16).padStart(8, '0')}`,
    seed,
    family: 'access-vlan',
    title: 'VLAN 10 HOST ISOLATED',
    objective: `Restore Layer-2 reachability from ${ethernetDeviceLabel(healthy, target.endpointId)} to ${ethernetDeviceLabel(healthy, target.peerId)}. Use the normal LAN flow, ARP observations, and Device Workbench before repairing the switch-port configuration.`,
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    verification: { kind: 'ethernet-flow', sourceId: target.endpointId, destinationId: target.peerId },
    fault: {
      kind: 'access-vlan-mismatch',
      boundary: 'L2',
      plane: 'ethernet',
      nodeId: target.nodeId,
      linkId: target.linkId,
      expectedAccessVlan: 10,
      brokenAccessVlan: 20,
    },
  };
}

export function createTrunkVlanChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  const candidates = [
    { linkId: 'lan-sw1-sw2', nodeId: 'lan-sw1' },
    { linkId: 'lan-sw1-r1', nodeId: 'lan-sw1' },
  ];
  const target = candidates[hash % candidates.length];
  const link = healthy.ethernet.links.find((entry) => entry.id === target.linkId);
  if (!link || link.mode !== 'trunk' || !link.allowedVlans?.includes(20)) throw new Error('The trunk challenge requires a canonical trunk carrying VLAN 20.');
  const expectedAllowedVlans = [...link.allowedVlans].sort((a, b) => a - b);
  const brokenAllowedVlans = expectedAllowedVlans.filter((vlanId) => vlanId !== 20);
  if (brokenAllowedVlans.length === 0) throw new Error('The trunk challenge must leave at least one VLAN allowed on the trunk.');
  const broken = withValidatedEthernet(healthy, (ethernet) => {
    const targetLink = ethernet.links.find((entry) => entry.id === target.linkId);
    if (!targetLink) throw new Error(`Missing challenge link ${target.linkId}.`);
    targetLink.allowedVlans = [...brokenAllowedVlans];
  });

  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: `trunk-${hash.toString(16).padStart(8, '0')}`,
    seed,
    family: 'trunk-vlan',
    title: 'SERVER VLAN DISAPPEARS',
    objective: `Restore routed LAN reachability from ${ethernetDeviceLabel(healthy, 'lan-a')} to ${ethernetDeviceLabel(healthy, 'lan-c')}. Diagnose where VLAN 20 stops propagating before repairing the normal trunk allow-list.`,
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    verification: { kind: 'ethernet-flow', sourceId: 'lan-a', destinationId: 'lan-c' },
    fault: {
      kind: 'trunk-vlan-pruned',
      boundary: 'L2',
      plane: 'ethernet',
      nodeId: target.nodeId,
      linkId: target.linkId,
      vlanId: 20,
      expectedAllowedVlans,
      brokenAllowedVlans,
    },
  };
}

export function createStpLoopChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  const broken = withValidatedEthernet(healthy, (ethernet) => {
    ethernet.stp.enabled = false;
  });

  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: `stp-${hash.toString(16).padStart(8, '0')}`,
    seed,
    family: 'stp-loop',
    title: 'VLAN 10 LOOP UNSAFE',
    objective: `Restore safe Layer-2 forwarding from ${ethernetDeviceLabel(healthy, 'lan-a')} to ${ethernetDeviceLabel(healthy, 'lan-b')}. The physical links are intact; use normal STP state and LAN forwarding evidence to find the broken control-plane boundary.`,
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    verification: { kind: 'ethernet-flow', sourceId: 'lan-a', destinationId: 'lan-b' },
    fault: {
      kind: 'stp-disabled-loop',
      boundary: 'L2',
      plane: 'ethernet',
      nodeId: 'lan-sw1',
      vlanId: 10,
      expectedEnabled: true,
    },
  };
}

export function createMissingStaticRouteChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultStaticHealthySnapshot();
  const candidates = ['edge', 'core'].map((routerId) => healthy.routing.staticRoutes.find((route) => route.routerId === routerId)).filter((route): route is NonNullable<typeof route> => Boolean(route));
  if (candidates.length !== 2) throw new Error('The static-route challenge requires canonical forward and reverse edge routes.');
  const expectedRoute = { ...candidates[hash % candidates.length] };
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.routing = validateBuilderRoutingConfig(broken.graph, broken.addressing, {
    ...broken.routing,
    staticRoutes: broken.routing.staticRoutes.filter((route) => route.id !== expectedRoute.id),
  });
  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: `static-${hash.toString(16).padStart(8, '0')}`,
    seed,
    family: 'static-route',
    title: 'STATIC PATH HAS A HOLE',
    objective: 'Restore IPv4 reachability from CLIENT to APP in a static-only routed network. Use ordinary Ping / Traceroute, route-table state, and Device Workbench before restoring the missing route.',
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    verification: { kind: 'routed-probe', sourceId: 'client', destinationId: 'app' },
    fault: { kind: 'missing-static-route', boundary: 'ROUTING', plane: 'routed', nodeId: expectedRoute.routerId, expectedRoute },
  };
}

export function createOspfDisabledChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  const nodeId = ['edge', 'core'][hash % 2];
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.routing = setBuilderOspfRouterEnabled(broken.graph, broken.addressing, broken.routing, nodeId, false);
  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: `ospf-${hash.toString(16).padStart(8, '0')}`,
    seed,
    family: 'ospf-disabled',
    title: 'OSPF ROUTER FALLS SILENT',
    objective: 'Restore IPv4 reachability from CLIENT to APP. Physical links remain up; diagnose the routed control plane with ordinary probes, route/neighbor state, and Device Workbench before restoring OSPF participation.',
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    verification: { kind: 'routed-probe', sourceId: 'client', destinationId: 'app' },
    fault: { kind: 'ospf-router-disabled', boundary: 'ROUTING', plane: 'routed', nodeId, expectedEnabled: true },
  };
}

export function createAclDenyChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  healthy.sourceId = 'client';
  healthy.destinationId = 'app';
  const sourceAddress = interfacesForBuilderNode(healthy.addressing, 'client')[0]?.address;
  const destinationAddress = interfacesForBuilderNode(healthy.addressing, 'app')[0]?.address;
  if (!sourceAddress || !destinationAddress) throw new Error('The ACL challenge requires canonical CLIENT and APP IPv4 addresses.');
  const candidates = ['edge', 'core'].filter((id) => healthy.graph.nodes.some((node) => node.id === id && node.kind === 'router'));
  if (candidates.length !== 2) throw new Error('The ACL challenge requires canonical EDGE and CORE routers.');
  const nodeId = candidates[hash % candidates.length];
  const blockingRule: BuilderAclRule = {
    id: `challenge-acl-${hash.toString(16).padStart(8, '0')}`, routerId: nodeId, order: 5, action: 'deny', protocol: 'icmp',
    sourcePrefix: `${sourceAddress}/32`, destinationPrefix: `${destinationAddress}/32`, destinationPort: null, description: 'Track J objective ICMP deny',
  };
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.acl = upsertBuilderAclRule(broken.graph, broken.acl, blockingRule);
  return {
    schema: BUILDER_CHALLENGE_SCHEMA, version: BUILDER_CHALLENGE_VERSION, id: `acl-${hash.toString(16).padStart(8, '0')}`, seed, family: 'acl-deny',
    title: 'ICMP POLICY BLOCKS THE PATH',
    objective: 'Restore IPv4 diagnostic reachability from CLIENT to APP. Routing remains healthy; use ordinary Ping / Traceroute plus policy state and Device Workbench to identify and remove the blocking canonical ACL rule.',
    difficulty: 'FOUNDATION', healthy, broken, verification: { kind: 'routed-probe', sourceId: 'client', destinationId: 'app' },
    fault: { kind: 'acl-objective-deny', boundary: 'POLICY', plane: 'routed', nodeId, blockingRule },
  };
}

export function createNatDisabledChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  healthy.sourceId = 'client';
  healthy.destinationId = 'app';
  const boundary = healthy.nat.boundaries.find((entry) => entry.routerId === 'edge');
  if (!boundary || !boundary.enabled) throw new Error('The NAT challenge requires the canonical enabled EDGE NAT boundary.');
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.nat = validateBuilderNatConfig(broken.graph, {
    ...broken.nat,
    boundaries: broken.nat.boundaries.map((entry) => entry.id === boundary.id ? { ...entry, enabled: false } : entry),
  });
  return {
    schema: BUILDER_CHALLENGE_SCHEMA, version: BUILDER_CHALLENGE_VERSION, id: `nat-${hash.toString(16).padStart(8, '0')}`, seed, family: 'nat-disabled',
    title: 'PAT BOUNDARY GOES DARK',
    objective: 'Restore required PAT translation from CLIENT to APP. The routed flow may still deliver untranslated; use the ordinary NAT outbound tool and Device Workbench to prove whether the canonical EDGE boundary is actually translating.',
    difficulty: 'FOUNDATION', healthy, broken, verification: { kind: 'nat-translation', sourceId: 'client', destinationId: 'app' },
    fault: { kind: 'nat-boundary-disabled', boundary: 'POLICY', plane: 'routed', nodeId: boundary.routerId, boundaryId: boundary.id, expectedEnabled: true },
  };
}

export function createDhcpGatewayChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  const clientDeviceId = 'lan-a';
  const pool = healthy.dhcp.pools.find((entry) => entry.id === 'dhcp-lan-r1-v10');
  if (!pool || !pool.gateway) throw new Error('The DHCP challenge requires the canonical VLAN 10 pool with a default gateway.');
  healthy.dhcp = setBuilderDhcpClient(healthy.ethernet, healthy.dhcp, clientDeviceId, true);
  const expectedGateway = pool.gateway;
  const broken = createBuilderAuthoringSnapshot(healthy);
  const brokenPool = broken.dhcp.pools.find((entry) => entry.id === pool.id);
  if (!brokenPool) throw new Error('The DHCP challenge pool disappeared while cloning canonical truth.');
  broken.dhcp = upsertBuilderDhcpPool(broken.ethernet, broken.dhcp, { ...brokenPool, gateway: null });
  return {
    schema: BUILDER_CHALLENGE_SCHEMA, version: BUILDER_CHALLENGE_VERSION, id: 'dhcp-' + hash.toString(16).padStart(8, '0'), seed, family: 'dhcp-gateway',
    title: 'DHCP ACK MISSES THE GATEWAY',
    objective: 'Restore a complete DHCP configuration for PC-A. DORA may still ACK an address; use the ordinary DHCP transaction, pool config, and Device Workbench to identify the missing default-gateway option, repair it, and reacquire a configuration-ready lease.',
    difficulty: 'FOUNDATION', healthy, broken, verification: { kind: 'dhcp-configuration', sourceId: clientDeviceId, destinationId: pool.serverDeviceId },
    fault: { kind: 'dhcp-gateway-option-missing', boundary: 'ADDRESSING', plane: 'ethernet', nodeId: pool.serverDeviceId, poolId: pool.id, clientDeviceId, expectedGateway },
  };
}

export function createIpv6PmtuChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  healthy.sourceId = 'client';
  healthy.destinationId = 'app';
  healthy.ipv6 = setBuilderOspfv3Everywhere(healthy.graph, healthy.addressing, healthy.ipv6, true);
  const candidates = [
    { linkId: 'edge-r1', nodeId: 'edge' },
    { linkId: 'r1-core', nodeId: 'r1' },
    { linkId: 'core-app', nodeId: 'core' },
  ];
  const target = candidates[hash % candidates.length];
  const healthyProfile = healthy.linkProfiles[target.linkId];
  if (!healthyProfile || healthyProfile.mtuBytes !== 1500) throw new Error('The PMTU challenge requires the canonical 1500-byte routed-link baseline.');
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.linkProfiles = updateBuilderLinkProfile(broken.graph, broken.linkProfiles, target.linkId, { mtuBytes: 1280 });
  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: 'mtu-' + hash.toString(16).padStart(8, '0'),
    seed,
    family: 'ipv6-pmtu',
    title: 'IPV6 PATH MTU SHRINKS',
    objective: 'Restore full 1500-byte IPv6 delivery from CLIENT to APP. Use the ordinary IPv6 probe, Neighbor Discovery / PMTU state, Device Workbench, and selected-link characteristics; repair canonical MTU truth and prove that 1500 bytes are actually transmitted after stale PMTU state is cleared.',
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    verification: { kind: 'ipv6-pmtu', sourceId: 'client', destinationId: 'app', packetBytes: 1500 },
    fault: { kind: 'path-mtu-reduced', boundary: 'TRANSPORT', plane: 'routed', nodeId: target.nodeId, linkId: target.linkId, expectedMtuBytes: 1500, brokenMtuBytes: 1280, packetBytes: 1500 },
  };
}

export function createDnsNameChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  healthy.sourceId = 'client'; healthy.destinationId = 'app';
  const services = healthy.services ?? [];
  const candidates = services.filter((service) => service.nodeId === 'app' && service.kind !== 'dns' && Boolean(service.hostname)).sort((a,b)=>a.id.localeCompare(b.id));
  const service = candidates[hash % candidates.length];
  if (!service?.hostname) throw new Error('The DNS challenge requires a canonical named application service on APP.');
  const expectedHostname = service.hostname;
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.services = upsertBuilderHostedService(broken.graph, broken.services ?? [], { ...service, hostname: null });
  return { schema: BUILDER_CHALLENGE_SCHEMA, version: BUILDER_CHALLENGE_VERSION, id: 'dns-' + hash.toString(16).padStart(8,'0'), seed, family: 'dns-name', title: 'SERVICE NAME DOES NOT RESOLVE', objective: `Restore the deterministic DNS name for ${service.label} on APP. Use the ordinary application transaction and Device Workbench to prove lower layers were never reached, repair canonical hosted-service configuration, then rerun the exact service request.`, difficulty: 'FOUNDATION', healthy, broken, verification: { kind:'application-transaction', sourceId:'client', destinationId:'app', serviceId:service.id, family:'ipv4' }, fault: { kind:'service-hostname-missing', boundary:'DNS', plane:'routed', nodeId:'app', serviceId:service.id, expectedHostname } };
}

export function createTransportListenerChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  healthy.sourceId = 'client'; healthy.destinationId = 'app';
  const services = healthy.services ?? [];
  const candidates = services.filter((service) => service.nodeId === 'app' && service.enabled && Boolean(service.hostname) && ['http','https','ssh','tcp'].includes(service.kind) && !(service.kind === 'https' && service.transportProfile === 'quic-h3')).sort((a,b)=>a.id.localeCompare(b.id));
  const service = candidates[hash % candidates.length];
  if (!service) throw new Error('The transport challenge requires a canonical named TCP service on APP.');
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.services = upsertBuilderHostedService(broken.graph, broken.services ?? [], { ...service, enabled: false });
  return { schema: BUILDER_CHALLENGE_SCHEMA, version: BUILDER_CHALLENGE_VERSION, id: 'transport-' + hash.toString(16).padStart(8,'0'), seed, family: 'transport-listener', title: 'SERVICE PORT IS CLOSED', objective: `Restore the ${service.label} listener on APP. Use the ordinary application transaction to prove DNS, L2, routing, policy, and link truth reach the endpoint before transport fails; repair canonical listener configuration and rerun the exact service request.`, difficulty: 'FOUNDATION', healthy, broken, verification: { kind:'application-transaction', sourceId:'client', destinationId:'app', serviceId:service.id, family:'ipv4' }, fault: { kind:'service-listener-disabled', boundary:'TRANSPORT', plane:'routed', nodeId:'app', serviceId:service.id, expectedEnabled:true, port:service.port } };
}


export function createBgpImportPolicyChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultBgpHealthySnapshot();
  const edgeSession = healthy.routing.bgp.sessions.find((entry) => entry.linkId === 'edge-r1');
  const coreSession = healthy.routing.bgp.sessions.find((entry) => entry.linkId === 'r1-core');
  const clientPrefix = healthy.addressing.segments['client-edge']?.cidr;
  const appPrefix = healthy.addressing.segments['core-app']?.cidr;
  if (!edgeSession || !coreSession || !clientPrefix || !appPrefix) throw new Error('The BGP policy challenge requires canonical edge/core sessions and endpoint prefixes.');
  const candidates = [
    { nodeId: 'edge', sessionId: edgeSession.id, targetPrefix: appPrefix, label: 'APP service prefix' },
    { nodeId: 'core', sessionId: coreSession.id, targetPrefix: clientPrefix, label: 'CLIENT return prefix' },
  ];
  const target = candidates[hash % candidates.length];
  const blockingPolicy: BuilderBgpPolicyRule = {
    id: `challenge-bgp-import-${hash.toString(16).padStart(8, '0')}`,
    routerId: target.nodeId,
    direction: 'import',
    sessionId: target.sessionId,
    order: 5,
    action: 'deny',
    prefix: target.targetPrefix,
    setLocalPref: null,
    setMed: null,
    addCommunity: null,
    matchCommunity: null,
    removeCommunity: null,
    prependAsCount: 0,
    allowRelationshipLeak: false,
    description: `Track J deny ${target.label}`,
  };
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.routing = validateBuilderRoutingConfig(broken.graph, broken.addressing, {
    ...broken.routing,
    bgp: upsertBuilderBgpPolicy(broken.graph, broken.routing.bgp, blockingPolicy),
  });
  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: `bgp-policy-${hash.toString(16).padStart(8, '0')}`,
    seed,
    family: 'bgp-import-policy',
    title: 'BGP IMPORT POLICY BLACKHOLES THE SERVICE',
    objective: `Restore CLIENT ↔ APP IPv4 reachability in a BGP-only routed baseline. One explicit import policy rejects the required ${target.label}; use ordinary Ping / Traceroute, BGP RIB/policy state, and Device Workbench before removing the canonical deny and proving the same objective again.`,
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    verification: { kind: 'routed-probe', sourceId: 'client', destinationId: 'app' },
    fault: { kind: 'bgp-import-deny', boundary: 'POLICY', plane: 'routed', nodeId: target.nodeId, sessionId: target.sessionId, targetPrefix: target.targetPrefix, blockingPolicy },
  };
}


export function createComposedChallenge(seedInput: string): BuilderChallenge {
  const seed=normalizeSeed(seedInput), hash=hashSeed(seed), healthy=defaultHealthySnapshot();
  healthy.sourceId='client'; healthy.destinationId='app';
  const sourceAddress=interfacesForBuilderNode(healthy.addressing,'client')[0]?.address;
  const destinationAddress=interfacesForBuilderNode(healthy.addressing,'app')[0]?.address;
  const natBoundary=healthy.nat.boundaries.find((entry)=>entry.routerId==='edge'&&entry.enabled);
  if(!sourceAddress||!destinationAddress||!natBoundary)throw new Error('The composed challenge requires canonical CLIENT/APP IPv4 addresses and the enabled EDGE NAT boundary.');
  const translatedSource=natBoundary.overloadAddress;
  const blockingRule:BuilderAclRule={id:`challenge-multi-acl-${hash.toString(16).padStart(8,'0')}`,routerId:'core',order:5,action:'deny',protocol:'icmp',sourcePrefix:`${translatedSource}/32`,destinationPrefix:`${destinationAddress}/32`,destinationPort:null,description:'Track J composed post-NAT objective ICMP deny'};
  const broken=createBuilderAuthoringSnapshot(healthy);
  broken.acl=upsertBuilderAclRule(broken.graph,broken.acl,blockingRule);
  const secondaryFault:BuilderAclDenyChallengeFault={kind:'acl-objective-deny',boundary:'POLICY',plane:'routed',nodeId:'core',blockingRule};
  let fault:BuilderGatewayChallengeFault|BuilderOspfDisabledChallengeFault;
  if(hash%2===0){
    const expectedGateway=healthy.addressing.defaultGateways.client;
    if(!expectedGateway)throw new Error('The composed gateway branch requires the canonical CLIENT default gateway.');
    broken.addressing.defaultGateways.client=null;
    broken.addressing=validateBuilderAddressing(broken.graph,broken.addressing);
    fault={kind:'missing-default-gateway',boundary:'ADDRESSING',plane:'routed',nodeId:'client',expectedGateway};
  }else{
    broken.routing=setBuilderOspfRouterEnabled(broken.graph,broken.addressing,broken.routing,'edge',false);
    fault={kind:'ospf-router-disabled',boundary:'ROUTING',plane:'routed',nodeId:'edge',expectedEnabled:true};
  }
  return{schema:BUILDER_CHALLENGE_SCHEMA,version:BUILDER_CHALLENGE_VERSION,id:`multi-${hash.toString(16).padStart(8,'0')}`,seed,family:'multi-fault',title:'TWO FAILURES, ONE SYMPTOM',objective:'Restore CLIENT → APP IPv4 reachability. Two independent canonical faults are active and one can mask the other. Use ordinary probes and Device Workbench to identify an ordered two-step causal hypothesis, repair both with normal Builder controls, and verify only after both faults are restored.',difficulty:'COMPOSED',healthy,broken,verification:{kind:'routed-probe',sourceId:'client',destinationId:'app'},fault,secondaryFault};
}

export function createBuilderChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const lowered = seed.toLowerCase();
  if (lowered.startsWith('vlan-') || lowered.startsWith('l2-vlan-')) return createAccessVlanChallenge(seed);
  if (lowered.startsWith('trunk-') || lowered.startsWith('l2-trunk-')) return createTrunkVlanChallenge(seed);
  if (lowered.startsWith('stp-') || lowered.startsWith('l2-stp-')) return createStpLoopChallenge(seed);
  if (lowered.startsWith('static-') || lowered.startsWith('route-')) return createMissingStaticRouteChallenge(seed);
  if (lowered.startsWith('ospf-')) return createOspfDisabledChallenge(seed);
  if (lowered.startsWith('acl-') || lowered.startsWith('firewall-')) return createAclDenyChallenge(seed);
  if (lowered.startsWith('nat-') || lowered.startsWith('pat-')) return createNatDisabledChallenge(seed);
  if (lowered.startsWith('dhcp-')) return createDhcpGatewayChallenge(seed);
  if (lowered.startsWith('mtu-') || lowered.startsWith('pmtu-') || lowered.startsWith('ipv6-mtu-')) return createIpv6PmtuChallenge(seed);
  if (lowered.startsWith('dns-')) return createDnsNameChallenge(seed);
  if (lowered.startsWith('transport-') || lowered.startsWith('tcp-') || lowered.startsWith('listener-')) return createTransportListenerChallenge(seed);
  if (lowered.startsWith('bgp-') || lowered.startsWith('bgp-policy-')) return createBgpImportPolicyChallenge(seed);
  if (lowered.startsWith('multi-') || lowered.startsWith('composed-')) return createComposedChallenge(seed);
  return createDefaultGatewayChallenge(seed);
}

export function builderChallengeToken(challenge: Pick<BuilderChallenge, 'version' | 'seed'>): string {
  return `HOP-J${challenge.version}.${encodeURIComponent(challenge.seed)}`;
}

export function seedFromBuilderChallengeToken(token: string): string {
  const match = /^HOP-J1\.(.+)$/.exec(token.trim());
  if (!match) throw new Error('Unsupported HOPSCOTCH challenge token.');
  try {
    return normalizeSeed(decodeURIComponent(match[1]));
  } catch {
    throw new Error('Malformed HOPSCOTCH challenge token.');
  }
}

function sameNumberArray(left: readonly number[] | undefined, right: readonly number[]): boolean {
  const normalized = [...(left ?? [])].sort((a, b) => a - b);
  return normalized.length === right.length && normalized.every((value, index) => value === right[index]);
}

function challengeFaultIsRepaired(fault:BuilderChallengeFault,addressing:BuilderAddressing,ethernet:BuilderEthernetConfig,routing:BuilderRoutingConfig,acl:BuilderAclConfig,nat:BuilderNatConfig,dhcp:BuilderDhcpConfig,linkProfiles:BuilderLinkProfiles,services:readonly BuilderHostedService[]):boolean{
  if(fault.kind==='missing-default-gateway')return addressing.defaultGateways[fault.nodeId]===fault.expectedGateway;
  if(fault.kind==='access-vlan-mismatch'){const link=ethernet.links.find((entry)=>entry.id===fault.linkId);return link?.mode==='access'&&link.accessVlan===fault.expectedAccessVlan;}
  if(fault.kind==='trunk-vlan-pruned'){const link=ethernet.links.find((entry)=>entry.id===fault.linkId);return link?.mode==='trunk'&&sameNumberArray(link.allowedVlans,fault.expectedAllowedVlans);}
  if(fault.kind==='stp-disabled-loop')return ethernet.stp.enabled===fault.expectedEnabled;
  if(fault.kind==='missing-static-route')return routing.staticRoutes.some((route)=>route.id===fault.expectedRoute.id&&route.routerId===fault.expectedRoute.routerId&&route.prefix===fault.expectedRoute.prefix&&route.nextHop===fault.expectedRoute.nextHop&&route.metric===fault.expectedRoute.metric);
  if(fault.kind==='ospf-router-disabled')return routing.ospf.enabledRouterIds.includes(fault.nodeId)===fault.expectedEnabled;
  if(fault.kind==='acl-objective-deny')return !acl.rules.some((rule)=>rule.id===fault.blockingRule.id);
  if(fault.kind==='nat-boundary-disabled'){const boundary=nat.boundaries.find((entry)=>entry.id===fault.boundaryId&&entry.routerId===fault.nodeId);return boundary?.enabled===fault.expectedEnabled;}
  if(fault.kind==='dhcp-gateway-option-missing'){const pool=dhcp.pools.find((entry)=>entry.id===fault.poolId&&entry.serverDeviceId===fault.nodeId);return pool?.gateway===fault.expectedGateway;}
  if(fault.kind==='path-mtu-reduced')return linkProfiles[fault.linkId]?.mtuBytes===fault.expectedMtuBytes;
  if(fault.kind==='bgp-import-deny')return !routing.bgp.policies.some((rule)=>rule.id===fault.blockingPolicy.id);
  const service=services.find((entry)=>entry.id===fault.serviceId&&entry.nodeId===fault.nodeId);
  return fault.kind==='service-hostname-missing'?service?.hostname===fault.expectedHostname:service?.enabled===fault.expectedEnabled;
}
export function builderChallengeRepairStage(challenge:BuilderChallenge,addressing:BuilderAddressing,ethernet:BuilderEthernetConfig,routing:BuilderRoutingConfig,acl:BuilderAclConfig=challenge.broken.acl,nat:BuilderNatConfig=challenge.broken.nat,dhcp:BuilderDhcpConfig=challenge.broken.dhcp,linkProfiles:BuilderLinkProfiles=challenge.broken.linkProfiles,services:readonly BuilderHostedService[]=challenge.broken.services??[]):BuilderChallengeRepairStage{
  const primary=challengeFaultIsRepaired(challenge.fault,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);
  if(!challenge.secondaryFault)return primary?'ALL':'NONE';
  const secondary=challengeFaultIsRepaired(challenge.secondaryFault,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);
  return primary&&secondary?'ALL':primary?'PRIMARY_ONLY':secondary?'SECONDARY_ONLY':'NONE';
}
export function builderChallengeIsRepaired(challenge:BuilderChallenge,addressing:BuilderAddressing,ethernet:BuilderEthernetConfig,routing:BuilderRoutingConfig,acl:BuilderAclConfig=challenge.broken.acl,nat:BuilderNatConfig=challenge.broken.nat,dhcp:BuilderDhcpConfig=challenge.broken.dhcp,linkProfiles:BuilderLinkProfiles=challenge.broken.linkProfiles,services:readonly BuilderHostedService[]=challenge.broken.services??[]):boolean{
  return builderChallengeRepairStage(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services)==='ALL';
}

export function builderChallengeSolvedExplanation(challenge: BuilderChallenge): string {
  const fault = challenge.fault;
  if(challenge.secondaryFault){const first=fault.kind==='missing-default-gateway'?`${fault.nodeId.toUpperCase()} was missing its canonical default gateway`:fault.kind==='ospf-router-disabled'?`${fault.nodeId.toUpperCase()} was not participating in OSPF`:`${fault.nodeId.toUpperCase()} carried the first canonical fault`;const second=challenge.secondaryFault.kind==='acl-objective-deny'?`${challenge.secondaryFault.nodeId.toUpperCase()} carried an explicit ICMP deny for the objective`:`${challenge.secondaryFault.nodeId.toUpperCase()} carried the second canonical fault`;return `Two independent faults were active: ${first}, then ${second}. Restoring both canonical fields and rerunning the same CLIENT → APP probe closed the composed causal chain.`;}
  if (fault.kind === 'missing-default-gateway') return `The endpoint had no default gateway. Restoring canonical gateway ${fault.expectedGateway} repaired forwarding, and the post-repair routed probe verified the outcome.`;
  if (fault.kind === 'access-vlan-mismatch') return `The access port ${fault.linkId.toUpperCase()} was assigned to VLAN ${fault.brokenAccessVlan} instead of VLAN ${fault.expectedAccessVlan}. Restoring the canonical access VLAN repaired ARP and Layer-2 forwarding.`;
  if (fault.kind === 'trunk-vlan-pruned') return `VLAN ${fault.vlanId} was pruned from trunk ${fault.linkId.toUpperCase()}. Restoring the canonical allow-list (${fault.expectedAllowedVlans.join(', ')}) repaired the tagged path and the post-repair LAN flow verified it.`;
  if (fault.kind === 'stp-disabled-loop') return `STP was disabled while VLAN ${fault.vlanId} had a physical Layer-2 cycle. Re-enabling canonical STP restored a loop-safe forwarding tree and the post-repair LAN flow verified it.`;
  if (fault.kind === 'missing-static-route') return `${fault.nodeId.toUpperCase()} was missing static route ${fault.expectedRoute.prefix} via ${fault.expectedRoute.nextHop}. Restoring that canonical route repaired forwarding and the post-repair routed probe verified it.`;
  if (fault.kind === 'ospf-router-disabled') return `${fault.nodeId.toUpperCase()} was not participating in OSPF. Re-enabling the canonical OSPF process restored route learning and the post-repair routed probe verified reachability.`;
  if (fault.kind === 'acl-objective-deny') return `${fault.nodeId.toUpperCase()} had an explicit ICMP deny for the challenge source/destination. Removing the canonical blocking rule restored policy permission and the post-repair probe verified reachability.`;
  if (fault.kind === 'nat-boundary-disabled') return `${fault.nodeId.toUpperCase()} had the canonical NAT boundary disabled. Re-enabling it restored PAT translation; the post-repair NAT flow proved the tuple was translated rather than merely routed.`;
  if (fault.kind === 'dhcp-gateway-option-missing') return `${fault.nodeId.toUpperCase()} ACKed the DHCP lease without a default-gateway option. Restoring ${fault.expectedGateway} to the canonical pool and reacquiring produced a configuration-ready lease.`;
  if (fault.kind === 'path-mtu-reduced') return `${fault.linkId.toUpperCase()} was reduced to MTU ${fault.brokenMtuBytes}. Restoring MTU ${fault.expectedMtuBytes}, clearing stale PMTU state, and retransmitting ${fault.packetBytes} bytes proved full-size IPv6 delivery while Neighbor Discovery remained healthy.`;
  if (fault.kind === 'service-hostname-missing') return `${fault.serviceId} had no deterministic hostname. Restoring ${fault.expectedHostname} repaired the DNS intent boundary; the post-repair application transaction then traversed the normal lower-layer and service stack.`;
  if (fault.kind === 'service-listener-disabled') return `${fault.serviceId} had its canonical listener disabled on port ${fault.port}. Re-enabling the listener repaired the transport boundary after DNS/routing/policy/link truth had already reached ${fault.nodeId.toUpperCase()}.`;
  return `${fault.nodeId.toUpperCase()} imported an explicit BGP deny for ${fault.targetPrefix} on ${fault.sessionId}. Removing that canonical policy restored the required best path, and the post-repair routed probe proved end-to-end reachability.`;
}

export function appendBuilderChallengeEvidence(
  evidence: readonly BuilderChallengeEvidence[],
  input: BuilderChallengeEvidenceInput,
): BuilderChallengeEvidence[] {
  const sequence = (evidence.at(-1)?.sequence ?? 0) + 1;
  return [...evidence, { ...input, id: `challenge-evidence-${sequence}`, sequence }].slice(-BUILDER_CHALLENGE_EVIDENCE_LIMIT);
}

function hasEvidence(
  evidence: readonly BuilderChallengeEvidence[],
  predicate: (entry: BuilderChallengeEvidence) => boolean,
): boolean {
  return evidence.some(predicate);
}

function isObjectiveEvidence(challenge: BuilderChallenge, entry: BuilderChallengeEvidence): boolean {
  if (entry.sourceId !== challenge.verification.sourceId || entry.destinationId !== challenge.verification.destinationId) return false;
  return challenge.verification.kind !== 'application-transaction' || entry.serviceId === challenge.verification.serviceId;
}

function isFaultInspection(fault:BuilderChallengeFault,entry:BuilderChallengeEvidence):boolean{return entry.deviceId===fault.nodeId&&entry.devicePlane===fault.plane;}

export function scoreBuilderChallenge(
  challenge: BuilderChallenge,
  evidence: readonly BuilderChallengeEvidence[],
  hypothesis: BuilderChallengeHypothesis | null,
  addressing: BuilderAddressing,
  ethernet: BuilderEthernetConfig,
  routing: BuilderRoutingConfig,
  acl: BuilderAclConfig = challenge.broken.acl,
  nat: BuilderNatConfig = challenge.broken.nat,
  dhcp: BuilderDhcpConfig = challenge.broken.dhcp,
  linkProfiles: BuilderLinkProfiles = challenge.broken.linkProfiles,
  services: readonly BuilderHostedService[] = challenge.broken.services ?? [],
): BuilderChallengeScore {
  const inspectedState = hasEvidence(evidence, (entry) => entry.kind === 'inspect-state' && isFaultInspection(challenge.fault, entry) && !entry.repaired);
  const inspectedConfig = hasEvidence(evidence, (entry) => entry.kind === 'inspect-config' && isFaultInspection(challenge.fault, entry) && !entry.repaired);

  if(challenge.secondaryFault){
    const secondary=challenge.secondaryFault;
    const failedPing=hasEvidence(evidence,(entry)=>entry.kind==='ping'&&isObjectiveEvidence(challenge,entry)&&entry.success===false&&entry.repairStage==='NONE');
    const failedTrace=hasEvidence(evidence,(entry)=>entry.kind==='traceroute'&&isObjectiveEvidence(challenge,entry)&&entry.success===false&&entry.repairStage==='NONE');
    const firstInspect=hasEvidence(evidence,(entry)=>(entry.kind==='inspect-state'||entry.kind==='inspect-config')&&isFaultInspection(challenge.fault,entry)&&entry.repairStage!=='ALL');
    const secondInspect=hasEvidence(evidence,(entry)=>(entry.kind==='inspect-state'||entry.kind==='inspect-config')&&isFaultInspection(secondary,entry)&&entry.repairStage!=='ALL');
    const oneRepairFailure=hasEvidence(evidence,(entry)=>(entry.kind==='ping'||entry.kind==='traceroute')&&isObjectiveEvidence(challenge,entry)&&entry.success===false&&(entry.repairStage==='PRIMARY_ONLY'||entry.repairStage==='SECONDARY_ONLY'));
    const evidenceScore=(failedPing?10:0)+(failedTrace?10:0)+(firstInspect?5:0)+(secondInspect?5:0)+(oneRepairFailure?10:0);
    const eligible=(failedPing||failedTrace)&&firstInspect&&secondInspect&&oneRepairFailure;
    const reasoningScore=eligible&&hypothesis?(hypothesis.boundary===challenge.fault.boundary?5:0)+(hypothesis.deviceId===challenge.fault.nodeId?5:0)+(hypothesis.secondaryBoundary===secondary.boundary?5:0)+(hypothesis.secondaryDeviceId===secondary.nodeId?5:0):0;
    const repaired=builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);
    const verified=hasEvidence(evidence,(entry)=>(entry.kind==='ping'||entry.kind==='traceroute')&&isObjectiveEvidence(challenge,entry)&&entry.success===true&&entry.repairStage==='ALL'&&entry.repaired);
    const repairScore=repaired?25:0,verificationScore=repaired&&verified?15:0;
    return{evidence:evidenceScore,reasoning:reasoningScore,repair:repairScore,verification:verificationScore,total:evidenceScore+reasoningScore+repairScore+verificationScore,repaired,verified:repaired&&verified,solved:repaired&&verified};
  }

  let evidenceScore = 0;
  let hasPrimaryDiagnostic = false;
  if (challenge.verification.kind === 'routed-probe') {
    const failedPing = hasEvidence(evidence, (entry) => entry.kind === 'ping' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);
    const failedTraceroute = hasEvidence(evidence, (entry) => entry.kind === 'traceroute' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);
    evidenceScore = (failedPing ? 10 : 0) + (failedTraceroute ? 10 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);
    hasPrimaryDiagnostic = failedPing || failedTraceroute;
  } else if (challenge.verification.kind === 'ethernet-flow') {
    const failedLanFlow = hasEvidence(evidence, (entry) => entry.kind === 'ethernet-flow' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);
    const observedArp = hasEvidence(evidence, (entry) => entry.kind === 'arp-resolution' && isObjectiveEvidence(challenge, entry) && !entry.repaired);
    evidenceScore = (failedLanFlow ? 15 : 0) + (observedArp ? 5 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);
    hasPrimaryDiagnostic = failedLanFlow;
  } else if (challenge.verification.kind === 'nat-translation') {
    const missingTranslation = hasEvidence(evidence, (entry) => entry.kind === 'nat-flow' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);
    evidenceScore = (missingTranslation ? 20 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);
    hasPrimaryDiagnostic = missingTranslation;
  } else if (challenge.verification.kind === 'ipv6-pmtu') {
    const packetBytes = challenge.verification.packetBytes ?? 1500;
    const packetTooBig = hasEvidence(evidence, (entry) => (entry.kind === 'ping' || entry.kind === 'traceroute') && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired && entry.pathMtuBytes != null && entry.pathMtuBytes < packetBytes);
    const observedNd = hasEvidence(evidence, (entry) => entry.kind === 'ipv6-nd' && isObjectiveEvidence(challenge, entry) && entry.success === true && !entry.repaired);
    evidenceScore = (packetTooBig ? 15 : 0) + (observedNd ? 5 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);
    hasPrimaryDiagnostic = packetTooBig;
  } else if (challenge.verification.kind === 'application-transaction') {
    const failedApplication = hasEvidence(evidence, (entry) => entry.kind === 'application-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === false && entry.applicationBoundary === challenge.fault.boundary && !entry.repaired);
    evidenceScore = (failedApplication ? 20 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);
    hasPrimaryDiagnostic = failedApplication;
  } else {
    const incompleteConfiguration = hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);
    evidenceScore = (incompleteConfiguration ? 20 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);
    hasPrimaryDiagnostic = incompleteConfiguration;
  }

  const hasInspectionEvidence = inspectedState || inspectedConfig;
  const reasoningEligible = hasPrimaryDiagnostic && hasInspectionEvidence;
  const reasoningScore = reasoningEligible && hypothesis
    ? (hypothesis.boundary === challenge.fault.boundary ? 10 : 0) + (hypothesis.deviceId === challenge.fault.nodeId ? 10 : 0)
    : 0;

  const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles, services);
  const verified = challenge.verification.kind === 'routed-probe'
    ? hasEvidence(evidence, (entry) => (entry.kind === 'ping' || entry.kind === 'traceroute') && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired)
    : challenge.verification.kind === 'ethernet-flow'
      ? hasEvidence(evidence, (entry) => entry.kind === 'ethernet-flow' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired)
      : challenge.verification.kind === 'nat-translation'
        ? hasEvidence(evidence, (entry) => entry.kind === 'nat-flow' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired)
        : challenge.verification.kind === 'ipv6-pmtu'
          ? hasEvidence(evidence, (entry) => (entry.kind === 'ping' || entry.kind === 'traceroute') && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired && entry.requestedBytes === (challenge.verification.packetBytes ?? 1500) && entry.effectiveBytes === (challenge.verification.packetBytes ?? 1500))
          : challenge.verification.kind === 'application-transaction'
            ? hasEvidence(evidence, (entry) => entry.kind === 'application-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired)
            : hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired);
  const repairScore = repaired ? 25 : 0;
  const verificationScore = repaired && verified ? 15 : 0;
  const total = evidenceScore + reasoningScore + repairScore + verificationScore;

  return {
    evidence: evidenceScore,
    reasoning: reasoningScore,
    repair: repairScore,
    verification: verificationScore,
    total,
    repaired,
    verified: repaired && verified,
    solved: repaired && verified,
  };
}

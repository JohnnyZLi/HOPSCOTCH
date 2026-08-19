import { validateBuilderAddressing, type BuilderAddressing } from './addressing.ts';
import { createBuilderAuthoringSnapshot, type BuilderAuthoringSnapshot } from './authoring.ts';
import { validateBuilderEthernetConfig, type BuilderEthernetConfig } from './ethernet.ts';
import { installStaticRoutesForWeightedPath, setBuilderOspfEverywhere, setBuilderOspfRouterEnabled, validateBuilderRoutingConfig, type BuilderRoutingConfig } from './routing.ts';
import { defaultBuilderScenario } from './scenario.ts';

export const BUILDER_CHALLENGE_SCHEMA = 'hopscotch.builder.challenge' as const;
export const BUILDER_CHALLENGE_VERSION = 1 as const;
export const BUILDER_CHALLENGE_EVIDENCE_LIMIT = 40;

export type BuilderChallengeBoundary = 'ADDRESSING' | 'L2' | 'ROUTING' | 'POLICY' | 'TRANSPORT';
export type BuilderChallengeDevicePlane = 'routed' | 'ethernet';
export type BuilderChallengeEvidenceKind = 'ping' | 'traceroute' | 'ethernet-flow' | 'arp-resolution' | 'inspect-config' | 'inspect-state' | 'inspect-events';
export type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled';

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

export type BuilderChallengeFault = BuilderGatewayChallengeFault | BuilderAccessVlanChallengeFault | BuilderTrunkVlanChallengeFault | BuilderStpChallengeFault | BuilderStaticRouteChallengeFault | BuilderOspfDisabledChallengeFault;

export interface BuilderChallengeVerification {
  kind: 'routed-probe' | 'ethernet-flow';
  sourceId: string;
  destinationId: string;
}

export interface BuilderChallenge {
  schema: typeof BUILDER_CHALLENGE_SCHEMA;
  version: typeof BUILDER_CHALLENGE_VERSION;
  id: string;
  seed: string;
  family: BuilderChallengeFamily;
  title: string;
  objective: string;
  difficulty: 'FOUNDATION';
  healthy: BuilderAuthoringSnapshot;
  broken: BuilderAuthoringSnapshot;
  verification: BuilderChallengeVerification;
  fault: BuilderChallengeFault;
}

export interface BuilderChallengeEvidenceInput {
  kind: BuilderChallengeEvidenceKind;
  deviceId?: string | null;
  devicePlane?: BuilderChallengeDevicePlane | null;
  sourceId?: string | null;
  destinationId?: string | null;
  success?: boolean | null;
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
    title: 'OSPF EDGE FALLS SILENT',
    objective: 'Restore IPv4 reachability from CLIENT to APP. Physical links remain up; diagnose the routed control plane with ordinary probes, route/neighbor state, and Device Workbench before restoring OSPF participation.',
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    verification: { kind: 'routed-probe', sourceId: 'client', destinationId: 'app' },
    fault: { kind: 'ospf-router-disabled', boundary: 'ROUTING', plane: 'routed', nodeId, expectedEnabled: true },
  };
}

export function createBuilderChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const lowered = seed.toLowerCase();
  if (lowered.startsWith('vlan-') || lowered.startsWith('l2-vlan-')) return createAccessVlanChallenge(seed);
  if (lowered.startsWith('trunk-') || lowered.startsWith('l2-trunk-')) return createTrunkVlanChallenge(seed);
  if (lowered.startsWith('stp-') || lowered.startsWith('l2-stp-')) return createStpLoopChallenge(seed);
  if (lowered.startsWith('static-') || lowered.startsWith('route-')) return createMissingStaticRouteChallenge(seed);
  if (lowered.startsWith('ospf-')) return createOspfDisabledChallenge(seed);
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

export function builderChallengeIsRepaired(challenge: BuilderChallenge, addressing: BuilderAddressing, ethernet: BuilderEthernetConfig, routing: BuilderRoutingConfig): boolean {
  const fault = challenge.fault;
  if (fault.kind === 'missing-default-gateway') return addressing.defaultGateways[fault.nodeId] === fault.expectedGateway;
  if (fault.kind === 'access-vlan-mismatch') {
    const link = ethernet.links.find((entry) => entry.id === fault.linkId);
    return link?.mode === 'access' && link.accessVlan === fault.expectedAccessVlan;
  }
  if (fault.kind === 'trunk-vlan-pruned') {
    const link = ethernet.links.find((entry) => entry.id === fault.linkId);
    return link?.mode === 'trunk' && sameNumberArray(link.allowedVlans, fault.expectedAllowedVlans);
  }
  if (fault.kind === 'stp-disabled-loop') return ethernet.stp.enabled === fault.expectedEnabled;
  if (fault.kind === 'missing-static-route') {
    return routing.staticRoutes.some((route) => route.id === fault.expectedRoute.id && route.routerId === fault.expectedRoute.routerId && route.prefix === fault.expectedRoute.prefix && route.nextHop === fault.expectedRoute.nextHop && route.metric === fault.expectedRoute.metric);
  }
  return routing.ospf.enabledRouterIds.includes(fault.nodeId) === fault.expectedEnabled;
}

export function builderChallengeSolvedExplanation(challenge: BuilderChallenge): string {
  const fault = challenge.fault;
  if (fault.kind === 'missing-default-gateway') return `The endpoint had no default gateway. Restoring canonical gateway ${fault.expectedGateway} repaired forwarding, and the post-repair routed probe verified the outcome.`;
  if (fault.kind === 'access-vlan-mismatch') return `The access port ${fault.linkId.toUpperCase()} was assigned to VLAN ${fault.brokenAccessVlan} instead of VLAN ${fault.expectedAccessVlan}. Restoring the canonical access VLAN repaired ARP and Layer-2 forwarding.`;
  if (fault.kind === 'trunk-vlan-pruned') return `VLAN ${fault.vlanId} was pruned from trunk ${fault.linkId.toUpperCase()}. Restoring the canonical allow-list (${fault.expectedAllowedVlans.join(', ')}) repaired the tagged path and the post-repair LAN flow verified it.`;
  if (fault.kind === 'stp-disabled-loop') return `STP was disabled while VLAN ${fault.vlanId} had a physical Layer-2 cycle. Re-enabling canonical STP restored a loop-safe forwarding tree and the post-repair LAN flow verified it.`;
  if (fault.kind === 'missing-static-route') return `${fault.nodeId.toUpperCase()} was missing static route ${fault.expectedRoute.prefix} via ${fault.expectedRoute.nextHop}. Restoring that canonical route repaired forwarding and the post-repair routed probe verified it.`;
  return `${fault.nodeId.toUpperCase()} was not participating in OSPF. Re-enabling the canonical OSPF process restored route learning and the post-repair routed probe verified reachability.`;
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
  return entry.sourceId === challenge.verification.sourceId && entry.destinationId === challenge.verification.destinationId;
}

function isFaultInspection(challenge: BuilderChallenge, entry: BuilderChallengeEvidence): boolean {
  return entry.deviceId === challenge.fault.nodeId && entry.devicePlane === challenge.fault.plane;
}

export function scoreBuilderChallenge(
  challenge: BuilderChallenge,
  evidence: readonly BuilderChallengeEvidence[],
  hypothesis: BuilderChallengeHypothesis | null,
  addressing: BuilderAddressing,
  ethernet: BuilderEthernetConfig,
  routing: BuilderRoutingConfig,
): BuilderChallengeScore {
  const inspectedState = hasEvidence(evidence, (entry) => entry.kind === 'inspect-state' && isFaultInspection(challenge, entry) && !entry.repaired);
  const inspectedConfig = hasEvidence(evidence, (entry) => entry.kind === 'inspect-config' && isFaultInspection(challenge, entry) && !entry.repaired);

  let evidenceScore = 0;
  let hasPrimaryDiagnostic = false;
  if (challenge.verification.kind === 'routed-probe') {
    const failedPing = hasEvidence(evidence, (entry) => entry.kind === 'ping' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);
    const failedTraceroute = hasEvidence(evidence, (entry) => entry.kind === 'traceroute' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);
    evidenceScore = (failedPing ? 10 : 0) + (failedTraceroute ? 10 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);
    hasPrimaryDiagnostic = failedPing || failedTraceroute;
  } else {
    const failedLanFlow = hasEvidence(evidence, (entry) => entry.kind === 'ethernet-flow' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);
    const observedArp = hasEvidence(evidence, (entry) => entry.kind === 'arp-resolution' && isObjectiveEvidence(challenge, entry) && !entry.repaired);
    evidenceScore = (failedLanFlow ? 15 : 0) + (observedArp ? 5 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);
    hasPrimaryDiagnostic = failedLanFlow;
  }

  const hasInspectionEvidence = inspectedState || inspectedConfig;
  const reasoningEligible = hasPrimaryDiagnostic && hasInspectionEvidence;
  const reasoningScore = reasoningEligible && hypothesis
    ? (hypothesis.boundary === challenge.fault.boundary ? 10 : 0) + (hypothesis.deviceId === challenge.fault.nodeId ? 10 : 0)
    : 0;

  const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing);
  const verified = challenge.verification.kind === 'routed-probe'
    ? hasEvidence(evidence, (entry) => (entry.kind === 'ping' || entry.kind === 'traceroute') && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired)
    : hasEvidence(evidence, (entry) => entry.kind === 'ethernet-flow' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired);
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

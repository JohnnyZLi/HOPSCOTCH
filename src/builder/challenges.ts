import { validateBuilderAddressing, type BuilderAddressing } from './addressing.ts';
import { createBuilderAuthoringSnapshot, type BuilderAuthoringSnapshot } from './authoring.ts';
import { setBuilderOspfEverywhere } from './routing.ts';
import { defaultBuilderScenario } from './scenario.ts';

export const BUILDER_CHALLENGE_SCHEMA = 'hopscotch.builder.challenge' as const;
export const BUILDER_CHALLENGE_VERSION = 1 as const;
export const BUILDER_CHALLENGE_EVIDENCE_LIMIT = 40;

export type BuilderChallengeBoundary = 'ADDRESSING' | 'L2' | 'ROUTING' | 'POLICY' | 'TRANSPORT';
export type BuilderChallengeEvidenceKind = 'ping' | 'traceroute' | 'inspect-config' | 'inspect-state' | 'inspect-events';

export interface BuilderChallengeFault {
  kind: 'missing-default-gateway';
  boundary: 'ADDRESSING';
  nodeId: string;
  expectedGateway: string;
}

export interface BuilderChallenge {
  schema: typeof BUILDER_CHALLENGE_SCHEMA;
  version: typeof BUILDER_CHALLENGE_VERSION;
  id: string;
  seed: string;
  title: string;
  objective: string;
  difficulty: 'FOUNDATION';
  healthy: BuilderAuthoringSnapshot;
  broken: BuilderAuthoringSnapshot;
  fault: BuilderChallengeFault;
}

export interface BuilderChallengeEvidenceInput {
  kind: BuilderChallengeEvidenceKind;
  deviceId?: string | null;
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
    title: 'REMOTE SERVICE UNREACHABLE',
    objective: `Restore IPv4 reachability from ${target.label} to ${destination.label}. Diagnose the failure with ordinary Builder evidence before repairing canonical configuration.`,
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    fault: {
      kind: 'missing-default-gateway',
      boundary: 'ADDRESSING',
      nodeId: target.id,
      expectedGateway,
    },
  };
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

export function builderChallengeIsRepaired(challenge: BuilderChallenge, addressing: BuilderAddressing): boolean {
  return addressing.defaultGateways[challenge.fault.nodeId] === challenge.fault.expectedGateway;
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

function isObjectiveProbe(challenge: BuilderChallenge, entry: BuilderChallengeEvidence): boolean {
  return entry.sourceId === challenge.broken.sourceId && entry.destinationId === challenge.broken.destinationId;
}

export function scoreBuilderChallenge(
  challenge: BuilderChallenge,
  evidence: readonly BuilderChallengeEvidence[],
  hypothesis: BuilderChallengeHypothesis | null,
  addressing: BuilderAddressing,
): BuilderChallengeScore {
  const failedPing = hasEvidence(evidence, (entry) => entry.kind === 'ping' && isObjectiveProbe(challenge, entry) && entry.success === false && !entry.repaired);
  const failedTraceroute = hasEvidence(evidence, (entry) => entry.kind === 'traceroute' && isObjectiveProbe(challenge, entry) && entry.success === false && !entry.repaired);
  const inspectedState = hasEvidence(evidence, (entry) => entry.kind === 'inspect-state' && entry.deviceId === challenge.fault.nodeId && !entry.repaired);
  const inspectedConfig = hasEvidence(evidence, (entry) => entry.kind === 'inspect-config' && entry.deviceId === challenge.fault.nodeId && !entry.repaired);
  const evidenceScore = (failedPing ? 10 : 0) + (failedTraceroute ? 10 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);

  const hasProbeEvidence = failedPing || failedTraceroute;
  const hasInspectionEvidence = inspectedState || inspectedConfig;
  const reasoningEligible = hasProbeEvidence && hasInspectionEvidence;
  const reasoningScore = reasoningEligible && hypothesis
    ? (hypothesis.boundary === challenge.fault.boundary ? 10 : 0) + (hypothesis.deviceId === challenge.fault.nodeId ? 10 : 0)
    : 0;

  const repaired = builderChallengeIsRepaired(challenge, addressing);
  const verified = hasEvidence(evidence, (entry) => (entry.kind === 'ping' || entry.kind === 'traceroute') && isObjectiveProbe(challenge, entry) && entry.success === true && entry.repaired);
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

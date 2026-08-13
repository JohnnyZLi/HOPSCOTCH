import { builderOspfState, traceBuilderForwarding, type BuilderForwardingTrace, type BuilderOspfState, type BuilderRoutingConfig } from './routing.ts';
import { cloneBuilderGraph, type BuilderGraph } from './model.ts';
import type { BuilderAddressing } from './addressing.ts';

export interface BuilderOspfTimingProfile {
  helloIntervalMs: number;
  deadIntervalMs: number;
  lsaFloodMs: number;
  spfDelayMs: number;
  ribInstallMs: number;
  fibInstallMs: number;
}

export const DEFAULT_BUILDER_OSPF_TIMING: BuilderOspfTimingProfile = {
  helloIntervalMs: 10_000,
  deadIntervalMs: 40_000,
  lsaFloodMs: 200,
  spfDelayMs: 500,
  ribInstallMs: 100,
  fibInstallMs: 100,
};

export type BuilderOspfConvergenceEventKind =
  | 'LINK_DOWN'
  | 'HELLO_MISSED'
  | 'DEAD_TIMER_EXPIRED'
  | 'ADJACENCY_DOWN'
  | 'LSA_ORIGINATED'
  | 'LSA_FLOODED'
  | 'SPF_SCHEDULED'
  | 'SPF_COMPLETE'
  | 'RIB_UPDATED'
  | 'FIB_UPDATED'
  | 'TRAFFIC_RECOVERED';

export interface BuilderOspfConvergenceEvent {
  id: string;
  atMs: number;
  kind: BuilderOspfConvergenceEventKind;
  summary: string;
}

export interface BuilderOspfConvergenceScenario {
  failedLinkId: string;
  failedRouterIds: [string, string];
  beforeGraph: BuilderGraph;
  afterGraph: BuilderGraph;
  addressing: BuilderAddressing;
  routing: BuilderRoutingConfig;
  sourceId: string;
  destinationId: string;
  profile: BuilderOspfTimingProfile;
  events: BuilderOspfConvergenceEvent[];
  deadAtMs: number;
  lsaFloodCompleteAtMs: number;
  spfCompleteAtMs: number;
  ribInstallAtMs: number;
  fibInstallAtMs: number;
}

export type BuilderOspfConvergencePhase =
  | 'PHYSICAL FAILURE · CONTROL PLANE STALE'
  | 'DEAD TIMER · ADJACENCY DOWN'
  | 'LSA FLOODING'
  | 'SPF RUNNING'
  | 'RIB UPDATED · FIB STALE'
  | 'FIB UPDATED · TRAFFIC RECOVERED';

export interface BuilderOspfConvergenceSnapshot {
  elapsedMs: number;
  phase: BuilderOspfConvergencePhase;
  controlState: BuilderOspfState;
  ribTrace: BuilderForwardingTrace;
  fibTrace: BuilderForwardingTrace;
  visibleEvents: BuilderOspfConvergenceEvent[];
  controlUsesFailedTopology: boolean;
  ribUsesFailedTopology: boolean;
  fibUsesFailedTopology: boolean;
}

function finiteInteger(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer from ${min} to ${max} ms.`);
  return value;
}

export function validateBuilderOspfTimingProfile(value: BuilderOspfTimingProfile): BuilderOspfTimingProfile {
  const profile = {
    helloIntervalMs: finiteInteger(value.helloIntervalMs, 'OSPF hello interval', 100, 120_000),
    deadIntervalMs: finiteInteger(value.deadIntervalMs, 'OSPF dead interval', 100, 600_000),
    lsaFloodMs: finiteInteger(value.lsaFloodMs, 'OSPF LSA flood delay', 0, 60_000),
    spfDelayMs: finiteInteger(value.spfDelayMs, 'OSPF SPF delay', 0, 60_000),
    ribInstallMs: finiteInteger(value.ribInstallMs, 'OSPF RIB install delay', 0, 60_000),
    fibInstallMs: finiteInteger(value.fibInstallMs, 'OSPF FIB install delay', 0, 60_000),
  };
  if (profile.deadIntervalMs < profile.helloIntervalMs) throw new Error('OSPF dead interval must be greater than or equal to the hello interval.');
  return profile;
}

function nodeKind(graph: BuilderGraph, nodeId: string) {
  return graph.nodes.find((node) => node.id === nodeId)?.kind ?? null;
}

export function createBuilderOspfLinkFailureScenario(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  sourceId: string,
  destinationId: string,
  failedLinkId: string,
  timing: BuilderOspfTimingProfile = DEFAULT_BUILDER_OSPF_TIMING,
): BuilderOspfConvergenceScenario {
  const profile = validateBuilderOspfTimingProfile(timing);
  const link = graph.links.find((candidate) => candidate.id === failedLinkId);
  if (!link) throw new Error(`OSPF timing scenario cannot find link ${failedLinkId}.`);
  if (link.failed) throw new Error(`OSPF timing scenario requires ${failedLinkId} to begin UP.`);
  if (nodeKind(graph, link.a) !== 'router' || nodeKind(graph, link.b) !== 'router') throw new Error('OSPF timing scenarios require a router-router link.');
  const enabled = new Set(routing.ospf.enabledRouterIds);
  if (!enabled.has(link.a) || !enabled.has(link.b)) throw new Error('Both routers on the failed link must be OSPF-enabled.');

  const beforeGraph = cloneBuilderGraph(graph);
  const afterGraph = cloneBuilderGraph(graph);
  const failed = afterGraph.links.find((candidate) => candidate.id === failedLinkId);
  if (!failed) throw new Error('Failed link disappeared while building the convergence scenario.');
  failed.failed = true;

  const deadAtMs = profile.deadIntervalMs;
  const lsaFloodCompleteAtMs = deadAtMs + profile.lsaFloodMs;
  const spfCompleteAtMs = lsaFloodCompleteAtMs + profile.spfDelayMs;
  const ribInstallAtMs = spfCompleteAtMs + profile.ribInstallMs;
  const fibInstallAtMs = ribInstallAtMs + profile.fibInstallMs;
  const helloMissAt = Math.min(profile.helloIntervalMs, Math.max(1, deadAtMs - 1));
  const labels = [link.a, link.b].map((id) => graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase());
  const events: BuilderOspfConvergenceEvent[] = [
    { id: 'link-down', atMs: 0, kind: 'LINK_DOWN', summary: `${labels[0]} ↔ ${labels[1]} carrier fails. The data plane sees the physical failure immediately.` },
    { id: 'hello-missed', atMs: helloMissAt, kind: 'HELLO_MISSED', summary: 'Expected OSPF Hello is missed, but the neighbor remains FULL until the dead timer expires.' },
    { id: 'dead-expired', atMs: deadAtMs, kind: 'DEAD_TIMER_EXPIRED', summary: 'Dead timer expires on the failed adjacency.' },
    { id: 'adj-down', atMs: deadAtMs, kind: 'ADJACENCY_DOWN', summary: `${labels[0]} ↔ ${labels[1]} transitions out of FULL.` },
    { id: 'lsa-originated', atMs: deadAtMs, kind: 'LSA_ORIGINATED', summary: 'Affected routers originate new link-state information.' },
    { id: 'lsa-flooded', atMs: lsaFloodCompleteAtMs, kind: 'LSA_FLOODED', summary: 'The Area 0 component has received the updated topology information.' },
    { id: 'spf-scheduled', atMs: lsaFloodCompleteAtMs, kind: 'SPF_SCHEDULED', summary: 'SPF is scheduled from the updated LSDB.' },
    { id: 'spf-complete', atMs: spfCompleteAtMs, kind: 'SPF_COMPLETE', summary: 'Deterministic SPF completes against the failed-link topology.' },
    { id: 'rib-updated', atMs: ribInstallAtMs, kind: 'RIB_UPDATED', summary: 'New OSPF routes are installed in the RIB; forwarding may still use stale FIB state.' },
    { id: 'fib-updated', atMs: fibInstallAtMs, kind: 'FIB_UPDATED', summary: 'Forwarding entries are programmed from the new RIB.' },
    { id: 'traffic-recovered', atMs: fibInstallAtMs, kind: 'TRAFFIC_RECOVERED', summary: 'New traffic consumes the reconverged OSPF forwarding path.' },
  ];

  return {
    failedLinkId,
    failedRouterIds: [link.a, link.b],
    beforeGraph,
    afterGraph,
    addressing,
    routing,
    sourceId,
    destinationId,
    profile,
    events,
    deadAtMs,
    lsaFloodCompleteAtMs,
    spfCompleteAtMs,
    ribInstallAtMs,
    fibInstallAtMs,
  };
}

export function snapshotBuilderOspfConvergence(
  scenario: BuilderOspfConvergenceScenario,
  elapsedMs: number,
): BuilderOspfConvergenceSnapshot {
  const elapsed = Math.max(0, Math.min(Math.round(elapsedMs), scenario.fibInstallAtMs + 10_000));
  const controlUsesFailedTopology = elapsed >= scenario.deadAtMs;
  const ribUsesFailedTopology = elapsed >= scenario.ribInstallAtMs;
  const fibUsesFailedTopology = elapsed >= scenario.fibInstallAtMs;
  const controlGraph = controlUsesFailedTopology ? scenario.afterGraph : scenario.beforeGraph;
  const ribGraph = ribUsesFailedTopology ? scenario.afterGraph : scenario.beforeGraph;
  const fibGraph = fibUsesFailedTopology ? scenario.afterGraph : scenario.beforeGraph;
  const controlState = builderOspfState(controlGraph, scenario.addressing, scenario.routing);
  const ribTrace = traceBuilderForwarding(scenario.afterGraph, scenario.addressing, scenario.routing, scenario.sourceId, scenario.destinationId, ribGraph);
  const fibTrace = traceBuilderForwarding(scenario.afterGraph, scenario.addressing, scenario.routing, scenario.sourceId, scenario.destinationId, fibGraph);

  let phase: BuilderOspfConvergencePhase;
  if (elapsed < scenario.deadAtMs) phase = 'PHYSICAL FAILURE · CONTROL PLANE STALE';
  else if (elapsed < scenario.lsaFloodCompleteAtMs) phase = 'DEAD TIMER · ADJACENCY DOWN';
  else if (elapsed < scenario.spfCompleteAtMs) phase = 'LSA FLOODING';
  else if (elapsed < scenario.ribInstallAtMs) phase = 'SPF RUNNING';
  else if (elapsed < scenario.fibInstallAtMs) phase = 'RIB UPDATED · FIB STALE';
  else phase = 'FIB UPDATED · TRAFFIC RECOVERED';

  return {
    elapsedMs: elapsed,
    phase,
    controlState,
    ribTrace,
    fibTrace,
    visibleEvents: scenario.events.filter((event) => event.atMs <= elapsed),
    controlUsesFailedTopology,
    ribUsesFailedTopology,
    fibUsesFailedTopology,
  };
}

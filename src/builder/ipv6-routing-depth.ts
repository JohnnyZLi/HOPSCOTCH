import type { BuilderGraph } from './model.ts';
import {
  builderIpv6PrefixContains,
  interfacesForBuilderNodeIpv6,
  parseBuilderIpv6Cidr,
  primaryBuilderIpv6Address,
  type BuilderIpv6Config,
  type BuilderIpv6ForwardingTrace,
  type BuilderIpv6RouteOverlay,
  type BuilderIpv6RouteTableEntry,
} from './ipv6.ts';

export type BuilderOspfv3AdjacencyPhase = 'FULL' | 'STALE FULL' | 'DOWN';
export type BuilderOspfv3FailurePhase = 'PHYSICAL' | 'DEAD TIMER' | 'LSA FLOOD' | 'SPF' | 'RIB' | 'FIB';
export type BuilderIpv6PolicyAction = 'permit' | 'deny';
export type BuilderIpv6IcmpType = 'any' | 'echo-request' | 'echo-reply' | 'time-exceeded' | 'packet-too-big';

export interface BuilderOspfv3DepthTimers {
  helloMs: number;
  deadMs: number;
  lsaFloodMs: number;
  spfMs: number;
  ribInstallMs: number;
  fibInstallMs: number;
}

export interface BuilderOspfv3FailureClock {
  linkId: string;
  failedAtMs: number;
}

export interface BuilderIpv6PolicyRule {
  id: string;
  routerId: string;
  order: number;
  action: BuilderIpv6PolicyAction;
  sourcePrefix: string;
  destinationPrefix: string;
  icmpType: BuilderIpv6IcmpType;
  description: string;
}

export interface BuilderIpv6PolicyConfig {
  defaultActions: Record<string, BuilderIpv6PolicyAction>;
  rules: BuilderIpv6PolicyRule[];
}

export interface BuilderIpv6RoutingDepthState {
  clockMs: number;
  linkAreas: Record<string, number>;
  failures: BuilderOspfv3FailureClock[];
  timers: BuilderOspfv3DepthTimers;
  policy: BuilderIpv6PolicyConfig;
}

export interface BuilderOspfv3DepthAdjacency {
  id: string;
  linkId: string;
  area: number;
  aRouterId: string;
  bRouterId: string;
  phase: BuilderOspfv3AdjacencyPhase;
  failurePhase: BuilderOspfv3FailurePhase | null;
  elapsedMs: number | null;
  detail: string;
}

export interface BuilderOspfv3DepthSummary {
  adjacencies: BuilderOspfv3DepthAdjacency[];
  abrRouterIds: string[];
  routerAreas: Record<string, number[]>;
  fullCount: number;
  staleCount: number;
}

export interface BuilderIpv6PolicyDecision {
  action: BuilderIpv6PolicyAction;
  routerId: string;
  ruleId: string | null;
  detail: string;
}

const DEFAULT_TIMERS: BuilderOspfv3DepthTimers = {
  helloMs: 10_000,
  deadMs: 40_000,
  lsaFloodMs: 200,
  spfMs: 50,
  ribInstallMs: 50,
  fibInstallMs: 50,
};

function routerIds(graph: BuilderGraph): string[] {
  return graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id).sort();
}

function isRouter(graph: BuilderGraph, nodeId: string): boolean {
  return graph.nodes.find((node) => node.id === nodeId)?.kind === 'router';
}

function normalizeArea(value: number): number {
  const area = Math.round(Number(value));
  if (!Number.isFinite(area) || area < 0 || area > 0xffffffff) throw new Error('OSPFv3 area must be 0 through 4294967295.');
  return area;
}

export function createDefaultBuilderIpv6RoutingDepthState(graph: BuilderGraph): BuilderIpv6RoutingDepthState {
  return {
    clockMs: 0,
    linkAreas: Object.fromEntries(graph.links.map((link) => [link.id, 0])),
    failures: [],
    timers: { ...DEFAULT_TIMERS },
    policy: { defaultActions: Object.fromEntries(routerIds(graph).map((id) => [id, 'permit'])), rules: [] },
  };
}

function cloneState(value: BuilderIpv6RoutingDepthState): BuilderIpv6RoutingDepthState {
  return {
    clockMs: value.clockMs,
    linkAreas: { ...value.linkAreas },
    failures: value.failures.map((entry) => ({ ...entry })),
    timers: { ...value.timers },
    policy: { defaultActions: { ...value.policy.defaultActions }, rules: value.policy.rules.map((rule) => ({ ...rule })) },
  };
}

export function reconcileBuilderIpv6RoutingDepthState(graph: BuilderGraph, current: BuilderIpv6RoutingDepthState): BuilderIpv6RoutingDepthState {
  const next = cloneState(current);
  const linkIds = new Set(graph.links.map((link) => link.id));
  next.linkAreas = Object.fromEntries(graph.links.map((link) => [link.id, normalizeArea(current.linkAreas[link.id] ?? 0)]));
  const failures = new Map(current.failures.filter((entry) => linkIds.has(entry.linkId)).map((entry) => [entry.linkId, { ...entry }]));
  for (const link of graph.links) {
    if (link.failed && !failures.has(link.id)) failures.set(link.id, { linkId: link.id, failedAtMs: current.clockMs });
    if (!link.failed) failures.delete(link.id);
  }
  next.failures = [...failures.values()].sort((a, b) => a.linkId.localeCompare(b.linkId));
  const routers = new Set(routerIds(graph));
  next.policy.defaultActions = Object.fromEntries([...routers].map((id) => [id, current.policy.defaultActions[id] === 'deny' ? 'deny' : 'permit']));
  next.policy.rules = current.policy.rules.filter((rule) => routers.has(rule.routerId)).map((rule) => ({ ...rule, order: Math.max(1, Math.min(9999, Math.round(rule.order))) })).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.order - b.order || a.id.localeCompare(b.id));
  return next;
}

export function advanceBuilderOspfv3Depth(graph: BuilderGraph, current: BuilderIpv6RoutingDepthState, deltaMs: number): BuilderIpv6RoutingDepthState {
  const next = reconcileBuilderIpv6RoutingDepthState(graph, current);
  next.clockMs += Math.max(0, Math.min(3_600_000, Math.round(deltaMs)));
  return next;
}

export function setBuilderOspfv3LinkArea(graph: BuilderGraph, current: BuilderIpv6RoutingDepthState, linkId: string, area: number): BuilderIpv6RoutingDepthState {
  if (!graph.links.some((link) => link.id === linkId)) throw new Error(`Unknown link ${linkId}.`);
  const next = reconcileBuilderIpv6RoutingDepthState(graph, current);
  next.linkAreas[linkId] = normalizeArea(area);
  return next;
}

export function setBuilderIpv6PolicyDefault(graph: BuilderGraph, current: BuilderIpv6RoutingDepthState, routerId: string, action: BuilderIpv6PolicyAction): BuilderIpv6RoutingDepthState {
  if (!isRouter(graph, routerId)) throw new Error(`${routerId} is not a router.`);
  const next = reconcileBuilderIpv6RoutingDepthState(graph, current);
  next.policy.defaultActions[routerId] = action;
  return next;
}

export function upsertBuilderIpv6PolicyRule(graph: BuilderGraph, current: BuilderIpv6RoutingDepthState, input: Omit<BuilderIpv6PolicyRule, 'id'> & { id?: string }): BuilderIpv6RoutingDepthState {
  if (!isRouter(graph, input.routerId)) throw new Error(`${input.routerId} is not a router.`);
  const sourcePrefix = parseBuilderIpv6Cidr(input.sourcePrefix).cidr;
  const destinationPrefix = parseBuilderIpv6Cidr(input.destinationPrefix).cidr;
  const order = Math.max(1, Math.min(9999, Math.round(input.order)));
  const id = input.id?.trim() || `acl6:${input.routerId}:${order}:${input.icmpType}`;
  const next = reconcileBuilderIpv6RoutingDepthState(graph, current);
  const rule: BuilderIpv6PolicyRule = { id, routerId: input.routerId, order, action: input.action, sourcePrefix, destinationPrefix, icmpType: input.icmpType, description: String(input.description ?? '').slice(0, 100) };
  next.policy.rules = [...next.policy.rules.filter((entry) => entry.id !== id), rule].sort((a, b) => a.routerId.localeCompare(b.routerId) || a.order - b.order || a.id.localeCompare(b.id));
  return next;
}

export function clearBuilderIpv6PolicyRules(graph: BuilderGraph, current: BuilderIpv6RoutingDepthState, routerId?: string): BuilderIpv6RoutingDepthState {
  const next = reconcileBuilderIpv6RoutingDepthState(graph, current);
  next.policy.rules = routerId ? next.policy.rules.filter((rule) => rule.routerId !== routerId) : [];
  return next;
}

function failurePhase(state: BuilderIpv6RoutingDepthState, linkId: string): { phase: BuilderOspfv3FailurePhase | null; elapsedMs: number | null; fibReady: boolean } {
  const failure = state.failures.find((entry) => entry.linkId === linkId);
  if (!failure) return { phase: null, elapsedMs: null, fibReady: true };
  const elapsed = Math.max(0, state.clockMs - failure.failedAtMs);
  const dead = state.timers.deadMs;
  const flood = dead + state.timers.lsaFloodMs;
  const spf = flood + state.timers.spfMs;
  const rib = spf + state.timers.ribInstallMs;
  const fib = rib + state.timers.fibInstallMs;
  if (elapsed < dead) return { phase: 'PHYSICAL', elapsedMs: elapsed, fibReady: false };
  if (elapsed < flood) return { phase: 'DEAD TIMER', elapsedMs: elapsed, fibReady: false };
  if (elapsed < spf) return { phase: 'LSA FLOOD', elapsedMs: elapsed, fibReady: false };
  if (elapsed < rib) return { phase: 'SPF', elapsedMs: elapsed, fibReady: false };
  if (elapsed < fib) return { phase: 'RIB', elapsedMs: elapsed, fibReady: false };
  return { phase: 'FIB', elapsedMs: elapsed, fibReady: true };
}

function routerAreasFor(graph: BuilderGraph, config: BuilderIpv6Config, state: BuilderIpv6RoutingDepthState): Record<string, number[]> {
  const enabled = new Set(config.enabled ? config.ospfv3.enabledRouterIds : []);
  const result: Record<string, number[]> = {};
  for (const routerId of enabled) {
    const areas = new Set<number>();
    for (const link of graph.links.filter((entry) => entry.a === routerId || entry.b === routerId)) areas.add(state.linkAreas[link.id] ?? 0);
    result[routerId] = [...areas].sort((a, b) => a - b);
  }
  return result;
}

export function builderOspfv3DepthSummary(graph: BuilderGraph, config: BuilderIpv6Config, current: BuilderIpv6RoutingDepthState): BuilderOspfv3DepthSummary {
  const state = reconcileBuilderIpv6RoutingDepthState(graph, current);
  const enabled = new Set(config.enabled ? config.ospfv3.enabledRouterIds : []);
  const routerAreas = routerAreasFor(graph, config, state);
  const abrRouterIds = Object.entries(routerAreas).filter(([, areas]) => areas.includes(0) && areas.some((area) => area !== 0)).map(([id]) => id).sort();
  const adjacencies = graph.links.flatMap((link): BuilderOspfv3DepthAdjacency[] => {
    if (!isRouter(graph, link.a) || !isRouter(graph, link.b) || !enabled.has(link.a) || !enabled.has(link.b)) return [];
    const area = state.linkAreas[link.id] ?? 0;
    const timing = failurePhase(state, link.id);
    const phase: BuilderOspfv3AdjacencyPhase = !link.failed ? 'FULL' : timing.elapsedMs != null && timing.elapsedMs < state.timers.deadMs ? 'STALE FULL' : 'DOWN';
    return [{ id: `ospfv3-depth:${link.id}`, linkId: link.id, area, aRouterId: link.a, bRouterId: link.b, phase, failurePhase: timing.phase, elapsedMs: timing.elapsedMs, detail: phase === 'FULL' ? `Area ${area} link-local Hello adjacency is FULL.` : phase === 'STALE FULL' ? `Physical link is down, but the ${state.timers.deadMs / 1000}s dead timer has not expired.` : `Dead timer expired; Area ${area} adjacency is DOWN and LSAs can reconverge.` }];
  }).sort((a, b) => a.linkId.localeCompare(b.linkId));
  return { adjacencies, abrRouterIds, routerAreas, fullCount: adjacencies.filter((entry) => entry.phase === 'FULL').length, staleCount: adjacencies.filter((entry) => entry.phase === 'STALE FULL').length };
}

interface StateEdge { to: string; cost: number; linkId: string | null; nextRouterId: string; transition: boolean; }

function ospfStatePath(graph: BuilderGraph, config: BuilderIpv6Config, state: BuilderIpv6RoutingDepthState, routingGraph: BuilderGraph, sourceRouterId: string, destinationRouterId: string, destinationArea: number): { reachable: boolean; cost: number; firstLinkId: string | null; nextRouterId: string | null; interArea: boolean } {
  const enabled = new Set(config.ospfv3.enabledRouterIds);
  const areas = routerAreasFor(routingGraph, config, state);
  const adjacency = new Map<string, StateEdge[]>();
  const add = (from: string, edge: StateEdge) => adjacency.set(from, [...(adjacency.get(from) ?? []), edge]);
  for (const routerId of enabled) for (const area of areas[routerId] ?? []) adjacency.set(`${routerId}|${area}`, adjacency.get(`${routerId}|${area}`) ?? []);
  for (const link of routingGraph.links) {
    if (link.failed || !enabled.has(link.a) || !enabled.has(link.b) || !isRouter(graph, link.a) || !isRouter(graph, link.b)) continue;
    const area = state.linkAreas[link.id] ?? 0;
    const a = `${link.a}|${area}`, b = `${link.b}|${area}`;
    if (!adjacency.has(a) || !adjacency.has(b)) continue;
    add(a, { to: b, cost: link.cost, linkId: link.id, nextRouterId: link.b, transition: false });
    add(b, { to: a, cost: link.cost, linkId: link.id, nextRouterId: link.a, transition: false });
  }
  for (const [routerId, routerAreaList] of Object.entries(areas)) {
    if (!routerAreaList.includes(0)) continue;
    for (const area of routerAreaList.filter((value) => value !== 0)) {
      const zero = `${routerId}|0`, other = `${routerId}|${area}`;
      if (!adjacency.has(zero) || !adjacency.has(other)) continue;
      add(other, { to: zero, cost: 0, linkId: null, nextRouterId: routerId, transition: true });
      add(zero, { to: other, cost: 0, linkId: null, nextRouterId: routerId, transition: true });
    }
  }
  const starts = (areas[sourceRouterId] ?? []).map((area) => `${sourceRouterId}|${area}`);
  const target = `${destinationRouterId}|${destinationArea}`;
  if (!adjacency.has(target) || starts.length === 0) return { reachable: false, cost: Infinity, firstLinkId: null, nextRouterId: null, interArea: false };
  const dist = new Map<string, number>();
  const prev = new Map<string, { from: string; edge: StateEdge }>();
  const queue = new Set<string>();
  for (const key of adjacency.keys()) { dist.set(key, Infinity); queue.add(key); }
  for (const start of starts) if (queue.has(start)) dist.set(start, 0);
  while (queue.size) {
    let current: string | null = null;
    for (const key of queue) if (current == null || (dist.get(key) ?? Infinity) < (dist.get(current) ?? Infinity) || ((dist.get(key) ?? Infinity) === (dist.get(current) ?? Infinity) && key < current)) current = key;
    if (current == null || (dist.get(current) ?? Infinity) === Infinity) break;
    queue.delete(current);
    if (current === target) break;
    for (const edge of adjacency.get(current) ?? []) {
      if (!queue.has(edge.to)) continue;
      const candidate = (dist.get(current) ?? Infinity) + edge.cost;
      if (candidate < (dist.get(edge.to) ?? Infinity)) { dist.set(edge.to, candidate); prev.set(edge.to, { from: current, edge }); }
    }
  }
  if ((dist.get(target) ?? Infinity) === Infinity) return { reachable: false, cost: Infinity, firstLinkId: null, nextRouterId: null, interArea: false };
  const edges: StateEdge[] = [];
  let cursor = target;
  while (prev.has(cursor)) { const step = prev.get(cursor)!; edges.push(step.edge); cursor = step.from; }
  edges.reverse();
  const firstPhysical = edges.find((edge) => edge.linkId) ?? null;
  return { reachable: true, cost: dist.get(target) ?? 0, firstLinkId: firstPhysical?.linkId ?? null, nextRouterId: firstPhysical?.nextRouterId ?? null, interArea: edges.some((edge) => edge.transition) };
}

function routingGraphAtTime(graph: BuilderGraph, state: BuilderIpv6RoutingDepthState): BuilderGraph {
  return { nodes: graph.nodes, links: graph.links.map((link) => {
    if (!link.failed) return { ...link };
    const phase = failurePhase(state, link.id);
    return { ...link, failed: phase.fibReady };
  }) };
}

export function builderOspfv3DepthRouteOverlay(graph: BuilderGraph, config: BuilderIpv6Config, current: BuilderIpv6RoutingDepthState): BuilderIpv6RouteOverlay {
  const state = reconcileBuilderIpv6RoutingDepthState(graph, current);
  const routingGraph = routingGraphAtTime(graph, state);
  const enabled = new Set(config.enabled ? config.ospfv3.enabledRouterIds : []);
  const overlay: BuilderIpv6RouteOverlay = {};
  const advertisements = [...enabled].flatMap((routerId) => interfacesForBuilderNodeIpv6(config.addressing, routerId).map((entry) => ({ routerId, prefix: entry.prefix, linkId: entry.linkId, area: state.linkAreas[entry.linkId] ?? 0 })));
  for (const routerId of enabled) {
    const localPrefixes = new Set(interfacesForBuilderNodeIpv6(config.addressing, routerId).map((entry) => entry.prefix));
    const best = new Map<string, BuilderIpv6RouteTableEntry>();
    for (const advertisement of advertisements) {
      if (advertisement.routerId === routerId || localPrefixes.has(advertisement.prefix)) continue;
      const path = ospfStatePath(graph, config, state, routingGraph, routerId, advertisement.routerId, advertisement.area);
      if (!path.reachable || !path.firstLinkId || !path.nextRouterId) continue;
      const nextHop = config.addressing.segments[path.firstLinkId]?.interfaces.find((entry) => entry.nodeId === path.nextRouterId)?.linkLocalAddress;
      const local = config.addressing.segments[path.firstLinkId]?.interfaces.find((entry) => entry.nodeId === routerId);
      if (!nextHop || !local) continue;
      const advertisedLink = graph.links.find((link) => link.id === advertisement.linkId);
      const otherNodeId = advertisedLink ? (advertisedLink.a === advertisement.routerId ? advertisedLink.b : advertisedLink.a) : null;
      const stubCost = otherNodeId && !isRouter(graph, otherNodeId) ? advertisedLink?.cost ?? 0 : 0;
      const parsed = parseBuilderIpv6Cidr(advertisement.prefix);
      const candidate: BuilderIpv6RouteTableEntry = {
        id: `ospfv3-depth-route:${routerId}:${parsed.cidr}:${path.nextRouterId}`,
        routerId,
        prefix: parsed.cidr,
        prefixLength: parsed.prefixLength,
        source: 'ospfv3',
        administrativeDistance: 110,
        metric: path.cost + stubCost,
        nextHop,
        outgoingInterface: local.name,
        linkId: path.firstLinkId,
        active: true,
        stateNote: path.interArea ? `OSPFV3 O6 IA · AREA ${advertisement.area} · ABR/BACKBONE` : `OSPFV3 O6 · AREA ${advertisement.area}`,
      };
      const prior = best.get(candidate.prefix);
      if (!prior || candidate.metric < prior.metric || (candidate.metric === prior.metric && (candidate.nextHop ?? '') < (prior.nextHop ?? ''))) best.set(candidate.prefix, candidate);
    }
    overlay[routerId] = [...best.values()];
  }
  return overlay;
}

export function evaluateBuilderIpv6Policy(config: BuilderIpv6PolicyConfig, routerId: string, sourceAddress: string, destinationAddress: string, icmpType: BuilderIpv6IcmpType): BuilderIpv6PolicyDecision {
  const rules = config.rules.filter((rule) => rule.routerId === routerId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const matched = rules.find((rule) => builderIpv6PrefixContains(rule.sourcePrefix, sourceAddress) && builderIpv6PrefixContains(rule.destinationPrefix, destinationAddress) && (rule.icmpType === 'any' || rule.icmpType === icmpType));
  const action = matched?.action ?? (config.defaultActions[routerId] === 'deny' ? 'deny' : 'permit');
  return { action, routerId, ruleId: matched?.id ?? null, detail: matched ? `${action.toUpperCase()} by ${matched.id} (${icmpType}).` : `${action.toUpperCase()} by IPv6 default action (${icmpType}).` };
}

export function evaluateBuilderIpv6TracePolicy(graph: BuilderGraph, config: BuilderIpv6Config, trace: BuilderIpv6ForwardingTrace, policy: BuilderIpv6PolicyConfig, icmpType: BuilderIpv6IcmpType, sourceAddress?: string | null, destinationAddress?: string | null): BuilderIpv6PolicyDecision | null {
  const source = sourceAddress ?? trace.sourceAddress ?? primaryBuilderIpv6Address(config.addressing, trace.sourceNodeId);
  const destination = destinationAddress ?? trace.destinationAddress ?? primaryBuilderIpv6Address(config.addressing, trace.destinationNodeId);
  if (!source || !destination) return null;
  for (const hop of trace.hops) {
    if (!isRouter(graph, hop.nodeId)) continue;
    const decision = evaluateBuilderIpv6Policy(policy, hop.nodeId, source, destination, icmpType);
    if (decision.action === 'deny') return decision;
  }
  return null;
}

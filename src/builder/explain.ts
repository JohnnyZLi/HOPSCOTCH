import { normalizeBuilderIpv4, type BuilderAddressing } from './addressing.ts';
import { traceBuilderPolicy } from './acl.ts';
import { builderBgpState } from './bgp.ts';
import { diagnoseBuilderApplicationTransaction } from './causal-diagnosis.ts';
import type { BuilderDeviceWorkbenchInput, BuilderWorkbenchEvent } from './device-workbench.ts';
import type { BuilderGraph } from './model.ts';
import { builderOspfState, routeTableForBuilderRouter, selectBuilderRouteWithDecision, traceBuilderForwarding, type BuilderRouteTableEntry } from './routing.ts';

export const BUILDER_EXPLAIN_SCHEMA = 'hopscotch.builder.explain' as const;
export const BUILDER_EXPLAIN_VERSION = 1 as const;

export type BuilderExplainTopic = 'network' | 'route' | 'adjacency' | 'policy' | 'packet' | 'application' | 'event';
export type BuilderExplainLevel = 'novice' | 'operational' | 'protocol';
export type BuilderExplainCitationKind = 'CONFIG' | 'STATE' | 'EVENT' | 'OUTCOME';
export type BuilderExplainFactStatus = 'neutral' | 'good' | 'warn' | 'bad';

export interface BuilderExplainCitation {
  id: string;
  ref: string;
  kind: BuilderExplainCitationKind;
  label: string;
  value: string;
  objectIds: string[];
  provenance: 'SIMULATED';
}

export interface BuilderExplainFact {
  id: string;
  category: 'TOPOLOGY' | 'CONFIG' | 'CONTROL' | 'RIB_FIB' | 'POLICY' | 'FORWARDING' | 'OUTCOME' | 'EVENT';
  subject: string;
  relation: string;
  value: string;
  status: BuilderExplainFactStatus;
  causeFactIds: string[];
  citationIds: string[];
}

export interface BuilderExplainStep {
  id: string;
  label: string;
  detail: string;
  status: BuilderExplainFactStatus;
  factId: string;
  citationIds: string[];
}

export interface BuilderExplanation {
  schema: typeof BUILDER_EXPLAIN_SCHEMA;
  version: typeof BUILDER_EXPLAIN_VERSION;
  id: string;
  topic: BuilderExplainTopic;
  level: BuilderExplainLevel;
  focusLabel: string;
  verdictCode: string;
  title: string;
  summary: string;
  detail: string;
  facts: BuilderExplainFact[];
  citations: BuilderExplainCitation[];
  chain: BuilderExplainStep[];
  provenance: 'SIMULATED';
  truthAuthority: 'CANONICAL_BUILDER';
  boundary: string;
}

export interface BuilderExplainRequest {
  topic: BuilderExplainTopic;
  level: BuilderExplainLevel;
  routerId?: string | null;
  adjacencyId?: string | null;
  probeId?: string | null;
  probeAttemptIndex?: number | null;
  applicationId?: string | null;
  eventId?: string | null;
}

export interface BuilderExplainCatalog {
  routers: Array<{ id: string; label: string }>;
  adjacencies: Array<{ id: string; label: string; state: 'FULL' | 'DOWN' }>;
  probes: Array<{ id: string; label: string }>;
  applications: Array<{ id: string; label: string }>;
  events: Array<{ id: string; label: string }>;
}

export interface BuilderExplanationQueryPack {
  schema: 'hopscotch.builder.explain.query-pack';
  version: 1;
  explanationId: string;
  topic: BuilderExplainTopic;
  truthAuthority: 'CANONICAL_BUILDER';
  advisoryOnly: true;
  allowedUses: readonly ['SUMMARIZE', 'ANSWER_FROM_CITED_FACTS', 'COMPARE_CITED_FACTS'];
  forbiddenUses: readonly ['DECIDE_ROUTING', 'DECIDE_FORWARDING', 'DECIDE_POLICY', 'MUTATE_CANONICAL_STATE', 'INVENT_EVIDENCE_OR_PROVENANCE'];
  facts: BuilderExplainFact[];
  citations: BuilderExplainCitation[];
}

interface FactGraph {
  topic: BuilderExplainTopic;
  focusLabel: string;
  verdictCode: string;
  facts: BuilderExplainFact[];
  citations: BuilderExplainCitation[];
}

class FactBuilder {
  readonly facts: BuilderExplainFact[] = [];
  readonly citations: BuilderExplainCitation[] = [];
  private readonly citationByRef = new Map<string, string>();

  cite(ref: string, kind: BuilderExplainCitationKind, label: string, value: string, objectIds: readonly string[] = []): string {
    const prior = this.citationByRef.get(ref);
    if (prior) return prior;
    const id = `C${String(this.citations.length + 1).padStart(2, '0')}`;
    this.citationByRef.set(ref, id);
    this.citations.push({ id, ref, kind, label, value, objectIds: [...new Set(objectIds.filter(Boolean))], provenance: 'SIMULATED' });
    return id;
  }

  add(
    id: string,
    category: BuilderExplainFact['category'],
    subject: string,
    relation: string,
    value: string,
    status: BuilderExplainFactStatus = 'neutral',
    causeFactIds: readonly string[] = [],
    citationIds: readonly string[] = [],
  ): void {
    this.facts.push({ id, category, subject, relation, value, status, causeFactIds: [...causeFactIds], citationIds: [...new Set(citationIds)] });
  }
}

function controlGraph(input: BuilderDeviceWorkbenchInput): BuilderGraph { return input.truthGraphs?.controlGraph ?? input.graph; }
function ribGraph(input: BuilderDeviceWorkbenchInput): BuilderGraph { return input.truthGraphs?.ribGraph ?? input.graph; }
function fibGraph(input: BuilderDeviceWorkbenchInput): BuilderGraph { return input.truthGraphs?.fibGraph ?? input.graph; }
function nodeLabel(graph: BuilderGraph, id: string): string { return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase(); }
function primaryAddress(addressing: BuilderAddressing, nodeId: string): string | null {
  for (const segment of Object.values(addressing.segments)) {
    const found = segment.interfaces.find((entry) => entry.nodeId === nodeId);
    if (found) return found.address;
  }
  return null;
}
function ipv4ToInt(value: string): number {
  return normalizeBuilderIpv4(value).split('.').reduce((result, part) => ((result << 8) | Number(part)) >>> 0, 0) >>> 0;
}
function prefixContains(prefix: string, address: string): boolean {
  const [rawAddress, rawLength, ...extra] = prefix.trim().split('/');
  if (!rawAddress || rawLength == null || extra.length || !/^\d{1,2}$/.test(rawLength)) return false;
  const length = Number(rawLength);
  if (!Number.isInteger(length) || length < 0 || length > 32) return false;
  const target = ipv4ToInt(address);
  const base = ipv4ToInt(rawAddress);
  const mask = length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
  return (target & mask) >>> 0 === (base & mask) >>> 0;
}
function eventChain(events: readonly BuilderWorkbenchEvent[], eventId: string): BuilderWorkbenchEvent[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const chain: BuilderWorkbenchEvent[] = [];
  const seen = new Set<string>();
  let current = byId.get(eventId) ?? null;
  while (current && !seen.has(current.id) && chain.length < 24) {
    seen.add(current.id);
    chain.push(current);
    current = current.causeId ? byId.get(current.causeId) ?? null : null;
  }
  return chain.reverse();
}
function latestMatchingEvent(input: BuilderDeviceWorkbenchInput, objectIds: readonly string[], categories?: readonly string[]): BuilderWorkbenchEvent | null {
  const wanted = new Set(objectIds.filter(Boolean));
  return [...input.events].reverse().find((event) => {
    if (categories && !categories.includes(event.category)) return false;
    if (wanted.size === 0) return true;
    if (event.objectIds.some((id) => wanted.has(id))) return true;
    if (event.deviceRefs.some((ref) => wanted.has(ref.id))) return true;
    return false;
  }) ?? null;
}
function appendEventFacts(builder: FactBuilder, input: BuilderDeviceWorkbenchInput, event: BuilderWorkbenchEvent | null, causeId: string | null = null): void {
  if (!event) return;
  const chain = eventChain(input.events, event.id);
  let previous = causeId;
  for (const item of chain) {
    const citation = builder.cite(`event:${item.id}`, 'EVENT', `${item.summary} · #${item.sequence}`, item.detail, [item.id, ...item.objectIds]);
    const factId = `event:${item.id}`;
    if (!builder.facts.some((fact) => fact.id === factId)) {
      builder.add(factId, 'EVENT', item.summary, 'caused / observed', item.detail, item.category === 'topology' || item.category === 'policy' ? 'warn' : 'neutral', previous ? [previous] : [], [citation]);
    }
    previous = factId;
  }
}

function defaultRouterId(input: BuilderDeviceWorkbenchInput): string | null {
  const source = input.graph.nodes.find((node) => node.id === input.sourceId);
  if (source?.kind === 'router') return source.id;
  const trace = traceBuilderForwarding(input.graph, input.addressing, input.routing, input.sourceId, input.destinationId, fibGraph(input));
  const routedHop = trace.hops.find((hop) => input.graph.nodes.find((node) => node.id === hop.nodeId)?.kind === 'router');
  return routedHop?.nodeId ?? input.graph.nodes.find((node) => node.kind === 'router')?.id ?? null;
}

export function builderExplainCatalog(input: BuilderDeviceWorkbenchInput): BuilderExplainCatalog {
  const ospf = builderOspfState(controlGraph(input), input.addressing, input.routing);
  return {
    routers: input.graph.nodes.filter((node) => node.kind === 'router').map((node) => ({ id: node.id, label: node.label })).sort((a, b) => a.label.localeCompare(b.label)),
    adjacencies: ospf.adjacencies.map((adjacency) => ({ id: adjacency.id, label: `${nodeLabel(input.graph, adjacency.aRouterId)} ↔ ${nodeLabel(input.graph, adjacency.bRouterId)} · ${adjacency.areaId}`, state: adjacency.state })).sort((a, b) => a.label.localeCompare(b.label)),
    probes: [...input.probeHistory].sort((a, b) => b.sequence - a.sequence).map((probe) => ({ id: probe.id, label: `#${probe.sequence} ${probe.kind.toUpperCase()} · ${probe.plane.replace('ROUTED ', '')} · ${probe.success ? 'PASS' : 'FAIL'}` })),
    applications: [...input.applicationHistory].sort((a, b) => b.sequence - a.sequence).map((transaction) => ({ id: transaction.id, label: `#${transaction.sequence} ${transaction.service.label} · ${transaction.success ? 'PASS' : transaction.firstBrokenBoundary ?? 'FAIL'}` })),
    events: [...input.events].reverse().filter((event) => event.kind !== 'session').slice(0, 80).map((event) => ({ id: event.id, label: `#${event.sequence} ${event.summary}` })),
  };
}

function networkFacts(input: BuilderDeviceWorkbenchInput): FactGraph {
  const builder = new FactBuilder();
  const graph = input.graph;
  const upLinks = graph.links.filter((link) => !link.failed);
  const downLinks = graph.links.filter((link) => link.failed);
  const topologyCitation = builder.cite('graph:routed', 'CONFIG', 'ROUTED GRAPH', `${graph.nodes.length} nodes · ${graph.links.length} links · ${downLinks.length} down`, [...graph.nodes.map((node) => node.id), ...graph.links.map((link) => link.id)]);
  builder.add('network.topology', 'TOPOLOGY', 'Routed topology', 'contains', `${graph.nodes.length} nodes · ${upLinks.length} up links · ${downLinks.length} down links`, downLinks.length ? 'warn' : 'good', [], [topologyCitation]);

  const sourceCitation = builder.cite(`addressing:endpoint:${input.sourceId}`, 'CONFIG', 'SOURCE', `${nodeLabel(graph, input.sourceId)} · ${primaryAddress(input.addressing, input.sourceId) ?? 'NO IPV4'}`, [input.sourceId]);
  const destinationCitation = builder.cite(`addressing:endpoint:${input.destinationId}`, 'CONFIG', 'DESTINATION', `${nodeLabel(graph, input.destinationId)} · ${primaryAddress(input.addressing, input.destinationId) ?? 'NO IPV4'}`, [input.destinationId]);
  builder.add('network.objective', 'CONFIG', 'Current objective', 'connects', `${nodeLabel(graph, input.sourceId)} → ${nodeLabel(graph, input.destinationId)}`, 'neutral', ['network.topology'], [sourceCitation, destinationCitation]);

  const forwarding = traceBuilderForwarding(graph, input.addressing, input.routing, input.sourceId, input.destinationId, fibGraph(input));
  const forwardingCitation = builder.cite('state:fib:current-objective', 'STATE', 'CURRENT FIB FORWARDING', forwarding.explanation, [input.sourceId, input.destinationId, ...forwarding.hops.map((hop) => hop.linkId ?? '').filter(Boolean)]);
  builder.add('network.forwarding', 'FORWARDING', 'Current IPv4 forwarding', 'results in', forwarding.reachable ? `REACHABLE · ${forwarding.hops.length} hop${forwarding.hops.length === 1 ? '' : 's'}` : `UNREACHABLE · ${forwarding.failureReason ?? 'NO ROUTE'}`, forwarding.reachable ? 'good' : 'bad', ['network.objective'], [forwardingCitation]);

  const ospf = builderOspfState(controlGraph(input), input.addressing, input.routing);
  const ospfCitation = builder.cite('state:ospf', 'STATE', 'OSPF STATE', `${ospf.enabledRouterIds.length} enabled routers · ${ospf.fullAdjacencyCount} FULL · ${ospf.downAdjacencyCount} DOWN`, [...ospf.enabledRouterIds, ...ospf.adjacencies.map((entry) => entry.id)]);
  builder.add('network.ospf', 'CONTROL', 'OSPF', 'has state', `${ospf.enabledRouterIds.length} routers · ${ospf.fullAdjacencyCount} FULL · ${ospf.downAdjacencyCount} DOWN`, ospf.downAdjacencyCount ? 'warn' : ospf.enabledRouterIds.length ? 'good' : 'neutral', ['network.topology'], [ospfCitation]);

  const bgp = builderBgpState(controlGraph(input), input.addressing, input.routing.bgp);
  const bgpCitation = builder.cite('state:bgp', 'STATE', 'BGP STATE', `${bgp.sessions.filter((session) => session.state === 'ESTABLISHED').length}/${bgp.sessions.length} established · ${bgp.bestRoutes.length} best routes · ${bgp.leakedRouteIds.length} anomalies`, [...bgp.sessions.map((session) => session.id), ...bgp.bestRoutes.map((route) => route.id)]);
  builder.add('network.bgp', 'CONTROL', 'BGP', 'has state', `${bgp.sessions.filter((session) => session.state === 'ESTABLISHED').length}/${bgp.sessions.length} ESTABLISHED · ${bgp.bestRoutes.length} BEST`, bgp.leakedRouteIds.length ? 'warn' : 'neutral', ['network.topology'], [bgpCitation]);

  const aclCitation = builder.cite('config:acl', 'CONFIG', 'ACL POLICY', `${input.acl.rules.length} explicit rules · default ${input.acl.defaultAction.toUpperCase()}`, input.acl.rules.map((rule) => rule.id));
  builder.add('network.acl', 'POLICY', 'ACL policy', 'contains', `${input.acl.rules.length} rules · DEFAULT ${input.acl.defaultAction.toUpperCase()}`, input.acl.defaultAction === 'deny' ? 'warn' : 'neutral', ['network.objective'], [aclCitation]);
  const natCitation = builder.cite('config:nat', 'CONFIG', 'NAT/PAT', `${input.nat.boundaries.length} boundaries · ${input.natSessions.length} sessions`, [...input.nat.boundaries.map((entry) => entry.id), ...input.natSessions.map((entry) => entry.id)]);
  builder.add('network.nat', 'POLICY', 'NAT/PAT', 'contains', `${input.nat.boundaries.length} boundaries · ${input.natSessions.length} active sessions`, 'neutral', ['network.objective'], [natCitation]);

  appendEventFacts(builder, input, [...input.events].reverse().find((event) => event.kind !== 'session') ?? null, 'network.topology');
  return { topic: 'network', focusLabel: `${nodeLabel(graph, input.sourceId)} → ${nodeLabel(graph, input.destinationId)}`, verdictCode: forwarding.reachable ? 'REACHABLE' : 'UNREACHABLE', facts: builder.facts, citations: builder.citations };
}

function routeSourceCitation(builder: FactBuilder, input: BuilderDeviceWorkbenchInput, route: BuilderRouteTableEntry): string {
  if (route.source === 'static') {
    const configured = input.routing.staticRoutes.find((entry) => entry.id === route.id || (entry.routerId === route.routerId && entry.prefix === route.prefix && entry.nextHop === route.nextHop));
    return builder.cite(`config:static-route:${configured?.id ?? route.id}`, 'CONFIG', 'STATIC ROUTE', configured ? `${configured.routerId} ${configured.prefix} via ${configured.nextHop} metric ${configured.metric}` : route.stateNote, [configured?.id ?? route.id, route.routerId]);
  }
  if (route.source === 'ospf') return builder.cite(`state:ospf-route:${route.id}`, 'STATE', 'OSPF RIB/FIB ROUTE', `${route.prefix} · AD ${route.administrativeDistance} · metric ${route.metric} · ${route.stateNote}`, [route.id, route.routerId, route.linkId]);
  if (route.source === 'bgp') return builder.cite(`state:bgp-route:${route.id}`, 'STATE', 'BGP RIB/FIB ROUTE', `${route.prefix} · AD ${route.administrativeDistance} · local-pref ${route.bgpLocalPref ?? '—'} · MED ${route.bgpMed ?? '—'} · ${route.stateNote}`, [route.id, route.routerId, route.linkId]);
  if (route.source === 'isis') return builder.cite(`state:isis-route:${route.id}`, 'STATE', 'IS-IS RIB/FIB ROUTE', `${route.prefix} · AD ${route.administrativeDistance} · metric ${route.metric} · ${route.stateNote}`, [route.id, route.routerId, route.linkId]);
  if (route.source === 'summary') return builder.cite(`state:summary-route:${route.id}`, 'STATE', 'SUMMARY ROUTE', `${route.prefix} · ${route.stateNote}`, [route.id, route.routerId, route.linkId]);
  return builder.cite(`config:connected:${route.routerId}:${route.linkId}`, 'CONFIG', 'CONNECTED INTERFACE', `${route.prefix} on ${route.outgoingInterface} · ${route.linkId}`, [route.routerId, route.linkId]);
}

function rejectionReason(selected: BuilderRouteTableEntry, contender: BuilderRouteTableEntry): string {
  if (contender.prefixLength < selected.prefixLength) return `less specific /${contender.prefixLength} versus /${selected.prefixLength}`;
  if (contender.administrativeDistance > selected.administrativeDistance) return `higher administrative distance ${contender.administrativeDistance} versus ${selected.administrativeDistance}`;
  if (contender.source === 'ospf' && selected.source === 'ospf' && contender.ospfRouteType !== selected.ospfRouteType) return `lower OSPF route-class preference (${contender.ospfRouteType ?? 'intra-area'} versus ${selected.ospfRouteType ?? 'intra-area'})`;
  if (contender.metric > selected.metric) return `higher metric ${contender.metric} versus ${selected.metric}`;
  return 'equal canonical preference or deterministic stable ordering; ECMP remains bounded by the routing engine';
}

function routeFacts(input: BuilderDeviceWorkbenchInput, request: BuilderExplainRequest): FactGraph {
  const builder = new FactBuilder();
  const routerId = request.routerId && input.graph.nodes.some((node) => node.id === request.routerId && node.kind === 'router') ? request.routerId : defaultRouterId(input);
  if (!routerId) {
    const citation = builder.cite('graph:routed', 'CONFIG', 'ROUTED GRAPH', 'No router exists in the current routed graph.', input.graph.nodes.map((node) => node.id));
    builder.add('route.no-router', 'TOPOLOGY', 'Route explanation', 'requires', 'NO ROUTER AVAILABLE', 'bad', [], [citation]);
    return { topic: 'route', focusLabel: 'NO ROUTER', verdictCode: 'NO_ROUTER', facts: builder.facts, citations: builder.citations };
  }
  const destinationAddress = primaryAddress(input.addressing, input.destinationId);
  const routerCitation = builder.cite(`graph:node:${routerId}`, 'CONFIG', 'ROUTER', `${nodeLabel(input.graph, routerId)} · ${routerId}`, [routerId]);
  const destinationCitation = builder.cite(`addressing:destination:${input.destinationId}`, 'CONFIG', 'DESTINATION ADDRESS', destinationAddress ?? 'NO IPV4 ADDRESS', [input.destinationId]);
  builder.add('route.objective', 'CONFIG', nodeLabel(input.graph, routerId), 'must forward to', `${nodeLabel(input.graph, input.destinationId)} · ${destinationAddress ?? 'NO IPV4'}`, destinationAddress ? 'neutral' : 'bad', [], [routerCitation, destinationCitation]);
  if (!destinationAddress) return { topic: 'route', focusLabel: nodeLabel(input.graph, routerId), verdictCode: 'NO_DESTINATION_ADDRESS', facts: builder.facts, citations: builder.citations };

  const ribTable = routeTableForBuilderRouter(ribGraph(input), input.addressing, input.routing, routerId, controlGraph(input));
  const ribCitation = builder.cite(`state:rib:${routerId}`, 'STATE', 'RIB ROUTE TABLE', `${ribTable.filter((entry) => entry.active).length} active routes in the selected live/historical RIB graph`, ribTable.map((entry) => entry.id));
  const ribMatching = ribTable.filter((entry) => entry.active && prefixContains(entry.prefix, destinationAddress));
  builder.add('route.matches', 'RIB_FIB', nodeLabel(input.graph, routerId), 'RIB matching routes', `${ribMatching.length} candidate${ribMatching.length === 1 ? '' : 's'} for ${destinationAddress}`, ribMatching.length ? 'good' : 'bad', ['route.objective'], [ribCitation]);
  const ribSelection = selectBuilderRouteWithDecision(ribTable, destinationAddress, null);
  const selected = ribSelection.route;
  if (!selected) {
    builder.add('route.selected', 'RIB_FIB', nodeLabel(input.graph, routerId), 'RIB selects', 'NO MATCHING ROUTE', 'bad', ['route.matches'], [ribCitation]);
    const fibTable = routeTableForBuilderRouter(fibGraph(input), input.addressing, input.routing, routerId, controlGraph(input));
    const fibCitation = builder.cite(`state:fib:${routerId}`, 'STATE', 'FIB ROUTE TABLE', `${fibTable.filter((entry) => entry.active).length} active routes in the selected live/historical FIB graph`, fibTable.map((entry) => entry.id));
    const fibSelected = selectBuilderRouteWithDecision(fibTable, destinationAddress, null).route;
    builder.add('route.fib-selected', 'RIB_FIB', nodeLabel(input.graph, routerId), 'FIB currently forwards with', fibSelected ? `${fibSelected.prefix} · ${fibSelected.source.toUpperCase()} · via ${fibSelected.nextHop ?? 'CONNECTED'}` : 'NO MATCHING ROUTE', fibSelected ? 'warn' : 'bad', ['route.selected'], [fibCitation, ...(fibSelected ? [routeSourceCitation(builder, input, fibSelected)] : [])]);
    appendEventFacts(builder, input, latestMatchingEvent(input, [routerId, input.destinationId], ['routing', 'topology']), 'route.fib-selected');
    return { topic: 'route', focusLabel: `${nodeLabel(input.graph, routerId)} → ${destinationAddress}`, verdictCode: fibSelected ? 'RIB_FIB_DIVERGED' : 'NO_ROUTE', facts: builder.facts, citations: builder.citations };
  }

  const selectedCitation = routeSourceCitation(builder, input, selected);
  builder.add('route.selected', 'RIB_FIB', nodeLabel(input.graph, routerId), 'RIB selects', `${selected.prefix} · ${selected.source.toUpperCase()} · AD ${selected.administrativeDistance} · metric ${selected.metric} · via ${selected.nextHop ?? 'CONNECTED'}`, 'good', ['route.matches'], [ribCitation, selectedCitation]);
  const contenders = ribMatching.filter((entry) => entry.id !== selected.id).slice(0, 4);
  contenders.forEach((entry, index) => {
    const citation = routeSourceCitation(builder, input, entry);
    builder.add(`route.contender.${index + 1}`, 'RIB_FIB', `${entry.prefix} ${entry.source.toUpperCase()}`, 'loses to RIB winner because', rejectionReason(selected, entry), 'neutral', ['route.selected'], [citation]);
  });

  const fibTable = routeTableForBuilderRouter(fibGraph(input), input.addressing, input.routing, routerId, controlGraph(input));
  const fibCitation = builder.cite(`state:fib:${routerId}`, 'STATE', 'FIB ROUTE TABLE', `${fibTable.filter((entry) => entry.active).length} active routes in the selected live/historical FIB graph`, fibTable.map((entry) => entry.id));
  const fibSelected = selectBuilderRouteWithDecision(fibTable, destinationAddress, null).route;
  const sameSelection = Boolean(fibSelected && fibSelected.prefix === selected.prefix && fibSelected.source === selected.source && fibSelected.nextHop === selected.nextHop && fibSelected.linkId === selected.linkId);
  const fibSelectedCitation = fibSelected ? routeSourceCitation(builder, input, fibSelected) : null;
  builder.add(
    'route.fib-selected',
    'RIB_FIB',
    nodeLabel(input.graph, routerId),
    'FIB currently forwards with',
    fibSelected ? `${fibSelected.prefix} · ${fibSelected.source.toUpperCase()} · via ${fibSelected.nextHop ?? 'CONNECTED'} · ${fibSelected.linkId}` : 'NO MATCHING ROUTE',
    fibSelected ? (sameSelection ? 'good' : 'warn') : 'bad',
    ['route.selected'],
    [fibCitation, ...(fibSelectedCitation ? [fibSelectedCitation] : [])],
  );
  if (!sameSelection) {
    builder.add('route.convergence', 'RIB_FIB', 'Control-to-data-plane convergence', 'has state', `RIB/FIB DIVERGENCE · RIB ${selected.prefix} ${selected.source.toUpperCase()} via ${selected.nextHop ?? 'CONNECTED'} · FIB ${fibSelected ? `${fibSelected.prefix} ${fibSelected.source.toUpperCase()} via ${fibSelected.nextHop ?? 'CONNECTED'}` : 'NO ROUTE'}`, 'warn', ['route.selected', 'route.fib-selected'], [ribCitation, fibCitation]);
  }

  const forwardingRoute = fibSelected;
  if (!forwardingRoute) {
    builder.add('route.forward', 'FORWARDING', nodeLabel(input.graph, routerId), 'forwards via', 'NO FIB ROUTE', 'bad', ['route.fib-selected'], [fibCitation]);
    appendEventFacts(builder, input, latestMatchingEvent(input, [selected.id, routerId], ['routing', 'topology']), 'route.forward');
    return { topic: 'route', focusLabel: `${nodeLabel(input.graph, routerId)} → ${destinationAddress}`, verdictCode: 'RIB_FIB_DIVERGED', facts: builder.facts, citations: builder.citations };
  }
  const link = fibGraph(input).links.find((entry) => entry.id === forwardingRoute.linkId);
  const linkCitation = builder.cite(`graph:fib-link:${forwardingRoute.linkId}`, 'STATE', 'FIB OUTGOING LINK', `${forwardingRoute.linkId} · ${link?.failed ? 'DOWN' : 'UP'} · cost ${link?.cost ?? '—'}`, [forwardingRoute.linkId]);
  builder.add('route.forward', 'FORWARDING', nodeLabel(input.graph, routerId), 'forwards via', `${forwardingRoute.outgoingInterface} → ${forwardingRoute.nextHop ?? destinationAddress} · ${forwardingRoute.linkId}`, link?.failed ? 'bad' : sameSelection ? 'good' : 'warn', ['route.fib-selected'], [linkCitation]);
  appendEventFacts(builder, input, latestMatchingEvent(input, [selected.id, forwardingRoute.id, forwardingRoute.linkId, routerId], ['routing', 'topology']), 'route.forward');
  const verdictCode = !sameSelection ? 'RIB_FIB_DIVERGED' : link?.failed ? 'SELECTED_LINK_DOWN' : 'ROUTE_SELECTED';
  return { topic: 'route', focusLabel: `${nodeLabel(input.graph, routerId)} → ${destinationAddress}`, verdictCode, facts: builder.facts, citations: builder.citations };
}

function adjacencyFacts(input: BuilderDeviceWorkbenchInput, request: BuilderExplainRequest): FactGraph {
  const builder = new FactBuilder();
  const ospf = builderOspfState(controlGraph(input), input.addressing, input.routing);
  const preferredRouter = request.routerId ?? defaultRouterId(input);
  const adjacency = (request.adjacencyId ? ospf.adjacencies.find((entry) => entry.id === request.adjacencyId) : null)
    ?? ospf.adjacencies.find((entry) => entry.aRouterId === preferredRouter || entry.bRouterId === preferredRouter)
    ?? ospf.adjacencies[0]
    ?? null;
  const ospfConfigCitation = builder.cite('config:ospf:enabled', 'CONFIG', 'OSPF ENABLEMENT', input.routing.ospf.enabledRouterIds.join(', ') || 'NONE', input.routing.ospf.enabledRouterIds);
  if (!adjacency) {
    builder.add('adjacency.none', 'CONTROL', 'OSPF', 'has adjacency', 'NO ADJACENCY OBJECTS', 'warn', [], [ospfConfigCitation]);
    return { topic: 'adjacency', focusLabel: preferredRouter ? nodeLabel(input.graph, preferredRouter) : 'OSPF', verdictCode: 'NO_ADJACENCY', facts: builder.facts, citations: builder.citations };
  }
  const link = controlGraph(input).links.find((entry) => entry.id === adjacency.linkId);
  const linkCitation = builder.cite(`graph:link:${adjacency.linkId}`, 'STATE', 'CONTROL-PLANE LINK', `${adjacency.linkId} · ${link?.failed ? 'DOWN' : 'UP'} · cost ${link?.cost ?? adjacency.cost}`, [adjacency.linkId]);
  const areaCitation = builder.cite(`config:ospf:area:${adjacency.linkId}`, 'CONFIG', 'OSPF LINK AREA', adjacency.areaId, [adjacency.linkId, adjacency.aRouterId, adjacency.bRouterId]);
  const adjacencyCitation = builder.cite(`state:ospf:adjacency:${adjacency.id}`, 'STATE', 'OSPF ADJACENCY', `${adjacency.state} · ${adjacency.reason}`, [adjacency.id, adjacency.linkId, adjacency.aRouterId, adjacency.bRouterId]);
  builder.add('adjacency.enabled', 'CONFIG', `${nodeLabel(input.graph, adjacency.aRouterId)} + ${nodeLabel(input.graph, adjacency.bRouterId)}`, 'OSPF enablement', `${input.routing.ospf.enabledRouterIds.includes(adjacency.aRouterId) ? 'ON' : 'OFF'} / ${input.routing.ospf.enabledRouterIds.includes(adjacency.bRouterId) ? 'ON' : 'OFF'}`, input.routing.ospf.enabledRouterIds.includes(adjacency.aRouterId) && input.routing.ospf.enabledRouterIds.includes(adjacency.bRouterId) ? 'good' : 'bad', [], [ospfConfigCitation]);
  builder.add('adjacency.link', 'TOPOLOGY', adjacency.linkId, 'physical/control state', link?.failed ? 'DOWN' : 'UP', link?.failed ? 'bad' : 'good', ['adjacency.enabled'], [linkCitation]);
  builder.add('adjacency.area', 'CONFIG', adjacency.linkId, 'belongs to OSPF area', adjacency.areaId, 'neutral', ['adjacency.enabled'], [areaCitation]);
  builder.add('adjacency.state', 'CONTROL', `${nodeLabel(input.graph, adjacency.aRouterId)} ↔ ${nodeLabel(input.graph, adjacency.bRouterId)}`, 'adjacency state', `${adjacency.state} · ${adjacency.reason}`, adjacency.state === 'FULL' ? 'good' : 'bad', ['adjacency.enabled', 'adjacency.link', 'adjacency.area'], [adjacencyCitation]);
  appendEventFacts(builder, input, latestMatchingEvent(input, [adjacency.id, adjacency.linkId, adjacency.aRouterId, adjacency.bRouterId], ['routing', 'topology']), 'adjacency.state');
  return { topic: 'adjacency', focusLabel: `${nodeLabel(input.graph, adjacency.aRouterId)} ↔ ${nodeLabel(input.graph, adjacency.bRouterId)}`, verdictCode: adjacency.state, facts: builder.facts, citations: builder.citations };
}

function policyFacts(input: BuilderDeviceWorkbenchInput): FactGraph {
  const builder = new FactBuilder();
  const trace = traceBuilderPolicy(input.graph, input.addressing, input.routing, input.acl, input.sourceId, input.destinationId, 'icmp', null, null, fibGraph(input));
  const objectiveCitation = builder.cite('config:policy:objective', 'CONFIG', 'POLICY OBJECTIVE', `${nodeLabel(input.graph, input.sourceId)} → ${nodeLabel(input.graph, input.destinationId)} · ICMP`, [input.sourceId, input.destinationId]);
  builder.add('policy.objective', 'CONFIG', 'Current ICMP objective', 'flows', `${nodeLabel(input.graph, input.sourceId)} → ${nodeLabel(input.graph, input.destinationId)}`, 'neutral', [], [objectiveCitation]);
  const forwardingCitation = builder.cite('state:policy:forwarding', 'STATE', 'FORWARDING PREREQUISITE', trace.forwarding.explanation, [input.sourceId, input.destinationId, ...trace.forwarding.hops.map((hop) => hop.linkId ?? '').filter(Boolean)]);
  builder.add('policy.forwarding', 'FORWARDING', 'IPv4 forwarding', 'must succeed before ACL evaluation', trace.forwarding.reachable ? 'REACHABLE' : `UNREACHABLE · ${trace.forwarding.failureReason ?? 'NO ROUTE'}`, trace.forwarding.reachable ? 'good' : 'bad', ['policy.objective'], [forwardingCitation]);
  trace.decisions.forEach((decision, index) => {
    const rule = decision.ruleId ? input.acl.rules.find((entry) => entry.id === decision.ruleId) ?? null : null;
    const citation = builder.cite(decision.ruleId ? `config:acl:${decision.ruleId}` : `config:acl:default:${decision.routerId}`, 'CONFIG', decision.ruleId ? `ACL RULE ${decision.ruleId}` : 'ACL DEFAULT ACTION', rule ? `${rule.order} ${rule.action.toUpperCase()} ${rule.protocol.toUpperCase()} ${rule.sourcePrefix} → ${rule.destinationPrefix}${rule.destinationPort == null ? '' : `:${rule.destinationPort}`} · ${rule.description}` : `DEFAULT ${input.acl.defaultAction.toUpperCase()}`, [decision.ruleId ?? '', decision.routerId]);
    builder.add(`policy.decision.${index + 1}`, 'POLICY', nodeLabel(input.graph, decision.routerId), 'ACL decision', `${decision.action.toUpperCase()} · ${decision.ruleId ?? 'DEFAULT'} · ${decision.ruleDescription}`, decision.action === 'permit' ? 'good' : 'bad', index === 0 ? ['policy.forwarding'] : [`policy.decision.${index}`], [citation]);
  });
  const policyOutcomeCitation = builder.cite('state:policy:outcome', 'STATE', 'POLICY TRACE', trace.explanation, [trace.deniedAtRouterId ?? '', input.sourceId, input.destinationId]);
  builder.add('policy.outcome', 'POLICY', 'Current ICMP policy', 'results in', trace.forwarding.reachable ? (trace.permitted ? 'PERMITTED' : `DENIED · ${trace.deniedAtRouterId ?? 'DEFAULT'}`) : 'NOT EVALUATED', trace.forwarding.reachable ? (trace.permitted ? 'good' : 'bad') : 'warn', trace.decisions.length ? [`policy.decision.${trace.decisions.length}`] : ['policy.forwarding'], [policyOutcomeCitation]);
  const enabledNat = input.nat.boundaries.filter((entry) => entry.enabled);
  const natCitation = builder.cite('config:nat:boundaries', 'CONFIG', 'NAT BOUNDARIES', enabledNat.length ? enabledNat.map((entry) => `${entry.id}@${entry.routerId}`).join(', ') : 'NONE ENABLED', enabledNat.map((entry) => entry.id));
  builder.add('policy.nat', 'POLICY', 'NAT/PAT', 'enabled boundaries', String(enabledNat.length), 'neutral', ['policy.objective'], [natCitation]);
  appendEventFacts(builder, input, latestMatchingEvent(input, [trace.deniedAtRouterId ?? '', ...trace.decisions.map((entry) => entry.ruleId ?? '')], ['policy', 'nat']), 'policy.outcome');
  return { topic: 'policy', focusLabel: `${nodeLabel(input.graph, input.sourceId)} → ${nodeLabel(input.graph, input.destinationId)}`, verdictCode: !trace.forwarding.reachable ? 'NOT_REACHED' : trace.permitted ? 'PERMITTED' : 'DENIED', facts: builder.facts, citations: builder.citations };
}

function packetFacts(input: BuilderDeviceWorkbenchInput, request: BuilderExplainRequest): FactGraph {
  const builder = new FactBuilder();
  const probe = (request.probeId ? input.probeHistory.find((entry) => entry.id === request.probeId) : null) ?? [...input.probeHistory].sort((a, b) => b.sequence - a.sequence)[0] ?? null;
  if (!probe) {
    const citation = builder.cite('outcome:probe:none', 'OUTCOME', 'PROBE HISTORY', 'No probe has been recorded in this live/historical snapshot.', []);
    builder.add('packet.none', 'OUTCOME', 'Probe/packet outcome', 'has result', 'NO PROBE RECORDED', 'warn', [], [citation]);
    return { topic: 'packet', focusLabel: 'NO PROBE', verdictCode: 'NO_PROBE', facts: builder.facts, citations: builder.citations };
  }
  const requestedIndex = request.probeAttemptIndex == null ? probe.attempts.length - 1 : Math.max(0, Math.min(probe.attempts.length - 1, request.probeAttemptIndex));
  const attempt = probe.attempts[requestedIndex] ?? null;
  const probeCitation = builder.cite(`outcome:probe:${probe.id}`, 'OUTCOME', `${probe.kind.toUpperCase()} #${probe.sequence}`, `${probe.summary} · ${probe.snapshotNote}`, [probe.id, probe.sourceNodeId, probe.destinationNodeId]);
  builder.add('packet.probe', 'OUTCOME', `${probe.kind.toUpperCase()} #${probe.sequence}`, 'overall result', `${probe.success ? 'PASS' : 'FAIL'} · ${probe.plane}`, probe.success ? 'good' : 'bad', [], [probeCitation]);
  if (!attempt) return { topic: 'packet', focusLabel: `${probe.kind.toUpperCase()} #${probe.sequence}`, verdictCode: probe.success ? 'PASS' : 'FAIL', facts: builder.facts, citations: builder.citations };
  const attemptCitation = builder.cite(`outcome:probe:${probe.id}:attempt:${attempt.index}`, 'OUTCOME', `ATTEMPT TTL ${attempt.ttl}`, `${attempt.status.toUpperCase()} · ${attempt.detail}`, [probe.id, String(attempt.index), attempt.dropLinkId ?? '']);
  builder.add('packet.path', 'FORWARDING', 'Request path', 'traverses', attempt.requestNodeIds.length ? attempt.requestNodeIds.map((id) => nodeLabel(input.graph, id)).join(' → ') : 'NO FORWARD PATH', attempt.requestNodeIds.length ? 'neutral' : 'warn', ['packet.probe'], [attemptCitation]);
  builder.add('packet.attempt', 'OUTCOME', `TTL ${attempt.ttl}`, 'results in', `${attempt.status.toUpperCase().replaceAll('-', ' ')} · ${attempt.detail}`, attempt.status === 'echo-reply' || attempt.status === 'time-exceeded' ? 'good' : attempt.status === 'timeout' || attempt.status === 'unreachable' || attempt.status === 'packet-too-big' ? 'bad' : 'warn', ['packet.path'], [attemptCitation]);
  if (attempt.dropLinkId) {
    const profile = input.linkProfiles?.[attempt.dropLinkId];
    const dropCitation = builder.cite(`config:link-profile:${attempt.dropLinkId}`, 'CONFIG', 'LINK CHARACTERISTICS', profile ? `${attempt.dropLinkId} · loss ${profile.lossPercent}% · MTU ${profile.mtuBytes} · latency ${profile.latencyMs}ms` : `${attempt.dropLinkId} · profile unavailable in this snapshot`, [attempt.dropLinkId]);
    builder.add('packet.drop', 'OUTCOME', attempt.dropLinkId, 'caused deterministic packet loss', attempt.detail, 'bad', ['packet.attempt'], [dropCitation, attemptCitation]);
  }
  if (attempt.pathMtuBytes != null) {
    const mtuCitation = builder.cite(`outcome:probe:${probe.id}:attempt:${attempt.index}:mtu`, 'OUTCOME', 'PATH MTU', String(attempt.pathMtuBytes), attempt.requestLinkIds);
    builder.add('packet.mtu', 'FORWARDING', 'Path MTU', 'equals', `${attempt.pathMtuBytes} bytes`, attempt.status === 'packet-too-big' ? 'bad' : 'neutral', ['packet.path'], [mtuCitation]);
  }
  if (attempt.natDetail || probe.natApplied) {
    const natCitation = builder.cite(`outcome:probe:${probe.id}:nat`, 'OUTCOME', 'NAT TRANSLATION', attempt.natDetail ?? probe.natTranslationId ?? 'NAT APPLIED', [probe.natTranslationId ?? '', ...probe.natSessions.map((entry) => entry.id)]);
    builder.add('packet.nat', 'POLICY', 'NAT/PAT', 'translated packet', attempt.natDetail ?? probe.natTranslationId ?? 'NAT APPLIED', 'neutral', ['packet.path'], [natCitation]);
  }
  appendEventFacts(builder, input, latestMatchingEvent(input, [probe.id], ['probe', 'policy', 'nat', 'ipv6']), 'packet.attempt');
  return { topic: 'packet', focusLabel: `${probe.kind.toUpperCase()} #${probe.sequence} · TTL ${attempt.ttl}`, verdictCode: attempt.status.toUpperCase().replaceAll('-', '_'), facts: builder.facts, citations: builder.citations };
}

function applicationFacts(input: BuilderDeviceWorkbenchInput, request: BuilderExplainRequest): FactGraph {
  const builder = new FactBuilder();
  const transaction = (request.applicationId ? input.applicationHistory.find((entry) => entry.id === request.applicationId) : null) ?? input.applicationHistory.at(-1) ?? null;
  if (!transaction) {
    const citation = builder.cite('outcome:application:none', 'OUTCOME', 'APPLICATION HISTORY', 'No application transaction has been recorded in this live/historical snapshot.', []);
    builder.add('application.none', 'OUTCOME', 'Application transaction', 'has result', 'NO TRANSACTION RECORDED', 'warn', [], [citation]);
    return { topic: 'application', focusLabel: 'NO APPLICATION TRANSACTION', verdictCode: 'NO_TRANSACTION', facts: builder.facts, citations: builder.citations };
  }
  const transactionCitation = builder.cite(`outcome:application:${transaction.id}`, 'OUTCOME', `${transaction.service.label} #${transaction.sequence}`, `${transaction.summary} · first broken boundary ${transaction.firstBrokenBoundary ?? 'NONE'}`, [transaction.id, transaction.service.id, transaction.sourceNodeId, transaction.destinationNodeId]);
  builder.add('application.transaction', 'OUTCOME', `${transaction.service.label} #${transaction.sequence}`, 'overall result', transaction.success ? 'SUCCESS' : `FAIL · ${transaction.firstBrokenBoundary ?? 'UNKNOWN'}`, transaction.success ? 'good' : 'bad', [], [transactionCitation]);
  const diagnosis = diagnoseBuilderApplicationTransaction(transaction, input.graph, input.applicationStageOrder);
  let previous = 'application.transaction';
  for (const dimension of diagnosis.dimensions.filter((entry) => entry.status !== 'NOT_REACHED')) {
    const stage = dimension.stageId ? transaction.stages.find((entry) => entry.id === dimension.stageId) ?? null : null;
    const citation = builder.cite(`outcome:application:${transaction.id}:dimension:${dimension.id}`, 'OUTCOME', dimension.label, `${dimension.status} · ${dimension.summary} · ${dimension.detail}`, [transaction.id, dimension.stageId ?? '', ...dimension.nodeIds, ...dimension.linkIds]);
    const status: BuilderExplainFactStatus = dimension.status === 'FAIL' ? 'bad' : dimension.status === 'PASS' ? 'good' : 'neutral';
    const id = `application.dimension.${dimension.id.toLowerCase()}`;
    builder.add(id, dimension.id === 'POLICY' || dimension.id === 'TRANSLATION' ? 'POLICY' : dimension.id === 'ROUTING' ? 'RIB_FIB' : 'OUTCOME', dimension.label, 'evaluates to', `${dimension.status} · ${dimension.summary}`, status, [previous], [citation]);
    if (stage) {
      const stageCitation = builder.cite(`outcome:application:${transaction.id}:stage:${stage.id}`, 'OUTCOME', `STAGE ${stage.order} · ${stage.label}`, `${stage.status} · ${stage.summary} · ${stage.detail}`, [transaction.id, stage.id, ...stage.nodeIds, ...stage.linkIds]);
      builder.facts[builder.facts.length - 1].citationIds.push(stageCitation);
    }
    previous = id;
    if (dimension.status === 'FAIL') break;
  }
  appendEventFacts(builder, input, latestMatchingEvent(input, [transaction.id], ['application', 'policy', 'nat', 'routing', 'probe']), previous);
  return { topic: 'application', focusLabel: `${transaction.service.label} #${transaction.sequence}`, verdictCode: diagnosis.firstBrokenDimension ?? (diagnosis.success ? 'SUCCESS' : diagnosis.terminal ? 'FAIL' : 'IN_PROGRESS'), facts: builder.facts, citations: builder.citations };
}

function eventFacts(input: BuilderDeviceWorkbenchInput, request: BuilderExplainRequest): FactGraph {
  const builder = new FactBuilder();
  const event = (request.eventId ? input.events.find((entry) => entry.id === request.eventId) : null) ?? [...input.events].reverse().find((entry) => entry.kind !== 'session') ?? input.events.at(-1) ?? null;
  if (!event) {
    const citation = builder.cite('event:none', 'EVENT', 'EVENT JOURNAL', 'No event is available.', []);
    builder.add('event.none', 'EVENT', 'Causal event', 'has state', 'NO EVENT', 'warn', [], [citation]);
    return { topic: 'event', focusLabel: 'NO EVENT', verdictCode: 'NO_EVENT', facts: builder.facts, citations: builder.citations };
  }
  appendEventFacts(builder, input, event);
  const chain = eventChain(input.events, event.id);
  return { topic: 'event', focusLabel: `#${event.sequence} ${event.summary}`, verdictCode: chain.length > 1 ? 'CAUSAL_CHAIN' : 'EVENT', facts: builder.facts, citations: builder.citations };
}

function factGraph(input: BuilderDeviceWorkbenchInput, request: BuilderExplainRequest): FactGraph {
  if (request.topic === 'route') return routeFacts(input, request);
  if (request.topic === 'adjacency') return adjacencyFacts(input, request);
  if (request.topic === 'policy') return policyFacts(input);
  if (request.topic === 'packet') return packetFacts(input, request);
  if (request.topic === 'application') return applicationFacts(input, request);
  if (request.topic === 'event') return eventFacts(input, request);
  return networkFacts(input);
}

function firstFact(graph: FactGraph, id: string): BuilderExplainFact | null { return graph.facts.find((fact) => fact.id === id) ?? null; }
function badFact(graph: FactGraph): BuilderExplainFact | null { return graph.facts.find((fact) => fact.status === 'bad') ?? null; }
function terminalFact(graph: FactGraph): BuilderExplainFact | null { return [...graph.facts].reverse().find((fact) => fact.category !== 'EVENT') ?? graph.facts.at(-1) ?? null; }

function titleFor(graph: FactGraph): string {
  if (graph.topic === 'network') return 'EXPLAIN THIS NETWORK';
  if (graph.topic === 'route') return 'WHY THIS ROUTE';
  if (graph.topic === 'adjacency') return 'WHY THIS ADJACENCY';
  if (graph.topic === 'policy') return 'WHY POLICY PERMITTED OR DENIED';
  if (graph.topic === 'packet') return 'WHY THIS PACKET OUTCOME';
  if (graph.topic === 'application') return 'WHY THIS APPLICATION OUTCOME';
  return 'WHY THIS EVENT HAPPENED';
}

function summaryFor(graph: FactGraph, level: BuilderExplainLevel): string {
  const failed = badFact(graph);
  const terminal = terminalFact(graph);
  if (level === 'novice') {
    if (graph.topic === 'network') return graph.verdictCode === 'REACHABLE' ? 'The selected endpoints can currently reach each other. The explanation below shows the network facts that make that true.' : 'The selected endpoints cannot currently complete IPv4 forwarding. The first failing fact below shows where the path stops.';
    if (graph.topic === 'route') return graph.verdictCode === 'ROUTE_SELECTED' ? `This router has a usable route for the destination and sends traffic through the selected next hop.` : `This router cannot currently use the expected route. ${failed?.value ?? terminal?.value ?? ''}`;
    if (graph.topic === 'adjacency') return graph.verdictCode === 'FULL' ? 'These OSPF routers are neighbors because both sides are enabled and the shared control-plane link satisfies the adjacency rules.' : `These OSPF routers are not fully adjacent. ${failed?.value ?? terminal?.value ?? ''}`;
    if (graph.topic === 'policy') return graph.verdictCode === 'PERMITTED' ? 'The packet reaches each policy boundary and none of the evaluated ACL rules blocks it.' : `Policy does not permit the current flow. ${failed?.value ?? terminal?.value ?? ''}`;
    if (graph.topic === 'packet') return `The recorded probe outcome is explained from its immutable attempt snapshot, not by rerunning the packet. ${terminal?.value ?? ''}`;
    if (graph.topic === 'application') return graph.verdictCode === 'SUCCESS' ? 'Every application dependency reached by this transaction passed.' : `The application stopped at the first failed dependency: ${graph.verdictCode.replaceAll('_', ' ')}.`;
    return `This event is shown with the earlier canonical events recorded as its causes.`;
  }
  if (level === 'operational') {
    return `${graph.focusLabel} · ${graph.verdictCode.replaceAll('_', ' ')}. ${failed ? `First failing fact: ${failed.subject} ${failed.relation} ${failed.value}.` : `Terminal fact: ${terminal?.subject ?? '—'} ${terminal?.relation ?? ''} ${terminal?.value ?? ''}.`}`;
  }
  const citations = new Set(graph.facts.flatMap((fact) => fact.citationIds));
  return `${graph.focusLabel} · verdict ${graph.verdictCode}. Fact graph: ${graph.facts.length} facts, ${citations.size} cited canonical references. Text is a projection only; route, forwarding, policy, protocol state, and outcomes remain owned by the existing Builder engines.`;
}

function detailFor(graph: FactGraph, level: BuilderExplainLevel): string {
  const nonEventFacts = graph.facts.filter((fact) => fact.category !== 'EVENT');
  if (level === 'novice') {
    return nonEventFacts.slice(0, 5).map((fact) => `${fact.subject}: ${fact.value}.`).join(' ');
  }
  if (level === 'operational') {
    return nonEventFacts.map((fact) => `${fact.subject} ${fact.relation} ${fact.value}`).join(' · ');
  }
  return graph.facts.map((fact) => `${fact.id} [${fact.category}] ${fact.subject} ${fact.relation} ${fact.value} ← ${fact.citationIds.join(', ') || 'NO CITATION'}`).join(' · ');
}

function stepsFor(graph: FactGraph, level: BuilderExplainLevel): BuilderExplainStep[] {
  const facts = graph.facts;
  return facts.map((fact, index) => {
    const label = level === 'novice'
      ? `${index + 1}. ${fact.subject}`
      : level === 'operational'
        ? `${fact.category} · ${fact.subject}`
        : `${fact.id} · ${fact.category} · CAUSES ${fact.causeFactIds.join(', ') || 'ROOT'}`;
    const detail = level === 'novice'
      ? fact.value
      : level === 'operational'
        ? `${fact.relation.toUpperCase()} · ${fact.value}`
        : `${fact.subject} ${fact.relation} ${fact.value} · EVIDENCE ${fact.citationIds.join(', ') || 'NONE'}`;
    return { id: `step:${fact.id}`, label, detail, status: fact.status, factId: fact.id, citationIds: [...fact.citationIds] };
  });
}

export function explainBuilderNetwork(input: BuilderDeviceWorkbenchInput, request: BuilderExplainRequest): BuilderExplanation {
  const graph = factGraph(input, request);
  return {
    schema: BUILDER_EXPLAIN_SCHEMA,
    version: BUILDER_EXPLAIN_VERSION,
    id: `explain:${request.topic}:${graph.focusLabel}:${request.level}`,
    topic: request.topic,
    level: request.level,
    focusLabel: graph.focusLabel,
    verdictCode: graph.verdictCode,
    title: titleFor(graph),
    summary: summaryFor(graph, request.level),
    detail: detailFor(graph, request.level),
    facts: graph.facts.map((fact) => ({ ...fact, causeFactIds: [...fact.causeFactIds], citationIds: [...fact.citationIds] })),
    citations: graph.citations.map((citation) => ({ ...citation, objectIds: [...citation.objectIds] })),
    chain: stepsFor(graph, request.level),
    provenance: 'SIMULATED',
    truthAuthority: 'CANONICAL_BUILDER',
    boundary: 'Track L explanations are deterministic projections over supplied canonical Builder configuration, runtime state, immutable outcomes, and causal events. The explanation layer never selects routes, runs forwarding, evaluates policy as an authority, changes protocol state, or invents provenance; existing engines remain the only source of network truth.',
  };
}

export function createBuilderExplanationQueryPack(explanation: BuilderExplanation): BuilderExplanationQueryPack {
  return {
    schema: 'hopscotch.builder.explain.query-pack',
    version: 1,
    explanationId: explanation.id,
    topic: explanation.topic,
    truthAuthority: 'CANONICAL_BUILDER',
    advisoryOnly: true,
    allowedUses: ['SUMMARIZE', 'ANSWER_FROM_CITED_FACTS', 'COMPARE_CITED_FACTS'],
    forbiddenUses: ['DECIDE_ROUTING', 'DECIDE_FORWARDING', 'DECIDE_POLICY', 'MUTATE_CANONICAL_STATE', 'INVENT_EVIDENCE_OR_PROVENANCE'],
    facts: explanation.facts.map((fact) => ({ ...fact, causeFactIds: [...fact.causeFactIds], citationIds: [...fact.citationIds] })),
    citations: explanation.citations.map((citation) => ({ ...citation, objectIds: [...citation.objectIds] })),
  };
}

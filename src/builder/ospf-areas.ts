import { normalizeBuilderIpv4 } from './addressing.ts';
import type { BuilderGraph } from './model.ts';

export const BUILDER_OSPF_BACKBONE_AREA = '0.0.0.0' as const;

export interface BuilderOspfSummary {
  id: string;
  abrRouterId: string;
  fromAreaId: string;
  prefix: string;
  metric: number;
  description: string;
}

export interface BuilderOspfAreaConfigLike {
  enabledRouterIds: string[];
  linkAreas?: Record<string, string>;
  summaries?: BuilderOspfSummary[];
}

export interface BuilderOspfAreaPath {
  reachable: boolean;
  totalCost: number;
  firstHops: Array<{ nextRouterId: string; linkId: string }>;
}

export interface BuilderOspfPathCandidate extends BuilderOspfAreaPath {
  routeType: 'intra-area' | 'inter-area';
  sourceAreaId: string;
  originAreaId: string;
  sourceAbrRouterId: string | null;
  destinationAbrRouterId: string | null;
  costToDestinationAbr: number;
}

function nodeIsRouter(graph: BuilderGraph, nodeId: string): boolean {
  return graph.nodes.some((node) => node.id === nodeId && node.kind === 'router');
}

function linkById(graph: BuilderGraph, linkId: string) {
  return graph.links.find((link) => link.id === linkId);
}

function ipv4ToInt(value: string): number {
  return normalizeBuilderIpv4(value).split('.').reduce((result, part) => ((result << 8) | Number(part)) >>> 0, 0) >>> 0;
}

function intToIpv4(value: number): string {
  const normalized = value >>> 0;
  return [24, 16, 8, 0].map((shift) => (normalized >>> shift) & 255).join('.');
}

export function normalizeBuilderOspfAreaId(value: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('OSPF area id cannot be empty.');
  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (!Number.isSafeInteger(numeric) || numeric < 0 || numeric > 0xffffffff) throw new Error('OSPF decimal area ids must be 0–4294967295.');
    return intToIpv4(numeric >>> 0);
  }
  try { return normalizeBuilderIpv4(raw); }
  catch { throw new Error(`Invalid OSPF area id ${value}; use decimal or dotted-quad notation.`); }
}

interface ParsedPrefix { cidr: string; network: number; broadcast: number; prefixLength: number }
function parsePrefix(value: string): ParsedPrefix {
  const [addressText, prefixText, ...extra] = String(value ?? '').trim().split('/');
  if (!addressText || prefixText == null || extra.length > 0 || !/^\d{1,2}$/.test(prefixText)) throw new Error(`Invalid OSPF summary prefix ${value}.`);
  const prefixLength = Number(prefixText);
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) throw new Error('OSPF summary prefixes must be /0 through /32.');
  const address = ipv4ToInt(addressText);
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  const network = (address & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { cidr: `${intToIpv4(network)}/${prefixLength}`, network, broadcast, prefixLength };
}

export function builderOspfPrefixContains(summaryPrefix: string, specificPrefix: string): boolean {
  const summary = parsePrefix(summaryPrefix);
  const specific = parsePrefix(specificPrefix);
  return summary.prefixLength <= specific.prefixLength && specific.network >= summary.network && specific.broadcast <= summary.broadcast;
}

export function builderOspfAreaForLink(config: BuilderOspfAreaConfigLike, linkId: string): string {
  return normalizeBuilderOspfAreaId(config.linkAreas?.[linkId] ?? BUILDER_OSPF_BACKBONE_AREA);
}

export function builderOspfAreasForRouter(graph: BuilderGraph, config: BuilderOspfAreaConfigLike, routerId: string): string[] {
  if (!config.enabledRouterIds.includes(routerId) || !nodeIsRouter(graph, routerId)) return [];
  return [...new Set(graph.links.filter((link) => link.a === routerId || link.b === routerId).map((link) => builderOspfAreaForLink(config, link.id)))].sort();
}

export function builderOspfAbrRouterIds(graph: BuilderGraph, config: BuilderOspfAreaConfigLike): string[] {
  return config.enabledRouterIds.filter((routerId) => {
    const areas = builderOspfAreasForRouter(graph, config, routerId);
    return areas.includes(BUILDER_OSPF_BACKBONE_AREA) && areas.some((areaId) => areaId !== BUILDER_OSPF_BACKBONE_AREA);
  }).sort();
}

export function validateBuilderOspfAreaConfig(graph: BuilderGraph, config: BuilderOspfAreaConfigLike): { linkAreas: Record<string, string>; summaries: BuilderOspfSummary[] } {
  const linkIds = new Set(graph.links.map((link) => link.id));
  const linkAreas: Record<string, string> = {};
  for (const [linkId, rawAreaId] of Object.entries(config.linkAreas ?? {})) {
    if (!linkIds.has(linkId)) throw new Error(`OSPF area assignment references unknown link ${linkId}.`);
    const areaId = normalizeBuilderOspfAreaId(rawAreaId);
    if (areaId !== BUILDER_OSPF_BACKBONE_AREA) linkAreas[linkId] = areaId;
  }

  const normalizedConfig: BuilderOspfAreaConfigLike = { ...config, linkAreas };
  const abrIds = new Set(builderOspfAbrRouterIds(graph, normalizedConfig));
  const enabled = new Set(config.enabledRouterIds);
  const summaryIds = new Set<string>();
  const summaries = (config.summaries ?? []).map((raw, index): BuilderOspfSummary => {
    if (!raw || typeof raw !== 'object') throw new Error(`OSPF summary ${index + 1} is invalid.`);
    const id = String(raw.id ?? '').trim();
    if (!id || id.length > 120 || !/^[a-zA-Z0-9_.:-]+$/.test(id) || summaryIds.has(id)) throw new Error(`OSPF summary ${index + 1} has an invalid or duplicate id.`);
    const abrRouterId = String(raw.abrRouterId ?? '').trim();
    if (!enabled.has(abrRouterId) || !abrIds.has(abrRouterId)) throw new Error(`OSPF summary ${id} must belong to an enabled ABR attached to Area 0.`);
    const fromAreaId = normalizeBuilderOspfAreaId(raw.fromAreaId);
    if (fromAreaId === BUILDER_OSPF_BACKBONE_AREA) throw new Error(`OSPF summary ${id} must summarize a non-backbone source area in this teaching model.`);
    if (!builderOspfAreasForRouter(graph, normalizedConfig, abrRouterId).includes(fromAreaId)) throw new Error(`OSPF summary ${id} ABR ${abrRouterId} is not attached to ${fromAreaId}.`);
    const prefix = parsePrefix(raw.prefix).cidr;
    const metric = Number(raw.metric);
    if (!Number.isInteger(metric) || metric < 1 || metric > 16777215) throw new Error(`OSPF summary ${id} metric must be 1–16777215.`);
    summaryIds.add(id);
    return { id, abrRouterId, fromAreaId, prefix, metric, description: String(raw.description ?? '').slice(0, 80) };
  }).sort((a, b) => a.abrRouterId.localeCompare(b.abrRouterId) || a.fromAreaId.localeCompare(b.fromAreaId) || a.prefix.localeCompare(b.prefix) || a.id.localeCompare(b.id));
  return { linkAreas, summaries };
}

export function reconcileBuilderOspfAreaConfig(graph: BuilderGraph, config: BuilderOspfAreaConfigLike): { linkAreas: Record<string, string>; summaries: BuilderOspfSummary[] } {
  const linkIds = new Set(graph.links.map((link) => link.id));
  const linkAreas = Object.fromEntries(Object.entries(config.linkAreas ?? {}).filter(([linkId]) => linkIds.has(linkId)));
  const provisional: BuilderOspfAreaConfigLike = { ...config, linkAreas, summaries: [] };
  const abrIds = new Set(builderOspfAbrRouterIds(graph, provisional));
  const summaries = (config.summaries ?? []).filter((summary) => abrIds.has(summary.abrRouterId) && builderOspfAreasForRouter(graph, provisional, summary.abrRouterId).includes(normalizeBuilderOspfAreaId(summary.fromAreaId)));
  return validateBuilderOspfAreaConfig(graph, { ...config, linkAreas, summaries });
}

function adjacencyMap(graph: BuilderGraph, config: BuilderOspfAreaConfigLike, areaId: string): Map<string, Array<{ neighbor: string; linkId: string; cost: number }>> {
  const normalizedArea = normalizeBuilderOspfAreaId(areaId);
  const enabled = new Set(config.enabledRouterIds.filter((routerId) => nodeIsRouter(graph, routerId)));
  const adjacency = new Map<string, Array<{ neighbor: string; linkId: string; cost: number }>>();
  for (const routerId of enabled) if (builderOspfAreasForRouter(graph, config, routerId).includes(normalizedArea)) adjacency.set(routerId, []);
  for (const link of graph.links) {
    if (link.failed || builderOspfAreaForLink(config, link.id) !== normalizedArea || !enabled.has(link.a) || !enabled.has(link.b)) continue;
    if (!nodeIsRouter(graph, link.a) || !nodeIsRouter(graph, link.b)) continue;
    adjacency.get(link.a)?.push({ neighbor: link.b, linkId: link.id, cost: link.cost });
    adjacency.get(link.b)?.push({ neighbor: link.a, linkId: link.id, cost: link.cost });
  }
  for (const neighbors of adjacency.values()) neighbors.sort((a, b) => a.neighbor.localeCompare(b.neighbor) || a.linkId.localeCompare(b.linkId));
  return adjacency;
}

function distances(adjacency: Map<string, Array<{ neighbor: string; linkId: string; cost: number }>>, startRouterId: string): Map<string, number> {
  const result = new Map<string, number>();
  const settled = new Set<string>();
  for (const routerId of adjacency.keys()) result.set(routerId, Number.POSITIVE_INFINITY);
  if (!adjacency.has(startRouterId)) return result;
  result.set(startRouterId, 0);
  while (settled.size < adjacency.size) {
    let currentId: string | null = null;
    let currentCost = Number.POSITIVE_INFINITY;
    for (const [routerId, cost] of result) {
      if (settled.has(routerId)) continue;
      if (cost < currentCost || (cost === currentCost && currentId !== null && routerId.localeCompare(currentId) < 0)) { currentId = routerId; currentCost = cost; }
    }
    if (currentId === null || !Number.isFinite(currentCost)) break;
    settled.add(currentId);
    for (const edge of adjacency.get(currentId) ?? []) {
      const next = currentCost + edge.cost;
      if (next < (result.get(edge.neighbor) ?? Number.POSITIVE_INFINITY)) result.set(edge.neighbor, next);
    }
  }
  return result;
}

export function builderOspfAreaPath(graph: BuilderGraph, config: BuilderOspfAreaConfigLike, sourceRouterId: string, destinationRouterId: string, areaId: string): BuilderOspfAreaPath {
  const normalizedArea = normalizeBuilderOspfAreaId(areaId);
  const adjacency = adjacencyMap(graph, config, normalizedArea);
  if (sourceRouterId === destinationRouterId) {
    const participates = builderOspfAreasForRouter(graph, config, sourceRouterId).includes(normalizedArea);
    return { reachable: participates, totalCost: 0, firstHops: [] };
  }
  if (!adjacency.has(sourceRouterId) || !adjacency.has(destinationRouterId)) return { reachable: false, totalCost: 0, firstHops: [] };
  const fromSource = distances(adjacency, sourceRouterId);
  const toDestination = distances(adjacency, destinationRouterId);
  const totalCost = fromSource.get(destinationRouterId) ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(totalCost)) return { reachable: false, totalCost: 0, firstHops: [] };
  const firstHops = (adjacency.get(sourceRouterId) ?? []).filter((edge) => edge.cost + (toDestination.get(edge.neighbor) ?? Number.POSITIVE_INFINITY) === totalCost).map((edge) => ({ nextRouterId: edge.neighbor, linkId: edge.linkId })).sort((a, b) => a.nextRouterId.localeCompare(b.nextRouterId) || a.linkId.localeCompare(b.linkId));
  return { reachable: firstHops.length > 0, totalCost, firstHops };
}

function abrIdsForArea(graph: BuilderGraph, config: BuilderOspfAreaConfigLike, areaId: string): string[] {
  const normalized = normalizeBuilderOspfAreaId(areaId);
  return builderOspfAbrRouterIds(graph, config).filter((routerId) => builderOspfAreasForRouter(graph, config, routerId).includes(normalized));
}

export function builderOspfPathCandidates(graph: BuilderGraph, config: BuilderOspfAreaConfigLike, sourceRouterId: string, originRouterId: string, originAreaId: string): BuilderOspfPathCandidate[] {
  const originArea = normalizeBuilderOspfAreaId(originAreaId);
  const sourceAreas = builderOspfAreasForRouter(graph, config, sourceRouterId);
  if (sourceAreas.includes(originArea)) {
    const intra = builderOspfAreaPath(graph, config, sourceRouterId, originRouterId, originArea);
    if (!intra.reachable) return [];
    return [{ ...intra, routeType: 'intra-area', sourceAreaId: originArea, originAreaId: originArea, sourceAbrRouterId: null, destinationAbrRouterId: null, costToDestinationAbr: intra.totalCost }];
  }

  const sourceAreaChoices = sourceAreas.includes(BUILDER_OSPF_BACKBONE_AREA) ? [BUILDER_OSPF_BACKBONE_AREA] : sourceAreas.filter((areaId) => areaId !== BUILDER_OSPF_BACKBONE_AREA);
  const sourceBackboneEntries: Array<{ sourceAreaId: string; abrRouterId: string; local: BuilderOspfAreaPath }> = [];
  for (const sourceAreaId of sourceAreaChoices) {
    if (sourceAreaId === BUILDER_OSPF_BACKBONE_AREA) {
      sourceBackboneEntries.push({ sourceAreaId, abrRouterId: sourceRouterId, local: { reachable: true, totalCost: 0, firstHops: [] } });
      continue;
    }
    for (const abrRouterId of abrIdsForArea(graph, config, sourceAreaId)) {
      const local = builderOspfAreaPath(graph, config, sourceRouterId, abrRouterId, sourceAreaId);
      if (local.reachable) sourceBackboneEntries.push({ sourceAreaId, abrRouterId, local });
    }
  }

  const destinationEntries: Array<{ abrRouterId: string; destination: BuilderOspfAreaPath }> = [];
  if (originArea === BUILDER_OSPF_BACKBONE_AREA) {
    destinationEntries.push({ abrRouterId: originRouterId, destination: { reachable: true, totalCost: 0, firstHops: [] } });
  } else {
    for (const abrRouterId of abrIdsForArea(graph, config, originArea)) {
      const destination = builderOspfAreaPath(graph, config, abrRouterId, originRouterId, originArea);
      if (destination.reachable) destinationEntries.push({ abrRouterId, destination });
    }
  }

  const candidates: BuilderOspfPathCandidate[] = [];
  for (const sourceEntry of sourceBackboneEntries) {
    for (const destinationEntry of destinationEntries) {
      const backbone = builderOspfAreaPath(graph, config, sourceEntry.abrRouterId, destinationEntry.abrRouterId, BUILDER_OSPF_BACKBONE_AREA);
      if (!backbone.reachable) continue;
      const firstHops = sourceEntry.local.firstHops.length > 0 ? sourceEntry.local.firstHops : backbone.firstHops.length > 0 ? backbone.firstHops : destinationEntry.destination.firstHops;
      const costToDestinationAbr = sourceEntry.local.totalCost + backbone.totalCost;
      candidates.push({
        reachable: true,
        totalCost: costToDestinationAbr + destinationEntry.destination.totalCost,
        firstHops,
        routeType: 'inter-area',
        sourceAreaId: sourceEntry.sourceAreaId,
        originAreaId: originArea,
        sourceAbrRouterId: sourceEntry.sourceAreaId === BUILDER_OSPF_BACKBONE_AREA ? null : sourceEntry.abrRouterId,
        destinationAbrRouterId: originArea === BUILDER_OSPF_BACKBONE_AREA ? null : destinationEntry.abrRouterId,
        costToDestinationAbr,
      });
    }
  }
  return candidates.sort((a, b) => a.totalCost - b.totalCost || (a.sourceAbrRouterId ?? '').localeCompare(b.sourceAbrRouterId ?? '') || (a.destinationAbrRouterId ?? '').localeCompare(b.destinationAbrRouterId ?? '') || a.firstHops.map((hop) => `${hop.nextRouterId}:${hop.linkId}`).join('|').localeCompare(b.firstHops.map((hop) => `${hop.nextRouterId}:${hop.linkId}`).join('|')));
}

export function builderOspfAreaComponents(graph: BuilderGraph, config: BuilderOspfAreaConfigLike, areaId: string): string[][] {
  const adjacency = adjacencyMap(graph, config, areaId);
  const unvisited = new Set(adjacency.keys());
  const components: string[][] = [];
  while (unvisited.size > 0) {
    const seed = [...unvisited].sort()[0];
    const stack = [seed];
    const component: string[] = [];
    unvisited.delete(seed);
    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);
      for (const edge of [...(adjacency.get(current) ?? [])].sort((a, b) => b.neighbor.localeCompare(a.neighbor))) {
        if (!unvisited.has(edge.neighbor)) continue;
        unvisited.delete(edge.neighbor);
        stack.push(edge.neighbor);
      }
    }
    components.push(component.sort());
  }
  return components.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));
}

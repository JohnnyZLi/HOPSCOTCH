import { interfacesForBuilderNode, normalizeBuilderIpv4, parseBuilderIpv4Cidr, type BuilderAddressing } from './addressing.ts';
import type { BuilderBgpConfig } from './bgp.ts';
import type { BuilderGraph } from './model.ts';
import {
  BUILDER_OSPF_BACKBONE_AREA,
  builderOspfAbrRouterIds,
  builderOspfAreaForLink,
  builderOspfAreaPath,
  builderOspfAreasForRouter,
  builderOspfPathCandidates,
  normalizeBuilderOspfAreaId,
  type BuilderOspfSummary,
} from './ospf-areas.ts';
import * as base from './routing-base.ts';

export type { BuilderOspfSummary } from './ospf-areas.ts';
export type BuilderStaticRoute = base.BuilderStaticRoute;
export type BuilderRouteSource = base.BuilderRouteSource;
export type BuilderForwardingHop = base.BuilderForwardingHop;
export type BuilderForwardingTrace = base.BuilderForwardingTrace;
export type BuilderFlowKey = base.BuilderFlowKey;
export type BuilderOspfAdjacency = base.BuilderOspfAdjacency;
export type BuilderOspfAdvertisement = base.BuilderOspfAdvertisement;
export type BuilderOspfState = base.BuilderOspfState;

export type BuilderOspfAreaType = 'normal' | 'stub' | 'nssa';

export interface BuilderOspfRedistribution {
  id: string;
  routerId: string;
  staticRouteId: string;
  areaId: string;
  metric: number;
}

export interface BuilderOspfConfig {
  enabledRouterIds: string[];
  linkAreas?: Record<string, string>;
  summaries?: BuilderOspfSummary[];
  areaTypes?: Record<string, BuilderOspfAreaType>;
  redistributions?: BuilderOspfRedistribution[];
}

export interface BuilderRoutingConfig {
  staticRoutes: BuilderStaticRoute[];
  ospf: BuilderOspfConfig;
  bgp: BuilderBgpConfig;
}

export interface BuilderRouteTableEntry extends Omit<base.BuilderRouteTableEntry, 'ospfRouteType'> {
  ospfRouteType?: 'intra-area' | 'inter-area' | 'external' | 'nssa-external';
  ospfExternalSource?: 'static';
  ospfExternalLsaType?: 5 | 7;
  ospfRedistributionId?: string | null;
}

export interface BuilderRouteSelection {
  route: BuilderRouteTableEntry | null;
  candidates: BuilderRouteTableEntry[];
  flowKey: string | null;
  flowHash: number | null;
  selectedIndex: number | null;
}

export interface BuilderStaticPathInstallResult {
  routing: BuilderRoutingConfig;
  prefix: string;
  installedRouterIds: string[];
  weightedPathNodeIds: string[];
}

function toBaseRouting(value: BuilderRoutingConfig): base.BuilderRoutingConfig {
  return {
    staticRoutes: value.staticRoutes.map((route) => ({ ...route })),
    ospf: {
      enabledRouterIds: [...(value.ospf?.enabledRouterIds ?? [])],
      linkAreas: { ...(value.ospf?.linkAreas ?? {}) },
      summaries: (value.ospf?.summaries ?? []).map((summary) => ({ ...summary })),
    },
    bgp: value.bgp,
  };
}

function configuredAreaIds(graph: BuilderGraph, ospf: Pick<BuilderOspfConfig, 'enabledRouterIds' | 'linkAreas' | 'summaries'>): Set<string> {
  return new Set(graph.links.map((link) => builderOspfAreaForLink(ospf, link.id)));
}

export function builderOspfAreaType(ospf: BuilderOspfConfig, areaId: string): BuilderOspfAreaType {
  const normalized = normalizeBuilderOspfAreaId(areaId);
  if (normalized === BUILDER_OSPF_BACKBONE_AREA) return 'normal';
  const value = ospf.areaTypes?.[normalized];
  return value === 'stub' || value === 'nssa' ? value : 'normal';
}

function validateOspfExtensions(
  graph: BuilderGraph,
  baseRouting: base.BuilderRoutingConfig,
  rawOspf: BuilderOspfConfig,
): { areaTypes: Record<string, BuilderOspfAreaType>; redistributions: BuilderOspfRedistribution[] } {
  const areas = configuredAreaIds(graph, baseRouting.ospf);
  const areaTypes: Record<string, BuilderOspfAreaType> = {};
  for (const [rawAreaId, rawType] of Object.entries(rawOspf.areaTypes ?? {})) {
    const areaId = normalizeBuilderOspfAreaId(rawAreaId);
    if (rawType !== 'normal' && rawType !== 'stub' && rawType !== 'nssa') throw new Error(`OSPF area ${areaId} has unsupported type ${String(rawType)}.`);
    if (areaId === BUILDER_OSPF_BACKBONE_AREA && rawType !== 'normal') throw new Error('OSPF Area 0 cannot be stub or NSSA.');
    if (!areas.has(areaId)) throw new Error(`OSPF area type references area ${areaId}, which is not assigned to any routed link.`);
    if (rawType !== 'normal') areaTypes[areaId] = rawType;
  }

  const staticById = new Map(baseRouting.staticRoutes.map((route) => [route.id, route]));
  const enabled = new Set(baseRouting.ospf.enabledRouterIds);
  const ids = new Set<string>();
  const redistributions = (rawOspf.redistributions ?? []).map((raw, index): BuilderOspfRedistribution => {
    if (!raw || typeof raw !== 'object') throw new Error(`OSPF redistribution ${index + 1} is invalid.`);
    const id = String(raw.id ?? '').trim();
    if (!id || id.length > 160 || !/^[a-zA-Z0-9_.:-]+$/.test(id) || ids.has(id)) throw new Error(`OSPF redistribution ${index + 1} has an invalid or duplicate id.`);
    ids.add(id);
    const routerId = String(raw.routerId ?? '').trim();
    if (!enabled.has(routerId)) throw new Error(`OSPF redistribution ${id} requires OSPF to be enabled on ${routerId}.`);
    const staticRouteId = String(raw.staticRouteId ?? '').trim();
    const staticRoute = staticById.get(staticRouteId);
    if (!staticRoute || staticRoute.routerId !== routerId) throw new Error(`OSPF redistribution ${id} must reference a static route owned by ${routerId}.`);
    const areaId = normalizeBuilderOspfAreaId(String(raw.areaId ?? ''));
    if (!builderOspfAreasForRouter(graph, baseRouting.ospf, routerId).includes(areaId)) throw new Error(`OSPF redistribution ${id} origin router ${routerId} is not attached to ${areaId}.`);
    const areaType = areaId === BUILDER_OSPF_BACKBONE_AREA ? 'normal' : areaTypes[areaId] ?? 'normal';
    if (areaType === 'stub') throw new Error(`OSPF redistribution ${id} cannot originate external routes inside stub area ${areaId}.`);
    const metric = Number(raw.metric);
    if (!Number.isInteger(metric) || metric < 1 || metric > 16777215) throw new Error(`OSPF redistribution ${id} metric must be 1–16777215.`);
    return { id, routerId, staticRouteId, areaId, metric };
  }).sort((a, b) => a.areaId.localeCompare(b.areaId) || a.routerId.localeCompare(b.routerId) || a.staticRouteId.localeCompare(b.staticRouteId) || a.id.localeCompare(b.id));
  return { areaTypes, redistributions };
}

export function createDefaultBuilderRoutingConfig(): BuilderRoutingConfig {
  const result = base.createDefaultBuilderRoutingConfig();
  return { ...result, ospf: { ...result.ospf, areaTypes: {}, redistributions: [] } };
}

export function validateBuilderRoutingConfig(graph: BuilderGraph, addressing: BuilderAddressing, value: BuilderRoutingConfig): BuilderRoutingConfig {
  const baseRouting = base.validateBuilderRoutingConfig(graph, addressing, toBaseRouting(value));
  const extensions = validateOspfExtensions(graph, baseRouting, value.ospf ?? { enabledRouterIds: [] });
  return {
    ...baseRouting,
    ospf: {
      ...baseRouting.ospf,
      areaTypes: extensions.areaTypes,
      redistributions: extensions.redistributions,
    },
  };
}

export function cloneBuilderRoutingConfig(value: BuilderRoutingConfig): BuilderRoutingConfig {
  const cloned = base.cloneBuilderRoutingConfig(toBaseRouting(value));
  return {
    ...cloned,
    ospf: {
      ...cloned.ospf,
      areaTypes: { ...(value.ospf?.areaTypes ?? {}) },
      redistributions: (value.ospf?.redistributions ?? []).map((entry) => ({ ...entry })),
    },
  };
}

export function reconcileBuilderRoutingConfig(graph: BuilderGraph, addressing: BuilderAddressing, current: BuilderRoutingConfig): BuilderRoutingConfig {
  const reconciled = base.reconcileBuilderRoutingConfig(graph, addressing, toBaseRouting(current));
  const areas = configuredAreaIds(graph, reconciled.ospf);
  const areaTypes = Object.fromEntries(Object.entries(current.ospf?.areaTypes ?? {}).filter(([areaId]) => {
    try { return areas.has(normalizeBuilderOspfAreaId(areaId)); } catch { return false; }
  }));
  const staticById = new Map(reconciled.staticRoutes.map((route) => [route.id, route]));
  const enabled = new Set(reconciled.ospf.enabledRouterIds);
  const redistributions = (current.ospf?.redistributions ?? []).filter((entry) => {
    const route = staticById.get(entry.staticRouteId);
    if (!route || route.routerId !== entry.routerId || !enabled.has(entry.routerId)) return false;
    try {
      const areaId = normalizeBuilderOspfAreaId(entry.areaId);
      return builderOspfAreasForRouter(graph, reconciled.ospf, entry.routerId).includes(areaId)
        && (areaId === BUILDER_OSPF_BACKBONE_AREA || (areaTypes[areaId] ?? 'normal') !== 'stub');
    } catch { return false; }
  });
  return validateBuilderRoutingConfig(graph, addressing, { ...reconciled, ospf: { ...reconciled.ospf, areaTypes, redistributions } });
}

function preserveExtensions(graph: BuilderGraph, addressing: BuilderAddressing, result: base.BuilderRoutingConfig, source: BuilderRoutingConfig, redistributions = source.ospf?.redistributions ?? []): BuilderRoutingConfig {
  return validateBuilderRoutingConfig(graph, addressing, {
    ...result,
    ospf: {
      ...result.ospf,
      areaTypes: { ...(source.ospf?.areaTypes ?? {}) },
      redistributions: redistributions.map((entry) => ({ ...entry })),
    },
  });
}

export function setBuilderOspfRouterEnabled(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, routerId: string, enabled: boolean): BuilderRoutingConfig {
  const result = base.setBuilderOspfRouterEnabled(graph, addressing, toBaseRouting(routing), routerId, enabled);
  const redistributions = enabled ? routing.ospf.redistributions ?? [] : (routing.ospf.redistributions ?? []).filter((entry) => entry.routerId !== routerId);
  return preserveExtensions(graph, addressing, result, routing, redistributions);
}

export function setBuilderOspfEverywhere(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, enabled: boolean): BuilderRoutingConfig {
  const result = base.setBuilderOspfEverywhere(graph, addressing, toBaseRouting(routing), enabled);
  return preserveExtensions(graph, addressing, result, routing, enabled ? routing.ospf.redistributions ?? [] : []);
}

export function setBuilderOspfLinkArea(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, linkId: string, areaId: string): BuilderRoutingConfig {
  const result = base.setBuilderOspfLinkArea(graph, addressing, toBaseRouting(routing), linkId, areaId);
  return reconcileBuilderRoutingConfig(graph, addressing, { ...result, ospf: { ...result.ospf, areaTypes: routing.ospf.areaTypes ?? {}, redistributions: routing.ospf.redistributions ?? [] } });
}

export function setBuilderOspfAreaType(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, areaId: string, areaType: BuilderOspfAreaType): BuilderRoutingConfig {
  const normalized = normalizeBuilderOspfAreaId(areaId);
  if (normalized === BUILDER_OSPF_BACKBONE_AREA && areaType !== 'normal') throw new Error('OSPF Area 0 cannot be stub or NSSA.');
  const next = cloneBuilderRoutingConfig(routing);
  const areaTypes = { ...(next.ospf.areaTypes ?? {}) };
  if (areaType === 'normal') delete areaTypes[normalized];
  else areaTypes[normalized] = areaType;
  next.ospf.areaTypes = areaTypes;
  return validateBuilderRoutingConfig(graph, addressing, next);
}

export function upsertBuilderOspfSummary(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, summary: Omit<BuilderOspfSummary, 'id'> & { id?: string }): BuilderRoutingConfig {
  return preserveExtensions(graph, addressing, base.upsertBuilderOspfSummary(graph, addressing, toBaseRouting(routing), summary), routing);
}

export function deleteBuilderOspfSummary(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, summaryId: string): BuilderRoutingConfig {
  return preserveExtensions(graph, addressing, base.deleteBuilderOspfSummary(graph, addressing, toBaseRouting(routing), summaryId), routing);
}

export function upsertBuilderOspfRedistribution(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  redistribution: Omit<BuilderOspfRedistribution, 'id'> & { id?: string },
): BuilderRoutingConfig {
  const areaId = normalizeBuilderOspfAreaId(redistribution.areaId);
  const id = redistribution.id?.trim() || `ospf-redist:${redistribution.routerId}:${redistribution.staticRouteId}:${areaId}`;
  const next = cloneBuilderRoutingConfig(routing);
  next.ospf.redistributions = [
    ...(next.ospf.redistributions ?? []).filter((entry) => entry.id !== id && !(entry.routerId === redistribution.routerId && entry.staticRouteId === redistribution.staticRouteId && entry.areaId === areaId)),
    { id, routerId: redistribution.routerId, staticRouteId: redistribution.staticRouteId, areaId, metric: redistribution.metric },
  ];
  return validateBuilderRoutingConfig(graph, addressing, next);
}

export function deleteBuilderOspfRedistribution(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, redistributionId: string): BuilderRoutingConfig {
  const next = cloneBuilderRoutingConfig(routing);
  next.ospf.redistributions = (next.ospf.redistributions ?? []).filter((entry) => entry.id !== redistributionId);
  return validateBuilderRoutingConfig(graph, addressing, next);
}

export function upsertBuilderStaticRoute(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, route: Omit<BuilderStaticRoute, 'id'> & { id?: string }): BuilderRoutingConfig {
  const result = base.upsertBuilderStaticRoute(graph, addressing, toBaseRouting(routing), route);
  return reconcileBuilderRoutingConfig(graph, addressing, { ...result, ospf: { ...result.ospf, areaTypes: routing.ospf.areaTypes ?? {}, redistributions: routing.ospf.redistributions ?? [] } });
}

export function deleteBuilderStaticRoute(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, routeId: string): BuilderRoutingConfig {
  const result = base.deleteBuilderStaticRoute(graph, addressing, toBaseRouting(routing), routeId);
  return reconcileBuilderRoutingConfig(graph, addressing, { ...result, ospf: { ...result.ospf, areaTypes: routing.ospf.areaTypes ?? {}, redistributions: routing.ospf.redistributions ?? [] } });
}

export function builderOspfState(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig): BuilderOspfState {
  return base.builderOspfState(graph, addressing, toBaseRouting(routing));
}

function nodeById(graph: BuilderGraph, nodeId: string) { return graph.nodes.find((node) => node.id === nodeId); }
function linkById(graph: BuilderGraph, linkId: string) { return graph.links.find((link) => link.id === linkId); }

function ipv4ToInt(value: string): number {
  return normalizeBuilderIpv4(value).split('.').reduce((result, part) => ((result << 8) | Number(part)) >>> 0, 0) >>> 0;
}
function prefixContains(prefix: string, address: string): boolean {
  const [rawAddress, rawLength] = prefix.split('/');
  const length = Number(rawLength);
  const mask = length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
  return (ipv4ToInt(rawAddress) & mask) === (ipv4ToInt(address) & mask);
}

function firstHopEntry(graph: BuilderGraph, addressing: BuilderAddressing, routerId: string, nextRouterId: string, linkId: string) {
  const segment = addressing.segments[linkId];
  const local = segment?.interfaces.find((entry) => entry.nodeId === routerId);
  const remote = segment?.interfaces.find((entry) => entry.nodeId === nextRouterId);
  return segment && local && remote ? { local, remote } : null;
}

function ospfExternalEntries(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, routerId: string): BuilderRouteTableEntry[] {
  if (!routing.ospf.enabledRouterIds.includes(routerId)) return [];
  const viewerAreas = builderOspfAreasForRouter(graph, routing.ospf, routerId);
  const viewerHasNormalArea = viewerAreas.some((areaId) => builderOspfAreaType(routing.ospf, areaId) === 'normal');
  const entries: BuilderRouteTableEntry[] = [];
  for (const rule of routing.ospf.redistributions ?? []) {
    if (rule.routerId === routerId) continue;
    const staticRoute = routing.staticRoutes.find((route) => route.id === rule.staticRouteId && route.routerId === rule.routerId);
    if (!staticRoute) continue;
    const originStatic = base.routeTableForBuilderRouter(graph, addressing, toBaseRouting(routing), rule.routerId).find((entry) => entry.id === staticRoute.id);
    if (!originStatic?.active) continue;
    const originType = builderOspfAreaType(routing.ospf, rule.areaId);
    const insideOriginNssa = originType === 'nssa' && viewerAreas.includes(rule.areaId);
    if (originType === 'nssa' ? !insideOriginNssa && !viewerHasNormalArea : !viewerHasNormalArea) continue;
    const paths = builderOspfPathCandidates(graph, routing.ospf, routerId, rule.routerId, rule.areaId);
    for (const path of paths) {
      if (!path.reachable || path.firstHops.length === 0) continue;
      for (const firstHop of path.firstHops) {
        const hop = firstHopEntry(graph, addressing, routerId, firstHop.nextRouterId, firstHop.linkId);
        if (!hop) continue;
        const nssa = originType === 'nssa' && path.routeType === 'intra-area';
        entries.push({
          id: `ospf-external:${routerId}:${staticRoute.prefix}:${rule.id}:${firstHop.nextRouterId}:${firstHop.linkId}`.replace(/\//g, ':'),
          routerId,
          prefix: staticRoute.prefix,
          prefixLength: Number(staticRoute.prefix.split('/')[1]),
          source: 'ospf',
          administrativeDistance: 110,
          metric: path.totalCost + rule.metric,
          nextHop: hop.remote.address,
          outgoingInterface: hop.local.name,
          linkId: firstHop.linkId,
          active: true,
          stateNote: `${nssa ? 'OSPF O N1 · TYPE-7 NSSA' : originType === 'nssa' ? 'OSPF O E1 · TYPE-5 TRANSLATED FROM NSSA' : 'OSPF O E1 · TYPE-5 EXTERNAL'} · REDISTRIBUTED STATIC · ASBR ${nodeById(graph, rule.routerId)?.label ?? rule.routerId} · METRIC ${rule.metric}`,
          ospfRouteType: nssa ? 'nssa-external' : 'external',
          ospfAreaId: rule.areaId,
          ospfAbrRouterId: path.destinationAbrRouterId,
          ospfSummaryId: null,
          ospfExternalSource: 'static',
          ospfExternalLsaType: nssa ? 7 : 5,
          ospfRedistributionId: rule.id,
        });
      }
    }
  }
  return bestOspfEntries(entries);
}

function ospfStubDefaultEntries(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, routerId: string): BuilderRouteTableEntry[] {
  if (!routing.ospf.enabledRouterIds.includes(routerId)) return [];
  const state = builderOspfState(graph, addressing, routing);
  if (state.abrRouterIds.includes(routerId)) return [];
  const entries: BuilderRouteTableEntry[] = [];
  for (const areaId of builderOspfAreasForRouter(graph, routing.ospf, routerId)) {
    const areaType = builderOspfAreaType(routing.ospf, areaId);
    if (areaType === 'normal') continue;
    const abrIds = builderOspfAbrRouterIds(graph, routing.ospf).filter((abrId) => builderOspfAreasForRouter(graph, routing.ospf, abrId).includes(areaId));
    for (const abrId of abrIds) {
      const path = builderOspfAreaPath(graph, routing.ospf, routerId, abrId, areaId);
      if (!path.reachable || path.firstHops.length === 0) continue;
      for (const firstHop of path.firstHops) {
        const hop = firstHopEntry(graph, addressing, routerId, firstHop.nextRouterId, firstHop.linkId);
        if (!hop) continue;
        entries.push({
          id: `ospf-default:${routerId}:${areaId}:${abrId}:${firstHop.linkId}`,
          routerId,
          prefix: '0.0.0.0/0',
          prefixLength: 0,
          source: 'ospf',
          administrativeDistance: 110,
          metric: path.totalCost + 1,
          nextHop: hop.remote.address,
          outgoingInterface: hop.local.name,
          linkId: firstHop.linkId,
          active: true,
          stateNote: `OSPF O IA · ${areaType === 'stub' ? 'STUB' : 'NSSA'} DEFAULT · ABR ${nodeById(graph, abrId)?.label ?? abrId}`,
          ospfRouteType: 'inter-area',
          ospfAreaId: areaId,
          ospfAbrRouterId: abrId,
          ospfSummaryId: null,
        });
      }
    }
  }
  return bestOspfEntries(entries);
}

function ospfRank(entry: BuilderRouteTableEntry): number {
  if (entry.source !== 'ospf') return 0;
  if (entry.ospfRouteType === 'inter-area') return 1;
  if (entry.ospfRouteType === 'external' || entry.ospfRouteType === 'nssa-external') return 2;
  return 0;
}

function bestOspfEntries(entries: BuilderRouteTableEntry[]): BuilderRouteTableEntry[] {
  const byPrefix = new Map<string, BuilderRouteTableEntry[]>();
  for (const entry of entries) byPrefix.set(entry.prefix, [...(byPrefix.get(entry.prefix) ?? []), entry]);
  const winners: BuilderRouteTableEntry[] = [];
  for (const candidates of byPrefix.values()) {
    const bestRank = Math.min(...candidates.map(ospfRank));
    const ranked = candidates.filter((entry) => ospfRank(entry) === bestRank);
    const bestMetric = Math.min(...ranked.map((entry) => entry.metric));
    const byNextHop = new Map<string, BuilderRouteTableEntry>();
    for (const entry of ranked.filter((candidate) => candidate.metric === bestMetric).sort((a, b) => a.id.localeCompare(b.id))) {
      const key = `${entry.nextHop ?? ''}\u0000${entry.linkId}`;
      if (!byNextHop.has(key)) byNextHop.set(key, entry);
    }
    const equal = [...byNextHop.values()].sort((a, b) => a.id.localeCompare(b.id));
    winners.push(...equal.map((entry) => ({ ...entry, stateNote: `${entry.stateNote}${equal.length > 1 ? ` · ECMP ${equal.length}-WAY` : ''}` })));
  }
  return winners;
}

function compareRoutePreference(left: BuilderRouteTableEntry, right: BuilderRouteTableEntry): number {
  return right.prefixLength - left.prefixLength
    || left.administrativeDistance - right.administrativeDistance
    || ospfRank(left) - ospfRank(right)
    || left.metric - right.metric
    || left.id.localeCompare(right.id);
}

export function routeTableForBuilderRouter(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, routerId: string, ospfTopologyGraph: BuilderGraph = graph): BuilderRouteTableEntry[] {
  const validated = validateBuilderRoutingConfig(graph, addressing, routing);
  const baseEntries = base.routeTableForBuilderRouter(graph, addressing, toBaseRouting(validated), routerId, ospfTopologyGraph) as BuilderRouteTableEntry[];
  return [...baseEntries, ...ospfExternalEntries(ospfTopologyGraph, addressing, validated, routerId), ...ospfStubDefaultEntries(ospfTopologyGraph, addressing, validated, routerId)].sort(compareRoutePreference);
}

export const builderStableFlowHash = base.builderStableFlowHash;

function canonicalFlowKey(flowKey: BuilderFlowKey | string | null | undefined, destinationAddress: string): string | null {
  if (flowKey == null) return null;
  if (typeof flowKey === 'string') return flowKey;
  return `${String(flowKey.protocol ?? 'ip').trim().toLowerCase() || 'ip'}|${String(flowKey.sourceAddress ?? '').trim()}|${String(flowKey.destinationAddress ?? destinationAddress).trim()}|${flowKey.sourcePort == null ? '' : String(flowKey.sourcePort)}|${flowKey.destinationPort == null ? '' : String(flowKey.destinationPort)}|${flowKey.discriminator == null ? '' : String(flowKey.discriminator)}`;
}

export function builderEcmpRoutesForDestination(entries: readonly BuilderRouteTableEntry[], destinationAddress: string): BuilderRouteTableEntry[] {
  const matches = entries.filter((entry) => entry.active && prefixContains(entry.prefix, destinationAddress)).sort(compareRoutePreference);
  const best = matches[0];
  if (!best) return [];
  return matches.filter((entry) => entry.prefix === best.prefix && entry.prefixLength === best.prefixLength && entry.administrativeDistance === best.administrativeDistance && ospfRank(entry) === ospfRank(best) && entry.metric === best.metric).sort((a, b) => a.id.localeCompare(b.id));
}

export function selectBuilderRouteWithDecision(entries: readonly BuilderRouteTableEntry[], destinationAddress: string, flowKey: BuilderFlowKey | string | null = null): BuilderRouteSelection {
  const candidates = builderEcmpRoutesForDestination(entries, destinationAddress);
  if (candidates.length === 0) return { route: null, candidates: [], flowKey: null, flowHash: null, selectedIndex: null };
  const canonical = canonicalFlowKey(flowKey, destinationAddress);
  if (candidates.length === 1 || canonical === null) return { route: candidates[0], candidates, flowKey: canonical, flowHash: null, selectedIndex: 0 };
  const flowHash = builderStableFlowHash(canonical);
  const selectedIndex = flowHash % candidates.length;
  return { route: candidates[selectedIndex], candidates, flowKey: canonical, flowHash, selectedIndex };
}

export function selectBuilderRoute(entries: readonly BuilderRouteTableEntry[], destinationAddress: string, flowKey: BuilderFlowKey | string | null = null): BuilderRouteTableEntry | null {
  return selectBuilderRouteWithDecision(entries, destinationAddress, flowKey).route;
}

function interfaceOwner(addressing: BuilderAddressing, address: string): { nodeId: string; linkId: string; interfaceName: string } | null {
  const normalized = normalizeBuilderIpv4(address);
  for (const segment of Object.values(addressing.segments)) {
    const entry = segment.interfaces.find((candidate) => candidate.address === normalized);
    if (entry) return { nodeId: entry.nodeId, linkId: segment.linkId, interfaceName: entry.name };
  }
  return null;
}

function primaryInterfaceForNode(addressing: BuilderAddressing, nodeId: string) { return interfacesForBuilderNode(addressing, nodeId)[0] ?? null; }

function forwardingFailure(sourceNodeId: string, destinationNodeId: string, destinationAddress: string | null, hops: BuilderForwardingHop[], failureNodeId: string, failureReason: string): BuilderForwardingTrace {
  return { reachable: false, sourceNodeId, destinationNodeId, destinationAddress, hops, failureNodeId, failureReason, explanation: `${failureNodeId.toUpperCase()} stopped forwarding: ${failureReason}.` };
}

export function traceBuilderForwarding(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, sourceNodeId: string, destinationNodeId: string, ospfTopologyGraph: BuilderGraph = graph, flowKey: BuilderFlowKey | string | null = null): BuilderForwardingTrace {
  const source = nodeById(graph, sourceNodeId);
  const destination = nodeById(graph, destinationNodeId);
  if (!source || !destination) return { reachable: false, sourceNodeId, destinationNodeId, destinationAddress: null, hops: [], failureNodeId: null, failureReason: 'SOURCE OR DESTINATION DOES NOT EXIST', explanation: 'Choose source and destination devices that still exist in the topology.' };
  if (sourceNodeId === destinationNodeId) return { reachable: true, sourceNodeId, destinationNodeId, destinationAddress: primaryInterfaceForNode(addressing, destinationNodeId)?.address ?? null, hops: [], failureNodeId: null, failureReason: null, explanation: 'Source and destination are the same device.' };
  const destinationInterface = primaryInterfaceForNode(addressing, destinationNodeId);
  if (!destinationInterface) return forwardingFailure(sourceNodeId, destinationNodeId, null, [], destinationNodeId, 'DESTINATION HAS NO IPV4 INTERFACE');
  const destinationAddress = destinationInterface.address;
  const hops: BuilderForwardingHop[] = [];
  const visited = new Set<string>();
  let currentNodeId = sourceNodeId;
  for (let hopIndex = 0; hopIndex <= graph.nodes.length + 1; hopIndex += 1) {
    if (currentNodeId === destinationNodeId) return { reachable: true, sourceNodeId, destinationNodeId, destinationAddress, hops, failureNodeId: null, failureReason: null, explanation: `${source.label} reaches ${destination.label} at ${destinationAddress} in ${hops.length} forwarding hop${hops.length === 1 ? '' : 's'}.` };
    if (visited.has(currentNodeId)) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'FORWARDING LOOP');
    visited.add(currentNodeId);
    const current = nodeById(graph, currentNodeId);
    if (!current) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'DEVICE DISAPPEARED');
    if (current.kind === 'endpoint') {
      const interfaces = interfacesForBuilderNode(addressing, currentNodeId);
      const direct = interfaces.find((entry) => prefixContains(entry.cidr, destinationAddress));
      if (direct) {
        const link = linkById(graph, direct.linkId);
        const owner = interfaceOwner(addressing, destinationAddress);
        if (!link || link.failed) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'DIRECT LINK DOWN');
        if (!owner || owner.linkId !== direct.linkId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'DESTINATION NOT PRESENT ON DIRECT SEGMENT');
        hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: 'endpoint-local', matchedPrefix: direct.cidr, nextHop: destinationAddress, outgoingInterface: direct.name, linkId: direct.linkId, nextNodeId: owner.nodeId });
        currentNodeId = owner.nodeId;
        continue;
      }
      const gateway = addressing.defaultGateways[currentNodeId] ?? null;
      if (!gateway) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'NO DEFAULT GATEWAY');
      const owner = interfaceOwner(addressing, gateway);
      const localAttachment = owner ? interfaces.find((entry) => entry.linkId === owner.linkId) : null;
      const link = owner ? linkById(graph, owner.linkId) : null;
      if (!owner || !localAttachment) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'DEFAULT GATEWAY IS NOT DIRECTLY CONNECTED');
      if (!link || link.failed) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'DEFAULT GATEWAY LINK DOWN');
      hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: 'default-gateway', matchedPrefix: '0.0.0.0/0', nextHop: gateway, outgoingInterface: localAttachment.name, linkId: owner.linkId, nextNodeId: owner.nodeId });
      currentNodeId = owner.nodeId;
      continue;
    }
    const selection = selectBuilderRouteWithDecision(routeTableForBuilderRouter(graph, addressing, routing, currentNodeId, ospfTopologyGraph), destinationAddress, flowKey);
    const selected = selection.route;
    if (!selected) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'NO MATCHING ROUTE');
    let nextNodeId: string | null = null;
    let nextHop: string | null = selected.nextHop;
    if (selected.source === 'connected') {
      const owner = interfaceOwner(addressing, destinationAddress);
      if (!owner || owner.linkId !== selected.linkId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'CONNECTED PREFIX HAS NO DESTINATION NEIGHBOR');
      nextNodeId = owner.nodeId;
      nextHop = destinationAddress;
    } else {
      const owner = selected.nextHop ? interfaceOwner(addressing, selected.nextHop) : null;
      if (!owner || owner.linkId !== selected.linkId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, selected.source === 'static' ? 'STATIC NEXT HOP INVALID' : selected.source === 'bgp' ? 'BGP NEXT HOP INVALID' : 'OSPF NEXT HOP INVALID');
      nextNodeId = owner.nodeId;
    }
    const link = linkById(graph, selected.linkId);
    if (!link || link.failed) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'OUTGOING LINK DOWN');
    hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: selected.source, matchedPrefix: selected.prefix, nextHop, outgoingInterface: selected.outgoingInterface, linkId: selected.linkId, nextNodeId, ecmpCandidateCount: selection.candidates.length, ecmpSelectedIndex: selection.selectedIndex, ecmpFlowHash: selection.flowHash, ecmpFlowKey: selection.flowKey });
    if (!nextNodeId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'NEXT HOP HAS NO DEVICE');
    currentNodeId = nextNodeId;
  }
  return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'HOP LIMIT EXCEEDED');
}

export const nextHopOptionsForBuilderRouter = base.nextHopOptionsForBuilderRouter;

export function installStaticRoutesForWeightedPath(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, sourceNodeId: string, destinationNodeId: string): BuilderStaticPathInstallResult {
  const result = base.installStaticRoutesForWeightedPath(graph, addressing, toBaseRouting(routing), sourceNodeId, destinationNodeId);
  return { ...result, routing: reconcileBuilderRoutingConfig(graph, addressing, { ...result.routing, ospf: { ...result.routing.ospf, areaTypes: routing.ospf.areaTypes ?? {}, redistributions: routing.ospf.redistributions ?? [] } }) };
}

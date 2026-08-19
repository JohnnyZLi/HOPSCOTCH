import { interfacesForBuilderNode, normalizeBuilderIpv4, parseBuilderIpv4Cidr, type BuilderAddressing } from './addressing.ts';
import type { BuilderBgpConfig } from './bgp.ts';
import type { BuilderGraph } from './model.ts';
import { builderBgpState, cloneBuilderBgpConfig } from './bgp.ts';
import { builderIsisRouteEntriesForRouter, builderIsisState, type BuilderIsisInjectedRoute } from './isis.ts';
import {
  builderCanonicalEcmpKey,
  builderEcmpProfile,
  builderOspfEffectiveGraph,
  builderOspfTimerCompatible,
  builderPbrDecision,
  builderPolicyPrefixContainsPrefix,
  cloneBuilderRoutingPolicyConfig,
  createDefaultBuilderRoutingPolicyConfig,
  reconcileBuilderRoutingPolicyConfig,
  validateBuilderRoutingPolicyConfig,
  type BuilderRoutingPolicyConfig,
  type BuilderRedistributionSource,
} from './routing-policy.ts';
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
export type BuilderRouteSource = base.BuilderRouteSource | 'isis' | 'summary';
export interface BuilderForwardingHop extends Omit<base.BuilderForwardingHop,'routeSource'> {
  routeSource: 'endpoint-local' | 'default-gateway' | BuilderRouteSource;
  fibRouteSource?: BuilderRouteSource; fibMatchedPrefix?: string | null; fibNextHop?: string | null;
  pbrRuleId?: string | null; pbrNextHop?: string | null; ecmpHashMode?: 'l3'|'l4'|'full';
}
export interface BuilderForwardingTrace extends Omit<base.BuilderForwardingTrace,'hops'> { hops: BuilderForwardingHop[] }
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
  policy: BuilderRoutingPolicyConfig;
}

export interface BuilderRouteTableEntry extends Omit<base.BuilderRouteTableEntry, 'ospfRouteType' | 'source'> {
  source: BuilderRouteSource;
  ospfRouteType?: 'intra-area' | 'inter-area' | 'external' | 'nssa-external';
  ospfExternalSource?: 'static';
  ospfExternalLsaType?: 5 | 7;
  ospfRedistributionId?: string | null;
  redistributedFrom?: BuilderRedistributionSource | 'summary';
  redistributionRuleId?: string | null;
  routeTag?: number;
  summaryDiscard?: boolean;
  summarySource?: BuilderRedistributionSource;
  summaryId?: string | null;
  isisLevel?: 'L1' | 'L2';
  isisAreaId?: string;
  isisOriginRouterId?: string;
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
  return { ...result, ospf: { ...result.ospf, areaTypes: {}, redistributions: [] }, policy: createDefaultBuilderRoutingPolicyConfig() };
}

export function validateBuilderRoutingConfig(graph: BuilderGraph, addressing: BuilderAddressing, value: BuilderRoutingConfig): BuilderRoutingConfig {
  const baseRouting = base.validateBuilderRoutingConfig(graph, addressing, toBaseRouting(value));
  const extensions = validateOspfExtensions(graph, baseRouting, value.ospf ?? { enabledRouterIds: [] });
  return {
    ...baseRouting,
    ospf: { ...baseRouting.ospf, areaTypes: extensions.areaTypes, redistributions: extensions.redistributions },
    policy: validateBuilderRoutingPolicyConfig(graph,addressing,value.policy),
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
    policy: cloneBuilderRoutingPolicyConfig(value.policy),
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
  return validateBuilderRoutingConfig(graph, addressing, { ...reconciled, ospf: { ...reconciled.ospf, areaTypes, redistributions }, policy: reconcileBuilderRoutingPolicyConfig(graph,addressing,current.policy) });
}

function preserveExtensions(graph: BuilderGraph, addressing: BuilderAddressing, result: base.BuilderRoutingConfig, source: BuilderRoutingConfig, redistributions = source.ospf?.redistributions ?? []): BuilderRoutingConfig {
  return validateBuilderRoutingConfig(graph, addressing, {
    ...result,
    ospf: {
      ...result.ospf,
      areaTypes: { ...(source.ospf?.areaTypes ?? {}) },
      redistributions: redistributions.map((entry) => ({ ...entry })),
    },
    policy: cloneBuilderRoutingPolicyConfig(source.policy),
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
  return reconcileBuilderRoutingConfig(graph, addressing, { ...result, ospf: { ...result.ospf, areaTypes: routing.ospf.areaTypes ?? {}, redistributions: routing.ospf.redistributions ?? [] }, policy: cloneBuilderRoutingPolicyConfig(routing.policy) });
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
  return reconcileBuilderRoutingConfig(graph, addressing, { ...result, ospf: { ...result.ospf, areaTypes: routing.ospf.areaTypes ?? {}, redistributions: routing.ospf.redistributions ?? [] }, policy: cloneBuilderRoutingPolicyConfig(routing.policy) });
}

export function deleteBuilderStaticRoute(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, routeId: string): BuilderRoutingConfig {
  const result = base.deleteBuilderStaticRoute(graph, addressing, toBaseRouting(routing), routeId);
  return reconcileBuilderRoutingConfig(graph, addressing, { ...result, ospf: { ...result.ospf, areaTypes: routing.ospf.areaTypes ?? {}, redistributions: routing.ospf.redistributions ?? [] }, policy: cloneBuilderRoutingPolicyConfig(routing.policy) });
}

export function builderOspfState(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig): BuilderOspfState {
  const effective=builderOspfEffectiveGraph(graph,routing.policy,routing.ospf.enabledRouterIds);
  const state=base.builderOspfState(effective,addressing,toBaseRouting(routing));
  return {...state,adjacencies:state.adjacencies.map((adj)=>{const physical=graph.links.find((link)=>link.id===adj.linkId);if(physical&&!physical.failed&&!builderOspfTimerCompatible(routing.policy,adj.aRouterId,adj.bRouterId,adj.linkId))return{...adj,state:'DOWN' as const,reason:'HELLO/DEAD TIMER MISMATCH'};return adj;})};
}

export function setBuilderRoutingPolicyConfig(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,policy:BuilderRoutingPolicyConfig):BuilderRoutingConfig{
  return validateBuilderRoutingConfig(graph,addressing,{...cloneBuilderRoutingConfig(routing),policy});
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

function nativePolicyRoutes(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,routerId:string,source:BuilderRedistributionSource,ospfGraph:BuilderGraph):BuilderRouteTableEntry[]{
  if(source==='connected'||source==='static'||source==='ospf')return (base.routeTableForBuilderRouter(ospfGraph,addressing,toBaseRouting(routing),routerId,ospfGraph) as BuilderRouteTableEntry[]).filter((entry)=>entry.source===source);
  if(source==='bgp'){const state=builderBgpState(graph,addressing,routing.bgp);return state.bestRoutes.filter((route)=>route.routerId===routerId&&route.learnedVia!=='local').map((route)=>({id:`policy-bgp:${route.id}`,routerId,prefix:route.prefix,prefixLength:Number(route.prefix.split('/')[1]),source:'bgp' as const,administrativeDistance:route.learnedVia==='ebgp'?20:200,metric:route.asPath.length*1000+route.med,nextHop:route.nextHopAddress,outgoingInterface:'—',linkId:'—',active:true,stateNote:'NATIVE BGP BEST · REDISTRIBUTION SOURCE'}));}
  return builderIsisRouteEntriesForRouter(graph,addressing,routing.policy.isis,routerId).map((entry)=>({...entry,source:'isis' as const}));
}
function matchingNativePolicyRoutes(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,routerId:string,source:BuilderRedistributionSource,prefix:string,ospfGraph:BuilderGraph){return nativePolicyRoutes(graph,addressing,routing,routerId,source,ospfGraph).filter((entry)=>entry.active&&builderPolicyPrefixContainsPrefix(prefix,entry.prefix));}
function summaryActive(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,summary:BuilderRoutingPolicyConfig['summaries'][number],ospfGraph:BuilderGraph){return matchingNativePolicyRoutes(graph,addressing,routing,summary.routerId,summary.source,summary.prefix,ospfGraph).some((entry)=>entry.prefix!==summary.prefix);}
function effectiveBgpConfig(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,ospfGraph:BuilderGraph):BuilderBgpConfig{
  const bgp=cloneBuilderBgpConfig(routing.bgp);for(const rule of routing.policy.redistributions.filter((entry)=>entry.enabled&&entry.target==='bgp'))for(const route of matchingNativePolicyRoutes(graph,addressing,routing,rule.routerId,rule.source,rule.prefix,ospfGraph)){const id=`trackf-redist-bgp:${rule.id}:${route.prefix}`.replaceAll('/','_');if(!bgp.origins.some((entry)=>entry.id===id))bgp.origins.push({id,routerId:rule.routerId,prefix:route.prefix,med:rule.metric,communities:[`65000:${rule.routeTag}`],description:`REDISTRIBUTED ${rule.source.toUpperCase()} · RULE ${rule.id}`});if(!bgp.enabledRouterIds.includes(rule.routerId))bgp.enabledRouterIds.push(rule.routerId);}
  for(const summary of routing.policy.summaries.filter((entry)=>entry.advertiseInto==='bgp'&&summaryActive(graph,addressing,routing,entry,ospfGraph))){const id=`trackf-summary-bgp:${summary.id}`;if(!bgp.origins.some((entry)=>entry.id===id))bgp.origins.push({id,routerId:summary.routerId,prefix:summary.prefix,med:summary.metric,communities:['65000:999'],description:`SUMMARY ${summary.id}`});if(!bgp.enabledRouterIds.includes(summary.routerId))bgp.enabledRouterIds.push(summary.routerId);}
  return bgp;
}
function summaryDiscardEntries(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,routerId:string,ospfGraph:BuilderGraph):BuilderRouteTableEntry[]{return routing.policy.summaries.filter((entry)=>entry.routerId===routerId&&entry.discard&&summaryActive(graph,addressing,routing,entry,ospfGraph)).map((entry)=>({id:`summary-discard:${entry.id}`,routerId,prefix:entry.prefix,prefixLength:Number(entry.prefix.split('/')[1]),source:'summary',administrativeDistance:254,metric:entry.metric,nextHop:null,outgoingInterface:'Null0',linkId:'discard',active:true,stateNote:`INTENTIONAL SUMMARY DISCARD · SOURCE ${entry.source.toUpperCase()} · ${entry.description||entry.id}`,summaryDiscard:true,summarySource:entry.source,summaryId:entry.id}));}
function generalOspfExternalEntries(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,routerId:string):BuilderRouteTableEntry[]{
  if(!routing.ospf.enabledRouterIds.includes(routerId))return[];const entries:BuilderRouteTableEntry[]=[];for(const rule of routing.policy.redistributions.filter((entry)=>entry.enabled&&entry.target==='ospf')){const areas=builderOspfAreasForRouter(graph,routing.ospf,rule.routerId).filter((area)=>builderOspfAreaType(routing.ospf,area)!=='stub').sort();const areaId=areas[0];if(!areaId)continue;for(const sourceRoute of matchingNativePolicyRoutes(graph,addressing,routing,rule.routerId,rule.source,rule.prefix,graph)){if(rule.routerId===routerId)continue;const paths=builderOspfPathCandidates(graph,routing.ospf,routerId,rule.routerId,areaId);for(const path of paths){if(!path.reachable)continue;for(const firstHop of path.firstHops){const hop=firstHopEntry(graph,addressing,routerId,firstHop.nextRouterId,firstHop.linkId);if(!hop)continue;const nssa=builderOspfAreaType(routing.ospf,areaId)==='nssa'&&path.routeType==='intra-area';entries.push({id:`ospf-redist-general:${routerId}:${rule.id}:${sourceRoute.prefix}:${firstHop.linkId}`.replaceAll('/','_'),routerId,prefix:sourceRoute.prefix,prefixLength:sourceRoute.prefixLength,source:'ospf',administrativeDistance:110,metric:path.totalCost+rule.metric,nextHop:hop.remote.address,outgoingInterface:hop.local.name,linkId:firstHop.linkId,active:true,stateNote:`${nssa?'OSPF O N1 · TYPE-7 NSSA':'OSPF O E1 · TYPE-5 EXTERNAL'} · REDISTRIBUTED ${rule.source.toUpperCase()} · TAG ${rule.routeTag}`,ospfRouteType:nssa?'nssa-external':'external',ospfAreaId:areaId,ospfAbrRouterId:path.destinationAbrRouterId,ospfSummaryId:null,ospfExternalLsaType:nssa?7:5,redistributedFrom:rule.source,redistributionRuleId:rule.id,routeTag:rule.routeTag});}}}}
  for(const summary of routing.policy.summaries.filter((entry)=>entry.advertiseInto==='ospf'&&summaryActive(graph,addressing,routing,entry,graph))){if(summary.routerId===routerId)continue;const areaId=builderOspfAreasForRouter(graph,routing.ospf,summary.routerId).filter((area)=>builderOspfAreaType(routing.ospf,area)!=='stub').sort()[0];if(!areaId)continue;for(const path of builderOspfPathCandidates(graph,routing.ospf,routerId,summary.routerId,areaId)){for(const firstHop of path.firstHops){const hop=firstHopEntry(graph,addressing,routerId,firstHop.nextRouterId,firstHop.linkId);if(!hop)continue;entries.push({id:`ospf-summary:${routerId}:${summary.id}:${firstHop.linkId}`,routerId,prefix:summary.prefix,prefixLength:Number(summary.prefix.split('/')[1]),source:'ospf',administrativeDistance:110,metric:path.totalCost+summary.metric,nextHop:hop.remote.address,outgoingInterface:hop.local.name,linkId:firstHop.linkId,active:true,stateNote:`OSPF SUMMARY · ORIGIN ${summary.routerId.toUpperCase()} · DISCARD AT ORIGIN`,ospfRouteType:'external',ospfAreaId:areaId,ospfExternalLsaType:5,redistributedFrom:'summary',summaryId:summary.id});}}}
  return bestOspfEntries(entries);
}
function isisInjectedRoutes(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,ospfGraph:BuilderGraph):BuilderIsisInjectedRoute[]{const result:BuilderIsisInjectedRoute[]=[];for(const rule of routing.policy.redistributions.filter((entry)=>entry.enabled&&entry.target==='isis'))for(const route of matchingNativePolicyRoutes(graph,addressing,routing,rule.routerId,rule.source,rule.prefix,ospfGraph))result.push({id:`isis-inject:${rule.id}:${route.prefix}`,originRouterId:rule.routerId,prefix:route.prefix,metric:rule.metric,source:rule.source,routeTag:rule.routeTag,redistributionRuleId:rule.id,summaryId:null});for(const summary of routing.policy.summaries.filter((entry)=>entry.advertiseInto==='isis'&&summaryActive(graph,addressing,routing,entry,ospfGraph)))result.push({id:`isis-summary:${summary.id}`,originRouterId:summary.routerId,prefix:summary.prefix,metric:summary.metric,source:'summary',routeTag:999,redistributionRuleId:null,summaryId:summary.id});return result;}

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
  const validated=validateBuilderRoutingConfig(graph,addressing,routing);const effectiveOspf=builderOspfEffectiveGraph(ospfTopologyGraph,validated.policy,validated.ospf.enabledRouterIds);const bgp=effectiveBgpConfig(graph,addressing,validated,effectiveOspf);const baseRouting={...toBaseRouting(validated),bgp};const baseEntries=base.routeTableForBuilderRouter(graph,addressing,baseRouting,routerId,effectiveOspf) as BuilderRouteTableEntry[];const isis=builderIsisRouteEntriesForRouter(graph,addressing,validated.policy.isis,routerId,isisInjectedRoutes(graph,addressing,validated,effectiveOspf)).map((entry)=>({...entry,source:'isis' as const}));return [...baseEntries,...ospfExternalEntries(effectiveOspf,addressing,validated,routerId),...generalOspfExternalEntries(effectiveOspf,addressing,validated,routerId),...ospfStubDefaultEntries(effectiveOspf,addressing,validated,routerId),...isis,...summaryDiscardEntries(graph,addressing,validated,routerId,effectiveOspf)].sort(compareRoutePreference);
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
  const candidates = builderEcmpRoutesForDestination(entries, destinationAddress).slice(0,Math.max(1,Math.min(16,arguments.length>3?Number(arguments[3])||16:16)));
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
    const packetKey={sourceAddress:primaryInterfaceForNode(addressing,sourceNodeId)?.address??'0.0.0.0',destinationAddress,protocol:typeof flowKey==='object'&&flowKey?String(flowKey.protocol??'ip'):'ip',sourcePort:typeof flowKey==='object'&&flowKey&&flowKey.sourcePort!=null?flowKey.sourcePort:null,destinationPort:typeof flowKey==='object'&&flowKey&&flowKey.destinationPort!=null?flowKey.destinationPort:null};
    const ecmp=builderEcmpProfile(routing.policy,currentNodeId);const discriminator=typeof flowKey==='object'&&flowKey?flowKey.discriminator??null:typeof flowKey==='string'?flowKey:null;const hashedKey=builderCanonicalEcmpKey(ecmp.hashMode,packetKey,discriminator);
    const selection = selectBuilderRouteWithDecision(routeTableForBuilderRouter(graph, addressing, routing, currentNodeId, ospfTopologyGraph), destinationAddress, hashedKey,ecmp.maxPaths);
    const selected = selection.route;
    if (!selected) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'NO MATCHING ROUTE');
    let nextNodeId: string | null = null;
    let nextHop: string | null = selected.nextHop;
    let actualLinkId=selected.linkId;let actualOutgoingInterface=selected.outgoingInterface;const pbr=builderPbrDecision(routing.policy,currentNodeId,packetKey);
    if(pbr.matched&&pbr.rule){const owner=interfaceOwner(addressing,pbr.rule.nextHop);const local=owner?addressing.segments[owner.linkId]?.interfaces.find((entry)=>entry.nodeId===currentNodeId):null;if(!owner||!local)return forwardingFailure(sourceNodeId,destinationNodeId,destinationAddress,hops,currentNodeId,'PBR NEXT HOP INVALID');nextNodeId=owner.nodeId;nextHop=pbr.rule.nextHop;actualLinkId=owner.linkId;actualOutgoingInterface=local.name;}
    else if(selected.source==='summary'&&selected.summaryDiscard)return forwardingFailure(sourceNodeId,destinationNodeId,destinationAddress,hops,currentNodeId,'INTENTIONAL SUMMARY BLACK HOLE');
    if (!pbr.matched && selected.source === 'connected') {
      const owner = interfaceOwner(addressing, destinationAddress);
      if (!owner || owner.linkId !== selected.linkId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, 'CONNECTED PREFIX HAS NO DESTINATION NEIGHBOR');
      nextNodeId = owner.nodeId;
      nextHop = destinationAddress;
    } else if(!pbr.matched) {
      const owner = selected.nextHop ? interfaceOwner(addressing, selected.nextHop) : null;
      if (!owner || owner.linkId !== selected.linkId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, selected.source === 'static' ? 'STATIC NEXT HOP INVALID' : selected.source === 'bgp' ? 'BGP NEXT HOP INVALID' : 'OSPF NEXT HOP INVALID');
      nextNodeId = owner.nodeId;
    }
    const link=linkById(graph,actualLinkId);if(!link||link.failed)return forwardingFailure(sourceNodeId,destinationNodeId,destinationAddress,hops,currentNodeId,pbr.matched?'PBR NEXT-HOP LINK DOWN':'OUTGOING LINK DOWN');
    hops.push({nodeId:currentNodeId,nodeLabel:current.label,routeSource:selected.source,matchedPrefix:selected.prefix,nextHop,outgoingInterface:actualOutgoingInterface,linkId:actualLinkId,nextNodeId,ecmpCandidateCount:selection.candidates.length,ecmpSelectedIndex:selection.selectedIndex,ecmpFlowHash:selection.flowHash,ecmpFlowKey:selection.flowKey,ecmpHashMode:ecmp.hashMode,fibRouteSource:selected.source,fibMatchedPrefix:selected.prefix,fibNextHop:selected.nextHop,pbrRuleId:pbr.rule?.id??null,pbrNextHop:pbr.rule?.nextHop??null});
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

from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,text):
    p=ROOT/path; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(text,encoding='utf-8')
def replace_once(path,old,new):
    text=read(path); count=text.count(old)
    if count!=1: raise SystemExit(f'{path}: expected one match, found {count}: {old[:100]!r}')
    write(path,text.replace(old,new,1))
def regex_once(path,pattern,replacement):
    text=read(path); next_text,count=re.subn(pattern,lambda _m:replacement,text,count=1)
    if count!=1: raise SystemExit(f'{path}: expected one regex match, found {count}: {pattern[:120]!r}')
    write(path,next_text)

# Make configured area membership independent of runtime OSPF enablement so disabling OSPF does not destroy authored summaries.
areas='src/builder/ospf-areas.ts'
replace_once(areas,"export function builderOspfAreasForRouter(graph: BuilderGraph, config: BuilderOspfAreaConfigLike, routerId: string): string[] {\n  if (!config.enabledRouterIds.includes(routerId) || !nodeIsRouter(graph, routerId)) return [];\n  return [...new Set(graph.links.filter((link) => link.a === routerId || link.b === routerId).map((link) => builderOspfAreaForLink(config, link.id)))].sort();\n}\n", "function configuredAreasForRouter(graph: BuilderGraph, config: BuilderOspfAreaConfigLike, routerId: string): string[] {\n  if (!nodeIsRouter(graph, routerId)) return [];\n  return [...new Set(graph.links.filter((link) => link.a === routerId || link.b === routerId).map((link) => builderOspfAreaForLink(config, link.id)))].sort();\n}\n\nexport function builderOspfAreasForRouter(graph: BuilderGraph, config: BuilderOspfAreaConfigLike, routerId: string): string[] {\n  if (!config.enabledRouterIds.includes(routerId)) return [];\n  return configuredAreasForRouter(graph, config, routerId);\n}\n")
replace_once(areas,"  const abrIds = new Set(builderOspfAbrRouterIds(graph, normalizedConfig));\n  const enabled = new Set(config.enabledRouterIds);", "  const configuredAbrIds = new Set(graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id).filter((routerId) => { const areas = configuredAreasForRouter(graph, normalizedConfig, routerId); return areas.includes(BUILDER_OSPF_BACKBONE_AREA) && areas.some((areaId) => areaId !== BUILDER_OSPF_BACKBONE_AREA); }));")
replace_once(areas,"    if (!enabled.has(abrRouterId) || !abrIds.has(abrRouterId)) throw new Error(`OSPF summary ${id} must belong to an enabled ABR attached to Area 0.`);", "    if (!configuredAbrIds.has(abrRouterId)) throw new Error(`OSPF summary ${id} must belong to a configured ABR attached to Area 0 and a non-backbone area.`);")
replace_once(areas,"    if (!builderOspfAreasForRouter(graph, normalizedConfig, abrRouterId).includes(fromAreaId)) throw new Error(`OSPF summary ${id} ABR ${abrRouterId} is not attached to ${fromAreaId}.`);", "    if (!configuredAreasForRouter(graph, normalizedConfig, abrRouterId).includes(fromAreaId)) throw new Error(`OSPF summary ${id} ABR ${abrRouterId} is not attached to ${fromAreaId}.`);")
replace_once(areas,"  const provisional: BuilderOspfAreaConfigLike = { ...config, linkAreas, summaries: [] };\n  const abrIds = new Set(builderOspfAbrRouterIds(graph, provisional));\n  const summaries = (config.summaries ?? []).filter((summary) => abrIds.has(summary.abrRouterId) && builderOspfAreasForRouter(graph, provisional, summary.abrRouterId).includes(normalizeBuilderOspfAreaId(summary.fromAreaId)));", "  const provisional: BuilderOspfAreaConfigLike = { ...config, linkAreas, summaries: [] };\n  const summaries = (config.summaries ?? []).filter((summary) => { const areas = configuredAreasForRouter(graph, provisional, summary.abrRouterId); return areas.includes(BUILDER_OSPF_BACKBONE_AREA) && areas.includes(normalizeBuilderOspfAreaId(summary.fromAreaId)); });")

routing='src/builder/routing.ts'
replace_once(routing,"import { findShortestPath, type BuilderGraph } from './model.ts';", "import { findShortestPath, type BuilderGraph } from './model.ts';\nimport {\n  BUILDER_OSPF_BACKBONE_AREA,\n  builderOspfAbrRouterIds,\n  builderOspfAreaComponents,\n  builderOspfAreaForLink,\n  builderOspfAreasForRouter,\n  builderOspfPathCandidates,\n  builderOspfPrefixContains,\n  normalizeBuilderOspfAreaId,\n  reconcileBuilderOspfAreaConfig,\n  validateBuilderOspfAreaConfig,\n  type BuilderOspfSummary,\n} from './ospf-areas.ts';\nexport type { BuilderOspfSummary } from './ospf-areas.ts';")
replace_once(routing,"export interface BuilderOspfConfig {\n  enabledRouterIds: string[];\n}\n", "export interface BuilderOspfConfig {\n  enabledRouterIds: string[];\n  linkAreas?: Record<string, string>;\n  summaries?: BuilderOspfSummary[];\n}\n")
replace_once(routing,"  stateNote: string;\n}\n", "  stateNote: string;\n  ospfRouteType?: 'intra-area' | 'inter-area';\n  ospfAreaId?: string;\n  ospfAbrRouterId?: string | null;\n  ospfSummaryId?: string | null;\n}\n")
replace_once(routing,"export interface BuilderOspfAdjacency {\n  id: string;\n  linkId: string;", "export interface BuilderOspfAdjacency {\n  id: string;\n  linkId: string;\n  areaId: string;")
replace_once(routing,"export interface BuilderOspfAdvertisement {\n  id: string;\n  routerId: string;", "export interface BuilderOspfAdvertisement {\n  id: string;\n  routerId: string;\n  areaId: string;")
replace_once(routing,"export interface BuilderOspfState {\n  areaId: '0.0.0.0';\n  enabledRouterIds: string[];", "export interface BuilderOspfState {\n  areaId: '0.0.0.0';\n  areaIds: string[];\n  enabledRouterIds: string[];\n  abrRouterIds: string[];\n  areaComponents: Record<string, string[][]>;")
# Old single-area path helper is replaced by area-aware helper module.
replace_once(routing,"export function createDefaultBuilderRoutingConfig(): BuilderRoutingConfig {\n  return { staticRoutes: [], ospf: { enabledRouterIds: [] } };\n}", "export function createDefaultBuilderRoutingConfig(): BuilderRoutingConfig {\n  return { staticRoutes: [], ospf: { enabledRouterIds: [], linkAreas: {}, summaries: [] } };\n}")
replace_once(routing,"  return { staticRoutes, ospf: { enabledRouterIds } };", "  const areaConfig = validateBuilderOspfAreaConfig(graph, { ...(value.ospf ?? { enabledRouterIds }), enabledRouterIds });\n  return { staticRoutes, ospf: { enabledRouterIds, linkAreas: areaConfig.linkAreas, summaries: areaConfig.summaries } };")
replace_once(routing,"    ospf: { enabledRouterIds: [...(value.ospf?.enabledRouterIds ?? [])] },", "    ospf: { enabledRouterIds: [...(value.ospf?.enabledRouterIds ?? [])], linkAreas: { ...(value.ospf?.linkAreas ?? {}) }, summaries: (value.ospf?.summaries ?? []).map((summary) => ({ ...summary })) },")
replace_once(routing,"  const enabledRouterIds = (current.ospf?.enabledRouterIds ?? []).filter((routerId) => nodeById(graph, routerId)?.kind === 'router');\n  return validateBuilderRoutingConfig(graph, addressing, { staticRoutes: [...unique.values()], ospf: { enabledRouterIds } });", "  const enabledRouterIds = (current.ospf?.enabledRouterIds ?? []).filter((routerId) => nodeById(graph, routerId)?.kind === 'router');\n  const areaConfig = reconcileBuilderOspfAreaConfig(graph, { ...(current.ospf ?? { enabledRouterIds }), enabledRouterIds });\n  return validateBuilderRoutingConfig(graph, addressing, { staticRoutes: [...unique.values()], ospf: { enabledRouterIds, linkAreas: areaConfig.linkAreas, summaries: areaConfig.summaries } });")
replace_once(routing,"  return validateBuilderRoutingConfig(graph, addressing, { ...cloneBuilderRoutingConfig(routing), ospf: { enabledRouterIds: [...ids] } });", "  const next = cloneBuilderRoutingConfig(routing);\n  next.ospf.enabledRouterIds = [...ids];\n  return validateBuilderRoutingConfig(graph, addressing, next);")
replace_once(routing,"    ospf: { enabledRouterIds: enabled ? graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id) : [] },", "    ospf: { ...(routing.ospf ?? {}), enabledRouterIds: enabled ? graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id) : [] },")
# Add authoring mutations before builderOspfState.
replace_once(routing,"export function builderOspfState(\n", r'''export function setBuilderOspfLinkArea(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  linkId: string,
  areaId: string,
): BuilderRoutingConfig {
  if (!linkById(graph, linkId)) throw new Error(`Unknown Builder link ${linkId}.`);
  const normalizedAreaId = normalizeBuilderOspfAreaId(areaId);
  const next = cloneBuilderRoutingConfig(routing);
  const linkAreas = { ...(next.ospf.linkAreas ?? {}) };
  if (normalizedAreaId === BUILDER_OSPF_BACKBONE_AREA) delete linkAreas[linkId];
  else linkAreas[linkId] = normalizedAreaId;
  next.ospf.linkAreas = linkAreas;
  return validateBuilderRoutingConfig(graph, addressing, next);
}

export function upsertBuilderOspfSummary(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  summary: Omit<BuilderOspfSummary, 'id'> & { id?: string },
): BuilderRoutingConfig {
  const fromAreaId = normalizeBuilderOspfAreaId(summary.fromAreaId);
  const prefix = parseRoutePrefix(summary.prefix).cidr;
  const id = summary.id?.trim() || `ospf-summary:${summary.abrRouterId}:${fromAreaId}:${prefix}`.replace(/\//g, ':');
  const next = cloneBuilderRoutingConfig(routing);
  next.ospf.summaries = [...(next.ospf.summaries ?? []).filter((entry) => entry.id !== id && !(entry.abrRouterId === summary.abrRouterId && entry.fromAreaId === fromAreaId && entry.prefix === prefix)), { id, abrRouterId: summary.abrRouterId, fromAreaId, prefix, metric: summary.metric, description: summary.description }];
  return validateBuilderRoutingConfig(graph, addressing, next);
}

export function deleteBuilderOspfSummary(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  summaryId: string,
): BuilderRoutingConfig {
  const next = cloneBuilderRoutingConfig(routing);
  next.ospf.summaries = (next.ospf.summaries ?? []).filter((summary) => summary.id !== summaryId);
  return validateBuilderRoutingConfig(graph, addressing, next);
}

export function builderOspfState(
''')
# Replace state builder wholesale.
regex_once(routing,r"export function builderOspfState\([\s\S]*?\n}\n\nfunction ospfRouteEntriesForBuilderRouter", r'''export function builderOspfState(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
): BuilderOspfState {
  const validated = validateBuilderRoutingConfig(graph, addressing, routing);
  const enabled = enabledOspfSet(validated);
  const enabledRouterIds = [...enabled].filter((routerId) => nodeById(graph, routerId)?.kind === 'router').sort();
  const adjacencies: BuilderOspfAdjacency[] = [];
  for (const link of graph.links) {
    if (!enabled.has(link.a) || !enabled.has(link.b)) continue;
    if (nodeById(graph, link.a)?.kind !== 'router' || nodeById(graph, link.b)?.kind !== 'router') continue;
    const areaId = builderOspfAreaForLink(validated.ospf, link.id);
    adjacencies.push({
      id: `ospf-adj:${link.id}`,
      linkId: link.id,
      areaId,
      aRouterId: link.a,
      bRouterId: link.b,
      cost: link.cost,
      state: link.failed ? 'DOWN' : 'FULL',
      reason: link.failed ? 'LINK DOWN' : `${areaId} ADJACENCY`,
    });
  }
  adjacencies.sort((a, b) => a.areaId.localeCompare(b.areaId) || a.linkId.localeCompare(b.linkId));

  const advertisements: BuilderOspfAdvertisement[] = [];
  for (const routerId of enabledRouterIds) {
    for (const entry of interfacesForBuilderNode(addressing, routerId)) {
      const link = linkById(graph, entry.linkId);
      if (!link || link.failed) continue;
      advertisements.push({
        id: `ospf-lsa:${routerId}:${entry.linkId}`,
        routerId,
        areaId: builderOspfAreaForLink(validated.ospf, entry.linkId),
        prefix: parseBuilderIpv4Cidr(entry.cidr).cidr,
        linkId: entry.linkId,
        metric: link.cost,
      });
    }
  }
  advertisements.sort((a, b) => a.areaId.localeCompare(b.areaId) || a.routerId.localeCompare(b.routerId) || a.prefix.localeCompare(b.prefix) || a.linkId.localeCompare(b.linkId));

  const fullAdjacency = adjacencies.filter((adjacency) => adjacency.state === 'FULL');
  const adjacencyByRouter = new Map<string, string[]>();
  for (const routerId of enabledRouterIds) adjacencyByRouter.set(routerId, []);
  for (const adjacency of fullAdjacency) {
    adjacencyByRouter.get(adjacency.aRouterId)?.push(adjacency.bRouterId);
    adjacencyByRouter.get(adjacency.bRouterId)?.push(adjacency.aRouterId);
  }
  const unvisited = new Set(enabledRouterIds);
  const components: string[][] = [];
  while (unvisited.size > 0) {
    const seed = [...unvisited].sort()[0];
    const stack = [seed];
    const component: string[] = [];
    unvisited.delete(seed);
    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);
      for (const neighbor of [...(adjacencyByRouter.get(current) ?? [])].sort().reverse()) {
        if (!unvisited.has(neighbor)) continue;
        unvisited.delete(neighbor);
        stack.push(neighbor);
      }
    }
    components.push(component.sort());
  }
  components.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));
  const areaIds = [...new Set([BUILDER_OSPF_BACKBONE_AREA, ...adjacencies.map((entry) => entry.areaId), ...advertisements.map((entry) => entry.areaId)])].sort();
  const areaComponents = Object.fromEntries(areaIds.map((areaId) => [areaId, builderOspfAreaComponents(graph, validated.ospf, areaId)]));

  return {
    areaId: BUILDER_OSPF_BACKBONE_AREA,
    areaIds,
    enabledRouterIds,
    abrRouterIds: builderOspfAbrRouterIds(graph, validated.ospf),
    areaComponents,
    adjacencies,
    advertisements,
    components,
    fullAdjacencyCount: fullAdjacency.length,
    downAdjacencyCount: adjacencies.length - fullAdjacency.length,
  };
}

function ospfRouteEntriesForBuilderRouter''')
# Replace route generation with area-aware + summarization logic.
regex_once(routing,r"function ospfRouteEntriesForBuilderRouter\([\s\S]*?\n}\n\nexport function upsertBuilderStaticRoute", r'''function ospfRouteEntriesForBuilderRouter(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  routerId: string,
): BuilderRouteTableEntry[] {
  const enabled = enabledOspfSet(routing);
  if (!enabled.has(routerId)) return [];
  const directlyConnected = new Set(interfacesForBuilderNode(addressing, routerId).map((entry) => parseBuilderIpv4Cidr(entry.cidr).cidr));
  const state = builderOspfState(graph, addressing, routing);
  const candidates: BuilderRouteTableEntry[] = [];

  for (const advertisement of state.advertisements) {
    if (advertisement.routerId === routerId || directlyConnected.has(advertisement.prefix)) continue;
    const paths = builderOspfPathCandidates(graph, routing.ospf, routerId, advertisement.routerId, advertisement.areaId);
    for (const path of paths) {
      if (!path.reachable || path.firstHops.length === 0) continue;
      const matchingSummary = path.routeType === 'inter-area' && path.destinationAbrRouterId
        ? (routing.ospf.summaries ?? []).find((summary) => summary.abrRouterId === path.destinationAbrRouterId && normalizeBuilderOspfAreaId(summary.fromAreaId) === advertisement.areaId && builderOspfPrefixContains(summary.prefix, advertisement.prefix))
        : undefined;
      const learnedPrefix = matchingSummary?.prefix ?? advertisement.prefix;
      const parsed = parseRoutePrefix(learnedPrefix);
      const metric = matchingSummary ? path.costToDestinationAbr + matchingSummary.metric : path.totalCost + advertisement.metric;
      for (const firstHop of path.firstHops) {
        const segment = addressing.segments[firstHop.linkId];
        const local = segment?.interfaces.find((entry) => entry.nodeId === routerId);
        const remote = segment?.interfaces.find((entry) => entry.nodeId === firstHop.nextRouterId);
        if (!segment || !local || !remote) continue;
        const routeType = path.routeType;
        const abrRouterId = matchingSummary?.abrRouterId ?? path.destinationAbrRouterId;
        const routeLabel = routeType === 'intra-area' ? `OSPF O · AREA ${advertisement.areaId}` : matchingSummary ? `OSPF O IA · SUMMARY ${matchingSummary.prefix} FROM ${advertisement.areaId}` : `OSPF O IA · AREA ${advertisement.areaId}`;
        candidates.push({
          id: `ospf:${routerId}:${parsed.cidr}:${advertisement.routerId}:${firstHop.nextRouterId}:${firstHop.linkId}:${matchingSummary?.id ?? 'specific'}`.replace(/\//g, ':'),
          routerId,
          prefix: parsed.cidr,
          prefixLength: parsed.prefixLength,
          source: 'ospf',
          administrativeDistance: 110,
          metric,
          nextHop: remote.address,
          outgoingInterface: local.name,
          linkId: firstHop.linkId,
          active: true,
          stateNote: `${routeLabel}${abrRouterId ? ` · ABR ${nodeById(graph, abrRouterId)?.label ?? abrRouterId}` : ''} · ORIGIN ${nodeById(graph, advertisement.routerId)?.label ?? advertisement.routerId}`,
          ospfRouteType: routeType,
          ospfAreaId: advertisement.areaId,
          ospfAbrRouterId: abrRouterId,
          ospfSummaryId: matchingSummary?.id ?? null,
        });
      }
    }
  }

  const byPrefix = new Map<string, BuilderRouteTableEntry[]>();
  for (const candidate of candidates) {
    const list = byPrefix.get(candidate.prefix) ?? [];
    list.push(candidate);
    byPrefix.set(candidate.prefix, list);
  }
  const winners: BuilderRouteTableEntry[] = [];
  for (const prefixCandidates of byPrefix.values()) {
    const bestOspfRank = Math.min(...prefixCandidates.map((candidate) => candidate.ospfRouteType === 'inter-area' ? 1 : 0));
    const preferredType = prefixCandidates.filter((candidate) => (candidate.ospfRouteType === 'inter-area' ? 1 : 0) === bestOspfRank);
    const bestMetric = Math.min(...preferredType.map((candidate) => candidate.metric));
    const byNextHop = new Map<string, BuilderRouteTableEntry>();
    for (const candidate of preferredType.filter((entry) => entry.metric === bestMetric).sort((a, b) => a.id.localeCompare(b.id))) {
      const key = `${candidate.nextHop ?? ''}\u0000${candidate.linkId}`;
      if (!byNextHop.has(key)) byNextHop.set(key, candidate);
    }
    const equal = [...byNextHop.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const candidate of equal) winners.push({ ...candidate, stateNote: `${candidate.stateNote}${equal.length > 1 ? ` · ECMP ${equal.length}-WAY` : ''}` });
  }
  return winners;
}

export function upsertBuilderStaticRoute''')
# Route selection must prefer O over O IA before metric.
replace_once(routing,"function compareBuilderRoutePreference(left: BuilderRouteTableEntry, right: BuilderRouteTableEntry): number {\n  return right.prefixLength - left.prefixLength\n    || left.administrativeDistance - right.administrativeDistance\n    || left.metric - right.metric\n    || left.id.localeCompare(right.id);\n}", "function ospfRoutePreference(entry: BuilderRouteTableEntry): number { return entry.source !== 'ospf' ? 0 : entry.ospfRouteType === 'inter-area' ? 1 : 0; }\n\nfunction compareBuilderRoutePreference(left: BuilderRouteTableEntry, right: BuilderRouteTableEntry): number {\n  return right.prefixLength - left.prefixLength\n    || left.administrativeDistance - right.administrativeDistance\n    || ospfRoutePreference(left) - ospfRoutePreference(right)\n    || left.metric - right.metric\n    || left.id.localeCompare(right.id);\n}")
replace_once(routing,"    .filter((entry) => entry.prefix === best.prefix && entry.prefixLength === best.prefixLength && entry.administrativeDistance === best.administrativeDistance && entry.metric === best.metric)", "    .filter((entry) => entry.prefix === best.prefix && entry.prefixLength === best.prefixLength && entry.administrativeDistance === best.administrativeDistance && ospfRoutePreference(entry) === ospfRoutePreference(best) && entry.metric === best.metric)")

# UI panel for area authoring/summaries.
panel=r'''import { useMemo, useState } from 'react';
import { builderOspfAreaForLink, normalizeBuilderOspfAreaId, BUILDER_OSPF_BACKBONE_AREA } from './builder/ospf-areas.ts';
import { builderOspfState, deleteBuilderOspfSummary, setBuilderOspfLinkArea, upsertBuilderOspfSummary, type BuilderRoutingConfig } from './builder/routing.ts';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderGraph } from './builder/model.ts';

function labelFor(graph: BuilderGraph, id: string): string { return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase(); }

export function BuilderOspfAreaPanel({ graph, addressing, routing, selectedNodeId, selectedLinkId, onChange }: { graph: BuilderGraph; addressing: BuilderAddressing; routing: BuilderRoutingConfig; selectedNodeId: string; selectedLinkId: string; onChange: (routing: BuilderRoutingConfig, message: string) => void }) {
  const [summaryArea, setSummaryArea] = useState('0.0.0.1');
  const [summaryPrefix, setSummaryPrefix] = useState('10.0.0.0/24');
  const [summaryMetric, setSummaryMetric] = useState(10);
  const [summaryDescription, setSummaryDescription] = useState('Area range');
  const state = useMemo(() => builderOspfState(graph, addressing, routing), [graph, addressing, routing]);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId);
  if (!selectedNode || selectedNode.kind !== 'router' || !routing.ospf.enabledRouterIds.includes(selectedNodeId)) return null;
  const attachedLinks = graph.links.filter((link) => link.a === selectedNodeId || link.b === selectedNodeId);
  const configuredAreas = [...new Set(attachedLinks.map((link) => builderOspfAreaForLink(routing.ospf, link.id)))].sort();
  const nonBackboneAreas = configuredAreas.filter((areaId) => areaId !== BUILDER_OSPF_BACKBONE_AREA);
  const isAbr = state.abrRouterIds.includes(selectedNodeId);
  const selectedLink = attachedLinks.find((link) => link.id === selectedLinkId) ?? attachedLinks[0] ?? null;
  const selectedArea = selectedLink ? builderOspfAreaForLink(routing.ospf, selectedLink.id) : BUILDER_OSPF_BACKBONE_AREA;
  const summaries = (routing.ospf.summaries ?? []).filter((summary) => summary.abrRouterId === selectedNodeId);
  const activeSummaryArea = nonBackboneAreas.includes(summaryArea) ? summaryArea : (nonBackboneAreas[0] ?? summaryArea);
  return <section className="builder-ospf-section">
    <div className="control-title"><span>OSPF AREAS + ABR</span><strong>{isAbr ? `ABR · ${configuredAreas.length} AREAS` : `${configuredAreas.length} AREA${configuredAreas.length === 1 ? '' : 'S'}`}</strong></div>
    <div className="builder-ospf-facts">
      <div><span>ATTACHED AREAS</span><strong>{configuredAreas.join(' · ') || 'NONE'}</strong></div>
      <div><span>ROLE</span><strong>{isAbr ? 'AREA BORDER ROUTER' : 'INTERNAL ROUTER'}</strong></div>
    </div>
    {selectedLink && <label>SELECTED LINK AREA · {selectedLink.id.toUpperCase()}<input key={`${selectedLink.id}-${selectedArea}`} defaultValue={selectedArea} onBlur={(event) => { try { const next = setBuilderOspfLinkArea(graph, addressing, routing, selectedLink.id, event.currentTarget.value); onChange(next, `OSPF AREA · ${selectedLink.id.toUpperCase()} → ${builderOspfAreaForLink(next.ospf, selectedLink.id)}.`); } catch (error) { event.currentTarget.value = selectedArea; onChange(routing, `OSPF AREA REJECTED · ${error instanceof Error ? error.message : 'Invalid area configuration.'}`); } }} /></label>}
    <div className="builder-ospf-neighbors">{attachedLinks.length === 0 ? <small>NO ROUTED INTERFACES</small> : attachedLinks.map((link) => <div key={link.id} className={link.failed ? 'down' : 'full'}><span>{builderOspfAreaForLink(routing.ospf, link.id) === BUILDER_OSPF_BACKBONE_AREA ? 'BACKBONE' : 'AREA'}</span><strong>{builderOspfAreaForLink(routing.ospf, link.id)}</strong><small>{link.id.toUpperCase()} · COST {link.cost}{link.failed ? ' · DOWN' : ''}</small></div>)}</div>
    {isAbr && nonBackboneAreas.length > 0 && <><div className="builder-static-form"><label>FROM AREA<select value={activeSummaryArea} onChange={(event) => setSummaryArea(event.currentTarget.value)}>{nonBackboneAreas.map((areaId) => <option key={areaId} value={areaId}>{areaId}</option>)}</select></label><label>SUMMARY PREFIX<input value={summaryPrefix} onChange={(event) => setSummaryPrefix(event.currentTarget.value)} /></label><label>METRIC<input type="number" min={1} max={16777215} value={summaryMetric} onChange={(event) => setSummaryMetric(Math.max(1, Math.min(16777215, Math.round(Number(event.currentTarget.value) || 1))))} /></label><label>DESCRIPTION<input value={summaryDescription} maxLength={80} onChange={(event) => setSummaryDescription(event.currentTarget.value)} /></label><button type="button" onClick={() => { try { const next = upsertBuilderOspfSummary(graph, addressing, routing, { abrRouterId: selectedNodeId, fromAreaId: normalizeBuilderOspfAreaId(activeSummaryArea), prefix: summaryPrefix, metric: summaryMetric, description: summaryDescription }); onChange(next, `OSPF SUMMARY · ${summaryPrefix} exported from ${activeSummaryArea} by ${labelFor(graph, selectedNodeId)}.`); } catch (error) { onChange(routing, `OSPF SUMMARY REJECTED · ${error instanceof Error ? error.message : 'Invalid summary.'}`); } }}>ADD / REPLACE SUMMARY</button></div><div className="builder-ospf-neighbors">{summaries.length === 0 ? <small>NO INTER-AREA SUMMARIES</small> : summaries.map((summary) => <div key={summary.id} className="full"><span>O IA</span><strong>{summary.prefix}</strong><small>FROM {summary.fromAreaId} · METRIC {summary.metric} · {summary.description || summary.id}</small><button type="button" onClick={() => onChange(deleteBuilderOspfSummary(graph, addressing, routing, summary.id), `OSPF SUMMARY · ${summary.prefix} removed.`)}>×</button></div>)}</div></>}
    <small className="builder-routing-note">AREA ASSIGNMENT IS PER ROUTED LINK / INTERFACE NETWORK. ABRS REQUIRE AREA 0 PLUS AT LEAST ONE NON-BACKBONE AREA. INTER-AREA ROUTES MUST CROSS THE BACKBONE CONTROL-PLANE PATH; SUMMARIES SUPPRESS COVERED SPECIFICS ONLY ACROSS THAT ABR BOUNDARY.</small>
  </section>;
}
'''
write('src/BuilderOspfAreaPanel.tsx',panel)

network='src/NetworkBuilder.tsx'
# Expand imports from routing.
replace_once(network,"  setBuilderOspfEverywhere,\n  setBuilderOspfRouterEnabled,", "  setBuilderOspfEverywhere,\n  setBuilderOspfRouterEnabled,")
replace_once(network,"import { BuilderOspfEcmpPanel } from './BuilderOspfEcmpPanel.tsx';", "import { BuilderOspfEcmpPanel } from './BuilderOspfEcmpPanel.tsx';\nimport { BuilderOspfAreaPanel } from './BuilderOspfAreaPanel.tsx';")
replace_once(network,"<section className=\"builder-ospf-section\"><div className=\"control-title\"><span>OSPF CONTROL PLANE</span><strong>{selectedNode?.kind === 'router' ? (selectedOspfEnabled ? 'AREA 0 · ENABLED' : 'DISABLED') : 'ROUTERS ONLY'}</strong></div>", "<section className=\"builder-ospf-section\"><div className=\"control-title\"><span>OSPF CONTROL PLANE</span><strong>{selectedNode?.kind === 'router' ? (selectedOspfEnabled ? (ospfState.abrRouterIds.includes(selectedNode.id) ? 'ABR · MULTI-AREA' : 'OSPF · ENABLED') : 'DISABLED') : 'ROUTERS ONLY'}</strong></div>")
replace_once(network,"<small>{adjacency.linkId.toUpperCase()} · COST {adjacency.cost} · {adjacency.reason}</small>", "<small>{adjacency.linkId.toUpperCase()} · AREA {adjacency.areaId} · COST {adjacency.cost} · {adjacency.reason}</small>")
replace_once(network,"SINGLE-AREA OSPF · EQUAL-COST ROUTES INSTALL AS ONE ECMP SET · FLOW HASHING INSPECTOR BELOW · MULTI-AREA STILL DEFERRED.", "MULTI-AREA OSPF · AREA 0 BACKBONE + ABRS + O / O IA ROUTES · ECMP REMAINS PER-FLOW INSIDE EQUAL-BEST ROUTE TYPES.")
replace_once(network,"          <BuilderOspfEcmpPanel graph={graph} addressing={addressing} routing={routing} sourceId={sourceId} destinationId={destinationId}/>", "          <BuilderOspfAreaPanel graph={graph} addressing={addressing} routing={routing} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} onChange={(next, detail)=>{setRouting(next);setMessage(detail);}}/>\n          <BuilderOspfEcmpPanel graph={graph} addressing={addressing} routing={routing} sourceId={sourceId} destinationId={destinationId}/>")
replace_once(network,"{entry.source==='connected'?'C':entry.source==='static'?'S':'O'}</span>", "{entry.source==='connected'?'C':entry.source==='static'?'S':entry.ospfRouteType==='inter-area'?'O IA':'O'}</span>")
replace_once(network,"LOOKUP: LONGEST PREFIX → AD → METRIC → ECMP FLOW HASH. CONNECTED AD 0 · STATIC AD 1 · OSPF AD 110. OSPF SPF USES LINK COST; EQUAL BEST OSPF NEXT HOPS STAY INSTALLED TOGETHER.", "LOOKUP: LONGEST PREFIX → AD → OSPF ROUTE TYPE (O BEFORE O IA) → METRIC → ECMP FLOW HASH. CONNECTED AD 0 · STATIC AD 1 · OSPF AD 110.")

contract=r'''import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import { defaultBuilderLayout } from '../src/builder/model.ts';
import {
  builderOspfState,
  createDefaultBuilderRoutingConfig,
  routeTableForBuilderRouter,
  selectBuilderRoute,
  setBuilderOspfEverywhere,
  setBuilderOspfLinkArea,
  traceBuilderForwarding,
  upsertBuilderOspfSummary,
} from '../src/builder/routing.ts';
import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';

const graph={
  nodes:[
    {id:'client',label:'CLIENT',kind:'endpoint'}, {id:'r1',label:'R1',kind:'router'}, {id:'abr1',label:'ABR1',kind:'router'},
    {id:'abr2',label:'ABR2',kind:'router'}, {id:'r2',label:'R2',kind:'router'}, {id:'app',label:'APP',kind:'endpoint'},
  ],
  links:[
    {id:'client-r1',a:'client',b:'r1',cost:1,failed:false},
    {id:'r1-abr1',a:'r1',b:'abr1',cost:10,failed:false},
    {id:'abr1-abr2',a:'abr1',b:'abr2',cost:5,failed:false},
    {id:'abr2-r2',a:'abr2',b:'r2',cost:10,failed:false},
    {id:'r2-app',a:'r2',b:'app',cost:1,failed:false},
  ],
};
const layout={client:{x:5,y:50},r1:{x:20,y:50},abr1:{x:38,y:50},abr2:{x:62,y:50},r2:{x:80,y:50},app:{x:95,y:50}};
const addressing=createDefaultBuilderAddressing(graph);
let routing=setBuilderOspfEverywhere(graph,addressing,createDefaultBuilderRoutingConfig(),true);
routing=setBuilderOspfLinkArea(graph,addressing,routing,'client-r1','1');
routing=setBuilderOspfLinkArea(graph,addressing,routing,'r1-abr1','1');
routing=setBuilderOspfLinkArea(graph,addressing,routing,'abr1-abr2','0');
routing=setBuilderOspfLinkArea(graph,addressing,routing,'abr2-r2','2');
routing=setBuilderOspfLinkArea(graph,addressing,routing,'r2-app','2');

assert.equal(routing.ospf.linkAreas['r1-abr1'],'0.0.0.1');
assert.equal(routing.ospf.linkAreas['abr2-r2'],'0.0.0.2');
assert.equal(routing.ospf.linkAreas['abr1-abr2'],undefined,'Area 0 is the implicit/default persisted assignment');
const state=builderOspfState(graph,addressing,routing);
assert.deepEqual(state.areaIds,['0.0.0.0','0.0.0.1','0.0.0.2']);
assert.deepEqual(state.abrRouterIds,['abr1','abr2']);
assert.equal(state.adjacencies.find((entry)=>entry.linkId==='r1-abr1')?.areaId,'0.0.0.1');
assert.equal(state.adjacencies.find((entry)=>entry.linkId==='abr1-abr2')?.areaId,'0.0.0.0');
assert.equal(state.adjacencies.find((entry)=>entry.linkId==='abr2-r2')?.areaId,'0.0.0.2');
assert.deepEqual(state.areaComponents['0.0.0.0'],[['abr1','abr2']]);
assert.deepEqual(state.areaComponents['0.0.0.1'],[['abr1','r1']]);
assert.deepEqual(state.areaComponents['0.0.0.2'],[['abr2','r2']]);

const appIf=interfacesForBuilderNode(addressing,'app')[0];
assert.ok(appIf);
const appPrefix=addressing.segments[appIf.linkId].cidr;
const r1App=selectBuilderRoute(routeTableForBuilderRouter(graph,addressing,routing,'r1'),appIf.address);
assert.equal(r1App?.source,'ospf');
assert.equal(r1App?.ospfRouteType,'inter-area');
assert.equal(r1App?.ospfAreaId,'0.0.0.2');
assert.equal(r1App?.linkId,'r1-abr1');
assert.equal(r1App?.metric,26);
assert.match(r1App?.stateNote??'',/O IA/);
const abr2App=selectBuilderRoute(routeTableForBuilderRouter(graph,addressing,routing,'abr2'),appIf.address);
assert.equal(abr2App?.ospfRouteType,'intra-area');
assert.equal(abr2App?.prefix,appPrefix);
assert.equal(abr2App?.metric,11);
assert.match(abr2App?.stateNote??'',/OSPF O · AREA 0\.0\.0\.2/);

const trace=traceBuilderForwarding(graph,addressing,routing,'client','app');
assert.equal(trace.reachable,true);
assert.deepEqual(trace.hops.map((hop)=>hop.nodeId),['client','r1','abr1','abr2','r2']);

routing=upsertBuilderOspfSummary(graph,addressing,routing,{abrRouterId:'abr2',fromAreaId:'2',prefix:'10.0.0.0/24',metric:20,description:'Area 2 range'});
const summarized=selectBuilderRoute(routeTableForBuilderRouter(graph,addressing,routing,'r1'),appIf.address);
assert.equal(summarized?.prefix,'10.0.0.0/24');
assert.equal(summarized?.ospfRouteType,'inter-area');
assert.equal(summarized?.ospfSummaryId,routing.ospf.summaries[0].id);
assert.equal(summarized?.ospfAbrRouterId,'abr2');
assert.equal(summarized?.metric,35);
assert.ok(!routeTableForBuilderRouter(graph,addressing,routing,'r1').some((entry)=>entry.source==='ospf'&&entry.ospfRouteType==='inter-area'&&entry.prefix===appPrefix),'covered Area 2 specific must be suppressed across summarizing ABR');
assert.equal(selectBuilderRoute(routeTableForBuilderRouter(graph,addressing,routing,'abr2'),appIf.address)?.prefix,appPrefix,'ABR inside Area 2 must retain the specific intra-area route');
assert.equal(traceBuilderForwarding(graph,addressing,routing,'client','app').reachable,true,'summary must remain forwarding-capable at the remote router while destination-side ABR keeps specifics');

const failed={...graph,links:graph.links.map((link)=>link.id==='abr1-abr2'?{...link,failed:true}:{...link})};
assert.equal(selectBuilderRoute(routeTableForBuilderRouter(failed,addressing,routing,'r1'),appIf.address),null,'inter-area knowledge must not teleport across a failed Area 0 backbone');
assert.equal(traceBuilderForwarding(failed,addressing,routing,'client','app').reachable,false);

const scenario=createBuilderScenario('Multi-area OSPF',graph,'client','app',layout,addressing,routing);
assert.equal(scenario.version,9,'multi-area fields are an additive routing config extension inside scenario v9');
const restored=deserializeBuilderScenario(serializeBuilderScenario(scenario));
assert.equal(restored.routing.ospf.linkAreas['r1-abr1'],'0.0.0.1');
assert.equal(restored.routing.ospf.linkAreas['abr2-r2'],'0.0.0.2');
assert.equal(restored.routing.ospf.summaries.length,1);
assert.equal(restored.routing.ospf.summaries[0].prefix,'10.0.0.0/24');

console.log('Builder OSPF multi-area contract passed: per-link area membership, ABR detection, Area 0 hierarchy, O vs O IA preference, inter-area forwarding, ABR summarization, backbone failure isolation, and scenario-v9 persistence.');
'''
write('scripts/builder-ospf-multiarea-contract-check.mjs',contract)

package='package.json'
text=read(package)
text=text.replace('npm run test:builder-ospf-ecmp-contract && npm run test:builder-probes-contract','npm run test:builder-ospf-ecmp-contract && npm run test:builder-ospf-multiarea-contract && npm run test:builder-probes-contract')
text=text.replace('"test:builder-ospf-ecmp-contract": "node scripts/builder-ospf-ecmp-contract-check.mjs"','"test:builder-ospf-ecmp-contract": "node scripts/builder-ospf-ecmp-contract-check.mjs",\n    "test:builder-ospf-multiarea-contract": "node scripts/builder-ospf-multiarea-contract-check.mjs"')
write(package,text)

roadmap='docs/ROADMAP.md'
replace_once(roadmap,'- [ ] multi-area OSPF with ABRs, inter-area routes, and summarization','- [x] multi-area OSPF with ABRs, inter-area routes, and summarization')

lab='docs/LAB11M.md'
text=read(lab)
insert='''\n## Multi-area OSPF + ABR summarization\n\n- Routed Builder links now carry an OSPF area assignment. Area `0.0.0.0` remains the implicit default, so every existing scenario keeps its original single-area behavior.\n- An enabled router attached to Area 0 and at least one non-backbone area is derived as an ABR. Adjacencies and LSDB components are tracked per area.\n- Intra-area routes are marked `O`; inter-area routes are marked `O IA`. For the same prefix and AD, `O` is preferred before `O IA`, then metric and ECMP selection apply.\n- A router outside the destination area reaches that area through a local ABR, the Area 0 backbone, and a destination-side ABR. A failed backbone path removes the inter-area route rather than fabricating cross-area reachability.\n- ABRs can author explicit summary ranges with an explicit summary metric. Covered specifics remain visible inside the source area but are suppressed across that summarizing ABR boundary.\n- Equal-cost intra-area or inter-area next hops still feed the deterministic per-flow ECMP engine from the previous slice.\n- Area assignments and summaries persist as additive fields inside the existing Builder scenario-v9 routing object; older v9 documents with no area fields normalize to Area 0 and no summaries.\n\nThe Builder area inspector exposes per-link area assignment, derived ABR role, attached areas, and summary authoring without adding a second routing truth model.\n'''
text=text.replace('## Default teaching timers',insert+'\n## Default teaching timers')
text=text.replace('- multi-area OSPF, ABRs, inter-area routes, and summarization\n','')
write(lab,text)

print('Lab 11M multi-area slice applied.')

import { useMemo, useState } from 'react';
import { builderOspfAreaForLink, normalizeBuilderOspfAreaId, BUILDER_OSPF_BACKBONE_AREA } from './builder/ospf-areas.ts';
import {
  builderOspfAreaType,
  builderOspfState,
  deleteBuilderOspfRedistribution,
  deleteBuilderOspfSummary,
  setBuilderOspfAreaType,
  setBuilderOspfLinkArea,
  upsertBuilderOspfRedistribution,
  upsertBuilderOspfSummary,
  type BuilderOspfAreaType,
  type BuilderRoutingConfig,
} from './builder/routing.ts';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderGraph } from './builder/model.ts';

function labelFor(graph: BuilderGraph, id: string): string { return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase(); }
function areaTypeLabel(value: BuilderOspfAreaType): string { return value === 'normal' ? 'NORMAL' : value.toUpperCase(); }

export function BuilderOspfAreaPanel({ graph, addressing, routing, selectedNodeId, selectedLinkId, onChange }: { graph: BuilderGraph; addressing: BuilderAddressing; routing: BuilderRoutingConfig; selectedNodeId: string; selectedLinkId: string; onChange: (routing: BuilderRoutingConfig, message: string) => void }) {
  const [summaryArea, setSummaryArea] = useState('0.0.0.1');
  const [summaryPrefix, setSummaryPrefix] = useState('10.0.0.0/24');
  const [summaryMetric, setSummaryMetric] = useState(10);
  const [summaryDescription, setSummaryDescription] = useState('Area range');
  const [redistributionRouteId, setRedistributionRouteId] = useState('');
  const [redistributionArea, setRedistributionArea] = useState('0.0.0.0');
  const [redistributionMetric, setRedistributionMetric] = useState(20);
  const state = useMemo(() => builderOspfState(graph, addressing, routing), [graph, addressing, routing]);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId);
  if (!selectedNode || selectedNode.kind !== 'router' || !routing.ospf.enabledRouterIds.includes(selectedNodeId)) return null;
  const attachedLinks = graph.links.filter((link) => link.a === selectedNodeId || link.b === selectedNodeId);
  const configuredAreas = [...new Set(attachedLinks.map((link) => builderOspfAreaForLink(routing.ospf, link.id)))].sort();
  const nonBackboneAreas = configuredAreas.filter((areaId) => areaId !== BUILDER_OSPF_BACKBONE_AREA);
  const isAbr = state.abrRouterIds.includes(selectedNodeId);
  const selectedLink = attachedLinks.find((link) => link.id === selectedLinkId) ?? attachedLinks[0] ?? null;
  const selectedArea = selectedLink ? builderOspfAreaForLink(routing.ospf, selectedLink.id) : BUILDER_OSPF_BACKBONE_AREA;
  const selectedAreaType = builderOspfAreaType(routing.ospf, selectedArea);
  const summaries = (routing.ospf.summaries ?? []).filter((summary) => summary.abrRouterId === selectedNodeId);
  const activeSummaryArea = nonBackboneAreas.includes(summaryArea) ? summaryArea : (nonBackboneAreas[0] ?? summaryArea);
  const localStaticRoutes = routing.staticRoutes.filter((route) => route.routerId === selectedNodeId).sort((a, b) => a.prefix.localeCompare(b.prefix) || a.id.localeCompare(b.id));
  const redistributionAreas = configuredAreas.filter((areaId) => builderOspfAreaType(routing.ospf, areaId) !== 'stub');
  const activeRedistributionRouteId = localStaticRoutes.some((route) => route.id === redistributionRouteId) ? redistributionRouteId : (localStaticRoutes[0]?.id ?? '');
  const activeRedistributionArea = redistributionAreas.includes(redistributionArea) ? redistributionArea : (redistributionAreas[0] ?? redistributionArea);
  const redistributions = (routing.ospf.redistributions ?? []).filter((entry) => entry.routerId === selectedNodeId);
  return <section className="builder-ospf-section">
    <div className="control-title"><span>OSPF AREAS + ABR</span><strong>{isAbr ? `ABR · ${configuredAreas.length} AREAS` : `${configuredAreas.length} AREA${configuredAreas.length === 1 ? '' : 'S'}`}</strong></div>
    <div className="builder-ospf-facts">
      <div><span>ATTACHED AREAS</span><strong>{configuredAreas.map((areaId) => `${areaId} ${areaTypeLabel(builderOspfAreaType(routing.ospf, areaId))}`).join(' · ') || 'NONE'}</strong></div>
      <div><span>ROLE</span><strong>{isAbr ? 'AREA BORDER ROUTER' : 'INTERNAL ROUTER'}</strong></div>
    </div>
    {selectedLink && <div className="builder-static-form">
      <label>SELECTED LINK AREA · {selectedLink.id.toUpperCase()}<input key={`${selectedLink.id}-${selectedArea}`} defaultValue={selectedArea} onBlur={(event) => { try { const next = setBuilderOspfLinkArea(graph, addressing, routing, selectedLink.id, event.currentTarget.value); onChange(next, `OSPF AREA · ${selectedLink.id.toUpperCase()} → ${builderOspfAreaForLink(next.ospf, selectedLink.id)}.`); } catch (error) { event.currentTarget.value = selectedArea; onChange(routing, `OSPF AREA REJECTED · ${error instanceof Error ? error.message : 'Invalid area configuration.'}`); } }} /></label>
      <label>AREA TYPE<select value={selectedAreaType} disabled={selectedArea === BUILDER_OSPF_BACKBONE_AREA} onChange={(event) => { try { const areaType = event.currentTarget.value as BuilderOspfAreaType; const next = setBuilderOspfAreaType(graph, addressing, routing, selectedArea, areaType); onChange(next, `OSPF AREA ${selectedArea} · ${areaTypeLabel(areaType)}.`); } catch (error) { onChange(routing, `OSPF AREA TYPE REJECTED · ${error instanceof Error ? error.message : 'Invalid area type.'}`); } }}><option value="normal">NORMAL</option><option value="stub">STUB</option><option value="nssa">NSSA</option></select></label>
    </div>}
    <div className="builder-ospf-neighbors">{attachedLinks.length === 0 ? <small>NO ROUTED INTERFACES</small> : attachedLinks.map((link) => { const areaId = builderOspfAreaForLink(routing.ospf, link.id); const areaType = builderOspfAreaType(routing.ospf, areaId); return <div key={link.id} className={link.failed ? 'down' : 'full'}><span>{areaId === BUILDER_OSPF_BACKBONE_AREA ? 'BACKBONE' : areaTypeLabel(areaType)}</span><strong>{areaId}</strong><small>{link.id.toUpperCase()} · COST {link.cost}{link.failed ? ' · DOWN' : ''}</small></div>; })}</div>
    {isAbr && nonBackboneAreas.length > 0 && <><div className="builder-static-form"><label>FROM AREA<select value={activeSummaryArea} onChange={(event) => setSummaryArea(event.currentTarget.value)}>{nonBackboneAreas.map((areaId) => <option key={areaId} value={areaId}>{areaId}</option>)}</select></label><label>SUMMARY PREFIX<input value={summaryPrefix} onChange={(event) => setSummaryPrefix(event.currentTarget.value)} /></label><label>METRIC<input type="number" min={1} max={16777215} value={summaryMetric} onChange={(event) => setSummaryMetric(Math.max(1, Math.min(16777215, Math.round(Number(event.currentTarget.value) || 1))))} /></label><label>DESCRIPTION<input value={summaryDescription} maxLength={80} onChange={(event) => setSummaryDescription(event.currentTarget.value)} /></label><button type="button" onClick={() => { try { const next = upsertBuilderOspfSummary(graph, addressing, routing, { abrRouterId: selectedNodeId, fromAreaId: normalizeBuilderOspfAreaId(activeSummaryArea), prefix: summaryPrefix, metric: summaryMetric, description: summaryDescription }); onChange(next, `OSPF SUMMARY · ${summaryPrefix} exported from ${activeSummaryArea} by ${labelFor(graph, selectedNodeId)}.`); } catch (error) { onChange(routing, `OSPF SUMMARY REJECTED · ${error instanceof Error ? error.message : 'Invalid summary.'}`); } }}>ADD / REPLACE SUMMARY</button></div><div className="builder-ospf-neighbors">{summaries.length === 0 ? <small>NO INTER-AREA SUMMARIES</small> : summaries.map((summary) => <div key={summary.id} className="full"><span>O IA</span><strong>{summary.prefix}</strong><small>FROM {summary.fromAreaId} · METRIC {summary.metric} · {summary.description || summary.id}</small><button type="button" onClick={() => onChange(deleteBuilderOspfSummary(graph, addressing, routing, summary.id), `OSPF SUMMARY · ${summary.prefix} removed.`)}>×</button></div>)}</div></>}
    <div className="control-title"><span>STATIC → OSPF REDISTRIBUTION</span><strong>{redistributions.length}</strong></div>
    {localStaticRoutes.length > 0 && redistributionAreas.length > 0 ? <div className="builder-static-form"><label>STATIC ROUTE<select value={activeRedistributionRouteId} onChange={(event) => setRedistributionRouteId(event.currentTarget.value)}>{localStaticRoutes.map((route) => <option key={route.id} value={route.id}>{route.prefix} · {route.nextHop}</option>)}</select></label><label>ORIGIN AREA<select value={activeRedistributionArea} onChange={(event) => setRedistributionArea(event.currentTarget.value)}>{redistributionAreas.map((areaId) => <option key={areaId} value={areaId}>{areaId} · {areaTypeLabel(builderOspfAreaType(routing.ospf, areaId))}</option>)}</select></label><label>EXTERNAL METRIC<input type="number" min={1} max={16777215} value={redistributionMetric} onChange={(event) => setRedistributionMetric(Math.max(1, Math.min(16777215, Math.round(Number(event.currentTarget.value) || 1))))} /></label><button type="button" onClick={() => { try { const next = upsertBuilderOspfRedistribution(graph, addressing, routing, { routerId: selectedNodeId, staticRouteId: activeRedistributionRouteId, areaId: activeRedistributionArea, metric: redistributionMetric }); const route = localStaticRoutes.find((entry) => entry.id === activeRedistributionRouteId); onChange(next, `OSPF REDISTRIBUTION · ${route?.prefix ?? activeRedistributionRouteId} from ${activeRedistributionArea}.`); } catch (error) { onChange(routing, `OSPF REDISTRIBUTION REJECTED · ${error instanceof Error ? error.message : 'Invalid redistribution.'}`); } }}>REDISTRIBUTE STATIC</button></div> : <small>{localStaticRoutes.length === 0 ? 'NO LOCAL STATIC ROUTES TO REDISTRIBUTE.' : 'NO ELIGIBLE ORIGIN AREA. STUB AREAS CANNOT ORIGINATE EXTERNAL ROUTES.'}</small>}
    <div className="builder-ospf-neighbors">{redistributions.length === 0 ? <small>NO REDISTRIBUTED STATIC ROUTES</small> : redistributions.map((entry) => { const route = routing.staticRoutes.find((candidate) => candidate.id === entry.staticRouteId); const nssa = builderOspfAreaType(routing.ospf, entry.areaId) === 'nssa'; return <div key={entry.id} className="full"><span>{nssa ? 'O N1 · TYPE 7' : 'O E1 · TYPE 5'}</span><strong>{route?.prefix ?? entry.staticRouteId}</strong><small>AREA {entry.areaId} · METRIC {entry.metric} · STATIC PROVENANCE</small><button type="button" onClick={() => onChange(deleteBuilderOspfRedistribution(graph, addressing, routing, entry.id), `OSPF REDISTRIBUTION · ${route?.prefix ?? entry.staticRouteId} removed.`)}>×</button></div>; })}</div>
    <small className="builder-routing-note">AREA 0 IS ALWAYS NORMAL. STUB AREAS RECEIVE AN ABR DEFAULT AND SUPPRESS OSPF EXTERNALS. NSSA ROUTERS MAY ORIGINATE AN EXPLICIT STATIC ROUTE AS TYPE-7 / O N1; AN ABR TRANSLATES IT TO TYPE-5 / O E1 FOR NORMAL AREAS. THIS IS BOUNDED STATIC→OSPF REDISTRIBUTION, NOT A GENERIC MULTI-PROTOCOL REDISTRIBUTION ENGINE.</small>
  </section>;
}

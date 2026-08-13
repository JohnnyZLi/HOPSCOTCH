import { useMemo, useState } from 'react';
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

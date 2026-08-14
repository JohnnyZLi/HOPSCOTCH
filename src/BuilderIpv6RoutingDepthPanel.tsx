import { useMemo, useState } from 'react';
import type { BuilderGraph } from './builder/model.ts';
import { primaryBuilderIpv6Address, type BuilderIpv6Config } from './builder/ipv6.ts';
import {
  advanceBuilderOspfv3Depth,
  builderOspfv3DepthSummary,
  clearBuilderIpv6PolicyRules,
  reconcileBuilderIpv6RoutingDepthState,
  setBuilderIpv6PolicyDefault,
  setBuilderOspfv3LinkArea,
  upsertBuilderIpv6PolicyRule,
  type BuilderIpv6IcmpType,
  type BuilderIpv6RoutingDepthState,
} from './builder/ipv6-routing-depth.ts';

function labelFor(graph: BuilderGraph, id: string): string { return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase(); }

export function BuilderIpv6RoutingDepthPanel({ graph, ipv6, selectedNodeId, selectedLinkId, sourceId, destinationId, state, onChange, onMessage }: {
  graph: BuilderGraph;
  ipv6: BuilderIpv6Config;
  selectedNodeId: string;
  selectedLinkId: string;
  sourceId: string;
  destinationId: string;
  state: BuilderIpv6RoutingDepthState;
  onChange: (next: BuilderIpv6RoutingDepthState) => void;
  onMessage: (message: string) => void;
}) {
  const reconciled = useMemo(() => reconcileBuilderIpv6RoutingDepthState(graph, state), [graph, state]);
  const summary = useMemo(() => builderOspfv3DepthSummary(graph, ipv6, reconciled), [graph, ipv6, reconciled]);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedLink = graph.links.find((link) => link.id === selectedLinkId) ?? null;
  const [area, setArea] = useState(reconciled.linkAreas[selectedLinkId] ?? 0);
  const [icmpType, setIcmpType] = useState<BuilderIpv6IcmpType>('echo-request');
  const sourceAddress = primaryBuilderIpv6Address(ipv6.addressing, sourceId);
  const destinationAddress = primaryBuilderIpv6Address(ipv6.addressing, destinationId);
  const adjacency = summary.adjacencies.find((entry) => entry.linkId === selectedLinkId) ?? null;
  const selectedRules = selectedNode?.kind === 'router' ? reconciled.policy.rules.filter((rule) => rule.routerId === selectedNode.id) : [];
  const selectedDefault = selectedNode?.kind === 'router' ? reconciled.policy.defaultActions[selectedNode.id] ?? 'permit' : 'permit';
  const routerAreas = selectedNode?.kind === 'router' ? summary.routerAreas[selectedNode.id] ?? [] : [];
  const isAbr = Boolean(selectedNode?.kind === 'router' && summary.abrRouterIds.includes(selectedNode.id));

  const advance = (ms: number) => { const next = advanceBuilderOspfv3Depth(graph, reconciled, ms); onChange(next); onMessage(`OSPFV3 TIME +${ms / 1000}s · physical failure, dead timer, LSA/SPF, RIB, and FIB stages remain distinct.`); };
  const applyArea = () => { if (!selectedLink) return; try { const next = setBuilderOspfv3LinkArea(graph, reconciled, selectedLink.id, area); onChange(next); onMessage(`OSPFV3 AREA · ${selectedLink.id.toUpperCase()} assigned to Area ${next.linkAreas[selectedLink.id]}.`); } catch (error) { onMessage(`OSPFV3 AREA REJECTED · ${error instanceof Error ? error.message : 'Invalid area.'}`); } };
  const addFlowRule = (action: 'permit' | 'deny') => {
    if (!selectedNode || selectedNode.kind !== 'router' || !sourceAddress || !destinationAddress) { onMessage('Select a router with a valid IPv6 source/destination flow before adding policy.'); return; }
    const next = upsertBuilderIpv6PolicyRule(graph, reconciled, { routerId: selectedNode.id, order: selectedRules.length ? Math.max(...selectedRules.map((rule) => rule.order)) + 10 : 10, action, sourcePrefix: `${sourceAddress}/128`, destinationPrefix: `${destinationAddress}/128`, icmpType, description: `${action.toUpperCase()} current Builder IPv6 flow` });
    onChange(next); onMessage(`IPV6 ACL · ${selectedNode.label} ${action.toUpperCase()} ${icmpType} ${sourceAddress} → ${destinationAddress}.`);
  };

  return <section className="builder-ipv6-routing-depth-section">
    <div className="control-title"><span>OSPFV3 · AREAS + TIME</span><strong>T+{(reconciled.clockMs / 1000).toFixed(1)}S · {summary.abrRouterIds.length} ABR</strong></div>
    <div className="button-row"><button type="button" onClick={() => advance(5_000)}>+5S</button><button type="button" onClick={() => advance(30_000)}>+30S</button><button type="button" onClick={() => advance(40_000)}>+40S</button></div>
    {selectedLink && <div className="builder-static-form"><label>SELECTED LINK AREA<input type="number" min={0} max={4294967295} value={area} onChange={(event) => setArea(Math.max(0, Math.min(4294967295, Math.round(Number(event.currentTarget.value) || 0))))}/></label><button type="button" onClick={applyArea}>SET AREA</button></div>}
    {adjacency && <small className="builder-routing-note">{adjacency.phase} · AREA {adjacency.area} · {adjacency.failurePhase ?? 'STEADY'}{adjacency.elapsedMs != null ? ` · ${(adjacency.elapsedMs / 1000).toFixed(1)}S SINCE FAILURE` : ''} · {adjacency.detail}</small>}
    {selectedNode?.kind === 'router' && <small className="builder-routing-note">{selectedNode.label} · AREAS {routerAreas.length ? routerAreas.join(', ') : 'NONE'} · {isAbr ? 'ABR: AREA 0 BACKBONE + NONZERO AREA' : 'INTERNAL ROUTER'}. Inter-area O6 IA requires the Area 0 backbone.</small>}

    <div className="control-title"><span>IPV6 ACL / FIREWALL</span><strong>{selectedNode?.kind === 'router' ? `${selectedRules.length} RULES · DEFAULT ${selectedDefault.toUpperCase()}` : 'SELECT ROUTER'}</strong></div>
    {selectedNode?.kind === 'router' && <><div className="button-row"><button type="button" onClick={() => onChange(setBuilderIpv6PolicyDefault(graph, reconciled, selectedNode.id, selectedDefault === 'permit' ? 'deny' : 'permit'))}>DEFAULT {selectedDefault === 'permit' ? 'DENY' : 'PERMIT'}</button><button type="button" onClick={() => onChange(clearBuilderIpv6PolicyRules(graph, reconciled, selectedNode.id))}>CLEAR RULES</button></div><div className="builder-static-form"><label>ICMPV6 TYPE<select value={icmpType} onChange={(event) => setIcmpType(event.currentTarget.value as BuilderIpv6IcmpType)}><option value="echo-request">ECHO REQUEST</option><option value="echo-reply">ECHO REPLY</option><option value="time-exceeded">TIME EXCEEDED</option><option value="packet-too-big">PACKET TOO BIG</option><option value="any">ANY ICMPV6</option></select></label><button type="button" onClick={() => addFlowRule('deny')}>DENY CURRENT FLOW</button><button type="button" onClick={() => addFlowRule('permit')}>PERMIT CURRENT FLOW</button></div><div className="builder-interface-list">{selectedRules.length === 0 ? <small>NO EXPLICIT IPV6 POLICY RULES</small> : selectedRules.map((rule) => <div key={rule.id}><span>{rule.order} · {rule.action.toUpperCase()} · {rule.icmpType.toUpperCase()}</span><strong>{rule.sourcePrefix} → {rule.destinationPrefix}</strong><small>{rule.description}</small></div>)}</div></>}
    <small className="builder-routing-note">POLICY TRUTH · FIRST MATCH WINS. ECHO REQUEST, ECHO REPLY, TIME EXCEEDED, AND PACKET TOO BIG ARE DISTINCT ICMPV6 DIRECTIONS/TYPES. OSPFV3 ROUTING AND IPV6 POLICY REMAIN SEPARATE DIMENSIONS.</small>
  </section>;
}

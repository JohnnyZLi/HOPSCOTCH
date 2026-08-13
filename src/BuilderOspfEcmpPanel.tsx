import { useMemo, useState } from 'react';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderGraph } from './builder/model.ts';
import { traceBuilderForwarding, type BuilderRoutingConfig } from './builder/routing.ts';

function labelFor(graph: BuilderGraph, id: string | null): string {
  if (!id) return '—';
  return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase();
}

function firstEcmpHop(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, sourceId: string, destinationId: string, flowKey: string) {
  const trace = traceBuilderForwarding(graph, addressing, routing, sourceId, destinationId, graph, flowKey);
  const hop = trace.hops.find((entry) => (entry.ecmpCandidateCount ?? 0) > 1) ?? null;
  return { trace, hop };
}

export function BuilderOspfEcmpPanel({ graph, addressing, routing, sourceId, destinationId }: { graph: BuilderGraph; addressing: BuilderAddressing; routing: BuilderRoutingConfig; sourceId: string; destinationId: string }) {
  const [flowKey, setFlowKey] = useState('tcp|client|app|49152|443');
  const current = useMemo(() => firstEcmpHop(graph, addressing, routing, sourceId, destinationId, flowKey), [graph, addressing, routing, sourceId, destinationId, flowKey]);
  const samples = useMemo(() => Array.from({ length: 8 }, (_, index) => {
    const key = `tcp|client|app|${49152 + index}|443`;
    const result = firstEcmpHop(graph, addressing, routing, sourceId, destinationId, key);
    return { key, hop: result.hop, trace: result.trace };
  }), [graph, addressing, routing, sourceId, destinationId]);
  if (routing.ospf.enabledRouterIds.length === 0) return null;
  const ecmpHop = current.hop;
  const selected = ecmpHop?.nextNodeId ?? null;
  const distinctSampleNextHops = [...new Set(samples.flatMap((sample) => sample.hop?.nextNodeId ? [sample.hop.nextNodeId] : []))];
  return <section className="builder-ospf-section">
    <div className="control-title"><span>OSPF ECMP</span><strong>{ecmpHop ? `${ecmpHop.ecmpCandidateCount}-WAY` : 'NO EQUAL-COST SET'}</strong></div>
    <label>FLOW HASH KEY<input value={flowKey} onChange={(event) => setFlowKey(event.currentTarget.value)} /></label>
    <div className="builder-ospf-facts">
      <div><span>DECISION POINT</span><strong>{ecmpHop ? labelFor(graph, ecmpHop.nodeId) : '—'}</strong></div>
      <div><span>SELECTED NEXT HOP</span><strong>{selected ? labelFor(graph, selected) : '—'}</strong></div>
      <div><span>HASH</span><strong>{ecmpHop?.ecmpFlowHash == null ? '—' : `0x${ecmpHop.ecmpFlowHash.toString(16).padStart(8, '0')}`}</strong></div>
      <div><span>SAMPLE SPREAD</span><strong>{distinctSampleNextHops.length > 0 ? distinctSampleNextHops.map((id) => labelFor(graph, id)).join(' · ') : '—'}</strong></div>
    </div>
    <div className="builder-ospf-neighbors">{samples.map((sample, index) => <div key={sample.key} className={sample.trace.reachable ? 'full' : 'down'}><span>FLOW {index + 1}</span><strong>{sample.hop ? `${labelFor(graph, sample.hop.nodeId)} → ${labelFor(graph, sample.hop.nextNodeId)}` : sample.trace.reachable ? 'NO ECMP HOP' : 'UNREACHABLE'}</strong><small>{sample.key} {sample.hop?.ecmpFlowHash == null ? '' : `· HASH ${sample.hop.ecmpFlowHash.toString(16).padStart(8, '0')}`}</small></div>)}</div>
    <small className="builder-routing-note">PER-FLOW, NOT PER-PACKET · LONGEST PREFIX / AD / METRIC CHOOSE THE ECMP SET FIRST · A STABLE FNV-1A HASH THEN CHOOSES ONE SORTED NEXT HOP. CHANGE LINK COSTS SO TWO OSPF PATHS TIE TO SEE THE SAMPLE FLOWS DISTRIBUTE.</small>
  </section>;
}

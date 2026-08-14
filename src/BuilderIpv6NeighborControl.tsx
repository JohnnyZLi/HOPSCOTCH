import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderGraph } from './builder/model.ts';
import { setBuilderIpv6RaRouterEnabled, type BuilderIpv6Config } from './builder/ipv6.ts';
import { clearBuilderIpv6NeighborCache, runBuilderIpv6RouterSolicitation } from './builder/ipv6-control-plane.ts';
import { getBuilderIpv6SessionState, resetBuilderIpv6SessionState, setBuilderIpv6SessionState, subscribeBuilderIpv6Session } from './builder/ipv6-session.ts';

function labelFor(graph: BuilderGraph, id: string): string {
  return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase();
}

export function BuilderIpv6NeighborControl({ graph, ipv4, ipv6, selectedNodeId, onChange, onMessage }: {
  graph: BuilderGraph;
  ipv4: BuilderAddressing;
  ipv6: BuilderIpv6Config;
  selectedNodeId: string;
  onChange: (next: BuilderIpv6Config) => void;
  onMessage: (message: string) => void;
}) {
  const control = useSyncExternalStore(subscribeBuilderIpv6Session, getBuilderIpv6SessionState, getBuilderIpv6SessionState);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes[0];
  const raEnabled = Boolean(selectedNode?.kind === 'router' && ipv6.autoconfig.raEnabledRouterIds.includes(selectedNode.id));
  const selectedNeighbors = selectedNode ? control.neighborCache.filter((entry) => entry.nodeId === selectedNode.id) : [];
  const lastRa = control.raHistory.at(-1) ?? null;
  const graphRef = useRef(graph);

  useEffect(() => {
    resetBuilderIpv6SessionState();
    return () => resetBuilderIpv6SessionState();
  }, []);

  useEffect(() => {
    if (graphRef.current !== graph) {
      graphRef.current = graph;
      resetBuilderIpv6SessionState();
    }
  }, [graph]);

  const runSlaac = () => {
    if (!selectedNode || selectedNode.kind !== 'endpoint') return;
    try {
      const result = runBuilderIpv6RouterSolicitation(graph, ipv4, ipv6, selectedNode.id, control);
      onChange(result.config);
      setBuilderIpv6SessionState(result.state);
      onMessage(result.event.success ? `RA / SLAAC · ${result.event.detail}` : `RA MISSED · ${result.event.detail}`);
    } catch (error) {
      onMessage(`SLAAC REJECTED · ${error instanceof Error ? error.message : 'Unable to apply SLAAC.'}`);
    }
  };

  const toggleRa = () => {
    if (!selectedNode || selectedNode.kind !== 'router') return;
    try {
      onChange(setBuilderIpv6RaRouterEnabled(graph, ipv4, ipv6, selectedNode.id, !raEnabled));
      onMessage(`ROUTER ADVERTISEMENT · ${selectedNode.label} ${raEnabled ? 'stopped' : 'started'} advertising connected /64 prefixes.`);
    } catch (error) {
      onMessage(`RA CONFIG REJECTED · ${error instanceof Error ? error.message : 'Unable to change RA state.'}`);
    }
  };

  return <div className="builder-ipv6-neighbor-control">
    <div className="control-title"><span>ND + RA / SLAAC</span><strong>{control.neighborCache.length} NEIGHBORS · {ipv6.autoconfig.slaacEndpointIds.length} SLAAC</strong></div>
    {selectedNode?.kind === 'endpoint' ? <div className="button-row">
      <button type="button" disabled={!ipv6.enabled} onClick={runSlaac}>RUN RS / SLAAC</button>
      <button type="button" disabled={control.neighborCache.length === 0} onClick={() => { setBuilderIpv6SessionState(clearBuilderIpv6NeighborCache(control)); onMessage('IPV6 NEIGHBOR CACHE CLEARED · next routed probe emits NS/NA again.'); }}>CLEAR ND CACHE</button>
    </div> : selectedNode?.kind === 'router' ? <div className="button-row">
      <button type="button" disabled={!ipv6.enabled} onClick={toggleRa}>{raEnabled ? 'DISABLE RA' : 'ENABLE RA'}</button>
      <button type="button" disabled={control.neighborCache.length === 0} onClick={() => { setBuilderIpv6SessionState(clearBuilderIpv6NeighborCache(control)); onMessage('IPV6 NEIGHBOR CACHE CLEARED.'); }}>CLEAR ND CACHE</button>
    </div> : null}
    {lastRa && <small className="builder-routing-note">LAST RS/RA · {lastRa.success ? `${labelFor(graph, lastRa.endpointId)} ← ${labelFor(graph, lastRa.routerId ?? '')} · ${lastRa.prefix} · SLAAC ${lastRa.slaacAddress}` : lastRa.detail}</small>}
    <div className="builder-interface-list">{selectedNeighbors.length === 0 ? <small>NO CACHED IPV6 NEIGHBORS ON SELECTED DEVICE</small> : selectedNeighbors.map((entry) => <div key={entry.id}><span>{entry.address}</span><strong>{entry.mac}</strong><small>{labelFor(graph, entry.targetNodeId)} · {entry.linkId.toUpperCase()} · LEARNED {entry.source}</small></div>)}</div>
    <small className="builder-routing-note">CACHE MISS · NS TO SOLICITED-NODE MULTICAST / 33:33:FF:* → NA. RS TARGETS FF02::2; RA INSTALLS A DETERMINISTIC SLAAC ADDRESS + LINK-LOCAL DEFAULT ROUTER.</small>
  </div>;
}

import { useMemo, useState } from 'react';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderGraph } from './builder/model.ts';
import {
  builderOspfv3State,
  clearBuilderIpv6StaticRoutes,
  cloneBuilderIpv6Config,
  deleteBuilderIpv6StaticRoute,
  installBuilderIpv6BidirectionalStaticPath,
  interfacesForBuilderNodeIpv6,
  nextHopOptionsForBuilderIpv6Router,
  routeTableForBuilderIpv6Router,
  setBuilderIpv6RaRouterEnabled,
  setBuilderOspfv3Everywhere,
  setBuilderOspfv3RouterEnabled,
  traceBuilderIpv6Forwarding,
  upsertBuilderIpv6StaticRoute,
  validateBuilderIpv6Config,
  type BuilderIpv6Config,
} from './builder/ipv6.ts';
import { clearBuilderIpv6NeighborCache, clearBuilderIpv6PmtuCache, runBuilderIpv6RouterSolicitation, type BuilderIpv6ControlState } from './builder/ipv6-control-plane.ts';

function labelFor(graph: BuilderGraph, id: string): string { return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase(); }

export function BuilderIpv6Panel({ graph, ipv4, ipv6, selectedNodeId, selectedLinkId, sourceId, destinationId, controlState, onControlStateChange, probePacketBytes, onProbePacketBytesChange, onChange, onMessage }: {
  graph: BuilderGraph;
  ipv4: BuilderAddressing;
  ipv6: BuilderIpv6Config;
  selectedNodeId: string;
  selectedLinkId: string;
  sourceId: string;
  destinationId: string;
  controlState: BuilderIpv6ControlState;
  onControlStateChange: (next: BuilderIpv6ControlState) => void;
  probePacketBytes: number;
  onProbePacketBytesChange: (bytes: number) => void;
  onChange: (next: BuilderIpv6Config) => void;
  onMessage: (message: string) => void;
}) {
  const [staticPrefix, setStaticPrefix] = useState('::/0');
  const [staticNextHopKey, setStaticNextHopKey] = useState('');
  const [staticMetric, setStaticMetric] = useState(1);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes[0];
  const selectedLink = graph.links.find((link) => link.id === selectedLinkId) ?? graph.links[0];
  const segment = selectedLink ? ipv6.addressing.segments[selectedLink.id] : undefined;
  const interfaces = selectedNode ? interfacesForBuilderNodeIpv6(ipv6.addressing, selectedNode.id) : [];
  const routeTable = selectedNode?.kind === 'router' ? routeTableForBuilderIpv6Router(graph, ipv6, selectedNode.id) : [];
  const nextHops = selectedNode?.kind === 'router' ? nextHopOptionsForBuilderIpv6Router(graph, ipv6, selectedNode.id) : [];
  const effectiveNextHop = nextHops.find((entry) => `${entry.linkId}|${entry.address}` === staticNextHopKey) ?? nextHops[0] ?? null;
  const destinationPrefix = interfacesForBuilderNodeIpv6(ipv6.addressing, destinationId)[0]?.prefix ?? '::/0';
  const trace = useMemo(() => traceBuilderIpv6Forwarding(graph, ipv6, sourceId, destinationId), [graph, ipv6, sourceId, destinationId]);
  const ospfv3 = useMemo(() => builderOspfv3State(graph, ipv6), [graph, ipv6]);
  const selectedOspfv3Enabled = Boolean(selectedNode?.kind === 'router' && ipv6.ospfv3.enabledRouterIds.includes(selectedNode.id));
  const selectedRaEnabled = Boolean(selectedNode?.kind === 'router' && ipv6.autoconfig.raEnabledRouterIds.includes(selectedNode.id));
  const selectedNeighbors = selectedNode ? controlState.neighborCache.filter((entry) => entry.nodeId === selectedNode.id) : [];
  const lastRa = controlState.raHistory.at(-1) ?? null;
  const lastPmtu = controlState.pmtuHistory.at(-1) ?? null;

  const setEnabled = () => {
    try {
      const next = validateBuilderIpv6Config(graph, ipv4, { ...cloneBuilderIpv6Config(ipv6), enabled: !ipv6.enabled });
      onChange(next);
      onMessage(`IPV6 ${next.enabled ? 'ENABLED' : 'DISABLED'} · IPv4 routing state is unchanged.`);
    } catch (error) { onMessage(`IPV6 CONFIG REJECTED · ${error instanceof Error ? error.message : 'Invalid IPv6 configuration.'}`); }
  };

  const installPath = () => {
    try {
      const next = installBuilderIpv6BidirectionalStaticPath(graph, ipv4, ipv6, sourceId, destinationId);
      onChange(next);
      onMessage(`IPV6 STATIC PATH · ${labelFor(graph, sourceId)} ↔ ${labelFor(graph, destinationId)} installed bidirectionally from the current live weighted graph path.`);
    } catch (error) { onMessage(`IPV6 PATH REJECTED · ${error instanceof Error ? error.message : 'Unable to install IPv6 path.'}`); }
  };

  const addStatic = () => {
    if (!selectedNode || selectedNode.kind !== 'router' || !effectiveNextHop) return;
    try {
      const next = upsertBuilderIpv6StaticRoute(graph, ipv4, ipv6, { routerId: selectedNode.id, prefix: staticPrefix, nextHop: effectiveNextHop.address, linkId: effectiveNextHop.linkId, metric: staticMetric, description: 'Builder IPv6 static route' });
      onChange(next);
      onMessage(`IPV6 STATIC · ${selectedNode.label} ${staticPrefix} via ${effectiveNextHop.address}%${effectiveNextHop.linkId}.`);
    } catch (error) { onMessage(`IPV6 STATIC REJECTED · ${error instanceof Error ? error.message : 'Invalid IPv6 static route.'}`); }
  };

  const runSlaac = () => {
    if (!selectedNode || selectedNode.kind !== 'endpoint') { onMessage('Select an endpoint before sending Router Solicitation.'); return; }
    try {
      const result = runBuilderIpv6RouterSolicitation(graph, ipv4, ipv6, selectedNode.id, controlState);
      onChange(result.config); onControlStateChange(result.state);
      onMessage(result.event.success ? `RA / SLAAC · ${result.event.detail}` : `RA MISSED · ${result.event.detail}`);
    } catch (error) { onMessage(`SLAAC REJECTED · ${error instanceof Error ? error.message : 'Unable to apply SLAAC.'}`); }
  };
  const toggleRa = () => {
    if (!selectedNode || selectedNode.kind !== 'router') return;
    try {
      onChange(setBuilderIpv6RaRouterEnabled(graph, ipv4, ipv6, selectedNode.id, !selectedRaEnabled));
      onMessage(`ROUTER ADVERTISEMENT · ${selectedNode.label} ${selectedRaEnabled ? 'stopped' : 'started'} advertising connected /64 prefixes.`);
    } catch (error) { onMessage(`RA CONFIG REJECTED · ${error instanceof Error ? error.message : 'Unable to change RA state.'}`); }
  };
  const toggleOspfv3 = () => {
    if (!selectedNode || selectedNode.kind !== 'router') return;
    try {
      onChange(setBuilderOspfv3RouterEnabled(graph, ipv4, ipv6, selectedNode.id, !selectedOspfv3Enabled));
      onMessage(`OSPFV3 · ${selectedNode.label} ${selectedOspfv3Enabled ? 'left' : 'joined'} AREA 0. IPv4 OSPF is unchanged.`);
    } catch (error) { onMessage(`OSPFV3 REJECTED · ${error instanceof Error ? error.message : 'Unable to change OSPFv3 state.'}`); }
  };

  return <section className="builder-ipv6-section">
    <div className="control-title"><span>IPV6 · DUAL STACK</span><strong>{ipv6.enabled ? (trace.reachable ? 'ENABLED · REACHABLE' : 'ENABLED · NO ROUTE') : 'DISABLED'}</strong></div>
    <div className="button-row"><button type="button" onClick={setEnabled}>{ipv6.enabled ? 'DISABLE IPV6' : 'ENABLE IPV6'}</button><button type="button" disabled={!ipv6.enabled} onClick={installPath}>INSTALL IPV6 STATIC PATH</button><button type="button" disabled={ipv6.routing.staticRoutes.length === 0} onClick={() => { onChange(clearBuilderIpv6StaticRoutes(graph, ipv4, ipv6)); onMessage('IPV6 STATICS CLEARED · IPv4 routing is unchanged.'); }}>CLEAR IPV6 STATICS</button></div>
    {segment && <><div className="builder-ospf-facts"><div><span>SELECTED /64</span><strong>{segment.prefix}</strong></div><div><span>L3 TRUTH</span><strong>IPV6 FIB ONLY</strong></div></div><div className="builder-interface-list">{segment.interfaces.map((entry) => <div key={`${segment.linkId}-${entry.nodeId}`}><span>{labelFor(graph, entry.nodeId)} · {entry.name}</span><strong>{entry.globalAddress}</strong><small>{entry.addressOrigin.toUpperCase()} · LINK-LOCAL {entry.linkLocalAddress}</small></div>)}</div></>}
    <div className="control-title"><span>ND + RA / SLAAC</span><strong>{controlState.neighborCache.length} NEIGHBORS · {ipv6.autoconfig.slaacEndpointIds.length} SLAAC</strong></div>
    {selectedNode?.kind === 'endpoint' ? <div className="button-row"><button type="button" disabled={!ipv6.enabled} onClick={runSlaac}>RUN RS / SLAAC</button><button type="button" disabled={controlState.neighborCache.length===0} onClick={()=>{onControlStateChange(clearBuilderIpv6NeighborCache(controlState));onMessage('IPV6 NEIGHBOR CACHE CLEARED · next probe emits NS/NA again.');}}>CLEAR ND CACHE</button></div> : selectedNode?.kind === 'router' ? <div className="button-row"><button type="button" disabled={!ipv6.enabled} onClick={toggleRa}>{selectedRaEnabled?'DISABLE RA':'ENABLE RA'}</button><button type="button" disabled={controlState.neighborCache.length===0} onClick={()=>{onControlStateChange(clearBuilderIpv6NeighborCache(controlState));onMessage('IPV6 NEIGHBOR CACHE CLEARED.');}}>CLEAR ND CACHE</button></div> : null}
    {lastRa&&<small className="builder-routing-note">LAST RS/RA · {lastRa.success?`${labelFor(graph,lastRa.endpointId)} ← ${labelFor(graph,lastRa.routerId??'')} · ${lastRa.prefix} · SLAAC ${lastRa.slaacAddress}`:lastRa.detail}</small>}
    <div className="builder-interface-list">{selectedNeighbors.length===0?<small>NO CACHED IPV6 NEIGHBORS ON SELECTED DEVICE</small>:selectedNeighbors.map((entry)=><div key={entry.id}><span>{entry.address}</span><strong>{entry.mac}</strong><small>{labelFor(graph,entry.targetNodeId)} · {entry.linkId.toUpperCase()} · LEARNED {entry.source}</small></div>)}</div>
    <div className="control-title"><span>PATH MTU DISCOVERY</span><strong>{controlState.pmtuCache.length} CACHED</strong></div>
    <label>IPV6 PROBE PACKET BYTES<input type="number" min={80} max={9216} value={probePacketBytes} onChange={(event)=>onProbePacketBytesChange(Math.max(80,Math.min(9216,Math.round(Number(event.currentTarget.value)||1280))))}/></label>
    <div className="button-row"><button type="button" disabled={controlState.pmtuCache.length===0} onClick={()=>{onControlStateChange(clearBuilderIpv6PmtuCache(controlState));onMessage('IPV6 PMTU CACHE CLEARED · oversized probes can trigger Packet Too Big again.');}}>CLEAR PMTU CACHE</button></div>
    {lastPmtu&&<small className="builder-routing-note">LAST PTB · {labelFor(graph,lastPmtu.responderNodeId)} · {lastPmtu.linkId.toUpperCase()} MTU {lastPmtu.mtuBytes} · {lastPmtu.delivered?'DELIVERED + CACHED':'REVERSE PATH FAILED'}</small>}
    <div className="builder-interface-list">{controlState.pmtuCache.length===0?<small>NO PMTU STATE · DEFAULT PROBE SIZE 1280 BYTES</small>:controlState.pmtuCache.map((entry)=><div key={entry.id}><span>{labelFor(graph,entry.sourceNodeId)} → {labelFor(graph,entry.destinationNodeId)}</span><strong>{entry.pathMtuBytes} BYTES</strong><small>PTB FROM {labelFor(graph,entry.learnedFromNodeId)} · {entry.linkId.toUpperCase()}</small></div>)}</div>
    {selectedNode && <><div className="control-title"><span>SELECTED DEVICE · IPV6</span><strong>{selectedNode.kind.toUpperCase()} · {interfaces.length} IF</strong></div><div className="builder-interface-list">{interfaces.length === 0 ? <small>NO IPV6 INTERFACES</small> : interfaces.map((entry) => <div key={`${entry.linkId}-${entry.name}`}><span>{entry.name}</span><strong>{entry.globalAddress}</strong><small>{entry.addressOrigin.toUpperCase()} · {entry.prefix} · LL {entry.linkLocalAddress} · {entry.linkId.toUpperCase()}</small></div>)}</div>{selectedNode.kind === 'endpoint' && <small className="builder-routing-note">DEFAULT ROUTER · {ipv6.addressing.defaultGateways[selectedNode.id]?.address ?? 'NONE'}{ipv6.addressing.defaultGateways[selectedNode.id] ? `%${ipv6.addressing.defaultGateways[selectedNode.id]?.linkId}` : ''} · LINK-LOCAL NEXT HOP</small>}</>}
    <div className="control-title"><span>OSPFV3 · AREA 0</span><strong>{ospfv3.enabledRouterIds.length===0?'OFF':`${ospfv3.enabledRouterIds.length} RTR · ${ospfv3.fullAdjacencyCount} FULL`}</strong></div>
    {selectedNode?.kind==='router'?<><div className="button-row"><button type="button" disabled={!ipv6.enabled} onClick={toggleOspfv3}>{selectedOspfv3Enabled?'DISABLE OSPFV3':'ENABLE OSPFV3'}</button><button type="button" disabled={!ipv6.enabled} onClick={()=>{onChange(setBuilderOspfv3Everywhere(graph,ipv4,ipv6,true));onMessage('OSPFV3 AREA 0 ENABLED · all routers advertise connected IPv6 /64s over link-local adjacencies.');}}>ENABLE ALL OSPFV3</button><button type="button" onClick={()=>{onChange(setBuilderOspfv3Everywhere(graph,ipv4,ipv6,false));onMessage('OSPFV3 DISABLED · O6 routes withdrawn; C6/S6 remain.');}}>DISABLE ALL OSPFV3</button></div><div className="builder-ospf-neighbors">{ospfv3.adjacencies.filter((entry)=>entry.aRouterId===selectedNode.id||entry.bRouterId===selectedNode.id).length===0?<small>NO OSPFV3 ROUTER NEIGHBORS</small>:ospfv3.adjacencies.filter((entry)=>entry.aRouterId===selectedNode.id||entry.bRouterId===selectedNode.id).map((entry)=>{const neighbor=entry.aRouterId===selectedNode.id?entry.bRouterId:entry.aRouterId;return <div key={entry.id} className={entry.state==='FULL'?'full':'down'}><span>{entry.state}</span><strong>{labelFor(graph,neighbor)}</strong><small>{entry.linkId.toUpperCase()} · AREA 0 · COST {entry.cost} · {entry.reason}</small></div>;})}</div></>:<small className="builder-routing-note">Select a router to inspect OSPFv3 adjacency and enablement.</small>}
    {selectedNode?.kind === 'router' && <><div className="control-title"><span>IPV6 ROUTE TABLE</span><strong>{routeTable.filter((entry) => entry.active).length} ACTIVE · {routeTable.length} TOTAL</strong></div><div className="builder-route-table builder-ipv6-route-table">{routeTable.length === 0 ? <small>{ipv6.enabled ? 'NO IPV6 ROUTES' : 'IPV6 DISABLED'}</small> : routeTable.map((entry) => <div key={entry.id} className={`${entry.active ? '' : 'inactive'} source-${entry.source}`}><span>{entry.source === 'connected' ? 'C6' : entry.source === 'static' ? 'S6' : 'O6'}</span><strong>{entry.prefix}</strong><small>{entry.source === 'connected' ? 'DIRECT' : `via ${entry.nextHop}%${entry.linkId}`} · {entry.outgoingInterface} · AD {entry.administrativeDistance} · M {entry.metric} · {entry.stateNote}</small>{entry.source === 'static' && <button type="button" aria-label={`Delete IPv6 route ${entry.prefix}`} onClick={() => { onChange(deleteBuilderIpv6StaticRoute(graph, ipv4, ipv6, entry.id)); onMessage(`IPV6 STATIC · ${entry.prefix} removed from ${selectedNode.label}.`); }}>×</button>}</div>)}</div><div className="builder-static-form"><label>DESTINATION PREFIX<input value={staticPrefix} onChange={(event) => setStaticPrefix(event.currentTarget.value)} /></label><button type="button" onClick={() => setStaticPrefix(destinationPrefix)}>USE DEST /64</button><label>NEXT HOP<select value={effectiveNextHop ? `${effectiveNextHop.linkId}|${effectiveNextHop.address}` : ''} onChange={(event) => setStaticNextHopKey(event.currentTarget.value)}>{nextHops.length === 0 ? <option value="">NO NEIGHBORS</option> : nextHops.map((entry) => <option key={`${entry.linkId}-${entry.address}`} value={`${entry.linkId}|${entry.address}`}>{entry.nodeLabel} · {entry.address}%{entry.linkId}{entry.linkFailed ? ' · DOWN' : ''}</option>)}</select></label><label>METRIC<input type="number" min={1} max={999} value={staticMetric} onChange={(event) => setStaticMetric(Math.max(1, Math.min(999, Math.round(Number(event.currentTarget.value) || 1))))} /></label><button type="button" disabled={!ipv6.enabled || !effectiveNextHop} onClick={addStatic}>ADD / REPLACE S6</button></div></>}
    <small className="builder-routing-note">IPV6 DATA PLANE · C6 AD 0 / S6 AD 1 / O6 OSPFV3 AD 110 · NEXT HOPS USE LINK-LOCAL ADDRESSES · ND + PMTU CACHES ARE SESSION-ONLY. RA/SLAAC CONFIG AND OSPFV3 ENABLEMENT PERSIST IN SCHEMA V9. DAD, PRIVACY ADDRESSES, DHCPV6, MULTI-AREA OSPFV3, IPV6 ACL/NAT, AND MLD REMAIN DEFERRED.</small>
  </section>;
}

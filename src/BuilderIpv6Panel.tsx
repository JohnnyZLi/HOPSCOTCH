import { useMemo, useState } from 'react';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderGraph } from './builder/model.ts';
import {
  clearBuilderIpv6StaticRoutes,
  cloneBuilderIpv6Config,
  deleteBuilderIpv6StaticRoute,
  installBuilderIpv6BidirectionalStaticPath,
  interfacesForBuilderNodeIpv6,
  nextHopOptionsForBuilderIpv6Router,
  routeTableForBuilderIpv6Router,
  traceBuilderIpv6Forwarding,
  upsertBuilderIpv6StaticRoute,
  validateBuilderIpv6Config,
  type BuilderIpv6Config,
} from './builder/ipv6.ts';

function labelFor(graph: BuilderGraph, id: string): string { return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase(); }

export function BuilderIpv6Panel({ graph, ipv4, ipv6, selectedNodeId, selectedLinkId, sourceId, destinationId, onChange, onMessage }: {
  graph: BuilderGraph;
  ipv4: BuilderAddressing;
  ipv6: BuilderIpv6Config;
  selectedNodeId: string;
  selectedLinkId: string;
  sourceId: string;
  destinationId: string;
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

  return <section className="builder-ipv6-section">
    <div className="control-title"><span>IPV6 · DUAL STACK</span><strong>{ipv6.enabled ? (trace.reachable ? 'ENABLED · REACHABLE' : 'ENABLED · NO ROUTE') : 'DISABLED'}</strong></div>
    <div className="button-row"><button type="button" onClick={setEnabled}>{ipv6.enabled ? 'DISABLE IPV6' : 'ENABLE IPV6'}</button><button type="button" disabled={!ipv6.enabled} onClick={installPath}>INSTALL IPV6 STATIC PATH</button><button type="button" disabled={ipv6.routing.staticRoutes.length === 0} onClick={() => { onChange(clearBuilderIpv6StaticRoutes(graph, ipv4, ipv6)); onMessage('IPV6 STATICS CLEARED · IPv4 routing is unchanged.'); }}>CLEAR IPV6 STATICS</button></div>
    {segment && <><div className="builder-ospf-facts"><div><span>SELECTED /64</span><strong>{segment.prefix}</strong></div><div><span>L3 TRUTH</span><strong>IPV6 FIB ONLY</strong></div></div><div className="builder-interface-list">{segment.interfaces.map((entry) => <div key={`${segment.linkId}-${entry.nodeId}`}><span>{labelFor(graph, entry.nodeId)} · {entry.name}</span><strong>{entry.globalAddress}</strong><small>LINK-LOCAL {entry.linkLocalAddress}</small></div>)}</div></>}
    {selectedNode && <><div className="control-title"><span>SELECTED DEVICE · IPV6</span><strong>{selectedNode.kind.toUpperCase()} · {interfaces.length} IF</strong></div><div className="builder-interface-list">{interfaces.length === 0 ? <small>NO IPV6 INTERFACES</small> : interfaces.map((entry) => <div key={`${entry.linkId}-${entry.name}`}><span>{entry.name}</span><strong>{entry.globalAddress}</strong><small>{entry.prefix} · LL {entry.linkLocalAddress} · {entry.linkId.toUpperCase()}</small></div>)}</div>{selectedNode.kind === 'endpoint' && <small className="builder-routing-note">DEFAULT ROUTER · {ipv6.addressing.defaultGateways[selectedNode.id]?.address ?? 'NONE'}{ipv6.addressing.defaultGateways[selectedNode.id] ? `%${ipv6.addressing.defaultGateways[selectedNode.id]?.linkId}` : ''} · LINK-LOCAL NEXT HOP</small>}</>}
    {selectedNode?.kind === 'router' && <><div className="control-title"><span>IPV6 ROUTE TABLE</span><strong>{routeTable.filter((entry) => entry.active).length} ACTIVE · {routeTable.length} TOTAL</strong></div><div className="builder-route-table">{routeTable.length === 0 ? <small>{ipv6.enabled ? 'NO IPV6 ROUTES' : 'IPV6 DISABLED'}</small> : routeTable.map((entry) => <div key={entry.id} className={`${entry.active ? '' : 'inactive'} source-${entry.source}`}><span>{entry.source === 'connected' ? 'C6' : 'S6'}</span><strong>{entry.prefix}</strong><small>{entry.source === 'connected' ? 'DIRECT' : `via ${entry.nextHop}%${entry.linkId}`} · {entry.outgoingInterface} · AD {entry.administrativeDistance} · M {entry.metric} · {entry.stateNote}</small>{entry.source === 'static' && <button type="button" aria-label={`Delete IPv6 route ${entry.prefix}`} onClick={() => { onChange(deleteBuilderIpv6StaticRoute(graph, ipv4, ipv6, entry.id)); onMessage(`IPV6 STATIC · ${entry.prefix} removed from ${selectedNode.label}.`); }}>×</button>}</div>)}</div><div className="builder-static-form"><label>DESTINATION PREFIX<input value={staticPrefix} onChange={(event) => setStaticPrefix(event.currentTarget.value)} /></label><button type="button" onClick={() => setStaticPrefix(destinationPrefix)}>USE DEST /64</button><label>NEXT HOP<select value={effectiveNextHop ? `${effectiveNextHop.linkId}|${effectiveNextHop.address}` : ''} onChange={(event) => setStaticNextHopKey(event.currentTarget.value)}>{nextHops.length === 0 ? <option value="">NO NEIGHBORS</option> : nextHops.map((entry) => <option key={`${entry.linkId}-${entry.address}`} value={`${entry.linkId}|${entry.address}`}>{entry.nodeLabel} · {entry.address}%{entry.linkId}{entry.linkFailed ? ' · DOWN' : ''}</option>)}</select></label><label>METRIC<input type="number" min={1} max={999} value={staticMetric} onChange={(event) => setStaticMetric(Math.max(1, Math.min(999, Math.round(Number(event.currentTarget.value) || 1))))} /></label><button type="button" disabled={!ipv6.enabled || !effectiveNextHop} onClick={addStatic}>ADD / REPLACE S6</button></div></>}
    <small className="builder-routing-note">FOUNDATION SLICE · GLOBAL 2001:DB8::/32 DOCUMENTATION SPACE + PER-INTERFACE FE80:: LINK-LOCAL · ENDPOINT DEFAULT ROUTERS USE SCOPED LINK-LOCAL NEXT HOPS · CONNECTED AD 0 / STATIC AD 1. NEIGHBOR DISCOVERY, RA/SLAAC, PACKET TOO BIG, IPV6 ACL/NAT, AND OSPFV3 ARE NOT FABRICATED YET.</small>
  </section>;
}

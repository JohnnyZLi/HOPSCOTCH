import { useSyncExternalStore } from 'react';
import type { BuilderGraph } from './builder/model.ts';
import { clearBuilderIpv6PmtuCache } from './builder/ipv6-control-plane.ts';
import { getBuilderIpv6ProbePacketBytes, getBuilderIpv6SessionState, setBuilderIpv6ProbePacketBytes, setBuilderIpv6SessionState, subscribeBuilderIpv6Session } from './builder/ipv6-session.ts';

function labelFor(graph: BuilderGraph, id: string): string {
  return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase();
}

export function BuilderIpv6PmtuControl({ graph, onMessage }: { graph: BuilderGraph; onMessage: (message: string) => void }) {
  const control = useSyncExternalStore(subscribeBuilderIpv6Session, getBuilderIpv6SessionState, getBuilderIpv6SessionState);
  const packetBytes = useSyncExternalStore(subscribeBuilderIpv6Session, getBuilderIpv6ProbePacketBytes, getBuilderIpv6ProbePacketBytes);
  const lastPmtu = control.pmtuHistory.at(-1) ?? null;

  return <div className="builder-ipv6-pmtu-control">
    <div className="control-title"><span>PATH MTU DISCOVERY</span><strong>{control.pmtuCache.length} CACHED</strong></div>
    <label>IPV6 PROBE PACKET BYTES<input type="number" min={80} max={9216} value={packetBytes} onChange={(event) => setBuilderIpv6ProbePacketBytes(Number(event.currentTarget.value))} /></label>
    <div className="button-row"><button type="button" disabled={control.pmtuCache.length === 0} onClick={() => { setBuilderIpv6SessionState(clearBuilderIpv6PmtuCache(control)); onMessage('IPV6 PMTU CACHE CLEARED · oversized probes can trigger Packet Too Big again.'); }}>CLEAR PMTU CACHE</button></div>
    {lastPmtu && <small className="builder-routing-note">LAST PTB · {labelFor(graph, lastPmtu.responderNodeId)} · {lastPmtu.linkId.toUpperCase()} MTU {lastPmtu.mtuBytes} · {lastPmtu.delivered ? 'DELIVERED + CACHED' : 'REVERSE PATH FAILED'}</small>}
    <div className="builder-interface-list">{control.pmtuCache.length === 0 ? <small>NO PMTU STATE · DEFAULT PROBE SIZE 1280 BYTES</small> : control.pmtuCache.map((entry) => <div key={entry.id}><span>{labelFor(graph, entry.sourceNodeId)} → {labelFor(graph, entry.destinationNodeId)}</span><strong>{entry.pathMtuBytes} BYTES</strong><small>PTB FROM {labelFor(graph, entry.learnedFromNodeId)} · {entry.linkId.toUpperCase()}</small></div>)}</div>
    <small className="builder-routing-note">IPV6 ROUTERS DO NOT FRAGMENT TRANSIT PACKETS · OVERSIZE → ICMPV6 PACKET TOO BIG → SESSION PMTU CACHE → SMALLER RETRY.</small>
  </div>;
}

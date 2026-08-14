import { useMemo } from 'react';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderIpv6ControlState } from './builder/ipv6-control-plane.ts';
import type { BuilderIpv6Config } from './builder/ipv6.ts';
import type { BuilderGraph } from './builder/model.ts';
import {
  advanceBuilderIpv6Lifecycle,
  reconcileBuilderIpv6LifecycleWithControl,
  renumberBuilderIpv6Link,
  runBuilderDhcpv6Client,
  runBuilderIpv6Dad,
  setBuilderDhcpv6Server,
  useBuilderIpv6Neighbor,
  type BuilderIpv6LifecycleState,
} from './builder/ipv6-lifecycle.ts';

function labelFor(graph: BuilderGraph, id: string): string { return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase(); }

export function BuilderIpv6LifecyclePanel({ graph, ipv4, ipv6, selectedNodeId, selectedLinkId, controlState, lifecycleState, onLifecycleStateChange, onIpv6Change, onMessage }: {
  graph: BuilderGraph;
  ipv4: BuilderAddressing;
  ipv6: BuilderIpv6Config;
  selectedNodeId: string;
  selectedLinkId: string;
  controlState: BuilderIpv6ControlState;
  lifecycleState: BuilderIpv6LifecycleState;
  onLifecycleStateChange: (next: BuilderIpv6LifecycleState) => void;
  onIpv6Change: (next: BuilderIpv6Config) => void;
  onMessage: (message: string) => void;
}) {
  const state = useMemo(() => reconcileBuilderIpv6LifecycleWithControl(controlState, lifecycleState), [controlState, lifecycleState]);
  const node = graph.nodes.find((entry) => entry.id === selectedNodeId) ?? null;
  const link = graph.links.find((entry) => entry.id === selectedLinkId) ?? null;
  const segment = link ? ipv6.addressing.segments[link.id] : null;
  const localInterface = segment?.interfaces.find((entry) => entry.nodeId === selectedNodeId) ?? null;
  const selectedNud = state.nud.find((entry) => entry.nodeId === selectedNodeId) ?? null;
  const selectedServer = node?.kind === 'router' && link ? state.dhcpServers.find((entry) => entry.routerId === node.id && entry.linkId === link.id) ?? null : null;
  const selectedLease = state.dhcpLeases.find((entry) => entry.endpointId === selectedNodeId) ?? null;
  const selectedPrefix = state.prefixLifetimes.filter((entry) => entry.endpointId === selectedNodeId).sort((a, b) => b.validUntil - a.validUntil)[0] ?? null;
  const lastDad = state.dadHistory.at(-1) ?? null;
  const lastDhcp = state.dhcpHistory.at(-1) ?? null;
  const lastRenumber = state.renumberHistory.at(-1) ?? null;
  const selectedLinkAttached = Boolean(node && link && [link.a, link.b].includes(node.id));

  const advance = (seconds: number) => {
    const next = advanceBuilderIpv6Lifecycle(state, seconds);
    onLifecycleStateChange(next);
    onMessage(`IPV6 CLOCK +${seconds}s · NUD, RA prefix lifetimes, router lifetime, and DHCPv6 lease timers advanced deterministically.`);
  };

  const dad = (duplicate: boolean) => {
    if (!node || !link || !localInterface) { onMessage('Select a device and one of its IPv6 links before running DAD.'); return; }
    const duplicateAddress = duplicate ? segment?.interfaces.find((entry) => entry.nodeId !== node.id)?.globalAddress : undefined;
    const result = runBuilderIpv6Dad(graph, ipv6, node.id, link.id, state, duplicateAddress);
    onLifecycleStateChange(result.state);
    onMessage(`DAD · ${result.event.detail}`);
  };

  const nud = () => {
    if (!selectedNud) { onMessage('No cached IPv6 neighbor is available on the selected device. Run an IPv6 probe first.'); return; }
    const next = useBuilderIpv6Neighbor(graph, controlState, state, selectedNud.id);
    onLifecycleStateChange(next);
    const updated = next.nud.find((entry) => entry.id === selectedNud.id);
    onMessage(`NUD ${updated?.state ?? 'UNKNOWN'} · ${updated?.detail ?? 'No neighbor state.'}`);
  };

  const toggleDhcp = () => {
    if (!node || node.kind !== 'router' || !link || !selectedLinkAttached) { onMessage('Select a router and one of its attached links before configuring DHCPv6.'); return; }
    const next = setBuilderDhcpv6Server(graph, ipv6, state, node.id, link.id, !selectedServer);
    onLifecycleStateChange(next);
    onMessage(`DHCPV6 SERVER · ${node.label} ${selectedServer ? 'stopped' : 'started'} stateful service on ${link.id.toUpperCase()}.`);
  };

  const runDhcp = () => {
    if (!node || node.kind !== 'endpoint') { onMessage('Select an endpoint before running DHCPv6.'); return; }
    const result = runBuilderDhcpv6Client(graph, ipv6, state, node.id);
    onLifecycleStateChange(result.state);
    onMessage(`DHCPV6 · ${result.event.detail}`);
  };

  const renumber = () => {
    if (!link) { onMessage('Select a routed link before renumbering IPv6.'); return; }
    try {
      const result = renumberBuilderIpv6Link(graph, ipv4, ipv6, state, link.id);
      onIpv6Change(result.config);
      onLifecycleStateChange(result.state);
      onMessage(`IPV6 RENUMBER · ${result.event.detail}`);
    } catch (error) { onMessage(`IPV6 RENUMBER REJECTED · ${error instanceof Error ? error.message : 'Unable to renumber link.'}`); }
  };

  return <section className="builder-ipv6-lifecycle-section">
    <div className="control-title"><span>IPV6 LIFECYCLE</span><strong>T+{state.clockSeconds}s · DAD / NUD / RA / DHCPV6</strong></div>
    <div className="button-row"><button type="button" onClick={() => advance(5)}>+5S</button><button type="button" onClick={() => advance(30)}>+30S</button><button type="button" onClick={() => advance(600)}>+10 MIN</button></div>
    {node && link && localInterface && selectedLinkAttached && <><div className="button-row"><button type="button" onClick={() => dad(false)}>RUN DAD</button><button type="button" onClick={() => dad(true)}>TEST DUPLICATE</button>{node.kind === 'router' && <button type="button" onClick={renumber}>RENUMBER /64</button>}</div><small className="builder-routing-note">DAD sends a tentative-address NS from :: before use. The duplicate test intentionally targets the neighbor's address without corrupting canonical addressing.</small></>}
    {selectedNud && <><div className="builder-ospf-facts"><div><span>NUD STATE</span><strong>{selectedNud.state}</strong></div><div><span>NEIGHBOR</span><strong>{selectedNud.address}</strong></div></div><button type="button" onClick={nud}>USE / PROBE NEIGHBOR</button><small className="builder-routing-note">{selectedNud.detail}</small></>}
    {node?.kind === 'router' && link && selectedLinkAttached && <div className="button-row"><button type="button" onClick={toggleDhcp}>{selectedServer ? 'DISABLE DHCPV6' : 'ENABLE DHCPV6'}</button></div>}
    {node?.kind === 'endpoint' && <div className="button-row"><button type="button" onClick={runDhcp}>RUN DHCPV6</button></div>}
    <div className="builder-ospf-facts"><div><span>PREFIX LIFETIME</span><strong>{selectedPrefix ? `${selectedPrefix.status} · ${selectedPrefix.prefix}` : 'NO RA LEASE'}</strong></div><div><span>DHCPV6 LEASE</span><strong>{selectedLease ? `${selectedLease.status} · ${selectedLease.address}` : 'NONE'}</strong></div></div>
    {selectedPrefix && <small className="builder-routing-note">PREFERRED UNTIL T+{selectedPrefix.preferredUntil}s · VALID UNTIL T+{selectedPrefix.validUntil}s · ROUTER UNTIL T+{selectedPrefix.routerUntil}s.</small>}
    {selectedLease && <small className="builder-routing-note">T1 T+{selectedLease.t1At}s · T2 T+{selectedLease.t2At}s · VALID T+{selectedLease.validUntil}s. DHCPv6 provides the address; RA still provides the default router.</small>}
    {lastDad && <small className="builder-routing-note">LAST DAD · {labelFor(graph,lastDad.nodeId)} · {lastDad.status} · {lastDad.candidateAddress}</small>}
    {lastDhcp && <small className="builder-routing-note">LAST DHCPV6 · {lastDhcp.success ? lastDhcp.stages.join(' → ') : 'SOLICIT ONLY'} · {lastDhcp.address ?? 'NO LEASE'}</small>}
    {lastRenumber && <small className="builder-routing-note">LAST RENUMBER · {lastRenumber.oldPrefix} → {lastRenumber.newPrefix} · old prefix valid until T+{lastRenumber.deprecatedUntil}s.</small>}
  </section>;
}

import { useMemo, useState } from 'react';
import { cloneBuilderEthernetConfig, type BuilderEthernetConfig } from './builder/ethernet.ts';
import { builderEnterpriseRole, builderFirstHopGroups, builderLacpBundles, builderLldpNeighbors, builderNativeVlanStates, builderRstpFailoverPlan, builderRstpState, builderVrfTables, createBuilderEnterpriseDemo, runBuilderEnterpriseFlow } from './builder/enterprise.ts';
import './BuilderEnterprisePanel.css';

export interface BuilderEnterprisePanelProps {
  ethernet: BuilderEthernetConfig;
  historical: boolean;
  onCommitEthernet: (ethernet: BuilderEthernetConfig, message: string) => void;
  onMessage: (message: string) => void;
}

export default function BuilderEnterprisePanel({ ethernet, historical, onCommitEthernet, onMessage }: BuilderEnterprisePanelProps) {
  const vlanIds = ethernet.vlans.map((vlan) => vlan.id).sort((a, b) => a - b);
  const [vlanId, setVlanId] = useState(vlanIds[0] ?? 1);
  const endpoints = ethernet.devices.filter((device) => device.kind === 'endpoint');
  const [sourceId, setSourceId] = useState(endpoints[0]?.id ?? '');
  const [destinationId, setDestinationId] = useState(endpoints[1]?.id ?? '');
  const [flowSummary, setFlowSummary] = useState('NO ENTERPRISE FLOW RUN');
  const lacp = useMemo(() => builderLacpBundles(ethernet), [ethernet]);
  const lldp = useMemo(() => builderLldpNeighbors(ethernet), [ethernet]);
  const native = useMemo(() => builderNativeVlanStates(ethernet), [ethernet]);
  const firstHop = useMemo(() => builderFirstHopGroups(ethernet), [ethernet]);
  const vrfTables = useMemo(() => builderVrfTables(ethernet), [ethernet]);
  const rstp = useMemo(() => vlanIds.includes(vlanId) ? builderRstpState(ethernet, vlanId) : null, [ethernet, vlanId, vlanIds.join(',')]);
  const roles = useMemo(() => ethernet.devices.flatMap((device) => { const role = builderEnterpriseRole(ethernet, device.id); return role ? [{ id: device.id, label: device.label, role }] : []; }), [ethernet]);

  const loadDemo = () => {
    const next = createBuilderEnterpriseDemo();
    onCommitEthernet(next, 'ENTERPRISE FABRIC · canonical access/distribution/core demo loaded with RSTP, LACP, LLDP, SVIs, routed ports, first-hop redundancy, VRFs, and native VLAN semantics.');
    setVlanId(110); setSourceId('blue-client'); setDestinationId('blue-server'); setFlowSummary('ENTERPRISE DEMO LOADED');
  };

  const setProtocol = (protocol: 'stp' | 'rstp') => {
    const next = cloneBuilderEthernetConfig(ethernet); next.stp.protocol = protocol;
    onCommitEthernet(next, `${protocol.toUpperCase()} · canonical spanning-tree protocol mode changed; steady-state loop prevention remains shared Ethernet truth.`);
  };

  const toggleLink = (linkId: string) => {
    const next = cloneBuilderEthernetConfig(ethernet); const link = next.links.find((entry) => entry.id === linkId); if (!link) return; link.failed = !link.failed;
    onCommitEthernet(next, `PHYSICAL MEMBER · ${linkId} ${link.failed ? 'DOWN' : 'UP'}; bundles, RSTP, LLDP, first-hop reachability, and VRF forwarding derive from the same link state.`);
  };

  const runFlow = () => {
    try { const result = runBuilderEnterpriseFlow(ethernet, sourceId, destinationId); setFlowSummary(result.summary); onMessage(`${result.success ? 'ENTERPRISE FLOW' : 'ENTERPRISE FLOW FAILED'} · ${result.summary}`); }
    catch (error) { const message = error instanceof Error ? error.message : 'Unable to run enterprise flow.'; setFlowSummary(message); onMessage(`ENTERPRISE FLOW REJECTED · ${message}`); }
  };

  const failover = () => {
    if (!rstp) return;
    const candidate = ethernet.links.find((link) => !link.failed && link.mode === 'trunk' && rstp.ports.some((port) => port.linkId === link.id && port.role === 'ROOT')) ?? ethernet.links.find((link) => !link.failed && link.mode === 'trunk');
    if (!candidate) { onMessage('RSTP · no active trunk is available for a failover projection.'); return; }
    try { const plan = builderRstpFailoverPlan(ethernet, vlanId, candidate.id); onMessage(`${plan.protocol.toUpperCase()} FAILOVER · ${candidate.id} fails; replacement path reaches FORWARDING at ${plan.convergedAtMs} ms with ${plan.newlyForwardingPortIds.length} newly-forwarding port role${plan.newlyForwardingPortIds.length === 1 ? '' : 's'}.`); }
    catch (error) { onMessage(`RSTP FAILOVER REJECTED · ${error instanceof Error ? error.message : 'Unable to project failover.'}`); }
  };

  return <section className="builder-enterprise-panel" aria-label="Enterprise Layer 2 and Layer 3 tools">
    <div className="builder-enterprise-head"><div><span>TRACK C</span><strong>ENTERPRISE L2 / L3</strong></div><button type="button" disabled={historical} onClick={loadDemo}>LOAD ENTERPRISE FABRIC</button></div>
    <p>One canonical Ethernet fabric. RSTP, bundles, neighbor discovery, SVIs, routed ports, first-hop ownership, VRFs, and VLAN encoding are projections of the same device/link/interface state.</p>

    <div className="builder-enterprise-kpis">
      <div><b>{lacp.length}</b><span>BUNDLES</span></div><div><b>{lldp.length}</b><span>LLDP ADJACENCIES</span></div><div><b>{firstHop.length}</b><span>FIRST-HOP GROUPS</span></div><div><b>{vrfTables.length}</b><span>VRF TABLES</span></div>
    </div>

    <details open><summary>RSTP + PHYSICAL LINKS</summary><div className="builder-enterprise-section">
      <div className="builder-enterprise-inline"><label>VLAN<select value={vlanId} onChange={(event) => setVlanId(Number(event.currentTarget.value))}>{vlanIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label><button type="button" disabled={historical} onClick={() => setProtocol('rstp')}>RSTP</button><button type="button" disabled={historical} onClick={() => setProtocol('stp')}>CLASSIC STP</button><button type="button" onClick={failover}>PROJECT FAILOVER</button></div>
      {rstp ? <div className="builder-enterprise-note"><b>{rstp.protocol.toUpperCase()} · ROOT {rstp.rootBridgeId ?? 'NONE'}</b><span>{rstp.explanation}</span></div> : null}
      <div className="builder-enterprise-list">{ethernet.links.filter((link) => link.mode !== 'access').map((link) => <div key={link.id}><span><b>{link.id}</b><small>{link.mode.toUpperCase()}{link.bundleId ? ` · ${link.bundleId.toUpperCase()}` : ''} · {link.failed ? 'DOWN' : 'UP'}</small></span><button type="button" disabled={historical} onClick={() => toggleLink(link.id)}>{link.failed ? 'BRING UP' : 'FAIL'}</button></div>)}</div>
    </div></details>

    <details><summary>LACP / ETHERCHANNEL + LLDP</summary><div className="builder-enterprise-section builder-enterprise-columns">
      <div><h4>LOGICAL BUNDLES</h4>{lacp.length ? lacp.map((bundle) => <div className="builder-enterprise-note" key={bundle.id}><b>{bundle.id.toUpperCase()} · {bundle.state}</b><span>{bundle.activeMemberLinkIds.length}/{bundle.memberLinkIds.length} MEMBERS · FORWARDING {bundle.forwardingMemberLinkId ?? 'NONE'}</span><small>{bundle.explanation}</small></div>) : <small>NO BUNDLES CONFIGURED</small>}</div>
      <div><h4>DERIVED NEIGHBORS</h4><div className="builder-enterprise-table">{lldp.map((neighbor) => <div key={neighbor.id}><b>{neighbor.localDeviceId}</b><span>→ {neighbor.remoteDeviceId}</span><small>{neighbor.linkId}{neighbor.bundleId ? ` · ${neighbor.bundleId}` : ''}</small></div>)}</div></div>
    </div></details>

    <details><summary>L3 SWITCHING + FIRST-HOP REDUNDANCY</summary><div className="builder-enterprise-section builder-enterprise-columns">
      <div><h4>DESIGN ROLES</h4><div className="builder-enterprise-table">{roles.map((entry) => <div key={entry.id}><b>{entry.label}</b><span>{entry.role}</span><small>{entry.id}</small></div>)}</div></div>
      <div><h4>VIRTUAL GATEWAYS</h4>{firstHop.length ? firstHop.map((group) => <div className="builder-enterprise-note" key={group.id}><b>VLAN {group.vlanId} · {group.vrfId}</b><span>{group.virtualGateway} · MASTER {group.masterDeviceId ?? 'DOWN'}</span><small>{group.virtualMac} · {group.members.map((member) => `${member.deviceId}:${member.priority}${member.active ? '' : '(DOWN)'}`).join(' · ')}</small></div>) : <small>NO VIRTUAL FIRST-HOP GROUPS</small>}</div>
    </div></details>

    <details><summary>VRFS + ROUTED PORTS</summary><div className="builder-enterprise-section">
      <div className="builder-enterprise-inline"><label>SOURCE<select value={sourceId} onChange={(event) => setSourceId(event.currentTarget.value)}>{endpoints.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}</select></label><label>DESTINATION<select value={destinationId} onChange={(event) => setDestinationId(event.currentTarget.value)}>{endpoints.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}</select></label><button type="button" onClick={runFlow}>RUN ENTERPRISE FLOW</button></div>
      <div className="builder-enterprise-note"><b>FLOW RESULT</b><span>{flowSummary}</span></div>
      <div className="builder-enterprise-route-grid">{vrfTables.map((table) => <div key={`${table.deviceId}:${table.vrfId}`}><h4>{table.deviceId} · {table.vrfId}</h4>{table.routes.map((route) => <div key={route.id}><b>{route.prefix}</b><span>{route.source.toUpperCase()}</span><small>{route.nextHopDeviceId ? `VIA ${route.nextHopDeviceId}` : route.outgoing}</small></div>)}</div>)}</div>
    </div></details>

    <details><summary>NATIVE / TAGGED / UNTAGGED VLAN TRUTH</summary><div className="builder-enterprise-section"><div className="builder-enterprise-table">{native.map((entry) => <div key={entry.linkId} className={entry.state === 'MISMATCH' ? 'is-warning' : ''}><b>{entry.linkId}</b><span>{entry.state}</span><small>A NATIVE {entry.nativeVlanA ?? 'NONE'} · B NATIVE {entry.nativeVlanB ?? 'NONE'} · PRESERVED {entry.preservedVlanIds.join(', ') || 'NONE'}{entry.mismatchedVlanIds.length ? ` · MISMATCH ${entry.mismatchedVlanIds.join(', ')}` : ''}</small></div>)}</div></div></details>
  </section>;
}

import { useMemo, useState } from 'react';
import {
  builderFhrpState,
  builderLacpState,
  builderLldpNeighbors,
  builderRstpConvergence,
  builderVlanEncapsulation,
  builderVrfRouteTables,
  createDefaultBuilderEthernetEnterpriseConfig,
  createEnterpriseCampusFixture,
  validateBuilderEthernetEnterpriseConfig,
} from './builder/enterprise.ts';
import { cloneBuilderEthernetConfig, type BuilderEthernetConfig } from './builder/ethernet.ts';
import './BuilderEnterprisePanel.css';

export interface BuilderEnterprisePanelProps {
  ethernet: BuilderEthernetConfig;
  historical: boolean;
  onCommit: (ethernet: BuilderEthernetConfig, message: string) => void;
  onMessage: (message: string) => void;
}

function commitValidated(config: BuilderEthernetConfig): BuilderEthernetConfig {
  const next = cloneBuilderEthernetConfig(config);
  next.enterprise = validateBuilderEthernetEnterpriseConfig(next, next.enterprise);
  return next;
}

export default function BuilderEnterprisePanel({ ethernet, historical, onCommit, onMessage }: BuilderEnterprisePanelProps) {
  const [vlanId, setVlanId] = useState(ethernet.vlans[0]?.id ?? 1);
  const [selectedTrunkId, setSelectedTrunkId] = useState(ethernet.links.find((link) => link.mode === 'trunk')?.id ?? '');
  const enterprise = ethernet.enterprise ?? createDefaultBuilderEthernetEnterpriseConfig();
  const lacp = useMemo(() => enterprise.lacpBundles.flatMap((bundle) => { try { return [builderLacpState({ ...ethernet, enterprise }, bundle.id)]; } catch { return []; } }), [ethernet, enterprise]);
  const lldp = useMemo(() => builderLldpNeighbors({ ...ethernet, enterprise }), [ethernet, enterprise]);
  const fhrp = useMemo(() => enterprise.fhrpGroups.flatMap((group) => { try { return [builderFhrpState({ ...ethernet, enterprise }, group.id)]; } catch { return []; } }), [ethernet, enterprise]);
  const vrfRoutes = useMemo(() => builderVrfRouteTables({ ...ethernet, enterprise }), [ethernet, enterprise]);
  const trunk = ethernet.links.find((link) => link.id === selectedTrunkId && link.mode === 'trunk') ?? ethernet.links.find((link) => link.mode === 'trunk') ?? null;
  const encapsulation = trunk ? builderVlanEncapsulation(trunk, vlanId) : null;
  const rstpCandidate = ethernet.links.find((link) => !link.failed && link.mode === 'trunk') ?? null;
  const convergence = rstpCandidate ? builderRstpConvergence({ ...ethernet, enterprise }, vlanId, rstpCandidate.id) : null;
  const disabled = historical;

  const loadCampus = () => {
    try {
      const next = commitValidated(createEnterpriseCampusFixture(ethernet));
      onCommit(next, 'ENTERPRISE CAMPUS · RSTP, dual distribution L3 switches, LACP uplinks, FHRP gateways, VRFs, and explicit trunk tag state added to the canonical Ethernet fabric.');
    } catch (error) { onMessage(`ENTERPRISE CAMPUS REJECTED · ${error instanceof Error ? error.message : 'Invalid enterprise configuration.'}`); }
  };
  const setProtocol = (protocol: 'stp' | 'rstp') => {
    const next = cloneBuilderEthernetConfig(ethernet);
    next.stp = { ...next.stp, protocol };
    onCommit(next, `${protocol.toUpperCase()} · spanning-tree protocol changed without altering physical topology.`);
  };
  const toggleFirstBundleMember = () => {
    const memberId = enterprise.lacpBundles[0]?.memberLinkIds[0];
    if (!memberId) { onMessage('LACP · load or configure a bundle first.'); return; }
    const next = cloneBuilderEthernetConfig(ethernet);
    next.links = next.links.map((link) => link.id === memberId ? { ...link, failed: !link.failed } : link);
    onCommit(next, `LACP MEMBER · ${memberId} ${next.links.find((link) => link.id === memberId)?.failed ? 'DOWN' : 'UP'}; logical bundle state recomputes from live physical members and minLinks.`);
  };
  const toggleNativeMismatch = () => {
    if (!trunk) { onMessage('NATIVE VLAN · choose a trunk first.'); return; }
    const next = cloneBuilderEthernetConfig(ethernet);
    next.links = next.links.map((link) => link.id === trunk.id ? { ...link, nativeVlanA: vlanId, nativeVlanB: link.nativeVlanB === vlanId ? undefined : vlanId } : link);
    onCommit(next, `NATIVE VLAN · ${trunk.id} endpoint tag expectations changed. Mismatched tagged/untagged behavior remains explicit and can break that VLAN without changing other allowed VLANs.`);
  };

  return <section className="builder-enterprise-card" aria-label="Enterprise Layer 2 and Layer 3 tools">
    <div className="builder-enterprise-title"><div><span>ENTERPRISE</span><strong>L2 / L3 DEPTH</strong></div><small>ONE CANONICAL ETHERNET FABRIC</small></div>
    <div className="builder-enterprise-actions">
      <button type="button" disabled={disabled} onClick={loadCampus}>LOAD CAMPUS</button>
      <button type="button" disabled={disabled} onClick={() => setProtocol('rstp')}>USE RSTP</button>
      <button type="button" disabled={disabled} onClick={() => setProtocol('stp')}>USE CLASSIC STP</button>
      <button type="button" disabled={disabled || lacp.length === 0} onClick={toggleFirstBundleMember}>TOGGLE LACP MEMBER</button>
    </div>
    <div className="builder-enterprise-metrics">
      <div><span>SPANNING TREE</span><strong>{(ethernet.stp.protocol ?? 'stp').toUpperCase()}</strong><small>{convergence ? `${convergence.convergenceMs} ms deterministic failover model` : 'No trunk candidate'}</small></div>
      <div><span>LACP</span><strong>{lacp.length} BUNDLE{lacp.length === 1 ? '' : 'S'}</strong><small>{lacp.filter((state) => state.up).length} logical up</small></div>
      <div><span>LLDP</span><strong>{lldp.filter((row) => row.state === 'UP').length / 2} LINKS</strong><small>derived physical neighbors</small></div>
      <div><span>FHRP</span><strong>{fhrp.length} GROUP{fhrp.length === 1 ? '' : 'S'}</strong><small>{fhrp.filter((state) => state.masterDeviceId).length} masters elected</small></div>
      <div><span>VRFS</span><strong>{enterprise.vrfs.length}</strong><small>{vrfRoutes.length} connected route rows</small></div>
    </div>
    <div className="builder-enterprise-grid">
      <section><div className="builder-enterprise-subtitle"><span>PORT-CHANNEL</span><strong>LOGICAL VS PHYSICAL</strong></div>{lacp.length === 0 ? <small>NO BUNDLES · LOAD CAMPUS TO ADD A DETERMINISTIC EXAMPLE</small> : lacp.map((state) => <div className="builder-enterprise-row" key={state.bundleId}><b>{state.bundleId.toUpperCase()}</b><span>{state.up ? 'UP' : 'DOWN'} · {state.activeMemberLinkIds.length}/{state.activeMemberLinkIds.length + state.inactiveMemberLinkIds.length} ACTIVE</span><small>{state.reason}</small></div>)}</section>
      <section><div className="builder-enterprise-subtitle"><span>FIRST HOP</span><strong>REDUNDANT GATEWAYS</strong></div>{fhrp.length === 0 ? <small>NO GROUPS</small> : fhrp.map((state) => <div className="builder-enterprise-row" key={state.groupId}><b>{state.groupId.toUpperCase()}</b><span>{state.virtualIp} · {state.vrfId}</span><small>MASTER {state.masterDeviceId ?? 'NONE'} · BACKUP {state.backupDeviceIds.join(', ') || 'NONE'}</small></div>)}</section>
      <section><div className="builder-enterprise-subtitle"><span>VRF</span><strong>SEPARATE ROUTING TABLES</strong></div>{enterprise.vrfs.map((vrf) => <div className="builder-enterprise-row" key={vrf.id}><b>{vrf.label}</b><span>{vrfRoutes.filter((row) => row.vrfId === vrf.id).length} CONNECTED</span><small>{vrfRoutes.filter((row) => row.vrfId === vrf.id).slice(0, 4).map((row) => `${row.deviceId}:${row.prefix}`).join(' · ') || 'NO ROUTES'}</small></div>)}</section>
      <section><div className="builder-enterprise-subtitle"><span>TRUNK</span><strong>TAG TRUTH</strong></div><div className="builder-enterprise-controls"><select value={selectedTrunkId} onChange={(event) => setSelectedTrunkId(event.currentTarget.value)}>{ethernet.links.filter((link) => link.mode === 'trunk').map((link) => <option key={link.id} value={link.id}>{link.id}</option>)}</select><select value={vlanId} onChange={(event) => setVlanId(Number(event.currentTarget.value))}>{ethernet.vlans.map((vlan) => <option key={vlan.id} value={vlan.id}>VLAN {vlan.id}</option>)}</select><button type="button" disabled={disabled || !trunk} onClick={toggleNativeMismatch}>TOGGLE NATIVE EXPECTATION</button></div>{encapsulation && <div className={`builder-enterprise-row ${encapsulation.mismatch ? 'is-danger' : ''}`}><b>{encapsulation.a} ↔ {encapsulation.b}</b><span>{encapsulation.mismatch ? 'NATIVE MISMATCH' : 'CONSISTENT'}</span><small>{encapsulation.reason}</small></div>}</section>
      <section className="builder-enterprise-wide"><div className="builder-enterprise-subtitle"><span>LLDP</span><strong>DERIVED NEIGHBORS</strong></div><div className="builder-enterprise-neighbors">{lldp.filter((row) => row.localDeviceId.localeCompare(row.remoteDeviceId) < 0).map((row) => <div className="builder-enterprise-row" key={`${row.localDeviceId}:${row.linkId}`}><b>{row.localLabel} ↔ {row.remoteLabel}</b><span>{row.state}{row.bundleId ? ` · ${row.bundleId.toUpperCase()}` : ''}</span><small>{row.linkId} · physical adjacency only; no inferred topology beyond configured link truth</small></div>)}</div></section>
    </div>
  </section>;
}

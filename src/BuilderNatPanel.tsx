import { useMemo, useState } from 'react';
import { interfacesForBuilderNode, type BuilderAddressing } from './builder/addressing.ts';
import type { BuilderAclConfig } from './builder/acl.ts';
import type { BuilderGraph } from './builder/model.ts';
import {
  clearBuilderNatSessions,
  deleteBuilderNatBoundary,
  deleteBuilderNatStaticAddress,
  deleteBuilderNatStaticMapping,
  runBuilderNatInboundFlow,
  runBuilderNatOutboundFlow,
  upsertBuilderNatBoundary,
  upsertBuilderNatStaticAddress,
  upsertBuilderNatStaticMapping,
  type BuilderNatBoundary,
  type BuilderNatConfig,
  type BuilderNatFlowResult,
  type BuilderNatProtocol,
  type BuilderNatSessionTable,
} from './builder/nat.ts';
import type { BuilderRoutingConfig } from './builder/routing.ts';
import './BuilderNatPanel.css';

function labelFor(graph: BuilderGraph, id: string): string { return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase(); }
function addressFor(addressing: BuilderAddressing, nodeId: string): string | null { return interfacesForBuilderNode(addressing, nodeId)[0]?.address ?? null; }
function tupleText(address: string, port: number | null): string { return `${address}${port == null ? '' : `:${port}`}`; }

interface BuilderNatPanelProps {
  graph: BuilderGraph;
  addressing: BuilderAddressing;
  routing: BuilderRoutingConfig;
  acl: BuilderAclConfig;
  nat: BuilderNatConfig;
  onNatChange: (next: BuilderNatConfig) => void;
  sessions: BuilderNatSessionTable;
  onSessionsChange: (next: BuilderNatSessionTable) => void;
  sourceId: string;
  destinationId: string;
  onMessage: (message: string) => void;
  onFlowResult?: (result: BuilderNatFlowResult, sourceId: string, destinationId: string) => void;
}

export function BuilderNatPanel({ graph, addressing, routing, acl, nat, onNatChange, sessions, onSessionsChange, sourceId, destinationId, onMessage, onFlowResult }: BuilderNatPanelProps) {
  const routers = graph.nodes.filter((node) => node.kind === 'router');
  const [routerId, setRouterId] = useState(() => nat.boundaries[0]?.routerId ?? routers[0]?.id ?? '');
  const [protocol, setProtocol] = useState<BuilderNatProtocol>('tcp');
  const [sourcePort, setSourcePort] = useState(51515);
  const [destinationPort, setDestinationPort] = useState(443);
  const [sequence, setSequence] = useState(1);
  const [lastResult, setLastResult] = useState<BuilderNatFlowResult | null>(null);
  const [staticOutsideAddress, setStaticOutsideAddress] = useState('198.51.100.20');
  const [staticInsidePort, setStaticInsidePort] = useState(443);
  const [staticOutsidePort, setStaticOutsidePort] = useState(8443);
  const [staticProtocol, setStaticProtocol] = useState<'tcp' | 'udp'>('tcp');

  const effectiveRouterId = routers.some((router) => router.id === routerId) ? routerId : (routers[0]?.id ?? '');
  const boundary = nat.boundaries.find((entry) => entry.routerId === effectiveRouterId) ?? null;
  const attachedLinks = useMemo(() => graph.links.filter((link) => link.a === effectiveRouterId || link.b === effectiveRouterId), [graph, effectiveRouterId]);
  const sourceAddress = addressFor(addressing, sourceId);
  const selectedStaticAddresses = nat.staticAddresses.filter((entry) => entry.routerId === effectiveRouterId);
  const selectedStaticPorts = nat.staticMappings.filter((entry) => entry.routerId === effectiveRouterId);

  const commitBoundary = (nextBoundary: BuilderNatBoundary) => {
    try { onNatChange(upsertBuilderNatBoundary(graph, nat, nextBoundary)); onSessionsChange(clearBuilderNatSessions()); setLastResult(null); onMessage(`NAT BOUNDARY · ${labelFor(graph, nextBoundary.routerId)} configuration updated. Translation sessions cleared.`); }
    catch (error) { onMessage(`NAT CONFIG REJECTED · ${error instanceof Error ? error.message : 'Invalid NAT boundary.'}`); }
  };

  const enableBoundary = () => {
    if (!effectiveRouterId) return;
    if (attachedLinks.length < 2) { onMessage('NAT CONFIG REJECTED · a NAT router needs at least two attached routed links.'); return; }
    const endpointLink = attachedLinks.find((link) => {
      const peerId = link.a === effectiveRouterId ? link.b : link.a;
      return graph.nodes.find((node) => node.id === peerId)?.kind === 'endpoint';
    }) ?? attachedLinks[0];
    const outsideLinks = attachedLinks.filter((link) => link.id !== endpointLink.id).map((link) => link.id);
    const ordinal = Math.max(10, routers.findIndex((router) => router.id === effectiveRouterId) + 10);
    commitBoundary({ id: `nat-${effectiveRouterId}`, routerId: effectiveRouterId, insideLinkIds: [endpointLink.id], outsideLinkIds: outsideLinks, overloadAddress: `198.51.100.${ordinal}`, enabled: true });
  };

  const classifyLink = (linkId: string, side: 'inside' | 'outside') => {
    if (!boundary) return;
    const inside = new Set(boundary.insideLinkIds); const outside = new Set(boundary.outsideLinkIds);
    inside.delete(linkId); outside.delete(linkId);
    (side === 'inside' ? inside : outside).add(linkId);
    commitBoundary({ ...boundary, insideLinkIds: [...inside], outsideLinkIds: [...outside] });
  };

  const runOutbound = () => {
    try {
      const result = runBuilderNatOutboundFlow(graph, addressing, routing, nat, sessions, sourceId, destinationId, protocol, protocol === 'icmp' ? null : sourcePort, protocol === 'icmp' ? null : destinationPort, sequence, acl);
      onSessionsChange(result.sessions); setLastResult(result); setSequence((value) => value + 1); onFlowResult?.(result, sourceId, destinationId);
      onMessage(`NAT ${result.success ? 'FLOW' : 'FAILED'} · ${result.explanation}`);
    } catch (error) { onMessage(`NAT FLOW REJECTED · ${error instanceof Error ? error.message : 'Unable to run NAT flow.'}`); }
  };

  const runInboundReturn = () => {
    const translation = lastResult?.translation;
    if (!translation) { onMessage('NAT RETURN · run an outbound translated flow first.'); return; }
    try {
      const result = runBuilderNatInboundFlow(
        graph, addressing, routing, nat, sessions, destinationId, translation.outsideAddress, translation.protocol,
        translation.protocol === 'icmp' ? null : translation.remotePort,
        translation.protocol === 'icmp' ? null : translation.outsidePort,
        sequence, acl,
      );
      onSessionsChange(result.sessions); setLastResult(result); setSequence((value) => value + 1); onFlowResult?.(result, destinationId, sourceId);
      onMessage(`NAT RETURN ${result.success ? 'MATCHED' : 'FAILED'} · ${result.explanation}`);
    } catch (error) { onMessage(`NAT RETURN REJECTED · ${error instanceof Error ? error.message : 'Unable to run return flow.'}`); }
  };

  const addStaticAddress = () => {
    if (!boundary || !sourceAddress) { onMessage('STATIC 1:1 NAT · choose a source with IPv4 and an enabled NAT boundary.'); return; }
    try {
      const next = upsertBuilderNatStaticAddress(graph, nat, {
        id: `nat-1to1-${effectiveRouterId}-${sourceId}`,
        routerId: effectiveRouterId,
        insideAddress: sourceAddress,
        outsideAddress: staticOutsideAddress,
        description: `${labelFor(graph, sourceId)} one-to-one publication`,
      });
      onNatChange(next); onSessionsChange(clearBuilderNatSessions()); setLastResult(null);
      onMessage(`STATIC 1:1 NAT · ${sourceAddress} ↔ ${staticOutsideAddress} configured on ${labelFor(graph, effectiveRouterId)}.`);
    } catch (error) { onMessage(`STATIC 1:1 REJECTED · ${error instanceof Error ? error.message : 'Invalid one-to-one mapping.'}`); }
  };

  const addStaticPort = () => {
    if (!boundary || !sourceAddress) { onMessage('PORT FORWARD · choose a source with IPv4 and an enabled NAT boundary.'); return; }
    try {
      const next = upsertBuilderNatStaticMapping(graph, nat, {
        id: `nat-port-${effectiveRouterId}-${sourceId}-${staticProtocol}-${staticOutsidePort}`,
        routerId: effectiveRouterId,
        protocol: staticProtocol,
        insideAddress: sourceAddress,
        insidePort: staticInsidePort,
        outsideAddress: boundary.overloadAddress,
        outsidePort: staticOutsidePort,
        description: `${labelFor(graph, sourceId)} ${staticProtocol.toUpperCase()} publication`,
      });
      onNatChange(next); onMessage(`PORT FORWARD · ${boundary.overloadAddress}:${staticOutsidePort} → ${sourceAddress}:${staticInsidePort}/${staticProtocol.toUpperCase()}.`);
    } catch (error) { onMessage(`PORT FORWARD REJECTED · ${error instanceof Error ? error.message : 'Invalid static port mapping.'}`); }
  };

  return <section className="builder-nat-section" data-nat-session-count={sessions.length}>
    <div className="control-title"><span>NAT / PAT</span><strong>{nat.boundaries.length === 0 ? 'NO BOUNDARY' : `${nat.boundaries.length} BOUNDARY · ${sessions.length} ACTIVE`}</strong></div>
    <label>NAT ROUTER<select value={effectiveRouterId} onChange={(event) => setRouterId(event.currentTarget.value)}>{routers.map((router) => <option key={router.id} value={router.id}>{router.label}</option>)}</select></label>
    {!boundary ? <button type="button" onClick={enableBoundary} disabled={!effectiveRouterId}>ENABLE NAT ON ROUTER</button> : <>
      <div className="builder-nat-boundary">
        <span>BOUNDARY · {boundary.enabled ? 'ENABLED' : 'DISABLED'}</span>
        <strong>{boundary.insideLinkIds.length} INSIDE → {boundary.outsideLinkIds.length} OUTSIDE</strong>
        <label>OVERLOAD / PAT ADDRESS<input key={`${boundary.id}-${boundary.overloadAddress}`} defaultValue={boundary.overloadAddress} onBlur={(event) => commitBoundary({ ...boundary, overloadAddress: event.currentTarget.value })}/></label>
        <div className="builder-nat-links">{attachedLinks.map((link) => {
          const side = boundary.insideLinkIds.includes(link.id) ? 'inside' : 'outside';
          const peer = link.a === effectiveRouterId ? link.b : link.a;
          return <label key={link.id}>{labelFor(graph, peer)} · {link.id.toUpperCase()}<select value={side} onChange={(event) => classifyLink(link.id, event.currentTarget.value as 'inside' | 'outside')}><option value="inside">INSIDE</option><option value="outside">OUTSIDE</option></select></label>;
        })}</div>
        <div className="button-row"><button type="button" onClick={() => commitBoundary({ ...boundary, enabled: !boundary.enabled })}>{boundary.enabled ? 'DISABLE NAT' : 'ENABLE NAT'}</button><button type="button" onClick={() => { onNatChange(deleteBuilderNatBoundary(graph, nat, boundary.routerId)); onSessionsChange(clearBuilderNatSessions()); setLastResult(null); onMessage(`NAT · ${labelFor(graph, boundary.routerId)} boundary removed.`); }}>REMOVE BOUNDARY</button></div>
      </div>

      <div className="builder-nat-flow-form">
        <label>PROTOCOL<select value={protocol} onChange={(event) => setProtocol(event.currentTarget.value as BuilderNatProtocol)}><option value="tcp">TCP</option><option value="udp">UDP</option><option value="icmp">ICMP</option></select></label>
        <label>SRC PORT<input type="number" min={1} max={65535} disabled={protocol === 'icmp'} value={sourcePort} onChange={(event) => setSourcePort(Math.max(1, Math.min(65535, Math.round(Number(event.currentTarget.value) || 1))))}/></label>
        <label>DST PORT<input type="number" min={1} max={65535} disabled={protocol === 'icmp'} value={destinationPort} onChange={(event) => setDestinationPort(Math.max(1, Math.min(65535, Math.round(Number(event.currentTarget.value) || 1))))}/></label>
      </div>
      <div className="button-row"><button type="button" onClick={runOutbound}>RUN OUTBOUND</button><button type="button" onClick={runInboundReturn} disabled={!lastResult?.translation}>TEST RETURN</button><button type="button" onClick={() => { onSessionsChange(clearBuilderNatSessions()); setLastResult(null); onMessage('NAT SESSIONS CLEARED · unsolicited inbound return traffic now requires static configuration.'); }}>CLEAR STATE</button></div>

      {lastResult && <div className={`builder-nat-result ${lastResult.success ? 'success' : 'failed'}`}>
        <span>{lastResult.direction.toUpperCase()} · {lastResult.success ? 'DELIVERED' : lastResult.failureReason}</span>
        <strong>{tupleText(lastResult.originalTuple.sourceAddress, lastResult.originalTuple.sourcePort)} → {tupleText(lastResult.originalTuple.destinationAddress, lastResult.originalTuple.destinationPort)}</strong>
        {lastResult.translatedTuple && <small>TRANSLATED · {tupleText(lastResult.translatedTuple.sourceAddress, lastResult.translatedTuple.sourcePort)} → {tupleText(lastResult.translatedTuple.destinationAddress, lastResult.translatedTuple.destinationPort)}</small>}
        <p>{lastResult.explanation}</p>
        {lastResult.policyStages.length > 0 && <div className="builder-nat-policy-stages">{lastResult.policyStages.map((stage, index) => <small key={`${stage.routerId}-${stage.phase}-${index}`} className={stage.decision.action}><b>{stage.phase.toUpperCase()} · {labelFor(graph, stage.routerId)}{stage.boundary ? ' · NAT BOUNDARY' : ''}</b>{tupleText(stage.tuple.sourceAddress, stage.tuple.sourcePort)} → {tupleText(stage.tuple.destinationAddress, stage.tuple.destinationPort)} · {stage.decision.action.toUpperCase()} {stage.decision.ruleId ?? 'DEFAULT'}</small>)}</div>}
      </div>}

      <div className="builder-nat-static">
        <span>STATIC 1:1</span>
        <label>PUBLIC ADDRESS<input value={staticOutsideAddress} onChange={(event) => setStaticOutsideAddress(event.currentTarget.value)}/></label>
        <button type="button" onClick={addStaticAddress}>MAP CURRENT SOURCE 1:1</button>
        {selectedStaticAddresses.map((mapping) => <div key={mapping.id}><small><b>{mapping.insideAddress}</b> ↔ {mapping.outsideAddress}</small><button type="button" onClick={() => { onNatChange(deleteBuilderNatStaticAddress(graph, nat, mapping.id)); onMessage(`STATIC 1:1 · ${mapping.id} removed.`); }}>×</button></div>)}
      </div>

      <div className="builder-nat-static">
        <span>STATIC PORT FORWARD</span>
        <div className="builder-nat-flow-form"><label>PROTO<select value={staticProtocol} onChange={(event) => setStaticProtocol(event.currentTarget.value as 'tcp' | 'udp')}><option value="tcp">TCP</option><option value="udp">UDP</option></select></label><label>INSIDE<input type="number" min={1} max={65535} value={staticInsidePort} onChange={(event) => setStaticInsidePort(Math.max(1, Math.min(65535, Math.round(Number(event.currentTarget.value) || 1))))}/></label><label>PUBLIC<input type="number" min={1} max={65535} value={staticOutsidePort} onChange={(event) => setStaticOutsidePort(Math.max(1, Math.min(65535, Math.round(Number(event.currentTarget.value) || 1))))}/></label></div>
        <button type="button" onClick={addStaticPort}>PUBLISH CURRENT SOURCE</button>
        {selectedStaticPorts.map((mapping) => <div key={mapping.id}><small><b>{mapping.outsideAddress}:{mapping.outsidePort}</b> → {mapping.insideAddress}:{mapping.insidePort}/{mapping.protocol.toUpperCase()}</small><button type="button" onClick={() => { onNatChange(deleteBuilderNatStaticMapping(graph, nat, mapping.id)); onMessage(`PORT FORWARD · ${mapping.id} removed.`); }}>×</button></div>)}
      </div>

      <div className="builder-nat-sessions"><span>DERIVED TRANSLATION STATE</span>{sessions.length === 0 ? <small>NO ACTIVE PAT SESSIONS</small> : sessions.map((session) => <small key={session.id}><b>{session.protocol.toUpperCase()} · {session.kind.toUpperCase()}</b>{tupleText(session.insideAddress, session.insidePort)} → {tupleText(session.outsideAddress, session.outsidePort)} · REMOTE {tupleText(session.remoteAddress, session.remotePort)} · EXPIRES {session.expiresAfterSequence ?? 'STATIC'}</small>)}</div>
      <small className="builder-routing-note">ROUTING → PRE-NAT ACL → TRANSLATION → POST-NAT ACL ARE SEPARATE TRUTH STAGES. DYNAMIC PAT STATE IS SESSION-ONLY; STATIC NAT CONFIG PERSISTS.</small>
    </>}
  </section>;
}

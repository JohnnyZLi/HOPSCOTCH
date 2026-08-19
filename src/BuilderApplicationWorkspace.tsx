import { useMemo, useState } from 'react';
import { PacketMicroscope } from './PacketMicroscope.tsx';
import {
  createDefaultBuilderHostedServices,
  runBuilderApplicationTransaction,
  type BuilderApplicationCamera,
  type BuilderApplicationFamily,
  type BuilderApplicationPacket,
  type BuilderApplicationTransaction,
  type BuilderHostedService,
} from './builder/application.ts';
import { diagnoseBuilderApplicationTransaction } from './builder/causal-diagnosis.ts';
import type { BuilderApplicationPanelProps } from './BuilderApplicationPanel.tsx';
import './BuilderApplicationPanel.css';

function stageTone(status: string): string { return status === 'PASS' ? 'pass' : status === 'FAIL' ? 'fail' : 'not-reached'; }
function serviceProtocol(service: BuilderHostedService): string {
  if (service.kind === 'https' && service.transportProfile === 'quic-h3') return 'UDP/443 · QUIC/H3';
  if (service.kind === 'dns' || service.kind === 'udp') return `UDP/${service.port}`;
  return `TCP/${service.port}${service.kind === 'https' ? ' · TLS/H2' : ''}`;
}

function TransactionPacketMicroscope({ packet, transaction, onClose }: { packet: BuilderApplicationPacket; transaction: BuilderApplicationTransaction; onClose: () => void }) {
  return <div className="builder-app-microscope"><PacketMicroscope onExit={onClose} initialConfig={packet.config} origin={{ label: `TRACK D · ${packet.label}`, timestamp: transaction.id, actionLabel: 'RETURN TO APPLICATION TRANSACTION ↗' }} /></div>;
}

export function BuilderApplicationWorkspace({ context, sourceNodeId, historical, onSessionState, onTransaction, onMessage }: BuilderApplicationPanelProps) {
  const services = useMemo(() => createDefaultBuilderHostedServices(context.graph), [context.graph]);
  const [serviceId, setServiceId] = useState(() => services[0]?.id ?? '');
  const [family, setFamily] = useState<BuilderApplicationFamily>('ipv4');
  const [sequence, setSequence] = useState(1);
  const [transaction, setTransaction] = useState<BuilderApplicationTransaction | null>(null);
  const [camera, setCamera] = useState<BuilderApplicationCamera>('BUILDER');
  const [packetId, setPacketId] = useState<string | null>(null);
  const selectedService = services.find((service) => service.id === serviceId) ?? services[0] ?? null;
  const selectedPacket = transaction?.packets.find((packet) => packet.id === packetId) ?? null;
  const diagnosis = useMemo(() => transaction ? diagnoseBuilderApplicationTransaction(transaction, context.graph) : null, [transaction, context.graph]);

  const run = () => {
    if (!selectedService) return;
    try {
      const result = runBuilderApplicationTransaction(context, services, sourceNodeId, selectedService.id, family, sequence);
      setTransaction(result); setSequence((value) => value + 2); setCamera('BUILDER'); setPacketId(null);
      onSessionState({ arpCache: result.arpCache, natSessions: result.natSessions, dhcpLeases: result.dhcpLeases, ipv6ControlState: result.ipv6ControlState });
      onTransaction(result);
      onMessage(`APPLICATION · ${result.summary}`);
    } catch (cause) { onMessage(`APPLICATION REJECTED · ${cause instanceof Error ? cause.message : String(cause)}`); }
  };

  if (selectedPacket && transaction) return <TransactionPacketMicroscope packet={selectedPacket} transaction={transaction} onClose={() => setPacketId(null)} />;

  return (
    <section className="builder-app-panel" data-track-d="shared-application-transaction">
      <header className="builder-app-heading">
        <div><span>TRACK D · APPLICATION TRANSACTION</span><strong>ONE REQUEST · ONE CAUSAL TRUTH STACK</strong><p>Addressing/DHCP → Ethernet/VLAN/STP → ARP/ND → FIB → ACL/NAT → link truth → canonical transport/TLS/application → exact packet bytes.</p></div>
        <span className="builder-app-boundary">SIMULATED · DETERMINISTIC</span>
      </header>
      <div className="builder-app-controls">
        <label>SOURCE<strong>{context.graph.nodes.find((node) => node.id === sourceNodeId)?.label ?? sourceNodeId}</strong></label>
        <label>SERVICE<select disabled={historical} value={selectedService?.id ?? ''} onChange={(event) => setServiceId(event.currentTarget.value)}>{services.map((service) => <option key={service.id} value={service.id}>{service.label} · {serviceProtocol(service)}</option>)}</select></label>
        <label>NETWORK FAMILY<select disabled={historical} value={family} onChange={(event) => setFamily(event.currentTarget.value as BuilderApplicationFamily)}><option value="ipv4">IPV4</option><option value="ipv6" disabled={!context.ipv6.enabled}>IPV6{context.ipv6.enabled ? '' : ' · DISABLED'}</option></select></label>
        <button type="button" disabled={historical || !selectedService} onClick={run}>RUN APPLICATION REQUEST</button>
      </div>
      <div className="builder-service-strip">{services.map((service) => <span key={service.id} data-enabled={service.enabled}><b>{service.kind.toUpperCase()}</b>{serviceProtocol(service)} · {service.hostname ?? service.nodeId}</span>)}</div>
      {!transaction ? <div className="builder-app-empty"><strong>NO APPLICATION TRANSACTION YET</strong><p>Choose a hosted service and run the request. Transport and application stages do not exist until lower-layer truth passes.</p></div> : <>
        <div className={`builder-app-result ${transaction.success ? 'success' : 'failed'}`}><span>RESULT</span><strong>{transaction.success ? 'COMPLETE' : `STOPPED · ${transaction.firstBrokenBoundary?.replace('_', ' ') ?? 'UNKNOWN'}`}</strong><p>{transaction.summary}</p><small>{transaction.boundary}</small></div>
        {diagnosis&&<div className={`builder-app-diagnosis ${diagnosis.firstBrokenDimension?'failed':'passed'}`}><span>TRACK A · CAUSAL DIAGNOSIS</span><strong>{diagnosis.summary}</strong><p>{diagnosis.dimensions.map((entry)=>`${entry.id} ${entry.status}`).join(' · ')}</p><small>FIRST BROKEN BOUNDARY IS DERIVED FROM THE SHARED TRACK D TRANSACTION · NOT_REACHED NEVER COUNTS AS FAILURE.</small></div>}
        <nav className="builder-app-cameras" aria-label="Application transaction cameras">{transaction.projections.map((projection) => <button key={projection.camera} type="button" className={camera === projection.camera ? 'active' : ''} onClick={() => setCamera(projection.camera)}><b>{projection.camera}</b><span>{projection.label}</span></button>)}</nav>
        {camera === 'BUILDER' && <div className="builder-app-stage-list">{transaction.stages.map((stage) => <article key={stage.id} data-status={stageTone(stage.status)}><span>{String(stage.order).padStart(2, '0')} · {stage.boundary.replace('_', ' ')}</span><strong>{stage.label}</strong><b>{stage.status}</b><p>{stage.summary}</p><small>{stage.detail}</small>{stage.linkIds.length > 0 && <code>{stage.linkIds.join(' → ')}</code>}</article>)}</div>}
        {camera === 'PROTOCOL' && <div className="builder-app-protocol">{transaction.protocolEvents.length === 0 ? <article><strong>NO TCP/QUIC THEATER REQUIRED</strong><p>This service uses UDP datagram semantics. HOPSCOTCH does not manufacture a transport handshake.</p></article> : transaction.protocolEvents.map((event, index) => <article key={event.id}><span>{String(index + 1).padStart(2, '0')} · {event.protocol}</span><strong>{event.title}</strong><p>{event.summary}</p><small>{event.kind} · CANONICAL JOURNEY/LAB 03 · {event.provenance}</small></article>)}</div>}
        {camera === 'JOURNEY' && <div className="builder-app-journey"><div className="builder-app-journey-rail">{transaction.stages.map((stage) => <span key={stage.id} data-status={stageTone(stage.status)}><b>{stage.label}</b><small>{stage.status}</small></span>)}{transaction.protocolEvents.map((event) => <span key={event.id} data-status="pass"><b>{event.title}</b><small>{event.protocol}</small></span>)}</div><p>The Builder camera supplies actual topology/addressing/policy/link truth; the Journey camera supplies the canonical TCP/QUIC/TLS/HTTP event vocabulary. They are projections of this transaction, not competing simulators.</p></div>}
        {camera === 'PACKET' && <div className="builder-app-packets">{transaction.packets.length === 0 ? <article><strong>NO PACKET BYTES REACHED</strong><p>The transaction failed before the transport boundary, so Packet Microscope bytes were not fabricated.</p></article> : transaction.packets.map((packet) => <article key={packet.id}><span>{packet.direction} · {packet.vantage.replace('_', ' ')}</span><strong>{packet.label}</strong><p>{packet.config.family.toUpperCase()} · {packet.config.transport.toUpperCase()} · {packet.config.sourcePort} → {packet.config.destinationPort}</p><code>{packet.snapshot.bytes.slice(0, 24).map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')}{packet.snapshot.bytes.length > 24 ? ' …' : ''}</code><small>{packet.snapshot.frameBytes} exact bytes · IP checksum {packet.snapshot.networkChecksum == null ? 'N/A' : `0x${packet.snapshot.networkChecksum.toString(16).padStart(4, '0').toUpperCase()}`} · transport checksum 0x{packet.snapshot.transportChecksum.toString(16).padStart(4, '0').toUpperCase()}</small><button type="button" onClick={() => setPacketId(packet.id)}>OPEN PACKET MICROSCOPE ↗</button></article>)}</div>}
      </>}
    </section>
  );
}

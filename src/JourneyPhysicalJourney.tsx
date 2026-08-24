import { useReducedMotion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';
import type { JourneyPacketLayerId } from './journey/packet-visual.ts';
import type { JourneyPhysicalProjection } from './journey/physical-journey.ts';
import './JourneyPhysicalJourney.css';

const signalCells = Array.from({ length: 28 }, (_, index) => index);

function Device({ id, eyebrow, label, port, active, children }: {
  id: string;
  eyebrow: string;
  label: string;
  port: string;
  active: boolean;
  children?: ReactNode;
}) {
  return <article className={`phase5b-device device-${id} ${active ? 'is-active' : ''}`} data-device={id} aria-current={active ? 'step' : undefined}>
    <span>{eyebrow}</span><strong>{label}</strong><small>{port}</small><i aria-hidden="true"/>{children}
  </article>;
}

export function JourneyPhysicalJourney({ projection, onSelectLayer }: {
  projection: JourneyPhysicalProjection;
  onSelectLayer: (layerId: JourneyPacketLayerId) => void;
}) {
  const reduceMotion = useReducedMotion();
  const switchActive = projection.activeDevice === 'switch';
  const routerActive = projection.activeDevice === 'router';
  const outgoing = projection.l2Envelope === 'wan';
  const envelope = outgoing ? projection.outgoing : projection.incoming;

  return <section
    className={`phase5b-physical phase5b-stage-${projection.stage} mode-${projection.frameMode} l2-${projection.l2Envelope} ${reduceMotion ? 'reduce-motion' : ''}`}
    data-phase5b-physical="true"
    data-phase5b-stage={projection.stage}
    data-phase5b-signature={projection.semanticSignature}
    data-phase5b-l2={projection.l2Envelope}
    data-phase5b-ttl={projection.currentTtl}
    data-phase5b-checksum={projection.currentChecksum}
    data-phase5b-selected-field={projection.selectedField}
    data-phase5b-incoming-frame={projection.incoming.semanticSignature}
    data-phase5b-outgoing-frame={projection.outgoing.semanticSignature}
    aria-label={`Physical packet journey, ${projection.stage.replaceAll('-', ' ')}`}
  >
    <header className="phase5b-instrument">
      <div><span>CONTINUITY / REQUEST 01</span><strong>{projection.continuityId}</strong></div>
      <div><span>DEVICE READS</span><strong>{projection.selectedField}</strong></div>
      <div><span>IP STATE</span><strong>{projection.destinationIp} · TTL {projection.currentTtl}</strong></div>
    </header>

    <div className="phase5b-world">
      <div className="phase5b-camera">
        <div className="phase5b-axis" aria-hidden="true"><i/><i/><i/><span>LAN / HOP 01</span><span>WAN / HOP 02</span></div>
        <div className={`phase5b-path path-a ${projection.activeDevice === 'link-a' ? 'is-active' : ''}`} data-locus="link-a" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
        <div className={`phase5b-path path-b ${projection.activeDevice === 'link-b' ? 'is-active' : ''}`} data-locus="link-b" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>

        <Device id="client" eyebrow="HOST / ORIGIN" label="CLIENT NIC" port="eth0 · 1 Gb/s" active={projection.activeDevice === 'client'}>
          <span className="phase5b-nic-queue">TX QUEUE <b>01</b></span>
        </Device>
        <Device id="switch" eyebrow="LAYER 2" label="ACCESS SWITCH" port="Gi0/3 → Gi0/24" active={switchActive}>
          <span className="phase5b-switch-ports" aria-hidden="true"><b/><b/><b/><b/><b/><b/></span>
        </Device>
        <Device id="router" eyebrow="LAYER 3" label="EDGE ROUTER" port="lan0 → wan0" active={routerActive}>
          <span className="phase5b-router-ring" aria-hidden="true"><b/><b/><b/></span>
        </Device>
        <Device id="next" eyebrow="NEXT HOP" label="198.51.100.2" port="WAN adjacency" active={false} />

        <div className="phase5b-serialization" aria-hidden="true">
          {signalCells.map((index) => <i key={index} style={{ '--signal-index': index } as CSSProperties}>{index % 3 === 0 ? '1' : '0'}</i>)}
        </div>

        <button type="button" className="phase5b-data-unit" onClick={() => onSelectLayer(projection.focusLayer)} aria-label={`Inspect ${projection.focusLayer} layer at ${projection.stage.replaceAll('-', ' ')}`}>
          <span className="phase5b-old-envelope" aria-hidden={projection.l2Envelope !== 'lan'}>
            <small>ETH / LAN</small><b>{projection.incoming.destinationMac}</b><em>14 B</em>
          </span>
          <span className="phase5b-ip-core">
            <small>IPv4 / CONTINUITY OBJECT</small>
            <b>{projection.destinationIp}</b>
            <em>TTL <strong>{projection.currentTtl}</strong> · {projection.currentChecksum}</em>
          </span>
          <span className="phase5b-transport-core"><small>{projection.continuityId.includes('quic-h3') ? 'UDP · QUIC' : 'TCP · TLS'}</small><b>PROTECTED REQUEST</b></span>
          <span className="phase5b-new-envelope" aria-hidden={projection.l2Envelope !== 'wan'}>
            <small>ETH / WAN</small><b>{projection.outgoing.destinationMac}</b><em>14 B</em>
          </span>
        </button>

        <section className="phase5b-mac-projection" aria-label="Switch MAC table projection">
          <header><span>DESTINATION MAC PROJECTION</span><strong>{projection.incoming.destinationMac}</strong></header>
          <div><small>MAC ADDRESS</small><small>PORT</small><small>TYPE</small></div>
          <div><b>{projection.incoming.sourceMac}</b><b>Gi0/3</b><em>LEARNED</em></div>
          <div className="is-match"><b>{projection.incoming.destinationMac}</b><b>Gi0/24</b><em>MATCH</em></div>
          <footer>FORWARD FRAME · HEADER UNCHANGED</footer>
        </section>

        <section className="phase5b-route-projection" aria-label="Router forwarding projection">
          <header><span>FORWARDING INFORMATION BASE</span><strong>LONGEST PREFIX MATCH</strong></header>
          <div className="phase5b-route-query"><small>DESTINATION IP</small><b>{projection.destinationIp}</b></div>
          <div className="phase5b-route-match"><small>PREFIX</small><b>203.0.113.0/24</b><small>NEXT HOP</small><b>198.51.100.2</b><small>EGRESS</small><b>wan0</b></div>
          <footer>TTL {projection.ttlBefore} → {projection.ttlAfter} · CHECKSUM {projection.checksumBefore} → {projection.checksumAfter}</footer>
        </section>
      </div>
    </div>

    <footer className="phase5b-continuity">
      <div className={projection.l2Envelope === 'lan' ? 'is-current' : 'is-complete'}><span>ETHERNET / HOP 01</span><strong>{projection.incoming.sourceMac} → {projection.incoming.destinationMac}</strong></div>
      <i aria-hidden="true"/>
      <div className="is-current"><span>IPv4 / ROUTED IDENTITY</span><strong>{projection.sourceIp} → {projection.destinationIp}</strong></div>
      <i aria-hidden="true"/>
      <div className={projection.l2Envelope === 'wan' ? 'is-current' : ''}><span>ETHERNET / HOP 02</span><strong>{projection.outgoing.sourceMac} → {projection.outgoing.destinationMac}</strong></div>
      <p>{projection.decision}</p>
    </footer>
  </section>;
}

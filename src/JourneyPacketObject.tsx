import { useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { JourneyPacketVisualProjection, JourneyPacketLayerId, JourneyPacketVisualLayer } from './journey/packet-visual.ts';
import './JourneyHeroChoreography.css';

function byteRange(start: number | null, length: number): string {
  if (start === null || length === 0) return 'SEMANTIC';
  return `B${start}–${start + length - 1}`;
}

export function JourneyPacketObject({ projection, onSelectLayer }: {
  projection: JourneyPacketVisualProjection;
  onSelectLayer: (layerId: JourneyPacketLayerId) => void;
}) {
  const reduceMotion = useReducedMotion();
  const layer = (id: JourneyPacketLayerId) => projection.layers.find((candidate) => candidate.id === id)!;
  const applicationLayer = layer('application');
  const securityLayer = layer('security');
  const transportLayer = layer('transport');
  const networkLayer = layer('network');
  const linkLayer = layer('link');
  const ttl = networkLayer.fields.find((field) => field.label.toLowerCase() === 'ttl')?.value ?? '64';

  const layerProps = (current: JourneyPacketVisualLayer) => ({
    className: `phase5c-layer phase5c-${current.id} phase5-packet-shell shell-${current.id} ${current.visible ? 'is-visible' : ''} ${current.active ? 'is-active' : ''}`,
    'data-phase5-layer': current.id,
    'data-visible': current.visible ? 'true' : 'false',
    tabIndex: current.visible ? 0 : -1,
    onClick: () => onSelectLayer(current.id),
  });

  return <section
    className={`phase5-packet-object phase5c-assembly phase5-stage-${projection.stage} ${projection.collapsed ? 'is-collapsed' : ''} ${projection.exploded ? 'is-exploded' : ''} ${reduceMotion ? 'reduce-motion' : ''}`}
    data-phase5-packet-object="true"
    data-phase5c-hero="assembly"
    data-phase5-stage={projection.stage}
    data-phase5-signature={projection.semanticSignature}
    aria-label={`Packet assembly, ${projection.title}`}
  >
    <div className="phase5c-void" aria-hidden="true"><i/><i/><i/></div>
    <div className="phase5c-camera phase5-packet-camera">
      <div className="phase5c-packet-shadow" aria-hidden="true"/>

      <div className="phase5c-protagonist" data-phase5c-protagonist="true">
        <button type="button" {...layerProps(applicationLayer)} aria-label="Inspect application layer">
          <span className="phase5c-app-mark">HTTP</span>
          <strong>GET /</strong>
          <small>REQUEST 01</small>
          <i/><i/><i/>
        </button>

        <button type="button" {...layerProps(securityLayer)} aria-label="Inspect protection layer">
          <span className="phase5c-security-orbit orbit-a"/><span className="phase5c-security-orbit orbit-b"/>
          <strong>{securityLayer.protocol}</strong>
          <small>PROTECTED</small>
        </button>

        <button type="button" {...layerProps(transportLayer)} aria-label={`Inspect ${transportLayer.protocol} layer`}>
          <span className="phase5c-transport-head">
            <small>SRC</small><b>52133</b><i/>
            <small>DST</small><b>443</b>
          </span>
          <span className="phase5c-transport-flags"><i/><i/><i/><i/><i/><i/></span>
          <strong>{transportLayer.protocol === 'TCP' ? 'TCP' : 'UDP / QUIC'}</strong>
        </button>

        <button type="button" {...layerProps(networkLayer)} aria-label="Inspect IPv4 layer">
          <span className="phase5c-network-wing wing-left"><i/><i/><i/></span>
          <span className="phase5c-network-wing wing-right"><i/><i/><i/></span>
          <span className="phase5c-ip-identity"><small>IPv4</small><strong>{networkLayer.headline}</strong></span>
          <span className="phase5c-ttl"><small>TTL</small><b>{ttl}</b></span>
        </button>

        <button type="button" {...layerProps(linkLayer)} aria-label="Inspect Ethernet layer">
          <span className="phase5c-ether-clamp clamp-header">
            <small>ETHERNET II</small><strong>{linkLayer.headline}</strong>
            <i/><i/><i/><i/><i/><i/>
          </span>
          <span className="phase5c-ether-clamp clamp-trailer"><small>NIC</small><strong>FCS</strong><i/><i/><i/></span>
          <span className="phase5c-ether-rails rail-top"/><span className="phase5c-ether-rails rail-bottom"/>
        </button>

        <div className="phase5c-collapse-spine phase5-frame-spine" data-fcs-note="NIC APPENDS" aria-hidden="true">
          <span>ETH</span><span>IP</span><span>{transportLayer.protocol === 'TCP' ? 'TCP' : 'UDP'}</span><span>DATA</span><span>FCS</span>
        </div>
      </div>

      <div className="phase5c-nic" aria-hidden="true">
        <span>NIC</span><i/><i/><i/><i/><i/><i/><b>TX</b>
      </div>
    </div>

    <div className="phase5c-beat" aria-hidden="true">
      <span>REQUEST / 01</span>
      <strong>{projection.stage === 'collapsed' ? 'FRAME READY' : projection.layers.find((candidate) => candidate.active)?.protocol ?? projection.title}</strong>
      <i/>
    </div>

    <div className="phase5c-layer-access" aria-label="Packet layers">
      {projection.layers.map((current) => (
        <button
          type="button"
          key={current.id}
          style={{ '--phase5c-order': current.order } as CSSProperties}
          className={current.visible ? 'is-visible' : ''}
          tabIndex={current.visible ? 0 : -1}
          onClick={() => onSelectLayer(current.id)}
          aria-label={`${current.protocol}, ${byteRange(current.byteStart, current.byteLength)}`}
        >
          <i/><span>{current.protocol}</span>
        </button>
      ))}
    </div>
  </section>;
}

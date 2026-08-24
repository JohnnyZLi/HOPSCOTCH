import { useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { JourneyPacketVisualProjection, JourneyPacketLayerId } from './journey/packet-visual.ts';
import './JourneyPacketObject.css';

const stageLabels = [
  ['application', 'APPLICATION'],
  ['security', 'PROTECTION'],
  ['transport', 'TRANSPORT'],
  ['network', 'NETWORK'],
  ['link', 'LINK'],
] as const;

function byteRange(start: number | null, length: number): string {
  if (start === null || length === 0) return 'SEMANTIC';
  return `B${start}–${start + length - 1}`;
}

export function JourneyPacketObject({ projection, onSelectLayer }: {
  projection: JourneyPacketVisualProjection;
  onSelectLayer: (layerId: JourneyPacketLayerId) => void;
}) {
  const reduceMotion = useReducedMotion();
  const transportLayer = projection.layers.find((layer) => layer.id === 'transport')!;
  const cameraStyle = {
    '--packet-camera-scale': projection.camera.scale,
    '--packet-camera-rx': `${projection.camera.rotateX}deg`,
    '--packet-camera-ry': `${projection.camera.rotateY}deg`,
    '--packet-camera-x': `${projection.camera.translateX}px`,
    '--packet-camera-y': `${projection.camera.translateY}px`,
  } as CSSProperties;

  return <section
    className={`phase5-packet-object phase5-stage-${projection.stage} ${projection.collapsed ? 'is-collapsed' : ''} ${projection.exploded ? 'is-exploded' : ''} ${reduceMotion ? 'reduce-motion' : ''}`}
    data-phase5-packet-object="true"
    data-phase5-stage={projection.stage}
    data-phase5-signature={projection.semanticSignature}
    aria-label={`Packet assembly, ${projection.title}`}
  >
    <header className="phase5-packet-instrument">
      <div><span>DATA UNIT / 01</span><strong>{projection.title}</strong></div>
      <div className="phase5-packet-vector"><span>DIRECTION</span><strong>{projection.direction}</strong></div>
      <div><span>INSPECTION SNAPSHOT</span><strong>{projection.frameBytes} B <small>+ 4 B NIC FCS</small></strong></div>
    </header>

    <div className="phase5-packet-scene">
      <div className="phase5-packet-coordinate" aria-hidden="true"><i/><i/><i/><span>X / LINK</span><span>Y / STACK</span></div>
      <div className="phase5-packet-camera" style={cameraStyle}>
        <div className="phase5-packet-shadow" aria-hidden="true"/>
        <div className="phase5-packet-core" aria-hidden="true"><i/><span>REQUEST / 01</span><b>GET /</b></div>
        <div className="phase5-packet-shells">
          {projection.layers.map((layer) => {
            const layerStyle = { '--phase5-layer-order': layer.order } as CSSProperties;
            return <button
              type="button"
              key={layer.id}
              className={`phase5-packet-shell shell-${layer.id} ${layer.visible ? 'is-visible' : ''} ${layer.active ? 'is-active' : ''}`}
              style={layerStyle}
              data-phase5-layer={layer.id}
              data-visible={layer.visible ? 'true' : 'false'}
              aria-pressed={projection.selectedLayerId === layer.id}
              aria-label={`${layer.protocol}, ${layer.role}, ${byteRange(layer.byteStart, layer.byteLength)}`}
              tabIndex={layer.visible ? 0 : -1}
              onClick={() => onSelectLayer(layer.id)}
            >
              <span className="phase5-shell-index">0{layer.order + 1}</span>
              <span className="phase5-shell-copy"><small>{layer.role}</small><strong>{layer.protocol}</strong><b>{layer.headline}</b></span>
              <span className="phase5-shell-bytes"><small>{byteRange(layer.byteStart, layer.byteLength)}</small><code>{layer.bytePreview}</code></span>
              {layer.id === 'link' && <span className="phase5-fcs-tab"><small>TRAILER</small><b>FCS</b><em>NIC</em></span>}
            </button>;
          })}
        </div>
        <div className="phase5-frame-spine" aria-hidden="true">
          <b className="spine-link"><small>ETH</small><strong>14 B</strong></b>
          <b className="spine-network"><small>IPv4</small><strong>20 B</strong></b>
          <b className="spine-transport"><small>{transportLayer.protocol === 'TCP' ? 'TCP' : 'UDP'}</small><strong>{transportLayer.byteLength} B</strong></b>
          <b className="spine-payload"><small>PROTECTED PAYLOAD</small><strong>{projection.payloadBytes} B</strong></b>
          <b className="spine-fcs"><small>NIC APPENDS</small><strong>FCS · 4 B</strong></b>
        </div>
      </div>

      <ol className="phase5-packet-sequence" aria-label="Encapsulation sequence">
        {stageLabels.map(([id, label], index) => {
          const layer = projection.layers.find((candidate) => candidate.id === id)!;
          return <li key={id} className={`${layer.visible ? 'is-visible' : ''} ${layer.active ? 'is-active' : ''}`}>
            <button type="button" disabled={!layer.visible} onClick={() => onSelectLayer(id)} aria-label={`Inspect ${label.toLowerCase()} layer`}>
              <span>0{index + 1}</span><i/><strong>{label}</strong>
            </button>
          </li>;
        })}
      </ol>
    </div>

    <footer className="phase5-packet-caption">
      <div><span>CONTINUITY OBJECT</span><strong>{projection.stage === 'link' || projection.collapsed || projection.exploded ? 'IPv4 packet inside a hop-local frame' : 'One request changing representation'}</strong></div>
      <p>{projection.layers.find((layer) => layer.active)?.detail}</p>
      <div className="phase5-packet-truth"><i/><span>DETERMINISTIC STATE</span><strong>ANIMATION = RENDERER</strong></div>
    </footer>
  </section>;
}

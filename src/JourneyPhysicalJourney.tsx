import { useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { JourneyPacketLayerId } from './journey/packet-visual.ts';
import type { JourneyPhysicalProjection } from './journey/physical-journey.ts';
import './JourneyHeroChoreography.css';
import './JourneyHeroOverrides.css';

const signalCells = Array.from({ length: 18 }, (_, index) => index);
const camCells = Array.from({ length: 8 }, (_, index) => index);

function Device({ id, eyebrow, label, port, active }: {
  id: string;
  eyebrow: string;
  label: string;
  port: string;
  active: boolean;
}) {
  return <div className={`phase5b-device device-${id} ${active ? 'is-active' : ''}`} data-device={id} aria-current={active ? 'step' : undefined}>
    <span>{eyebrow}</span><strong>{label}</strong><small>{port}</small>
    <div className="phase5c-device-body" aria-hidden="true">
      <i/><i/><i/><i/><i/><i/><i/><i/>
    </div>
  </div>;
}

export function JourneyPhysicalJourney({ projection, onSelectLayer }: {
  projection: JourneyPhysicalProjection;
  onSelectLayer: (layerId: JourneyPacketLayerId) => void;
}) {
  const reduceMotion = useReducedMotion();
  const switchActive = projection.activeDevice === 'switch';
  const routerActive = projection.activeDevice === 'router';
  const outgoing = projection.l2Envelope === 'wan';

  return <section
    className={`phase5b-physical phase5c-transit phase5b-stage-${projection.stage} mode-${projection.frameMode} l2-${projection.l2Envelope} ${reduceMotion ? 'reduce-motion' : ''}`}
    data-phase5b-physical="true"
    data-phase5c-hero="transit"
    data-phase5b-stage={projection.stage}
    data-phase5b-signature={projection.semanticSignature}
    data-phase5b-l2={projection.l2Envelope}
    data-phase5b-ttl={projection.currentTtl}
    data-phase5b-checksum={projection.currentChecksum}
    data-phase5b-selected-field={projection.selectedField}
    data-phase5b-incoming-frame={projection.incoming.semanticSignature}
    data-phase5b-outgoing-frame={projection.outgoing.semanticSignature}
    aria-label={`Animated physical packet journey, ${projection.stage.replaceAll('-', ' ')}`}
  >
    <div className="phase5c-void" aria-hidden="true"><i/><i/><i/></div>

    <svg className="phase5c-link-map" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
      <path className="phase5c-wire-path access-link" d="M155 330 C270 285 365 290 455 300"/>
      <path className="phase5c-wire-path switch-router-link" d="M505 300 C610 292 680 290 745 285"/>
      <path className="phase5c-wire-path wan-link" d="M790 280 C870 245 925 205 982 165"/>
      <path className="phase5c-route-ghost route-one" d="M756 274 C820 216 884 208 944 234"/>
      <path className="phase5c-route-ghost route-two" d="M756 274 C828 274 884 274 954 274"/>
      <path className="phase5c-route-ghost route-three" d="M756 274 C820 332 884 338 944 310"/>
    </svg>

    <div className="phase5b-world">
      <div className="phase5b-camera">
        <Device id="client" eyebrow="HOST" label="CLIENT NIC" port="eth0" active={projection.activeDevice === 'client'}/>
        <Device id="switch" eyebrow="L2" label="ACCESS SWITCH" port="Gi0/3 · Gi0/24" active={switchActive}/>
        <Device id="router" eyebrow="L3" label="EDGE ROUTER" port="lan0 · wan0" active={routerActive}/>
        <Device id="next" eyebrow="NEXT HOP" label="198.51.100.2" port="WAN" active={false}/>

        <div className={`phase5b-path path-a ${projection.activeDevice === 'link-a' ? 'is-active' : ''}`} data-locus="link-a" aria-hidden="true"/>
        <div className={`phase5b-path path-b ${projection.activeDevice === 'link-b' ? 'is-active' : ''}`} data-locus="link-b" aria-hidden="true"/>

        <div className="phase5b-serialization" aria-hidden="true">
          {signalCells.map((index) => <i key={index} style={{ '--signal-index': index } as CSSProperties}>{index % 3 === 0 ? '1' : index % 3 === 1 ? '0' : '·'}</i>)}
        </div>

        <button
          type="button"
          className="phase5b-data-unit"
          onClick={() => onSelectLayer(projection.focusLayer)}
          aria-label={`Inspect ${projection.focusLayer} layer at ${projection.stage.replaceAll('-', ' ')}`}
        >
          <span className="phase5c-frame-shell shell-lan">
            <i className="phase5c-frame-rail rail-a"/><i className="phase5c-frame-rail rail-b"/>
            <small>ETH / LAN</small><strong>{projection.incoming.destinationMac}</strong>
          </span>

          <span className="phase5b-ip-core">
            <small>IPv4</small>
            <b>{projection.destinationIp}</b>
            <span className="phase5c-ttl-rotor" aria-label={`TTL ${projection.currentTtl}`}>
              <small>TTL</small>
              <i className="ttl-before">64</i>
              <i className="ttl-after">63</i>
            </span>
            <em>{projection.currentChecksum}</em>
          </span>

          <span className="phase5b-transport-core"><small>{projection.continuityId.includes('quic-h3') ? 'UDP · QUIC' : 'TCP · TLS'}</small><b>REQUEST / 01</b></span>

          <span className="phase5c-frame-shell shell-wan">
            <i className="phase5c-frame-rail rail-a"/><i className="phase5c-frame-rail rail-b"/>
            <small>ETH / WAN</small><strong>{projection.outgoing.destinationMac}</strong>
          </span>

          <span className="phase5c-mac-token" aria-hidden="true">
            <small>DST MAC</small><b>{projection.incoming.destinationMac}</b>
          </span>
          <span className="phase5c-ip-token" aria-hidden="true">
            <small>DST IP</small><b>{projection.destinationIp}</b>
          </span>
        </button>

        <section className="phase5b-mac-projection" aria-label="Switch MAC table projection">
          <span className="phase5c-cam-title">CAM</span>
          <div className="phase5c-cam-bank">
            {camCells.map((index) => (
              <i key={index} className={index === 5 ? 'is-match' : ''} style={{ '--cam-index': index } as CSSProperties}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <b>{index === 5 ? projection.incoming.destinationMac : `02:48:4F:${String(18 + index).padStart(2, '0')}:A${index}:0${index}`}</b>
                <em>{index === 5 ? 'Gi0/24' : `Gi0/${index + 7}`}</em>
              </i>
            ))}
          </div>
          <strong className="phase5c-port-lock">Gi0/24</strong>
        </section>

        <section className="phase5b-route-projection" aria-label="Router forwarding projection">
          <span className="phase5c-route-origin"><i/>DST IP</span>
          <div className="phase5c-route-fan" aria-hidden="true">
            <i className="route-candidate candidate-a"/><i className="route-candidate candidate-b"/><i className="route-candidate candidate-c"/>
            <b className="route-node node-a">/16</b><b className="route-node node-b">/24</b><b className="route-node node-c">/0</b>
          </div>
          <strong className="phase5c-route-lock">203.0.113.0/24 <i/> 198.51.100.2</strong>
        </section>

        <div className="phase5c-port-flare switch-flare" aria-hidden="true"><i/><i/><i/></div>
        <div className="phase5c-port-flare router-flare" aria-hidden="true"><i/><i/><i/></div>
      </div>
    </div>

    <div className="phase5c-beat" aria-hidden="true">
      <span>REQUEST / 01</span>
      <strong>{projection.stage === 'router-ttl' ? `TTL ${projection.ttlBefore} → ${projection.ttlAfter}` : projection.selectedField}</strong>
      <i/>
    </div>

    <div className="phase5c-continuity-mark" aria-hidden="true">
      <i/><span>IPv4 CONTINUITY</span><strong>{outgoing ? 'HOP 02' : projection.l2Envelope === 'none' ? 'ROUTING' : 'HOP 01'}</strong>
    </div>
  </section>;
}

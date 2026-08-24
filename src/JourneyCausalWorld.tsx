import { useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { JourneyPacketLayerId, JourneyPacketVisualProjection } from './journey/packet-visual.ts';
import type { JourneyPhysicalProjection } from './journey/physical-journey.ts';
import type { JourneyState } from './journey/model.ts';
import { JourneyPacketObject } from './JourneyPacketObject.tsx';
import { JourneyPhysicalJourney } from './JourneyPhysicalJourney.tsx';
import './JourneyCausalWorld.css';

type CausalPhase = 'intent' | 'dns' | 'route' | 'path' | 'tcp' | 'tls' | 'http' | 'packet' | 'response' | 'complete';

const dnsActors = [
  { id: 'recursive', label: 'recursive', detail: 'finishes the question' },
  { id: 'root', label: 'root', detail: 'points to .test' },
  { id: 'tld', label: '.test', detail: 'points to authority' },
  { id: 'authority', label: 'authoritative', detail: 'owns the answer' },
] as const;

const cipherCells = Array.from({ length: 24 }, (_, index) => index);

function phaseFor(state: JourneyState): CausalPhase {
  const kind = state.activeEvent.kind;
  if (kind === 'intent.accepted') return 'intent';
  if (kind.startsWith('dns.')) return 'dns';
  if (kind.startsWith('route.')) return 'route';
  if (kind.startsWith('internet.')) return 'path';
  if (kind.startsWith('transport.')) {
    if (state.transportProfile === 'quic-h3' && state.activeEvent.id === 'quic-established') return 'tls';
    if (state.timeMs < 6000) return 'tcp';
  }
  if (kind.startsWith('tls.')) return 'tls';
  if (kind.startsWith('http.')) return state.responseReady ? 'response' : 'http';
  if (kind.startsWith('packet.')) return 'packet';
  if (kind === 'response.ready' || kind === 'transfer.complete') return 'response';
  if (kind === 'journey.complete') return 'complete';
  if (kind === 'camera.pullback') return state.scale === 'internet' ? 'complete' : 'response';
  return state.timeMs >= 19000 ? 'response' : 'http';
}

function eventToken(state: JourneyState): string {
  return state.activeEvent.id.replace(/[^a-z0-9-]/gi, '-');
}

function dnsProgress(state: JourneyState): number {
  if (state.dnsProfile === 'cache-hit') return state.dns === 'idle' ? 0 : 1;
  const order = ['dns-cache', 'dns-recursive', 'dns-root', 'dns-tld', 'dns-answer', 'dns-store'];
  return Math.max(0, order.indexOf(state.activeEvent.id));
}

function tcpProgress(state: JourneyState): number {
  if (state.transportProfile === 'quic-h3') {
    if (state.transport === 'established' || state.transport === 'complete') return 3;
    if (state.activeEvent.id === 'quic-server-initial') return 2;
    if (state.activeEvent.id === 'quic-initial') return 1;
    return state.tls === 'handshake-keys' || state.tls === 'application-keys' ? 2 : 0;
  }
  if (state.transport === 'established' || state.transport === 'complete') return 3;
  if (state.activeEvent.id === 'tcp-synack') return 2;
  if (state.activeEvent.id === 'tcp-syn') return 1;
  return 0;
}

function tlsProgress(state: JourneyState): number {
  if (state.tls === 'application-keys') return 5;
  if (state.activeEvent.id === 'tls-certificate') return 4;
  if (state.tls === 'handshake-keys') return 3;
  if (state.activeEvent.id === 'tls-serverhello') return 2;
  if (state.tls === 'negotiating') return 1;
  return 0;
}

function annotationFor(state: JourneyState): { index: string; label: string; note: string } {
  const phase = phaseFor(state);
  if (phase === 'intent') return { index: '01', label: 'Intent becomes a dependency', note: 'The hostname is the first causal object.' };
  if (phase === 'dns') {
    if (state.dnsProfile === 'cache-hit') return { index: '02', label: 'Local answer', note: 'The cache closes the dependency. No upstream query exists.' };
    if (state.activeEvent.id === 'dns-cache') return { index: '02', label: 'Cache opens', note: 'No reusable record is present.' };
    if (state.activeEvent.id === 'dns-answer' || state.activeEvent.id === 'dns-store') return { index: '02', label: 'Name gains an address', note: 'The answer docks into the same request object.' };
    return { index: '02', label: 'Namespace walk', note: 'One A question advances through authority.' };
  }
  if (phase === 'route' || phase === 'path') return { index: '03', label: 'Destination selects a path', note: 'Candidates fan out; the viable next hop locks.' };
  if (phase === 'tcp') return { index: '04', label: 'Transport reacts on arrival', note: 'SYN, SYN-ACK, and ACK alter endpoint state.' };
  if (phase === 'tls') return { index: '05', label: 'Protection assembles', note: 'Negotiated parameters lock before the payload turns opaque.' };
  if (phase === 'http') return { index: '06', label: 'Request ready', note: 'HTTP meaning flows directly into packet assembly.' };
  if (phase === 'packet') return { index: '07', label: 'One object, deeper scale', note: 'Deterministic packet truth now drives the existing choreography.' };
  if (phase === 'response') return { index: '08', label: 'Response returns', note: 'The established world carries application data back.' };
  return { index: '09', label: 'Intent satisfied', note: 'The same timeline can reconstruct every causal boundary.' };
}

function DnsWorld({ state, hostname }: { state: JourneyState; hostname: string }) {
  const progress = dnsProgress(state);
  const hit = state.dnsProfile === 'cache-hit';
  const answerVisible = state.resolvedAddress !== null;
  const labels = hostname.split('.');
  return <div className={`causal-dns-world ${hit ? 'is-hit' : 'is-miss'} dns-progress-${progress}`} data-causal-dns="true" aria-hidden={phaseFor(state) !== 'dns'}>
    <div className="causal-cache" data-causal-cache={hit ? 'hit' : state.activeEvent.id === 'dns-store' ? 'stored' : 'miss'} aria-label={`DNS cache ${hit ? 'hit' : 'miss'}`}>
      <div className="causal-cache__lid"><span>resolver cache</span><i/><i/><i/></div>
      <div className="causal-cache__tray"><i/><i/><i/><span className="causal-cache__record"><b>{hostname}</b><strong>{state.resolvedAddress ?? '203.0.113.42'}</strong><small>TTL {state.dnsTtlSeconds ?? 300}s</small></span></div>
      <div className="causal-cache__status"><i/><span>{hit ? 'record found' : state.activeEvent.id === 'dns-store' ? 'record stored' : 'empty slot'}</span></div>
    </div>

    <svg className="causal-dns-thread" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true">
      <path className="dns-thread-base" d="M270 222 C390 130 470 128 545 190 S685 276 774 180 S880 104 944 178"/>
      <path className="dns-thread-progress" pathLength="1" d="M270 222 C390 130 470 128 545 190 S685 276 774 180 S880 104 944 178"/>
      <path className="dns-answer-thread" d="M936 190 C786 308 613 314 338 246"/>
    </svg>

    <div className="causal-namespace" aria-label={hit ? 'Upstream DNS skipped' : 'DNS namespace traversal'}>
      {dnsActors.map((actor, index) => <div key={actor.id} className={`causal-authority causal-authority--${actor.id} ${progress >= index + 1 ? 'is-reached' : ''}`} data-dns-authority={actor.id}>
        <i/><span>{actor.label}</span><small>{actor.detail}</small>
      </div>)}
    </div>

    {!hit && <div key={state.activeEvent.id} className={`causal-dns-query query-${state.activeEvent.id}`} data-dns-query={state.activeEvent.id} aria-hidden="true">
      <small>A</small>{labels.map((label, index) => <span key={`${label}-${index}`} className={index === labels.length - 1 ? 'namespace-focus' : ''}>{label}</span>)}<b>?</b>
    </div>}
    <div key={`answer-${state.activeEvent.id}`} className={`causal-dns-answer ${answerVisible ? 'is-visible' : ''}`} data-dns-answer={answerVisible ? 'available' : 'pending'} aria-hidden="true">
      <small>A</small><b>{state.resolvedAddress ?? '203.0.113.42'}</b><i/>
    </div>
    {hit && <div className="causal-dns-skip"><i/><span>upstream resolution skipped</span></div>}
  </div>;
}

function RouteWorld({ state, address }: { state: JourneyState; address: string }) {
  const selected = state.route === 'gateway-ready' || state.route === 'internet-path-ready' || state.transport !== 'closed';
  const phase = phaseFor(state);
  return <div className={`causal-route-world ${selected ? 'is-selected' : ''}`} data-causal-route={state.route} aria-hidden={phase !== 'route' && phase !== 'path'}>
    <svg className="causal-route-fan" viewBox="0 0 760 420" preserveAspectRatio="none" aria-hidden="true">
      <path className="route-candidate route-candidate--specific" d="M100 210 C240 118 374 94 650 86"/>
      <path className="route-candidate route-candidate--network" d="M100 210 C278 204 410 205 650 210"/>
      <path className="route-candidate route-candidate--default" d="M100 210 C246 300 410 332 650 334"/>
      <path className="route-selected" d="M100 210 C246 300 410 332 650 334"/>
    </svg>
    <div className="causal-route-choice choice-specific"><i/><span>{address}/32</span><small>no local host route</small></div>
    <div className="causal-route-choice choice-network"><i/><span>203.0.113.0/24</span><small>remote network</small></div>
    <div className="causal-route-choice choice-default"><i/><span>0.0.0.0/0</span><small>via 192.0.2.1</small></div>
    <div className="causal-gateway"><i className="gateway-ring"/><i className="gateway-core"/><span>gateway</span><strong>192.0.2.1</strong><small>eth0</small></div>
    <div className="causal-path-context"><span>access</span><i/><span>edge</span><i/><span>origin</span></div>
  </div>;
}

function TcpWorld({ state }: { state: JourneyState }) {
  const progress = tcpProgress(state);
  const quic = state.transportProfile === 'quic-h3';
  const active = state.activeEvent.id.startsWith('tcp-')
    ? state.activeEvent.id.replace('tcp-', '')
    : state.activeEvent.id === 'quic-initial'
      ? 'initial'
      : state.activeEvent.id === 'quic-server-initial'
        ? 'server-initial'
        : '';
  const clientState = quic
    ? progress >= 3 ? '1-RTT' : progress >= 1 ? 'INITIAL SENT' : 'IDLE'
    : progress >= 3 ? 'ESTABLISHED' : progress >= 1 ? 'SYN-SENT' : 'CLOSED';
  const serverState = quic
    ? progress >= 3 ? '1-RTT' : progress >= 2 ? 'HANDSHAKE' : 'LISTEN'
    : progress >= 3 ? 'ESTABLISHED' : progress >= 2 ? 'SYN-RECEIVED' : 'LISTEN';
  const flightLabel = active === 'synack' ? 'SYN · ACK' : active === 'server-initial' ? 'INITIAL · HANDSHAKE' : active === 'initial' ? 'QUIC INITIAL' : active.toUpperCase();
  const reverse = active === 'synack' || active === 'server-initial';
  return <div className={`causal-tcp-world tcp-progress-${progress} ${quic ? 'is-quic' : ''}`} data-causal-tcp={state.transport} aria-hidden={phaseFor(state) !== 'tcp'}>
    <svg viewBox="0 0 1000 380" preserveAspectRatio="none" aria-hidden="true"><path d="M170 196 C382 128 625 128 835 196"/><path className="transport-lock" d="M170 196 C382 128 625 128 835 196"/></svg>
    <div className={`causal-endpoint endpoint-client ${progress >= 1 ? 'is-awake' : ''} ${progress >= 3 ? 'is-established' : ''}`}><i/><b/><span>{quic ? 'QUIC client' : 'client'}</span><strong>{clientState}</strong></div>
    <div className={`causal-endpoint endpoint-server ${progress >= 2 ? 'is-awake' : ''} ${progress >= 3 ? 'is-established' : ''}`}><i/><b/><span>{quic ? 'QUIC origin :443' : 'origin :443'}</span><strong>{serverState}</strong></div>
    {active && <div key={state.activeEvent.id} className={`causal-tcp-flight flight-${active}`} data-tcp-flight={active} aria-hidden="true"><i/><strong>{flightLabel}</strong><small>{reverse ? 'server → client' : 'client → server'}</small></div>}
    <div className="causal-sequence-mark sequence-client"><span>{quic ? 'pn' : 'seq'}</span><b>{quic ? 'INITIAL' : '1000'}</b></div>
    <div className="causal-sequence-mark sequence-server"><span>{quic ? 'crypto' : 'seq'}</span><b>{quic ? 'TLS 1.3' : '7000'}</b></div>
  </div>;
}

function TlsWorld({ state, hostname }: { state: JourneyState; hostname: string }) {
  const progress = tlsProgress(state);
  const locked = progress >= 2;
  const fields = [
    ['SNI', hostname],
    ['ALPN', state.transportProfile === 'quic-h3' ? 'h3' : 'h2'],
    ['VERSIONS', 'TLS 1.3'],
    ['KEY SHARE', 'X25519'],
  ];
  return <div className={`causal-tls-world tls-progress-${progress} ${locked ? 'is-locked' : ''}`} data-causal-tls={state.tls} aria-hidden={phaseFor(state) !== 'tls'}>
    <svg className="causal-tls-leaders" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
      <path d="M500 258 L284 124 L112 124"/><path d="M500 258 L716 124 L888 124"/><path d="M500 258 L284 392 L112 392"/><path d="M500 258 L716 392 L888 392"/>
    </svg>
    <div className="causal-client-hello"><span>ClientHello</span><strong>{progress <= 1 ? 'unfolding' : locked ? 'parameters selected' : 'ready'}</strong><i/></div>
    <div className="causal-tls-fields">{fields.map(([label, value], index) => <div key={label} style={{ '--tls-field-index': index } as CSSProperties} className={locked && index > 0 ? 'is-selected' : ''}><span>{label}</span><strong>{value}</strong><i/></div>)}</div>
    <div className="causal-tls-server"><i/><span>server selection</span><strong>{locked ? `${state.transportProfile === 'quic-h3' ? 'h3' : 'h2'} · TLS 1.3 · X25519` : 'waiting'}</strong></div>
    <div className="causal-key-boundary"><i/><span>{progress >= 5 ? 'application protection' : progress >= 3 ? 'handshake protection' : 'negotiation visible'}</span><i/></div>
  </div>;
}

export function JourneyCausalWorld({ state, hostname, address, packetProjection, physicalProjection, onSelectLayer }: {
  state: JourneyState;
  hostname: string;
  address: string;
  packetProjection: JourneyPacketVisualProjection;
  physicalProjection: JourneyPhysicalProjection;
  onSelectLayer: (layerId: JourneyPacketLayerId) => void;
}) {
  const reduceMotion = useReducedMotion();
  const phase = phaseFor(state);
  const annotation = annotationFor(state);
  const encrypted = state.tls === 'handshake-keys' || state.tls === 'application-keys';
  const applicationProtected = state.tls === 'application-keys';
  const packetActive = state.activeEvent.kind === 'packet.assembly' || state.activeEvent.kind === 'packet.inspect';
  const transitActive = state.activeEvent.kind === 'packet.transit';
  const pathVisible = phase === 'path' || phase === 'tcp' || phase === 'tls' || phase === 'http' || phase === 'response' || phase === 'complete';

  return <section
    className={`journey-scene journey-causal-world causal-phase-${phase} causal-event-${eventToken(state)} ${encrypted ? 'is-encrypted' : ''} ${applicationProtected ? 'is-application-protected' : ''} ${packetActive || transitActive ? 'is-packet-world' : ''} ${reduceMotion ? 'reduce-motion' : ''}`}
    data-journey-causal-world="true"
    data-causal-phase={phase}
    data-causal-event={state.activeEvent.id}
    aria-label={`Continuous Journey world, ${state.activeEvent.title}`}
  >
    <div className="causal-field" aria-hidden="true"><i/><i/><i/><span/></div>
    <svg className="causal-world-thread" viewBox="0 0 1400 760" preserveAspectRatio="none" aria-hidden="true"><path d="M100 430 C270 330 420 344 570 392 S880 470 1040 354 S1240 282 1340 330"/></svg>

    <div className="causal-camera">
      <div className="causal-object" data-causal-object="request-01">
        <div className="causal-object__index"><span>request</span><b>01</b></div>
        <div className="causal-object__intent"><small>intent / hostname</small><strong>{hostname}</strong><i/></div>
        <div className={`causal-object__address ${state.resolvedAddress ? 'is-docked' : ''}`}><small>destination IPv4</small><strong>{state.resolvedAddress ?? address}</strong><i/></div>
        <div className="causal-object__payload">
          <span className="payload-clear"><small>{state.transportProfile === 'quic-h3' ? 'HTTP/3' : 'HTTP/2'}</small><strong>GET /</strong><b>{hostname}</b></span>
          <span className="payload-cipher" aria-label={applicationProtected ? 'Protected application payload' : 'Application payload not protected'}>{cipherCells.map((cell) => <i key={cell} style={{ '--cipher-index': cell } as CSSProperties}/>)}</span>
        </div>
        <div className="causal-object__spine"><i/><i/><i/><i/><i/><i/></div>
      </div>

      <DnsWorld state={state} hostname={hostname}/>
      <RouteWorld state={state} address={address}/>
      <div className={`causal-network-path ${pathVisible ? 'is-visible' : ''}`} aria-hidden="true"><i/><i/><i/><span>selected path</span></div>
      <TcpWorld state={state}/>
      <TlsWorld state={state} hostname={hostname}/>
      <div className="causal-http-flight" aria-hidden="true"><i/><span>{state.transportProfile === 'quic-h3' ? 'HTTP/3 request' : 'HTTP/2 HEADERS'}</span><strong>GET /</strong><b/></div>
      <div className="causal-response-flight" aria-hidden="true"><i/><span>response</span><strong>200</strong><b/></div>
    </div>

    <aside className="causal-annotation" aria-hidden="true"><i/><div><span>{annotation.index}</span><strong>{annotation.label}</strong><small>{annotation.note}</small></div></aside>
    <div className="causal-continuity" aria-hidden="true"><span>intent</span><i/><span>name</span><i/><span>address</span><i/><span>path</span><i/><span>connection</span><i/><span>protected request</span></div>

    {packetActive && <div className="causal-phase5-layer causal-phase5-layer--assembly"><JourneyPacketObject projection={packetProjection} onSelectLayer={onSelectLayer}/></div>}
    {transitActive && <div className="causal-phase5-layer causal-phase5-layer--transit"><JourneyPhysicalJourney projection={physicalProjection} onSelectLayer={onSelectLayer}/></div>}
  </section>;
}

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { InternetEvidenceError, InternetEvidenceSnapshot } from './internet/evidence';
import { JourneyCongestionPanel } from './JourneyCongestionPanel';
import { JourneyServerFailurePanel } from './JourneyServerFailurePanel';
import { MeasuredEvidenceSidecar } from './MeasuredEvidenceSidecar';
import type { MeasuredSnapshotState } from './measurement/state.ts';
import { JourneyLatencyPanel } from './JourneyLatencyPanel';
import { JourneyCausalWorld } from './JourneyCausalWorld';
import { JourneyPacketObject } from './JourneyPacketObject';
import { JourneyPhysicalJourney } from './JourneyPhysicalJourney';
import { JourneyPolicyLeakPanel } from './JourneyPolicyLeakPanel';
import {
  VisualDrawerTabs,
  VisualTimeRail,
  VisualWorkspaceShell,
  useVisualPresentationPlayback,
  type VisualDrawerDefinition,
  type VisualDrawerId,
  type VisualTimelineEvent,
  type VisualTimelineMilestone,
} from './VisualWorkspace';
import { readJourneyBrowserConfig, writeJourneyBrowserConfig } from './journey/browser.ts';
import {
  buildJourneyScenario,
  JOURNEY_SCALE_DEPTH,
  journeyStateAt,
  normalizeJourneyHostname,
  type JourneyDetailLab,
  type JourneyDnsProfile,
  type JourneyModifierId,
  type JourneyScale,
  type JourneyState,
  type JourneyTransportProfile,
} from './journey/model';
import { impairmentProfileForModifiers, resolveJourneyModifierIds } from './journey/modifiers.ts';
import { projectJourneyPacketVisual, type JourneyPacketLayerId, type JourneyPacketVisualProjection } from './journey/packet-visual.ts';
import { projectJourneyPhysicalState, type JourneyPhysicalProjection } from './journey/physical-journey.ts';
import './JourneyTheater.css';
import './journey-branch.css';
import './journey-god-mode.css';

const scaleOrder: JourneyScale[] = ['internet', 'routing', 'transport', 'application', 'packet'];

function initialBrowserConfig() {
  if (typeof sessionStorage === 'undefined') {
    return { transportProfile: 'tcp-h2' as const, dnsProfile: 'cache-miss' as const, impairmentProfile: 'clean' as const };
  }
  return readJourneyBrowserConfig();
}

function formatTime(timeMs: number): string {
  const seconds = Math.floor(timeMs / 1000).toString().padStart(2, '0');
  const milliseconds = Math.floor(timeMs % 1000).toString().padStart(3, '0');
  return `00:${seconds}.${milliseconds}`;
}

function provenanceClass(value: string): string {
  return value.toLowerCase().replaceAll(' ', '-');
}

function isLossEvent(kind: string): boolean {
  return kind.startsWith('transport.loss') || kind === 'transport.retransmit' || kind === 'transport.recovered';
}

function isLatencyEvent(kind: string): boolean {
  return kind === 'transport.latency' || kind === 'transport.rtt-update' || kind === 'transport.latency-cleared';
}

function isRouteFailureEvent(kind: string): boolean {
  return kind === 'route.failure' || kind === 'route.invalidated' || kind === 'route.recompute' || kind === 'route.alternate-installed';
}

function isCongestionEvent(kind: string): boolean {
  return kind === 'transport.queue-growth' || kind === 'transport.ecn-mark' || kind === 'transport.congestion-response' || kind === 'transport.congestion-cleared';
}

function isDnsFailureEvent(kind: string): boolean {
  return kind === 'dns.timeout' || kind === 'dns.retry' || kind === 'dns.failure-masked';
}

function isServerFailureEvent(kind: string): boolean {
  return kind === 'server.unavailable' || kind === 'http.service-unavailable' || kind === 'http.retry-wait' || kind === 'server.recovered' || kind === 'http.retry';
}

function isPolicyLeakEvent(kind: string): boolean {
  return kind === 'internet.route-leak-advertised' || kind === 'internet.route-leak-selected' || kind === 'internet.policy-anomaly' || kind === 'internet.route-leak-withdrawn' || kind === 'internet.policy-restored';
}

function isPartitionEvent(kind: string): boolean {
  return kind === 'route.partition' || kind === 'route.partition-recompute' || kind === 'route.unreachable' || kind === 'transport.stalled' || kind === 'journey.failed';
}

function modifierLabel(modifierIds: readonly JourneyModifierId[]): string {
  if (modifierIds.length === 0) return 'CLEAN';
  return modifierIds.map((id) => id === 'dns-failure' ? 'DNS FAIL' : id === 'route-failure' ? 'ROUTE' : id === 'route-leak' ? 'LEAK' : id === 'server-failure' ? 'SERVER' : id === 'single-loss' ? 'LOSS' : id === 'latency-spike' ? 'LATENCY' : id === 'path-outage' ? 'OUTAGE' : id === 'congestion' ? 'CONGESTION' : 'PARTITION').join(' + ');
}

function stateToneClass(state: JourneyState): string {
  if (state.impairmentState === 'dns-failed' || state.impairmentState === 'dns-retrying') return 'dns-failure-active';
  if (state.impairmentState === 'dns-masked') return 'dns-masked-active';
  if (state.impairmentState === 'server-unavailable' || state.impairmentState === 'server-waiting') return 'server-failure-active';
  if (state.impairmentState === 'server-ready') return 'server-ready-active';
  if (state.impairmentState === 'policy-leak' || state.impairmentState === 'policy-anomaly') return 'policy-leak-active';
  if (state.impairmentState === 'policy-restored') return 'policy-restored-active';
  if (state.impairmentState === 'partitioned' || state.impairmentState === 'partition-recomputing' || state.impairmentState === 'unreachable') return 'partition-active';
  if (state.impairmentState === 'lost' || state.impairmentState === 'detected' || state.impairmentState === 'recovering') return 'impairment-active';
  if (state.impairmentState === 'delayed' || state.impairmentState === 'estimating') return 'latency-active';
  if (state.impairmentState === 'queueing' || state.impairmentState === 'ecn-signaled' || state.impairmentState === 'congestion-responding') return 'congestion-active';
  if (state.impairmentState === 'route-failed') return 'route-failed';
  if (state.impairmentState === 'route-recomputing') return 'route-recomputing';
  if (state.impairmentState === 'route-ready') return 'route-ready';
  return '';
}

function calloutToneClass(state: JourneyState): string {
  if (state.impairmentState === 'dns-failed' || state.impairmentState === 'dns-retrying') return 'dns-failure-callout';
  if (state.impairmentState === 'dns-masked') return 'dns-masked-callout';
  if (state.impairmentState === 'server-unavailable' || state.impairmentState === 'server-waiting') return 'server-failure-callout';
  if (state.impairmentState === 'server-ready') return 'server-ready-callout';
  if (state.impairmentState === 'policy-leak' || state.impairmentState === 'policy-anomaly') return 'policy-leak-callout';
  if (state.impairmentState === 'policy-restored') return 'policy-restored-callout';
  if (state.impairmentState === 'partitioned' || state.impairmentState === 'partition-recomputing' || state.impairmentState === 'unreachable') return 'partition-callout';
  if (state.impairmentState === 'lost' || state.impairmentState === 'detected' || state.impairmentState === 'recovering') return 'impairment-callout';
  if (state.impairmentState === 'delayed' || state.impairmentState === 'estimating') return 'latency-callout';
  if (state.impairmentState === 'queueing' || state.impairmentState === 'ecn-signaled' || state.impairmentState === 'congestion-responding') return 'congestion-callout';
  if (state.impairmentState === 'route-failed') return 'route-failure-callout';
  if (state.impairmentState === 'route-recomputing') return 'route-recompute-callout';
  if (state.impairmentState === 'route-ready') return 'route-ready-callout';
  return '';
}

function usesCausalWorld(state: JourneyState): boolean {
  return state.modifierIds.length === 0 && !state.journeyFailed;
}

function sceneMode(state: JourneyState): string {
  if (usesCausalWorld(state)) return 'causal-world';
  if (state.journeyFailed) return 'failure';
  if (state.scale !== 'application') return `${state.scale}:${state.transportProfile}:${state.activeEvent.kind}`;
  if (state.protocol === 'DNS') return `dns:${state.dnsProfile}`;
  if (state.protocol.includes('TLS')) return `tls:${state.transportProfile}`;
  if (state.protocol.startsWith('HTTP')) return `http:${state.transportProfile}:${state.activeEvent.kind}`;
  return state.journeyComplete || state.responseReady ? 'response' : 'intent';
}

function InternetScene({ state }: { state: JourneyState }) {
  if (isPolicyLeakEvent(state.activeEvent.kind)) return <JourneyPolicyLeakPanel state={state}/>;
  return <div className="journey-scene internet-scene">
    <div className="journey-world"><i className="orbit o1"/><i className="orbit o2"/><i className="orbit o3"/><b className="as-node source">AS ACCESS</b><b className="as-node transit">TRANSIT</b><b className="as-node destination">CONTENT AS</b><span className="facility-dot f1"/><span className="facility-dot f2"/><span className="facility-dot f3"/><svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M17 42 C34 20 55 17 82 34"/><path className="physical" d="M18 45 C44 66 69 2 84 31"/></svg></div>
    <div className="scene-caption"><span>{state.protocol}</span><strong>{state.phase === 'pullback-internet' ? 'GLOBAL CONTEXT RESTORED' : 'INTERDOMAIN CONTEXT'}</strong><p>{state.phase === 'infrastructure-context' ? 'Public infrastructure can decorate geography. The forwarding story remains simulated.' : 'Policy chooses the simulated AS path; external observations stay separate evidence.'}</p></div>
  </div>;
}

function RoutingScene({ state, address }: { state: JourneyState; address: string }) {
  const ready = state.route === 'gateway-ready' || state.route === 'internet-path-ready';
  const routeSelected = state.modifierIds.includes('route-failure') || state.modifierIds.includes('path-outage') || state.modifierIds.includes('partition');
  if (!routeSelected) {
    return <div className="journey-scene routing-scene">
      <div className="route-topology"><div className="route-node endpoint"><span>HOST</span><strong>CLIENT</strong></div><i className="route-link active"/><div className={`route-node ${ready ? 'active' : ''}`}><span>NEXT HOP</span><strong>EDGE</strong></div><i className={`route-link ${ready ? 'active' : ''}`}/><div className={`route-node ${ready ? 'active' : ''}`}><span>ROUTE</span><strong>CORE</strong></div><i className={`route-link ${state.route === 'internet-path-ready' ? 'active' : ''}`}/><div className="route-node endpoint destination"><span>DST</span><strong>{address}</strong></div></div>
      <div className="route-table"><span>DESTINATION</span><span>NEXT HOP</span><span>STATE</span><strong>{address}/32</strong><strong>{ready ? 'DEFAULT GATEWAY' : 'LOOKUP…'}</strong><strong>{state.route.toUpperCase()}</strong></div>
    </div>;
  }

  const failed = state.route === 'failed' || state.route === 'recomputing' || state.route === 'alternate-ready' || state.route === 'unreachable' || (state.route === 'internet-path-ready' && state.routeMetrics?.failedLinkId === 'r1-core');
  const recomputing = state.route === 'recomputing';
  const primaryFailed = state.routeMetrics?.failedLinkIds?.includes('r1-core') ?? failed;
  const alternateFailed = state.routeMetrics?.failedLinkIds?.includes('r2-core') ?? false;
  const alternateActive = !alternateFailed && (state.route === 'alternate-ready' || (state.route === 'internet-path-ready' && state.routeMetrics?.activePath === 'alternate'));
  const primaryActive = !primaryFailed && (state.route === 'gateway-ready' || state.route === 'lookup');
  const activePath = state.routeMetrics?.activePath ?? 'primary';
  return <div className="journey-scene routing-scene route-god-scene">
    <div className="route-god-topology">
      <div className="route-god-node"><span>HOST</span><strong>CLIENT</strong></div>
      <div className="route-god-node"><span>NEXT HOP</span><strong>EDGE</strong></div>
      <div className="route-branches">
        <div className={`route-branch-row primary ${primaryActive ? 'active' : ''} ${primaryFailed ? 'failed' : ''}`}><span>R1 → CORE</span><i/><b>COST 22</b></div>
        <div className={`route-branch-row alternate ${recomputing ? 'recomputing' : ''} ${alternateActive ? 'active' : ''} ${alternateFailed ? 'failed' : ''}`}><span>R2 → CORE</span><i/><b>COST 52</b></div>
      </div>
      <div className="route-god-node destination"><span>DST</span><strong>{address}</strong></div>
    </div>
    <div className="route-god-metrics">
      <div><span>PRIMARY</span><strong>22</strong></div>
      <div><span>ALTERNATE</span><strong>52</strong></div>
      <div className={failed && !alternateActive ? (recomputing ? 'warning' : 'danger') : alternateActive ? 'success' : ''}><span>ACTIVE PATH</span><strong>{activePath.toUpperCase()}</strong></div>
      <div className={failed ? 'danger' : ''}><span>{alternateFailed ? 'FAILED LINKS' : 'FAILED LINK'}</span><strong>{alternateFailed ? 'R1 + R2 → CORE' : failed ? 'R1 → CORE' : 'NONE'}</strong></div>
    </div>
  </div>;
}

function TransportScene({ state }: { state: JourneyState }) {
  const quic = state.transportProfile === 'quic-h3';
  const stalled = state.transport === 'stalled';
  const established = state.transport === 'established' || stalled || state.transport === 'complete';
  const complete = state.transport === 'complete';
  const detectingLoss = state.activeEvent.kind === 'transport.loss-detected';
  const outageDetection = detectingLoss && state.activeEvent.id.includes('outage');
  const latencySelected = state.modifierIds.includes('latency-spike');
  const congestionSelected = state.modifierIds.includes('congestion');
  const leftLabel = quic ? 'CLIENT QUIC' : 'CLIENT TCP';
  const rightLabel = quic ? 'SERVER QUIC' : 'SERVER TCP';
  const leftState = stalled ? 'STALLED · NO IP ROUTE' : complete ? 'COMPLETE' : established ? '1-RTT READY' : quic ? 'INITIAL / HANDSHAKE' : 'SYN-SENT';
  const rightState = stalled ? 'STATE RETAINED' : complete ? 'COMPLETE' : established ? '1-RTT READY' : quic ? 'INITIAL / HANDSHAKE' : 'LISTEN';
  return <div className={`journey-scene transport-scene ${quic ? 'quic-transport-scene' : ''} ${detectingLoss ? 'loss-detected-scene' : ''}`}>
    <div className="transport-endpoints"><div><span>{leftLabel}</span><strong>{leftState}</strong></div><div><span>{rightLabel}</span><strong>{rightState}</strong></div></div>
    <div className="transport-wire"><i/><motion.b key={state.activeEvent.id} initial={{ left: state.activeEvent.actor.includes('server') || state.activeEvent.actor.includes('Server') ? '76%' : '18%', opacity: 0 }} animate={{ left: state.activeEvent.actor.includes('server') || state.activeEvent.actor.includes('Server') ? '22%' : '72%', opacity: 1 }} transition={{ duration: .48, ease: [0.16,1,.3,1] }}>{state.phase.toUpperCase()}</motion.b></div>
    {latencySelected && (state.activeEvent.kind === 'transport.latency' || state.activeEvent.kind === 'transport.rtt-update') && <JourneyLatencyPanel state={state}/>}
    {congestionSelected && isCongestionEvent(state.activeEvent.kind) && <JourneyCongestionPanel state={state}/>}
    {stalled&&<div className="partition-transport-panel"><span>IP ROUTE</span><strong>NONE</strong><small>TRANSPORT STATE EXISTS · FORWARDING CANNOT PROGRESS</small></div>}
    {detectingLoss ? <div className="loss-transport-panel">
      {outageDetection ? (quic ? <><div><span>ACK PROGRESS</span><strong>STALLED</strong></div><div className="loss-gap"><span>PTO</span><strong>{state.transportMetrics?.timerMs ?? '—'} ms</strong></div><div><span>ROUTE</span><strong>{state.routeMetrics?.activePath?.toUpperCase() ?? 'NONE'}</strong></div></> : <><div><span>ACK PROGRESS</span><strong>SILENT</strong></div><div className="loss-gap"><span>RTO</span><strong>{state.transportMetrics?.timerMs ?? '—'} ms</strong></div><div><span>RECOVERY</span><strong>RETRANSMIT AFTER ROUTE</strong></div></>) : quic ? <><div><span>ACK RANGES</span><strong>4105–4107 · 4109–4112</strong></div><div className="loss-gap"><span>MISSING PACKET</span><strong>PN 4108</strong></div><div><span>STREAM GAP</span><strong>4096–5555</strong></div></> : <><div><span>RECEIVE NEXT</span><strong>2461</strong></div><div className="loss-gap"><span>DUPLICATE ACK</span><strong>ACK 2461 × 3</strong></div><div><span>MISSING RANGE</span><strong>SEQ 2461–3920</strong></div></>}
    </div> : <div className="sequence-state"><div><span>TRANSPORT</span><strong>{quic ? 'UDP + QUIC' : 'TCP BYTE STREAM'}</strong></div><div><span>{quic ? 'CRYPTO LEVEL' : 'DELIVERY'}</span><strong>{quic ? (state.tls === 'application-keys' ? '1-RTT' : state.tls === 'handshake-keys' ? 'HANDSHAKE' : 'INITIAL') : stalled ? 'NO IP PROGRESS' : complete ? 'CUMULATIVELY ACKED' : established ? 'BYTE STREAM READY' : 'HANDSHAKE'}</strong></div></div>}
  </div>;
}

function DnsScene({ state, hostname, address }: { state: JourneyState; hostname: string; address: string }) {
  const timedOut = state.activeEvent.kind === 'dns.timeout';
  const retrying = state.activeEvent.kind === 'dns.retry';
  const masked = state.activeEvent.kind === 'dns.failure-masked';
  if (state.dnsProfile === 'cache-hit') {
    return <div className="journey-scene dns-scene dns-hit-scene">
      <div className="dns-hit-path"><div className="active"><i/><span>STUB</span></div><b>→</b><div className="active cache"><i/><span>LOCAL CACHE</span></div></div>
      <div className="dns-answer"><span>{hostname}</span><b>→</b><strong>{state.resolvedAddress ?? address}</strong></div>
      <div className="dns-upstream-idle"><span>RECURSIVE · IDLE</span><span>ROOT · IDLE</span><span>TLD · IDLE</span><span>AUTH · IDLE</span></div>
      {masked&&<div className="dns-failure-banner masked"><span>UPSTREAM OUTAGE MASKED</span><strong>LOCAL CACHE SATISFIES THE LOOKUP</strong><small>NO QUERY · NO TIMEOUT · NO RETRY</small></div>}
      <p>{masked ? 'The selected upstream outage exists in the simulated environment, but this cached answer prevents any dependency on it.' : `Cache hit · TTL ${state.dnsTtlSeconds ?? '—'}s. No upstream DNS traffic is generated.`}</p>
    </div>;
  }
  const nodes = ['STUB','RECURSIVE','ROOT','TLD','AUTH'];
  return <div className="journey-scene dns-scene"><div className="dns-chain">{nodes.map((node,index)=><div key={node} className={index <= Math.min(4, Math.max(0, state.activeEventIndex - 1)) ? 'active' : ''}><i/><span>{node}</span></div>)}</div><div className="dns-answer"><span>{hostname}</span><b>→</b><strong>{timedOut ? 'NO RESPONSE' : retrying ? 'RETRYING…' : state.resolvedAddress ?? 'RESOLVING…'}</strong></div>{(timedOut||retrying)&&<div className={`dns-failure-banner ${retrying?'retrying':'timeout'}`}><span>{timedOut?'PRIMARY RECURSIVE · TIMEOUT':'SECONDARY RECURSIVE · RETRY'}</span><strong>{timedOut?'NO DNS ANSWER RECEIVED':'SAME A QUESTION · NEW TRANSACTION CONTEXT'}</strong><small>{timedOut?'SILENCE ≠ NXDOMAIN / SERVFAIL':'AUTHORITY WALK RESUMES AFTER RETRY'}</small></div>}<p>{timedOut ? 'The first recursive attempt is silent; no DNS answer exists to interpret.' : retrying ? 'The stub has moved the logical lookup to a secondary recursive resolver.' : state.dns === 'cached' ? `Resolver cache holds ${address} · TTL ${state.dnsTtlSeconds ?? '—'}s.` : 'Recursive resolution is walking authority state.'}</p></div>;
}

function TlsScene({ state, hostname }: { state: JourneyState; hostname: string }) {
  const quic = state.transportProfile === 'quic-h3';
  const encryption = state.tls === 'handshake-keys' || state.tls === 'application-keys';
  const boundary = quic ? (state.tls === 'application-keys' ? 'QUIC 1-RTT' : state.tls === 'handshake-keys' ? 'QUIC HANDSHAKE' : 'QUIC INITIAL') : state.tls === 'application-keys' ? 'APPLICATION KEYS' : state.tls === 'handshake-keys' ? 'HANDSHAKE KEYS' : 'VISIBLE NEGOTIATION';
  return <div className={`journey-scene tls-scene ${quic ? 'quic-tls-scene' : ''}`}><div className="tls-peers"><div><span>{quic ? 'QUIC CLIENT' : 'CLIENT'}</span><strong>{hostname}</strong></div><div className={`tls-boundary ${encryption ? 'encrypted' : ''}`}><i/><b>{boundary}</b><i/></div><div><span>{quic ? 'QUIC SERVER' : 'SERVER'}</span><strong>TLS 1.3</strong></div></div><div className="tls-schedule"><span className={state.tls !== 'idle' ? 'on' : ''}>{quic ? 'INITIAL' : 'EARLY SECRET'}</span><span className={encryption ? 'on' : ''}>{quic ? 'HANDSHAKE' : 'HANDSHAKE SECRET'}</span><span className={state.tls === 'application-keys' ? 'on' : ''}>{quic ? '1-RTT' : 'MASTER SECRET'}</span><span className={state.tls === 'application-keys' ? 'on' : ''}>{quic ? 'STREAM DATA' : 'APP TRAFFIC'}</span></div><p>{quic ? 'TLS 1.3 handshake data drives QUIC crypto levels. There is no TLS record layer between UDP and QUIC.' : state.phase === 'certificate-validation' ? 'Certificate identity is validated independently from routing.' : encryption ? 'Wire protection is active; HOPSCOTCH never invents secret bytes.' : 'ClientHello / ServerHello negotiate before encrypted handshake traffic begins.'}</p></div>;
}

function HttpScene({ state, hostname }: { state: JourneyState; hostname: string }) {
  const h3 = state.transportProfile === 'quic-h3';
  const recovered = state.activeEvent.kind === 'transport.recovered';
  const serverEpisode = isServerFailureEvent(state.activeEvent.kind);
  const progress = recovered ? 84 : serverEpisode ? (state.activeEvent.kind === 'http.retry' ? 24 : 18) : state.http === 'streaming' ? 72 : state.http === 'complete' ? 100 : state.http === 'headers' ? 34 : state.http === 'request-sent' ? 16 : 5;
  const protocol = h3 ? 'HTTP/3' : 'HTTP/2';
  const payloadLabel = recovered ? 'DELIVERY RESUMES' : state.activeEvent.kind === 'http.service-unavailable' ? ':status 503 · Retry-After: 1' : state.activeEvent.kind === 'http.retry-wait' ? 'WAITING · RETRY-AFTER' : state.activeEvent.kind === 'server.recovered' ? 'SERVICE READY' : state.activeEvent.kind === 'http.retry' ? `RETRY GET / · ${hostname}` : state.activeEvent.kind === 'server.unavailable' ? 'SERVICE UNAVAILABLE' : state.http === 'request-sent' ? `GET / · ${hostname}` : state.http === 'headers' ? ':status 200' : state.http === 'streaming' || state.http === 'complete' ? 'RESPONSE DATA' : h3 ? 'CONTROL + QPACK' : 'SETTINGS';
  return <div className={`journey-scene http-scene ${h3 ? 'h3-scene' : ''} ${recovered ? 'loss-recovered-scene' : ''}`}><div className="http-request-line"><span>{protocol}</span><strong>{payloadLabel}</strong></div>{serverEpisode&&<JourneyServerFailurePanel state={state}/>} {recovered&&<div className="recovery-banner"><span>TRANSPORT REPAIRED</span><strong>{h3 ? 'STREAM 4096–5555 CONTIGUOUS' : 'CUMULATIVE ACK 2461 → 8301'}</strong></div>}<div className="http-stream"><span>{h3 ? 'REQUEST STREAM' : 'STREAM 1'}</span><i><b style={{width:`${progress}%`}}/></i><strong>{progress}%</strong></div><div className="http-stream muted"><span>TRANSPORT</span><i><b style={{width:`${Math.max(12,progress-14)}%`}}/></i><strong>{h3 ? 'QUIC 1-RTT' : 'TLS OVER TCP'}</strong></div><p>{serverEpisode ? (state.activeEvent.kind === 'http.service-unavailable' ? 'The server returned a real HTTP 503 response while the existing connection stayed healthy.' : state.activeEvent.kind === 'http.retry' ? 'The canonical idempotent GET is replayed on the same established transport and TLS state.' : 'Application availability changes without becoming a routing, transport, or TLS failure.') : recovered ? (h3 ? 'The missing QUIC STREAM range has arrived in a new packet number; this request stream can advance again.' : 'TCP repaired the missing byte range; HTTP/2 can consume the ordered byte stream again.') : h3 ? 'HTTP/3 maps request/response data to QUIC streams; there is no TCP connection beneath it.' : 'Application frames remain encrypted on the wire and inherit TCP delivery behavior.'}</p></div>;
}

function PacketEventScene({ state }: { state: JourneyState }) {
  const quic = state.transportProfile === 'quic-h3';
  const loss = state.activeEvent.kind === 'transport.loss';
  const retransmit = state.activeEvent.kind === 'transport.retransmit';
  const ecnMark = state.activeEvent.kind === 'transport.ecn-mark';
  const layers = quic ? [['ETHERNET','14 B'],['IPv4','20 B'],['UDP','8 B'],['QUIC','PROTECTED']] : [['ETHERNET','14 B'],['IPv4','20 B'],['TCP','20 B+'],['TLS APPLICATION DATA','ENCRYPTED']];
  return <div className={`journey-scene packet-scene ${quic ? 'quic-packet-scene' : ''} ${loss ? 'packet-loss-scene' : ''} ${retransmit ? 'packet-repair-scene' : ''} ${ecnMark ? 'packet-congestion-scene' : ''}`}><div className="packet-layers">{layers.map(([label,value],index)=><div key={label} className={index===3?'encrypted':''}><span>{label}</span><strong>{value}</strong></div>)}</div>{ecnMark&&<div className="packet-congestion-card"><span>ECN CE MARK</span><strong>PACKET DELIVERED</strong><small>CONGESTION SIGNAL · NOT A DROP</small></div>}{(loss||retransmit)&&<div className="packet-impairment-card"><span>{loss?'DROPPED':'REPAIR TRANSMISSION'}</span>{quic?<><strong>{loss?'PN 4108':'NEW PN 4113'}</strong><small>STREAM 4096–5555</small></>:<><strong>SEQ 2461–3920</strong><small>{loss?'MISSING BYTE RANGE':'FAST RETRANSMIT'}</small></>}</div>}<div className="packet-bytes">{['45','00','01','9A','00','01','40','00','40',quic?'11':'06','B7','5C','C0','00','02','0A','CB','00','71','2A'].map((byte,index)=><b key={`${byte}-${index}`} className={state.packet === 'headers' && index < 12 ? 'hot' : ''}>{byte}</b>)}</div><p>{loss ? (quic ? 'Packet 4108 is gone. QUIC will recover its STREAM data without reusing packet number 4108.' : 'This TCP byte range is now missing; cumulative delivery cannot advance past SEQ 2461.') : retransmit ? (quic ? 'The same STREAM range is carried in new packet 4113. QUIC packet numbers are never retransmitted.' : 'Fast retransmit sends the missing TCP sequence range again before the normal timeout.') : quic ? 'UDP and QUIC headers remain structurally visible while the QUIC protected payload stays opaque without key material.' : state.packet === 'headers' ? 'Header bytes map to delivery fields while the TLS payload remains opaque.' : 'One representative frame is frozen without creating a second transfer.'}</p></div>;
}

function PacketAssemblyScene({ projection, onSelectLayer }: {
  projection: JourneyPacketVisualProjection;
  onSelectLayer: (layerId: JourneyPacketLayerId) => void;
}) {
  return <div className="journey-scene phase5-packet-scene-wrap"><JourneyPacketObject projection={projection} onSelectLayer={onSelectLayer}/></div>;
}

function PhysicalJourneyScene({ projection, onSelectLayer }: {
  projection: JourneyPhysicalProjection;
  onSelectLayer: (layerId: JourneyPacketLayerId) => void;
}) {
  return <div className="journey-scene phase5-physical-scene-wrap"><JourneyPhysicalJourney projection={projection} onSelectLayer={onSelectLayer}/></div>;
}

function IntentScene({ hostname }: { hostname: string }) {
  return <div className="journey-scene response-scene intent-scene"><div className="browser-frame"><div><i/><i/><i/><span>{hostname}</span></div><section><b>URL</b><strong>APPLICATION INTENT</strong><p>The browser has a hostname and an intent. DNS, routing, transport, encryption, and HTTP state do not exist yet.</p></section></div></div>;
}

function FailureScene({ state, hostname }: { state: JourneyState; hostname: string }) {
  return <div className="journey-scene response-scene failure-scene"><div className="browser-frame failure-frame"><div><i/><i/><i/><span>{hostname}</span></div><section><b>NO ROUTE</b><strong>NETWORK UNREACHABLE</strong><p>Both routed exits are down. DNS, TLS, and earlier transport history still exist, but IP forwarding has no path to the destination.</p><small>JOURNEY TERMINATED · NO RECOVERY FABRICATED</small></section></div><div className="partition-terminal-facts"><span>ACTIVE PATH <b>NONE</b></span><span>ROUTE CANDIDATES <b>{state.routeMetrics?.candidateRouteCount ?? 0}</b></span><span>TRANSPORT <b>STALLED</b></span></div></div>;
}

function ResponseScene({ hostname }: { hostname: string }) {
  return <div className="journey-scene response-scene"><div className="browser-frame"><div><i/><i/><i/><span>{hostname}</span></div><section><b>200</b><strong>RESPONSE READY</strong><p>Intent satisfied after DNS, routing, transport, encryption, HTTP, and packet delivery.</p></section></div></div>;
}

function ApplicationScene({ state, hostname, address }: { state: JourneyState; hostname: string; address: string }) {
  if (state.journeyFailed) return <FailureScene state={state} hostname={hostname}/>;
  if (state.protocol === 'DNS') return <DnsScene state={state} hostname={hostname} address={address}/>;
  if (state.protocol.includes('TLS')) return <TlsScene state={state} hostname={hostname}/>;
  if (state.protocol.startsWith('HTTP')) return <HttpScene state={state} hostname={hostname}/>;
  if (state.responseReady || state.journeyComplete) return <ResponseScene hostname={hostname}/>;
  return <IntentScene hostname={hostname}/>;
}

function SemanticScene({ state, hostname, address, packetProjection, physicalProjection, onSelectPacketLayer }: {
  state: JourneyState;
  hostname: string;
  address: string;
  packetProjection: JourneyPacketVisualProjection;
  physicalProjection: JourneyPhysicalProjection;
  onSelectPacketLayer: (layerId: JourneyPacketLayerId) => void;
}) {
  if (usesCausalWorld(state)) return <JourneyCausalWorld state={state} hostname={hostname} address={address} packetProjection={packetProjection} physicalProjection={physicalProjection} onSelectLayer={onSelectPacketLayer}/>;
  if (state.scale === 'internet') return <InternetScene state={state}/>;
  if (state.scale === 'routing') return <RoutingScene state={state} address={address}/>;
  if (state.scale === 'transport') return <TransportScene state={state}/>;
  if (state.scale === 'packet' && state.activeEvent.kind === 'packet.transit') return <PhysicalJourneyScene projection={physicalProjection} onSelectLayer={onSelectPacketLayer}/>;
  if (state.scale === 'packet' && (state.activeEvent.kind === 'packet.assembly' || state.activeEvent.kind === 'packet.inspect')) return <PacketAssemblyScene projection={packetProjection} onSelectLayer={onSelectPacketLayer}/>;
  if (state.scale === 'packet') return <PacketEventScene state={state}/>;
  return <ApplicationScene state={state} hostname={hostname} address={address}/>;
}

export function JourneyTheater({ hostname, timeMs, startPlaying, evidence, measuredState, onHostnameChange, onTimeChange, onEvidenceChange, onOpenDetail, onExit }: {
  hostname: string;
  timeMs: number;
  startPlaying: boolean;
  evidence: InternetEvidenceSnapshot | null;
  measuredState: MeasuredSnapshotState | null;
  onHostnameChange: (hostname: string) => void;
  onTimeChange: (timeMs: number) => void;
  onEvidenceChange: (evidence: InternetEvidenceSnapshot | null) => void;
  onOpenDetail: (lab: JourneyDetailLab, timeMs: number) => void;
  onExit: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const initialConfig = useMemo(initialBrowserConfig, []);
  const [profile, setProfile] = useState<JourneyTransportProfile>(initialConfig.transportProfile);
  const [dnsProfile, setDnsProfile] = useState<JourneyDnsProfile>(initialConfig.dnsProfile);
  const [modifierIds, setModifierIds] = useState<JourneyModifierId[]>(() => resolveJourneyModifierIds(initialConfig));
  const [playing, setPlaying] = useState(startPlaying);
  const [draftHostname, setDraftHostname] = useState(hostname);
  const [hostError, setHostError] = useState<string | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<VisualDrawerId | null>(null);
  const [selectedPacketLayer, setSelectedPacketLayer] = useState<JourneyPacketLayerId>('application');
  const eventRailRef = useRef<HTMLDivElement>(null);
  const impairmentProfile = impairmentProfileForModifiers(modifierIds);
  const scenario = useMemo(() => buildJourneyScenario(hostname, { transportProfile: profile, dnsProfile, impairmentProfile, modifierIds }), [hostname, profile, dnsProfile, impairmentProfile, modifierIds]);
  const state = useMemo(() => journeyStateAt(scenario, timeMs), [scenario, timeMs]);
  const physicalProjection = useMemo(() => projectJourneyPhysicalState({
    profile,
    destinationAddress: scenario.destinationAddress,
    stage: state.packetTransitStage,
  }), [profile, scenario.destinationAddress, state.packetTransitStage]);
  const packetProjection = useMemo(() => projectJourneyPacketVisual({
    hostname: scenario.hostname,
    destinationAddress: scenario.destinationAddress,
    profile,
    stage: state.packetAssemblyStage,
    selectedLayerId: selectedPacketLayer,
    ttl: state.activeEvent.kind === 'packet.transit' ? physicalProjection.currentTtl : undefined,
    sourceMac: state.activeEvent.kind === 'packet.transit' && physicalProjection.l2Envelope === 'wan' ? physicalProjection.outgoing.sourceMac : undefined,
    destinationMac: state.activeEvent.kind === 'packet.transit' && physicalProjection.l2Envelope === 'wan' ? physicalProjection.outgoing.destinationMac : undefined,
  }), [physicalProjection, profile, scenario.destinationAddress, scenario.hostname, selectedPacketLayer, state.activeEvent.kind, state.packetAssemblyStage]);
  const mode = sceneMode(state);
  const selectedModifiers = scenario.modifierIds;
  const timelineEvents: VisualTimelineEvent[] = scenario.events.map((current) => ({
    id: current.id,
    atMs: current.atMs,
    label: current.title,
    tone: isRouteFailureEvent(current.kind) || isPartitionEvent(current.kind) || isDnsFailureEvent(current.kind) || isServerFailureEvent(current.kind)
      ? 'danger'
      : isLossEvent(current.kind) || isLatencyEvent(current.kind) || isCongestionEvent(current.kind) || isPolicyLeakEvent(current.kind)
        ? 'warning'
        : current.provenance === 'SIMULATED'
          ? 'neutral'
          : 'evidence',
  }));
  const { playbackSpeed, setPlaybackSpeed } = useVisualPresentationPlayback({
    playing,
    timeMs,
    durationMs: scenario.durationMs,
    events: timelineEvents,
    onTimeChange,
    onComplete: () => setPlaying(false),
  });

  useEffect(() => {
    writeJourneyBrowserConfig({ transportProfile: profile, dnsProfile, impairmentProfile, modifierIds: selectedModifiers });
  }, [profile, dnsProfile, impairmentProfile, selectedModifiers.join('|')]);

  useEffect(() => {
    const rail = eventRailRef.current;
    const current = rail?.querySelector<HTMLElement>('.journey-event.current');
    if (!rail || !current) return;
    const railRect = rail.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
    if (currentRect.top < railRect.top) {
      rail.scrollBy({ top: currentRect.top - railRect.top, behavior });
    } else if (currentRect.bottom > railRect.bottom) {
      rail.scrollBy({ top: currentRect.bottom - railRect.bottom, behavior });
    }
  }, [reduceMotion, state.activeEvent.id]);

  const applyHostname = (event: FormEvent) => {
    event.preventDefault();
    try {
      const normalized = normalizeJourneyHostname(draftHostname);
      setHostError(null); setPlaying(false); onEvidenceChange(null); onHostnameChange(normalized); onTimeChange(0);
    } catch (error) { setHostError(error instanceof Error ? error.message : 'Invalid hostname.'); }
  };

  const chooseProfile = (next: JourneyTransportProfile) => { if (next !== profile) { setPlaying(false); setProfile(next); onTimeChange(0); } };
  const chooseDnsProfile = (next: JourneyDnsProfile) => { if (next !== dnsProfile) { setPlaying(false); setDnsProfile(next); onTimeChange(0); } };
  const clearModifiers = () => { if (modifierIds.length > 0) { setPlaying(false); setModifierIds([]); onTimeChange(0); } };
  const toggleModifier = (modifierId: JourneyModifierId) => {
    setPlaying(false);
    setModifierIds((current) => {
      if (current.includes(modifierId)) return current.filter((id) => id !== modifierId);
      const incompatible = modifierId === 'route-failure' ? 'path-outage' : modifierId === 'path-outage' ? 'route-failure' : null;
      return [...current.filter((id) => id !== incompatible), modifierId];
    });
    onTimeChange(0);
  };

  const attachEvidence = async () => {
    setEvidenceLoading(true); setEvidenceError(null);
    try {
      const response = await fetch(`/api/internet/snapshot?host=${encodeURIComponent(hostname)}`, { headers: { accept: 'application/json' } });
      const payload = await response.json() as InternetEvidenceSnapshot | InternetEvidenceError;
      if (!response.ok || ('ok' in payload && payload.ok === false)) throw new Error('error' in payload ? payload.error : `Evidence request failed with HTTP ${response.status}.`);
      if (!('schema' in payload) || payload.schema !== 'hopscotch.internet-evidence') throw new Error('Unexpected evidence payload.');
      onEvidenceChange(payload);
    } catch (error) { setEvidenceError(error instanceof Error ? error.message : 'Live context unavailable.'); }
    finally { setEvidenceLoading(false); }
  };

  const seek = (next: number) => { setPlaying(false); onTimeChange(next); };
  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
  };
  const openDrawer = (drawer: VisualDrawerId) => {
    setPlaying(false);
    setActiveDrawer((current) => current === drawer ? null : drawer);
  };
  const inspectPacketLayer = (layerId: JourneyPacketLayerId) => {
    setPlaying(false);
    setSelectedPacketLayer(layerId);
    setActiveDrawer('inspect');
  };
  const detail = state.activeEvent.detailLab;
  const depthDelta = state.scaleDepth - JOURNEY_SCALE_DEPTH[state.previousScale];
  const enteringScale = state.zoom === 'in' || depthDelta > 0 ? .72 : state.zoom === 'out' || depthDelta < 0 ? 1.28 : .97;
  const profileLabel = profile === 'quic-h3' ? 'QUIC + H3' : 'TCP + H2';
  const dnsLabel = dnsProfile === 'cache-hit' ? 'CACHE HIT' : 'CACHE MISS';
  const godModeLabel = modifierLabel(selectedModifiers);
  const dnsStateLabel = state.dns === 'cached' && state.dnsTtlSeconds !== null ? `CACHED · ${state.dnsTtlSeconds}s` : state.dns.toUpperCase();
  const transportImpairmentPhase = state.impairmentState === 'lost' || state.impairmentState === 'detected' || state.impairmentState === 'recovering' || state.impairmentState === 'queueing' || state.impairmentState === 'ecn-signaled' || state.impairmentState === 'congestion-responding';
  const transportStateLabel = transportImpairmentPhase ? `${state.transport.toUpperCase()} · ${state.impairmentState.toUpperCase()}` : state.transport.toUpperCase();
  const toneClass = stateToneClass(state);
  const calloutClass = calloutToneClass(state);
  const preRouteSelected = selectedModifiers.includes('route-failure');
  const outageSelected = selectedModifiers.includes('path-outage');
  const routeSelected = preRouteSelected || outageSelected;
  const lossSelected = selectedModifiers.includes('single-loss');
  const latencySelected = selectedModifiers.includes('latency-spike');
  const congestionSelected = selectedModifiers.includes('congestion');
  const dnsFailureSelected = selectedModifiers.includes('dns-failure');
  const serverFailureSelected = selectedModifiers.includes('server-failure');
  const routeLeakSelected = selectedModifiers.includes('route-leak');
  const partitionSelected = selectedModifiers.includes('partition');
  const measuredScene = state.scale === 'routing' ? 'routing' : state.scale === 'transport' ? 'transport' : state.scale === 'application' && state.protocol === 'DNS' ? 'dns' : null;
  const firstEventAt = (predicate: (current: typeof scenario.events[number]) => boolean, fallback: number) => scenario.events.find(predicate)?.atMs ?? fallback;
  const timelineMilestones: VisualTimelineMilestone[] = [
    { id: 'dns', atMs: firstEventAt((current) => current.protocol === 'DNS', 420), label: 'DNS' },
    { id: 'route', atMs: firstEventAt((current) => current.scale === 'routing', 3140), label: 'ROUTE' },
    { id: 'transport', atMs: firstEventAt((current) => current.scale === 'transport', 5000), label: profile === 'quic-h3' ? 'QUIC' : 'TCP' },
    { id: 'tls', atMs: firstEventAt((current) => current.protocol.includes('TLS'), 6070), label: 'TLS' },
    { id: 'http', atMs: firstEventAt((current) => current.protocol.startsWith('HTTP'), 8070), label: profile === 'quic-h3' ? 'H3' : 'H2' },
    { id: 'packet', atMs: firstEventAt((current) => current.scale === 'packet', 8840), label: 'PACKET' },
  ];

  const configContent = <form className="journey-drawer-form" onSubmit={applyHostname}>
    <label><span>HOSTNAME</span><input value={draftHostname} maxLength={253} spellCheck={false} autoComplete="off" onChange={(event)=>setDraftHostname(event.currentTarget.value)}/></label>
    <button type="submit" className="journey-drawer-primary">APPLY + RESET</button>
    <fieldset><legend>TRANSPORT</legend><div className="journey-profile" role="group" aria-label="Journey transport profile"><button type="button" className={profile==='tcp-h2'?'active':''} onClick={()=>chooseProfile('tcp-h2')}>TCP + H2</button><button type="button" className={profile==='quic-h3'?'active':''} onClick={()=>chooseProfile('quic-h3')}>QUIC + H3</button></div></fieldset>
    <fieldset><legend>DNS PATH</legend><div className="journey-profile" role="group" aria-label="Journey DNS profile"><button type="button" className={dnsProfile==='cache-miss'?'active':''} onClick={()=>chooseDnsProfile('cache-miss')}>CACHE MISS</button><button type="button" className={dnsProfile==='cache-hit'?'active':''} onClick={()=>chooseDnsProfile('cache-hit')}>CACHE HIT</button></div></fieldset>
    <fieldset><legend>GOD MODE MODIFIERS</legend><div className="journey-profile journey-modifier-profile" role="group" aria-label="GOD MODE modifiers"><button type="button" className={selectedModifiers.length===0?'active':''} aria-pressed={selectedModifiers.length===0} onClick={clearModifiers}>CLEAN</button><button type="button" className={lossSelected?'active':''} aria-pressed={lossSelected} onClick={()=>toggleModifier('single-loss')}>LOSS</button><button type="button" className={latencySelected?'active':''} aria-pressed={latencySelected} onClick={()=>toggleModifier('latency-spike')}>LATENCY</button><button type="button" className={preRouteSelected?'active':''} aria-pressed={preRouteSelected} onClick={()=>toggleModifier('route-failure')}>ROUTE</button><button type="button" className={outageSelected?'active':''} aria-pressed={outageSelected} onClick={()=>toggleModifier('path-outage')}>OUTAGE</button><button type="button" className={congestionSelected?'active':''} aria-pressed={congestionSelected} onClick={()=>toggleModifier('congestion')}>CONGESTION</button><button type="button" className={dnsFailureSelected?'active':''} aria-pressed={dnsFailureSelected} onClick={()=>toggleModifier('dns-failure')}>DNS FAIL</button><button type="button" className={serverFailureSelected?'active':''} aria-pressed={serverFailureSelected} onClick={()=>toggleModifier('server-failure')}>SERVER</button><button type="button" className={partitionSelected?'active':''} aria-pressed={partitionSelected} onClick={()=>toggleModifier('partition')}>PARTITION</button><button type="button" className={routeLeakSelected?'active':''} aria-pressed={routeLeakSelected} onClick={()=>toggleModifier('route-leak')}>LEAK</button></div></fieldset>
    <p className="journey-truth-note">{hostError ?? `SIMULATED CONFIGURATION · ${profileLabel} · ${dnsLabel} · ${godModeLabel}. Live or public evidence never rewrites this story.`}</p>
  </form>;

  const selectedPacketProjectionLayer = packetProjection.layers.find((layer) => layer.id === selectedPacketLayer) ?? packetProjection.layers[0];
  const packetObjectActive = state.activeEvent.kind === 'packet.assembly' || state.activeEvent.kind === 'packet.inspect' || state.activeEvent.kind === 'packet.transit';
  const physicalJourneyActive = state.activeEvent.kind === 'packet.transit';
  const causalWorldActive = usesCausalWorld(state);
  const inspectContent = <div className="journey-inspect-drawer">
    {packetObjectActive && selectedPacketProjectionLayer && <section className="journey-packet-inspector" data-phase5-inspector="true">
      <div className="rail-title"><span>PACKET OBJECT</span><strong>0{selectedPacketProjectionLayer.order + 1} / 05</strong></div>
      <div className="journey-packet-inspector__identity"><span>{selectedPacketProjectionLayer.role}</span><h3>{selectedPacketProjectionLayer.protocol}</h3><p>{selectedPacketProjectionLayer.detail}</p><small>{selectedPacketProjectionLayer.byteStart === null ? 'SEMANTIC VIEW · NO FALSE BYTE CLAIM' : `FRAME BYTES ${selectedPacketProjectionLayer.byteStart}–${selectedPacketProjectionLayer.byteStart + selectedPacketProjectionLayer.byteLength - 1}`}</small></div>
      <div className="journey-packet-inspector__fields">{selectedPacketProjectionLayer.fields.map((field)=><div key={field.id}><span>{field.label}</span><strong>{field.value}</strong><small>{field.byteStart === null ? field.derived ? 'DERIVED' : 'SEMANTIC' : `B${field.byteStart}${field.byteLength > 1 ? `–${field.byteStart + field.byteLength - 1}` : ''}`}</small></div>)}</div>
    </section>}
    {physicalJourneyActive && <section className="journey-physical-inspector" data-phase5b-inspector="true">
      <div className="rail-title"><span>FORWARDING OBJECT</span><strong>{String(physicalProjection.stageIndex + 1).padStart(2, '0')} / 09</strong></div>
      <div><span>DEVICE READS</span><strong>{physicalProjection.selectedField}</strong><small>{physicalProjection.decision}</small></div>
      <div><span>IP CONTINUITY</span><strong>{physicalProjection.continuityId}</strong><small>TTL {physicalProjection.currentTtl} · CHECKSUM {physicalProjection.currentChecksum}</small></div>
      <div><span>ACTIVE L2</span><strong>{physicalProjection.l2Envelope.toUpperCase()}</strong><small>{physicalProjection.l2Envelope === 'none' ? 'ETHERNET TERMINATED AT ROUTER' : `${physicalProjection.l2Envelope === 'lan' ? physicalProjection.incoming.sourceMac : physicalProjection.outgoing.sourceMac} → ${physicalProjection.l2Envelope === 'lan' ? physicalProjection.incoming.destinationMac : physicalProjection.outgoing.destinationMac}`}</small></div>
    </section>}
    <article className={`journey-inspect-event ${calloutClass}`}><div><span>{formatTime(state.activeEvent.atMs)}</span><b className={provenanceClass(state.activeEvent.provenance)}>{state.activeEvent.provenance}</b></div><h3>{state.activeEvent.title}</h3><p>{state.activeEvent.summary}</p><small>{state.activeEvent.detail}</small>{detail&&<button type="button" onClick={()=>onOpenDetail(detail,timeMs)}>OPEN {detail.toUpperCase()} DETAIL ↗</button>}</article>
    <section><div className="rail-title"><span>PROTOCOL STATE</span><strong>{state.scale.toUpperCase()}</strong></div><div className="journey-state-strip"><div><span>DNS</span><strong className={dnsFailureSelected?toneClass:''}>{dnsStateLabel}</strong></div><div><span>ROUTE</span><strong className={routeSelected?toneClass:''}>{state.route.toUpperCase()}</strong></div><div><span>{profile==='quic-h3'?'QUIC':'TCP'}</span><strong className={lossSelected||latencySelected||outageSelected||congestionSelected||partitionSelected?toneClass:''}>{transportStateLabel}</strong></div><div><span>TLS</span><strong>{state.tls.toUpperCase()}</strong></div><div><span>{profile==='quic-h3'?'H3':'H2'}</span><strong>{state.http.toUpperCase()}</strong></div><div><span>PACKET</span><strong>{state.packet.toUpperCase()}</strong></div></div></section>
    <section><div className="rail-title"><span>ABSTRACTION DEPTH</span><strong>0{state.scaleDepth + 1}</strong></div><div className="journey-inspect-depth">{scaleOrder.map((scale)=><div key={scale} className={scale===state.scale?'active':''}><i/><span>{scale.toUpperCase()}</span><small>0{JOURNEY_SCALE_DEPTH[scale]+1}</small></div>)}</div></section>
  </div>;

  const eventsContent = <section className="journey-events journey-events-drawer"><div className="rail-title"><span>CAUSAL CHAIN</span><strong>{String(state.activeEventIndex+1).padStart(2,'0')} / {scenario.events.length}</strong></div><div className="journey-event-list" ref={eventRailRef}>{scenario.events.map((current,index)=>{const complete=current.atMs<=timeMs;const active=current.id===state.activeEvent.id;const lossEvent=isLossEvent(current.kind);const latencyEvent=isLatencyEvent(current.kind);const routeEvent=isRouteFailureEvent(current.kind);const congestionEvent=isCongestionEvent(current.kind);const dnsFailureEvent=isDnsFailureEvent(current.kind);const serverFailureEvent=isServerFailureEvent(current.kind);const partitionEvent=isPartitionEvent(current.kind);const policyLeakEvent=isPolicyLeakEvent(current.kind);return <button type="button" key={current.id} className={`journey-event ${complete?'complete':''} ${active?'current':''} ${lossEvent?'impairment-event':''} ${latencyEvent?'latency-event':''} ${routeEvent?'route-event':''} ${congestionEvent?'congestion-event':''} ${dnsFailureEvent?'dns-failure-event':''} ${serverFailureEvent?'server-failure-event':''} ${partitionEvent?'partition-event':''} ${policyLeakEvent?'policy-leak-event':''}`} onClick={()=>seek(current.atMs)}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{current.title}</strong><small>{formatTime(current.atMs)} · {current.scale.toUpperCase()} · {current.protocol}</small></div><i className={provenanceClass(current.provenance)}/></button>})}</div></section>;

  const evidenceContent = <section className="journey-context journey-evidence-drawer"><div className="journey-evidence-status"><span>ENDPOINT CONTEXT</span><strong>{evidence?'ATTACHED':'SIMULATION ONLY'}</strong></div>{evidence?<><div className="context-facts"><div><b>EDGE OBSERVED</b><strong>{evidence.edge.asn?`AS${evidence.edge.asn}`:'ASN UNAVAILABLE'}</strong><small>{evidence.edge.colo??'COLO UNAVAILABLE'}</small></div><div><b>PUBLIC COLLECTOR</b><strong>{evidence.routing.originAsns.length?evidence.routing.originAsns.map((asn)=>`AS${asn}`).join(' / '):'ORIGIN UNAVAILABLE'}</strong><small>{evidence.routing.prefix??'PREFIX UNAVAILABLE'}</small></div></div><p><b>DECORATION ONLY.</b> These observations do not choose {profileLabel}, {dnsLabel}, or {godModeLabel} and do not become the simulated path.</p></>:<p>Attach optional Cloudflare and public routing context for {hostname}. It remains separate evidence beside the deterministic story.</p>}<button type="button" className="journey-drawer-primary" onClick={()=>void attachEvidence()} disabled={evidenceLoading}>{evidenceLoading?'ATTACHING…':evidence?'REFRESH CONTEXT':'ATTACH CONTEXT'}</button>{evidenceError&&<p className="journey-evidence-error">{evidenceError}</p>}</section>;

  const drawers: VisualDrawerDefinition[] = [
    { id: 'inspect', label: 'Inspect', title: 'Current network state', eyebrow: `${state.scale.toUpperCase()} · ${state.protocol}`, content: inspectContent },
    { id: 'config', label: 'Config', title: 'Configure the journey', eyebrow: 'SIMULATED INPUTS', content: configContent },
    { id: 'events', label: 'Events', title: 'Causal event chain', eyebrow: `${scenario.events.length} DETERMINISTIC EVENTS`, content: eventsContent },
    { id: 'evidence', label: 'Evidence', title: 'Bounded external context', eyebrow: 'SEPARATE TRUTH CLASS', content: evidenceContent },
  ];

  return <VisualWorkspaceShell
    className="journey-visual-workspace"
    stageLabel="URL Journey cinematic network scene"
    activeDrawer={activeDrawer}
    drawers={drawers}
    onCloseDrawer={()=>setActiveDrawer(null)}
    toolbar={<><div className="visual-identity"><i/><span>URL JOURNEY</span><strong>{hostname} · {profileLabel} · {dnsLabel}</strong></div><div className="journey-visual-tools"><VisualDrawerTabs active={activeDrawer} items={[{id:'inspect',label:'INSPECT'},{id:'config',label:'CONFIG'},{id:'events',label:'EVENTS',badge:String(scenario.events.length)},{id:'evidence',label:'EVIDENCE',badge:evidence?'ON':undefined}]} onSelect={openDrawer}/><button type="button" className="visual-tool-button" onClick={onExit}>EXIT</button></div></>}
    hud={<><div><span>SCALE</span><strong>{state.scale.toUpperCase()}</strong></div><div><span>PROTOCOL</span><strong>{state.protocol}</strong></div><div><span>{physicalJourneyActive ? 'FORWARDING' : packetObjectActive ? 'ASSEMBLY' : 'ACTIVE STATE'}</span><strong className={toneClass}>{physicalJourneyActive ? state.packetTransitStage.toUpperCase() : packetObjectActive ? state.packetAssemblyStage.toUpperCase() : state.impairmentState.toUpperCase()}</strong></div><div><span>PROVENANCE</span><strong className={provenanceClass(state.provenance)}>{state.provenance}</strong></div></>}
    timeline={<VisualTimeRail timeMs={timeMs} durationMs={scenario.durationMs} playing={playing} playbackSpeed={playbackSpeed} onPlaybackSpeedChange={setPlaybackSpeed} label="GLOBAL TIME MACHINE" context={`${profileLabel} · ${dnsLabel} · ${godModeLabel}`} events={timelineEvents} milestones={timelineMilestones} onToggle={togglePlayback} onReset={()=>seek(0)} onSeek={seek}/>}
  >
    <div className={`journey-cinematic-stage ${causalWorldActive ? 'causal-world-active' : ''} ${packetObjectActive ? 'phase5-object-active' : ''} ${physicalJourneyActive ? 'phase5-physical-active' : ''} ${toneClass}`} data-profile={profile} data-dns-profile={dnsProfile} data-impairment={impairmentProfile} data-modifiers={selectedModifiers.join(' ')}>
      <nav className="journey-depth journey-depth-overlay" aria-label="Active Journey scale">{scaleOrder.map((scale)=><div key={scale} className={`${scale===state.scale?'active':''} ${JOURNEY_SCALE_DEPTH[scale] < state.scaleDepth?'behind':''}`}><i/><span>{scale.toUpperCase()}</span><small>0{JOURNEY_SCALE_DEPTH[scale]+1}</small></div>)}</nav>
      <div className={`journey-scene-shell ${packetObjectActive ? 'phase5-packet-active' : ''} ${physicalJourneyActive ? 'phase5-physical-active' : ''} ${measuredState && measuredScene ? 'measured-evidence-active' : ''}`}><div className="depth-rings" aria-hidden="true"><i/><i/><i/><i/></div><AnimatePresence mode="wait" initial={false}><motion.div key={`${state.scale}:${mode}`} className="journey-scene-transition" initial={reduceMotion ? {opacity:1}:{opacity:0,scale:enteringScale,filter:'blur(12px)'}} animate={{opacity:1,scale:1,filter:'blur(0px)'}} exit={reduceMotion ? {opacity:0}:{opacity:0,scale:state.zoom==='out'?.72:1.24,filter:'blur(10px)'}} transition={reduceMotion ? {duration:0} : {duration:.46,ease:[.16,1,.3,1]}}><SemanticScene state={state} hostname={scenario.hostname} address={scenario.destinationAddress} packetProjection={packetProjection} physicalProjection={physicalProjection} onSelectPacketLayer={inspectPacketLayer}/></motion.div></AnimatePresence><MeasuredEvidenceSidecar measuredState={measuredState} scene={measuredScene} hostname={scenario.hostname} destinationAddress={scenario.destinationAddress}/></div>
      <AnimatePresence mode="wait" initial={false}><motion.article key={state.activeEvent.id} className={`journey-callout journey-callout-overlay ${calloutClass}`} initial={reduceMotion?{opacity:1}:{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={reduceMotion ? {duration:0} : {duration:.24}}><div><span>{formatTime(state.activeEvent.atMs)}</span><b className={provenanceClass(state.activeEvent.provenance)}>{state.activeEvent.provenance}</b></div><h2>{state.activeEvent.title}</h2><p>{state.activeEvent.summary}</p><small>{state.activeEvent.detail}</small>{detail&&<button type="button" onClick={()=>{setPlaying(false);onOpenDetail(detail,timeMs)}}>OPEN {detail.toUpperCase()} DETAIL ↗</button>}</motion.article></AnimatePresence>
    </div>
  </VisualWorkspaceShell>;
}

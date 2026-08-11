import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { InternetEvidenceError, InternetEvidenceSnapshot } from './internet/evidence';
import { JourneyLatencyPanel } from './JourneyLatencyPanel';
import {
  buildJourneyScenario,
  JOURNEY_SCALE_DEPTH,
  journeyStateAt,
  normalizeJourneyHostname,
  type JourneyDetailLab,
  type JourneyDnsProfile,
  type JourneyImpairmentProfile,
  type JourneyScale,
  type JourneyState,
  type JourneyTransportProfile,
} from './journey/model';
import './JourneyTheater.css';
import './journey-branch.css';
import './journey-god-mode.css';

const scaleOrder: JourneyScale[] = ['internet', 'routing', 'transport', 'application', 'packet'];
const PROFILE_KEY = 'hopscotch.journey.transport-profile';
const DNS_PROFILE_KEY = 'hopscotch.journey.dns-profile';
const IMPAIRMENT_PROFILE_KEY = 'hopscotch.journey.impairment-profile';

function initialProfile(): JourneyTransportProfile {
  if (typeof sessionStorage === 'undefined') return 'tcp-h2';
  return sessionStorage.getItem(PROFILE_KEY) === 'quic-h3' ? 'quic-h3' : 'tcp-h2';
}

function initialDnsProfile(): JourneyDnsProfile {
  if (typeof sessionStorage === 'undefined') return 'cache-miss';
  return sessionStorage.getItem(DNS_PROFILE_KEY) === 'cache-hit' ? 'cache-hit' : 'cache-miss';
}

function initialImpairmentProfile(): JourneyImpairmentProfile {
  if (typeof sessionStorage === 'undefined') return 'clean';
  const stored = sessionStorage.getItem(IMPAIRMENT_PROFILE_KEY);
  return stored === 'single-loss' || stored === 'latency-spike' || stored === 'route-failure' ? stored : 'clean';
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

function stateToneClass(state: JourneyState): string {
  if (state.impairmentState === 'lost' || state.impairmentState === 'detected' || state.impairmentState === 'recovering') return 'impairment-active';
  if (state.impairmentState === 'delayed' || state.impairmentState === 'estimating') return 'latency-active';
  if (state.impairmentState === 'route-failed') return 'route-failed';
  if (state.impairmentState === 'route-recomputing') return 'route-recomputing';
  if (state.impairmentState === 'route-ready') return 'route-ready';
  return '';
}

function calloutToneClass(state: JourneyState): string {
  if (state.impairmentState === 'lost' || state.impairmentState === 'detected' || state.impairmentState === 'recovering') return 'impairment-callout';
  if (state.impairmentState === 'delayed' || state.impairmentState === 'estimating') return 'latency-callout';
  if (state.impairmentState === 'route-failed') return 'route-failure-callout';
  if (state.impairmentState === 'route-recomputing') return 'route-recompute-callout';
  if (state.impairmentState === 'route-ready') return 'route-ready-callout';
  return '';
}

function sceneMode(state: JourneyState): string {
  if (state.scale !== 'application') return `${state.scale}:${state.transportProfile}:${state.activeEvent.kind}`;
  if (state.protocol === 'DNS') return `dns:${state.dnsProfile}`;
  if (state.protocol.includes('TLS')) return `tls:${state.transportProfile}`;
  if (state.protocol.startsWith('HTTP')) return `http:${state.transportProfile}:${state.activeEvent.kind}`;
  return state.journeyComplete || state.responseReady ? 'response' : 'intent';
}

function InternetScene({ state }: { state: JourneyState }) {
  return <div className="journey-scene internet-scene">
    <div className="journey-world"><i className="orbit o1"/><i className="orbit o2"/><i className="orbit o3"/><b className="as-node source">AS ACCESS</b><b className="as-node transit">TRANSIT</b><b className="as-node destination">CONTENT AS</b><span className="facility-dot f1"/><span className="facility-dot f2"/><span className="facility-dot f3"/><svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M17 42 C34 20 55 17 82 34"/><path className="physical" d="M18 45 C44 66 69 2 84 31"/></svg></div>
    <div className="scene-caption"><span>{state.protocol}</span><strong>{state.phase === 'pullback-internet' ? 'GLOBAL CONTEXT RESTORED' : 'INTERDOMAIN CONTEXT'}</strong><p>{state.phase === 'infrastructure-context' ? 'Public infrastructure can decorate geography. The forwarding story remains simulated.' : 'Policy chooses the simulated AS path; external observations stay separate evidence.'}</p></div>
  </div>;
}

function RoutingScene({ state, address }: { state: JourneyState; address: string }) {
  const ready = state.route === 'gateway-ready' || state.route === 'internet-path-ready';
  if (state.impairmentProfile !== 'route-failure') {
    return <div className="journey-scene routing-scene">
      <div className="route-topology"><div className="route-node endpoint"><span>HOST</span><strong>CLIENT</strong></div><i className="route-link active"/><div className={`route-node ${ready ? 'active' : ''}`}><span>NEXT HOP</span><strong>EDGE</strong></div><i className={`route-link ${ready ? 'active' : ''}`}/><div className={`route-node ${ready ? 'active' : ''}`}><span>ROUTE</span><strong>CORE</strong></div><i className={`route-link ${state.route === 'internet-path-ready' ? 'active' : ''}`}/><div className="route-node endpoint destination"><span>DST</span><strong>{address}</strong></div></div>
      <div className="route-table"><span>DESTINATION</span><span>NEXT HOP</span><span>STATE</span><strong>{address}/32</strong><strong>{ready ? 'DEFAULT GATEWAY' : 'LOOKUP…'}</strong><strong>{state.route.toUpperCase()}</strong></div>
    </div>;
  }

  const failed = state.route === 'failed' || state.route === 'recomputing' || state.route === 'alternate-ready' || (state.route === 'internet-path-ready' && state.routeMetrics?.failedLinkId === 'r1-core');
  const recomputing = state.route === 'recomputing';
  const alternateActive = state.route === 'alternate-ready' || (state.route === 'internet-path-ready' && state.routeMetrics?.activePath === 'alternate');
  const primaryActive = !failed && (state.route === 'gateway-ready' || state.route === 'lookup');
  const activePath = state.routeMetrics?.activePath ?? (primaryActive ? 'primary' : 'primary');
  return <div className="journey-scene routing-scene route-god-scene">
    <div className="route-god-topology">
      <div className="route-god-node"><span>HOST</span><strong>CLIENT</strong></div>
      <div className="route-god-node"><span>NEXT HOP</span><strong>EDGE</strong></div>
      <div className="route-branches">
        <div className={`route-branch-row primary ${primaryActive ? 'active' : ''} ${failed ? 'failed' : ''}`}><span>R1 → CORE</span><i/><b>COST 22</b></div>
        <div className={`route-branch-row alternate ${recomputing ? 'recomputing' : ''} ${alternateActive ? 'active' : ''}`}><span>R2 → CORE</span><i/><b>COST 52</b></div>
      </div>
      <div className="route-god-node destination"><span>DST</span><strong>{address}</strong></div>
    </div>
    <div className="route-god-metrics">
      <div><span>PRIMARY</span><strong>22</strong></div>
      <div><span>ALTERNATE</span><strong>52</strong></div>
      <div className={failed && !alternateActive ? (recomputing ? 'warning' : 'danger') : alternateActive ? 'success' : ''}><span>ACTIVE PATH</span><strong>{activePath.toUpperCase()}</strong></div>
      <div className={failed ? 'danger' : ''}><span>FAILED LINK</span><strong>{failed ? 'R1 → CORE' : 'NONE'}</strong></div>
    </div>
  </div>;
}

function TransportScene({ state }: { state: JourneyState }) {
  const quic = state.transportProfile === 'quic-h3';
  const established = state.transport === 'established' || state.transport === 'complete';
  const complete = state.transport === 'complete';
  const detectingLoss = state.activeEvent.kind === 'transport.loss-detected';
  const leftLabel = quic ? 'CLIENT QUIC' : 'CLIENT TCP';
  const rightLabel = quic ? 'SERVER QUIC' : 'SERVER TCP';
  const leftState = complete ? 'COMPLETE' : established ? '1-RTT READY' : quic ? 'INITIAL / HANDSHAKE' : 'SYN-SENT';
  const rightState = complete ? 'COMPLETE' : established ? '1-RTT READY' : quic ? 'INITIAL / HANDSHAKE' : 'LISTEN';
  return <div className={`journey-scene transport-scene ${quic ? 'quic-transport-scene' : ''} ${detectingLoss ? 'loss-detected-scene' : ''}`}>
    <div className="transport-endpoints"><div><span>{leftLabel}</span><strong>{leftState}</strong></div><div><span>{rightLabel}</span><strong>{rightState}</strong></div></div>
    <div className="transport-wire"><i/><motion.b key={state.activeEvent.id} initial={{ left: state.activeEvent.actor.includes('server') || state.activeEvent.actor.includes('Server') ? '76%' : '18%', opacity: 0 }} animate={{ left: state.activeEvent.actor.includes('server') || state.activeEvent.actor.includes('Server') ? '22%' : '72%', opacity: 1 }} transition={{ duration: .48, ease: [0.16,1,.3,1] }}>{state.phase.toUpperCase()}</motion.b></div>
    {state.impairmentProfile === 'latency-spike' && (state.activeEvent.kind === 'transport.latency' || state.activeEvent.kind === 'transport.rtt-update') && <JourneyLatencyPanel state={state}/>}
    {detectingLoss ? <div className="loss-transport-panel">
      {quic ? <><div><span>ACK RANGES</span><strong>4105–4107 · 4109–4112</strong></div><div className="loss-gap"><span>MISSING PACKET</span><strong>PN 4108</strong></div><div><span>STREAM GAP</span><strong>4096–5555</strong></div></> : <><div><span>RECEIVE NEXT</span><strong>2461</strong></div><div className="loss-gap"><span>DUPLICATE ACK</span><strong>ACK 2461 × 3</strong></div><div><span>MISSING RANGE</span><strong>SEQ 2461–3920</strong></div></>}
    </div> : <div className="sequence-state"><div><span>TRANSPORT</span><strong>{quic ? 'UDP + QUIC' : 'TCP BYTE STREAM'}</strong></div><div><span>{quic ? 'CRYPTO LEVEL' : 'DELIVERY'}</span><strong>{quic ? (state.tls === 'application-keys' ? '1-RTT' : state.tls === 'handshake-keys' ? 'HANDSHAKE' : 'INITIAL') : complete ? 'CUMULATIVELY ACKED' : established ? 'BYTE STREAM READY' : 'HANDSHAKE'}</strong></div></div>}
  </div>;
}

function DnsScene({ state, hostname, address }: { state: JourneyState; hostname: string; address: string }) {
  if (state.dnsProfile === 'cache-hit') {
    return <div className="journey-scene dns-scene dns-hit-scene">
      <div className="dns-hit-path"><div className="active"><i/><span>STUB</span></div><b>→</b><div className="active cache"><i/><span>LOCAL CACHE</span></div></div>
      <div className="dns-answer"><span>{hostname}</span><b>→</b><strong>{state.resolvedAddress ?? address}</strong></div>
      <div className="dns-upstream-idle"><span>RECURSIVE · IDLE</span><span>ROOT · IDLE</span><span>TLD · IDLE</span><span>AUTH · IDLE</span></div>
      <p>Cache hit · TTL {state.dnsTtlSeconds ?? '—'}s. No upstream DNS traffic is generated.</p>
    </div>;
  }
  const nodes = ['STUB','RECURSIVE','ROOT','TLD','AUTH'];
  return <div className="journey-scene dns-scene"><div className="dns-chain">{nodes.map((node,index)=><div key={node} className={index <= Math.min(4, Math.max(0, state.activeEventIndex - 1)) ? 'active' : ''}><i/><span>{node}</span></div>)}</div><div className="dns-answer"><span>{hostname}</span><b>→</b><strong>{state.resolvedAddress ?? 'RESOLVING…'}</strong></div><p>{state.dns === 'cached' ? `Resolver cache holds ${address} · TTL ${state.dnsTtlSeconds ?? '—'}s.` : 'Recursive resolution is walking authority state.'}</p></div>;
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
  const progress = recovered ? 84 : state.http === 'streaming' ? 72 : state.http === 'complete' ? 100 : state.http === 'headers' ? 34 : state.http === 'request-sent' ? 16 : 5;
  const protocol = h3 ? 'HTTP/3' : 'HTTP/2';
  const payloadLabel = recovered ? 'DELIVERY RESUMES' : state.http === 'request-sent' ? `GET / · ${hostname}` : state.http === 'headers' ? ':status 200' : state.http === 'streaming' || state.http === 'complete' ? 'RESPONSE DATA' : h3 ? 'CONTROL + QPACK' : 'SETTINGS';
  return <div className={`journey-scene http-scene ${h3 ? 'h3-scene' : ''} ${recovered ? 'loss-recovered-scene' : ''}`}><div className="http-request-line"><span>{protocol}</span><strong>{payloadLabel}</strong></div>{recovered&&<div className="recovery-banner"><span>TRANSPORT REPAIRED</span><strong>{h3 ? 'STREAM 4096–5555 CONTIGUOUS' : 'CUMULATIVE ACK 2461 → 8301'}</strong></div>}<div className="http-stream"><span>{h3 ? 'REQUEST STREAM' : 'STREAM 1'}</span><i><b style={{width:`${progress}%`}}/></i><strong>{progress}%</strong></div><div className="http-stream muted"><span>TRANSPORT</span><i><b style={{width:`${Math.max(12,progress-14)}%`}}/></i><strong>{h3 ? 'QUIC 1-RTT' : 'TLS OVER TCP'}</strong></div><p>{recovered ? (h3 ? 'The missing QUIC STREAM range has arrived in a new packet number; this request stream can advance again.' : 'TCP repaired the missing byte range; HTTP/2 can consume the ordered byte stream again.') : h3 ? 'HTTP/3 maps request/response data to QUIC streams; there is no TCP connection beneath it.' : 'Application frames remain encrypted on the wire and inherit TCP delivery behavior.'}</p></div>;
}

function PacketScene({ state }: { state: JourneyState }) {
  const quic = state.transportProfile === 'quic-h3';
  const loss = state.activeEvent.kind === 'transport.loss';
  const retransmit = state.activeEvent.kind === 'transport.retransmit';
  const layers = quic ? [['ETHERNET','14 B'],['IPv4','20 B'],['UDP','8 B'],['QUIC','PROTECTED']] : [['ETHERNET','14 B'],['IPv4','20 B'],['TCP','20 B+'],['TLS APPLICATION DATA','ENCRYPTED']];
  return <div className={`journey-scene packet-scene ${quic ? 'quic-packet-scene' : ''} ${loss ? 'packet-loss-scene' : ''} ${retransmit ? 'packet-repair-scene' : ''}`}><div className="packet-layers">{layers.map(([label,value],index)=><div key={label} className={index===3?'encrypted':''}><span>{label}</span><strong>{value}</strong></div>)}</div>{(loss||retransmit)&&<div className="packet-impairment-card"><span>{loss?'DROPPED':'REPAIR TRANSMISSION'}</span>{quic?<><strong>{loss?'PN 4108':'NEW PN 4113'}</strong><small>STREAM 4096–5555</small></>:<><strong>SEQ 2461–3920</strong><small>{loss?'MISSING BYTE RANGE':'FAST RETRANSMIT'}</small></>}</div>}<div className="packet-bytes">{['45','00','01','9A','00','01','40','00','40',quic?'11':'06','B7','5C','C0','00','02','0A','CB','00','71','2A'].map((byte,index)=><b key={`${byte}-${index}`} className={state.packet === 'headers' && index < 12 ? 'hot' : ''}>{byte}</b>)}</div><p>{loss ? (quic ? 'Packet 4108 is gone. QUIC will recover its STREAM data without reusing packet number 4108.' : 'This TCP byte range is now missing; cumulative delivery cannot advance past SEQ 2461.') : retransmit ? (quic ? 'The same STREAM range is carried in new packet 4113. QUIC packet numbers are never retransmitted.' : 'Fast retransmit sends the missing TCP sequence range again before the normal timeout.') : quic ? 'UDP and QUIC headers remain structurally visible while the QUIC protected payload stays opaque without key material.' : state.packet === 'headers' ? 'Header bytes map to delivery fields while the TLS payload remains opaque.' : 'One representative frame is frozen without creating a second transfer.'}</p></div>;
}

function IntentScene({ hostname }: { hostname: string }) {
  return <div className="journey-scene response-scene intent-scene"><div className="browser-frame"><div><i/><i/><i/><span>{hostname}</span></div><section><b>URL</b><strong>APPLICATION INTENT</strong><p>The browser has a hostname and an intent. DNS, routing, transport, encryption, and HTTP state do not exist yet.</p></section></div></div>;
}

function ResponseScene({ hostname }: { hostname: string }) {
  return <div className="journey-scene response-scene"><div className="browser-frame"><div><i/><i/><i/><span>{hostname}</span></div><section><b>200</b><strong>RESPONSE READY</strong><p>Intent satisfied after DNS, routing, transport, encryption, HTTP, and packet delivery.</p></section></div></div>;
}

function ApplicationScene({ state, hostname, address }: { state: JourneyState; hostname: string; address: string }) {
  if (state.protocol === 'DNS') return <DnsScene state={state} hostname={hostname} address={address}/>;
  if (state.protocol.includes('TLS')) return <TlsScene state={state} hostname={hostname}/>;
  if (state.protocol.startsWith('HTTP')) return <HttpScene state={state} hostname={hostname}/>;
  if (state.responseReady || state.journeyComplete) return <ResponseScene hostname={hostname}/>;
  return <IntentScene hostname={hostname}/>;
}

function SemanticScene({ state, hostname, address }: { state: JourneyState; hostname: string; address: string }) {
  if (state.scale === 'internet') return <InternetScene state={state}/>;
  if (state.scale === 'routing') return <RoutingScene state={state} address={address}/>;
  if (state.scale === 'transport') return <TransportScene state={state}/>;
  if (state.scale === 'packet') return <PacketScene state={state}/>;
  return <ApplicationScene state={state} hostname={hostname} address={address}/>;
}

export function JourneyTheater({ hostname, timeMs, startPlaying, evidence, onHostnameChange, onTimeChange, onEvidenceChange, onOpenDetail, onExit }: {
  hostname: string;
  timeMs: number;
  startPlaying: boolean;
  evidence: InternetEvidenceSnapshot | null;
  onHostnameChange: (hostname: string) => void;
  onTimeChange: (timeMs: number) => void;
  onEvidenceChange: (evidence: InternetEvidenceSnapshot | null) => void;
  onOpenDetail: (lab: JourneyDetailLab, timeMs: number) => void;
  onExit: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [profile, setProfile] = useState<JourneyTransportProfile>(initialProfile);
  const [dnsProfile, setDnsProfile] = useState<JourneyDnsProfile>(initialDnsProfile);
  const [impairmentProfile, setImpairmentProfile] = useState<JourneyImpairmentProfile>(initialImpairmentProfile);
  const [playing, setPlaying] = useState(startPlaying);
  const [draftHostname, setDraftHostname] = useState(hostname);
  const [hostError, setHostError] = useState<string | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const eventRailRef = useRef<HTMLDivElement>(null);
  const scenario = useMemo(() => buildJourneyScenario(hostname, { transportProfile: profile, dnsProfile, impairmentProfile }), [hostname, profile, dnsProfile, impairmentProfile]);
  const state = useMemo(() => journeyStateAt(scenario, timeMs), [scenario, timeMs]);
  const mode = sceneMode(state);

  useEffect(() => { sessionStorage.setItem(PROFILE_KEY, profile); }, [profile]);
  useEffect(() => { sessionStorage.setItem(DNS_PROFILE_KEY, dnsProfile); }, [dnsProfile]);
  useEffect(() => { sessionStorage.setItem(IMPAIRMENT_PROFILE_KEY, impairmentProfile); }, [impairmentProfile]);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now();
    const startedFrom = timeMs >= scenario.durationMs ? 0 : timeMs;
    if (timeMs >= scenario.durationMs) onTimeChange(0);
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(scenario.durationMs, startedFrom + now - startedAt);
      onTimeChange(next);
      if (next >= scenario.durationMs) { setPlaying(false); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, scenario.id, scenario.durationMs]);

  useEffect(() => {
    const current = eventRailRef.current?.querySelector<HTMLElement>('.journey-event.current');
    current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
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
  const chooseImpairmentProfile = (next: JourneyImpairmentProfile) => { if (next !== impairmentProfile) { setPlaying(false); setImpairmentProfile(next); onTimeChange(0); } };

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
  const togglePlayback = () => setPlaying((current) => !current);
  const detail = state.activeEvent.detailLab;
  const depthDelta = state.scaleDepth - JOURNEY_SCALE_DEPTH[state.previousScale];
  const enteringScale = state.zoom === 'in' || depthDelta > 0 ? .72 : state.zoom === 'out' || depthDelta < 0 ? 1.28 : .97;
  const profileLabel = profile === 'quic-h3' ? 'QUIC + H3' : 'TCP + H2';
  const dnsLabel = dnsProfile === 'cache-hit' ? 'CACHE HIT' : 'CACHE MISS';
  const impairmentLabel = impairmentProfile === 'single-loss' ? 'LOSS' : impairmentProfile === 'latency-spike' ? 'LATENCY' : impairmentProfile === 'route-failure' ? 'ROUTE' : 'CLEAN';
  const dnsStateLabel = state.dns === 'cached' && state.dnsTtlSeconds !== null ? `CACHED · ${state.dnsTtlSeconds}s` : state.dns.toUpperCase();
  const transportStateLabel = state.impairmentProfile === 'single-loss' && state.impairmentState !== 'armed' && state.impairmentState !== 'recovered' ? `${state.transport.toUpperCase()} · ${state.impairmentState.toUpperCase()}` : state.transport.toUpperCase();
  const toneClass = stateToneClass(state);
  const calloutClass = calloutToneClass(state);

  return <motion.section className="journey-workspace" data-profile={profile} data-dns-profile={dnsProfile} data-impairment={impairmentProfile} initial={reduceMotion ? {opacity:1}:{opacity:0,scale:.985}} animate={{opacity:1,scale:1}} exit={{opacity:0}}>
    <header className="journey-heading"><div><p className="eyebrow">Lab 07 · GOD MODE Journey</p><h1>ONE REQUEST.<br/><span>BREAK THE PATH.</span></h1></div><div className="journey-heading-actions"><span>{profileLabel} · {dnsLabel} · {impairmentLabel} · {scenario.events.length} EVENTS</span><button className="lab-mode" type="button" onClick={onExit}>EXIT JOURNEY</button></div></header>

    <form className="journey-config journey-config-branch journey-config-loss" onSubmit={applyHostname}><label><span>HOSTNAME</span><input value={draftHostname} maxLength={253} spellCheck={false} autoComplete="off" onChange={(event)=>setDraftHostname(event.currentTarget.value)}/></label><button type="submit">APPLY + RESET</button><div className="journey-profile journey-transport-profile" role="group" aria-label="Journey transport profile"><button type="button" className={profile==='tcp-h2'?'active':''} onClick={()=>chooseProfile('tcp-h2')}>TCP + H2</button><button type="button" className={profile==='quic-h3'?'active':''} onClick={()=>chooseProfile('quic-h3')}>QUIC + H3</button></div><div className="journey-profile journey-dns-profile" role="group" aria-label="Journey DNS profile"><button type="button" className={dnsProfile==='cache-miss'?'active':''} onClick={()=>chooseDnsProfile('cache-miss')}>CACHE MISS</button><button type="button" className={dnsProfile==='cache-hit'?'active':''} onClick={()=>chooseDnsProfile('cache-hit')}>CACHE HIT</button></div><div className="journey-profile journey-impairment-profile" role="group" aria-label="Journey impairment profile"><button type="button" className={impairmentProfile==='clean'?'active':''} onClick={()=>chooseImpairmentProfile('clean')}>CLEAN</button><button type="button" className={impairmentProfile==='single-loss'?'active':''} onClick={()=>chooseImpairmentProfile('single-loss')}>LOSS</button><button type="button" className={impairmentProfile==='latency-spike'?'active':''} onClick={()=>chooseImpairmentProfile('latency-spike')}>LATENCY</button><button type="button" className={impairmentProfile==='route-failure'?'active':''} onClick={()=>chooseImpairmentProfile('route-failure')}>ROUTE</button></div><button type="button" className="context-button" onClick={()=>void attachEvidence()} disabled={evidenceLoading}>{evidenceLoading?'ATTACHING…':evidence?'REFRESH CONTEXT':'ATTACH CONTEXT'}</button><p>{hostError ?? evidenceError ?? 'GOD MODE, DNS, and transport choices are simulated configuration. Live/public evidence never rewrites them.'}</p></form>

    <div className="journey-main">
      <section className="journey-stage">
        <div className="journey-stage-meta"><div><span>TIME</span><strong>{formatTime(timeMs)}</strong></div><div><span>SCALE</span><strong>{state.scale.toUpperCase()}</strong></div><div><span>TRANSPORT</span><strong>{profileLabel}</strong></div><div><span>DNS PATH</span><strong>{dnsLabel}</strong></div><div><span>IMPAIRMENT</span><strong className={toneClass}>{state.impairmentState.toUpperCase()}</strong></div><div><span>PROTOCOL</span><strong>{state.protocol}</strong></div><div><span>PROVENANCE</span><strong className={provenanceClass(state.provenance)}>{state.provenance}</strong></div></div>
        <div className="journey-camera">
          <nav className="journey-depth" aria-label="Active Journey scale">{scaleOrder.map((scale)=><div key={scale} className={`${scale===state.scale?'active':''} ${JOURNEY_SCALE_DEPTH[scale] < state.scaleDepth?'behind':''}`}><i/><span>{scale.toUpperCase()}</span><small>0{JOURNEY_SCALE_DEPTH[scale]+1}</small></div>)}</nav>
          <div className="journey-scene-shell"><div className="depth-rings" aria-hidden="true"><i/><i/><i/><i/></div><AnimatePresence key={scenario.id} mode="sync" initial={false}><motion.div key={`${state.scale}:${mode}`} className="journey-scene-transition" initial={reduceMotion ? {opacity:1}:{opacity:0,scale:enteringScale,filter:'blur(12px)'}} animate={{opacity:1,scale:1,filter:'blur(0px)'}} exit={reduceMotion ? {opacity:0}:{opacity:0,scale:state.zoom==='out'?.72:1.24,filter:'blur(10px)'}} transition={reduceMotion ? {duration:0} : {duration:.46,ease:[.16,1,.3,1]}}><SemanticScene state={state} hostname={scenario.hostname} address={scenario.destinationAddress}/></motion.div></AnimatePresence></div>
          <AnimatePresence mode="wait" initial={false}><motion.article key={state.activeEvent.id} className={`journey-callout ${calloutClass}`} initial={reduceMotion?{opacity:1}:{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={reduceMotion ? {duration:0} : {duration:.24}}><div><span>{formatTime(state.activeEvent.atMs)}</span><b className={provenanceClass(state.activeEvent.provenance)}>{state.activeEvent.provenance}</b></div><h2>{state.activeEvent.title}</h2><p>{state.activeEvent.summary}</p><small>{state.activeEvent.detail}</small>{detail&&<button type="button" onClick={()=>{setPlaying(false);onOpenDetail(detail,timeMs)}}>OPEN {detail.toUpperCase()} DETAIL ↗</button>}</motion.article></AnimatePresence>
        </div>
        <div className="journey-state-strip"><div><span>DNS</span><strong>{dnsStateLabel}</strong></div><div><span>ROUTE</span><strong className={state.impairmentProfile==='route-failure'?toneClass:''}>{state.route.toUpperCase()}</strong></div><div><span>{profile==='quic-h3'?'QUIC':'TCP'}</span><strong className={state.impairmentProfile==='single-loss'||state.impairmentProfile==='latency-spike'?toneClass:''}>{transportStateLabel}</strong></div><div><span>TLS</span><strong>{state.tls.toUpperCase()}</strong></div><div><span>{profile==='quic-h3'?'H3':'H2'}</span><strong>{state.http.toUpperCase()}</strong></div><div><span>PACKET</span><strong>{state.packet.toUpperCase()}</strong></div></div>
      </section>

      <aside className="journey-rail"><section className="journey-context"><div className="rail-title"><span>ENDPOINT CONTEXT</span><strong>{evidence?'ATTACHED':'SIMULATION ONLY'}</strong></div>{evidence?<><div className="context-facts"><div><b>EDGE OBSERVED</b><strong>{evidence.edge.asn?`AS${evidence.edge.asn}`:'ASN UNAVAILABLE'}</strong><small>{evidence.edge.colo??'COLO UNAVAILABLE'}</small></div><div><b>PUBLIC COLLECTOR</b><strong>{evidence.routing.originAsns.length?evidence.routing.originAsns.map((asn)=>`AS${asn}`).join(' / '):'ORIGIN UNAVAILABLE'}</strong><small>{evidence.routing.prefix??'PREFIX UNAVAILABLE'}</small></div></div><p><b>DECORATION ONLY.</b> These observations do not choose {profileLabel}, {dnsLabel}, or {impairmentLabel} and do not become the simulated path.</p></>:<p>Attach optional Cloudflare/RIPE context. The selected {profileLabel} · {dnsLabel} · {impairmentLabel} story remains deterministic.</p>}</section><section className="journey-events"><div className="rail-title"><span>CAUSAL CHAIN</span><strong>{String(state.activeEventIndex+1).padStart(2,'0')} / {scenario.events.length}</strong></div><div className="journey-event-list" ref={eventRailRef}>{scenario.events.map((current,index)=>{const complete=current.atMs<=timeMs;const active=current.id===state.activeEvent.id;const lossEvent=isLossEvent(current.kind);const latencyEvent=isLatencyEvent(current.kind);const routeEvent=isRouteFailureEvent(current.kind);return <button type="button" key={current.id} className={`journey-event ${complete?'complete':''} ${active?'current':''} ${lossEvent?'impairment-event':''} ${latencyEvent?'latency-event':''} ${routeEvent?'route-event':''}`} onClick={()=>seek(current.atMs)}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{current.title}</strong><small>{formatTime(current.atMs)} · {current.scale.toUpperCase()} · {current.protocol}</small></div><i className={provenanceClass(current.provenance)}/></button>})}</div></section></aside>
    </div>

    <footer className="journey-time-machine"><div className="journey-time-controls"><button type="button" onClick={togglePlayback}>{playing?'Ⅱ':'▶'}</button><button type="button" onClick={()=>seek(0)}>↺</button></div><div className="journey-time-readout"><span>GLOBAL TIME MACHINE · {profileLabel} · {dnsLabel} · {impairmentLabel}</span><strong>{formatTime(timeMs)}</strong></div><div className="journey-scrubber"><div>{scenario.events.map((current)=><i key={current.id} className={`${current.atMs<=timeMs?'passed':''} ${isLossEvent(current.kind)&&current.kind!=='transport.recovered'?'impairment-marker':''} ${isLatencyEvent(current.kind)?'latency-marker':''} ${isRouteFailureEvent(current.kind)?'route-marker':''}`} style={{left:`${current.atMs/scenario.durationMs*100}%`}}/>)}</div><input type="range" min="0" max={scenario.durationMs} step="10" value={Math.round(timeMs)} onChange={(event)=>seek(Number(event.currentTarget.value))}/></div><span className="journey-duration">{formatTime(scenario.durationMs)}</span></footer>
  </motion.section>;
}
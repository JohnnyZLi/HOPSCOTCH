import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { InternetEvidenceError, InternetEvidenceSnapshot } from './internet/evidence';
import {
  buildJourneyScenario,
  JOURNEY_SCALE_DEPTH,
  journeyStateAt,
  normalizeJourneyHostname,
  type JourneyDetailLab,
  type JourneyScale,
  type JourneyState,
} from './journey/model';
import './JourneyTheater.css';

const scaleOrder: JourneyScale[] = ['internet', 'routing', 'transport', 'application', 'packet'];

function formatTime(timeMs: number): string {
  const seconds = Math.floor(timeMs / 1000).toString().padStart(2, '0');
  const milliseconds = Math.floor(timeMs % 1000).toString().padStart(3, '0');
  return `00:${seconds}.${milliseconds}`;
}

function sceneMode(state: JourneyState): string {
  if (state.scale !== 'application') return state.scale;
  if (state.protocol === 'DNS') return 'dns';
  if (state.protocol.startsWith('TLS')) return 'tls';
  if (state.protocol.startsWith('HTTP')) return 'http';
  return state.journeyComplete || state.responseReady ? 'response' : 'intent';
}

function provenanceClass(value: string): string {
  return value.toLowerCase().replaceAll(' ', '-');
}

function InternetScene({ state }: { state: JourneyState }) {
  return <div className="journey-scene internet-scene">
    <div className="journey-world"><i className="orbit o1"/><i className="orbit o2"/><i className="orbit o3"/><b className="as-node source">AS ACCESS</b><b className="as-node transit">TRANSIT</b><b className="as-node destination">CONTENT AS</b><span className="facility-dot f1"/><span className="facility-dot f2"/><span className="facility-dot f3"/><svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M17 42 C34 20 55 17 82 34"/><path className="physical" d="M18 45 C44 66 69 2 84 31"/></svg></div>
    <div className="scene-caption"><span>{state.protocol}</span><strong>{state.phase === 'pullback-internet' ? 'GLOBAL CONTEXT RESTORED' : 'INTERDOMAIN CONTEXT'}</strong><p>{state.phase === 'infrastructure-context' ? 'Public infrastructure can decorate geography. The forwarding story remains simulated.' : 'Policy chooses the simulated AS path; external observations stay separate evidence.'}</p></div>
  </div>;
}

function RoutingScene({ state, address }: { state: JourneyState; address: string }) {
  const ready = state.route === 'gateway-ready' || state.route === 'internet-path-ready';
  return <div className="journey-scene routing-scene">
    <div className="route-topology"><div className="route-node endpoint"><span>HOST</span><strong>CLIENT</strong></div><i className="route-link active"/><div className={`route-node ${ready ? 'active' : ''}`}><span>NEXT HOP</span><strong>EDGE</strong></div><i className={`route-link ${ready ? 'active' : ''}`}/><div className={`route-node ${ready ? 'active' : ''}`}><span>ROUTE</span><strong>CORE</strong></div><i className={`route-link ${state.route === 'internet-path-ready' ? 'active' : ''}`}/><div className="route-node endpoint destination"><span>DST</span><strong>{address}</strong></div></div>
    <div className="route-table"><span>DESTINATION</span><span>NEXT HOP</span><span>STATE</span><strong>{address}/32</strong><strong>{ready ? 'DEFAULT GATEWAY' : 'LOOKUP…'}</strong><strong>{state.route.toUpperCase()}</strong></div>
  </div>;
}

function TransportScene({ state }: { state: JourneyState }) {
  const established = state.transport === 'established' || state.transport === 'complete';
  const complete = state.transport === 'complete';
  return <div className="journey-scene transport-scene">
    <div className="transport-endpoints"><div><span>CLIENT TCP</span><strong>{established ? 'ESTABLISHED' : 'SYN-SENT'}</strong></div><div><span>SERVER TCP</span><strong>{established ? 'ESTABLISHED' : 'LISTEN'}</strong></div></div>
    <div className="transport-wire"><i/><motion.b key={state.activeEvent.id} initial={{ left: state.activeEvent.actor.includes('server') ? '76%' : '18%', opacity: 0 }} animate={{ left: state.activeEvent.actor.includes('server') ? '22%' : '72%', opacity: 1 }} transition={{ duration: .48, ease: [0.16,1,.3,1] }}>{complete ? 'ACK COMPLETE' : state.phase.toUpperCase()}</motion.b></div>
    <div className="sequence-state"><div><span>CONNECTION</span><strong>{state.transport.toUpperCase()}</strong></div><div><span>DELIVERY</span><strong>{complete ? 'CUMULATIVELY ACKED' : established ? 'BYTE STREAM READY' : 'HANDSHAKE'}</strong></div></div>
  </div>;
}

function DnsScene({ state, hostname, address }: { state: JourneyState; hostname: string; address: string }) {
  const nodes = ['STUB','RECURSIVE','ROOT','TLD','AUTH'];
  return <div className="journey-scene dns-scene"><div className="dns-chain">{nodes.map((node,index)=><div key={node} className={index <= Math.min(4, Math.max(0, state.activeEventIndex - 1)) ? 'active' : ''}><i/><span>{node}</span></div>)}</div><div className="dns-answer"><span>{hostname}</span><b>→</b><strong>{state.resolvedAddress ?? 'RESOLVING…'}</strong></div><p>{state.dns === 'cached' ? `Resolver cache now holds ${address}.` : 'Recursive resolution is walking authority state.'}</p></div>;
}

function TlsScene({ state, hostname }: { state: JourneyState; hostname: string }) {
  const encryption = state.tls === 'handshake-keys' || state.tls === 'application-keys';
  return <div className="journey-scene tls-scene"><div className="tls-peers"><div><span>CLIENT</span><strong>{hostname}</strong></div><div className={`tls-boundary ${encryption ? 'encrypted' : ''}`}><i/><b>{state.tls === 'application-keys' ? 'APPLICATION KEYS' : state.tls === 'handshake-keys' ? 'HANDSHAKE KEYS' : 'VISIBLE NEGOTIATION'}</b><i/></div><div><span>SERVER</span><strong>TLS 1.3</strong></div></div><div className="tls-schedule"><span className={state.tls !== 'idle' ? 'on' : ''}>EARLY SECRET</span><span className={encryption ? 'on' : ''}>HANDSHAKE SECRET</span><span className={state.tls === 'application-keys' ? 'on' : ''}>MASTER SECRET</span><span className={state.tls === 'application-keys' ? 'on' : ''}>APP TRAFFIC</span></div><p>{state.phase === 'certificate-validation' ? 'Certificate identity is being validated independently from routing.' : encryption ? 'Wire protection is active; HOPSCOTCH never invents secret bytes.' : 'ClientHello / ServerHello negotiate before encrypted handshake traffic begins.'}</p></div>;
}

function HttpScene({ state, hostname }: { state: JourneyState; hostname: string }) {
  const progress = state.http === 'streaming' ? 72 : state.http === 'complete' ? 100 : state.http === 'headers' ? 34 : state.http === 'request-sent' ? 16 : 5;
  return <div className="journey-scene http-scene"><div className="http-request-line"><span>HTTP/2</span><strong>{state.http === 'request-sent' ? `GET / · ${hostname}` : state.http === 'headers' ? ':status 200' : state.http === 'streaming' || state.http === 'complete' ? 'RESPONSE DATA' : 'SETTINGS'}</strong></div><div className="http-stream"><span>STREAM 1</span><i><b style={{width:`${progress}%`}}/></i><strong>{progress}%</strong></div><div className="http-stream muted"><span>CONNECTION</span><i><b style={{width:`${Math.max(12,progress-14)}%`}}/></i><strong>TLS OVER TCP</strong></div><p>Application frames remain encrypted on the wire and inherit TCP delivery behavior.</p></div>;
}

function PacketScene({ state }: { state: JourneyState }) {
  return <div className="journey-scene packet-scene"><div className="packet-layers"><div><span>ETHERNET</span><strong>14 B</strong></div><div><span>IPv4</span><strong>20 B</strong></div><div><span>TCP</span><strong>20 B+</strong></div><div className="encrypted"><span>TLS APPLICATION DATA</span><strong>ENCRYPTED</strong></div></div><div className="packet-bytes">{['45','00','01','9A','00','01','40','00','40','06','B7','5C','C0','00','02','0A','CB','00','71','2A'].map((byte,index)=><b key={`${byte}-${index}`} className={state.packet === 'headers' && index < 12 ? 'hot' : ''}>{byte}</b>)}</div><p>{state.packet === 'headers' ? 'Header bytes are mapped to delivery fields while the TLS payload remains opaque.' : 'One representative frame is frozen without creating a second transfer.'}</p></div>;
}

function IntentScene({ hostname }: { hostname: string }) {
  return <div className="journey-scene response-scene intent-scene"><div className="browser-frame"><div><i/><i/><i/><span>{hostname}</span></div><section><b>URL</b><strong>APPLICATION INTENT</strong><p>The browser has a hostname and an intent. DNS, routing, transport, encryption, and HTTP state do not exist yet.</p></section></div></div>;
}

function ResponseScene({ hostname }: { hostname: string }) {
  return <div className="journey-scene response-scene"><div className="browser-frame"><div><i/><i/><i/><span>{hostname}</span></div><section><b>200</b><strong>RESPONSE READY</strong><p>Intent satisfied after DNS, routing, transport, encryption, HTTP, and packet delivery.</p></section></div></div>;
}

function ApplicationScene({ state, hostname, address }: { state: JourneyState; hostname: string; address: string }) {
  if (state.protocol === 'DNS') return <DnsScene state={state} hostname={hostname} address={address}/>;
  if (state.protocol.startsWith('TLS')) return <TlsScene state={state} hostname={hostname}/>;
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

export function JourneyTheater({
  hostname,
  timeMs,
  startPlaying,
  evidence,
  onHostnameChange,
  onTimeChange,
  onEvidenceChange,
  onOpenDetail,
  onExit,
}: {
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
  const [playing, setPlaying] = useState(startPlaying);
  const [draftHostname, setDraftHostname] = useState(hostname);
  const [hostError, setHostError] = useState<string | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const eventRailRef = useRef<HTMLDivElement>(null);
  const scenario = useMemo(() => buildJourneyScenario(hostname), [hostname]);
  const state = useMemo(() => journeyStateAt(scenario, timeMs), [scenario, timeMs]);
  const mode = sceneMode(state);

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
      setHostError(null);
      setPlaying(false);
      onEvidenceChange(null);
      onHostnameChange(normalized);
      onTimeChange(0);
    } catch (error) {
      setHostError(error instanceof Error ? error.message : 'Invalid hostname.');
    }
  };

  const attachEvidence = async () => {
    setEvidenceLoading(true); setEvidenceError(null);
    try {
      const response = await fetch(`/api/internet/snapshot?host=${encodeURIComponent(hostname)}`, { headers: { accept: 'application/json' } });
      const payload = await response.json() as InternetEvidenceSnapshot | InternetEvidenceError;
      if (!response.ok || ('ok' in payload && payload.ok === false)) throw new Error('error' in payload ? payload.error : `Evidence request failed with HTTP ${response.status}.`);
      if (!('schema' in payload) || payload.schema !== 'hopscotch.internet-evidence') throw new Error('Unexpected evidence payload.');
      onEvidenceChange(payload);
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : 'Live context unavailable.');
    } finally { setEvidenceLoading(false); }
  };

  const seek = (next: number) => { setPlaying(false); onTimeChange(next); };
  const togglePlayback = () => setPlaying((current) => !current);
  const detail = state.activeEvent.detailLab;
  const depthDelta = state.scaleDepth - JOURNEY_SCALE_DEPTH[state.previousScale];
  const enteringScale = state.zoom === 'in' || depthDelta > 0 ? .72 : state.zoom === 'out' || depthDelta < 0 ? 1.28 : .97;

  return <motion.section className="journey-workspace" initial={reduceMotion ? {opacity:1}:{opacity:0,scale:.985}} animate={{opacity:1,scale:1}} exit={{opacity:0}}>
    <header className="journey-heading"><div><p className="eyebrow">Lab 06 · URL Journey</p><h1>ONE REQUEST.<br/><span>EVERY LAYER.</span></h1></div><div className="journey-heading-actions"><span>CANONICAL EVENT LOG · {scenario.events.length} EVENTS</span><button className="lab-mode" type="button" onClick={onExit}>EXIT JOURNEY</button></div></header>

    <form className="journey-config" onSubmit={applyHostname}><label><span>HOSTNAME</span><input value={draftHostname} maxLength={253} spellCheck={false} autoComplete="off" onChange={(event)=>setDraftHostname(event.currentTarget.value)}/></label><button type="submit">APPLY + RESET</button><button type="button" className="context-button" onClick={()=>void attachEvidence()} disabled={evidenceLoading}>{evidenceLoading?'ATTACHING…':evidence?'REFRESH LIVE CONTEXT':'ATTACH LIVE CONTEXT'}</button><p>{hostError ?? evidenceError ?? 'The Journey remains deterministic. Live/public evidence may decorate endpoints but never rewrites the simulated forwarding story.'}</p></form>

    <div className="journey-main">
      <section className="journey-stage">
        <div className="journey-stage-meta"><div><span>TIME</span><strong>{formatTime(timeMs)}</strong></div><div><span>SCALE</span><strong>{state.scale.toUpperCase()}</strong></div><div><span>PROTOCOL</span><strong>{state.protocol}</strong></div><div><span>PROVENANCE</span><strong className={provenanceClass(state.provenance)}>{state.provenance}</strong></div></div>
        <div className="journey-camera">
          <nav className="journey-depth" aria-label="Active Journey scale">{scaleOrder.map((scale)=><div key={scale} className={`${scale===state.scale?'active':''} ${JOURNEY_SCALE_DEPTH[scale] < state.scaleDepth?'behind':''}`}><i/><span>{scale.toUpperCase()}</span><small>0{JOURNEY_SCALE_DEPTH[scale]+1}</small></div>)}</nav>
          <div className="journey-scene-shell">
            <div className="depth-rings" aria-hidden="true"><i/><i/><i/><i/></div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${state.scale}:${mode}`} className="journey-scene-transition" initial={reduceMotion ? {opacity:1}:{opacity:0,scale:enteringScale,filter:'blur(12px)'}} animate={{opacity:1,scale:1,filter:'blur(0px)'}} exit={reduceMotion ? {opacity:0}:{opacity:0,scale:state.zoom==='out'?.72:1.24,filter:'blur(10px)'}} transition={{duration:.46,ease:[.16,1,.3,1]}}>
                <SemanticScene state={state} hostname={scenario.hostname} address={scenario.destinationAddress}/>
              </motion.div>
            </AnimatePresence>
          </div>
          <AnimatePresence mode="wait" initial={false}><motion.article key={state.activeEvent.id} className="journey-callout" initial={reduceMotion?{opacity:1}:{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}><div><span>{formatTime(state.activeEvent.atMs)}</span><b className={provenanceClass(state.activeEvent.provenance)}>{state.activeEvent.provenance}</b></div><h2>{state.activeEvent.title}</h2><p>{state.activeEvent.summary}</p><small>{state.activeEvent.detail}</small>{detail&&<button type="button" onClick={()=>{setPlaying(false);onOpenDetail(detail,timeMs)}}>OPEN {detail.toUpperCase()} DETAIL ↗</button>}</motion.article></AnimatePresence>
        </div>
        <div className="journey-state-strip"><div><span>DNS</span><strong>{state.dns.toUpperCase()}</strong></div><div><span>ROUTE</span><strong>{state.route.toUpperCase()}</strong></div><div><span>TCP</span><strong>{state.transport.toUpperCase()}</strong></div><div><span>TLS</span><strong>{state.tls.toUpperCase()}</strong></div><div><span>HTTP</span><strong>{state.http.toUpperCase()}</strong></div><div><span>PACKET</span><strong>{state.packet.toUpperCase()}</strong></div></div>
      </section>

      <aside className="journey-rail">
        <section className="journey-context"><div className="rail-title"><span>ENDPOINT CONTEXT</span><strong>{evidence?'ATTACHED':'SIMULATION ONLY'}</strong></div>{evidence?<><div className="context-facts"><div><b>EDGE OBSERVED</b><strong>{evidence.edge.asn?`AS${evidence.edge.asn}`:'ASN UNAVAILABLE'}</strong><small>{evidence.edge.colo??'COLO UNAVAILABLE'}</small></div><div><b>PUBLIC COLLECTOR</b><strong>{evidence.routing.originAsns.length?evidence.routing.originAsns.map((asn)=>`AS${asn}`).join(' / '):'ORIGIN UNAVAILABLE'}</strong><small>{evidence.routing.prefix??'PREFIX UNAVAILABLE'}</small></div></div><p><b>DECORATION ONLY.</b> These observations do not become the simulated Journey path.</p></>:<p>Attach optional Cloudflare/RIPE context for this hostname. The 30-event story remains deterministic either way.</p>}</section>
        <section className="journey-events"><div className="rail-title"><span>CAUSAL CHAIN</span><strong>{String(state.activeEventIndex+1).padStart(2,'0')} / {scenario.events.length}</strong></div><div className="journey-event-list" ref={eventRailRef}>{scenario.events.map((current,index)=>{const complete=current.atMs<=timeMs;const active=current.id===state.activeEvent.id;return <button type="button" key={current.id} className={`journey-event ${complete?'complete':''} ${active?'current':''}`} onClick={()=>seek(current.atMs)}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{current.title}</strong><small>{formatTime(current.atMs)} · {current.scale.toUpperCase()} · {current.protocol}</small></div><i className={provenanceClass(current.provenance)}/></button>})}</div></section>
      </aside>
    </div>

    <footer className="journey-time-machine"><div className="journey-time-controls"><button type="button" onClick={togglePlayback}>{playing?'Ⅱ':'▶'}</button><button type="button" onClick={()=>seek(0)}>↺</button></div><div className="journey-time-readout"><span>GLOBAL TIME MACHINE</span><strong>{formatTime(timeMs)}</strong></div><div className="journey-scrubber"><div>{scenario.events.map((current)=><i key={current.id} className={current.atMs<=timeMs?'passed':''} style={{left:`${current.atMs/scenario.durationMs*100}%`}}/>)}</div><input type="range" min="0" max={scenario.durationMs} step="10" value={Math.round(timeMs)} onChange={(event)=>seek(Number(event.currentTarget.value))}/></div><span className="journey-duration">{formatTime(scenario.durationMs)}</span></footer>
  </motion.section>;
}

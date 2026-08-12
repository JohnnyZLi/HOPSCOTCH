import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { DnsTheater } from './DnsTheater';
import { ExploreLauncher, type ExploreDestination } from './ExploreLauncher';
import { HttpComparisonTheater } from './HttpComparisonTheater';
import { JourneyScenarioMenu } from './JourneyScenarioMenu';
import { JourneyTheater } from './JourneyTheater';
import { InternetScaleTheater } from './InternetScaleTheater';
import type { InternetEvidenceSnapshot } from './internet/evidence';
import { bootstrapJourneyFromSearch, seedJourneyBrowserScenario } from './journey/browser.ts';
import type { JourneyDetailLab } from './journey/model';
import type { PortableJourneyScenario } from './journey/scenario.ts';
import { LabNetworkField } from './LabNetworkField';
import { NetworkBuilder } from './NetworkBuilder';
import { NetworkField } from './NetworkField';
import { canonicalUrlForRoute, pathForDestination, resolveAppRoute } from './navigation';
import { ObservedInternet } from './ObservedInternet';
import { MeasuredNetworkWorkspace } from './MeasuredNetworkWorkspace';
import type { MeasuredSnapshotState } from './measurement/state.ts';
import { PacketMicroscope } from './PacketMicroscope';
import { PhysicalInternetGlobe } from './PhysicalInternetGlobe';
import { TcpTheater } from './TcpTheater';
import { TlsTheater } from './TlsTheater';
import { lab01Scenario, lab01StateAt } from './simulation/lab01';
import { latestEventAtOrBefore, type NetworkLayer } from './simulation/model';

type DisplayMode = 'overview' | 'xray';
type ActiveLab = ExploreDestination | null;

const layers: Array<{ id: NetworkLayer; label: string; kicker: string; description: string }> = [
  { id: 'internet', label: 'Internet', kicker: 'Scale 05', description: 'Physical interconnection infrastructure, autonomous systems, public routing evidence, and clearly labeled inference.' },
  { id: 'routing', label: 'Routing', kicker: 'Scale 04', description: 'Build a weighted graph, change topology, inject failures, and watch route truth recompute.' },
  { id: 'transport', label: 'Transport', kicker: 'Scale 03', description: 'Flows, congestion windows, retransmissions, loss, and multiplexing.' },
  { id: 'application', label: 'Application', kicker: 'Scale 02', description: 'DNS, TLS, HTTP, QUIC, and the exchanges behind an application request.' },
  { id: 'packet', label: 'Packet', kicker: 'Scale 01', description: 'Frames, headers, fields, encapsulation, and individual protocol messages.' },
];

const DESTINATION_LAYERS: Readonly<Record<ExploreDestination, NetworkLayer>> = {
  journey: 'application',
  failure: 'routing',
  builder: 'routing',
  packet: 'packet',
  tcp: 'transport',
  dns: 'application',
  tls: 'application',
  http: 'application',
  internet: 'internet',
  physical: 'internet',
  observed: 'internet',
  measured: 'internet',
};

const browserHistoryRoutingAvailable = typeof window !== 'undefined'
  && (window.location.protocol === 'http:' || window.location.protocol === 'https:');

const initialAppRoute = browserHistoryRoutingAvailable
  ? resolveAppRoute(window.location.pathname, window.location.search)
  : resolveAppRoute('/', typeof window === 'undefined' ? '' : window.location.search);

const initialJourneyBootstrap = typeof window === 'undefined' || initialAppRoute.destination !== 'journey'
  ? { scenario: null, error: null }
  : bootstrapJourneyFromSearch(window.location.search);

function formatTime(timeMs: number): string {
  const seconds = Math.floor(timeMs / 1000).toString().padStart(2, '0');
  const milliseconds = Math.floor(timeMs % 1000).toString().padStart(3, '0');
  return `00:${seconds}.${milliseconds}`;
}

export default function App() {
  const initialSharedJourney = initialJourneyBootstrap.scenario;
  const [layer, setLayer] = useState<NetworkLayer>(initialAppRoute.destination ? DESTINATION_LAYERS[initialAppRoute.destination] : 'internet');
  const [mode, setMode] = useState<DisplayMode>('overview');
  const [exploreOpen, setExploreOpen] = useState(false);
  const [activeLab, setActiveLab] = useState<ActiveLab>(initialAppRoute.destination);
  const [labXray, setLabXray] = useState(true);
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [journeyHostname, setJourneyHostname] = useState(initialSharedJourney?.hostname ?? 'example.test');
  const [journeyTimeMs, setJourneyTimeMs] = useState(initialSharedJourney?.timeMs ?? 0);
  const [journeyStartPlaying, setJourneyStartPlaying] = useState(initialAppRoute.destination === 'journey' && !initialSharedJourney);
  const [journeyReturnPending, setJourneyReturnPending] = useState(false);
  const [journeyEvidence, setJourneyEvidence] = useState<InternetEvidenceSnapshot | null>(null);
  const [measuredSession, setMeasuredSession] = useState<MeasuredSnapshotState | null>(null);
  const [journeyScenarioName, setJourneyScenarioName] = useState(initialSharedJourney?.name ?? '');
  const [journeyRenderKey, setJourneyRenderKey] = useState(0);
  const reduceMotion = useReducedMotion();
  const active = layers.find((item) => item.id === layer) ?? layers[0];
  const labState = useMemo(() => lab01StateAt(timeMs), [timeMs]);
  const activeEvent = useMemo(() => latestEventAtOrBefore(lab01Scenario, timeMs), [timeMs]);
  const activePath = lab01Scenario.paths.find((path) => path.id === labState.activePathId) ?? lab01Scenario.paths[0];
  const failureLabActive = activeLab === 'failure';

  const actorNode = lab01Scenario.nodes.find((node) => node.id === activeEvent.actorId);
  const targetNode = lab01Scenario.nodes.find((node) => node.id === activeEvent.targetId);
  const focusX = actorNode && targetNode ? (actorNode.x + targetNode.x) / 2 : actorNode?.x ?? targetNode?.x ?? 60;
  const focusY = actorNode && targetNode ? (actorNode.y + targetNode.y) / 2 : actorNode?.y ?? targetNode?.y ?? 36;
  const cameraScale = labState.phase === 'failure'
    ? 1.045
    : labState.phase === 'converging'
      ? 1.028
      : labState.phase === 'recomputing'
        ? 1.018
        : labState.phase === 'rerouting'
          ? 1.032
          : labState.phase === 'recovered'
            ? 1.012
            : 1;
  const cameraX = ((60 - focusX) / 60) * 14;
  const cameraY = ((36 - focusY) / 36) * 9;

  const pushBrowserRoute = (destination: ExploreDestination | null) => {
    if (!browserHistoryRoutingAvailable) return;
    const nextUrl = destination === null ? '/' : pathForDestination(destination);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) window.history.pushState({}, '', nextUrl);
  };

  useEffect(() => {
    if (!browserHistoryRoutingAvailable) return;

    const applyCurrentLocation = () => {
      const route = resolveAppRoute(window.location.pathname, window.location.search);
      const canonicalUrl = canonicalUrlForRoute(route, window.location.search);
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl !== canonicalUrl) window.history.replaceState(window.history.state, '', canonicalUrl);

      setExploreOpen(false);
      setPlaying(false);
      setJourneyReturnPending(false);

      if (route.destination === null) {
        setLayer('internet');
        setActiveLab(null);
        return;
      }

      const destination = route.destination;
      setLayer(DESTINATION_LAYERS[destination]);
      if (destination === 'failure') setTimeMs(0);

      if (destination === 'journey') {
        const bootstrap = bootstrapJourneyFromSearch(window.location.search);
        if (bootstrap.scenario) {
          setJourneyHostname(bootstrap.scenario.hostname);
          setJourneyTimeMs(bootstrap.scenario.timeMs);
          setJourneyStartPlaying(false);
          setJourneyScenarioName(bootstrap.scenario.name ?? '');
          setJourneyRenderKey((current) => current + 1);
        } else {
          setJourneyStartPlaying(false);
        }
      }

      setActiveLab(destination);
    };

    const initialCanonicalUrl = canonicalUrlForRoute(initialAppRoute, window.location.search);
    const initialCurrentUrl = `${window.location.pathname}${window.location.search}`;
    if (initialCurrentUrl !== initialCanonicalUrl) {
      window.history.replaceState(window.history.state, '', initialCanonicalUrl);
    }

    window.addEventListener('popstate', applyCurrentLocation);
    return () => window.removeEventListener('popstate', applyCurrentLocation);
  }, []);

  useEffect(() => {
    if (!playing || !failureLabActive) return;
    const startedAt = performance.now();
    const startedFrom = timeMs;
    let frameId = 0;
    const tick = (now: number) => {
      const next = Math.min(lab01Scenario.durationMs, startedFrom + (now - startedAt));
      setTimeMs(next);
      if (next >= lab01Scenario.durationMs) {
        setPlaying(false);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [failureLabActive, playing]);

  const openFailureLab = (atMs = 0, autoplay = true) => {
    pushBrowserRoute('failure');
    setLayer('routing'); setTimeMs(atMs); setActiveLab('failure'); setPlaying(autoplay);
  };
  const openPacketLab = () => { pushBrowserRoute('packet'); setPlaying(false); setLayer('packet'); setActiveLab('packet'); };
  const openTcpLab = () => { pushBrowserRoute('tcp'); setPlaying(false); setLayer('transport'); setActiveLab('tcp'); };
  const openDnsLab = () => { pushBrowserRoute('dns'); setPlaying(false); setLayer('application'); setActiveLab('dns'); };
  const openTlsLab = () => { pushBrowserRoute('tls'); setPlaying(false); setLayer('application'); setActiveLab('tls'); };
  const openHttpLab = () => { pushBrowserRoute('http'); setPlaying(false); setLayer('application'); setActiveLab('http'); };
  const openBuilderLab = () => { pushBrowserRoute('builder'); setPlaying(false); setLayer('routing'); setActiveLab('builder'); };
  const openPhysicalInternet = () => { pushBrowserRoute('physical'); setPlaying(false); setLayer('internet'); setActiveLab('physical'); };
  const openInternetLab = () => { pushBrowserRoute('internet'); setPlaying(false); setLayer('internet'); setActiveLab('internet'); };
  const openObservedInternet = () => { pushBrowserRoute('observed'); setPlaying(false); setLayer('internet'); setActiveLab('observed'); };
  const openMeasuredNetwork = () => { pushBrowserRoute('measured'); setPlaying(false); setLayer('internet'); setActiveLab('measured'); };
  const openJourney = () => {
    pushBrowserRoute('journey');
    setPlaying(false);
    setLayer('application');
    setJourneyTimeMs(0);
    setJourneyStartPlaying(true);
    setJourneyReturnPending(false);
    setJourneyScenarioName('');
    setActiveLab('journey');
  };
  const selectExploreDestination = (destination: ExploreDestination) => {
    const openers: Record<ExploreDestination, () => void> = {
      journey: openJourney,
      failure: () => openFailureLab(0, true),
      builder: openBuilderLab,
      packet: openPacketLab,
      tcp: openTcpLab,
      dns: openDnsLab,
      tls: openTlsLab,
      http: openHttpLab,
      internet: openInternetLab,
      physical: openPhysicalInternet,
      observed: openObservedInternet,
      measured: openMeasuredNetwork,
    };
    setExploreOpen(false);
    openers[destination]();
  };
  const openJourneyDetail = (lab: JourneyDetailLab, atMs: number) => {
    const detailLayer: Record<JourneyDetailLab, NetworkLayer> = {
      dns: 'application', tcp: 'transport', tls: 'application', http: 'application', packet: 'packet',
      builder: 'routing', failure: 'routing', internet: 'internet', physical: 'internet', observed: 'internet',
    };
    setPlaying(false);
    setJourneyTimeMs(atMs);
    setJourneyStartPlaying(false);
    setJourneyReturnPending(true);
    setLayer(detailLayer[lab]);
    pushBrowserRoute(lab as ExploreDestination);
    if (lab === 'failure') {
      setTimeMs(1900);
      setActiveLab('failure');
      return;
    }
    setActiveLab(lab);
  };
  const importJourneyScenario = (scenario: PortableJourneyScenario) => {
    seedJourneyBrowserScenario(scenario);
    pushBrowserRoute('journey');
    setPlaying(false);
    setJourneyHostname(scenario.hostname);
    setJourneyTimeMs(scenario.timeMs);
    setJourneyStartPlaying(false);
    setJourneyReturnPending(false);
    setJourneyEvidence(null);
    setJourneyScenarioName(scenario.name ?? '');
    setLayer('application');
    setActiveLab('journey');
    setJourneyRenderKey((current) => current + 1);
  };
  const exitLabs = () => { pushBrowserRoute(null); setPlaying(false); setJourneyReturnPending(false); setExploreOpen(false); setActiveLab(null); };
  const exitActiveLab = () => {
    setPlaying(false);
    if (journeyReturnPending && activeLab !== 'journey') {
      setJourneyReturnPending(false);
      setJourneyStartPlaying(false);
      pushBrowserRoute('journey');
      setActiveLab('journey');
      return;
    }
    exitLabs();
  };

  const togglePlayback = () => {
    if (playing) { setPlaying(false); return; }
    if (timeMs >= lab01Scenario.durationMs) setTimeMs(0);
    setPlaying(true);
  };
  const seek = (nextTime: number) => { setPlaying(false); setTimeMs(nextTime); };

  const overviewAction = layer === 'packet'
    ? { label: 'Open packet microscope', run: openPacketLab }
    : layer === 'transport'
      ? { label: 'Open TCP theater', run: openTcpLab }
      : layer === 'application'
        ? { label: 'Compare HTTP/2 vs HTTP/3', run: openHttpLab }
        : layer === 'routing'
          ? { label: 'Open network builder', run: openBuilderLab }
          : { label: 'Open physical Internet', run: openPhysicalInternet };

  const buildLabel = activeLab === 'measured'
    ? 'LAB 09'
    : activeLab === 'journey'
    ? 'LAB 07'
    : activeLab === 'failure'
    ? 'LAB 01'
    : activeLab === 'packet'
      ? 'LAB 02'
      : activeLab === 'tcp' || activeLab === 'dns' || activeLab === 'tls' || activeLab === 'http'
        ? 'LAB 03'
        : activeLab === 'builder'
          ? 'LAB 04'
          : activeLab === 'physical' || activeLab === 'internet' || activeLab === 'observed'
            ? 'LAB 05'
            : 'LAB 00';
  const buildStatus = activeLab === 'measured'
    ? 'LOCAL MEASURED ACTIVE'
    : activeLab === 'journey'
    ? 'GOD MODE JOURNEY ACTIVE'
    : activeLab === 'failure'
    ? labState.statusLabel
    : activeLab === 'packet'
      ? 'PACKET TRACE ACTIVE'
      : activeLab === 'tcp'
        ? 'TCP THEATER ACTIVE'
        : activeLab === 'dns'
          ? 'DNS THEATER ACTIVE'
          : activeLab === 'tls'
            ? 'TLS 1.3 THEATER ACTIVE'
            : activeLab === 'http'
              ? 'HTTP/2 ↔ HTTP/3 ACTIVE'
              : activeLab === 'builder'
                ? 'NETWORK BUILDER ACTIVE'
                : activeLab === 'physical'
                  ? 'PHYSICAL INTERNET ATLAS ACTIVE'
                  : activeLab === 'internet'
                    ? 'SIMULATED AS THEATER ACTIVE'
                    : activeLab === 'observed'
                      ? 'INTERNET EVIDENCE ACTIVE'
                      : 'Foundation online';

  return (
    <main className="app-shell" data-layer={layer} data-mode={mode} data-lab={activeLab ? 'active' : 'idle'}>
      {!activeLab && <NetworkField mode={mode} layer={layer} />}
      <div className="grid-field" aria-hidden="true" />
      <div className="scene-vignette" aria-hidden="true" />

      <motion.header className="topbar" initial={reduceMotion ? false : { opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
        <button className="brand-lockup brand-button" type="button" onClick={exitLabs} aria-label="Return to HOPSCOTCH overview">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <strong>HOPSCOTCH</strong>
        </button>
        <div className="topbar-meta">
          <button className="explore-trigger" type="button" onClick={() => setExploreOpen(true)}>EXPLORE <span>12 LABS</span></button>
          <div className="build-state"><span>{buildLabel}</span><span className={`status-dot${failureLabActive ? ` phase-${labState.phase}` : ''}`}>{buildStatus}</span></div>
          {activeLab === 'journey' && <JourneyScenarioMenu hostname={journeyHostname} timeMs={journeyTimeMs} name={journeyScenarioName} onNameChange={setJourneyScenarioName} onImportScenario={importJourneyScenario} />}
        </div>
      </motion.header>

      <ExploreLauncher open={exploreOpen} onClose={() => setExploreOpen(false)} onSelect={selectExploreDestination} />

      <AnimatePresence mode="wait" initial={false}>
        {!activeLab ? (
          <motion.div key="overview" className="overview-scene" initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.025, filter: 'blur(12px)' }} transition={{ duration: 0.45 }}>
            <section className="hero-copy">
              <motion.p className="eyebrow" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}>Interactive network systems laboratory</motion.p>
              <motion.h1 initial={reduceMotion ? false : { opacity: 0, y: 34 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}>SEE THE<span>INTERNET</span>HAPPEN.</motion.h1>
              <motion.p className="lede" initial={reduceMotion ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.7 }}>Move from the global Internet to a single packet without losing the story in between. Routes, protocols, failures, and recovery become something you can watch, stop, rewind, build, and interrogate.</motion.p>
              <motion.div className="hero-actions" initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.65 }}>
                <motion.button className="primary-action" type="button" onClick={openJourney} whileHover={reduceMotion ? undefined : { y: -2, scale: 1.015 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }}>Play URL journey<span aria-hidden="true">↗</span></motion.button>
                <button className="explore-hero-action" type="button" onClick={() => setExploreOpen(true)}>Explore labs<span>12 labs ↗</span></button>
                <button className="text-action text-button" type="button" onClick={openMeasuredNetwork}>Inspect measured report</button>
                <button className="text-action text-button" type="button" onClick={overviewAction.run}>{overviewAction.label}</button>
                <button className="text-action text-button" type="button" onClick={() => setMode((current) => (current === 'overview' ? 'xray' : 'overview'))}>{mode === 'overview' ? 'Preview X-ray' : 'Hide X-ray'}</button>
                <a className="text-action" href="https://github.com/JohnnyZLi/HOPSCOTCH">Source</a>
              </motion.div>
            </section>

            <nav className="scale-rail" aria-label="Network scale">
              {layers.map((item) => <motion.button key={item.id} type="button" className={layer === item.id ? 'active' : ''} onClick={() => setLayer(item.id)} whileHover={reduceMotion ? undefined : { x: 5 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}><span>{item.kicker}</span><strong>{item.label}</strong></motion.button>)}
            </nav>

            <motion.aside key={active.id} className="layer-card" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.34 }}>
              <span>{active.kicker}</span><h2>{active.label}</h2><p>{active.description}</p><div className="card-rule" />
              <small>{layer === 'packet' ? 'PACKET MICROSCOPE READY' : layer === 'transport' ? 'TCP PROTOCOL THEATER READY' : layer === 'application' ? 'HTTP + TLS + DNS THEATER READY' : layer === 'routing' ? 'DYNAMIC NETWORK BUILDER READY' : 'PHYSICAL + SIMULATED + OBSERVED INTERNET MODES READY'}</small>
            </motion.aside>

            <footer className="timeline-preview"><div className="timeline-labels"><span>TIME MACHINE</span><span>00:00.000</span></div><div className="timeline-track" aria-hidden="true"><i /><b /></div><span className="timeline-note">Lab 01 failure · Lab 02 packet · Lab 03 protocols · Lab 04 builder · Lab 05 Internet · Lab 06 Journey · Lab 09 measured</span></footer>
          </motion.div>
        ) : activeLab === 'journey' ? (
          <JourneyTheater key={`lab06-${journeyRenderKey}`} hostname={journeyHostname} timeMs={journeyTimeMs} startPlaying={journeyStartPlaying} evidence={journeyEvidence} measuredState={measuredSession} onHostnameChange={setJourneyHostname} onTimeChange={setJourneyTimeMs} onEvidenceChange={setJourneyEvidence} onOpenDetail={openJourneyDetail} onExit={exitLabs} />
        ) : activeLab === 'packet' ? (
          <PacketMicroscope key="lab02" onExit={exitActiveLab} onOpenSourceEvent={() => openFailureLab(5400, false)} />
        ) : activeLab === 'tcp' ? (
          <TcpTheater key="lab03-tcp" onExit={exitActiveLab} onOpenPacket={openPacketLab} />
        ) : activeLab === 'dns' ? (
          <DnsTheater key="lab03-dns" onExit={exitActiveLab} />
        ) : activeLab === 'tls' ? (
          <TlsTheater key="lab03-tls" onExit={exitActiveLab} onOpenDns={openDnsLab} onOpenTcp={openTcpLab} onOpenPacket={openPacketLab} />
        ) : activeLab === 'http' ? (
          <HttpComparisonTheater key="lab03-http" onExit={exitActiveLab} onOpenTls={openTlsLab} />
        ) : activeLab === 'builder' ? (
          <NetworkBuilder key="lab04" onExit={exitActiveLab} onOpenFailureStory={() => openFailureLab(0, true)} />
        ) : activeLab === 'physical' ? (
          <PhysicalInternetGlobe key="lab05-physical" onExit={exitActiveLab} onOpenSimulated={openInternetLab} onOpenObserved={openObservedInternet} />
        ) : activeLab === 'internet' ? (
          <InternetScaleTheater key="lab05-simulated" onExit={exitActiveLab} onOpenObserved={openObservedInternet} />
        ) : activeLab === 'observed' ? (
          <ObservedInternet key="lab05-observed" onExit={exitActiveLab} onOpenSimulated={openInternetLab} />
        ) : activeLab === 'measured' ? (
          <MeasuredNetworkWorkspace key="lab09-measured" measuredState={measuredSession} onMeasuredStateChange={setMeasuredSession} onExit={exitActiveLab} />
        ) : (
          <motion.section key="lab01" className="lab-workspace" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.985, filter: 'blur(14px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02, filter: 'blur(10px)' }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            <header className="lab-heading"><div><p className="eyebrow">Lab 01 · Failure & recovery</p><h1>BREAK THE ROUTE.<br /><span>WATCH IT THINK.</span></h1></div><div className="lab-heading-actions"><button type="button" className={labXray ? 'lab-mode active' : 'lab-mode'} onClick={() => setLabXray((current) => !current)}>X-RAY {labXray ? 'ON' : 'OFF'}</button><button type="button" className="lab-mode" onClick={exitActiveLab}>EXIT LAB</button></div></header>
            <div className="lab-stage">
              <motion.div key={`flash-${activeEvent.id}`} className={`lab-phase-flash severity-${activeEvent.payload.severity}`} initial={reduceMotion ? false : { opacity: activeEvent.payload.severity === 'critical' ? 0.34 : 0.16 }} animate={{ opacity: 0 }} transition={{ duration: activeEvent.payload.severity === 'critical' ? 0.95 : 0.7 }} aria-hidden="true" />
              <div className="lab-stage-meta"><div><span>PHASE</span><strong>{labState.phase.toUpperCase()}</strong></div><div><span>INSTALLED PATH</span><strong>{activePath.label.toUpperCase()}</strong></div><div><span>PATH COST</span><strong>{activePath.metric}</strong></div></div>
              <motion.div className="lab-camera" animate={reduceMotion ? undefined : { x: cameraX, y: cameraY, scale: cameraScale }} transition={{ type: 'spring', stiffness: 110, damping: 20, mass: 0.85 }}><LabNetworkField scenario={lab01Scenario} state={labState} activeEvent={activeEvent} xray={labXray} /></motion.div>
              <AnimatePresence mode="wait" initial={false}><motion.div key={activeEvent.id} className={`lab-event-callout severity-${activeEvent.payload.severity}`} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }} transition={{ duration: 0.28 }}><span>{formatTime(activeEvent.atMs)}</span><strong>{activeEvent.payload.title}</strong><p>{activeEvent.payload.summary}</p></motion.div></AnimatePresence>
            </div>
            <aside className="event-inspector" aria-label="Causal event chain"><div className="inspector-heading"><span>CAUSAL CHAIN</span><strong>{String(lab01Scenario.events.indexOf(activeEvent) + 1).padStart(2, '0')} / {String(lab01Scenario.events.length).padStart(2, '0')}</strong></div><div className="event-list">{lab01Scenario.events.map((event, index) => { const complete = event.atMs <= timeMs; const current = event.id === activeEvent.id; return <button key={event.id} type="button" className={`${complete ? 'complete' : ''}${current ? ' current' : ''}`} onClick={() => seek(event.atMs)}><span className="event-index">{String(index + 1).padStart(2, '0')}</span><span className="event-copy"><strong>{event.payload.title}</strong><small>{formatTime(event.atMs)} · {event.kind.replace('.', ' ')}</small></span></button>; })}</div><div className="event-detail"><span>WHY THIS MATTERS</span><p>{activeEvent.payload.detail}</p></div></aside>
            <footer className="time-machine"><div className="time-controls"><button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause scenario' : 'Play scenario'}>{playing ? 'Ⅱ' : '▶'}</button><button type="button" onClick={() => seek(0)} aria-label="Reset scenario">↺</button></div><div className="time-readout"><span>TIME MACHINE</span><strong>{formatTime(timeMs)}</strong></div><div className="scrubber-wrap"><div className="timeline-markers" aria-hidden="true">{lab01Scenario.events.map((event) => <i key={event.id} className={event.atMs <= timeMs ? 'passed' : ''} style={{ left: `${(event.atMs / lab01Scenario.durationMs) * 100}%` }} />)}</div><input type="range" min="0" max={lab01Scenario.durationMs} step="10" value={Math.round(timeMs)} onChange={(event) => seek(Number(event.currentTarget.value))} aria-label="Scenario time" /></div><span className="time-duration">{formatTime(lab01Scenario.durationMs)}</span></footer>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

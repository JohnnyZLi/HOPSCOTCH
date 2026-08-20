import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ExploreLauncher } from './ExploreLauncher';
import { WORKSPACE_COUNT, workspaceDefinition, type ExploreDestination } from './workspace-catalog';
import { HomeActionDeck } from './HomeActionDeck';
import { JourneyScenarioMenu } from './JourneyScenarioMenu';
import type { InternetEvidenceSnapshot } from './internet/evidence';
import { bootstrapJourneyFromSearch, seedJourneyBrowserScenario } from './journey/browser.ts';
import { scenarioForPreset } from './journey/presets.ts';
import type { JourneyDetailLab } from './journey/model';
import { encodeJourneyQuery, type PortableJourneyScenario } from './journey/scenario.ts';
import type { BuilderProbePacketSeed } from './builder/probes.ts';
import type { BuilderScenarioV8 } from './builder/scenario.ts';
import type { BuilderBgpAsProjection } from './builder/bgp.ts';
import { NetworkField } from './NetworkField';
import { canonicalUrlForRoute, pathForDestination, resolveAppRoute } from './navigation';
import type { MeasuredSnapshotState } from './measurement/state.ts';
import type { CaptureReplayContext } from './CaptureReplayWorkspace.tsx';
import type { CaptureSessionIndex } from './capture/session.ts';
import type { CapturedFrameEvidence } from './capture/types.ts';
import type { ScenarioPresetId } from './scenarios/catalog.ts';
import { lab01Scenario, lab01StateAt } from './simulation/lab01';
import { latestEventAtOrBefore, type NetworkLayer } from './simulation/model';

type DisplayMode = 'overview' | 'xray';
type ActiveLab = ExploreDestination | null;

const CaptureReplayWorkspace = lazy(() => import('./CaptureReplayWorkspace.tsx').then((module) => ({ default: module.CaptureReplayWorkspace })));
const DnsTheater = lazy(() => import('./DnsTheater.tsx').then((module) => ({ default: module.DnsTheater })));
const HttpComparisonTheater = lazy(() => import('./HttpComparisonTheater.tsx').then((module) => ({ default: module.HttpComparisonTheater })));
const InternetScaleTheater = lazy(() => import('./InternetScaleTheater.tsx').then((module) => ({ default: module.InternetScaleTheater })));
const JourneyTheater = lazy(() => import('./JourneyTheater.tsx').then((module) => ({ default: module.JourneyTheater })));
const LabNetworkField = lazy(() => import('./LabNetworkField.tsx').then((module) => ({ default: module.LabNetworkField })));
const MeasuredNetworkWorkspace = lazy(() => import('./MeasuredNetworkWorkspace.tsx').then((module) => ({ default: module.MeasuredNetworkWorkspace })));
const NetworkBuilder = lazy(() => import('./NetworkBuilder.tsx').then((module) => ({ default: module.NetworkBuilder })));
const ObservedInternet = lazy(() => import('./ObservedInternet.tsx').then((module) => ({ default: module.ObservedInternet })));
const PacketMicroscope = lazy(() => import('./PacketMicroscope.tsx').then((module) => ({ default: module.PacketMicroscope })));
const PhysicalInternetGlobe = lazy(() => import('./PhysicalInternetGlobe.tsx').then((module) => ({ default: module.PhysicalInternetGlobe })));
const TcpTheater = lazy(() => import('./TcpTheater.tsx').then((module) => ({ default: module.TcpTheater })));
const TlsTheater = lazy(() => import('./TlsTheater.tsx').then((module) => ({ default: module.TlsTheater })));

const layers: Array<{ id: NetworkLayer; label: string; kicker: string; description: string }> = [
  { id: 'internet', label: 'Internet', kicker: 'Scale 05', description: 'Physical interconnection infrastructure, autonomous systems, public routing evidence, and clearly labeled inference.' },
  { id: 'routing', label: 'Routing', kicker: 'Scale 04', description: 'Build a weighted graph, change topology, inject failures, and watch route truth recompute.' },
  { id: 'transport', label: 'Transport', kicker: 'Scale 03', description: 'Flows, congestion windows, retransmissions, loss, and multiplexing.' },
  { id: 'application', label: 'Application', kicker: 'Scale 02', description: 'DNS, TLS, HTTP, QUIC, and the exchanges behind an application request.' },
  { id: 'packet', label: 'Packet', kicker: 'Scale 01', description: 'Frames, headers, fields, encapsulation, and individual protocol messages.' },
];

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
  const [layer, setLayer] = useState<NetworkLayer>(initialAppRoute.destination ? workspaceDefinition(initialAppRoute.destination).layer : 'internet');
  const [scaleDirection, setScaleDirection] = useState<'inward' | 'outward'>('inward');
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
  const [builderPacketSeed, setBuilderPacketSeed] = useState<BuilderProbePacketSeed | null>(null);
  const [builderBgpProjection, setBuilderBgpProjection] = useState<{ projection: BuilderBgpAsProjection; scenario: BuilderScenarioV8 } | null>(null);
  const [captureSession, setCaptureSession] = useState<CaptureSessionIndex | null>(null);
  const [captureSourceName, setCaptureSourceName] = useState<string | null>(null);
  const [captureContext, setCaptureContext] = useState<CaptureReplayContext | null>(null);
  const [capturedMicroscopeFrame, setCapturedMicroscopeFrame] = useState<CapturedFrameEvidence | null>(null);
  const [captureReturnPending, setCaptureReturnPending] = useState(false);
  const reduceMotion = useReducedMotion();
  const active = layers.find((item) => item.id === layer) ?? layers[0];
  const activeLayerTop = 24.5 + Math.max(0, layers.findIndex((item) => item.id === layer)) * 52;
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
      setCaptureReturnPending(false);

      if (route.destination === null) {
        setLayer('internet');
        setBuilderBgpProjection(null);
        setActiveLab(null);
        return;
      }

      const destination = route.destination;
      setLayer(workspaceDefinition(destination).layer);
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
    document.title = activeLab
      ? `HOPSCOTCH — ${workspaceDefinition(activeLab).name}`
      : 'HOPSCOTCH — See the Internet happen';
  }, [activeLab]);

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
    setLayer(workspaceDefinition('failure').layer); setTimeMs(atMs); setActiveLab('failure'); setPlaying(autoplay);
  };
  const openPacketLab = (seed?: BuilderProbePacketSeed) => { setCapturedMicroscopeFrame(null); setCaptureReturnPending(false); setBuilderPacketSeed(seed ?? null); pushBrowserRoute('packet'); setPlaying(false); setLayer(workspaceDefinition('packet').layer); setActiveLab('packet'); };
  const openTcpLab = () => { pushBrowserRoute('tcp'); setPlaying(false); setLayer(workspaceDefinition('tcp').layer); setActiveLab('tcp'); };
  const openDnsLab = () => { pushBrowserRoute('dns'); setPlaying(false); setLayer(workspaceDefinition('dns').layer); setActiveLab('dns'); };
  const openTlsLab = () => { pushBrowserRoute('tls'); setPlaying(false); setLayer(workspaceDefinition('tls').layer); setActiveLab('tls'); };
  const openHttpLab = () => { pushBrowserRoute('http'); setPlaying(false); setLayer(workspaceDefinition('http').layer); setActiveLab('http'); };
  const openBuilderLab = () => { setBuilderBgpProjection(null); pushBrowserRoute('builder'); setPlaying(false); setLayer(workspaceDefinition('builder').layer); setActiveLab('builder'); };
  const openBuilderBgpProjection = (payload: { projection: BuilderBgpAsProjection; scenario: BuilderScenarioV8 }) => { setBuilderBgpProjection(payload); pushBrowserRoute('internet'); setPlaying(false); setLayer(workspaceDefinition('internet').layer); setActiveLab('internet'); };
  const returnToProjectedBuilder = () => { if (!builderBgpProjection) { openBuilderLab(); return; } pushBrowserRoute('builder'); setPlaying(false); setLayer(workspaceDefinition('builder').layer); setActiveLab('builder'); };
  const openPhysicalInternet = () => { pushBrowserRoute('physical'); setPlaying(false); setLayer(workspaceDefinition('physical').layer); setActiveLab('physical'); };
  const openInternetLab = () => { setBuilderBgpProjection(null); pushBrowserRoute('internet'); setPlaying(false); setLayer(workspaceDefinition('internet').layer); setActiveLab('internet'); };
  const openObservedInternet = () => { pushBrowserRoute('observed'); setPlaying(false); setLayer(workspaceDefinition('observed').layer); setActiveLab('observed'); };
  const openMeasuredNetwork = () => { pushBrowserRoute('measured'); setPlaying(false); setLayer(workspaceDefinition('measured').layer); setActiveLab('measured'); };
  const openCaptureReplay = () => { setCapturedMicroscopeFrame(null); setCaptureReturnPending(false); pushBrowserRoute('capture'); setPlaying(false); setLayer(workspaceDefinition('capture').layer); setActiveLab('capture'); };
  const openCapturedFrame = (frame: CapturedFrameEvidence, context: CaptureReplayContext) => {
    setBuilderPacketSeed(null);
    setCapturedMicroscopeFrame(frame);
    setCaptureContext(context);
    setCaptureReturnPending(true);
    pushBrowserRoute('packet');
    setPlaying(false);
    setLayer(workspaceDefinition('packet').layer);
    setActiveLab('packet');
  };
  const openJourney = () => {
    pushBrowserRoute('journey');
    setPlaying(false);
    setLayer(workspaceDefinition('journey').layer);
    setJourneyTimeMs(0);
    setJourneyStartPlaying(true);
    setJourneyReturnPending(false);
    setJourneyScenarioName('');
    setActiveLab('journey');
  };
  const launchScenarioPreset = (presetId: ScenarioPresetId) => {
    const scenario = scenarioForPreset(presetId);
    seedJourneyBrowserScenario(scenario);
    if (browserHistoryRoutingAvailable) {
      const nextUrl = `/journey${encodeJourneyQuery(scenario)}`;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl !== nextUrl) window.history.pushState({}, '', nextUrl);
    }
    setPlaying(false);
    setJourneyHostname(scenario.hostname);
    setJourneyTimeMs(scenario.timeMs);
    setJourneyStartPlaying(true);
    setJourneyReturnPending(false);
    setJourneyEvidence(null);
    setJourneyScenarioName(scenario.name ?? '');
    setLayer(workspaceDefinition('journey').layer);
    setExploreOpen(false);
    setActiveLab('journey');
    setJourneyRenderKey((current) => current + 1);
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
      capture: openCaptureReplay,
    };
    setExploreOpen(false);
    openers[destination]();
  };
  const openJourneyDetail = (lab: JourneyDetailLab, atMs: number) => {
    const detailDestination = lab as ExploreDestination;
    setPlaying(false);
    setJourneyTimeMs(atMs);
    setJourneyStartPlaying(false);
    setJourneyReturnPending(true);
    setLayer(workspaceDefinition(detailDestination).layer);
    pushBrowserRoute(detailDestination);
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
    setLayer(workspaceDefinition('journey').layer);
    setActiveLab('journey');
    setJourneyRenderKey((current) => current + 1);
  };
  const exitLabs = () => { pushBrowserRoute(null); setPlaying(false); setJourneyReturnPending(false); setCaptureReturnPending(false); setCapturedMicroscopeFrame(null); setExploreOpen(false); setBuilderBgpProjection(null); setActiveLab(null); };
  const exitActiveLab = () => {
    setPlaying(false);
    if (journeyReturnPending && activeLab !== 'journey') {
      setJourneyReturnPending(false);
      setJourneyStartPlaying(false);
      pushBrowserRoute('journey');
      setActiveLab('journey');
      return;
    }
    if (captureReturnPending && activeLab === 'packet') {
      setCaptureReturnPending(false);
      setCapturedMicroscopeFrame(null);
      pushBrowserRoute('capture');
      setLayer(workspaceDefinition('capture').layer);
      setActiveLab('capture');
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
  const selectOverviewLayer = (nextLayer: NetworkLayer) => {
    if (nextLayer === layer) return;
    const currentIndex = layers.findIndex((item) => item.id === layer);
    const nextIndex = layers.findIndex((item) => item.id === nextLayer);
    setScaleDirection(nextIndex > currentIndex ? 'inward' : 'outward');
    setLayer(nextLayer);
  };

  const activeWorkspace = activeLab ? workspaceDefinition(activeLab) : null;
  const buildLabel = activeWorkspace?.lab ?? 'LAB 00';
  const buildName = activeWorkspace?.name ?? 'FOUNDATION ONLINE';
  const buildStatus = failureLabActive ? labState.statusLabel : activeWorkspace?.status ?? 'FOUNDATION ONLINE';

  return (
    <main className="app-shell" data-layer={layer} data-scale-direction={scaleDirection} data-mode={mode} data-lab={activeLab ? 'active' : 'idle'}>
      {!activeLab && <NetworkField mode={mode} layer={layer} />}
      <div className="grid-field" aria-hidden="true" />
      <div className="scene-vignette" aria-hidden="true" />

      <motion.header className="topbar" initial={reduceMotion ? false : { opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
        <button className="brand-lockup brand-button" type="button" onClick={exitLabs} aria-label="Return to HOPSCOTCH overview">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <strong>HOPSCOTCH</strong>
        </button>
        <div className="topbar-meta">
          <button className="explore-trigger" type="button" aria-expanded={exploreOpen} aria-controls="explore-dialog" onClick={() => setExploreOpen(true)}>EXPLORE <span>{WORKSPACE_COUNT} WORKSPACES</span></button>
          <div className="build-state" aria-label={`${buildLabel} · ${buildStatus}`}>
            <span>{buildLabel}</span>
            <span className={`status-dot${failureLabActive ? ` phase-${labState.phase}` : ''}`}>{buildName}</span>
            {failureLabActive && <span className="build-phase">{buildStatus}</span>}
          </div>
          {activeLab === 'journey' && <JourneyScenarioMenu hostname={journeyHostname} timeMs={journeyTimeMs} name={journeyScenarioName} onNameChange={setJourneyScenarioName} onImportScenario={importJourneyScenario} />}
        </div>
      </motion.header>

      <ExploreLauncher open={exploreOpen} onClose={() => setExploreOpen(false)} onSelect={selectExploreDestination} onScenarioSelect={launchScenarioPreset} />

      <Suspense fallback={<section className="lab-loading" aria-live="polite">LOADING WORKSPACE…</section>}>
        <AnimatePresence mode="wait" initial={false}>
          {!activeLab ? (
            <motion.div key="overview" className="overview-scene" initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.025, filter: 'blur(12px)' }} transition={{ duration: 0.45 }}>
              <section className="hero-copy">
                <motion.p className="eyebrow" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}>Interactive network systems laboratory</motion.p>
                <motion.h1 initial={reduceMotion ? false : { opacity: 0, y: 34 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}>SEE THE<span>INTERNET</span>HAPPEN.</motion.h1>
                <motion.p className="lede" initial={reduceMotion ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.7 }}>Move from the global Internet to a single packet without losing the story in between. Routes, protocols, failures, and recovery become something you can watch, stop, rewind, build, and interrogate.</motion.p>
                <HomeActionDeck
                  onWatch={openJourney}
                  onBreak={() => openFailureLab(0, true)}
                  onBuild={openBuilderLab}
                  onExplore={() => setExploreOpen(true)}
                  onMeasured={openMeasuredNetwork}
                  onToggleXray={() => setMode((current) => (current === 'overview' ? 'xray' : 'overview'))}
                  xrayActive={mode === 'xray'}
                />
              </section>

              <div className="scale-inspector" data-active-scale={layer} data-direction={scaleDirection}>
                {!reduceMotion && <i key={`wave-${layer}`} className="scale-depth-wave" aria-hidden="true" />}
                {!reduceMotion && <motion.i key={`ripple-${layer}`} className="scale-depth-ripple" aria-hidden="true" initial={{ opacity: 0.52, scale: 0.3 }} animate={{ opacity: 0, scale: 1.75 }} transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }} />}
                <motion.aside className="layer-card" aria-label={`${active.label} scale details`} initial={false} animate={{ top: activeLayerTop }} transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 27, mass: 0.75 }}>
                  <motion.i className="scale-connector" aria-hidden="true" initial={false} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: reduceMotion ? 0 : 0.24 }} />
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={active.id} className="layer-card-copy" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 16, y: scaleDirection === 'inward' ? -8 : 8, filter: 'blur(9px)' }} animate={{ opacity: 1, x: 0, y: 0, filter: 'blur(0px)' }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8, y: scaleDirection === 'inward' ? 5 : -5, filter: 'blur(5px)' }} transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}>
                      <motion.p initial={reduceMotion ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04, duration: 0.28 }}>{active.description}</motion.p>
                      <motion.div className="card-rule" initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 0.08, duration: 0.3, ease: [0.16, 1, 0.3, 1] }} />
                      <motion.small initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13, duration: 0.24 }}>{layer === 'packet' ? 'PACKET MICROSCOPE READY' : layer === 'transport' ? 'TCP PROTOCOL THEATER READY' : layer === 'application' ? 'HTTP + TLS + DNS THEATER READY' : layer === 'routing' ? 'DYNAMIC NETWORK BUILDER READY' : 'PHYSICAL + SIMULATED + OBSERVED INTERNET MODES READY'}</motion.small>
                    </motion.div>
                  </AnimatePresence>
                </motion.aside>
                <nav className="scale-rail" aria-label="Network scale">
                  {layers.map((item) => {
                    const selected = layer === item.id;
                    return <motion.button key={item.id} type="button" className={selected ? 'active' : ''} onClick={() => selectOverviewLayer(item.id)} animate={reduceMotion ? { opacity: selected ? 1 : 0.72 } : { x: selected ? -4 : 0, opacity: selected ? 1 : 0.68 }} whileHover={reduceMotion ? undefined : { x: selected ? -7 : 5, opacity: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 28, mass: 0.65 }}>{selected && <motion.i className="scale-active-marker" layoutId="overview-scale-marker" aria-hidden="true" transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.7 }} />}<span>{item.kicker}</span><strong>{item.label}</strong></motion.button>;
                  })}
                </nav>
              </div>

              <footer className="timeline-preview"><div className="timeline-labels"><span>TIME MACHINE</span><span>00:00.000</span></div><div className="timeline-track" aria-hidden="true"><i /><b /></div><span className="timeline-note">Lab 01 failure · Lab 02 packet · Lab 03 protocols · Lab 04 builder · Lab 05 Internet · Lab 07 Journey · Lab 09 measured</span></footer>
            </motion.div>
          ) : activeLab === 'journey' ? (
            <JourneyTheater key={`lab06-${journeyRenderKey}`} hostname={journeyHostname} timeMs={journeyTimeMs} startPlaying={journeyStartPlaying} evidence={journeyEvidence} measuredState={measuredSession} onHostnameChange={setJourneyHostname} onTimeChange={setJourneyTimeMs} onEvidenceChange={setJourneyEvidence} onOpenDetail={openJourneyDetail} onExit={exitLabs} />
          ) : activeLab === 'packet' ? (
            <Suspense fallback={<section className="lab-loading" aria-live="polite">LOADING PACKET MICROSCOPE…</section>}>
              <PacketMicroscope
                key={`lab02-${capturedMicroscopeFrame?.record.id ?? builderPacketSeed?.id ?? 'default'}`}
                onExit={exitActiveLab}
                onOpenSourceEvent={capturedMicroscopeFrame ? openCaptureReplay : builderPacketSeed ? () => openBuilderLab() : () => openFailureLab(5400, false)}
                capturedFrame={capturedMicroscopeFrame ?? undefined}
                initialConfig={builderPacketSeed ? { family: builderPacketSeed.family, transport: 'icmp', payloadBytes: builderPacketSeed.payloadBytes ?? 32, ttl: builderPacketSeed.ttl, ...(builderPacketSeed.family === 'ipv4' ? { sourceIpv4: builderPacketSeed.sourceAddress, destinationIpv4: builderPacketSeed.destinationAddress } : { sourceIpv6: builderPacketSeed.sourceAddress, destinationIpv6: builderPacketSeed.destinationAddress }), sourceMac: builderPacketSeed.sourceMac, destinationMac: builderPacketSeed.destinationMac, icmpType: builderPacketSeed.icmpType ?? (builderPacketSeed.family === 'ipv4' ? 8 : 128), icmpCode: builderPacketSeed.icmpCode ?? 0, icmpMtu: builderPacketSeed.icmpMtu, icmpSequence: Math.max(1, builderPacketSeed.ttl) } : undefined}
                origin={capturedMicroscopeFrame ? { label: `${captureSourceName ?? 'LOCAL CAPTURE'} · FRAME ${capturedMicroscopeFrame.record.number}`, timestamp: capturedMicroscopeFrame.record.timestamp.iso8601 ?? `t+${capturedMicroscopeFrame.record.relativeTimeMs.toFixed(3)} ms`, actionLabel: 'RETURN TO CAPTURE ↗' } : builderPacketSeed ? { label: `${builderPacketSeed.family === 'ipv4' ? 'LAB 11D' : 'LAB 11N'} · ${builderPacketSeed.label}`, timestamp: `${builderPacketSeed.family === 'ipv4' ? 'TTL' : 'HOP LIMIT'} ${builderPacketSeed.ttl}`, actionLabel: 'RETURN TO BUILDER ↗' } : undefined}
              />
            </Suspense>
          ) : activeLab === 'capture' ? (
            <Suspense fallback={<section className="capture-loading" aria-live="polite">LOADING CAPTURE WORKSPACE…</section>}>
              <CaptureReplayWorkspace
                session={captureSession}
                sourceName={captureSourceName}
                initialContext={captureContext}
                onSessionChange={(nextSession, nextSourceName) => { setCaptureSession(nextSession); setCaptureSourceName(nextSourceName); if (!nextSession) setCaptureContext(null); }}
                onContextChange={setCaptureContext}
                onOpenFrame={openCapturedFrame}
                onExit={exitActiveLab}
              />
            </Suspense>
          ) : activeLab === 'tcp' ? (
            <TcpTheater key="lab03-tcp" onExit={exitActiveLab} onOpenPacket={openPacketLab} />
          ) : activeLab === 'dns' ? (
            <DnsTheater key="lab03-dns" onExit={exitActiveLab} />
          ) : activeLab === 'tls' ? (
            <TlsTheater key="lab03-tls" onExit={exitActiveLab} onOpenDns={openDnsLab} onOpenTcp={openTcpLab} onOpenPacket={openPacketLab} />
          ) : activeLab === 'http' ? (
            <HttpComparisonTheater key="lab03-http" onExit={exitActiveLab} onOpenTls={openTlsLab} />
          ) : activeLab === 'builder' ? (
            <NetworkBuilder key={`lab04-${builderBgpProjection?.scenario.updatedAt??'default'}`} onExit={exitActiveLab} onOpenFailureStory={() => openFailureLab(0, true)} onOpenProbePacket={openPacketLab} onOpenBgpProjection={openBuilderBgpProjection} initialGraph={builderBgpProjection?.scenario.graph} initialLayout={builderBgpProjection?.scenario.layout} initialAddressing={builderBgpProjection?.scenario.addressing} initialRouting={builderBgpProjection?.scenario.routing} initialEthernet={builderBgpProjection?.scenario.ethernet} initialLinkProfiles={builderBgpProjection?.scenario.linkProfiles} initialAcl={builderBgpProjection?.scenario.acl} initialNat={builderBgpProjection?.scenario.nat} initialDhcp={builderBgpProjection?.scenario.dhcp} initialIpv6={builderBgpProjection?.scenario.ipv6} initialSourceId={builderBgpProjection?.scenario.sourceId} initialDestinationId={builderBgpProjection?.scenario.destinationId} initialScenarioName={builderBgpProjection?.scenario.name}/>
          ) : activeLab === 'physical' ? (
            <PhysicalInternetGlobe key="lab05-physical" onExit={exitActiveLab} onOpenSimulated={openInternetLab} onOpenObserved={openObservedInternet} />
          ) : activeLab === 'internet' ? (
            <InternetScaleTheater key={`lab05-simulated-${builderBgpProjection?'builder-bgp':'default'}`} onExit={exitActiveLab} onOpenObserved={openObservedInternet} builderProjection={builderBgpProjection?.projection} onReturnToBuilder={builderBgpProjection?returnToProjectedBuilder:undefined} />
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
      </Suspense>
    </main>
  );
}

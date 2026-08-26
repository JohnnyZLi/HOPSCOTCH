import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { CornerNavigator } from './CornerNavigator';
import { ExploreLauncher } from './ExploreLauncher';
import { workspaceDefinition, type ExploreDestination } from './workspace-catalog';
import { JourneyScenarioMenu } from './JourneyScenarioMenu';
import { KineticOverview } from './KineticOverview';
import type { InternetEvidenceSnapshot } from './internet/evidence';
import { bootstrapJourneyFromSearch, seedJourneyBrowserScenario } from './journey/browser.ts';
import { scenarioForPreset } from './journey/presets.ts';
import type { JourneyDetailLab } from './journey/model';
import { encodeJourneyQuery, type PortableJourneyScenario } from './journey/scenario.ts';
import type { BuilderProbePacketSeed } from './builder/probes.ts';
import type { BuilderScenarioV8 } from './builder/scenario.ts';
import type { BuilderBgpAsProjection } from './builder/bgp.ts';
import { canonicalUrlForRoute, pathForDestination, resolveAppRoute } from './navigation';
import type { MeasuredSnapshotState } from './measurement/state.ts';
import type { CaptureReplayContext } from './CaptureReplayWorkspace.tsx';
import type { CaptureSessionIndex } from './capture/session.ts';
import type { CapturedFrameEvidence } from './capture/types.ts';
import type { ScenarioPresetId } from './scenarios/catalog.ts';
import { lab01Scenario } from './simulation/lab01';
import type { NetworkLayer } from './simulation/model';
import { useVisualPresentationPlayback, type VisualTimelineEvent } from './VisualWorkspace';

type ActiveLab = ExploreDestination | null;

const CaptureReplayWorkspace = lazy(() => import('./CaptureReplayWorkspace.tsx').then((module) => ({ default: module.CaptureReplayWorkspace })));
const DnsTheater = lazy(() => import('./DnsTheater.tsx').then((module) => ({ default: module.DnsTheater })));
const FailureStoryWorkspace = lazy(() => import('./FailureStoryWorkspace.tsx').then((module) => ({ default: module.FailureStoryWorkspace })));
const HttpComparisonTheater = lazy(() => import('./HttpComparisonTheater.tsx').then((module) => ({ default: module.HttpComparisonTheater })));
const InternetScaleTheater = lazy(() => import('./InternetScaleTheater.tsx').then((module) => ({ default: module.InternetScaleTheater })));
const JourneyTheater = lazy(() => import('./JourneyTheater.tsx').then((module) => ({ default: module.JourneyTheater })));
const MeasuredNetworkWorkspace = lazy(() => import('./MeasuredNetworkWorkspace.tsx').then((module) => ({ default: module.MeasuredNetworkWorkspace })));
const NetworkBuilder = lazy(() => import('./NetworkBuilder.tsx').then((module) => ({ default: module.NetworkBuilder })));
const ObservedInternet = lazy(() => import('./ObservedInternet.tsx').then((module) => ({ default: module.ObservedInternet })));
const PacketMicroscope = lazy(() => import('./PacketMicroscope.tsx').then((module) => ({ default: module.PacketMicroscope })));
const PhysicalInternetGlobe = lazy(() => import('./PhysicalInternetGlobe.tsx').then((module) => ({ default: module.PhysicalInternetGlobe })));
const TcpTheater = lazy(() => import('./TcpTheater.tsx').then((module) => ({ default: module.TcpTheater })));
const TlsTheater = lazy(() => import('./TlsTheater.tsx').then((module) => ({ default: module.TlsTheater })));

const browserHistoryRoutingAvailable = typeof window !== 'undefined'
  && (window.location.protocol === 'http:' || window.location.protocol === 'https:');

const initialAppRoute = browserHistoryRoutingAvailable
  ? resolveAppRoute(window.location.pathname, window.location.search)
  : resolveAppRoute('/', typeof window === 'undefined' ? '' : window.location.search);

const initialJourneyBootstrap = typeof window === 'undefined' || initialAppRoute.destination !== 'journey'
  ? { scenario: null, error: null }
  : bootstrapJourneyFromSearch(window.location.search);

function failureTimelineTone(severity: string): VisualTimelineEvent['tone'] {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  if (severity === 'success') return 'success';
  return 'neutral';
}

export default function App() {
  const initialSharedJourney = initialJourneyBootstrap.scenario;
  const [layer, setLayer] = useState<NetworkLayer>(initialAppRoute.destination ? workspaceDefinition(initialAppRoute.destination).layer : 'internet');
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
  const failureLabActive = activeLab === 'failure';
  const failurePresentationEvents = useMemo<VisualTimelineEvent[]>(() => lab01Scenario.events.map((event) => ({
    id: event.id,
    atMs: event.atMs,
    label: event.payload.title,
    tone: failureTimelineTone(event.payload.severity),
  })), []);
  const { playbackSpeed: failurePlaybackSpeed, setPlaybackSpeed: setFailurePlaybackSpeed } = useVisualPresentationPlayback({
    playing: playing && failureLabActive,
    timeMs,
    durationMs: lab01Scenario.durationMs,
    events: failurePresentationEvents,
    onTimeChange: setTimeMs,
    onComplete: () => setPlaying(false),
  });

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
  const activeWorkspace = activeLab ? workspaceDefinition(activeLab) : null;

  return (
    <main className="app-shell" data-layer={layer} data-lab={activeLab ? 'active' : 'idle'}>
      {activeLab && <><div className="grid-field" aria-hidden="true" /><div className="scene-vignette" aria-hidden="true" /></>}

      <CornerNavigator open={exploreOpen} current={activeWorkspace?.name ?? 'Request journey'} onOpen={() => setExploreOpen(true)} />

      <ExploreLauncher
        open={exploreOpen}
        activeDestination={activeLab}
        contextActions={activeLab === 'journey' ? <JourneyScenarioMenu hostname={journeyHostname} timeMs={journeyTimeMs} name={journeyScenarioName} onNameChange={setJourneyScenarioName} onImportScenario={importJourneyScenario} /> : undefined}
        onClose={() => setExploreOpen(false)}
        onHome={exitLabs}
        onSelect={selectExploreDestination}
        onScenarioSelect={launchScenarioPreset}
      />

      <Suspense fallback={<section className="lab-loading" aria-live="polite">LOADING WORKSPACE…</section>}>
        <AnimatePresence mode="wait" initial={false}>
          {!activeLab ? (
            <motion.div key="overview" className="kinetic-overview-shell" initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.018, filter: 'blur(10px)' }} transition={{ duration: .45 }}>
              <KineticOverview onRunJourney={openJourney} onOpenExplore={() => setExploreOpen(true)} />
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
                origin={capturedMicroscopeFrame ? { label: `${captureSourceName ?? 'LOCAL CAPTURE'} · FRAME ${capturedMicroscopeFrame.record.number}`, timestamp: capturedMicroscopeFrame.record.timestamp.iso8601 ?? `t+${capturedMicroscopeFrame.record.relativeTimeMs.toFixed(3)} ms`, actionLabel: 'RETURN TO CAPTURE ↗' } : builderPacketSeed ? { label: `BUILDER ${builderPacketSeed.family.toUpperCase()} · ${builderPacketSeed.label}`, timestamp: `${builderPacketSeed.family === 'ipv4' ? 'TTL' : 'HOP LIMIT'} ${builderPacketSeed.ttl}`, actionLabel: 'RETURN TO BUILDER ↗' } : undefined}
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
            <FailureStoryWorkspace
              key="lab01"
              timeMs={timeMs}
              playing={playing}
              playbackSpeed={failurePlaybackSpeed}
              onPlaybackSpeedChange={setFailurePlaybackSpeed}
              xray={labXray}
              onTogglePlayback={togglePlayback}
              onSeek={seek}
              onToggleXray={() => setLabXray((current) => !current)}
              onExit={exitActiveLab}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </main>
  );
}

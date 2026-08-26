import { animate } from 'animejs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  HTTP_COMPARISON_DURATION_MS,
  HTTP_STREAM_A,
  HTTP_STREAM_B,
  clampHttpComparisonTime,
  httpComparisonEvents,
  httpComparisonStateAt,
  latestHttpComparisonEvent,
  type HttpLane,
  type HttpLaneState,
} from './protocol/httpComparison';

function formatTime(timeMs: number): string {
  const seconds = Math.floor(timeMs / 1000).toString().padStart(2, '0');
  const milliseconds = Math.floor(timeMs % 1000).toString().padStart(3, '0');
  return `00:${seconds}.${milliseconds}`;
}

function Lane({ lane, state, focused }: { lane: HttpLane; state: HttpLaneState; focused: boolean }) {
  const h2 = lane === 'h2';
  return <motion.section className={`http-lane lane-${lane}${focused ? ' focused' : ''}`} animate={{ opacity: focused ? 1 : 0.68, scale: focused ? 1.006 : 0.994 }} transition={{ duration: 0.24 }}>
    <header><div><span>{h2 ? 'HTTP/2' : 'HTTP/3'}</span><strong>{state.transportLabel}</strong></div><small>{h2 ? 'ONE ORDERED TCP BYTE STREAM' : 'INDEPENDENT QUIC STREAM ORDERING'}</small></header>
    <div className="http-transport-rail"><span>{state.lossLabel.toUpperCase()}</span><div className={`http-transport-line${state.lossLabel !== 'none' && state.lossLabel !== 'repaired' ? ' has-loss' : ''}`}><i/><b/><i/><em className="http-loss-pulse"/></div><small>{state.congestionLabel}</small></div>
    <div className="http-streams"><StreamRow label="STREAM A" resource={HTTP_STREAM_A} state={state.streamA} progress={state.streamAProgress} lane={lane}/><StreamRow label="STREAM B" resource={HTTP_STREAM_B} state={state.streamB} progress={state.streamBProgress} lane={lane}/></div>
    <footer><span>DELIVERY</span><strong>{state.deliveryLabel}</strong></footer>
  </motion.section>;
}

function StreamRow({ label, resource, state, progress, lane }: { label: string; resource: string; state: string; progress: number; lane: HttpLane }) {
  return <div className={`http-stream-row state-${state}`}><div className="http-stream-label"><span>{label}</span><strong>{resource}</strong><small>{state.toUpperCase()}</small></div><div className="http-progress-track"><motion.i className={`stream-fill fill-${lane}`} animate={{ width: `${progress}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}/>{state === 'blocked' && <b className="http-block-marker">×</b>}</div><strong className="http-progress-value">{progress}%</strong></div>;
}

export function HttpComparisonTheater({ onExit, onOpenTls }: { onExit: () => void; onOpenTls: () => void }) {
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<VisualDrawerId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const state = useMemo(() => httpComparisonStateAt(timeMs), [timeMs]);
  const activeEvent = useMemo(() => latestHttpComparisonEvent(timeMs), [timeMs]);
  const activeIndex = httpComparisonEvents.indexOf(activeEvent);
  const timelineEvents: VisualTimelineEvent[] = httpComparisonEvents.map((event) => ({
    id: event.id,
    atMs: event.atMs,
    label: event.title,
    tone: event.id === 'loss' || event.id === 'hol-diverges' ? 'danger' : event.id.includes('retransmit') ? 'warning' : event.id === 'complete' ? 'success' : 'neutral',
  }));
  const { playbackSpeed, setPlaybackSpeed } = useVisualPresentationPlayback({
    playing,
    timeMs,
    durationMs: HTTP_COMPARISON_DURATION_MS,
    events: timelineEvents,
    onTimeChange: setTimeMs,
    onComplete: () => setPlaying(false),
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduceMotion) return;
    const pulses = root.querySelectorAll('.http-transport-line.has-loss .http-loss-pulse');
    if (pulses.length === 0) return;
    const animation = animate(pulses, { opacity: [0, 1, 0], scale: [0.6, 1.5, 2.2], duration: 900, ease: 'outExpo' });
    return () => { animation.cancel(); };
  }, [activeEvent.id, reduceMotion]);

  const seek = (nextTime: number) => {
    setPlaying(false);
    setTimeMs(clampHttpComparisonTime(nextTime));
  };

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (timeMs >= HTTP_COMPARISON_DURATION_MS) setTimeMs(0);
    setPlaying(true);
  };

  const openDrawer = (drawer: VisualDrawerId) => {
    if (playing) setPlaying(false);
    setActiveDrawer((current) => current === drawer ? null : drawer);
  };

  const timelineMilestones: VisualTimelineMilestone[] = [
    { id: 'open', atMs: 0, label: 'OPEN' },
    { id: 'loss', atMs: 900, label: 'LOSS' },
    { id: 'diverge', atMs: 1450, label: 'DIVERGE' },
    { id: 'tcp', atMs: 1900, label: 'TCP REPAIR' },
    { id: 'quic', atMs: 2350, label: 'QUIC REPAIR' },
    { id: 'done', atMs: 2850, label: 'DONE' },
  ];

  const inspectContent = <div className="protocol-inspect-drawer http-protocol-drawer">
    <article className="protocol-inspect-event severity-info"><div><span>{formatTime(activeEvent.atMs)}</span><b>SYNCHRONIZED TRACE</b></div><h3>{activeEvent.title}</h3><p>{activeEvent.summary}</p><small>{activeEvent.detail}</small></article>
    <section><span>LANE STATE</span><div className="http-drawer-lanes"><div><b>HTTP/2 · TCP</b><strong>{state.h2.deliveryLabel}</strong><small>{state.h2.lossLabel} · {state.h2.congestionLabel}</small></div><div><b>HTTP/3 · QUIC</b><strong>{state.h3.deliveryLabel}</strong><small>{state.h3.lossLabel} · {state.h3.congestionLabel}</small></div></div></section>
    <section><span>CURRENT COMPARISON</span><div className="http-event-compare"><div><b>H2/TCP</b>{activeEvent.h2Label}</div><div><b>H3/QUIC</b>{activeEvent.h3Label}</div></div></section>
  </div>;

  const eventsContent = <section className="protocol-events-drawer http-events-drawer"><div className="http-inspector-heading"><span>SYNCHRONIZED EVENTS</span><strong>{String(activeIndex + 1).padStart(2, '0')} / {String(httpComparisonEvents.length).padStart(2, '0')}</strong></div><div className="http-event-list">{httpComparisonEvents.map((event, index) => { const complete = event.atMs <= timeMs; const current = event.id === activeEvent.id; return <button key={event.id} type="button" className={`${complete ? 'complete' : ''}${current ? ' current' : ''}`} onClick={() => seek(event.atMs)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{event.title}</strong><small>{formatTime(event.atMs)} · focus {event.focus}</small></div></button>; })}</div><div className="http-event-detail"><span>WHY THIS MATTERS</span><p>{activeEvent.detail}</p></div></section>;

  const modelContent = <div className="protocol-model-drawer http-model-drawer">
    <section><span>WHAT THIS CLAIMS</span><strong>ORDERING COUPLING, NOT LOSS IMMUNITY</strong><p>HTTP/3 removes cross-stream transport ordering blockage: loss on Stream A does not force Stream B to wait for Stream A’s missing bytes.</p></section>
    <section><span>IMPORTANT BOUNDARY</span><p>QUIC loss recovery and congestion control remain connection-wide, so loss can still reduce overall sending rate. This deterministic trace also avoids QPACK dynamic-table dependencies.</p></section>
    <button type="button" className="protocol-drawer-primary" onClick={onOpenTls}>Open TLS 1.3 handshake ↗</button>
  </div>;

  const drawers: VisualDrawerDefinition[] = [
    { id: 'inspect', label: 'Inspect', title: 'Current A/B state', eyebrow: `${activeEvent.focus.toUpperCase()} FOCUS · ${formatTime(timeMs)}`, content: inspectContent },
    { id: 'events', label: 'Events', title: 'Synchronized loss trace', eyebrow: `${httpComparisonEvents.length} COMPARISON EVENTS`, content: eventsContent },
    { id: 'tools', label: 'Model', title: 'Comparison boundary', eyebrow: 'CURATED LOSS TRACE', content: modelContent },
  ];

  return <VisualWorkspaceShell
    className="protocol-visual-workspace http-visual-workspace"
    entrance={{ eyebrow: 'HTTP/2 and HTTP/3', title: 'The same loss', accentTitle: 'lands differently.', subtitle: 'Two synchronized lanes expose how TCP and QUIC couple application streams.' }}
    stageLabel="HTTP/2 and HTTP/3 synchronized loss comparison"
    activeDrawer={activeDrawer}
    drawers={drawers}
    onCloseDrawer={() => setActiveDrawer(null)}
    toolbar={<><div className="visual-identity"><i/><span>HTTP loss comparison</span><strong>H2/TCP × H3/QUIC</strong></div><div className="protocol-visual-tools"><VisualDrawerTabs active={activeDrawer} items={[{ id: 'inspect', label: 'Inspect' }, { id: 'events', label: 'Events', badge: String(httpComparisonEvents.length) }, { id: 'tools', label: 'Model' }]} onSelect={openDrawer}/><button type="button" className="visual-tool-button protocol-link-button" onClick={onOpenTls}>TLS ↗</button><button type="button" className="visual-tool-button" onClick={onExit}>Exit</button></div></>}
    hud={<><div><span>PHASE</span><strong>{state.phaseLabel}</strong></div><div><span>LOSS TARGET</span><strong>{HTTP_STREAM_A}</strong></div><div><span>CONTROL</span><strong>SYNCHRONIZED A/B</strong></div><div><span>PROVENANCE</span><strong>SIMULATED</strong></div></>}
    timeline={<VisualTimeRail timeMs={timeMs} durationMs={HTTP_COMPARISON_DURATION_MS} playing={playing} playbackSpeed={playbackSpeed} onPlaybackSpeedChange={setPlaybackSpeed} label="Shared loss trace" context={`${activeEvent.focus} focus · same loss`} events={timelineEvents} milestones={timelineMilestones} onToggle={togglePlayback} onReset={() => seek(0)} onSeek={seek}/>}
  >
    <div ref={rootRef} className={`protocol-cinematic-stage http-cinematic-stage focus-${activeEvent.focus}`}>
      <div className="protocol-scene-kicker"><span>APPLICATION / TRANSPORT COUPLING</span><strong>{activeEvent.focus.toUpperCase()} FOCUS</strong></div>
      <div className="http-stage http-workspace-stage">
        <div className="http-divergence-axis" aria-hidden="true"><span>SAME LOSS</span><i/></div>
        <div className="http-lanes"><Lane lane="h2" state={state.h2} focused={activeEvent.focus === 'both' || activeEvent.focus === 'h2'}/><Lane lane="h3" state={state.h3} focused={activeEvent.focus === 'both' || activeEvent.focus === 'h3'}/></div>
        <AnimatePresence mode="wait" initial={false}><motion.article key={activeEvent.id} className={`protocol-scene-annotation http-scene-annotation focus-${activeEvent.focus}`} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: reduceMotion ? 0 : 0.24 }}><i aria-hidden="true"/><div><span>{formatTime(activeEvent.atMs)} · {activeEvent.focus} focus</span><strong>{activeEvent.title}</strong><p>{activeEvent.summary}</p><div className="http-event-compare"><div><b>H2</b>{activeEvent.h2Label}</div><div><b>H3</b>{activeEvent.h3Label}</div></div></div></motion.article></AnimatePresence>
      </div>
    </div>
  </VisualWorkspaceShell>;
}

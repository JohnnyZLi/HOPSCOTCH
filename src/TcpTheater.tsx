import { animate, stagger } from 'animejs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {ReviewedScene, useReviewedAttention} from './redesign/ReviewedScene';
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
  tcpLatestEventAtOrBefore,
  tcpScenario,
  tcpStateAt,
  type TcpEvent,
} from './protocol/tcp';

function formatTime(timeMs: number): string {
  const seconds = Math.floor(timeMs / 1000).toString().padStart(2, '0');
  const milliseconds = Math.floor(timeMs % 1000).toString().padStart(3, '0');
  return `00:${seconds}.${milliseconds}`;
}

function eventWireLabel(event: TcpEvent): string {
  const bits = [event.flags];
  if (event.seq !== undefined) bits.push(`SEQ ${event.seq}`);
  if (event.ack !== undefined) bits.push(`ACK ${event.ack}`);
  if (event.length) bits.push(`${event.length} B`);
  return bits.filter(Boolean).join(' · ');
}

function eventTone(severity: TcpEvent['severity']): VisualTimelineEvent['tone'] {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  if (severity === 'success') return 'success';
  return 'neutral';
}

function segmentState(index: number, timeMs: number): 'idle' | 'flight' | 'lost' | 'buffered' | 'delivered' | 'retransmit' {
  if (index === 1) return timeMs >= 1050 ? 'delivered' : 'idle';
  if (index === 2) {
    if (timeMs < 1250) return 'idle';
    if (timeMs < 2275) return 'lost';
    if (timeMs < 2600) return 'retransmit';
    return 'delivered';
  }
  if (index === 3) {
    if (timeMs < 1450) return 'idle';
    if (timeMs < 2600) return 'buffered';
    return 'delivered';
  }
  if (index === 4) {
    if (timeMs < 1750) return 'idle';
    if (timeMs < 2600) return 'buffered';
    return 'delivered';
  }
  if (index === 5) {
    if (timeMs < 2000) return 'idle';
    if (timeMs < 2600) return 'buffered';
    return 'delivered';
  }
  if (index === 6) return timeMs >= 3150 ? 'delivered' : 'idle';
  return 'idle';
}

function segmentStart(index: number): number {
  return 1001 + (index - 1) * tcpScenario.mss;
}

export function TcpTheater({ onExit, onOpenPacket }: { onExit: () => void; onOpenPacket: () => void }) {
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<VisualDrawerId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const state = useMemo(() => tcpStateAt(timeMs), [timeMs]);
  const activeEvent = useMemo(() => tcpLatestEventAtOrBefore(timeMs), [timeMs]);
  const activeIndex = tcpScenario.events.indexOf(activeEvent);
  const timelineEvents: VisualTimelineEvent[] = tcpScenario.events.map((event) => ({ id: event.id, atMs: event.atMs, label: event.title, tone: eventTone(event.severity) }));
  const presentation = useReviewedAttention(timelineEvents);
  const presentationData = useMemo(() => ({bootstrapScene:'tcp',referenceModels:[],tcp:{frames:tcpScenario.events.map(event => ({event,state:tcpStateAt(event.atMs)}))}}), []);
  const { playbackSpeed, setPlaybackSpeed } = useVisualPresentationPlayback({
    playing: playing && presentation.ready,
    timeMs,
    durationMs: tcpScenario.durationMs,
    events: presentation.events,
    onTimeChange: setTimeMs,
    onComplete: () => setPlaying(false),
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const animations: Array<ReturnType<typeof animate>> = [];
    const token = root.querySelector<HTMLElement>('.tcp-message-token');
    const wireStage = root.querySelector<HTMLElement>('.tcp-wire-stage');
    const windowCells = root.querySelectorAll('.tcp-window-cell.is-active');

    if (reduceMotion) {
      if (token) {
        token.style.left = '50%';
        token.style.opacity = activeEvent.direction === 'local' ? '0' : '1';
      }
      return;
    }

    if (activeEvent.direction !== 'local' && token && wireStage) {
      const leftToRight = activeEvent.direction === 'client-to-server';
      const endpoint = root.querySelector<HTMLElement>('.tcp-endpoint');
      const endpointOffset = endpoint ? endpoint.offsetLeft + endpoint.offsetWidth : 0;
      const safeInset = Math.min(34, Math.max(11, ((endpointOffset + token.offsetWidth / 2 + 14) / Math.max(wireStage.clientWidth, 1)) * 100));
      const start = leftToRight ? `${safeInset}%` : `${100 - safeInset}%`;
      const end = leftToRight ? `${100 - safeInset}%` : `${safeInset}%`;
      const lost = activeEvent.kind === 'data.loss';
      animations.push(animate(token, {
        left: lost ? [start, leftToRight ? '53%' : '47%'] : [start, end],
        opacity: lost ? [0, 1, 1, 0] : [0, 1, 1, 0.94],
        scale: lost ? [0.72, 1, 1.1, 0.2] : [0.78, 1.04, 1],
        duration: lost ? 760 : 820,
        ease: lost ? 'inQuad' : 'inOutSine',
      }));
    }

    if (windowCells.length > 0) {
      animations.push(animate(windowCells, {
        translateY: [3, 0],
        opacity: [0.42, 1],
        delay: stagger(24),
        duration: 360,
        ease: 'outExpo',
      }));
    }

    const localPulse = root.querySelector('.tcp-local-pulse');
    if (activeEvent.direction === 'local' && localPulse) {
      animations.push(animate(localPulse, {
        opacity: [0, 0.8, 0],
        scale: [0.8, 1.35, 1.8],
        duration: 900,
        ease: 'outExpo',
      }));
    }
    return () => animations.forEach((animation) => animation.cancel());
  }, [activeEvent.id, reduceMotion, state.cwndMss, state.ssthreshMss]);

  const seek = (nextTime: number) => {
    setPlaying(false);
    setTimeMs(Math.max(0, Math.min(tcpScenario.durationMs, nextTime)));
  };

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (timeMs >= tcpScenario.durationMs) setTimeMs(0);
    setPlaying(true);
  };

  const openDrawer = (drawer: VisualDrawerId) => {
    if (playing) setPlaying(false);
    setActiveDrawer((current) => current === drawer ? null : drawer);
  };

  const timelineMilestones: VisualTimelineMilestone[] = [
    { id: 'open', atMs: 0, label: 'OPEN' },
    { id: 'loss', atMs: 1250, label: 'LOSS' },
    { id: 'signal', atMs: 2125, label: '3× ACK' },
    { id: 'repair', atMs: 2275, label: 'REPAIR' },
    { id: 'recover', atMs: 2700, label: 'RECOVER' },
    { id: 'close', atMs: 4000, label: 'CLOSE' },
  ];

  const inspectContent = <div className="protocol-inspect-drawer tcp-protocol-drawer">
    <article className={`protocol-inspect-event severity-${activeEvent.severity}`}><div><span>{formatTime(activeEvent.atMs)}</span><b>SIMULATED · RENO</b></div><h3>{activeEvent.title}</h3><p>{activeEvent.summary}</p><small>{activeEvent.detail}</small></article>
    <section><span>CONNECTION STATE</span><div className="protocol-fact-grid"><div><small>PHASE</small><strong>{state.connectionLabel}</strong></div><div><small>EXPECTED ACK</small><strong>{state.expectedAck || '—'}</strong></div><div><small>DUP ACKS</small><strong>{state.duplicateAcks} / 3</strong></div><div><small>HIGHEST ACK</small><strong>{state.highestAck || '—'}</strong></div></div></section>
    <section><span>CONGESTION RESPONSE</span><div className="protocol-meter-pair"><div><small>cwnd</small><strong>{state.cwndMss} MSS</strong></div><div><small>ssthresh</small><strong>{state.ssthreshMss} MSS</strong></div></div><p>The sequence-space strip shows why later bytes can be buffered while the cumulative ACK stays pinned to the hole.</p></section>
  </div>;

  const eventsContent = <section className="protocol-events-drawer tcp-events-drawer"><div className="tcp-inspector-heading"><span>WIRE EVENTS</span><strong>{String(activeIndex + 1).padStart(2, '0')} / {String(tcpScenario.events.length).padStart(2, '0')}</strong></div><div className="tcp-event-list">{tcpScenario.events.map((event, index) => { const complete = event.atMs <= timeMs; const current = event.id === activeEvent.id; return <button key={event.id} type="button" className={`${complete ? 'complete' : ''}${current ? ' current' : ''}`} onClick={() => seek(event.atMs)}><span className="tcp-event-index">{String(index + 1).padStart(2, '0')}</span><span className="tcp-event-copy"><strong>{event.title}</strong><small>{formatTime(event.atMs)} · {eventWireLabel(event) || event.kind.replaceAll('.', ' ')}</small></span></button>; })}</div><div className="tcp-event-detail"><span>WHY THIS MATTERS</span><p>{activeEvent.detail}</p></div></section>;

  const modelContent = <div className="protocol-model-drawer"><section><span>MODEL BOUNDARY</span><strong>CURATED TCP RENO TRACE</strong><p>This deterministic sequence isolates cumulative acknowledgments, three duplicate ACKs, fast retransmit, and fast recovery. It is not a live socket capture.</p></section><section><span>FIXED ASSUMPTIONS</span><div className="protocol-fact-grid"><div><small>MSS</small><strong>{tcpScenario.mss} B</strong></div><div><small>INITIAL cwnd</small><strong>6 MSS</strong></div><div><small>CLIENT ISN</small><strong>{tcpScenario.clientInitialSeq}</strong></div><div><small>SERVER ISN</small><strong>{tcpScenario.serverInitialSeq}</strong></div></div></section><button type="button" className="protocol-drawer-primary" onClick={onOpenPacket}>OPEN PACKET MICROSCOPE ↗</button></div>;

  const drawers: VisualDrawerDefinition[] = [
    { id: 'inspect', label: 'Inspect', title: 'Current TCP state', eyebrow: `${state.phase.toUpperCase()} · ${formatTime(timeMs)}`, content: inspectContent },
    { id: 'events', label: 'Events', title: 'Wire and local event chain', eyebrow: `${tcpScenario.events.length} DETERMINISTIC EVENTS`, content: eventsContent },
    { id: 'tools', label: 'Model', title: 'Scenario boundary', eyebrow: 'CURATED RENO MODEL', content: modelContent },
  ];

  return <VisualWorkspaceShell
    className="protocol-visual-workspace tcp-visual-workspace"
    entrance={{ eyebrow: 'TCP recovery', title: 'One missing segment', accentTitle: 'reshapes the window.', subtitle: 'Sequence space, loss signaling, retransmission, and congestion response share one wire.' }}
    stageLabel="TCP fast retransmit and recovery theater"
    activeDrawer={activeDrawer}
    drawers={drawers}
    onCloseDrawer={() => setActiveDrawer(null)}
    toolbar={<><div className="visual-identity"><i/><span>TCP recovery</span><strong>Fast retransmit · Reno</strong></div><div className="protocol-visual-tools"><VisualDrawerTabs active={activeDrawer} items={[{ id: 'inspect', label: 'Inspect' }, { id: 'events', label: 'Events', badge: String(tcpScenario.events.length) }, { id: 'tools', label: 'Model' }]} onSelect={openDrawer}/><button type="button" className="visual-tool-button protocol-link-button" onClick={onOpenPacket}>Packet ↗</button><button type="button" className="visual-tool-button" onClick={onExit}>Exit</button></div></>}
    hud={<><div><span>PHASE</span><strong>{state.connectionLabel}</strong></div><div><span>EXPECTED ACK</span><strong>{state.expectedAck || '—'}</strong></div><div><span>DUP ACKS</span><strong>{state.duplicateAcks} / 3</strong></div><div><span>PROVENANCE</span><strong>SIMULATED</strong></div></>}
    timeline={<VisualTimeRail timeMs={timeMs} durationMs={tcpScenario.durationMs} playing={playing} playbackSpeed={playbackSpeed} onPlaybackSpeedChange={setPlaybackSpeed} label="TCP trace" context={`${state.cwndMss} MSS cwnd · ${state.ssthreshMss} MSS threshold`} events={timelineEvents} milestones={timelineMilestones} onToggle={togglePlayback} onReset={() => seek(0)} onSeek={seek}/>}
  >
    <ReviewedScene data={presentationData} timeMs={timeMs} durationMs={tcpScenario.durationMs} playing={playing} onBudgets={presentation.onBudgets}/>
  </VisualWorkspaceShell>;
}

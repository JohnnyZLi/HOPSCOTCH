import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type CSSProperties, useMemo, useState } from 'react';
import { LabNetworkField } from './LabNetworkField';
import { lab01Scenario, lab01StateAt } from './simulation/lab01';
import { latestEventAtOrBefore } from './simulation/model';
import {
  VisualDrawerTabs,
  VisualTimeRail,
  VisualWorkspaceShell,
  type VisualDrawerDefinition,
  type VisualDrawerId,
  type VisualPlaybackSpeed,
  type VisualTimelineEvent,
  type VisualTimelineMilestone,
} from './VisualWorkspace';
import './FailureStoryWorkspace.css';

function formatTime(timeMs: number): string {
  const seconds = Math.floor(timeMs / 1000).toString().padStart(2, '0');
  const milliseconds = Math.floor(timeMs % 1000).toString().padStart(3, '0');
  return `00:${seconds}.${milliseconds}`;
}

function eventTone(severity: string): VisualTimelineEvent['tone'] {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  if (severity === 'success') return 'success';
  return 'neutral';
}

export function FailureStoryWorkspace({
  timeMs,
  playing,
  playbackSpeed,
  onPlaybackSpeedChange,
  xray,
  onTogglePlayback,
  onSeek,
  onToggleXray,
  onExit,
}: {
  timeMs: number;
  playing: boolean;
  playbackSpeed: VisualPlaybackSpeed;
  onPlaybackSpeedChange: (speed: VisualPlaybackSpeed) => void;
  xray: boolean;
  onTogglePlayback: () => void;
  onSeek: (timeMs: number) => void;
  onToggleXray: () => void;
  onExit: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [activeDrawer, setActiveDrawer] = useState<VisualDrawerId | null>(null);
  const state = useMemo(() => lab01StateAt(timeMs), [timeMs]);
  const activeEvent = useMemo(() => latestEventAtOrBefore(lab01Scenario, timeMs), [timeMs]);
  const activePath = lab01Scenario.paths.find((path) => path.id === state.activePathId) ?? lab01Scenario.paths[0];
  const actorNode = lab01Scenario.nodes.find((node) => node.id === activeEvent.actorId);
  const targetNode = lab01Scenario.nodes.find((node) => node.id === activeEvent.targetId);
  const focusX = actorNode && targetNode ? (actorNode.x + targetNode.x) / 2 : actorNode?.x ?? targetNode?.x ?? 60;
  const focusY = actorNode && targetNode ? (actorNode.y + targetNode.y) / 2 : actorNode?.y ?? targetNode?.y ?? 36;
  const cameraScale = state.phase === 'failure'
    ? 1.055
    : state.phase === 'converging'
      ? 1.036
      : state.phase === 'recomputing'
        ? 1.024
        : state.phase === 'rerouting'
          ? 1.04
          : state.phase === 'recovered'
            ? 1.015
            : 1;
  const cameraX = ((60 - focusX) / 60) * 12;
  const cameraY = ((36 - focusY) / 36) * 7;
  const annotationStyle = {
    '--failure-anchor-x': `${focusX / 120 * 100}%`,
    '--failure-anchor-y': `${focusY / 72 * 100}%`,
  } as CSSProperties;

  const openDrawer = (drawer: VisualDrawerId) => {
    if (playing) onTogglePlayback();
    setActiveDrawer((current) => current === drawer ? null : drawer);
  };
  const togglePlayback = () => {
    if (playing) {
      onTogglePlayback();
      return;
    }
    onTogglePlayback();
  };

  const timelineEvents: VisualTimelineEvent[] = lab01Scenario.events.map((event) => ({
    id: event.id,
    atMs: event.atMs,
    label: event.payload.title,
    tone: eventTone(event.payload.severity),
  }));
  const timelineMilestones: VisualTimelineMilestone[] = [
    { id: 'break', atMs: 1900, label: 'BREAK' },
    { id: 'flood', atMs: 2500, label: 'FLOOD' },
    { id: 'spf', atMs: 3800, label: 'SPF' },
    { id: 'reroute', atMs: 4500, label: 'REROUTE' },
    { id: 'recover', atMs: 5400, label: 'RECOVER' },
  ];

  const inspectContent = <div className="failure-inspect-drawer">
    <article className={`failure-inspect-event severity-${activeEvent.payload.severity}`}><div><span>{formatTime(activeEvent.atMs)}</span><b>SIMULATED</b></div><h3>{activeEvent.payload.title}</h3><p>{activeEvent.payload.summary}</p><small>{activeEvent.payload.detail}</small></article>
    <section><span>FORWARDING STATE</span><div className="failure-fact-grid"><div><small>PHASE</small><strong>{state.phase.toUpperCase()}</strong></div><div><small>INSTALLED PATH</small><strong>{activePath.label.toUpperCase()}</strong></div><div><small>PATH COST</small><strong>{activePath.metric}</strong></div><div><small>FAILED LINKS</small><strong>{state.failedLinkIds.length ? state.failedLinkIds.map((id) => id.toUpperCase()).join(' · ') : 'NONE'}</strong></div></div></section>
    <section><span>CANDIDATE PATHS</span>{lab01Scenario.paths.map((path) => <div key={path.id} className={`failure-path-row ${path.id === activePath.id ? 'active' : ''}`}><div><strong>{path.label}</strong><small>{path.nodeIds.map((id) => lab01Scenario.nodes.find((node) => node.id === id)?.shortLabel ?? id).join(' → ')}</small></div><b>{path.metric}</b></div>)}</section>
  </div>;

  const eventsContent = <section className="failure-events-drawer"><div className="inspector-heading"><span>CAUSAL CHAIN</span><strong>{String(lab01Scenario.events.indexOf(activeEvent) + 1).padStart(2, '0')} / {String(lab01Scenario.events.length).padStart(2, '0')}</strong></div><div className="event-list">{lab01Scenario.events.map((event,index)=>{const complete=event.atMs<=timeMs;const current=event.id===activeEvent.id;return <button key={event.id} type="button" className={`${complete?'complete':''}${current?' current':''}`} onClick={()=>onSeek(event.atMs)}><span className="event-index">{String(index+1).padStart(2,'0')}</span><span className="event-copy"><strong>{event.payload.title}</strong><small>{formatTime(event.atMs)} · {event.kind.replace('.', ' ')}</small></span></button>})}</div><div className="event-detail"><span>WHY THIS MATTERS</span><p>{activeEvent.payload.detail}</p></div></section>;

  const drawers: VisualDrawerDefinition[] = [
    { id: 'inspect', label: 'Inspect', title: 'Current forwarding state', eyebrow: `${state.phase.toUpperCase()} · ${formatTime(timeMs)}`, content: inspectContent },
    { id: 'events', label: 'Events', title: 'Failure and recovery chain', eyebrow: `${lab01Scenario.events.length} CANONICAL EVENTS`, content: eventsContent },
  ];

  return <VisualWorkspaceShell
    className="failure-visual-workspace"
    entrance={{ eyebrow: 'Failure and recovery', title: 'The primary path', accentTitle: 'is recomputed.', subtitle: 'Failure, convergence, recomputation, and recovery happen in the topology.' }}
    stageLabel="Failure Story network topology"
    activeDrawer={activeDrawer}
    drawers={drawers}
    onCloseDrawer={()=>setActiveDrawer(null)}
    toolbar={<><div className="visual-identity"><i/><span>Failure sequence</span><strong>{state.statusLabel}</strong></div><div className="failure-visual-tools"><button type="button" className={`visual-tool-button ${xray?'active':''}`} aria-pressed={xray} onClick={onToggleXray}>Detail {xray?'on':'off'}</button><VisualDrawerTabs active={activeDrawer} items={[{id:'inspect',label:'Inspect'},{id:'events',label:'Events',badge:String(lab01Scenario.events.length)}]} onSelect={openDrawer}/><button type="button" className="visual-tool-button" onClick={onExit}>Exit</button></div></>}
    hud={<><div><span>PHASE</span><strong>{state.phase.toUpperCase()}</strong></div><div><span>INSTALLED PATH</span><strong>{activePath.label.toUpperCase()}</strong></div><div><span>PATH COST</span><strong>{activePath.metric}</strong></div><div><span>PROVENANCE</span><strong>SIMULATED</strong></div></>}
    timeline={<VisualTimeRail timeMs={timeMs} durationMs={lab01Scenario.durationMs} playing={playing} playbackSpeed={playbackSpeed} onPlaybackSpeedChange={onPlaybackSpeedChange} label="Failure sequence" context={state.statusLabel} events={timelineEvents} milestones={timelineMilestones} onToggle={togglePlayback} onReset={()=>onSeek(0)} onSeek={onSeek}/>}
  >
    <div className={`failure-cinematic-stage phase-${state.phase}`} style={annotationStyle}>
      <motion.div key={`flash-${activeEvent.id}`} className={`lab-phase-flash severity-${activeEvent.payload.severity}`} initial={reduceMotion ? false : {opacity:activeEvent.payload.severity==='critical'?.34:.16}} animate={{opacity:0}} transition={{duration:activeEvent.payload.severity==='critical'?.95:.7}} aria-hidden="true"/>
      <motion.div className="failure-scene-camera" animate={reduceMotion?undefined:{x:cameraX,y:cameraY,scale:cameraScale}} transition={{type:'spring',stiffness:110,damping:20,mass:.85}}><LabNetworkField scenario={lab01Scenario} state={state} activeEvent={activeEvent} xray={xray}/></motion.div>
      <AnimatePresence mode="wait" initial={false}><motion.article key={activeEvent.id} className={`failure-object-annotation ${focusX > 66 ? 'align-left' : 'align-right'} severity-${activeEvent.payload.severity}`} initial={reduceMotion?{opacity:1}:{opacity:0,scale:.92}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.94}} transition={reduceMotion?{duration:0}:{duration:.28,ease:[.16,1,.3,1]}}><i aria-hidden="true"/><div><span>{formatTime(activeEvent.atMs)} · {activeEvent.kind.replace('.', ' ').toUpperCase()}</span><strong>{activeEvent.payload.title}</strong><p>{activeEvent.payload.summary}</p></div></motion.article></AnimatePresence>
    </div>
  </VisualWorkspaceShell>;
}

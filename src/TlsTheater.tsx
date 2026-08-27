import { animate, stagger } from 'animejs';
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
  TLS_HOST,
  clampTlsTime,
  tlsDurationMs,
  tlsEvents,
  tlsLatestEventAtOrBefore,
  tlsStateAt,
  type TlsKeyStage,
  type TlsProtection,
} from './protocol/tls';

const keyStages: Array<{ id: TlsKeyStage; label: string; note: string }> = [
  { id: 'early', label: 'EARLY SECRET', note: 'no PSK · zero input branch' },
  { id: 'handshake', label: 'HANDSHAKE SECRET', note: 'ECDHE + CH…SH transcript' },
  { id: 'master', label: 'MASTER SECRET', note: 'post-handshake derivation root' },
  { id: 'application', label: 'APPLICATION TRAFFIC', note: 'client/server traffic secret 0' },
];

function formatTime(timeMs: number): string {
  const seconds = Math.floor(timeMs / 1000).toString().padStart(2, '0');
  const milliseconds = Math.floor(timeMs % 1000).toString().padStart(3, '0');
  return `00:${seconds}.${milliseconds}`;
}

function eventTone(protection: TlsProtection): VisualTimelineEvent['tone'] {
  if (protection === 'application') return 'success';
  if (protection === 'handshake') return 'evidence';
  if (protection === 'local') return 'warning';
  return 'neutral';
}

export function TlsTheater({
  onExit,
  onOpenDns,
  onOpenTcp,
  onOpenPacket,
}: {
  onExit: () => void;
  onOpenDns: () => void;
  onOpenTcp: () => void;
  onOpenPacket: () => void;
}) {
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<VisualDrawerId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const state = useMemo(() => tlsStateAt(timeMs), [timeMs]);
  const activeEvent = useMemo(() => tlsLatestEventAtOrBefore(timeMs), [timeMs]);
  const activeIndex = tlsEvents.indexOf(activeEvent);
  const timelineEvents: VisualTimelineEvent[] = tlsEvents.map((event) => ({ id: event.id, atMs: event.atMs, label: event.title, tone: eventTone(event.protection) }));
  const { playbackSpeed, setPlaybackSpeed } = useVisualPresentationPlayback({
    playing,
    timeMs,
    durationMs: tlsDurationMs,
    events: timelineEvents,
    onTimeChange: setTimeMs,
    onComplete: () => setPlaying(false),
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduceMotion) return;
    const animations: Array<ReturnType<typeof animate>> = [];
    const token = root.querySelector<HTMLElement>('.tls-message-token');
    const wireStage = root.querySelector<HTMLElement>('.tls-wire-stage');
    const keyNodes = root.querySelectorAll('.tls-key-stage.active');
    const transcriptItems = root.querySelectorAll('.tls-transcript-item.current');

    if (activeEvent.direction !== 'local' && token && wireStage) {
      const leftToRight = activeEvent.direction === 'client-to-server';
      const endpoint = root.querySelector<HTMLElement>('.tls-endpoint');
      const endpointOffset = endpoint ? endpoint.offsetLeft + endpoint.offsetWidth : 0;
      const safeInset = Math.min(34, Math.max(12, ((endpointOffset + token.offsetWidth / 2 + 14) / Math.max(wireStage.clientWidth, 1)) * 100));
      animations.push(animate(token, { left: leftToRight ? [`${safeInset}%`, `${100 - safeInset}%`] : [`${100 - safeInset}%`, `${safeInset}%`], opacity: [0, 1, 1, 0.96], scale: [0.78, 1.04, 1], duration: 820, ease: 'inOutSine' }));
    }
    if (keyNodes.length > 0) animations.push(animate(keyNodes, { opacity: [0.62, 1], translateY: [4, 0], delay: stagger(32), duration: 420, ease: 'outExpo' }));
    if (transcriptItems.length > 0) animations.push(animate(transcriptItems, { opacity: [0.35, 1], scale: [0.96, 1], duration: 360, ease: 'outExpo' }));
    const pulse = root.querySelector('.tls-local-pulse');
    if (activeEvent.direction === 'local' && pulse) animations.push(animate(pulse, { opacity: [0, 0.8, 0], scale: [0.8, 1.35, 1.8], duration: 900, ease: 'outExpo' }));
    return () => animations.forEach((animation) => animation.cancel());
  }, [activeEvent.id, reduceMotion, state.activeKeys.length, state.transcript.length]);

  const seek = (nextTime: number) => {
    setPlaying(false);
    setTimeMs(clampTlsTime(nextTime));
  };

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (timeMs >= tlsDurationMs) setTimeMs(0);
    setPlaying(true);
  };

  const openDrawer = (drawer: VisualDrawerId) => {
    if (playing) setPlaying(false);
    setActiveDrawer((current) => current === drawer ? null : drawer);
  };

  const handshakeKeysReady = state.activeKeys.includes('handshake');
  const wireProtection = state.applicationReady ? 'application' : handshakeKeysReady ? 'handshake' : 'cleartext';
  const wireEncrypted = wireProtection !== 'cleartext';
  const protectionLabel = wireProtection === 'cleartext' ? 'VISIBLE HANDSHAKE' : wireProtection === 'handshake' ? 'HANDSHAKE KEYS' : 'APPLICATION KEYS';
  const boundaryTitle = activeEvent.direction === 'local' ? 'LOCAL STATE TRANSITION' : wireEncrypted ? 'ENCRYPTED TLS RECORD' : activeEvent.message;
  const boundaryNote = activeEvent.direction === 'local' ? `No wire message · protection remains ${wireProtection}` : wireEncrypted ? 'Semantic label supplied by the curated trace' : 'Negotiation remains visible at this point';
  const timelineMilestones: VisualTimelineMilestone[] = [
    { id: 'offer', atMs: 0, label: 'OFFER' },
    { id: 'keys', atMs: 680, label: 'KEYS' },
    { id: 'identity', atMs: 1690, label: 'IDENTITY' },
    { id: 'finished', atMs: 2350, label: 'FINISHED' },
    { id: 'data', atMs: 2720, label: 'DATA' },
    { id: 'ready', atMs: 3500, label: 'READY' },
  ];

  const inspectContent = <div className="protocol-inspect-drawer tls-protocol-drawer">
    <article className={`protocol-inspect-event protection-${activeEvent.protection}`}><div><span>{formatTime(activeEvent.atMs)}</span><b>CURATED TLS 1.3</b></div><h3>{activeEvent.title}</h3><p>{activeEvent.summary}</p><small>{activeEvent.detail}</small>{activeEvent.fields && <div className="tls-field-chips">{activeEvent.fields.map((field) => <span key={field.label}><b>{field.label}</b>{field.value}</span>)}</div>}</article>
    <section><span>NEGOTIATED STATE</span><div className="protocol-fact-grid"><div><small>VERSION</small><strong>{state.negotiatedVersion ?? 'PENDING'}</strong></div><div><small>ALPN</small><strong>{state.negotiatedAlpn ?? 'PENDING'}</strong></div><div><small>GROUP</small><strong>{state.negotiatedGroup ?? 'PENDING'}</strong></div><div><small>CERTIFICATE</small><strong>{state.certificateState.toUpperCase()}</strong></div></div></section>
    <section><span>WIRE VISIBILITY</span><p>{boundaryNote}. Once handshake keys exist, HOPSCOTCH labels semantic content from the deterministic model; it does not claim passive decryption.</p></section>
  </div>;

  const eventsContent = <section className="protocol-events-drawer tls-events-drawer"><div className="tls-inspector-heading"><span>TLS 1.3 HANDSHAKE</span><strong>{String(activeIndex + 1).padStart(2, '0')} / {String(tlsEvents.length).padStart(2, '0')}</strong></div><div className="tls-event-list">{tlsEvents.map((event, index) => { const complete = event.atMs <= timeMs; const current = event.id === activeEvent.id; return <button key={event.id} type="button" className={`${complete ? 'complete' : ''}${current ? ' current' : ''}`} onClick={() => seek(event.atMs)}><span className="tls-event-index">{String(index + 1).padStart(2, '0')}</span><span className="tls-event-copy"><strong>{event.title}</strong><small>{formatTime(event.atMs)} · {event.message} · {event.protection}</small></span></button>; })}</div><div className="tls-event-detail"><span>WHY THIS MATTERS</span><p>{activeEvent.detail}</p></div></section>;

  const modelContent = <div className="protocol-model-drawer tls-model-drawer">
    <section><span>MODEL BOUNDARY</span><strong>SYMBOLIC SECRETS · NO KEY BYTES</strong><p>The key schedule names real TLS 1.3 stages but never invents or exposes secret material. The certificate chain and signatures are explicitly simulated.</p></section>
    <section><span>RELATED WORKSPACES</span><div className="protocol-link-grid"><button type="button" onClick={onOpenDns}>DNS resolution ↗</button><button type="button" onClick={onOpenTcp}>TCP recovery ↗</button><button type="button" onClick={onOpenPacket}>Packet microscope ↗</button></div></section>
  </div>;

  const drawers: VisualDrawerDefinition[] = [
    { id: 'inspect', label: 'Inspect', title: 'Current TLS state', eyebrow: `${state.phase.toUpperCase()} · ${formatTime(timeMs)}`, content: inspectContent },
    { id: 'events', label: 'Events', title: 'Handshake event chain', eyebrow: `${tlsEvents.length} DETERMINISTIC EVENTS`, content: eventsContent },
    { id: 'tools', label: 'Model', title: 'Truth boundary and related workspaces', eyebrow: 'CURATED TLS 1.3', content: modelContent },
  ];

  return <VisualWorkspaceShell
    className="protocol-visual-workspace tls-visual-workspace"
    entrance={{ eyebrow: 'TLS 1.3 handshake', title: 'The transcript', accentTitle: 'becomes protected.', subtitle: 'Negotiation, identity, transcript, and key stages cross the encryption boundary in one scene.' }}
    stageLabel="TLS 1.3 handshake and encryption theater"
    activeDrawer={activeDrawer}
    drawers={drawers}
    onCloseDrawer={() => setActiveDrawer(null)}
    toolbar={<><div className="visual-identity"><i/><span>TLS 1.3 handshake</span><strong>{TLS_HOST} · {protectionLabel}</strong></div><div className="protocol-visual-tools"><VisualDrawerTabs active={activeDrawer} items={[{ id: 'inspect', label: 'Inspect' }, { id: 'events', label: 'Events', badge: String(tlsEvents.length) }, { id: 'tools', label: 'Model' }]} onSelect={openDrawer}/><button type="button" className="visual-tool-button" onClick={onExit}>Exit</button></div></>}
    hud={<><div><span>PHASE</span><strong>{state.phaseLabel}</strong></div><div><span>WIRE</span><strong>{protectionLabel}</strong></div><div><span>ALPN</span><strong>{state.negotiatedAlpn ?? 'OFFERING h2'}</strong></div><div><span>PROVENANCE</span><strong>SIMULATED</strong></div></>}
    timeline={<VisualTimeRail timeMs={timeMs} durationMs={tlsDurationMs} playing={playing} playbackSpeed={playbackSpeed} onPlaybackSpeedChange={setPlaybackSpeed} label="TLS handshake" context={`${state.transcript.length} transcript messages · ${state.activeKeys.length} key stages`} events={timelineEvents} milestones={timelineMilestones} onToggle={togglePlayback} onReset={() => seek(0)} onSeek={seek}/>}
  >
    <div ref={rootRef} className={`protocol-cinematic-stage tls-cinematic-stage protection-${wireProtection}`}>
      <div className="protocol-scene-kicker"><span>TLS 1.3 / RECORD LAYER</span><strong>{activeEvent.direction === 'local' ? 'LOCAL DERIVATION' : activeEvent.direction.replaceAll('-', ' ').toUpperCase()}</strong></div>
      <div className="tls-stage tls-workspace-stage">
        <div className={`tls-wire-stage${wireEncrypted ? ' is-encrypted' : ''}`}>
          <div className="tls-cipher-field" aria-hidden="true"><span>6F A1 09 7C</span><span>AE 32 F8 D0</span><span>19 C4 77 2B</span><span>D3 80 5E 14</span></div>
          <div className="tls-endpoint endpoint-client"><span>CLIENT</span><strong>{TLS_HOST}</strong><small>{state.applicationReady ? 'APPLICATION KEYS ACTIVE' : 'HANDSHAKE IN PROGRESS'}</small></div>
          <div className="tls-wire"><i/><b/><i/></div>
          <div className="tls-encryption-boundary"><span>WIRE VISIBILITY</span><strong>{boundaryTitle}</strong><small>{boundaryNote}</small></div>
          <div className="tls-endpoint endpoint-server"><span>SERVER</span><strong>203.0.113.42:443</strong><small>{state.certificateState === 'valid' ? 'IDENTITY VALIDATED' : 'SIMULATED CERTIFICATE'}</small></div>
          <div className={`tls-message-token protection-${activeEvent.protection}${activeEvent.direction === 'local' ? ' is-local' : ''}`}><span>{activeEvent.protection.toUpperCase()}</span><strong>{activeEvent.message}</strong>{wireEncrypted && activeEvent.direction !== 'local' && <i aria-hidden="true">◆</i>}</div><div className="tls-local-pulse" aria-hidden="true"/>
          <AnimatePresence mode="wait" initial={false}><motion.article key={activeEvent.id} className={`protocol-scene-annotation tls-scene-annotation protection-${activeEvent.protection}`} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: reduceMotion ? 0 : 0.24 }}><i aria-hidden="true"/><div><span>{formatTime(activeEvent.atMs)} · {activeEvent.protection}</span><strong>{activeEvent.title}</strong><p>{activeEvent.summary}</p></div></motion.article></AnimatePresence>
        </div>
        <div className="tls-key-schedule"><div className="tls-subhead"><div><span>SYMBOLIC KEY SCHEDULE</span><strong>STAGE NAMES, NOT SECRET BYTES</strong></div><small>HKDF structure</small></div><div className="tls-key-chain">{keyStages.map((stage, index) => <div key={stage.id} className={`tls-key-stage${state.activeKeys.includes(stage.id) ? ' active' : ''}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{stage.label}</strong><small>{stage.note}</small></div>)}</div></div>
        <div className="tls-transcript-panel"><div className="tls-subhead"><div><span>TRANSCRIPT</span><strong>{state.transcript.length} MESSAGES HASHED</strong></div><small>ordered context</small></div><div className="tls-transcript-list">{tlsEvents.filter((event) => event.transcriptLabel).map((event) => { const included = state.transcript.includes(event.transcriptLabel!); const current = event.id === activeEvent.id; return <span key={event.id} className={`tls-transcript-item${included ? ' included' : ''}${current ? ' current' : ''}`}><i/>{event.transcriptLabel}</span>; })}</div></div>
      </div>
    </div>
  </VisualWorkspaceShell>;
}

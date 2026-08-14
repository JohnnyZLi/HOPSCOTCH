import { animate, stagger } from 'animejs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const rootRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const state = useMemo(() => tcpStateAt(timeMs), [timeMs]);
  const activeEvent = useMemo(() => tcpLatestEventAtOrBefore(timeMs), [timeMs]);
  const visibleEvents = useMemo(
    () => tcpScenario.events.filter((event) => event.atMs <= timeMs),
    [timeMs],
  );

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now();
    const startedFrom = timeMs;
    let frameId = 0;

    const tick = (now: number) => {
      const next = Math.min(tcpScenario.durationMs, startedFrom + (now - startedAt));
      setTimeMs(next);
      if (next >= tcpScenario.durationMs) {
        setPlaying(false);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing]);

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
      const safeInset = Math.min(34, Math.max(11, ((token.offsetWidth / 2 + 10) / Math.max(wireStage.clientWidth, 1)) * 100));
      const start = leftToRight ? `${safeInset}%` : `${100 - safeInset}%`;
      const end = leftToRight ? `${100 - safeInset}%` : `${safeInset}%`;
      const lost = activeEvent.kind === 'data.loss';

      animations.push(
        animate(token, {
          left: lost ? [start, leftToRight ? '53%' : '47%'] : [start, end],
          opacity: lost ? [0, 1, 1, 0] : [0, 1, 1, 0.94],
          scale: lost ? [0.72, 1, 1.1, 0.2] : [0.78, 1.04, 1],
          duration: lost ? 760 : 820,
          ease: lost ? 'inQuad' : 'inOutSine',
        }),
      );
    }

    if (windowCells.length > 0) {
      animations.push(
        animate(windowCells, {
          translateY: [3, 0],
          opacity: [0.42, 1],
          delay: stagger(24),
          duration: 360,
          ease: 'outExpo',
        }),
      );
    }

    const localPulse = root.querySelector('.tcp-local-pulse');
    if (activeEvent.direction === 'local' && localPulse) {
      animations.push(
        animate(localPulse, {
          opacity: [0, 0.8, 0],
          scale: [0.8, 1.35, 1.8],
          duration: 900,
          ease: 'outExpo',
        }),
      );
    }

    return () => animations.forEach((animation) => animation.cancel());
  }, [activeEvent.id, reduceMotion, state.cwndMss, state.ssthreshMss]);

  const seek = (nextTime: number) => {
    setPlaying(false);
    setTimeMs(nextTime);
  };

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (timeMs >= tcpScenario.durationMs) setTimeMs(0);
    setPlaying(true);
  };

  const activeIndex = tcpScenario.events.indexOf(activeEvent);

  return (
    <motion.section
      ref={rootRef}
      className="tcp-theater"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="tcp-heading">
        <div>
          <p className="eyebrow">Lab 03A · Protocol theater</p>
          <h1>MAKE TCP<br /><span>SHOW ITS WORK.</span></h1>
        </div>
        <div className="tcp-heading-actions">
          <span className="tcp-model-badge">CURATED RENO MODEL</span>
          <button type="button" className="lab-mode" onClick={onOpenPacket}>OPEN PACKET ↗</button>
          <button type="button" className="lab-mode" onClick={onExit}>EXIT LAB</button>
        </div>
      </header>

      <div className="tcp-stage">
        <div className="tcp-stage-meta">
          <div><span>PHASE</span><strong>{state.connectionLabel}</strong></div>
          <div><span>EXPECTED ACK</span><strong>{state.expectedAck || '—'}</strong></div>
          <div><span>DUP ACKS</span><strong>{state.duplicateAcks} / 3</strong></div>
        </div>

        <div className="tcp-wire-stage">
          <div className="tcp-endpoint endpoint-client">
            <span>CLIENT</span>
            <strong>192.0.2.10</strong>
            <small>SEQ SPACE · {activeEvent.direction === 'client-to-server' ? 'SENDER' : 'PEER'}</small>
          </div>

          <div className="tcp-wire" aria-hidden="true">
            <i />
            <b />
            <i />
          </div>

          <div className="tcp-endpoint endpoint-server">
            <span>SERVER</span>
            <strong>198.51.100.42:443</strong>
            <small>RECEIVE NEXT · {state.expectedAck || 1001}</small>
          </div>

          <div className={`tcp-message-token severity-${activeEvent.severity} kind-${activeEvent.kind.replaceAll('.', '-')}`}>
            <span>{activeEvent.flags ?? 'LOCAL'}</span>
            <strong>{activeEvent.direction === 'local' ? activeEvent.title : eventWireLabel(activeEvent)}</strong>
            {activeEvent.kind === 'data.loss' && <b aria-hidden="true">×</b>}
          </div>
          <div className="tcp-local-pulse" aria-hidden="true" />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeEvent.id}
            className={`tcp-event-callout severity-${activeEvent.severity}`}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={{ duration: 0.24 }}
          >
            <span>{formatTime(activeEvent.atMs)} · {activeEvent.kind.replaceAll('.', ' ')}</span>
            <strong>{activeEvent.title}</strong>
            <p>{activeEvent.summary}</p>
          </motion.div>
        </AnimatePresence>

        <div className="tcp-sequence-space">
          <div className="tcp-subhead">
            <div><span>CLIENT SEQUENCE SPACE</span><strong>1460-BYTE MSS SEGMENTS</strong></div>
            <small>Hole repair is cumulative</small>
          </div>
          <div className="tcp-segment-grid">
            {[1, 2, 3, 4, 5, 6].map((index) => {
              const status = segmentState(index, timeMs);
              const start = segmentStart(index);
              const end = start + tcpScenario.mss - 1;
              return (
                <motion.div
                  layout
                  key={index}
                  className={`tcp-segment status-${status}${index === activeEvent.segmentIndex ? ' current' : ''}`}
                >
                  <span>SEG {index}</span>
                  <strong>{start}–{end}</strong>
                  <small>{status.toUpperCase()}</small>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="tcp-congestion-panel">
          <div className="tcp-subhead">
            <div><span>CONGESTION CONTROL</span><strong>CURATED RENO RESPONSE</strong></div>
            <small>MSS = {tcpScenario.mss} B</small>
          </div>
          <div className="tcp-window-values">
            <div><span>cwnd</span><strong>{state.cwndMss} MSS</strong></div>
            <div><span>ssthresh</span><strong>{state.ssthreshMss} MSS</strong></div>
          </div>
          <div className="tcp-window-slots" aria-label={`Congestion window ${state.cwndMss} MSS, threshold ${state.ssthreshMss} MSS`}>
            {Array.from({ length: 12 }, (_, index) => {
              const number = index + 1;
              return (
                <i
                  key={number}
                  className={`${number <= state.cwndMss ? 'is-active' : ''}${number === state.ssthreshMss ? ' is-threshold' : ''}`}
                  title={`${number} MSS`}
                />
              );
            })}
          </div>
          <div className="tcp-window-legend">
            <span><i className="legend-cwnd" /> ACTIVE cwnd</span>
            <span><i className="legend-threshold" /> ssthresh marker</span>
          </div>
        </div>
      </div>

      <aside className="tcp-inspector" aria-label="TCP causal chain">
        <div className="tcp-inspector-heading">
          <span>WIRE EVENTS</span>
          <strong>{String(activeIndex + 1).padStart(2, '0')} / {String(tcpScenario.events.length).padStart(2, '0')}</strong>
        </div>
        <div className="tcp-event-list">
          {tcpScenario.events.map((event, index) => {
            const complete = event.atMs <= timeMs;
            const current = event.id === activeEvent.id;
            return (
              <button
                key={event.id}
                type="button"
                className={`${complete ? 'complete' : ''}${current ? ' current' : ''}`}
                onClick={() => seek(event.atMs)}
              >
                <span className="tcp-event-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="tcp-event-copy">
                  <strong>{event.title}</strong>
                  <small>{formatTime(event.atMs)} · {eventWireLabel(event) || event.kind.replaceAll('.', ' ')}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className="tcp-event-detail">
          <span>WHY THIS MATTERS</span>
          <p>{activeEvent.detail}</p>
        </div>
      </aside>

      <footer className="time-machine tcp-time-machine">
        <div className="time-controls">
          <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause TCP scenario' : 'Play TCP scenario'}>{playing ? 'Ⅱ' : '▶'}</button>
          <button type="button" onClick={() => seek(0)} aria-label="Reset TCP scenario">↺</button>
        </div>
        <div className="time-readout"><span>TCP TIME MACHINE</span><strong>{formatTime(timeMs)}</strong></div>
        <div className="scrubber-wrap">
          <div className="timeline-markers" aria-hidden="true">
            {tcpScenario.events.map((event) => (
              <i key={event.id} className={event.atMs <= timeMs ? 'passed' : ''} style={{ left: `${(event.atMs / tcpScenario.durationMs) * 100}%` }} />
            ))}
          </div>
          <input
            type="range"
            min="0"
            max={tcpScenario.durationMs}
            step="10"
            value={Math.round(timeMs)}
            onChange={(event) => seek(Number(event.currentTarget.value))}
            aria-label="TCP scenario time"
          />
        </div>
        <span className="time-duration">{formatTime(tcpScenario.durationMs)}</span>
      </footer>
    </motion.section>
  );
}

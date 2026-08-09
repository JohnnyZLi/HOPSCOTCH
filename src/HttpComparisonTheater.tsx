import { animate } from 'animejs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  return (
    <motion.section className={`http-lane lane-${lane}${focused ? ' focused' : ''}`} animate={{ opacity: focused ? 1 : 0.78, scale: focused ? 1.008 : 1 }}>
      <header>
        <div><span>{h2 ? 'HTTP/2' : 'HTTP/3'}</span><strong>{state.transportLabel}</strong></div>
        <small>{h2 ? 'ONE ORDERED TCP BYTE STREAM' : 'INDEPENDENT QUIC STREAM ORDERING'}</small>
      </header>
      <div className="http-transport-rail">
        <span>{state.lossLabel.toUpperCase()}</span>
        <div className={`http-transport-line${state.lossLabel !== 'none' && state.lossLabel !== 'repaired' ? ' has-loss' : ''}`}>
          <i /><b /><i />
          <em className="http-loss-pulse" />
        </div>
        <small>{state.congestionLabel}</small>
      </div>
      <div className="http-streams">
        <StreamRow label="STREAM A" resource={HTTP_STREAM_A} state={state.streamA} progress={state.streamAProgress} lane={lane} />
        <StreamRow label="STREAM B" resource={HTTP_STREAM_B} state={state.streamB} progress={state.streamBProgress} lane={lane} />
      </div>
      <footer><span>DELIVERY</span><strong>{state.deliveryLabel}</strong></footer>
    </motion.section>
  );
}

function StreamRow({ label, resource, state, progress, lane }: { label: string; resource: string; state: string; progress: number; lane: HttpLane }) {
  return (
    <div className={`http-stream-row state-${state}`}>
      <div className="http-stream-label"><span>{label}</span><strong>{resource}</strong><small>{state.toUpperCase()}</small></div>
      <div className="http-progress-track">
        <motion.i className={`stream-fill fill-${lane}`} animate={{ width: `${progress}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        {state === 'blocked' && <b className="http-block-marker">×</b>}
      </div>
      <strong className="http-progress-value">{progress}%</strong>
    </div>
  );
}

export function HttpComparisonTheater({ onExit, onOpenTls }: { onExit: () => void; onOpenTls: () => void }) {
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const rootRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const state = useMemo(() => httpComparisonStateAt(timeMs), [timeMs]);
  const activeEvent = useMemo(() => latestHttpComparisonEvent(timeMs), [timeMs]);
  const activeIndex = httpComparisonEvents.indexOf(activeEvent);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now();
    const startedFrom = timeMs;
    let frameId = 0;
    const tick = (now: number) => {
      const next = Math.min(HTTP_COMPARISON_DURATION_MS, startedFrom + (now - startedAt));
      setTimeMs(next);
      if (next >= HTTP_COMPARISON_DURATION_MS) { setPlaying(false); return; }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduceMotion) return;
    const pulses = root.querySelectorAll('.http-transport-line.has-loss .http-loss-pulse');
    if (pulses.length === 0) return;
    const animation = animate(pulses, { opacity: [0, 1, 0], scale: [0.6, 1.5, 2.2], duration: 900, ease: 'outExpo' });
    return () => { animation.cancel(); };
  }, [activeEvent.id, reduceMotion]);

  const seek = (nextTime: number) => { setPlaying(false); setTimeMs(clampHttpComparisonTime(nextTime)); };
  const togglePlayback = () => {
    if (playing) { setPlaying(false); return; }
    if (timeMs >= HTTP_COMPARISON_DURATION_MS) setTimeMs(0);
    setPlaying(true);
  };

  return (
    <motion.section ref={rootRef} className="http-comparison" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
      <header className="http-heading">
        <div><p className="eyebrow">Lab 03D · Protocol theater</p><h1>SAME LOSS.<br /><span>DIFFERENT DAMAGE.</span></h1></div>
        <div className="http-heading-actions">
          <span className="http-model-badge">CURATED LOSS TRACE · QPACK DYNAMIC DEPENDENCIES DISABLED</span>
          <button type="button" className="lab-mode" onClick={onOpenTls}>TLS ↗</button>
          <button type="button" className="lab-mode" onClick={onExit}>EXIT LAB</button>
        </div>
      </header>

      <div className="http-stage">
        <div className="http-stage-meta">
          <div><span>PHASE</span><strong>{state.phaseLabel}</strong></div>
          <div><span>LOSS TARGET</span><strong>{HTTP_STREAM_A}</strong></div>
          <div><span>CONTROL</span><strong>SYNCHRONIZED A/B TRACE</strong></div>
        </div>
        <div className="http-lanes">
          <Lane lane="h2" state={state.h2} focused={activeEvent.focus === 'both' || activeEvent.focus === 'h2'} />
          <Lane lane="h3" state={state.h3} focused={activeEvent.focus === 'both' || activeEvent.focus === 'h3'} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={activeEvent.id} className="http-event-callout" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
            <span>{formatTime(activeEvent.atMs)}</span><strong>{activeEvent.title}</strong><p>{activeEvent.summary}</p>
            <div className="http-event-compare"><div><b>H2/TCP</b>{activeEvent.h2Label}</div><div><b>H3/QUIC</b>{activeEvent.h3Label}</div></div>
          </motion.div>
        </AnimatePresence>
        <div className="http-caveats">
          <span>WHAT THIS CLAIMS</span>
          <p>HTTP/3 removes cross-stream <b>transport ordering</b> blockage: loss on Stream A does not force Stream B to wait for Stream A’s missing bytes.</p>
          <p>QUIC loss and congestion control still operate at the connection level, so packet loss can reduce overall sending rate. This trace also avoids QPACK dynamic-table dependencies.</p>
        </div>
      </div>

      <aside className="http-inspector">
        <div className="http-inspector-heading"><span>SYNCHRONIZED EVENTS</span><strong>{String(activeIndex + 1).padStart(2,'0')} / {String(httpComparisonEvents.length).padStart(2,'0')}</strong></div>
        <div className="http-event-list">
          {httpComparisonEvents.map((event,index) => {
            const complete = event.atMs <= timeMs; const current = event.id === activeEvent.id;
            return <button key={event.id} type="button" className={`${complete?'complete':''}${current?' current':''}`} onClick={() => seek(event.atMs)}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{event.title}</strong><small>{formatTime(event.atMs)} · focus {event.focus}</small></div></button>;
          })}
        </div>
        <div className="http-event-detail"><span>WHY THIS MATTERS</span><p>{activeEvent.detail}</p></div>
      </aside>

      <footer className="time-machine http-time-machine">
        <div className="time-controls"><button type="button" onClick={togglePlayback}>{playing?'Ⅱ':'▶'}</button><button type="button" onClick={() => seek(0)}>↺</button></div>
        <div className="time-readout"><span>HTTP A/B TIME MACHINE</span><strong>{formatTime(timeMs)}</strong></div>
        <div className="scrubber-wrap"><div className="timeline-markers">{httpComparisonEvents.map(event => <i key={event.id} className={event.atMs <= timeMs?'passed':''} style={{left:`${event.atMs/HTTP_COMPARISON_DURATION_MS*100}%`}} />)}</div><input type="range" min="0" max={HTTP_COMPARISON_DURATION_MS} step="10" value={Math.round(timeMs)} onChange={e=>seek(Number(e.currentTarget.value))} /></div>
        <span className="time-duration">{formatTime(HTTP_COMPARISON_DURATION_MS)}</span>
      </footer>
    </motion.section>
  );
}

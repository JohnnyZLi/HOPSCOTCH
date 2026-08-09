import { animate, stagger } from 'animejs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TLS_HOST,
  clampTlsTime,
  tlsDurationMs,
  tlsEvents,
  tlsLatestEventAtOrBefore,
  tlsStateAt,
  type TlsKeyStage,
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
  const rootRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const state = useMemo(() => tlsStateAt(timeMs), [timeMs]);
  const activeEvent = useMemo(() => tlsLatestEventAtOrBefore(timeMs), [timeMs]);
  const activeIndex = tlsEvents.indexOf(activeEvent);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now();
    const startedFrom = timeMs;
    let frameId = 0;
    const tick = (now: number) => {
      const next = Math.min(tlsDurationMs, startedFrom + (now - startedAt));
      setTimeMs(next);
      if (next >= tlsDurationMs) {
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
    if (!root || reduceMotion) return;
    const animations: Array<ReturnType<typeof animate>> = [];
    const token = root.querySelector<HTMLElement>('.tls-message-token');
    const keyNodes = root.querySelectorAll('.tls-key-stage.active');
    const transcriptItems = root.querySelectorAll('.tls-transcript-item.current');

    if (activeEvent.direction !== 'local' && token) {
      const leftToRight = activeEvent.direction === 'client-to-server';
      animations.push(animate(token, {
        left: leftToRight ? ['12%', '88%'] : ['88%', '12%'],
        opacity: [0, 1, 1, 0.96],
        scale: [0.78, 1.04, 1],
        duration: 820,
        ease: 'inOutSine',
      }));
    }

    if (keyNodes.length > 0) {
      animations.push(animate(keyNodes, {
        opacity: [0.62, 1],
        translateY: [4, 0],
        delay: stagger(32),
        duration: 420,
        ease: 'outExpo',
      }));
    }

    if (transcriptItems.length > 0) {
      animations.push(animate(transcriptItems, {
        opacity: [0.35, 1],
        scale: [0.96, 1],
        duration: 360,
        ease: 'outExpo',
      }));
    }

    const pulse = root.querySelector('.tls-local-pulse');
    if (activeEvent.direction === 'local' && pulse) {
      animations.push(animate(pulse, {
        opacity: [0, 0.8, 0],
        scale: [0.8, 1.35, 1.8],
        duration: 900,
        ease: 'outExpo',
      }));
    }

    return () => {
      animations.forEach((animation) => animation.cancel());
    };
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

  const wireEncrypted = activeEvent.protection === 'handshake' || activeEvent.protection === 'application';
  const protectionLabel = activeEvent.protection === 'cleartext'
    ? 'VISIBLE HANDSHAKE'
    : activeEvent.protection === 'handshake'
      ? 'HANDSHAKE KEYS'
      : activeEvent.protection === 'application'
        ? 'APPLICATION KEYS'
        : 'LOCAL STATE';

  return (
    <motion.section
      ref={rootRef}
      className="tls-theater"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="tls-heading">
        <div>
          <p className="eyebrow">Lab 03C · Protocol theater</p>
          <h1>WATCH TLS<br /><span>DISAPPEAR INTO CIPHERTEXT.</span></h1>
        </div>
        <div className="tls-heading-actions">
          <span className="tls-model-badge">CURATED TLS 1.3 · NO LIVE KEY MATERIAL</span>
          <button type="button" className="lab-mode" onClick={onOpenDns}>DNS ↗</button>
          <button type="button" className="lab-mode" onClick={onOpenTcp}>TCP ↗</button>
          <button type="button" className="lab-mode" onClick={onOpenPacket}>PACKET ↗</button>
          <button type="button" className="lab-mode" onClick={onExit}>EXIT LAB</button>
        </div>
      </header>

      <div className="tls-stage">
        <div className="tls-stage-meta">
          <div><span>PHASE</span><strong>{state.phaseLabel}</strong></div>
          <div><span>PROTECTION</span><strong>{protectionLabel}</strong></div>
          <div><span>ALPN</span><strong>{state.negotiatedAlpn ?? 'OFFERING h2 / http1.1'}</strong></div>
        </div>

        <div className={`tls-wire-stage${wireEncrypted ? ' is-encrypted' : ''}`}>
          <div className="tls-endpoint endpoint-client">
            <span>CLIENT</span>
            <strong>{TLS_HOST}</strong>
            <small>{state.applicationReady ? 'APPLICATION KEYS ACTIVE' : 'HANDSHAKE IN PROGRESS'}</small>
          </div>
          <div className="tls-wire"><i /><b /><i /></div>
          <div className="tls-encryption-boundary">
            <span>WIRE VISIBILITY</span>
            <strong>{wireEncrypted ? 'ENCRYPTED TLS RECORD' : activeEvent.direction === 'local' ? 'NO WIRE MESSAGE' : activeEvent.message}</strong>
            <small>{wireEncrypted ? 'Handshake/application semantic label shown by curated trace' : 'Negotiation remains visible at this point'}</small>
          </div>
          <div className="tls-endpoint endpoint-server">
            <span>SERVER</span>
            <strong>203.0.113.42:443</strong>
            <small>{state.certificateState === 'valid' ? 'IDENTITY VALIDATED' : 'SIMULATED CERTIFICATE'}</small>
          </div>

          <div className={`tls-message-token protection-${activeEvent.protection}${activeEvent.direction === 'local' ? ' is-local' : ''}`}>
            <span>{activeEvent.protection.toUpperCase()}</span>
            <strong>{activeEvent.message}</strong>
            {wireEncrypted && <i aria-hidden="true">◆</i>}
          </div>
          <div className="tls-local-pulse" aria-hidden="true" />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeEvent.id}
            className={`tls-event-callout protection-${activeEvent.protection}`}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={{ duration: 0.24 }}
          >
            <span>{formatTime(activeEvent.atMs)} · {activeEvent.protection}</span>
            <strong>{activeEvent.title}</strong>
            <p>{activeEvent.summary}</p>
            {activeEvent.fields && (
              <div className="tls-field-chips">
                {activeEvent.fields.map((field) => <span key={field.label}><b>{field.label}</b>{field.value}</span>)}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="tls-key-schedule">
          <div className="tls-subhead">
            <div><span>SYMBOLIC KEY SCHEDULE</span><strong>STAGE NAMES, NOT SECRET BYTES</strong></div>
            <small>HKDF structure</small>
          </div>
          <div className="tls-key-chain">
            {keyStages.map((stage, index) => {
              const active = state.activeKeys.includes(stage.id);
              return (
                <div key={stage.id} className={`tls-key-stage${active ? ' active' : ''}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{stage.label}</strong>
                  <small>{stage.note}</small>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tls-transcript-panel">
          <div className="tls-subhead">
            <div><span>HANDSHAKE TRANSCRIPT</span><strong>{state.transcript.length} MESSAGES HASHED</strong></div>
            <small>ordered handshake context</small>
          </div>
          <div className="tls-transcript-list">
            {tlsEvents.filter((event) => event.transcriptLabel).map((event) => {
              const included = state.transcript.includes(event.transcriptLabel!);
              const current = event.id === activeEvent.id;
              return (
                <span key={event.id} className={`tls-transcript-item${included ? ' included' : ''}${current ? ' current' : ''}`}>
                  <i />{event.transcriptLabel}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="tls-inspector" aria-label="TLS causal chain">
        <div className="tls-inspector-heading">
          <span>TLS 1.3 HANDSHAKE</span>
          <strong>{String(activeIndex + 1).padStart(2, '0')} / {String(tlsEvents.length).padStart(2, '0')}</strong>
        </div>
        <div className="tls-event-list">
          {tlsEvents.map((event, index) => {
            const complete = event.atMs <= timeMs;
            const current = event.id === activeEvent.id;
            return (
              <button key={event.id} type="button" className={`${complete ? 'complete' : ''}${current ? ' current' : ''}`} onClick={() => seek(event.atMs)}>
                <span className="tls-event-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="tls-event-copy">
                  <strong>{event.title}</strong>
                  <small>{formatTime(event.atMs)} · {event.message} · {event.protection}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className="tls-negotiated-state">
          <span>NEGOTIATED STATE</span>
          <div><b>VERSION</b><strong>{state.negotiatedVersion ?? 'pending'}</strong></div>
          <div><b>CIPHER</b><strong>{state.negotiatedCipher ?? 'pending'}</strong></div>
          <div><b>GROUP</b><strong>{state.negotiatedGroup ?? 'pending'}</strong></div>
          <div><b>CERT</b><strong>{state.certificateState}</strong></div>
        </div>
        <div className="tls-event-detail"><span>WHY THIS MATTERS</span><p>{activeEvent.detail}</p></div>
      </aside>

      <footer className="time-machine tls-time-machine">
        <div className="time-controls">
          <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause TLS scenario' : 'Play TLS scenario'}>{playing ? 'Ⅱ' : '▶'}</button>
          <button type="button" onClick={() => seek(0)} aria-label="Reset TLS scenario">↺</button>
        </div>
        <div className="time-readout"><span>TLS TIME MACHINE</span><strong>{formatTime(timeMs)}</strong></div>
        <div className="scrubber-wrap">
          <div className="timeline-markers" aria-hidden="true">
            {tlsEvents.map((event) => <i key={event.id} className={event.atMs <= timeMs ? 'passed' : ''} style={{ left: `${(event.atMs / tlsDurationMs) * 100}%` }} />)}
          </div>
          <input type="range" min="0" max={tlsDurationMs} step="10" value={Math.round(timeMs)} onChange={(event) => seek(Number(event.currentTarget.value))} aria-label="TLS scenario time" />
        </div>
        <span className="time-duration">{formatTime(tlsDurationMs)}</span>
      </footer>
    </motion.section>
  );
}

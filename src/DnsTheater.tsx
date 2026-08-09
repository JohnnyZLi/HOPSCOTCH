import { animate } from 'animejs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DNS_ANSWER,
  DNS_QNAME,
  dnsLatestEventAtOrBefore,
  dnsScenario,
  dnsStateAt,
  type DnsActorId,
  type DnsEvent,
  type DnsMode,
} from './protocol/dns';

const actorLabels: Record<DnsActorId, { label: string; sub: string }> = {
  stub: { label: 'STUB', sub: 'CLIENT RESOLVER' },
  recursive: { label: 'RECURSIVE', sub: 'FULL RESOLVER' },
  root: { label: 'ROOT', sub: 'ZONE .' },
  tld: { label: 'TLD', sub: 'ZONE test.' },
  authoritative: { label: 'AUTHORITATIVE', sub: 'ZONE example.test.' },
  cache: { label: 'CACHE', sub: 'RECURSIVE STATE' },
};

function formatTime(timeMs: number): string {
  const seconds = Math.floor(timeMs / 1000).toString().padStart(2, '0');
  const milliseconds = Math.floor(timeMs % 1000).toString().padStart(3, '0');
  return `00:${seconds}.${milliseconds}`;
}

function messageLabel(event: DnsEvent): string {
  if (event.kind === 'query') return `${event.qname} ${event.qtype ?? ''}${event.recursionDesired ? ' · RD=1' : ' · ITERATIVE'}`;
  if (event.kind === 'referral') return `REFERRAL → ${event.delegation}`;
  if (event.kind === 'answer' || event.kind === 'deliver') return `${DNS_QNAME} → ${DNS_ANSWER}`;
  if (event.kind === 'cache.hit') return `CACHE HIT · ${DNS_ANSWER}`;
  if (event.kind === 'cache.store') return `STORE · ${DNS_ANSWER}`;
  return event.title;
}

export function DnsTheater({ onExit }: { onExit: () => void }) {
  const [mode, setMode] = useState<DnsMode>('miss');
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const rootRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const scenario = useMemo(() => dnsScenario(mode), [mode]);
  const state = useMemo(() => dnsStateAt(mode, timeMs), [mode, timeMs]);
  const activeEvent = useMemo(() => dnsLatestEventAtOrBefore(mode, timeMs), [mode, timeMs]);
  const activeIndex = scenario.events.indexOf(activeEvent);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now();
    const startedFrom = timeMs;
    let frameId = 0;
    const tick = (now: number) => {
      const next = Math.min(scenario.durationMs, startedFrom + (now - startedAt));
      setTimeMs(next);
      if (next >= scenario.durationMs) {
        setPlaying(false);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, scenario.durationMs]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduceMotion) return;
    const token = root.querySelector<HTMLElement>('.dns-message-token');
    const from = root.querySelector<HTMLElement>(`[data-dns-actor="${activeEvent.from}"]`);
    const to = root.querySelector<HTMLElement>(`[data-dns-actor="${activeEvent.to}"]`);
    if (!token || !from || !to) return;

    const stage = root.querySelector<HTMLElement>('.dns-map');
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();
    const startX = fromRect.left + fromRect.width / 2 - stageRect.left;
    const startY = fromRect.top + fromRect.height / 2 - stageRect.top;
    const endX = toRect.left + toRect.width / 2 - stageRect.left;
    const endY = toRect.top + toRect.height / 2 - stageRect.top;

    token.style.left = `${startX}px`;
    token.style.top = `${startY}px`;
    token.style.opacity = '0';
    const localCache = activeEvent.from === 'recursive' && activeEvent.to === 'cache';
    const animation = animate(token, {
      translateX: [0, endX - startX],
      translateY: [0, endY - startY],
      opacity: [0, 1, 1, localCache ? 0.8 : 0.96],
      scale: [0.78, 1.04, 1],
      duration: localCache ? 580 : 760,
      ease: 'inOutSine',
    });

    return () => animation.cancel();
  }, [activeEvent.id, reduceMotion]);

  const chooseMode = (nextMode: DnsMode) => {
    setMode(nextMode);
    setTimeMs(0);
    setPlaying(true);
  };

  const seek = (nextTime: number) => {
    setPlaying(false);
    setTimeMs(nextTime);
  };

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (timeMs >= scenario.durationMs) setTimeMs(0);
    setPlaying(true);
  };

  const namespace = ['.', 'test.', 'example.test.', `${DNS_QNAME}.`];
  const activeNamespaceIndex = Math.max(0, namespace.indexOf(state.activeDelegation));
  const upstreamDimmed = mode === 'hit';

  return (
    <motion.section
      ref={rootRef}
      className="dns-theater"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="dns-heading">
        <div>
          <p className="eyebrow">Lab 03B · Protocol theater</p>
          <h1>FOLLOW THE NAME.<br /><span>WATCH DELEGATION DESCEND.</span></h1>
        </div>
        <div className="dns-heading-actions">
          <span className="dns-sim-badge">SIMULATED · RESERVED TEST NAMESPACE</span>
          <div className="dns-mode-toggle" aria-label="DNS cache scenario">
            <button type="button" className={mode === 'miss' ? 'active' : ''} onClick={() => chooseMode('miss')}>CACHE MISS</button>
            <button type="button" className={mode === 'hit' ? 'active' : ''} onClick={() => chooseMode('hit')}>CACHE HIT</button>
          </div>
          <button type="button" className="lab-mode" onClick={onExit}>EXIT LAB</button>
        </div>
      </header>

      <div className="dns-stage">
        <div className="dns-stage-meta">
          <div><span>PHASE</span><strong>{state.phaseLabel}</strong></div>
          <div><span>QNAME</span><strong>{DNS_QNAME}</strong></div>
          <div><span>CACHE TTL</span><strong>{state.cacheTtlSeconds === null ? '—' : `${state.cacheTtlSeconds}s`}</strong></div>
        </div>

        <div className="dns-map">
          <div className="dns-link stub-recursive" aria-hidden="true" />
          <div className="dns-link recursive-root" aria-hidden="true" />
          <div className="dns-link recursive-tld" aria-hidden="true" />
          <div className="dns-link recursive-auth" aria-hidden="true" />
          <div className="dns-link recursive-cache" aria-hidden="true" />

          {(['stub', 'recursive', 'root', 'tld', 'authoritative', 'cache'] as const).map((actor) => (
            <div
              key={actor}
              data-dns-actor={actor}
              className={`dns-actor actor-${actor}${upstreamDimmed && ['root', 'tld', 'authoritative'].includes(actor) ? ' is-idle-upstream' : ''}${activeEvent.from === actor || activeEvent.to === actor ? ' is-current' : ''}`}
            >
              <span>{actorLabels[actor].label}</span>
              <strong>{actorLabels[actor].sub}</strong>
              {actor === 'cache' && (
                <small>{state.cacheState === 'empty' ? 'EMPTY' : `${DNS_ANSWER} · ${state.cacheTtlSeconds ?? 0}s`}</small>
              )}
            </div>
          ))}

          <div className={`dns-message-token severity-${activeEvent.severity}`}>
            <span>{activeEvent.kind.replace('.', ' ')}</span>
            <strong>{messageLabel(activeEvent)}</strong>
          </div>

          <div className="dns-namespace-ladder" aria-label="DNS namespace delegation">
            <span>NAMESPACE</span>
            {namespace.map((label, index) => (
              <motion.div
                key={label}
                className={`${index <= activeNamespaceIndex ? 'resolved' : ''}${index === activeNamespaceIndex ? ' current' : ''}`}
                animate={reduceMotion ? undefined : { x: index === activeNamespaceIndex ? 5 : 0 }}
              >
                <i />
                <strong>{label}</strong>
              </motion.div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${mode}-${activeEvent.id}`}
            className={`dns-event-callout severity-${activeEvent.severity}`}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={{ duration: 0.24 }}
          >
            <span>{formatTime(activeEvent.atMs)} · {activeEvent.kind.replace('.', ' ')}</span>
            <strong>{activeEvent.title}</strong>
            <p>{activeEvent.summary}</p>
          </motion.div>
        </AnimatePresence>

        <div className="dns-cache-panel">
          <div className="dns-subhead">
            <div><span>RECURSIVE CACHE</span><strong>{state.cacheState.toUpperCase()}</strong></div>
            <small>TTL is reusable lifetime, not permanence</small>
          </div>
          <div className={`dns-cache-record state-${state.cacheState}`}>
            <span>A</span>
            <strong>{state.cacheState === 'empty' ? DNS_QNAME : `${DNS_QNAME} → ${DNS_ANSWER}`}</strong>
            <b>{state.cacheTtlSeconds === null ? 'NO ENTRY' : `${state.cacheTtlSeconds}s`}</b>
          </div>
          <div className="dns-path-comparison">
            <div className={mode === 'miss' ? 'active' : ''}><span>MISS</span><strong>STUB → REC → ROOT → TLD → AUTH → REC → STUB</strong></div>
            <div className={mode === 'hit' ? 'active' : ''}><span>HIT</span><strong>STUB → REC/CACHE → STUB</strong></div>
          </div>
        </div>
      </div>

      <aside className="dns-inspector" aria-label="DNS causal chain">
        <div className="dns-inspector-heading">
          <span>{mode === 'miss' ? 'DELEGATION CHAIN' : 'CACHE-HIT CHAIN'}</span>
          <strong>{String(activeIndex + 1).padStart(2, '0')} / {String(scenario.events.length).padStart(2, '0')}</strong>
        </div>
        <div className="dns-event-list">
          {scenario.events.map((event, index) => {
            const complete = event.atMs <= timeMs;
            const current = event.id === activeEvent.id;
            return (
              <button key={event.id} type="button" className={`${complete ? 'complete' : ''}${current ? ' current' : ''}`} onClick={() => seek(event.atMs)}>
                <span className="dns-event-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="dns-event-copy"><strong>{event.title}</strong><small>{formatTime(event.atMs)} · {event.from} → {event.to}</small></span>
              </button>
            );
          })}
        </div>
        <div className="dns-event-detail">
          <span>WHY THIS MATTERS</span>
          <p>{activeEvent.detail}</p>
        </div>
        <div className="dns-recursion-note">
          <span>RECURSION VS ITERATION</span>
          <p>STUB → RECURSIVE requests recursion. The recursive resolver’s ROOT/TLD/AUTH queries are iterative in this scenario.</p>
        </div>
      </aside>

      <footer className="time-machine dns-time-machine">
        <div className="time-controls">
          <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause DNS scenario' : 'Play DNS scenario'}>{playing ? 'Ⅱ' : '▶'}</button>
          <button type="button" onClick={() => seek(0)} aria-label="Reset DNS scenario">↺</button>
        </div>
        <div className="time-readout"><span>DNS TIME MACHINE</span><strong>{formatTime(timeMs)}</strong></div>
        <div className="scrubber-wrap">
          <div className="timeline-markers" aria-hidden="true">
            {scenario.events.map((event) => <i key={event.id} className={event.atMs <= timeMs ? 'passed' : ''} style={{ left: `${(event.atMs / scenario.durationMs) * 100}%` }} />)}
          </div>
          <input type="range" min="0" max={scenario.durationMs} step="10" value={Math.round(timeMs)} onChange={(event) => seek(Number(event.currentTarget.value))} aria-label="DNS scenario time" />
        </div>
        <span className="time-duration">{formatTime(scenario.durationMs)}</span>
      </footer>
    </motion.section>
  );
}

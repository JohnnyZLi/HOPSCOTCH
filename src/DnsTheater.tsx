import { animate } from 'animejs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  VisualDrawerTabs,
  VisualTimeRail,
  VisualWorkspaceShell,
  type VisualDrawerDefinition,
  type VisualDrawerId,
  type VisualTimelineEvent,
  type VisualTimelineMilestone,
} from './VisualWorkspace';
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

function eventTone(event: DnsEvent): VisualTimelineEvent['tone'] {
  if (event.severity === 'warning') return 'warning';
  if (event.severity === 'success') return 'success';
  return 'neutral';
}

export function DnsTheater({ onExit }: { onExit: () => void }) {
  const [mode, setMode] = useState<DnsMode>('miss');
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<VisualDrawerId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
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
    if (!root) return;
    const token = root.querySelector<HTMLElement>('.dns-message-token');
    const from = root.querySelector<HTMLElement>(`[data-dns-actor="${activeEvent.from}"]`);
    const to = root.querySelector<HTMLElement>(`[data-dns-actor="${activeEvent.to}"]`);
    const stage = root.querySelector<HTMLElement>('.dns-map');
    if (!token || !from || !to || !stage) return;

    const stageRect = stage.getBoundingClientRect();
    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();
    const rawStartX = fromRect.left + fromRect.width / 2 - stageRect.left;
    const rawStartY = fromRect.top + fromRect.height / 2 - stageRect.top;
    const rawEndX = toRect.left + toRect.width / 2 - stageRect.left;
    const rawEndY = toRect.top + toRect.height / 2 - stageRect.top;
    const halfWidth = Math.min(stageRect.width / 2 - 4, token.offsetWidth / 2 + 8);
    const halfHeight = Math.min(stageRect.height / 2 - 4, token.offsetHeight / 2 + 8);
    const clampX = (value: number) => Math.max(halfWidth, Math.min(stageRect.width - halfWidth, value));
    const clampY = (value: number) => Math.max(halfHeight, Math.min(stageRect.height - halfHeight, value));
    const startX = clampX(rawStartX);
    const startY = clampY(rawStartY);
    const endX = clampX(rawEndX);
    const endY = clampY(rawEndY);

    if (reduceMotion) {
      token.style.left = `${endX}px`;
      token.style.top = `${endY}px`;
      token.style.opacity = '0';
      return;
    }

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
    return () => { animation.cancel(); };
  }, [activeEvent.id, reduceMotion]);

  const chooseMode = (nextMode: DnsMode) => {
    setMode(nextMode);
    setTimeMs(0);
    setPlaying(true);
    setActiveDrawer(null);
  };

  const seek = (nextTime: number) => {
    setPlaying(false);
    setTimeMs(Math.max(0, Math.min(scenario.durationMs, nextTime)));
  };

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (timeMs >= scenario.durationMs) setTimeMs(0);
    setPlaying(true);
  };

  const openDrawer = (drawer: VisualDrawerId) => {
    if (playing) setPlaying(false);
    setActiveDrawer((current) => current === drawer ? null : drawer);
  };

  const namespace = ['.', 'test.', 'example.test.', `${DNS_QNAME}.`];
  const activeNamespaceIndex = Math.max(0, namespace.indexOf(state.activeDelegation));
  const upstreamDimmed = mode === 'hit';
  const timelineEvents: VisualTimelineEvent[] = scenario.events.map((event) => ({ id: event.id, atMs: event.atMs, label: event.title, tone: eventTone(event) }));
  const timelineMilestones: VisualTimelineMilestone[] = mode === 'miss' ? [
    { id: 'stub', atMs: 0, label: 'STUB' },
    { id: 'root', atMs: 650, label: 'ROOT' },
    { id: 'tld', atMs: 1450, label: 'TLD' },
    { id: 'auth', atMs: 2250, label: 'AUTH' },
    { id: 'cache', atMs: 3050, label: 'CACHE' },
    { id: 'answer', atMs: 3450, label: 'ANSWER' },
  ] : [
    { id: 'stub', atMs: 0, label: 'STUB' },
    { id: 'cache', atMs: 350, label: 'CACHE' },
    { id: 'answer', atMs: 750, label: 'ANSWER' },
  ];

  const inspectContent = <div className="protocol-inspect-drawer dns-protocol-drawer">
    <article className={`protocol-inspect-event severity-${activeEvent.severity}`}><div><span>{formatTime(activeEvent.atMs)}</span><b>SIMULATED · RESERVED NAMESPACE</b></div><h3>{activeEvent.title}</h3><p>{activeEvent.summary}</p><small>{activeEvent.detail}</small></article>
    <section><span>RESOLUTION STATE</span><div className="protocol-fact-grid"><div><small>MODE</small><strong>CACHE {mode.toUpperCase()}</strong></div><div><small>DELEGATION</small><strong>{state.activeDelegation}</strong></div><div><small>CACHE</small><strong>{state.cacheState.toUpperCase()}</strong></div><div><small>TTL</small><strong>{state.cacheTtlSeconds === null ? '—' : `${state.cacheTtlSeconds}s`}</strong></div></div></section>
    <section><span>RECURSION VS ITERATION</span><p>STUB → RECURSIVE requests recursion. The recursive resolver’s ROOT, TLD, and authoritative queries are iterative in this scenario.</p></section>
  </div>;

  const configContent = <div className="protocol-model-drawer dns-config-drawer">
    <section><span>RESOLUTION PATH</span><strong>{mode === 'miss' ? 'WALK THE DELEGATION' : 'REUSE A FRESH ANSWER'}</strong><div className="dns-mode-toggle" role="group" aria-label="DNS cache scenario"><button type="button" className={mode === 'miss' ? 'active' : ''} onClick={() => chooseMode('miss')}>CACHE MISS</button><button type="button" className={mode === 'hit' ? 'active' : ''} onClick={() => chooseMode('hit')}>CACHE HIT</button></div></section>
    <section><span>PATH COMPARISON</span><div className="dns-path-comparison"><div className={mode === 'miss' ? 'active' : ''}><span>MISS</span><strong>STUB → REC → ROOT → TLD → AUTH → REC → STUB</strong></div><div className={mode === 'hit' ? 'active' : ''}><span>HIT</span><strong>STUB → REC/CACHE → STUB</strong></div></div></section>
    <section><span>MODEL BOUNDARY</span><p>The name, answer, referrals, and TTL are deterministic teaching data under the reserved .test namespace. No live resolver query changes this scene.</p></section>
  </div>;

  const eventsContent = <section className="protocol-events-drawer dns-events-drawer"><div className="dns-inspector-heading"><span>{mode === 'miss' ? 'DELEGATION CHAIN' : 'CACHE-HIT CHAIN'}</span><strong>{String(activeIndex + 1).padStart(2, '0')} / {String(scenario.events.length).padStart(2, '0')}</strong></div><div className="dns-event-list">{scenario.events.map((event, index) => { const complete = event.atMs <= timeMs; const current = event.id === activeEvent.id; return <button key={event.id} type="button" className={`${complete ? 'complete' : ''}${current ? ' current' : ''}`} onClick={() => seek(event.atMs)}><span className="dns-event-index">{String(index + 1).padStart(2, '0')}</span><span className="dns-event-copy"><strong>{event.title}</strong><small>{formatTime(event.atMs)} · {event.from} → {event.to}</small></span></button>; })}</div><div className="dns-event-detail"><span>WHY THIS MATTERS</span><p>{activeEvent.detail}</p></div></section>;

  const drawers: VisualDrawerDefinition[] = [
    { id: 'inspect', label: 'Inspect', title: 'Current resolver state', eyebrow: `${state.phase.toUpperCase()} · ${formatTime(timeMs)}`, content: inspectContent },
    { id: 'config', label: 'Configure', title: 'Choose the cache path', eyebrow: 'DETERMINISTIC COMPARISON', content: configContent },
    { id: 'events', label: 'Events', title: 'Delegation event chain', eyebrow: `${scenario.events.length} ${mode.toUpperCase()} EVENTS`, content: eventsContent },
  ];

  return <VisualWorkspaceShell
    className="protocol-visual-workspace dns-visual-workspace"
    entrance={{ eyebrow: 'LAB 03B · DNS THEATER', title: 'FOLLOW THE NAME.', accentTitle: 'DESCEND THE TREE.', subtitle: 'Watch recursion, iteration, delegation, and cache state become one spatial path.' }}
    stageLabel="DNS delegation and cache theater"
    activeDrawer={activeDrawer}
    drawers={drawers}
    onCloseDrawer={() => setActiveDrawer(null)}
    toolbar={<><div className="visual-identity"><i/><span>DNS THEATER</span><strong>{DNS_QNAME} · CACHE {mode.toUpperCase()}</strong></div><div className="protocol-visual-tools"><VisualDrawerTabs active={activeDrawer} items={[{ id: 'inspect', label: 'INSPECT' }, { id: 'config', label: 'CONFIG' }, { id: 'events', label: 'EVENTS', badge: String(scenario.events.length) }]} onSelect={openDrawer}/><button type="button" className="visual-tool-button" onClick={onExit}>EXIT</button></div></>}
    hud={<><div><span>PHASE</span><strong>{state.phaseLabel}</strong></div><div><span>QNAME</span><strong>{DNS_QNAME}</strong></div><div><span>CACHE TTL</span><strong>{state.cacheTtlSeconds === null ? '—' : `${state.cacheTtlSeconds}s`}</strong></div><div><span>PROVENANCE</span><strong>SIMULATED</strong></div></>}
    timeline={<VisualTimeRail timeMs={timeMs} durationMs={scenario.durationMs} playing={playing} label="DNS TIME MACHINE" context={`CACHE ${mode.toUpperCase()} · ${state.cacheState.toUpperCase()}`} events={timelineEvents} milestones={timelineMilestones} onToggle={togglePlayback} onReset={() => seek(0)} onSeek={seek}/>}
  >
    <div ref={rootRef} className={`protocol-cinematic-stage dns-cinematic-stage mode-${mode}`}>
      <div className="protocol-scene-kicker"><span>DNS / NAMESPACE</span><strong>{activeEvent.from.toUpperCase()} → {activeEvent.to.toUpperCase()}</strong></div>
      <div className="dns-map dns-workspace-map">
        <div className="dns-link stub-recursive" aria-hidden="true"/><div className="dns-link recursive-root" aria-hidden="true"/><div className="dns-link recursive-tld" aria-hidden="true"/><div className="dns-link recursive-auth" aria-hidden="true"/><div className="dns-link recursive-cache" aria-hidden="true"/>
        {(['stub', 'recursive', 'root', 'tld', 'authoritative', 'cache'] as const).map((actor) => { const idleUpstream = upstreamDimmed && (actor === 'root' || actor === 'tld' || actor === 'authoritative'); return <div key={actor} data-dns-actor={actor} className={`dns-actor actor-${actor}${idleUpstream ? ' is-idle-upstream' : ''}${activeEvent.from === actor || activeEvent.to === actor ? ' is-current' : ''}`}><span>{actorLabels[actor].label}</span><strong>{actorLabels[actor].sub}</strong>{actor === 'cache' && <small>{state.cacheState === 'empty' ? 'EMPTY' : `${DNS_ANSWER} · ${state.cacheTtlSeconds ?? 0}s`}</small>}</div>; })}
        <div className={`dns-message-token severity-${activeEvent.severity}`}><span>{activeEvent.kind.replace('.', ' ')}</span><strong>{messageLabel(activeEvent)}</strong></div>
        <div className="dns-namespace-ladder" aria-label="DNS namespace delegation"><span>NAMESPACE</span>{namespace.map((label, index) => <motion.div key={label} className={`${index <= activeNamespaceIndex ? 'resolved' : ''}${index === activeNamespaceIndex ? ' current' : ''}`} animate={reduceMotion ? undefined : { x: index === activeNamespaceIndex ? 5 : 0 }}><i/><strong>{label}</strong></motion.div>)}</div>
        <div className="dns-path-readout"><span>{mode === 'miss' ? 'MISS PATH' : 'HIT PATH'}</span><strong>{mode === 'miss' ? 'STUB → RECURSIVE → AUTHORITY' : 'STUB → RECURSIVE CACHE'}</strong></div>
        <AnimatePresence mode="wait" initial={false}><motion.article key={`${mode}-${activeEvent.id}`} className={`protocol-scene-annotation dns-scene-annotation severity-${activeEvent.severity}`} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: reduceMotion ? 0 : 0.24 }}><i aria-hidden="true"/><div><span>{formatTime(activeEvent.atMs)} · {activeEvent.kind.replace('.', ' ')}</span><strong>{activeEvent.title}</strong><p>{activeEvent.summary}</p></div></motion.article></AnimatePresence>
      </div>
    </div>
  </VisualWorkspaceShell>;
}

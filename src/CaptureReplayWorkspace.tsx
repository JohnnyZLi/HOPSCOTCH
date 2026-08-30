import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CaptureParseError } from './capture/bytes.ts';
import { parseCaptureSessionAsync } from './capture/parse-async.ts';
import { endpointDisplay } from './capture/protocol.ts';
import { CaptureSessionIndex } from './capture/session.ts';
import { CAPTURE_LIMITS, type CapturedField, type CapturedFrameEvidence, type CapturedLayer, type SemanticCapturedEvent } from './capture/types.ts';
import { CaptureTrackHPanel } from './CaptureTrackHPanel.tsx';
import { CapturedFrameMechanism } from './CapturedFrameMechanism.tsx';
import { useVisualDrawerFocus, VisualEntranceTransition } from './VisualWorkspace.tsx';
import './CaptureReplayWorkspace.css';
import './CaptureReplayWorkspace.phase4.css';
import './CaptureReplayEditorialLight.css';
import './CaptureReplayMechanismPass.css';

const FLOW_RENDER_LIMIT = 80;
const EVENT_WINDOW_RADIUS = 36;
const BYTE_PAGE_SIZE = 256;
const DENSITY_BIN_COUNT = 96;
const SCRUB_UNITS = 100_000n;

type CaptureWorkspaceMode = 'replay' | 'frame';
type CaptureContextDrawer = 'flows' | 'inspect' | 'analysis' | 'session';

export interface CaptureReplayContext {
  readonly conversationId: string;
  readonly eventId: string | null;
  readonly frameId: string | null;
  readonly timeNanoseconds: bigint;
}

function formatDuration(nanoseconds: bigint): string {
  const milliseconds = Number(nanoseconds) / 1_000_000;
  if (milliseconds < 1) return `${(milliseconds * 1000).toFixed(0)} µs`;
  if (milliseconds < 1000) return `${milliseconds.toFixed(milliseconds < 10 ? 3 : 1)} ms`;
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 3 : 1)} s`;
  return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`;
}

function formatCaptureTime(nanoseconds: bigint): string {
  const milliseconds = nanoseconds / 1_000_000n;
  const subMilliseconds = nanoseconds % 1_000_000n;
  const seconds = milliseconds / 1000n;
  const minutes = seconds / 60n;
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60n).toString().padStart(2, '0')}.${(milliseconds % 1000n).toString().padStart(3, '0')}${subMilliseconds > 0n ? ` +${subMilliseconds}ns` : ''}`;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function protocolTone(protocol: string): string {
  if (protocol === 'DNS') return 'dns';
  if (protocol === 'TCP') return 'tcp';
  if (protocol === 'UDP') return 'udp';
  return 'icmp';
}

function eventTone(event: SemanticCapturedEvent | null): string {
  if (!event) return 'neutral';
  if (event.kind.includes('retransmission') || event.kind.includes('gap') || event.kind.includes('rst')) return 'alert';
  if (event.kind.startsWith('dns')) return 'dns';
  if (event.kind.startsWith('tls')) return 'tls';
  if (event.kind.startsWith('icmp')) return 'icmp';
  return 'tcp';
}

function byteInRanges(offset: number, field: CapturedField | null): boolean {
  return field?.byteRanges.some((candidate) => offset >= candidate.offset && offset < candidate.offset + candidate.length) ?? false;
}

function defaultLayer(frame: CapturedFrameEvidence | null): CapturedLayer | null {
  if (!frame) return null;
  return frame.layers.find((candidate) => ['dns', 'tls', 'tcp', 'udp', 'icmp', 'icmpv6'].includes(candidate.protocol))
    ?? frame.layers.find((candidate) => candidate.protocol === 'ipv4' || candidate.protocol === 'ipv6')
    ?? frame.layers[0]
    ?? null;
}

function densityBins(events: readonly SemanticCapturedEvent[], start: bigint, end: bigint): readonly number[] {
  const bins = Array.from({ length: DENSITY_BIN_COUNT }, () => 0);
  const duration = end > start ? end - start : 1n;
  for (const event of events) {
    const relative = event.relativeTimeNanoseconds <= start ? 0n : event.relativeTimeNanoseconds - start;
    const bin = Number((relative * BigInt(DENSITY_BIN_COUNT - 1)) / duration);
    bins[Math.max(0, Math.min(DENSITY_BIN_COUNT - 1, bin))] += 1;
  }
  return bins;
}

function eventWindow(events: readonly SemanticCapturedEvent[], currentIndex: number): { start: number; end: number; events: readonly SemanticCapturedEvent[] } {
  if (events.length <= (EVENT_WINDOW_RADIUS * 2) + 1) return { start: 0, end: events.length, events };
  const safeIndex = Math.max(0, currentIndex);
  let start = Math.max(0, safeIndex - EVENT_WINDOW_RADIUS);
  let end = Math.min(events.length, start + (EVENT_WINDOW_RADIUS * 2) + 1);
  start = Math.max(0, end - ((EVENT_WINDOW_RADIUS * 2) + 1));
  return { start, end, events: events.slice(start, end) };
}

function EmptyCapture({
  parsing,
  dragging,
  error,
  onChoose,
  onDrop,
  onDragState,
}: {
  parsing: boolean;
  dragging: boolean;
  error: string | null;
  onChoose: () => void;
  onDrop: (file: File) => void;
  onDragState: (dragging: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <section className="capture-empty-state">
      <div
        className={`capture-drop-zone${dragging ? ' is-dragging' : ''}${parsing ? ' is-parsing' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Choose or drop a PCAP or PCAPNG capture"
        onClick={onChoose}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onChoose(); } }}
        onDragEnter={(event) => { event.preventDefault(); onDragState(true); }}
        onDragOver={(event) => { event.preventDefault(); onDragState(true); }}
        onDragLeave={(event) => { if (event.currentTarget === event.target) onDragState(false); }}
        onDrop={(event) => {
          event.preventDefault();
          onDragState(false);
          const file = event.dataTransfer.files[0];
          if (file) onDrop(file);
        }}
      >
        <motion.div
          className="capture-drop-orbit"
          animate={parsing && !reduceMotion ? { rotate: 360 } : undefined}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          aria-hidden="true"
        ><i /><i /><i /></motion.div>
        <div className="capture-ingest-stream" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
        <span>{parsing ? 'PARSING LOCALLY' : 'LOCAL CAPTURE INGEST'}</span>
        <h2>{parsing ? 'READING IMMUTABLE EVIDENCE…' : 'DROP PCAP / PCAPNG'}</h2>
        <p>Choose a capture explicitly. HOPSCOTCH reads it in this browser session and never uploads, scans, sniffs, probes, or silently stores it.</p>
        <button type="button" disabled={parsing}>{parsing ? 'VALIDATING BYTES' : 'CHOOSE CAPTURE'}</button>
        <small>64 MiB · 100,000 FRAME CEILING · WORKER PARSE/INDEX · ETHERNET II</small>
      </div>
      {error && <div className="capture-import-error" role="alert"><strong>IMPORT REJECTED</strong><p>{error}</p></div>}
      <div className="capture-boundary-grid capture-ingest-path">
        <article><i aria-hidden="true"/><span>CONTAINER</span><strong>PCAP + PCAPNG</strong><p>Bounded capture blocks</p></article>
        <b aria-hidden="true"/>
        <article><i aria-hidden="true"/><span>VISIBLE BYTES</span><strong>ETH → IP → TRANSPORT</strong><p>Only parsed evidence advances</p></article>
        <b aria-hidden="true"/>
        <article><i aria-hidden="true"/><span>TRUTH BOUNDARY</span><strong>UNKNOWN STAYS UNKNOWN</strong><p>No invented path or plaintext</p></article>
      </div>
    </section>
  );
}

export function CaptureReplayWorkspace({
  session,
  sourceName,
  initialContext,
  onSessionChange,
  onContextChange,
  onOpenFrame,
  onExit,
}: {
  session: CaptureSessionIndex | null;
  sourceName: string | null;
  initialContext: CaptureReplayContext | null;
  onSessionChange: (session: CaptureSessionIndex | null, sourceName: string | null) => void;
  onContextChange: (context: CaptureReplayContext | null) => void;
  onOpenFrame: (frame: CapturedFrameEvidence, context: CaptureReplayContext) => void;
  onExit: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const eventRailRef = useRef<HTMLDivElement>(null);
  const eventButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const timeRef = useRef(0n);
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flowQuery, setFlowQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('ALL');
  const [conversationId, setConversationId] = useState(initialContext?.conversationId ?? session?.conversations[0]?.id ?? '');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialContext?.eventId ?? null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(initialContext?.frameId ?? null);
  const [timeNanoseconds, setTimeNanoseconds] = useState(initialContext?.timeNanoseconds ?? 0n);
  const [playing, setPlaying] = useState(false);
  const [followFlow, setFollowFlow] = useState(true);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [bytePage, setBytePage] = useState(0);
  const [frameNumberDraft, setFrameNumberDraft] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState<CaptureWorkspaceMode>('replay');
  const [activeDrawer, setActiveDrawer] = useState<CaptureContextDrawer | null>(null);
  const { drawerRef, initialFocusRef } = useVisualDrawerFocus<HTMLElement>(activeDrawer !== null, () => setActiveDrawer(null), activeDrawer);

  const activeConversation = session?.conversation(conversationId) ?? session?.conversations[0] ?? null;
  const activeConversationId = activeConversation?.id ?? '';
  const events = useMemo(() => session?.eventsForConversation(activeConversationId) ?? [], [session, activeConversationId]);
  const indexedSelectedEvent = selectedEventId ? session?.event(selectedEventId) ?? null : null;
  const timelineEvent = session && activeConversation ? session.eventAtOrBefore(activeConversation.id, timeNanoseconds) : null;
  const selectedEventCandidate = indexedSelectedEvent?.conversationId === activeConversationId
    ? indexedSelectedEvent
    : timelineEvent ?? events[0] ?? null;
  const explicitSelectedFrame = selectedFrameId ? session?.frame(selectedFrameId) ?? null : null;
  const explicitFrameConversation = explicitSelectedFrame ? session?.conversationForFrame(explicitSelectedFrame.record.id) ?? null : null;
  const selectedEvent = explicitSelectedFrame && !explicitFrameConversation ? null : selectedEventCandidate;
  const selectedFrame = explicitSelectedFrame
    ?? (selectedEvent ? session?.frame(selectedEvent.primaryFrameId) : null)
    ?? (activeConversation?.frameReferences[0] ? session?.frame(activeConversation.frameReferences[0].frameId) : null)
    ?? null;
  const selectedLayer = selectedFrame?.layers.find((candidate) => candidate.id === selectedLayerId) ?? defaultLayer(selectedFrame);
  const selectedField = selectedLayer?.fields.find((candidate) => candidate.id === selectedFieldId) ?? selectedLayer?.fields[0] ?? null;
  const lineage = selectedEvent ? session?.lineage(selectedEvent.id) ?? null : null;
  const currentEventIndex = selectedEvent ? events.findIndex((event) => event.id === selectedEvent.id) : -1;
  const windowedEvents = useMemo(() => eventWindow(events, currentEventIndex), [events, currentEventIndex]);
  const bins = useMemo(
    () => densityBins(events, activeConversation?.firstObservedNanoseconds ?? 0n, activeConversation?.lastObservedNanoseconds ?? 0n),
    [events, activeConversation],
  );
  const maxBin = Math.max(1, ...bins);

  const filteredConversations = useMemo(() => {
    if (!session) return [];
    const query = flowQuery.trim().toLowerCase();
    return session.conversations.filter((conversation) => {
      if (protocolFilter !== 'ALL' && conversation.protocol !== protocolFilter && conversation.applicationProtocol !== protocolFilter) return false;
      if (!query) return true;
      return `${conversation.id} ${conversation.protocol} ${conversation.applicationProtocol ?? ''} ${endpointDisplay(conversation.endpointA)} ${endpointDisplay(conversation.endpointB)}`.toLowerCase().includes(query);
    });
  }, [session, flowQuery, protocolFilter]);

  const setContext = useCallback((next: CaptureReplayContext, notify = true) => {
    setConversationId(next.conversationId);
    setSelectedEventId(next.eventId);
    setSelectedFrameId(next.frameId);
    setTimeNanoseconds(next.timeNanoseconds);
    timeRef.current = next.timeNanoseconds;
    if (notify) onContextChange(next);
  }, [onContextChange]);

  const chooseEvent = useCallback((event: SemanticCapturedEvent, notify = true) => {
    setContext({
      conversationId: event.conversationId,
      eventId: event.id,
      frameId: event.primaryFrameId,
      timeNanoseconds: event.relativeTimeNanoseconds,
    }, notify);
    const firstReference = event.fieldReferences[0];
    if (firstReference) {
      setSelectedLayerId(firstReference.layerId);
      setSelectedFieldId(firstReference.fieldId);
      const frame = session?.frame(firstReference.frameId);
      const selected = frame?.layers.find((candidate) => candidate.id === firstReference.layerId)?.fields.find((candidate) => candidate.id === firstReference.fieldId);
      if (selected?.byteRanges[0]) setBytePage(Math.floor(selected.byteRanges[0].offset / BYTE_PAGE_SIZE));
    }
  }, [session, setContext]);

  const chooseConversation = useCallback((nextConversationId: string) => {
    if (!session) return;
    const nextConversation = session.conversation(nextConversationId);
    if (!nextConversation) return;
    const nextEvents = session.eventsForConversation(nextConversation.id);
    const event = nextEvents[0] ?? null;
    const frameId = event?.primaryFrameId ?? nextConversation.frameReferences[0]?.frameId ?? null;
    const time = event?.relativeTimeNanoseconds ?? nextConversation.firstObservedNanoseconds;
    setPlaying(false);
    setSelectedLayerId(null);
    setSelectedFieldId(null);
    setBytePage(0);
    setContext({ conversationId: nextConversation.id, eventId: event?.id ?? null, frameId, timeNanoseconds: time });
  }, [session, setContext]);

  const loadFile = useCallback(async (file: File) => {
    setDragging(false);
    setParsing(true);
    setError(null);
    try {
      if (!/\.(pcap|pcapng)$/i.test(file.name)) throw new CaptureParseError('UNSUPPORTED_FORMAT', 'Choose a file ending in .pcap or .pcapng.');
      if (file.size > CAPTURE_LIMITS.maxCaptureBytes) throw new CaptureParseError('CAPTURE_TOO_LARGE', `${file.name} is ${formatBytes(file.size)}; this slice accepts up to ${formatBytes(CAPTURE_LIMITS.maxCaptureBytes)}.`);
      const buffer = await file.arrayBuffer();
      const nextSession = await parseCaptureSessionAsync(buffer);
      const conversation = nextSession.conversations[0] ?? null;
      const event = conversation ? nextSession.eventsForConversation(conversation.id)[0] ?? null : null;
      const frameId = event?.primaryFrameId ?? conversation?.frameReferences[0]?.frameId ?? nextSession.frames[0]?.record.id ?? null;
      const nextContext = conversation ? {
        conversationId: conversation.id,
        eventId: event?.id ?? null,
        frameId,
        timeNanoseconds: event?.relativeTimeNanoseconds ?? conversation.firstObservedNanoseconds,
      } : null;
      onSessionChange(nextSession, file.name);
      onContextChange(nextContext);
      setConversationId(nextContext?.conversationId ?? '');
      setSelectedEventId(nextContext?.eventId ?? null);
      setSelectedFrameId(nextContext?.frameId ?? frameId);
      setTimeNanoseconds(nextContext?.timeNanoseconds ?? 0n);
      timeRef.current = nextContext?.timeNanoseconds ?? 0n;
      setSelectedLayerId(null);
      setSelectedFieldId(null);
      setBytePage(0);
      setPlaying(false);
      setWorkspaceMode('replay');
      setActiveDrawer(null);
      requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true }));
    } catch (cause) {
      const message = cause instanceof CaptureParseError
        ? `${cause.code.replaceAll('_', ' ')} · ${cause.message}`
        : `The capture could not be parsed safely: ${cause instanceof Error ? cause.message : String(cause)}`;
      setError(`${message}${session ? ' The previous valid capture remains active.' : ''}`);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onContextChange, onSessionChange, session]);

  useEffect(() => {
    if (!session || activeConversation) return;
    const first = session.conversations[0];
    if (first) chooseConversation(first.id);
  }, [session, activeConversation, chooseConversation]);

  useEffect(() => {
    timeRef.current = timeNanoseconds;
  }, [timeNanoseconds]);

  useEffect(() => {
    if (!selectedFrame) return;
    setFrameNumberDraft(String(selectedFrame.record.number));
    const fallback = defaultLayer(selectedFrame);
    if (!selectedLayerId || !selectedFrame.layers.some((candidate) => candidate.id === selectedLayerId)) {
      setSelectedLayerId(fallback?.id ?? null);
      setSelectedFieldId(fallback?.fields[0]?.id ?? null);
    }
  }, [selectedFrame, selectedLayerId]);

  useEffect(() => {
    if (!playing || !session || !activeConversation) return;
    const startWall = performance.now();
    const startCapture = timeRef.current >= activeConversation.lastObservedNanoseconds
      ? activeConversation.firstObservedNanoseconds
      : timeRef.current;
    let frameHandle = 0;
    let lastEventId = session.eventAtOrBefore(activeConversation.id, startCapture)?.id ?? null;
    const tick = (now: number) => {
      const elapsedNanoseconds = BigInt(Math.max(0, Math.floor((now - startWall) * 1_000_000)));
      const nextTime = startCapture + elapsedNanoseconds;
      const clamped = nextTime >= activeConversation.lastObservedNanoseconds ? activeConversation.lastObservedNanoseconds : nextTime;
      timeRef.current = clamped;
      setTimeNanoseconds(clamped);
      const nextEvent = session.eventAtOrBefore(activeConversation.id, clamped);
      if (nextEvent && nextEvent.id !== lastEventId) {
        lastEventId = nextEvent.id;
        setSelectedEventId(nextEvent.id);
        setSelectedFrameId(nextEvent.primaryFrameId);
        onContextChange({ conversationId: activeConversation.id, eventId: nextEvent.id, frameId: nextEvent.primaryFrameId, timeNanoseconds: nextEvent.relativeTimeNanoseconds });
      }
      if (nextTime >= activeConversation.lastObservedNanoseconds) { setPlaying(false); return; }
      frameHandle = requestAnimationFrame(tick);
    };
    frameHandle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameHandle);
  }, [playing, session, activeConversation, onContextChange]);

  useEffect(() => {
    if (!followFlow || !selectedEvent || !eventRailRef.current) return;
    const button = eventButtonRefs.current.get(selectedEvent.id);
    const rail = eventRailRef.current;
    if (!button) return;
    const top = button.offsetTop - rail.offsetTop;
    const bottom = top + button.offsetHeight;
    if (top < rail.scrollTop) rail.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    else if (bottom > rail.scrollTop + rail.clientHeight) rail.scrollTo({ top: bottom - rail.clientHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [selectedEvent, followFlow, reduceMotion, windowedEvents]);

  const seekEventDelta = (delta: number) => {
    if (events.length === 0) return;
    const nextIndex = Math.max(0, Math.min(events.length - 1, (currentEventIndex < 0 ? 0 : currentEventIndex) + delta));
    const event = events[nextIndex];
    if (event) { setPlaying(false); chooseEvent(event); }
  };

  const chooseFrame = (frameId: string) => {
    if (!session) return;
    const frame = session.frame(frameId);
    if (!frame) return;
    const owner = session.conversationForFrame(frameId);
    const ownerEvents = owner ? session.eventsForConversation(owner.id) : [];
    const event = ownerEvents.find((candidate) => candidate.primaryFrameId === frameId || candidate.supportingFrameIds.includes(frameId)) ?? null;
    setPlaying(false);
    setSelectedLayerId(null);
    setSelectedFieldId(null);
    setBytePage(0);
    setContext({ conversationId: owner?.id ?? activeConversation?.id ?? '', eventId: event?.id ?? null, frameId, timeNanoseconds: frame.record.relativeTimeNanoseconds });
  };

  const stepFrame = (delta: number) => {
    if (!session || !selectedFrame) return;
    const owner = session.conversationForFrame(selectedFrame.record.id);
    const index = owner?.frameReferences.findIndex((entry) => entry.frameId === selectedFrame.record.id) ?? -1;
    const nextFrameId = owner && index >= 0
      ? owner.frameReferences[Math.max(0, Math.min(owner.frameReferences.length - 1, index + delta))]?.frameId ?? null
      : session.frameByNumber(selectedFrame.record.number + delta)?.record.id ?? null;
    if (nextFrameId) chooseFrame(nextFrameId);
  };

  const selectLineageField = (lineageFrameId: string, layerId: string, fieldId: string, offset: number) => {
    setSelectedFrameId(lineageFrameId);
    setSelectedLayerId(layerId);
    setSelectedFieldId(fieldId);
    setBytePage(Math.floor(offset / BYTE_PAGE_SIZE));
  };

  const totalBytePages = selectedFrame ? Math.max(1, Math.ceil(selectedFrame.record.bytes.length / BYTE_PAGE_SIZE)) : 1;
  const safeBytePage = Math.max(0, Math.min(totalBytePages - 1, bytePage));
  const byteStart = safeBytePage * BYTE_PAGE_SIZE;
  const byteEnd = selectedFrame ? Math.min(selectedFrame.record.bytes.length, byteStart + BYTE_PAGE_SIZE) : 0;
  const visibleBytes = selectedFrame ? selectedFrame.record.bytes.copy(byteStart, byteEnd - byteStart) : new Uint8Array();
  const activePosition = activeConversation
    ? Number(((timeNanoseconds - activeConversation.firstObservedNanoseconds) * 10000n) / (activeConversation.durationNanoseconds || 1n)) / 100
    : 0;
  const scrubValue = activeConversation
    ? Math.max(0, Math.min(Number(SCRUB_UNITS), Number(((timeNanoseconds - activeConversation.firstObservedNanoseconds) * SCRUB_UNITS) / (activeConversation.durationNanoseconds || 1n))))
    : 0;

  const openContextDrawer = (drawer: CaptureContextDrawer) => {
    setPlaying(false);
    setActiveDrawer((current) => current === drawer ? null : drawer);
  };

  const selectWorkspaceMode = (mode: CaptureWorkspaceMode) => {
    setPlaying(false);
    setActiveDrawer(null);
    setWorkspaceMode(mode);
  };

  const clearSession = () => {
    setPlaying(false);
    setActiveDrawer(null);
    setWorkspaceMode('replay');
    setError(null);
    onContextChange(null);
    onSessionChange(null, null);
  };

  const handleWorkspaceKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches('input, textarea, select, button')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); workspaceMode === 'frame' ? stepFrame(-1) : seekEventDelta(-1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); workspaceMode === 'frame' ? stepFrame(1) : seekEventDelta(1); }
    else if (event.key === ' ' && workspaceMode === 'replay') { event.preventDefault(); setPlaying((current) => !current); }
    else if (event.key === 'Home' && events[0]) { event.preventDefault(); setPlaying(false); chooseEvent(events[0]); }
  };

  return (
    <motion.section
      ref={rootRef}
      className="capture-replay"
      data-capture-loaded={session ? 'true' : 'false'}
      data-follow-flow={followFlow ? 'true' : 'false'}
      data-capture-mode={workspaceMode}
      data-context-drawer={activeDrawer ?? 'none'}
      tabIndex={-1}
      onKeyDown={handleWorkspaceKey}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.992 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
    >
      <input
        ref={fileInputRef}
        className="capture-file-input"
        type="file"
        accept=".pcap,.pcapng,application/vnd.tcpdump.pcap"
        onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void loadFile(file); }}
      />
      <header className="capture-heading">
        <div className="visual-identity"><span>CAPTURE EVIDENCE</span><strong>REPLAY</strong></div>
        <span className="capture-local-badge">CAPTURED · LOCAL ONLY · SESSION MEMORY</span>
        <div className="capture-heading-actions">
          {session && <button type="button" className={activeDrawer === 'session' ? 'capture-action capture-session active' : 'capture-action capture-session'} aria-pressed={activeDrawer === 'session'} onClick={() => openContextDrawer('session')}>Session</button>}
          {session && <div className="capture-mode-switch" role="group" aria-label="Capture workspace mode">
            <button type="button" className={workspaceMode === 'replay' ? 'active' : ''} aria-pressed={workspaceMode === 'replay'} onClick={() => selectWorkspaceMode('replay')}>Replay</button>
            <button type="button" className={workspaceMode === 'frame' ? 'active' : ''} aria-pressed={workspaceMode === 'frame'} onClick={() => selectWorkspaceMode('frame')}>Frame specimen</button>
          </div>}
          {session && <button type="button" className={activeDrawer === 'flows' ? 'capture-action active' : 'capture-action'} aria-pressed={activeDrawer === 'flows'} onClick={() => openContextDrawer('flows')}>Flows <span>{session.metadata.conversationCount}</span></button>}
          {session && workspaceMode === 'replay' && <button type="button" className={activeDrawer === 'inspect' ? 'capture-action active' : 'capture-action'} aria-pressed={activeDrawer === 'inspect'} onClick={() => openContextDrawer('inspect')}>Frame details</button>}
          {session && <button type="button" className={activeDrawer === 'analysis' ? 'capture-action active' : 'capture-action'} aria-pressed={activeDrawer === 'analysis'} onClick={() => openContextDrawer('analysis')}>Analysis</button>}
          <button type="button" className="capture-action capture-replace" onClick={() => fileInputRef.current?.click()} disabled={parsing}>{session ? 'Replace capture' : 'Import capture'}</button>
          {session && <button type="button" className="capture-action capture-clear" onClick={clearSession}>Clear</button>}
          <button type="button" className="lab-mode capture-exit" onClick={onExit}>Exit</button>
        </div>
      </header>
      <VisualEntranceTransition entrance={{ eyebrow: 'Capture evidence · immutable local session', title: 'REPLAY THE EVIDENCE.', accentTitle: 'DESCEND TO THE BYTES.', subtitle: 'Conversation motion and exact frame inspection remain capture-bounded.' }} />

      {!session ? (
        <EmptyCapture parsing={parsing} dragging={dragging} error={error} onChoose={() => fileInputRef.current?.click()} onDrop={(file) => void loadFile(file)} onDragState={setDragging} />
      ) : (
        <>
          <section className="capture-summary" aria-label="Capture summary">
            <div className="capture-summary-source"><span>ACTIVE CAPTURE</span><strong title={sourceName ?? undefined}>{sourceName ?? 'Unnamed local capture'}</strong><small>{session.metadata.format.toUpperCase()} · {formatBytes(session.metadata.byteLength)} · {session.metadata.interfaceCount} interface{session.metadata.interfaceCount === 1 ? '' : 's'}</small></div>
            <div><span>CAPTURED EVIDENCE</span><strong>{session.metadata.frameCount.toLocaleString()} FRAMES · {session.metadata.conversationCount.toLocaleString()} FLOWS</strong><small>{session.metadata.eventCount.toLocaleString()} events · {session.metadata.truncatedFrameCount} truncated · {session.metadata.unsupportedFrameCount} unsupported</small></div>
            <div><span>CAPTURE SPAN</span><strong>{formatDuration(session.metadata.durationNanoseconds)}</strong><small>{session.metadata.firstTimestamp?.iso8601 ?? 'timestamp unavailable'}</small></div>
            <div className="capture-noise"><span>PROVENANCE</span><strong>CAPTURED + INFERRED</strong><small>never simulated · never measured</small></div>
          </section>
          {error && <div className="capture-import-error capture-import-error-loaded" role="alert"><strong>REPLACEMENT REJECTED</strong><p>{error}</p></div>}
          {session.warnings.length > 0 && (
            <details className="capture-warnings"><summary>{session.warnings.length} capture limitation{session.warnings.length === 1 ? '' : 's'} / decoder note{session.warnings.length === 1 ? '' : 's'}</summary><ul>{session.warnings.slice(0, 20).map((warning) => <li key={warning}>{warning}</li>)}</ul></details>
          )}

          <div className="capture-workspace-grid">
            <AnimatePresence>
              {activeDrawer && <motion.button
                type="button"
                className="capture-context-backdrop"
                aria-label={`Close ${activeDrawer} drawer`}
                onClick={() => setActiveDrawer(null)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />}
            </AnimatePresence>
            <aside
              ref={activeDrawer === 'flows' ? drawerRef : undefined}
              className={`capture-flow-browser${activeDrawer === 'flows' ? ' is-open' : ''}`}
              role={activeDrawer === 'flows' ? 'dialog' : undefined}
              aria-modal={activeDrawer === 'flows' ? 'true' : undefined}
              aria-labelledby="capture-flow-drawer-title"
              aria-hidden={activeDrawer !== 'flows'}
              inert={activeDrawer !== 'flows'}
            >
              <header><div><span>CONVERSATIONS</span><strong id="capture-flow-drawer-title">{filteredConversations.length.toLocaleString()} MATCH</strong></div><small>DETERMINISTIC A / B</small><button ref={activeDrawer === 'flows' ? initialFocusRef : undefined} type="button" className="capture-drawer-close" onClick={() => setActiveDrawer(null)} aria-label="Close conversations">×</button></header>
              <div className="capture-flow-tools">
                <input value={flowQuery} onChange={(event) => setFlowQuery(event.currentTarget.value)} placeholder="Endpoint, port, protocol…" aria-label="Filter capture conversations" />
                <select value={protocolFilter} onChange={(event) => setProtocolFilter(event.currentTarget.value)} aria-label="Filter by protocol">
                  {['ALL', 'TCP', 'UDP', 'DNS', 'TLS', 'ICMP', 'ICMPV6'].map((value) => <option value={value} key={value}>{value}</option>)}
                </select>
              </div>
              <div className="capture-flow-list" role="listbox" aria-label="Captured conversations">
                {filteredConversations.slice(0, FLOW_RENDER_LIMIT).map((conversation) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={conversation.id === activeConversation?.id}
                    className={conversation.id === activeConversation?.id ? 'active' : ''}
                    data-protocol={protocolTone(conversation.protocol)}
                    key={conversation.id}
                    onClick={() => { chooseConversation(conversation.id); setActiveDrawer(null); }}
                  >
                    <span className="capture-flow-protocol">{conversation.applicationProtocol ?? conversation.protocol}</span>
                    <strong>{endpointDisplay(conversation.endpointA)}</strong>
                    <i aria-hidden="true">↕</i>
                    <strong>{endpointDisplay(conversation.endpointB)}</strong>
                    <small>{conversation.frameCount} frames · {formatBytes(conversation.capturedBytes)} · {formatDuration(conversation.durationNanoseconds)}</small>
                    <em>{conversation.captureStartedMidConversation ? 'STARTED MID-CONVERSATION' : conversation.oneDirectionOnly ? 'ONE DIRECTION OBSERVED' : 'BIDIRECTIONAL EVIDENCE'}</em>
                  </button>
                ))}
                {filteredConversations.length === 0 && <div className="capture-list-empty">NO CONVERSATIONS MATCH. Captured frames remain available; filters create no evidence.</div>}
              </div>
              {filteredConversations.length > FLOW_RENDER_LIMIT && <p className="capture-window-note">Showing the first {FLOW_RENDER_LIMIT} deterministic matches of {filteredConversations.length.toLocaleString()}. Refine the filter to inspect later flows; none were discarded.</p>}
            </aside>

            <main className="capture-cinematic-stage">
              {activeConversation ? (
                <>
                  <header className="capture-flow-heading">
                    <div><span>{activeConversation.applicationProtocol ?? activeConversation.protocol} CONVERSATION</span><strong>{activeConversation.id}</strong></div>
                    <div className="capture-quality-flags">
                      {activeConversation.captureStartedMidConversation && <span>CAPTURE STARTED MID-CONVERSATION</span>}
                      {activeConversation.oneDirectionOnly && <span>ONE DIRECTION OBSERVED</span>}
                      {activeConversation.truncatedFrameCount > 0 && <span>{activeConversation.truncatedFrameCount} TRUNCATED</span>}
                      {!activeConversation.captureStartedMidConversation && !activeConversation.oneDirectionOnly && activeConversation.truncatedFrameCount === 0 && <span className="good">BIDIRECTIONAL CAPTURE EVIDENCE</span>}
                    </div>
                  </header>

                  <section className="capture-exchange" data-tone={eventTone(selectedEvent)}>
                    <div className="capture-endpoint endpoint-a"><span>ENDPOINT A</span><strong>{endpointDisplay(activeConversation.endpointA)}</strong><small>{activeConversation.observedInitiator === 'A' ? 'OBSERVED INITIATOR' : `${activeConversation.directionCounts.A_TO_B} → frames`}</small></div>
                    <div className="capture-exchange-track" aria-label="Conceptual captured exchange between normalized endpoints">
                      <i className="capture-track-line" />
                      <div className="capture-time-pins">{bins.map((count, index) => <i key={index} style={{ height: `${Math.max(4, (count / maxBin) * 100)}%`, opacity: count === 0 ? 0.12 : 0.35 + (count / maxBin) * 0.65 }} />)}</div>
                      {selectedFrame && <motion.div
                        key={selectedEvent?.id ?? selectedFrame.record.id}
                        className="capture-packet-mechanism"
                        initial={reduceMotion || !selectedEvent ? { left: '50%', opacity: 1 } : { left: `${selectedEvent.direction === 'B_TO_A' ? 84 : 16}%`, opacity: 0.18, scale: 0.72 }}
                        animate={{ left: `${selectedEvent ? (selectedEvent.direction === 'B_TO_A' ? 16 : 84) : 50}%`, opacity: 1, scale: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.72, ease: [0.16, 1, 0.3, 1] }}
                      ><div className="capture-packet-mechanism-anchor"><CapturedFrameMechanism frame={selectedFrame} event={selectedEvent} mode="replay" playing={playing} activeLayer={selectedLayer} activeField={selectedField} handoffId={workspaceMode === 'replay' ? `captured-frame-${selectedFrame.record.id}` : undefined} /></div></motion.div>}
                      <div className="capture-playhead" style={{ left: `${Math.max(0, Math.min(100, activePosition))}%` }}><i /></div>
                    </div>
                    <div className="capture-endpoint endpoint-b"><span>ENDPOINT B</span><strong>{endpointDisplay(activeConversation.endpointB)}</strong><small>{activeConversation.observedInitiator === 'B' ? 'OBSERVED INITIATOR' : `${activeConversation.directionCounts.B_TO_A} ← frames`}</small></div>
                  </section>

                  <AnimatePresence mode="wait" initial={false}>
                    <motion.article
                      key={selectedEvent?.id ?? 'no-event'}
                      className="capture-current-event"
                      data-tone={eventTone(selectedEvent)}
                      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22 }}
                    >
                      <div><span>{selectedEvent ? formatCaptureTime(selectedEvent.relativeTimeNanoseconds) : 'NO SEMANTIC EVENT'}</span><strong>{selectedEvent?.title ?? 'NO RECOGNIZED EVENT IN THIS FLOW'}</strong></div>
                      <span className={`capture-provenance provenance-${selectedEvent?.provenance.toLowerCase() ?? 'captured'}`}>{selectedEvent?.provenance ?? 'CAPTURED'}</span>
                      <p>{selectedEvent?.summary ?? 'The captured frames remain inspectable even when no higher-level event is recognized.'}</p>
                      {selectedEvent?.uncertainty && <small>{selectedEvent.uncertainty}</small>}
                    </motion.article>
                  </AnimatePresence>

                  <section className="capture-event-rail-wrap">
                    <header><div><span>SEMANTIC EVENT RAIL</span><strong>{events.length.toLocaleString()} CAPTURE-BOUNDED EVENTS</strong></div><small>Showing {windowedEvents.start + 1}–{windowedEvents.end} · bounded around focus</small></header>
                    <div className="capture-event-rail" ref={eventRailRef}>
                      {windowedEvents.events.map((event, index) => (
                        <button
                          ref={(node) => { if (node) eventButtonRefs.current.set(event.id, node); else eventButtonRefs.current.delete(event.id); }}
                          type="button"
                          className={event.id === selectedEvent?.id ? 'active' : ''}
                          data-tone={eventTone(event)}
                          key={event.id}
                          onClick={() => { setPlaying(false); chooseEvent(event); }}
                        >
                          <span>{String(windowedEvents.start + index + 1).padStart(3, '0')}</span>
                          <div><strong>{event.title}</strong><small>{formatCaptureTime(event.relativeTimeNanoseconds)} · FRAME {session.frame(event.primaryFrameId)?.record.number ?? '—'}</small></div>
                          <em>{event.provenance}</em>
                        </button>
                      ))}
                    </div>
                  </section>

                  <footer className="capture-time-machine">
                    <div className="capture-time-controls">
                      <button type="button" onClick={() => setPlaying((current) => !current)} aria-label={playing ? 'Pause capture replay' : 'Play capture replay'}>{playing ? 'Ⅱ' : '▶'}</button>
                      <button type="button" onClick={() => seekEventDelta(-1)} aria-label="Previous semantic event">←</button>
                      <button type="button" onClick={() => seekEventDelta(1)} aria-label="Next semantic event">→</button>
                      <button type="button" onClick={() => { const first = events[0]; if (first) { setPlaying(false); chooseEvent(first); } }} aria-label="Reset capture replay">↺</button>
                    </div>
                    <div className="capture-time-readout"><span>CAPTURE TIME</span><strong>{formatCaptureTime(timeNanoseconds)}</strong></div>
                    <div className="capture-scrubber"><input type="range" min="0" max={Number(SCRUB_UNITS)} step="1" value={scrubValue} onChange={(event) => { setPlaying(false); const units = BigInt(event.currentTarget.value); const next = activeConversation.firstObservedNanoseconds + ((activeConversation.durationNanoseconds * units) / SCRUB_UNITS); const nextEvent = session.eventAtOrBefore(activeConversation.id, next); setTimeNanoseconds(next); timeRef.current = next; setSelectedEventId(nextEvent?.id ?? null); setSelectedFrameId(nextEvent?.primaryFrameId ?? activeConversation.frameReferences[0]?.frameId ?? null); onContextChange({ conversationId: activeConversation.id, eventId: nextEvent?.id ?? null, frameId: nextEvent?.primaryFrameId ?? null, timeNanoseconds: next }); }} aria-label="Capture replay time" /></div>
                    <button type="button" className={followFlow ? 'capture-follow active' : 'capture-follow'} onClick={() => setFollowFlow((current) => !current)}>FOLLOW FLOW {followFlow ? 'ON' : 'OFF'}</button>
                  </footer>
                </>
              ) : <div className="capture-no-flows"><strong>NO RECOGNIZED CONVERSATIONS</strong><p>Frames are retained exactly, but this capture contains no supported IP transport tuple. Unsupported evidence was not turned into a fictional flow.</p></div>}
            </main>

            <aside
              ref={activeDrawer === 'inspect' ? drawerRef : undefined}
              className={`capture-evidence-inspector${activeDrawer === 'inspect' ? ' is-open' : ''}${workspaceMode === 'frame' ? ' is-frame-stage' : ''}`}
              role={activeDrawer === 'inspect' ? 'dialog' : undefined}
              aria-modal={activeDrawer === 'inspect' ? 'true' : undefined}
              aria-labelledby="capture-frame-inspector-title"
              aria-hidden={activeDrawer !== null ? activeDrawer !== 'inspect' : workspaceMode !== 'frame'}
              inert={activeDrawer !== null ? activeDrawer !== 'inspect' : workspaceMode !== 'frame'}
            >
              {workspaceMode === 'frame' && <div className="capture-specimen-mode-banner"><span>FRAME SPECIMEN</span><strong>EXACT CAPTURED STRUCTURE + BYTES</strong><small>← / → steps captured frames · selection changes focus only</small></div>}
              {selectedFrame ? (
                <>
                  <header className="capture-frame-heading">
                    <div><span>SOURCE FRAME</span><strong id="capture-frame-inspector-title">FRAME {selectedFrame.record.number}</strong><small>{formatCaptureTime(selectedFrame.record.relativeTimeNanoseconds)} · {selectedFrame.record.interfaceId}</small></div>
                    <div className="capture-frame-heading-actions"><span className="capture-provenance provenance-captured">CAPTURED</span>{activeDrawer === 'inspect' && <button ref={initialFocusRef} type="button" className="capture-drawer-close" onClick={() => setActiveDrawer(null)} aria-label="Close frame details">×</button>}</div>
                  </header>
                  <CapturedFrameMechanism
                    frame={selectedFrame}
                    event={selectedEvent}
                    mode="frame"
                    activeLayer={selectedLayer}
                    activeField={selectedField}
                    handoffId={workspaceMode === 'frame' ? `captured-frame-${selectedFrame.record.id}` : undefined}
                    onSelectLayer={(capturedLayer) => {
                      setSelectedLayerId(capturedLayer.id);
                      setSelectedFieldId(capturedLayer.fields[0]?.id ?? null);
                      if (capturedLayer.byteRange.length > 0) setBytePage(Math.floor(capturedLayer.byteRange.offset / BYTE_PAGE_SIZE));
                    }}
                  />
                  <div className="capture-frame-nav">
                    <button type="button" onClick={() => stepFrame(-1)} aria-label="Previous frame in conversation">← FRAME</button>
                    <label><span>GO TO #</span><input type="number" min="1" max={session.metadata.frameCount} value={frameNumberDraft} onChange={(event) => setFrameNumberDraft(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') { const target = session.frameByNumber(Number(frameNumberDraft)); if (target) chooseFrame(target.record.id); } }} onBlur={() => { const target = session.frameByNumber(Number(frameNumberDraft)); if (target) chooseFrame(target.record.id); else setFrameNumberDraft(String(selectedFrame.record.number)); }} /></label>
                    <button type="button" onClick={() => stepFrame(1)} aria-label="Next frame in conversation">FRAME →</button>
                  </div>
                  <div className="capture-frame-facts">
                    <div><span>CAPTURED / WIRE</span><strong>{selectedFrame.record.capturedLength} / {selectedFrame.record.originalLength} B</strong></div>
                    <div><span>STATUS</span><strong>{selectedFrame.record.truncated ? 'TRUNCATED' : selectedFrame.issues.length > 0 ? 'BOUNDED NOTES' : 'COMPLETE BYTES'}</strong></div>
                  </div>

                  {lineage && lineage.fields.length > 0 && (
                    <section className="capture-lineage">
                      <header><span>WHY HOPSCOTCH SAID THIS</span><strong>EVENT → FRAME → FIELD → BYTES</strong></header>
                      <div>{lineage.fields.map((lineageField) => (
                        <button type="button" key={`${lineageField.frameId}:${lineageField.fieldId}`} onClick={() => selectLineageField(lineageField.frameId, lineageField.layerId, lineageField.fieldId, lineageField.byteRanges[0]?.offset ?? 0)}>
                          <span>FRAME {lineageField.frameNumber} · {lineageField.layerLabel}</span><strong>{lineageField.fieldLabel}</strong><small>{lineageField.bytes.join(' · ')}</small>
                        </button>
                      ))}</div>
                    </section>
                  )}

                  <section className="capture-protocol-stack">
                    <header><span>PROTOCOL LAYERS</span><small>READ ONLY</small></header>
                    <div>{selectedFrame.layers.map((capturedLayer) => (
                      <button type="button" className={capturedLayer.id === selectedLayer?.id ? 'active' : ''} data-protocol={capturedLayer.protocol} key={capturedLayer.id} onClick={() => { setSelectedLayerId(capturedLayer.id); setSelectedFieldId(capturedLayer.fields[0]?.id ?? null); if (capturedLayer.byteRange.length > 0) setBytePage(Math.floor(capturedLayer.byteRange.offset / BYTE_PAGE_SIZE)); }}>
                        <span>{capturedLayer.protocol.toUpperCase()}</span><strong>{capturedLayer.label}</strong><small>{capturedLayer.byteRange.offset}–{capturedLayer.byteRange.offset + Math.max(0, capturedLayer.byteRange.length - 1)}</small>
                      </button>
                    ))}</div>
                  </section>

                  {selectedLayer && (
                    <section className="capture-field-list">
                      <header><span>{selectedLayer.label} FIELDS</span><small>{selectedLayer.status.toUpperCase()}</small></header>
                      <div>{selectedLayer.fields.map((capturedField) => (
                        <button type="button" className={capturedField.id === selectedField?.id ? 'active' : ''} key={capturedField.id} onClick={() => { setSelectedFieldId(capturedField.id); const first = capturedField.byteRanges[0]; if (first) setBytePage(Math.floor(first.offset / BYTE_PAGE_SIZE)); }}>
                          <span>{capturedField.label}</span><strong>{capturedField.displayValue}</strong><small>{capturedField.byteRanges.map((entry) => `${entry.offset}+${entry.length}`).join(' · ') || 'NO DIRECT RANGE'}</small>
                        </button>
                      ))}</div>
                    </section>
                  )}

                  <section className="capture-byte-inspector">
                    <header><div><span>EXACT CAPTURED BYTES</span><strong>{selectedField?.label ?? 'RAW FRAME'}</strong></div><small>OFFSETS {byteStart}–{Math.max(byteStart, byteEnd - 1)} OF {selectedFrame.record.bytes.length}</small></header>
                    <div className="capture-byte-page-controls"><button type="button" disabled={safeBytePage === 0} onClick={() => setBytePage((current) => Math.max(0, current - 1))}>← 256 B</button><span>PAGE {safeBytePage + 1} / {totalBytePages}</span><button type="button" disabled={safeBytePage >= totalBytePages - 1} onClick={() => setBytePage((current) => Math.min(totalBytePages - 1, current + 1))}>256 B →</button></div>
                    <div className="capture-hex-grid" aria-label="Captured frame byte page">{Array.from(visibleBytes, (byte, index) => {
                      const absoluteOffset = byteStart + index;
                      return <span className={byteInRanges(absoluteOffset, selectedField) ? 'highlighted' : ''} title={`frame offset ${absoluteOffset}`} key={absoluteOffset}>{byte.toString(16).padStart(2, '0').toUpperCase()}</span>;
                    })}</div>
                    <p>{selectedField?.note ?? 'Byte pages are presentation windows only. The complete immutable frame remains indexed in session memory.'}</p>
                  </section>

                  <button type="button" className="capture-open-microscope" onClick={() => onOpenFrame(selectedFrame, { conversationId: activeConversation?.id ?? '', eventId: selectedEvent?.id ?? null, frameId: selectedFrame.record.id, timeNanoseconds })}>OPEN READ-ONLY PACKET MICROSCOPE ↗</button>
                </>
              ) : <div className="capture-inspector-empty">{activeDrawer === 'inspect' && <button ref={initialFocusRef} type="button" className="capture-drawer-close" onClick={() => setActiveDrawer(null)} aria-label="Close frame details">×</button>}<strong id="capture-frame-inspector-title">SELECT A CAPTURED FRAME</strong><p>Choose a semantic event or frame to resolve protocol fields and exact byte ranges.</p></div>}
            </aside>

            <aside
              ref={activeDrawer === 'analysis' ? drawerRef : undefined}
              className={`capture-analysis-drawer${activeDrawer === 'analysis' ? ' is-open' : ''}`}
              role={activeDrawer === 'analysis' ? 'dialog' : undefined}
              aria-modal={activeDrawer === 'analysis' ? 'true' : undefined}
              aria-labelledby="capture-analysis-drawer-title"
              aria-hidden={activeDrawer !== 'analysis'}
              inert={activeDrawer !== 'analysis'}
            >
              <header><div><span>CAPTURE-BOUNDED ANALYSIS</span><strong id="capture-analysis-drawer-title">Conversation evidence</strong></div><button ref={activeDrawer === 'analysis' ? initialFocusRef : undefined} type="button" className="capture-drawer-close" onClick={() => setActiveDrawer(null)} aria-label="Close capture analysis">×</button></header>
              <div className="capture-analysis-drawer-body">{activeConversation ? <CaptureTrackHPanel session={session} conversationId={activeConversation.id} /> : <div className="capture-inspector-empty"><strong>NO RECOGNIZED CONVERSATION</strong><p>Analysis remains empty rather than inventing a flow.</p></div>}</div>
            </aside>

            <aside
              ref={activeDrawer === 'session' ? drawerRef : undefined}
              className={`capture-session-drawer${activeDrawer === 'session' ? ' is-open' : ''}`}
              role={activeDrawer === 'session' ? 'dialog' : undefined}
              aria-modal={activeDrawer === 'session' ? 'true' : undefined}
              aria-labelledby="capture-session-drawer-title"
              aria-hidden={activeDrawer !== 'session'}
              inert={activeDrawer !== 'session'}
            >
              <header><div><span>LOCAL CAPTURE SESSION</span><strong id="capture-session-drawer-title">Evidence source</strong></div><button ref={activeDrawer === 'session' ? initialFocusRef : undefined} type="button" className="capture-drawer-close" onClick={() => setActiveDrawer(null)} aria-label="Close capture session">×</button></header>
              <div className="capture-session-drawer-body">
                <div className="capture-session-ledger" role="note">
                  <div><span>SOURCE</span><strong>{sourceName ?? 'Unnamed local capture'}</strong></div>
                  <div><span>BOUNDARY</span><strong>SESSION MEMORY</strong></div>
                  <div><span>PROVENANCE</span><strong>CAPTURED + INFERRED</strong></div>
                </div>
                <p>Replacing or clearing this session never uploads the capture. Parsed evidence and its derived index remain local to this browser tab.</p>
                <div className="capture-session-actions">
                  <button type="button" className="capture-session-replace" onClick={() => { fileInputRef.current?.click(); setActiveDrawer(null); }} disabled={parsing}>{parsing ? 'VALIDATING BYTES' : 'REPLACE CAPTURE'}</button>
                  <button type="button" className="capture-session-clear" onClick={clearSession}>CLEAR CURRENT SESSION</button>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </motion.section>
  );
}

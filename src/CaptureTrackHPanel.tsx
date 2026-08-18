import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCaptureRttSummary,
  buildCaptureTrafficOverview,
  buildCapturedProtocolTheater,
  compareCaptureSessions,
  readTcpStreamWindow,
  reconstructTcpConversation,
  type CapturedEvidenceState,
} from './capture/analysis.ts';
import {
  buildJourneyCounterfactual,
  compareCaptureConversationToSimulation,
  type CaptureCounterfactualPreset,
} from './capture/counterfactual.ts';
import {
  parseCaptureSidecarEvidenceJson,
  parseNetworkConfiguration,
  type CaptureSidecarEvidenceDocument,
  type ParsedConfigVendor,
  type ParsedNetworkConfiguration,
} from './capture/evidence.ts';
import { parseCaptureSessionAsync } from './capture/parse-async.ts';
import type { CaptureSessionIndex } from './capture/session.ts';
import type { ConversationDirection } from './capture/types.ts';
import './CaptureTrackHPanel.css';

const STREAM_PREVIEW_BYTES = 512;
const COMPARE_FLOW_RENDER_LIMIT = 80;
const CONFIG_FACT_RENDER_LIMIT = 120;

function formatBytes(value: number): string {
  if (Math.abs(value) < 1024) return `${value.toLocaleString()} B`;
  if (Math.abs(value) < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

function formatSigned(value: number, formatter: (value: number) => string = (entry) => entry.toLocaleString()): string {
  return `${value > 0 ? '+' : ''}${formatter(value)}`;
}

function stateLabel(state: CapturedEvidenceState): string {
  return state.replaceAll('_', ' ');
}

function stateTone(state: CapturedEvidenceState): string {
  if (state === 'OBSERVED') return 'observed';
  if (state === 'NOT_OBSERVED_IN_CAPTURE') return 'missing';
  return 'partial';
}

function aggregateRowCount(document: CaptureSidecarEvidenceDocument): number {
  return document.snapshots.reduce((sum, snapshot) => {
    if (snapshot.kind === 'traceroute') return sum + snapshot.hops.length;
    if (snapshot.kind === 'route-table') return sum + snapshot.entries.length;
    if (snapshot.kind === 'interface-snapshot') return sum + snapshot.interfaces.length;
    return sum + snapshot.facts.length;
  }, 0);
}

export function CaptureTrackHPanel({ session, conversationId }: { session: CaptureSessionIndex; conversationId: string }) {
  const compareInputRef = useRef<HTMLInputElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const configInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'theater' | 'stream' | 'traffic' | 'compare' | 'evidence'>('theater');
  const [streamDirection, setStreamDirection] = useState<ConversationDirection>('A_TO_B');
  const [compareSession, setCompareSession] = useState<CaptureSessionIndex | null>(null);
  const [compareSource, setCompareSource] = useState<string | null>(null);
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [counterfactualPreset, setCounterfactualPreset] = useState<CaptureCounterfactualPreset>('tcp-clean');
  const [sidecar, setSidecar] = useState<CaptureSidecarEvidenceDocument | null>(null);
  const [sidecarSource, setSidecarSource] = useState<string | null>(null);
  const [sidecarError, setSidecarError] = useState<string | null>(null);
  const [configVendor, setConfigVendor] = useState<ParsedConfigVendor>('cisco');
  const [parsedConfig, setParsedConfig] = useState<ParsedNetworkConfiguration | null>(null);
  const [configSource, setConfigSource] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const conversation = session.conversation(conversationId) ?? session.conversations[0] ?? null;
  const activeConversationId = conversation?.id ?? '';
  const stream = useMemo(() => activeConversationId ? reconstructTcpConversation(session, activeConversationId) : null, [session, activeConversationId]);
  const rtt = useMemo(() => activeConversationId ? buildCaptureRttSummary(session, activeConversationId) : null, [session, activeConversationId]);
  const theater = useMemo(() => activeConversationId ? buildCapturedProtocolTheater(session, activeConversationId) : null, [session, activeConversationId]);
  const traffic = useMemo(() => buildCaptureTrafficOverview(session, 64), [session]);
  const streamWindow = useMemo(() => stream ? readTcpStreamWindow(session, stream, streamDirection, 0n, STREAM_PREVIEW_BYTES) : null, [session, stream, streamDirection]);
  const comparison = useMemo(() => compareSession ? compareCaptureSessions(session, compareSession) : null, [session, compareSession]);
  const counterfactual = useMemo(() => buildJourneyCounterfactual(counterfactualPreset), [counterfactualPreset]);
  const counterfactualComparison = useMemo(
    () => activeConversationId ? compareCaptureConversationToSimulation(session, activeConversationId, counterfactual) : null,
    [session, activeConversationId, counterfactual],
  );
  const maxTrafficBytes = Math.max(1, ...traffic.bins.map((bin) => bin.capturedBytes));
  const streamState = stream?.directions[streamDirection] ?? null;

  useEffect(() => {
    setCompareSession(null);
    setCompareSource(null);
    setCompareError(null);
    setSidecar(null);
    setSidecarSource(null);
    setSidecarError(null);
    setParsedConfig(null);
    setConfigSource(null);
    setConfigError(null);
  }, [session.metadata.captureId]);

  const importComparisonCapture = async (file: File) => {
    setCompareBusy(true);
    setCompareError(null);
    try {
      if (!/\.(pcap|pcapng)$/i.test(file.name)) throw new Error('Choose a .pcap or .pcapng comparison capture.');
      const parsed = await parseCaptureSessionAsync(await file.arrayBuffer());
      setCompareSession(parsed);
      setCompareSource(file.name);
    } catch (cause) {
      setCompareError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCompareBusy(false);
      if (compareInputRef.current) compareInputRef.current.value = '';
    }
  };

  const importSidecar = async (file: File) => {
    setSidecarError(null);
    try {
      const parsed = parseCaptureSidecarEvidenceJson(await file.text());
      setSidecar(parsed);
      setSidecarSource(file.name);
    } catch (cause) {
      setSidecarError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (evidenceInputRef.current) evidenceInputRef.current.value = '';
    }
  };

  const importConfig = async (file: File) => {
    setConfigError(null);
    try {
      const parsed = parseNetworkConfiguration(await file.text(), configVendor);
      setParsedConfig(parsed);
      setConfigSource(file.name);
    } catch (cause) {
      setConfigError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (configInputRef.current) configInputRef.current.value = '';
    }
  };

  return (
    <section className="capture-track-h" data-track-h="complete-surface">
      <header className="capture-track-h-heading">
        <div>
          <span>CAPTURE EVIDENCE LAB</span>
          <strong>STREAMS · RTT · THEATER · TRAFFIC · COMPARE · IMPORT</strong>
          <p>Every surface stays downstream of immutable capture bytes. Missing evidence remains missing; sidecars and parsed configuration never become captured runtime truth.</p>
        </div>
        <span className="capture-track-h-boundary">SESSION ONLY · NO UPLOAD</span>
      </header>

      <nav className="capture-track-h-tabs" aria-label="Capture evidence analysis">
        {([
          ['theater', 'PROTOCOL THEATER'],
          ['stream', 'TCP STREAM + RTT'],
          ['traffic', 'TRAFFIC OVERVIEW'],
          ['compare', 'COMPARE'],
          ['evidence', 'SIDECAR EVIDENCE'],
        ] as const).map(([id, label]) => <button type="button" className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}>{label}</button>)}
      </nav>

      {tab === 'theater' && (
        <div className="capture-track-h-body">
          {theater && conversation ? (
            <>
              <div className="capture-track-h-summary">
                <div><span>ACTIVE FLOW</span><strong>{theater.protocol}</strong><small>{conversation.id}</small></div>
                <div data-state={stateTone(theater.evidenceState)}><span>EVIDENCE STATE</span><strong>{stateLabel(theater.evidenceState)}</strong><small>INFERRED PROJECTION</small></div>
              </div>
              <div className="capture-theater-stages">
                {theater.stages.map((stage, index) => (
                  <article key={stage.id} data-state={stateTone(stage.state)}>
                    <span>{String(index + 1).padStart(2, '0')} · {stage.provenance ?? 'NO EVIDENCE'}</span>
                    <strong>{stage.label}</strong>
                    <em>{stateLabel(stage.state)}</em>
                    <p>{stage.detail}</p>
                    <small>{stage.primaryFrameIds.length > 0 ? `${stage.primaryFrameIds.length} supporting primary frame${stage.primaryFrameIds.length === 1 ? '' : 's'}` : 'No source frame invented'}</small>
                  </article>
                ))}
              </div>
              <p className="capture-track-h-footnote">{theater.boundary}</p>
            </>
          ) : <div className="capture-track-h-empty">SELECT A RECOGNIZED CONVERSATION TO PROJECT CAPTURED PROTOCOL STATE.</div>}
        </div>
      )}

      {tab === 'stream' && (
        <div className="capture-track-h-body">
          {stream ? (
            <>
              <div className="capture-stream-direction">
                {(['A_TO_B', 'B_TO_A'] as const).map((direction) => <button type="button" key={direction} className={streamDirection === direction ? 'active' : ''} onClick={() => setStreamDirection(direction)}>{direction === 'A_TO_B' ? 'A → B' : 'B → A'}</button>)}
              </div>
              {streamState && (
                <div className="capture-stream-grid">
                  <article className="capture-stream-summary" data-state={stateTone(streamState.evidenceState)}>
                    <span>RECONSTRUCTION</span>
                    <strong>{stateLabel(streamState.evidenceState)}</strong>
                    <p>{streamState.summary}</p>
                    <div><small>UNIQUE BYTES</small><b>{formatBytes(streamState.uniqueCapturedBytes)}</b></div>
                    <div><small>VISIBLE GAPS</small><b>{streamState.gaps.length}</b></div>
                    <div><small>RETRANSMISSIONS</small><b>{streamState.retransmissionCount}</b></div>
                    <div><small>OVERLAPS</small><b>{streamState.overlapCount}</b></div>
                    <div><small>OUT OF ORDER</small><b>{streamState.outOfOrderCount}</b></div>
                  </article>
                  <article className="capture-stream-window">
                    <header><span>FIRST {STREAM_PREVIEW_BYTES} LOGICAL BYTES</span><strong>{streamWindow?.completeForRequestedWindow ? 'CONTIGUOUS IN WINDOW' : 'HOLES STAY HOLES'}</strong></header>
                    <div className="capture-stream-pieces">
                      {streamWindow?.pieces.map((piece) => <div key={`${piece.frameId}:${piece.logicalStart}`}><span>{piece.logicalStart.toString()}–{(piece.logicalEnd - 1n).toString()} · FRAME {piece.frameNumber}</span><code>{piece.bytesHex || '—'}</code><small>{piece.textPreview || '—'}</small></div>)}
                      {streamWindow?.pieces.length === 0 && <p>No payload bytes in this preview window.</p>}
                    </div>
                    {streamWindow && streamWindow.gaps.length > 0 && <div className="capture-stream-gaps">{streamWindow.gaps.map((gap) => <span key={`${gap.logicalStart}:${gap.logicalEnd}`}>MISSING {gap.logicalStart.toString()}–{(gap.logicalEnd - 1n).toString()} · {gap.length} B</span>)}</div>}
                  </article>
                </div>
              )}
              <section className="capture-rtt-panel">
                <header><div><span>CAPTURE-OBSERVED ACK DELAY</span><strong>{rtt?.p50Ms === null || rtt?.p50Ms === undefined ? 'NO UNAMBIGUOUS SAMPLE' : `P50 ${rtt.p50Ms.toFixed(3)} ms · P95 ${rtt.p95Ms?.toFixed(3) ?? '—'} ms`}</strong></div><small>{rtt?.ambiguousSamplesExcluded ?? 0} ambiguous excluded</small></header>
                <div>{rtt?.observations.slice(0, 24).map((observation) => <article key={observation.id}><span>FRAME {observation.sourceFrameNumber} → ACK FRAME {observation.acknowledgmentFrameNumber}</span><strong>{observation.durationMs.toFixed(3)} ms</strong><small>{observation.basis.replaceAll('-', ' ').toUpperCase()} · INFERRED</small></article>)}</div>
                <p>ACK-backed timing is a one-vantage observation, not a claim about hidden network path latency. Repeated sequence ranges are excluded when ACK attribution is ambiguous.</p>
              </section>
            </>
          ) : <div className="capture-track-h-empty">TCP STREAM RECONSTRUCTION IS AVAILABLE ONLY FOR A CAPTURE-VISIBLE TCP CONVERSATION.</div>}
        </div>
      )}

      {tab === 'traffic' && (
        <div className="capture-track-h-body">
          <div className="capture-traffic-chart" aria-label="Capture-visible traffic density">
            {traffic.bins.map((bin) => <i key={bin.index} title={`${bin.frameCount} frames · ${formatBytes(bin.capturedBytes)}`} style={{ height: `${Math.max(3, (bin.capturedBytes / maxTrafficBytes) * 100)}%` }} />)}
          </div>
          <div className="capture-traffic-columns">
            <section><header><span>PROTOCOL EVIDENCE</span><strong>{traffic.protocols.length} GROUPS</strong></header>{traffic.protocols.map((aggregate) => <article key={aggregate.protocol}><strong>{aggregate.protocol}</strong><span>{aggregate.frameCount.toLocaleString()} frames</span><span>{formatBytes(aggregate.capturedBytes)}</span><small>{aggregate.conversationCount} conversations</small></article>)}</section>
            <section><header><span>CAPTURE-VISIBLE ENDPOINTS</span><strong>TOP {traffic.endpoints.length}</strong></header>{traffic.endpoints.map((aggregate) => <article key={aggregate.endpoint}><strong>{aggregate.endpoint}</strong><span>{aggregate.frameCount.toLocaleString()} participating frames</span><span>{formatBytes(aggregate.participatingBytes)}</span></article>)}</section>
          </div>
          <p className="capture-track-h-footnote">{traffic.boundary}</p>
        </div>
      )}

      {tab === 'compare' && (
        <div className="capture-track-h-body">
          <input ref={compareInputRef} className="capture-track-h-file" type="file" accept=".pcap,.pcapng,application/vnd.tcpdump.pcap" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importComparisonCapture(file); }} />
          <section className="capture-compare-import">
            <div><span>CAPTURE ↔ CAPTURE</span><strong>{compareSource ?? 'NO SECOND CAPTURE LOADED'}</strong><p>Load another local capture. Both inputs stay independent evidence sets; the diff never decides why they differ.</p></div>
            <button type="button" disabled={compareBusy} onClick={() => compareInputRef.current?.click()}>{compareBusy ? 'PARSING…' : compareSession ? 'REPLACE COMPARISON' : 'LOAD COMPARISON CAPTURE'}</button>
          </section>
          {compareError && <p className="capture-track-h-error">{compareError}</p>}
          {comparison && (
            <>
              <div className="capture-compare-summary">
                <div><span>FRAMES Δ</span><strong>{formatSigned(comparison.frameDelta)}</strong></div>
                <div><span>FILE BYTES Δ</span><strong>{formatSigned(comparison.capturedByteDelta, formatBytes)}</strong></div>
                <div><span>CONVERSATIONS Δ</span><strong>{formatSigned(comparison.conversationDelta)}</strong></div>
                <div><span>SEMANTIC EVENTS Δ</span><strong>{formatSigned(comparison.eventDelta)}</strong></div>
              </div>
              <div className="capture-compare-flows">{comparison.flows.slice(0, COMPARE_FLOW_RENDER_LIMIT).map((flow) => <article key={flow.key} data-status={flow.status}><span>{flow.status.toUpperCase()}</span><strong>{flow.protocol}</strong><code>{flow.key}</code><small>{flow.frameDelta === null ? 'Only one capture contains this normalized flow' : `${formatSigned(flow.frameDelta)} frames · ${formatSigned(flow.capturedByteDelta ?? 0, formatBytes)}`}</small></article>)}</div>
              <p className="capture-track-h-footnote">{comparison.boundary}</p>
            </>
          )}

          <section className="capture-counterfactual">
            <header><div><span>CAPTURED ↔ SIMULATED COUNTERFACTUAL</span><strong>PROVENANCE NEVER MERGES</strong></div><select value={counterfactualPreset} onChange={(event) => setCounterfactualPreset(event.currentTarget.value as CaptureCounterfactualPreset)}><option value="tcp-clean">TCP/H2 · CLEAN</option><option value="tcp-single-loss">TCP/H2 · SINGLE LOSS</option><option value="tcp-latency">TCP/H2 · LATENCY</option><option value="quic-clean">QUIC/H3 · CLEAN</option></select></header>
            <p>{counterfactual.boundary}</p>
            <div>{counterfactualComparison?.facts.map((fact) => <article key={fact.id} data-status={fact.status.toLowerCase()}><span>{fact.label}</span><div><strong>CAPTURED / INFERRED</strong><b>{fact.captured}</b></div><div><strong>SIMULATED</strong><b>{fact.simulated}</b></div><em>{fact.status}</em><small>{fact.explanation}</small></article>)}</div>
          </section>
        </div>
      )}

      {tab === 'evidence' && (
        <div className="capture-track-h-body">
          <input ref={evidenceInputRef} className="capture-track-h-file" type="file" accept=".json,application/json" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importSidecar(file); }} />
          <input ref={configInputRef} className="capture-track-h-file" type="file" accept=".txt,.conf,.cfg,text/plain" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importConfig(file); }} />
          <div className="capture-evidence-import-grid">
            <section>
              <span>RUNTIME SNAPSHOT SIDECAR</span><strong>{sidecarSource ?? 'TRACEROUTE · ROUTES · INTERFACES · DEVICE STATE'}</strong><p>Strict `hopscotch.capture-sidecar-evidence` JSON. Imported rows remain `IMPORTED EVIDENCE`; address matches do not become topology.</p><button type="button" onClick={() => evidenceInputRef.current?.click()}>IMPORT SIDECAR JSON</button>
              {sidecarError && <small className="capture-track-h-error">{sidecarError}</small>}
            </section>
            <section>
              <span>PARSED DEVICE CONFIG</span><strong>{configSource ?? 'CISCO · JUNIPER · FRR'}</strong><p>Only explicit supported statements become facts. Parsed text is configuration provenance, never proof of runtime state.</p><div><select value={configVendor} onChange={(event) => setConfigVendor(event.currentTarget.value as ParsedConfigVendor)}><option value="cisco">CISCO</option><option value="juniper">JUNIPER</option><option value="frr">FRR</option></select><button type="button" onClick={() => configInputRef.current?.click()}>IMPORT CONFIG</button></div>
              {configError && <small className="capture-track-h-error">{configError}</small>}
            </section>
          </div>
          {sidecar && (
            <section className="capture-sidecar-results"><header><div><span>IMPORTED EVIDENCE</span><strong>{sidecar.sourceLabel}</strong></div><small>{sidecar.snapshots.length} snapshots · {aggregateRowCount(sidecar)} rows</small></header><div>{sidecar.snapshots.map((snapshot, index) => <article key={`${snapshot.kind}:${index}`}><span>{snapshot.kind.replaceAll('-', ' ').toUpperCase()}</span><strong>{snapshot.label}</strong><small>{snapshot.observedAt ?? 'OBSERVED TIME NOT SUPPLIED'} · IMPORTED EVIDENCE</small><p>{snapshot.kind === 'traceroute' ? `${snapshot.hops.length} hops` : snapshot.kind === 'route-table' ? `${snapshot.entries.length} routes` : snapshot.kind === 'interface-snapshot' ? `${snapshot.interfaces.length} interfaces` : `${snapshot.facts.length} facts`}</p></article>)}</div></section>
          )}
          {parsedConfig && (
            <section className="capture-config-results"><header><div><span>PARSED CONFIG</span><strong>{parsedConfig.vendor.toUpperCase()} · {parsedConfig.facts.length.toLocaleString()} FACTS</strong></div><small>{parsedConfig.sourceLineCount.toLocaleString()} source lines</small></header><div>{parsedConfig.facts.slice(0, CONFIG_FACT_RENDER_LIMIT).map((fact) => <article key={fact.id}><span>LINE {fact.lineNumber} · {fact.category.toUpperCase()}</span><strong>{fact.scope ? `${fact.scope} · ` : ''}{fact.key}</strong><code>{fact.value}</code></article>)}</div>{parsedConfig.facts.length > CONFIG_FACT_RENDER_LIMIT && <p>Showing {CONFIG_FACT_RENDER_LIMIT} of {parsedConfig.facts.length.toLocaleString()} parsed facts. The bounded model retains all accepted facts.</p>}<p className="capture-track-h-footnote">{parsedConfig.boundary}</p></section>
          )}
        </div>
      )}
    </section>
  );
}

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ingestNetworkDiagnosticsReportV2 } from './measurement/networkDiagnosticsAdapter.ts';
import {
  DEFAULT_LOOPBACK_BRIDGE_ORIGIN,
  connectLoopbackBridge,
  fetchLoopbackBridgeReport,
  type LoopbackBridgeConnection,
  type LoopbackBridgeStatus,
} from './measurement/loopbackBridge.ts';
import {
  measuredFactsByCategory,
  measuredFreshnessAt,
  type MeasuredFreshness,
  type MeasuredSnapshotState,
} from './measurement/state.ts';
import type {
  NativeMeasurementCategory,
  NativeMeasurementFact,
  NativeMeasurementTarget,
  NativeMeasurementUnit,
  NativeMeasurementValue,
} from './measurement/native.ts';
import './MeasuredNetworkWorkspace.css';

const MAX_REPORT_BYTES = 10 * 1024 * 1024;

const CATEGORY_ORDER: readonly NativeMeasurementCategory[] = [
  'interface',
  'route',
  'dns',
  'icmp',
  'traceroute',
  'transport',
  'packet-capture',
];

const CATEGORY_COPY: Record<NativeMeasurementCategory, { label: string; kicker: string; description: string }> = {
  interface: {
    label: 'Interface',
    kicker: 'LOCAL EDGE',
    description: 'Interface capabilities and source-selected link state from this host.',
  },
  route: {
    label: 'Routing',
    kicker: 'LOCAL FORWARDING',
    description: 'Route-table facts from this host only. No global forwarding path is implied.',
  },
  dns: {
    label: 'DNS',
    kicker: 'RESOLUTION',
    description: 'Resolver attempts and timing captured by the imported diagnostic run.',
  },
  icmp: {
    label: 'ICMP',
    kicker: 'REACHABILITY',
    description: 'Bounded echo observations. Missing replies do not prove path absence.',
  },
  traceroute: {
    label: 'Trace',
    kicker: 'HOP OBSERVATION',
    description: 'Responding hops and RTT samples from one forward traceroute attempt.',
  },
  transport: {
    label: 'Transport',
    kicker: 'DELIVERY',
    description: 'Service timing, throughput, loaded latency, and address-family transport facts.',
  },
  'packet-capture': {
    label: 'Capture',
    kicker: 'PACKET EVIDENCE',
    description: 'Packet-capture facts when a future source explicitly includes them.',
  },
};

function targetKey(target: NativeMeasurementTarget | null): string {
  return target === null ? 'untargeted' : `${target.kind}:${target.value}`;
}

function targetLabel(target: NativeMeasurementTarget | null): string {
  if (target === null) return 'NO TARGET DISCLOSED';
  return `${target.kind.toUpperCase()} · ${target.value}`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatUnit(value: number, unit: NativeMeasurementUnit): string {
  if (unit === 'bits-per-second') {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 2)} Gbps`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 2)} Mbps`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 2)} Kbps`;
    return `${formatNumber(value)} bps`;
  }
  if (unit === 'bytes') {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} GB`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MB`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)} KB`;
    return `${formatNumber(value)} B`;
  }
  if (unit === 'ms') return `${formatNumber(value)} ms`;
  if (unit === 'percent') return `${formatNumber(value)}%`;
  if (unit === 'hops') return `${formatNumber(value)} hops`;
  if (unit === 'count') return formatNumber(value);
  return formatNumber(value);
}

function formatValue(value: NativeMeasurementValue, unit: NativeMeasurementUnit | null): string {
  if (value === null) return 'UNAVAILABLE';
  if (Array.isArray(value)) return value.length === 0 ? 'NONE OBSERVED' : value.join(' · ');
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  if (typeof value === 'number') return unit === null ? formatNumber(value) : formatUnit(value, unit);
  return value;
}

function freshnessLabel(value: MeasuredFreshness): string {
  if (value === 'fresh') return 'FRESH';
  if (value === 'aging') return 'AGING';
  if (value === 'stale') return 'STALE';
  return 'CLOCK SKEW';
}

function captureAgeLabel(ageMs: number): string {
  if (ageMs < 0) return 'CAPTURE TIME IS AHEAD OF THIS CLOCK';
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1000)}s AGO`;
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m AGO`;
  if (ageMs < 86_400_000) return `${Math.floor(ageMs / 3_600_000)}h AGO`;
  return `${Math.floor(ageMs / 86_400_000)}d AGO`;
}

function groupFacts(facts: readonly NativeMeasurementFact[]): Array<{ target: NativeMeasurementTarget | null; facts: NativeMeasurementFact[] }> {
  const groups = new Map<string, { target: NativeMeasurementTarget | null; facts: NativeMeasurementFact[] }>();
  for (const fact of facts) {
    const key = targetKey(fact.target);
    const current = groups.get(key);
    if (current) current.facts.push(fact);
    else groups.set(key, { target: fact.target, facts: [fact] });
  }
  return [...groups.values()];
}

function SemanticGlyph({ category }: { category: NativeMeasurementCategory }) {
  const dots = category === 'traceroute' ? 5 : category === 'transport' ? 4 : category === 'route' ? 3 : 2;
  return <div className={`measured-glyph glyph-${category}`} aria-hidden="true">
    <span className="glyph-line" />
    {Array.from({ length: dots }, (_, index) => <i key={index} style={{ left: `${8 + (index / (dots - 1)) * 84}%` }} />)}
  </div>;
}

export function MeasuredNetworkWorkspace({ measuredState, onMeasuredStateChange, onExit }: { measuredState: MeasuredSnapshotState | null; onMeasuredStateChange: (state: MeasuredSnapshotState | null) => void; onExit: () => void }) {
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<NativeMeasurementCategory>('interface');
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [bridgeOrigin, setBridgeOrigin] = useState(DEFAULT_LOOPBACK_BRIDGE_ORIGIN);
  const [bridgeStatus, setBridgeStatus] = useState<LoopbackBridgeStatus>('disconnected');
  const [bridgeConnection, setBridgeConnection] = useState<LoopbackBridgeConnection | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  useEffect(() => {
    if (measuredState === null) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [measuredState]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<NativeMeasurementCategory, number>();
    for (const category of CATEGORY_ORDER) counts.set(category, measuredState ? measuredFactsByCategory(measuredState, category).length : 0);
    return counts;
  }, [measuredState]);

  const selectedFacts = useMemo(
    () => measuredState ? measuredFactsByCategory(measuredState, selectedCategory) : [],
    [measuredState, selectedCategory],
  );
  const selectedGroups = useMemo(() => groupFacts(selectedFacts), [selectedFacts]);
  const activeTargetGroup = selectedGroups.find((group) => targetKey(group.target) === selectedTargetKey) ?? selectedGroups[0] ?? null;
  const freshness = measuredState ? measuredFreshnessAt(measuredState, nowMs) : null;
  const categoryCopy = CATEGORY_COPY[selectedCategory];
  const skippedSections = measuredState?.snapshot.warnings.filter((warning) => warning.includes(':') || warning.startsWith('unknown root fields ignored:')) ?? [];

  const chooseBestCategory = (next: MeasuredSnapshotState) => {
    const preferred: NativeMeasurementCategory[] = ['transport', 'route', 'interface', 'dns', 'icmp', 'traceroute', 'packet-capture'];
    const first = preferred.find((category) => measuredFactsByCategory(next, category).length > 0);
    setSelectedCategory(first ?? 'interface');
    setSelectedTargetKey(null);
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setError(null);
    if (file.size > MAX_REPORT_BYTES) {
      setError('Report is larger than the 10 MB browser-import limit. Nothing was imported.');
      return;
    }
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const next = ingestNetworkDiagnosticsReportV2(parsed);
      onMeasuredStateChange(next.state);
      setFileName(file.name);
      setNowMs(Date.now());
      chooseBestCategory(next.state);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to import this Network Diagnostics report.');
    }
  };

  const connectBridge = async () => {
    if (bridgeStatus === 'connecting') return;
    setBridgeError(null);
    setBridgeStatus('connecting');
    try {
      const connection = await connectLoopbackBridge(bridgeOrigin);
      setBridgeConnection(connection);
      setBridgeOrigin(connection.origin);
      setBridgeStatus('connected');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to connect to the local Network Diagnostics bridge.';
      setBridgeConnection(null);
      setBridgeStatus(/handshake|schema|version|identity|report path|capabilit/i.test(message) ? 'rejected' : 'unavailable');
      setBridgeError(message);
    }
  };

  const refreshBridgeReport = async () => {
    if (bridgeConnection === null || bridgeStatus !== 'connected') return;
    setBridgeError(null);
    try {
      const next = await fetchLoopbackBridgeReport(bridgeConnection);
      onMeasuredStateChange(next.state);
      setFileName('LOCAL BRIDGE · REPORT V2');
      setNowMs(Date.now());
      chooseBestCategory(next.state);
    } catch (reason) {
      setBridgeError(reason instanceof Error ? reason.message : 'Unable to load a report from the local bridge.');
    }
  };

  const disconnectBridge = () => {
    setBridgeConnection(null);
    setBridgeStatus('disconnected');
    setBridgeError(null);
  };

  const clear = () => {
    onMeasuredStateChange(null);
    setFileName(null);
    setError(null);
    setSelectedCategory('interface');
    setSelectedTargetKey(null);
  };

  return <motion.section
    className="measured-workspace"
    data-measured-loaded={measuredState ? 'true' : 'false'}
    data-bridge-status={bridgeStatus}
    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.987, filter: 'blur(12px)' }}
    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.012, filter: 'blur(8px)' }}
    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
  >
    <header className="measured-heading">
      <div>
        <p className="eyebrow">Lab 09 · Local measurement</p>
        <h1>MEASURED HERE.<br /><span>NOT EVERYWHERE.</span></h1>
      </div>
      <div className="measured-heading-actions">
        <span className="measured-truth-chip">LOCAL MEASURED · BOUNDED · NOT GLOBAL</span>
        <button className="lab-mode" type="button" onClick={() => inputRef.current?.click()}>{measuredState ? 'IMPORT ANOTHER' : 'IMPORT REPORT'}</button>
        {measuredState && <button className="lab-mode measured-clear" type="button" onClick={clear}>CLEAR</button>}
        <button className="lab-mode" type="button" onClick={onExit}>EXIT LAB</button>
        <input ref={inputRef} className="measured-file-input" type="file" accept=".json,application/json" onChange={(event) => void importFile(event)} />
      </div>
    </header>

    <div className="measured-boundary" role="note">
      <div><span>VANTAGE</span><strong>LOCAL HOST</strong></div>
      <i />
      <div><span>CAPTURE</span><strong>BOUNDED</strong></div>
      <i />
      <div><span>GLOBAL TRUTH</span><strong>NO</strong></div>
      <p>Imported bytes stay in this browser session. Facts are shown only after the Network Diagnostics v2 adapter, native provenance validator, and measured-state projection accept them. Separate targets are not drawn as one observed route.</p>
    </div>

    <section className="measured-bridge" aria-label="Optional local Network Diagnostics bridge">
      <div className="measured-bridge-copy">
        <span>OPTIONAL LOCAL BRIDGE</span>
        <strong>EXPLICIT LOOPBACK CONNECTION</strong>
        <p>No scanning or background polling. Connect performs one handshake against a loopback-only endpoint; Refresh Report is the separate action that requests one report through the existing validation path.</p>
      </div>
      <label className="measured-bridge-origin">
        <span>BRIDGE ORIGIN</span>
        <input value={bridgeOrigin} disabled={bridgeStatus === 'connecting' || bridgeStatus === 'connected'} onChange={(event) => setBridgeOrigin(event.currentTarget.value)} spellCheck={false} aria-label="Local bridge origin" />
      </label>
      <div className="measured-bridge-state">
        <span>STATE</span>
        <strong className={`state-${bridgeStatus}`}>{bridgeStatus.toUpperCase()}</strong>
        {bridgeConnection && <small>{bridgeConnection.handshake.application} · BRIDGE {bridgeConnection.handshake.bridgeVersion}</small>}
      </div>
      <div className="measured-bridge-actions">
        {bridgeStatus !== 'connected' ? <button type="button" disabled={bridgeStatus === 'connecting'} onClick={() => void connectBridge()}>{bridgeStatus === 'connecting' ? 'CONNECTING…' : 'CONNECT'}</button> : <>
          <button type="button" onClick={() => void refreshBridgeReport()}>REFRESH REPORT</button>
          <button className="bridge-disconnect" type="button" onClick={disconnectBridge}>DISCONNECT</button>
        </>}
      </div>
      {bridgeError && <p className="measured-bridge-error"><strong>BRIDGE {bridgeStatus === 'connected' ? 'REPORT REJECTED' : bridgeStatus.toUpperCase()}</strong><span>{bridgeError}</span>{measuredState && <small>PREVIOUS VALID MEASUREMENT REMAINS ACTIVE.</small>}</p>}
    </section>

    <AnimatePresence mode="wait" initial={false}>
      {error && <motion.div key={error} className="measured-error" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <strong>IMPORT REJECTED</strong><span>{error}</span>{measuredState && <small>THE PREVIOUS VALID REPORT REMAINS ACTIVE.</small>}
      </motion.div>}
    </AnimatePresence>

    {!measuredState ? <section className="measured-empty">
      <SemanticGlyph category="route" />
      <div><strong>NO LOCAL MEASUREMENT LOADED</strong><p>Import a Network Diagnostics Suite report-v2 JSON file or explicitly connect the optional loopback bridge above. HOPSCOTCH does not scan localhost, poll in the background, upload reports, or invent measurements for sections that were not captured.</p></div>
      <button type="button" onClick={() => inputRef.current?.click()}>CHOOSE JSON REPORT <span>↗</span></button>
    </section> : <>
      <section className="measured-capture-strip" aria-label="Imported measurement capture">
        <div className="capture-source"><span className="provenance measured">LOCAL MEASURED</span><div><small>SOURCE</small><strong>{measuredState.snapshot.source.tool}</strong><span>{measuredState.snapshot.source.platform.toUpperCase()} · ADAPTER {measuredState.snapshot.source.adapterVersion}</span></div></div>
        <div><span>REPORT</span><strong>{fileName ?? 'IMPORTED JSON'}</strong></div>
        <div><span>FACTS</span><strong>{measuredState.availability.total}</strong><small>{measuredState.availability.available} available · {measuredState.availability.partial} partial · {measuredState.availability.unavailable} unavailable</small></div>
        <div className={`capture-freshness state-${freshness?.classification ?? 'fresh'}`}><span>CAPTURE AGE</span><strong>{freshness ? freshnessLabel(freshness.classification) : '—'}</strong><small>{freshness ? captureAgeLabel(freshness.ageMs) : '—'}</small></div>
        <div><span>COMPLETED</span><strong>{new Date(measuredState.snapshot.capture.completedAt).toLocaleString()}</strong></div>
      </section>

      <div className="measured-main">
        <nav className="measured-categories" aria-label="Measured fact categories">
          <header><span>MEASURED DOMAINS</span><small>SELECT ONE</small></header>
          {CATEGORY_ORDER.map((category) => {
            const count = categoryCounts.get(category) ?? 0;
            return <button key={category} type="button" className={selectedCategory === category ? 'active' : ''} onClick={() => { setSelectedCategory(category); setSelectedTargetKey(null); }}>
              <span><small>{CATEGORY_COPY[category].kicker}</small><strong>{CATEGORY_COPY[category].label}</strong></span><b>{count}</b>
            </button>;
          })}
          <footer><span>NO CROSS-TARGET MERGE</span><p>Each fact retains its source target. Untargeted facts stay explicitly untargeted.</p></footer>
        </nav>

        <section className="measured-scene">
          <header className="measured-scene-heading">
            <div><span>{categoryCopy.kicker}</span><h2>{categoryCopy.label.toUpperCase()}</h2><p>{categoryCopy.description}</p></div>
            <SemanticGlyph category={selectedCategory} />
          </header>
          <div className="measured-scene-body">
            {selectedGroups.length > 1 && <nav className="measured-target-selector" aria-label={`${categoryCopy.label} target scopes`}>
              {selectedGroups.map((group) => {
                const key = targetKey(group.target);
                const active = activeTargetGroup !== null && targetKey(activeTargetGroup.target) === key;
                return <button key={key} type="button" className={active ? 'active' : ''} onClick={() => setSelectedTargetKey(key)}>
                  <span>{targetLabel(group.target)}</span><b>{group.facts.length}</b>
                </button>;
              })}
            </nav>}
            {selectedGroups.length === 0 ? <div className="measured-category-empty"><strong>NO {categoryCopy.label.toUpperCase()} FACTS</strong><span>This report did not provide a whitelisted measurement in this category. HOPSCOTCH will not fill the gap from simulation.</span></div> : activeTargetGroup && <div className="measured-target-groups">
              <article key={targetKey(activeTargetGroup.target)} className="measured-target-group">
                <header><div><span>TARGET SCOPE</span><strong>{targetLabel(activeTargetGroup.target)}</strong></div><small>{activeTargetGroup.facts.length} FACT{activeTargetGroup.facts.length === 1 ? '' : 'S'}</small></header>
                <div className="measured-fact-list">{activeTargetGroup.facts.map((fact) => <div key={fact.id} className={`measured-fact state-${fact.availability}`} data-fact-id={fact.id}>
                  <div><span>{fact.subject}</span><small>{fact.availability.toUpperCase()} · {new Date(fact.observedAt).toLocaleTimeString()}</small></div>
                  <strong>{formatValue(fact.value, fact.unit)}</strong>
                  <p>{fact.note}</p>
                </div>)}</div>
              </article>
            </div>}
          </div>
        </section>

        <aside className="measured-provenance-panel">
          <header><span>PROVENANCE BOUNDARY</span><strong>WHAT THIS REPORT CAN SAY</strong></header>
          <dl>
            <div><dt>VANTAGE</dt><dd>LOCAL HOST</dd></div>
            <div><dt>COMPLETENESS</dt><dd>BOUNDED</dd></div>
            <div><dt>GLOBAL COMPLETE</dt><dd>FALSE</dd></div>
            <div><dt>SNAPSHOT TARGET</dt><dd>MULTI-TARGET / NONE</dd></div>
          </dl>
          <section><span>LIMITATIONS</span>{measuredState.snapshot.scope.limitations.map((line) => <p key={line}>{line}</p>)}</section>
          {skippedSections.length > 0 && <section className="measured-skipped"><span>NOT PROMOTED TO LOCAL MEASURED</span>{skippedSections.map((line) => <p key={line}>{line}</p>)}</section>}
          {measuredState.snapshot.warnings.length > 0 && <details><summary>ALL ADAPTER WARNINGS · {measuredState.snapshot.warnings.length}</summary><div>{measuredState.snapshot.warnings.map((line) => <p key={line}>{line}</p>)}</div></details>}
          <footer><span>SESSION ONLY</span><strong>NOT STORED · NOT UPLOADED</strong></footer>
        </aside>
      </div>
    </>}
  </motion.section>;
}

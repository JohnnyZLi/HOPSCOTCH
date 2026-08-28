import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import {
  VisualDrawerTabs,
  type VisualDrawerDefinition,
  type VisualDrawerId,
  VisualWorkspaceShell,
} from './VisualWorkspace.tsx';
import type { InternetEvidenceError, InternetEvidenceSnapshot } from './internet/evidence';
import './ObservedInternet.css';
import './ObservedInternet.phase4.css';
import './ObservedInternetEditorialLight.css';

function asLabel(asn: number | null): string {
  return asn === null ? 'UNAVAILABLE' : `AS${asn}`;
}

function joinLocation(city: string | null, region: string | null, country: string | null): string {
  return [city, region, country].filter((value): value is string => Boolean(value)).join(' · ') || 'UNAVAILABLE';
}

export function ObservedInternet({ onExit, onOpenSimulated }: { onExit: () => void; onOpenSimulated: () => void }) {
  const [host, setHost] = useState('cloudflare.com');
  const [snapshot, setSnapshot] = useState<InternetEvidenceSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<VisualDrawerId | null>(null);

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/internet/snapshot?host=${encodeURIComponent(host.trim())}`, {
        headers: { accept: 'application/json' },
      });
      const payload = await response.json() as InternetEvidenceSnapshot | InternetEvidenceError;
      if (!response.ok || ('ok' in payload && payload.ok === false)) {
        throw new Error('error' in payload ? payload.error : `Snapshot failed with HTTP ${response.status}.`);
      }
      if (!('schema' in payload) || payload.schema !== 'hopscotch.internet-evidence') {
        throw new Error('HOPSCOTCH received an unexpected evidence payload.');
      }
      setSnapshot(payload);
      setActiveDrawer(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load Internet evidence.');
      setActiveDrawer('config');
    } finally {
      setLoading(false);
    }
  };

  const queryDrawer = <div className="observed-query-drawer">
    <form className="observed-query" onSubmit={(event) => void load(event)}>
      <label>
        <span>DESTINATION HOSTNAME</span>
        <input
          value={host}
          maxLength={253}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setHost(event.currentTarget.value)}
          placeholder="example.com"
        />
      </label>
      <button type="submit" disabled={loading}>{loading ? 'OBSERVING…' : 'BUILD EVIDENCE SNAPSHOT'}</button>
      <p>Cloudflare edge metadata and public RIPE RIS observations are separate evidence classes. Collector paths are never presented as the browser’s measured route.</p>
    </form>
    <AnimatePresence mode="wait" initial={false}>
      {error && <motion.div key={error} className="observed-error" role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <strong>SNAPSHOT ERROR</strong>
        <span>{error}</span>
        {snapshot && <small>THE PREVIOUS VALID SNAPSHOT REMAINS ON SCREEN.</small>}
      </motion.div>}
    </AnimatePresence>
    <div className="observed-query-boundary" role="note">
      <span>REQUEST</span><strong>EXPLICIT</strong>
      <span>PATH CLAIM</span><strong>NONE</strong>
      <span>CLIENT IDENTIFIERS</span><strong>EXCLUDED</strong>
    </div>
  </div>;

  const collectorDrawer = snapshot ? <aside className="collector-panel">
    <div className="collector-heading">
      <div><span>PUBLIC COLLECTOR</span><strong>RIPE RIS AS PATHS</strong></div>
      <small>{snapshot.collectorPaths.length} OBSERVATIONS</small>
    </div>
    <p className="collector-warning">Each row is a route seen from a named RIS collector-peer vantage point. It is not the current browser’s exact forwarding path.</p>
    <div className="collector-paths">
      {snapshot.collectorPaths.length === 0 ? <div className="collector-empty"><strong>NO COLLECTOR PATH AVAILABLE</strong><span>HOPSCOTCH will not fabricate one.</span></div> : snapshot.collectorPaths.map((path, index) => <article key={`${path.sourceId}-${index}`}>
        <div><span className="provenance collector">PUBLIC COLLECTOR</span><small>{path.sourceId}</small></div>
        <strong>{path.asPath.map((asn) => `AS${asn}`).join(' → ')}</strong>
        <p>{path.targetPrefix}</p>
        <small>{path.note}</small>
      </article>)}
    </div>
  </aside> : <div className="observed-drawer-empty"><strong>NO SNAPSHOT YET</strong><p>Build an evidence snapshot before inspecting collector observations.</p></div>;

  const evidenceDrawer = snapshot ? <div className="observed-evidence-drawer">
    <div className="observed-boundary-ledger" role="note">
      <div><span>EDGE</span><strong>OBSERVED</strong></div>
      <div><span>DESTINATION</span><strong>INFERRED</strong></div>
      <div><span>ROUTING</span><strong>PUBLIC COLLECTOR</strong></div>
      <div><span>CONTINUOUS PATH</span><strong>NOT OBSERVED</strong></div>
    </div>
    <section>
      <span>EVIDENCE GAP</span>
      <strong>THE MIDDLE IS INTENTIONALLY UNKNOWN</strong>
      <p>{snapshot.bridge.note}</p>
    </section>
    {snapshot.warnings.length > 0 && <div className="evidence-warnings"><span>PARTIAL EVIDENCE</span>{snapshot.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
    <footer><span>SNAPSHOT</span><strong>{new Date(snapshot.generatedAt).toLocaleString()}</strong></footer>
  </div> : <div className="observed-drawer-empty"><strong>NO EVIDENCE LEDGER YET</strong><p>Build a snapshot to inspect its provenance and limitations.</p></div>;

  const drawers: readonly VisualDrawerDefinition[] = [
    { id: 'config', label: 'Query', eyebrow: 'EXPLICIT REQUEST', title: 'Build evidence snapshot', content: queryDrawer },
    { id: 'inspect', label: 'Collectors', eyebrow: 'PUBLIC VANTAGE POINTS', title: 'Collector observations', content: collectorDrawer },
    { id: 'evidence', label: 'Evidence', eyebrow: 'PROVENANCE BOUNDARY', title: 'What this snapshot can say', content: evidenceDrawer },
  ];

  const toolbar = <>
    <div className="visual-identity"><span>INTERNET EVIDENCE</span><strong>OBSERVATION BOUNDARY</strong></div>
    <div className="observed-toolbar-controls">
      <VisualDrawerTabs
        active={activeDrawer}
        items={[
          { id: 'config', label: 'Query' },
          { id: 'inspect', label: 'Collectors', badge: snapshot ? String(snapshot.collectorPaths.length) : '—' },
          { id: 'evidence', label: 'Evidence', badge: snapshot?.warnings.length ? String(snapshot.warnings.length) : undefined },
        ]}
        onSelect={(id) => setActiveDrawer((current) => current === id ? null : id)}
      />
      <div className="observed-workspace-actions">
        <button type="button" onClick={onOpenSimulated}>Simulated AS ↗</button>
        <button type="button" onClick={onExit}>Exit</button>
      </div>
    </div>
  </>;

  const hud = <>
    <div><span>TRUTH</span><strong>NO ROUTE CLAIM</strong></div>
    {snapshot && <div><span>HOST</span><strong>{snapshot.destination.hostname}</strong></div>}
    {snapshot && <div><span>EDGE</span><strong>{asLabel(snapshot.edge.asn)}</strong></div>}
    {snapshot && <div><span>GAPS</span><strong>{snapshot.warnings.length ? 'PARTIAL' : 'DECLARED'}</strong></div>}
  </>;

  return <VisualWorkspaceShell
    className="observed-internet"
    entrance={{ eyebrow: 'Internet evidence · bounded observation', title: 'OBSERVE WHAT', accentTitle: 'WE ACTUALLY KNOW.', subtitle: 'Evidence islands. Explicit gaps. No invented path.' }}
    toolbar={toolbar}
    hud={hud}
    stageLabel="Internet evidence relationship workspace"
    activeDrawer={activeDrawer}
    drawers={drawers}
    onCloseDrawer={() => setActiveDrawer(null)}
    timeline={<div className="observed-evidence-rail"><span>EDGE OBSERVATION</span><i /><strong>UNKNOWN FORWARDING SPACE</strong><i /><span>PUBLIC ROUTING CONTEXT</span></div>}
  >
    {!snapshot ? <section className="observed-empty">
      <div className="observed-dormant-field" aria-hidden="true">
        <div className="evidence-orbit"><i /><i /><i /><b /></div>
        <span className="observed-dormant-node node-edge">EDGE</span>
        <span className="observed-dormant-gap"><i /><b>UNKNOWN</b><i /></span>
        <span className="observed-dormant-node node-public">PUBLIC</span>
      </div>
      <div><span>AWAITING EXPLICIT QUERY</span><strong>BUILD ONE BOUNDED SNAPSHOT</strong><p>Request-address identifiers are intentionally excluded from the browser-facing evidence model.</p></div>
      <button type="button" onClick={() => setActiveDrawer('config')}>OPEN QUERY</button>
    </section> : <section className="observed-main" aria-label={`Evidence islands for ${snapshot.destination.hostname}`}>
      <div className="evidence-flow">
        <article className={`evidence-card evidence-edge-island state-${snapshot.edge.availability}`}>
          <div className="provenance edge">EDGE OBSERVED</div>
          <header><span>CURRENT HOPSCOTCH REQUEST</span><strong>{asLabel(snapshot.edge.asn)}</strong></header>
          <dl>
            <div><dt>ORGANIZATION</dt><dd>{snapshot.edge.organization ?? 'UNAVAILABLE'}</dd></div>
            <div><dt>CLOUDFLARE COLO</dt><dd>{snapshot.edge.colo ?? 'UNAVAILABLE'}</dd></div>
            <div><dt>LOCATION CONTEXT</dt><dd>{joinLocation(snapshot.edge.city, snapshot.edge.region, snapshot.edge.country)}</dd></div>
            <div><dt>EDGE RTT</dt><dd>{snapshot.edge.transportRttMs === null ? 'UNAVAILABLE' : `${snapshot.edge.transportRttMs} ms · ${snapshot.edge.transport ?? 'transport'}`}</dd></div>
          </dl>
          <p>{snapshot.edge.note}</p>
        </article>

        <div className="inferred-bridge" aria-label="Unobserved forwarding gap">
          <span className="provenance inferred">INFERRED BOUNDARY</span>
          <div><i /><strong>NO CONTINUOUS OBSERVATION</strong><i /></div>
          <p>{snapshot.bridge.sourceAsn === null ? 'EDGE ASN UNAVAILABLE' : `AS${snapshot.bridge.sourceAsn}`} <b>≠ measured path ≠</b> {snapshot.bridge.destinationOriginAsns.length ? snapshot.bridge.destinationOriginAsns.map((asn) => `AS${asn}`).join(' / ') : 'DESTINATION ORIGIN UNAVAILABLE'}</p>
          <small>{snapshot.bridge.note}</small>
        </div>

        <article className={`evidence-card evidence-destination-island state-${snapshot.destination.availability}`}>
          <div className="provenance inferred">INFERRED</div>
          <header><span>DESTINATION RESOLUTION</span><strong>{snapshot.destination.hostname}</strong></header>
          <dl>
            <div><dt>SELECTED ADDRESS</dt><dd>{snapshot.destination.selectedAddress ?? 'UNAVAILABLE'}</dd></div>
            <div><dt>RESOLVED ADDRESSES</dt><dd>{snapshot.destination.addresses.length ? snapshot.destination.addresses.join(' · ') : 'UNAVAILABLE'}</dd></div>
          </dl>
          <p>{snapshot.destination.note}</p>
        </article>

        <article className={`evidence-card evidence-routing-island state-${snapshot.routing.availability}`}>
          <div className="provenance collector">PUBLIC COLLECTOR</div>
          <header><span>DESTINATION ROUTING CONTEXT</span><strong>{snapshot.routing.prefix ?? 'UNAVAILABLE'}</strong></header>
          <dl><div><dt>ORIGIN ASN(S)</dt><dd>{snapshot.routing.originAsns.length ? snapshot.routing.originAsns.map((asn) => `AS${asn}`).join(' · ') : 'UNAVAILABLE'}</dd></div></dl>
          <p>{snapshot.routing.note}</p>
          <button type="button" onClick={() => setActiveDrawer('inspect')}>INSPECT {snapshot.collectorPaths.length} COLLECTOR OBSERVATION{snapshot.collectorPaths.length === 1 ? '' : 'S'} ↗</button>
        </article>
      </div>
    </section>}
  </VisualWorkspaceShell>;
}

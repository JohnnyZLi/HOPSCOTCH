import { useMemo, useState } from 'react';
import type { InternetEvidenceSnapshot } from './internet/evidence.ts';
import type { PublicInfrastructureSnapshot } from './internet/infrastructure.ts';
import {
  fetchNativePublicContext,
  projectNativePublicCorrelation,
  type NativeCorrelationProvenance,
} from './measurement/nativeCorrelation.ts';
import type { MeasuredSnapshotState } from './measurement/state.ts';
import './MeasuredNativeCorrelationPanel.css';

const PROVENANCE_LABELS: Record<NativeCorrelationProvenance, string> = {
  'LOCAL MEASURED': 'LOCAL MEASURED',
  'EDGE OBSERVED': 'EDGE OBSERVED',
  'PUBLIC COLLECTOR': 'PUBLIC COLLECTOR',
  'PUBLIC DATA': 'PUBLIC DATA',
  INFERRED: 'INFERRED',
};

export function MeasuredNativeCorrelationPanel({ measuredState }: { measuredState: MeasuredSnapshotState }) {
  const [evidence, setEvidence] = useState<InternetEvidenceSnapshot | null>(null);
  const [infrastructure, setInfrastructure] = useState<PublicInfrastructureSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projection = useMemo(
    () => projectNativePublicCorrelation(measuredState, evidence, infrastructure),
    [measuredState, evidence, infrastructure],
  );

  const correlate = async () => {
    if (!projection.targetHostname || loading) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchNativePublicContext(projection.targetHostname);
      setEvidence(next.evidence);
      setInfrastructure(next.infrastructure);
    } catch (reason) {
      setEvidence(null);
      setInfrastructure(null);
      setError(reason instanceof Error ? reason.message : 'Unable to load public Internet context.');
    } finally {
      setLoading(false);
    }
  };

  const clearPublic = () => {
    setEvidence(null);
    setInfrastructure(null);
    setError(null);
  };

  return <section className="native-correlation" aria-label="Native companion and public evidence correlation">
    <header className="native-correlation-heading">
      <div>
        <span>TRACK I · NATIVE COMPANION</span>
        <strong>LOCAL → PUBLIC, WITHOUT BLENDING TRUTH</strong>
        <p>The Network Diagnostics report remains local measured evidence. Public routing, edge, and facility context is requested separately and keeps its own provenance.</p>
      </div>
      <div className="native-correlation-actions">
        <button type="button" disabled={!projection.targetHostname || loading} onClick={() => void correlate()}>
          {loading ? 'CORRELATING…' : evidence ? 'REFRESH PUBLIC CONTEXT' : 'CORRELATE PUBLIC CONTEXT'}
        </button>
        {evidence && <button className="native-correlation-clear" type="button" onClick={clearPublic}>CLEAR PUBLIC</button>}
      </div>
    </header>

    <div className="native-local-summary">
      <div><span>INTERFACES</span><strong>{projection.local.interfaceFacts}</strong></div>
      <div><span>ROUTES</span><strong>{projection.local.routeFacts}</strong></div>
      <div><span>DNS</span><strong>{projection.local.dnsFacts}</strong></div>
      <div><span>ICMP</span><strong>{projection.local.icmpFacts}</strong></div>
      <div><span>TRACE</span><strong>{projection.local.tracerouteFacts}</strong></div>
      <div><span>TRANSPORT</span><strong>{projection.local.transportFacts}</strong></div>
    </div>

    <div className="native-config-strip">
      <div><span>SOURCE</span><strong>{projection.local.sourceAddress ?? 'NOT DISCLOSED'}</strong></div>
      <div><span>GATEWAY</span><strong>{projection.local.defaultGateway ?? 'NOT OBSERVED'}</strong></div>
      <div><span>DNS SERVERS</span><strong>{projection.local.dnsServers.length ? projection.local.dnsServers.join(' · ') : 'NOT DISCLOSED'}</strong></div>
      <div><span>TARGET</span><strong>{projection.targetHostname ?? 'NO HOSTNAME TARGET'}</strong></div>
    </div>

    {!projection.targetHostname && <p className="native-correlation-note">A hostname target was not present in this bounded measurement. HOPSCOTCH will not guess a destination merely to load public context.</p>}
    {error && <p className="native-correlation-error"><strong>PUBLIC CONTEXT UNAVAILABLE</strong> · {error}</p>}

    <div className="native-evidence-lane">
      {projection.stages.map((stage, index) => <div className={`native-evidence-stage provenance-${stage.provenance.toLowerCase().replaceAll(' ', '-')}`} key={stage.id}>
        <div className="native-evidence-index">{String(index + 1).padStart(2, '0')}</div>
        <div className="native-evidence-copy">
          <div className="native-evidence-label"><span>{stage.label}</span><em>{PROVENANCE_LABELS[stage.provenance]}</em></div>
          <strong>{stage.value}</strong>
          <p>{stage.detail}</p>
        </div>
      </div>)}
    </div>

    <footer className="native-correlation-boundary">
      <strong>PROVENANCE DOES NOT FLOW ACROSS THE ARROWS.</strong>
      <p>{projection.boundaryNote}</p>
      <p>No credentials. No LAN scanning or discovery. No hidden polling. Local refresh and public correlation are separate explicit actions.</p>
    </footer>
  </section>;
}

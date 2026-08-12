import { useMemo } from 'react';
import {
  measuredCompatibilityLabel,
  measuredEvidenceForScene,
  type MeasuredEvidenceCompatibility,
  type MeasuredSceneKind,
} from './measurement/sceneEvidence.ts';
import { measuredFreshnessAt, type MeasuredSnapshotState } from './measurement/state.ts';
import type { NativeMeasurementFact, NativeMeasurementUnit, NativeMeasurementValue } from './measurement/native.ts';
import './MeasuredEvidenceSidecar.css';

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatValue(value: NativeMeasurementValue, unit: NativeMeasurementUnit | null): string {
  if (value === null) return 'UNAVAILABLE';
  if (Array.isArray(value)) return value.length === 0 ? 'NONE OBSERVED' : value.join(' · ');
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  if (typeof value === 'string') return value;
  if (unit === 'bits-per-second') {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 2)} Gbps`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 2)} Mbps`;
    return `${formatNumber(value)} bps`;
  }
  if (unit === 'bytes') return `${formatNumber(value)} B`;
  if (unit === 'ms') return `${formatNumber(value)} ms`;
  if (unit === 'percent') return `${formatNumber(value)}%`;
  if (unit === 'hops') return `${formatNumber(value)} hops`;
  return formatNumber(value);
}

function targetText(fact: NativeMeasurementFact): string {
  if (fact.target === null) return 'UNTARGETED';
  return `${fact.target.kind.toUpperCase()} · ${fact.target.value}`;
}

function compatibilityForEvidence(matched: number, local: number, other: number): MeasuredEvidenceCompatibility | null {
  if (matched > 0) return 'matched-target';
  if (local > 0) return 'local-context';
  if (other > 0) return 'other-target';
  return null;
}

function factPriority(fact: NativeMeasurementFact): number {
  const subject = fact.subject.toLowerCase();
  if (subject.includes('reachable') || subject.includes('default') || subject.includes('latency') || subject.includes('duration')) return 0;
  if (subject.includes('protocol') || subject.includes('interface') || subject.includes('metric')) return 1;
  return 2;
}

export function MeasuredEvidenceSidecar({
  measuredState,
  scene,
  hostname,
  destinationAddress,
}: {
  measuredState: MeasuredSnapshotState | null;
  scene: MeasuredSceneKind | null;
  hostname: string;
  destinationAddress: string;
}) {
  const evidence = useMemo(() => {
    if (measuredState === null || scene === null) return null;
    return measuredEvidenceForScene(measuredState, { scene, hostname, destinationAddress });
  }, [measuredState, scene, hostname, destinationAddress]);

  if (measuredState === null || scene === null || evidence === null) return null;
  const compatibility = compatibilityForEvidence(evidence.matchedTarget.length, evidence.localContext.length, evidence.otherTarget.length);
  if (compatibility === null) return null;

  const primary = compatibility === 'matched-target'
    ? evidence.matchedTarget
    : compatibility === 'local-context'
      ? evidence.localContext
      : [];
  const sorted = [...primary].sort((left, right) => factPriority(left) - factPriority(right));
  const visible = sorted.slice(0, 3);
  const now = Date.now();
  const freshness = measuredFreshnessAt(measuredState, now);
  const otherTargetCount = evidence.otherTarget.length;
  const hiddenPrimaryCount = Math.max(0, primary.length - visible.length);

  return <aside className={`journey-measured-sidecar compatibility-${compatibility}`} data-measured-compatibility={compatibility} data-measured-scene={scene}>
    <header>
      <div><span>LOCAL MEASURED</span><strong>{measuredCompatibilityLabel(compatibility)}</strong></div>
      <small>{freshness.classification.toUpperCase()} · LOCAL HOST · NOT GLOBAL</small>
    </header>
    {compatibility === 'other-target' ? <div className="journey-measured-mismatch">
      <strong>NO COMPATIBLE {scene.toUpperCase()} TARGET</strong>
      <span>{otherTargetCount} measured fact{otherTargetCount === 1 ? '' : 's'} from other target scope{otherTargetCount === 1 ? '' : 's'} remain separate from {hostname}.</span>
    </div> : <div className="journey-measured-facts">
      {visible.map((fact) => <div key={fact.id} className={`journey-measured-fact state-${fact.availability}`}>
        <span>{fact.subject}</span><strong>{formatValue(fact.value, fact.unit)}</strong><small>{targetText(fact)}</small>
      </div>)}
    </div>}
    <footer>
      <span>SIMULATED STORY UNCHANGED</span>
      <small>{hiddenPrimaryCount > 0 ? `+${hiddenPrimaryCount} MORE ${compatibility === 'matched-target' ? 'MATCHED' : 'LOCAL'} · ` : ''}{otherTargetCount > 0 ? `${otherTargetCount} OTHER-TARGET FACT${otherTargetCount === 1 ? '' : 'S'} HIDDEN` : 'NO OTHER-TARGET FACTS SHOWN'}</small>
    </footer>
  </aside>;
}

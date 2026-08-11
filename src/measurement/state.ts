import type { EvidenceAvailability } from '../internet/evidence.ts';
import {
  parseNativeMeasurementSnapshot,
  type LocalMeasuredProvenance,
  type NativeMeasurementCategory,
  type NativeMeasurementFact,
  type NativeMeasurementSnapshot,
  type NativeMeasurementTarget,
} from './native.ts';

export type MeasuredFreshness = 'clock-skew' | 'fresh' | 'aging' | 'stale';

export interface MeasuredAvailabilitySummary {
  available: number;
  partial: number;
  unavailable: number;
  total: number;
}

export interface MeasuredFreshnessPolicy {
  freshForMs: number;
  staleAfterMs: number;
}

export interface MeasuredFreshnessState {
  classification: MeasuredFreshness;
  ageMs: number;
  captureCompletedAt: string;
  evaluatedAt: string;
}

export interface MeasuredSnapshotState {
  schema: 'hopscotch.measured-state';
  version: 1;
  provenance: LocalMeasuredProvenance;
  measurementKey: string;
  snapshot: NativeMeasurementSnapshot;
  factsById: Readonly<Record<string, NativeMeasurementFact>>;
  factIdsByCategory: Readonly<Record<NativeMeasurementCategory, readonly string[]>>;
  availability: MeasuredAvailabilitySummary;
  latestObservedAt: string | null;
}

export interface ActiveMeasuredStateStore {
  schema: 'hopscotch.measured-state-store';
  version: 1;
  active: MeasuredSnapshotState | null;
}

export const DEFAULT_MEASURED_FRESHNESS_POLICY: Readonly<MeasuredFreshnessPolicy> = Object.freeze({
  freshForMs: 60_000,
  staleAfterMs: 300_000,
});

const CATEGORIES: readonly NativeMeasurementCategory[] = [
  'interface',
  'route',
  'dns',
  'icmp',
  'traceroute',
  'transport',
  'packet-capture',
];

function targetKey(target: NativeMeasurementTarget | null): string {
  return target === null ? 'untargeted' : `${target.kind}:${target.value}`;
}

function copyTarget(target: NativeMeasurementTarget | null): NativeMeasurementTarget | null {
  return target === null ? null : { ...target };
}

function copyFact(fact: NativeMeasurementFact): NativeMeasurementFact {
  return {
    ...fact,
    target: copyTarget(fact.target),
    value: Array.isArray(fact.value) ? [...fact.value] : fact.value,
  };
}

function copySnapshot(snapshot: NativeMeasurementSnapshot): NativeMeasurementSnapshot {
  return {
    ...snapshot,
    source: { ...snapshot.source },
    capture: { ...snapshot.capture },
    scope: {
      ...snapshot.scope,
      target: copyTarget(snapshot.scope.target),
      limitations: [...snapshot.scope.limitations],
    },
    facts: snapshot.facts.map(copyFact),
    warnings: [...snapshot.warnings],
  };
}

function measurementKey(snapshot: NativeMeasurementSnapshot): string {
  return [
    'local-measured',
    snapshot.source.adapter,
    snapshot.source.adapterVersion,
    snapshot.source.tool,
    snapshot.capture.startedAt,
    snapshot.capture.completedAt,
    targetKey(snapshot.scope.target),
  ].join('|');
}

function availabilitySummary(facts: readonly NativeMeasurementFact[]): MeasuredAvailabilitySummary {
  const summary: MeasuredAvailabilitySummary = {
    available: 0,
    partial: 0,
    unavailable: 0,
    total: facts.length,
  };
  for (const fact of facts) summary[fact.availability] += 1;
  return summary;
}

function latestObservedAt(facts: readonly NativeMeasurementFact[]): string | null {
  if (facts.length === 0) return null;
  let latest = facts[0].observedAt;
  let latestMs = Date.parse(latest);
  for (let index = 1; index < facts.length; index += 1) {
    const observedMs = Date.parse(facts[index].observedAt);
    if (observedMs > latestMs) {
      latest = facts[index].observedAt;
      latestMs = observedMs;
    }
  }
  return latest;
}

function timestampMs(value: string | number, label: string): { ms: number; iso: string } {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${label} must be a finite epoch millisecond value or ISO-compatible timestamp.`);
  return { ms, iso: new Date(ms).toISOString() };
}

function validateFreshnessPolicy(policy: MeasuredFreshnessPolicy): void {
  if (!Number.isFinite(policy.freshForMs) || policy.freshForMs < 0) throw new Error('freshForMs must be a non-negative finite number.');
  if (!Number.isFinite(policy.staleAfterMs) || policy.staleAfterMs < policy.freshForMs) throw new Error('staleAfterMs must be finite and greater than or equal to freshForMs.');
}

export function projectMeasuredSnapshot(value: unknown): MeasuredSnapshotState {
  const parsed = parseNativeMeasurementSnapshot(value);
  const snapshot = copySnapshot(parsed);
  const factsById: Record<string, NativeMeasurementFact> = {};
  const factIdsByCategory: Record<NativeMeasurementCategory, string[]> = {
    interface: [],
    route: [],
    dns: [],
    icmp: [],
    traceroute: [],
    transport: [],
    'packet-capture': [],
  };

  for (const fact of snapshot.facts) {
    factsById[fact.id] = fact;
    factIdsByCategory[fact.category].push(fact.id);
  }

  return {
    schema: 'hopscotch.measured-state',
    version: 1,
    provenance: 'LOCAL MEASURED',
    measurementKey: measurementKey(snapshot),
    snapshot,
    factsById,
    factIdsByCategory,
    availability: availabilitySummary(snapshot.facts),
    latestObservedAt: latestObservedAt(snapshot.facts),
  };
}

export function createMeasuredStateStore(): ActiveMeasuredStateStore {
  return {
    schema: 'hopscotch.measured-state-store',
    version: 1,
    active: null,
  };
}

export function replaceActiveMeasuredSnapshot(store: ActiveMeasuredStateStore, value: unknown): ActiveMeasuredStateStore {
  if (store.schema !== 'hopscotch.measured-state-store' || store.version !== 1) throw new Error('Measured state store schema/version is invalid.');
  return {
    schema: 'hopscotch.measured-state-store',
    version: 1,
    active: projectMeasuredSnapshot(value),
  };
}

export function clearActiveMeasuredSnapshot(store: ActiveMeasuredStateStore): ActiveMeasuredStateStore {
  if (store.schema !== 'hopscotch.measured-state-store' || store.version !== 1) throw new Error('Measured state store schema/version is invalid.');
  return createMeasuredStateStore();
}

export function measuredFactById(state: MeasuredSnapshotState, id: string): NativeMeasurementFact | null {
  return state.factsById[id] ?? null;
}

export function measuredFactsByCategory(state: MeasuredSnapshotState, category: NativeMeasurementCategory): NativeMeasurementFact[] {
  return state.factIdsByCategory[category].map((id) => state.factsById[id]);
}

export function measuredFactsByTarget(state: MeasuredSnapshotState, target: NativeMeasurementTarget | null): NativeMeasurementFact[] {
  return state.snapshot.facts.filter((fact) => {
    if (target === null || fact.target === null) return target === null && fact.target === null;
    return fact.target.kind === target.kind && fact.target.value === target.value;
  });
}

export function measuredAvailability(state: MeasuredSnapshotState, availability: EvidenceAvailability): NativeMeasurementFact[] {
  return state.snapshot.facts.filter((fact) => fact.availability === availability);
}

export function measuredLatestObservationAt(state: MeasuredSnapshotState): string | null {
  return state.latestObservedAt;
}

export function measuredFreshnessAt(
  state: MeasuredSnapshotState,
  now: string | number,
  policy: MeasuredFreshnessPolicy = DEFAULT_MEASURED_FRESHNESS_POLICY,
): MeasuredFreshnessState {
  validateFreshnessPolicy(policy);
  const evaluated = timestampMs(now, 'now');
  const completedMs = Date.parse(state.snapshot.capture.completedAt);
  const ageMs = evaluated.ms - completedMs;
  let classification: MeasuredFreshness;
  if (ageMs < 0) classification = 'clock-skew';
  else if (ageMs <= policy.freshForMs) classification = 'fresh';
  else if (ageMs < policy.staleAfterMs) classification = 'aging';
  else classification = 'stale';

  return {
    classification,
    ageMs,
    captureCompletedAt: state.snapshot.capture.completedAt,
    evaluatedAt: evaluated.iso,
  };
}

export function measuredCategories(): readonly NativeMeasurementCategory[] {
  return CATEGORIES;
}

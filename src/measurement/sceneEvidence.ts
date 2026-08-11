import type { NativeMeasurementCategory, NativeMeasurementFact, NativeMeasurementTarget } from './native.ts';
import type { MeasuredSnapshotState } from './state.ts';

export type MeasuredSceneKind = 'routing' | 'dns' | 'transport';
export type MeasuredEvidenceCompatibility = 'matched-target' | 'local-context' | 'other-target';

export interface MeasuredSceneQuery {
  scene: MeasuredSceneKind;
  hostname: string;
  destinationAddress: string;
}

export interface MeasuredSceneEvidenceGroup {
  compatibility: MeasuredEvidenceCompatibility;
  facts: NativeMeasurementFact[];
}

export interface MeasuredSceneEvidence {
  scene: MeasuredSceneKind;
  hostname: string;
  destinationAddress: string;
  matchedTarget: NativeMeasurementFact[];
  localContext: NativeMeasurementFact[];
  otherTarget: NativeMeasurementFact[];
}

function normalizeHostname(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/\.+$/, '');
  if (trimmed.length === 0 || trimmed.length > 253) return null;
  if (trimmed.includes('/') || trimmed.includes('://') || trimmed.includes('@') || /\s/.test(trimmed)) return null;
  const labels = trimmed.split('.');
  if (labels.some((label) => label.length === 0 || label.length > 63 || !/^[a-z0-9-]+$/.test(label) || label.startsWith('-') || label.endsWith('-'))) return null;
  return trimmed;
}

function normalizeIpv4(value: string): string | null {
  const parts = value.trim().split('.');
  if (parts.length !== 4) return null;
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const number = Number(part);
    if (!Number.isInteger(number) || number < 0 || number > 255) return null;
    numbers.push(number);
  }
  return numbers.join('.');
}

function ipv4Number(value: string): number | null {
  const normalized = normalizeIpv4(value);
  if (normalized === null) return null;
  return normalized.split('.').reduce((result, part) => ((result << 8) | Number(part)) >>> 0, 0) >>> 0;
}

function prefixMatch(prefix: string, address: string): { matches: boolean; prefixLength: number } | null {
  const [networkText, lengthText, ...extra] = prefix.trim().split('/');
  if (extra.length > 0 || lengthText === undefined || !/^\d{1,2}$/.test(lengthText)) return null;
  const network = ipv4Number(networkText);
  const candidate = ipv4Number(address);
  const prefixLength = Number(lengthText);
  if (network === null || candidate === null || prefixLength < 0 || prefixLength > 32) return null;
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return { matches: (network & mask) === (candidate & mask), prefixLength };
}

function serviceHostname(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return normalizeHostname(new URL(trimmed).hostname);
  } catch {
    return null;
  }

  if (trimmed.startsWith('[')) return null;
  const colonCount = [...trimmed].filter((character) => character === ':').length;
  const hostText = colonCount === 1 ? trimmed.slice(0, trimmed.lastIndexOf(':')) : trimmed;
  const portText = colonCount === 1 ? trimmed.slice(trimmed.lastIndexOf(':') + 1) : null;
  if (portText !== null && !/^\d{1,5}$/.test(portText)) return null;
  return normalizeHostname(hostText);
}

function exactHostnameTarget(target: NativeMeasurementTarget, hostname: string): boolean {
  const normalizedHostname = normalizeHostname(hostname);
  if (normalizedHostname === null) return false;
  if (target.kind === 'hostname') return normalizeHostname(target.value) === normalizedHostname;
  if (target.kind === 'service') return serviceHostname(target.value) === normalizedHostname;
  return false;
}

function exactIpTarget(target: NativeMeasurementTarget, address: string): boolean {
  if (target.kind !== 'ip') return false;
  const expected = normalizeIpv4(address);
  const actual = normalizeIpv4(target.value);
  return expected !== null && actual !== null && expected === actual;
}

export function measuredTargetCompatibility(
  target: NativeMeasurementTarget | null,
  query: MeasuredSceneQuery,
): MeasuredEvidenceCompatibility {
  const hostname = normalizeHostname(query.hostname);
  const destination = normalizeIpv4(query.destinationAddress);
  if (hostname === null || destination === null) return 'other-target';
  if (target === null || target.kind === 'interface') return 'local-context';

  if (query.scene === 'routing') {
    if (target.kind === 'prefix') {
      const match = prefixMatch(target.value, destination);
      if (match === null || !match.matches) return 'other-target';
      return match.prefixLength === 0 ? 'local-context' : 'matched-target';
    }
    if (target.kind === 'ip') return exactIpTarget(target, destination) ? 'matched-target' : 'other-target';
    return 'other-target';
  }

  if (query.scene === 'dns') {
    if (target.kind === 'ip') return 'local-context';
    return exactHostnameTarget(target, hostname) ? 'matched-target' : 'other-target';
  }

  if (target.kind === 'ip') return exactIpTarget(target, destination) ? 'matched-target' : 'other-target';
  if (target.kind === 'hostname' || target.kind === 'service') return exactHostnameTarget(target, hostname) ? 'matched-target' : 'other-target';
  return 'local-context';
}

function categoryForScene(scene: MeasuredSceneKind): readonly NativeMeasurementCategory[] {
  if (scene === 'routing') return ['interface', 'route'];
  if (scene === 'dns') return ['dns'];
  return ['transport'];
}

export function measuredEvidenceForScene(state: MeasuredSnapshotState, query: MeasuredSceneQuery): MeasuredSceneEvidence {
  const categories = new Set(categoryForScene(query.scene));
  const result: MeasuredSceneEvidence = {
    scene: query.scene,
    hostname: query.hostname,
    destinationAddress: query.destinationAddress,
    matchedTarget: [],
    localContext: [],
    otherTarget: [],
  };

  for (const fact of state.snapshot.facts) {
    if (!categories.has(fact.category)) continue;
    const compatibility = measuredTargetCompatibility(fact.target, query);
    if (compatibility === 'matched-target') result.matchedTarget.push(fact);
    else if (compatibility === 'local-context') result.localContext.push(fact);
    else result.otherTarget.push(fact);
  }
  return result;
}

export function measuredCompatibilityLabel(value: MeasuredEvidenceCompatibility): 'MATCHED TARGET' | 'LOCAL CONTEXT' | 'OTHER TARGET' {
  if (value === 'matched-target') return 'MATCHED TARGET';
  if (value === 'local-context') return 'LOCAL CONTEXT';
  return 'OTHER TARGET';
}

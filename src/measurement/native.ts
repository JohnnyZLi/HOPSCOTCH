import type { EvidenceAvailability, EvidenceProvenance } from '../internet/evidence.ts';

export type LocalMeasuredProvenance = Extract<EvidenceProvenance, 'LOCAL MEASURED'>;
export type NativeMeasurementPlatform = 'windows' | 'macos' | 'linux' | 'unknown';
export type NativeMeasurementCategory = 'interface' | 'route' | 'dns' | 'icmp' | 'traceroute' | 'transport' | 'packet-capture';
export type NativeMeasurementTargetKind = 'hostname' | 'ip' | 'prefix' | 'interface' | 'service';
export type NativeMeasurementUnit = 'ms' | 'bytes' | 'bits-per-second' | 'percent' | 'count' | 'hops';
export type NativeMeasurementValue = string | number | boolean | string[] | null;

export interface NativeMeasurementTarget {
  kind: NativeMeasurementTargetKind;
  value: string;
}

export interface NativeMeasurementSource {
  adapter: string;
  adapterVersion: string;
  platform: NativeMeasurementPlatform;
  tool: string;
  toolVersion: string | null;
}

export interface NativeMeasurementCapture {
  startedAt: string;
  completedAt: string;
}

export interface NativeMeasurementScope {
  vantage: 'local-host';
  completeness: 'bounded';
  globalComplete: false;
  target: NativeMeasurementTarget | null;
  limitations: string[];
}

export interface NativeMeasurementFact {
  id: string;
  provenance: LocalMeasuredProvenance;
  category: NativeMeasurementCategory;
  subject: string;
  availability: EvidenceAvailability;
  observedAt: string;
  target: NativeMeasurementTarget | null;
  value: NativeMeasurementValue;
  unit: NativeMeasurementUnit | null;
  note: string;
}

export interface NativeMeasurementSnapshot {
  schema: 'hopscotch.native-measurement';
  version: 1;
  provenance: LocalMeasuredProvenance;
  generatedAt: string;
  source: NativeMeasurementSource;
  capture: NativeMeasurementCapture;
  scope: NativeMeasurementScope;
  facts: NativeMeasurementFact[];
  warnings: string[];
}

const PROVENANCE: LocalMeasuredProvenance = 'LOCAL MEASURED';
const PLATFORMS = new Set<NativeMeasurementPlatform>(['windows', 'macos', 'linux', 'unknown']);
const CATEGORIES = new Set<NativeMeasurementCategory>(['interface', 'route', 'dns', 'icmp', 'traceroute', 'transport', 'packet-capture']);
const AVAILABILITY = new Set<EvidenceAvailability>(['available', 'unavailable', 'partial']);
const TARGET_KINDS = new Set<NativeMeasurementTargetKind>(['hostname', 'ip', 'prefix', 'interface', 'service']);
const UNITS = new Set<NativeMeasurementUnit>(['ms', 'bytes', 'bits-per-second', 'percent', 'count', 'hops']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function assertExactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unexpected.length > 0) throw new Error(`${label} contains unsupported field(s): ${unexpected.join(', ')}.`);
}

function assertString(value: unknown, label: string, max = 240): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > max) throw new Error(`${label} must contain 1–${max} characters.`);
  return normalized;
}

function assertNullableString(value: unknown, label: string, max = 120): string | null {
  if (value === null) return null;
  return assertString(value, label, max);
}

function assertTimestamp(value: unknown, label: string): string {
  const timestamp = assertString(value, label, 80);
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`${label} must be an ISO-compatible timestamp.`);
  return timestamp;
}

function assertStringArray(value: unknown, label: string, options: { allowEmpty?: boolean; maxItems?: number; maxLength?: number } = {}): string[] {
  const { allowEmpty = true, maxItems = 64, maxLength = 240 } = options;
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (!allowEmpty && value.length === 0) throw new Error(`${label} must not be empty.`);
  if (value.length > maxItems) throw new Error(`${label} supports at most ${maxItems} entries.`);
  return value.map((entry, index) => assertString(entry, `${label}[${index}]`, maxLength));
}

function parseTarget(value: unknown, label: string): NativeMeasurementTarget | null {
  if (value === null) return null;
  const record = assertRecord(value, label);
  assertExactKeys(record, ['kind', 'value'], label);
  if (!TARGET_KINDS.has(record.kind as NativeMeasurementTargetKind)) throw new Error(`${label}.kind is unsupported.`);
  return {
    kind: record.kind as NativeMeasurementTargetKind,
    value: assertString(record.value, `${label}.value`, 253),
  };
}

function parseValue(value: unknown, label: string): NativeMeasurementValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${label} numeric values must be finite.`);
    return value;
  }
  if (Array.isArray(value)) return assertStringArray(value, label, { maxItems: 128, maxLength: 253 });
  throw new Error(`${label} must be a scalar, string list, or null; structured model/Journey state is not valid measured fact data.`);
}

function parseFact(value: unknown, captureStart: number, captureEnd: number, index: number): NativeMeasurementFact {
  const label = `facts[${index}]`;
  const record = assertRecord(value, label);
  assertExactKeys(record, ['id', 'provenance', 'category', 'subject', 'availability', 'observedAt', 'target', 'value', 'unit', 'note'], label);
  if (record.provenance !== PROVENANCE) throw new Error(`${label}.provenance must be LOCAL MEASURED.`);
  if (!CATEGORIES.has(record.category as NativeMeasurementCategory)) throw new Error(`${label}.category is unsupported.`);
  if (!AVAILABILITY.has(record.availability as EvidenceAvailability)) throw new Error(`${label}.availability is unsupported.`);
  const observedAt = assertTimestamp(record.observedAt, `${label}.observedAt`);
  const observedMs = Date.parse(observedAt);
  if (observedMs < captureStart || observedMs > captureEnd) throw new Error(`${label}.observedAt must fall inside the capture interval.`);
  const parsedValue = parseValue(record.value, `${label}.value`);
  let unit: NativeMeasurementUnit | null = null;
  if (record.unit !== null) {
    if (!UNITS.has(record.unit as NativeMeasurementUnit)) throw new Error(`${label}.unit is unsupported.`);
    unit = record.unit as NativeMeasurementUnit;
  }
  if (unit !== null && typeof parsedValue !== 'number') throw new Error(`${label}.unit requires a numeric value.`);
  if (record.availability === 'unavailable' && parsedValue !== null) throw new Error(`${label}.value must be null when availability is unavailable.`);
  if (unit === 'percent' && typeof parsedValue === 'number' && (parsedValue < 0 || parsedValue > 100)) throw new Error(`${label}.value must be 0–100 for percent.`);
  if ((unit === 'bytes' || unit === 'bits-per-second' || unit === 'count' || unit === 'hops' || unit === 'ms') && typeof parsedValue === 'number' && parsedValue < 0) throw new Error(`${label}.value must be non-negative for ${unit}.`);

  return {
    id: assertString(record.id, `${label}.id`, 120),
    provenance: PROVENANCE,
    category: record.category as NativeMeasurementCategory,
    subject: assertString(record.subject, `${label}.subject`, 240),
    availability: record.availability as EvidenceAvailability,
    observedAt,
    target: parseTarget(record.target, `${label}.target`),
    value: parsedValue,
    unit,
    note: assertString(record.note, `${label}.note`, 500),
  };
}

export function parseNativeMeasurementSnapshot(value: unknown): NativeMeasurementSnapshot {
  const record = assertRecord(value, 'Native measurement snapshot');
  assertExactKeys(record, ['schema', 'version', 'provenance', 'generatedAt', 'source', 'capture', 'scope', 'facts', 'warnings'], 'Native measurement snapshot');
  if (record.schema !== 'hopscotch.native-measurement') throw new Error('Native measurement schema must be hopscotch.native-measurement.');
  if (record.version !== 1) throw new Error('Native measurement version must be 1.');
  if (record.provenance !== PROVENANCE) throw new Error('Native measurement provenance must be LOCAL MEASURED.');

  const sourceRecord = assertRecord(record.source, 'source');
  assertExactKeys(sourceRecord, ['adapter', 'adapterVersion', 'platform', 'tool', 'toolVersion'], 'source');
  if (!PLATFORMS.has(sourceRecord.platform as NativeMeasurementPlatform)) throw new Error('source.platform is unsupported.');
  const source: NativeMeasurementSource = {
    adapter: assertString(sourceRecord.adapter, 'source.adapter', 120),
    adapterVersion: assertString(sourceRecord.adapterVersion, 'source.adapterVersion', 80),
    platform: sourceRecord.platform as NativeMeasurementPlatform,
    tool: assertString(sourceRecord.tool, 'source.tool', 120),
    toolVersion: assertNullableString(sourceRecord.toolVersion, 'source.toolVersion', 80),
  };

  const captureRecord = assertRecord(record.capture, 'capture');
  assertExactKeys(captureRecord, ['startedAt', 'completedAt'], 'capture');
  const startedAt = assertTimestamp(captureRecord.startedAt, 'capture.startedAt');
  const completedAt = assertTimestamp(captureRecord.completedAt, 'capture.completedAt');
  const captureStart = Date.parse(startedAt);
  const captureEnd = Date.parse(completedAt);
  if (captureEnd < captureStart) throw new Error('capture.completedAt must not precede capture.startedAt.');

  const generatedAt = assertTimestamp(record.generatedAt, 'generatedAt');
  if (Date.parse(generatedAt) < captureEnd) throw new Error('generatedAt must not precede capture.completedAt.');

  const scopeRecord = assertRecord(record.scope, 'scope');
  assertExactKeys(scopeRecord, ['vantage', 'completeness', 'globalComplete', 'target', 'limitations'], 'scope');
  if (scopeRecord.vantage !== 'local-host') throw new Error('scope.vantage must be local-host.');
  if (scopeRecord.completeness !== 'bounded') throw new Error('scope.completeness must be bounded.');
  if (scopeRecord.globalComplete !== false) throw new Error('scope.globalComplete must be false; local measurements cannot claim global completeness.');
  const limitations = assertStringArray(scopeRecord.limitations, 'scope.limitations', { allowEmpty: false, maxItems: 32, maxLength: 500 });
  const scope: NativeMeasurementScope = {
    vantage: 'local-host',
    completeness: 'bounded',
    globalComplete: false,
    target: parseTarget(scopeRecord.target, 'scope.target'),
    limitations,
  };

  if (!Array.isArray(record.facts)) throw new Error('facts must be an array.');
  if (record.facts.length > 4096) throw new Error('facts supports at most 4096 entries per snapshot.');
  const facts = record.facts.map((fact, index) => parseFact(fact, captureStart, captureEnd, index));
  const seen = new Set<string>();
  for (const fact of facts) {
    if (seen.has(fact.id)) throw new Error(`Duplicate measured fact id: ${fact.id}.`);
    seen.add(fact.id);
  }

  return {
    schema: 'hopscotch.native-measurement',
    version: 1,
    provenance: PROVENANCE,
    generatedAt,
    source,
    capture: { startedAt, completedAt },
    scope,
    facts,
    warnings: assertStringArray(record.warnings, 'warnings', { maxItems: 64, maxLength: 500 }),
  };
}

export function serializeNativeMeasurementSnapshot(snapshot: NativeMeasurementSnapshot): string {
  return `${JSON.stringify(parseNativeMeasurementSnapshot(snapshot), null, 2)}\n`;
}

export function deserializeNativeMeasurementSnapshot(json: string): NativeMeasurementSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Native measurement JSON is invalid.');
  }
  return parseNativeMeasurementSnapshot(parsed);
}

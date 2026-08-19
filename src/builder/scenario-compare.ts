import type { BuilderScenario } from './scenario.ts';

export const BUILDER_SCENARIO_CONFIGURATION_FIELDS = [
  'graph',
  'addressing',
  'routing',
  'ethernet',
  'linkProfiles',
  'acl',
  'nat',
  'dhcp',
  'ipv6',
  'services',
  'sourceId',
  'destinationId',
] as const satisfies readonly (keyof BuilderScenario)[];

export type BuilderScenarioConfigurationSnapshot = Omit<Pick<
  BuilderScenario,
  (typeof BUILDER_SCENARIO_CONFIGURATION_FIELDS)[number]
>, 'services'> & { services?: BuilderScenario['services'] };

export type BuilderScenarioChangeType = 'added' | 'removed' | 'changed';
export type BuilderScenarioObjectCategory = 'device' | 'link' | 'configuration';
export type BuilderScenarioStableId = string | number;

export interface BuilderScenarioFieldChange {
  path: string[];
  change: BuilderScenarioChangeType;
  before?: unknown;
  after?: unknown;
}

export interface BuilderScenarioObjectChange {
  category: BuilderScenarioObjectCategory;
  collectionPath: string[];
  id: BuilderScenarioStableId;
  change: BuilderScenarioChangeType;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  fields: BuilderScenarioFieldChange[];
}

export interface BuilderScenarioDiff {
  devices: BuilderScenarioObjectChange[];
  links: BuilderScenarioObjectChange[];
  configurationObjects: BuilderScenarioObjectChange[];
  fields: BuilderScenarioFieldChange[];
}

const MISSING = Symbol('missing Builder scenario value');
type Missing = typeof MISSING;
type ComparableValue = unknown | Missing;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function comparePath(left: readonly string[], right: readonly string[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const result = compareText(left[index], right[index]);
    if (result !== 0) return result;
  }
  return left.length - right.length;
}

function compareStableId(left: BuilderScenarioStableId, right: BuilderScenarioStableId): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left !== typeof right) return typeof left === 'number' ? -1 : 1;
  return compareText(String(left), String(right));
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined';
  return JSON.stringify(value) ?? 'undefined';
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeValue(item))
      .sort((left, right) => compareText(stableSerialize(left), stableSerialize(right)));
  }
  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort(compareText)) normalized[key] = normalizeValue(value[key]);
    return normalized;
  }
  return value;
}

function stableEqual(left: unknown, right: unknown): boolean {
  return stableSerialize(normalizeValue(left)) === stableSerialize(normalizeValue(right));
}

function changeType(before: ComparableValue, after: ComparableValue): BuilderScenarioChangeType {
  if (before === MISSING) return 'added';
  if (after === MISSING) return 'removed';
  return 'changed';
}

function fieldChange(path: readonly string[], before: ComparableValue, after: ComparableValue): BuilderScenarioFieldChange {
  return {
    path: [...path],
    change: changeType(before, after),
    ...(before === MISSING ? {} : { before: normalizeValue(before) }),
    ...(after === MISSING ? {} : { after: normalizeValue(after) }),
  };
}

function collectFieldChanges(
  before: ComparableValue,
  after: ComparableValue,
  path: readonly string[],
  changes: BuilderScenarioFieldChange[],
): void {
  if (before !== MISSING && after !== MISSING && stableEqual(before, after)) return;

  if (before !== MISSING && after !== MISSING && isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(compareText);
    for (const key of keys) {
      collectFieldChanges(
        Object.hasOwn(before, key) ? before[key] : MISSING,
        Object.hasOwn(after, key) ? after[key] : MISSING,
        [...path, key],
        changes,
      );
    }
    return;
  }

  changes.push(fieldChange(path, before, after));
}

function stableId(value: Record<string, unknown>): BuilderScenarioStableId | null {
  const id = value.id;
  if (typeof id === 'string') return id;
  if (typeof id === 'number' && Number.isFinite(id)) return id;
  return null;
}

function stableCollection(values: readonly unknown[]): Map<BuilderScenarioStableId, Record<string, unknown>> | null {
  const collection = new Map<BuilderScenarioStableId, Record<string, unknown>>();
  for (const value of values) {
    if (!isRecord(value)) return null;
    const id = stableId(value);
    if (id === null || collection.has(id)) return null;
    collection.set(id, value);
  }
  return collection;
}

function objectCategory(collectionPath: readonly string[]): BuilderScenarioObjectCategory {
  const key = collectionPath.join('.');
  if (key === 'graph.nodes' || key === 'ethernet.devices') return 'device';
  if (key === 'graph.links' || key === 'ethernet.links') return 'link';
  return 'configuration';
}

function normalizedRecord(value: Record<string, unknown>): Record<string, unknown> {
  return normalizeValue(value) as Record<string, unknown>;
}

function compareStableCollections(
  before: Map<BuilderScenarioStableId, Record<string, unknown>>,
  after: Map<BuilderScenarioStableId, Record<string, unknown>>,
  collectionPath: readonly string[],
  result: BuilderScenarioDiff,
): void {
  const category = objectCategory(collectionPath);
  const bucket = category === 'device' ? result.devices : category === 'link' ? result.links : result.configurationObjects;
  const ids = [...new Set([...before.keys(), ...after.keys()])].sort(compareStableId);

  for (const id of ids) {
    const beforeValue = before.get(id);
    const afterValue = after.get(id);
    if (!beforeValue && afterValue) {
      bucket.push({
        category,
        collectionPath: [...collectionPath],
        id,
        change: 'added',
        after: normalizedRecord(afterValue),
        fields: [],
      });
      continue;
    }
    if (beforeValue && !afterValue) {
      bucket.push({
        category,
        collectionPath: [...collectionPath],
        id,
        change: 'removed',
        before: normalizedRecord(beforeValue),
        fields: [],
      });
      continue;
    }
    if (!beforeValue || !afterValue || stableEqual(beforeValue, afterValue)) continue;

    const fields: BuilderScenarioFieldChange[] = [];
    collectFieldChanges(beforeValue, afterValue, [], fields);
    fields.sort((left, right) => comparePath(left.path, right.path));
    bucket.push({
      category,
      collectionPath: [...collectionPath],
      id,
      change: 'changed',
      before: normalizedRecord(beforeValue),
      after: normalizedRecord(afterValue),
      fields,
    });
  }
}

function walkConfiguration(
  before: ComparableValue,
  after: ComparableValue,
  path: readonly string[],
  result: BuilderScenarioDiff,
): void {
  if (before !== MISSING && after !== MISSING && stableEqual(before, after)) return;

  if (before !== MISSING && after !== MISSING && Array.isArray(before) && Array.isArray(after)) {
    const beforeCollection = stableCollection(before);
    const afterCollection = stableCollection(after);
    const hasIdentifiedObject = before.length > 0 || after.length > 0;
    if (hasIdentifiedObject && beforeCollection && afterCollection) {
      compareStableCollections(beforeCollection, afterCollection, path, result);
      return;
    }
  }

  if (before !== MISSING && after !== MISSING && isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(compareText);
    for (const key of keys) {
      walkConfiguration(
        Object.hasOwn(before, key) ? before[key] : MISSING,
        Object.hasOwn(after, key) ? after[key] : MISSING,
        [...path, key],
        result,
      );
    }
    return;
  }

  result.fields.push(fieldChange(path, before, after));
}

function configurationProjection(snapshot: Readonly<BuilderScenarioConfigurationSnapshot>): Record<string, unknown> {
  const ethernet = Object.fromEntries(
    Object.entries(snapshot.ethernet).filter(([key]) => key !== 'layout'),
  );
  return {
    graph: snapshot.graph,
    addressing: snapshot.addressing,
    routing: snapshot.routing,
    ethernet,
    linkProfiles: snapshot.linkProfiles,
    acl: snapshot.acl,
    nat: snapshot.nat,
    dhcp: snapshot.dhcp,
    ipv6: snapshot.ipv6,
    services: snapshot.services ?? [],
    sourceId: snapshot.sourceId,
    destinationId: snapshot.destinationId,
  };
}

function compareObjectChange(left: BuilderScenarioObjectChange, right: BuilderScenarioObjectChange): number {
  return comparePath(left.collectionPath, right.collectionPath) || compareStableId(left.id, right.id);
}

export function compareBuilderScenarios(
  before: Readonly<BuilderScenarioConfigurationSnapshot>,
  after: Readonly<BuilderScenarioConfigurationSnapshot>,
): BuilderScenarioDiff {
  const result: BuilderScenarioDiff = {
    devices: [],
    links: [],
    configurationObjects: [],
    fields: [],
  };

  walkConfiguration(configurationProjection(before), configurationProjection(after), [], result);
  result.devices.sort(compareObjectChange);
  result.links.sort(compareObjectChange);
  result.configurationObjects.sort(compareObjectChange);
  result.fields.sort((left, right) => comparePath(left.path, right.path));
  return result;
}

export function compareBuilderScenarioConfigurations(
  before: Readonly<BuilderScenarioConfigurationSnapshot>,
  after: Readonly<BuilderScenarioConfigurationSnapshot>,
): BuilderScenarioDiff {
  return compareBuilderScenarios(before, after);
}

export function isBuilderScenarioDiffEmpty(diff: Readonly<BuilderScenarioDiff>): boolean {
  return diff.devices.length === 0
    && diff.links.length === 0
    && diff.configurationObjects.length === 0
    && diff.fields.length === 0;
}

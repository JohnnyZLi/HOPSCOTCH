import {
  createDefaultBuilderAddressing,
  validateBuilderAddressing,
  type BuilderAddressing,
} from './addressing.ts';
import {
  BUILDER_LIMITS,
  cloneBuilderGraph,
  defaultBuilderGraph,
  defaultBuilderLayout,
  type BuilderGraph,
  type BuilderLayout,
  type BuilderNode,
  type BuilderLink,
} from './model.ts';

export interface BuilderScenarioV1 {
  schema: 'hopscotch.builder';
  version: 1;
  name: string;
  nodes: BuilderNode[];
  links: BuilderLink[];
  sourceId: string;
  destinationId: string;
  layout: BuilderLayout;
  createdAt: string;
  updatedAt: string;
}

export interface BuilderScenarioV2 {
  schema: 'hopscotch.builder';
  version: 2;
  name: string;
  graph: BuilderGraph;
  sourceId: string;
  destinationId: string;
  layout: BuilderLayout;
  createdAt: string;
  updatedAt: string;
}

export interface BuilderScenarioV3 {
  schema: 'hopscotch.builder';
  version: 3;
  name: string;
  graph: BuilderGraph;
  addressing: BuilderAddressing;
  sourceId: string;
  destinationId: string;
  layout: BuilderLayout;
  createdAt: string;
  updatedAt: string;
}

export type BuilderScenario = BuilderScenarioV3;

const STORAGE_KEY = 'hopscotch.builder.scenarios.v3';
const LEGACY_STORAGE_KEY = 'hopscotch.builder.scenarios.v2';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string, max = 120): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new Error(`${label} must be a non-empty string under ${max + 1} characters.`);
  return value;
}

function assertTimestamp(value: unknown, label: string): string {
  const text = assertString(value, label, 80);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} must be an ISO-compatible timestamp.`);
  return text;
}

function validateGraph(value: unknown): BuilderGraph {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.links)) throw new Error('Scenario graph must contain node and link arrays.');
  if (value.nodes.length < 1 || value.nodes.length > BUILDER_LIMITS.maxNodes) throw new Error(`Scenario must contain 1–${BUILDER_LIMITS.maxNodes} nodes.`);
  if (value.links.length > BUILDER_LIMITS.maxLinks) throw new Error(`Scenario supports at most ${BUILDER_LIMITS.maxLinks} links.`);

  const ids = new Set<string>();
  const nodes: BuilderNode[] = value.nodes.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`Node ${index + 1} is invalid.`);
    const id = assertString(raw.id, `Node ${index + 1} id`, 48);
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`Node id ${id} contains unsupported characters.`);
    if (ids.has(id)) throw new Error(`Duplicate node id: ${id}.`);
    ids.add(id);
    const label = assertString(raw.label, `Node ${id} label`, 48);
    if (raw.kind !== 'router' && raw.kind !== 'endpoint') throw new Error(`Node ${id} kind must be router or endpoint.`);
    return { id, label, kind: raw.kind, builtin: raw.builtin === true };
  });

  const linkIds = new Set<string>();
  const pairs = new Set<string>();
  const links: BuilderLink[] = value.links.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`Link ${index + 1} is invalid.`);
    const id = assertString(raw.id, `Link ${index + 1} id`, 64);
    if (linkIds.has(id)) throw new Error(`Duplicate link id: ${id}.`);
    linkIds.add(id);
    const a = assertString(raw.a, `Link ${id} endpoint A`, 48);
    const b = assertString(raw.b, `Link ${id} endpoint B`, 48);
    if (!ids.has(a) || !ids.has(b)) throw new Error(`Link ${id} references a node that does not exist.`);
    if (a === b) throw new Error(`Link ${id} cannot connect a node to itself.`);
    const pair = [a, b].sort().join('\u0000');
    if (pairs.has(pair)) throw new Error(`Duplicate undirected link between ${a} and ${b}.`);
    pairs.add(pair);
    if (typeof raw.cost !== 'number' || !Number.isInteger(raw.cost) || raw.cost < BUILDER_LIMITS.minCost || raw.cost > BUILDER_LIMITS.maxCost) {
      throw new Error(`Link ${id} cost must be an integer from ${BUILDER_LIMITS.minCost} to ${BUILDER_LIMITS.maxCost}.`);
    }
    return { id, a, b, cost: raw.cost, failed: raw.failed === true, builtin: raw.builtin === true };
  });

  return { nodes, links };
}

function validateLayout(value: unknown, graph: BuilderGraph): BuilderLayout {
  if (!isRecord(value)) throw new Error('Scenario layout must be an object keyed by node id.');
  const ids = new Set(graph.nodes.map((node) => node.id));
  const layout: BuilderLayout = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!ids.has(id)) throw new Error(`Layout references unknown node ${id}.`);
    if (!isRecord(raw) || typeof raw.x !== 'number' || typeof raw.y !== 'number' || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) throw new Error(`Layout for ${id} must contain finite x/y coordinates.`);
    if (raw.x < BUILDER_LIMITS.minCoordinate || raw.x > BUILDER_LIMITS.maxCoordinate || raw.y < BUILDER_LIMITS.minCoordinate || raw.y > BUILDER_LIMITS.maxCoordinate) {
      throw new Error(`Layout for ${id} must stay within 0–100.`);
    }
    layout[id] = { x: raw.x, y: raw.y };
  }
  for (const node of graph.nodes) {
    if (!layout[node.id]) throw new Error(`Layout is missing node ${node.id}.`);
  }
  return layout;
}

function layoutForGraph(layout: BuilderLayout, graph: BuilderGraph): BuilderLayout {
  const scoped: BuilderLayout = {};
  for (const node of graph.nodes) {
    const point = layout[node.id];
    if (point) scoped[node.id] = { ...point };
  }
  return scoped;
}

function validateV3(raw: Record<string, unknown>): BuilderScenarioV3 {
  if (raw.schema !== 'hopscotch.builder' || raw.version !== 3) throw new Error('Unsupported HOPSCOTCH Builder schema/version.');
  const graph = validateGraph(raw.graph);
  const sourceId = assertString(raw.sourceId, 'sourceId', 48);
  const destinationId = assertString(raw.destinationId, 'destinationId', 48);
  const ids = new Set(graph.nodes.map((node) => node.id));
  if (!ids.has(sourceId) || !ids.has(destinationId)) throw new Error('Source and destination must reference nodes that exist.');
  if (!isRecord(raw.addressing) || !isRecord(raw.addressing.segments) || !isRecord(raw.addressing.defaultGateways)) {
    throw new Error('Builder schema v3 requires explicit L3 addressing.');
  }
  return {
    schema: 'hopscotch.builder',
    version: 3,
    name: assertString(raw.name, 'Scenario name', 80),
    graph,
    addressing: validateBuilderAddressing(graph, raw.addressing as unknown as BuilderAddressing),
    sourceId,
    destinationId,
    layout: validateLayout(raw.layout, graph),
    createdAt: assertTimestamp(raw.createdAt, 'createdAt'),
    updatedAt: assertTimestamp(raw.updatedAt, 'updatedAt'),
  };
}

function migrateV1(raw: Record<string, unknown>): BuilderScenarioV3 {
  const graph = validateGraph({ nodes: raw.nodes, links: raw.links });
  return validateV3({
    ...raw,
    version: 3,
    graph,
    addressing: createDefaultBuilderAddressing(graph),
  });
}

function migrateV2(raw: Record<string, unknown>): BuilderScenarioV3 {
  const graph = validateGraph(raw.graph);
  return validateV3({
    ...raw,
    version: 3,
    graph,
    addressing: createDefaultBuilderAddressing(graph),
  });
}

function normalizeScenarioRecord(raw: Record<string, unknown>): BuilderScenarioV3 {
  if (raw.version === 1) return migrateV1(raw);
  if (raw.version === 2) return migrateV2(raw);
  return validateV3(raw);
}

export function deserializeBuilderScenario(text: string): BuilderScenarioV3 {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Scenario file is not valid JSON.');
  }
  if (!isRecord(raw) || raw.schema !== 'hopscotch.builder') throw new Error('File is not a HOPSCOTCH Builder scenario.');
  return normalizeScenarioRecord(raw);
}

export function serializeBuilderScenario(scenario: BuilderScenarioV3): string {
  return JSON.stringify(validateV3(scenario as unknown as Record<string, unknown>), null, 2);
}

export function createBuilderScenario(
  name: string,
  graph: BuilderGraph,
  sourceId: string,
  destinationId: string,
  layout: BuilderLayout,
  addressing: BuilderAddressing = createDefaultBuilderAddressing(graph),
  existing?: BuilderScenarioV3,
): BuilderScenarioV3 {
  const now = new Date().toISOString();
  return validateV3({
    schema: 'hopscotch.builder',
    version: 3,
    name,
    graph: cloneBuilderGraph(graph),
    addressing,
    sourceId,
    destinationId,
    layout: layoutForGraph(layout, graph),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

function parseStoredList(rawText: string | null): BuilderScenarioV3[] {
  if (!rawText) return [];
  const parsed: unknown = JSON.parse(rawText);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    try {
      return isRecord(item) ? [normalizeScenarioRecord(item)] : [];
    } catch {
      return [];
    }
  });
}

export function listStoredBuilderScenarios(): BuilderScenarioV3[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = parseStoredList(window.localStorage.getItem(STORAGE_KEY));
    const legacy = parseStoredList(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    const byName = new Map<string, BuilderScenarioV3>();
    for (const scenario of [...current, ...legacy].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
      if (!byName.has(scenario.name)) byName.set(scenario.name, scenario);
    }
    return [...byName.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveStoredBuilderScenario(scenario: BuilderScenarioV3): BuilderScenarioV3[] {
  const validated = validateV3(scenario as unknown as Record<string, unknown>);
  const next = [validated, ...listStoredBuilderScenarios().filter((item) => item.name !== validated.name)].slice(0, 24);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  return next;
}

export function deleteStoredBuilderScenario(name: string): BuilderScenarioV3[] {
  const next = listStoredBuilderScenarios().filter((item) => item.name !== name);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  return next;
}

export function defaultBuilderScenario(): BuilderScenarioV3 {
  return createBuilderScenario('Default topology', defaultBuilderGraph, 'client', 'app', defaultBuilderLayout, createDefaultBuilderAddressing(defaultBuilderGraph));
}

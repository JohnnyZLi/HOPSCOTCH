import { validateBuilderAddressing, type BuilderAddressing } from './addressing.ts';
import type { BuilderAclConfig } from './acl.ts';
import type { BuilderHostedService } from './application.ts';
import type { BuilderDhcpConfig } from './dhcp.ts';
import { updateBuilderEthernetLink, type BuilderEthernetConfig } from './ethernet.ts';
import type { BuilderIpv6Config } from './ipv6.ts';
import type { BuilderLinkProfiles } from './link-characteristics.ts';
import { BUILDER_LIMITS, type BuilderGraph, type BuilderLayout, type BuilderLink, type BuilderNode, type BuilderPoint } from './model.ts';
import type { BuilderNatConfig } from './nat.ts';
import type { BuilderRoutingConfig } from './routing.ts';

export const BUILDER_AUTHORING_LIMITS = {
  historyEntries: 40,
  templates: 16,
  sites: 16,
  branches: 16,
  annotationLength: 96,
} as const;

export interface BuilderAuthoringSnapshot {
  graph: BuilderGraph;
  addressing: BuilderAddressing;
  routing: BuilderRoutingConfig;
  ethernet: BuilderEthernetConfig;
  linkProfiles: BuilderLinkProfiles;
  acl: BuilderAclConfig;
  nat: BuilderNatConfig;
  dhcp: BuilderDhcpConfig;
  ipv6: BuilderIpv6Config;
  services?: BuilderHostedService[];
  sourceId: string;
  destinationId: string;
  layout: BuilderLayout;
}

export interface BuilderAuthoringHistory {
  readonly entries: readonly BuilderAuthoringSnapshot[];
  readonly index: number;
}

export interface BuilderAuthoringClipboard {
  readonly nodes: readonly BuilderNode[];
  readonly links: readonly BuilderLink[];
  readonly layout: Readonly<Record<string, Readonly<BuilderPoint>>>;
}

export interface BuilderAuthoringPasteResult {
  graph: BuilderGraph;
  layout: BuilderLayout;
  selectedNodeIds: string[];
}

export type BuilderLayoutOperation = 'align-left' | 'align-right' | 'align-top' | 'align-bottom' | 'align-center-x' | 'align-center-y' | 'distribute-x' | 'distribute-y';

export interface BuilderAuthoringSite {
  id: string;
  label: string;
  nodeIds: string[];
  collapsed: boolean;
}

export interface BuilderAuthoringSiteBounds {
  id: string;
  label: string;
  collapsed: boolean;
  nodeCount: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BuilderAuthoringTemplate extends BuilderAuthoringClipboard {
  id: string;
  label: string;
}

export interface BuilderAuthoringBranch {
  id: string;
  label: string;
  snapshot: BuilderAuthoringSnapshot;
  createdAt: string;
}

export interface BuilderAuthoringCamera {
  x: number;
  y: number;
  scale: number;
}

export interface BuilderAuthoringSession {
  selection: string[];
  ethernetLinkSelection: string[];
  clipboard: BuilderAuthoringClipboard | null;
  sites: BuilderAuthoringSite[];
  annotations: Record<string, string>;
  showInterfaces: boolean;
  camera: BuilderAuthoringCamera;
  branches: BuilderAuthoringBranch[];
  baseline: BuilderAuthoringSnapshot | null;
}

const TEMPLATE_STORAGE_KEY = 'hopscotch.builder.authoring.templates.v1';

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function cloneSnapshot(snapshot: Readonly<BuilderAuthoringSnapshot>): BuilderAuthoringSnapshot {
  return cloneValue(snapshot);
}

export function createBuilderAuthoringSnapshot(snapshot: Readonly<BuilderAuthoringSnapshot>): BuilderAuthoringSnapshot {
  return cloneSnapshot(snapshot);
}

export function builderAuthoringSnapshotKey(snapshot: Readonly<BuilderAuthoringSnapshot>): string {
  return JSON.stringify(snapshot);
}

export function createBuilderAuthoringHistory(initial: Readonly<BuilderAuthoringSnapshot>): BuilderAuthoringHistory {
  return { entries: [cloneSnapshot(initial)], index: 0 };
}

export function recordBuilderAuthoringSnapshot(history: Readonly<BuilderAuthoringHistory>, snapshot: Readonly<BuilderAuthoringSnapshot>): BuilderAuthoringHistory {
  const current = history.entries[history.index];
  if (current && builderAuthoringSnapshotKey(current) === builderAuthoringSnapshotKey(snapshot)) return history;
  const entries = [...history.entries.slice(0, history.index + 1), cloneSnapshot(snapshot)].slice(-BUILDER_AUTHORING_LIMITS.historyEntries);
  return { entries, index: entries.length - 1 };
}

export function undoBuilderAuthoringHistory(history: Readonly<BuilderAuthoringHistory>): { history: BuilderAuthoringHistory; snapshot: BuilderAuthoringSnapshot | null } {
  if (history.index <= 0) return { history: { entries: [...history.entries], index: history.index }, snapshot: null };
  const index = history.index - 1;
  return { history: { entries: [...history.entries], index }, snapshot: cloneSnapshot(history.entries[index]) };
}

export function redoBuilderAuthoringHistory(history: Readonly<BuilderAuthoringHistory>): { history: BuilderAuthoringHistory; snapshot: BuilderAuthoringSnapshot | null } {
  if (history.index >= history.entries.length - 1) return { history: { entries: [...history.entries], index: history.index }, snapshot: null };
  const index = history.index + 1;
  return { history: { entries: [...history.entries], index }, snapshot: cloneSnapshot(history.entries[index]) };
}

export function createBuilderAuthoringSession(initialSelection: readonly string[] = []): BuilderAuthoringSession {
  return {
    selection: [...new Set(initialSelection)],
    ethernetLinkSelection: [],
    clipboard: null,
    sites: [],
    annotations: {},
    showInterfaces: false,
    camera: { x: 50, y: 50, scale: 1 },
    branches: [],
    baseline: null,
  };
}

export function reconcileBuilderAuthoringSession(session: Readonly<BuilderAuthoringSession>, graph: Readonly<BuilderGraph>, ethernet: Readonly<BuilderEthernetConfig>): BuilderAuthoringSession {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const ethernetLinkIds = new Set(ethernet.links.map((link) => link.id));
  const sites = session.sites
    .map((site) => ({ ...site, nodeIds: site.nodeIds.filter((id) => nodeIds.has(id)) }))
    .filter((site) => site.nodeIds.length > 0);
  const annotations = Object.fromEntries(Object.entries(session.annotations).filter(([id]) => nodeIds.has(id)));
  return {
    ...session,
    selection: session.selection.filter((id) => nodeIds.has(id)),
    ethernetLinkSelection: session.ethernetLinkSelection.filter((id) => ethernetLinkIds.has(id)),
    sites,
    annotations,
  };
}

export function copyBuilderTopologySelection(graph: Readonly<BuilderGraph>, layout: Readonly<BuilderLayout>, selectedNodeIds: readonly string[]): BuilderAuthoringClipboard | null {
  const selected = new Set(selectedNodeIds);
  const nodes = graph.nodes.filter((node) => selected.has(node.id)).map((node) => cloneValue(node));
  if (nodes.length === 0) return null;
  const links = graph.links.filter((link) => selected.has(link.a) && selected.has(link.b)).map((link) => cloneValue(link));
  const copiedLayout: Record<string, BuilderPoint> = {};
  for (const node of nodes) {
    const point = layout[node.id];
    if (point) copiedLayout[node.id] = { ...point };
  }
  return { nodes, links, layout: copiedLayout };
}

function nextCopyId(base: string, used: Set<string>): string {
  let index = 1;
  let candidate = `${base}-copy`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${base}-copy-${index}`;
  }
  used.add(candidate);
  return candidate;
}

function clampPoint(value: number): number {
  return Math.max(BUILDER_LIMITS.minCoordinate, Math.min(BUILDER_LIMITS.maxCoordinate, value));
}

export function pasteBuilderTopologySelection(graph: Readonly<BuilderGraph>, layout: Readonly<BuilderLayout>, clipboard: Readonly<BuilderAuthoringClipboard>, offset = 8): BuilderAuthoringPasteResult {
  if (graph.nodes.length + clipboard.nodes.length > BUILDER_LIMITS.maxNodes) throw new Error(`Paste would exceed the ${BUILDER_LIMITS.maxNodes}-node Builder ceiling.`);
  if (graph.links.length + clipboard.links.length > BUILDER_LIMITS.maxLinks) throw new Error(`Paste would exceed the ${BUILDER_LIMITS.maxLinks}-link Builder ceiling.`);
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const linkIds = new Set(graph.links.map((link) => link.id));
  const idMap = new Map<string, string>();
  const nodes = clipboard.nodes.map((node) => {
    const id = nextCopyId(node.id, nodeIds);
    idMap.set(node.id, id);
    return { ...cloneValue(node), id, label: `${node.label} COPY`, builtin: false };
  });
  const links = clipboard.links.map((link) => ({
    ...cloneValue(link),
    id: nextCopyId(link.id, linkIds),
    a: idMap.get(link.a) ?? link.a,
    b: idMap.get(link.b) ?? link.b,
    builtin: false,
  }));
  const nextLayout = cloneValue(layout) as BuilderLayout;
  for (const node of clipboard.nodes) {
    const targetId = idMap.get(node.id);
    const point = clipboard.layout[node.id];
    if (targetId && point) nextLayout[targetId] = { x: clampPoint(point.x + offset), y: clampPoint(point.y + offset) };
  }
  return { graph: { nodes: [...graph.nodes.map((node) => cloneValue(node)), ...nodes], links: [...graph.links.map((link) => cloneValue(link)), ...links] }, layout: nextLayout, selectedNodeIds: nodes.map((node) => node.id) };
}

export function applyBuilderLayoutOperation(layout: Readonly<BuilderLayout>, selectedNodeIds: readonly string[], operation: BuilderLayoutOperation): BuilderLayout {
  const next = cloneValue(layout) as BuilderLayout;
  const points = selectedNodeIds.flatMap((id) => next[id] ? [{ id, point: next[id] }] : []);
  if (points.length < 2) return next;
  const xs = points.map(({ point }) => point.x);
  const ys = points.map(({ point }) => point.y);
  const averageX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const averageY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  if (operation === 'align-left' || operation === 'align-right' || operation === 'align-center-x') {
    const target = operation === 'align-left' ? Math.min(...xs) : operation === 'align-right' ? Math.max(...xs) : averageX;
    for (const { id, point } of points) next[id] = { ...point, x: target };
  } else if (operation === 'align-top' || operation === 'align-bottom' || operation === 'align-center-y') {
    const target = operation === 'align-top' ? Math.min(...ys) : operation === 'align-bottom' ? Math.max(...ys) : averageY;
    for (const { id, point } of points) next[id] = { ...point, y: target };
  } else if (points.length >= 3) {
    const axis = operation === 'distribute-x' ? 'x' : 'y';
    const sorted = [...points].sort((left, right) => left.point[axis] - right.point[axis] || left.id.localeCompare(right.id));
    const first = sorted[0].point[axis];
    const last = sorted.at(-1)?.point[axis] ?? first;
    const step = (last - first) / (sorted.length - 1);
    sorted.forEach(({ id, point }, index) => { next[id] = { ...point, [axis]: first + step * index }; });
  }
  return next;
}

export function createBuilderAuthoringSite(sites: readonly BuilderAuthoringSite[], label: string, selectedNodeIds: readonly string[]): BuilderAuthoringSite[] {
  const nodeIds = [...new Set(selectedNodeIds)];
  if (nodeIds.length === 0) throw new Error('Select at least one routed device before creating a site.');
  if (sites.length >= BUILDER_AUTHORING_LIMITS.sites) throw new Error(`Authoring supports at most ${BUILDER_AUTHORING_LIMITS.sites} active sites.`);
  const used = new Set(sites.map((site) => site.id));
  let index = 1;
  while (used.has(`site-${index}`)) index += 1;
  const normalizedLabel = label.trim().slice(0, 48) || `SITE ${index}`;
  return [...sites, { id: `site-${index}`, label: normalizedLabel, nodeIds, collapsed: false }];
}

export function builderAuthoringSiteBounds(site: Readonly<BuilderAuthoringSite>, layout: Readonly<BuilderLayout>): BuilderAuthoringSiteBounds | null {
  const points = site.nodeIds.flatMap((id) => layout[id] ? [layout[id]] : []);
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const padding = 6;
  const left = clampPoint(minX - padding);
  const top = clampPoint(minY - padding);
  const right = clampPoint(maxX + padding);
  const bottom = clampPoint(maxY + padding);
  return { id: site.id, label: site.label, collapsed: site.collapsed, nodeCount: points.length, left, top, width: Math.max(4, right - left), height: Math.max(4, bottom - top) };
}

export function createBuilderAuthoringTemplate(templates: readonly BuilderAuthoringTemplate[], label: string, graph: Readonly<BuilderGraph>, layout: Readonly<BuilderLayout>, selectedNodeIds: readonly string[]): BuilderAuthoringTemplate[] {
  const clipboard = copyBuilderTopologySelection(graph, layout, selectedNodeIds);
  if (!clipboard) throw new Error('Select at least one routed device before saving a template.');
  if (templates.length >= BUILDER_AUTHORING_LIMITS.templates) throw new Error(`Authoring supports at most ${BUILDER_AUTHORING_LIMITS.templates} saved templates.`);
  const used = new Set(templates.map((template) => template.id));
  let index = 1;
  while (used.has(`template-${index}`)) index += 1;
  return [...templates, { ...clipboard, id: `template-${index}`, label: label.trim().slice(0, 48) || `TEMPLATE ${index}` }];
}

function isTemplate(value: unknown): value is BuilderAuthoringTemplate {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<BuilderAuthoringTemplate>;
  return typeof record.id === 'string' && typeof record.label === 'string' && Array.isArray(record.nodes) && Array.isArray(record.links) && Boolean(record.layout && typeof record.layout === 'object');
}

export function listStoredBuilderAuthoringTemplates(): BuilderAuthoringTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(TEMPLATE_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isTemplate).slice(0, BUILDER_AUTHORING_LIMITS.templates) : [];
  } catch { return []; }
}

export function saveStoredBuilderAuthoringTemplates(templates: readonly BuilderAuthoringTemplate[]): BuilderAuthoringTemplate[] {
  const next = cloneValue(templates.slice(0, BUILDER_AUTHORING_LIMITS.templates)) as BuilderAuthoringTemplate[];
  if (typeof window !== 'undefined') window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function createBuilderAuthoringBranch(branches: readonly BuilderAuthoringBranch[], label: string, snapshot: Readonly<BuilderAuthoringSnapshot>): BuilderAuthoringBranch[] {
  if (branches.length >= BUILDER_AUTHORING_LIMITS.branches) throw new Error(`Authoring supports at most ${BUILDER_AUTHORING_LIMITS.branches} in-session branches.`);
  const used = new Set(branches.map((branch) => branch.id));
  let index = 1;
  while (used.has(`branch-${index}`)) index += 1;
  return [...branches, { id: `branch-${index}`, label: label.trim().slice(0, 48) || `BRANCH ${index}`, snapshot: cloneSnapshot(snapshot), createdAt: new Date().toISOString() }];
}

export function bulkRenameBuilderNodes(graph: Readonly<BuilderGraph>, selectedNodeIds: readonly string[], prefix: string): BuilderGraph {
  const selected = new Set(selectedNodeIds);
  const normalized = prefix.trim().slice(0, 24);
  if (!normalized) throw new Error('Device label prefix cannot be empty.');
  let index = 0;
  const next = cloneValue(graph) as BuilderGraph;
  next.nodes = next.nodes.map((node) => selected.has(node.id) ? { ...node, label: `${normalized}${++index}`.slice(0, 48) } : node);
  return next;
}

export function bulkRenameBuilderInterfaces(graph: Readonly<BuilderGraph>, addressing: Readonly<BuilderAddressing>, selectedNodeIds: readonly string[], prefix: string): BuilderAddressing {
  const selected = new Set(selectedNodeIds);
  const normalized = prefix.trim().slice(0, 20);
  if (!normalized) throw new Error('Interface name prefix cannot be empty.');
  const next = cloneValue(addressing) as BuilderAddressing;
  const counters = new Map<string, number>();
  for (const segment of Object.values(next.segments).sort((left, right) => left.linkId.localeCompare(right.linkId))) {
    segment.interfaces = segment.interfaces.map((entry) => {
      if (!selected.has(entry.nodeId)) return { ...entry };
      const index = (counters.get(entry.nodeId) ?? 0) + 1;
      counters.set(entry.nodeId, index);
      return { ...entry, name: `${normalized}${index}`.slice(0, 32) };
    }) as typeof segment.interfaces;
  }
  return validateBuilderAddressing(graph as BuilderGraph, next);
}

export function bulkUpdateBuilderInternalLinks(graph: Readonly<BuilderGraph>, selectedNodeIds: readonly string[], patch: Readonly<{ cost?: number; failed?: boolean }>): BuilderGraph {
  const selected = new Set(selectedNodeIds);
  if (patch.cost != null && (!Number.isInteger(patch.cost) || patch.cost < BUILDER_LIMITS.minCost || patch.cost > BUILDER_LIMITS.maxCost)) throw new Error(`Link cost must be ${BUILDER_LIMITS.minCost}–${BUILDER_LIMITS.maxCost}.`);
  const next = cloneValue(graph) as BuilderGraph;
  next.links = next.links.map((link) => selected.has(link.a) && selected.has(link.b) ? { ...link, ...patch } : link);
  return next;
}

export function bulkUpdateBuilderEthernetLinks(config: Readonly<BuilderEthernetConfig>, linkIds: readonly string[], patch: Parameters<typeof updateBuilderEthernetLink>[2]): BuilderEthernetConfig {
  let next = cloneValue(config) as BuilderEthernetConfig;
  for (const id of [...new Set(linkIds)].sort()) next = updateBuilderEthernetLink(next, id, patch);
  return next;
}

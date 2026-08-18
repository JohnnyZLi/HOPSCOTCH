import type { BuilderNode, BuilderNodeKind, BuilderPoint } from './model.ts';

export type BuilderTopologyMatchKind = 'exact' | 'prefix' | 'substring';
export type BuilderTopologyMatchField = 'id' | 'label' | 'name';

export interface BuilderTopologySearchNode extends BuilderNode {
  readonly name?: string;
}

export interface BuilderTopologyGraphView {
  readonly nodes: readonly BuilderTopologySearchNode[];
}

export type BuilderTopologyLayoutView = Readonly<Record<string, Readonly<BuilderPoint> | undefined>>;

export interface BuilderTopologyZoomTarget {
  readonly deviceId: string;
  readonly x: number;
  readonly y: number;
}

export interface BuilderTopologySearchResult {
  readonly deviceId: string;
  readonly label: string;
  readonly name?: string;
  readonly kind: BuilderNodeKind;
  readonly matchKind: BuilderTopologyMatchKind;
  readonly matchedField: BuilderTopologyMatchField;
  readonly zoomTarget: BuilderTopologyZoomTarget;
}

const MATCH_RANK: Record<BuilderTopologyMatchKind, number> = {
  exact: 0,
  prefix: 1,
  substring: 2,
};

const FIELD_RANK: Record<BuilderTopologyMatchField, number> = {
  id: 0,
  label: 1,
  name: 2,
};

interface RankedMatch {
  kind: BuilderTopologyMatchKind;
  field: BuilderTopologyMatchField;
}

interface RankedResult extends BuilderTopologySearchResult {
  rank: number;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalized(value: string): string {
  return value.toLowerCase();
}

function optionalNodeName(node: BuilderTopologySearchNode): string | undefined {
  const trimmed = node.name?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > 0 ? trimmed : undefined;
}

function classifyMatch(value: string, query: string): BuilderTopologyMatchKind | null {
  const candidate = normalized(value);
  if (candidate === query) return 'exact';
  if (candidate.startsWith(query)) return 'prefix';
  if (candidate.includes(query)) return 'substring';
  return null;
}

function bestNodeMatch(node: BuilderTopologySearchNode, name: string | undefined, query: string): RankedMatch | null {
  const fields: Array<{ field: BuilderTopologyMatchField; value: string }> = [
    { field: 'id', value: node.id },
    { field: 'label', value: node.label },
  ];
  if (name) fields.push({ field: 'name', value: name });

  let best: RankedMatch | null = null;
  for (const entry of fields) {
    const kind = classifyMatch(entry.value, query);
    if (!kind) continue;
    if (
      !best
      || MATCH_RANK[kind] < MATCH_RANK[best.kind]
      || (MATCH_RANK[kind] === MATCH_RANK[best.kind] && FIELD_RANK[entry.field] < FIELD_RANK[best.field])
    ) {
      best = { kind, field: entry.field };
    }
  }
  return best;
}

export function getBuilderTopologyZoomTarget(
  graph: BuilderTopologyGraphView,
  layout: BuilderTopologyLayoutView,
  deviceId: string,
): BuilderTopologyZoomTarget | null {
  const matchingNodes = graph.nodes.filter((node) => node.id === deviceId);
  if (matchingNodes.length !== 1 || !Object.prototype.hasOwnProperty.call(layout, deviceId)) return null;

  const point = layout[deviceId];
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

  return { deviceId, x: point.x, y: point.y };
}

export function searchBuilderTopology(
  graph: BuilderTopologyGraphView,
  layout: BuilderTopologyLayoutView,
  query: string,
): BuilderTopologySearchResult[] {
  const normalizedQuery = normalized(query.trim());
  if (normalizedQuery.length === 0) return [];

  const ranked: RankedResult[] = [];
  for (const node of graph.nodes) {
    const zoomTarget = getBuilderTopologyZoomTarget(graph, layout, node.id);
    if (!zoomTarget) continue;

    const name = optionalNodeName(node);
    const match = bestNodeMatch(node, name, normalizedQuery);
    if (!match) continue;

    ranked.push({
      deviceId: node.id,
      label: node.label,
      ...(name ? { name } : {}),
      kind: node.kind,
      matchKind: match.kind,
      matchedField: match.field,
      zoomTarget,
      rank: MATCH_RANK[match.kind],
    });
  }

  ranked.sort((left, right) => (
    left.rank - right.rank
    || compareText(normalized(left.deviceId), normalized(right.deviceId))
    || compareText(left.deviceId, right.deviceId)
  ));

  return ranked.map(({ rank: _rank, ...result }) => result);
}

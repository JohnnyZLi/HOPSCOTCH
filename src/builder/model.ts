export type BuilderNodeKind = 'router' | 'endpoint';

export interface BuilderNode {
  id: string;
  label: string;
  kind: BuilderNodeKind;
  builtin?: boolean;
}

export interface BuilderLink {
  id: string;
  a: string;
  b: string;
  cost: number;
  failed: boolean;
  builtin?: boolean;
}

export interface BuilderGraph {
  nodes: BuilderNode[];
  links: BuilderLink[];
}

export interface BuilderPoint {
  x: number;
  y: number;
}

export type BuilderLayout = Record<string, BuilderPoint>;

export interface BuilderRouteStep {
  linkId: string;
  from: string;
  to: string;
  cost: number;
}

export interface BuilderRoute {
  reachable: boolean;
  nodeIds: string[];
  linkIds: string[];
  totalCost: number | null;
  steps: BuilderRouteStep[];
  explanation: string;
}

export const BUILDER_LIMITS = {
  minCost: 1,
  maxCost: 999,
  maxNodes: 32,
  maxLinks: 96,
  minCoordinate: 0,
  maxCoordinate: 100,
} as const;

export const defaultBuilderGraph: BuilderGraph = {
  nodes: [
    { id: 'client', label: 'CLIENT', kind: 'endpoint', builtin: true },
    { id: 'edge', label: 'EDGE', kind: 'router', builtin: true },
    { id: 'r1', label: 'R1', kind: 'router', builtin: true },
    { id: 'r2', label: 'R2', kind: 'router', builtin: true },
    { id: 'core', label: 'CORE', kind: 'router', builtin: true },
    { id: 'app', label: 'APP', kind: 'endpoint', builtin: true },
  ],
  links: [
    { id: 'client-edge', a: 'client', b: 'edge', cost: 1, failed: false, builtin: true },
    { id: 'edge-r1', a: 'edge', b: 'r1', cost: 10, failed: false, builtin: true },
    { id: 'r1-core', a: 'r1', b: 'core', cost: 10, failed: false, builtin: true },
    { id: 'edge-r2', a: 'edge', b: 'r2', cost: 30, failed: false, builtin: true },
    { id: 'r2-core', a: 'r2', b: 'core', cost: 20, failed: false, builtin: true },
    { id: 'r1-r2', a: 'r1', b: 'r2', cost: 12, failed: false, builtin: true },
    { id: 'core-app', a: 'core', b: 'app', cost: 1, failed: false, builtin: true },
  ],
};

export const defaultBuilderLayout: BuilderLayout = {
  client: { x: 8, y: 50 },
  edge: { x: 24, y: 50 },
  r1: { x: 44, y: 30 },
  r2: { x: 44, y: 70 },
  core: { x: 68, y: 50 },
  app: { x: 90, y: 50 },
};

export function cloneBuilderGraph(graph: BuilderGraph): BuilderGraph {
  return {
    nodes: graph.nodes.map((node) => ({ ...node })),
    links: graph.links.map((link) => ({ ...link })),
  };
}

export function cloneBuilderLayout(layout: BuilderLayout): BuilderLayout {
  return Object.fromEntries(Object.entries(layout).map(([id, point]) => [id, { ...point }]));
}

function stablePathKey(path: string[]): string {
  return path.join('\u0000');
}

export function findShortestPath(graph: BuilderGraph, sourceId: string, destinationId: string): BuilderRoute {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(sourceId) || !nodeIds.has(destinationId)) {
    return {
      reachable: false,
      nodeIds: [],
      linkIds: [],
      totalCost: null,
      steps: [],
      explanation: 'Select two nodes that still exist in the graph.',
    };
  }

  if (sourceId === destinationId) {
    return {
      reachable: true,
      nodeIds: [sourceId],
      linkIds: [],
      totalCost: 0,
      steps: [],
      explanation: 'Source and destination are the same node. Total cost 0.',
    };
  }

  type Candidate = { nodeId: string; cost: number; nodePath: string[]; linkPath: string[] };
  const best = new Map<string, Candidate>();
  const settled = new Set<string>();
  best.set(sourceId, { nodeId: sourceId, cost: 0, nodePath: [sourceId], linkPath: [] });

  const adjacency = new Map<string, Array<{ neighbor: string; link: BuilderLink }>>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const link of graph.links) {
    if (link.failed || !nodeIds.has(link.a) || !nodeIds.has(link.b)) continue;
    adjacency.get(link.a)?.push({ neighbor: link.b, link });
    adjacency.get(link.b)?.push({ neighbor: link.a, link });
  }
  for (const neighbors of adjacency.values()) {
    neighbors.sort((left, right) => left.neighbor.localeCompare(right.neighbor) || left.link.id.localeCompare(right.link.id));
  }

  while (settled.size < graph.nodes.length) {
    let current: Candidate | undefined;
    for (const candidate of best.values()) {
      if (settled.has(candidate.nodeId)) continue;
      if (!current || candidate.cost < current.cost || (candidate.cost === current.cost && stablePathKey(candidate.nodePath).localeCompare(stablePathKey(current.nodePath)) < 0)) {
        current = candidate;
      }
    }
    if (!current) break;
    if (current.nodeId === destinationId) break;
    settled.add(current.nodeId);

    for (const edge of adjacency.get(current.nodeId) ?? []) {
      if (settled.has(edge.neighbor)) continue;
      const next: Candidate = {
        nodeId: edge.neighbor,
        cost: current.cost + edge.link.cost,
        nodePath: [...current.nodePath, edge.neighbor],
        linkPath: [...current.linkPath, edge.link.id],
      };
      const prior = best.get(edge.neighbor);
      if (!prior || next.cost < prior.cost || (next.cost === prior.cost && stablePathKey(next.nodePath).localeCompare(stablePathKey(prior.nodePath)) < 0)) {
        best.set(edge.neighbor, next);
      }
    }
  }

  const winner = best.get(destinationId);
  if (!winner) {
    return {
      reachable: false,
      nodeIds: [],
      linkIds: [],
      totalCost: null,
      steps: [],
      explanation: `${sourceId.toUpperCase()} and ${destinationId.toUpperCase()} are partitioned by the current failures/topology.`,
    };
  }

  const linksById = new Map(graph.links.map((link) => [link.id, link]));
  const steps = winner.linkPath.map((linkId, index): BuilderRouteStep => {
    const link = linksById.get(linkId);
    return {
      linkId,
      from: winner.nodePath[index],
      to: winner.nodePath[index + 1],
      cost: link?.cost ?? 0,
    };
  });
  const equation = steps.map((step) => step.cost).join(' + ');
  return {
    reachable: true,
    nodeIds: winner.nodePath,
    linkIds: winner.linkPath,
    totalCost: winner.cost,
    steps,
    explanation: `${winner.nodePath.map((id) => id.toUpperCase()).join(' → ')} · ${equation || '0'} = ${winner.cost}`,
  };
}

export function undirectedLinkExists(graph: BuilderGraph, a: string, b: string): boolean {
  return graph.links.some((link) => (link.a === a && link.b === b) || (link.a === b && link.b === a));
}

export function nextGeneratedNodeId(graph: BuilderGraph, kind: BuilderNodeKind): string {
  const prefix = kind === 'router' ? 'r' : 'host';
  let index = 3;
  while (graph.nodes.some((node) => node.id === `${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

export function nextGeneratedLinkId(graph: BuilderGraph, a: string, b: string): string {
  const base = `${[a, b].sort().join('-')}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  let candidate = base;
  let index = 2;
  while (graph.links.some((link) => link.id === candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

export function deterministicNewNodePoint(index: number): BuilderPoint {
  const column = index % 4;
  const row = Math.floor(index / 4) % 3;
  return { x: 32 + column * 14, y: 20 + row * 30 };
}

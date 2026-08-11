import { BUILDER_LIMITS, findShortestPath, type BuilderGraph, type BuilderLayout } from '../builder/model.ts';
import type { AsRelationship, AsRole, SimulatedAsGraph } from '../internet/asModel.ts';

export const STRESS_AS_NODE_COUNT = 160;
export const STRESS_AS_RELATIONSHIP_COUNT = 220;
export const STRESS_AS_SOURCE = 4200000000;
export const STRESS_AS_DESTINATION = 4200000007;

function stressAsRole(index: number): AsRole {
  if (index === 0) return 'access';
  if (index === 7) return 'content';
  if (index < 8) return index < 3 ? 'regional' : index < 5 ? 'transit' : 'content';
  return (['access', 'regional', 'transit', 'content', 'exchange-adjacent'] as const)[index % 5];
}

function buildStressAsGraph(): SimulatedAsGraph {
  const nodes = Array.from({ length: STRESS_AS_NODE_COUNT }, (_, index) => {
    const column = index % 16;
    const row = Math.floor(index / 16);
    return {
      asn: STRESS_AS_SOURCE + index,
      label: `STRESS AS${STRESS_AS_SOURCE + index}`,
      role: stressAsRole(index),
      x: 4 + column * 6.1,
      y: 6 + row * 9.7,
    };
  });

  const relationships: AsRelationship[] = [
    { id: 'stress-backbone-0', kind: 'customer-provider', customer: STRESS_AS_SOURCE, provider: STRESS_AS_SOURCE + 1 },
    { id: 'stress-backbone-1', kind: 'customer-provider', customer: STRESS_AS_SOURCE + 1, provider: STRESS_AS_SOURCE + 2 },
    { id: 'stress-backbone-2', kind: 'peer', a: STRESS_AS_SOURCE + 2, b: STRESS_AS_SOURCE + 3 },
    { id: 'stress-backbone-3', kind: 'customer-provider', customer: STRESS_AS_SOURCE + 4, provider: STRESS_AS_SOURCE + 3 },
    { id: 'stress-backbone-4', kind: 'customer-provider', customer: STRESS_AS_SOURCE + 5, provider: STRESS_AS_SOURCE + 4 },
    { id: 'stress-backbone-5', kind: 'customer-provider', customer: STRESS_AS_SOURCE + 6, provider: STRESS_AS_SOURCE + 5 },
    { id: 'stress-backbone-6', kind: 'customer-provider', customer: STRESS_AS_DESTINATION, provider: STRESS_AS_SOURCE + 6 },
  ];

  for (let index = 8; index < STRESS_AS_NODE_COUNT; index += 1) {
    const providerIndex = 1 + ((index * 7) % 7);
    relationships.push({
      id: `stress-spoke-${index}`,
      kind: 'customer-provider',
      customer: STRESS_AS_SOURCE + index,
      provider: STRESS_AS_SOURCE + providerIndex,
    });
  }

  let peerIndex = 0;
  for (let left = 8; relationships.length < STRESS_AS_RELATIONSHIP_COUNT && left < STRESS_AS_NODE_COUNT; left += 2) {
    const right = 8 + ((left - 8 + 17) % (STRESS_AS_NODE_COUNT - 8));
    if (left === right) continue;
    relationships.push({
      id: `stress-peer-${peerIndex++}`,
      kind: 'peer',
      a: STRESS_AS_SOURCE + left,
      b: STRESS_AS_SOURCE + right,
    });
  }

  if (nodes.length !== STRESS_AS_NODE_COUNT || relationships.length !== STRESS_AS_RELATIONSHIP_COUNT) {
    throw new Error('Dense AS fixture count drifted.');
  }
  return { nodes, relationships };
}

export const denseAsStressGraph = buildStressAsGraph();

export const STRESS_BUILDER_NODE_COUNT = BUILDER_LIMITS.maxNodes;
export const STRESS_BUILDER_LINK_COUNT = BUILDER_LIMITS.maxLinks;
export const STRESS_BUILDER_SOURCE = 'stress-node-00';
export const STRESS_BUILDER_DESTINATION = `stress-node-${String(STRESS_BUILDER_NODE_COUNT - 1).padStart(2, '0')}`;

function builderNodeId(index: number): string {
  return `stress-node-${String(index).padStart(2, '0')}`;
}

function buildDenseBuilderFixture(): { graph: BuilderGraph; layout: BuilderLayout } {
  const nodes: BuilderGraph['nodes'] = Array.from({ length: STRESS_BUILDER_NODE_COUNT }, (_, index) => ({
    id: builderNodeId(index),
    label: index === 0 ? 'STRESS SOURCE' : index === STRESS_BUILDER_NODE_COUNT - 1 ? 'STRESS DEST' : `R${String(index).padStart(2, '0')}`,
    kind: index === 0 || index === STRESS_BUILDER_NODE_COUNT - 1 ? 'endpoint' : 'router',
    builtin: false,
  }));
  const links: BuilderGraph['links'] = [];
  const seen = new Set<string>();
  const add = (a: number, b: number, cost: number) => {
    if (a === b || links.length >= STRESS_BUILDER_LINK_COUNT) return;
    const low = Math.min(a, b); const high = Math.max(a, b); const key = `${low}:${high}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ id: `stress-link-${String(links.length).padStart(3, '0')}`, a: builderNodeId(a), b: builderNodeId(b), cost, failed: false });
  };
  for (let index = 0; index < STRESS_BUILDER_NODE_COUNT - 1; index += 1) add(index, index + 1, 2 + (index % 5));
  for (let stride = 2; links.length < STRESS_BUILDER_LINK_COUNT; stride += 1) {
    for (let index = 0; index < STRESS_BUILDER_NODE_COUNT && links.length < STRESS_BUILDER_LINK_COUNT; index += 1) {
      add(index, (index + stride) % STRESS_BUILDER_NODE_COUNT, 7 + ((index + stride) % 11));
    }
  }
  const layout: BuilderLayout = Object.fromEntries(nodes.map((node, index) => {
    const column = index % 8; const row = Math.floor(index / 8);
    return [node.id, { x: 7 + column * 12.2, y: 12 + row * 24 }];
  }));
  const graph = { nodes, links };
  if (graph.nodes.length !== STRESS_BUILDER_NODE_COUNT || graph.links.length !== STRESS_BUILDER_LINK_COUNT) throw new Error('Dense Builder fixture count drifted.');
  const route = findShortestPath(graph, STRESS_BUILDER_SOURCE, STRESS_BUILDER_DESTINATION);
  if (!route.reachable) throw new Error('Dense Builder fixture must remain routable.');
  return { graph, layout };
}

const denseBuilder = buildDenseBuilderFixture();
export const denseBuilderStressGraph = denseBuilder.graph;
export const denseBuilderStressLayout = denseBuilder.layout;

export interface StressFacility {
  id: number;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  networkCount: number | null;
  exchangeCount: number | null;
}

export const STRESS_FACILITY_COUNT = 2000;

function buildStressFacilities(): StressFacility[] {
  const golden = 137.50776405003785;
  return Array.from({ length: STRESS_FACILITY_COUNT }, (_, index) => {
    const y = 1 - (2 * (index + 0.5)) / STRESS_FACILITY_COUNT;
    const latitude = Math.asin(y) * 180 / Math.PI;
    const longitude = ((index * golden + 180) % 360) - 180;
    return {
      id: 900000 + index,
      name: `SIMULATED STRESS FACILITY ${String(index + 1).padStart(4, '0')}`,
      city: 'TEST FIXTURE',
      country: 'SIMULATED',
      latitude,
      longitude,
      networkCount: 20 + (index % 480),
      exchangeCount: 1 + (index % 18),
    };
  });
}

export const densePhysicalStressFacilities = buildStressFacilities();

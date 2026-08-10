export type AsRole = 'access' | 'regional' | 'transit' | 'content' | 'exchange-adjacent';
export type AsRelationshipKind = 'customer-provider' | 'peer';
export type TraversalKind = 'up' | 'peer' | 'down';

export interface SimulatedAsNode {
  asn: number;
  label: string;
  role: AsRole;
  x: number;
  y: number;
}

export interface CustomerProviderRelationship {
  id: string;
  kind: 'customer-provider';
  customer: number;
  provider: number;
}

export interface PeerRelationship {
  id: string;
  kind: 'peer';
  a: number;
  b: number;
}

export type AsRelationship = CustomerProviderRelationship | PeerRelationship;

export interface SimulatedAsGraph {
  nodes: SimulatedAsNode[];
  relationships: AsRelationship[];
}

export interface AsPathHop {
  relationshipId: string;
  from: number;
  to: number;
  traversal: TraversalKind;
}

export interface AsPathCandidate {
  asns: number[];
  relationshipIds: string[];
  hops: AsPathHop[];
  localPreference: number;
  scoreLabel: string;
}

function documentationAsns(): number[] {
  return [
    ...Array.from({ length: 16 }, (_, index) => 64496 + index),
    ...Array.from({ length: 16 }, (_, index) => 65536 + index),
  ];
}

function roleFor(asn: number): AsRole {
  if (asn >= 64496 && asn <= 64499) return 'access';
  if (asn >= 64500 && asn <= 64503) return 'regional';
  if (asn >= 64504 && asn <= 64507) return 'transit';
  if (asn >= 64508 && asn <= 64511) return 'content';
  if (asn === 65538 || asn === 65539 || asn >= 65548) return 'content';
  if (asn >= 65540 && asn <= 65543) return 'transit';
  if (asn >= 65544 && asn <= 65547) return 'regional';
  return 'access';
}

function buildNodes(): SimulatedAsNode[] {
  return documentationAsns().map((asn, index) => {
    const side = index < 16 ? 0 : 1;
    const local = index % 16;
    const column = local % 4;
    const row = Math.floor(local / 4);
    const x = side === 0 ? 10 + column * 10.5 : 57 + column * 10.5;
    const y = 16 + row * 22;
    return { asn, label: `AS${asn}`, role: roleFor(asn), x, y };
  });
}

function cp(id: string, customer: number, provider: number): CustomerProviderRelationship {
  return { id, kind: 'customer-provider', customer, provider };
}

function peer(id: string, a: number, b: number): PeerRelationship {
  return { id, kind: 'peer', a, b };
}

function buildRelationships(): AsRelationship[] {
  const relationships: AsRelationship[] = [
    cp('src-p1', 64496, 64500),
    cp('src-p2', 64496, 64501),
    peer('p1-content', 64500, 65538),
    peer('p2-cross', 64501, 65540),
    cp('content-upstream', 65538, 65540),
    cp('a1-p1', 64497, 64500), cp('a1-p2', 64497, 64502),
    cp('a2-p1', 64498, 64501), cp('a2-p2', 64498, 64503),
    cp('a3-p1', 64499, 64502), cp('a3-p2', 64499, 64503),
    cp('reg0-t0', 64500, 64504), cp('reg0-t1', 64500, 64505),
    cp('reg1-t0', 64501, 64504), cp('reg1-t1', 64501, 64506),
    cp('reg2-t0', 64502, 64505), cp('reg2-t1', 64502, 64507),
    cp('reg3-t0', 64503, 64506), cp('reg3-t1', 64503, 64507),
    peer('ta-0-1', 64504, 64505), peer('ta-1-2', 64505, 64506), peer('ta-2-3', 64506, 64507), peer('ta-3-0', 64507, 64504),
    cp('ca0', 64508, 64504), cp('ca1', 64509, 64505), cp('ca2', 64510, 64506), cp('ca3', 64511, 64507),
    cp('baccess0', 65536, 65544), cp('baccess0b', 65536, 65545),
    cp('baccess1', 65537, 65544), cp('baccess1b', 65537, 65546),
    cp('breg0', 65544, 65540), cp('breg1', 65545, 65541), cp('breg2', 65546, 65542), cp('breg3', 65547, 65543),
    peer('tb-0-1', 65540, 65541), peer('tb-1-2', 65541, 65542), peer('tb-2-3', 65542, 65543), peer('tb-3-0', 65543, 65540),
    peer('cross-t0', 64504, 65540), peer('cross-t1', 64505, 65541), peer('cross-t2', 64506, 65542), peer('cross-t3', 64507, 65543),
    cp('cb1', 65539, 65541), cp('cb2', 65548, 65540), cp('cb3', 65549, 65541), cp('cb4', 65550, 65542), cp('cb5', 65551, 65543),
  ];
  return relationships;
}

export const simulatedAsGraph: SimulatedAsGraph = {
  nodes: buildNodes(),
  relationships: buildRelationships(),
};

export const DEFAULT_AS_SOURCE = 64496;
export const DEFAULT_AS_DESTINATION = 65538;

function endpoints(relationship: AsRelationship): [number, number] {
  return relationship.kind === 'peer' ? [relationship.a, relationship.b] : [relationship.customer, relationship.provider];
}

export function traversalFor(relationship: AsRelationship, from: number, to: number): TraversalKind | null {
  if (relationship.kind === 'peer') {
    return (relationship.a === from && relationship.b === to) || (relationship.b === from && relationship.a === to) ? 'peer' : null;
  }
  if (relationship.customer === from && relationship.provider === to) return 'up';
  if (relationship.provider === from && relationship.customer === to) return 'down';
  return null;
}

function validNextTraversal(phase: TraversalKind | 'start', next: TraversalKind): boolean {
  if (phase === 'start') return true;
  if (phase === 'up') return next === 'up' || next === 'peer' || next === 'down';
  if (phase === 'peer') return next === 'down';
  return next === 'down';
}

function nextPhase(current: TraversalKind | 'start', next: TraversalKind): TraversalKind {
  if (next === 'down') return 'down';
  if (next === 'peer') return 'peer';
  return current === 'start' ? 'up' : current;
}

function firstHopPreference(hop: AsPathHop | undefined): number {
  if (!hop) return 400;
  if (hop.traversal === 'down') return 300;
  if (hop.traversal === 'peer') return 200;
  return 100;
}

export function enumeratePolicyPaths(graph: SimulatedAsGraph, source: number, destination: number, failedRelationshipIds: Set<string> = new Set(), maxHops = 7): AsPathCandidate[] {
  if (source === destination) return [{ asns: [source], relationshipIds: [], hops: [], localPreference: 400, scoreLabel: 'LOCAL · 0 AS HOPS' }];
  const adjacency = new Map<number, AsRelationship[]>();
  graph.nodes.forEach((node) => adjacency.set(node.asn, []));
  graph.relationships.forEach((relationship) => {
    if (failedRelationshipIds.has(relationship.id)) return;
    const [a, b] = endpoints(relationship);
    adjacency.get(a)?.push(relationship);
    adjacency.get(b)?.push(relationship);
  });
  adjacency.forEach((items) => items.sort((a, b) => a.id.localeCompare(b.id)));

  const candidates: AsPathCandidate[] = [];
  const visit = (current: number, asns: number[], relationshipIds: string[], hops: AsPathHop[], phase: TraversalKind | 'start') => {
    if (relationshipIds.length > maxHops) return;
    if (current === destination) {
      const localPreference = firstHopPreference(hops[0]);
      candidates.push({ asns: [...asns], relationshipIds: [...relationshipIds], hops: [...hops], localPreference, scoreLabel: `LOCAL PREF ${localPreference} · ${relationshipIds.length} AS HOPS` });
      return;
    }
    if (relationshipIds.length === maxHops) return;
    for (const relationship of adjacency.get(current) ?? []) {
      const [a, b] = endpoints(relationship);
      const next = a === current ? b : b === current ? a : null;
      if (next === null || asns.includes(next)) continue;
      const traversal = traversalFor(relationship, current, next);
      if (!traversal || !validNextTraversal(phase, traversal)) continue;
      visit(next, [...asns, next], [...relationshipIds, relationship.id], [...hops, { relationshipId: relationship.id, from: current, to: next, traversal }], nextPhase(phase, traversal));
    }
  };
  visit(source, [source], [], [], 'start');
  return candidates.sort((left, right) => right.localPreference - left.localPreference || left.relationshipIds.length - right.relationshipIds.length || left.asns.join('-').localeCompare(right.asns.join('-'))).slice(0, 12);
}

export function relationshipLabel(relationship: AsRelationship, from?: number): string {
  if (relationship.kind === 'peer') return 'PEER';
  if (from === undefined) return 'CUSTOMER / PROVIDER';
  return relationship.customer === from ? 'TO PROVIDER' : 'TO CUSTOMER';
}

export function relationshipEndpoints(relationship: AsRelationship): [number, number] {
  return endpoints(relationship);
}

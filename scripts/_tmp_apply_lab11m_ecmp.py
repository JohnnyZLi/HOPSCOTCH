from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')

def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:100]!r}')
    write(path, text.replace(old, new, 1))

def regex_replace_once(path, pattern, replacement, flags=0):
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one regex match, found {count}: {pattern[:120]!r}')
    write(path, next_text)

routing = 'src/builder/routing.ts'
replace_once(routing, "export interface BuilderForwardingHop {\n  nodeId: string;\n  nodeLabel: string;\n  routeSource: 'endpoint-local' | 'default-gateway' | BuilderRouteSource;\n  matchedPrefix: string | null;\n  nextHop: string | null;\n  outgoingInterface: string | null;\n  linkId: string | null;\n  nextNodeId: string | null;\n}\n", "export interface BuilderForwardingHop {\n  nodeId: string;\n  nodeLabel: string;\n  routeSource: 'endpoint-local' | 'default-gateway' | BuilderRouteSource;\n  matchedPrefix: string | null;\n  nextHop: string | null;\n  outgoingInterface: string | null;\n  linkId: string | null;\n  nextNodeId: string | null;\n  ecmpCandidateCount?: number;\n  ecmpSelectedIndex?: number | null;\n  ecmpFlowHash?: number | null;\n  ecmpFlowKey?: string | null;\n}\n")
replace_once(routing, "export interface BuilderForwardingTrace {\n  reachable: boolean;\n  sourceNodeId: string;\n  destinationNodeId: string;\n  destinationAddress: string | null;\n  hops: BuilderForwardingHop[];\n  failureNodeId: string | null;\n  failureReason: string | null;\n  explanation: string;\n}\n", "export interface BuilderForwardingTrace {\n  reachable: boolean;\n  sourceNodeId: string;\n  destinationNodeId: string;\n  destinationAddress: string | null;\n  hops: BuilderForwardingHop[];\n  failureNodeId: string | null;\n  failureReason: string | null;\n  explanation: string;\n}\n\nexport interface BuilderFlowKey {\n  sourceAddress?: string | null;\n  destinationAddress?: string | null;\n  protocol?: string | null;\n  sourcePort?: number | null;\n  destinationPort?: number | null;\n  discriminator?: string | number | null;\n}\n\nexport interface BuilderRouteSelection {\n  route: BuilderRouteTableEntry | null;\n  candidates: BuilderRouteTableEntry[];\n  flowKey: string | null;\n  flowHash: number | null;\n  selectedIndex: number | null;\n}\n")
replace_once(routing, "interface OspfRouterPath {\n  reachable: boolean;\n  nodeIds: string[];\n  linkIds: string[];\n  totalCost: number;\n}\n", "interface OspfRouterFirstHop {\n  nextRouterId: string;\n  linkId: string;\n}\n\ninterface OspfRouterPathSet {\n  reachable: boolean;\n  totalCost: number;\n  firstHops: OspfRouterFirstHop[];\n}\n")

new_ospf_helpers = r'''function ospfAdjacencyMap(
  graph: BuilderGraph,
  routing: BuilderRoutingConfig,
): Map<string, Array<{ neighbor: string; linkId: string; cost: number }>> {
  const enabled = enabledOspfSet(routing);
  const adjacency = new Map<string, Array<{ neighbor: string; linkId: string; cost: number }>>();
  for (const routerId of enabled) adjacency.set(routerId, []);
  for (const link of graph.links) {
    if (link.failed || !enabled.has(link.a) || !enabled.has(link.b)) continue;
    if (nodeById(graph, link.a)?.kind !== 'router' || nodeById(graph, link.b)?.kind !== 'router') continue;
    adjacency.get(link.a)?.push({ neighbor: link.b, linkId: link.id, cost: link.cost });
    adjacency.get(link.b)?.push({ neighbor: link.a, linkId: link.id, cost: link.cost });
  }
  for (const neighbors of adjacency.values()) neighbors.sort((a, b) => a.neighbor.localeCompare(b.neighbor) || a.linkId.localeCompare(b.linkId));
  return adjacency;
}

function ospfDistances(
  adjacency: Map<string, Array<{ neighbor: string; linkId: string; cost: number }>>,
  startRouterId: string,
): Map<string, number> {
  const distances = new Map<string, number>();
  const settled = new Set<string>();
  for (const routerId of adjacency.keys()) distances.set(routerId, Number.POSITIVE_INFINITY);
  if (!adjacency.has(startRouterId)) return distances;
  distances.set(startRouterId, 0);
  while (settled.size < adjacency.size) {
    let currentId: string | null = null;
    let currentCost = Number.POSITIVE_INFINITY;
    for (const [routerId, cost] of distances) {
      if (settled.has(routerId)) continue;
      if (cost < currentCost || (cost === currentCost && currentId !== null && routerId.localeCompare(currentId) < 0)) {
        currentId = routerId;
        currentCost = cost;
      }
    }
    if (currentId === null || !Number.isFinite(currentCost)) break;
    settled.add(currentId);
    for (const edge of adjacency.get(currentId) ?? []) {
      const nextCost = currentCost + edge.cost;
      if (nextCost < (distances.get(edge.neighbor) ?? Number.POSITIVE_INFINITY)) distances.set(edge.neighbor, nextCost);
    }
  }
  return distances;
}

function ospfRouterFirstHops(
  graph: BuilderGraph,
  routing: BuilderRoutingConfig,
  sourceRouterId: string,
  destinationRouterId: string,
): OspfRouterPathSet {
  if (sourceRouterId === destinationRouterId) return { reachable: true, totalCost: 0, firstHops: [] };
  const enabled = enabledOspfSet(routing);
  if (!enabled.has(sourceRouterId) || !enabled.has(destinationRouterId)) return { reachable: false, totalCost: 0, firstHops: [] };
  const adjacency = ospfAdjacencyMap(graph, routing);
  const fromSource = ospfDistances(adjacency, sourceRouterId);
  const toDestination = ospfDistances(adjacency, destinationRouterId);
  const totalCost = fromSource.get(destinationRouterId) ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(totalCost)) return { reachable: false, totalCost: 0, firstHops: [] };
  const firstHops = (adjacency.get(sourceRouterId) ?? [])
    .filter((edge) => edge.cost + (toDestination.get(edge.neighbor) ?? Number.POSITIVE_INFINITY) === totalCost)
    .map((edge) => ({ nextRouterId: edge.neighbor, linkId: edge.linkId }))
    .sort((a, b) => a.nextRouterId.localeCompare(b.nextRouterId) || a.linkId.localeCompare(b.linkId));
  return { reachable: firstHops.length > 0, totalCost, firstHops };
}
'''
regex_replace_once(routing, r"function ospfRouterPath\([\s\S]*?\n}\n\nfunction remoteInterfaceForNextHop\(", new_ospf_helpers + "\nfunction remoteInterfaceForNextHop(")

new_ospf_routes = r'''function ospfRouteEntriesForBuilderRouter(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  routerId: string,
): BuilderRouteTableEntry[] {
  const enabled = enabledOspfSet(routing);
  if (!enabled.has(routerId)) return [];
  const directlyConnected = new Set(interfacesForBuilderNode(addressing, routerId).map((entry) => parseBuilderIpv4Cidr(entry.cidr).cidr));
  const state = builderOspfState(graph, addressing, routing);
  const candidates: BuilderRouteTableEntry[] = [];

  for (const advertisement of state.advertisements) {
    if (advertisement.routerId === routerId || directlyConnected.has(advertisement.prefix)) continue;
    const paths = ospfRouterFirstHops(graph, routing, routerId, advertisement.routerId);
    if (!paths.reachable || paths.firstHops.length === 0) continue;
    const parsed = parseRoutePrefix(advertisement.prefix);
    for (const firstHop of paths.firstHops) {
      const segment = addressing.segments[firstHop.linkId];
      const local = segment?.interfaces.find((entry) => entry.nodeId === routerId);
      const remote = segment?.interfaces.find((entry) => entry.nodeId === firstHop.nextRouterId);
      if (!segment || !local || !remote) continue;
      candidates.push({
        id: `ospf:${routerId}:${parsed.cidr}:${advertisement.routerId}:${firstHop.nextRouterId}:${firstHop.linkId}`.replace(/\//g, ':'),
        routerId,
        prefix: parsed.cidr,
        prefixLength: parsed.prefixLength,
        source: 'ospf',
        administrativeDistance: 110,
        metric: paths.totalCost + advertisement.metric,
        nextHop: remote.address,
        outgoingInterface: local.name,
        linkId: firstHop.linkId,
        active: true,
        stateNote: `OSPF AREA 0 · ORIGIN ${nodeById(graph, advertisement.routerId)?.label ?? advertisement.routerId}`,
      });
    }
  }

  const byPrefix = new Map<string, BuilderRouteTableEntry[]>();
  for (const candidate of candidates) {
    const list = byPrefix.get(candidate.prefix) ?? [];
    list.push(candidate);
    byPrefix.set(candidate.prefix, list);
  }
  const winners: BuilderRouteTableEntry[] = [];
  for (const prefixCandidates of byPrefix.values()) {
    const bestMetric = Math.min(...prefixCandidates.map((candidate) => candidate.metric));
    const byNextHop = new Map<string, BuilderRouteTableEntry>();
    for (const candidate of prefixCandidates.filter((entry) => entry.metric === bestMetric).sort((a, b) => a.id.localeCompare(b.id))) {
      const key = `${candidate.nextHop ?? ''}\u0000${candidate.linkId}`;
      if (!byNextHop.has(key)) byNextHop.set(key, candidate);
    }
    const equal = [...byNextHop.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const candidate of equal) {
      winners.push({ ...candidate, stateNote: `${candidate.stateNote}${equal.length > 1 ? ` · ECMP ${equal.length}-WAY` : ''}` });
    }
  }
  return winners;
}
'''
regex_replace_once(routing, r"function ospfRouteEntriesForBuilderRouter\([\s\S]*?\n}\n\nexport function upsertBuilderStaticRoute", new_ospf_routes + "\nexport function upsertBuilderStaticRoute")

new_selector = r'''function compareBuilderRoutePreference(left: BuilderRouteTableEntry, right: BuilderRouteTableEntry): number {
  return right.prefixLength - left.prefixLength
    || left.administrativeDistance - right.administrativeDistance
    || left.metric - right.metric
    || left.id.localeCompare(right.id);
}

export function builderEcmpRoutesForDestination(
  entries: readonly BuilderRouteTableEntry[],
  destinationAddress: string,
): BuilderRouteTableEntry[] {
  const matches = entries.filter((entry) => entry.active && prefixContains(parseRoutePrefix(entry.prefix), destinationAddress)).sort(compareBuilderRoutePreference);
  const best = matches[0];
  if (!best) return [];
  return matches
    .filter((entry) => entry.prefix === best.prefix && entry.prefixLength === best.prefixLength && entry.administrativeDistance === best.administrativeDistance && entry.metric === best.metric)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function builderStableFlowHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function canonicalBuilderFlowKey(flowKey: BuilderFlowKey | string | null | undefined, destinationAddress: string): string | null {
  if (flowKey == null) return null;
  if (typeof flowKey === 'string') return flowKey;
  const protocol = String(flowKey.protocol ?? 'ip').trim().toLowerCase() || 'ip';
  const sourceAddress = String(flowKey.sourceAddress ?? '').trim();
  const resolvedDestination = String(flowKey.destinationAddress ?? destinationAddress).trim();
  const sourcePort = flowKey.sourcePort == null ? '' : String(flowKey.sourcePort);
  const destinationPort = flowKey.destinationPort == null ? '' : String(flowKey.destinationPort);
  const discriminator = flowKey.discriminator == null ? '' : String(flowKey.discriminator);
  return `${protocol}|${sourceAddress}|${resolvedDestination}|${sourcePort}|${destinationPort}|${discriminator}`;
}

export function selectBuilderRouteWithDecision(
  entries: readonly BuilderRouteTableEntry[],
  destinationAddress: string,
  flowKey: BuilderFlowKey | string | null = null,
): BuilderRouteSelection {
  const candidates = builderEcmpRoutesForDestination(entries, destinationAddress);
  if (candidates.length === 0) return { route: null, candidates: [], flowKey: null, flowHash: null, selectedIndex: null };
  const canonical = canonicalBuilderFlowKey(flowKey, destinationAddress);
  if (candidates.length === 1 || canonical === null) return { route: candidates[0], candidates, flowKey: canonical, flowHash: null, selectedIndex: 0 };
  const flowHash = builderStableFlowHash(canonical);
  const selectedIndex = flowHash % candidates.length;
  return { route: candidates[selectedIndex], candidates, flowKey: canonical, flowHash, selectedIndex };
}

export function selectBuilderRoute(
  entries: readonly BuilderRouteTableEntry[],
  destinationAddress: string,
  flowKey: BuilderFlowKey | string | null = null,
): BuilderRouteTableEntry | null {
  return selectBuilderRouteWithDecision(entries, destinationAddress, flowKey).route;
}
'''
regex_replace_once(routing, r"export function selectBuilderRoute\([\s\S]*?\n}\n\nfunction remoteNodeOnLink", new_selector + "\nfunction remoteNodeOnLink")

replace_once(routing, "  destinationNodeId: string,\n  ospfTopologyGraph: BuilderGraph = graph,\n): BuilderForwardingTrace {", "  destinationNodeId: string,\n  ospfTopologyGraph: BuilderGraph = graph,\n  flowKey: BuilderFlowKey | string | null = null,\n): BuilderForwardingTrace {")
replace_once(routing, "    const table = routeTableForBuilderRouter(graph, addressing, routing, currentNodeId, ospfTopologyGraph);\n    const selected = selectBuilderRoute(table, destinationAddress);\n    if (!selected) return forwardingFailure", "    const table = routeTableForBuilderRouter(graph, addressing, routing, currentNodeId, ospfTopologyGraph);\n    const selection = selectBuilderRouteWithDecision(table, destinationAddress, flowKey);\n    const selected = selection.route;\n    if (!selected) return forwardingFailure")
replace_once(routing, "    hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: selected.source, matchedPrefix: selected.prefix, nextHop, outgoingInterface: selected.outgoingInterface, linkId: selected.linkId, nextNodeId });", "    hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: selected.source, matchedPrefix: selected.prefix, nextHop, outgoingInterface: selected.outgoingInterface, linkId: selected.linkId, nextNodeId, ecmpCandidateCount: selection.candidates.length, ecmpSelectedIndex: selection.selectedIndex, ecmpFlowHash: selection.flowHash, ecmpFlowKey: selection.flowKey });")

acl = 'src/builder/acl.ts'
replace_once(acl, "import { traceBuilderForwarding, type BuilderForwardingTrace, type BuilderRoutingConfig } from './routing.ts';", "import { traceBuilderForwarding, type BuilderFlowKey, type BuilderForwardingTrace, type BuilderRoutingConfig } from './routing.ts';")
replace_once(acl, "  protocol: BuilderAclProtocol='ip',\n  destinationPort: number|null=null,\n): BuilderPolicyTrace {", "  protocol: BuilderAclProtocol='ip',\n  destinationPort: number|null=null,\n  flowKey: BuilderFlowKey | string | null = null,\n): BuilderPolicyTrace {")
replace_once(acl, "  const forwarding=traceBuilderForwarding(graph,addressing,routing,sourceNodeId,destinationNodeId);", "  const forwarding=traceBuilderForwarding(graph,addressing,routing,sourceNodeId,destinationNodeId,graph,flowKey);")

probes = 'src/builder/probes.ts'
text = read(probes)
text = text.replace("traceBuilderPolicy(graph,addressing,routing,acl,sourceNodeId,destinationNodeId,'icmp');", "traceBuilderPolicy(graph,addressing,routing,acl,sourceNodeId,destinationNodeId,'icmp',null,`icmp|${sourceNodeId}|${destinationNodeId}|${sequence}|request`);")
text = text.replace("traceBuilderForwarding(graph,addressing,routing,sourceNodeId,destinationNodeId);", "traceBuilderForwarding(graph,addressing,routing,sourceNodeId,destinationNodeId,graph,`icmp|${sourceNodeId}|${destinationNodeId}|${sequence}|request`);")
text = text.replace("traceBuilderPolicy(graph,addressing,routing,acl,destinationNodeId,sourceNodeId,'icmp');", "traceBuilderPolicy(graph,addressing,routing,acl,destinationNodeId,sourceNodeId,'icmp',null,`icmp|${destinationNodeId}|${sourceNodeId}|${sequence}|reply`);")
text = text.replace("traceBuilderPolicy(graph,addressing,routing,acl,nodeId,sourceNodeId,'icmp');", "traceBuilderPolicy(graph,addressing,routing,acl,nodeId,sourceNodeId,'icmp',null,`icmp|${nodeId}|${sourceNodeId}|${sequence}|ttl-${ttl}-reply`);")
text = text.replace("traceBuilderForwarding(graph,addressing,routing,nodeId,sourceNodeId);", "traceBuilderForwarding(graph,addressing,routing,nodeId,sourceNodeId,graph,`icmp|${nodeId}|${sourceNodeId}|${sequence}|ttl-${ttl}-reply`);")
write(probes, text)

panel = r'''import { useMemo, useState } from 'react';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderGraph } from './builder/model.ts';
import { traceBuilderForwarding, type BuilderRoutingConfig } from './builder/routing.ts';

function labelFor(graph: BuilderGraph, id: string | null): string {
  if (!id) return '—';
  return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase();
}

function firstEcmpHop(graph: BuilderGraph, addressing: BuilderAddressing, routing: BuilderRoutingConfig, sourceId: string, destinationId: string, flowKey: string) {
  const trace = traceBuilderForwarding(graph, addressing, routing, sourceId, destinationId, graph, flowKey);
  const hop = trace.hops.find((entry) => (entry.ecmpCandidateCount ?? 0) > 1) ?? null;
  return { trace, hop };
}

export function BuilderOspfEcmpPanel({ graph, addressing, routing, sourceId, destinationId }: { graph: BuilderGraph; addressing: BuilderAddressing; routing: BuilderRoutingConfig; sourceId: string; destinationId: string }) {
  const [flowKey, setFlowKey] = useState('tcp|client|app|49152|443');
  const current = useMemo(() => firstEcmpHop(graph, addressing, routing, sourceId, destinationId, flowKey), [graph, addressing, routing, sourceId, destinationId, flowKey]);
  const samples = useMemo(() => Array.from({ length: 8 }, (_, index) => {
    const key = `tcp|client|app|${49152 + index}|443`;
    const result = firstEcmpHop(graph, addressing, routing, sourceId, destinationId, key);
    return { key, hop: result.hop, trace: result.trace };
  }), [graph, addressing, routing, sourceId, destinationId]);
  if (routing.ospf.enabledRouterIds.length === 0) return null;
  const ecmpHop = current.hop;
  const selected = ecmpHop?.nextNodeId ?? null;
  const distinctSampleNextHops = [...new Set(samples.flatMap((sample) => sample.hop?.nextNodeId ? [sample.hop.nextNodeId] : []))];
  return <section className="builder-ospf-section">
    <div className="control-title"><span>OSPF ECMP</span><strong>{ecmpHop ? `${ecmpHop.ecmpCandidateCount}-WAY` : 'NO EQUAL-COST SET'}</strong></div>
    <label>FLOW HASH KEY<input value={flowKey} onChange={(event) => setFlowKey(event.currentTarget.value)} /></label>
    <div className="builder-ospf-facts">
      <div><span>DECISION POINT</span><strong>{ecmpHop ? labelFor(graph, ecmpHop.nodeId) : '—'}</strong></div>
      <div><span>SELECTED NEXT HOP</span><strong>{selected ? labelFor(graph, selected) : '—'}</strong></div>
      <div><span>HASH</span><strong>{ecmpHop?.ecmpFlowHash == null ? '—' : `0x${ecmpHop.ecmpFlowHash.toString(16).padStart(8, '0')}`}</strong></div>
      <div><span>SAMPLE SPREAD</span><strong>{distinctSampleNextHops.length > 0 ? distinctSampleNextHops.map((id) => labelFor(graph, id)).join(' · ') : '—'}</strong></div>
    </div>
    <div className="builder-ospf-neighbors">{samples.map((sample, index) => <div key={sample.key} className={sample.trace.reachable ? 'full' : 'down'}><span>FLOW {index + 1}</span><strong>{sample.hop ? `${labelFor(graph, sample.hop.nodeId)} → ${labelFor(graph, sample.hop.nextNodeId)}` : sample.trace.reachable ? 'NO ECMP HOP' : 'UNREACHABLE'}</strong><small>{sample.key} {sample.hop?.ecmpFlowHash == null ? '' : `· HASH ${sample.hop.ecmpFlowHash.toString(16).padStart(8, '0')}`}</small></div>)}</div>
    <small className="builder-routing-note">PER-FLOW, NOT PER-PACKET · LONGEST PREFIX / AD / METRIC CHOOSE THE ECMP SET FIRST · A STABLE FNV-1A HASH THEN CHOOSES ONE SORTED NEXT HOP. CHANGE LINK COSTS SO TWO OSPF PATHS TIE TO SEE THE SAMPLE FLOWS DISTRIBUTE.</small>
  </section>;
}
'''
write('src/BuilderOspfEcmpPanel.tsx', panel)

network = 'src/NetworkBuilder.tsx'
replace_once(network, "import { BuilderOspfTimingPanel } from './BuilderOspfTimingPanel.tsx';", "import { BuilderOspfTimingPanel } from './BuilderOspfTimingPanel.tsx';\nimport { BuilderOspfEcmpPanel } from './BuilderOspfEcmpPanel.tsx';")
replace_once(network, "SINGLE-AREA BASE MODEL · ROUTER-ROUTER ADJACENCIES · TIMED FAILURE INSPECTOR BELOW · ECMP / MULTI-AREA STILL DEFERRED.", "SINGLE-AREA OSPF · EQUAL-COST ROUTES INSTALL AS ONE ECMP SET · FLOW HASHING INSPECTOR BELOW · MULTI-AREA STILL DEFERRED.")
replace_once(network, "          <BuilderOspfTimingPanel graph={graph} addressing={addressing} routing={routing} sourceId={sourceId} destinationId={destinationId}/>", "          <BuilderOspfEcmpPanel graph={graph} addressing={addressing} routing={routing} sourceId={sourceId} destinationId={destinationId}/>\n          <BuilderOspfTimingPanel graph={graph} addressing={addressing} routing={routing} sourceId={sourceId} destinationId={destinationId}/>")
replace_once(network, "LOOKUP: LONGEST PREFIX → AD → METRIC. CONNECTED AD 0 · STATIC AD 1 · OSPF AD 110. OSPF SPF USES LINK COST.", "LOOKUP: LONGEST PREFIX → AD → METRIC → ECMP FLOW HASH. CONNECTED AD 0 · STATIC AD 1 · OSPF AD 110. OSPF SPF USES LINK COST; EQUAL BEST OSPF NEXT HOPS STAY INSTALLED TOGETHER.")

contract = r'''import assert from 'node:assert/strict';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import {
  builderEcmpRoutesForDestination,
  createDefaultBuilderRoutingConfig,
  routeTableForBuilderRouter,
  selectBuilderRouteWithDecision,
  setBuilderOspfEverywhere,
  traceBuilderForwarding,
  upsertBuilderStaticRoute,
} from '../src/builder/routing.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
for (const link of graph.links) {
  if (link.id === 'edge-r2' || link.id === 'r2-core') link.cost = 10;
}
const addressing = createDefaultBuilderAddressing(graph);
let routing = setBuilderOspfEverywhere(graph, addressing, createDefaultBuilderRoutingConfig(), true);
const appInterface = interfacesForBuilderNode(addressing, 'app')[0];
assert.ok(appInterface, 'APP must have an IPv4 interface');
const appPrefix = addressing.segments[appInterface.linkId].cidr;
const appAddress = appInterface.address;

const edgeTable = routeTableForBuilderRouter(graph, addressing, routing, 'edge');
const ecmp = builderEcmpRoutesForDestination(edgeTable, appAddress);
assert.equal(ecmp.length, 2, 'equal EDGE→R1→CORE and EDGE→R2→CORE paths must install two equal OSPF next hops');
assert.deepEqual(new Set(ecmp.map((entry) => entry.linkId)), new Set(['edge-r1', 'edge-r2']));
assert.ok(ecmp.every((entry) => entry.source === 'ospf' && entry.prefix === appPrefix && entry.administrativeDistance === 110));
assert.equal(new Set(ecmp.map((entry) => entry.metric)).size, 1, 'ECMP members must have identical metric');
assert.ok(ecmp.every((entry) => entry.stateNote.includes('ECMP 2-WAY')));

const observed = new Map();
for (let index = 0; index < 256 && observed.size < 2; index += 1) {
  const key = `tcp|client|app|${49152 + index}|443`;
  const decision = selectBuilderRouteWithDecision(edgeTable, appAddress, key);
  assert.equal(decision.candidates.length, 2);
  assert.ok(decision.route);
  assert.ok(decision.flowHash != null);
  observed.set(decision.route.linkId, key);
  const repeated = selectBuilderRouteWithDecision(edgeTable, appAddress, key);
  assert.equal(repeated.route?.id, decision.route.id, 'same flow key must stay pinned to the same ECMP member');
  assert.equal(repeated.flowHash, decision.flowHash);
}
assert.deepEqual(new Set(observed.keys()), new Set(['edge-r1', 'edge-r2']), 'bounded deterministic sample must exercise both ECMP members');

for (const [linkId, key] of observed) {
  const trace = traceBuilderForwarding(graph, addressing, routing, 'client', 'app', graph, key);
  assert.equal(trace.reachable, true);
  const nodes = [trace.sourceNodeId, ...trace.hops.map((hop) => hop.nextNodeId).filter(Boolean)];
  assert.ok(nodes.includes(linkId === 'edge-r1' ? 'r1' : 'r2'));
  const edgeHop = trace.hops.find((hop) => hop.nodeId === 'edge');
  assert.equal(edgeHop?.ecmpCandidateCount, 2);
  assert.equal(edgeHop?.linkId, linkId);
  assert.ok(edgeHop?.ecmpFlowHash != null);
}

const reversed = cloneBuilderGraph(graph);
reversed.links.reverse();
for (const [linkId, key] of observed) {
  const original = traceBuilderForwarding(graph, addressing, routing, 'client', 'app', graph, key);
  const reordered = traceBuilderForwarding(reversed, addressing, routing, 'client', 'app', reversed, key);
  assert.equal(reordered.hops.find((hop) => hop.nodeId === 'edge')?.linkId, original.hops.find((hop) => hop.nodeId === 'edge')?.linkId, 'link-array order must not change flow hashing');
}

const failed = cloneBuilderGraph(graph);
failed.links.find((link) => link.id === 'edge-r1').failed = true;
const failedTable = routeTableForBuilderRouter(failed, addressing, routing, 'edge');
const survivors = builderEcmpRoutesForDestination(failedTable, appAddress);
assert.equal(survivors.length, 1);
assert.equal(survivors[0].linkId, 'edge-r2');
for (const key of observed.values()) {
  const trace = traceBuilderForwarding(failed, addressing, routing, 'client', 'app', failed, key);
  assert.equal(trace.reachable, true);
  assert.equal(trace.hops.find((hop) => hop.nodeId === 'edge')?.linkId, 'edge-r2', 'all flows must converge onto the surviving member after OSPF recomputation');
}

const r1Address = addressing.segments['edge-r1'].interfaces.find((entry) => entry.nodeId === 'r1')?.address;
assert.ok(r1Address);
routing = upsertBuilderStaticRoute(graph, addressing, routing, { routerId: 'edge', prefix: appPrefix, nextHop: r1Address, metric: 1 });
const staticTable = routeTableForBuilderRouter(graph, addressing, routing, 'edge');
const staticWinner = selectBuilderRouteWithDecision(staticTable, appAddress, observed.values().next().value ?? 'flow').route;
assert.equal(staticWinner?.source, 'static', 'AD 1 static route must outrank the OSPF ECMP set');
assert.equal(staticWinner?.linkId, 'edge-r1');

console.log('Builder OSPF ECMP contract passed: equal-cost next-hop installation, deterministic per-flow hashing, stable ordering, member failure convergence, and static-route AD precedence.');
'''
write('scripts/builder-ospf-ecmp-contract-check.mjs', contract)

package = 'package.json'
text = read(package)
text = text.replace('npm run test:builder-ospf-timing-contract && npm run test:builder-probes-contract', 'npm run test:builder-ospf-timing-contract && npm run test:builder-ospf-ecmp-contract && npm run test:builder-probes-contract')
text = text.replace('"test:builder-ospf-timing-contract": "node scripts/builder-ospf-timing-contract-check.mjs"', '"test:builder-ospf-timing-contract": "node scripts/builder-ospf-timing-contract-check.mjs",\n    "test:builder-ospf-ecmp-contract": "node scripts/builder-ospf-ecmp-contract-check.mjs"')
write(package, text)

roadmap = 'docs/ROADMAP.md'
replace_once(roadmap, '- [ ] equal-cost multipath with deterministic per-flow selection', '- [x] equal-cost multipath with deterministic per-flow selection')

lab = 'docs/LAB11M.md'
text = read(lab)
text = text.replace('# Lab 11M — OSPF convergence timing', '# Lab 11M — OSPF depth + convergence timing')
text = text.replace('## Implemented in this slice', '## Timed convergence foundation')
insert = '''\n## ECMP + deterministic per-flow forwarding\n\n- SPF keeps every equal-cost first hop for a best OSPF prefix instead of collapsing ties to a lexical winner.\n- Route selection still applies longest prefix, administrative distance, and metric first; hashing happens only inside that equal-best set.\n- A stable FNV-1a flow hash selects one member from next hops sorted by stable route identity. Reordering the graph/link arrays cannot move a flow.\n- The same flow key remains pinned to one ECMP member until the candidate set changes. Different flow keys can distribute across different members without per-packet spraying.\n- If one ECMP member fails and OSPF recomputes, the surviving member becomes the only eligible next hop. Static AD 1 still outranks OSPF AD 110.\n- Network Builder exposes an OSPF ECMP inspector with a user-editable flow key plus a small deterministic flow sample so equal-cost paths are visible rather than hidden in the route table.\n- Active ICMP probes provide stable per-probe flow keys to ordinary routed/ACL forwarding. NAT-aware probes retain the NAT engine's existing tuple/session truth.\n\nECMP is forwarding behavior derived from OSPF route state, so it adds no new persisted scenario configuration and does not require a schema bump.\n'''
text = text.replace('## Default teaching timers', insert + '\n## Default teaching timers')
text = text.replace('- equal-cost multipath with deterministic flow hashing\n', '')
write(lab, text)

print('Lab 11M ECMP slice applied.')

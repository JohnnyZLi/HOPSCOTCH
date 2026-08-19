import { builderBgpState } from './bgp.ts';
import { diagnoseBuilderApplicationTransaction } from './causal-diagnosis.ts';
import { builderStpState } from './stp.ts';
import { builderOspfv3DepthRouteOverlay, builderOspfv3DepthSummary } from './ipv6-routing-depth.ts';
import { routeTableForBuilderIpv6Router } from './ipv6.ts';
import { builderOspfState, routeTableForBuilderRouter } from './routing.ts';
import type { BuilderDeviceRef, BuilderDeviceWorkbenchInput, BuilderWorkbenchRow, BuilderWorkbenchSection, BuilderWorkbenchWhyStep } from './device-workbench.ts';

function why(id: string, source: BuilderWorkbenchWhyStep['source'], label: string, detail: string): BuilderWorkbenchWhyStep {
  return { id, source, label, detail };
}

function row(id: string, label: string, value: string, detail: string, status: BuilderWorkbenchRow['status'] = 'normal', chain: BuilderWorkbenchWhyStep[] = []): BuilderWorkbenchRow {
  return { id, label, value, detail, status, why: chain };
}

function section(id: string, title: string, rows: BuilderWorkbenchRow[]): BuilderWorkbenchSection | null {
  return rows.length > 0 ? { id, title, summary: `${rows.length} item${rows.length === 1 ? '' : 's'}`, rows } : null;
}

function latestApplication(input: BuilderDeviceWorkbenchInput) {
  return (input.applicationHistory ?? []).at(-1) ?? null;
}

function applicationApplies(input: BuilderDeviceWorkbenchInput, device: BuilderDeviceRef): boolean {
  const transaction = latestApplication(input);
  if (!transaction) return false;
  if (device.plane === 'routed') {
    return transaction.sourceNodeId === device.id || transaction.destinationNodeId === device.id || transaction.stages.some((stage) => stage.nodeIds.includes(device.id));
  }
  return transaction.stages.some((stage) => stage.nodeIds.includes(device.id));
}

export function builderProtocolDatabaseSection(input: BuilderDeviceWorkbenchInput, device: BuilderDeviceRef): BuilderWorkbenchSection | null {
  const rows: BuilderWorkbenchRow[] = [];
  if (device.plane === 'routed') {
    const node = input.graph.nodes.find((candidate) => candidate.id === device.id);
    if (!node) return null;
    if (node.kind === 'router') {
      const ospf = builderOspfState(input.truthGraphs?.controlGraph ?? input.graph, input.addressing, input.routing);
      const ospfNeighbors = ospf.adjacencies.filter((entry) => entry.aRouterId === device.id || entry.bRouterId === device.id);
      const ospfLsas = ospf.advertisements.filter((entry) => entry.routerId === device.id);
      const ospfRoutes = routeTableForBuilderRouter(input.truthGraphs?.ribGraph ?? input.graph, input.addressing, input.routing, device.id).filter((entry) => entry.source === 'ospf' && entry.active);
      rows.push(row('db:ospf', 'OSPF DATABASE', `${ospfNeighbors.filter((entry) => entry.state === 'FULL').length}/${ospfNeighbors.length} FULL · ${ospfLsas.length} SELF PREFIXES · ${ospfRoutes.length} ACTIVE ROUTES`, 'Neighbor state, current self-originated LSDB view, and active OSPF RIB entries are counted from the selected canonical timeline snapshot.', ospfNeighbors.some((entry) => entry.state !== 'FULL') ? 'warn' : 'good', [why('db:ospf:control', 'STATE', 'CONTROL PLANE SNAPSHOT', 'Counts use the selected control-plane truth graph rather than the live final topology.'), why('db:ospf:rib', 'STATE', 'RIB SNAPSHOT', 'Active OSPF routes use the selected RIB truth graph.')]));

      const ospfv3 = builderOspfv3DepthSummary(input.graph, input.ipv6, input.ipv6RoutingDepth);
      const ospfv3Neighbors = ospfv3.adjacencies.filter((entry) => entry.aRouterId === device.id || entry.bRouterId === device.id);
      const overlay = builderOspfv3DepthRouteOverlay(input.graph, input.ipv6, input.ipv6RoutingDepth);
      const ospfv3Routes = input.ipv6.enabled ? routeTableForBuilderIpv6Router(input.graph, input.ipv6, device.id, overlay).filter((entry) => entry.source === 'ospfv3' && entry.active) : [];
      rows.push(row('db:ospfv3', 'OSPFV3 DATABASE', `${ospfv3Neighbors.filter((entry) => entry.phase === 'FULL').length}/${ospfv3Neighbors.length} FULL · ${ospfv3Routes.length} O6 ROUTES`, 'OSPFv3 neighbor phases and active IPv6 link-state routes remain independent from IPv4 OSPF.', ospfv3Neighbors.some((entry) => entry.phase !== 'FULL') ? 'warn' : 'normal'));

      const bgp = builderBgpState(input.graph, input.addressing, input.routing.bgp);
      const bgpSessions = bgp.sessions.filter((entry) => entry.aRouterId === device.id || entry.bRouterId === device.id);
      const bgpRoutes = bgp.routes.filter((entry) => entry.routerId === device.id);
      rows.push(row('db:bgp', 'BGP DATABASE', `${bgpSessions.filter((entry) => entry.state === 'ESTABLISHED').length}/${bgpSessions.length} ESTABLISHED · ${bgpRoutes.length} PATHS · ${bgpRoutes.filter((entry) => entry.best).length} BEST`, 'Session state, candidate paths, and best-path count are a deterministic projection of the selected Builder BGP state.', bgpSessions.some((entry) => entry.state !== 'ESTABLISHED') ? 'warn' : 'normal'));
    }
    const neighbors = input.ipv6ControlState.neighborCache.filter((entry) => entry.nodeId === device.id);
    const translations = input.natSessions.filter((entry) => entry.routerId === device.id);
    const probes = input.probeHistory.filter((probe) => probe.sourceNodeId === device.id || probe.destinationNodeId === device.id || probe.attempts.some((attempt) => attempt.requestNodeIds.includes(device.id) || attempt.responseNodeIds.includes(device.id)));
    rows.push(row('db:runtime', 'RUNTIME TABLES', `${neighbors.length} ND · ${translations.length} NAT · ${probes.length} PROBES`, 'ND cache entries, NAT sessions, and probe observations are session-only and are counted from the selected historical snapshot, never reconstructed from UI text.', 'normal'));
  } else {
    const deviceConfig = input.ethernet.devices.find((candidate) => candidate.id === device.id);
    if (!deviceConfig) return null;
    const stp = input.ethernet.vlans.map((vlan) => builderStpState(input.ethernet, vlan.id)).filter((state) => state.ports.some((port) => port.a === device.id || port.b === device.id) || state.rootBridgeId === device.id);
    const fdb = input.ethernetFlow?.fdb.filter((entry) => entry.switchId === device.id) ?? [];
    const arp = input.arpCache.filter((entry) => entry.ownerDeviceId === device.id);
    const leases = input.dhcpLeases.filter((entry) => entry.clientDeviceId === device.id || entry.serverDeviceId === device.id);
    rows.push(row('db:lan', 'LAN DATABASES', `${stp.length} STP VLAN${stp.length === 1 ? '' : 'S'} · ${fdb.length} FDB · ${arp.length} ARP · ${leases.length} DHCP`, 'STP, learned MACs, ARP mappings, and leases are counted from the selected canonical Ethernet/session snapshot.', stp.some((state) => state.loopDetected && !state.enabled) ? 'warn' : 'normal'));
  }
  return section('protocol-databases', 'PROTOCOL DATABASES / COUNTERS', rows);
}

export function builderApplicationDiagnosisSection(input: BuilderDeviceWorkbenchInput, device: BuilderDeviceRef): BuilderWorkbenchSection | null {
  const transaction = latestApplication(input);
  if (!transaction || !applicationApplies(input, device)) return null;
  const diagnosis = diagnoseBuilderApplicationTransaction(transaction, input.graph, input.applicationStageOrder ?? null);
  const dimensions = diagnosis.dimensions.map((entry) => `${entry.id}:${entry.status}`).join(' · ');
  const chain = diagnosis.causalChain.map((step, index) => why(`app:diagnosis:${transaction.id}:${index}`, step.status === 'FAIL' ? 'EVENT' : 'STATE', step.label, step.detail));
  const rows: BuilderWorkbenchRow[] = [
    row('app:diagnosis', 'CAUSAL DIAGNOSIS', diagnosis.summary, diagnosis.terminal ? transaction.summary : `Historical projection through Track D stage ${diagnosis.visibleThroughStageOrder}. Later truth remains NOT REACHED.`, diagnosis.firstBrokenDimension ? 'bad' : diagnosis.terminal ? 'good' : 'warn', chain),
    row('app:dimensions', 'TRUTH DIMENSIONS', dimensions, 'Physical, L2, resolution, routing, policy, translation, link, transport, TLS, application, and return-path truth remain independent. NOT_REACHED is not treated as failure.', diagnosis.firstBrokenDimension ? 'warn' : 'normal'),
  ];
  if (diagnosis.firstBrokenDimension) {
    const broken = diagnosis.dimensions.find((entry) => entry.id === diagnosis.firstBrokenDimension);
    if (broken) rows.push(row('app:first-broken', 'FIRST BROKEN BOUNDARY', broken.label, broken.summary, 'bad', chain));
  }
  return section('application-diagnosis', 'APPLICATION CAUSALITY', rows);
}

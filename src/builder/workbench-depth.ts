import { diagnoseBuilderApplicationTransaction } from './causal-diagnosis.ts';
import type { BuilderDeviceRef, BuilderDeviceWorkbenchInput, BuilderDeviceWorkbenchSnapshot, BuilderWorkbenchRow, BuilderWorkbenchSection, BuilderWorkbenchWhyStep } from './device-workbench.ts';

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

function rowsIn(snapshot: BuilderDeviceWorkbenchSnapshot, sectionId: string): BuilderWorkbenchRow[] {
  return snapshot.stateSections.find((entry) => entry.id === sectionId)?.rows ?? [];
}

export function builderProtocolDatabaseSection(snapshot: BuilderDeviceWorkbenchSnapshot): BuilderWorkbenchSection | null {
  const rows: BuilderWorkbenchRow[] = [];
  if (snapshot.device.plane === 'routed') {
    const rib = rowsIn(snapshot, 'rib-fib');
    const control = rowsIn(snapshot, 'control-state');
    const neighbor = rowsIn(snapshot, 'neighbor-state');
    const flows = rowsIn(snapshot, 'policy-flow-state');

    const ospfNeighbors = control.filter((entry) => entry.label === 'OSPF NEIGHBOR');
    const ospfLsdb = control.find((entry) => entry.id === 'state:ospf:lsdb');
    const ospfRoutes = rib.filter((entry) => entry.label === 'IPV4 OSPF' && entry.status === 'good');
    if (ospfNeighbors.length > 0 || ospfLsdb || ospfRoutes.length > 0) {
      rows.push(row(
        'db:ospf',
        'OSPF DATABASE',
        `${ospfNeighbors.filter((entry) => /\bFULL\b/.test(entry.value)).length}/${ospfNeighbors.length} FULL · ${ospfLsdb?.value ?? '0 PREFIXES'} · ${ospfRoutes.length} ACTIVE ROUTES`,
        'Counts summarize the OSPF neighbor, self-LSDB, and active RIB rows already projected by the selected canonical Device Workbench snapshot; no SPF or route selection is rerun here.',
        ospfNeighbors.some((entry) => !/\bFULL\b/.test(entry.value)) ? 'warn' : 'good',
        [why('db:ospf:projection', 'STATE', 'SELECTED WORKBENCH SNAPSHOT', 'This compact row counts existing OSPF workbench facts at the selected event time.')],
      ));
    }

    const ospfv3Neighbors = control.filter((entry) => entry.label === 'OSPFV3 NEIGHBOR');
    const ospfv3Routes = rib.filter((entry) => entry.label === 'IPV6 OSPFV3' && entry.status === 'good');
    if (ospfv3Neighbors.length > 0 || ospfv3Routes.length > 0) {
      rows.push(row(
        'db:ospfv3',
        'OSPFV3 DATABASE',
        `${ospfv3Neighbors.filter((entry) => /\bFULL\b/.test(entry.value) && !/STALE FULL/.test(entry.value)).length}/${ospfv3Neighbors.length} FULL · ${ospfv3Routes.length} O6 ROUTES`,
        'OSPFv3 counts are summarized from the already-selected IPv6 control-plane and RIB rows and remain independent from IPv4 OSPF.',
        ospfv3Neighbors.some((entry) => !/\bFULL\b/.test(entry.value) || /STALE FULL/.test(entry.value)) ? 'warn' : 'normal',
      ));
    }

    const bgpSessions = control.filter((entry) => entry.label === 'BGP SESSION');
    const bgpBest = control.filter((entry) => entry.label === 'BGP BEST');
    if (bgpSessions.length > 0 || bgpBest.length > 0) {
      rows.push(row(
        'db:bgp',
        'BGP DATABASE',
        `${bgpSessions.filter((entry) => /\bESTABLISHED\b/.test(entry.value)).length}/${bgpSessions.length} ESTABLISHED · ${bgpBest.length} BEST PATHS`,
        'Session and best-path counts summarize canonical BGP rows already present in this historical workbench. Candidate-path selection is not recomputed by the summary.',
        bgpSessions.some((entry) => !/\bESTABLISHED\b/.test(entry.value)) ? 'warn' : 'normal',
      ));
    }

    const nd = neighbor.filter((entry) => entry.label === 'IPV6 NEIGHBOR').length;
    const nat = neighbor.filter((entry) => entry.id.startsWith('state:nat:')).length;
    const probes = flows.filter((entry) => entry.id.startsWith('state:probe:')).length;
    rows.push(row('db:runtime', 'RUNTIME TABLES', `${nd} ND · ${nat} NAT · ${probes} PROBES`, 'Runtime counts summarize rows from this selected canonical workbench snapshot. They are not reconstructed from live state or display text outside the snapshot.', 'normal'));
  } else {
    const host = rowsIn(snapshot, 'lan-host-state');
    const switching = rowsIn(snapshot, 'lan-switch-state');
    const service = rowsIn(snapshot, 'lan-service-state');
    const stp = switching.filter((entry) => entry.label === 'STP');
    const fdb = switching.filter((entry) => entry.label === 'FDB').length;
    const arp = host.filter((entry) => entry.label === 'ARP').length;
    const leases = service.filter((entry) => entry.label === 'DHCP LEASE').length;
    rows.push(row(
      'db:lan',
      'LAN DATABASES',
      `${stp.length} STP VLAN${stp.length === 1 ? '' : 'S'} · ${fdb} FDB · ${arp} ARP · ${leases} DHCP`,
      'STP, learned MAC, ARP, and DHCP counts summarize the existing historical Ethernet workbench rows; the depth view does not execute switching or lease logic.',
      stp.some((entry) => entry.status === 'bad') ? 'warn' : 'normal',
    ));
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

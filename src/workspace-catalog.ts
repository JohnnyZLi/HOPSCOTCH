import type { NetworkLayer } from './simulation/model';

export type ExploreDestination =
  | 'journey'
  | 'failure'
  | 'builder'
  | 'packet'
  | 'tcp'
  | 'dns'
  | 'tls'
  | 'http'
  | 'internet'
  | 'physical'
  | 'observed'
  | 'measured'
  | 'capture';

export type ExploreGroupId = 'protocols' | 'internet' | 'evidence';
export type FeaturedWorkspaceId = 'journey' | 'failure' | 'builder';
export type FeaturedWorkspaceTone = 'watch' | 'break' | 'build';

export interface WorkspaceDefinition {
  readonly id: ExploreDestination;
  readonly path: string;
  readonly layer: NetworkLayer;
  readonly lab: string;
  readonly name: string;
  readonly exploreTitle: string;
  readonly description: string;
  readonly meta: string;
  readonly status: string;
  readonly group: ExploreGroupId | 'featured';
  readonly featured?: {
    readonly tone: FeaturedWorkspaceTone;
    readonly actionLabel: string;
  };
}

export interface ExploreGroupDefinition {
  readonly id: ExploreGroupId;
  readonly label: string;
  readonly description: string;
  readonly workspaceIds: readonly ExploreDestination[];
}

export const WORKSPACE_IDS = [
  'journey',
  'failure',
  'builder',
  'packet',
  'tcp',
  'dns',
  'tls',
  'http',
  'internet',
  'physical',
  'observed',
  'measured',
  'capture',
] as const satisfies readonly ExploreDestination[];

export const FEATURED_WORKSPACE_IDS = ['journey', 'failure', 'builder'] as const satisfies readonly FeaturedWorkspaceId[];

export const WORKSPACE_CATALOG: Readonly<Record<ExploreDestination, WorkspaceDefinition>> = Object.freeze({
  journey: {
    id: 'journey',
    path: '/journey',
    layer: 'application',
    lab: 'LAB 06 + 07',
    name: 'URL Journey',
    exploreTitle: 'Watch a request',
    description: 'Follow one HTTPS request across DNS, routing, transport, TLS, HTTP, packets, failures, and recovery.',
    meta: 'END TO END · GOD MODE · SHAREABLE',
    status: 'URL JOURNEY + GOD MODE ACTIVE',
    group: 'featured',
    featured: { tone: 'watch', actionLabel: 'Play URL journey' },
  },
  failure: {
    id: 'failure',
    path: '/labs/failure',
    layer: 'routing',
    lab: 'LAB 01',
    name: 'Failure Story',
    exploreTitle: 'Break the network',
    description: 'Fail the active route and watch convergence, recomputation, failover, and the causal chain unfold.',
    meta: 'FAILURE · RECOVERY · TIME',
    status: 'FAILURE STORY ACTIVE',
    group: 'featured',
    featured: { tone: 'break', actionLabel: 'Run failure story' },
  },
  builder: {
    id: 'builder',
    path: '/labs/builder',
    layer: 'routing',
    lab: 'LAB 04',
    name: 'Network Builder',
    exploreTitle: 'Build a network',
    description: 'Author topology and configuration, run probes, troubleshoot faults, use the CLI, rewind canonical time, and explain why the network behaves as it does.',
    meta: 'AUTHOR · PROBE · TROUBLESHOOT · EXPLAIN',
    status: 'NETWORK BUILDER ACTIVE',
    group: 'featured',
    featured: { tone: 'build', actionLabel: 'Open network builder' },
  },
  packet: {
    id: 'packet',
    path: '/labs/packet',
    layer: 'packet',
    lab: 'LAB 02',
    name: 'Packet Microscope',
    exploreTitle: 'Packet Microscope',
    description: 'Peel Ethernet, IP, TCP, UDP, and ICMP fields down to exact bytes and checksums.',
    meta: 'SIMULATED OR CAPTURED · EXACT BYTES',
    status: 'PACKET TRACE ACTIVE',
    group: 'protocols',
  },
  tcp: {
    id: 'tcp',
    path: '/labs/tcp',
    layer: 'transport',
    lab: 'LAB 03A',
    name: 'TCP Theater',
    exploreTitle: 'TCP Theater',
    description: 'Handshake, sequence space, loss, retransmission, congestion response, and teardown.',
    meta: 'STATE MACHINE · SEQ / ACK · RECOVERY',
    status: 'TCP THEATER ACTIVE',
    group: 'protocols',
  },
  dns: {
    id: 'dns',
    path: '/labs/dns',
    layer: 'application',
    lab: 'LAB 03B',
    name: 'DNS Theater',
    exploreTitle: 'DNS Theater',
    description: 'Recursive resolution, cache behavior, TTLs, retries, and visible failure boundaries.',
    meta: 'CACHE · RECURSION · TTL',
    status: 'DNS THEATER ACTIVE',
    group: 'protocols',
  },
  tls: {
    id: 'tls',
    path: '/labs/tls',
    layer: 'application',
    lab: 'LAB 03C',
    name: 'TLS 1.3 Theater',
    exploreTitle: 'TLS 1.3 Theater',
    description: 'Handshake negotiation, key schedule, certificate boundary, and encrypted application data.',
    meta: 'TLS 1.3 · KEYS · ENCRYPTION',
    status: 'TLS 1.3 THEATER ACTIVE',
    group: 'protocols',
  },
  http: {
    id: 'http',
    path: '/labs/http2-vs-http3',
    layer: 'application',
    lab: 'LAB 03D',
    name: 'HTTP/2 vs HTTP/3',
    exploreTitle: 'HTTP/2 vs HTTP/3',
    description: 'Compare multiplexing, TCP head-of-line blocking, QUIC streams, and recovery behavior.',
    meta: 'H2/TCP · H3/QUIC · MULTIPLEXING',
    status: 'HTTP/2 ↔ HTTP/3 ACTIVE',
    group: 'protocols',
  },
  internet: {
    id: 'internet',
    path: '/internet/as-routing',
    layer: 'internet',
    lab: 'LAB 05A',
    name: 'AS Routing Theater',
    exploreTitle: 'AS routing theater',
    description: 'Explore deterministic interdomain relationships, valley-free policy, path selection, and route leaks.',
    meta: 'SIMULATED · POLICY · BGP',
    status: 'SIMULATED AS THEATER ACTIVE',
    group: 'internet',
  },
  physical: {
    id: 'physical',
    path: '/internet/physical',
    layer: 'internet',
    lab: 'LAB 05C',
    name: 'Physical Internet Atlas',
    exploreTitle: 'Physical Internet atlas',
    description: 'See facilities and physical Internet context on the globe without turning geography into forwarding truth.',
    meta: 'PUBLIC DATA · INFERRED CORRIDORS',
    status: 'PHYSICAL INTERNET ATLAS ACTIVE',
    group: 'internet',
  },
  observed: {
    id: 'observed',
    path: '/internet/observed',
    layer: 'internet',
    lab: 'LAB 05B',
    name: 'Internet Evidence',
    exploreTitle: 'Internet evidence',
    description: 'Inspect edge-observed and public-collector evidence with explicit vantage and provenance boundaries.',
    meta: 'EDGE OBSERVED · PUBLIC COLLECTOR',
    status: 'INTERNET EVIDENCE ACTIVE',
    group: 'internet',
  },
  measured: {
    id: 'measured',
    path: '/measured',
    layer: 'internet',
    lab: 'LAB 09',
    name: 'Measured Network',
    exploreTitle: 'Measured network',
    description: 'Inspect imported or loopback-bridged local diagnostics without confusing one host vantage with Internet truth.',
    meta: 'LOCAL MEASURED · EXPLICIT VANTAGE',
    status: 'LOCAL MEASURED ACTIVE',
    group: 'evidence',
  },
  capture: {
    id: 'capture',
    path: '/capture',
    layer: 'packet',
    lab: 'TRACK H',
    name: 'Capture Replay',
    exploreTitle: 'Capture Replay',
    description: 'Open a local PCAP/PCAPNG, follow conversations and time, inspect exact bytes, and keep missing evidence explicit.',
    meta: 'CAPTURED · LOCAL ONLY · SESSION MEMORY',
    status: 'CAPTURED EVIDENCE ACTIVE',
    group: 'evidence',
  },
});

export const EXPLORE_GROUPS = [
  {
    id: 'protocols',
    label: 'Protocols + packets',
    description: 'Zoom into one packet or one protocol machine without losing the causal model.',
    workspaceIds: ['packet', 'tcp', 'dns', 'tls', 'http'],
  },
  {
    id: 'internet',
    label: 'Internet scale',
    description: 'Separate deterministic policy simulation from observed/public evidence and physical context.',
    workspaceIds: ['internet', 'observed', 'physical'],
  },
  {
    id: 'evidence',
    label: 'Evidence + measurement',
    description: 'Inspect real local or captured evidence while preserving vantage, uncertainty, and provenance.',
    workspaceIds: ['measured', 'capture'],
  },
] as const satisfies readonly ExploreGroupDefinition[];

export const WORKSPACE_COUNT = WORKSPACE_IDS.length;

export const WORKSPACE_PATHS: Readonly<Record<ExploreDestination, string>> = Object.freeze(
  Object.fromEntries(WORKSPACE_IDS.map((id) => [id, WORKSPACE_CATALOG[id].path])) as Record<ExploreDestination, string>,
);

export function workspaceDefinition(destination: ExploreDestination): WorkspaceDefinition {
  return WORKSPACE_CATALOG[destination];
}

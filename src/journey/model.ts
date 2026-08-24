import { applyJourneyModifiers, impairmentProfileForModifiers } from './modifiers.ts';

export type JourneyScale = 'internet' | 'routing' | 'transport' | 'application' | 'packet';
export type JourneyProvenance = 'SIMULATED' | 'EDGE OBSERVED' | 'PUBLIC COLLECTOR' | 'PUBLIC DATA' | 'INFERRED';
export type JourneyZoomDirection = 'in' | 'out' | 'hold';
export type JourneyTransportProfile = 'tcp-h2' | 'quic-h3';
export type JourneyDnsProfile = 'cache-miss' | 'cache-hit';
export type JourneyModifierId = 'dns-failure' | 'route-failure' | 'route-leak' | 'server-failure' | 'single-loss' | 'path-outage' | 'latency-spike' | 'congestion' | 'partition';
export type JourneyImpairmentProfile = 'clean' | JourneyModifierId | 'composed';
export type JourneyDetailLab = 'dns' | 'tcp' | 'tls' | 'http' | 'packet' | 'builder' | 'failure' | 'internet' | 'physical' | 'observed';
export type JourneyEventKind =
  | 'intent.accepted'
  | 'dns.cache-check'
  | 'dns.cache-hit'
  | 'dns.query'
  | 'dns.referral'
  | 'dns.answer'
  | 'dns.cache-store'
  | 'dns.timeout'
  | 'dns.retry'
  | 'dns.failure-masked'
  | 'route.lookup'
  | 'route.gateway'
  | 'route.failure'
  | 'route.invalidated'
  | 'route.recompute'
  | 'route.alternate-installed'
  | 'route.partition'
  | 'route.partition-recompute'
  | 'route.unreachable'
  | 'internet.policy-path'
  | 'internet.route-leak-advertised'
  | 'internet.route-leak-selected'
  | 'internet.policy-anomaly'
  | 'internet.route-leak-withdrawn'
  | 'internet.policy-restored'
  | 'internet.physical-context'
  | 'transport.segment'
  | 'transport.established'
  | 'transport.loss'
  | 'transport.loss-detected'
  | 'transport.retransmit'
  | 'transport.recovered'
  | 'transport.latency'
  | 'transport.rtt-update'
  | 'transport.latency-cleared'
  | 'transport.queue-growth'
  | 'transport.ecn-mark'
  | 'transport.congestion-response'
  | 'transport.congestion-cleared'
  | 'transport.stalled'
  | 'tls.message'
  | 'tls.validation'
  | 'tls.keys'
  | 'http.control'
  | 'http.request'
  | 'server.unavailable'
  | 'http.service-unavailable'
  | 'http.retry-wait'
  | 'server.recovered'
  | 'http.retry'
  | 'http.response'
  | 'http.data'
  | 'packet.assembly'
  | 'packet.transit'
  | 'packet.inspect'
  | 'transfer.complete'
  | 'response.ready'
  | 'camera.pullback'
  | 'journey.complete'
  | 'journey.failed';

export interface JourneyScenarioConfig {
  transportProfile: JourneyTransportProfile;
  dnsProfile: JourneyDnsProfile;
  impairmentProfile: JourneyImpairmentProfile;
  modifierIds?: JourneyModifierId[];
}

export const DEFAULT_JOURNEY_CONFIG: JourneyScenarioConfig = {
  transportProfile: 'tcp-h2',
  dnsProfile: 'cache-miss',
  impairmentProfile: 'clean',
};

export interface JourneyTransportMetrics {
  baselineRttMs?: number;
  latestRttMs?: number;
  adjustedRttMs?: number;
  smoothedRttMs?: number;
  rttVarMs?: number;
  ackDelayMs?: number;
  timerLabel?: 'RTO' | 'PTO';
  timerMs?: number;
  lossDetected?: boolean;
}

export interface JourneyCongestionMetrics {
  bottleneckRateMbps: number;
  offeredRateMbps: number;
  queueCapacityPackets: number;
  queueOccupancyPackets: number;
  queueDelayMs: number;
  ecnCeMarks: number;
  congestionWindowPackets: number;
  slowStartThresholdPackets?: number;
  signal: 'NONE' | 'CE' | 'ECE/CWR' | 'ACK_ECN';
  droppedPackets: number;
}

export interface JourneyServerMetrics {
  statusCode?: 503;
  retryAfterMs: number;
  requestMethod: 'GET';
  idempotent: boolean;
  retrySafe: boolean;
  transportReused: boolean;
}

export interface JourneyPolicyMetrics {
  legitimatePathAsns: number[];
  leakedPathAsns: number[];
  activePathAsns: number[];
  legitimateTraversal: Array<'up' | 'peer' | 'down'>;
  leakedTraversal: Array<'up' | 'peer' | 'down'>;
  legitimateLocalPreference: number;
  leakedLocalPreference: number;
  activeLocalPreference: number;
  leakSourceAsn: number;
  decisionAsn: number;
  destinationAsn: number;
  learnedFrom: 'peer';
  exportedTo: 'provider';
  selectedPathPolicyCompliant: boolean;
  exportPolicyCompliant: boolean;
  reachable: boolean;
}

export interface JourneyRouteMetrics {
  primaryPathCost: number;
  alternatePathCost: number;
  activePath: 'primary' | 'none' | 'alternate';
  failedLinkId?: string;
  failedLinkIds?: string[];
  candidateRouteCount?: number;
  recoveryAvailable?: boolean;
}

export interface JourneyEvent {
  id: string;
  atMs: number;
  kind: JourneyEventKind;
  scale: JourneyScale;
  zoom: JourneyZoomDirection;
  protocol: string;
  phase: string;
  title: string;
  summary: string;
  detail: string;
  provenance: JourneyProvenance;
  actor: string;
  target?: string;
  detailLab?: JourneyDetailLab;
  ttlSeconds?: number;
  transportMetrics?: JourneyTransportMetrics;
  congestionMetrics?: JourneyCongestionMetrics;
  serverMetrics?: JourneyServerMetrics;
  policyMetrics?: JourneyPolicyMetrics;
  routeMetrics?: JourneyRouteMetrics;
}

export interface JourneyScenario {
  id: string;
  hostname: string;
  destinationAddress: string;
  transportProfile: JourneyTransportProfile;
  dnsProfile: JourneyDnsProfile;
  impairmentProfile: JourneyImpairmentProfile;
  modifierIds: JourneyModifierId[];
  appliedModifierIds: JourneyModifierId[];
  durationMs: number;
  events: JourneyEvent[];
}

export type DnsJourneyState = 'idle' | 'cache-miss' | 'resolving' | 'timeout' | 'retrying' | 'resolved' | 'cached';
export type RouteJourneyState = 'idle' | 'lookup' | 'gateway-ready' | 'failed' | 'recomputing' | 'alternate-ready' | 'internet-path-ready' | 'unreachable';
export type TransportJourneyState = 'closed' | 'handshake' | 'established' | 'stalled' | 'complete';
export type TlsJourneyState = 'idle' | 'negotiating' | 'validating' | 'handshake-keys' | 'application-keys';
export type HttpJourneyState = 'idle' | 'control' | 'request-sent' | 'service-unavailable' | 'retry-wait' | 'headers' | 'streaming' | 'stalled' | 'complete';
export type ServerJourneyState = 'healthy' | 'unavailable' | 'waiting' | 'ready';
export type PolicyJourneyState = 'normal' | 'leak-advertised' | 'leaked' | 'anomaly' | 'restored';
export type PacketJourneyState = 'idle' | 'assembling' | 'transit' | 'frame' | 'headers';
export type JourneyPacketAssemblyStage = 'idle' | 'application' | 'security' | 'transport' | 'network' | 'link' | 'collapsed' | 'exploded';
export type JourneyPacketTransitStage = 'idle' | 'nic-serialize' | 'link-transmit' | 'switch-inspect' | 'switch-forward' | 'router-decapsulate' | 'router-ttl' | 'router-route' | 'router-reencapsulate' | 'next-link';
export type JourneyImpairmentState = 'clean' | 'armed' | 'dns-failed' | 'dns-retrying' | 'dns-masked' | 'server-unavailable' | 'server-waiting' | 'server-ready' | 'lost' | 'detected' | 'recovering' | 'recovered' | 'delayed' | 'estimating' | 'normalized' | 'queueing' | 'ecn-signaled' | 'congestion-responding' | 'route-failed' | 'route-recomputing' | 'route-ready' | 'policy-leak' | 'policy-anomaly' | 'policy-restored' | 'partitioned' | 'partition-recomputing' | 'unreachable';

export interface JourneyState {
  timeMs: number;
  activeEvent: JourneyEvent;
  activeEventIndex: number;
  completedEventIds: string[];
  transportProfile: JourneyTransportProfile;
  dnsProfile: JourneyDnsProfile;
  impairmentProfile: JourneyImpairmentProfile;
  modifierIds: JourneyModifierId[];
  impairmentState: JourneyImpairmentState;
  transportMetrics: JourneyTransportMetrics | null;
  congestionMetrics: JourneyCongestionMetrics | null;
  serverMetrics: JourneyServerMetrics | null;
  policyMetrics: JourneyPolicyMetrics | null;
  routeMetrics: JourneyRouteMetrics | null;
  scale: JourneyScale;
  scaleDepth: number;
  previousScale: JourneyScale;
  zoom: JourneyZoomDirection;
  protocol: string;
  phase: string;
  provenance: JourneyProvenance;
  dns: DnsJourneyState;
  dnsTtlSeconds: number | null;
  resolvedAddress: string | null;
  route: RouteJourneyState;
  transport: TransportJourneyState;
  tls: TlsJourneyState;
  http: HttpJourneyState;
  server: ServerJourneyState;
  policy: PolicyJourneyState;
  packet: PacketJourneyState;
  packetAssemblyStage: JourneyPacketAssemblyStage;
  packetTransitStage: JourneyPacketTransitStage;
  responseReady: boolean;
  journeyComplete: boolean;
  journeyFailed: boolean;
  failureReason: 'network-unreachable' | null;
}

export const JOURNEY_SCALE_DEPTH: Record<JourneyScale, number> = {
  internet: 0,
  routing: 1,
  transport: 2,
  application: 3,
  packet: 4,
};

export function normalizeJourneyHostname(input: string): string {
  const hostname = input.trim().toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname.length > 253) throw new Error('Hostname must contain 1–253 characters.');
  if (hostname.includes('://') || /[\/:?#\[\]@]/.test(hostname)) throw new Error('Enter a hostname only, not a URL, port, path, or IP literal.');
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) throw new Error('Enter a hostname instead of an IP address.');
  const labels = hostname.split('.');
  if (labels.length < 2) throw new Error('Hostname must contain at least one dot.');
  for (const label of labels) {
    if (!label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) throw new Error(`Invalid hostname label: ${label || '(empty)'}.`);
  }
  return hostname;
}

function event(
  id: string,
  atMs: number,
  kind: JourneyEventKind,
  scale: JourneyScale,
  zoom: JourneyZoomDirection,
  protocol: string,
  phase: string,
  title: string,
  summary: string,
  detail: string,
  actor: string,
  target?: string,
  detailLab?: JourneyDetailLab,
  provenance: JourneyProvenance = 'SIMULATED',
): JourneyEvent {
  return { id, atMs, kind, scale, zoom, protocol, phase, title, summary, detail, actor, target, detailLab, provenance };
}

function withTtl(source: JourneyEvent, ttlSeconds: number): JourneyEvent {
  return { ...source, ttlSeconds };
}

function shiftEvents(events: JourneyEvent[], deltaMs: number): JourneyEvent[] {
  if (deltaMs === 0) return events;
  return events.map((current) => ({ ...current, atMs: current.atMs + deltaMs }));
}

function intentEvent(hostname: string): JourneyEvent {
  return event('intent', 0, 'intent.accepted', 'application', 'hold', 'URL', 'intent', `Navigate to ${hostname}`, 'The application turns a human hostname into a network dependency graph.', 'A URL is intent, not a route. HOPSCOTCH starts at the application layer and moves outward only when the next dependency requires it.', 'browser', hostname);
}

function dnsMissEvents(hostname: string, destinationAddress: string): JourneyEvent[] {
  return [
    event('dns-cache', 420, 'dns.cache-check', 'application', 'hold', 'DNS', 'cache-miss', 'DNS cache miss', 'No usable cached answer exists for this curated journey.', 'The simulated miss forces the complete recursive resolution path to remain visible.', 'stub resolver', hostname, 'dns'),
    event('dns-recursive', 850, 'dns.query', 'application', 'hold', 'DNS', 'recursive-query', 'Stub asks recursive resolver', `A recursive A query is issued for ${hostname}.`, 'The stub asks one recursive resolver to finish the job. The recursive resolver performs iterative upstream work.', 'stub resolver', 'recursive resolver', 'dns'),
    event('dns-root', 1320, 'dns.referral', 'application', 'hold', 'DNS', 'root-referral', 'Root referral received', 'The recursive resolver learns where to continue the namespace walk.', 'A referral narrows the search to the next authority.', 'root authority', 'recursive resolver', 'dns'),
    event('dns-tld', 1810, 'dns.referral', 'application', 'hold', 'DNS', 'tld-referral', 'TLD referral received', 'The recursive resolver is directed toward the authoritative zone.', 'The resolver continues iteratively rather than asking the browser to chase each authority.', 'TLD authority', 'recursive resolver', 'dns'),
    event('dns-answer', 2310, 'dns.answer', 'application', 'hold', 'DNS', 'answer', `${hostname} → ${destinationAddress}`, 'The authoritative answer supplies a documentation-only destination address for the deterministic story.', '203.0.113.0/24 is documentation space. This journey never implies that example.test is a live public host.', 'authoritative DNS', 'recursive resolver', 'dns'),
    withTtl(event('dns-store', 2700, 'dns.cache-store', 'application', 'hold', 'DNS', 'cache-store', 'Answer cached', 'The recursive result becomes reusable until its simulated TTL expires.', 'The cache starts at a deterministic 300-second TTL and ages with Journey time.', 'recursive resolver', 'cache', 'dns'), 300),
  ];
}

function dnsHitEvents(hostname: string, destinationAddress: string): JourneyEvent[] {
  return [
    withTtl(event('dns-hit', 420, 'dns.cache-hit', 'application', 'hold', 'DNS', 'cache-hit', 'DNS cache hit', `${hostname} → ${destinationAddress} is already cached.`, 'A deterministic unexpired cached answer satisfies the name dependency immediately. No recursive, root, TLD, or authoritative traffic occurs.', 'stub resolver cache', hostname, 'dns'), 258),
  ];
}

function routingInternetEvents(destinationAddress: string, times: [number, number, number, number]): JourneyEvent[] {
  const [routeAt, gatewayAt, asAt, physicalAt] = times;
  return [
    event('route-lookup', routeAt, 'route.lookup', 'routing', 'out', 'IP', 'route-lookup', 'Destination enters the routing table', `${destinationAddress} requires a next-hop decision outside the local subnet.`, 'The camera moves outward because an IP destination cannot leave the host until a route and next hop exist.', 'host routing table', destinationAddress, 'builder'),
    event('gateway', gatewayAt, 'route.gateway', 'routing', 'hold', 'Ethernet/IP', 'gateway', 'Default gateway selected', 'The host has a viable local path to the router that can forward toward the Internet.', 'This is a deterministic teaching topology, not a measurement of the viewer’s LAN.', 'client', 'edge router', 'builder'),
    event('as-path', asAt, 'internet.policy-path', 'internet', 'out', 'BGP policy model', 'as-path', 'Interdomain path context appears', 'A simulated valley-free AS path carries the story beyond the local routing domain.', 'The AS path is SIMULATED. Public collector paths, when attached, remain separate evidence and never replace this story path.', 'access AS', 'content AS', 'internet'),
    event('physical-context', physicalAt, 'internet.physical-context', 'internet', 'hold', 'Physical Internet', 'infrastructure-context', 'Physical infrastructure comes into view', 'Interconnection facilities give geography to the story without claiming a cable or exact forwarding path.', 'PeeringDB facility points can decorate this moment as PUBLIC DATA. Any connecting great-circle geometry remains INFERRED.', 'public facility context', 'destination region', 'physical', 'INFERRED'),
  ];
}

function sharedPrelude(hostname: string, destinationAddress: string, dnsProfile: JourneyDnsProfile): JourneyEvent[] {
  const dnsEvents = dnsProfile === 'cache-hit'
    ? dnsHitEvents(hostname, destinationAddress)
    : dnsMissEvents(hostname, destinationAddress);
  const routingTimes: [number, number, number, number] = dnsProfile === 'cache-hit'
    ? [900, 1340, 1800, 2320]
    : [3140, 3560, 4050, 4520];
  return [intentEvent(hostname), ...dnsEvents, ...routingInternetEvents(destinationAddress, routingTimes)];
}

function tcpH2Events(hostname: string): JourneyEvent[] {
  return [
    event('tcp-syn', 5000, 'transport.segment', 'transport', 'in', 'TCP', 'syn', 'SYN leaves the client', 'TCP opens a reliable byte stream before TLS begins.', 'This branch uses TCP + TLS 1.3 + HTTP/2.', 'client TCP', 'server TCP', 'tcp'),
    event('tcp-synack', 5320, 'transport.segment', 'transport', 'hold', 'TCP', 'syn-ack', 'SYN-ACK returns', 'The server acknowledges the client sequence space and contributes its own initial sequence number.', 'The handshake establishes shared transport sequence state.', 'server TCP', 'client TCP', 'tcp'),
    event('tcp-ack', 5620, 'transport.established', 'transport', 'hold', 'TCP', 'established', 'TCP connection established', 'The third handshake segment makes the bidirectional byte stream usable.', 'Encryption still does not exist yet.', 'client TCP', 'server TCP', 'tcp'),
    event('tls-clienthello', 6070, 'tls.message', 'application', 'in', 'TLS 1.3', 'client-hello', 'ClientHello', `SNI names ${hostname}; ALPN offers h2.`, 'TLS records are carried inside the established TCP byte stream.', 'TLS client', 'TLS server', 'tls'),
    event('tls-serverhello', 6470, 'tls.message', 'application', 'hold', 'TLS 1.3', 'server-hello', 'ServerHello', 'The server selects compatible cryptographic parameters and contributes its key share.', 'The transcript now contains both hellos.', 'TLS server', 'TLS client', 'tls'),
    event('tls-encrypted', 6840, 'tls.keys', 'application', 'hold', 'TLS 1.3', 'handshake-keys', 'Handshake traffic becomes encrypted', 'EncryptedExtensions and later server handshake messages are protected with handshake keys.', 'HOPSCOTCH shows named key-schedule stages, not invented secret bytes.', 'TLS key schedule', 'handshake traffic', 'tls'),
    event('tls-certificate', 7210, 'tls.validation', 'application', 'hold', 'TLS 1.3', 'certificate-validation', 'Certificate identity validated', `The presented identity is checked against ${hostname}.`, 'Certificate validation authenticates the server identity independently from routing.', 'certificate validator', hostname, 'tls'),
    event('tls-finished', 7610, 'tls.keys', 'application', 'hold', 'TLS 1.3', 'application-keys', 'Application traffic keys ready', 'Both sides can now protect application data with TLS 1.3 application traffic secrets.', 'The encryption boundary changes before HTTP/2 request data is sent.', 'TLS key schedule', 'application traffic', 'tls'),
    event('h2-settings', 8070, 'http.control', 'application', 'hold', 'HTTP/2', 'connection-control', 'HTTP/2 control state exchanged', 'SETTINGS establishes connection-level HTTP/2 parameters over the encrypted stream.', 'HTTP/2 multiplexing lives above TCP.', 'HTTP client', 'HTTP server', 'http'),
    event('h2-request', 8540, 'http.request', 'application', 'hold', 'HTTP/2', 'request', `GET / on ${hostname}`, 'Request headers become an encrypted HTTP/2 HEADERS frame carried by TLS over TCP.', 'Each representation is a different abstraction of the same bytes.', 'browser', 'origin', 'http'),
    ...packetAssemblyEvents(hostname, 'tcp-h2', 8840),
    ...packetTransitEvents('tcp-h2', 11600),
    event('h2-headers', 16420, 'http.response', 'application', 'out', 'HTTP/2', 'response-headers', 'Response headers arrive', 'The origin begins the response with status and metadata before the body streams.', 'The first response bytes do not mean transfer is complete.', 'origin', 'browser', 'http'),
    event('h2-data', 16960, 'http.data', 'application', 'hold', 'HTTP/2', 'streaming', 'Response DATA streams', 'Encrypted application data crosses the established TCP stream.', 'HOPSCOTCH can now zoom into one representative frame.', 'origin', 'browser', 'http'),
    event('packet-frame', 17680, 'packet.inspect', 'packet', 'in', 'Ethernet / IPv4 / TCP / TLS', 'frame', 'Freeze one TCP frame', 'One delivery unit becomes the entire world: link, network, transport, and encrypted TLS payload bytes.', 'The packet microscope is a projection of the same Journey moment.', 'network interface', 'packet bytes', 'packet'),
    event('packet-headers', 18360, 'packet.inspect', 'packet', 'hold', 'Ethernet / IPv4 / TCP', 'headers', 'Explode TCP/IP headers', 'The same frame opens into persistent link, network, transport, security, and application objects.', 'TLS-protected application bytes remain opaque at this packet-observation boundary.', 'packet bytes', 'header fields', 'packet'),
    event('transfer-complete', 19160, 'transfer.complete', 'transport', 'out', 'TCP', 'complete', 'Transfer acknowledged', 'The representative response flight is cumulatively acknowledged and TCP delivery is complete.', 'The camera pulls back because byte delivery has finished.', 'client TCP', 'server TCP', 'tcp'),
  ];
}

function quicH3Events(hostname: string): JourneyEvent[] {
  return [
    event('quic-initial', 5000, 'transport.segment', 'transport', 'in', 'QUIC + TLS 1.3', 'quic-initial', 'QUIC Initial leaves the client', `The Initial packet carries TLS ClientHello data, including SNI for ${hostname} and ALPN for h3.`, 'QUIC runs over UDP, but TLS 1.3 is integrated into QUIC crypto levels rather than transported as TLS records.', 'QUIC client', 'QUIC server', 'http'),
    event('quic-server-initial', 5380, 'tls.message', 'transport', 'hold', 'QUIC + TLS 1.3', 'server-initial', 'Server Initial + Handshake arrive', 'The server answers with QUIC Initial/Handshake packets carrying TLS handshake messages.', 'Packet protection and TLS transcript state advance together inside QUIC.', 'QUIC server', 'QUIC client', 'http'),
    event('quic-handshake-keys', 5750, 'tls.keys', 'transport', 'hold', 'QUIC + TLS 1.3', 'handshake-keys', 'QUIC Handshake keys active', 'Handshake packets move to the Handshake encryption level.', 'There is no standalone TLS record layer between UDP and QUIC.', 'QUIC crypto', 'Handshake packets', 'http'),
    event('quic-certificate', 6180, 'tls.validation', 'transport', 'hold', 'QUIC + TLS 1.3', 'certificate-validation', 'Certificate identity validated', `The TLS identity carried through QUIC is checked against ${hostname}.`, 'QUIC changes transport mechanics, not server-authentication requirements.', 'certificate validator', hostname, 'http'),
    event('quic-1rtt', 6620, 'tls.keys', 'transport', 'hold', 'QUIC + TLS 1.3', 'application-keys', '1-RTT keys ready', 'TLS application secrets feed QUIC 1-RTT packet protection.', 'Application data can now travel on independent QUIC streams.', 'QUIC crypto', '1-RTT packets', 'http'),
    event('quic-established', 6900, 'transport.established', 'transport', 'hold', 'QUIC', 'established', 'QUIC connection established', 'The connection has usable 1-RTT keys and transport parameters.', 'HTTP/3 can now use QUIC streams without a TCP byte stream.', 'QUIC client', 'QUIC server', 'http'),
    event('h3-control', 7500, 'http.control', 'application', 'in', 'HTTP/3', 'connection-control', 'HTTP/3 control streams open', 'HTTP/3 SETTINGS and QPACK control state use dedicated QUIC streams.', 'This curated trace avoids dynamic QPACK dependencies so transport behavior stays legible.', 'HTTP/3 client', 'HTTP/3 server', 'http'),
    event('h3-request', 8120, 'http.request', 'application', 'hold', 'HTTP/3', 'request', `GET / on ${hostname}`, 'Request fields are encoded for HTTP/3 and carried on a QUIC request stream.', 'There is no HTTP/2 framing or TCP stream in this branch.', 'browser', 'origin', 'http'),
    ...packetAssemblyEvents(hostname, 'quic-h3', 8420),
    ...packetTransitEvents('quic-h3', 11180),
    event('h3-headers', 16000, 'http.response', 'application', 'out', 'HTTP/3', 'response-headers', 'Response headers arrive', 'The response begins on the request’s QUIC stream.', 'Other QUIC streams are independently ordered.', 'origin', 'browser', 'http'),
    event('h3-data', 16700, 'http.data', 'application', 'hold', 'HTTP/3', 'streaming', 'HTTP/3 DATA streams', 'Protected QUIC STREAM frames carry response data.', 'QUIC loss can still affect congestion control even though stream ordering is independent.', 'origin', 'browser', 'http'),
    event('packet-frame', 17680, 'packet.inspect', 'packet', 'in', 'Ethernet / IPv4 / UDP / QUIC', 'frame', 'Freeze one QUIC packet', 'One datagram becomes the entire world: Ethernet, IP, UDP, QUIC header, and protected payload.', 'TLS-derived keys protect QUIC packet payloads; there is no visible TLS record envelope.', 'network interface', 'packet bytes', 'packet'),
    event('packet-headers', 18360, 'packet.inspect', 'packet', 'hold', 'Ethernet / IPv4 / UDP / QUIC', 'headers', 'Explode UDP + QUIC headers', 'The same datagram opens into link, network, UDP, QUIC protection, and application objects.', 'Protected QUIC payload bytes remain opaque without key material.', 'packet bytes', 'header fields', 'packet'),
    event('transfer-complete', 19160, 'transfer.complete', 'transport', 'out', 'QUIC', 'complete', 'QUIC transfer complete', 'The response stream reaches its final offset and delivery is acknowledged.', 'Completion belongs to QUIC stream/packet state, not TCP cumulative ACK space.', 'QUIC client', 'QUIC server', 'http'),
  ];
}

function packetAssemblyEvents(hostname: string, profile: JourneyTransportProfile, startAtMs: number): JourneyEvent[] {
  const quic = profile === 'quic-h3';
  const application = quic ? 'HTTP/3 request fields' : 'HTTP/2 request headers';
  const security = quic ? 'QUIC 1-RTT protection' : 'TLS 1.3 application data';
  const transport = quic ? 'UDP datagram + QUIC packet' : 'TCP segment';
  const transportDetail = quic
    ? 'QUIC integrates TLS-derived protection into its packet format, then uses UDP as the IP payload. HOPSCOTCH does not insert a standalone TLS record layer.'
    : 'TLS-protected bytes become TCP payload. Sequence, acknowledgment, flags, window, and checksum belong to the TCP header.';
  return [
    event('packet-assembly-application', startAtMs, 'packet.assembly', 'packet', 'in', quic ? 'HTTP/3' : 'HTTP/2', 'application', 'Application data isolated', `${application} for GET / on ${hostname} becomes the logical payload.`, 'This is the clear application meaning at the browser boundary; it is not yet a wire-visible packet.', 'browser', 'network stack', 'packet'),
    event('packet-assembly-security', startAtMs + 460, 'packet.assembly', 'packet', 'hold', quic ? 'QUIC + TLS 1.3' : 'TLS 1.3', 'security', `${security} closes`, quic ? 'HTTP/3 request data becomes protected QUIC STREAM data.' : 'HTTP/2 request bytes become opaque TLS application data.', quic ? 'TLS-derived keys protect QUIC payloads without creating a TLS record layer between QUIC and UDP.' : 'The HTTP meaning remains available above TLS; packet observers without keys see an opaque TLS record payload.', quic ? 'QUIC packet protection' : 'TLS record layer', 'protected application bytes', 'packet'),
    event('packet-assembly-transport', startAtMs + 920, 'packet.assembly', 'packet', 'hold', quic ? 'QUIC / UDP' : 'TCP', 'transport', `${transport} assembles`, quic ? 'UDP ports and checksum carry a protected QUIC packet toward the origin.' : 'TCP ports, sequence space, flags, window, and checksum surround the protected bytes.', transportDetail, quic ? 'QUIC + UDP' : 'TCP', 'transport unit', 'packet'),
    event('packet-assembly-network', startAtMs + 1380, 'packet.assembly', 'packet', 'hold', 'IPv4', 'network', 'IPv4 envelope assembles', 'Source, destination, TTL, protocol, length, and checksum establish the routed packet.', 'The IP packet is the continuity object across routed hops. Its Ethernet envelope may change at every hop.', 'IPv4', 'routed packet', 'packet'),
    event('packet-assembly-link', startAtMs + 1840, 'packet.assembly', 'packet', 'hold', 'Ethernet II', 'link', 'Hop-local Ethernet envelope closes', 'Source and next-hop destination MAC addresses frame the same IPv4 packet for this local link.', 'The Ethernet header is hop-local. The NIC generates the FCS during transmission; the simulated inspection snapshot does not pretend the trailer was captured.', 'Ethernet', 'next-hop frame', 'packet'),
    event('packet-assembly-collapsed', startAtMs + 2300, 'packet.assembly', 'packet', 'hold', 'Ethernet / IPv4 / transport', 'collapsed', 'Structured frame ready at the NIC', 'Five semantic representations collapse into one deterministic outbound data unit.', 'No animation callback created this frame. Scrubbing to this timestamp reconstructs the same semantic assembly from the canonical event log.', 'network stack', 'NIC queue', 'packet'),
  ];
}

function packetTransitEvents(profile: JourneyTransportProfile, startAtMs: number): JourneyEvent[] {
  const transport = profile === 'quic-h3' ? 'UDP / QUIC' : 'TCP';
  return [
    event('packet-transit-nic', startAtMs, 'packet.transit', 'packet', 'hold', `Ethernet / IPv4 / ${transport}`, 'nic-serialize', 'NIC serializes the structured frame', 'The frame becomes an ordered link transmission without changing its packet semantics.', 'The renderer exposes bytes, bits, and link activity as representations of one deterministic frame. The NIC generates a per-transmission FCS; it is not fabricated as captured packet data.', 'client NIC', 'access link', 'packet'),
    event('packet-transit-link', startAtMs + 480, 'packet.transit', 'packet', 'hold', 'Ethernet PHY', 'link-transmit', 'Symbols cross the access link', 'Structured bytes become physical link activity moving toward the switch.', 'Serialization is a rendering of the already-built frame. Browser scheduling cannot create, drop, or reorder semantic network state.', 'client NIC', 'access switch Gi0/3', 'physical'),
    event('packet-transit-switch-inspect', startAtMs + 960, 'packet.transit', 'packet', 'hold', 'Ethernet II', 'switch-inspect', 'Switch isolates destination MAC', 'Only the destination MAC is projected for the forwarding decision; unrelated packet fields recede.', 'The switch may learn the source MAC on ingress, but this forwarding decision compares destination MAC 02:48:4F:50:00:02 with its MAC table.', 'access switch Gi0/3', 'MAC table', 'packet'),
    event('packet-transit-switch-forward', startAtMs + 1440, 'packet.transit', 'packet', 'hold', 'Ethernet II', 'switch-forward', 'MAC table selects Gi0/24', 'The same Ethernet header and IPv4 payload leave the selected switch port.', 'A normal Layer 2 forward does not rewrite source or destination MAC. The egress transmitter generates link-local physical overhead such as a new FCS.', 'access switch', 'Gi0/24 → edge router', 'packet'),
    event('packet-transit-router-decapsulate', startAtMs + 1920, 'packet.transit', 'packet', 'hold', 'Ethernet II → IPv4', 'router-decapsulate', 'Router terminates the incoming Ethernet envelope', 'The hop-local Layer 2 shell opens and ends; the routed IPv4 packet remains.', 'The router validates the incoming frame, removes the Ethernet header/trailer context, and makes an IP forwarding decision. Ethernet does not continue through the router.', 'edge router lan0', 'IPv4 forwarding plane', 'packet'),
    event('packet-transit-router-ttl', startAtMs + 2400, 'packet.transit', 'packet', 'hold', 'IPv4', 'router-ttl', 'TTL decrements: 64 → 63', 'The router mutates the IPv4 TTL and updates the IPv4 header checksum.', 'Destination IP and transport payload remain logically continuous. TTL and its dependent header checksum are the exact routed-hop mutations shown here.', 'IPv4 forwarding plane', 'mutable header fields', 'packet'),
    event('packet-transit-router-route', startAtMs + 2880, 'packet.transit', 'packet', 'hold', 'IPv4 routing', 'router-route', 'Destination IP selects the next hop', '203.0.113.42 matches 203.0.113.0/24 via 198.51.100.2 on wan0.', 'The destination IP—not either hop-local MAC address—selects the route. The chosen next hop will supply the next Ethernet destination.', 'edge router FIB', 'wan0 / 198.51.100.2', 'builder'),
    event('packet-transit-router-reencapsulate', startAtMs + 3360, 'packet.transit', 'packet', 'hold', 'IPv4 → Ethernet II', 'router-reencapsulate', 'A new Ethernet envelope assembles', 'Router wan0 constructs new source and next-hop destination MAC fields around the forwarded IPv4 packet.', 'The outgoing frame is a new hop-local object. The IPv4 continuity identity survives with TTL 63 and an updated header checksum.', 'edge router wan0', 'next-hop Ethernet frame', 'packet'),
    event('packet-transit-next-link', startAtMs + 3840, 'packet.transit', 'packet', 'hold', 'Ethernet PHY', 'next-link', 'The re-encapsulated packet continues', 'A second link transmission carries the new Ethernet frame toward 198.51.100.2.', 'The visual grammar repeats—frame, serialization, link—but the Layer 2 addresses now belong to the next hop while the IP destination remains 203.0.113.42.', 'edge router wan0', 'next hop 198.51.100.2', 'physical'),
  ];
}

function sharedTail(hostname: string, profile: JourneyTransportProfile): JourneyEvent[] {
  const applicationProtocol = profile === 'tcp-h2' ? 'HTTP/2 + TLS' : 'HTTP/3 + QUIC';
  return [
    event('response-ready', 19980, 'response.ready', 'application', 'out', applicationProtocol, 'response-ready', 'Response available to the application', 'Decrypted response bytes are delivered upward to the browser.', 'Network delivery ends by satisfying the application intent that began the story.', 'network stack', 'browser', 'http'),
    event('pullback-route', 20800, 'camera.pullback', 'routing', 'out', 'IP', 'pullback-routing', 'Pull back through the route', 'The journey recedes from application state to the forwarding structures that carried it.', 'Nothing new is transmitted here. This is an explanatory camera move through already completed causal state.', 'camera', 'routing scale', 'builder'),
    event('pullback-internet', 21650, 'camera.pullback', 'internet', 'out', 'Internet', 'pullback-internet', 'Return to Internet scale', 'Local routes, AS policy, and physical infrastructure collapse back into one global context.', 'Observed/public context can decorate this endpoint view without rewriting the simulated journey that just completed.', 'camera', 'Internet scale', 'physical', 'INFERRED'),
    event('complete', 22650, 'journey.complete', 'application', 'in', 'URL', 'complete', `${hostname} journey complete`, 'A human hostname became DNS state, routing state, transport state, protected application traffic, packets, and finally a response.', 'The same global time machine can now be rewound to any causal boundary without changing the event log.', hostname, 'browser'),
  ];
}

export function buildJourneyScenario(hostnameInput = 'example.test', config: Partial<JourneyScenarioConfig> = {}): JourneyScenario {
  const hostname = normalizeJourneyHostname(hostnameInput);
  const destinationAddress = '203.0.113.42';
  const normalizedConfig: JourneyScenarioConfig = { ...DEFAULT_JOURNEY_CONFIG, ...config };
  const dnsShiftMs = normalizedConfig.dnsProfile === 'cache-hit' ? -2200 : 0;
  const baseTransportEvents = normalizedConfig.transportProfile === 'quic-h3' ? quicH3Events(hostname) : tcpH2Events(hostname);
  const transportEvents = shiftEvents(baseTransportEvents, dnsShiftMs);
  const tailEvents = shiftEvents(sharedTail(hostname, normalizedConfig.transportProfile), dnsShiftMs);
  const baseEvents = [
    ...sharedPrelude(hostname, destinationAddress, normalizedConfig.dnsProfile),
    ...transportEvents,
    ...tailEvents,
  ];
  const modifierResult = applyJourneyModifiers(baseEvents, normalizedConfig);
  const events = modifierResult.events;
  const modifierIds = modifierResult.appliedModifierIds;
  const impairmentProfile = impairmentProfileForModifiers(modifierIds);
  const impairmentKey = impairmentProfile === 'composed' ? modifierIds.join('+') : impairmentProfile;

  return {
    id: `url-journey:${hostname}:${normalizedConfig.transportProfile}:${normalizedConfig.dnsProfile}:${impairmentKey}`,
    hostname,
    destinationAddress,
    transportProfile: normalizedConfig.transportProfile,
    dnsProfile: normalizedConfig.dnsProfile,
    impairmentProfile,
    modifierIds,
    appliedModifierIds: modifierIds,
    durationMs: 23100 + dnsShiftMs + modifierResult.addedDurationMs,
    events,
  };
}

export function latestJourneyEventAtOrBefore(scenario: JourneyScenario, timeMs: number): JourneyEvent {
  let active = scenario.events[0];
  for (const candidate of scenario.events) {
    if (candidate.atMs > timeMs) break;
    active = candidate;
  }
  return active;
}

export function journeyStateAt(scenario: JourneyScenario, requestedTimeMs: number): JourneyState {
  const timeMs = Math.max(0, Math.min(scenario.durationMs, requestedTimeMs));
  const activeEvent = latestJourneyEventAtOrBefore(scenario, timeMs);
  const activeEventIndex = scenario.events.indexOf(activeEvent);
  const previousEvent = scenario.events[Math.max(0, activeEventIndex - 1)];
  const completed = scenario.events.filter((candidate) => candidate.atMs <= timeMs);

  let dns: DnsJourneyState = 'idle';
  let dnsTtlBase: number | null = null;
  let dnsCachedAtMs: number | null = null;
  let resolvedAddress: string | null = null;
  let route: RouteJourneyState = 'idle';
  let transport: TransportJourneyState = 'closed';
  let tls: TlsJourneyState = 'idle';
  let http: HttpJourneyState = 'idle';
  let server: ServerJourneyState = 'healthy';
  let policy: PolicyJourneyState = 'normal';
  let packet: PacketJourneyState = 'idle';
  let packetAssemblyStage: JourneyPacketAssemblyStage = 'idle';
  let packetTransitStage: JourneyPacketTransitStage = 'idle';
  let impairmentState: JourneyImpairmentState = scenario.modifierIds.length === 0 ? 'clean' : 'armed';
  let transportMetrics: JourneyTransportMetrics | null = null;
  let congestionMetrics: JourneyCongestionMetrics | null = null;
  let serverMetrics: JourneyServerMetrics | null = null;
  let policyMetrics: JourneyPolicyMetrics | null = null;
  let routeMetrics: JourneyRouteMetrics | null = null;
  let responseReady = false;
  let journeyComplete = false;
  let journeyFailed = false;
  let failureReason: 'network-unreachable' | null = null;

  for (const current of completed) {
    switch (current.kind) {
      case 'dns.cache-check': dns = 'cache-miss'; break;
      case 'dns.cache-hit':
        dns = 'cached';
        resolvedAddress = scenario.destinationAddress;
        dnsTtlBase = current.ttlSeconds ?? null;
        dnsCachedAtMs = current.atMs;
        break;
      case 'dns.query': dns = 'resolving'; break;
      case 'dns.timeout':
        dns = 'timeout';
        impairmentState = 'dns-failed';
        break;
      case 'dns.retry':
        dns = 'retrying';
        impairmentState = 'dns-retrying';
        break;
      case 'dns.failure-masked':
        impairmentState = 'dns-masked';
        break;
      case 'dns.referral':
        dns = 'resolving';
        if (impairmentState === 'dns-failed' || impairmentState === 'dns-retrying') impairmentState = 'normalized';
        break;
      case 'dns.answer': dns = 'resolved'; resolvedAddress = scenario.destinationAddress; break;
      case 'dns.cache-store':
        dns = 'cached';
        dnsTtlBase = current.ttlSeconds ?? null;
        dnsCachedAtMs = current.atMs;
        break;
      case 'route.lookup':
        route = 'lookup';
        if (impairmentState === 'dns-masked') impairmentState = 'normalized';
        break;
      case 'route.gateway': route = 'gateway-ready'; break;
      case 'route.failure':
        route = 'failed';
        impairmentState = 'route-failed';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.invalidated':
        route = 'failed';
        impairmentState = 'route-failed';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.recompute':
        route = 'recomputing';
        impairmentState = 'route-recomputing';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.alternate-installed':
        route = 'alternate-ready';
        impairmentState = 'route-ready';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.partition':
        route = 'failed';
        impairmentState = 'partitioned';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.partition-recompute':
        route = 'recomputing';
        impairmentState = 'partition-recomputing';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.unreachable':
        route = 'unreachable';
        impairmentState = 'unreachable';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'internet.policy-path': route = 'internet-path-ready'; policy = 'normal'; break;
      case 'internet.route-leak-advertised':
        policy = 'leak-advertised';
        impairmentState = 'policy-leak';
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case 'internet.route-leak-selected':
        policy = 'leaked';
        impairmentState = 'policy-leak';
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case 'internet.policy-anomaly':
        policy = 'anomaly';
        impairmentState = 'policy-anomaly';
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case 'internet.route-leak-withdrawn':
        policy = 'anomaly';
        impairmentState = 'policy-anomaly';
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case 'internet.policy-restored':
        policy = 'restored';
        impairmentState = 'policy-restored';
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case 'internet.physical-context':
        if (impairmentState === 'policy-restored') impairmentState = 'normalized';
        break;
      case 'transport.segment': transport = 'handshake'; break;
      case 'transport.established': transport = 'established'; break;
      case 'transport.loss': impairmentState = 'lost'; break;
      case 'transport.loss-detected':
        impairmentState = 'detected';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case 'transport.retransmit': impairmentState = 'recovering'; break;
      case 'transport.recovered': impairmentState = 'recovered'; break;
      case 'transport.latency':
        impairmentState = 'delayed';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case 'transport.rtt-update':
        impairmentState = 'estimating';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case 'transport.latency-cleared':
        impairmentState = 'normalized';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case 'transport.queue-growth':
        impairmentState = 'queueing';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics = current.congestionMetrics ?? congestionMetrics;
        break;
      case 'transport.ecn-mark':
        impairmentState = 'ecn-signaled';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics = current.congestionMetrics ?? congestionMetrics;
        break;
      case 'transport.congestion-response':
        impairmentState = 'congestion-responding';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics = current.congestionMetrics ?? congestionMetrics;
        break;
      case 'transport.congestion-cleared':
        impairmentState = 'normalized';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics = current.congestionMetrics ?? congestionMetrics;
        break;
      case 'transport.stalled':
        transport = 'stalled';
        impairmentState = 'unreachable';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'tls.message': tls = 'negotiating'; break;
      case 'tls.validation': tls = 'validating'; break;
      case 'tls.keys': tls = current.phase === 'application-keys' ? 'application-keys' : 'handshake-keys'; break;
      case 'http.control': http = 'control'; break;
      case 'http.request': http = 'request-sent'; break;
      case 'server.unavailable':
        server = 'unavailable';
        impairmentState = 'server-unavailable';
        serverMetrics = current.serverMetrics ?? serverMetrics;
        break;
      case 'http.service-unavailable':
        server = 'unavailable';
        http = 'service-unavailable';
        impairmentState = 'server-unavailable';
        serverMetrics = current.serverMetrics ?? serverMetrics;
        break;
      case 'http.retry-wait':
        server = 'waiting';
        http = 'retry-wait';
        impairmentState = 'server-waiting';
        serverMetrics = current.serverMetrics ?? serverMetrics;
        break;
      case 'server.recovered':
        server = 'ready';
        impairmentState = 'server-ready';
        serverMetrics = current.serverMetrics ?? serverMetrics;
        break;
      case 'http.retry':
        server = 'ready';
        http = 'request-sent';
        impairmentState = 'server-ready';
        serverMetrics = current.serverMetrics ?? serverMetrics;
        break;
      case 'http.response':
        http = 'headers';
        if (impairmentState === 'server-ready') { server = 'healthy'; impairmentState = 'normalized'; }
        break;
      case 'http.data': http = 'streaming'; break;
      case 'packet.assembly':
        packet = 'assembling';
        packetAssemblyStage = current.phase as JourneyPacketAssemblyStage;
        break;
      case 'packet.transit':
        packet = 'transit';
        packetTransitStage = current.phase as JourneyPacketTransitStage;
        break;
      case 'packet.inspect':
        packet = current.phase === 'headers' ? 'headers' : 'frame';
        packetAssemblyStage = current.phase === 'headers' ? 'exploded' : 'collapsed';
        break;
      case 'transfer.complete': transport = 'complete'; http = 'complete'; break;
      case 'response.ready': responseReady = true; break;
      case 'journey.complete': journeyComplete = true; break;
      case 'journey.failed':
        route = 'unreachable';
        transport = 'stalled';
        http = 'stalled';
        responseReady = false;
        journeyComplete = false;
        journeyFailed = true;
        failureReason = 'network-unreachable';
        impairmentState = 'unreachable';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      default: break;
    }
  }

  const dnsTtlSeconds = dnsTtlBase === null || dnsCachedAtMs === null
    ? null
    : Math.max(0, dnsTtlBase - Math.floor((timeMs - dnsCachedAtMs) / 1000));

  return {
    timeMs,
    activeEvent,
    activeEventIndex,
    completedEventIds: completed.map((current) => current.id),
    transportProfile: scenario.transportProfile,
    dnsProfile: scenario.dnsProfile,
    impairmentProfile: scenario.impairmentProfile,
    modifierIds: scenario.modifierIds,
    impairmentState,
    transportMetrics,
    congestionMetrics,
    serverMetrics,
    policyMetrics,
    routeMetrics,
    scale: activeEvent.scale,
    scaleDepth: JOURNEY_SCALE_DEPTH[activeEvent.scale],
    previousScale: previousEvent.scale,
    zoom: activeEvent.zoom,
    protocol: activeEvent.protocol,
    phase: activeEvent.phase,
    provenance: activeEvent.provenance,
    dns,
    dnsTtlSeconds,
    resolvedAddress,
    route,
    transport,
    tls,
    http,
    server,
    policy,
    packet,
    packetAssemblyStage,
    packetTransitStage,
    responseReady,
    journeyComplete,
    journeyFailed,
    failureReason,
  };
}

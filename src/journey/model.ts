export type JourneyScale = 'internet' | 'routing' | 'transport' | 'application' | 'packet';
export type JourneyProvenance = 'SIMULATED' | 'EDGE OBSERVED' | 'PUBLIC COLLECTOR' | 'PUBLIC DATA' | 'INFERRED';
export type JourneyZoomDirection = 'in' | 'out' | 'hold';
export type JourneyDetailLab = 'dns' | 'tcp' | 'tls' | 'http' | 'packet' | 'builder' | 'internet' | 'physical' | 'observed';
export type JourneyEventKind =
  | 'intent.accepted'
  | 'dns.cache-check'
  | 'dns.query'
  | 'dns.referral'
  | 'dns.answer'
  | 'dns.cache-store'
  | 'route.lookup'
  | 'route.gateway'
  | 'internet.policy-path'
  | 'internet.physical-context'
  | 'transport.segment'
  | 'transport.established'
  | 'tls.message'
  | 'tls.validation'
  | 'tls.keys'
  | 'http.control'
  | 'http.request'
  | 'http.response'
  | 'http.data'
  | 'packet.inspect'
  | 'transfer.complete'
  | 'response.ready'
  | 'camera.pullback'
  | 'journey.complete';

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
}

export interface JourneyScenario {
  id: string;
  hostname: string;
  destinationAddress: string;
  durationMs: number;
  events: JourneyEvent[];
}

export type DnsJourneyState = 'idle' | 'cache-miss' | 'resolving' | 'resolved' | 'cached';
export type RouteJourneyState = 'idle' | 'lookup' | 'gateway-ready' | 'internet-path-ready';
export type TransportJourneyState = 'closed' | 'handshake' | 'established' | 'complete';
export type TlsJourneyState = 'idle' | 'negotiating' | 'validating' | 'handshake-keys' | 'application-keys';
export type HttpJourneyState = 'idle' | 'control' | 'request-sent' | 'headers' | 'streaming' | 'complete';
export type PacketJourneyState = 'idle' | 'frame' | 'headers';

export interface JourneyState {
  timeMs: number;
  activeEvent: JourneyEvent;
  activeEventIndex: number;
  completedEventIds: string[];
  scale: JourneyScale;
  scaleDepth: number;
  previousScale: JourneyScale;
  zoom: JourneyZoomDirection;
  protocol: string;
  phase: string;
  provenance: JourneyProvenance;
  dns: DnsJourneyState;
  resolvedAddress: string | null;
  route: RouteJourneyState;
  transport: TransportJourneyState;
  tls: TlsJourneyState;
  http: HttpJourneyState;
  packet: PacketJourneyState;
  responseReady: boolean;
  journeyComplete: boolean;
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

export function buildJourneyScenario(hostnameInput = 'example.test'): JourneyScenario {
  const hostname = normalizeJourneyHostname(hostnameInput);
  const destinationAddress = '203.0.113.42';
  const events: JourneyEvent[] = [
    event('intent', 0, 'intent.accepted', 'application', 'hold', 'URL', 'intent', `Navigate to ${hostname}`, 'The application turns a human hostname into a network dependency graph.', 'A URL is intent, not a route. HOPSCOTCH starts at the application layer and only moves outward when the next dependency requires a lower layer.', 'browser', hostname),
    event('dns-cache', 420, 'dns.cache-check', 'application', 'hold', 'DNS', 'cache-check', 'DNS cache checked', 'No usable cached answer exists for this curated journey.', 'The cache miss is simulated so the full resolver path remains visible. Later Journey branches can replay the same story as a cache hit.', 'stub resolver', hostname, 'dns'),
    event('dns-recursive', 850, 'dns.query', 'application', 'hold', 'DNS', 'recursive-query', 'Stub asks recursive resolver', `A recursive A query is issued for ${hostname}.`, 'The stub asks one recursive resolver to finish the job. The recursive resolver will perform iterative upstream work.', 'stub resolver', 'recursive resolver', 'dns'),
    event('dns-root', 1320, 'dns.referral', 'application', 'hold', 'DNS', 'root-referral', 'Root referral received', 'The recursive resolver learns where to continue the namespace walk.', 'A referral does not contain the final address. It narrows the search to the next authority.', 'root authority', 'recursive resolver', 'dns'),
    event('dns-tld', 1810, 'dns.referral', 'application', 'hold', 'DNS', 'tld-referral', 'TLD referral received', 'The recursive resolver is directed toward the authoritative zone.', 'The resolver continues iteratively rather than asking the browser to chase each authority.', 'TLD authority', 'recursive resolver', 'dns'),
    event('dns-answer', 2310, 'dns.answer', 'application', 'hold', 'DNS', 'answer', `${hostname} → ${destinationAddress}`, 'The authoritative answer supplies a documentation-only destination address for the deterministic story.', '203.0.113.0/24 is documentation space. This journey never implies that example.test is a live public host.', 'authoritative DNS', 'recursive resolver', 'dns'),
    event('dns-store', 2700, 'dns.cache-store', 'application', 'hold', 'DNS', 'cache-store', 'Answer cached', 'The recursive result becomes reusable until its simulated TTL expires.', 'Caching changes future dependency cost, not the meaning of the current answer.', 'recursive resolver', 'cache', 'dns'),
    event('route-lookup', 3140, 'route.lookup', 'routing', 'out', 'IP', 'route-lookup', 'Destination enters the routing table', `${destinationAddress} requires a next-hop decision outside the local subnet.`, 'The camera moves outward because an IP destination cannot leave the host until a route and next hop exist.', 'host routing table', destinationAddress, 'builder'),
    event('gateway', 3560, 'route.gateway', 'routing', 'hold', 'Ethernet/IP', 'gateway', 'Default gateway selected', 'The host has a viable local path to the router that can forward toward the Internet.', 'This is a deterministic teaching topology, not a measurement of the viewer’s LAN.', 'client', 'edge router', 'builder'),
    event('as-path', 4050, 'internet.policy-path', 'internet', 'out', 'BGP policy model', 'as-path', 'Interdomain path context appears', 'A simulated valley-free AS path carries the story beyond the local routing domain.', 'The AS path is SIMULATED. Public collector paths, when attached, remain separate evidence and never replace this story path.', 'access AS', 'content AS', 'internet'),
    event('physical-context', 4520, 'internet.physical-context', 'internet', 'hold', 'Physical Internet', 'infrastructure-context', 'Physical infrastructure comes into view', 'Interconnection facilities give geography to the story without claiming a cable or exact forwarding path.', 'PeeringDB facility points can decorate this moment as PUBLIC DATA. Any connecting great-circle geometry remains INFERRED.', 'public facility context', 'destination region', 'physical', 'INFERRED'),
    event('tcp-syn', 5000, 'transport.segment', 'transport', 'in', 'TCP', 'syn', 'SYN leaves the client', 'The curated baseline chooses TCP so TLS and HTTP/2 can be shown explicitly.', 'This first Journey slice deliberately fixes the transport branch. A later branch can choose QUIC/HTTP/3 without changing the timeline architecture.', 'client TCP', 'server TCP', 'tcp'),
    event('tcp-synack', 5320, 'transport.segment', 'transport', 'hold', 'TCP', 'syn-ack', 'SYN-ACK returns', 'The server acknowledges the client sequence space and contributes its own initial sequence number.', 'The handshake establishes shared transport sequence state before application bytes can be delivered reliably.', 'server TCP', 'client TCP', 'tcp'),
    event('tcp-ack', 5620, 'transport.established', 'transport', 'hold', 'TCP', 'established', 'TCP connection established', 'The third handshake segment makes the bidirectional byte stream usable.', 'Connection establishment is transport state; encryption still does not exist yet.', 'client TCP', 'server TCP', 'tcp'),
    event('tls-clienthello', 6070, 'tls.message', 'application', 'in', 'TLS 1.3', 'client-hello', 'ClientHello', `SNI names ${hostname}; ALPN offers HTTP/2-compatible application protocols.`, 'ClientHello is visible negotiation metadata. Application confidentiality begins only after handshake traffic secrets exist.', 'TLS client', 'TLS server', 'tls'),
    event('tls-serverhello', 6470, 'tls.message', 'application', 'hold', 'TLS 1.3', 'server-hello', 'ServerHello', 'The server selects compatible cryptographic parameters and contributes its key share.', 'The transcript now contains both hellos and the handshake secret can be derived.', 'TLS server', 'TLS client', 'tls'),
    event('tls-encrypted', 6840, 'tls.keys', 'application', 'hold', 'TLS 1.3', 'handshake-keys', 'Handshake traffic becomes encrypted', 'EncryptedExtensions and later server handshake messages are protected with handshake keys.', 'HOPSCOTCH shows named key-schedule stages, not invented secret bytes.', 'TLS key schedule', 'handshake traffic', 'tls'),
    event('tls-certificate', 7210, 'tls.validation', 'application', 'hold', 'TLS 1.3', 'certificate-validation', 'Certificate identity validated', `The presented identity is checked against ${hostname} in the curated story.`, 'Certificate validation authenticates the server identity independently from transport routing.', 'certificate validator', hostname, 'tls'),
    event('tls-finished', 7610, 'tls.keys', 'application', 'hold', 'TLS 1.3', 'application-keys', 'Application traffic keys ready', 'Both sides can now protect application data with TLS 1.3 application traffic secrets.', 'The encryption boundary changes before the HTTP request is sent.', 'TLS key schedule', 'application traffic', 'tls'),
    event('h2-settings', 8070, 'http.control', 'application', 'hold', 'HTTP/2', 'connection-control', 'HTTP/2 control state exchanged', 'SETTINGS establishes connection-level HTTP/2 parameters over the encrypted stream.', 'HTTP/2 multiplexing lives above TCP. TCP loss can still block delivery across HTTP streams.', 'HTTP client', 'HTTP server', 'http'),
    event('http-request', 8540, 'http.request', 'application', 'hold', 'HTTP/2', 'request', `GET / on ${hostname}`, 'Request headers become an encrypted HTTP/2 HEADERS frame carried by TLS over TCP.', 'Each representation is a different abstraction of the same bytes, not a different request.', 'browser', 'origin', 'http'),
    event('http-headers', 9030, 'http.response', 'application', 'hold', 'HTTP/2', 'response-headers', 'Response headers arrive', 'The origin begins the response with status and metadata before the body streams.', 'The first response bytes satisfy application-level dependencies but do not mean transfer is complete.', 'origin', 'browser', 'http'),
    event('http-data', 9550, 'http.data', 'application', 'hold', 'HTTP/2', 'streaming', 'Response DATA streams', 'Encrypted application data crosses the established transport stream.', 'HOPSCOTCH can now zoom into one representative packet without losing where those bytes came from.', 'origin', 'browser', 'http'),
    event('packet-frame', 10120, 'packet.inspect', 'packet', 'in', 'Ethernet / IPv4 / TCP / TLS', 'frame', 'Freeze one frame', 'One delivery unit becomes the entire world: link, network, transport, and encrypted payload bytes.', 'The packet microscope is a projection of the same Journey moment. It does not invent a second transfer.', 'network interface', 'packet bytes', 'packet'),
    event('packet-headers', 10680, 'packet.inspect', 'packet', 'hold', 'Ethernet / IPv4 / TCP', 'headers', 'Peel the headers', 'Frame offsets reveal the fields that made delivery possible while TLS protects the application payload.', 'Headers are visible transport/network structure; encrypted application bytes remain opaque at this layer.', 'packet bytes', 'header fields', 'packet'),
    event('transfer-complete', 11300, 'transfer.complete', 'transport', 'out', 'TCP', 'complete', 'Transfer acknowledged', 'The representative response flight is cumulatively acknowledged and transport delivery is complete.', 'The camera pulls back because byte delivery has finished and the remaining consequence is application state.', 'client TCP', 'server TCP', 'tcp'),
    event('response-ready', 12020, 'response.ready', 'application', 'out', 'HTTP/TLS', 'response-ready', 'Response available to the application', 'Decrypted response bytes are delivered upward to the browser.', 'Network delivery ends by satisfying the application intent that began the story.', 'network stack', 'browser', 'http'),
    event('pullback-route', 12750, 'camera.pullback', 'routing', 'out', 'IP', 'pullback-routing', 'Pull back through the route', 'The journey recedes from application state to the forwarding structures that carried it.', 'Nothing new is transmitted here. This is an explanatory camera move through already completed causal state.', 'camera', 'routing scale', 'builder'),
    event('pullback-internet', 13500, 'camera.pullback', 'internet', 'out', 'Internet', 'pullback-internet', 'Return to Internet scale', 'Local routes, AS policy, and physical infrastructure collapse back into one global context.', 'Observed/public context can decorate this endpoint view without rewriting the simulated journey that just completed.', 'camera', 'Internet scale', 'physical', 'INFERRED'),
    event('complete', 14500, 'journey.complete', 'application', 'in', 'URL', 'complete', `${hostname} journey complete`, 'A human hostname became DNS state, routing state, transport state, encrypted application traffic, packets, and finally a response.', 'The same global time machine can now be rewound to any causal boundary without changing the event log.', hostname, 'browser'),
  ];

  return {
    id: `url-journey:${hostname}`,
    hostname,
    destinationAddress,
    durationMs: 15000,
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
  let resolvedAddress: string | null = null;
  let route: RouteJourneyState = 'idle';
  let transport: TransportJourneyState = 'closed';
  let tls: TlsJourneyState = 'idle';
  let http: HttpJourneyState = 'idle';
  let packet: PacketJourneyState = 'idle';
  let responseReady = false;
  let journeyComplete = false;

  for (const current of completed) {
    switch (current.kind) {
      case 'dns.cache-check': dns = 'cache-miss'; break;
      case 'dns.query':
      case 'dns.referral': dns = 'resolving'; break;
      case 'dns.answer': dns = 'resolved'; resolvedAddress = scenario.destinationAddress; break;
      case 'dns.cache-store': dns = 'cached'; break;
      case 'route.lookup': route = 'lookup'; break;
      case 'route.gateway': route = 'gateway-ready'; break;
      case 'internet.policy-path': route = 'internet-path-ready'; break;
      case 'transport.segment': transport = 'handshake'; break;
      case 'transport.established': transport = 'established'; break;
      case 'tls.message': tls = 'negotiating'; break;
      case 'tls.validation': tls = 'validating'; break;
      case 'tls.keys': tls = current.phase === 'application-keys' ? 'application-keys' : 'handshake-keys'; break;
      case 'http.control': http = 'control'; break;
      case 'http.request': http = 'request-sent'; break;
      case 'http.response': http = 'headers'; break;
      case 'http.data': http = 'streaming'; break;
      case 'packet.inspect': packet = current.phase === 'headers' ? 'headers' : 'frame'; break;
      case 'transfer.complete': transport = 'complete'; http = 'complete'; break;
      case 'response.ready': responseReady = true; break;
      case 'journey.complete': responseReady = true; journeyComplete = true; break;
      default: break;
    }
  }

  return {
    timeMs,
    activeEvent,
    activeEventIndex,
    completedEventIds: completed.map((current) => current.id),
    scale: activeEvent.scale,
    scaleDepth: JOURNEY_SCALE_DEPTH[activeEvent.scale],
    previousScale: previousEvent.scale,
    zoom: activeEvent.zoom,
    protocol: activeEvent.protocol,
    phase: activeEvent.phase,
    provenance: activeEvent.provenance,
    dns,
    resolvedAddress,
    route,
    transport,
    tls,
    http,
    packet,
    responseReady,
    journeyComplete,
  };
}

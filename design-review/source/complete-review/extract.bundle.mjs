// complete-review/extract.mjs
import fs from "node:fs";

// ../8f1a24ac8c73/hopscotch/src/workspace-catalog.ts
var WORKSPACE_IDS = [
  "journey",
  "failure",
  "builder",
  "packet",
  "tcp",
  "dns",
  "tls",
  "http",
  "internet",
  "physical",
  "observed",
  "measured",
  "capture"
];
var WORKSPACE_CATALOG = Object.freeze({
  journey: {
    id: "journey",
    path: "/journey",
    layer: "application",
    name: "URL Journey",
    exploreTitle: "Watch a request",
    description: "Follow one HTTPS request across DNS, routing, transport, TLS, HTTP, packets, failures, and recovery.",
    meta: "END TO END \xB7 CANONICAL TIME \xB7 SHAREABLE",
    status: "URL JOURNEY ACTIVE",
    group: "featured",
    featured: { tone: "watch", actionLabel: "Play URL journey" }
  },
  failure: {
    id: "failure",
    path: "/labs/failure",
    layer: "routing",
    name: "Failure Story",
    exploreTitle: "Break the network",
    description: "Fail the active route and watch convergence, recomputation, failover, and the causal chain unfold.",
    meta: "FAILURE \xB7 RECOVERY \xB7 TIME",
    status: "FAILURE STORY ACTIVE",
    group: "featured",
    featured: { tone: "break", actionLabel: "Run failure story" }
  },
  builder: {
    id: "builder",
    path: "/labs/builder",
    layer: "routing",
    name: "Network Builder",
    exploreTitle: "Build a network",
    description: "Author topology and configuration, run probes, troubleshoot faults, use the CLI, rewind canonical time, and explain why the network behaves as it does.",
    meta: "AUTHOR \xB7 PROBE \xB7 TROUBLESHOOT \xB7 EXPLAIN",
    status: "NETWORK BUILDER ACTIVE",
    group: "featured",
    featured: { tone: "build", actionLabel: "Open network builder" }
  },
  packet: {
    id: "packet",
    path: "/labs/packet",
    layer: "packet",
    name: "Packet Microscope",
    exploreTitle: "Packet Microscope",
    description: "Peel Ethernet, IP, TCP, UDP, and ICMP fields down to exact bytes and checksums.",
    meta: "SIMULATED OR CAPTURED \xB7 EXACT BYTES",
    status: "PACKET TRACE ACTIVE",
    group: "protocols"
  },
  tcp: {
    id: "tcp",
    path: "/labs/tcp",
    layer: "transport",
    name: "TCP Theater",
    exploreTitle: "TCP Theater",
    description: "Handshake, sequence space, loss, retransmission, congestion response, and teardown.",
    meta: "STATE MACHINE \xB7 SEQ / ACK \xB7 RECOVERY",
    status: "TCP THEATER ACTIVE",
    group: "protocols"
  },
  dns: {
    id: "dns",
    path: "/labs/dns",
    layer: "application",
    name: "DNS Theater",
    exploreTitle: "DNS Theater",
    description: "Recursive resolution, cache behavior, TTLs, retries, and visible failure boundaries.",
    meta: "CACHE \xB7 RECURSION \xB7 TTL",
    status: "DNS THEATER ACTIVE",
    group: "protocols"
  },
  tls: {
    id: "tls",
    path: "/labs/tls",
    layer: "application",
    name: "TLS 1.3 Theater",
    exploreTitle: "TLS 1.3 Theater",
    description: "Handshake negotiation, key schedule, certificate boundary, and encrypted application data.",
    meta: "TLS 1.3 \xB7 KEYS \xB7 ENCRYPTION",
    status: "TLS 1.3 THEATER ACTIVE",
    group: "protocols"
  },
  http: {
    id: "http",
    path: "/labs/http2-vs-http3",
    layer: "application",
    name: "HTTP/2 vs HTTP/3",
    exploreTitle: "HTTP/2 vs HTTP/3",
    description: "Compare multiplexing, TCP head-of-line blocking, QUIC streams, and recovery behavior.",
    meta: "H2/TCP \xB7 H3/QUIC \xB7 MULTIPLEXING",
    status: "HTTP/2 \u2194 HTTP/3 ACTIVE",
    group: "protocols"
  },
  internet: {
    id: "internet",
    path: "/internet/as-routing",
    layer: "internet",
    name: "AS Routing Theater",
    exploreTitle: "AS routing theater",
    description: "Explore deterministic interdomain relationships, valley-free policy, path selection, and route leaks.",
    meta: "SIMULATED \xB7 POLICY \xB7 BGP",
    status: "SIMULATED AS THEATER ACTIVE",
    group: "internet"
  },
  physical: {
    id: "physical",
    path: "/internet/physical",
    layer: "internet",
    name: "Physical Internet Atlas",
    exploreTitle: "Physical Internet atlas",
    description: "See facilities and physical Internet context on the globe without turning geography into forwarding truth.",
    meta: "PUBLIC DATA \xB7 INFERRED CORRIDORS",
    status: "PHYSICAL INTERNET ATLAS ACTIVE",
    group: "internet"
  },
  observed: {
    id: "observed",
    path: "/internet/observed",
    layer: "internet",
    name: "Internet Evidence",
    exploreTitle: "Internet evidence",
    description: "Inspect edge-observed and public-collector evidence with explicit vantage and provenance boundaries.",
    meta: "EDGE OBSERVED \xB7 PUBLIC COLLECTOR",
    status: "INTERNET EVIDENCE ACTIVE",
    group: "internet"
  },
  measured: {
    id: "measured",
    path: "/measured",
    layer: "internet",
    name: "Measured Network",
    exploreTitle: "Measured network",
    description: "Inspect imported or loopback-bridged local diagnostics without confusing one host vantage with Internet truth.",
    meta: "LOCAL MEASURED \xB7 EXPLICIT VANTAGE",
    status: "LOCAL MEASURED ACTIVE",
    group: "evidence"
  },
  capture: {
    id: "capture",
    path: "/capture",
    layer: "packet",
    name: "Capture Replay",
    exploreTitle: "Capture Replay",
    description: "Open a local PCAP/PCAPNG, follow conversations and time, inspect exact bytes, and keep missing evidence explicit.",
    meta: "CAPTURED \xB7 LOCAL ONLY \xB7 SESSION MEMORY",
    status: "CAPTURED EVIDENCE ACTIVE",
    group: "evidence"
  }
});
var WORKSPACE_COUNT = WORKSPACE_IDS.length;
var WORKSPACE_PATHS = Object.freeze(
  Object.fromEntries(WORKSPACE_IDS.map((id2) => [id2, WORKSPACE_CATALOG[id2].path]))
);

// ../8f1a24ac8c73/hopscotch/src/protocol/dns.ts
var DNS_QNAME = "www.example.test";
var DNS_ANSWER = "203.0.113.42";
var DNS_TTL_SECONDS = 300;
var ROOT_REFERRAL = { owner: "test.", type: "NS", value: "ns.test.invalid.", ttl: 86400 };
var TLD_REFERRAL = { owner: "example.test.", type: "NS", value: "ns1.example.test.", ttl: 3600 };
var A_RECORD = { owner: `${DNS_QNAME}.`, type: "A", value: DNS_ANSWER, ttl: DNS_TTL_SECONDS };
var missEvents = [
  {
    id: "stub-query",
    atMs: 0,
    kind: "query",
    from: "stub",
    to: "recursive",
    phase: "stub-query",
    severity: "info",
    title: "Stub asks for a recursive answer",
    summary: `${DNS_QNAME} A leaves the client with RD=1.`,
    detail: "The application-facing stub resolver asks its configured recursive resolver to finish the job. Recursion Desired is set on this client-to-resolver query.",
    qname: DNS_QNAME,
    qtype: "A",
    recursionDesired: true,
    delegation: "."
  },
  {
    id: "cache-miss",
    atMs: 350,
    kind: "cache.miss",
    from: "recursive",
    to: "cache",
    phase: "cache-check",
    severity: "warning",
    title: "Recursive cache misses",
    summary: "No usable answer or delegation is cached for this teaching query.",
    detail: "Because the recursive resolver cannot answer from cache, it starts iterative resolution. Upstream queries are not asking those servers to recurse on its behalf.",
    qname: DNS_QNAME,
    qtype: "A",
    delegation: "."
  },
  {
    id: "ask-root",
    atMs: 650,
    kind: "query",
    from: "recursive",
    to: "root",
    phase: "root",
    severity: "info",
    title: "Recursive asks the root",
    summary: `Who knows ${DNS_QNAME}?`,
    detail: "The recursive resolver begins at the root of the namespace. The root need not know the final A record; it only needs to direct the resolver toward the next zone cut.",
    qname: DNS_QNAME,
    qtype: "A",
    recursionDesired: false,
    delegation: "."
  },
  {
    id: "root-referral",
    atMs: 1050,
    kind: "referral",
    from: "root",
    to: "recursive",
    phase: "root",
    severity: "success",
    title: "Root refers the resolver to .test",
    summary: "The answer is not here; the next authority is the test. TLD.",
    detail: "This is a referral, not the final A answer. It tells the recursive resolver which nameserver is authoritative for the next delegation step.",
    records: [ROOT_REFERRAL],
    delegation: "test."
  },
  {
    id: "ask-tld",
    atMs: 1450,
    kind: "query",
    from: "recursive",
    to: "tld",
    phase: "tld",
    severity: "info",
    title: "Recursive follows the .test delegation",
    summary: `The same ${DNS_QNAME} A question moves one level deeper.`,
    detail: "Iterative resolution repeats the original question at the next authority. The recursive resolver is walking referrals until it reaches the zone that owns the name.",
    qname: DNS_QNAME,
    qtype: "A",
    recursionDesired: false,
    delegation: "test."
  },
  {
    id: "tld-referral",
    atMs: 1850,
    kind: "referral",
    from: "tld",
    to: "recursive",
    phase: "tld",
    severity: "success",
    title: ".test refers to example.test",
    summary: "The authoritative nameserver for example.test is the next stop.",
    detail: "The TLD server narrows the search from the top-level domain to the delegated example.test zone.",
    records: [TLD_REFERRAL],
    delegation: "example.test."
  },
  {
    id: "ask-authoritative",
    atMs: 2250,
    kind: "query",
    from: "recursive",
    to: "authoritative",
    phase: "authoritative",
    severity: "info",
    title: "Recursive reaches the authoritative zone",
    summary: `Now the resolver asks the server that owns example.test.`,
    detail: "The delegation chain has reached the authoritative source for the queried name. This server can provide the final A record instead of another referral.",
    qname: DNS_QNAME,
    qtype: "A",
    recursionDesired: false,
    delegation: "example.test."
  },
  {
    id: "authoritative-answer",
    atMs: 2700,
    kind: "answer",
    from: "authoritative",
    to: "recursive",
    phase: "authoritative",
    severity: "success",
    title: "Authoritative answer returns",
    summary: `${DNS_QNAME} \u2192 ${DNS_ANSWER} \xB7 TTL ${DNS_TTL_SECONDS}s`,
    detail: "The authoritative response supplies the final address record. The TTL gives downstream caches an upper bound on how long this data may be reused without asking again.",
    authoritative: true,
    records: [A_RECORD],
    delegation: `${DNS_QNAME}.`
  },
  {
    id: "cache-store",
    atMs: 3050,
    kind: "cache.store",
    from: "recursive",
    to: "cache",
    phase: "cache-store",
    severity: "success",
    title: "Recursive caches the answer",
    summary: `A ${DNS_ANSWER} enters cache with ${DNS_TTL_SECONDS}s remaining.`,
    detail: "Caching is what makes the next identical lookup radically shorter. The cached record ages; it is not permanent truth.",
    records: [A_RECORD],
    delegation: `${DNS_QNAME}.`
  },
  {
    id: "deliver-answer",
    atMs: 3450,
    kind: "deliver",
    from: "recursive",
    to: "stub",
    phase: "deliver",
    severity: "success",
    title: "Recursive returns the completed answer",
    summary: `${DNS_ANSWER} reaches the stub resolver.`,
    detail: "The stub sees one completed recursive answer even though the recursive resolver performed several iterative exchanges upstream.",
    records: [A_RECORD],
    delegation: `${DNS_QNAME}.`
  },
  {
    id: "complete",
    atMs: 3900,
    kind: "deliver",
    from: "recursive",
    to: "stub",
    phase: "complete",
    severity: "success",
    title: "Miss path complete",
    summary: "Four network exchanges produced one cached answer.",
    detail: "The useful artifact of the miss is not only the returned A record; it is also the cached state that can collapse future lookups.",
    records: [A_RECORD],
    delegation: `${DNS_QNAME}.`
  }
];
var hitEvents = [
  {
    id: "hit-stub-query",
    atMs: 0,
    kind: "query",
    from: "stub",
    to: "recursive",
    phase: "stub-query",
    severity: "info",
    title: "The same query arrives again",
    summary: `${DNS_QNAME} A reaches the recursive resolver with RD=1.`,
    detail: "From the stub resolver\u2019s perspective, the request looks the same as the cache-miss query.",
    qname: DNS_QNAME,
    qtype: "A",
    recursionDesired: true,
    delegation: `${DNS_QNAME}.`
  },
  {
    id: "cache-hit",
    atMs: 350,
    kind: "cache.hit",
    from: "recursive",
    to: "cache",
    phase: "cache-hit",
    severity: "success",
    title: "Fresh answer found in cache",
    summary: "No root, TLD, or authoritative query is necessary.",
    detail: "The recursive resolver can answer immediately because the cached TTL has not expired. Upstream authorities stay completely quiet.",
    records: [A_RECORD],
    delegation: `${DNS_QNAME}.`
  },
  {
    id: "hit-deliver",
    atMs: 750,
    kind: "deliver",
    from: "recursive",
    to: "stub",
    phase: "deliver",
    severity: "success",
    title: "Cached answer returns",
    summary: `${DNS_ANSWER} comes back with an aged TTL.`,
    detail: "The value is the same, but the TTL exposed to the client reflects time already spent in cache.",
    records: [A_RECORD],
    delegation: `${DNS_QNAME}.`
  },
  {
    id: "hit-complete",
    atMs: 1200,
    kind: "deliver",
    from: "recursive",
    to: "stub",
    phase: "complete",
    severity: "success",
    title: "Hit path complete",
    summary: "One resolver round trip replaced the entire delegation walk.",
    detail: "This is the practical payoff of DNS caching: less latency and less upstream query load while cached data remains valid.",
    records: [A_RECORD],
    delegation: `${DNS_QNAME}.`
  }
];
var dnsScenarios = {
  miss: { mode: "miss", durationMs: 4200, events: missEvents, initialCacheAgeSeconds: null },
  hit: { mode: "hit", durationMs: 1500, events: hitEvents, initialCacheAgeSeconds: 42 }
};
function dnsScenario(mode) {
  return dnsScenarios[mode];
}
function clampDnsTime(mode, timeMs) {
  return Math.max(0, Math.min(dnsScenario(mode).durationMs, timeMs));
}
function dnsEventsAtOrBefore(mode, timeMs) {
  const scenario = dnsScenario(mode);
  const time = clampDnsTime(mode, timeMs);
  return scenario.events.filter((event3) => event3.atMs <= time);
}
function phaseLabel(phase) {
  switch (phase) {
    case "stub-query":
      return "RECURSIVE QUERY REQUESTED";
    case "cache-check":
      return "CACHE MISS";
    case "root":
      return "ROOT DELEGATION";
    case "tld":
      return "TLD DELEGATION";
    case "authoritative":
      return "AUTHORITATIVE LOOKUP";
    case "cache-store":
      return "ANSWER CACHED";
    case "deliver":
      return "ANSWER DELIVERY";
    case "cache-hit":
      return "CACHE HIT";
    case "complete":
      return "RESOLUTION COMPLETE";
  }
}
function dnsStateAt(mode, timeMs) {
  const scenario = dnsScenario(mode);
  const time = clampDnsTime(mode, timeMs);
  const events2 = dnsEventsAtOrBefore(mode, time);
  const latest = events2[events2.length - 1] ?? scenario.events[0];
  const stored = events2.some((event3) => event3.kind === "cache.store");
  const hit = events2.some((event3) => event3.kind === "cache.hit");
  const answered = events2.some((event3) => event3.kind === "answer" || event3.kind === "cache.hit" || event3.kind === "deliver");
  const cacheAgeStart = mode === "hit" ? scenario.initialCacheAgeSeconds ?? 0 : 0;
  const storeAt = mode === "miss" ? 3050 : 0;
  const hasCache = mode === "hit" || stored;
  const ageSeconds = hasCache ? cacheAgeStart + Math.max(0, Math.floor((time - storeAt) / 1e3)) : 0;
  const ttl = hasCache ? Math.max(0, DNS_TTL_SECONDS - ageSeconds) : null;
  return {
    timeMs: time,
    phase: latest.phase,
    phaseLabel: phaseLabel(latest.phase),
    activeDelegation: latest.delegation ?? ".",
    cacheState: hit ? "hit" : stored ? "stored" : "empty",
    cacheTtlSeconds: ttl,
    answer: answered ? A_RECORD : null,
    latestEventId: latest.id
  };
}

// ../8f1a24ac8c73/hopscotch/src/protocol/tls.ts
var TLS_HOST = "www.example.test";
var clientHelloFields = [
  { label: "supported_versions", value: "TLS 1.3" },
  { label: "server_name", value: TLS_HOST },
  { label: "ALPN", value: "h2, http/1.1" },
  { label: "cipher_suites", value: "TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384" },
  { label: "supported_groups", value: "X25519, secp256r1" },
  { label: "key_share", value: "X25519 \xB7 symbolic public share C" }
];
var serverHelloFields = [
  { label: "supported_versions", value: "TLS 1.3" },
  { label: "cipher_suite", value: "TLS_AES_128_GCM_SHA256" },
  { label: "key_share", value: "X25519 \xB7 symbolic public share S" }
];
var tlsEvents = [
  {
    id: "client-hello",
    atMs: 0,
    actor: "client",
    direction: "client-to-server",
    phase: "client-hello",
    protection: "cleartext",
    message: "ClientHello",
    title: "Client offers TLS 1.3 parameters",
    summary: `SNI ${TLS_HOST}, ALPN h2/http1.1, X25519 key share, and TLS 1.3 cipher suites leave in the clear.`,
    detail: "ClientHello begins the handshake transcript. In this full 1-RTT model there is no PSK or 0-RTT data. The key share contributes to the later ECDHE shared secret.",
    transcriptLabel: "ClientHello",
    fields: clientHelloFields,
    activates: ["early"],
    certificateState: "unchecked"
  },
  {
    id: "server-hello",
    atMs: 430,
    actor: "server",
    direction: "server-to-client",
    phase: "server-hello",
    protection: "cleartext",
    message: "ServerHello",
    title: "Server selects the cryptographic context",
    summary: "TLS 1.3, X25519, and TLS_AES_128_GCM_SHA256 are selected.",
    detail: "ServerHello completes the visible key-exchange negotiation. Both peers now have the information required to derive the ECDHE-based Handshake Secret and handshake traffic secrets.",
    transcriptLabel: "ServerHello",
    fields: serverHelloFields,
    activates: ["early"],
    certificateState: "unchecked"
  },
  {
    id: "handshake-secret",
    atMs: 680,
    actor: "local",
    direction: "local",
    phase: "handshake-keys",
    protection: "local",
    message: "HKDF key schedule",
    title: "Handshake traffic secrets become available",
    summary: "ECDHE feeds the Handshake Secret; transcript(ClientHello\u2026ServerHello) contextualizes client/server handshake traffic secrets.",
    detail: "HOPSCOTCH represents this symbolically. It does not fabricate secret bytes. These handshake traffic secrets protect the encrypted authentication flight that follows.",
    activates: ["early", "handshake"],
    certificateState: "unchecked"
  },
  {
    id: "encrypted-extensions",
    atMs: 930,
    actor: "server",
    direction: "server-to-client",
    phase: "server-encrypted-flight",
    protection: "handshake",
    message: "EncryptedExtensions",
    title: "The handshake crosses the encryption boundary",
    summary: "EncryptedExtensions is the first server handshake message protected with server handshake traffic keys.",
    detail: "Extensions not needed to establish the cryptographic context move here. In this model the server confirms ALPN h2 inside the encrypted handshake flight.",
    transcriptLabel: "EncryptedExtensions",
    fields: [{ label: "ALPN selected", value: "h2" }],
    activates: ["early", "handshake"],
    certificateState: "unchecked"
  },
  {
    id: "certificate",
    atMs: 1220,
    actor: "server",
    direction: "server-to-client",
    phase: "server-encrypted-flight",
    protection: "handshake",
    message: "Certificate",
    title: "Server sends its simulated certificate chain",
    summary: `${TLS_HOST} leaf \u2192 HOPSCOTCH Test Intermediate \u2192 HOPSCOTCH Test Root.`,
    detail: "The certificate message is encrypted under the server handshake traffic secret in TLS 1.3. The chain here is deliberately simulated and not a real trust anchor.",
    transcriptLabel: "Certificate",
    fields: [
      { label: "Leaf SAN", value: TLS_HOST },
      { label: "Leaf key", value: "ECDSA P-256 \xB7 simulated" },
      { label: "Intermediate", value: "HOPSCOTCH Test Intermediate" },
      { label: "Root", value: "HOPSCOTCH Test Root \xB7 simulated trust anchor" }
    ],
    activates: ["early", "handshake"],
    certificateState: "unchecked"
  },
  {
    id: "certificate-verify",
    atMs: 1510,
    actor: "server",
    direction: "server-to-client",
    phase: "server-encrypted-flight",
    protection: "handshake",
    message: "CertificateVerify",
    title: "Server proves possession of the certificate key",
    summary: "A signature covers the TLS 1.3 CertificateVerify context and the handshake transcript.",
    detail: "The client verifies this signature with the public key from the end-entity certificate. This binds the authenticated identity to the handshake transcript.",
    transcriptLabel: "CertificateVerify",
    fields: [{ label: "signature algorithm", value: "ecdsa_secp256r1_sha256 \xB7 simulated signature" }],
    activates: ["early", "handshake"],
    certificateState: "validating"
  },
  {
    id: "certificate-validation",
    atMs: 1690,
    actor: "local",
    direction: "local",
    phase: "certificate-validation",
    protection: "local",
    message: "Certificate validation",
    title: "Client validates identity and chain",
    summary: `Hostname ${TLS_HOST} matches; simulated chain and CertificateVerify proof validate.`,
    detail: "This local step is a teaching abstraction for certificate/path/hostname verification. No public CA claim is made and the displayed chain is intentionally synthetic.",
    activates: ["early", "handshake"],
    certificateState: "valid"
  },
  {
    id: "server-finished",
    atMs: 1900,
    actor: "server",
    direction: "server-to-client",
    phase: "server-finished",
    protection: "handshake",
    message: "Finished",
    title: "Server authenticates the handshake transcript",
    summary: "Server Finished verifies the handshake state and completes the server authentication block.",
    detail: "Finished is a MAC over the transcript using a key derived from the server handshake traffic secret. The client must verify it before trusting the completed server handshake.",
    transcriptLabel: "Server Finished",
    fields: [{ label: "verify_data", value: "HMAC over transcript hash \xB7 symbolic" }],
    activates: ["early", "handshake"],
    certificateState: "valid"
  },
  {
    id: "master-and-app-secrets",
    atMs: 2110,
    actor: "local",
    direction: "local",
    phase: "application-keys",
    protection: "local",
    message: "Application key schedule",
    title: "Master and application traffic secrets are derived",
    summary: "The transcript through server Finished feeds client/server application traffic secret 0.",
    detail: "TLS 1.3 derives application traffic secrets from the Master Secret and the transcript through the server Finished. The client still has one handshake-authentication message left to send.",
    activates: ["early", "handshake", "master", "application"],
    certificateState: "valid"
  },
  {
    id: "client-finished",
    atMs: 2350,
    actor: "client",
    direction: "client-to-server",
    phase: "client-finished",
    protection: "handshake",
    message: "Finished",
    title: "Client Finished completes mutual key confirmation",
    summary: "The client Finished is still protected with client handshake traffic keys.",
    detail: "The client authenticates its view of the handshake transcript. After both sides have exchanged and validated Finished, this curated handshake is complete.",
    transcriptLabel: "Client Finished",
    fields: [{ label: "verify_data", value: "HMAC over transcript hash \xB7 symbolic" }],
    activates: ["early", "handshake", "master", "application"],
    certificateState: "valid"
  },
  {
    id: "application-data-request",
    atMs: 2720,
    actor: "client",
    direction: "client-to-server",
    phase: "application-data",
    protection: "application",
    message: "Application Data",
    title: "HTTP/2 request is now opaque TLS Application Data",
    summary: "The record layer uses client application traffic secret 0 derived key/IV material.",
    detail: "The protocol theater intentionally stops exposing application plaintext on the wire. HOPSCOTCH can still label the semantic payload because this is a curated teaching trace, not passive decryption.",
    fields: [{ label: "semantic payload", value: "HTTP/2 HEADERS \xB7 GET /" }],
    activates: ["early", "handshake", "master", "application"],
    certificateState: "valid"
  },
  {
    id: "application-data-response",
    atMs: 3100,
    actor: "server",
    direction: "server-to-client",
    phase: "application-data",
    protection: "application",
    message: "Application Data",
    title: "Server responds under application traffic keys",
    summary: "Encrypted TLS records carry the HTTP/2 response in the opposite direction.",
    detail: "Client and server maintain separate application traffic secrets and therefore separate write keys/IVs. The record contents remain encrypted on the wire.",
    fields: [{ label: "semantic payload", value: "HTTP/2 HEADERS + DATA \xB7 200" }],
    activates: ["early", "handshake", "master", "application"],
    certificateState: "valid"
  },
  {
    id: "tls-complete",
    atMs: 3500,
    actor: "local",
    direction: "local",
    phase: "complete",
    protection: "local",
    message: "Established TLS 1.3",
    title: "Authenticated encrypted channel established",
    summary: "TLS 1.3 negotiation, server authentication, Finished verification, and application-key transition are complete.",
    detail: "This deterministic trace now provides a stable bridge from DNS resolution and TCP transport into HTTP/2 or HTTP/3 application behavior.",
    activates: ["early", "handshake", "master", "application"],
    certificateState: "valid"
  }
];
var tlsDurationMs = 3800;
function clampTlsTime(timeMs) {
  return Math.max(0, Math.min(tlsDurationMs, timeMs));
}
function tlsEventsAtOrBefore(timeMs) {
  const time = clampTlsTime(timeMs);
  return tlsEvents.filter((event3) => event3.atMs <= time);
}
function phaseLabel2(phase) {
  switch (phase) {
    case "client-hello":
      return "CLIENT OFFER";
    case "server-hello":
      return "SERVER SELECTION";
    case "handshake-keys":
      return "HANDSHAKE KEYS READY";
    case "server-encrypted-flight":
      return "ENCRYPTED SERVER FLIGHT";
    case "certificate-validation":
      return "IDENTITY VALIDATION";
    case "server-finished":
      return "SERVER FINISHED";
    case "client-finished":
      return "CLIENT FINISHED";
    case "application-keys":
      return "APPLICATION KEYS READY";
    case "application-data":
      return "ENCRYPTED APPLICATION DATA";
    case "complete":
      return "TLS 1.3 ESTABLISHED";
  }
}
function tlsStateAt(timeMs) {
  const time = clampTlsTime(timeMs);
  const events2 = tlsEventsAtOrBefore(time);
  const latest = events2[events2.length - 1] ?? tlsEvents[0];
  const transcript = events2.flatMap((event3) => event3.transcriptLabel ? [event3.transcriptLabel] : []);
  const activeKeys = Array.from(new Set(events2.flatMap((event3) => event3.activates ?? [])));
  const serverHelloSeen = events2.some((event3) => event3.id === "server-hello");
  const encryptedExtensionsSeen = events2.some((event3) => event3.id === "encrypted-extensions");
  const appKeysSeen = events2.some((event3) => event3.id === "master-and-app-secrets");
  const clientFinishedSeen = events2.some((event3) => event3.id === "client-finished");
  return {
    timeMs: time,
    phase: latest.phase,
    phaseLabel: phaseLabel2(latest.phase),
    latestEventId: latest.id,
    transcript,
    activeKeys,
    protection: latest.protection,
    certificateState: latest.certificateState ?? "unchecked",
    negotiatedVersion: serverHelloSeen ? "TLS 1.3" : null,
    negotiatedCipher: serverHelloSeen ? "TLS_AES_128_GCM_SHA256" : null,
    negotiatedGroup: serverHelloSeen ? "X25519" : null,
    negotiatedAlpn: encryptedExtensionsSeen ? "h2" : null,
    applicationReady: appKeysSeen && clientFinishedSeen
  };
}

// ../8f1a24ac8c73/hopscotch/src/protocol/httpComparison.ts
var HTTP_COMPARISON_DURATION_MS = 3200;
var httpComparisonEvents = [
  {
    id: "requests-open",
    atMs: 0,
    focus: "both",
    title: "Two responses begin concurrently",
    summary: "Both lanes serve /hero.jpg and /app.js at the same time.",
    detail: "HTTP/2 multiplexes frames for both streams over one TCP connection. HTTP/3 maps each request/response pair to an independent QUIC stream.",
    h2Label: "H2 streams 1 + 3 share one ordered TCP byte stream",
    h3Label: "H3 request streams 0 + 4 are independent QUIC streams"
  },
  {
    id: "first-data",
    atMs: 450,
    focus: "both",
    title: "Both resources make forward progress",
    summary: "Initial data for both streams reaches the client in both lanes.",
    detail: "Before loss, multiplexing looks superficially similar: two application streams interleave over one connection.",
    h2Label: "TCP delivers bytes in order to HTTP/2",
    h3Label: "QUIC delivers ordered bytes within each stream"
  },
  {
    id: "loss",
    atMs: 900,
    focus: "both",
    title: "The same logical Stream A data is lost",
    summary: "A transport packet carrying /hero.jpg data disappears in each lane.",
    detail: "The loss event is synchronized to isolate the transport difference. The comparison is curated; packetization details are chosen to expose head-of-line behavior clearly.",
    h2Label: "TCP sequence hole opens in the connection byte stream",
    h3Label: "QUIC Stream A offset range is missing"
  },
  {
    id: "later-data",
    atMs: 1200,
    focus: "both",
    title: "Later data arrives after the gap",
    summary: "Packets carrying later bytes\u2014including Stream B data\u2014still reach the receiver.",
    detail: "The network can deliver packets out of order. What matters is what the transport is allowed to release upward to the HTTP layer.",
    h2Label: "Later TCP bytes are buffered behind the missing sequence range",
    h3Label: "Stream B bytes can be delivered independently of Stream A ordering"
  },
  {
    id: "hol-diverges",
    atMs: 1450,
    focus: "both",
    title: "The lanes visibly diverge",
    summary: "HTTP/2 stalls both responses; HTTP/3 keeps /app.js moving.",
    detail: "TCP presents one ordered byte stream, so a sequence gap prevents later connection bytes from reaching HTTP/2. QUIC has no ordering relationship between bytes on different streams, so Stream B can progress while Stream A waits for repair.",
    h2Label: "CONNECTION HOL \xB7 Stream A + Stream B blocked",
    h3Label: "Stream A blocked \xB7 Stream B still progressing"
  },
  {
    id: "congestion-response",
    atMs: 1650,
    focus: "h3",
    title: "QUIC loss still affects the connection",
    summary: "HTTP/3 avoids cross-stream ordering blockage, not all consequences of packet loss.",
    detail: "QUIC recovery and congestion control are connection-level mechanisms. The curated trace shows reduced sending pressure while preserving Stream B delivery independence.",
    h2Label: "TCP loss recovery / congestion response active",
    h3Label: "QUIC loss recovery active \xB7 Stream B remains deliverable"
  },
  {
    id: "h2-retransmit",
    atMs: 1900,
    focus: "h2",
    title: "TCP retransmits the missing connection bytes",
    summary: "Repairing the TCP sequence hole finally lets HTTP/2 see the buffered later bytes.",
    detail: "Once the missing range arrives, TCP can release the contiguous byte stream. HTTP/2 can then resume parsing frames from both logical streams.",
    h2Label: "TCP retransmission repairs the connection byte stream",
    h3Label: "Stream B has already moved ahead"
  },
  {
    id: "h2-release",
    atMs: 2150,
    focus: "h2",
    title: "HTTP/2 releases both stalled streams",
    summary: "/hero.jpg and /app.js jump forward together after TCP repair.",
    detail: "This is transport head-of-line blocking beneath HTTP/2 multiplexing: independent HTTP streams were coupled by the ordered TCP substrate.",
    h2Label: "Buffered H2 frames become deliverable",
    h3Label: "No equivalent cross-stream release event was necessary"
  },
  {
    id: "h3-retransmit",
    atMs: 2350,
    focus: "h3",
    title: "QUIC repairs Stream A",
    summary: "/hero.jpg receives the missing stream range while /app.js is already near completion.",
    detail: "QUIC retransmits stream data as needed, but the lost Stream A range does not impose ordering on Stream B. STREAM frame boundaries need not be preserved during retransmission.",
    h2Label: "Both H2 streams are progressing again",
    h3Label: "Only Stream A needed ordering repair"
  },
  {
    id: "complete",
    atMs: 2850,
    focus: "both",
    title: "Both lanes complete",
    summary: "The final payload bytes are the same; the delivery coupling under loss was not.",
    detail: "This theater isolates transport head-of-line behavior. It does not claim HTTP/3 can never block: flow control, congestion control, or QPACK dependencies can still create delays. This curated trace avoids dynamic QPACK dependencies.",
    h2Label: "HTTP/2 complete after connection-level repair",
    h3Label: "HTTP/3 complete with independent stream progress"
  }
];
function clampHttpComparisonTime(timeMs) {
  return Math.max(0, Math.min(HTTP_COMPARISON_DURATION_MS, timeMs));
}
function latestHttpComparisonEvent(timeMs) {
  const time = clampHttpComparisonTime(timeMs);
  const events2 = httpComparisonEvents.filter((event3) => event3.atMs <= time);
  return events2[events2.length - 1] ?? httpComparisonEvents[0];
}
function h2State(timeMs) {
  if (timeMs >= 2850) return { streamA: "complete", streamB: "complete", streamAProgress: 100, streamBProgress: 100, transportLabel: "HTTP/2 over TCP", lossLabel: "repaired", deliveryLabel: "both complete", congestionLabel: "recovery complete" };
  if (timeMs >= 2150) return { streamA: "progressing", streamB: "progressing", streamAProgress: 78, streamBProgress: 82, transportLabel: "HTTP/2 over TCP", lossLabel: "sequence gap repaired", deliveryLabel: "buffered frames released", congestionLabel: "additive recovery" };
  if (timeMs >= 1900) return { streamA: "retransmitting", streamB: "blocked", streamAProgress: 34, streamBProgress: 38, transportLabel: "HTTP/2 over TCP", lossLabel: "TCP retransmitting gap", deliveryLabel: "HTTP/2 still waiting", congestionLabel: "loss recovery active" };
  if (timeMs >= 900) return { streamA: "blocked", streamB: "blocked", streamAProgress: 34, streamBProgress: 38, transportLabel: "HTTP/2 over TCP", lossLabel: "TCP sequence hole", deliveryLabel: "connection HOL blocking", congestionLabel: "loss response active" };
  if (timeMs >= 450) return { streamA: "active", streamB: "active", streamAProgress: 34, streamBProgress: 38, transportLabel: "HTTP/2 over TCP", lossLabel: "none", deliveryLabel: "multiplexed progress", congestionLabel: "steady sending" };
  return { streamA: "active", streamB: "active", streamAProgress: 12, streamBProgress: 14, transportLabel: "HTTP/2 over TCP", lossLabel: "none", deliveryLabel: "responses opening", congestionLabel: "steady sending" };
}
function h3State(timeMs) {
  if (timeMs >= 2850) return { streamA: "complete", streamB: "complete", streamAProgress: 100, streamBProgress: 100, transportLabel: "HTTP/3 over QUIC", lossLabel: "repaired", deliveryLabel: "both complete", congestionLabel: "recovery complete" };
  if (timeMs >= 2350) return { streamA: "retransmitting", streamB: "complete", streamAProgress: 72, streamBProgress: 100, transportLabel: "HTTP/3 over QUIC", lossLabel: "Stream A repair", deliveryLabel: "Stream B already complete", congestionLabel: "connection recovering" };
  if (timeMs >= 1650) return { streamA: "blocked", streamB: "progressing", streamAProgress: 34, streamBProgress: 88, transportLabel: "HTTP/3 over QUIC", lossLabel: "Stream A offset gap", deliveryLabel: "Stream B independent", congestionLabel: "connection-wide loss response" };
  if (timeMs >= 1200) return { streamA: "blocked", streamB: "progressing", streamAProgress: 34, streamBProgress: 66, transportLabel: "HTTP/3 over QUIC", lossLabel: "Stream A offset gap", deliveryLabel: "Stream B independent", congestionLabel: "loss detected" };
  if (timeMs >= 900) return { streamA: "blocked", streamB: "active", streamAProgress: 34, streamBProgress: 43, transportLabel: "HTTP/3 over QUIC", lossLabel: "Stream A offset gap", deliveryLabel: "Stream B remains eligible", congestionLabel: "loss detection pending" };
  if (timeMs >= 450) return { streamA: "active", streamB: "active", streamAProgress: 34, streamBProgress: 38, transportLabel: "HTTP/3 over QUIC", lossLabel: "none", deliveryLabel: "independent streams", congestionLabel: "steady sending" };
  return { streamA: "active", streamB: "active", streamAProgress: 12, streamBProgress: 14, transportLabel: "HTTP/3 over QUIC", lossLabel: "none", deliveryLabel: "responses opening", congestionLabel: "steady sending" };
}
function httpComparisonStateAt(timeMs) {
  const time = clampHttpComparisonTime(timeMs);
  const latest = latestHttpComparisonEvent(time);
  return {
    timeMs: time,
    latestEventId: latest.id,
    phaseLabel: latest.title.toUpperCase(),
    h2: h2State(time),
    h3: h3State(time)
  };
}

// ../8f1a24ac8c73/hopscotch/src/protocol/tcp.ts
var MSS = 1460;
function event(input2) {
  return {
    cwndMss: 6,
    ssthreshMss: 12,
    duplicateAcks: 0,
    ...input2
  };
}
var tcpScenario = {
  id: "lab-03a-tcp-fast-retransmit",
  title: "TCP fast retransmit and recovery",
  durationMs: 5e3,
  mss: MSS,
  clientInitialSeq: 1e3,
  serverInitialSeq: 7e3,
  events: [
    event({ id: "syn", atMs: 0, kind: "handshake.syn", direction: "client-to-server", title: "Client opens the connection", summary: "SYN consumes one sequence number and proposes CLIENT ISN 1000.", detail: "The client sends SYN with SEQ 1000. A successful peer acknowledges 1001 because SYN occupies one position in TCP sequence space.", severity: "info", flags: "SYN", seq: 1e3, phase: "handshake" }),
    event({ id: "synack", atMs: 350, kind: "handshake.synack", direction: "server-to-client", title: "Server answers with SYN / ACK", summary: "SERVER ISN 7000 acknowledges the client SYN with ACK 1001.", detail: "The server combines its own SYN with an acknowledgment of the client sequence space: SEQ 7000, ACK 1001.", severity: "info", flags: "SYN \xB7 ACK", seq: 7e3, ack: 1001, phase: "handshake" }),
    event({ id: "handshake-complete", atMs: 700, kind: "handshake.ack", direction: "client-to-server", title: "Connection established", summary: "ACK 7001 completes the three-way handshake.", detail: "The final ACK confirms both initial sequence numbers. Application data can now begin at client SEQ 1001.", severity: "success", flags: "ACK", seq: 1001, ack: 7001, phase: "established" }),
    event({ id: "data-1", atMs: 1050, kind: "data.segment", direction: "client-to-server", title: "Segment 1 arrives in order", summary: "SEQ 1001\u20132460 advances the receiver next-expected byte to 2461.", detail: "One full 1460-byte MSS arrives. The receiver is now waiting for byte 2461.", severity: "info", flags: "PSH \xB7 ACK", seq: 1001, ack: 7001, length: MSS, segmentIndex: 1, phase: "established" }),
    event({ id: "data-2-loss", atMs: 1250, kind: "data.loss", direction: "client-to-server", title: "Segment 2 is lost", summary: "SEQ 2461\u20133920 disappears before the server receives it.", detail: "This missing sequence range creates a hole. TCP can recover it without waiting for the retransmission timer if enough later data arrives to produce duplicate ACKs.", severity: "critical", flags: "PSH \xB7 ACK", seq: 2461, ack: 7001, length: MSS, segmentIndex: 2, phase: "loss" }),
    event({ id: "data-3", atMs: 1450, kind: "data.segment", direction: "client-to-server", title: "Segment 3 arrives out of order", summary: "SEQ 3921\u20135380 arrives, but byte 2461 is still missing.", detail: "The receiver can buffer this later range, but its cumulative acknowledgment cannot move past the missing byte.", severity: "warning", flags: "PSH \xB7 ACK", seq: 3921, ack: 7001, length: MSS, segmentIndex: 3, phase: "loss" }),
    event({ id: "dup-ack-1", atMs: 1600, kind: "ack.duplicate", direction: "server-to-client", title: "Duplicate ACK 1", summary: "The server repeats ACK 2461: that is still the first missing byte.", detail: "A duplicate cumulative ACK is evidence that later data arrived while the expected sequence did not.", severity: "warning", flags: "ACK", seq: 7001, ack: 2461, duplicateAcks: 1, phase: "duplicate-acks" }),
    event({ id: "data-4", atMs: 1750, kind: "data.segment", direction: "client-to-server", title: "Segment 4 extends the out-of-order queue", summary: "SEQ 5381\u20136840 arrives while the 2461 hole remains.", detail: "The receiver still cannot advance its cumulative ACK, so another duplicate ACK follows.", severity: "warning", flags: "PSH \xB7 ACK", seq: 5381, ack: 7001, length: MSS, segmentIndex: 4, duplicateAcks: 1, phase: "duplicate-acks" }),
    event({ id: "dup-ack-2", atMs: 1875, kind: "ack.duplicate", direction: "server-to-client", title: "Duplicate ACK 2", summary: "ACK 2461 repeats again.", detail: "Two duplicate ACKs strengthen the loss signal, but this curated Reno scenario waits for the third duplicate ACK before fast retransmit.", severity: "warning", flags: "ACK", seq: 7001, ack: 2461, duplicateAcks: 2, phase: "duplicate-acks" }),
    event({ id: "data-5", atMs: 2e3, kind: "data.segment", direction: "client-to-server", title: "Segment 5 arrives behind the same hole", summary: "SEQ 6841\u20138300 arrives out of order.", detail: "The receiver now holds three contiguous later segments behind the missing SEQ 2461\u20133920 range.", severity: "warning", flags: "PSH \xB7 ACK", seq: 6841, ack: 7001, length: MSS, segmentIndex: 5, duplicateAcks: 2, phase: "duplicate-acks" }),
    event({ id: "dup-ack-3", atMs: 2125, kind: "ack.duplicate", direction: "server-to-client", title: "Duplicate ACK 3 triggers fast retransmit", summary: "The third ACK 2461 crosses the curated Reno fast-retransmit threshold.", detail: "The sender infers one segment was probably lost while the path still delivers later packets. It can retransmit without waiting for the retransmission timeout.", severity: "critical", flags: "ACK \xD73", seq: 7001, ack: 2461, duplicateAcks: 3, phase: "duplicate-acks" }),
    event({ id: "fast-recovery", atMs: 2200, kind: "congestion.fast-recovery", direction: "local", title: "Reno enters fast recovery", summary: "ssthresh falls to 3 MSS; cwnd is temporarily inflated to 6 MSS.", detail: "For this curated Reno model, the 6-MSS flight is halved to a 3-MSS slow-start threshold. During fast recovery, cwnd is represented as ssthresh + 3 duplicate ACKs = 6 MSS.", severity: "critical", cwndMss: 6, ssthreshMss: 3, duplicateAcks: 3, phase: "fast-recovery" }),
    event({ id: "retransmit", atMs: 2275, kind: "data.retransmit", direction: "client-to-server", title: "Fast retransmit repairs the hole", summary: "SEQ 2461\u20133920 is sent again immediately.", detail: "The retransmission carries the exact sequence range identified by the repeated ACK 2461 signal.", severity: "success", flags: "PSH \xB7 ACK \xB7 RTX", seq: 2461, ack: 7001, length: MSS, segmentIndex: 2, cwndMss: 6, ssthreshMss: 3, duplicateAcks: 3, phase: "fast-recovery" }),
    event({ id: "cumulative-ack", atMs: 2600, kind: "ack.cumulative", direction: "server-to-client", title: "One ACK releases the buffered ranges", summary: "ACK 8301 cumulatively covers segments 2 through 5.", detail: "Once the missing bytes arrive, the receiver already has SEQ 3921\u20138300 buffered. Its cumulative ACK can jump directly from 2461 to 8301.", severity: "success", flags: "ACK", seq: 7001, ack: 8301, cwndMss: 6, ssthreshMss: 3, phase: "fast-recovery" }),
    event({ id: "recovery-exit", atMs: 2700, kind: "congestion.recover", direction: "local", title: "cwnd deflates to ssthresh", summary: "Fast recovery ends at cwnd 3 MSS, ssthresh 3 MSS.", detail: "The full cumulative ACK confirms recovery of the lost range. This curated Reno model exits fast recovery by deflating cwnd to the 3-MSS threshold.", severity: "info", cwndMss: 3, ssthreshMss: 3, phase: "recovered" }),
    event({ id: "post-recovery-data", atMs: 3150, kind: "data.segment", direction: "client-to-server", title: "Forward progress resumes", summary: "SEQ 8301\u20139760 crosses the repaired connection.", detail: "The sender continues from the cumulatively acknowledged sequence point instead of replaying data that the receiver already buffered.", severity: "success", flags: "PSH \xB7 ACK", seq: 8301, ack: 7001, length: MSS, segmentIndex: 6, cwndMss: 3, ssthreshMss: 3, phase: "recovered" }),
    event({ id: "post-recovery-ack", atMs: 3425, kind: "ack.cumulative", direction: "server-to-client", title: "ACK 9761 grows the window again", summary: "Successful delivery raises the illustrated congestion window to 4 MSS.", detail: "The scenario now shows additive recovery rather than snapping immediately back to the pre-loss window.", severity: "success", flags: "ACK", seq: 7001, ack: 9761, cwndMss: 4, ssthreshMss: 3, phase: "recovered" }),
    event({ id: "client-fin", atMs: 4e3, kind: "teardown.fin", direction: "client-to-server", title: "Client begins teardown", summary: "FIN at SEQ 9761 consumes one final sequence number.", detail: "TCP teardown also uses sequence space. The peer will acknowledge 9762.", severity: "info", flags: "FIN \xB7 ACK", seq: 9761, ack: 7001, cwndMss: 4, ssthreshMss: 3, phase: "closing" }),
    event({ id: "server-finack", atMs: 4300, kind: "teardown.finack", direction: "server-to-client", title: "Server acknowledges and closes its side", summary: "ACK 9762 plus FIN at SERVER SEQ 7001.", detail: "For the compact theater sequence, the server combines its acknowledgment with its own FIN.", severity: "info", flags: "FIN \xB7 ACK", seq: 7001, ack: 9762, cwndMss: 4, ssthreshMss: 3, phase: "closing" }),
    event({ id: "final-ack", atMs: 4600, kind: "teardown.ack", direction: "client-to-server", title: "Final ACK closes the theater sequence", summary: "ACK 7002 confirms the server FIN.", detail: "The modeled exchange is complete. Real TCP endpoint state can persist afterward, such as TIME_WAIT, but this theater focuses on the wire exchange itself.", severity: "success", flags: "ACK", seq: 9762, ack: 7002, cwndMss: 4, ssthreshMss: 3, phase: "closed-cleanly" })
  ]
};
function clampTcpTime(timeMs) {
  return Math.max(0, Math.min(tcpScenario.durationMs, timeMs));
}
function tcpEventsAtOrBefore(timeMs) {
  const clamped = clampTcpTime(timeMs);
  return tcpScenario.events.filter((item) => item.atMs <= clamped);
}
function tcpLatestEventAtOrBefore(timeMs) {
  const events2 = tcpEventsAtOrBefore(timeMs);
  return events2[events2.length - 1] ?? tcpScenario.events[0];
}
function phaseLabel3(phase) {
  switch (phase) {
    case "handshake":
      return "NEGOTIATING CONNECTION";
    case "established":
      return "CONNECTION ESTABLISHED";
    case "loss":
      return "SEQUENCE HOLE DETECTED";
    case "duplicate-acks":
      return "DUPLICATE ACK SIGNAL";
    case "fast-recovery":
      return "FAST RECOVERY";
    case "recovered":
      return "FORWARD PROGRESS RESTORED";
    case "closing":
      return "CONNECTION CLOSING";
    case "closed-cleanly":
      return "WIRE EXCHANGE COMPLETE";
    default:
      return "CLOSED";
  }
}
function expectedClientAckAt(timeMs) {
  if (timeMs >= 4e3) return 9762;
  if (timeMs >= 3150) return 9761;
  if (timeMs >= 2600) return 8301;
  if (timeMs >= 1050) return 2461;
  return 1001;
}
function tcpStateAt(timeMs) {
  const time = clampTcpTime(timeMs);
  const latest = tcpLatestEventAtOrBefore(time);
  const highestAck = tcpEventsAtOrBefore(time).filter((item) => item.direction === "server-to-client" && item.ack !== void 0).reduce((highest, item) => Math.max(highest, item.ack ?? 0), 0);
  return {
    timeMs: time,
    phase: latest.phase,
    connectionLabel: phaseLabel3(latest.phase),
    cwndMss: latest.cwndMss,
    ssthreshMss: latest.ssthreshMss,
    duplicateAcks: latest.duplicateAcks,
    highestAck,
    expectedAck: expectedClientAckAt(time),
    latestEventId: latest.id
  };
}

// ../8f1a24ac8c73/hopscotch/src/internet/asModel.ts
var DOCUMENTATION_ASNS = [
  ...Array.from({ length: 16 }, (_, index) => 64496 + index),
  ...Array.from({ length: 16 }, (_, index) => 65536 + index)
];
function isDocumentationAsn(asn) {
  return DOCUMENTATION_ASNS.includes(Number(asn));
}
function relationshipExportAllowed(learnedFrom, advertiseTo) {
  return learnedFrom === "local" || learnedFrom === "customer" || advertiseTo === "customer";
}
function documentationAsns() {
  return [...DOCUMENTATION_ASNS];
}
function roleFor(asn) {
  if (asn >= 64496 && asn <= 64499) return "access";
  if (asn >= 64500 && asn <= 64503) return "regional";
  if (asn >= 64504 && asn <= 64507) return "transit";
  if (asn >= 64508 && asn <= 64511) return "content";
  if (asn === 65538 || asn === 65539 || asn >= 65548) return "content";
  if (asn >= 65540 && asn <= 65543) return "transit";
  if (asn >= 65544 && asn <= 65547) return "regional";
  return "access";
}
function buildNodes() {
  return documentationAsns().map((asn, index) => {
    const side = index < 16 ? 0 : 1;
    const local = index % 16;
    const column = local % 4;
    const row2 = Math.floor(local / 4);
    const x = side === 0 ? 10 + column * 10.5 : 57 + column * 10.5;
    const y = 16 + row2 * 22;
    return { asn, label: `AS${asn}`, role: roleFor(asn), x, y };
  });
}
function cp(id2, customer, provider2) {
  return { id: id2, kind: "customer-provider", customer, provider: provider2 };
}
function peer(id2, a, b) {
  return { id: id2, kind: "peer", a, b };
}
function buildRelationships() {
  const relationships = [
    cp("src-p1", 64496, 64500),
    cp("src-p2", 64496, 64501),
    peer("p1-content", 64500, 65538),
    peer("p2-cross", 64501, 65540),
    cp("content-upstream", 65538, 65540),
    cp("a1-p1", 64497, 64500),
    cp("a1-p2", 64497, 64502),
    cp("a2-p1", 64498, 64501),
    cp("a2-p2", 64498, 64503),
    cp("a3-p1", 64499, 64502),
    cp("a3-p2", 64499, 64503),
    cp("reg0-t0", 64500, 64504),
    cp("reg0-t1", 64500, 64505),
    cp("reg1-t0", 64501, 64504),
    cp("reg1-t1", 64501, 64506),
    cp("reg2-t0", 64502, 64505),
    cp("reg2-t1", 64502, 64507),
    cp("reg3-t0", 64503, 64506),
    cp("reg3-t1", 64503, 64507),
    peer("ta-0-1", 64504, 64505),
    peer("ta-1-2", 64505, 64506),
    peer("ta-2-3", 64506, 64507),
    peer("ta-3-0", 64507, 64504),
    cp("ca0", 64508, 64504),
    cp("ca1", 64509, 64505),
    cp("ca2", 64510, 64506),
    cp("ca3", 64511, 64507),
    cp("baccess0", 65536, 65544),
    cp("baccess0b", 65536, 65545),
    cp("baccess1", 65537, 65544),
    cp("baccess1b", 65537, 65546),
    cp("breg0", 65544, 65540),
    cp("breg1", 65545, 65541),
    cp("breg2", 65546, 65542),
    cp("breg3", 65547, 65543),
    peer("tb-0-1", 65540, 65541),
    peer("tb-1-2", 65541, 65542),
    peer("tb-2-3", 65542, 65543),
    peer("tb-3-0", 65543, 65540),
    peer("cross-t0", 64504, 65540),
    peer("cross-t1", 64505, 65541),
    peer("cross-t2", 64506, 65542),
    peer("cross-t3", 64507, 65543),
    cp("cb1", 65539, 65541),
    cp("cb2", 65548, 65540),
    cp("cb3", 65549, 65541),
    cp("cb4", 65550, 65542),
    cp("cb5", 65551, 65543)
  ];
  return relationships;
}
var simulatedAsGraph = {
  nodes: buildNodes(),
  relationships: buildRelationships()
};
var DEFAULT_AS_SOURCE = 64496;
var DEFAULT_AS_DESTINATION = 65538;
function endpoints(relationship) {
  return relationship.kind === "peer" ? [relationship.a, relationship.b] : [relationship.customer, relationship.provider];
}
function traversalFor(relationship, from, to) {
  if (relationship.kind === "peer") {
    return relationship.a === from && relationship.b === to || relationship.b === from && relationship.a === to ? "peer" : null;
  }
  if (relationship.customer === from && relationship.provider === to) return "up";
  if (relationship.provider === from && relationship.customer === to) return "down";
  return null;
}
function validNextTraversal(phase, next) {
  if (phase === "start") return true;
  if (phase === "up") return next === "up" || next === "peer" || next === "down";
  if (phase === "peer") return next === "down";
  return next === "down";
}
function nextPhase(current, next) {
  if (next === "down") return "down";
  if (next === "peer") return "peer";
  return current === "start" ? "up" : current;
}
function firstHopPreference(hop) {
  if (!hop) return 400;
  if (hop.traversal === "down") return 300;
  if (hop.traversal === "peer") return 200;
  return 100;
}
function enumeratePolicyPaths(graph4, source, destination, failedRelationshipIds = /* @__PURE__ */ new Set(), maxHops = 7) {
  if (source === destination) return [{ asns: [source], relationshipIds: [], hops: [], localPreference: 400, scoreLabel: "LOCAL \xB7 0 AS HOPS" }];
  const adjacency2 = /* @__PURE__ */ new Map();
  graph4.nodes.forEach((node) => adjacency2.set(node.asn, []));
  graph4.relationships.forEach((relationship) => {
    if (failedRelationshipIds.has(relationship.id)) return;
    const [a, b] = endpoints(relationship);
    adjacency2.get(a)?.push(relationship);
    adjacency2.get(b)?.push(relationship);
  });
  adjacency2.forEach((items) => items.sort((a, b) => a.id.localeCompare(b.id)));
  const candidates = [];
  const visit = (current, asns, relationshipIds, hops, phase) => {
    if (relationshipIds.length > maxHops) return;
    if (current === destination) {
      const localPreference = firstHopPreference(hops[0]);
      candidates.push({ asns: [...asns], relationshipIds: [...relationshipIds], hops: [...hops], localPreference, scoreLabel: `LOCAL PREF ${localPreference} \xB7 ${relationshipIds.length} AS HOPS` });
      return;
    }
    if (relationshipIds.length === maxHops) return;
    for (const relationship of adjacency2.get(current) ?? []) {
      const [a, b] = endpoints(relationship);
      const next = a === current ? b : b === current ? a : null;
      if (next === null || asns.includes(next)) continue;
      const traversal = traversalFor(relationship, current, next);
      if (!traversal || !validNextTraversal(phase, traversal)) continue;
      visit(next, [...asns, next], [...relationshipIds, relationship.id], [...hops, { relationshipId: relationship.id, from: current, to: next, traversal }], nextPhase(phase, traversal));
    }
  };
  visit(source, [source], [], [], "start");
  return candidates.sort((left, right) => right.localPreference - left.localPreference || left.relationshipIds.length - right.relationshipIds.length || left.asns.join("-").localeCompare(right.asns.join("-"))).slice(0, 12);
}

// ../8f1a24ac8c73/hopscotch/src/packet/model.ts
var defaultPacketConfig = { family: "ipv4", transport: "tcp", payloadBytes: 96, ttl: 64, sourcePort: 51820, destinationPort: 443 };
var DEFAULT_SOURCE_MAC = [2, 72, 79, 80, 0, 1];
var DEFAULT_DEST_MAC = [2, 72, 79, 80, 0, 2];
var DEFAULT_SOURCE_IPV4 = [192, 0, 2, 10];
var DEFAULT_DEST_IPV4 = [198, 51, 100, 42];
var SOURCE_IPV6 = [32, 1, 13, 184, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16];
var DEST_IPV6 = [32, 1, 13, 184, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 66];
function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
function word16(value) {
  return [value >>> 8 & 255, value & 255];
}
function word32(value) {
  return [value >>> 24 & 255, value >>> 16 & 255, value >>> 8 & 255, value & 255];
}
function checksum16(bytes2) {
  let sum = 0;
  for (let index = 0; index < bytes2.length; index += 2) {
    sum += (bytes2[index] ?? 0) << 8 | (bytes2[index + 1] ?? 0);
    sum = (sum & 65535) + (sum >>> 16);
  }
  while (sum >>> 16) sum = (sum & 65535) + (sum >>> 16);
  return ~sum & 65535;
}
function payloadFor(length) {
  const seed = new TextEncoder().encode("HOPSCOTCH/RECOVERY/");
  return Array.from({ length }, (_, index) => seed[index % seed.length]);
}
function formatMac(bytes2) {
  return bytes2.map((byte) => byte.toString(16).padStart(2, "0")).join(":");
}
function formatIpv4(bytes2) {
  return bytes2.join(".");
}
function formatIpv6(bytes2) {
  const groups = [];
  for (let index = 0; index < 16; index += 2) groups.push(((bytes2[index] ?? 0) << 8 | (bytes2[index + 1] ?? 0)).toString(16));
  return groups.join(":");
}
function parseMac(value, fallback) {
  if (!value) return [...fallback];
  const parts = value.trim().split(":");
  if (parts.length !== 6 || parts.some((part) => !/^[0-9a-fA-F]{2}$/.test(part))) return [...fallback];
  return parts.map((part) => Number.parseInt(part, 16));
}
function parseIpv4(value, fallback) {
  if (!value) return [...fallback];
  const parts = value.trim().split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return [...fallback];
  return parts.map(Number);
}
function parseIpv6(value, fallback) {
  if (!value) return [...fallback];
  try {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized.includes("%") || normalized.includes(".") || (normalized.match(/::/g) ?? []).length > 1) return [...fallback];
    const compressed = normalized.includes("::");
    const [leftText, rightText = ""] = compressed ? normalized.split("::") : [normalized, ""];
    const side = (text2) => text2 === "" ? [] : text2.split(":").map((part) => {
      if (!/^[0-9a-f]{1,4}$/.test(part)) throw new Error("bad");
      return Number.parseInt(part, 16);
    });
    const left = side(leftText), right = side(rightText);
    const groups = compressed ? [...left, ...Array.from({ length: 8 - left.length - right.length }, () => 0), ...right] : left;
    if (groups.length !== 8 || compressed && 8 - left.length - right.length < 1) return [...fallback];
    return groups.flatMap((group) => [group >>> 8 & 255, group & 255]);
  } catch {
    return [...fallback];
  }
}
function hex16(value) {
  return `0x${value.toString(16).padStart(4, "0").toUpperCase()}`;
}
function protocolNumber(config) {
  if (config.transport === "tcp") return 6;
  if (config.transport === "udp") return 17;
  return config.family === "ipv4" ? 1 : 58;
}
function buildEthernet(config) {
  const sourceMac = parseMac(config.sourceMac, DEFAULT_SOURCE_MAC);
  const destinationMac = parseMac(config.destinationMac, DEFAULT_DEST_MAC);
  const etherType = config.family === "ipv4" ? 2048 : 34525;
  const bytes2 = [...destinationMac, ...sourceMac, ...word16(etherType)];
  return { bytes: bytes2, fields: [
    { id: "eth-dst", label: "Destination MAC", value: formatMac(destinationMac), offset: 0, length: 6 },
    { id: "eth-src", label: "Source MAC", value: formatMac(sourceMac), offset: 6, length: 6 },
    { id: "eth-type", label: "EtherType", value: config.family === "ipv4" ? "0x0800 \xB7 IPv4" : "0x86DD \xB7 IPv6", offset: 12, length: 2, derived: true }
  ] };
}
function buildIpv4(config, transportLength, source, destination) {
  const totalLength = 20 + transportLength + config.payloadBytes;
  const protocol = protocolNumber(config);
  const bytes2 = [69, 0, ...word16(totalLength), 74, 23, 64, 0, config.ttl, protocol, 0, 0, ...source, ...destination];
  const checksum = checksum16(bytes2);
  bytes2[10] = checksum >>> 8 & 255;
  bytes2[11] = checksum & 255;
  const protocolLabel = config.transport === "tcp" ? "6 \xB7 TCP" : config.transport === "udp" ? "17 \xB7 UDP" : "1 \xB7 ICMP";
  return { bytes: bytes2, checksum, fields: [
    { id: "ip-version", label: "Version / IHL", value: "IPv4 \xB7 20 byte header", offset: 0, length: 1 },
    { id: "ip-length", label: "Total Length", value: `${totalLength} bytes`, offset: 2, length: 2, derived: true, note: "IPv4 header + upper-layer/control message + payload" },
    { id: "ip-id", label: "Identification", value: "0x4A17", offset: 4, length: 2 },
    { id: "ip-flags", label: "Flags / Fragment", value: "DF \xB7 offset 0", offset: 6, length: 2 },
    { id: "ip-ttl", label: "TTL", value: String(config.ttl), offset: 8, length: 1 },
    { id: "ip-protocol", label: "Protocol", value: protocolLabel, offset: 9, length: 1, derived: true },
    { id: "ip-checksum", label: "Header Checksum", value: hex16(checksum), offset: 10, length: 2, derived: true, note: "One\u2019s-complement checksum of the IPv4 header only" },
    { id: "ip-src", label: "Source", value: formatIpv4(source), offset: 12, length: 4 },
    { id: "ip-dst", label: "Destination", value: formatIpv4(destination), offset: 16, length: 4 }
  ] };
}
function buildIpv6(config, transportLength, source, destination) {
  const payloadLength = transportLength + config.payloadBytes;
  const nextHeader = protocolNumber(config);
  const bytes2 = [96, 0, 0, 0, ...word16(payloadLength), nextHeader, config.ttl, ...source, ...destination];
  const nextLabel = config.transport === "tcp" ? "6 \xB7 TCP" : config.transport === "udp" ? "17 \xB7 UDP" : "58 \xB7 ICMPv6";
  return { bytes: bytes2, checksum: null, fields: [
    { id: "ip6-version", label: "Version / Flow", value: "IPv6 \xB7 flow label 0", offset: 0, length: 4 },
    { id: "ip6-length", label: "Payload Length", value: `${payloadLength} bytes`, offset: 4, length: 2, derived: true, note: "Upper-layer/control message + payload" },
    { id: "ip6-next", label: "Next Header", value: nextLabel, offset: 6, length: 1, derived: true },
    { id: "ip6-hop", label: "Hop Limit", value: String(config.ttl), offset: 7, length: 1 },
    { id: "ip6-src", label: "Source", value: formatIpv6(source), offset: 8, length: 16 },
    { id: "ip6-dst", label: "Destination", value: formatIpv6(destination), offset: 24, length: 16 },
    { id: "ip6-checksum", label: "Header Checksum", value: "None", offset: 0, length: 0, note: "IPv6 deliberately removed the network-header checksum." }
  ] };
}
function pseudoHeader(config, transportLength, sourceIpv4, destinationIpv4, sourceIpv6, destinationIpv6) {
  const protocol = protocolNumber(config);
  if (config.family === "ipv4") return [...sourceIpv4, ...destinationIpv4, 0, protocol, ...word16(transportLength + config.payloadBytes)];
  return [...sourceIpv6, ...destinationIpv6, ...word32(transportLength + config.payloadBytes), 0, 0, 0, protocol];
}
function buildTransport(config, payload, sourceIpv4, destinationIpv4, sourceIpv6, destinationIpv6) {
  if (config.transport === "icmp") {
    const type = clampInteger(config.icmpType ?? (config.family === "ipv4" ? 8 : 128), 0, 255);
    const code = clampInteger(config.icmpCode ?? 0, 0, 255);
    const identifier = clampInteger(config.icmpIdentifier ?? 18511, 0, 65535);
    const sequence = clampInteger(config.icmpSequence ?? 1, 0, 65535);
    const packetTooBig = config.family === "ipv6" && type === 2;
    const mtu = clampInteger(config.icmpMtu ?? 1280, 1280, 4294967295);
    const bytes3 = packetTooBig ? [type, code, 0, 0, ...word32(mtu)] : [type, code, 0, 0, ...word16(identifier), ...word16(sequence)];
    const checksumInput = config.family === "ipv4" ? [...bytes3, ...payload] : [...pseudoHeader(config, 8, sourceIpv4, destinationIpv4, sourceIpv6, destinationIpv6), ...bytes3, ...payload];
    const checksum2 = checksum16(checksumInput);
    bytes3[2] = checksum2 >>> 8 & 255;
    bytes3[3] = checksum2 & 255;
    return { bytes: bytes3, checksum: checksum2, fields: [
      { id: "icmp-type", label: "Type", value: config.family === "ipv4" && type === 8 ? "8 \xB7 Echo Request" : config.family === "ipv6" && type === 128 ? "128 \xB7 Echo Request" : packetTooBig ? "2 \xB7 Packet Too Big" : String(type), offset: 0, length: 1 },
      { id: "icmp-code", label: "Code", value: String(code), offset: 1, length: 1 },
      { id: "icmp-checksum", label: "Checksum", value: hex16(checksum2), offset: 2, length: 2, derived: true, note: config.family === "ipv4" ? "ICMP message + payload" : "ICMPv6 message + payload + IPv6 pseudo-header" },
      ...packetTooBig ? [{ id: "icmp-mtu", label: "MTU", value: `${mtu} bytes`, offset: 4, length: 4, derived: true, note: "IPv6 routers do not fragment transit packets; Packet Too Big carries the constraining next-hop MTU." }] : [{ id: "icmp-id", label: "Identifier", value: hex16(identifier), offset: 4, length: 2 }, { id: "icmp-seq", label: "Sequence", value: String(sequence), offset: 6, length: 2 }]
    ] };
  }
  const transportLength = config.transport === "tcp" ? 20 : 8;
  const bytes2 = config.transport === "tcp" ? [...word16(config.sourcePort), ...word16(config.destinationPort), ...word32(439041101), ...word32(1432778632), 80, 24, ...word16(64240), 0, 0, 0, 0] : [...word16(config.sourcePort), ...word16(config.destinationPort), ...word16(8 + config.payloadBytes), 0, 0];
  let checksum = checksum16([...pseudoHeader(config, transportLength, sourceIpv4, destinationIpv4, sourceIpv6, destinationIpv6), ...bytes2, ...payload]);
  if (config.transport === "udp" && checksum === 0) checksum = 65535;
  const checksumOffset = config.transport === "tcp" ? 16 : 6;
  bytes2[checksumOffset] = checksum >>> 8 & 255;
  bytes2[checksumOffset + 1] = checksum & 255;
  const commonFields = [
    { id: "trans-src", label: "Source Port", value: String(config.sourcePort), offset: 0, length: 2 },
    { id: "trans-dst", label: "Destination Port", value: `${config.destinationPort}${config.destinationPort === 443 ? " \xB7 HTTPS" : ""}`, offset: 2, length: 2 }
  ];
  const fields = config.transport === "tcp" ? [
    ...commonFields,
    { id: "tcp-seq", label: "Sequence", value: "0x1A2B3C4D", offset: 4, length: 4 },
    { id: "tcp-ack", label: "Acknowledgment", value: "0x55667788", offset: 8, length: 4 },
    { id: "tcp-flags", label: "Flags", value: "PSH, ACK", offset: 12, length: 2 },
    { id: "tcp-window", label: "Window", value: "64240", offset: 14, length: 2 },
    { id: "tcp-checksum", label: "Checksum", value: hex16(checksum), offset: 16, length: 2, derived: true, note: "TCP header + payload + IP pseudo-header" }
  ] : [
    ...commonFields,
    { id: "udp-length", label: "Length", value: `${8 + config.payloadBytes} bytes`, offset: 4, length: 2, derived: true },
    { id: "udp-checksum", label: "Checksum", value: hex16(checksum), offset: 6, length: 2, derived: true, note: "UDP header + payload + IP pseudo-header" }
  ];
  return { bytes: bytes2, checksum, fields };
}
function buildPacket(input2) {
  const config = {
    ...input2,
    family: input2.family,
    transport: input2.transport,
    payloadBytes: clampInteger(input2.payloadBytes, 16, 1400),
    ttl: clampInteger(input2.ttl, 1, 255),
    sourcePort: clampInteger(input2.sourcePort, 1, 65535),
    destinationPort: clampInteger(input2.destinationPort, 1, 65535)
  };
  const payload = payloadFor(config.payloadBytes);
  const transportHeaderLength = config.transport === "tcp" ? 20 : 8;
  const sourceIpv4 = parseIpv4(config.sourceIpv4, DEFAULT_SOURCE_IPV4);
  const destinationIpv4 = parseIpv4(config.destinationIpv4, DEFAULT_DEST_IPV4);
  const sourceIpv6 = parseIpv6(config.sourceIpv6, SOURCE_IPV6);
  const destinationIpv6 = parseIpv6(config.destinationIpv6, DEST_IPV6);
  const ethernet2 = buildEthernet(config);
  const network = config.family === "ipv4" ? buildIpv4(config, transportHeaderLength, sourceIpv4, destinationIpv4) : buildIpv6(config, transportHeaderLength, sourceIpv6, destinationIpv6);
  const transport = buildTransport(config, payload, sourceIpv4, destinationIpv4, sourceIpv6, destinationIpv6);
  const networkOffset = ethernet2.bytes.length;
  const transportOffset = networkOffset + network.bytes.length;
  const payloadOffset = transportOffset + transport.bytes.length;
  const transportLabel = config.transport === "icmp" ? config.family === "ipv4" ? "ICMP" : "ICMPv6" : config.transport.toUpperCase();
  const segments = [
    { id: "ethernet", label: "Ethernet II", offset: 0, length: ethernet2.bytes.length, bytes: ethernet2.bytes, fields: ethernet2.fields },
    { id: "network", label: config.family === "ipv4" ? "IPv4" : "IPv6", offset: networkOffset, length: network.bytes.length, bytes: network.bytes, fields: network.fields },
    { id: "transport", label: transportLabel, offset: transportOffset, length: transport.bytes.length, bytes: transport.bytes, fields: transport.fields },
    { id: "payload", label: "Payload", offset: payloadOffset, length: payload.length, bytes: payload, fields: [{ id: "payload-data", label: "Application Data", value: `${payload.length} bytes \xB7 deterministic HOPSCOTCH pattern`, offset: 0, length: payload.length, derived: true }] }
  ];
  return {
    config,
    bytes: [...ethernet2.bytes, ...network.bytes, ...transport.bytes, ...payload],
    segments,
    frameBytes: ethernet2.bytes.length + network.bytes.length + transport.bytes.length + payload.length,
    networkBytes: network.bytes.length + transport.bytes.length + payload.length,
    transportBytes: transport.bytes.length + payload.length,
    payloadBytes: payload.length,
    networkChecksum: network.checksum,
    transportChecksum: transport.checksum
  };
}

// ../8f1a24ac8c73/hopscotch/src/journey/modifiers.ts
var JOURNEY_MODIFIER_ORDER = ["dns-failure", "route-failure", "route-leak", "server-failure", "single-loss", "path-outage", "latency-spike", "congestion", "partition"];
var JOURNEY_MODIFIER_SET = new Set(JOURNEY_MODIFIER_ORDER);
function normalizeJourneyModifierIds(values) {
  const selected = /* @__PURE__ */ new Set();
  for (const value of values) {
    if (typeof value !== "string" || !JOURNEY_MODIFIER_SET.has(value)) {
      throw new Error(`Unknown Journey modifier: ${String(value)}.`);
    }
    selected.add(value);
  }
  if (selected.has("route-failure") && selected.has("path-outage")) {
    throw new Error("Journey modifiers route-failure and path-outage are mutually exclusive.");
  }
  return JOURNEY_MODIFIER_ORDER.filter((id2) => selected.has(id2));
}
function resolveJourneyModifierIds(config) {
  if (config.modifierIds !== void 0) return normalizeJourneyModifierIds(config.modifierIds);
  if (config.impairmentProfile === "clean") return [];
  if (config.impairmentProfile === "composed") throw new Error("Composed Journey config requires modifierIds.");
  return normalizeJourneyModifierIds([config.impairmentProfile]);
}
function impairmentProfileForModifiers(modifierIds) {
  const normalized = normalizeJourneyModifierIds(modifierIds);
  if (normalized.length === 0) return "clean";
  if (normalized.length === 1) return normalized[0];
  return "composed";
}
function modifierEvent(input2) {
  const { provenance = "SIMULATED", ...eventInput } = input2;
  return { ...eventInput, provenance };
}
function requireRouteAnchors(events2, modifierId) {
  const gateway = events2.find((current) => current.kind === "route.gateway");
  const asPath = events2.find((current) => current.id === "as-path");
  const transportStart = events2.find((current) => current.kind === "transport.segment");
  if (!gateway || !asPath || !transportStart) throw new Error(`${modifierId} requires gateway, AS-path, and transport-start events.`);
  if (!(gateway.atMs < asPath.atMs && asPath.atMs < transportStart.atMs)) throw new Error(`${modifierId} requires gateway < AS path < transport start.`);
  return { gateway, asPath, transportStart };
}
function requireResponseAnchors(events2, modifierId) {
  const data2 = events2.find((current) => current.kind === "http.data");
  const packetFrame = events2.find((current) => current.id === "packet-frame");
  if (!data2 || !packetFrame) throw new Error(`${modifierId} requires response data and packet-frame events.`);
  return { data: data2, packetFrame };
}
function shiftPostAnchor(events2, anchorMs, deltaMs) {
  return events2.map((current) => current.atMs >= anchorMs ? { ...current, atMs: current.atMs + deltaMs } : current);
}
function tcpLossEvents(dataAtMs) {
  return [
    modifierEvent({ id: "tcp-loss", atMs: dataAtMs + 160, kind: "transport.loss", scale: "packet", zoom: "in", protocol: "TCP", phase: "loss", title: "TCP data segment is lost", summary: "SEQ 2461\u20133920 disappears before the receiver.", detail: "Later TCP bytes can arrive, but cumulative delivery cannot advance beyond the missing receive-next byte.", actor: "network path", target: "TCP receiver", detailLab: "tcp" }),
    modifierEvent({ id: "tcp-gap", atMs: dataAtMs + 400, kind: "transport.loss-detected", scale: "transport", zoom: "out", protocol: "TCP", phase: "gap-detected", title: "Three duplicate ACK 2461 signals expose the gap", summary: "Repeated cumulative ACK 2461 tells the sender later bytes arrived beyond a missing range.", detail: "Three duplicate ACKs trigger the curated fast-retransmit path; the application remains blocked behind the TCP byte gap.", actor: "TCP receiver", target: "TCP sender", detailLab: "tcp" }),
    modifierEvent({ id: "tcp-retransmit", atMs: dataAtMs + 700, kind: "transport.retransmit", scale: "packet", zoom: "in", protocol: "TCP", phase: "retransmit", title: "Fast retransmit sends SEQ 2461\u20133920 again", summary: "The sender retransmits the missing TCP byte range without waiting for the normal retransmission timeout.", detail: "The repair is a new transmission of the missing byte range; transport sequence semantics remain TCP-specific.", actor: "TCP sender", target: "TCP receiver", detailLab: "tcp" }),
    modifierEvent({ id: "tcp-recovered", atMs: dataAtMs + 1050, kind: "transport.recovered", scale: "application", zoom: "out", protocol: "HTTP/2", phase: "loss-recovered", title: "HTTP/2 delivery resumes", summary: "The repaired gap lets the cumulative ACK advance from 2461 to 8301 and releases buffered response bytes.", detail: "HTTP/2 did not repair the loss itself; TCP restored the ordered byte stream underneath it.", actor: "TCP receiver", target: "HTTP/2", detailLab: "http" })
  ];
}
function quicLossEvents(dataAtMs) {
  return [
    modifierEvent({ id: "quic-loss", atMs: dataAtMs + 160, kind: "transport.loss", scale: "packet", zoom: "in", protocol: "QUIC", phase: "loss", title: "QUIC packet 4108 is lost", summary: "Packet 4108 carried STREAM offset 4096\u20135555 and disappears before the receiver.", detail: "The QUIC packet number is lost permanently; recovery retransmits the STREAM data in a different packet number.", actor: "network path", target: "QUIC receiver", detailLab: "http" }),
    modifierEvent({ id: "quic-gap", atMs: dataAtMs + 400, kind: "transport.loss-detected", scale: "transport", zoom: "out", protocol: "QUIC", phase: "gap-detected", title: "ACK ranges expose packet-number gap 4108", summary: "ACK ranges 4105\u20134107 and 4109\u20134112 show that packet 4108 is missing.", detail: "QUIC loss detection works from packet-number/ACK-range state, not TCP cumulative duplicate ACK semantics.", actor: "QUIC receiver", target: "QUIC sender", detailLab: "http" }),
    modifierEvent({ id: "quic-retransmit", atMs: dataAtMs + 700, kind: "transport.retransmit", scale: "packet", zoom: "in", protocol: "QUIC", phase: "retransmit", title: "STREAM range is retransmitted in packet 4113", summary: "STREAM offset 4096\u20135555 is sent again inside new QUIC packet number 4113.", detail: "QUIC never retransmits packet number 4108. The data is retransmitted, but the new packet has a new packet number.", actor: "QUIC sender", target: "QUIC receiver", detailLab: "http" }),
    modifierEvent({ id: "quic-recovered", atMs: dataAtMs + 1050, kind: "transport.recovered", scale: "application", zoom: "out", protocol: "HTTP/3", phase: "loss-recovered", title: "HTTP/3 request stream resumes", summary: "The repaired STREAM range closes the ordering gap on this HTTP/3 request stream.", detail: "The affected stream can advance after its missing range arrives; no TCP sequence or cumulative-ACK state exists in this branch.", actor: "QUIC receiver", target: "HTTP/3", detailLab: "http" })
  ];
}
var singleLossModifier = {
  id: "single-loss",
  order: 100,
  apply(events2, context) {
    const { data: data2, packetFrame } = requireResponseAnchors(events2, "single-loss");
    const addedDurationMs = 1600;
    const shifted = shiftPostAnchor(events2, packetFrame.atMs, addedDurationMs);
    const injected = context.config.transportProfile === "tcp-h2" ? tcpLossEvents(data2.atMs) : quicLossEvents(data2.atMs);
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ["single-loss"]
    };
  }
};
var BROKEN_ROUTE = { primaryPathCost: 22, alternatePathCost: 52, activePath: "none", failedLinkId: "r1-core" };
var ALTERNATE_ROUTE = { primaryPathCost: 22, alternatePathCost: 52, activePath: "alternate", failedLinkId: "r1-core" };
function routeFailureEvents(gatewayAtMs) {
  return [
    modifierEvent({ id: "route-primary-fails", atMs: gatewayAtMs + 160, kind: "route.failure", scale: "routing", zoom: "hold", protocol: "OSPF teaching model", phase: "route-failure", title: "Primary R1 \u2192 CORE link fails", summary: "The selected cost-22 route breaks after the gateway has already been chosen.", detail: "This failure occurs before TCP SYN or QUIC Initial. HOPSCOTCH isolates routing convergence here instead of inventing transport timeout behavior.", actor: "R1", target: "CORE", detailLab: "failure", routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: "route-primary-invalidated", atMs: gatewayAtMs + 440, kind: "route.invalidated", scale: "routing", zoom: "hold", protocol: "OSPF teaching model", phase: "route-invalidated", title: "Installed primary route is invalidated", summary: "Forwarding through the failed R1 \u2192 CORE edge is no longer viable.", detail: "The physical failure is immediate; a replacement path is not installed until the control plane recomputes the surviving graph.", actor: "edge router", target: "routing table", detailLab: "failure", routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: "route-spf-recompute", atMs: gatewayAtMs + 820, kind: "route.recompute", scale: "routing", zoom: "hold", protocol: "OSPF teaching model", phase: "route-recompute", title: "SPF evaluates the surviving graph", summary: "The cost-52 route through R2 becomes the lowest-cost viable path.", detail: "The primary route cost was 22. Once its failed edge is removed, EDGE \u2192 R2 \u2192 CORE is more expensive but reachable.", actor: "edge router", target: "SPF engine", detailLab: "failure", routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: "route-alternate-installed", atMs: gatewayAtMs + 1180, kind: "route.alternate-installed", scale: "routing", zoom: "hold", protocol: "OSPF teaching model", phase: "route-alternate-ready", title: "Alternate cost-52 route installed", summary: "Forwarding can continue through R2 before the transport handshake begins.", detail: "Recovery comes from routing around the failed link. The failed R1 \u2192 CORE edge remains down.", actor: "routing table", target: "R2 next hop", detailLab: "failure", routeMetrics: ALTERNATE_ROUTE })
  ];
}
var routeFailureModifier = {
  id: "route-failure",
  order: 90,
  apply(events2) {
    const { gateway, asPath, transportStart } = requireRouteAnchors(events2, "route-failure");
    const addedDurationMs = 1400;
    const shifted = shiftPostAnchor(events2, asPath.atMs, addedDurationMs);
    const injected = routeFailureEvents(gateway.atMs);
    const nextEvents = [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs);
    const firstTransport = nextEvents.find((current) => current.kind === "transport.segment");
    const alternate = nextEvents.find((current) => current.kind === "route.alternate-installed");
    if (!firstTransport || !alternate || alternate.atMs >= firstTransport.atMs) throw new Error("route-failure must converge before transport begins.");
    if (transportStart.atMs + addedDurationMs !== firstTransport.atMs) throw new Error("route-failure shifted transport by an unexpected amount.");
    return { events: nextEvents, addedDurationMs, appliedModifierIds: ["route-failure"] };
  }
};
function latestTransportRecovery(events2) {
  return events2.filter((current) => current.kind === "transport.recovered").sort((a, b) => b.atMs - a.atMs)[0];
}
function pathOutageRouteEvents(baseAtMs) {
  return [
    modifierEvent({ id: "path-outage-primary-fails", atMs: baseAtMs + 160, kind: "route.failure", scale: "routing", zoom: "out", protocol: "OSPF teaching model", phase: "path-outage", title: "The active path fails mid-transfer", summary: "R1 \u2192 CORE disappears while response bytes are already in flight.", detail: "Unlike the pre-transport ROUTE modifier, this failure crosses an established transport flow. In-flight delivery can be lost before the control plane installs the alternate path.", actor: "R1", target: "CORE", detailLab: "failure", routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: "path-outage-inflight-loss", atMs: baseAtMs + 200, kind: "transport.loss", scale: "packet", zoom: "in", protocol: "IP forwarding", phase: "outage-loss", title: "In-flight response data loses its forwarding path", summary: "One response flight disappears with the failed next hop.", detail: "Routing failure is the cause; transport loss is the consequence. HOPSCOTCH keeps those two causal layers separate in the event log.", actor: "failed network path", target: "transport receiver", detailLab: "packet", routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: "path-outage-route-invalidated", atMs: baseAtMs + 360, kind: "route.invalidated", scale: "routing", zoom: "out", protocol: "OSPF teaching model", phase: "outage-invalidated", title: "The installed primary route is invalidated", summary: "Forwarding through R1 \u2192 CORE is no longer viable.", detail: "Transport remains established, but the forwarding table currently has no usable path for the affected destination.", actor: "edge router", target: "routing table", detailLab: "failure", routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: "path-outage-spf-recompute", atMs: baseAtMs + 620, kind: "route.recompute", scale: "routing", zoom: "hold", protocol: "OSPF teaching model", phase: "outage-recompute", title: "SPF recomputes around the failed link", summary: "The surviving cost-52 path through R2 becomes the best reachable route.", detail: "The transport connection is not recreated. Routing is repairing reachability underneath the still-existing connection.", actor: "edge router", target: "SPF engine", detailLab: "failure", routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: "path-outage-alternate-installed", atMs: baseAtMs + 900, kind: "route.alternate-installed", scale: "routing", zoom: "hold", protocol: "OSPF teaching model", phase: "outage-route-ready", title: "Alternate path installed under the live connection", summary: "R2 \u2192 CORE restores forwarding at cost 52.", detail: "Routing convergence restores reachability, but it does not repair data already lost during the outage. The transport protocol still has to detect and recover that missing delivery.", actor: "routing table", target: "R2 next hop", detailLab: "failure", routeMetrics: ALTERNATE_ROUTE })
  ];
}
function tcpPathOutageEvents(baseAtMs) {
  return [
    modifierEvent({ id: "tcp-outage-rto", atMs: baseAtMs + 1160, kind: "transport.loss-detected", scale: "transport", zoom: "in", protocol: "TCP", phase: "outage-rto", title: "ACK silence reaches the TCP retransmission timeout", summary: "No cumulative ACK advances for the missing response bytes; the teaching RTO reaches its 1 s minimum.", detail: "This is not the duplicate-ACK fast-retransmit story used by the single-loss modifier. The path outage suppresses useful feedback long enough that the sender relies on its retransmission timer.", actor: "TCP retransmission timer", target: "TCP sender", detailLab: "tcp", transportMetrics: { baselineRttMs: 32, timerLabel: "RTO", timerMs: 1e3, lossDetected: true } }),
    modifierEvent({ id: "tcp-outage-retransmit", atMs: baseAtMs + 1380, kind: "transport.retransmit", scale: "packet", zoom: "in", protocol: "TCP", phase: "outage-retransmit", title: "TCP retransmits the missing byte range over R2", summary: "SEQ 2461\u20133920 is sent again after the alternate route exists.", detail: "The TCP sequence space does not change just because IP forwarding changed underneath it. The same missing byte range is retransmitted over the newly available route.", actor: "TCP sender", target: "TCP receiver", detailLab: "tcp", routeMetrics: ALTERNATE_ROUTE }),
    modifierEvent({ id: "tcp-outage-recovered", atMs: baseAtMs + 1740, kind: "transport.recovered", scale: "application", zoom: "out", protocol: "HTTP/2", phase: "outage-recovered", title: "HTTP/2 delivery resumes on the surviving route", summary: "The retransmitted TCP bytes close the gap and cumulative delivery advances again.", detail: "The HTTP/2 connection survives because TCP recovered after IP reachability returned; no new TCP or TLS handshake was required.", actor: "TCP receiver", target: "HTTP/2", detailLab: "http", routeMetrics: ALTERNATE_ROUTE })
  ];
}
function quicPathOutageEvents(baseAtMs) {
  return [
    modifierEvent({ id: "quic-outage-pto1", atMs: baseAtMs + 300, kind: "transport.loss-detected", scale: "transport", zoom: "in", protocol: "QUIC", phase: "outage-pto", title: "QUIC PTO fires before routing has recovered", summary: "ACK progress stops and QUIC reaches a probe timeout while the primary route is still unusable.", detail: "QUIC reacts earlier than the TCP 1 s teaching RTO, but a transport timer cannot repair missing IP reachability.", actor: "QUIC PTO timer", target: "QUIC sender", detailLab: "http", transportMetrics: { baselineRttMs: 32, smoothedRttMs: 32, rttVarMs: 8, ackDelayMs: 25, timerLabel: "PTO", timerMs: 89, lossDetected: true } }),
    modifierEvent({ id: "quic-outage-probe", atMs: baseAtMs + 470, kind: "transport.retransmit", scale: "packet", zoom: "in", protocol: "QUIC", phase: "outage-probe", title: "A QUIC probe cannot make forward progress", summary: "Probe traffic is generated, but the forwarding path is still broken.", detail: "This probe does not prove recovery. HOPSCOTCH keeps the route at NONE until SPF installs the alternate path.", actor: "QUIC sender", target: "failed network path", detailLab: "http", routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: "quic-outage-pto2", atMs: baseAtMs + 760, kind: "transport.loss-detected", scale: "transport", zoom: "out", protocol: "QUIC", phase: "outage-pto-backoff", title: "QUIC remains in PTO backoff during convergence", summary: "The connection still has no ACK progress while SPF is finishing the alternate route.", detail: "Probe timeout backoff is transport state; route recomputation is control-plane state. They advance independently until reachability returns.", actor: "QUIC loss detector", target: "QUIC sender", detailLab: "http", transportMetrics: { baselineRttMs: 32, smoothedRttMs: 32, rttVarMs: 8, ackDelayMs: 25, timerLabel: "PTO", timerMs: 178, lossDetected: true } }),
    modifierEvent({ id: "quic-outage-retransmit", atMs: baseAtMs + 1080, kind: "transport.retransmit", scale: "packet", zoom: "in", protocol: "QUIC", phase: "outage-retransmit", title: "Missing STREAM data is sent in new packet 4216", summary: "STREAM offset 4096\u20135555 is retransmitted after R2 becomes active.", detail: "QUIC does not reuse the lost packet number. The STREAM data moves in a new QUIC packet number over the restored IP path.", actor: "QUIC sender", target: "QUIC receiver", detailLab: "http", routeMetrics: ALTERNATE_ROUTE }),
    modifierEvent({ id: "quic-outage-recovered", atMs: baseAtMs + 1320, kind: "transport.recovered", scale: "application", zoom: "out", protocol: "HTTP/3", phase: "outage-recovered", title: "HTTP/3 stream resumes over the alternate path", summary: "The new QUIC packet closes the missing STREAM range and request-stream delivery advances.", detail: "The QUIC connection and TLS 1.3 state survive the routing outage; neither a TCP connection nor a new TLS handshake is introduced.", actor: "QUIC receiver", target: "HTTP/3", detailLab: "http", routeMetrics: ALTERNATE_ROUTE })
  ];
}
var pathOutageModifier = {
  id: "path-outage",
  order: 105,
  apply(events2, context) {
    const { data: data2, packetFrame } = requireResponseAnchors(events2, "path-outage");
    const priorRecovery = latestTransportRecovery(events2);
    const baseAtMs = priorRecovery?.atMs ?? data2.atMs;
    const addedDurationMs = 2200;
    const shifted = shiftPostAnchor(events2, packetFrame.atMs, addedDurationMs);
    const injected = [
      ...pathOutageRouteEvents(baseAtMs),
      ...context.config.transportProfile === "tcp-h2" ? tcpPathOutageEvents(baseAtMs) : quicPathOutageEvents(baseAtMs)
    ];
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ["path-outage"]
    };
  }
};
function round1(value) {
  return Math.round(value * 10) / 10;
}
function tcpEstimator(sampleRttMs, previousSmoothedRttMs = 32, previousRttVarMs = 8) {
  const rttVarMs = 3 / 4 * previousRttVarMs + 1 / 4 * Math.abs(previousSmoothedRttMs - sampleRttMs);
  const smoothedRttMs = 7 / 8 * previousSmoothedRttMs + 1 / 8 * sampleRttMs;
  const calculatedRtoMs = smoothedRttMs + Math.max(1, 4 * rttVarMs);
  return {
    baselineRttMs: 32,
    latestRttMs: sampleRttMs,
    smoothedRttMs: round1(smoothedRttMs),
    rttVarMs: round1(rttVarMs),
    timerLabel: "RTO",
    timerMs: Math.max(1e3, Math.ceil(calculatedRtoMs)),
    lossDetected: false
  };
}
function quicEstimator(sampleRttMs, previousSmoothedRttMs = 32, previousRttVarMs = 8) {
  const maxAckDelayMs = 25;
  const minRttMs = 32;
  const adjustedRttMs = sampleRttMs >= minRttMs + maxAckDelayMs ? sampleRttMs - maxAckDelayMs : sampleRttMs;
  const rttVarMs = 3 / 4 * previousRttVarMs + 1 / 4 * Math.abs(previousSmoothedRttMs - adjustedRttMs);
  const smoothedRttMs = 7 / 8 * previousSmoothedRttMs + 1 / 8 * adjustedRttMs;
  const ptoMs = smoothedRttMs + Math.max(4 * rttVarMs, 1) + maxAckDelayMs;
  return {
    baselineRttMs: 32,
    latestRttMs: sampleRttMs,
    adjustedRttMs: round1(adjustedRttMs),
    smoothedRttMs: round1(smoothedRttMs),
    rttVarMs: round1(rttVarMs),
    ackDelayMs: maxAckDelayMs,
    timerLabel: "PTO",
    timerMs: round1(ptoMs),
    lossDetected: false
  };
}
function latencyEvents(transportProfile, dataAtMs) {
  if (transportProfile === "tcp-h2") {
    const slow2 = tcpEstimator(220);
    const recovery2 = tcpEstimator(46, slow2.smoothedRttMs, slow2.rttVarMs);
    return [
      modifierEvent({ id: "tcp-latency-start", atMs: dataAtMs + 160, kind: "transport.latency", scale: "transport", zoom: "out", protocol: "TCP", phase: "latency-spike", title: "RTT spike stretches the TCP ACK clock", summary: "A simulated queueing delay raises the next RTT sample from 32 ms to 220 ms; no TCP segment is lost.", detail: "Feedback arrives later, so delivery pacing slows. There is no sequence gap, duplicate-ACK loss signal, or retransmission in this modifier.", actor: "network queue", target: "TCP sender", detailLab: "tcp", transportMetrics: { baselineRttMs: 32, latestRttMs: 220, lossDetected: false } }),
      modifierEvent({ id: "tcp-rtt-update", atMs: dataAtMs + 500, kind: "transport.rtt-update", scale: "transport", zoom: "hold", protocol: "TCP", phase: "rtt-estimator", title: "TCP RTT estimator absorbs the slow sample", summary: `SRTT rises to ${slow2.smoothedRttMs} ms and RTTVAR to ${slow2.rttVarMs} ms; the RFC 6298 teaching RTO remains at its 1 s minimum.`, detail: "The timer estimator expands because the observed round trip became slower and more variable. No loss-driven congestion response is inferred from RTT alone.", actor: "TCP RTT estimator", target: "retransmission timer", detailLab: "tcp", transportMetrics: slow2 }),
      modifierEvent({ id: "tcp-latency-clear", atMs: dataAtMs + 900, kind: "transport.latency-cleared", scale: "application", zoom: "out", protocol: "HTTP/2", phase: "latency-normalized", title: "Queue drains; HTTP/2 pacing normalizes", summary: `A later 46 ms RTT sample begins pulling the estimator back down; SRTT is now about ${recovery2.smoothedRttMs} ms.`, detail: "The response continues without fast retransmit or a packet-loss event. RTT estimators decay over subsequent samples rather than snapping instantly to baseline.", actor: "network queue", target: "HTTP/2", detailLab: "http", transportMetrics: recovery2 })
    ];
  }
  const slow = quicEstimator(220);
  const recovery = quicEstimator(46, slow.smoothedRttMs, slow.rttVarMs);
  return [
    modifierEvent({ id: "quic-latency-start", atMs: dataAtMs + 160, kind: "transport.latency", scale: "transport", zoom: "out", protocol: "QUIC", phase: "latency-spike", title: "A QUIC ACK arrives late", summary: "A simulated queueing delay raises latest_rtt from 32 ms to 220 ms; no QUIC packet-number gap exists.", detail: "The response waits longer for feedback, but latency alone is not modeled as packet loss or a retransmission trigger.", actor: "network queue", target: "QUIC sender", detailLab: "http", transportMetrics: { baselineRttMs: 32, latestRttMs: 220, ackDelayMs: 25, lossDetected: false } }),
    modifierEvent({ id: "quic-rtt-update", atMs: dataAtMs + 500, kind: "transport.rtt-update", scale: "transport", zoom: "hold", protocol: "QUIC", phase: "rtt-estimator", title: "QUIC RTT and PTO estimates expand", summary: `After ACK-delay adjustment, smoothed RTT is about ${slow.smoothedRttMs} ms, RTTVAR ${slow.rttVarMs} ms, and PTO about ${slow.timerMs} ms.`, detail: "QUIC updates RTT/PTO estimation from ACK timing. This event contains no packet-threshold/time-threshold loss declaration and no loss-driven congestion-window reduction.", actor: "QUIC RTT estimator", target: "PTO timer", detailLab: "http", transportMetrics: slow }),
    modifierEvent({ id: "quic-latency-clear", atMs: dataAtMs + 900, kind: "transport.latency-cleared", scale: "application", zoom: "out", protocol: "HTTP/3", phase: "latency-normalized", title: "Queue drains; HTTP/3 pacing normalizes", summary: `A later 46 ms sample begins reducing the estimator; smoothed RTT is now about ${recovery.smoothedRttMs} ms.`, detail: "No STREAM retransmission was needed. The connection simply observes faster feedback again while estimator history decays over later samples.", actor: "network queue", target: "HTTP/3", detailLab: "http", transportMetrics: recovery })
  ];
}
var latencySpikeModifier = {
  id: "latency-spike",
  order: 110,
  apply(events2, context) {
    const { data: data2, packetFrame } = requireResponseAnchors(events2, "latency-spike");
    const recovered = latestTransportRecovery(events2);
    const latencyBaseAtMs = recovered?.atMs ?? data2.atMs;
    const addedDurationMs = 1200;
    const shifted = shiftPostAnchor(events2, packetFrame.atMs, addedDurationMs);
    return {
      events: [...shifted, ...latencyEvents(context.config.transportProfile, latencyBaseAtMs)].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ["latency-spike"]
    };
  }
};
function latestTransportEpisodeEnd(events2) {
  return events2.filter((current) => current.kind === "transport.recovered" || current.kind === "transport.latency-cleared").sort((a, b) => b.atMs - a.atMs)[0];
}
function congestionMetrics(input2 = {}) {
  return {
    bottleneckRateMbps: 100,
    offeredRateMbps: 160,
    queueCapacityPackets: 32,
    queueOccupancyPackets: 8,
    queueDelayMs: 24,
    ecnCeMarks: 0,
    congestionWindowPackets: 12,
    slowStartThresholdPackets: 24,
    signal: "NONE",
    droppedPackets: 0,
    ...input2
  };
}
function tcpCongestionEvents(baseAtMs) {
  return [
    modifierEvent({ id: "tcp-congestion-queue-start", atMs: baseAtMs + 160, kind: "transport.queue-growth", scale: "transport", zoom: "out", protocol: "TCP", phase: "queue-growth", title: "A bottleneck queue starts to build", summary: "The sender offers about 160 Mb/s to a 100 Mb/s bottleneck, so packets begin waiting instead of disappearing.", detail: "Queueing raises delay before it creates a transport loss signal. TCP still has a contiguous sequence space and no retransmission is justified.", actor: "bottleneck queue", target: "TCP flow", detailLab: "tcp", transportMetrics: { baselineRttMs: 32, latestRttMs: 56, lossDetected: false }, congestionMetrics: congestionMetrics() }),
    modifierEvent({ id: "tcp-congestion-queue-high", atMs: baseAtMs + 420, kind: "transport.queue-growth", scale: "transport", zoom: "hold", protocol: "TCP", phase: "queue-high", title: "Queueing delay grows before any drop", summary: "The queue reaches 24 of 32 packets and contributes roughly 96 ms of delay.", detail: "This is a congestion precursor, not packet loss. The receiver can still acknowledge a complete TCP byte stream.", actor: "bottleneck queue", target: "TCP ACK clock", detailLab: "tcp", transportMetrics: { baselineRttMs: 32, latestRttMs: 128, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 24, queueDelayMs: 96 }) }),
    modifierEvent({ id: "tcp-congestion-ecn", atMs: baseAtMs + 680, kind: "transport.ecn-mark", scale: "packet", zoom: "in", protocol: "IP ECN", phase: "ecn-ce", title: "ECN marks congestion without dropping the packet", summary: "Three packets arrive with the IP CE codepoint while the queue approaches capacity.", detail: "The curated bottleneck is ECN-capable: CE is an explicit congestion signal carried on delivered packets, not a missing TCP sequence range.", actor: "ECN-capable bottleneck", target: "TCP receiver", detailLab: "packet", transportMetrics: { baselineRttMs: 32, latestRttMs: 136, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 26, queueDelayMs: 104, ecnCeMarks: 3, signal: "CE" }) }),
    modifierEvent({ id: "tcp-congestion-response", atMs: baseAtMs + 900, kind: "transport.congestion-response", scale: "transport", zoom: "out", protocol: "TCP ECN", phase: "ecn-response", title: "TCP ECE feedback cuts the congestion window", summary: "ECE feedback causes the teaching cwnd to fall from 12 to 6 packets; the sender answers with CWR.", detail: "There is no TCP sequence gap and no retransmission. Congestion control reduces sending pressure because ECN reported congestion before a drop was needed.", actor: "TCP sender", target: "bottleneck queue", detailLab: "tcp", transportMetrics: { baselineRttMs: 32, latestRttMs: 104, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 20, queueDelayMs: 72, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: 6, signal: "ECE/CWR" }) }),
    modifierEvent({ id: "tcp-congestion-cleared", atMs: baseAtMs + 1320, kind: "transport.congestion-cleared", scale: "application", zoom: "out", protocol: "HTTP/2", phase: "queue-drained", title: "The queue drains after TCP backs off", summary: "With offered load below the bottleneck rate, occupancy falls to four packets and response pacing steadies.", detail: "HTTP/2 continues on the same TCP/TLS connection. No packet was dropped and no repair transmission was required in this ECN episode.", actor: "bottleneck queue", target: "HTTP/2", detailLab: "http", transportMetrics: { baselineRttMs: 32, latestRttMs: 44, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 4, queueDelayMs: 12, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: 6, signal: "NONE" }) })
  ];
}
function quicCongestionEvents(baseAtMs) {
  return [
    modifierEvent({ id: "quic-congestion-queue-start", atMs: baseAtMs + 160, kind: "transport.queue-growth", scale: "transport", zoom: "out", protocol: "QUIC", phase: "queue-growth", title: "A bottleneck queue starts to build", summary: "The QUIC sender offers about 160 Mb/s to a 100 Mb/s bottleneck, so packets spend longer waiting in the queue.", detail: "Queueing changes ACK timing first. There is no packet-number gap, PTO recovery, or STREAM retransmission in this congestion-only episode.", actor: "bottleneck queue", target: "QUIC flow", detailLab: "http", transportMetrics: { baselineRttMs: 32, latestRttMs: 56, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ slowStartThresholdPackets: void 0 }) }),
    modifierEvent({ id: "quic-congestion-queue-high", atMs: baseAtMs + 420, kind: "transport.queue-growth", scale: "transport", zoom: "hold", protocol: "QUIC", phase: "queue-high", title: "Queueing delay grows before any drop", summary: "The queue reaches 24 of 32 packets and latest_rtt rises as feedback spends longer in the path.", detail: "The QUIC packet-number space remains contiguous from the receiver perspective. Higher RTT by itself is not a QUIC loss declaration.", actor: "bottleneck queue", target: "QUIC ACK timing", detailLab: "http", transportMetrics: { baselineRttMs: 32, latestRttMs: 128, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 24, queueDelayMs: 96, slowStartThresholdPackets: void 0 }) }),
    modifierEvent({ id: "quic-congestion-ecn", atMs: baseAtMs + 680, kind: "transport.ecn-mark", scale: "packet", zoom: "in", protocol: "IP ECN", phase: "ecn-ce", title: "ECN marks QUIC packets instead of dropping them", summary: "The receiver observes three additional CE-marked packets while all packet numbers still arrive.", detail: "The packet remains delivered. ACK_ECN can report increasing CE counters without inventing a packet-number gap or STREAM loss.", actor: "ECN-capable bottleneck", target: "QUIC receiver", detailLab: "packet", transportMetrics: { baselineRttMs: 32, latestRttMs: 136, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 26, queueDelayMs: 104, ecnCeMarks: 3, signal: "CE", slowStartThresholdPackets: void 0 }) }),
    modifierEvent({ id: "quic-congestion-response", atMs: baseAtMs + 900, kind: "transport.congestion-response", scale: "transport", zoom: "out", protocol: "QUIC ACK_ECN", phase: "ecn-response", title: "ACK_ECN feedback reduces the QUIC congestion window", summary: "Validated CE-counter growth causes the teaching congestion window to fall from 12 to 6 packets.", detail: "There is no QUIC packet-number gap, retransmission, or PTO recovery here. The sender reduces in-flight pressure because ACK_ECN explicitly reported congestion.", actor: "QUIC sender", target: "bottleneck queue", detailLab: "http", transportMetrics: { baselineRttMs: 32, latestRttMs: 104, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 20, queueDelayMs: 72, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: void 0, signal: "ACK_ECN" }) }),
    modifierEvent({ id: "quic-congestion-cleared", atMs: baseAtMs + 1320, kind: "transport.congestion-cleared", scale: "application", zoom: "out", protocol: "HTTP/3", phase: "queue-drained", title: "The queue drains after QUIC backs off", summary: "Offered load falls below the bottleneck rate, occupancy returns to four packets, and request-stream pacing steadies.", detail: "HTTP/3 continues on the same QUIC/TLS state. No packet or STREAM data was lost, so there is nothing to retransmit.", actor: "bottleneck queue", target: "HTTP/3", detailLab: "http", transportMetrics: { baselineRttMs: 32, latestRttMs: 44, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 4, queueDelayMs: 12, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: void 0, signal: "NONE" }) })
  ];
}
var congestionModifier = {
  id: "congestion",
  order: 120,
  apply(events2, context) {
    const { data: data2, packetFrame } = requireResponseAnchors(events2, "congestion");
    const priorEpisode = latestTransportEpisodeEnd(events2);
    const baseAtMs = priorEpisode?.atMs ?? data2.atMs;
    const addedDurationMs = 1700;
    const shifted = shiftPostAnchor(events2, packetFrame.atMs, addedDurationMs);
    const injected = context.config.transportProfile === "tcp-h2" ? tcpCongestionEvents(baseAtMs) : quicCongestionEvents(baseAtMs);
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ["congestion"]
    };
  }
};
function dnsFailureMissEvents(recursiveAtMs) {
  return [
    modifierEvent({
      id: "dns-primary-timeout",
      atMs: recursiveAtMs + 600,
      kind: "dns.timeout",
      scale: "application",
      zoom: "hold",
      protocol: "DNS",
      phase: "resolver-timeout",
      title: "Primary recursive resolver does not answer",
      summary: "The first recursive A-query attempt produces no DNS response before the teaching timeout.",
      detail: "A timeout is the absence of a response. HOPSCOTCH does not turn silence into NXDOMAIN or SERVFAIL, because neither response was received.",
      actor: "primary recursive resolver",
      target: "stub resolver",
      detailLab: "dns"
    }),
    modifierEvent({
      id: "dns-secondary-retry",
      atMs: recursiveAtMs + 900,
      kind: "dns.retry",
      scale: "application",
      zoom: "hold",
      protocol: "DNS",
      phase: "resolver-retry",
      title: "Stub retries through a secondary recursive resolver",
      summary: "The same logical A question is sent through the configured secondary recursive path after the primary attempt times out.",
      detail: "This curated retry uses a new transaction context and a secondary recursive resolver. It is not a replayed DNS answer and does not imply that every operating system uses identical fallback timing.",
      actor: "stub resolver",
      target: "secondary recursive resolver",
      detailLab: "dns"
    })
  ];
}
function dnsFailureMaskedEvent(cacheHitAtMs) {
  return modifierEvent({
    id: "dns-outage-masked",
    atMs: cacheHitAtMs + 180,
    kind: "dns.failure-masked",
    scale: "application",
    zoom: "hold",
    protocol: "DNS",
    phase: "outage-masked",
    title: "Cache hit masks the upstream DNS outage",
    summary: "The local cached answer is already usable, so the unavailable upstream resolver path is never consulted.",
    detail: "No upstream query is required, so HOPSCOTCH does not fabricate a timeout packet, DNS retry, or resolver delay. The cached TTL continues to age normally.",
    actor: "local DNS cache",
    target: "application",
    detailLab: "dns"
  });
}
var dnsFailureModifier = {
  id: "dns-failure",
  order: 70,
  apply(events2, context) {
    if (context.config.dnsProfile === "cache-hit") {
      const cacheHit = events2.find((current) => current.kind === "dns.cache-hit");
      const routeLookup = events2.find((current) => current.kind === "route.lookup");
      if (!cacheHit || !routeLookup || cacheHit.atMs >= routeLookup.atMs) throw new Error("dns-failure cache-hit path requires cache hit before route lookup.");
      const masked = dnsFailureMaskedEvent(cacheHit.atMs);
      if (masked.atMs >= routeLookup.atMs) throw new Error("dns-failure masked event must remain before route lookup.");
      return {
        events: [...events2, masked].sort((a, b) => a.atMs - b.atMs),
        addedDurationMs: 0,
        appliedModifierIds: ["dns-failure"]
      };
    }
    const recursive = events2.find((current) => current.id === "dns-recursive");
    const root = events2.find((current) => current.id === "dns-root");
    if (!recursive || !root || recursive.atMs >= root.atMs) throw new Error("dns-failure cache-miss path requires recursive query before root referral.");
    const addedDurationMs = 1200;
    const shifted = shiftPostAnchor(events2, root.atMs, addedDurationMs);
    const injected = dnsFailureMissEvents(recursive.atMs);
    if (!(recursive.atMs < injected[0].atMs && injected[0].atMs < injected[1].atMs && injected[1].atMs < root.atMs + addedDurationMs)) {
      throw new Error("dns-failure must order query < timeout < retry < root referral.");
    }
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ["dns-failure"]
    };
  }
};
function serverMetrics(input2 = {}) {
  return {
    statusCode: 503,
    retryAfterMs: 1e3,
    requestMethod: "GET",
    idempotent: true,
    retrySafe: true,
    transportReused: true,
    ...input2
  };
}
function serverFailureEvents(requestAtMs, frameReadyAtMs, transportProfile) {
  const protocol = transportProfile === "quic-h3" ? "HTTP/3" : "HTTP/2";
  const detailLab = "http";
  const responseBaseMs = Math.max(requestAtMs, frameReadyAtMs);
  return [
    modifierEvent({
      id: "server-service-unavailable",
      atMs: responseBaseMs + 180,
      kind: "server.unavailable",
      scale: "application",
      zoom: "hold",
      protocol,
      phase: "service-unavailable",
      title: "The application service becomes temporarily unavailable",
      summary: "The request reached a healthy network endpoint, but the application service cannot produce the successful representation yet.",
      detail: "DNS, IP routing, the established transport connection, and TLS keys remain valid. This failure lives at the HTTP/application boundary.",
      actor: "application service",
      target: "HTTP request",
      detailLab,
      serverMetrics: serverMetrics()
    }),
    modifierEvent({
      id: "server-http-503",
      atMs: responseBaseMs + 340,
      kind: "http.service-unavailable",
      scale: "application",
      zoom: "hold",
      protocol,
      phase: "http-503",
      title: "HTTP 503 Service Unavailable returns",
      summary: "The reachable server returns a real HTTP 503 response with Retry-After: 1.",
      detail: "Unlike DNS timeout silence, this is an application-layer response. The server is reachable enough to return status and retry guidance on the existing connection.",
      actor: "HTTP server",
      target: "browser",
      detailLab,
      serverMetrics: serverMetrics()
    }),
    modifierEvent({
      id: "server-retry-wait",
      atMs: responseBaseMs + 520,
      kind: "http.retry-wait",
      scale: "application",
      zoom: "hold",
      protocol,
      phase: "retry-wait",
      title: "Client honors Retry-After before replaying the GET",
      summary: "The teaching client waits one second instead of hammering the unavailable service.",
      detail: "The connection remains established during the wait. Retry safety comes from this canonical GET being idempotent; arbitrary requests must not be assumed safe to replay.",
      actor: "browser",
      target: "HTTP server",
      detailLab,
      serverMetrics: serverMetrics()
    }),
    modifierEvent({
      id: "server-service-ready",
      atMs: responseBaseMs + 1240,
      kind: "server.recovered",
      scale: "application",
      zoom: "hold",
      protocol,
      phase: "service-ready",
      title: "The application service becomes ready again",
      summary: "Server-side availability recovers while the original client transport and TLS session remain usable.",
      detail: "No DNS lookup, route change, TCP/QUIC handshake, or TLS handshake is needed to represent this service recovery.",
      actor: "application service",
      target: "HTTP endpoint",
      detailLab,
      serverMetrics: serverMetrics({ statusCode: void 0 })
    }),
    modifierEvent({
      id: "server-get-retry",
      atMs: responseBaseMs + 1340,
      kind: "http.retry",
      scale: "application",
      zoom: "hold",
      protocol,
      phase: "safe-get-retry",
      title: "The idempotent GET is retried on the same connection",
      summary: "Exactly one second after the 503, the canonical GET / is replayed using the already-established transport and TLS state.",
      detail: "This teaching retry is safe because GET is idempotent. HOPSCOTCH does not imply arbitrary requests, especially non-idempotent writes, can always be retried automatically.",
      actor: "browser",
      target: "HTTP server",
      detailLab,
      serverMetrics: serverMetrics({ statusCode: void 0 })
    })
  ];
}
function routeLeakTraversal(asns) {
  const traversals = [];
  for (let index = 0; index < asns.length - 1; index += 1) {
    const from = asns[index];
    const to = asns[index + 1];
    const relationship = simulatedAsGraph.relationships.find((candidate) => traversalFor(candidate, from, to) !== null);
    if (!relationship) throw new Error(`route-leak teaching path is missing AS${from} \u2192 AS${to} from the AS Routing graph.`);
    const traversal = traversalFor(relationship, from, to);
    if (!traversal) throw new Error(`route-leak cannot derive traversal AS${from} \u2192 AS${to}.`);
    traversals.push(traversal);
  }
  return traversals;
}
function routeLeakMetricStates() {
  const legitimatePathAsns = [64504, 65540, 65538];
  const leakedPathAsns = [64504, 64500, 65538];
  const legitimate = enumeratePolicyPaths(simulatedAsGraph, 64504, 65538).find((candidate) => candidate.asns.join(",") === legitimatePathAsns.join(","));
  if (!legitimate) throw new Error("route-leak requires the existing policy-compliant AS64504 \u2192 AS65540 \u2192 AS65538 candidate.");
  const legitimateTraversal = routeLeakTraversal(legitimatePathAsns);
  const leakedTraversal = routeLeakTraversal(leakedPathAsns);
  if (legitimateTraversal.join(",") !== "peer,down") throw new Error("route-leak legitimate path no longer matches the AS Routing peer \u2192 down teaching policy.");
  if (leakedTraversal.join(",") !== "down,peer") throw new Error("route-leak leaked path must expose the down \u2192 peer valley violation.");
  if (enumeratePolicyPaths(simulatedAsGraph, 64504, 65538).some((candidate) => candidate.asns.join(",") === leakedPathAsns.join(","))) {
    throw new Error("route-leak leaked path unexpectedly passed the normal valley-free enumerator.");
  }
  const common = {
    legitimatePathAsns,
    leakedPathAsns,
    legitimateTraversal,
    leakedTraversal,
    legitimateLocalPreference: legitimate.localPreference,
    leakedLocalPreference: 300,
    leakSourceAsn: 64500,
    decisionAsn: 64504,
    destinationAsn: 65538,
    learnedFrom: "peer",
    exportedTo: "provider",
    reachable: true
  };
  const normal = {
    ...common,
    activePathAsns: legitimatePathAsns,
    activeLocalPreference: legitimate.localPreference,
    selectedPathPolicyCompliant: true,
    exportPolicyCompliant: true
  };
  const advertised = {
    ...normal,
    exportPolicyCompliant: false
  };
  const leaked = {
    ...common,
    activePathAsns: leakedPathAsns,
    activeLocalPreference: 300,
    selectedPathPolicyCompliant: false,
    exportPolicyCompliant: false
  };
  return { normal, advertised, leaked, restored: normal };
}
function routeLeakEvents(asPathAtMs) {
  const metrics2 = routeLeakMetricStates();
  return [
    modifierEvent({
      id: "route-leak-advertised",
      atMs: asPathAtMs + 180,
      kind: "internet.route-leak-advertised",
      scale: "internet",
      zoom: "hold",
      protocol: "BGP policy model",
      phase: "route-leak-advertised",
      title: "AS64500 leaks a peer-learned route to its provider",
      summary: "A route learned from peer AS65538 is incorrectly exported upward to provider AS64504.",
      detail: "The export itself violates the curated valley-free teaching policy. Forwarding has not failed: the legitimate AS64504 \u2192 AS65540 \u2192 AS65538 path is still selected at this instant.",
      actor: "AS64500",
      target: "AS64504",
      detailLab: "internet",
      policyMetrics: metrics2.advertised
    }),
    modifierEvent({
      id: "route-leak-selected",
      atMs: asPathAtMs + 460,
      kind: "internet.route-leak-selected",
      scale: "internet",
      zoom: "hold",
      protocol: "BGP policy model",
      phase: "route-leak-selected",
      title: "AS64504 selects the leaked customer advertisement",
      summary: "The deterministic teaching LOCAL_PREF changes from peer-learned 200 to customer-learned 300.",
      detail: "AS64504 now forwards through AS64500 \u2192 AS65538. This is a curated policy demonstration, not a claim that every network implements identical BGP preference rules.",
      actor: "AS64504 decision process",
      target: "AS64500",
      detailLab: "internet",
      policyMetrics: metrics2.leaked
    }),
    modifierEvent({
      id: "route-leak-anomaly",
      atMs: asPathAtMs + 760,
      kind: "internet.policy-anomaly",
      scale: "internet",
      zoom: "hold",
      protocol: "BGP policy model",
      phase: "policy-anomaly",
      title: "Reachable path violates the valley-free export policy",
      summary: "The selected path is AS64504 \u2192 AS64500 \u2192 AS65538: physically connected, but its down \u2192 peer relationship sequence is policy-invalid.",
      detail: "This is the core lesson: reachability and policy correctness are separate dimensions. HOPSCOTCH keeps REACHABLE = YES while POLICY COMPLIANT = NO.",
      actor: "policy monitor",
      target: "selected AS path",
      detailLab: "internet",
      policyMetrics: metrics2.leaked
    }),
    modifierEvent({
      id: "route-leak-withdrawn",
      atMs: asPathAtMs + 1080,
      kind: "internet.route-leak-withdrawn",
      scale: "internet",
      zoom: "hold",
      protocol: "BGP policy model",
      phase: "route-leak-withdrawn",
      title: "The leaked advertisement is filtered and withdrawn",
      summary: "AS64504 stops accepting the bad customer advertisement after the policy anomaly is contained.",
      detail: "Containment removes the policy-invalid route; it does not require a local OSPF failure, packet retransmission, or transport reset.",
      actor: "AS64504 policy filter",
      target: "AS64500 advertisement",
      detailLab: "internet",
      policyMetrics: metrics2.leaked
    }),
    modifierEvent({
      id: "route-leak-restored",
      atMs: asPathAtMs + 1320,
      kind: "internet.policy-restored",
      scale: "internet",
      zoom: "hold",
      protocol: "BGP policy model",
      phase: "policy-restored",
      title: "Policy-compliant peer path is selected again",
      summary: "AS64504 returns to AS64504 \u2192 AS65540 \u2192 AS65538 with teaching LOCAL_PREF 200.",
      detail: "Reachability existed throughout the episode. What changed was which advertisement was considered policy-acceptable and therefore selected.",
      actor: "AS64504 decision process",
      target: "AS65540 peer route",
      detailLab: "internet",
      policyMetrics: metrics2.restored
    })
  ];
}
var routeLeakModifier = {
  id: "route-leak",
  order: 92,
  apply(events2) {
    const { asPath, transportStart } = requireRouteAnchors(events2, "route-leak");
    const physical = events2.find((current) => current.id === "physical-context");
    if (!physical || asPath.atMs >= physical.atMs || physical.atMs >= transportStart.atMs) {
      throw new Error("route-leak requires AS path < physical context < transport start.");
    }
    const addedDurationMs = 1600;
    const shifted = shiftPostAnchor(events2, physical.atMs, addedDurationMs);
    const injected = routeLeakEvents(asPath.atMs);
    const nextEvents = [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs);
    const restored = nextEvents.find((current) => current.kind === "internet.policy-restored");
    const firstTransport = nextEvents.find((current) => current.kind === "transport.segment");
    if (!restored || !firstTransport || restored.atMs >= firstTransport.atMs) throw new Error("route-leak must restore policy before transport begins.");
    if (firstTransport.atMs !== transportStart.atMs + addedDurationMs) throw new Error("route-leak shifted transport by an unexpected amount.");
    return { events: nextEvents, addedDurationMs, appliedModifierIds: ["route-leak"] };
  }
};
var serverFailureModifier = {
  id: "server-failure",
  order: 95,
  apply(events2, context) {
    const request = events2.find((current) => current.kind === "http.request");
    const frameReady = events2.find((current) => current.id === "packet-assembly-collapsed");
    const response = events2.find((current) => current.kind === "http.response");
    if (!request || !frameReady || !response || request.atMs >= frameReady.atMs || frameReady.atMs >= response.atMs) throw new Error("server-failure requires an assembled HTTP request before the successful response.");
    const addedDurationMs = 1700;
    const shifted = shiftPostAnchor(events2, response.atMs, addedDurationMs);
    const injected = serverFailureEvents(request.atMs, frameReady.atMs, context.config.transportProfile);
    const retry = injected.find((current) => current.kind === "http.retry");
    if (!retry || retry.atMs >= response.atMs + addedDurationMs) throw new Error("server-failure retry must finish before successful response headers.");
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ["server-failure"]
    };
  }
};
function latestPartitionTrigger(events2) {
  const preferredKinds = /* @__PURE__ */ new Set([
    "http.data",
    "transport.recovered",
    "transport.latency-cleared",
    "transport.congestion-cleared"
  ]);
  const candidates = events2.filter((current) => preferredKinds.has(current.kind)).sort((a, b) => b.atMs - a.atMs);
  if (!candidates[0]) throw new Error("partition requires response-path activity before terminalizing the Journey.");
  return candidates[0];
}
function partitionRouteMetrics() {
  return {
    primaryPathCost: 22,
    alternatePathCost: 52,
    activePath: "none",
    failedLinkId: "r1-core",
    failedLinkIds: ["r1-core", "r2-core"],
    candidateRouteCount: 0,
    recoveryAvailable: false
  };
}
function partitionEvents(triggerAtMs, terminalAtMs, transportProfile) {
  const metrics2 = partitionRouteMetrics();
  const transportProtocol = transportProfile === "quic-h3" ? "QUIC" : "TCP";
  const stalledDetail = transportProfile === "quic-h3" ? "The QUIC connection had valid 1-RTT state before the cut. With no IP route, probes cannot create reachability; stalled does not mean the connection is already closed." : "The TCP connection was established before the cut. With no IP route, bytes cannot make progress; stalled does not mean the connection is already closed.";
  const injected = [
    modifierEvent({
      id: "partition-cut",
      atMs: triggerAtMs + 220,
      kind: "route.partition",
      scale: "routing",
      zoom: "out",
      protocol: "IP",
      phase: "partition-cut",
      title: "Both routed exits disappear across the partition",
      summary: "R1 \u2192 CORE and R2 \u2192 CORE are both unavailable, so the installed forwarding path is no longer usable.",
      detail: "This is not the recoverable ROUTE or OUTAGE story. The teaching topology has lost both of its destination-facing exits at once.",
      actor: "network partition",
      target: "R1 / R2 uplinks",
      detailLab: "failure",
      routeMetrics: metrics2
    }),
    modifierEvent({
      id: "partition-recompute",
      atMs: triggerAtMs + 520,
      kind: "route.partition-recompute",
      scale: "routing",
      zoom: "hold",
      protocol: "OSPF-style SPF",
      phase: "partition-recompute",
      title: "SPF runs with zero surviving candidates",
      summary: "The route calculation sees no primary or alternate path capable of reaching the destination.",
      detail: "Recomputation is still meaningful even when it cannot produce a route. Candidate route count is explicitly zero.",
      actor: "routing process",
      target: "forwarding table",
      detailLab: "failure",
      routeMetrics: metrics2
    }),
    modifierEvent({
      id: "partition-unreachable",
      atMs: triggerAtMs + 820,
      kind: "route.unreachable",
      scale: "routing",
      zoom: "hold",
      protocol: "IP",
      phase: "unreachable",
      title: "Destination is unreachable: no route is installed",
      summary: "Active path becomes NONE and forwarding cannot choose a next hop toward the destination.",
      detail: "The terminal truth is routing reachability. HOPSCOTCH does not invent a third path or silently restore one of the failed links.",
      actor: "forwarding table",
      target: "destination prefix",
      detailLab: "failure",
      routeMetrics: metrics2
    }),
    modifierEvent({
      id: "partition-transport-stalled",
      atMs: triggerAtMs + 1080,
      kind: "transport.stalled",
      scale: "transport",
      zoom: "in",
      protocol: transportProtocol,
      phase: "transport-stalled",
      title: `${transportProtocol} state remains, but IP progress stops`,
      summary: "The existing transport state is stalled because there is no forwarding path on which packets can travel.",
      detail: stalledDetail,
      actor: `${transportProtocol} sender`,
      target: "unreachable IP path",
      detailLab: transportProfile === "quic-h3" ? "http" : "tcp",
      routeMetrics: metrics2
    }),
    modifierEvent({
      id: "partition-terminal",
      atMs: terminalAtMs,
      kind: "journey.failed",
      scale: "application",
      zoom: "out",
      protocol: "URL",
      phase: "network-unreachable",
      title: "Journey ends without a route to the destination",
      summary: "The request cannot reach response-ready because the simulated network remains partitioned.",
      detail: "No route exists and no recovery event follows. Earlier DNS, TLS, HTTP, and transport history remains inspectable when the time machine is rewound.",
      actor: "network stack",
      target: "browser",
      detailLab: "failure",
      routeMetrics: metrics2
    })
  ];
  if (injected[injected.length - 2].atMs >= terminalAtMs) throw new Error("partition terminal boundary must follow routing and transport stall events.");
  return injected;
}
var partitionModifier = {
  id: "partition",
  order: 130,
  apply(events2, context) {
    const trigger = latestPartitionTrigger(events2);
    const complete = events2.find((current) => current.kind === "journey.complete");
    if (!complete) throw new Error("partition requires the pre-terminal Journey completion boundary.");
    const injected = partitionEvents(trigger.atMs, complete.atMs, context.config.transportProfile);
    const cutAtMs = injected[0].atMs;
    const kept = events2.filter((current) => current.atMs < cutAtMs);
    return {
      events: [...kept, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs: 0,
      appliedModifierIds: ["partition"]
    };
  }
};
var modifiers = [dnsFailureModifier, routeFailureModifier, routeLeakModifier, serverFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier, partitionModifier].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
function applyJourneyModifiers(baseEvents, config) {
  let events2 = baseEvents.map((current) => ({ ...current }));
  let addedDurationMs = 0;
  const appliedModifierIds = [];
  const selectedModifierIds = new Set(resolveJourneyModifierIds(config));
  for (const modifier of modifiers) {
    if (!selectedModifierIds.has(modifier.id)) continue;
    const result = modifier.apply(events2, { config });
    events2 = result.events;
    addedDurationMs += result.addedDurationMs;
    appliedModifierIds.push(...result.appliedModifierIds);
  }
  if (new Set(events2.map((event3) => event3.id)).size !== events2.length) throw new Error("Journey modifiers produced duplicate event IDs.");
  if (new Set(events2.map((event3) => event3.atMs)).size !== events2.length) throw new Error("Journey modifiers produced duplicate event timestamps.");
  if (!events2.every((event3, index) => index === 0 || event3.atMs > events2[index - 1].atMs)) throw new Error("Journey modifier events must remain strictly ordered.");
  return { events: events2, addedDurationMs, appliedModifierIds };
}

// ../8f1a24ac8c73/hopscotch/src/journey/model.ts
var DEFAULT_JOURNEY_CONFIG = {
  transportProfile: "tcp-h2",
  dnsProfile: "cache-miss",
  impairmentProfile: "clean"
};
var JOURNEY_SCALE_DEPTH = {
  internet: 0,
  routing: 1,
  transport: 2,
  application: 3,
  packet: 4
};
function normalizeJourneyHostname(input2) {
  const hostname = input2.trim().toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname.length > 253) throw new Error("Hostname must contain 1\u2013253 characters.");
  if (hostname.includes("://") || /[\/:?#\[\]@]/.test(hostname)) throw new Error("Enter a hostname only, not a URL, port, path, or IP literal.");
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) throw new Error("Enter a hostname instead of an IP address.");
  const labels = hostname.split(".");
  if (labels.length < 2) throw new Error("Hostname must contain at least one dot.");
  for (const label of labels) {
    if (!label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) throw new Error(`Invalid hostname label: ${label || "(empty)"}.`);
  }
  return hostname;
}
function event2(id2, atMs, kind, scale, zoom, protocol, phase, title, summary, detail, actor, target2, detailLab, provenance = "SIMULATED") {
  return { id: id2, atMs, kind, scale, zoom, protocol, phase, title, summary, detail, actor, target: target2, detailLab, provenance };
}
function withTtl(source, ttlSeconds) {
  return { ...source, ttlSeconds };
}
function shiftEvents(events2, deltaMs) {
  if (deltaMs === 0) return events2;
  return events2.map((current) => ({ ...current, atMs: current.atMs + deltaMs }));
}
function intentEvent(hostname) {
  return event2("intent", 0, "intent.accepted", "application", "hold", "URL", "intent", `Navigate to ${hostname}`, "The application turns a human hostname into a network dependency graph.", "A URL is intent, not a route. HOPSCOTCH starts at the application layer and moves outward only when the next dependency requires it.", "browser", hostname);
}
function dnsMissEvents(hostname, destinationAddress) {
  return [
    event2("dns-cache", 420, "dns.cache-check", "application", "hold", "DNS", "cache-miss", "DNS cache miss", "No usable cached answer exists for this curated journey.", "The simulated miss forces the complete recursive resolution path to remain visible.", "stub resolver", hostname, "dns"),
    event2("dns-recursive", 850, "dns.query", "application", "hold", "DNS", "recursive-query", "Stub asks recursive resolver", `A recursive A query is issued for ${hostname}.`, "The stub asks one recursive resolver to finish the job. The recursive resolver performs iterative upstream work.", "stub resolver", "recursive resolver", "dns"),
    event2("dns-root", 1320, "dns.referral", "application", "hold", "DNS", "root-referral", "Root referral received", "The recursive resolver learns where to continue the namespace walk.", "A referral narrows the search to the next authority.", "root authority", "recursive resolver", "dns"),
    event2("dns-tld", 1810, "dns.referral", "application", "hold", "DNS", "tld-referral", "TLD referral received", "The recursive resolver is directed toward the authoritative zone.", "The resolver continues iteratively rather than asking the browser to chase each authority.", "TLD authority", "recursive resolver", "dns"),
    event2("dns-answer", 2310, "dns.answer", "application", "hold", "DNS", "answer", `${hostname} \u2192 ${destinationAddress}`, "The authoritative answer supplies a documentation-only destination address for the deterministic story.", "203.0.113.0/24 is documentation space. This journey never implies that example.test is a live public host.", "authoritative DNS", "recursive resolver", "dns"),
    withTtl(event2("dns-store", 2700, "dns.cache-store", "application", "hold", "DNS", "cache-store", "Answer cached", "The recursive result becomes reusable until its simulated TTL expires.", "The cache starts at a deterministic 300-second TTL and ages with Journey time.", "recursive resolver", "cache", "dns"), 300)
  ];
}
function dnsHitEvents(hostname, destinationAddress) {
  return [
    withTtl(event2("dns-hit", 420, "dns.cache-hit", "application", "hold", "DNS", "cache-hit", "DNS cache hit", `${hostname} \u2192 ${destinationAddress} is already cached.`, "A deterministic unexpired cached answer satisfies the name dependency immediately. No recursive, root, TLD, or authoritative traffic occurs.", "stub resolver cache", hostname, "dns"), 258)
  ];
}
function routingInternetEvents(destinationAddress, times) {
  const [routeAt, gatewayAt, asAt, physicalAt] = times;
  return [
    event2("route-lookup", routeAt, "route.lookup", "routing", "out", "IP", "route-lookup", "Destination enters the routing table", `${destinationAddress} requires a next-hop decision outside the local subnet.`, "The camera moves outward because an IP destination cannot leave the host until a route and next hop exist.", "host routing table", destinationAddress, "builder"),
    event2("gateway", gatewayAt, "route.gateway", "routing", "hold", "Ethernet/IP", "gateway", "Default gateway selected", "The host has a viable local path to the router that can forward toward the Internet.", "This is a deterministic teaching topology, not a measurement of the viewer\u2019s LAN.", "client", "edge router", "builder"),
    event2("as-path", asAt, "internet.policy-path", "internet", "out", "BGP policy model", "as-path", "Interdomain path context appears", "A simulated valley-free AS path carries the story beyond the local routing domain.", "The AS path is SIMULATED. Public collector paths, when attached, remain separate evidence and never replace this story path.", "access AS", "content AS", "internet"),
    event2("physical-context", physicalAt, "internet.physical-context", "internet", "hold", "Physical Internet", "infrastructure-context", "Physical infrastructure comes into view", "Interconnection facilities give geography to the story without claiming a cable or exact forwarding path.", "PeeringDB facility points can decorate this moment as PUBLIC DATA. Any connecting great-circle geometry remains INFERRED.", "public facility context", "destination region", "physical", "INFERRED")
  ];
}
function sharedPrelude(hostname, destinationAddress, dnsProfile) {
  const dnsEvents = dnsProfile === "cache-hit" ? dnsHitEvents(hostname, destinationAddress) : dnsMissEvents(hostname, destinationAddress);
  const routingTimes = dnsProfile === "cache-hit" ? [900, 1340, 1800, 2320] : [3140, 3560, 4050, 4520];
  return [intentEvent(hostname), ...dnsEvents, ...routingInternetEvents(destinationAddress, routingTimes)];
}
function tcpH2Events(hostname) {
  return [
    event2("tcp-syn", 5e3, "transport.segment", "transport", "in", "TCP", "syn", "SYN leaves the client", "TCP opens a reliable byte stream before TLS begins.", "This branch uses TCP + TLS 1.3 + HTTP/2.", "client TCP", "server TCP", "tcp"),
    event2("tcp-synack", 5320, "transport.segment", "transport", "hold", "TCP", "syn-ack", "SYN-ACK returns", "The server acknowledges the client sequence space and contributes its own initial sequence number.", "The handshake establishes shared transport sequence state.", "server TCP", "client TCP", "tcp"),
    event2("tcp-ack", 5620, "transport.established", "transport", "hold", "TCP", "established", "TCP connection established", "The third handshake segment makes the bidirectional byte stream usable.", "Encryption still does not exist yet.", "client TCP", "server TCP", "tcp"),
    event2("tls-clienthello", 6070, "tls.message", "application", "in", "TLS 1.3", "client-hello", "ClientHello", `SNI names ${hostname}; ALPN offers h2.`, "TLS records are carried inside the established TCP byte stream.", "TLS client", "TLS server", "tls"),
    event2("tls-serverhello", 6470, "tls.message", "application", "hold", "TLS 1.3", "server-hello", "ServerHello", "The server selects compatible cryptographic parameters and contributes its key share.", "The transcript now contains both hellos.", "TLS server", "TLS client", "tls"),
    event2("tls-encrypted", 6840, "tls.keys", "application", "hold", "TLS 1.3", "handshake-keys", "Handshake traffic becomes encrypted", "EncryptedExtensions and later server handshake messages are protected with handshake keys.", "HOPSCOTCH shows named key-schedule stages, not invented secret bytes.", "TLS key schedule", "handshake traffic", "tls"),
    event2("tls-certificate", 7210, "tls.validation", "application", "hold", "TLS 1.3", "certificate-validation", "Certificate identity validated", `The presented identity is checked against ${hostname}.`, "Certificate validation authenticates the server identity independently from routing.", "certificate validator", hostname, "tls"),
    event2("tls-finished", 7610, "tls.keys", "application", "hold", "TLS 1.3", "application-keys", "Application traffic keys ready", "Both sides can now protect application data with TLS 1.3 application traffic secrets.", "The encryption boundary changes before HTTP/2 request data is sent.", "TLS key schedule", "application traffic", "tls"),
    event2("h2-settings", 8070, "http.control", "application", "hold", "HTTP/2", "connection-control", "HTTP/2 control state exchanged", "SETTINGS establishes connection-level HTTP/2 parameters over the encrypted stream.", "HTTP/2 multiplexing lives above TCP.", "HTTP client", "HTTP server", "http"),
    event2("h2-request", 8540, "http.request", "application", "hold", "HTTP/2", "request", `GET / on ${hostname}`, "Request headers become an encrypted HTTP/2 HEADERS frame carried by TLS over TCP.", "Each representation is a different abstraction of the same bytes.", "browser", "origin", "http"),
    ...packetAssemblyEvents(hostname, "tcp-h2", 8840),
    ...packetTransitEvents("tcp-h2", 11600),
    event2("h2-headers", 16420, "http.response", "application", "out", "HTTP/2", "response-headers", "Response headers arrive", "The origin begins the response with status and metadata before the body streams.", "The first response bytes do not mean transfer is complete.", "origin", "browser", "http"),
    event2("h2-data", 16960, "http.data", "application", "hold", "HTTP/2", "streaming", "Response DATA streams", "Encrypted application data crosses the established TCP stream.", "HOPSCOTCH can now zoom into one representative frame.", "origin", "browser", "http"),
    event2("packet-frame", 17680, "packet.inspect", "packet", "in", "Ethernet / IPv4 / TCP / TLS", "frame", "Freeze one TCP frame", "One delivery unit becomes the entire world: link, network, transport, and encrypted TLS payload bytes.", "The packet microscope is a projection of the same Journey moment.", "network interface", "packet bytes", "packet"),
    event2("packet-headers", 18360, "packet.inspect", "packet", "hold", "Ethernet / IPv4 / TCP", "headers", "Explode TCP/IP headers", "The same frame opens into persistent link, network, transport, security, and application objects.", "TLS-protected application bytes remain opaque at this packet-observation boundary.", "packet bytes", "header fields", "packet"),
    event2("transfer-complete", 19160, "transfer.complete", "transport", "out", "TCP", "complete", "Transfer acknowledged", "The representative response flight is cumulatively acknowledged and TCP delivery is complete.", "The camera pulls back because byte delivery has finished.", "client TCP", "server TCP", "tcp")
  ];
}
function quicH3Events(hostname) {
  return [
    event2("quic-initial", 5e3, "transport.segment", "transport", "in", "QUIC + TLS 1.3", "quic-initial", "QUIC Initial leaves the client", `The Initial packet carries TLS ClientHello data, including SNI for ${hostname} and ALPN for h3.`, "QUIC runs over UDP, but TLS 1.3 is integrated into QUIC crypto levels rather than transported as TLS records.", "QUIC client", "QUIC server", "http"),
    event2("quic-server-initial", 5380, "tls.message", "transport", "hold", "QUIC + TLS 1.3", "server-initial", "Server Initial + Handshake arrive", "The server answers with QUIC Initial/Handshake packets carrying TLS handshake messages.", "Packet protection and TLS transcript state advance together inside QUIC.", "QUIC server", "QUIC client", "http"),
    event2("quic-handshake-keys", 5750, "tls.keys", "transport", "hold", "QUIC + TLS 1.3", "handshake-keys", "QUIC Handshake keys active", "Handshake packets move to the Handshake encryption level.", "There is no standalone TLS record layer between UDP and QUIC.", "QUIC crypto", "Handshake packets", "http"),
    event2("quic-certificate", 6180, "tls.validation", "transport", "hold", "QUIC + TLS 1.3", "certificate-validation", "Certificate identity validated", `The TLS identity carried through QUIC is checked against ${hostname}.`, "QUIC changes transport mechanics, not server-authentication requirements.", "certificate validator", hostname, "http"),
    event2("quic-1rtt", 6620, "tls.keys", "transport", "hold", "QUIC + TLS 1.3", "application-keys", "1-RTT keys ready", "TLS application secrets feed QUIC 1-RTT packet protection.", "Application data can now travel on independent QUIC streams.", "QUIC crypto", "1-RTT packets", "http"),
    event2("quic-established", 6900, "transport.established", "transport", "hold", "QUIC", "established", "QUIC connection established", "The connection has usable 1-RTT keys and transport parameters.", "HTTP/3 can now use QUIC streams without a TCP byte stream.", "QUIC client", "QUIC server", "http"),
    event2("h3-control", 7500, "http.control", "application", "in", "HTTP/3", "connection-control", "HTTP/3 control streams open", "HTTP/3 SETTINGS and QPACK control state use dedicated QUIC streams.", "This curated trace avoids dynamic QPACK dependencies so transport behavior stays legible.", "HTTP/3 client", "HTTP/3 server", "http"),
    event2("h3-request", 8120, "http.request", "application", "hold", "HTTP/3", "request", `GET / on ${hostname}`, "Request fields are encoded for HTTP/3 and carried on a QUIC request stream.", "There is no HTTP/2 framing or TCP stream in this branch.", "browser", "origin", "http"),
    ...packetAssemblyEvents(hostname, "quic-h3", 8420),
    ...packetTransitEvents("quic-h3", 11180),
    event2("h3-headers", 16e3, "http.response", "application", "out", "HTTP/3", "response-headers", "Response headers arrive", "The response begins on the request\u2019s QUIC stream.", "Other QUIC streams are independently ordered.", "origin", "browser", "http"),
    event2("h3-data", 16700, "http.data", "application", "hold", "HTTP/3", "streaming", "HTTP/3 DATA streams", "Protected QUIC STREAM frames carry response data.", "QUIC loss can still affect congestion control even though stream ordering is independent.", "origin", "browser", "http"),
    event2("packet-frame", 17680, "packet.inspect", "packet", "in", "Ethernet / IPv4 / UDP / QUIC", "frame", "Freeze one QUIC packet", "One datagram becomes the entire world: Ethernet, IP, UDP, QUIC header, and protected payload.", "TLS-derived keys protect QUIC packet payloads; there is no visible TLS record envelope.", "network interface", "packet bytes", "packet"),
    event2("packet-headers", 18360, "packet.inspect", "packet", "hold", "Ethernet / IPv4 / UDP / QUIC", "headers", "Explode UDP + QUIC headers", "The same datagram opens into link, network, UDP, QUIC protection, and application objects.", "Protected QUIC payload bytes remain opaque without key material.", "packet bytes", "header fields", "packet"),
    event2("transfer-complete", 19160, "transfer.complete", "transport", "out", "QUIC", "complete", "QUIC transfer complete", "The response stream reaches its final offset and delivery is acknowledged.", "Completion belongs to QUIC stream/packet state, not TCP cumulative ACK space.", "QUIC client", "QUIC server", "http")
  ];
}
function packetAssemblyEvents(hostname, profile, startAtMs) {
  const quic = profile === "quic-h3";
  const application = quic ? "HTTP/3 request fields" : "HTTP/2 request headers";
  const security = quic ? "QUIC 1-RTT protection" : "TLS 1.3 application data";
  const transport = quic ? "UDP datagram + QUIC packet" : "TCP segment";
  const transportDetail = quic ? "QUIC integrates TLS-derived protection into its packet format, then uses UDP as the IP payload. HOPSCOTCH does not insert a standalone TLS record layer." : "TLS-protected bytes become TCP payload. Sequence, acknowledgment, flags, window, and checksum belong to the TCP header.";
  return [
    event2("packet-assembly-application", startAtMs, "packet.assembly", "packet", "in", quic ? "HTTP/3" : "HTTP/2", "application", "Application data isolated", `${application} for GET / on ${hostname} becomes the logical payload.`, "This is the clear application meaning at the browser boundary; it is not yet a wire-visible packet.", "browser", "network stack", "packet"),
    event2("packet-assembly-security", startAtMs + 460, "packet.assembly", "packet", "hold", quic ? "QUIC + TLS 1.3" : "TLS 1.3", "security", `${security} closes`, quic ? "HTTP/3 request data becomes protected QUIC STREAM data." : "HTTP/2 request bytes become opaque TLS application data.", quic ? "TLS-derived keys protect QUIC payloads without creating a TLS record layer between QUIC and UDP." : "The HTTP meaning remains available above TLS; packet observers without keys see an opaque TLS record payload.", quic ? "QUIC packet protection" : "TLS record layer", "protected application bytes", "packet"),
    event2("packet-assembly-transport", startAtMs + 920, "packet.assembly", "packet", "hold", quic ? "QUIC / UDP" : "TCP", "transport", `${transport} assembles`, quic ? "UDP ports and checksum carry a protected QUIC packet toward the origin." : "TCP ports, sequence space, flags, window, and checksum surround the protected bytes.", transportDetail, quic ? "QUIC + UDP" : "TCP", "transport unit", "packet"),
    event2("packet-assembly-network", startAtMs + 1380, "packet.assembly", "packet", "hold", "IPv4", "network", "IPv4 envelope assembles", "Source, destination, TTL, protocol, length, and checksum establish the routed packet.", "The IP packet is the continuity object across routed hops. Its Ethernet envelope may change at every hop.", "IPv4", "routed packet", "packet"),
    event2("packet-assembly-link", startAtMs + 1840, "packet.assembly", "packet", "hold", "Ethernet II", "link", "Hop-local Ethernet envelope closes", "Source and next-hop destination MAC addresses frame the same IPv4 packet for this local link.", "The Ethernet header is hop-local. The NIC generates the FCS during transmission; the simulated inspection snapshot does not pretend the trailer was captured.", "Ethernet", "next-hop frame", "packet"),
    event2("packet-assembly-collapsed", startAtMs + 2300, "packet.assembly", "packet", "hold", "Ethernet / IPv4 / transport", "collapsed", "Structured frame ready at the NIC", "Five semantic representations collapse into one deterministic outbound data unit.", "No animation callback created this frame. Scrubbing to this timestamp reconstructs the same semantic assembly from the canonical event log.", "network stack", "NIC queue", "packet")
  ];
}
function packetTransitEvents(profile, startAtMs) {
  const transport = profile === "quic-h3" ? "UDP / QUIC" : "TCP";
  return [
    event2("packet-transit-nic", startAtMs, "packet.transit", "packet", "hold", `Ethernet / IPv4 / ${transport}`, "nic-serialize", "NIC serializes the structured frame", "The frame becomes an ordered link transmission without changing its packet semantics.", "The renderer exposes bytes, bits, and link activity as representations of one deterministic frame. The NIC generates a per-transmission FCS; it is not fabricated as captured packet data.", "client NIC", "access link", "packet"),
    event2("packet-transit-link", startAtMs + 480, "packet.transit", "packet", "hold", "Ethernet PHY", "link-transmit", "Symbols cross the access link", "Structured bytes become physical link activity moving toward the switch.", "Serialization is a rendering of the already-built frame. Browser scheduling cannot create, drop, or reorder semantic network state.", "client NIC", "access switch Gi0/3", "physical"),
    event2("packet-transit-switch-inspect", startAtMs + 960, "packet.transit", "packet", "hold", "Ethernet II", "switch-inspect", "Switch isolates destination MAC", "Only the destination MAC is projected for the forwarding decision; unrelated packet fields recede.", "The switch may learn the source MAC on ingress, but this forwarding decision compares destination MAC 02:48:4F:50:00:02 with its MAC table.", "access switch Gi0/3", "MAC table", "packet"),
    event2("packet-transit-switch-forward", startAtMs + 1440, "packet.transit", "packet", "hold", "Ethernet II", "switch-forward", "MAC table selects Gi0/24", "The same Ethernet header and IPv4 payload leave the selected switch port.", "A normal Layer 2 forward does not rewrite source or destination MAC. The egress transmitter generates link-local physical overhead such as a new FCS.", "access switch", "Gi0/24 \u2192 edge router", "packet"),
    event2("packet-transit-router-decapsulate", startAtMs + 1920, "packet.transit", "packet", "hold", "Ethernet II \u2192 IPv4", "router-decapsulate", "Router terminates the incoming Ethernet envelope", "The hop-local Layer 2 shell opens and ends; the routed IPv4 packet remains.", "The router validates the incoming frame, removes the Ethernet header/trailer context, and makes an IP forwarding decision. Ethernet does not continue through the router.", "edge router lan0", "IPv4 forwarding plane", "packet"),
    event2("packet-transit-router-ttl", startAtMs + 2400, "packet.transit", "packet", "hold", "IPv4", "router-ttl", "TTL decrements: 64 \u2192 63", "The router mutates the IPv4 TTL and updates the IPv4 header checksum.", "Destination IP and transport payload remain logically continuous. TTL and its dependent header checksum are the exact routed-hop mutations shown here.", "IPv4 forwarding plane", "mutable header fields", "packet"),
    event2("packet-transit-router-route", startAtMs + 2880, "packet.transit", "packet", "hold", "IPv4 routing", "router-route", "Destination IP selects the next hop", "203.0.113.42 matches 203.0.113.0/24 via 198.51.100.2 on wan0.", "The destination IP\u2014not either hop-local MAC address\u2014selects the route. The chosen next hop will supply the next Ethernet destination.", "edge router FIB", "wan0 / 198.51.100.2", "builder"),
    event2("packet-transit-router-reencapsulate", startAtMs + 3360, "packet.transit", "packet", "hold", "IPv4 \u2192 Ethernet II", "router-reencapsulate", "A new Ethernet envelope assembles", "Router wan0 constructs new source and next-hop destination MAC fields around the forwarded IPv4 packet.", "The outgoing frame is a new hop-local object. The IPv4 continuity identity survives with TTL 63 and an updated header checksum.", "edge router wan0", "next-hop Ethernet frame", "packet"),
    event2("packet-transit-next-link", startAtMs + 3840, "packet.transit", "packet", "hold", "Ethernet PHY", "next-link", "The re-encapsulated packet continues", "A second link transmission carries the new Ethernet frame toward 198.51.100.2.", "The visual grammar repeats\u2014frame, serialization, link\u2014but the Layer 2 addresses now belong to the next hop while the IP destination remains 203.0.113.42.", "edge router wan0", "next hop 198.51.100.2", "physical")
  ];
}
function sharedTail(hostname, profile) {
  const applicationProtocol = profile === "tcp-h2" ? "HTTP/2 + TLS" : "HTTP/3 + QUIC";
  return [
    event2("response-ready", 19980, "response.ready", "application", "out", applicationProtocol, "response-ready", "Response available to the application", "Decrypted response bytes are delivered upward to the browser.", "Network delivery ends by satisfying the application intent that began the story.", "network stack", "browser", "http"),
    event2("pullback-route", 20800, "camera.pullback", "routing", "out", "IP", "pullback-routing", "Pull back through the route", "The journey recedes from application state to the forwarding structures that carried it.", "Nothing new is transmitted here. This is an explanatory camera move through already completed causal state.", "camera", "routing scale", "builder"),
    event2("pullback-internet", 21650, "camera.pullback", "internet", "out", "Internet", "pullback-internet", "Return to Internet scale", "Local routes, AS policy, and physical infrastructure collapse back into one global context.", "Observed/public context can decorate this endpoint view without rewriting the simulated journey that just completed.", "camera", "Internet scale", "physical", "INFERRED"),
    event2("complete", 22650, "journey.complete", "application", "in", "URL", "complete", `${hostname} journey complete`, "A human hostname became DNS state, routing state, transport state, protected application traffic, packets, and finally a response.", "The same global time machine can now be rewound to any causal boundary without changing the event log.", hostname, "browser")
  ];
}
function buildJourneyScenario(hostnameInput = "example.test", config = {}) {
  const hostname = normalizeJourneyHostname(hostnameInput);
  const destinationAddress = "203.0.113.42";
  const normalizedConfig = { ...DEFAULT_JOURNEY_CONFIG, ...config };
  const dnsShiftMs = normalizedConfig.dnsProfile === "cache-hit" ? -2200 : 0;
  const baseTransportEvents = normalizedConfig.transportProfile === "quic-h3" ? quicH3Events(hostname) : tcpH2Events(hostname);
  const transportEvents = shiftEvents(baseTransportEvents, dnsShiftMs);
  const tailEvents = shiftEvents(sharedTail(hostname, normalizedConfig.transportProfile), dnsShiftMs);
  const baseEvents = [
    ...sharedPrelude(hostname, destinationAddress, normalizedConfig.dnsProfile),
    ...transportEvents,
    ...tailEvents
  ];
  const modifierResult = applyJourneyModifiers(baseEvents, normalizedConfig);
  const events2 = modifierResult.events;
  const modifierIds = modifierResult.appliedModifierIds;
  const impairmentProfile = impairmentProfileForModifiers(modifierIds);
  const impairmentKey = impairmentProfile === "composed" ? modifierIds.join("+") : impairmentProfile;
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
    events: events2
  };
}
function latestJourneyEventAtOrBefore(scenario, timeMs) {
  let active = scenario.events[0];
  for (const candidate of scenario.events) {
    if (candidate.atMs > timeMs) break;
    active = candidate;
  }
  return active;
}
function journeyStateAt(scenario, requestedTimeMs) {
  const timeMs = Math.max(0, Math.min(scenario.durationMs, requestedTimeMs));
  const activeEvent = latestJourneyEventAtOrBefore(scenario, timeMs);
  const activeEventIndex = scenario.events.indexOf(activeEvent);
  const previousEvent = scenario.events[Math.max(0, activeEventIndex - 1)];
  const completed = scenario.events.filter((candidate) => candidate.atMs <= timeMs);
  let dns = "idle";
  let dnsTtlBase = null;
  let dnsCachedAtMs = null;
  let resolvedAddress = null;
  let route = "idle";
  let transport = "closed";
  let tls = "idle";
  let http = "idle";
  let server = "healthy";
  let policy = "normal";
  let packet2 = "idle";
  let packetAssemblyStage = "idle";
  let packetTransitStage = "idle";
  let impairmentState = scenario.modifierIds.length === 0 ? "clean" : "armed";
  let transportMetrics = null;
  let congestionMetrics2 = null;
  let serverMetrics2 = null;
  let policyMetrics = null;
  let routeMetrics = null;
  let responseReady = false;
  let journeyComplete = false;
  let journeyFailed = false;
  let failureReason = null;
  for (const current of completed) {
    switch (current.kind) {
      case "dns.cache-check":
        dns = "cache-miss";
        break;
      case "dns.cache-hit":
        dns = "cached";
        resolvedAddress = scenario.destinationAddress;
        dnsTtlBase = current.ttlSeconds ?? null;
        dnsCachedAtMs = current.atMs;
        break;
      case "dns.query":
        dns = "resolving";
        break;
      case "dns.timeout":
        dns = "timeout";
        impairmentState = "dns-failed";
        break;
      case "dns.retry":
        dns = "retrying";
        impairmentState = "dns-retrying";
        break;
      case "dns.failure-masked":
        impairmentState = "dns-masked";
        break;
      case "dns.referral":
        dns = "resolving";
        if (impairmentState === "dns-failed" || impairmentState === "dns-retrying") impairmentState = "normalized";
        break;
      case "dns.answer":
        dns = "resolved";
        resolvedAddress = scenario.destinationAddress;
        break;
      case "dns.cache-store":
        dns = "cached";
        dnsTtlBase = current.ttlSeconds ?? null;
        dnsCachedAtMs = current.atMs;
        break;
      case "route.lookup":
        route = "lookup";
        if (impairmentState === "dns-masked") impairmentState = "normalized";
        break;
      case "route.gateway":
        route = "gateway-ready";
        break;
      case "route.failure":
        route = "failed";
        impairmentState = "route-failed";
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case "route.invalidated":
        route = "failed";
        impairmentState = "route-failed";
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case "route.recompute":
        route = "recomputing";
        impairmentState = "route-recomputing";
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case "route.alternate-installed":
        route = "alternate-ready";
        impairmentState = "route-ready";
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case "route.partition":
        route = "failed";
        impairmentState = "partitioned";
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case "route.partition-recompute":
        route = "recomputing";
        impairmentState = "partition-recomputing";
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case "route.unreachable":
        route = "unreachable";
        impairmentState = "unreachable";
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case "internet.policy-path":
        route = "internet-path-ready";
        policy = "normal";
        break;
      case "internet.route-leak-advertised":
        policy = "leak-advertised";
        impairmentState = "policy-leak";
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case "internet.route-leak-selected":
        policy = "leaked";
        impairmentState = "policy-leak";
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case "internet.policy-anomaly":
        policy = "anomaly";
        impairmentState = "policy-anomaly";
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case "internet.route-leak-withdrawn":
        policy = "anomaly";
        impairmentState = "policy-anomaly";
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case "internet.policy-restored":
        policy = "restored";
        impairmentState = "policy-restored";
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case "internet.physical-context":
        if (impairmentState === "policy-restored") impairmentState = "normalized";
        break;
      case "transport.segment":
        transport = "handshake";
        break;
      case "transport.established":
        transport = "established";
        break;
      case "transport.loss":
        impairmentState = "lost";
        break;
      case "transport.loss-detected":
        impairmentState = "detected";
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case "transport.retransmit":
        impairmentState = "recovering";
        break;
      case "transport.recovered":
        impairmentState = "recovered";
        break;
      case "transport.latency":
        impairmentState = "delayed";
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case "transport.rtt-update":
        impairmentState = "estimating";
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case "transport.latency-cleared":
        impairmentState = "normalized";
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case "transport.queue-growth":
        impairmentState = "queueing";
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics2 = current.congestionMetrics ?? congestionMetrics2;
        break;
      case "transport.ecn-mark":
        impairmentState = "ecn-signaled";
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics2 = current.congestionMetrics ?? congestionMetrics2;
        break;
      case "transport.congestion-response":
        impairmentState = "congestion-responding";
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics2 = current.congestionMetrics ?? congestionMetrics2;
        break;
      case "transport.congestion-cleared":
        impairmentState = "normalized";
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics2 = current.congestionMetrics ?? congestionMetrics2;
        break;
      case "transport.stalled":
        transport = "stalled";
        impairmentState = "unreachable";
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case "tls.message":
        tls = "negotiating";
        break;
      case "tls.validation":
        tls = "validating";
        break;
      case "tls.keys":
        tls = current.phase === "application-keys" ? "application-keys" : "handshake-keys";
        break;
      case "http.control":
        http = "control";
        break;
      case "http.request":
        http = "request-sent";
        break;
      case "server.unavailable":
        server = "unavailable";
        impairmentState = "server-unavailable";
        serverMetrics2 = current.serverMetrics ?? serverMetrics2;
        break;
      case "http.service-unavailable":
        server = "unavailable";
        http = "service-unavailable";
        impairmentState = "server-unavailable";
        serverMetrics2 = current.serverMetrics ?? serverMetrics2;
        break;
      case "http.retry-wait":
        server = "waiting";
        http = "retry-wait";
        impairmentState = "server-waiting";
        serverMetrics2 = current.serverMetrics ?? serverMetrics2;
        break;
      case "server.recovered":
        server = "ready";
        impairmentState = "server-ready";
        serverMetrics2 = current.serverMetrics ?? serverMetrics2;
        break;
      case "http.retry":
        server = "ready";
        http = "request-sent";
        impairmentState = "server-ready";
        serverMetrics2 = current.serverMetrics ?? serverMetrics2;
        break;
      case "http.response":
        http = "headers";
        if (impairmentState === "server-ready") {
          server = "healthy";
          impairmentState = "normalized";
        }
        break;
      case "http.data":
        http = "streaming";
        break;
      case "packet.assembly":
        packet2 = "assembling";
        packetAssemblyStage = current.phase;
        break;
      case "packet.transit":
        packet2 = "transit";
        packetTransitStage = current.phase;
        break;
      case "packet.inspect":
        packet2 = current.phase === "headers" ? "headers" : "frame";
        packetAssemblyStage = current.phase === "headers" ? "exploded" : "collapsed";
        break;
      case "transfer.complete":
        transport = "complete";
        http = "complete";
        break;
      case "response.ready":
        responseReady = true;
        break;
      case "journey.complete":
        journeyComplete = true;
        break;
      case "journey.failed":
        route = "unreachable";
        transport = "stalled";
        http = "stalled";
        responseReady = false;
        journeyComplete = false;
        journeyFailed = true;
        failureReason = "network-unreachable";
        impairmentState = "unreachable";
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      default:
        break;
    }
  }
  const dnsTtlSeconds = dnsTtlBase === null || dnsCachedAtMs === null ? null : Math.max(0, dnsTtlBase - Math.floor((timeMs - dnsCachedAtMs) / 1e3));
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
    congestionMetrics: congestionMetrics2,
    serverMetrics: serverMetrics2,
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
    packet: packet2,
    packetAssemblyStage,
    packetTransitStage,
    responseReady,
    journeyComplete,
    journeyFailed,
    failureReason
  };
}

// ../8f1a24ac8c73/hopscotch/src/simulation/model.ts
function clampScenarioTime(scenario, timeMs) {
  return Math.max(0, Math.min(scenario.durationMs, timeMs));
}
function eventsAtOrBefore(scenario, timeMs) {
  const clamped = clampScenarioTime(scenario, timeMs);
  return scenario.events.filter((event3) => event3.atMs <= clamped);
}

// ../8f1a24ac8c73/hopscotch/src/simulation/lab01.ts
var lab01Scenario = {
  id: "lab-01-failure-recovery",
  title: "Failure and recovery",
  durationMs: 7e3,
  nodes: [
    { id: "client", label: "Client", shortLabel: "CLIENT", x: 8, y: 36, kind: "client" },
    { id: "edge", label: "Edge Router", shortLabel: "EDGE", x: 28, y: 36, kind: "edge" },
    { id: "r1", label: "Router 1", shortLabel: "R1", x: 52, y: 14, kind: "router" },
    { id: "r2", label: "Router 2", shortLabel: "R2", x: 52, y: 58, kind: "router" },
    { id: "core", label: "Core Router", shortLabel: "CORE", x: 84, y: 36, kind: "router" },
    { id: "service", label: "Application", shortLabel: "APP", x: 112, y: 36, kind: "service" }
  ],
  links: [
    { id: "client-edge", from: "client", to: "edge", metric: 1, role: "access" },
    { id: "edge-r1", from: "edge", to: "r1", metric: 10, role: "primary" },
    { id: "edge-r2", from: "edge", to: "r2", metric: 30, role: "alternate" },
    { id: "r1-r2", from: "r1", to: "r2", metric: 20, role: "control" },
    { id: "r1-core", from: "r1", to: "core", metric: 10, role: "primary" },
    { id: "r2-core", from: "r2", to: "core", metric: 20, role: "alternate" },
    { id: "core-service", from: "core", to: "service", metric: 1, role: "service" }
  ],
  paths: [
    {
      id: "primary",
      label: "Primary path",
      nodeIds: ["client", "edge", "r1", "core", "service"],
      linkIds: ["client-edge", "edge-r1", "r1-core", "core-service"],
      metric: 22
    },
    {
      id: "alternate",
      label: "Alternate path",
      nodeIds: ["client", "edge", "r2", "core", "service"],
      linkIds: ["client-edge", "edge-r2", "r2-core", "core-service"],
      metric: 52
    }
  ],
  events: [
    {
      id: "flow-established",
      atMs: 0,
      kind: "flow.start",
      actorId: "client",
      targetId: "service",
      payload: {
        title: "Primary path established",
        summary: "Application traffic is flowing through R1 on the lowest-cost route.",
        detail: "The edge router prefers CLIENT \u2192 EDGE \u2192 R1 \u2192 CORE \u2192 APP with total metric 22. R2 remains a valid but more expensive standby path.",
        severity: "info",
        pathId: "primary"
      }
    },
    {
      id: "primary-link-fails",
      atMs: 1900,
      kind: "link.failure",
      actorId: "r1",
      targetId: "core",
      payload: {
        title: "Primary link fails",
        summary: "The R1 \u2194 CORE adjacency disappears and the forwarding path is broken.",
        detail: "Traffic can no longer traverse the installed primary route. The physical failure is immediate; control-plane convergence is not.",
        severity: "critical",
        linkId: "r1-core"
      }
    },
    {
      id: "lsa-originates",
      atMs: 2500,
      kind: "route.advertise",
      actorId: "r1",
      targetId: "edge",
      payload: {
        title: "R1 floods new link state",
        summary: "R1 advertises that the R1 \u2194 CORE link is no longer reachable.",
        detail: "The topology change begins propagating through surviving adjacencies. Routers are learning about the failure, but forwarding has not recovered yet.",
        severity: "warning",
        linkId: "r1-core",
        propagationLinkIds: ["edge-r1", "r1-r2"]
      }
    },
    {
      id: "lsa-propagates",
      atMs: 3150,
      kind: "route.advertise",
      actorId: "r2",
      targetId: "core",
      payload: {
        title: "Failure knowledge propagates",
        summary: "R2 and CORE now share the updated topology view.",
        detail: "The link-state database converges across the surviving path. Once the relevant routers have the same topology, shortest-path calculation can produce a replacement route.",
        severity: "warning",
        propagationLinkIds: ["edge-r2", "r2-core"]
      }
    },
    {
      id: "spf-recompute",
      atMs: 3800,
      kind: "route.recompute",
      actorId: "edge",
      targetId: "service",
      payload: {
        title: "SPF selects the alternate path",
        summary: "The failed edge is removed from the graph and the standby route through R2 wins.",
        detail: "CLIENT \u2192 EDGE \u2192 R2 \u2192 CORE \u2192 APP is more expensive than the original route, but it is now the lowest-cost viable path.",
        severity: "info",
        pathId: "alternate"
      }
    },
    {
      id: "traffic-reroutes",
      atMs: 4500,
      kind: "flow.reroute",
      actorId: "edge",
      targetId: "r2",
      payload: {
        title: "Forwarding moves to R2",
        summary: "New traffic leaves the edge router on the alternate next hop.",
        detail: "The forwarding plane installs the replacement route. The route exists again, but the application still has to absorb the disruption that occurred during convergence.",
        severity: "info",
        pathId: "alternate"
      }
    },
    {
      id: "application-recovers",
      atMs: 5400,
      kind: "flow.recover",
      actorId: "client",
      targetId: "service",
      payload: {
        title: "Traffic recovers",
        summary: "The application flow is healthy again over the alternate route.",
        detail: "The failed R1 \u2194 CORE link remains down. Recovery comes from routing around the failure, not from restoring the failed link.",
        severity: "success",
        pathId: "alternate"
      }
    }
  ]
};
var initialState = {
  timeMs: 0,
  phase: "steady",
  statusLabel: "PRIMARY PATH HEALTHY",
  activePathId: "primary",
  failedLinkIds: [],
  controlLinkIds: [],
  latestEventId: "flow-established"
};
function addUnique(items, item) {
  return items.includes(item) ? items : [...items, item];
}
function reduceEvent(state, event3) {
  const base = { ...state, latestEventId: event3.id };
  switch (event3.kind) {
    case "flow.start":
      return {
        ...base,
        phase: "steady",
        statusLabel: "PRIMARY PATH HEALTHY",
        activePathId: event3.payload.pathId ?? state.activePathId,
        controlLinkIds: []
      };
    case "link.failure":
      return {
        ...base,
        phase: "failure",
        statusLabel: "FORWARDING PATH BROKEN",
        failedLinkIds: event3.payload.linkId ? addUnique(state.failedLinkIds, event3.payload.linkId) : state.failedLinkIds,
        controlLinkIds: []
      };
    case "route.advertise":
      return {
        ...base,
        phase: "converging",
        statusLabel: "LINK STATE PROPAGATING",
        controlLinkIds: event3.payload.propagationLinkIds ?? []
      };
    case "route.recompute":
      return {
        ...base,
        phase: "recomputing",
        statusLabel: "SHORTEST PATH RECALCULATING",
        controlLinkIds: []
      };
    case "flow.reroute":
      return {
        ...base,
        phase: "rerouting",
        statusLabel: "ALTERNATE PATH INSTALLED",
        activePathId: event3.payload.pathId ?? state.activePathId,
        controlLinkIds: []
      };
    case "flow.recover":
      return {
        ...base,
        phase: "recovered",
        statusLabel: "TRAFFIC RECOVERED",
        activePathId: event3.payload.pathId ?? state.activePathId,
        controlLinkIds: []
      };
    case "link.restore":
      return {
        ...base,
        failedLinkIds: event3.payload.linkId ? state.failedLinkIds.filter((linkId) => linkId !== event3.payload.linkId) : state.failedLinkIds
      };
    default:
      return base;
  }
}
function lab01StateAt(timeMs) {
  const clamped = clampScenarioTime(lab01Scenario, timeMs);
  const state = eventsAtOrBefore(lab01Scenario, clamped).reduce(reduceEvent, initialState);
  return { ...state, timeMs: clamped };
}

// ../8f1a24ac8c73/hopscotch/src/measurement/native.ts
var PROVENANCE = "LOCAL MEASURED";
var PLATFORMS = /* @__PURE__ */ new Set(["windows", "macos", "linux", "unknown"]);
var CATEGORIES = /* @__PURE__ */ new Set(["interface", "route", "dns", "icmp", "traceroute", "transport", "packet-capture"]);
var AVAILABILITY = /* @__PURE__ */ new Set(["available", "unavailable", "partial"]);
var TARGET_KINDS = /* @__PURE__ */ new Set(["hostname", "ip", "prefix", "interface", "service"]);
var UNITS = /* @__PURE__ */ new Set(["ms", "bytes", "bits-per-second", "percent", "count", "hops"]);
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertRecord(value, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}
function assertExactKeys(value, allowed, label) {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).filter((key2) => !allowedSet.has(key2));
  if (unexpected.length > 0) throw new Error(`${label} contains unsupported field(s): ${unexpected.join(", ")}.`);
}
function assertString(value, label, max = 240) {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > max) throw new Error(`${label} must contain 1\u2013${max} characters.`);
  return normalized;
}
function assertNullableString(value, label, max = 120) {
  if (value === null) return null;
  return assertString(value, label, max);
}
function assertTimestamp(value, label) {
  const timestamp = assertString(value, label, 80);
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`${label} must be an ISO-compatible timestamp.`);
  return timestamp;
}
function assertStringArray(value, label, options2 = {}) {
  const { allowEmpty = true, maxItems = 64, maxLength = 240 } = options2;
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (!allowEmpty && value.length === 0) throw new Error(`${label} must not be empty.`);
  if (value.length > maxItems) throw new Error(`${label} supports at most ${maxItems} entries.`);
  return value.map((entry, index) => assertString(entry, `${label}[${index}]`, maxLength));
}
function parseTarget(value, label) {
  if (value === null) return null;
  const record = assertRecord(value, label);
  assertExactKeys(record, ["kind", "value"], label);
  if (!TARGET_KINDS.has(record.kind)) throw new Error(`${label}.kind is unsupported.`);
  return {
    kind: record.kind,
    value: assertString(record.value, `${label}.value`, 253)
  };
}
function parseValue(value, label) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} numeric values must be finite.`);
    return value;
  }
  if (Array.isArray(value)) return assertStringArray(value, label, { maxItems: 128, maxLength: 253 });
  throw new Error(`${label} must be a scalar, string list, or null; structured model/Journey state is not valid measured fact data.`);
}
function parseFact(value, captureStart, captureEnd, index) {
  const label = `facts[${index}]`;
  const record = assertRecord(value, label);
  assertExactKeys(record, ["id", "provenance", "category", "subject", "availability", "observedAt", "target", "value", "unit", "note"], label);
  if (record.provenance !== PROVENANCE) throw new Error(`${label}.provenance must be LOCAL MEASURED.`);
  if (!CATEGORIES.has(record.category)) throw new Error(`${label}.category is unsupported.`);
  if (!AVAILABILITY.has(record.availability)) throw new Error(`${label}.availability is unsupported.`);
  const observedAt = assertTimestamp(record.observedAt, `${label}.observedAt`);
  const observedMs = Date.parse(observedAt);
  if (observedMs < captureStart || observedMs > captureEnd) throw new Error(`${label}.observedAt must fall inside the capture interval.`);
  const parsedValue = parseValue(record.value, `${label}.value`);
  let unit = null;
  if (record.unit !== null) {
    if (!UNITS.has(record.unit)) throw new Error(`${label}.unit is unsupported.`);
    unit = record.unit;
  }
  if (unit !== null && typeof parsedValue !== "number") throw new Error(`${label}.unit requires a numeric value.`);
  if (record.availability === "unavailable" && parsedValue !== null) throw new Error(`${label}.value must be null when availability is unavailable.`);
  if (unit === "percent" && typeof parsedValue === "number" && (parsedValue < 0 || parsedValue > 100)) throw new Error(`${label}.value must be 0\u2013100 for percent.`);
  if ((unit === "bytes" || unit === "bits-per-second" || unit === "count" || unit === "hops" || unit === "ms") && typeof parsedValue === "number" && parsedValue < 0) throw new Error(`${label}.value must be non-negative for ${unit}.`);
  return {
    id: assertString(record.id, `${label}.id`, 120),
    provenance: PROVENANCE,
    category: record.category,
    subject: assertString(record.subject, `${label}.subject`, 240),
    availability: record.availability,
    observedAt,
    target: parseTarget(record.target, `${label}.target`),
    value: parsedValue,
    unit,
    note: assertString(record.note, `${label}.note`, 500)
  };
}
function parseNativeMeasurementSnapshot(value) {
  const record = assertRecord(value, "Native measurement snapshot");
  assertExactKeys(record, ["schema", "version", "provenance", "generatedAt", "source", "capture", "scope", "facts", "warnings"], "Native measurement snapshot");
  if (record.schema !== "hopscotch.native-measurement") throw new Error("Native measurement schema must be hopscotch.native-measurement.");
  if (record.version !== 1) throw new Error("Native measurement version must be 1.");
  if (record.provenance !== PROVENANCE) throw new Error("Native measurement provenance must be LOCAL MEASURED.");
  const sourceRecord = assertRecord(record.source, "source");
  assertExactKeys(sourceRecord, ["adapter", "adapterVersion", "platform", "tool", "toolVersion"], "source");
  if (!PLATFORMS.has(sourceRecord.platform)) throw new Error("source.platform is unsupported.");
  const source = {
    adapter: assertString(sourceRecord.adapter, "source.adapter", 120),
    adapterVersion: assertString(sourceRecord.adapterVersion, "source.adapterVersion", 80),
    platform: sourceRecord.platform,
    tool: assertString(sourceRecord.tool, "source.tool", 120),
    toolVersion: assertNullableString(sourceRecord.toolVersion, "source.toolVersion", 80)
  };
  const captureRecord = assertRecord(record.capture, "capture");
  assertExactKeys(captureRecord, ["startedAt", "completedAt"], "capture");
  const startedAt = assertTimestamp(captureRecord.startedAt, "capture.startedAt");
  const completedAt = assertTimestamp(captureRecord.completedAt, "capture.completedAt");
  const captureStart = Date.parse(startedAt);
  const captureEnd = Date.parse(completedAt);
  if (captureEnd < captureStart) throw new Error("capture.completedAt must not precede capture.startedAt.");
  const generatedAt = assertTimestamp(record.generatedAt, "generatedAt");
  if (Date.parse(generatedAt) < captureEnd) throw new Error("generatedAt must not precede capture.completedAt.");
  const scopeRecord = assertRecord(record.scope, "scope");
  assertExactKeys(scopeRecord, ["vantage", "completeness", "globalComplete", "target", "limitations"], "scope");
  if (scopeRecord.vantage !== "local-host") throw new Error("scope.vantage must be local-host.");
  if (scopeRecord.completeness !== "bounded") throw new Error("scope.completeness must be bounded.");
  if (scopeRecord.globalComplete !== false) throw new Error("scope.globalComplete must be false; local measurements cannot claim global completeness.");
  const limitations = assertStringArray(scopeRecord.limitations, "scope.limitations", { allowEmpty: false, maxItems: 32, maxLength: 500 });
  const scope = {
    vantage: "local-host",
    completeness: "bounded",
    globalComplete: false,
    target: parseTarget(scopeRecord.target, "scope.target"),
    limitations
  };
  if (!Array.isArray(record.facts)) throw new Error("facts must be an array.");
  if (record.facts.length > 4096) throw new Error("facts supports at most 4096 entries per snapshot.");
  const facts = record.facts.map((fact2, index) => parseFact(fact2, captureStart, captureEnd, index));
  const seen = /* @__PURE__ */ new Set();
  for (const fact2 of facts) {
    if (seen.has(fact2.id)) throw new Error(`Duplicate measured fact id: ${fact2.id}.`);
    seen.add(fact2.id);
  }
  return {
    schema: "hopscotch.native-measurement",
    version: 1,
    provenance: PROVENANCE,
    generatedAt,
    source,
    capture: { startedAt, completedAt },
    scope,
    facts,
    warnings: assertStringArray(record.warnings, "warnings", { maxItems: 64, maxLength: 500 })
  };
}

// ../8f1a24ac8c73/hopscotch/src/measurement/state.ts
var DEFAULT_MEASURED_FRESHNESS_POLICY = Object.freeze({
  freshForMs: 6e4,
  staleAfterMs: 3e5
});
function targetKey(target2) {
  return target2 === null ? "untargeted" : `${target2.kind}:${target2.value}`;
}
function copyTarget(target2) {
  return target2 === null ? null : { ...target2 };
}
function copyFact(fact2) {
  return {
    ...fact2,
    target: copyTarget(fact2.target),
    value: Array.isArray(fact2.value) ? [...fact2.value] : fact2.value
  };
}
function copySnapshot(snapshot) {
  return {
    ...snapshot,
    source: { ...snapshot.source },
    capture: { ...snapshot.capture },
    scope: {
      ...snapshot.scope,
      target: copyTarget(snapshot.scope.target),
      limitations: [...snapshot.scope.limitations]
    },
    facts: snapshot.facts.map(copyFact),
    warnings: [...snapshot.warnings]
  };
}
function measurementKey(snapshot) {
  return [
    "local-measured",
    snapshot.source.adapter,
    snapshot.source.adapterVersion,
    snapshot.source.tool,
    snapshot.capture.startedAt,
    snapshot.capture.completedAt,
    targetKey(snapshot.scope.target)
  ].join("|");
}
function availabilitySummary(facts) {
  const summary = {
    available: 0,
    partial: 0,
    unavailable: 0,
    total: facts.length
  };
  for (const fact2 of facts) summary[fact2.availability] += 1;
  return summary;
}
function latestObservedAt(facts) {
  if (facts.length === 0) return null;
  let latest = facts[0].observedAt;
  let latestMs = Date.parse(latest);
  for (let index = 1; index < facts.length; index += 1) {
    const observedMs = Date.parse(facts[index].observedAt);
    if (observedMs > latestMs) {
      latest = facts[index].observedAt;
      latestMs = observedMs;
    }
  }
  return latest;
}
function projectMeasuredSnapshot(value) {
  const parsed = parseNativeMeasurementSnapshot(value);
  const snapshot = copySnapshot(parsed);
  const factsById = {};
  const factIdsByCategory = {
    interface: [],
    route: [],
    dns: [],
    icmp: [],
    traceroute: [],
    transport: [],
    "packet-capture": []
  };
  for (const fact2 of snapshot.facts) {
    factsById[fact2.id] = fact2;
    factIdsByCategory[fact2.category].push(fact2.id);
  }
  return {
    schema: "hopscotch.measured-state",
    version: 1,
    provenance: "LOCAL MEASURED",
    measurementKey: measurementKey(snapshot),
    snapshot,
    factsById,
    factIdsByCategory,
    availability: availabilitySummary(snapshot.facts),
    latestObservedAt: latestObservedAt(snapshot.facts)
  };
}

// ../8f1a24ac8c73/hopscotch/src/measurement/networkDiagnosticsAdapter.ts
var PROFILE_VALUES = /* @__PURE__ */ new Set(["connection-check", "quick", "standard", "extended"]);
var TRANSFER_VALUES = /* @__PURE__ */ new Set(["compare", "single", "aggregate"]);
var KNOWN_ROOT_SECTIONS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "generatedAt",
  "producer",
  "run",
  "transferPlan",
  "internetTransfer",
  "deepDiagnostics",
  "localLink",
  "measurement",
  "findings",
  "browserEvidence",
  "loadLocalization",
  "dualStack",
  "networkChange",
  "hostResources",
  "annotations"
]);
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requiredRecord(value, label) {
  if (!isRecord2(value)) throw new Error(`${label} must be an object.`);
  return value;
}
function optionalRecord(value, label) {
  if (value === void 0 || value === null) return null;
  if (!isRecord2(value)) throw new Error(`${label} must be an object when present.`);
  return value;
}
function requiredString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function optionalString(value, label) {
  if (value === void 0 || value === null) return null;
  return requiredString(value, label);
}
function optionalFiniteNumber(value, label) {
  if (value === void 0 || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number when present.`);
  return value;
}
function optionalBoolean(value, label) {
  if (value === void 0 || value === null) return null;
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean when present.`);
  return value;
}
function optionalArray(value, label) {
  if (value === void 0 || value === null) return null;
  if (!Array.isArray(value)) throw new Error(`${label} must be an array when present.`);
  return value;
}
function parseTimestamp(value, label) {
  const timestamp = requiredString(value, label);
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`${label} must be an ISO-compatible timestamp.`);
  return timestamp;
}
function parseReport(value) {
  const root = requiredRecord(value, "Network Diagnostics report");
  if (root.schemaVersion !== "2.0") throw new Error("Network Diagnostics report schemaVersion must be 2.0.");
  const generatedAt = parseTimestamp(root.generatedAt, "generatedAt");
  const runRecord = requiredRecord(root.run, "run");
  const profile = requiredString(runRecord.profile, "run.profile");
  const transferMethod = requiredString(runRecord.transferMethod, "run.transferMethod");
  if (!PROFILE_VALUES.has(profile)) throw new Error("run.profile is unsupported.");
  if (!TRANSFER_VALUES.has(transferMethod)) throw new Error("run.transferMethod is unsupported.");
  const startedAt = parseTimestamp(runRecord.startedAt, "run.startedAt");
  const completedAt = parseTimestamp(runRecord.completedAt, "run.completedAt");
  if (Date.parse(completedAt) < Date.parse(startedAt)) throw new Error("run.completedAt must not precede run.startedAt.");
  if (Date.parse(generatedAt) < Date.parse(completedAt)) throw new Error("generatedAt must not precede run.completedAt.");
  const includesLocalAddresses = runRecord.includesLocalAddresses === true;
  return {
    root,
    generatedAt,
    producer: optionalRecord(root.producer, "producer"),
    run: {
      id: requiredString(runRecord.id, "run.id"),
      platform: requiredString(runRecord.platform, "run.platform"),
      profile,
      transferMethod,
      startedAt,
      completedAt,
      includesLocalAddresses
    }
  };
}
function platformFor(value) {
  const normalized = value.toLowerCase();
  if (normalized.includes("windows") || normalized.includes("win32")) return "windows";
  if (normalized.includes("mac") || normalized.includes("darwin") || normalized.includes("os x")) return "macos";
  if (normalized.includes("linux")) return "linux";
  return "unknown";
}
function target(kind, value) {
  return value === null ? null : { kind, value };
}
function serviceTarget(value) {
  const service = optionalString(value, "service target");
  return service === null ? null : target("service", service);
}
function fact(id2, category, subject, observedAt, value, unit, note, factTarget = null, availability = "available") {
  return {
    id: id2,
    provenance: "LOCAL MEASURED",
    category,
    subject,
    availability,
    observedAt,
    target: factTarget,
    value,
    unit,
    note
  };
}
function safeIdPart(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "item";
}
function pushNumber(facts, id2, category, subject, observedAt, value, unit, note, factTarget = null, availability = "available") {
  const numberValue = optionalFiniteNumber(value, subject);
  if (numberValue === null) return;
  facts.push(fact(id2, category, subject, observedAt, numberValue, unit, note, factTarget, availability));
}
function pushString(facts, id2, category, subject, observedAt, value, note, factTarget = null, availability = "available") {
  const stringValue = optionalString(value, subject);
  if (stringValue === null) return;
  facts.push(fact(id2, category, subject, observedAt, stringValue, null, note, factTarget, availability));
}
function pushBoolean(facts, id2, category, subject, observedAt, value, note, factTarget = null) {
  const booleanValue = optionalBoolean(value, subject);
  if (booleanValue === null) return;
  facts.push(fact(id2, category, subject, observedAt, booleanValue, null, note, factTarget));
}
function mbpsToBitsPerSecond(value, label) {
  const mbps = optionalFiniteNumber(value, label);
  if (mbps === null) return null;
  if (mbps < 0) throw new Error(`${label} must be non-negative.`);
  return mbps * 1e6;
}
function pushMbps(facts, id2, category, subject, observedAt, value, note, factTarget = null) {
  const bps = mbpsToBitsPerSecond(value, subject);
  if (bps === null) return;
  facts.push(fact(id2, category, subject, observedAt, bps, "bits-per-second", note, factTarget));
}
function mapLatencyStatistics(facts, prefix2, category, statsValue, observedAt, factTarget, notePrefix) {
  if (statsValue === void 0 || statsValue === null) return;
  const stats = requiredRecord(statsValue, `${prefix2} latency statistics`);
  pushNumber(facts, `${prefix2}-sent`, category, `${notePrefix} probes sent`, observedAt, stats.sent, "count", `${notePrefix}: source-reported sent probe count.`, factTarget);
  pushNumber(facts, `${prefix2}-received`, category, `${notePrefix} probes received`, observedAt, stats.received, "count", `${notePrefix}: source-reported received probe count.`, factTarget);
  pushNumber(facts, `${prefix2}-lost`, category, `${notePrefix} probes lost`, observedAt, stats.lost, "count", `${notePrefix}: source-reported lost probe count.`, factTarget);
  pushNumber(facts, `${prefix2}-loss-percent`, category, `${notePrefix} loss percent`, observedAt, stats.lossPercent, "percent", `${notePrefix}: source-reported packet loss percentage.`, factTarget);
  const received = optionalFiniteNumber(stats.received, `${notePrefix} received`);
  const sent = optionalFiniteNumber(stats.sent, `${notePrefix} sent`);
  const availability = received === 0 ? "unavailable" : sent !== null && received !== null && received < sent ? "partial" : "available";
  const latencyFields = [
    ["minimum", "minimum latency", stats.minimumMs ?? stats.minMs],
    ["maximum", "maximum latency", stats.maximumMs ?? stats.maxMs],
    ["mean", "mean latency", stats.meanMs],
    ["median", "median latency", stats.medianMs],
    ["p95", "p95 latency", stats.p95Ms],
    ["jitter", "jitter", stats.jitterMs]
  ];
  if (availability === "unavailable") return;
  for (const [suffix, label, value] of latencyFields) {
    pushNumber(facts, `${prefix2}-${suffix}-ms`, category, `${notePrefix} ${label}`, observedAt, value, "ms", `${notePrefix}: source-reported ${label}.`, factTarget, availability);
  }
}
function mapSelectedInterface(facts, measurement, observedAt, allowAddresses) {
  if (measurement === null) return;
  const selected = optionalRecord(measurement.selectedInterface, "measurement.selectedInterface");
  if (selected === null) return;
  const name = optionalString(selected.name, "measurement.selectedInterface.name");
  const id2 = optionalString(selected.id, "measurement.selectedInterface.id");
  const interfaceTarget = target("interface", id2 ?? name);
  pushString(facts, "selected-interface-name", "interface", "selected interface name", observedAt, selected.name, "Network Diagnostics selected this local interface for the run.", interfaceTarget);
  pushString(facts, "selected-interface-type", "interface", "selected interface type", observedAt, selected.type, "Source-reported local interface type.", interfaceTarget);
  pushString(facts, "selected-interface-binding-scope", "interface", "selected interface binding scope", observedAt, selected.bindingScope, "Source-reported binding scope for the selected interface.", interfaceTarget);
  const linkSpeed = mbpsToBitsPerSecond(selected.linkSpeedMbps, "selected interface link speed");
  if (linkSpeed !== null) facts.push(fact("selected-interface-link-speed", "interface", "selected interface link speed", observedAt, linkSpeed, "bits-per-second", "Exact conversion from the source-reported Mbps link speed.", interfaceTarget));
  if (allowAddresses) pushString(facts, "selected-interface-source-address", "interface", "selected interface source address", observedAt, selected.sourceAddress, "Local source address included only because the report explicitly permits local addresses.", interfaceTarget);
}
function mapDeepInterfaces(facts, deep, observedAt, allowAddresses) {
  if (deep === null) return;
  const interfaces = optionalArray(deep.interfaces, "deepDiagnostics.interfaces");
  if (interfaces === null) return;
  interfaces.forEach((entry, index) => {
    const current = requiredRecord(entry, `deepDiagnostics.interfaces[${index}]`);
    const name = requiredString(current.name, `deepDiagnostics.interfaces[${index}].name`);
    const key2 = `deep-interface-${index}-${safeIdPart(name)}`;
    const interfaceTarget = target("interface", name);
    pushString(facts, `${key2}-type`, "interface", `${name} interface type`, observedAt, current.type, "Source-reported local interface type.", interfaceTarget);
    pushBoolean(facts, `${key2}-ipv4`, "interface", `${name} supports IPv4`, observedAt, current.supportsIpv4, "Source-reported address-family capability.", interfaceTarget);
    pushBoolean(facts, `${key2}-ipv6`, "interface", `${name} supports IPv6`, observedAt, current.supportsIpv6, "Source-reported address-family capability.", interfaceTarget);
    pushMbps(facts, `${key2}-link-speed`, "interface", `${name} link speed`, observedAt, current.linkSpeedMbps, "Exact conversion from source-reported Mbps.", interfaceTarget);
    pushNumber(facts, `${key2}-ipv4-mtu`, "interface", `${name} IPv4 MTU`, observedAt, current.ipv4Mtu, "bytes", "Source-reported IPv4 interface MTU.", interfaceTarget);
    if (!allowAddresses) return;
    for (const [fieldName, subject] of [["unicastAddresses", "unicast addresses"], ["gateways", "gateway addresses"], ["dnsServers", "DNS server addresses"]]) {
      const values = optionalArray(current[fieldName], `${name} ${fieldName}`);
      if (values === null) continue;
      const strings = values.map((value, itemIndex) => requiredString(value, `${name} ${fieldName}[${itemIndex}]`));
      facts.push(fact(`${key2}-${safeIdPart(fieldName)}`, "interface", `${name} ${subject}`, observedAt, strings, null, "Local address list included only because the report explicitly permits local addresses.", interfaceTarget));
    }
  });
}
function mapRouting(facts, deep, observedAt, allowAddresses) {
  if (deep === null) return;
  const routing3 = optionalRecord(deep.routing, "deepDiagnostics.routing");
  if (routing3 === null) return;
  const status = requiredString(routing3.status, "deepDiagnostics.routing.status");
  if (status.toLowerCase() === "unavailable") {
    facts.push(fact("routing-availability", "route", "local routing table availability", observedAt, null, null, "Network Diagnostics explicitly reported routing details unavailable.", null, "unavailable"));
    return;
  }
  facts.push(fact("routing-availability", "route", "local routing table availability", observedAt, status, null, "Source-reported routing detail status."));
  const entries = optionalArray(routing3.entries, "deepDiagnostics.routing.entries") ?? [];
  entries.forEach((entry, index) => {
    const route = requiredRecord(entry, `deepDiagnostics.routing.entries[${index}]`);
    const destination = requiredString(route.destination, `deepDiagnostics.routing.entries[${index}].destination`);
    const disclosedDestination = allowAddresses ? destination : null;
    const routeLabel = disclosedDestination ?? `entry ${index + 1}`;
    const routeTarget = target("prefix", disclosedDestination);
    const prefix2 = allowAddresses ? `route-${index}-${safeIdPart(destination)}` : `route-${index}`;
    pushString(facts, `${prefix2}-family`, "route", `route ${routeLabel} address family`, observedAt, route.addressFamily, "Source-reported local route address family.", routeTarget);
    pushBoolean(facts, `${prefix2}-default`, "route", `route ${routeLabel} is default`, observedAt, route.isDefault, "Source-reported default-route flag.", routeTarget);
    pushNumber(facts, `${prefix2}-metric`, "route", `route ${routeLabel} metric`, observedAt, route.metric, "count", "Source-reported local route metric; no cross-platform metric equivalence is implied.", routeTarget);
    pushString(facts, `${prefix2}-interface`, "route", `route ${routeLabel} interface`, observedAt, route.interfaceName, "Source-reported egress interface for this local route.", routeTarget);
    if (allowAddresses) pushString(facts, `${prefix2}-gateway`, "route", `route ${routeLabel} gateway`, observedAt, route.gateway, "Local gateway address included only because the report explicitly permits local addresses.", routeTarget);
  });
}
function mapPingTarget(facts, prefix2, category, value, observedAt, allowAddresses) {
  if (value === void 0 || value === null) return;
  const ping = requiredRecord(value, prefix2);
  const label = requiredString(ping.label, `${prefix2}.label`);
  const address2 = allowAddresses ? optionalString(ping.address, `${prefix2}.address`) : null;
  const pingTarget = address2 === null ? null : target("ip", address2);
  mapLatencyStatistics(facts, prefix2, category, ping.statistics, observedAt, pingTarget, label);
}
function mapTraceroute(facts, deep, observedAt, allowAddresses) {
  if (deep === null) return;
  const trace2 = optionalRecord(deep.traceRoute, "deepDiagnostics.traceRoute");
  if (trace2 === null) return;
  const traceTargetText = requiredString(trace2.target, "deepDiagnostics.traceRoute.target");
  const traceTarget = target("hostname", traceTargetText);
  pushNumber(facts, "trace-maximum-hops", "traceroute", "traceroute maximum hops", observedAt, trace2.maximumHops, "hops", "Source-configured traceroute hop ceiling.", traceTarget);
  pushBoolean(facts, "trace-reached-destination", "traceroute", "traceroute reached destination", observedAt, trace2.reachedDestination, "Source-reported traceroute destination reachability.", traceTarget);
  const hops = optionalArray(trace2.hops, "deepDiagnostics.traceRoute.hops") ?? [];
  hops.forEach((entry, index) => {
    const hop = requiredRecord(entry, `deepDiagnostics.traceRoute.hops[${index}]`);
    const hopNumber = optionalFiniteNumber(hop.hop, `trace hop ${index} number`) ?? index + 1;
    const prefix2 = `trace-hop-${safeIdPart(String(hopNumber))}`;
    pushNumber(facts, `${prefix2}-number`, "traceroute", `traceroute hop ${hopNumber} index`, observedAt, hopNumber, "hops", "Source-reported traceroute hop index.", traceTarget);
    pushBoolean(facts, `${prefix2}-destination`, "traceroute", `traceroute hop ${hopNumber} reached destination`, observedAt, hop.reachedDestination, "Source-reported destination flag for this hop.", traceTarget);
    if (allowAddresses && hop.addressRedacted !== true) {
      pushString(facts, `${prefix2}-address`, "traceroute", `traceroute hop ${hopNumber} address`, observedAt, hop.address, "Observed hop address included only because local addresses are explicitly permitted and this hop is not marked redacted.", traceTarget);
      pushString(facts, `${prefix2}-hostname`, "traceroute", `traceroute hop ${hopNumber} hostname`, observedAt, hop.hostname, "Observed hop hostname included under the report local-address disclosure policy.", traceTarget);
    }
    const roundTrips = optionalArray(hop.roundTripsMs, `traceroute hop ${hopNumber} roundTripsMs`) ?? [];
    roundTrips.forEach((sample, sampleIndex) => {
      if (sample === null) return;
      pushNumber(facts, `${prefix2}-rtt-${sampleIndex + 1}`, "traceroute", `traceroute hop ${hopNumber} RTT sample ${sampleIndex + 1}`, observedAt, sample, "ms", "One source-reported traceroute round-trip sample; no path symmetry is implied.", traceTarget);
    });
  });
}
function mapDns(facts, deep, observedAt, allowAddresses) {
  if (deep === null) return;
  const resolvers = optionalArray(deep.dnsResolvers, "deepDiagnostics.dnsResolvers");
  if (resolvers === null) return;
  resolvers.forEach((entry, index) => {
    const resolver = requiredRecord(entry, `deepDiagnostics.dnsResolvers[${index}]`);
    const name = requiredString(resolver.name, `deepDiagnostics.dnsResolvers[${index}].name`);
    const address2 = allowAddresses ? optionalString(resolver.address, `deepDiagnostics.dnsResolvers[${index}].address`) : null;
    const resolverTarget = address2 === null ? null : target("ip", address2);
    const prefix2 = `dns-resolver-${index}-${safeIdPart(name)}`;
    const attempts = optionalFiniteNumber(resolver.attempts, `${name} attempts`);
    const successful = optionalFiniteNumber(resolver.successful, `${name} successful`);
    pushNumber(facts, `${prefix2}-attempts`, "dns", `${name} DNS attempts`, observedAt, resolver.attempts, "count", "Source-reported DNS query attempt count.", resolverTarget);
    pushNumber(facts, `${prefix2}-successful`, "dns", `${name} DNS successful attempts`, observedAt, resolver.successful, "count", "Source-reported successful DNS query count.", resolverTarget);
    const availability = successful === 0 ? "unavailable" : attempts !== null && successful !== null && successful < attempts ? "partial" : "available";
    if (availability !== "unavailable") {
      for (const [suffix, label, value] of [
        ["minimum", "minimum DNS latency", resolver.minimumMs],
        ["median", "median DNS latency", resolver.medianMs],
        ["p95", "p95 DNS latency", resolver.p95Ms],
        ["maximum", "maximum DNS latency", resolver.maximumMs]
      ]) pushNumber(facts, `${prefix2}-${suffix}-ms`, "dns", `${name} ${label}`, observedAt, value, "ms", `Source-reported ${label}.`, resolverTarget, availability);
    }
  });
}
function mapServices(facts, deep, observedAt) {
  if (deep === null) return;
  const endpoints2 = optionalArray(deep.serviceEndpoints, "deepDiagnostics.serviceEndpoints");
  if (endpoints2 === null) return;
  endpoints2.forEach((entry, index) => {
    const endpoint = requiredRecord(entry, `deepDiagnostics.serviceEndpoints[${index}]`);
    const host = requiredString(endpoint.host, `deepDiagnostics.serviceEndpoints[${index}].host`);
    const name = requiredString(endpoint.name, `deepDiagnostics.serviceEndpoints[${index}].name`);
    const endpointTarget = target("service", host);
    const prefix2 = `service-${index}-${safeIdPart(name)}`;
    pushBoolean(facts, `${prefix2}-reachable`, "transport", `${name} service reachable`, observedAt, endpoint.reachable, "Source-reported end-to-end service reachability.", endpointTarget);
    pushNumber(facts, `${prefix2}-dns-ms`, "dns", `${name} DNS duration`, observedAt, endpoint.dnsMs, "ms", "Source-reported DNS phase duration for this service check.", endpointTarget);
    pushNumber(facts, `${prefix2}-tcp-ms`, "transport", `${name} TCP connect duration`, observedAt, endpoint.tcpMs, "ms", "Source-reported TCP connect duration for this service check.", endpointTarget);
    pushNumber(facts, `${prefix2}-tls-ms`, "transport", `${name} TLS handshake duration`, observedAt, endpoint.tlsMs, "ms", "Source-reported TLS handshake duration for this service check.", endpointTarget);
    pushString(facts, `${prefix2}-tls-protocol`, "transport", `${name} TLS protocol`, observedAt, endpoint.tlsProtocol, "Source-reported TLS protocol for this service check.", endpointTarget);
    pushString(facts, `${prefix2}-application-protocol`, "transport", `${name} application protocol`, observedAt, endpoint.applicationProtocol, "Source-reported negotiated application protocol.", endpointTarget);
  });
}
function mapThroughputSummary(facts, prefix2, label, value, observedAt, factTarget) {
  if (value === void 0 || value === null) return;
  const summary = requiredRecord(value, label);
  pushMbps(facts, `${prefix2}-mbps`, "transport", `${label} throughput`, observedAt, summary.mbps, "Exact conversion from source-reported Mbps.", factTarget);
  pushMbps(facts, `${prefix2}-steady-mbps`, "transport", `${label} steady throughput`, observedAt, summary.steadyMbps, "Exact conversion from source-reported steady Mbps.", factTarget);
  pushMbps(facts, `${prefix2}-peak-mbps`, "transport", `${label} peak throughput`, observedAt, summary.peakMbps, "Exact conversion from source-reported peak Mbps.", factTarget);
  pushNumber(facts, `${prefix2}-bytes`, "transport", `${label} bytes`, observedAt, summary.bytes, "bytes", "Source-reported transferred byte count.", factTarget);
  pushNumber(facts, `${prefix2}-duration`, "transport", `${label} duration`, observedAt, summary.durationMs, "ms", "Source-reported transfer duration.", factTarget);
  pushNumber(facts, `${prefix2}-stability`, "transport", `${label} stability`, observedAt, summary.stabilityPercent, "percent", "Source-reported throughput stability percentage.", factTarget);
  pushBoolean(facts, `${prefix2}-cap-reached`, "transport", `${label} transfer cap reached`, observedAt, summary.capReached, "Source-reported transfer-cap status.", factTarget);
  pushString(facts, `${prefix2}-qualification`, "transport", `${label} qualification`, observedAt, summary.qualification, "Source-reported throughput qualification.", factTarget);
}
function mapLoadedLatency(facts, prefix2, label, value, observedAt, factTarget) {
  if (value === void 0 || value === null) return;
  const loaded = requiredRecord(value, label);
  mapLatencyStatistics(facts, `${prefix2}-stats`, "transport", loaded.statistics, observedAt, factTarget, label);
  pushNumber(facts, `${prefix2}-increase-ms`, "transport", `${label} latency increase`, observedAt, loaded.increaseMs, "ms", "Source-reported increase over idle latency.", factTarget);
  pushString(facts, `${prefix2}-grade`, "transport", `${label} grade`, observedAt, loaded.grade, "Source-reported loaded-latency grade.", factTarget);
}
function mapInternetTransfer(facts, value, observedAt) {
  if (value === void 0 || value === null) return;
  const transfer = requiredRecord(value, "internetTransfer");
  const origin = requiredString(transfer.origin, "internetTransfer.origin");
  const transferTarget = serviceTarget(origin);
  mapLatencyStatistics(facts, "internet-idle", "transport", transfer.idleLatency, observedAt, transferTarget, "Internet transfer idle latency");
  mapThroughputSummary(facts, "internet-download", "Internet download", transfer.download, observedAt, transferTarget);
  mapThroughputSummary(facts, "internet-upload", "Internet upload", transfer.upload, observedAt, transferTarget);
  mapLoadedLatency(facts, "internet-download-loaded", "Internet download loaded latency", transfer.downloadLatency, observedAt, transferTarget);
  mapLoadedLatency(facts, "internet-upload-loaded", "Internet upload loaded latency", transfer.uploadLatency, observedAt, transferTarget);
  pushNumber(facts, "internet-data-used", "transport", "Internet transfer data used", observedAt, transfer.dataUsedBytes, "bytes", "Source-reported total data usage for the transfer run.", transferTarget);
}
function mapLocalLink(facts, value, observedAt, allowAddresses) {
  if (value === void 0 || value === null) return;
  const link = requiredRecord(value, "localLink");
  const targetName = requiredString(link.target, "localLink.target");
  const port = optionalFiniteNumber(link.port, "localLink.port");
  const linkTarget = allowAddresses ? target("service", port === null ? targetName : `${targetName}:${port}`) : null;
  mapLatencyStatistics(facts, "local-link-latency", "transport", link.latency, observedAt, linkTarget, "Local-link latency");
  pushMbps(facts, "local-link-download", "transport", "local-link download throughput", observedAt, link.downloadMbps, "Exact conversion from source-reported Mbps.", linkTarget);
  pushNumber(facts, "local-link-download-bytes", "transport", "local-link download bytes", observedAt, link.downloadBytes, "bytes", "Source-reported local-link download bytes.", linkTarget);
  pushMbps(facts, "local-link-upload", "transport", "local-link upload throughput", observedAt, link.uploadMbps, "Exact conversion from source-reported Mbps.", linkTarget);
  pushNumber(facts, "local-link-upload-bytes", "transport", "local-link upload bytes", observedAt, link.uploadBytes, "bytes", "Source-reported local-link upload bytes.", linkTarget);
}
function mapAddressFamily(facts, familyLabel, value, observedAt) {
  const probe2 = requiredRecord(value, `${familyLabel} dual-stack probe`);
  const address2 = optionalString(probe2.address, `${familyLabel} address`);
  const probeTarget = address2 === null ? null : target("ip", address2);
  const prefix2 = `dual-${familyLabel.toLowerCase()}`;
  pushBoolean(facts, `${prefix2}-address-available`, "route", `${familyLabel} destination address available`, observedAt, probe2.addressAvailable, "Source-reported destination address-family availability.", probeTarget);
  pushBoolean(facts, `${prefix2}-ping-available`, "icmp", `${familyLabel} ping available`, observedAt, probe2.pingAvailable, "Source-reported ICMP reachability for this address family.", probeTarget);
  pushNumber(facts, `${prefix2}-ping-median`, "icmp", `${familyLabel} ping median`, observedAt, probe2.pingMedianMs, "ms", "Source-reported median ping latency.", probeTarget);
  pushBoolean(facts, `${prefix2}-tcp-reachable`, "transport", `${familyLabel} TCP reachable`, observedAt, probe2.tcpReachable, "Source-reported TCP reachability.", probeTarget);
  pushNumber(facts, `${prefix2}-tcp-connect`, "transport", `${familyLabel} TCP connect duration`, observedAt, probe2.tcpConnectMs, "ms", "Source-reported TCP connect duration.", probeTarget);
  pushBoolean(facts, `${prefix2}-tls-reachable`, "transport", `${familyLabel} TLS reachable`, observedAt, probe2.tlsReachable, "Source-reported TLS reachability.", probeTarget);
  pushNumber(facts, `${prefix2}-tls-handshake`, "transport", `${familyLabel} TLS handshake duration`, observedAt, probe2.tlsHandshakeMs, "ms", "Source-reported TLS handshake duration.", probeTarget);
  pushString(facts, `${prefix2}-tls-protocol`, "transport", `${familyLabel} TLS protocol`, observedAt, probe2.tlsProtocol, "Source-reported TLS protocol.", probeTarget);
  pushString(facts, `${prefix2}-application-protocol`, "transport", `${familyLabel} application protocol`, observedAt, probe2.applicationProtocol, "Source-reported application protocol.", probeTarget);
  pushBoolean(facts, `${prefix2}-http-reachable`, "transport", `${familyLabel} HTTP reachable`, observedAt, probe2.httpReachable, "Source-reported HTTP reachability.", probeTarget);
  pushNumber(facts, `${prefix2}-http-response`, "transport", `${familyLabel} HTTP response duration`, observedAt, probe2.httpResponseMs, "ms", "Source-reported HTTP response duration.", probeTarget);
  pushNumber(facts, `${prefix2}-http-status`, "transport", `${familyLabel} HTTP status code`, observedAt, probe2.httpStatusCode, "count", "Source-reported HTTP status code represented as a scalar diagnostic value.", probeTarget);
}
function mapDualStack(facts, value, observedAt) {
  if (value === void 0 || value === null) return;
  const dual = requiredRecord(value, "dualStack");
  mapAddressFamily(facts, "IPv4", dual.ipv4, observedAt);
  mapAddressFamily(facts, "IPv6", dual.ipv6, observedAt);
  pushString(facts, "dual-preferred-family", "route", "preferred address family", observedAt, dual.preferredFamily, "Source-reported address-family preference for this run.");
  pushBoolean(facts, "dual-nat64-suspected", "route", "NAT64 suspected", observedAt, dual.nat64Suspected, "Source-reported NAT64 suspicion flag; this is not a global topology claim.");
  pushNumber(facts, "dual-dns-resolution", "dns", "dual-stack DNS resolution duration", observedAt, dual.dnsResolutionMs, "ms", "Source-reported dual-stack DNS resolution duration.");
  pushNumber(facts, "dual-ipv4-address-count", "dns", "IPv4 destination address count", observedAt, dual.ipv4AddressCount, "count", "Source-reported resolved IPv4 address count.");
  pushNumber(facts, "dual-ipv6-address-count", "dns", "IPv6 destination address count", observedAt, dual.ipv6AddressCount, "count", "Source-reported resolved IPv6 address count.");
  pushString(facts, "dual-parallel-winner", "transport", "parallel connect winner", observedAt, dual.parallelConnectWinner, "Source-reported address-family winner for the parallel connection attempt.");
  pushNumber(facts, "dual-parallel-difference", "transport", "parallel connect difference", observedAt, dual.parallelConnectDifferenceMs, "ms", "Source-reported timing difference between parallel address-family connection attempts.");
}
function collectSkippedSections(report) {
  const skipped = [];
  const root = report.root;
  const explicitNonMeasured = [
    ["browserEvidence", "browserEvidence is browser/edge evidence, not LOCAL MEASURED"],
    ["findings", "findings are derived diagnostic conclusions, not direct measurements"],
    ["loadLocalization", "loadLocalization is a derived localization conclusion"],
    ["hostResources", "hostResources is outside the current 09A network measurement categories"],
    ["annotations", "annotations are user/report metadata, not measurements"]
  ];
  for (const [key2, reason] of explicitNonMeasured) if (root[key2] !== void 0 && root[key2] !== null) skipped.push(`${key2}: ${reason}`);
  const networkChange = optionalRecord(root.networkChange, "networkChange");
  if (networkChange?.publicNetworkBefore !== void 0 || networkChange?.publicNetworkAfter !== void 0) skipped.push("networkChange.publicNetwork*: public network context is not LOCAL MEASURED");
  const measurement = optionalRecord(root.measurement, "measurement");
  if (measurement?.network !== void 0) skipped.push("measurement.network: edge/public network metadata is not LOCAL MEASURED");
  if (measurement?.http3 !== void 0) skipped.push("measurement.http3: browser HTTP/3 evidence is not LOCAL MEASURED");
  const unknownKeys = Object.keys(root).filter((key2) => !KNOWN_ROOT_SECTIONS.has(key2));
  if (unknownKeys.length > 0) skipped.push(`unknown root fields ignored: ${unknownKeys.sort().join(", ")}`);
  return skipped;
}
function localAddressDisclosure(report, deep) {
  if (!report.run.includesLocalAddresses) return false;
  if (deep === null || deep.includesLocalAddresses === void 0) return true;
  return deep.includesLocalAddresses === true;
}
function adaptNetworkDiagnosticsReportV2(value) {
  const report = parseReport(value);
  const observedAt = report.run.completedAt;
  const facts = [];
  const measurement = optionalRecord(report.root.measurement, "measurement");
  const deep = optionalRecord(report.root.deepDiagnostics, "deepDiagnostics");
  const allowLocalAddresses = localAddressDisclosure(report, deep);
  const skipped = collectSkippedSections(report);
  mapSelectedInterface(facts, measurement, observedAt, allowLocalAddresses);
  mapDeepInterfaces(facts, deep, observedAt, allowLocalAddresses);
  mapRouting(facts, deep, observedAt, allowLocalAddresses);
  if (deep !== null) {
    mapPingTarget(facts, "gateway-ping", "icmp", deep.gatewayPing, observedAt, allowLocalAddresses);
    mapPingTarget(facts, "internet-ping", "icmp", deep.internetPing, observedAt, true);
  }
  mapTraceroute(facts, deep, observedAt, allowLocalAddresses);
  mapDns(facts, deep, observedAt, allowLocalAddresses);
  mapServices(facts, deep, observedAt);
  mapInternetTransfer(facts, report.root.internetTransfer, observedAt);
  mapLocalLink(facts, report.root.localLink, observedAt, allowLocalAddresses);
  mapDualStack(facts, report.root.dualStack, observedAt);
  const producerVersion = report.producer === null ? null : optionalString(report.producer.version, "producer.version");
  const producerEngine = report.producer === null ? null : optionalString(report.producer.engine, "producer.engine");
  const warnings = [
    "Imported from Network Diagnostics Suite report schema 2.0. This snapshot describes one local run and is not globally complete.",
    "The combined report is multi-target; snapshot-level target is intentionally null and target scope is carried per measured fact.",
    "Report v2 does not timestamp every metric individually; mapped facts use run.completedAt as the bounded observation timestamp.",
    "Absent optional report sections are omitted rather than fabricated as unavailable measurements.",
    "Only whitelisted direct/local measurement fields are mapped; public, browser, inferred, derived, and unknown fields are not promoted to LOCAL MEASURED.",
    ...allowLocalAddresses ? [] : ["Local address-valued facts are withheld because the report does not explicitly permit local-address disclosure."],
    ...skipped
  ];
  const candidate = {
    schema: "hopscotch.native-measurement",
    version: 1,
    provenance: "LOCAL MEASURED",
    generatedAt: report.generatedAt,
    source: {
      adapter: "network-diagnostics-suite-report-v2",
      adapterVersion: "1",
      platform: platformFor(report.run.platform),
      tool: producerEngine ?? "Network Diagnostics Suite",
      toolVersion: producerVersion
    },
    capture: {
      startedAt: report.run.startedAt,
      completedAt: report.run.completedAt
    },
    scope: {
      vantage: "local-host",
      completeness: "bounded",
      globalComplete: false,
      target: null,
      limitations: warnings.slice(0, 6)
    },
    facts,
    warnings
  };
  return parseNativeMeasurementSnapshot(candidate);
}

// ../8f1a24ac8c73/hopscotch/scripts/capture-fixtures.mjs
function bytes(value) {
  return value instanceof Uint8Array ? value : Uint8Array.from(value);
}
function concatBytes(...parts) {
  const normalized = parts.flat().map(bytes);
  const result = new Uint8Array(normalized.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of normalized) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
function u16(value, order = "big") {
  return order === "big" ? Uint8Array.of(value >>> 8 & 255, value & 255) : Uint8Array.of(value & 255, value >>> 8 & 255);
}
function u32(value, order = "big") {
  const unsigned = Number(value) >>> 0;
  return order === "big" ? Uint8Array.of(unsigned >>> 24 & 255, unsigned >>> 16 & 255, unsigned >>> 8 & 255, unsigned & 255) : Uint8Array.of(unsigned & 255, unsigned >>> 8 & 255, unsigned >>> 16 & 255, unsigned >>> 24 & 255);
}
function ipv4Address(value) {
  return Uint8Array.from(value.split(".").map(Number));
}
function checksum162(input2) {
  const data2 = bytes(input2);
  let sum = 0;
  for (let index = 0; index < data2.length; index += 2) {
    sum += data2[index] << 8 | (data2[index + 1] ?? 0);
    sum = (sum & 65535) + (sum >>> 16);
  }
  while (sum >>> 16) sum = (sum & 65535) + (sum >>> 16);
  return ~sum & 65535;
}
function ethernetFrame(payload, {
  etherType = 2048,
  source = [2, 0, 0, 0, 0, 1],
  destination = [2, 0, 0, 0, 0, 2],
  vlanTags = []
} = {}) {
  const header = [bytes(destination), bytes(source)];
  for (const [index, vlan] of vlanTags.entries()) {
    header.push(u16(index === 0 ? 33024 : 34984), u16(vlan & 4095));
  }
  header.push(u16(etherType));
  return concatBytes(header, payload);
}
function ipv4Packet(payload, {
  source = "192.0.2.10",
  destination = "198.51.100.42",
  protocol = 6,
  ttl = 64,
  identification = 4660,
  flagsFragment = 16384,
  ihlWords = 5,
  totalLength = null
} = {}) {
  const headerLength = ihlWords * 4;
  const header = new Uint8Array(Math.max(20, headerLength));
  header[0] = 4 << 4 | ihlWords;
  header.set(u16(totalLength ?? headerLength + payload.length), 2);
  header.set(u16(identification), 4);
  header.set(u16(flagsFragment), 6);
  header[8] = ttl;
  header[9] = protocol;
  header.set(ipv4Address(source), 12);
  header.set(ipv4Address(destination), 16);
  if (headerLength >= 20) header.set(u16(checksum162(header.subarray(0, headerLength))), 10);
  return concatBytes(header.subarray(0, headerLength), payload);
}
function tcpSegment(payload = new Uint8Array(), {
  sourcePort = 5e4,
  destinationPort = 443,
  sequence = 1e3,
  acknowledgment = 0,
  flags = 2,
  window: window2 = 64240,
  options: options2 = new Uint8Array(),
  dataOffsetWords = null
} = {}) {
  const paddedOptions = options2.length % 4 === 0 ? bytes(options2) : concatBytes(options2, new Uint8Array(4 - options2.length % 4));
  const headerLength = 20 + paddedOptions.length;
  const dataOffset = dataOffsetWords ?? headerLength / 4;
  return concatBytes(
    u16(sourcePort),
    u16(destinationPort),
    u32(sequence),
    u32(acknowledgment),
    Uint8Array.of(dataOffset << 4 & 240, flags & 255),
    u16(window2),
    u16(0),
    u16(0),
    paddedOptions,
    payload
  );
}
function udpDatagram(payload, { sourcePort = 53e3, destinationPort = 53, length = null } = {}) {
  return concatBytes(u16(sourcePort), u16(destinationPort), u16(length ?? 8 + payload.length), u16(0), payload);
}
function pcapCapture(frames, { order = "little", nanoseconds = false, linkType = 1, snapLength = 262144 } = {}) {
  const magic = order === "little" ? nanoseconds ? Uint8Array.of(77, 60, 178, 161) : Uint8Array.of(212, 195, 178, 161) : nanoseconds ? Uint8Array.of(161, 178, 60, 77) : Uint8Array.of(161, 178, 195, 212);
  const global = concatBytes(magic, u16(2, order), u16(4, order), u32(0, order), u32(0, order), u32(snapLength, order), u32(linkType, order));
  const records = frames.map((frame, index) => {
    const data2 = bytes(frame.bytes);
    return concatBytes(
      u32(frame.seconds ?? 17e8, order),
      u32(frame.fraction ?? index * (nanoseconds ? 1e6 : 1e3), order),
      u32(frame.capturedLength ?? data2.length, order),
      u32(frame.originalLength ?? data2.length, order),
      data2
    );
  });
  return concatBytes(global, records);
}
function pad32(data2) {
  const value = bytes(data2);
  return value.length % 4 === 0 ? value : concatBytes(value, new Uint8Array(4 - value.length % 4));
}
function pcapngOption(code, data2, order) {
  const value = bytes(data2);
  return concatBytes(u16(code, order), u16(value.length, order), pad32(value));
}
function pcapngBlock(type, body, order) {
  const paddedBody = pad32(body);
  const length = 12 + paddedBody.length;
  return concatBytes(u32(type, order), u32(length, order), paddedBody, u32(length, order));
}
function pcapngSection({ order = "little", interfaces = [{ linkType: 1, snapLength: 262144, tsresol: 9 }], packets = [], includeUnknownBlock = false } = {}) {
  const sectionBody = concatBytes(u32(439041101, order), u16(1, order), u16(0, order), new Uint8Array(8).fill(255));
  const section2 = pcapngBlock(168627466, sectionBody, order);
  const idbs = interfaces.map((record) => {
    const options2 = record.tsresol === void 0 ? new Uint8Array() : concatBytes(pcapngOption(9, Uint8Array.of(record.tsresol), order), pcapngOption(0, new Uint8Array(), order));
    return pcapngBlock(1, concatBytes(u16(record.linkType ?? 1, order), u16(0, order), u32(record.snapLength ?? 262144, order), options2), order);
  });
  const unknown = includeUnknownBlock ? [pcapngBlock(2989, Uint8Array.of(1, 2, 3, 4), order)] : [];
  const epbs = packets.map((packet2, index) => {
    const data2 = bytes(packet2.bytes);
    const ticks = BigInt(packet2.ticks ?? 1700000000000000000n + BigInt(index * 1e6));
    const high = Number(ticks >> 32n & 0xffffffffn);
    const low = Number(ticks & 0xffffffffn);
    const packetOptions = pcapngOption(0, new Uint8Array(), order);
    return pcapngBlock(6, concatBytes(
      u32(packet2.interfaceId ?? 0, order),
      u32(high, order),
      u32(low, order),
      u32(packet2.capturedLength ?? data2.length, order),
      u32(packet2.originalLength ?? data2.length, order),
      pad32(data2),
      packetOptions
    ), order);
  });
  return concatBytes(section2, idbs, unknown, epbs);
}
function tcpIpv4Frame(payload = new Uint8Array(), options2 = {}) {
  const segment = tcpSegment(payload, options2);
  return ethernetFrame(ipv4Packet(segment, {
    source: options2.sourceAddress ?? "192.0.2.10",
    destination: options2.destinationAddress ?? "198.51.100.42",
    protocol: 6,
    identification: options2.identification ?? 4660
  }), { vlanTags: options2.vlanTags ?? [] });
}
function udpIpv4Frame(payload, options2 = {}) {
  const datagram = udpDatagram(payload, options2);
  return ethernetFrame(ipv4Packet(datagram, {
    source: options2.sourceAddress ?? "192.0.2.53",
    destination: options2.destinationAddress ?? "198.51.100.9",
    protocol: 17
  }));
}

// ../8f1a24ac8c73/hopscotch/src/capture/bytes.ts
var CaptureParseError = class extends Error {
  code;
  offset;
  constructor(code, message, offset = null) {
    super(offset === null ? message : `${message} (byte ${offset})`);
    this.name = "CaptureParseError";
    this.code = code;
    this.offset = offset;
  }
};
var ImmutableBytes = class _ImmutableBytes {
  #buffer;
  #start;
  length;
  constructor(buffer, start, length) {
    this.#buffer = buffer;
    this.#start = start;
    this.length = length;
    Object.freeze(this);
  }
  static copyOf(input2) {
    const source = input2 instanceof Uint8Array ? input2 : ArrayBuffer.isView(input2) ? new Uint8Array(input2.buffer, input2.byteOffset, input2.byteLength) : new Uint8Array(input2);
    const owned = new Uint8Array(source.length);
    owned.set(source);
    return new _ImmutableBytes(owned, 0, owned.length);
  }
  view(offset, length = this.length - offset) {
    this.assertRange(offset, length);
    return new _ImmutableBytes(this.#buffer, this.#start + offset, length);
  }
  at(offset) {
    this.assertRange(offset, 1);
    return this.#buffer[this.#start + offset];
  }
  readUint16(offset, order) {
    this.assertRange(offset, 2);
    const a = this.at(offset);
    const b = this.at(offset + 1);
    return order === "big" ? a * 256 + b : b * 256 + a;
  }
  readUint24BE(offset) {
    this.assertRange(offset, 3);
    return this.at(offset) * 65536 + this.at(offset + 1) * 256 + this.at(offset + 2);
  }
  readUint32(offset, order) {
    this.assertRange(offset, 4);
    const a = this.at(offset);
    const b = this.at(offset + 1);
    const c = this.at(offset + 2);
    const d = this.at(offset + 3);
    return order === "big" ? a * 16777216 + b * 65536 + c * 256 + d >>> 0 : d * 16777216 + c * 65536 + b * 256 + a >>> 0;
  }
  readBigUint64(offset, order) {
    this.assertRange(offset, 8);
    if (order === "big") {
      return BigInt(this.readUint32(offset, "big")) << 32n | BigInt(this.readUint32(offset + 4, "big"));
    }
    return BigInt(this.readUint32(offset + 4, "little")) << 32n | BigInt(this.readUint32(offset, "little"));
  }
  copy(offset = 0, length = this.length - offset) {
    this.assertRange(offset, length);
    return this.#buffer.slice(this.#start + offset, this.#start + offset + length);
  }
  hex(offset = 0, length = this.length - offset) {
    this.assertRange(offset, length);
    const parts = [];
    for (let index = 0; index < length; index += 1) {
      parts.push(this.at(offset + index).toString(16).padStart(2, "0").toUpperCase());
    }
    return parts.join(" ");
  }
  deterministicFingerprint() {
    let hashA = 2166136261;
    let hashB = (2654435769 ^ this.length) >>> 0;
    for (let index = 0; index < this.length; index += 1) {
      const byte = this.#buffer[this.#start + index];
      hashA = Math.imul(hashA ^ byte, 16777619) >>> 0;
      hashB = Math.imul((hashB ^ byte ^ index & 255) >>> 0, 2246822507) >>> 0;
      hashB = (hashB ^ hashB >>> 13) >>> 0;
    }
    return `${hashA.toString(16).padStart(8, "0")}${hashB.toString(16).padStart(8, "0")}`;
  }
  assertRange(offset, length) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset > this.length || length > this.length - offset) {
      throw new CaptureParseError("TRUNCATED_INPUT", `Byte range ${offset}+${length} exceeds ${this.length}`, Math.max(0, offset));
    }
  }
};
function deepFreeze(value) {
  if (value === null || typeof value !== "object" || value instanceof ImmutableBytes || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach((entry) => deepFreeze(entry));
  } else {
    Object.values(value).forEach((entry) => deepFreeze(entry));
  }
  return Object.freeze(value);
}
function assertCapturedRange(containerLength, offset, length, label) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset > containerLength || length > containerLength - offset) {
    throw new CaptureParseError("MALFORMED_PROTOCOL", `${label} exceeds the captured frame`, Math.max(0, offset));
  }
}

// ../8f1a24ac8c73/hopscotch/src/capture/types.ts
var CAPTURE_LIMITS = Object.freeze({
  maxCaptureBytes: 64 * 1024 * 1024,
  maxFrames: 1e5,
  maxSemanticEvents: 5e5,
  maxFrameBytes: 16 * 1024 * 1024,
  maxPcapngBlockBytes: 32 * 1024 * 1024,
  maxPcapngBlocks: 25e4,
  maxPcapngInterfaces: 4096,
  maxIpv6ExtensionHeaders: 16,
  maxIpv6ExtensionBytes: 2048,
  maxDnsQuestions: 128,
  maxDnsRecords: 256,
  maxDnsPointerDepth: 32,
  maxTcpSequenceIntervalsPerDirection: 4096,
  maxTlsRecordsPerFrame: 64,
  maxTlsHandshakeMessagesPerFrame: 128,
  maxTlsExtensionsPerHello: 256,
  maxTlsNamesPerExtension: 128,
  maxTlsAlpnProtocols: 128,
  maxTlsSupportedVersions: 128
});

// ../8f1a24ac8c73/hopscotch/src/capture/container.ts
var PCAPNG_SECTION_HEADER = 168627466;
var PCAPNG_INTERFACE_DESCRIPTION = 1;
var PCAPNG_ENHANCED_PACKET = 6;
var PCAPNG_SIMPLE_PACKET = 3;
var MICROSECOND_RESOLUTION = deepFreeze({
  unit: "microseconds",
  exponent: 6,
  description: "10^-6 seconds"
});
var NANOSECOND_RESOLUTION = deepFreeze({
  unit: "nanoseconds",
  exponent: 9,
  description: "10^-9 seconds"
});
function decimalResolution(exponent) {
  return deepFreeze({ unit: "decimal", exponent, description: `10^-${exponent} seconds` });
}
function binaryResolution(exponent) {
  return deepFreeze({ unit: "binary", exponent, description: `2^-${exponent} seconds` });
}
function linkTypeLabel(linkType) {
  if (linkType === 1) return "Ethernet II";
  return `Unsupported link type ${linkType}`;
}
function isoFromNanoseconds(epochNanoseconds) {
  const milliseconds = epochNanoseconds / 1000000n;
  if (milliseconds < -8640000000000000n || milliseconds > 8640000000000000n) return null;
  const date = new Date(Number(milliseconds));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function timestampFromPcap(seconds, fraction, nanoseconds) {
  const scale = nanoseconds ? 1000000000n : 1000000n;
  const epochNanoseconds = BigInt(seconds) * 1000000000n + (nanoseconds ? BigInt(fraction) : BigInt(fraction) * 1000n);
  return deepFreeze({
    epochNanoseconds,
    originalSeconds: seconds,
    originalFraction: fraction,
    rawTicks: BigInt(seconds) * scale + BigInt(fraction),
    resolution: nanoseconds ? NANOSECOND_RESOLUTION : MICROSECOND_RESOLUTION,
    iso8601: isoFromNanoseconds(epochNanoseconds)
  });
}
function ticksToNanoseconds(ticks, resolution) {
  if (resolution.unit === "binary") return ticks * 1000000000n / (1n << BigInt(resolution.exponent));
  if (resolution.exponent <= 9) return ticks * 10n ** BigInt(9 - resolution.exponent);
  return ticks / 10n ** BigInt(resolution.exponent - 9);
}
function timestampFromTicks(ticks, resolution) {
  const epochNanoseconds = ticksToNanoseconds(ticks, resolution);
  return deepFreeze({
    epochNanoseconds,
    originalSeconds: null,
    originalFraction: null,
    rawTicks: ticks,
    resolution,
    iso8601: isoFromNanoseconds(epochNanoseconds)
  });
}
function captureHash(bytes2) {
  return `capture-${bytes2.deterministicFingerprint()}`;
}
function finalizeFrames(drafts) {
  if (drafts.length === 0) return Object.freeze([]);
  let origin = drafts[0]?.timestamp.epochNanoseconds ?? 0n;
  for (const frame of drafts) if (frame.timestamp.epochNanoseconds < origin) origin = frame.timestamp.epochNanoseconds;
  return Object.freeze(drafts.map((frame) => {
    const relativeTimeNanoseconds = frame.timestamp.epochNanoseconds - origin;
    return deepFreeze({
      ...frame,
      relativeTimeNanoseconds,
      relativeTimeMs: Number(relativeTimeNanoseconds) / 1e6
    });
  }));
}
function requireFrameCapacity(frameCount, capturedLength, offset) {
  if (frameCount >= CAPTURE_LIMITS.maxFrames) {
    throw new CaptureParseError("FRAME_LIMIT_EXCEEDED", `Capture exceeds the explicit ${CAPTURE_LIMITS.maxFrames.toLocaleString()} frame ceiling`, offset);
  }
  if (capturedLength > CAPTURE_LIMITS.maxFrameBytes) {
    throw new CaptureParseError("FRAME_TOO_LARGE", `Frame length ${capturedLength} exceeds the ${CAPTURE_LIMITS.maxFrameBytes} byte ceiling`, offset);
  }
}
function parseClassicPcap(bytes2, captureId) {
  if (bytes2.length < 24) throw new CaptureParseError("TRUNCATED_INPUT", "Classic PCAP global header requires 24 bytes", bytes2.length);
  const magic = bytes2.hex(0, 4).replaceAll(" ", "").toLowerCase();
  const variants = {
    d4c3b2a1: { order: "little", nanoseconds: false },
    a1b2c3d4: { order: "big", nanoseconds: false },
    "4d3cb2a1": { order: "little", nanoseconds: true },
    a1b23c4d: { order: "big", nanoseconds: true }
  };
  const variant = variants[magic];
  if (!variant) throw new CaptureParseError("UNSUPPORTED_FORMAT", "Unrecognized PCAP magic value", 0);
  const major = bytes2.readUint16(4, variant.order);
  const minor = bytes2.readUint16(6, variant.order);
  if (major !== 2 || minor !== 4) {
    throw new CaptureParseError("UNSUPPORTED_VERSION", `Unsupported PCAP version ${major}.${minor}; HOPSCOTCH accepts 2.4`, 4);
  }
  const snapLength = bytes2.readUint32(16, variant.order);
  if (snapLength === 0 || snapLength > CAPTURE_LIMITS.maxFrameBytes) {
    throw new CaptureParseError("INVALID_LENGTH", `Invalid or unsafe PCAP snapshot length ${snapLength}`, 16);
  }
  const linkType = bytes2.readUint32(20, variant.order);
  const captureInterface = deepFreeze({
    id: "interface-0-0",
    sectionIndex: 0,
    interfaceIndex: 0,
    linkType,
    linkTypeLabel: linkTypeLabel(linkType),
    supported: linkType === 1,
    snapLength,
    timestampResolution: variant.nanoseconds ? NANOSECOND_RESOLUTION : MICROSECOND_RESOLUTION
  });
  const warnings = [];
  if (!captureInterface.supported) warnings.push(`${captureInterface.linkTypeLabel}; frames remain available as raw captured bytes and are not decoded as Ethernet.`);
  const drafts = [];
  let offset = 24;
  while (offset < bytes2.length) {
    if (bytes2.length - offset < 16) throw new CaptureParseError("TRUNCATED_INPUT", "Truncated PCAP packet record header", offset);
    const seconds = bytes2.readUint32(offset, variant.order);
    const fraction = bytes2.readUint32(offset + 4, variant.order);
    const capturedLength = bytes2.readUint32(offset + 8, variant.order);
    const originalLength = bytes2.readUint32(offset + 12, variant.order);
    const fractionLimit = variant.nanoseconds ? 1e9 : 1e6;
    if (fraction >= fractionLimit) throw new CaptureParseError("MALFORMED_CONTAINER", `PCAP timestamp fraction ${fraction} exceeds its resolution`, offset + 4);
    requireFrameCapacity(drafts.length, capturedLength, offset + 8);
    if (capturedLength > snapLength) throw new CaptureParseError("INVALID_LENGTH", `Captured length ${capturedLength} exceeds declared snapshot length ${snapLength}`, offset + 8);
    if (originalLength < capturedLength) throw new CaptureParseError("INVALID_LENGTH", `Original length ${originalLength} is smaller than captured length ${capturedLength}`, offset + 12);
    const payloadOffset = offset + 16;
    if (capturedLength > bytes2.length - payloadOffset) throw new CaptureParseError("TRUNCATED_INPUT", "PCAP packet bytes end before captured length", payloadOffset);
    const number = drafts.length + 1;
    drafts.push({
      id: `frame-${number.toString().padStart(6, "0")}`,
      number,
      sourceOrder: drafts.length,
      timestamp: timestampFromPcap(seconds, fraction, variant.nanoseconds),
      capturedLength,
      originalLength,
      truncated: capturedLength < originalLength,
      linkType,
      linkTypeLabel: captureInterface.linkTypeLabel,
      interfaceId: captureInterface.id,
      sectionIndex: 0,
      bytes: bytes2.view(payloadOffset, capturedLength),
      provenance: "CAPTURED"
    });
    offset = payloadOffset + capturedLength;
  }
  return deepFreeze({
    format: "pcap",
    byteOrder: variant.order,
    captureId,
    byteLength: bytes2.length,
    frames: finalizeFrames(drafts),
    interfaces: [captureInterface],
    warnings
  });
}
function align32(length) {
  const remainder = length % 4;
  return remainder === 0 ? length : length + (4 - remainder);
}
function validateBlockLength(bytes2, offset, length, order) {
  if (length < 12 || length % 4 !== 0 || length > CAPTURE_LIMITS.maxPcapngBlockBytes) {
    throw new CaptureParseError("INVALID_LENGTH", `Invalid PCAPNG block length ${length}`, offset + 4);
  }
  if (length > bytes2.length - offset) throw new CaptureParseError("TRUNCATED_INPUT", "PCAPNG block exceeds the input buffer", offset);
  const trailingLength = bytes2.readUint32(offset + length - 4, order);
  if (trailingLength !== length) throw new CaptureParseError("MALFORMED_CONTAINER", `PCAPNG trailing block length ${trailingLength} does not match ${length}`, offset + length - 4);
}
function forEachPcapngOption(bytes2, start, end, order, visit) {
  let offset = start;
  while (offset < end) {
    if (end - offset < 4) throw new CaptureParseError("TRUNCATED_INPUT", "Truncated PCAPNG option header", offset);
    const code = bytes2.readUint16(offset, order);
    const length = bytes2.readUint16(offset + 2, order);
    const valueOffset = offset + 4;
    if (length > end - valueOffset) throw new CaptureParseError("TRUNCATED_INPUT", "PCAPNG option value exceeds its block", valueOffset);
    if (code === 0) {
      if (length !== 0) throw new CaptureParseError("MALFORMED_CONTAINER", "PCAPNG end-of-options must have zero length", offset);
      return;
    }
    visit(code, valueOffset, length);
    const paddedLength = align32(length);
    if (paddedLength > end - valueOffset) throw new CaptureParseError("TRUNCATED_INPUT", "PCAPNG option padding exceeds its block", valueOffset);
    offset = valueOffset + paddedLength;
  }
}
function pcapngResolution(bytes2, offset) {
  const raw = bytes2.at(offset);
  const binary = (raw & 128) !== 0;
  const exponent = raw & 127;
  if (exponent > 63) throw new CaptureParseError("MALFORMED_CONTAINER", `Unsafe PCAPNG timestamp resolution exponent ${exponent}`, offset);
  return binary ? binaryResolution(exponent) : decimalResolution(exponent);
}
function parsePcapng(bytes2, captureId) {
  const drafts = [];
  const interfaces = [];
  const warnings = [];
  let suppressedWarningCount = 0;
  const addWarning = (warning) => {
    if (warnings.length < 64) warnings.push(warning);
    else suppressedWarningCount += 1;
  };
  const orders = /* @__PURE__ */ new Set();
  let offset = 0;
  let sectionIndex = -1;
  let currentOrder = null;
  let sectionInterfaces = [];
  let blockCount = 0;
  while (offset < bytes2.length) {
    if (blockCount >= CAPTURE_LIMITS.maxPcapngBlocks) {
      throw new CaptureParseError("MALFORMED_CONTAINER", `PCAPNG exceeds the explicit ${CAPTURE_LIMITS.maxPcapngBlocks.toLocaleString()} block ceiling`, offset);
    }
    blockCount += 1;
    if (bytes2.length - offset < 12) throw new CaptureParseError("TRUNCATED_INPUT", "Truncated PCAPNG block header", offset);
    const rawType = bytes2.readUint32(offset, "big");
    if (rawType === PCAPNG_SECTION_HEADER) {
      if (bytes2.length - offset < 28) throw new CaptureParseError("TRUNCATED_INPUT", "PCAPNG Section Header Block requires at least 28 bytes", offset);
      const bom = bytes2.hex(offset + 8, 4).replaceAll(" ", "").toLowerCase();
      currentOrder = bom === "1a2b3c4d" ? "big" : bom === "4d3c2b1a" ? "little" : null;
      if (!currentOrder) throw new CaptureParseError("MALFORMED_CONTAINER", "Invalid PCAPNG byte-order magic", offset + 8);
      const blockLength2 = bytes2.readUint32(offset + 4, currentOrder);
      validateBlockLength(bytes2, offset, blockLength2, currentOrder);
      if (blockLength2 < 28) throw new CaptureParseError("INVALID_LENGTH", "PCAPNG Section Header Block is too short", offset + 4);
      const major = bytes2.readUint16(offset + 12, currentOrder);
      const minor = bytes2.readUint16(offset + 14, currentOrder);
      if (major !== 1 || minor !== 0) throw new CaptureParseError("UNSUPPORTED_VERSION", `Unsupported PCAPNG version ${major}.${minor}; HOPSCOTCH accepts 1.0`, offset + 12);
      sectionIndex += 1;
      sectionInterfaces = [];
      orders.add(currentOrder);
      forEachPcapngOption(bytes2, offset + 24, offset + blockLength2 - 4, currentOrder, () => void 0);
      offset += blockLength2;
      continue;
    }
    if (!currentOrder || sectionIndex < 0) throw new CaptureParseError("MALFORMED_CONTAINER", "PCAPNG data appeared before a Section Header Block", offset);
    const blockType = bytes2.readUint32(offset, currentOrder);
    const blockLength = bytes2.readUint32(offset + 4, currentOrder);
    validateBlockLength(bytes2, offset, blockLength, currentOrder);
    if (blockType === PCAPNG_INTERFACE_DESCRIPTION) {
      if (interfaces.length >= CAPTURE_LIMITS.maxPcapngInterfaces) {
        throw new CaptureParseError("INVALID_INTERFACE", `PCAPNG exceeds the explicit ${CAPTURE_LIMITS.maxPcapngInterfaces.toLocaleString()} interface ceiling`, offset);
      }
      if (blockLength < 20) throw new CaptureParseError("INVALID_LENGTH", "PCAPNG Interface Description Block is too short", offset + 4);
      const linkType = bytes2.readUint16(offset + 8, currentOrder);
      const snapLength = bytes2.readUint32(offset + 12, currentOrder);
      if (snapLength > CAPTURE_LIMITS.maxFrameBytes) throw new CaptureParseError("INVALID_LENGTH", `Unsafe PCAPNG snapshot length ${snapLength}`, offset + 12);
      let timestampResolution = MICROSECOND_RESOLUTION;
      forEachPcapngOption(bytes2, offset + 16, offset + blockLength - 4, currentOrder, (code, valueOffset, valueLength) => {
        if (code === 9) {
          if (valueLength !== 1) throw new CaptureParseError("MALFORMED_CONTAINER", "PCAPNG if_tsresol option must contain one byte", valueOffset);
          timestampResolution = pcapngResolution(bytes2, valueOffset);
        }
      });
      const interfaceIndex = sectionInterfaces.length;
      const record = deepFreeze({
        id: `interface-${sectionIndex}-${interfaceIndex}`,
        sectionIndex,
        interfaceIndex,
        linkType,
        linkTypeLabel: linkTypeLabel(linkType),
        supported: linkType === 1,
        snapLength,
        timestampResolution
      });
      sectionInterfaces.push(record);
      interfaces.push(record);
      if (!record.supported) addWarning(`${record.id}: ${record.linkTypeLabel}; referenced frames remain raw and are not decoded as Ethernet.`);
    } else if (blockType === PCAPNG_ENHANCED_PACKET) {
      if (blockLength < 32) throw new CaptureParseError("INVALID_LENGTH", "PCAPNG Enhanced Packet Block is too short", offset + 4);
      const interfaceIndex = bytes2.readUint32(offset + 8, currentOrder);
      const captureInterface = sectionInterfaces[interfaceIndex];
      if (!captureInterface) throw new CaptureParseError("INVALID_INTERFACE", `PCAPNG packet references missing interface ${interfaceIndex}`, offset + 8);
      const timestampHigh = bytes2.readUint32(offset + 12, currentOrder);
      const timestampLow = bytes2.readUint32(offset + 16, currentOrder);
      const capturedLength = bytes2.readUint32(offset + 20, currentOrder);
      const originalLength = bytes2.readUint32(offset + 24, currentOrder);
      requireFrameCapacity(drafts.length, capturedLength, offset + 20);
      if (originalLength < capturedLength) throw new CaptureParseError("INVALID_LENGTH", `Original length ${originalLength} is smaller than captured length ${capturedLength}`, offset + 24);
      if (captureInterface.snapLength !== 0 && capturedLength > captureInterface.snapLength) {
        throw new CaptureParseError("INVALID_LENGTH", `Captured length ${capturedLength} exceeds interface snapshot length ${captureInterface.snapLength}`, offset + 20);
      }
      const paddedLength = align32(capturedLength);
      const packetOffset = offset + 28;
      const optionsOffset = packetOffset + paddedLength;
      const optionsEnd = offset + blockLength - 4;
      if (capturedLength > optionsEnd - packetOffset || paddedLength > optionsEnd - packetOffset) {
        throw new CaptureParseError("TRUNCATED_INPUT", "PCAPNG packet data or padding exceeds its block", packetOffset);
      }
      forEachPcapngOption(bytes2, optionsOffset, optionsEnd, currentOrder, () => void 0);
      const ticks = BigInt(timestampHigh) << 32n | BigInt(timestampLow);
      const number = drafts.length + 1;
      drafts.push({
        id: `frame-${number.toString().padStart(6, "0")}`,
        number,
        sourceOrder: drafts.length,
        timestamp: timestampFromTicks(ticks, captureInterface.timestampResolution),
        capturedLength,
        originalLength,
        truncated: capturedLength < originalLength,
        linkType: captureInterface.linkType,
        linkTypeLabel: captureInterface.linkTypeLabel,
        interfaceId: captureInterface.id,
        sectionIndex,
        bytes: bytes2.view(packetOffset, capturedLength),
        provenance: "CAPTURED"
      });
    } else if (blockType === PCAPNG_SIMPLE_PACKET) {
      addWarning(`Section ${sectionIndex}: Simple Packet Block skipped; this slice implements Enhanced Packet Blocks only.`);
    }
    offset += blockLength;
  }
  const uniqueWarnings = [...new Set(warnings)];
  if (suppressedWarningCount > 0) uniqueWarnings.push(`${suppressedWarningCount.toLocaleString()} additional repeated container warning(s) were summarized; captured blocks were not reinterpreted.`);
  const byteOrder = orders.size === 1 ? [...orders][0] : "mixed";
  return deepFreeze({
    format: "pcapng",
    byteOrder,
    captureId,
    byteLength: bytes2.length,
    frames: finalizeFrames(drafts),
    interfaces,
    warnings: uniqueWarnings
  });
}
function parseCaptureContainer(input2) {
  const inputLength = input2.byteLength;
  if (inputLength > CAPTURE_LIMITS.maxCaptureBytes) {
    throw new CaptureParseError("CAPTURE_TOO_LARGE", `Capture is ${inputLength} bytes; the explicit first-slice ceiling is ${CAPTURE_LIMITS.maxCaptureBytes} bytes`);
  }
  const bytes2 = ImmutableBytes.copyOf(input2);
  if (bytes2.length < 4) throw new CaptureParseError("TRUNCATED_INPUT", "Capture is too small to contain a supported file header", bytes2.length);
  const captureId = captureHash(bytes2);
  const magic = bytes2.hex(0, 4).replaceAll(" ", "").toLowerCase();
  if (magic === "0a0d0d0a") return parsePcapng(bytes2, captureId);
  if (["d4c3b2a1", "a1b2c3d4", "4d3cb2a1", "a1b23c4d"].includes(magic)) return parseClassicPcap(bytes2, captureId);
  throw new CaptureParseError("UNSUPPORTED_FORMAT", "File is neither classic PCAP nor PCAPNG", 0);
}

// ../8f1a24ac8c73/hopscotch/src/capture/protocol.ts
function range(offset, length) {
  return { offset, length };
}
function field(frameLength, id2, label, value, displayValue, byteRanges, note) {
  byteRanges.forEach((entry) => assertCapturedRange(frameLength, entry.offset, entry.length, `${id2} byte range`));
  return { id: id2, label, value, displayValue, byteRanges: [...byteRanges], provenance: "CAPTURED", ...note ? { note } : {} };
}
function layer(frameLength, id2, protocol, label, byteRange, fields, status = "complete", note) {
  assertCapturedRange(frameLength, byteRange.offset, byteRange.length, `${id2} layer`);
  return { id: id2, protocol, label, byteRange, fields: [...fields], status, ...note ? { note } : {} };
}
function hex162(value) {
  return `0x${value.toString(16).padStart(4, "0").toUpperCase()}`;
}
function hex32(value) {
  return `0x${value.toString(16).padStart(8, "0").toUpperCase()}`;
}
function formatMac2(frame, offset) {
  return Array.from({ length: 6 }, (_, index) => frame.bytes.at(offset + index).toString(16).padStart(2, "0")).join(":");
}
function formatIpv42(frame, offset) {
  return Array.from({ length: 4 }, (_, index) => frame.bytes.at(offset + index)).join(".");
}
function formatIpv62(frame, offset) {
  const groups = [];
  for (let index = 0; index < 16; index += 2) groups.push(frame.bytes.readUint16(offset + index, "big").toString(16));
  return groups.join(":");
}
function ipProtocolLabel(protocol) {
  if (protocol === 1) return "ICMP";
  if (protocol === 6) return "TCP";
  if (protocol === 17) return "UDP";
  if (protocol === 58) return "ICMPv6";
  return `Protocol ${protocol}`;
}
function etherTypeLabel(etherType) {
  if (etherType === 2048) return "IPv4";
  if (etherType === 34525) return "IPv6";
  if (etherType === 33024) return "802.1Q VLAN";
  if (etherType === 34984) return "802.1ad VLAN";
  return "UNKNOWN";
}
function parseEthernet(frame, state) {
  const length = frame.bytes.length;
  if (length < 14) {
    state.layers.push(layer(length, "ethernet", "ethernet", "Ethernet II", range(0, length), [], "truncated", "Ethernet II requires a 14-byte header."));
    state.issues.push("TRUNCATED ETHERNET HEADER");
    return null;
  }
  const destination = formatMac2(frame, 0);
  const source = formatMac2(frame, 6);
  const outerEtherType = frame.bytes.readUint16(12, "big");
  let etherType = outerEtherType;
  let etherTypeOffset = 12;
  let vlanDepth = 0;
  while (etherType === 33024 || etherType === 34984) {
    if (vlanDepth >= 2) {
      state.issues.push("MORE THAN TWO VLAN TAGS ARE NOT DECODED IN THIS SLICE");
      break;
    }
    if (length - etherTypeOffset < 6) throw new CaptureParseError("MALFORMED_PROTOCOL", "Truncated VLAN tag", etherTypeOffset);
    const tci = frame.bytes.readUint16(etherTypeOffset + 2, "big");
    const innerType = frame.bytes.readUint16(etherTypeOffset + 4, "big");
    state.layers.push(layer(length, `vlan-${vlanDepth}`, "vlan", vlanDepth === 0 ? "802.1Q VLAN" : "Nested VLAN", range(etherTypeOffset, 6), [
      field(length, `vlan-${vlanDepth}.tpid`, "Tag Protocol ID", etherType, `${hex162(etherType)} \xB7 ${etherTypeLabel(etherType)}`, [range(etherTypeOffset, 2)]),
      field(length, `vlan-${vlanDepth}.priority`, "Priority Code Point", tci >>> 13 & 7, String(tci >>> 13 & 7), [range(etherTypeOffset + 2, 2)]),
      field(length, `vlan-${vlanDepth}.drop-eligible`, "Drop Eligible", (tci & 4096) !== 0, (tci & 4096) !== 0 ? "YES" : "NO", [range(etherTypeOffset + 2, 2)]),
      field(length, `vlan-${vlanDepth}.id`, "VLAN ID", tci & 4095, String(tci & 4095), [range(etherTypeOffset + 2, 2)]),
      field(length, `vlan-${vlanDepth}.ether-type`, "Inner EtherType", innerType, `${hex162(innerType)} \xB7 ${etherTypeLabel(innerType)}`, [range(etherTypeOffset + 4, 2)])
    ]));
    etherType = innerType;
    etherTypeOffset += 4;
    vlanDepth += 1;
  }
  const payloadOffset = etherTypeOffset + 2;
  state.layers.unshift(layer(length, "ethernet", "ethernet", "Ethernet II", range(0, payloadOffset), [
    field(length, "ethernet.destination", "Destination MAC", destination, destination, [range(0, 6)]),
    field(length, "ethernet.source", "Source MAC", source, source, [range(6, 6)]),
    field(length, "ethernet.ether-type", vlanDepth > 0 ? "Outer EtherType" : "EtherType", outerEtherType, `${hex162(outerEtherType)} \xB7 ${etherTypeLabel(outerEtherType)}`, [range(12, 2)]),
    ...vlanDepth > 0 ? [field(length, "ethernet.payload-ether-type", "Payload EtherType", etherType, `${hex162(etherType)} \xB7 ${etherTypeLabel(etherType)}`, [range(etherTypeOffset, 2)])] : []
  ]));
  return { etherType, payloadOffset };
}
function parseIpv42(frame, offset, state) {
  const frameLength = frame.bytes.length;
  if (frameLength - offset < 20) {
    state.layers.push(layer(frameLength, "ipv4", "ipv4", "IPv4", range(offset, frameLength - offset), [], "truncated", "IPv4 requires at least 20 captured bytes."));
    state.issues.push("TRUNCATED IPV4 HEADER");
    return null;
  }
  const first = frame.bytes.at(offset);
  const version = first >>> 4;
  const ihlWords = first & 15;
  if (version !== 4) throw new CaptureParseError("MALFORMED_PROTOCOL", `EtherType declared IPv4 but version is ${version}`, offset);
  if (ihlWords < 5) throw new CaptureParseError("MALFORMED_PROTOCOL", `IPv4 IHL ${ihlWords} is smaller than 5`, offset);
  const headerLength = ihlWords * 4;
  if (headerLength > frameLength - offset) throw new CaptureParseError("MALFORMED_PROTOCOL", `IPv4 IHL ${headerLength} exceeds captured bytes`, offset);
  const totalLength = frame.bytes.readUint16(offset + 2, "big");
  if (totalLength < headerLength) throw new CaptureParseError("MALFORMED_PROTOCOL", `IPv4 total length ${totalLength} is smaller than header length ${headerLength}`, offset + 2);
  const packetEnd = Math.min(frameLength, offset + totalLength);
  const truncated = offset + totalLength > frameLength;
  const flagsAndOffset = frame.bytes.readUint16(offset + 6, "big");
  const fragmentOffset = flagsAndOffset & 8191;
  const moreFragments = (flagsAndOffset & 8192) !== 0;
  const protocol = frame.bytes.at(offset + 9);
  const source = formatIpv42(frame, offset + 12);
  const destination = formatIpv42(frame, offset + 16);
  const dscpEcn = frame.bytes.at(offset + 1);
  state.layers.push(layer(frameLength, "ipv4", "ipv4", "IPv4", range(offset, headerLength), [
    field(frameLength, "ipv4.version-ihl", "Version / IHL", first, `IPv4 \xB7 ${headerLength} byte header`, [range(offset, 1)]),
    field(frameLength, "ipv4.dscp-ecn", "DSCP / ECN", dscpEcn, `DSCP ${dscpEcn >>> 2} \xB7 ECN ${dscpEcn & 3}`, [range(offset + 1, 1)]),
    field(frameLength, "ipv4.total-length", "Total Length", totalLength, `${totalLength} bytes`, [range(offset + 2, 2)]),
    field(frameLength, "ipv4.identification", "Identification", frame.bytes.readUint16(offset + 4, "big"), hex162(frame.bytes.readUint16(offset + 4, "big")), [range(offset + 4, 2)]),
    field(frameLength, "ipv4.flags-fragment", "Flags / Fragment Offset", flagsAndOffset, `${(flagsAndOffset & 16384) !== 0 ? "DF \xB7 " : ""}${moreFragments ? "MF \xB7 " : ""}offset ${fragmentOffset * 8} bytes`, [range(offset + 6, 2)]),
    field(frameLength, "ipv4.ttl", "TTL", frame.bytes.at(offset + 8), String(frame.bytes.at(offset + 8)), [range(offset + 8, 1)]),
    field(frameLength, "ipv4.protocol", "Protocol", protocol, `${protocol} \xB7 ${ipProtocolLabel(protocol)}`, [range(offset + 9, 1)]),
    field(frameLength, "ipv4.checksum", "Header Checksum Field", frame.bytes.readUint16(offset + 10, "big"), hex162(frame.bytes.readUint16(offset + 10, "big")), [range(offset + 10, 2)], "Captured field value only; this decoder does not claim checksum verification."),
    field(frameLength, "ipv4.source", "Source Address", source, source, [range(offset + 12, 4)]),
    field(frameLength, "ipv4.destination", "Destination Address", destination, destination, [range(offset + 16, 4)])
  ], truncated ? "truncated" : "complete", truncated ? "The IPv4 total length extends beyond the captured frame; missing bytes were not fabricated." : void 0));
  if (truncated) state.issues.push("IPV4 PAYLOAD TRUNCATED BY CAPTURE");
  state.sourceIp = source;
  state.destinationIp = destination;
  state.ipFamily = "ipv4";
  return { family: "ipv4", protocol, offset: offset + headerLength, end: packetEnd, source, destination, fragmented: fragmentOffset !== 0 || moreFragments };
}
function isIpv6Extension(nextHeader) {
  return nextHeader === 0 || nextHeader === 43 || nextHeader === 44 || nextHeader === 51 || nextHeader === 60;
}
function ipv6ExtensionLabel(nextHeader) {
  if (nextHeader === 0) return "IPv6 Hop-by-Hop Options";
  if (nextHeader === 43) return "IPv6 Routing Header";
  if (nextHeader === 44) return "IPv6 Fragment Header";
  if (nextHeader === 51) return "IP Authentication Header";
  if (nextHeader === 60) return "IPv6 Destination Options";
  return `IPv6 Extension ${nextHeader}`;
}
function parseIpv62(frame, offset, state) {
  const frameLength = frame.bytes.length;
  if (frameLength - offset < 40) {
    state.layers.push(layer(frameLength, "ipv6", "ipv6", "IPv6", range(offset, frameLength - offset), [], "truncated", "IPv6 requires a 40-byte base header."));
    state.issues.push("TRUNCATED IPV6 HEADER");
    return null;
  }
  const firstWord = frame.bytes.readUint32(offset, "big");
  const version = firstWord >>> 28;
  if (version !== 6) throw new CaptureParseError("MALFORMED_PROTOCOL", `EtherType declared IPv6 but version is ${version}`, offset);
  const trafficClass = firstWord >>> 20 & 255;
  const flowLabel = firstWord & 1048575;
  const payloadLength = frame.bytes.readUint16(offset + 4, "big");
  let nextHeader = frame.bytes.at(offset + 6);
  const source = formatIpv62(frame, offset + 8);
  const destination = formatIpv62(frame, offset + 24);
  const declaredEnd = payloadLength === 0 ? frameLength : offset + 40 + payloadLength;
  const packetEnd = Math.min(frameLength, declaredEnd);
  const truncated = declaredEnd > frameLength;
  state.layers.push(layer(frameLength, "ipv6", "ipv6", "IPv6", range(offset, 40), [
    field(frameLength, "ipv6.version", "Version", version, "IPv6", [range(offset, 1)]),
    field(frameLength, "ipv6.traffic-class", "Traffic Class", trafficClass, `${trafficClass}`, [range(offset, 2)]),
    field(frameLength, "ipv6.flow-label", "Flow Label", flowLabel, `0x${flowLabel.toString(16).padStart(5, "0").toUpperCase()}`, [range(offset + 1, 3)]),
    field(frameLength, "ipv6.payload-length", "Payload Length", payloadLength, `${payloadLength} bytes`, [range(offset + 4, 2)]),
    field(frameLength, "ipv6.next-header", "Next Header", nextHeader, `${nextHeader} \xB7 ${ipProtocolLabel(nextHeader)}`, [range(offset + 6, 1)]),
    field(frameLength, "ipv6.hop-limit", "Hop Limit", frame.bytes.at(offset + 7), String(frame.bytes.at(offset + 7)), [range(offset + 7, 1)]),
    field(frameLength, "ipv6.source", "Source Address", source, source, [range(offset + 8, 16)]),
    field(frameLength, "ipv6.destination", "Destination Address", destination, destination, [range(offset + 24, 16)])
  ], truncated ? "truncated" : "complete", truncated ? "The IPv6 payload length extends beyond the captured frame." : void 0));
  if (payloadLength === 0) state.issues.push("IPV6 JUMBO PAYLOAD OPTION IS NOT INTERPRETED; CAPTURE BOUNDARY USED");
  if (truncated) state.issues.push("IPV6 PAYLOAD TRUNCATED BY CAPTURE");
  state.sourceIp = source;
  state.destinationIp = destination;
  state.ipFamily = "ipv6";
  let cursor = offset + 40;
  let traversedBytes = 0;
  let traversedHeaders = 0;
  let fragmentedPayload = false;
  let nonInitialFragment = false;
  while (isIpv6Extension(nextHeader)) {
    if (traversedHeaders >= CAPTURE_LIMITS.maxIpv6ExtensionHeaders || traversedBytes >= CAPTURE_LIMITS.maxIpv6ExtensionBytes) {
      throw new CaptureParseError("MALFORMED_PROTOCOL", "IPv6 extension chain exceeds bounded traversal limits", cursor);
    }
    if (cursor >= packetEnd) throw new CaptureParseError("MALFORMED_PROTOCOL", "IPv6 extension header begins beyond the captured payload", cursor);
    const extensionType = nextHeader;
    let extensionLength;
    if (extensionType === 44) extensionLength = 8;
    else {
      if (packetEnd - cursor < 2) throw new CaptureParseError("MALFORMED_PROTOCOL", "Truncated IPv6 extension header", cursor);
      extensionLength = extensionType === 51 ? (frame.bytes.at(cursor + 1) + 2) * 4 : (frame.bytes.at(cursor + 1) + 1) * 8;
    }
    if (extensionLength <= 0 || extensionLength > packetEnd - cursor) throw new CaptureParseError("MALFORMED_PROTOCOL", `IPv6 extension length ${extensionLength} exceeds packet bounds`, cursor);
    if (traversedBytes + extensionLength > CAPTURE_LIMITS.maxIpv6ExtensionBytes) {
      throw new CaptureParseError("MALFORMED_PROTOCOL", "IPv6 extension chain exceeds the bounded byte limit", cursor);
    }
    const extensionNext = frame.bytes.at(cursor);
    const fields = [
      field(frameLength, `ipv6-extension-${traversedHeaders}.next-header`, "Next Header", extensionNext, `${extensionNext} \xB7 ${ipProtocolLabel(extensionNext)}`, [range(cursor, 1)])
    ];
    if (extensionType === 44) {
      const fragment = frame.bytes.readUint16(cursor + 2, "big");
      const fragmentOffset = fragment >>> 3 & 8191;
      nonInitialFragment = fragmentOffset !== 0;
      fragmentedPayload = nonInitialFragment || (fragment & 1) !== 0;
      fields.push(
        field(frameLength, `ipv6-extension-${traversedHeaders}.fragment-offset`, "Fragment Offset / M", fragment, `offset ${fragmentOffset * 8} bytes \xB7 more ${(fragment & 1) !== 0 ? "YES" : "NO"}`, [range(cursor + 2, 2)]),
        field(frameLength, `ipv6-extension-${traversedHeaders}.identification`, "Identification", frame.bytes.readUint32(cursor + 4, "big"), hex32(frame.bytes.readUint32(cursor + 4, "big")), [range(cursor + 4, 4)])
      );
    } else {
      fields.push(field(frameLength, `ipv6-extension-${traversedHeaders}.length`, "Extension Length", extensionLength, `${extensionLength} bytes`, [range(cursor + 1, 1)]));
    }
    state.layers.push(layer(frameLength, `ipv6-extension-${traversedHeaders}`, "ipv6-extension", ipv6ExtensionLabel(extensionType), range(cursor, extensionLength), fields));
    cursor += extensionLength;
    traversedBytes += extensionLength;
    traversedHeaders += 1;
    nextHeader = extensionNext;
    if (nonInitialFragment) {
      state.issues.push("NON-INITIAL IPV6 FRAGMENT; UPPER-LAYER HEADER NOT PRESENT AT THIS VANTAGE");
      break;
    }
  }
  if (nextHeader === 50) state.issues.push("IPSEC ESP PAYLOAD IS ENCRYPTED AND NOT DECODED");
  return { family: "ipv6", protocol: nextHeader, offset: cursor, end: packetEnd, source, destination, fragmented: fragmentedPayload };
}
function tcpFlags(frame, offset) {
  const byte12 = frame.bytes.at(offset + 12);
  const byte13 = frame.bytes.at(offset + 13);
  return {
    ns: (byte12 & 1) !== 0,
    cwr: (byte13 & 128) !== 0,
    ece: (byte13 & 64) !== 0,
    urg: (byte13 & 32) !== 0,
    ack: (byte13 & 16) !== 0,
    psh: (byte13 & 8) !== 0,
    rst: (byte13 & 4) !== 0,
    syn: (byte13 & 2) !== 0,
    fin: (byte13 & 1) !== 0
  };
}
function flagLabel(flags) {
  const labels = Object.entries(flags).filter(([, enabled]) => enabled).map(([name]) => name.toUpperCase());
  return labels.length > 0 ? labels.join(", ") : "NONE";
}
function parseTcp(frame, ip, state) {
  const frameLength = frame.bytes.length;
  const offset = ip.offset;
  if (ip.end - offset < 20) throw new CaptureParseError("MALFORMED_PROTOCOL", "TCP header is shorter than 20 bytes", offset);
  const dataOffsetBytes = (frame.bytes.at(offset + 12) >>> 4) * 4;
  if (dataOffsetBytes < 20) throw new CaptureParseError("MALFORMED_PROTOCOL", `TCP data offset ${dataOffsetBytes} is smaller than 20`, offset + 12);
  if (dataOffsetBytes > ip.end - offset) throw new CaptureParseError("MALFORMED_PROTOCOL", `TCP data offset ${dataOffsetBytes} exceeds IP payload`, offset + 12);
  const sourcePort = frame.bytes.readUint16(offset, "big");
  const destinationPort = frame.bytes.readUint16(offset + 2, "big");
  const sequenceNumber = frame.bytes.readUint32(offset + 4, "big");
  const acknowledgmentNumber = frame.bytes.readUint32(offset + 8, "big");
  const flags = tcpFlags(frame, offset);
  const payloadRange = range(offset + dataOffsetBytes, ip.end - (offset + dataOffsetBytes));
  let mss = null;
  let windowScale = null;
  let sackPermitted = false;
  let timestampValue = null;
  let timestampEchoReply = null;
  const fields = [
    field(frameLength, "tcp.source-port", "Source Port", sourcePort, String(sourcePort), [range(offset, 2)]),
    field(frameLength, "tcp.destination-port", "Destination Port", destinationPort, String(destinationPort), [range(offset + 2, 2)]),
    field(frameLength, "tcp.sequence", "Sequence Number", sequenceNumber, String(sequenceNumber), [range(offset + 4, 4)]),
    field(frameLength, "tcp.acknowledgment", "Acknowledgment Number", acknowledgmentNumber, String(acknowledgmentNumber), [range(offset + 8, 4)]),
    field(frameLength, "tcp.data-offset", "Header / Data Offset", dataOffsetBytes, `${dataOffsetBytes} bytes`, [range(offset + 12, 1)]),
    field(frameLength, "tcp.flags", "Flags", frame.bytes.readUint16(offset + 12, "big") & 511, flagLabel(flags), [range(offset + 12, 2)]),
    field(frameLength, "tcp.window", "Advertised Window", frame.bytes.readUint16(offset + 14, "big"), String(frame.bytes.readUint16(offset + 14, "big")), [range(offset + 14, 2)]),
    field(frameLength, "tcp.checksum", "Checksum Field", frame.bytes.readUint16(offset + 16, "big"), hex162(frame.bytes.readUint16(offset + 16, "big")), [range(offset + 16, 2)], "Captured field value only; checksum validity is not asserted."),
    field(frameLength, "tcp.urgent-pointer", "Urgent Pointer", frame.bytes.readUint16(offset + 18, "big"), String(frame.bytes.readUint16(offset + 18, "big")), [range(offset + 18, 2)])
  ];
  let optionOffset = offset + 20;
  let optionIndex = 0;
  while (optionOffset < offset + dataOffsetBytes) {
    const kind = frame.bytes.at(optionOffset);
    if (kind === 0) {
      fields.push(field(frameLength, `tcp.option-${optionIndex}`, "TCP Option", 0, "END", [range(optionOffset, 1)]));
      break;
    }
    if (kind === 1) {
      fields.push(field(frameLength, `tcp.option-${optionIndex}`, "TCP Option", 1, "NOP", [range(optionOffset, 1)]));
      optionOffset += 1;
      optionIndex += 1;
      continue;
    }
    if (offset + dataOffsetBytes - optionOffset < 2) throw new CaptureParseError("MALFORMED_PROTOCOL", "TCP option is missing its length byte", optionOffset);
    const optionLength = frame.bytes.at(optionOffset + 1);
    if (optionLength < 2 || optionLength > offset + dataOffsetBytes - optionOffset) throw new CaptureParseError("MALFORMED_PROTOCOL", `Invalid TCP option length ${optionLength}`, optionOffset + 1);
    let label = `OPTION ${kind}`;
    let value = kind;
    let display = `${optionLength} bytes`;
    if (kind === 2 && optionLength === 4) {
      mss = frame.bytes.readUint16(optionOffset + 2, "big");
      label = "Maximum Segment Size";
      value = mss;
      display = `${mss} bytes`;
    } else if (kind === 3 && optionLength === 3) {
      windowScale = frame.bytes.at(optionOffset + 2);
      label = "Window Scale";
      value = windowScale;
      display = String(windowScale);
    } else if (kind === 4 && optionLength === 2) {
      sackPermitted = true;
      label = "SACK Permitted";
      value = true;
      display = "YES";
    } else if (kind === 8 && optionLength === 10) {
      timestampValue = frame.bytes.readUint32(optionOffset + 2, "big");
      timestampEchoReply = frame.bytes.readUint32(optionOffset + 6, "big");
      label = "TCP Timestamps";
      value = timestampValue;
      display = `TSval ${timestampValue} \xB7 TSecr ${timestampEchoReply}`;
    }
    fields.push(field(frameLength, `tcp.option-${optionIndex}`, label, value, display, [range(optionOffset, optionLength)]));
    optionOffset += optionLength;
    optionIndex += 1;
  }
  state.layers.push(layer(frameLength, "tcp", "tcp", "TCP", range(offset, dataOffsetBytes), fields));
  const tcp = {
    sequenceNumber,
    acknowledgmentNumber,
    dataOffsetBytes,
    flags,
    window: frame.bytes.readUint16(offset + 14, "big"),
    checksum: frame.bytes.readUint16(offset + 16, "big"),
    urgentPointer: frame.bytes.readUint16(offset + 18, "big"),
    payloadRange,
    options: { mss, windowScale, sackPermitted, timestampValue, timestampEchoReply }
  };
  state.transport = {
    kind: "tcp",
    source: { family: ip.family, address: ip.source, port: sourcePort },
    destination: { family: ip.family, address: ip.destination, port: destinationPort },
    tcp,
    udp: null,
    icmp: null
  };
  if (payloadRange.length > 0) parseTcpApplication(frame, payloadRange, sourcePort, destinationPort, state);
}
function parseUdp(frame, ip, state) {
  const frameLength = frame.bytes.length;
  const offset = ip.offset;
  if (ip.end - offset < 8) throw new CaptureParseError("MALFORMED_PROTOCOL", "UDP header is shorter than 8 bytes", offset);
  const sourcePort = frame.bytes.readUint16(offset, "big");
  const destinationPort = frame.bytes.readUint16(offset + 2, "big");
  const udpLength = frame.bytes.readUint16(offset + 4, "big");
  if (udpLength < 8) throw new CaptureParseError("MALFORMED_PROTOCOL", `UDP length ${udpLength} is smaller than 8`, offset + 4);
  const declaredEnd = offset + udpLength;
  const payloadEnd = Math.min(ip.end, declaredEnd);
  const truncated = declaredEnd > ip.end;
  const payloadRange = range(offset + 8, Math.max(0, payloadEnd - (offset + 8)));
  const checksum = frame.bytes.readUint16(offset + 6, "big");
  state.layers.push(layer(frameLength, "udp", "udp", "UDP", range(offset, 8), [
    field(frameLength, "udp.source-port", "Source Port", sourcePort, String(sourcePort), [range(offset, 2)]),
    field(frameLength, "udp.destination-port", "Destination Port", destinationPort, String(destinationPort), [range(offset + 2, 2)]),
    field(frameLength, "udp.length", "UDP Length", udpLength, `${udpLength} bytes`, [range(offset + 4, 2)]),
    field(frameLength, "udp.checksum", "Checksum Field", checksum, hex162(checksum), [range(offset + 6, 2)], "Captured field value only; checksum validity is not asserted.")
  ], truncated ? "truncated" : "complete", truncated ? "UDP length extends beyond the capture/IP boundary." : void 0));
  if (truncated) state.issues.push("UDP PAYLOAD TRUNCATED OR LENGTH INCONSISTENT");
  else if (declaredEnd < ip.end) state.issues.push("IP PAYLOAD CONTAINS BYTES BEYOND THE DECLARED UDP LENGTH; TRAILING BYTES WERE NOT ASSIGNED TO UDP");
  const udp = { length: udpLength, checksum, payloadRange };
  state.transport = {
    kind: "udp",
    source: { family: ip.family, address: ip.source, port: sourcePort },
    destination: { family: ip.family, address: ip.destination, port: destinationPort },
    tcp: null,
    udp,
    icmp: null
  };
  if ((sourcePort === 53 || destinationPort === 53) && payloadRange.length > 0) parseDns(frame, payloadRange, state);
  else if (payloadRange.length > 0) addPayloadLayer(frame, payloadRange, state, "UDP payload");
}
function icmpLabel(family, type, code) {
  if (family === "ipv4") {
    if (type === 8) return "Echo Request";
    if (type === 0) return "Echo Reply";
    if (type === 3) return code === 4 ? "Destination Unreachable \xB7 Fragmentation Needed" : "Destination Unreachable";
    if (type === 11) return "Time Exceeded";
  } else {
    if (type === 128) return "Echo Request";
    if (type === 129) return "Echo Reply";
    if (type === 1) return "Destination Unreachable";
    if (type === 2) return "Packet Too Big";
    if (type === 3) return "Time Exceeded";
  }
  return `${family === "ipv4" ? "ICMP" : "ICMPv6"} type ${type} code ${code}`;
}
function parseIcmp(frame, ip, state) {
  const frameLength = frame.bytes.length;
  const offset = ip.offset;
  if (ip.end - offset < 4) throw new CaptureParseError("MALFORMED_PROTOCOL", "ICMP header is shorter than 4 bytes", offset);
  const type = frame.bytes.at(offset);
  const code = frame.bytes.at(offset + 1);
  const echo = ip.family === "ipv4" && (type === 8 || type === 0) || ip.family === "ipv6" && (type === 128 || type === 129);
  const packetTooBig = ip.family === "ipv6" && type === 2;
  const fragmentationNeeded = ip.family === "ipv4" && type === 3 && code === 4;
  let identifier = null;
  let sequence = null;
  let mtu = null;
  const fields = [
    field(frameLength, "icmp.type", "Type", type, `${type} \xB7 ${icmpLabel(ip.family, type, code)}`, [range(offset, 1)]),
    field(frameLength, "icmp.code", "Code", code, String(code), [range(offset + 1, 1)]),
    field(frameLength, "icmp.checksum", "Checksum Field", frame.bytes.readUint16(offset + 2, "big"), hex162(frame.bytes.readUint16(offset + 2, "big")), [range(offset + 2, 2)], "Captured field value only; checksum validity is not asserted.")
  ];
  if (echo) {
    if (ip.end - offset < 8) throw new CaptureParseError("MALFORMED_PROTOCOL", "ICMP echo header is shorter than 8 bytes", offset);
    identifier = frame.bytes.readUint16(offset + 4, "big");
    sequence = frame.bytes.readUint16(offset + 6, "big");
    fields.push(
      field(frameLength, "icmp.identifier", "Identifier", identifier, hex162(identifier), [range(offset + 4, 2)]),
      field(frameLength, "icmp.sequence", "Sequence", sequence, String(sequence), [range(offset + 6, 2)])
    );
  } else if (packetTooBig) {
    if (ip.end - offset < 8) throw new CaptureParseError("MALFORMED_PROTOCOL", "ICMPv6 Packet Too Big header is shorter than 8 bytes", offset);
    mtu = frame.bytes.readUint32(offset + 4, "big");
    fields.push(field(frameLength, "icmp.mtu", "Next-hop MTU", mtu, `${mtu} bytes`, [range(offset + 4, 4)]));
  } else if (fragmentationNeeded) {
    if (ip.end - offset < 8) throw new CaptureParseError("MALFORMED_PROTOCOL", "ICMP fragmentation-needed header is shorter than 8 bytes", offset);
    mtu = frame.bytes.readUint16(offset + 6, "big");
    fields.push(field(frameLength, "icmp.mtu", "Next-hop MTU", mtu, `${mtu} bytes`, [range(offset + 6, 2)]));
  }
  const protocol = ip.family === "ipv4" ? "icmp" : "icmpv6";
  state.layers.push(layer(frameLength, protocol, protocol, protocol === "icmp" ? "ICMP" : "ICMPv6", range(offset, ip.end - offset), fields));
  const icmp = { type, code, label: icmpLabel(ip.family, type, code), identifier, sequence, mtu };
  state.transport = {
    kind: protocol,
    source: { family: ip.family, address: ip.source, port: null },
    destination: { family: ip.family, address: ip.destination, port: null },
    tcp: null,
    udp: null,
    icmp
  };
}
function addPayloadLayer(frame, payload, state, labelText) {
  if (payload.length <= 0) return;
  state.layers.push(layer(frame.bytes.length, `payload-${payload.offset}`, "payload", labelText, payload, [
    field(frame.bytes.length, `payload-${payload.offset}.bytes`, "Captured Payload", payload.length, `${payload.length} bytes`, [payload])
  ]));
}
function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.offset - b.offset || a.length - b.length);
  const merged = [];
  for (const current of sorted) {
    const previous = merged.at(-1);
    if (previous && current.offset <= previous.offset + previous.length) {
      const end = Math.max(previous.offset + previous.length, current.offset + current.length);
      merged[merged.length - 1] = { offset: previous.offset, length: end - previous.offset };
    } else merged.push({ ...current });
  }
  return merged;
}
function dnsLabel(frame, offset, length) {
  let text2 = "";
  for (let index = 0; index < length; index += 1) {
    const byte = frame.bytes.at(offset + index);
    text2 += byte >= 33 && byte <= 126 ? String.fromCharCode(byte) : `\\x${byte.toString(16).padStart(2, "0")}`;
  }
  return text2;
}
function parseDnsName(frame, start, messageStart, messageEnd) {
  let cursor = start;
  let nextOffset = start;
  let jumped = false;
  let depth = 0;
  let expandedLength = 0;
  const visited = /* @__PURE__ */ new Set();
  const labels = [];
  const ranges = [];
  while (true) {
    if (cursor < messageStart || cursor >= messageEnd) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS name cursor is outside the message", cursor);
    const length = frame.bytes.at(cursor);
    if ((length & 192) === 192) {
      if (messageEnd - cursor < 2) throw new CaptureParseError("MALFORMED_PROTOCOL", "Truncated DNS compression pointer", cursor);
      const pointer = (length & 63) << 8 | frame.bytes.at(cursor + 1);
      const target2 = messageStart + pointer;
      if (target2 < messageStart || target2 >= messageEnd) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS compression pointer is outside the message", cursor);
      ranges.push(range(cursor, 2));
      if (!jumped) nextOffset = cursor + 2;
      if (visited.has(target2)) throw new CaptureParseError("MALFORMED_PROTOCOL", "Cyclic DNS compression pointer", cursor);
      visited.add(target2);
      depth += 1;
      if (depth > CAPTURE_LIMITS.maxDnsPointerDepth) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS compression pointer depth exceeded", cursor);
      cursor = target2;
      jumped = true;
      continue;
    }
    if ((length & 192) !== 0) throw new CaptureParseError("MALFORMED_PROTOCOL", `Invalid DNS label length byte ${length}`, cursor);
    ranges.push(range(cursor, 1));
    cursor += 1;
    if (length === 0) {
      if (!jumped) nextOffset = cursor;
      break;
    }
    if (length > 63 || length > messageEnd - cursor) throw new CaptureParseError("MALFORMED_PROTOCOL", `Invalid or truncated DNS label length ${length}`, cursor - 1);
    ranges.push(range(cursor, length));
    labels.push(dnsLabel(frame, cursor, length));
    expandedLength += length + 1;
    if (expandedLength > 255 || labels.length > 128) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS name exceeds bounded decoded length", start);
    cursor += length;
    if (!jumped) nextOffset = cursor;
  }
  return { name: labels.length > 0 ? labels.join(".") : ".", nextOffset, ranges: mergeRanges(ranges) };
}
function dnsTypeLabel(type) {
  const names = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 12: "PTR", 15: "MX", 16: "TXT", 28: "AAAA", 33: "SRV", 41: "OPT" };
  return names[type] ?? `TYPE${type}`;
}
function dnsRdata(frame, type, offset, length, messageStart, messageEnd) {
  const end = offset + length;
  if (end > messageEnd) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS RDATA exceeds the message", offset);
  if (type === 1 && length === 4) return formatIpv42(frame, offset);
  if (type === 28 && length === 16) return formatIpv62(frame, offset);
  if ([2, 5, 12].includes(type)) {
    const parsed = parseDnsName(frame, offset, messageStart, messageEnd);
    if (parsed.nextOffset > end) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS compressed-name RDATA exceeds RDLENGTH", offset);
    return parsed.name;
  }
  if (type === 15 && length >= 3) {
    const preference = frame.bytes.readUint16(offset, "big");
    const parsed = parseDnsName(frame, offset + 2, messageStart, messageEnd);
    if (parsed.nextOffset > end) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS MX RDATA exceeds RDLENGTH", offset);
    return `${preference} ${parsed.name}`;
  }
  if (type === 33 && length >= 7) {
    const priority2 = frame.bytes.readUint16(offset, "big");
    const weight = frame.bytes.readUint16(offset + 2, "big");
    const port = frame.bytes.readUint16(offset + 4, "big");
    const parsed = parseDnsName(frame, offset + 6, messageStart, messageEnd);
    if (parsed.nextOffset > end) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS SRV RDATA exceeds RDLENGTH", offset);
    return `${priority2} ${weight} ${port} ${parsed.name}`;
  }
  if (type === 16) {
    const values = [];
    let cursor = offset;
    while (cursor < end) {
      const textLength = frame.bytes.at(cursor);
      cursor += 1;
      if (textLength > end - cursor) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS TXT string exceeds RDLENGTH", cursor - 1);
      values.push(dnsLabel(frame, cursor, textLength));
      cursor += textLength;
    }
    return values.map((value) => `"${value}"`).join(" ");
  }
  const shown = Math.min(length, 32);
  return `${frame.bytes.hex(offset, shown)}${length > shown ? " \u2026" : ""}`;
}
function parseDns(frame, payload, state, tcpLengthPrefix = false) {
  let messageStart = payload.offset;
  let messageLength = payload.length;
  if (tcpLengthPrefix) {
    if (messageLength < 2) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS-over-TCP payload lacks the two-byte message length", messageStart);
    const declared = frame.bytes.readUint16(messageStart, "big");
    messageStart += 2;
    messageLength -= 2;
    if (declared > messageLength) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS-over-TCP message is truncated", messageStart);
    if (declared < messageLength) state.issues.push("ADDITIONAL DNS-OVER-TCP BYTES ARE PRESENT; THIS SLICE DECODES ONLY THE FIRST LENGTH-PREFIXED MESSAGE IN A FRAME");
    messageLength = declared;
  }
  const messageEnd = messageStart + messageLength;
  if (messageLength < 12) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS header is shorter than 12 bytes", messageStart);
  const transactionId = frame.bytes.readUint16(messageStart, "big");
  const flags = frame.bytes.readUint16(messageStart + 2, "big");
  const questionCount = frame.bytes.readUint16(messageStart + 4, "big");
  const answerCount = frame.bytes.readUint16(messageStart + 6, "big");
  const authorityCount = frame.bytes.readUint16(messageStart + 8, "big");
  const additionalCount = frame.bytes.readUint16(messageStart + 10, "big");
  if (questionCount > CAPTURE_LIMITS.maxDnsQuestions) throw new CaptureParseError("MALFORMED_PROTOCOL", `DNS question count ${questionCount} exceeds the bounded limit`, messageStart + 4);
  if (answerCount + authorityCount + additionalCount > CAPTURE_LIMITS.maxDnsRecords) throw new CaptureParseError("MALFORMED_PROTOCOL", "DNS record count exceeds the bounded limit", messageStart + 6);
  const fields = [
    field(frame.bytes.length, "dns.transaction-id", "Transaction ID", transactionId, hex162(transactionId), [range(messageStart, 2)]),
    field(frame.bytes.length, "dns.query-response", "Query / Response", (flags & 32768) !== 0, (flags & 32768) !== 0 ? "RESPONSE" : "QUERY", [range(messageStart + 2, 2)]),
    field(frame.bytes.length, "dns.opcode", "Opcode", flags >>> 11 & 15, String(flags >>> 11 & 15), [range(messageStart + 2, 2)]),
    field(frame.bytes.length, "dns.flags", "AA / TC / RD / RA", flags, `AA ${(flags & 1024) !== 0 ? 1 : 0} \xB7 TC ${(flags & 512) !== 0 ? 1 : 0} \xB7 RD ${(flags & 256) !== 0 ? 1 : 0} \xB7 RA ${(flags & 128) !== 0 ? 1 : 0}`, [range(messageStart + 2, 2)]),
    field(frame.bytes.length, "dns.rcode", "Response Code", flags & 15, String(flags & 15), [range(messageStart + 2, 2)]),
    field(frame.bytes.length, "dns.question-count", "Question Count", questionCount, String(questionCount), [range(messageStart + 4, 2)]),
    field(frame.bytes.length, "dns.answer-count", "Answer Count", answerCount, String(answerCount), [range(messageStart + 6, 2)]),
    field(frame.bytes.length, "dns.authority-count", "Authority Count", authorityCount, String(authorityCount), [range(messageStart + 8, 2)]),
    field(frame.bytes.length, "dns.additional-count", "Additional Count", additionalCount, String(additionalCount), [range(messageStart + 10, 2)])
  ];
  const questions = [];
  const answers = [];
  const authorities = [];
  const additionals = [];
  let cursor = messageStart + 12;
  for (let index = 0; index < questionCount; index += 1) {
    const name = parseDnsName(frame, cursor, messageStart, messageEnd);
    cursor = name.nextOffset;
    if (messageEnd - cursor < 4) throw new CaptureParseError("MALFORMED_PROTOCOL", "Truncated DNS question tail", cursor);
    const type = frame.bytes.readUint16(cursor, "big");
    const rrClass = frame.bytes.readUint16(cursor + 2, "big");
    questions.push({ name: name.name, type, typeLabel: dnsTypeLabel(type), class: rrClass });
    fields.push(
      field(frame.bytes.length, `dns.question-${index}.name`, `Question ${index + 1} Name`, name.name, name.name, name.ranges),
      field(frame.bytes.length, `dns.question-${index}.type`, `Question ${index + 1} Type`, type, dnsTypeLabel(type), [range(cursor, 2)]),
      field(frame.bytes.length, `dns.question-${index}.class`, `Question ${index + 1} Class`, rrClass, String(rrClass), [range(cursor + 2, 2)])
    );
    cursor += 4;
  }
  const parseRecords = (count, target2, section2) => {
    for (let index = 0; index < count; index += 1) {
      const name = parseDnsName(frame, cursor, messageStart, messageEnd);
      cursor = name.nextOffset;
      if (messageEnd - cursor < 10) throw new CaptureParseError("MALFORMED_PROTOCOL", `Truncated DNS ${section2} record header`, cursor);
      const type = frame.bytes.readUint16(cursor, "big");
      const rrClass = frame.bytes.readUint16(cursor + 2, "big");
      const ttl = frame.bytes.readUint32(cursor + 4, "big");
      const dataLength = frame.bytes.readUint16(cursor + 8, "big");
      const dataOffset = cursor + 10;
      if (dataLength > messageEnd - dataOffset) throw new CaptureParseError("MALFORMED_PROTOCOL", `DNS ${section2} RDATA exceeds the message`, dataOffset);
      const data2 = dnsRdata(frame, type, dataOffset, dataLength, messageStart, messageEnd);
      target2.push({ name: name.name, type, typeLabel: dnsTypeLabel(type), class: rrClass, ttl, data: data2 });
      const prefix2 = `dns.${section2}-${index}`;
      fields.push(
        field(frame.bytes.length, `${prefix2}.name`, `${section2} ${index + 1} Name`, name.name, name.name, name.ranges),
        field(frame.bytes.length, `${prefix2}.type`, `${section2} ${index + 1} Type`, type, dnsTypeLabel(type), [range(cursor, 2)]),
        field(frame.bytes.length, `${prefix2}.ttl`, `${section2} ${index + 1} TTL`, ttl, `${ttl} s`, [range(cursor + 4, 4)]),
        field(frame.bytes.length, `${prefix2}.data`, `${section2} ${index + 1} Data`, data2, data2, [range(dataOffset, dataLength)])
      );
      cursor = dataOffset + dataLength;
    }
  };
  parseRecords(answerCount, answers, "answer");
  parseRecords(authorityCount, authorities, "authority");
  parseRecords(additionalCount, additionals, "additional");
  state.layers.push(layer(frame.bytes.length, "dns", "dns", "DNS", range(messageStart, messageLength), fields));
  state.dns = {
    transactionId,
    isResponse: (flags & 32768) !== 0,
    opcode: flags >>> 11 & 15,
    authoritative: (flags & 1024) !== 0,
    truncated: (flags & 512) !== 0,
    recursionDesired: (flags & 256) !== 0,
    recursionAvailable: (flags & 128) !== 0,
    rcode: flags & 15,
    questions,
    answers,
    authorities,
    additionals
  };
}
function tlsVersion(value) {
  if (value === 772) return "TLS 1.3";
  if (value === 771) return "TLS 1.2";
  if (value === 770) return "TLS 1.1";
  if (value === 769) return "TLS 1.0";
  return hex162(value);
}
function tlsContentType(value) {
  return { 20: "ChangeCipherSpec", 21: "Alert", 22: "Handshake", 23: "Application Data", 24: "Heartbeat" }[value] ?? `Type ${value}`;
}
function cipherSuite(value) {
  return { 4865: "TLS_AES_128_GCM_SHA256", 4866: "TLS_AES_256_GCM_SHA384", 4867: "TLS_CHACHA20_POLY1305_SHA256" }[value] ?? hex162(value);
}
function ascii(frame, offset, length) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    const byte = frame.bytes.at(offset + index);
    if (byte < 32 || byte > 126) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS text extension contains non-printable bytes", offset + index);
    value += String.fromCharCode(byte);
  }
  return value;
}
function parseTlsExtensions(frame, offset, end, prefix2, serverHello) {
  let cursor = offset;
  let serverName = null;
  const alpnProtocols = [];
  const supportedVersions = [];
  const fields = [];
  let extensionIndex = 0;
  while (cursor < end) {
    if (extensionIndex >= CAPTURE_LIMITS.maxTlsExtensionsPerHello) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS extension count exceeds the bounded decoder limit", cursor);
    if (end - cursor < 4) throw new CaptureParseError("MALFORMED_PROTOCOL", "Truncated TLS extension header", cursor);
    const type = frame.bytes.readUint16(cursor, "big");
    const length = frame.bytes.readUint16(cursor + 2, "big");
    const dataOffset = cursor + 4;
    const dataEnd = dataOffset + length;
    if (dataEnd > end) throw new CaptureParseError("MALFORMED_PROTOCOL", `TLS extension ${type} exceeds its hello`, cursor);
    fields.push(field(frame.bytes.length, `${prefix2}.extension-${extensionIndex}`, `Extension ${type}`, type, `${type} \xB7 ${length} bytes`, [range(cursor, 4)]));
    if (type === 0) {
      if (length < 2) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS SNI extension lacks its list length", dataOffset);
      const listLength = frame.bytes.readUint16(dataOffset, "big");
      if (listLength !== length - 2) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS SNI list length does not match its extension", dataOffset);
      let nameCursor = dataOffset + 2;
      const listEnd = nameCursor + listLength;
      let nameCount = 0;
      while (nameCursor < listEnd) {
        if (nameCount >= CAPTURE_LIMITS.maxTlsNamesPerExtension) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS SNI name count exceeds the bounded decoder limit", nameCursor);
        if (listEnd - nameCursor < 3) throw new CaptureParseError("MALFORMED_PROTOCOL", "Truncated TLS SNI entry", nameCursor);
        const nameType = frame.bytes.at(nameCursor);
        const nameLength = frame.bytes.readUint16(nameCursor + 1, "big");
        if (nameLength > listEnd - (nameCursor + 3)) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS SNI name exceeds list", nameCursor + 1);
        if (nameType === 0 && serverName === null) {
          serverName = ascii(frame, nameCursor + 3, nameLength);
          fields.push(field(frame.bytes.length, `${prefix2}.sni`, "Server Name", serverName, serverName, [range(nameCursor + 3, nameLength)]));
        }
        nameCursor += 3 + nameLength;
        nameCount += 1;
      }
    } else if (type === 16) {
      if (length < 2) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS ALPN extension lacks its list length", dataOffset);
      const listLength = frame.bytes.readUint16(dataOffset, "big");
      if (listLength !== length - 2) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS ALPN list length does not match its extension", dataOffset);
      let protocolCursor = dataOffset + 2;
      const listEnd = protocolCursor + listLength;
      while (protocolCursor < listEnd) {
        if (alpnProtocols.length >= CAPTURE_LIMITS.maxTlsAlpnProtocols) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS ALPN protocol count exceeds the bounded decoder limit", protocolCursor);
        const protocolLength = frame.bytes.at(protocolCursor);
        protocolCursor += 1;
        if (protocolLength > listEnd - protocolCursor) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS ALPN value exceeds list", protocolCursor - 1);
        const protocol = ascii(frame, protocolCursor, protocolLength);
        alpnProtocols.push(protocol);
        fields.push(field(frame.bytes.length, `${prefix2}.alpn-${alpnProtocols.length - 1}`, "ALPN Protocol", protocol, protocol, [range(protocolCursor, protocolLength)]));
        protocolCursor += protocolLength;
      }
    } else if (type === 43) {
      if (serverHello) {
        if (length !== 2) throw new CaptureParseError("MALFORMED_PROTOCOL", "ServerHello supported_versions must be two bytes", dataOffset);
        supportedVersions.push(tlsVersion(frame.bytes.readUint16(dataOffset, "big")));
        fields.push(field(frame.bytes.length, `${prefix2}.supported-version`, "Selected TLS Version", frame.bytes.readUint16(dataOffset, "big"), supportedVersions[0] ?? "", [range(dataOffset, 2)]));
      } else {
        if (length < 1) throw new CaptureParseError("MALFORMED_PROTOCOL", "ClientHello supported_versions is empty", dataOffset);
        const listLength = frame.bytes.at(dataOffset);
        if (listLength % 2 !== 0 || listLength !== length - 1) throw new CaptureParseError("MALFORMED_PROTOCOL", "ClientHello supported_versions list is malformed", dataOffset);
        if (listLength / 2 > CAPTURE_LIMITS.maxTlsSupportedVersions) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS supported-version count exceeds the bounded decoder limit", dataOffset);
        for (let versionOffset = dataOffset + 1; versionOffset < dataOffset + 1 + listLength; versionOffset += 2) {
          supportedVersions.push(tlsVersion(frame.bytes.readUint16(versionOffset, "big")));
        }
        fields.push(field(frame.bytes.length, `${prefix2}.supported-versions`, "Supported TLS Versions", supportedVersions.join(", "), supportedVersions.join(", "), [range(dataOffset + 1, listLength)]));
      }
    }
    cursor = dataEnd;
    extensionIndex += 1;
  }
  return { serverName, alpnProtocols, supportedVersions, fields };
}
function parseTlsHello(frame, type, bodyOffset, bodyEnd, prefix2, fields) {
  if (type !== 1 && type !== 2) return null;
  if (bodyEnd - bodyOffset < 35) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS hello is shorter than its fixed fields", bodyOffset);
  const serverHello = type === 2;
  const legacyVersionValue = frame.bytes.readUint16(bodyOffset, "big");
  let cursor = bodyOffset + 34;
  const sessionLength = frame.bytes.at(cursor);
  cursor += 1;
  if (sessionLength > bodyEnd - cursor) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS session ID exceeds hello", cursor - 1);
  cursor += sessionLength;
  let selectedCipherSuite = null;
  if (serverHello) {
    if (bodyEnd - cursor < 3) throw new CaptureParseError("MALFORMED_PROTOCOL", "Truncated ServerHello cipher/compression fields", cursor);
    const selected = frame.bytes.readUint16(cursor, "big");
    selectedCipherSuite = cipherSuite(selected);
    fields.push(field(frame.bytes.length, `${prefix2}.cipher-suite`, "Selected Cipher Suite", selected, selectedCipherSuite, [range(cursor, 2)]));
    cursor += 3;
  } else {
    if (bodyEnd - cursor < 2) throw new CaptureParseError("MALFORMED_PROTOCOL", "Truncated ClientHello cipher-suite length", cursor);
    const suitesLength = frame.bytes.readUint16(cursor, "big");
    cursor += 2;
    if (suitesLength % 2 !== 0 || suitesLength > bodyEnd - cursor) throw new CaptureParseError("MALFORMED_PROTOCOL", "ClientHello cipher-suite list is malformed", cursor - 2);
    fields.push(field(frame.bytes.length, `${prefix2}.cipher-suites`, "Offered Cipher Suites", suitesLength / 2, `${suitesLength / 2} suites`, [range(cursor, suitesLength)]));
    cursor += suitesLength;
    if (bodyEnd - cursor < 1) throw new CaptureParseError("MALFORMED_PROTOCOL", "ClientHello lacks compression methods", cursor);
    const compressionLength = frame.bytes.at(cursor);
    cursor += 1;
    if (compressionLength > bodyEnd - cursor) throw new CaptureParseError("MALFORMED_PROTOCOL", "ClientHello compression methods exceed hello", cursor - 1);
    cursor += compressionLength;
  }
  let extensions = { serverName: null, alpnProtocols: [], supportedVersions: [], fields: [] };
  if (cursor < bodyEnd) {
    if (bodyEnd - cursor < 2) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS hello extension length is truncated", cursor);
    const extensionsLength = frame.bytes.readUint16(cursor, "big");
    cursor += 2;
    if (extensionsLength !== bodyEnd - cursor) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS extension length does not match the hello body", cursor - 2);
    extensions = parseTlsExtensions(frame, cursor, cursor + extensionsLength, prefix2, serverHello);
    fields.push(...extensions.fields);
  }
  fields.push(field(frame.bytes.length, `${prefix2}.legacy-version`, "Legacy Version", legacyVersionValue, tlsVersion(legacyVersionValue), [range(bodyOffset, 2)], "TLS 1.3 ClientHello/ServerHello retains a legacy version field; supported_versions carries the modern version signal."));
  return {
    kind: serverHello ? "server-hello" : "client-hello",
    legacyVersion: tlsVersion(legacyVersionValue),
    serverName: extensions.serverName,
    alpnProtocols: extensions.alpnProtocols,
    supportedVersions: extensions.supportedVersions,
    selectedCipherSuite
  };
}
function parseTls(frame, payload, state) {
  const end = payload.offset + payload.length;
  if (payload.length < 3) return;
  const firstType = frame.bytes.at(payload.offset);
  const firstMajor = frame.bytes.at(payload.offset + 1);
  if (![20, 21, 22, 23, 24].includes(firstType) || firstMajor !== 3) return;
  const records = [];
  let cursor = payload.offset;
  let recordIndex = 0;
  let handshakeCount = 0;
  while (cursor < end && recordIndex < CAPTURE_LIMITS.maxTlsRecordsPerFrame) {
    if (end - cursor < 5) {
      state.layers.push(layer(frame.bytes.length, `tls-record-${recordIndex}`, "tls", "TLS Record", range(cursor, end - cursor), [], "truncated", "TLS record header is incomplete in this frame."));
      state.issues.push("TLS RECORD HEADER TRUNCATED IN CAPTURE");
      break;
    }
    const contentType = frame.bytes.at(cursor);
    const versionValue = frame.bytes.readUint16(cursor + 1, "big");
    const recordLength = frame.bytes.readUint16(cursor + 3, "big");
    const bodyOffset = cursor + 5;
    const recordEnd = bodyOffset + recordLength;
    const availableEnd = Math.min(end, recordEnd);
    const fields = [
      field(frame.bytes.length, `tls-record-${recordIndex}.content-type`, "Record Content Type", contentType, `${contentType} \xB7 ${tlsContentType(contentType)}`, [range(cursor, 1)]),
      field(frame.bytes.length, `tls-record-${recordIndex}.legacy-version`, "Record Version Field", versionValue, tlsVersion(versionValue), [range(cursor + 1, 2)]),
      field(frame.bytes.length, `tls-record-${recordIndex}.length`, "Record Length", recordLength, `${recordLength} bytes`, [range(cursor + 3, 2)])
    ];
    let hello = null;
    if (recordEnd > end) {
      state.layers.push(layer(frame.bytes.length, `tls-record-${recordIndex}`, "tls", "TLS Record", range(cursor, availableEnd - cursor), fields, "truncated", `Declared TLS record length ${recordLength} exceeds captured TCP payload.`));
      state.issues.push("TLS RECORD TRUNCATED; CROSS-FRAME REASSEMBLY IS NOT CLAIMED");
      records.push({ contentType, contentTypeLabel: tlsContentType(contentType), legacyVersion: tlsVersion(versionValue), length: recordLength, hello: null });
      break;
    }
    if (contentType === 22) {
      let handshakeOffset = bodyOffset;
      while (handshakeOffset < recordEnd && handshakeCount < CAPTURE_LIMITS.maxTlsHandshakeMessagesPerFrame) {
        if (recordEnd - handshakeOffset < 4) throw new CaptureParseError("MALFORMED_PROTOCOL", "TLS handshake header is truncated", handshakeOffset);
        const handshakeType = frame.bytes.at(handshakeOffset);
        const handshakeLength = frame.bytes.readUint24BE(handshakeOffset + 1);
        const handshakeBody = handshakeOffset + 4;
        const handshakeEnd = handshakeBody + handshakeLength;
        if (handshakeEnd > recordEnd) throw new CaptureParseError("MALFORMED_PROTOCOL", `TLS handshake length ${handshakeLength} exceeds its record`, handshakeOffset + 1);
        fields.push(field(frame.bytes.length, `tls-record-${recordIndex}.handshake-${handshakeCount}`, "Handshake Message", handshakeType, handshakeType === 1 ? "ClientHello" : handshakeType === 2 ? "ServerHello" : `Type ${handshakeType}`, [range(handshakeOffset, 4)]));
        const parsedHello = parseTlsHello(frame, handshakeType, handshakeBody, handshakeEnd, `tls-record-${recordIndex}.hello`, fields);
        if (parsedHello && hello === null) hello = parsedHello;
        handshakeOffset = handshakeEnd;
        handshakeCount += 1;
      }
      if (handshakeOffset < recordEnd) state.issues.push("TLS HANDSHAKE MESSAGE COUNT EXCEEDED BOUNDED PER-FRAME DECODER LIMIT");
    }
    state.layers.push(layer(frame.bytes.length, `tls-record-${recordIndex}`, "tls", "TLS Record", range(cursor, recordEnd - cursor), fields));
    records.push({ contentType, contentTypeLabel: tlsContentType(contentType), legacyVersion: tlsVersion(versionValue), length: recordLength, hello });
    cursor = recordEnd;
    recordIndex += 1;
  }
  if (recordIndex >= CAPTURE_LIMITS.maxTlsRecordsPerFrame && cursor < end) state.issues.push("TLS RECORD COUNT EXCEEDED BOUNDED PER-FRAME DECODER LIMIT");
  if (records.length > 0) state.tls = { records };
}
function parseTcpApplication(frame, payload, sourcePort, destinationPort, state) {
  if (sourcePort === 53 || destinationPort === 53) {
    parseDns(frame, payload, state, true);
    return;
  }
  if (sourcePort === 443 || destinationPort === 443 || sourcePort === 853 || destinationPort === 853) {
    parseTls(frame, payload, state);
    if (state.tls) return;
  }
  addPayloadLayer(frame, payload, state, "TCP payload");
}
function parseUpperLayer(frame, ip, state) {
  if (ip.fragmented) {
    state.issues.push("FRAGMENTED IP PAYLOAD; COMPLETE UPPER-LAYER MESSAGE IS NOT ASSUMED");
    return;
  }
  if (ip.offset > ip.end) throw new CaptureParseError("MALFORMED_PROTOCOL", "IP upper-layer offset exceeds payload end", ip.offset);
  if (ip.protocol === 6) parseTcp(frame, ip, state);
  else if (ip.protocol === 17) parseUdp(frame, ip, state);
  else if (ip.family === "ipv4" && ip.protocol === 1 || ip.family === "ipv6" && ip.protocol === 58) parseIcmp(frame, ip, state);
  else if (ip.protocol !== 59 && ip.protocol !== 50) state.issues.push(`UNSUPPORTED IP PROTOCOL ${ip.protocol}; BYTES REMAIN CAPTURED BUT UNINTERPRETED`);
}
function decodeCapturedFrame(record) {
  const state = {
    layers: [],
    issues: [],
    sourceIp: null,
    destinationIp: null,
    ipFamily: null,
    transport: null,
    dns: null,
    tls: null
  };
  if (record.linkType !== 1) {
    state.layers.push(layer(record.bytes.length, "unknown-link", "unknown", record.linkTypeLabel, range(0, record.bytes.length), [], "unsupported", "Unsupported link type was not decoded as Ethernet."));
    state.issues.push(`${record.linkTypeLabel.toUpperCase()} IS NOT DECODED`);
  } else {
    try {
      const ethernet2 = parseEthernet(record, state);
      if (ethernet2) {
        const ip = ethernet2.etherType === 2048 ? parseIpv42(record, ethernet2.payloadOffset, state) : ethernet2.etherType === 34525 ? parseIpv62(record, ethernet2.payloadOffset, state) : null;
        if (ip) parseUpperLayer(record, ip, state);
        else if (ethernet2.etherType !== 2048 && ethernet2.etherType !== 34525) {
          state.issues.push(`UNKNOWN ETHERTYPE ${hex162(ethernet2.etherType)}; PAYLOAD NOT INTERPRETED`);
        }
      }
    } catch (error) {
      if (error instanceof CaptureParseError) state.issues.push(`${error.code}: ${error.message}`);
      else state.issues.push(`MALFORMED_PROTOCOL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return deepFreeze({
    record,
    layers: state.layers,
    sourceIp: state.sourceIp,
    destinationIp: state.destinationIp,
    ipFamily: state.ipFamily,
    transport: state.transport,
    dns: state.dns,
    tls: state.tls,
    issues: [...new Set(state.issues)],
    provenance: "CAPTURED"
  });
}
function endpointDisplay(endpoint) {
  const address2 = endpoint.family === "ipv6" && endpoint.port !== null ? `[${endpoint.address}]` : endpoint.address;
  return endpoint.port === null ? address2 : `${address2}:${endpoint.port}`;
}

// ../8f1a24ac8c73/hopscotch/src/capture/session.ts
var EMPTY_CAPTURE_EVENTS = Object.freeze([]);
function requireSemanticCapacity(events2) {
  if (events2.length > CAPTURE_LIMITS.maxSemanticEvents) {
    throw new CaptureParseError("SEMANTIC_LIMIT_EXCEEDED", `Capture interpretation exceeds the explicit ${CAPTURE_LIMITS.maxSemanticEvents.toLocaleString()} semantic-event ceiling`);
  }
}
function stableHash(value) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = hash * prime & mask;
  }
  return hash.toString(16).padStart(16, "0");
}
function endpointKey(endpoint) {
  return `${endpoint.family}|${endpoint.address.toLowerCase()}|${endpoint.port === null ? "-" : endpoint.port.toString().padStart(5, "0")}`;
}
function compareEndpoints(left, right) {
  return endpointKey(left).localeCompare(endpointKey(right));
}
function descriptorForFrame(frame) {
  const transport = frame.transport;
  if (!transport) return null;
  const source = transport.source;
  const destination = transport.destination;
  const ordered = compareEndpoints(source, destination) <= 0;
  const endpointA = ordered ? source : destination;
  const endpointB = ordered ? destination : source;
  const direction = ordered ? "A_TO_B" : "B_TO_A";
  const identifier = transport.icmp?.identifier ?? "-";
  const key2 = transport.kind === "icmp" || transport.kind === "icmpv6" ? `${transport.kind}|${endpointKey(endpointA)}|${endpointKey(endpointB)}|echo-id:${identifier}` : `${transport.kind}|${endpointKey(endpointA)}|${endpointKey(endpointB)}`;
  return { key: key2, transportKind: transport.kind, endpointA, endpointB, direction };
}
function buildConversationDrafts(inputFrames) {
  const frames = [...inputFrames].sort((a, b) => a.record.sourceOrder - b.record.sourceOrder);
  const byKey = /* @__PURE__ */ new Map();
  for (const frame of frames) {
    const descriptor = descriptorForFrame(frame);
    if (!descriptor) continue;
    let draft = byKey.get(descriptor.key);
    if (!draft) {
      draft = {
        key: descriptor.key,
        id: `conversation-${stableHash(descriptor.key)}`,
        transportKind: descriptor.transportKind,
        endpointA: descriptor.endpointA,
        endpointB: descriptor.endpointB,
        frameReferences: [],
        frames: [],
        directionByFrameId: /* @__PURE__ */ new Map()
      };
      byKey.set(descriptor.key, draft);
    }
    draft.frames.push(frame);
    draft.directionByFrameId.set(frame.record.id, descriptor.direction);
    draft.frameReferences.push({
      frameId: frame.record.id,
      frameNumber: frame.record.number,
      direction: descriptor.direction,
      relativeTimeNanoseconds: frame.record.relativeTimeNanoseconds,
      capturedLength: frame.record.capturedLength
    });
  }
  return [...byKey.values()].sort((a, b) => {
    const aTime = a.frames[0]?.record.relativeTimeNanoseconds ?? 0n;
    const bTime = b.frames[0]?.record.relativeTimeNanoseconds ?? 0n;
    return aTime < bTime ? -1 : aTime > bTime ? 1 : a.key.localeCompare(b.key);
  });
}
function directionForFrame(draft, frame) {
  return draft.directionByFrameId.get(frame.record.id) ?? "A_TO_B";
}
function reference(frame, layerId, fieldId) {
  return { frameId: frame.record.id, layerId, fieldId };
}
function firstFieldReference(frame, predicate) {
  for (const layer2 of frame.layers) {
    const found = layer2.fields.find((candidate) => predicate(candidate.id));
    if (found) return reference(frame, layer2.id, found.id);
  }
  return null;
}
function uniqueFrameIds(frames) {
  return [...new Set([...frames].sort((a, b) => a.record.sourceOrder - b.record.sourceOrder).map((frame) => frame.record.id))];
}
function eventDraft(draft, frame, suffix, kind, title, summary, detail, provenance, fields, supportingFrames = [frame], uncertainty = null, sortPriority = 10) {
  return {
    id: `${draft.id}:${frame.record.id}:${suffix}`,
    conversationId: draft.id,
    kind,
    title,
    summary,
    detail,
    relativeTimeNanoseconds: frame.record.relativeTimeNanoseconds,
    relativeTimeMs: frame.record.relativeTimeMs,
    primaryFrameId: frame.record.id,
    supportingFrameIds: uniqueFrameIds([...supportingFrames]),
    fieldReferences: fields.filter((entry) => entry !== null),
    direction: directionForFrame(draft, frame),
    provenance,
    uncertainty,
    sortPriority,
    sourceOrder: frame.record.sourceOrder
  };
}
function sequenceKey(start, end) {
  return `${start}:${end}`;
}
function sequenceObservation(tracker, start, end, frame) {
  const exact = tracker.exactRanges.get(sequenceKey(start, end)) ?? null;
  let low = 0;
  let high = tracker.intervals.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((tracker.intervals[middle]?.end ?? 0n) < start) low = middle + 1;
    else high = middle;
  }
  const first = low;
  let last = first;
  let overlap = null;
  let covering = exact;
  let mergedStart = start;
  let mergedEnd = end;
  const witnesses = [];
  while (last < tracker.intervals.length) {
    const interval = tracker.intervals[last];
    if (!interval || interval.start > mergedEnd) break;
    mergedStart = interval.start < mergedStart ? interval.start : mergedStart;
    mergedEnd = interval.end > mergedEnd ? interval.end : mergedEnd;
    for (const witness of interval.witnesses) {
      if (!overlap && start < witness.end && end > witness.start) overlap = witness;
      if (!covering && witness.start <= start && witness.end >= end) covering = witness;
      witnesses.push(witness);
    }
    last += 1;
  }
  const observation = { start, end, frame };
  if (!tracker.exactRanges.has(sequenceKey(start, end))) tracker.exactRanges.set(sequenceKey(start, end), observation);
  const createsInterval = last === first;
  if (createsInterval && tracker.intervals.length >= CAPTURE_LIMITS.maxTcpSequenceIntervalsPerDirection) {
    const saturatedNow = !tracker.saturated;
    tracker.saturated = true;
    return { retransmission: covering, overlap, saturatedNow };
  }
  const mergedWitnesses = [...witnesses, observation].sort((left, right) => left.frame.record.sourceOrder - right.frame.record.sourceOrder).slice(-16);
  tracker.intervals.splice(first, last - first, { start: mergedStart, end: mergedEnd, witnesses: mergedWitnesses });
  return { retransmission: covering, overlap, saturatedNow: false };
}
function addTcpEvents(draft, events2, warnings) {
  const sequenceTrackers = {
    A_TO_B: { intervals: [], exactRanges: /* @__PURE__ */ new Map(), saturated: false },
    B_TO_A: { intervals: [], exactRanges: /* @__PURE__ */ new Map(), saturated: false }
  };
  const expected = { A_TO_B: null, B_TO_A: null };
  const lastPureAck = { A_TO_B: null, B_TO_A: null };
  let synFrame = null;
  let synAckFrame = null;
  let establishmentEmitted = false;
  for (const frame of draft.frames) {
    const tcp = frame.transport?.tcp;
    if (!tcp) continue;
    const direction = directionForFrame(draft, frame);
    const opposite = direction === "A_TO_B" ? "B_TO_A" : "A_TO_B";
    const source = endpointDisplay(frame.transport?.source ?? draft.endpointA);
    const destination = endpointDisplay(frame.transport?.destination ?? draft.endpointB);
    const flagRef = reference(frame, "tcp", "tcp.flags");
    const sequenceRef = reference(frame, "tcp", "tcp.sequence");
    const acknowledgmentRef = reference(frame, "tcp", "tcp.acknowledgment");
    const payloadLength = tcp.payloadRange.length;
    let kind;
    let suffix;
    let title;
    let summary;
    if (tcp.flags.rst) {
      kind = "tcp.rst";
      suffix = "rst";
      title = "TCP \xB7 RST";
      summary = `${source} reset the observed TCP conversation.`;
    } else if (tcp.flags.syn && tcp.flags.ack) {
      kind = "tcp.syn-ack";
      suffix = "syn-ack";
      title = "TCP \xB7 SYN/ACK";
      summary = `${source} acknowledged a captured SYN and advertised sequence ${tcp.sequenceNumber}.`;
      synAckFrame = frame;
    } else if (tcp.flags.syn) {
      kind = "tcp.syn";
      suffix = "syn";
      title = "TCP \xB7 SYN";
      summary = `${source} opened an observed TCP sequence toward ${destination}.`;
      if (!synFrame) synFrame = frame;
      expected[direction] = BigInt(tcp.sequenceNumber) + 1n;
    } else if (tcp.flags.fin) {
      kind = "tcp.fin";
      suffix = "fin";
      title = "TCP \xB7 FIN";
      summary = `${source} advertised an observed end of stream.`;
    } else if (payloadLength > 0) {
      kind = "tcp.data";
      suffix = "data";
      title = "TCP \xB7 DATA";
      summary = `${source} carried ${payloadLength} captured payload bytes at sequence ${tcp.sequenceNumber}.`;
    } else {
      kind = "tcp.ack";
      suffix = "ack";
      title = "TCP \xB7 ACK";
      summary = `${source} acknowledged through sequence ${tcp.acknowledgmentNumber}.`;
    }
    events2.push(eventDraft(
      draft,
      frame,
      suffix,
      kind,
      title,
      summary,
      `Frame ${frame.record.number} directly encodes ${flagLabelForDetail(tcp.flags)} with captured sequence ${tcp.sequenceNumber} and acknowledgment ${tcp.acknowledgmentNumber}.`,
      "CAPTURED",
      [flagRef, sequenceRef, acknowledgmentRef]
    ));
    if (!establishmentEmitted && synFrame && synAckFrame && tcp.flags.ack && !tcp.flags.syn && payloadLength === 0 && synFrame.record.sourceOrder < synAckFrame.record.sourceOrder && synAckFrame.record.sourceOrder < frame.record.sourceOrder && directionForFrame(draft, synFrame) === direction && directionForFrame(draft, synAckFrame) === opposite) {
      events2.push(eventDraft(
        draft,
        frame,
        "established-observed",
        "tcp.established-observed",
        "TCP \xB7 OBSERVED ESTABLISHMENT",
        "The capture contains a SYN \u2192 SYN/ACK \u2192 ACK progression for this conversation.",
        "This is a deterministic interpretation of three captured frames, not proof that traffic outside the capture point was complete.",
        "INFERRED",
        [reference(synFrame, "tcp", "tcp.flags"), reference(synAckFrame, "tcp", "tcp.flags"), flagRef],
        [synFrame, synAckFrame, frame],
        "Observed from one capture vantage point.",
        20
      ));
      establishmentEmitted = true;
    }
    const pureAck = tcp.flags.ack && !tcp.flags.syn && !tcp.flags.fin && !tcp.flags.rst && payloadLength === 0;
    if (pureAck) {
      const previous = lastPureAck[direction];
      if (previous?.acknowledgment === tcp.acknowledgmentNumber) {
        events2.push(eventDraft(
          draft,
          frame,
          "duplicate-ack-observed",
          "tcp.duplicate-ack-observed",
          "TCP \xB7 DUPLICATE ACK OBSERVED",
          `Acknowledgment ${tcp.acknowledgmentNumber} was captured again in the same direction.`,
          "The repeated acknowledgment field is visible in both frames. Window updates or capture artifacts may still affect interpretation.",
          "INFERRED",
          [acknowledgmentRef, reference(previous.frame, "tcp", "tcp.acknowledgment")],
          [previous.frame, frame],
          "A repeated ACK at one vantage point is not by itself proof of network loss.",
          21
        ));
      }
      lastPureAck[direction] = { acknowledgment: tcp.acknowledgmentNumber, frame };
    }
    if (payloadLength > 0) {
      const start = BigInt(tcp.sequenceNumber);
      const end = start + BigInt(payloadLength);
      if (end <= 0x100000000n) {
        const observation = sequenceObservation(sequenceTrackers[direction], start, end, frame);
        if (observation.saturatedNow && warnings.length < 64) {
          warnings.push(`${draft.id}: TCP overlap inference reached the explicit ${CAPTURE_LIMITS.maxTcpSequenceIntervalsPerDirection.toLocaleString()} disjoint-range ceiling in one direction; all frames remain captured and exact-range repeats remain indexed.`);
        }
        const previousExpected = expected[direction];
        if (previousExpected !== null && start > previousExpected) {
          events2.push(eventDraft(
            draft,
            frame,
            "sequence-gap-visible",
            "tcp.sequence-gap-visible",
            "TCP \xB7 CAPTURE-VISIBLE SEQUENCE GAP",
            `The next captured payload begins at ${start}; the contiguous observed range ended at ${previousExpected}.`,
            "The sequence-number bytes support an apparent gap in this capture. Missing capture data, offload, or an incomplete vantage can produce the same observation.",
            "INFERRED",
            [sequenceRef],
            [frame],
            "This does not claim that the network dropped a packet.",
            22
          ));
        }
        if (observation.retransmission) {
          const supporting = [observation.retransmission.frame];
          events2.push(eventDraft(
            draft,
            frame,
            "retransmission-observed",
            "tcp.retransmission-observed",
            "TCP \xB7 OBSERVED RETRANSMISSION",
            `Captured bytes ${start}\u2013${end - 1n} repeat a previously observed sequence range.`,
            "The same directional sequence range was captured earlier. HOPSCOTCH labels the capture-visible repetition without asserting where or why retransmission occurred.",
            "INFERRED",
            [sequenceRef, ...supporting.map((seen) => reference(seen, "tcp", "tcp.sequence"))],
            [...supporting, frame],
            "Capture offload or duplicated capture delivery can mimic retransmission.",
            23
          ));
        } else if (observation.overlap) {
          const supporting = observation.overlap.frame;
          events2.push(eventDraft(
            draft,
            frame,
            "overlap-observed",
            "tcp.overlap-observed",
            "TCP \xB7 OVERLAPPING SEQUENCE RANGE",
            `Captured bytes ${start}\u2013${end - 1n} overlap earlier payload bytes.`,
            "The overlap is derived from captured sequence fields and payload lengths; no loss location is inferred.",
            "INFERRED",
            [sequenceRef, reference(supporting, "tcp", "tcp.sequence")],
            [supporting, frame],
            "One capture vantage cannot prove a global loss or delivery outcome.",
            23
          ));
        }
        expected[direction] = previousExpected === null ? end : end > previousExpected ? end : previousExpected;
      }
    }
    if (frame.tls) {
      frame.tls.records.forEach((record, recordIndex) => {
        const hello = record.hello;
        if (!hello) return;
        const client = hello.kind === "client-hello";
        const helloRef = firstFieldReference(frame, (id2) => id2.startsWith(`tls-record-${recordIndex}.handshake-`));
        const sniRef = firstFieldReference(frame, (id2) => id2 === `tls-record-${recordIndex}.hello.sni`);
        events2.push(eventDraft(
          draft,
          frame,
          `${client ? "tls-client-hello" : "tls-server-hello"}-${recordIndex}`,
          client ? "tls.client-hello" : "tls.server-hello",
          client ? "TLS \xB7 CLIENT HELLO" : "TLS \xB7 SERVER HELLO",
          client ? `A captured ClientHello${hello.serverName ? ` exposes SNI ${hello.serverName}` : ""}.` : `A captured ServerHello selected ${hello.supportedVersions[0] ?? hello.legacyVersion}${hello.selectedCipherSuite ? ` with ${hello.selectedCipherSuite}` : ""}.`,
          "Only capture-visible TLS handshake metadata is decoded. Encrypted application data, secrets, and uncaptured handshake steps remain unknown.",
          "CAPTURED",
          [helloRef, sniRef],
          [frame],
          null,
          30
        ));
      });
    }
    requireSemanticCapacity(events2);
  }
}
function flagLabelForDetail(flags) {
  if (!flags || typeof flags !== "object") return "TCP state";
  const active = Object.entries(flags).filter(([, value]) => value).map(([key2]) => key2.toUpperCase());
  return active.length > 0 ? active.join(", ") : "no control flags";
}
function addNonTcpEvents(draft, events2) {
  for (const frame of draft.frames) {
    const transport = frame.transport;
    if (!transport || transport.kind === "tcp") continue;
    if (frame.dns) {
      const question = frame.dns.questions[0]?.name ?? "name not present";
      const response = frame.dns.isResponse;
      events2.push(eventDraft(
        draft,
        frame,
        response ? "dns-response" : "dns-query",
        response ? "dns.response" : "dns.query",
        response ? "DNS \xB7 RESPONSE" : "DNS \xB7 QUERY",
        response ? `Transaction ${hexTransaction(frame.dns.transactionId)} contains ${frame.dns.answers.length} captured answer record${frame.dns.answers.length === 1 ? "" : "s"}.` : `Transaction ${hexTransaction(frame.dns.transactionId)} asks for ${question}.`,
        response ? "This event says only that a response exists in the capture; answer absence is not automatically labeled DNS failure." : "The DNS header and question bytes are directly present in this frame.",
        "CAPTURED",
        [reference(frame, "dns", "dns.transaction-id"), reference(frame, "dns", "dns.query-response"), firstFieldReference(frame, (id2) => id2 === "dns.question-0.name")]
      ));
      requireSemanticCapacity(events2);
      continue;
    }
    if (transport.kind === "udp") {
      events2.push(eventDraft(
        draft,
        frame,
        "udp-datagram",
        "udp.datagram",
        "UDP \xB7 DATAGRAM",
        `${endpointDisplay(transport.source)} sent ${transport.udp?.payloadRange.length ?? 0} captured payload bytes to ${endpointDisplay(transport.destination)}.`,
        "Source/destination ports and UDP length are directly captured; application meaning is not guessed.",
        "CAPTURED",
        [reference(frame, "udp", "udp.source-port"), reference(frame, "udp", "udp.destination-port"), reference(frame, "udp", "udp.length")]
      ));
      requireSemanticCapacity(events2);
      continue;
    }
    const icmp = transport.icmp;
    if (!icmp) continue;
    let kind = "icmp.message";
    let title = `${transport.kind.toUpperCase()} \xB7 MESSAGE`;
    const family = transport.source.family;
    if (family === "ipv4" && icmp.type === 8 || family === "ipv6" && icmp.type === 128) {
      kind = "icmp.echo-request";
      title = `${transport.kind.toUpperCase()} \xB7 ECHO REQUEST`;
    } else if (family === "ipv4" && icmp.type === 0 || family === "ipv6" && icmp.type === 129) {
      kind = "icmp.echo-reply";
      title = `${transport.kind.toUpperCase()} \xB7 ECHO REPLY`;
    } else if (family === "ipv4" && icmp.type === 3 || family === "ipv6" && icmp.type === 1) {
      kind = "icmp.destination-unreachable";
      title = `${transport.kind.toUpperCase()} \xB7 DESTINATION UNREACHABLE`;
    } else if (family === "ipv4" && icmp.type === 11 || family === "ipv6" && icmp.type === 3) {
      kind = "icmp.time-exceeded";
      title = `${transport.kind.toUpperCase()} \xB7 TIME EXCEEDED`;
    } else if (family === "ipv6" && icmp.type === 2) {
      kind = "icmp.packet-too-big";
      title = "ICMPV6 \xB7 PACKET TOO BIG";
    }
    events2.push(eventDraft(
      draft,
      frame,
      kind.replaceAll(".", "-"),
      kind,
      title,
      `${icmp.label} was captured from ${transport.source.address} to ${transport.destination.address}.`,
      "The ICMP type/code is directly captured. Any triggering packet is unknown unless its embedded bytes are separately present and decoded.",
      "CAPTURED",
      [reference(frame, transport.kind, "icmp.type"), reference(frame, transport.kind, "icmp.code")]
    ));
    requireSemanticCapacity(events2);
  }
}
function hexTransaction(value) {
  return `0x${value.toString(16).padStart(4, "0").toUpperCase()}`;
}
function sortEvents(events2) {
  return Object.freeze([...events2].sort((a, b) => {
    if (a.relativeTimeNanoseconds !== b.relativeTimeNanoseconds) return a.relativeTimeNanoseconds < b.relativeTimeNanoseconds ? -1 : 1;
    if (a.sourceOrder !== b.sourceOrder) return a.sourceOrder - b.sourceOrder;
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    return a.id.localeCompare(b.id);
  }).map(({ sortPriority: _sortPriority, sourceOrder: _sourceOrder, ...event3 }) => deepFreeze(event3)));
}
function observedInitiator(draft) {
  for (const frame of draft.frames) {
    const direction = directionForFrame(draft, frame);
    const tcp = frame.transport?.tcp;
    if (tcp?.flags.syn && !tcp.flags.ack) return direction === "A_TO_B" ? "A" : "B";
    if (frame.dns && !frame.dns.isResponse) return direction === "A_TO_B" ? "A" : "B";
    const icmp = frame.transport?.icmp;
    if (icmp && (frame.ipFamily === "ipv4" && icmp.type === 8 || frame.ipFamily === "ipv6" && icmp.type === 128)) return direction === "A_TO_B" ? "A" : "B";
  }
  return null;
}
function finalizeConversations(drafts, events2) {
  const eventsByConversation = /* @__PURE__ */ new Map();
  for (const event3 of events2) {
    const ids = eventsByConversation.get(event3.conversationId) ?? [];
    ids.push(event3.id);
    eventsByConversation.set(event3.conversationId, ids);
  }
  return Object.freeze(drafts.map((draft) => {
    const first = draft.frames.reduce((current, frame) => frame.record.relativeTimeNanoseconds < current ? frame.record.relativeTimeNanoseconds : current, draft.frames[0]?.record.relativeTimeNanoseconds ?? 0n);
    const last = draft.frames.reduce((current, frame) => frame.record.relativeTimeNanoseconds > current ? frame.record.relativeTimeNanoseconds : current, first);
    const directionCounts = draft.frameReferences.reduce((counts, entry) => {
      counts[entry.direction] += 1;
      return counts;
    }, { A_TO_B: 0, B_TO_A: 0 });
    const hasDns = draft.frames.some((frame) => frame.dns !== null);
    const hasTls = draft.frames.some((frame) => frame.tls !== null);
    const protocol = hasDns ? "DNS" : draft.transportKind === "tcp" ? "TCP" : draft.transportKind === "udp" ? "UDP" : draft.transportKind === "icmp" ? "ICMP" : "ICMPV6";
    const applicationProtocol = hasDns ? "DNS" : hasTls ? "TLS" : null;
    const tcpHasSyn = draft.frames.some((frame) => frame.transport?.tcp?.flags.syn);
    return deepFreeze({
      id: draft.id,
      key: draft.key,
      protocol,
      applicationProtocol,
      endpointA: draft.endpointA,
      endpointB: draft.endpointB,
      frameReferences: [...draft.frameReferences].sort((a, b) => a.relativeTimeNanoseconds < b.relativeTimeNanoseconds ? -1 : a.relativeTimeNanoseconds > b.relativeTimeNanoseconds ? 1 : a.frameNumber - b.frameNumber),
      eventIds: eventsByConversation.get(draft.id) ?? [],
      frameCount: draft.frames.length,
      capturedBytes: draft.frames.reduce((sum, frame) => sum + frame.record.capturedLength, 0),
      directionCounts,
      firstObservedNanoseconds: first,
      lastObservedNanoseconds: last,
      durationNanoseconds: last - first,
      observedInitiator: observedInitiator(draft),
      captureStartedMidConversation: draft.transportKind === "tcp" && !tcpHasSyn,
      oneDirectionOnly: directionCounts.A_TO_B === 0 || directionCounts.B_TO_A === 0,
      truncatedFrameCount: draft.frames.filter((frame) => frame.record.truncated).length,
      provenance: "INFERRED"
    });
  }));
}
function buildEvents(drafts) {
  const events2 = [];
  const warnings = [];
  for (const draft of drafts) {
    if (draft.transportKind === "tcp") addTcpEvents(draft, events2, warnings);
    else addNonTcpEvents(draft, events2);
  }
  return { events: sortEvents(events2), warnings: Object.freeze(warnings) };
}
function buildMetadata(container, frames, conversations, events2) {
  let first = frames[0]?.record.timestamp ?? null;
  let last = first;
  for (const frame of frames) {
    if (!first || frame.record.timestamp.epochNanoseconds < first.epochNanoseconds) first = frame.record.timestamp;
    if (!last || frame.record.timestamp.epochNanoseconds > last.epochNanoseconds) last = frame.record.timestamp;
  }
  return deepFreeze({
    captureId: container.captureId,
    format: container.format,
    byteLength: container.byteLength,
    frameCount: frames.length,
    conversationCount: conversations.length,
    eventCount: events2.length,
    interfaceCount: container.interfaces.length,
    firstTimestamp: first,
    lastTimestamp: last,
    durationNanoseconds: first && last ? last.epochNanoseconds - first.epochNanoseconds : 0n,
    truncatedFrameCount: frames.filter((frame) => frame.record.truncated).length,
    unsupportedFrameCount: frames.filter((frame) => frame.record.linkType !== 1).length
  });
}
var CaptureSessionIndex = class {
  container;
  metadata;
  frames;
  conversations;
  events;
  warnings;
  #framesById;
  #conversationsById;
  #eventsById;
  #eventsByConversationId;
  #framesByNumber;
  #conversationIdByFrameId;
  constructor(container, frames, conversations, events2, semanticWarnings = []) {
    const decoderNotes = [];
    for (const frame of frames) {
      for (const issue of frame.issues) {
        decoderNotes.push(issue);
        if (decoderNotes.length >= 64) break;
      }
      if (decoderNotes.length >= 64) break;
    }
    this.container = container;
    this.frames = Object.freeze([...frames]);
    this.conversations = Object.freeze([...conversations]);
    this.events = Object.freeze([...events2]);
    this.metadata = buildMetadata(container, frames, conversations, events2);
    this.warnings = Object.freeze([.../* @__PURE__ */ new Set([
      ...container.warnings,
      ...this.metadata.truncatedFrameCount > 0 ? [`${this.metadata.truncatedFrameCount} frame(s) are shorter than their original wire length.`] : [],
      ...semanticWarnings,
      ...decoderNotes
    ])]);
    this.#framesById = new Map(frames.map((frame) => [frame.record.id, frame]));
    this.#conversationsById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
    this.#eventsById = new Map(events2.map((event3) => [event3.id, event3]));
    this.#eventsByConversationId = new Map(conversations.map((conversation) => [
      conversation.id,
      Object.freeze(conversation.eventIds.map((id2) => this.#eventsById.get(id2)).filter((entry) => entry !== void 0))
    ]));
    this.#framesByNumber = new Map(frames.map((frame) => [frame.record.number, frame]));
    this.#conversationIdByFrameId = new Map(conversations.flatMap((conversation) => conversation.frameReferences.map((frame) => [frame.frameId, conversation.id])));
    Object.freeze(this);
  }
  frame(frameId) {
    return this.#framesById.get(frameId) ?? null;
  }
  frameByNumber(frameNumber) {
    return this.#framesByNumber.get(frameNumber) ?? null;
  }
  conversation(conversationId) {
    return this.#conversationsById.get(conversationId) ?? null;
  }
  conversationForFrame(frameId) {
    const conversationId = this.#conversationIdByFrameId.get(frameId);
    return conversationId ? this.conversation(conversationId) : null;
  }
  event(eventId) {
    return this.#eventsById.get(eventId) ?? null;
  }
  eventsForConversation(conversationId) {
    return this.#eventsByConversationId.get(conversationId) ?? EMPTY_CAPTURE_EVENTS;
  }
  projectionAt(conversationId, requestedTimeNanoseconds) {
    const conversation = this.conversation(conversationId);
    const events2 = this.eventsForConversation(conversationId);
    const maxTime = conversation?.lastObservedNanoseconds ?? 0n;
    const clampedTimeNanoseconds = requestedTimeNanoseconds < 0n ? 0n : requestedTimeNanoseconds > maxTime ? maxTime : requestedTimeNanoseconds;
    let low = 0;
    let high = events2.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const event3 = events2[middle];
      if (event3 && event3.relativeTimeNanoseconds <= clampedTimeNanoseconds) {
        found = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    return deepFreeze({
      conversationId,
      requestedTimeNanoseconds,
      clampedTimeNanoseconds,
      currentEvent: found >= 0 ? events2[found] ?? null : null,
      currentEventIndex: found,
      completedEventIds: events2.slice(0, found + 1).map((event3) => event3.id)
    });
  }
  eventAtOrBefore(conversationId, requestedTimeNanoseconds) {
    const events2 = this.eventsForConversation(conversationId);
    let low = 0;
    let high = events2.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const event3 = events2[middle];
      if (event3 && event3.relativeTimeNanoseconds <= requestedTimeNanoseconds) {
        found = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    return found >= 0 ? events2[found] ?? null : null;
  }
  eventBefore(conversationId, eventId) {
    const events2 = this.eventsForConversation(conversationId);
    const index = eventId ? events2.findIndex((event3) => event3.id === eventId) : -1;
    return events2[Math.max(0, index - 1)] ?? null;
  }
  eventAfter(conversationId, eventId) {
    const events2 = this.eventsForConversation(conversationId);
    const index = eventId ? events2.findIndex((event3) => event3.id === eventId) : -1;
    return events2[Math.min(events2.length - 1, index + 1)] ?? null;
  }
  lineage(eventId) {
    const event3 = this.event(eventId);
    if (!event3) return null;
    const fields = [];
    for (const fieldReference of event3.fieldReferences) {
      const frame = this.frame(fieldReference.frameId);
      const capturedLayer = frame?.layers.find((candidate) => candidate.id === fieldReference.layerId);
      const capturedField = capturedLayer?.fields.find((candidate) => candidate.id === fieldReference.fieldId);
      if (!frame || !capturedLayer || !capturedField) continue;
      fields.push({
        frameId: frame.record.id,
        frameNumber: frame.record.number,
        layerId: capturedLayer.id,
        layerLabel: capturedLayer.label,
        fieldId: capturedField.id,
        fieldLabel: capturedField.label,
        displayValue: capturedField.displayValue,
        byteRanges: capturedField.byteRanges,
        bytes: capturedField.byteRanges.map((byteRange) => frame.record.bytes.hex(byteRange.offset, byteRange.length)),
        provenance: "CAPTURED"
      });
    }
    return deepFreeze({
      conversationId: event3.conversationId,
      eventId: event3.id,
      provenance: event3.provenance,
      frameIds: event3.supportingFrameIds,
      fields
    });
  }
};
function buildCaptureSessionFromContainer(container) {
  const frames = Object.freeze(container.frames.map((frame) => decodeCapturedFrame(frame)));
  const drafts = buildConversationDrafts(frames);
  const { events: events2, warnings } = buildEvents(drafts);
  const conversations = finalizeConversations(drafts, events2);
  return new CaptureSessionIndex(container, frames, conversations, events2, warnings);
}
function parseCaptureSession(input2) {
  return buildCaptureSessionFromContainer(parseCaptureContainer(input2));
}

// ../8f1a24ac8c73/hopscotch/src/builder/addressing.ts
var PRIVATE_PLAN_BASE = ipv4ToInt("10.0.0.0");
var MAX_POINT_TO_POINT_SEGMENTS = 16384;
function ipv4ToInt(value) {
  const parts = value.split(".");
  if (parts.length !== 4) throw new Error(`Invalid IPv4 address: ${value}.`);
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) throw new Error(`Invalid IPv4 address: ${value}.`);
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) throw new Error(`Invalid IPv4 address: ${value}.`);
    result = (result << 8 | octet) >>> 0;
  }
  return result >>> 0;
}
function intToIpv4(value) {
  const normalized = value >>> 0;
  return [24, 16, 8, 0].map((shift) => normalized >>> shift & 255).join(".");
}
function maskForPrefix(prefixLength2) {
  if (!Number.isInteger(prefixLength2) || prefixLength2 < 8 || prefixLength2 > 30) {
    throw new Error("Builder IPv4 prefixes must be /8 through /30.");
  }
  return prefixLength2 === 0 ? 0 : 4294967295 << 32 - prefixLength2 >>> 0;
}
function parseBuilderIpv4Cidr(value) {
  const normalized = value.trim();
  const [addressText, prefixText, ...extra] = normalized.split("/");
  if (!addressText || !prefixText || extra.length > 0 || !/^\d{1,2}$/.test(prefixText)) {
    throw new Error(`Invalid IPv4 CIDR: ${value}.`);
  }
  const address2 = ipv4ToInt(addressText);
  const prefixLength2 = Number(prefixText);
  const mask = maskForPrefix(prefixLength2);
  const network = (address2 & mask) >>> 0;
  const broadcast = (network | ~mask >>> 0) >>> 0;
  return {
    cidr: `${intToIpv4(network)}/${prefixLength2}`,
    address: intToIpv4(address2),
    prefixLength: prefixLength2,
    networkAddress: intToIpv4(network),
    broadcastAddress: intToIpv4(broadcast),
    network,
    broadcast
  };
}
function normalizeBuilderIpv4(value) {
  return intToIpv4(ipv4ToInt(value.trim()));
}
function builderIpv4IsUsableInCidr(address2, cidr) {
  const parsed = parseBuilderIpv4Cidr(cidr);
  const numeric = ipv4ToInt(address2.trim());
  return numeric > parsed.network && numeric < parsed.broadcast;
}
function cidrsOverlap(left, right) {
  const a = parseBuilderIpv4Cidr(left);
  const b = parseBuilderIpv4Cidr(right);
  return a.network <= b.broadcast && b.network <= a.broadcast;
}
function linkEndpoints(link) {
  return /* @__PURE__ */ new Set([link.a, link.b]);
}
function validateInterfaceName(value, nodeId) {
  const normalized = value.trim();
  if (!/^eth\d+$/.test(normalized)) throw new Error(`${nodeId} interface names must use ethN notation.`);
  return normalized;
}
function validateBuilderAddressing(graph4, value) {
  if (!value || typeof value !== "object" || !value.segments || !value.defaultGateways) throw new Error("Builder addressing must contain segments and default gateways.");
  const linkIds2 = new Set(graph4.links.map((link) => link.id));
  const nodeById5 = new Map(graph4.nodes.map((node) => [node.id, node]));
  const segmentKeys = Object.keys(value.segments);
  if (segmentKeys.length !== graph4.links.length || segmentKeys.some((linkId) => !linkIds2.has(linkId))) {
    throw new Error("Builder addressing must define exactly one IPv4 segment for every graph link.");
  }
  const segments = {};
  const cidrs = [];
  const globalAddresses = /* @__PURE__ */ new Map();
  const interfaceNamesByNode = /* @__PURE__ */ new Map();
  for (const link of graph4.links) {
    const raw = value.segments[link.id];
    if (!raw || raw.linkId !== link.id || !Array.isArray(raw.interfaces) || raw.interfaces.length !== 2) {
      throw new Error(`Link ${link.id} must have one two-interface IPv4 segment.`);
    }
    const parsedCidr = parseBuilderIpv4Cidr(raw.cidr);
    const expectedEndpoints = linkEndpoints(link);
    const seenEndpoints = /* @__PURE__ */ new Set();
    const interfaces = raw.interfaces.map((rawInterface) => {
      if (!expectedEndpoints.has(rawInterface.nodeId) || seenEndpoints.has(rawInterface.nodeId)) {
        throw new Error(`Segment ${link.id} interfaces must match graph endpoints ${link.a} and ${link.b} exactly.`);
      }
      seenEndpoints.add(rawInterface.nodeId);
      const name = validateInterfaceName(rawInterface.name, rawInterface.nodeId);
      const address2 = normalizeBuilderIpv4(rawInterface.address);
      if (!builderIpv4IsUsableInCidr(address2, parsedCidr.cidr)) {
        throw new Error(`${rawInterface.nodeId} ${name} address ${address2} is not a usable host in ${parsedCidr.cidr}.`);
      }
      const priorAddressOwner = globalAddresses.get(address2);
      if (priorAddressOwner) throw new Error(`IPv4 address ${address2} is already assigned to ${priorAddressOwner}.`);
      globalAddresses.set(address2, `${rawInterface.nodeId} ${name}`);
      const names = interfaceNamesByNode.get(rawInterface.nodeId) ?? /* @__PURE__ */ new Set();
      if (names.has(name)) throw new Error(`${rawInterface.nodeId} has duplicate interface name ${name}.`);
      names.add(name);
      interfaceNamesByNode.set(rawInterface.nodeId, names);
      return { nodeId: rawInterface.nodeId, name, address: address2 };
    });
    segments[link.id] = { linkId: link.id, cidr: parsedCidr.cidr, interfaces };
    cidrs.push({ linkId: link.id, cidr: parsedCidr.cidr });
  }
  for (let index = 0; index < cidrs.length; index += 1) {
    for (let other = index + 1; other < cidrs.length; other += 1) {
      if (cidrsOverlap(cidrs[index].cidr, cidrs[other].cidr)) {
        throw new Error(`IPv4 segments ${cidrs[index].linkId} (${cidrs[index].cidr}) and ${cidrs[other].linkId} (${cidrs[other].cidr}) overlap.`);
      }
    }
  }
  const defaultGateways = {};
  const endpointIds = graph4.nodes.filter((node) => node.kind === "endpoint").map((node) => node.id);
  for (const [nodeId] of Object.entries(value.defaultGateways)) {
    const node = nodeById5.get(nodeId);
    if (!node || node.kind !== "endpoint") throw new Error(`Default gateway is only valid for endpoint nodes; ${nodeId} is not an endpoint.`);
  }
  for (const nodeId of endpointIds) {
    const rawGateway = value.defaultGateways[nodeId] ?? null;
    if (rawGateway === null) {
      defaultGateways[nodeId] = null;
      continue;
    }
    const gateway = normalizeBuilderIpv4(rawGateway);
    const directlyConnectedRouterAddresses = graph4.links.flatMap((link) => {
      if (link.a !== nodeId && link.b !== nodeId) return [];
      const neighborId = link.a === nodeId ? link.b : link.a;
      if (nodeById5.get(neighborId)?.kind !== "router") return [];
      const segment = segments[link.id];
      return segment.interfaces.filter((entry) => entry.nodeId === neighborId).map((entry) => entry.address);
    });
    if (!directlyConnectedRouterAddresses.includes(gateway)) {
      throw new Error(`${nodeId} default gateway ${gateway} must be the address of a directly connected router interface.`);
    }
    defaultGateways[nodeId] = gateway;
  }
  return { segments, defaultGateways };
}
function nextInterfaceName(addressing3, nodeId) {
  const used = new Set(Object.values(addressing3.segments).flatMap((segment) => segment.interfaces.filter((entry) => entry.nodeId === nodeId).map((entry) => entry.name)));
  let index = 0;
  while (used.has(`eth${index}`)) index += 1;
  return `eth${index}`;
}
function nextFreePrivateCidr(addressing3) {
  const used = new Set(Object.values(addressing3.segments).map((segment) => parseBuilderIpv4Cidr(segment.cidr).network));
  for (let index = 0; index < MAX_POINT_TO_POINT_SEGMENTS; index += 1) {
    const network = PRIVATE_PLAN_BASE + index * 4 >>> 0;
    if (!used.has(network)) return `${intToIpv4(network)}/30`;
  }
  throw new Error("No free deterministic private /30 remains in the Builder address plan.");
}
function makeSegment(addressing3, link) {
  const cidr = nextFreePrivateCidr(addressing3);
  const parsed = parseBuilderIpv4Cidr(cidr);
  return {
    linkId: link.id,
    cidr,
    interfaces: [
      { nodeId: link.a, name: nextInterfaceName(addressing3, link.a), address: intToIpv4(parsed.network + 1) },
      { nodeId: link.b, name: nextInterfaceName(addressing3, link.b), address: intToIpv4(parsed.network + 2) }
    ]
  };
}
function preferredGatewayForEndpoint(graph4, addressing3, nodeId) {
  const nodeById5 = new Map(graph4.nodes.map((node) => [node.id, node]));
  const candidateLinks = graph4.links.filter((link) => link.a === nodeId || link.b === nodeId).sort((a, b) => a.id.localeCompare(b.id));
  for (const link of candidateLinks) {
    const neighborId = link.a === nodeId ? link.b : link.a;
    if (nodeById5.get(neighborId)?.kind !== "router") continue;
    const neighbor = addressing3.segments[link.id]?.interfaces.find((entry) => entry.nodeId === neighborId);
    if (neighbor) return neighbor.address;
  }
  return null;
}
function createDefaultBuilderAddressing(graph4) {
  let addressing3 = { segments: {}, defaultGateways: {} };
  for (const link of [...graph4.links].sort((a, b) => a.id.localeCompare(b.id))) {
    const segment = makeSegment(addressing3, link);
    addressing3 = { ...addressing3, segments: { ...addressing3.segments, [link.id]: segment } };
  }
  for (const node of graph4.nodes.filter((entry) => entry.kind === "endpoint")) {
    addressing3.defaultGateways[node.id] = preferredGatewayForEndpoint(graph4, addressing3, node.id);
  }
  return validateBuilderAddressing(graph4, addressing3);
}
function interfacesForBuilderNode(addressing3, nodeId) {
  return Object.values(addressing3.segments).flatMap((segment) => segment.interfaces.filter((entry) => entry.nodeId === nodeId).map((entry) => ({ ...entry, linkId: segment.linkId, cidr: segment.cidr }))).sort((a, b) => a.name.localeCompare(b.name) || a.linkId.localeCompare(b.linkId));
}

// ../8f1a24ac8c73/hopscotch/src/builder/provider-config.ts
function ipInt(value) {
  return normalizeBuilderIpv4(value).split(".").reduce((n, p) => (n << 8 | Number(p)) >>> 0, 0) >>> 0;
}
function prefix(value) {
  const [raw, lenText, ...extra] = String(value ?? "").trim().split("/");
  const len = Number(lenText);
  if (!raw || extra.length || !Number.isInteger(len) || len < 0 || len > 32) throw new Error(`Invalid IPv4 prefix ${value}.`);
  const address2 = ipInt(raw), mask = len === 0 ? 0 : 4294967295 << 32 - len >>> 0, network = (address2 & mask) >>> 0;
  return { cidr: `${[24, 16, 8, 0].map((s) => network >>> s & 255).join(".")}/${len}`, network, mask };
}
function contains(cidr, address2) {
  const p = prefix(cidr);
  return (ipInt(address2) & p.mask) >>> 0 === p.network;
}
function text(value, max = 100) {
  return String(value ?? "").trim().slice(0, max);
}
function id(value, label, seen) {
  const result = text(value, 160);
  if (!result || !/^[a-zA-Z0-9_.:-]+$/.test(result) || seen.has(result)) throw new Error(`${label} needs a unique id.`);
  seen.add(result);
  return result;
}
function mac(value) {
  const raw = String(value ?? "").trim().toLowerCase().replaceAll("-", ":");
  if (!/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/.test(raw)) throw new Error(`Invalid MAC address ${String(value)}.`);
  return raw;
}
function routerIds(graph4) {
  return new Set(graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id));
}
function routerAddressSet(addressing3, routerId) {
  return new Set(interfacesForBuilderNode(addressing3, routerId).map((entry) => entry.address));
}
function createDefaultBuilderProviderConfig() {
  return { tunnels: [], mpls: { enabledRouterIds: [], lsps: [] }, vxlan: { vteps: [], vnis: [], bindings: [], evpnEnabled: false } };
}
function cloneBuilderProviderConfig(value) {
  return structuredClone(value ?? createDefaultBuilderProviderConfig());
}
function validateBuilderProviderConfig(graph4, addressing3, value) {
  const raw = value ?? createDefaultBuilderProviderConfig(), routers = routerIds(graph4), tunnelIds = /* @__PURE__ */ new Set();
  const tunnels = (raw.tunnels ?? []).map((entry, index) => {
    const tunnelId = id(entry?.id, `Tunnel ${index + 1}`, tunnelIds);
    const kind = ["gre", "ipip", "ipsec", "wireguard"].includes(entry?.kind) ? entry.kind : "gre";
    const sourceRouterId = String(entry?.sourceRouterId ?? ""), destinationRouterId = String(entry?.destinationRouterId ?? "");
    if (!routers.has(sourceRouterId) || !routers.has(destinationRouterId) || sourceRouterId === destinationRouterId) throw new Error(`Tunnel ${tunnelId} must connect two distinct routed Builder routers.`);
    const overlayPrefix = prefix(String(entry?.overlayPrefix ?? "")).cidr, localTunnelAddress = normalizeBuilderIpv4(String(entry?.localTunnelAddress ?? "")), remoteTunnelAddress = normalizeBuilderIpv4(String(entry?.remoteTunnelAddress ?? ""));
    if (localTunnelAddress === remoteTunnelAddress || !contains(overlayPrefix, localTunnelAddress) || !contains(overlayPrefix, remoteTunnelAddress)) throw new Error(`Tunnel ${tunnelId} addresses must be distinct members of ${overlayPrefix}.`);
    const encrypted2 = kind === "ipsec" || kind === "wireguard";
    const securityState = encrypted2 && ["ready", "auth-failed", "key-missing", "handshake-down"].includes(entry?.securityState) ? entry.securityState : "none";
    return { id: tunnelId, kind, sourceRouterId, destinationRouterId, overlayPrefix, localTunnelAddress, remoteTunnelAddress, enabled: entry?.enabled !== false, securityState, description: text(entry?.description) };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const enabledRouterIds = [...new Set((raw.mpls?.enabledRouterIds ?? []).map(String))].sort();
  if (enabledRouterIds.some((routerId) => !routers.has(routerId))) throw new Error("MPLS may only be enabled on routed Builder routers.");
  const mplsSet = new Set(enabledRouterIds), lspIds = /* @__PURE__ */ new Set();
  const lsps = (raw.mpls?.lsps ?? []).map((entry, index) => {
    const lspId = id(entry?.id, `MPLS LSP ${index + 1}`, lspIds);
    const ingressRouterId = String(entry?.ingressRouterId ?? ""), egressRouterId = String(entry?.egressRouterId ?? "");
    if (ingressRouterId === egressRouterId || !mplsSet.has(ingressRouterId) || !mplsSet.has(egressRouterId)) throw new Error(`MPLS LSP ${lspId} endpoints must both have MPLS enabled.`);
    return { id: lspId, ingressRouterId, egressRouterId, fecPrefix: prefix(String(entry?.fecPrefix ?? "")).cidr, enabled: entry?.enabled !== false, description: text(entry?.description) };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const vtepIds = /* @__PURE__ */ new Set();
  const vteps = (raw.vxlan?.vteps ?? []).map((entry, index) => {
    const routerId = String(entry?.routerId ?? "");
    if (!routers.has(routerId) || vtepIds.has(routerId)) throw new Error(`VTEP ${index + 1} must reference a unique routed Builder router.`);
    vtepIds.add(routerId);
    const sourceAddress = normalizeBuilderIpv4(String(entry?.sourceAddress ?? ""));
    if (!routerAddressSet(addressing3, routerId).has(sourceAddress)) throw new Error(`VTEP ${routerId} source ${sourceAddress} must be an address owned by that router.`);
    return { routerId, sourceAddress, enabled: entry?.enabled !== false };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId));
  const vniIds = /* @__PURE__ */ new Set(), vniNumbers = /* @__PURE__ */ new Set();
  const vnis = (raw.vxlan?.vnis ?? []).map((entry, index) => {
    const vniId = id(entry?.id, `VNI ${index + 1}`, vniIds);
    const vni3 = Math.round(Number(entry?.vni));
    if (!Number.isInteger(vni3) || vni3 < 1 || vni3 > 16777215 || vniNumbers.has(vni3)) throw new Error(`VNI ${vniId} must use a unique value from 1\u201316777215.`);
    vniNumbers.add(vni3);
    const memberVtepRouterIds = [...new Set((entry?.memberVtepRouterIds ?? []).map(String))].sort();
    if (memberVtepRouterIds.length < 2 || memberVtepRouterIds.some((routerId) => !vtepIds.has(routerId))) throw new Error(`VNI ${vniId} requires at least two configured VTEPs.`);
    const routeTarget = text(entry?.routeTarget, 32);
    if (!/^\d{1,10}:\d{1,10}$/.test(routeTarget)) throw new Error(`VNI ${vniId} route target must use ASN:value notation.`);
    return { id: vniId, vni: vni3, memberVtepRouterIds, routeTarget, description: text(entry?.description) };
  }).sort((a, b) => a.vni - b.vni);
  const vniSet = new Set(vnis.map((entry) => entry.vni)), bindingIds = /* @__PURE__ */ new Set();
  const bindings = (raw.vxlan?.bindings ?? []).map((entry, index) => {
    const bindingId = id(entry?.id, `EVPN binding ${index + 1}`, bindingIds), vni3 = Math.round(Number(entry?.vni)), vtepRouterId = String(entry?.vtepRouterId ?? "");
    const vniConfig = vnis.find((candidate) => candidate.vni === vni3);
    if (!vniSet.has(vni3) || !vniConfig?.memberVtepRouterIds.includes(vtepRouterId)) throw new Error(`EVPN binding ${bindingId} must attach to a member VTEP of VNI ${vni3}.`);
    const ip = entry?.ip == null || String(entry.ip).trim() === "" ? null : normalizeBuilderIpv4(String(entry.ip));
    return { id: bindingId, vni: vni3, vtepRouterId, mac: mac(entry?.mac), ip, attachment: text(entry?.attachment, 64) || "LOCAL ATTACHMENT", description: text(entry?.description) };
  }).sort((a, b) => a.vni - b.vni || a.mac.localeCompare(b.mac) || a.vtepRouterId.localeCompare(b.vtepRouterId));
  return { tunnels, mpls: { enabledRouterIds, lsps }, vxlan: { vteps, vnis, bindings, evpnEnabled: raw.vxlan?.evpnEnabled === true } };
}
function reconcileBuilderProviderConfig(graph4, addressing3, value) {
  const next = cloneBuilderProviderConfig(value), routers = routerIds(graph4);
  next.tunnels = next.tunnels.filter((entry) => routers.has(entry.sourceRouterId) && routers.has(entry.destinationRouterId));
  next.mpls.enabledRouterIds = next.mpls.enabledRouterIds.filter((id2) => routers.has(id2));
  const mpls = new Set(next.mpls.enabledRouterIds);
  next.mpls.lsps = next.mpls.lsps.filter((entry) => mpls.has(entry.ingressRouterId) && mpls.has(entry.egressRouterId));
  next.vxlan.vteps = next.vxlan.vteps.filter((entry) => routers.has(entry.routerId) && routerAddressSet(addressing3, entry.routerId).has(entry.sourceAddress));
  const vteps = new Set(next.vxlan.vteps.map((entry) => entry.routerId));
  next.vxlan.vnis = next.vxlan.vnis.map((entry) => ({ ...entry, memberVtepRouterIds: entry.memberVtepRouterIds.filter((id2) => vteps.has(id2)) })).filter((entry) => entry.memberVtepRouterIds.length >= 2);
  const vnis = new Map(next.vxlan.vnis.map((entry) => [entry.vni, entry]));
  next.vxlan.bindings = next.vxlan.bindings.filter((entry) => vnis.get(entry.vni)?.memberVtepRouterIds.includes(entry.vtepRouterId));
  return validateBuilderProviderConfig(graph4, addressing3, next);
}

// ../8f1a24ac8c73/hopscotch/src/builder/bgp.ts
function ipv4ToInt2(value) {
  return normalizeBuilderIpv4(value).split(".").reduce((result, part) => (result << 8 | Number(part)) >>> 0, 0) >>> 0;
}
function intToIpv42(value) {
  const n = value >>> 0;
  return [24, 16, 8, 0].map((shift) => n >>> shift & 255).join(".");
}
function parsePrefix(value) {
  const [rawAddress, rawLength, ...extra] = String(value ?? "").trim().split("/");
  if (!rawAddress || rawLength == null || extra.length || !/^\d{1,2}$/.test(rawLength)) throw new Error(`Invalid BGP IPv4 prefix ${value}.`);
  const prefixLength2 = Number(rawLength);
  if (!Number.isInteger(prefixLength2) || prefixLength2 < 0 || prefixLength2 > 32) throw new Error("BGP prefixes must be /0 through /32.");
  const address2 = ipv4ToInt2(rawAddress);
  const mask = prefixLength2 === 0 ? 0 : 4294967295 << 32 - prefixLength2 >>> 0;
  const network = (address2 & mask) >>> 0;
  const broadcast = (network | ~mask >>> 0) >>> 0;
  return { cidr: `${intToIpv42(network)}/${prefixLength2}`, prefixLength: prefixLength2, network, broadcast };
}
function prefixContainsPrefix(parent, child) {
  const a = parsePrefix(parent), b = parsePrefix(child);
  return a.prefixLength <= b.prefixLength && a.network <= b.network && a.broadcast >= b.broadcast;
}
function nodeIsRouter(graph4, id2) {
  return graph4.nodes.find((node) => node.id === id2)?.kind === "router";
}
function directLink(graph4, a, b) {
  return graph4.links.find((link) => link.a === a && link.b === b || link.a === b && link.b === a);
}
function interfaceAddress(addressing3, linkId, nodeId) {
  return addressing3.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nodeId)?.address ?? null;
}
function primaryAddress(addressing3, nodeId) {
  return interfacesForBuilderNode(addressing3, nodeId)[0]?.address ?? "0.0.0.0";
}
function normalizeCommunities(values) {
  return [...new Set(values.map((value) => String(value).trim().toUpperCase()).filter((value) => /^\d{1,10}:\d{1,10}$/.test(value) || value === "NO_EXPORT" || value === "NO_ADVERTISE"))].sort();
}
function createDefaultBuilderBgpConfig() {
  return { routerAsns: {}, enabledRouterIds: [], sessions: [], origins: [], policies: [] };
}
function cloneBuilderBgpConfig(value) {
  return { routerAsns: { ...value?.routerAsns ?? {} }, enabledRouterIds: [...value?.enabledRouterIds ?? []], sessions: (value?.sessions ?? []).map((entry) => ({ ...entry })), origins: (value?.origins ?? []).map((entry) => ({ ...entry, communities: [...entry.communities] })), policies: (value?.policies ?? []).map((entry) => ({ ...entry })) };
}
function builderBgpAsnForRouter(graph4, config, routerId) {
  const explicit = config.routerAsns?.[routerId];
  if (explicit && isDocumentationAsn(explicit)) return explicit;
  const routers = graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id).sort();
  const index = Math.max(0, routers.indexOf(routerId));
  return DOCUMENTATION_ASNS[index % DOCUMENTATION_ASNS.length];
}
function validateBuilderBgpConfig(graph4, value) {
  const raw = value ?? createDefaultBuilderBgpConfig();
  const routers = new Set(graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id));
  const routerAsns = {};
  for (const [routerId, rawAsn] of Object.entries(raw.routerAsns ?? {})) {
    if (!routers.has(routerId)) throw new Error(`BGP ASN override references non-router ${routerId}.`);
    const asn = Number(rawAsn);
    if (!isDocumentationAsn(asn)) throw new Error(`BGP ASN ${asn} is outside HOPSCOTCH documentation ASN ranges.`);
    routerAsns[routerId] = asn;
  }
  const enabledRouterIds = [...new Set((raw.enabledRouterIds ?? []).map(String))].sort();
  if (enabledRouterIds.some((id2) => !routers.has(id2))) throw new Error("BGP can only be enabled on router nodes.");
  const sessionIds = /* @__PURE__ */ new Set();
  const sessions = (raw.sessions ?? []).map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`BGP session ${index + 1} is invalid.`);
    const id2 = String(entry.id ?? "").trim();
    if (!id2 || sessionIds.has(id2)) throw new Error(`BGP session ${index + 1} needs a unique id.`);
    sessionIds.add(id2);
    const aRouterId = String(entry.aRouterId ?? ""), bRouterId = String(entry.bRouterId ?? ""), linkId = String(entry.linkId ?? "");
    if (!routers.has(aRouterId) || !routers.has(bRouterId) || aRouterId === bRouterId) throw new Error(`BGP session ${id2} must connect two routers.`);
    const link = directLink(graph4, aRouterId, bRouterId);
    if (!link || link.id !== linkId) throw new Error(`BGP session ${id2} must use the direct Builder router link.`);
    const aAsn = builderBgpAsnForRouter(graph4, { ...raw, routerAsns }, aRouterId), bAsn = builderBgpAsnForRouter(graph4, { ...raw, routerAsns }, bRouterId);
    let relationship = entry.relationship;
    let customerRouterId = entry.customerRouterId ? String(entry.customerRouterId) : null;
    if (aAsn === bAsn) {
      relationship = "internal";
      customerRouterId = null;
    } else {
      if (relationship !== "peer" && relationship !== "customer-provider") relationship = "peer";
      if (relationship === "customer-provider" && customerRouterId !== aRouterId && customerRouterId !== bRouterId) customerRouterId = aRouterId;
      if (relationship === "peer") customerRouterId = null;
    }
    const routeReflectorClientRouterId = relationship === "internal" && (entry.routeReflectorClientRouterId === aRouterId || entry.routeReflectorClientRouterId === bRouterId) ? String(entry.routeReflectorClientRouterId) : null;
    const holdTimeMs = Math.max(3e3, Math.min(18e4, Math.round(Number(entry.holdTimeMs) || 9e4)));
    return { id: id2, linkId, aRouterId, bRouterId, enabled: entry.enabled !== false, relationship, customerRouterId, nextHopSelf: entry.nextHopSelf === true, allowRelationshipLeak: entry.allowRelationshipLeak === true, routeReflectorClientRouterId, holdTimeMs };
  });
  const originIds = /* @__PURE__ */ new Set();
  const origins = (raw.origins ?? []).map((entry, index) => {
    const routerId = String(entry.routerId ?? "");
    if (!routers.has(routerId)) throw new Error(`BGP origin ${index + 1} belongs to a non-router.`);
    const prefix2 = parsePrefix(String(entry.prefix ?? "")).cidr;
    const id2 = String(entry.id ?? `bgp-origin:${routerId}:${prefix2}`).trim();
    if (!id2 || originIds.has(id2)) throw new Error(`BGP origin ${index + 1} needs a unique id.`);
    originIds.add(id2);
    const med = Math.max(0, Math.min(4294967295, Math.round(Number(entry.med) || 0)));
    return { id: id2, routerId, prefix: prefix2, med, communities: normalizeCommunities(entry.communities ?? []), description: String(entry.description ?? "").slice(0, 100) };
  });
  const policyIds = /* @__PURE__ */ new Set();
  const policies = (raw.policies ?? []).map((entry, index) => {
    const routerId = String(entry.routerId ?? "");
    if (!routers.has(routerId)) throw new Error(`BGP policy ${index + 1} belongs to a non-router.`);
    const direction = entry.direction === "export" ? "export" : "import";
    const sessionId = entry.sessionId == null ? null : String(entry.sessionId);
    if (sessionId && !sessionIds.has(sessionId)) throw new Error(`BGP policy ${index + 1} references unknown session ${sessionId}.`);
    const order = Math.max(1, Math.min(65535, Math.round(Number(entry.order) || 10)));
    const prefix2 = parsePrefix(String(entry.prefix ?? "0.0.0.0/0")).cidr;
    const action = entry.action === "deny" ? "deny" : "permit";
    const id2 = String(entry.id ?? `bgp-policy:${routerId}:${direction}:${sessionId ?? "any"}:${order}`).trim();
    if (!id2 || policyIds.has(id2)) throw new Error(`BGP policy ${index + 1} needs a unique id.`);
    policyIds.add(id2);
    const local = entry.setLocalPref == null ? null : Math.max(0, Math.min(4294967295, Math.round(Number(entry.setLocalPref) || 0)));
    const med = entry.setMed == null ? null : Math.max(0, Math.min(4294967295, Math.round(Number(entry.setMed) || 0)));
    const normalizeOne = (value2) => {
      const text2 = String(value2 ?? "").trim().toUpperCase();
      return /^\d{1,10}:\d{1,10}$/.test(text2) || text2 === "NO_EXPORT" || text2 === "NO_ADVERTISE" ? text2 : null;
    };
    const community = normalizeOne(entry.addCommunity), matchCommunity = normalizeOne(entry.matchCommunity), removeCommunity = normalizeOne(entry.removeCommunity);
    const prependAsCount = Math.max(0, Math.min(8, Math.round(Number(entry.prependAsCount) || 0)));
    return { id: id2, routerId, direction, sessionId, order, action, prefix: prefix2, setLocalPref: local, setMed: med, addCommunity: community, matchCommunity, removeCommunity, prependAsCount, allowRelationshipLeak: entry.allowRelationshipLeak === true, description: String(entry.description ?? "").slice(0, 100) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.direction.localeCompare(b.direction) || a.order - b.order || a.id.localeCompare(b.id));
  return { routerAsns, enabledRouterIds, sessions: sessions.sort((a, b) => a.id.localeCompare(b.id)), origins: origins.sort((a, b) => a.id.localeCompare(b.id)), policies };
}
function reconcileBuilderBgpConfig(graph4, current) {
  const routers = new Set(graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id));
  const next = cloneBuilderBgpConfig(current ?? createDefaultBuilderBgpConfig());
  next.routerAsns = Object.fromEntries(Object.entries(next.routerAsns).filter(([id2]) => routers.has(id2)));
  next.enabledRouterIds = next.enabledRouterIds.filter((id2) => routers.has(id2));
  next.sessions = next.sessions.filter((entry) => routers.has(entry.aRouterId) && routers.has(entry.bRouterId) && directLink(graph4, entry.aRouterId, entry.bRouterId)?.id === entry.linkId);
  const sessionIds = new Set(next.sessions.map((entry) => entry.id));
  next.origins = next.origins.filter((entry) => routers.has(entry.routerId));
  next.policies = next.policies.filter((entry) => routers.has(entry.routerId) && (!entry.sessionId || sessionIds.has(entry.sessionId)));
  return validateBuilderBgpConfig(graph4, next);
}
function setBuilderBgpRouterEnabled(graph4, config, routerId, enabled) {
  if (!nodeIsRouter(graph4, routerId)) throw new Error(`${routerId} is not a router.`);
  const next = reconcileBuilderBgpConfig(graph4, config);
  const ids = new Set(next.enabledRouterIds);
  if (enabled) ids.add(routerId);
  else ids.delete(routerId);
  next.enabledRouterIds = [...ids].sort();
  return validateBuilderBgpConfig(graph4, next);
}
function setBuilderBgpRouterAsn(graph4, config, routerId, asn) {
  if (!nodeIsRouter(graph4, routerId)) throw new Error(`${routerId} is not a router.`);
  if (!isDocumentationAsn(asn)) throw new Error("Use RFC 5398 documentation ASNs: 64496\u201364511 or 65536\u201365551.");
  const next = reconcileBuilderBgpConfig(graph4, config);
  next.routerAsns[routerId] = asn;
  return validateBuilderBgpConfig(graph4, next);
}
function upsertBuilderBgpSession(graph4, config, linkId, relationship = "peer") {
  const link = graph4.links.find((entry) => entry.id === linkId);
  if (!link || !nodeIsRouter(graph4, link.a) || !nodeIsRouter(graph4, link.b)) throw new Error("BGP sessions require a direct router-router Builder link.");
  const next = reconcileBuilderBgpConfig(graph4, config);
  const aAsn = builderBgpAsnForRouter(graph4, next, link.a), bAsn = builderBgpAsnForRouter(graph4, next, link.b);
  const id2 = `bgp-session:${link.id}`;
  const prior = next.sessions.find((entry) => entry.id === id2);
  const session = { id: id2, linkId: link.id, aRouterId: link.a, bRouterId: link.b, enabled: true, relationship: aAsn === bAsn ? "internal" : relationship, customerRouterId: aAsn === bAsn || relationship === "peer" ? null : prior?.customerRouterId ?? link.a, nextHopSelf: prior?.nextHopSelf ?? false, allowRelationshipLeak: prior?.allowRelationshipLeak ?? false, routeReflectorClientRouterId: prior?.routeReflectorClientRouterId ?? null, holdTimeMs: prior?.holdTimeMs ?? 9e4 };
  next.sessions = [...next.sessions.filter((entry) => entry.id !== id2), session];
  next.enabledRouterIds = [.../* @__PURE__ */ new Set([...next.enabledRouterIds, link.a, link.b])].sort();
  return validateBuilderBgpConfig(graph4, next);
}
function updateBuilderBgpSession(graph4, config, sessionId, patch) {
  const next = reconcileBuilderBgpConfig(graph4, config);
  const prior = next.sessions.find((entry) => entry.id === sessionId);
  if (!prior) throw new Error(`Unknown BGP session ${sessionId}.`);
  next.sessions = next.sessions.map((entry) => entry.id === sessionId ? { ...entry, ...patch } : entry);
  return validateBuilderBgpConfig(graph4, next);
}
function upsertBuilderBgpOrigin(graph4, config, input2) {
  if (!nodeIsRouter(graph4, input2.routerId)) throw new Error(`${input2.routerId} is not a router.`);
  const prefix2 = parsePrefix(input2.prefix).cidr;
  const next = reconcileBuilderBgpConfig(graph4, config);
  const id2 = input2.id?.trim() || `bgp-origin:${input2.routerId}:${prefix2}`.replace("/", "_");
  next.origins = [...next.origins.filter((entry) => entry.id !== id2 && !(entry.routerId === input2.routerId && entry.prefix === prefix2)), { id: id2, routerId: input2.routerId, prefix: prefix2, med: Math.max(0, Math.round(input2.med)), communities: normalizeCommunities(input2.communities), description: input2.description.slice(0, 100) }];
  next.enabledRouterIds = [.../* @__PURE__ */ new Set([...next.enabledRouterIds, input2.routerId])].sort();
  return validateBuilderBgpConfig(graph4, next);
}
function relationshipFrom(routerId, session) {
  if (session.relationship === "peer") return "peer";
  if (session.relationship === "internal") throw new Error("Internal session has no external relationship.");
  return session.customerRouterId === routerId ? "provider" : "customer";
}
function receivedRelationship(receiverId, session) {
  if (session.relationship === "peer") return "peer";
  if (session.relationship === "internal") return "local";
  return session.customerRouterId === receiverId ? "provider" : "customer";
}
function sessionMode(graph4, config, session) {
  return builderBgpAsnForRouter(graph4, config, session.aRouterId) === builderBgpAsnForRouter(graph4, config, session.bRouterId) ? "ibgp" : "ebgp";
}
function firstPolicy(config, routerId, direction, sessionId, route) {
  return config.policies.filter((rule) => rule.routerId === routerId && rule.direction === direction && (!rule.sessionId || rule.sessionId === sessionId) && prefixContainsPrefix(rule.prefix, route.prefix) && (!rule.matchCommunity || route.communities.includes(rule.matchCommunity))).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))[0] ?? null;
}
function mutateAttrs(route, rule) {
  if (!rule) return route;
  let communities = route.communities.filter((value) => value !== rule.removeCommunity);
  if (rule.addCommunity) communities = [...communities, rule.addCommunity];
  return { ...route, localPref: rule.setLocalPref ?? route.localPref, med: rule.setMed ?? route.med, communities: normalizeCommunities(communities) };
}
function routeFingerprint(route) {
  return [route.routerId, route.prefix, route.originRouterId, route.learnedFromRouterId ?? "", route.learnedSessionId ?? "", route.learnedVia, route.learnedFromRelationship, route.asPath.join(","), route.localPref, route.med, route.nextHopRouterId, route.nextHopAddress, route.communities.join(","), route.policyAnomaly, route.reflectionPath.join(",")].join("|");
}
function compareRoute(left, right) {
  return right.localPref - left.localPref || left.asPath.length - right.asPath.length || left.med - right.med || ["local", "ebgp", "ibgp"].indexOf(left.learnedVia) - ["local", "ebgp", "ibgp"].indexOf(right.learnedVia) || left.nextHopRouterId.localeCompare(right.nextHopRouterId) || left.originRouterId.localeCompare(right.originRouterId) || left.id.localeCompare(right.id);
}
function bestReason(route) {
  return `BEST \xB7 LOCAL_PREF ${route.localPref} \u2192 AS_PATH ${route.asPath.length} \u2192 MED ${route.med} \u2192 ${route.learnedVia.toUpperCase()} \u2192 STABLE ROUTER-ID TIE BREAK`;
}
function establishedSessions(graph4, addressing3, config) {
  const enabled = new Set(config.enabledRouterIds);
  return config.sessions.map((session) => {
    const aAsn = builderBgpAsnForRouter(graph4, config, session.aRouterId), bAsn = builderBgpAsnForRouter(graph4, config, session.bRouterId), mode = aAsn === bAsn ? "ibgp" : "ebgp";
    const link = graph4.links.find((entry) => entry.id === session.linkId);
    const validAddresses = Boolean(interfaceAddress(addressing3, session.linkId, session.aRouterId) && interfaceAddress(addressing3, session.linkId, session.bRouterId));
    const ok = session.enabled && enabled.has(session.aRouterId) && enabled.has(session.bRouterId) && Boolean(link && !link.failed) && validAddresses;
    const state = ok ? "ESTABLISHED" : "IDLE";
    return { id: session.id, linkId: session.linkId, aRouterId: session.aRouterId, bRouterId: session.bRouterId, aAsn, bAsn, mode, state, relationship: session.relationship, reason: !session.enabled ? "ADMIN DOWN" : !enabled.has(session.aRouterId) || !enabled.has(session.bRouterId) ? "BGP DISABLED ON PEER" : link?.failed ? "LINK DOWN" : !validAddresses ? "NO IPV4 PEERING ADDRESS" : "TCP/179 TEACHING SESSION ESTABLISHED" };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
function localRoutes(graph4, addressing3, config) {
  const rib = /* @__PURE__ */ new Map();
  for (const routerId of config.enabledRouterIds) rib.set(routerId, /* @__PURE__ */ new Map());
  for (const origin of config.origins) {
    if (!rib.has(origin.routerId)) continue;
    const asn = builderBgpAsnForRouter(graph4, config, origin.routerId);
    const route = { id: `bgp:${origin.routerId}:${origin.prefix}:local`, routerId: origin.routerId, prefix: origin.prefix, originRouterId: origin.routerId, originAsn: asn, learnedFromRouterId: null, learnedSessionId: null, learnedVia: "local", learnedFromRelationship: "local", asPath: [], localPref: 100, med: origin.med, nextHopRouterId: origin.routerId, nextHopAddress: primaryAddress(addressing3, origin.routerId), communities: [...origin.communities], policyAnomaly: false, best: false, bestReason: "", reflectionPath: [] };
    if (!rib.get(origin.routerId).has(origin.prefix)) rib.get(origin.routerId).set(origin.prefix, /* @__PURE__ */ new Map());
    rib.get(origin.routerId).get(origin.prefix).set(`local:${origin.id}`, route);
  }
  return rib;
}
function cloneRib(source) {
  const next = /* @__PURE__ */ new Map();
  for (const [router, prefixes] of source) {
    const p = /* @__PURE__ */ new Map();
    for (const [prefix2, routes] of prefixes) p.set(prefix2, new Map([...routes].map(([key2, route]) => [key2, { ...route, asPath: [...route.asPath], communities: [...route.communities], reflectionPath: [...route.reflectionPath] }])));
    next.set(router, p);
  }
  return next;
}
function bestMap(rib) {
  const result = /* @__PURE__ */ new Map();
  for (const [router, prefixes] of rib) {
    const map = /* @__PURE__ */ new Map();
    for (const [prefix2, routes] of prefixes) {
      const best = [...routes.values()].sort(compareRoute)[0];
      if (best) map.set(prefix2, best);
    }
    result.set(router, map);
  }
  return result;
}
function ribFingerprint(rib) {
  return [...rib].flatMap(([router, prefixes]) => [...prefixes].flatMap(([prefix2, routes]) => [...routes].map(([source, route]) => `${router}|${prefix2}|${source}|${routeFingerprint(route)}`))).sort().join("\n");
}
function advertise(graph4, addressing3, config, session, senderId, receiverId, input2) {
  const mode = sessionMode(graph4, config, session);
  if (input2.learnedFromRouterId === receiverId) return null;
  if (input2.communities.includes("NO_ADVERTISE")) return null;
  if (mode === "ebgp" && input2.communities.includes("NO_EXPORT")) return null;
  if (mode === "ibgp" && input2.learnedVia === "ibgp") {
    const inbound = config.sessions.find((entry) => entry.id === input2.learnedSessionId);
    const learnedFromClient = Boolean(inbound && inbound.routeReflectorClientRouterId === input2.learnedFromRouterId && (inbound.aRouterId === senderId || inbound.bRouterId === senderId));
    const receiverIsClient = session.routeReflectorClientRouterId === receiverId && (session.aRouterId === senderId || session.bRouterId === senderId);
    if (!learnedFromClient && !receiverIsClient) return null;
    if (input2.reflectionPath.includes(receiverId)) return null;
  }
  const exportRule = firstPolicy(config, senderId, "export", session.id, input2);
  if (exportRule?.action === "deny") return null;
  let route = mutateAttrs(input2, exportRule);
  if (mode === "ebgp" && exportRule?.prependAsCount) {
    const asn = builderBgpAsnForRouter(graph4, config, senderId);
    route = { ...route, asPath: [...Array(exportRule.prependAsCount).fill(asn), ...route.asPath] };
  }
  let anomaly = route.policyAnomaly;
  if (mode === "ebgp") {
    const advertiseTo = relationshipFrom(senderId, session);
    const allowed = relationshipExportAllowed(route.learnedFromRelationship, advertiseTo);
    if (!allowed && !session.allowRelationshipLeak && !exportRule?.allowRelationshipLeak) return null;
    if (!allowed) anomaly = true;
    const senderAsn = builderBgpAsnForRouter(graph4, config, senderId), receiverAsn = builderBgpAsnForRouter(graph4, config, receiverId);
    const asPath = [senderAsn, ...route.asPath];
    if (asPath.includes(receiverAsn)) return null;
    const nextHopAddress = interfaceAddress(addressing3, session.linkId, senderId);
    if (!nextHopAddress) return null;
    route = { ...route, routerId: receiverId, learnedFromRouterId: senderId, learnedSessionId: session.id, learnedVia: "ebgp", learnedFromRelationship: receivedRelationship(receiverId, session), asPath, localPref: 100, nextHopRouterId: senderId, nextHopAddress, policyAnomaly: anomaly, id: `bgp:${receiverId}:${route.prefix}:${session.id}:${senderId}` };
  } else {
    const nextHopSelf = session.nextHopSelf;
    const nextHopAddress = nextHopSelf ? interfaceAddress(addressing3, session.linkId, senderId) : route.nextHopAddress;
    if (!nextHopAddress) return null;
    route = { ...route, routerId: receiverId, learnedFromRouterId: senderId, learnedSessionId: session.id, learnedVia: "ibgp", nextHopRouterId: nextHopSelf ? senderId : route.nextHopRouterId, nextHopAddress, policyAnomaly: anomaly, reflectionPath: input2.learnedVia === "ibgp" ? [.../* @__PURE__ */ new Set([...input2.reflectionPath, senderId])] : [...input2.reflectionPath], id: `bgp:${receiverId}:${route.prefix}:${session.id}:${senderId}` };
  }
  const importRule = firstPolicy(config, receiverId, "import", session.id, route);
  if (importRule?.action === "deny") return null;
  route = mutateAttrs(route, importRule);
  return route;
}
function builderBgpState(graph4, addressing3, input2) {
  const config = validateBuilderBgpConfig(graph4, input2);
  const sessionStates = establishedSessions(graph4, addressing3, config);
  const established = new Set(sessionStates.filter((entry) => entry.state === "ESTABLISHED").map((entry) => entry.id));
  const locals = localRoutes(graph4, addressing3, config);
  let rib = cloneRib(locals);
  let rounds = 0;
  for (let round = 0; round < 64; round += 1) {
    rounds = round + 1;
    const best2 = bestMap(rib);
    const next = cloneRib(locals);
    for (const session of config.sessions) {
      if (!established.has(session.id)) continue;
      for (const [sender, receiver] of [[session.aRouterId, session.bRouterId], [session.bRouterId, session.aRouterId]]) {
        for (const route of best2.get(sender)?.values() ?? []) {
          const advertised = advertise(graph4, addressing3, config, session, sender, receiver, route);
          if (!advertised) continue;
          if (!next.has(receiver)) next.set(receiver, /* @__PURE__ */ new Map());
          if (!next.get(receiver).has(advertised.prefix)) next.get(receiver).set(advertised.prefix, /* @__PURE__ */ new Map());
          next.get(receiver).get(advertised.prefix).set(`${session.id}:${sender}`, advertised);
        }
      }
    }
    if (ribFingerprint(next) === ribFingerprint(rib)) {
      rib = next;
      break;
    }
    rib = next;
  }
  const best = bestMap(rib);
  const routes = [];
  for (const [router, prefixes] of rib) for (const [prefix2, candidates] of prefixes) {
    const winner = best.get(router)?.get(prefix2);
    for (const candidate of candidates.values()) routes.push({ ...candidate, best: Boolean(winner && routeFingerprint(winner) === routeFingerprint(candidate)), bestReason: winner && routeFingerprint(winner) === routeFingerprint(candidate) ? bestReason(candidate) : "CANDIDATE \xB7 lost deterministic best-path comparison" });
  }
  routes.sort((a, b) => a.routerId.localeCompare(b.routerId) || a.prefix.localeCompare(b.prefix) || (a.best ? -1 : 1) || compareRoute(a, b));
  const bestRoutes = routes.filter((route) => route.best);
  const originMap = /* @__PURE__ */ new Map();
  for (const origin of config.origins) {
    const set = originMap.get(origin.prefix) ?? /* @__PURE__ */ new Set();
    set.add(builderBgpAsnForRouter(graph4, config, origin.routerId));
    originMap.set(origin.prefix, set);
  }
  return { sessions: sessionStates, routes, bestRoutes, convergenceRounds: rounds, leakedRouteIds: routes.filter((route) => route.policyAnomaly).map((route) => route.id), multiOriginPrefixes: [...originMap].filter(([, asns]) => asns.size > 1).map(([prefix2]) => prefix2).sort() };
}

// ../8f1a24ac8c73/hopscotch/src/builder/model.ts
var BUILDER_LIMITS = {
  minCost: 1,
  maxCost: 999,
  maxNodes: 32,
  maxLinks: 96,
  minCoordinate: 0,
  maxCoordinate: 100
};
var defaultBuilderGraph = {
  nodes: [
    { id: "client", label: "CLIENT", kind: "endpoint", builtin: true },
    { id: "edge", label: "EDGE", kind: "router", builtin: true },
    { id: "r1", label: "R1", kind: "router", builtin: true },
    { id: "r2", label: "R2", kind: "router", builtin: true },
    { id: "core", label: "CORE", kind: "router", builtin: true },
    { id: "app", label: "APP", kind: "endpoint", builtin: true }
  ],
  links: [
    { id: "client-edge", a: "client", b: "edge", cost: 1, failed: false, builtin: true },
    { id: "edge-r1", a: "edge", b: "r1", cost: 10, failed: false, builtin: true },
    { id: "r1-core", a: "r1", b: "core", cost: 10, failed: false, builtin: true },
    { id: "edge-r2", a: "edge", b: "r2", cost: 30, failed: false, builtin: true },
    { id: "r2-core", a: "r2", b: "core", cost: 20, failed: false, builtin: true },
    { id: "r1-r2", a: "r1", b: "r2", cost: 40, failed: false, builtin: true },
    { id: "core-app", a: "core", b: "app", cost: 1, failed: false, builtin: true }
  ]
};
var defaultBuilderLayout = {
  client: { x: 8, y: 50 },
  edge: { x: 24, y: 50 },
  r1: { x: 44, y: 30 },
  r2: { x: 44, y: 70 },
  core: { x: 68, y: 50 },
  app: { x: 90, y: 50 }
};
function cloneBuilderGraph(graph4) {
  return {
    nodes: graph4.nodes.map((node) => ({ ...node })),
    links: graph4.links.map((link) => ({ ...link }))
  };
}
function stablePathKey(path) {
  return path.join("\0");
}
function findShortestPath(graph4, sourceId, destinationId) {
  const nodeIds = new Set(graph4.nodes.map((node) => node.id));
  if (!nodeIds.has(sourceId) || !nodeIds.has(destinationId)) {
    return {
      reachable: false,
      nodeIds: [],
      linkIds: [],
      totalCost: null,
      steps: [],
      explanation: "Select two nodes that still exist in the graph."
    };
  }
  if (sourceId === destinationId) {
    return {
      reachable: true,
      nodeIds: [sourceId],
      linkIds: [],
      totalCost: 0,
      steps: [],
      explanation: "Source and destination are the same node. Total cost 0."
    };
  }
  const best = /* @__PURE__ */ new Map();
  const settled = /* @__PURE__ */ new Set();
  best.set(sourceId, { nodeId: sourceId, cost: 0, nodePath: [sourceId], linkPath: [] });
  const adjacency2 = /* @__PURE__ */ new Map();
  for (const node of graph4.nodes) adjacency2.set(node.id, []);
  for (const link of graph4.links) {
    if (link.failed || !nodeIds.has(link.a) || !nodeIds.has(link.b)) continue;
    adjacency2.get(link.a)?.push({ neighbor: link.b, link });
    adjacency2.get(link.b)?.push({ neighbor: link.a, link });
  }
  for (const neighbors2 of adjacency2.values()) {
    neighbors2.sort((left, right) => left.neighbor.localeCompare(right.neighbor) || left.link.id.localeCompare(right.link.id));
  }
  while (settled.size < graph4.nodes.length) {
    let current;
    for (const candidate of best.values()) {
      if (settled.has(candidate.nodeId)) continue;
      if (!current || candidate.cost < current.cost || candidate.cost === current.cost && stablePathKey(candidate.nodePath).localeCompare(stablePathKey(current.nodePath)) < 0) {
        current = candidate;
      }
    }
    if (!current) break;
    if (current.nodeId === destinationId) break;
    settled.add(current.nodeId);
    for (const edge of adjacency2.get(current.nodeId) ?? []) {
      if (settled.has(edge.neighbor)) continue;
      const next = {
        nodeId: edge.neighbor,
        cost: current.cost + edge.link.cost,
        nodePath: [...current.nodePath, edge.neighbor],
        linkPath: [...current.linkPath, edge.link.id]
      };
      const prior = best.get(edge.neighbor);
      if (!prior || next.cost < prior.cost || next.cost === prior.cost && stablePathKey(next.nodePath).localeCompare(stablePathKey(prior.nodePath)) < 0) {
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
      explanation: `${sourceId.toUpperCase()} and ${destinationId.toUpperCase()} are partitioned by the current failures/topology.`
    };
  }
  const linksById = new Map(graph4.links.map((link) => [link.id, link]));
  const steps = winner.linkPath.map((linkId, index) => {
    const link = linksById.get(linkId);
    return {
      linkId,
      from: winner.nodePath[index],
      to: winner.nodePath[index + 1],
      cost: link?.cost ?? 0
    };
  });
  const equation = steps.map((step) => step.cost).join(" + ");
  return {
    reachable: true,
    nodeIds: winner.nodePath,
    linkIds: winner.linkPath,
    totalCost: winner.cost,
    steps,
    explanation: `${winner.nodePath.map((id2) => id2.toUpperCase()).join(" \u2192 ")} \xB7 ${equation || "0"} = ${winner.cost}`
  };
}

// ../8f1a24ac8c73/hopscotch/src/builder/routing-policy.ts
var PROTOCOLS = ["connected", "static", "ospf", "bgp", "isis"];
var TARGETS = ["ospf", "bgp", "isis"];
var HASH_MODES = ["l3", "l4", "full"];
var ISIS_LEVELS = ["L1", "L2", "L1L2"];
function nodeIsRouter2(graph4, id2) {
  return graph4.nodes.find((node) => node.id === id2)?.kind === "router";
}
function linkById(graph4, id2) {
  return graph4.links.find((link) => link.id === id2) ?? null;
}
function ipv4ToInt3(value) {
  return normalizeBuilderIpv4(value).split(".").reduce((result, part) => (result << 8 | Number(part)) >>> 0, 0) >>> 0;
}
function intToIpv43(value) {
  const n = value >>> 0;
  return [24, 16, 8, 0].map((shift) => n >>> shift & 255).join(".");
}
function parseBuilderPolicyPrefix(value) {
  const [rawAddress, rawLength, ...extra] = String(value ?? "").trim().split("/");
  if (!rawAddress || rawLength == null || extra.length || !/^\d{1,2}$/.test(rawLength)) throw new Error(`Invalid IPv4 prefix ${value}.`);
  const prefixLength2 = Number(rawLength);
  if (!Number.isInteger(prefixLength2) || prefixLength2 < 0 || prefixLength2 > 32) throw new Error("IPv4 prefixes must be /0 through /32.");
  const address2 = ipv4ToInt3(rawAddress);
  const mask = prefixLength2 === 0 ? 0 : 4294967295 << 32 - prefixLength2 >>> 0;
  const network = (address2 & mask) >>> 0, broadcast = (network | ~mask >>> 0) >>> 0;
  return { cidr: `${intToIpv43(network)}/${prefixLength2}`, prefixLength: prefixLength2, network, broadcast };
}
function builderPolicyPrefixContains(prefix2, address2) {
  const p = parseBuilderPolicyPrefix(prefix2), a = ipv4ToInt3(address2);
  return a >= p.network && a <= p.broadcast;
}
function builderPolicyPrefixContainsPrefix(parent, child) {
  const a = parseBuilderPolicyPrefix(parent), b = parseBuilderPolicyPrefix(child);
  return a.prefixLength <= b.prefixLength && a.network <= b.network && a.broadcast >= b.broadcast;
}
function createDefaultBuilderRoutingPolicyConfig() {
  return { redistributions: [], pbrRules: [], ecmpProfiles: [], summaries: [], ospfTimers: [], isis: { routers: [], links: [] } };
}
function cloneBuilderRoutingPolicyConfig(value) {
  const current = value ?? createDefaultBuilderRoutingPolicyConfig();
  return {
    redistributions: (current.redistributions ?? []).map((entry) => ({ ...entry })),
    pbrRules: (current.pbrRules ?? []).map((entry) => ({ ...entry })),
    ecmpProfiles: (current.ecmpProfiles ?? []).map((entry) => ({ ...entry })),
    summaries: (current.summaries ?? []).map((entry) => ({ ...entry })),
    ospfTimers: (current.ospfTimers ?? []).map((entry) => ({ ...entry })),
    isis: { routers: (current.isis?.routers ?? []).map((entry) => ({ ...entry })), links: (current.isis?.links ?? []).map((entry) => ({ ...entry })) }
  };
}
function validPort(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error("PBR ports must be 1\u201365535.");
  return n;
}
function directNextHop(graph4, addressing3, routerId, address2) {
  const normalized = normalizeBuilderIpv4(address2);
  return graph4.links.some((link) => {
    if (link.a !== routerId && link.b !== routerId) return false;
    return Boolean(addressing3.segments[link.id]?.interfaces.some((entry) => entry.nodeId !== routerId && entry.address === normalized));
  });
}
function validateBuilderRoutingPolicyConfig(graph4, addressing3, value) {
  const raw = value ?? createDefaultBuilderRoutingPolicyConfig();
  const ids = /* @__PURE__ */ new Set();
  const redistributions = (raw.redistributions ?? []).map((entry, index) => {
    const id2 = String(entry?.id ?? "").trim();
    if (!id2 || ids.has(id2) || !/^[a-zA-Z0-9_.:-]+$/.test(id2)) throw new Error(`Redistribution rule ${index + 1} needs a unique id.`);
    ids.add(id2);
    const routerId = String(entry.routerId ?? "");
    if (!nodeIsRouter2(graph4, routerId)) throw new Error(`Redistribution ${id2} belongs to a non-router.`);
    const source = entry.source, target2 = entry.target;
    if (!PROTOCOLS.includes(source) || !TARGETS.includes(target2) || source === target2) throw new Error(`Redistribution ${id2} needs two different supported protocols.`);
    const metric = Math.max(1, Math.min(16777215, Math.round(Number(entry.metric) || 1)));
    const routeTag = Math.max(0, Math.min(4294967295, Math.round(Number(entry.routeTag) || 0)));
    return { id: id2, routerId, source, target: target2, prefix: parseBuilderPolicyPrefix(entry.prefix ?? "0.0.0.0/0").cidr, metric, routeTag, enabled: entry.enabled !== false, allowFeedback: entry.allowFeedback === true, description: String(entry.description ?? "").slice(0, 100) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.id.localeCompare(b.id));
  const pbrIds = /* @__PURE__ */ new Set();
  const pbrRules = (raw.pbrRules ?? []).map((entry, index) => {
    const id2 = String(entry?.id ?? "").trim();
    if (!id2 || pbrIds.has(id2) || !/^[a-zA-Z0-9_.:-]+$/.test(id2)) throw new Error(`PBR rule ${index + 1} needs a unique id.`);
    pbrIds.add(id2);
    const routerId = String(entry.routerId ?? "");
    if (!nodeIsRouter2(graph4, routerId)) throw new Error(`PBR ${id2} belongs to a non-router.`);
    const protocol = ["icmp", "tcp", "udp"].includes(entry.protocol) ? entry.protocol : "ip";
    const nextHop = normalizeBuilderIpv4(String(entry.nextHop ?? ""));
    if (!directNextHop(graph4, addressing3, routerId, nextHop)) throw new Error(`PBR ${id2} next hop ${nextHop} must be directly connected to ${routerId}.`);
    return { id: id2, routerId, order: Math.max(1, Math.min(65535, Math.round(Number(entry.order) || 10))), sourcePrefix: parseBuilderPolicyPrefix(entry.sourcePrefix ?? "0.0.0.0/0").cidr, destinationPrefix: parseBuilderPolicyPrefix(entry.destinationPrefix ?? "0.0.0.0/0").cidr, protocol, sourcePort: validPort(entry.sourcePort), destinationPort: validPort(entry.destinationPort), nextHop, enabled: entry.enabled !== false, description: String(entry.description ?? "").slice(0, 100) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.order - b.order || a.id.localeCompare(b.id));
  const ecmpSeen = /* @__PURE__ */ new Set();
  const ecmpProfiles = (raw.ecmpProfiles ?? []).map((entry) => {
    const routerId = String(entry.routerId ?? "");
    if (!nodeIsRouter2(graph4, routerId) || ecmpSeen.has(routerId)) throw new Error(`ECMP profile ${routerId || "UNKNOWN"} is invalid or duplicated.`);
    ecmpSeen.add(routerId);
    const hashMode = HASH_MODES.includes(entry.hashMode) ? entry.hashMode : "full";
    return { routerId, hashMode, maxPaths: Math.max(1, Math.min(16, Math.round(Number(entry.maxPaths) || 8))) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId));
  const summaryIds = /* @__PURE__ */ new Set();
  const summaries = (raw.summaries ?? []).map((entry, index) => {
    const id2 = String(entry?.id ?? "").trim();
    if (!id2 || summaryIds.has(id2) || !/^[a-zA-Z0-9_.:-]+$/.test(id2)) throw new Error(`Summary ${index + 1} needs a unique id.`);
    summaryIds.add(id2);
    const routerId = String(entry.routerId ?? "");
    if (!nodeIsRouter2(graph4, routerId)) throw new Error(`Summary ${id2} belongs to a non-router.`);
    const source = entry.source;
    if (!PROTOCOLS.includes(source)) throw new Error(`Summary ${id2} source is unsupported.`);
    const advertiseInto = entry.advertiseInto ?? "none";
    if (advertiseInto !== "none" && !TARGETS.includes(advertiseInto)) throw new Error(`Summary ${id2} target is unsupported.`);
    return { id: id2, routerId, source, prefix: parseBuilderPolicyPrefix(entry.prefix).cidr, advertiseInto, metric: Math.max(1, Math.min(16777215, Math.round(Number(entry.metric) || 1))), discard: entry.discard !== false, description: String(entry.description ?? "").slice(0, 100) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.prefix.localeCompare(b.prefix) || a.id.localeCompare(b.id));
  const timerIds = /* @__PURE__ */ new Set();
  const ospfTimers = (raw.ospfTimers ?? []).map((entry, index) => {
    const routerId = String(entry.routerId ?? ""), linkId = String(entry.linkId ?? "");
    const link = linkById(graph4, linkId);
    if (!nodeIsRouter2(graph4, routerId) || !link || link.a !== routerId && link.b !== routerId) throw new Error(`OSPF timer ${index + 1} must reference a router interface.`);
    const id2 = String(entry.id ?? `ospf-timer:${routerId}:${linkId}`);
    if (timerIds.has(id2)) throw new Error(`Duplicate OSPF timer ${id2}.`);
    timerIds.add(id2);
    const helloIntervalMs = Math.max(100, Math.min(12e4, Math.round(Number(entry.helloIntervalMs) || 1e4))), deadIntervalMs = Math.max(100, Math.min(6e5, Math.round(Number(entry.deadIntervalMs) || 4e4)));
    if (deadIntervalMs < helloIntervalMs) throw new Error(`OSPF timer ${id2} dead interval must be >= hello interval.`);
    return { id: id2, routerId, linkId, helloIntervalMs, deadIntervalMs };
  }).sort((a, b) => a.linkId.localeCompare(b.linkId) || a.routerId.localeCompare(b.routerId));
  const isisRouterSeen = /* @__PURE__ */ new Set();
  const isisRouters = (raw.isis?.routers ?? []).map((entry) => {
    const routerId = String(entry.routerId ?? "");
    if (!nodeIsRouter2(graph4, routerId) || isisRouterSeen.has(routerId)) throw new Error(`IS-IS router ${routerId || "UNKNOWN"} is invalid or duplicated.`);
    isisRouterSeen.add(routerId);
    const areaId = String(entry.areaId ?? "49.0001").trim();
    if (!/^49\.\d{4}$/.test(areaId)) throw new Error(`IS-IS area ${areaId} must use teaching format 49.xxxx.`);
    const level = ISIS_LEVELS.includes(entry.level) ? entry.level : "L2";
    return { routerId, enabled: entry.enabled !== false, areaId, level };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId));
  const isisLinkSeen = /* @__PURE__ */ new Set();
  const isisLinks = (raw.isis?.links ?? []).map((entry) => {
    const linkId = String(entry.linkId ?? "");
    const link = linkById(graph4, linkId);
    if (!link || !nodeIsRouter2(graph4, link.a) || !nodeIsRouter2(graph4, link.b) || isisLinkSeen.has(linkId)) throw new Error(`IS-IS link ${linkId || "UNKNOWN"} is invalid or duplicated.`);
    isisLinkSeen.add(linkId);
    return { linkId, level: ISIS_LEVELS.includes(entry.level) ? entry.level : "L2" };
  }).sort((a, b) => a.linkId.localeCompare(b.linkId));
  return { redistributions, pbrRules, ecmpProfiles, summaries, ospfTimers, isis: { routers: isisRouters, links: isisLinks } };
}
function reconcileBuilderRoutingPolicyConfig(graph4, addressing3, value) {
  const next = cloneBuilderRoutingPolicyConfig(value);
  const routers = new Set(graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id)), links = new Set(graph4.links.map((link) => link.id));
  next.redistributions = next.redistributions.filter((entry) => routers.has(entry.routerId));
  next.pbrRules = next.pbrRules.filter((entry) => routers.has(entry.routerId) && directNextHop(graph4, addressing3, entry.routerId, entry.nextHop));
  next.ecmpProfiles = next.ecmpProfiles.filter((entry) => routers.has(entry.routerId));
  next.summaries = next.summaries.filter((entry) => routers.has(entry.routerId));
  next.ospfTimers = next.ospfTimers.filter((entry) => routers.has(entry.routerId) && links.has(entry.linkId));
  next.isis.routers = next.isis.routers.filter((entry) => routers.has(entry.routerId));
  next.isis.links = next.isis.links.filter((entry) => links.has(entry.linkId));
  return validateBuilderRoutingPolicyConfig(graph4, addressing3, next);
}
function builderPbrDecision(config, routerId, key2) {
  for (const rule of config.pbrRules.filter((entry) => entry.enabled && entry.routerId === routerId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
    if (!builderPolicyPrefixContains(rule.sourcePrefix, key2.sourceAddress) || !builderPolicyPrefixContains(rule.destinationPrefix, key2.destinationAddress)) continue;
    if (rule.protocol !== "ip" && rule.protocol !== key2.protocol.toLowerCase()) continue;
    if (rule.sourcePort != null && rule.sourcePort !== key2.sourcePort) continue;
    if (rule.destinationPort != null && rule.destinationPort !== key2.destinationPort) continue;
    return { matched: true, rule, reason: `PBR ${rule.id} matched before next-hop resolution. Destination FIB selection remains separately recorded.` };
  }
  return { matched: false, rule: null, reason: "No PBR rule matched; destination-based FIB forwarding applies." };
}
function builderEcmpProfile(config, routerId) {
  return config.ecmpProfiles.find((entry) => entry.routerId === routerId) ?? { routerId, hashMode: "full", maxPaths: 8 };
}
function builderCanonicalEcmpKey(mode, key2, discriminator = null) {
  const l3 = `${key2.sourceAddress}|${key2.destinationAddress}`;
  if (mode === "l3") return l3;
  const l4 = `${key2.protocol.toLowerCase()}|${l3}|${key2.sourcePort ?? ""}|${key2.destinationPort ?? ""}`;
  return mode === "l4" ? l4 : `${l4}|${discriminator ?? ""}`;
}
function builderOspfTimerFor(config, routerId, linkId) {
  return config.ospfTimers.find((entry) => entry.routerId === routerId && entry.linkId === linkId) ?? { id: `ospf-timer:${routerId}:${linkId}:default`, routerId, linkId, helloIntervalMs: 1e4, deadIntervalMs: 4e4 };
}
function builderOspfTimerCompatible(config, aRouterId, bRouterId, linkId) {
  const a = builderOspfTimerFor(config, aRouterId, linkId), b = builderOspfTimerFor(config, bRouterId, linkId);
  return a.helloIntervalMs === b.helloIntervalMs && a.deadIntervalMs === b.deadIntervalMs;
}
function builderOspfEffectiveGraph(graph4, config, enabledRouterIds) {
  const enabled = new Set(enabledRouterIds);
  const next = cloneBuilderGraph(graph4);
  next.links = next.links.map((link) => !link.failed && enabled.has(link.a) && enabled.has(link.b) && nodeIsRouter2(graph4, link.a) && nodeIsRouter2(graph4, link.b) && !builderOspfTimerCompatible(config, link.a, link.b, link.id) ? { ...link, failed: true } : link);
  return next;
}

// ../8f1a24ac8c73/hopscotch/src/builder/isis.ts
function routerConfig(config, routerId) {
  return config.routers.find((entry) => entry.routerId === routerId && entry.enabled) ?? null;
}
function linkLevel(config, linkId) {
  return config.links.find((entry) => entry.linkId === linkId)?.level ?? "L1L2";
}
function permits(level, target2) {
  return level === target2 || level === "L1L2";
}
function nodeIsRouter3(graph4, id2) {
  return graph4.nodes.find((node) => node.id === id2)?.kind === "router";
}
function interfaceOn(addressing3, linkId, nodeId) {
  return addressing3.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nodeId) ?? null;
}
function builderIsisState(graph4, addressing3, config) {
  const enabledRouterIds = config.routers.filter((entry) => entry.enabled && nodeIsRouter3(graph4, entry.routerId)).map((entry) => entry.routerId).sort();
  const enabled = new Set(enabledRouterIds);
  const adjacencies = [];
  for (const link of graph4.links) {
    if (!enabled.has(link.a) || !enabled.has(link.b) || !nodeIsRouter3(graph4, link.a) || !nodeIsRouter3(graph4, link.b)) continue;
    const a = routerConfig(config, link.a), b = routerConfig(config, link.b), ll = linkLevel(config, link.id);
    const l1 = permits(a.level, "L1") && permits(b.level, "L1") && permits(ll, "L1") && a.areaId === b.areaId;
    const l2 = permits(a.level, "L2") && permits(b.level, "L2") && permits(ll, "L2");
    const level = l1 && l2 ? "L1L2" : l2 ? "L2" : "L1";
    const compatible = l1 || l2;
    adjacencies.push({ id: `isis-adj:${link.id}`, linkId: link.id, aRouterId: link.a, bRouterId: link.b, level, state: link.failed || !compatible ? "DOWN" : "UP", reason: link.failed ? "LINK DOWN" : !compatible ? "LEVEL / AREA MISMATCH" : l1 && l2 ? "L1 + L2 ADJACENCY" : l2 ? "L2 ADJACENCY" : "L1 SAME-AREA ADJACENCY" });
  }
  const lsps = [];
  for (const routerId of enabledRouterIds) {
    const router = routerConfig(config, routerId);
    for (const iface of interfacesForBuilderNode(addressing3, routerId)) {
      const link = graph4.links.find((entry) => entry.id === iface.linkId);
      if (!link || link.failed) continue;
      const prefix2 = parseBuilderIpv4Cidr(iface.cidr).cidr;
      if (permits(router.level, "L1")) lsps.push({ id: `isis-lsp:l1:${routerId}:${iface.linkId}`, routerId, areaId: router.areaId, prefix: prefix2, linkId: iface.linkId, metric: link.cost, level: "L1" });
      if (permits(router.level, "L2")) lsps.push({ id: `isis-lsp:l2:${routerId}:${iface.linkId}`, routerId, areaId: router.areaId, prefix: prefix2, linkId: iface.linkId, metric: link.cost, level: "L2" });
    }
  }
  return { enabledRouterIds, adjacencies: adjacencies.sort((a, b) => a.linkId.localeCompare(b.linkId)), lsps: lsps.sort((a, b) => a.level.localeCompare(b.level) || a.routerId.localeCompare(b.routerId) || a.prefix.localeCompare(b.prefix)), l1Areas: [...new Set(config.routers.filter((entry) => entry.enabled && permits(entry.level, "L1")).map((entry) => entry.areaId))].sort(), l2RouterIds: config.routers.filter((entry) => entry.enabled && permits(entry.level, "L2")).map((entry) => entry.routerId).sort() };
}
function adjacency(config, state, level, areaId) {
  const map = /* @__PURE__ */ new Map();
  for (const id2 of state.enabledRouterIds) map.set(id2, []);
  for (const adj of state.adjacencies) {
    if (adj.state !== "UP" || !permits(adj.level, level)) continue;
    const a = routerConfig(config, adj.aRouterId), b = routerConfig(config, adj.bRouterId);
    if (!a || !b) continue;
    if (level === "L1" && (a.areaId !== b.areaId || a.areaId !== areaId)) continue;
    const cost = 1;
    map.get(adj.aRouterId)?.push({ neighbor: adj.bRouterId, linkId: adj.linkId, cost, level });
    map.get(adj.bRouterId)?.push({ neighbor: adj.aRouterId, linkId: adj.linkId, cost, level });
  }
  for (const edges of map.values()) edges.sort((a, b) => a.neighbor.localeCompare(b.neighbor) || a.linkId.localeCompare(b.linkId));
  return map;
}
function graphCost(graph4, linkId) {
  return graph4.links.find((entry) => entry.id === linkId)?.cost ?? 1;
}
function distances(graph4, map, start) {
  const dist = new Map([...map.keys()].map((id2) => [id2, Number.POSITIVE_INFINITY]));
  const done = /* @__PURE__ */ new Set();
  if (!map.has(start)) return dist;
  dist.set(start, 0);
  while (done.size < map.size) {
    let current = null, cost = Number.POSITIVE_INFINITY;
    for (const [id2, value] of dist) {
      if (done.has(id2)) continue;
      if (value < cost || value === cost && current !== null && id2.localeCompare(current) < 0) {
        current = id2;
        cost = value;
      }
    }
    if (current === null || !Number.isFinite(cost)) break;
    done.add(current);
    for (const edge of map.get(current) ?? []) {
      const next = cost + graphCost(graph4, edge.linkId);
      if (next < (dist.get(edge.neighbor) ?? Infinity)) dist.set(edge.neighbor, next);
    }
  }
  return dist;
}
function pathSet(graph4, config, state, source, destination) {
  if (source === destination) return { reachable: true, totalCost: 0, firstHops: [], level: "L1" };
  const a = routerConfig(config, source), b = routerConfig(config, destination);
  if (!a || !b) return { reachable: false, totalCost: 0, firstHops: [], level: "L2" };
  const level = a.areaId === b.areaId && permits(a.level, "L1") && permits(b.level, "L1") ? "L1" : "L2";
  const map = adjacency(config, state, level, level === "L1" ? a.areaId : null);
  const from = distances(graph4, map, source), to = distances(graph4, map, destination), total = from.get(destination) ?? Infinity;
  if (!Number.isFinite(total)) return { reachable: false, totalCost: 0, firstHops: [], level };
  const first = (map.get(source) ?? []).filter((edge) => graphCost(graph4, edge.linkId) + (to.get(edge.neighbor) ?? Infinity) === total).map((edge) => ({ nextRouterId: edge.neighbor, linkId: edge.linkId })).sort((x, y) => x.nextRouterId.localeCompare(y.nextRouterId) || x.linkId.localeCompare(y.linkId));
  return { reachable: first.length > 0, totalCost: total, firstHops: first, level };
}
function nativeOrigins(state) {
  const by = /* @__PURE__ */ new Map();
  for (const lsp2 of state.lsps) {
    const key2 = `${lsp2.routerId}|${lsp2.prefix}`;
    if (!by.has(key2)) by.set(key2, { routerId: lsp2.routerId, prefix: lsp2.prefix, metric: lsp2.metric, source: "connected" });
  }
  return [...by.values()];
}
function builderIsisRouteEntriesForRouter(graph4, addressing3, config, routerId, injected = []) {
  const viewer = routerConfig(config, routerId);
  if (!viewer) return [];
  const state = builderIsisState(graph4, addressing3, config);
  const origins = [...nativeOrigins(state), ...injected.map((entry) => ({ routerId: entry.originRouterId, prefix: entry.prefix, metric: entry.metric, source: entry.source, injected: entry }))];
  const entries = [];
  for (const origin of origins) {
    if (origin.routerId === routerId) continue;
    const path = pathSet(graph4, config, state, routerId, origin.routerId);
    if (!path.reachable) continue;
    for (const first of path.firstHops) {
      const local = interfaceOn(addressing3, first.linkId, routerId), remote = interfaceOn(addressing3, first.linkId, first.nextRouterId);
      if (!local || !remote) continue;
      const parsed = parseBuilderIpv4Cidr(origin.prefix);
      const injectedRoute = "injected" in origin ? origin.injected : void 0;
      entries.push({ id: `isis:${routerId}:${parsed.cidr}:${origin.routerId}:${first.linkId}${injectedRoute ? `:${injectedRoute.id}` : ""}`.replaceAll("/", "_"), routerId, prefix: parsed.cidr, prefixLength: parsed.prefixLength, administrativeDistance: 115, metric: path.totalCost + origin.metric, nextHop: remote.address, outgoingInterface: local.name, linkId: first.linkId, active: true, stateNote: `IS-IS ${path.level} \xB7 ORIGIN ${origin.routerId.toUpperCase()}${injectedRoute ? ` \xB7 REDISTRIBUTED ${injectedRoute.source.toUpperCase()} \xB7 TAG ${injectedRoute.routeTag}` : ""}`, isisLevel: path.level, isisAreaId: viewer.areaId, isisOriginRouterId: origin.routerId, ...injectedRoute ? { redistributedFrom: injectedRoute.source, redistributionRuleId: injectedRoute.redistributionRuleId, routeTag: injectedRoute.routeTag, summaryId: injectedRoute.summaryId } : {} });
    }
  }
  const byPrefix = /* @__PURE__ */ new Map();
  for (const entry of entries) byPrefix.set(entry.prefix, [...byPrefix.get(entry.prefix) ?? [], entry]);
  const winners = [];
  for (const candidates of byPrefix.values()) {
    const best = Math.min(...candidates.map((entry) => entry.metric));
    const equal = candidates.filter((entry) => entry.metric === best).sort((a, b) => a.id.localeCompare(b.id));
    winners.push(...equal.map((entry) => ({ ...entry, stateNote: `${entry.stateNote}${equal.length > 1 ? ` \xB7 ECMP ${equal.length}-WAY` : ""}` })));
  }
  return winners.sort((a, b) => b.prefixLength - a.prefixLength || a.metric - b.metric || a.id.localeCompare(b.id));
}

// ../8f1a24ac8c73/hopscotch/src/builder/ospf-areas.ts
var BUILDER_OSPF_BACKBONE_AREA = "0.0.0.0";
function nodeIsRouter4(graph4, nodeId) {
  return graph4.nodes.some((node) => node.id === nodeId && node.kind === "router");
}
function ipv4ToInt4(value) {
  return normalizeBuilderIpv4(value).split(".").reduce((result, part) => (result << 8 | Number(part)) >>> 0, 0) >>> 0;
}
function intToIpv44(value) {
  const normalized = value >>> 0;
  return [24, 16, 8, 0].map((shift) => normalized >>> shift & 255).join(".");
}
function normalizeBuilderOspfAreaId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("OSPF area id cannot be empty.");
  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (!Number.isSafeInteger(numeric) || numeric < 0 || numeric > 4294967295) throw new Error("OSPF decimal area ids must be 0\u20134294967295.");
    return intToIpv44(numeric >>> 0);
  }
  try {
    return normalizeBuilderIpv4(raw);
  } catch {
    throw new Error(`Invalid OSPF area id ${value}; use decimal or dotted-quad notation.`);
  }
}
function parsePrefix2(value) {
  const [addressText, prefixText, ...extra] = String(value ?? "").trim().split("/");
  if (!addressText || prefixText == null || extra.length > 0 || !/^\d{1,2}$/.test(prefixText)) throw new Error(`Invalid OSPF summary prefix ${value}.`);
  const prefixLength2 = Number(prefixText);
  if (!Number.isInteger(prefixLength2) || prefixLength2 < 0 || prefixLength2 > 32) throw new Error("OSPF summary prefixes must be /0 through /32.");
  const address2 = ipv4ToInt4(addressText);
  const mask = prefixLength2 === 0 ? 0 : 4294967295 << 32 - prefixLength2 >>> 0;
  const network = (address2 & mask) >>> 0;
  const broadcast = (network | ~mask >>> 0) >>> 0;
  return { cidr: `${intToIpv44(network)}/${prefixLength2}`, network, broadcast, prefixLength: prefixLength2 };
}
function builderOspfPrefixContains(summaryPrefix, specificPrefix) {
  const summary = parsePrefix2(summaryPrefix);
  const specific = parsePrefix2(specificPrefix);
  return summary.prefixLength <= specific.prefixLength && specific.network >= summary.network && specific.broadcast <= summary.broadcast;
}
function builderOspfAreaForLink(config, linkId) {
  return normalizeBuilderOspfAreaId(config.linkAreas?.[linkId] ?? BUILDER_OSPF_BACKBONE_AREA);
}
function configuredAreasForRouter(graph4, config, routerId) {
  if (!nodeIsRouter4(graph4, routerId)) return [];
  return [...new Set(graph4.links.filter((link) => link.a === routerId || link.b === routerId).map((link) => builderOspfAreaForLink(config, link.id)))].sort();
}
function builderOspfAreasForRouter(graph4, config, routerId) {
  if (!config.enabledRouterIds.includes(routerId)) return [];
  return configuredAreasForRouter(graph4, config, routerId);
}
function builderOspfAbrRouterIds(graph4, config) {
  return config.enabledRouterIds.filter((routerId) => {
    const areas = builderOspfAreasForRouter(graph4, config, routerId);
    return areas.includes(BUILDER_OSPF_BACKBONE_AREA) && areas.some((areaId) => areaId !== BUILDER_OSPF_BACKBONE_AREA);
  }).sort();
}
function validateBuilderOspfAreaConfig(graph4, config) {
  const linkIds2 = new Set(graph4.links.map((link) => link.id));
  const linkAreas = {};
  for (const [linkId, rawAreaId] of Object.entries(config.linkAreas ?? {})) {
    if (!linkIds2.has(linkId)) throw new Error(`OSPF area assignment references unknown link ${linkId}.`);
    const areaId = normalizeBuilderOspfAreaId(rawAreaId);
    if (areaId !== BUILDER_OSPF_BACKBONE_AREA) linkAreas[linkId] = areaId;
  }
  const normalizedConfig = { ...config, linkAreas };
  const configuredAbrIds = new Set(graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id).filter((routerId) => {
    const areas = configuredAreasForRouter(graph4, normalizedConfig, routerId);
    return areas.includes(BUILDER_OSPF_BACKBONE_AREA) && areas.some((areaId) => areaId !== BUILDER_OSPF_BACKBONE_AREA);
  }));
  const summaryIds = /* @__PURE__ */ new Set();
  const summaries = (config.summaries ?? []).map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`OSPF summary ${index + 1} is invalid.`);
    const id2 = String(raw.id ?? "").trim();
    if (!id2 || id2.length > 120 || !/^[a-zA-Z0-9_.:-]+$/.test(id2) || summaryIds.has(id2)) throw new Error(`OSPF summary ${index + 1} has an invalid or duplicate id.`);
    const abrRouterId = String(raw.abrRouterId ?? "").trim();
    if (!configuredAbrIds.has(abrRouterId)) throw new Error(`OSPF summary ${id2} must belong to a configured ABR attached to Area 0 and a non-backbone area.`);
    const fromAreaId = normalizeBuilderOspfAreaId(raw.fromAreaId);
    if (fromAreaId === BUILDER_OSPF_BACKBONE_AREA) throw new Error(`OSPF summary ${id2} must summarize a non-backbone source area in this teaching model.`);
    if (!configuredAreasForRouter(graph4, normalizedConfig, abrRouterId).includes(fromAreaId)) throw new Error(`OSPF summary ${id2} ABR ${abrRouterId} is not attached to ${fromAreaId}.`);
    const prefix2 = parsePrefix2(raw.prefix).cidr;
    const metric = Number(raw.metric);
    if (!Number.isInteger(metric) || metric < 1 || metric > 16777215) throw new Error(`OSPF summary ${id2} metric must be 1\u201316777215.`);
    summaryIds.add(id2);
    return { id: id2, abrRouterId, fromAreaId, prefix: prefix2, metric, description: String(raw.description ?? "").slice(0, 80) };
  }).sort((a, b) => a.abrRouterId.localeCompare(b.abrRouterId) || a.fromAreaId.localeCompare(b.fromAreaId) || a.prefix.localeCompare(b.prefix) || a.id.localeCompare(b.id));
  return { linkAreas, summaries };
}
function reconcileBuilderOspfAreaConfig(graph4, config) {
  const linkIds2 = new Set(graph4.links.map((link) => link.id));
  const linkAreas = Object.fromEntries(Object.entries(config.linkAreas ?? {}).filter(([linkId]) => linkIds2.has(linkId)));
  const provisional = { ...config, linkAreas, summaries: [] };
  const summaries = (config.summaries ?? []).filter((summary) => {
    const areas = configuredAreasForRouter(graph4, provisional, summary.abrRouterId);
    return areas.includes(BUILDER_OSPF_BACKBONE_AREA) && areas.includes(normalizeBuilderOspfAreaId(summary.fromAreaId));
  });
  return validateBuilderOspfAreaConfig(graph4, { ...config, linkAreas, summaries });
}
function adjacencyMap(graph4, config, areaId) {
  const normalizedArea = normalizeBuilderOspfAreaId(areaId);
  const enabled = new Set(config.enabledRouterIds.filter((routerId) => nodeIsRouter4(graph4, routerId)));
  const adjacency2 = /* @__PURE__ */ new Map();
  for (const routerId of enabled) if (builderOspfAreasForRouter(graph4, config, routerId).includes(normalizedArea)) adjacency2.set(routerId, []);
  for (const link of graph4.links) {
    if (link.failed || builderOspfAreaForLink(config, link.id) !== normalizedArea || !enabled.has(link.a) || !enabled.has(link.b)) continue;
    if (!nodeIsRouter4(graph4, link.a) || !nodeIsRouter4(graph4, link.b)) continue;
    adjacency2.get(link.a)?.push({ neighbor: link.b, linkId: link.id, cost: link.cost });
    adjacency2.get(link.b)?.push({ neighbor: link.a, linkId: link.id, cost: link.cost });
  }
  for (const neighbors2 of adjacency2.values()) neighbors2.sort((a, b) => a.neighbor.localeCompare(b.neighbor) || a.linkId.localeCompare(b.linkId));
  return adjacency2;
}
function distances2(adjacency2, startRouterId) {
  const result = /* @__PURE__ */ new Map();
  const settled = /* @__PURE__ */ new Set();
  for (const routerId of adjacency2.keys()) result.set(routerId, Number.POSITIVE_INFINITY);
  if (!adjacency2.has(startRouterId)) return result;
  result.set(startRouterId, 0);
  while (settled.size < adjacency2.size) {
    let currentId = null;
    let currentCost = Number.POSITIVE_INFINITY;
    for (const [routerId, cost] of result) {
      if (settled.has(routerId)) continue;
      if (cost < currentCost || cost === currentCost && currentId !== null && routerId.localeCompare(currentId) < 0) {
        currentId = routerId;
        currentCost = cost;
      }
    }
    if (currentId === null || !Number.isFinite(currentCost)) break;
    settled.add(currentId);
    for (const edge of adjacency2.get(currentId) ?? []) {
      const next = currentCost + edge.cost;
      if (next < (result.get(edge.neighbor) ?? Number.POSITIVE_INFINITY)) result.set(edge.neighbor, next);
    }
  }
  return result;
}
function builderOspfAreaPath(graph4, config, sourceRouterId, destinationRouterId, areaId) {
  const normalizedArea = normalizeBuilderOspfAreaId(areaId);
  const adjacency2 = adjacencyMap(graph4, config, normalizedArea);
  if (sourceRouterId === destinationRouterId) {
    const participates = builderOspfAreasForRouter(graph4, config, sourceRouterId).includes(normalizedArea);
    return { reachable: participates, totalCost: 0, firstHops: [] };
  }
  if (!adjacency2.has(sourceRouterId) || !adjacency2.has(destinationRouterId)) return { reachable: false, totalCost: 0, firstHops: [] };
  const fromSource = distances2(adjacency2, sourceRouterId);
  const toDestination = distances2(adjacency2, destinationRouterId);
  const totalCost = fromSource.get(destinationRouterId) ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(totalCost)) return { reachable: false, totalCost: 0, firstHops: [] };
  const firstHops = (adjacency2.get(sourceRouterId) ?? []).filter((edge) => edge.cost + (toDestination.get(edge.neighbor) ?? Number.POSITIVE_INFINITY) === totalCost).map((edge) => ({ nextRouterId: edge.neighbor, linkId: edge.linkId })).sort((a, b) => a.nextRouterId.localeCompare(b.nextRouterId) || a.linkId.localeCompare(b.linkId));
  return { reachable: firstHops.length > 0, totalCost, firstHops };
}
function abrIdsForArea(graph4, config, areaId) {
  const normalized = normalizeBuilderOspfAreaId(areaId);
  return builderOspfAbrRouterIds(graph4, config).filter((routerId) => builderOspfAreasForRouter(graph4, config, routerId).includes(normalized));
}
function builderOspfPathCandidates(graph4, config, sourceRouterId, originRouterId, originAreaId) {
  const originArea = normalizeBuilderOspfAreaId(originAreaId);
  const sourceAreas = builderOspfAreasForRouter(graph4, config, sourceRouterId);
  if (sourceAreas.includes(originArea)) {
    const intra = builderOspfAreaPath(graph4, config, sourceRouterId, originRouterId, originArea);
    if (!intra.reachable) return [];
    return [{ ...intra, routeType: "intra-area", sourceAreaId: originArea, originAreaId: originArea, sourceAbrRouterId: null, destinationAbrRouterId: null, costToDestinationAbr: intra.totalCost }];
  }
  const sourceAreaChoices = sourceAreas.includes(BUILDER_OSPF_BACKBONE_AREA) ? [BUILDER_OSPF_BACKBONE_AREA] : sourceAreas.filter((areaId) => areaId !== BUILDER_OSPF_BACKBONE_AREA);
  const sourceBackboneEntries = [];
  for (const sourceAreaId of sourceAreaChoices) {
    if (sourceAreaId === BUILDER_OSPF_BACKBONE_AREA) {
      sourceBackboneEntries.push({ sourceAreaId, abrRouterId: sourceRouterId, local: { reachable: true, totalCost: 0, firstHops: [] } });
      continue;
    }
    for (const abrRouterId of abrIdsForArea(graph4, config, sourceAreaId)) {
      const local = builderOspfAreaPath(graph4, config, sourceRouterId, abrRouterId, sourceAreaId);
      if (local.reachable) sourceBackboneEntries.push({ sourceAreaId, abrRouterId, local });
    }
  }
  const destinationEntries = [];
  if (originArea === BUILDER_OSPF_BACKBONE_AREA) {
    destinationEntries.push({ abrRouterId: originRouterId, destination: { reachable: true, totalCost: 0, firstHops: [] } });
  } else {
    for (const abrRouterId of abrIdsForArea(graph4, config, originArea)) {
      const destination = builderOspfAreaPath(graph4, config, abrRouterId, originRouterId, originArea);
      if (destination.reachable) destinationEntries.push({ abrRouterId, destination });
    }
  }
  const candidates = [];
  for (const sourceEntry of sourceBackboneEntries) {
    for (const destinationEntry of destinationEntries) {
      const backbone = builderOspfAreaPath(graph4, config, sourceEntry.abrRouterId, destinationEntry.abrRouterId, BUILDER_OSPF_BACKBONE_AREA);
      if (!backbone.reachable) continue;
      const firstHops = sourceEntry.local.firstHops.length > 0 ? sourceEntry.local.firstHops : backbone.firstHops.length > 0 ? backbone.firstHops : destinationEntry.destination.firstHops;
      const costToDestinationAbr = sourceEntry.local.totalCost + backbone.totalCost;
      candidates.push({
        reachable: true,
        totalCost: costToDestinationAbr + destinationEntry.destination.totalCost,
        firstHops,
        routeType: "inter-area",
        sourceAreaId: sourceEntry.sourceAreaId,
        originAreaId: originArea,
        sourceAbrRouterId: sourceEntry.sourceAreaId === BUILDER_OSPF_BACKBONE_AREA ? null : sourceEntry.abrRouterId,
        destinationAbrRouterId: originArea === BUILDER_OSPF_BACKBONE_AREA ? null : destinationEntry.abrRouterId,
        costToDestinationAbr
      });
    }
  }
  return candidates.sort((a, b) => a.totalCost - b.totalCost || (a.sourceAbrRouterId ?? "").localeCompare(b.sourceAbrRouterId ?? "") || (a.destinationAbrRouterId ?? "").localeCompare(b.destinationAbrRouterId ?? "") || a.firstHops.map((hop) => `${hop.nextRouterId}:${hop.linkId}`).join("|").localeCompare(b.firstHops.map((hop) => `${hop.nextRouterId}:${hop.linkId}`).join("|")));
}
function builderOspfAreaComponents(graph4, config, areaId) {
  const adjacency2 = adjacencyMap(graph4, config, areaId);
  const unvisited = new Set(adjacency2.keys());
  const components = [];
  while (unvisited.size > 0) {
    const seed = [...unvisited].sort()[0];
    const stack = [seed];
    const component = [];
    unvisited.delete(seed);
    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);
      for (const edge of [...adjacency2.get(current) ?? []].sort((a, b) => b.neighbor.localeCompare(a.neighbor))) {
        if (!unvisited.has(edge.neighbor)) continue;
        unvisited.delete(edge.neighbor);
        stack.push(edge.neighbor);
      }
    }
    components.push(component.sort());
  }
  return components.sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? ""));
}

// ../8f1a24ac8c73/hopscotch/src/builder/routing-base.ts
function ipv4ToInt5(value) {
  const normalized = normalizeBuilderIpv4(value);
  return normalized.split(".").reduce((result, part) => (result << 8 | Number(part)) >>> 0, 0) >>> 0;
}
function intToIpv45(value) {
  const normalized = value >>> 0;
  return [24, 16, 8, 0].map((shift) => normalized >>> shift & 255).join(".");
}
function parseRoutePrefix(value) {
  const normalized = value.trim();
  const [addressText, prefixText, ...extra] = normalized.split("/");
  if (!addressText || !prefixText || extra.length > 0 || !/^\d{1,2}$/.test(prefixText)) {
    throw new Error(`Invalid IPv4 route prefix: ${value}.`);
  }
  const prefixLength2 = Number(prefixText);
  if (!Number.isInteger(prefixLength2) || prefixLength2 < 0 || prefixLength2 > 32) {
    throw new Error("IPv4 route prefixes must be /0 through /32.");
  }
  const address2 = ipv4ToInt5(addressText);
  const mask = prefixLength2 === 0 ? 0 : 4294967295 << 32 - prefixLength2 >>> 0;
  const network = (address2 & mask) >>> 0;
  const broadcast = (network | ~mask >>> 0) >>> 0;
  return { cidr: `${intToIpv45(network)}/${prefixLength2}`, prefixLength: prefixLength2, network, broadcast };
}
function nodeById(graph4, nodeId) {
  return graph4.nodes.find((node) => node.id === nodeId);
}
function linkById2(graph4, linkId) {
  return graph4.links.find((link) => link.id === linkId);
}
function enabledOspfSet(routing3) {
  return new Set(routing3.ospf?.enabledRouterIds ?? []);
}
function remoteInterfaceForNextHop(graph4, addressing3, routerId, nextHop) {
  const normalizedNextHop = normalizeBuilderIpv4(nextHop);
  for (const link of graph4.links) {
    if (link.a !== routerId && link.b !== routerId) continue;
    const segment = addressing3.segments[link.id];
    if (!segment) continue;
    const local = segment.interfaces.find((entry) => entry.nodeId === routerId);
    const remote = segment.interfaces.find((entry) => entry.nodeId !== routerId && entry.address === normalizedNextHop);
    if (local && remote) return { linkId: link.id, local, remote };
  }
  return null;
}
function primaryInterfaceForNode(addressing3, nodeId) {
  return interfacesForBuilderNode(addressing3, nodeId)[0] ?? null;
}
function createDefaultBuilderRoutingConfig() {
  return { staticRoutes: [], ospf: { enabledRouterIds: [], linkAreas: {}, summaries: [] }, bgp: createDefaultBuilderBgpConfig() };
}
function validateBuilderRoutingConfig(graph4, addressing3, value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.staticRoutes)) throw new Error("Builder routing config must contain a staticRoutes array.");
  const routeIds = /* @__PURE__ */ new Set();
  const seenRouterPrefix = /* @__PURE__ */ new Set();
  const staticRoutes = value.staticRoutes.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Static route ${index + 1} is invalid.`);
    const id2 = String(raw.id ?? "").trim();
    if (!id2 || id2.length > 120 || !/^[a-zA-Z0-9_.:-]+$/.test(id2)) throw new Error(`Static route ${index + 1} has an invalid id.`);
    if (routeIds.has(id2)) throw new Error(`Duplicate static route id ${id2}.`);
    routeIds.add(id2);
    const routerId = String(raw.routerId ?? "").trim();
    const router = nodeById(graph4, routerId);
    if (!router || router.kind !== "router") throw new Error(`Static route ${id2} must belong to a router node.`);
    const prefix2 = parseRoutePrefix(String(raw.prefix ?? "")).cidr;
    const routeKey = `${routerId}\0${prefix2}`;
    if (seenRouterPrefix.has(routeKey)) throw new Error(`${routerId} already has a static route for ${prefix2}.`);
    seenRouterPrefix.add(routeKey);
    const nextHop = normalizeBuilderIpv4(String(raw.nextHop ?? ""));
    if (!remoteInterfaceForNextHop(graph4, addressing3, routerId, nextHop)) {
      throw new Error(`${routerId} static next hop ${nextHop} must be an interface on a directly connected neighbor.`);
    }
    const metric = Number(raw.metric);
    if (!Number.isInteger(metric) || metric < 1 || metric > 999) throw new Error(`Static route ${id2} metric must be an integer from 1 to 999.`);
    return { id: id2, routerId, prefix: prefix2, nextHop, metric };
  });
  const rawEnabled = value.ospf?.enabledRouterIds ?? [];
  if (!Array.isArray(rawEnabled)) throw new Error("Builder OSPF config must contain an enabledRouterIds array.");
  const enabledRouterIds = [...new Set(rawEnabled.map((id2) => String(id2).trim()))].sort();
  if (enabledRouterIds.some((id2) => !id2)) throw new Error("OSPF router ids must be non-empty Builder node ids.");
  for (const routerId of enabledRouterIds) {
    const router = nodeById(graph4, routerId);
    if (!router || router.kind !== "router") throw new Error(`OSPF can only be enabled on router nodes; ${routerId} is not a router.`);
  }
  const areaConfig = validateBuilderOspfAreaConfig(graph4, { ...value.ospf ?? { enabledRouterIds }, enabledRouterIds });
  const bgp2 = validateBuilderBgpConfig(graph4, value.bgp ?? createDefaultBuilderBgpConfig());
  return { staticRoutes, ospf: { enabledRouterIds, linkAreas: areaConfig.linkAreas, summaries: areaConfig.summaries }, bgp: bgp2 };
}
function cloneBuilderRoutingConfig(value) {
  return {
    staticRoutes: value.staticRoutes.map((route) => ({ ...route })),
    ospf: { enabledRouterIds: [...value.ospf?.enabledRouterIds ?? []], linkAreas: { ...value.ospf?.linkAreas ?? {} }, summaries: (value.ospf?.summaries ?? []).map((summary) => ({ ...summary })) },
    bgp: cloneBuilderBgpConfig(value.bgp ?? createDefaultBuilderBgpConfig())
  };
}
function reconcileBuilderRoutingConfig(graph4, addressing3, current) {
  const retained = current.staticRoutes.filter((route) => {
    const router = nodeById(graph4, route.routerId);
    if (!router || router.kind !== "router") return false;
    try {
      parseRoutePrefix(route.prefix);
      return remoteInterfaceForNextHop(graph4, addressing3, route.routerId, route.nextHop) !== null;
    } catch {
      return false;
    }
  });
  const unique = /* @__PURE__ */ new Map();
  for (const route of retained) {
    const key2 = `${route.routerId}\0${parseRoutePrefix(route.prefix).cidr}`;
    if (!unique.has(key2)) unique.set(key2, { ...route, prefix: parseRoutePrefix(route.prefix).cidr, nextHop: normalizeBuilderIpv4(route.nextHop) });
  }
  const enabledRouterIds = (current.ospf?.enabledRouterIds ?? []).filter((routerId) => nodeById(graph4, routerId)?.kind === "router");
  const areaConfig = reconcileBuilderOspfAreaConfig(graph4, { ...current.ospf ?? { enabledRouterIds }, enabledRouterIds });
  return validateBuilderRoutingConfig(graph4, addressing3, { staticRoutes: [...unique.values()], ospf: { enabledRouterIds, linkAreas: areaConfig.linkAreas, summaries: areaConfig.summaries }, bgp: reconcileBuilderBgpConfig(graph4, current.bgp ?? createDefaultBuilderBgpConfig()) });
}
function setBuilderOspfEverywhere(graph4, addressing3, routing3, enabled) {
  return validateBuilderRoutingConfig(graph4, addressing3, {
    ...cloneBuilderRoutingConfig(routing3),
    ospf: { ...routing3.ospf ?? {}, enabledRouterIds: enabled ? graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id) : [] }
  });
}
function builderOspfState(graph4, addressing3, routing3) {
  const validated = validateBuilderRoutingConfig(graph4, addressing3, routing3);
  const enabled = enabledOspfSet(validated);
  const enabledRouterIds = [...enabled].filter((routerId) => nodeById(graph4, routerId)?.kind === "router").sort();
  const adjacencies = [];
  for (const link of graph4.links) {
    if (!enabled.has(link.a) || !enabled.has(link.b)) continue;
    if (nodeById(graph4, link.a)?.kind !== "router" || nodeById(graph4, link.b)?.kind !== "router") continue;
    const areaId = builderOspfAreaForLink(validated.ospf, link.id);
    adjacencies.push({
      id: `ospf-adj:${link.id}`,
      linkId: link.id,
      areaId,
      aRouterId: link.a,
      bRouterId: link.b,
      cost: link.cost,
      state: link.failed ? "DOWN" : "FULL",
      reason: link.failed ? "LINK DOWN" : `${areaId} ADJACENCY`
    });
  }
  adjacencies.sort((a, b) => a.areaId.localeCompare(b.areaId) || a.linkId.localeCompare(b.linkId));
  const advertisements = [];
  for (const routerId of enabledRouterIds) {
    for (const entry of interfacesForBuilderNode(addressing3, routerId)) {
      const link = linkById2(graph4, entry.linkId);
      if (!link || link.failed) continue;
      advertisements.push({
        id: `ospf-lsa:${routerId}:${entry.linkId}`,
        routerId,
        areaId: builderOspfAreaForLink(validated.ospf, entry.linkId),
        prefix: parseBuilderIpv4Cidr(entry.cidr).cidr,
        linkId: entry.linkId,
        metric: link.cost
      });
    }
  }
  advertisements.sort((a, b) => a.areaId.localeCompare(b.areaId) || a.routerId.localeCompare(b.routerId) || a.prefix.localeCompare(b.prefix) || a.linkId.localeCompare(b.linkId));
  const fullAdjacency = adjacencies.filter((adjacency2) => adjacency2.state === "FULL");
  const adjacencyByRouter = /* @__PURE__ */ new Map();
  for (const routerId of enabledRouterIds) adjacencyByRouter.set(routerId, []);
  for (const adjacency2 of fullAdjacency) {
    adjacencyByRouter.get(adjacency2.aRouterId)?.push(adjacency2.bRouterId);
    adjacencyByRouter.get(adjacency2.bRouterId)?.push(adjacency2.aRouterId);
  }
  const unvisited = new Set(enabledRouterIds);
  const components = [];
  while (unvisited.size > 0) {
    const seed = [...unvisited].sort()[0];
    const stack = [seed];
    const component = [];
    unvisited.delete(seed);
    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);
      for (const neighbor of [...adjacencyByRouter.get(current) ?? []].sort().reverse()) {
        if (!unvisited.has(neighbor)) continue;
        unvisited.delete(neighbor);
        stack.push(neighbor);
      }
    }
    components.push(component.sort());
  }
  components.sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? ""));
  const areaIds = [.../* @__PURE__ */ new Set([BUILDER_OSPF_BACKBONE_AREA, ...adjacencies.map((entry) => entry.areaId), ...advertisements.map((entry) => entry.areaId)])].sort();
  const areaComponents = Object.fromEntries(areaIds.map((areaId) => [areaId, builderOspfAreaComponents(graph4, validated.ospf, areaId)]));
  return {
    areaId: BUILDER_OSPF_BACKBONE_AREA,
    areaIds,
    enabledRouterIds,
    abrRouterIds: builderOspfAbrRouterIds(graph4, validated.ospf),
    areaComponents,
    adjacencies,
    advertisements,
    components,
    fullAdjacencyCount: fullAdjacency.length,
    downAdjacencyCount: adjacencies.length - fullAdjacency.length
  };
}
function ospfRouteEntriesForBuilderRouter(graph4, addressing3, routing3, routerId) {
  const enabled = enabledOspfSet(routing3);
  if (!enabled.has(routerId)) return [];
  const directlyConnected = new Set(interfacesForBuilderNode(addressing3, routerId).map((entry) => parseBuilderIpv4Cidr(entry.cidr).cidr));
  const state = builderOspfState(graph4, addressing3, routing3);
  const candidates = [];
  for (const advertisement of state.advertisements) {
    if (advertisement.routerId === routerId || directlyConnected.has(advertisement.prefix)) continue;
    const paths = builderOspfPathCandidates(graph4, routing3.ospf, routerId, advertisement.routerId, advertisement.areaId);
    for (const path of paths) {
      if (!path.reachable || path.firstHops.length === 0) continue;
      const matchingSummary = path.routeType === "inter-area" && path.destinationAbrRouterId ? (routing3.ospf.summaries ?? []).find((summary) => summary.abrRouterId === path.destinationAbrRouterId && normalizeBuilderOspfAreaId(summary.fromAreaId) === advertisement.areaId && builderOspfPrefixContains(summary.prefix, advertisement.prefix)) : void 0;
      const learnedPrefix = matchingSummary?.prefix ?? advertisement.prefix;
      const parsed = parseRoutePrefix(learnedPrefix);
      const metric = matchingSummary ? path.costToDestinationAbr + matchingSummary.metric : path.totalCost + advertisement.metric;
      for (const firstHop of path.firstHops) {
        const segment = addressing3.segments[firstHop.linkId];
        const local = segment?.interfaces.find((entry) => entry.nodeId === routerId);
        const remote = segment?.interfaces.find((entry) => entry.nodeId === firstHop.nextRouterId);
        if (!segment || !local || !remote) continue;
        const routeType = path.routeType;
        const abrRouterId = matchingSummary?.abrRouterId ?? path.destinationAbrRouterId;
        const routeLabel = routeType === "intra-area" ? `OSPF O \xB7 AREA ${advertisement.areaId}` : matchingSummary ? `OSPF O IA \xB7 SUMMARY ${matchingSummary.prefix} FROM ${advertisement.areaId}` : `OSPF O IA \xB7 AREA ${advertisement.areaId}`;
        candidates.push({
          id: `ospf:${routerId}:${parsed.cidr}:${advertisement.routerId}:${firstHop.nextRouterId}:${firstHop.linkId}:${matchingSummary?.id ?? "specific"}`.replace(/\//g, ":"),
          routerId,
          prefix: parsed.cidr,
          prefixLength: parsed.prefixLength,
          source: "ospf",
          administrativeDistance: 110,
          metric,
          nextHop: remote.address,
          outgoingInterface: local.name,
          linkId: firstHop.linkId,
          active: true,
          stateNote: `${routeLabel}${abrRouterId ? ` \xB7 ABR ${nodeById(graph4, abrRouterId)?.label ?? abrRouterId}` : ""} \xB7 ORIGIN ${nodeById(graph4, advertisement.routerId)?.label ?? advertisement.routerId}`,
          ospfRouteType: routeType,
          ospfAreaId: advertisement.areaId,
          ospfAbrRouterId: abrRouterId,
          ospfSummaryId: matchingSummary?.id ?? null
        });
      }
    }
  }
  const byPrefix = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    const list = byPrefix.get(candidate.prefix) ?? [];
    list.push(candidate);
    byPrefix.set(candidate.prefix, list);
  }
  const winners = [];
  for (const prefixCandidates of byPrefix.values()) {
    const bestOspfRank = Math.min(...prefixCandidates.map((candidate) => candidate.ospfRouteType === "inter-area" ? 1 : 0));
    const preferredType = prefixCandidates.filter((candidate) => (candidate.ospfRouteType === "inter-area" ? 1 : 0) === bestOspfRank);
    const bestMetric = Math.min(...preferredType.map((candidate) => candidate.metric));
    const byNextHop = /* @__PURE__ */ new Map();
    for (const candidate of preferredType.filter((entry) => entry.metric === bestMetric).sort((a, b) => a.id.localeCompare(b.id))) {
      const key2 = `${candidate.nextHop ?? ""}\0${candidate.linkId}`;
      if (!byNextHop.has(key2)) byNextHop.set(key2, candidate);
    }
    const equal = [...byNextHop.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const candidate of equal) winners.push({ ...candidate, stateNote: `${candidate.stateNote}${equal.length > 1 ? ` \xB7 ECMP ${equal.length}-WAY` : ""}` });
  }
  return winners;
}
function upsertBuilderStaticRoute(graph4, addressing3, routing3, route) {
  const prefix2 = parseRoutePrefix(route.prefix).cidr;
  const nextHop = normalizeBuilderIpv4(route.nextHop);
  const id2 = route.id?.trim() || `static:${route.routerId}:${prefix2}:${nextHop}`.replace(/\//g, ":");
  const next = cloneBuilderRoutingConfig(routing3);
  next.staticRoutes = next.staticRoutes.filter((entry) => !(entry.routerId === route.routerId && parseRoutePrefix(entry.prefix).cidr === prefix2));
  next.staticRoutes.push({ id: id2, routerId: route.routerId, prefix: prefix2, nextHop, metric: route.metric });
  return validateBuilderRoutingConfig(graph4, addressing3, next);
}
function routeTableForBuilderRouter(graph4, addressing3, routing3, routerId, ospfTopologyGraph = graph4) {
  const router = nodeById(graph4, routerId);
  if (!router || router.kind !== "router") return [];
  const entries = [];
  for (const entry of interfacesForBuilderNode(addressing3, routerId)) {
    const link = linkById2(graph4, entry.linkId);
    const parsed = parseBuilderIpv4Cidr(entry.cidr);
    entries.push({
      id: `connected:${routerId}:${entry.linkId}`,
      routerId,
      prefix: parsed.cidr,
      prefixLength: parsed.prefixLength,
      source: "connected",
      administrativeDistance: 0,
      metric: 0,
      nextHop: null,
      outgoingInterface: entry.name,
      linkId: entry.linkId,
      active: Boolean(link && !link.failed),
      stateNote: link?.failed ? "LINK DOWN" : "DIRECTLY CONNECTED"
    });
  }
  for (const route of routing3.staticRoutes.filter((entry) => entry.routerId === routerId)) {
    const attachment = remoteInterfaceForNextHop(graph4, addressing3, routerId, route.nextHop);
    const link = attachment ? linkById2(graph4, attachment.linkId) : null;
    const parsed = parseRoutePrefix(route.prefix);
    entries.push({
      id: route.id,
      routerId,
      prefix: parsed.cidr,
      prefixLength: parsed.prefixLength,
      source: "static",
      administrativeDistance: 1,
      metric: route.metric,
      nextHop: route.nextHop,
      outgoingInterface: attachment?.local.name ?? "\u2014",
      linkId: attachment?.linkId ?? "\u2014",
      active: Boolean(attachment && link && !link.failed),
      stateNote: !attachment ? "NEXT HOP INVALID" : link?.failed ? "NEXT-HOP LINK DOWN" : "STATIC"
    });
  }
  entries.push(...ospfRouteEntriesForBuilderRouter(ospfTopologyGraph, addressing3, routing3, routerId));
  const bgpState = builderBgpState(graph4, addressing3, routing3.bgp ?? createDefaultBuilderBgpConfig());
  for (const path of bgpState.bestRoutes.filter((route) => route.routerId === routerId && route.learnedVia !== "local")) {
    const attachment = remoteInterfaceForNextHop(graph4, addressing3, routerId, path.nextHopAddress);
    const link = attachment ? linkById2(graph4, attachment.linkId) : null;
    const parsed = parseRoutePrefix(path.prefix);
    entries.push({
      id: `fib:${path.id}`,
      routerId,
      prefix: parsed.cidr,
      prefixLength: parsed.prefixLength,
      source: "bgp",
      administrativeDistance: path.learnedVia === "ebgp" ? 20 : 200,
      metric: path.asPath.length * 1e3 + path.med,
      nextHop: path.nextHopAddress,
      outgoingInterface: attachment?.local.name ?? "\u2014",
      linkId: attachment?.linkId ?? "\u2014",
      active: Boolean(attachment && link && !link.failed),
      stateNote: `${path.learnedVia.toUpperCase()} \xB7 LP ${path.localPref} \xB7 AS_PATH ${path.asPath.length ? path.asPath.join(" ") : "LOCAL"} \xB7 MED ${path.med} \xB7 BGP NEXT_HOP ${path.nextHopAddress}${path.communities.length ? ` \xB7 COMM ${path.communities.join(" ")}` : ""}${path.policyAnomaly ? " \xB7 RELATIONSHIP LEAK" : ""}${!attachment ? " \xB7 NEXT_HOP UNRESOLVED" : ""}`,
      bgpLearnedVia: path.learnedVia,
      bgpAsPath: [...path.asPath],
      bgpLocalPref: path.localPref,
      bgpMed: path.med,
      bgpCommunities: [...path.communities],
      bgpProtocolNextHop: path.nextHopAddress,
      bgpPolicyAnomaly: path.policyAnomaly
    });
  }
  return entries.sort((left, right) => right.prefixLength - left.prefixLength || left.administrativeDistance - right.administrativeDistance || left.metric - right.metric || left.id.localeCompare(right.id));
}
function builderStableFlowHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
function installStaticRoutesForWeightedPath(graph4, addressing3, routing3, sourceNodeId, destinationNodeId) {
  const weighted = findShortestPath(graph4, sourceNodeId, destinationNodeId);
  if (!weighted.reachable || weighted.nodeIds.length < 2) throw new Error("The current weighted graph has no path to install.");
  const destinationInterface = primaryInterfaceForNode(addressing3, destinationNodeId);
  if (!destinationInterface) throw new Error("Destination has no IPv4 interface to route toward.");
  const destinationSegment = addressing3.segments[destinationInterface.linkId];
  if (!destinationSegment) throw new Error("Destination IPv4 segment is missing.");
  const prefix2 = parseBuilderIpv4Cidr(destinationSegment.cidr).cidr;
  let nextRouting = cloneBuilderRoutingConfig(routing3);
  const installedRouterIds = [];
  for (let index = 0; index < weighted.nodeIds.length - 1; index += 1) {
    const currentId = weighted.nodeIds[index];
    const nextId = weighted.nodeIds[index + 1];
    const current = nodeById(graph4, currentId);
    if (!current) throw new Error(`Weighted path references missing device ${currentId}.`);
    if (current.kind === "endpoint") {
      if (index !== 0) throw new Error(`Endpoint ${current.label} cannot forward transit traffic; change the graph path.`);
      continue;
    }
    const table = routeTableForBuilderRouter(graph4, addressing3, nextRouting, currentId);
    if (table.some((entry) => entry.source === "connected" && entry.active && parseRoutePrefix(entry.prefix).cidr === prefix2)) continue;
    const step = weighted.steps[index];
    if (!step || step.from !== currentId || step.to !== nextId) throw new Error(`Weighted path step ${index + 1} is inconsistent.`);
    const segment = addressing3.segments[step.linkId];
    const remote = segment?.interfaces.find((entry) => entry.nodeId === nextId);
    if (!remote) throw new Error(`No next-hop interface exists for ${current.label} \u2192 ${nextId}.`);
    nextRouting = upsertBuilderStaticRoute(graph4, addressing3, nextRouting, {
      routerId: currentId,
      prefix: prefix2,
      nextHop: remote.address,
      metric: step.cost
    });
    installedRouterIds.push(currentId);
  }
  return { routing: nextRouting, prefix: prefix2, installedRouterIds, weightedPathNodeIds: [...weighted.nodeIds] };
}

// ../8f1a24ac8c73/hopscotch/src/builder/routing.ts
function toBaseRouting(value) {
  return {
    staticRoutes: value.staticRoutes.map((route) => ({ ...route })),
    ospf: {
      enabledRouterIds: [...value.ospf?.enabledRouterIds ?? []],
      linkAreas: { ...value.ospf?.linkAreas ?? {} },
      summaries: (value.ospf?.summaries ?? []).map((summary) => ({ ...summary }))
    },
    bgp: value.bgp
  };
}
function configuredAreaIds(graph4, ospf) {
  return new Set(graph4.links.map((link) => builderOspfAreaForLink(ospf, link.id)));
}
function builderOspfAreaType(ospf, areaId) {
  const normalized = normalizeBuilderOspfAreaId(areaId);
  if (normalized === BUILDER_OSPF_BACKBONE_AREA) return "normal";
  const value = ospf.areaTypes?.[normalized];
  return value === "stub" || value === "nssa" ? value : "normal";
}
function validateOspfExtensions(graph4, baseRouting, rawOspf) {
  const areas = configuredAreaIds(graph4, baseRouting.ospf);
  const areaTypes = {};
  for (const [rawAreaId, rawType] of Object.entries(rawOspf.areaTypes ?? {})) {
    const areaId = normalizeBuilderOspfAreaId(rawAreaId);
    if (rawType !== "normal" && rawType !== "stub" && rawType !== "nssa") throw new Error(`OSPF area ${areaId} has unsupported type ${String(rawType)}.`);
    if (areaId === BUILDER_OSPF_BACKBONE_AREA && rawType !== "normal") throw new Error("OSPF Area 0 cannot be stub or NSSA.");
    if (!areas.has(areaId)) throw new Error(`OSPF area type references area ${areaId}, which is not assigned to any routed link.`);
    if (rawType !== "normal") areaTypes[areaId] = rawType;
  }
  const staticById = new Map(baseRouting.staticRoutes.map((route) => [route.id, route]));
  const enabled = new Set(baseRouting.ospf.enabledRouterIds);
  const ids = /* @__PURE__ */ new Set();
  const redistributions = (rawOspf.redistributions ?? []).map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`OSPF redistribution ${index + 1} is invalid.`);
    const id2 = String(raw.id ?? "").trim();
    if (!id2 || id2.length > 160 || !/^[a-zA-Z0-9_.:-]+$/.test(id2) || ids.has(id2)) throw new Error(`OSPF redistribution ${index + 1} has an invalid or duplicate id.`);
    ids.add(id2);
    const routerId = String(raw.routerId ?? "").trim();
    if (!enabled.has(routerId)) throw new Error(`OSPF redistribution ${id2} requires OSPF to be enabled on ${routerId}.`);
    const staticRouteId = String(raw.staticRouteId ?? "").trim();
    const staticRoute = staticById.get(staticRouteId);
    if (!staticRoute || staticRoute.routerId !== routerId) throw new Error(`OSPF redistribution ${id2} must reference a static route owned by ${routerId}.`);
    const areaId = normalizeBuilderOspfAreaId(String(raw.areaId ?? ""));
    if (!builderOspfAreasForRouter(graph4, baseRouting.ospf, routerId).includes(areaId)) throw new Error(`OSPF redistribution ${id2} origin router ${routerId} is not attached to ${areaId}.`);
    const areaType = areaId === BUILDER_OSPF_BACKBONE_AREA ? "normal" : areaTypes[areaId] ?? "normal";
    if (areaType === "stub") throw new Error(`OSPF redistribution ${id2} cannot originate external routes inside stub area ${areaId}.`);
    const metric = Number(raw.metric);
    if (!Number.isInteger(metric) || metric < 1 || metric > 16777215) throw new Error(`OSPF redistribution ${id2} metric must be 1\u201316777215.`);
    return { id: id2, routerId, staticRouteId, areaId, metric };
  }).sort((a, b) => a.areaId.localeCompare(b.areaId) || a.routerId.localeCompare(b.routerId) || a.staticRouteId.localeCompare(b.staticRouteId) || a.id.localeCompare(b.id));
  return { areaTypes, redistributions };
}
function createDefaultBuilderRoutingConfig2() {
  const result = createDefaultBuilderRoutingConfig();
  return { ...result, ospf: { ...result.ospf, areaTypes: {}, redistributions: [] }, policy: createDefaultBuilderRoutingPolicyConfig(), provider: createDefaultBuilderProviderConfig() };
}
function validateBuilderRoutingConfig2(graph4, addressing3, value) {
  const baseRouting = validateBuilderRoutingConfig(graph4, addressing3, toBaseRouting(value));
  const extensions = validateOspfExtensions(graph4, baseRouting, value.ospf ?? { enabledRouterIds: [] });
  return {
    ...baseRouting,
    ospf: { ...baseRouting.ospf, areaTypes: extensions.areaTypes, redistributions: extensions.redistributions },
    policy: validateBuilderRoutingPolicyConfig(graph4, addressing3, value.policy),
    provider: validateBuilderProviderConfig(graph4, addressing3, value.provider)
  };
}
function cloneBuilderRoutingConfig2(value) {
  const cloned = cloneBuilderRoutingConfig(toBaseRouting(value));
  return {
    ...cloned,
    ospf: {
      ...cloned.ospf,
      areaTypes: { ...value.ospf?.areaTypes ?? {} },
      redistributions: (value.ospf?.redistributions ?? []).map((entry) => ({ ...entry }))
    },
    policy: cloneBuilderRoutingPolicyConfig(value.policy),
    provider: cloneBuilderProviderConfig(value.provider)
  };
}
function reconcileBuilderRoutingConfig2(graph4, addressing3, current) {
  const reconciled = reconcileBuilderRoutingConfig(graph4, addressing3, toBaseRouting(current));
  const areas = configuredAreaIds(graph4, reconciled.ospf);
  const areaTypes = Object.fromEntries(Object.entries(current.ospf?.areaTypes ?? {}).filter(([areaId]) => {
    try {
      return areas.has(normalizeBuilderOspfAreaId(areaId));
    } catch {
      return false;
    }
  }));
  const staticById = new Map(reconciled.staticRoutes.map((route) => [route.id, route]));
  const enabled = new Set(reconciled.ospf.enabledRouterIds);
  const redistributions = (current.ospf?.redistributions ?? []).filter((entry) => {
    const route = staticById.get(entry.staticRouteId);
    if (!route || route.routerId !== entry.routerId || !enabled.has(entry.routerId)) return false;
    try {
      const areaId = normalizeBuilderOspfAreaId(entry.areaId);
      return builderOspfAreasForRouter(graph4, reconciled.ospf, entry.routerId).includes(areaId) && (areaId === BUILDER_OSPF_BACKBONE_AREA || (areaTypes[areaId] ?? "normal") !== "stub");
    } catch {
      return false;
    }
  });
  return validateBuilderRoutingConfig2(graph4, addressing3, { ...reconciled, ospf: { ...reconciled.ospf, areaTypes, redistributions }, policy: reconcileBuilderRoutingPolicyConfig(graph4, addressing3, current.policy), provider: reconcileBuilderProviderConfig(graph4, addressing3, current.provider) });
}
function preserveExtensions(graph4, addressing3, result, source, redistributions = source.ospf?.redistributions ?? []) {
  return validateBuilderRoutingConfig2(graph4, addressing3, {
    ...result,
    ospf: {
      ...result.ospf,
      areaTypes: { ...source.ospf?.areaTypes ?? {} },
      redistributions: redistributions.map((entry) => ({ ...entry }))
    },
    policy: cloneBuilderRoutingPolicyConfig(source.policy),
    provider: cloneBuilderProviderConfig(source.provider)
  });
}
function setBuilderOspfEverywhere2(graph4, addressing3, routing3, enabled) {
  const result = setBuilderOspfEverywhere(graph4, addressing3, toBaseRouting(routing3), enabled);
  return preserveExtensions(graph4, addressing3, result, routing3, enabled ? routing3.ospf.redistributions ?? [] : []);
}
function builderOspfState2(graph4, addressing3, routing3) {
  const effective = builderOspfEffectiveGraph(graph4, routing3.policy, routing3.ospf.enabledRouterIds);
  const state = builderOspfState(effective, addressing3, toBaseRouting(routing3));
  return { ...state, adjacencies: state.adjacencies.map((adj) => {
    const physical = graph4.links.find((link) => link.id === adj.linkId);
    if (physical && !physical.failed && !builderOspfTimerCompatible(routing3.policy, adj.aRouterId, adj.bRouterId, adj.linkId)) return { ...adj, state: "DOWN", reason: "HELLO/DEAD TIMER MISMATCH" };
    return adj;
  }) };
}
function setBuilderProviderConfig(graph4, addressing3, routing3, provider2) {
  return validateBuilderRoutingConfig2(graph4, addressing3, { ...cloneBuilderRoutingConfig2(routing3), provider: provider2 });
}
function nodeById2(graph4, nodeId) {
  return graph4.nodes.find((node) => node.id === nodeId);
}
function linkById3(graph4, linkId) {
  return graph4.links.find((link) => link.id === linkId);
}
function ipv4ToInt6(value) {
  return normalizeBuilderIpv4(value).split(".").reduce((result, part) => (result << 8 | Number(part)) >>> 0, 0) >>> 0;
}
function prefixContains(prefix2, address2) {
  const [rawAddress, rawLength] = prefix2.split("/");
  const length = Number(rawLength);
  const mask = length === 0 ? 0 : 4294967295 << 32 - length >>> 0;
  return (ipv4ToInt6(rawAddress) & mask) === (ipv4ToInt6(address2) & mask);
}
function firstHopEntry(graph4, addressing3, routerId, nextRouterId, linkId) {
  const segment = addressing3.segments[linkId];
  const local = segment?.interfaces.find((entry) => entry.nodeId === routerId);
  const remote = segment?.interfaces.find((entry) => entry.nodeId === nextRouterId);
  return segment && local && remote ? { local, remote } : null;
}
function nativePolicyRoutes(graph4, addressing3, routing3, routerId, source, ospfGraph) {
  if (source === "connected" || source === "static" || source === "ospf") return routeTableForBuilderRouter(ospfGraph, addressing3, toBaseRouting(routing3), routerId, ospfGraph).filter((entry) => entry.source === source);
  if (source === "bgp") {
    const state = builderBgpState(graph4, addressing3, routing3.bgp);
    return state.bestRoutes.filter((route) => route.routerId === routerId).map((route) => ({ id: `policy-bgp:${route.id}`, routerId, prefix: route.prefix, prefixLength: Number(route.prefix.split("/")[1]), source: "bgp", administrativeDistance: route.learnedVia === "ebgp" ? 20 : 200, metric: route.asPath.length * 1e3 + route.med, nextHop: route.nextHopAddress, outgoingInterface: "\u2014", linkId: "\u2014", active: true, stateNote: "NATIVE BGP BEST \xB7 REDISTRIBUTION SOURCE" }));
  }
  return builderIsisRouteEntriesForRouter(graph4, addressing3, routing3.policy.isis, routerId).map((entry) => ({ ...entry, source: "isis" }));
}
function matchingNativePolicyRoutes(graph4, addressing3, routing3, routerId, source, prefix2, ospfGraph) {
  return nativePolicyRoutes(graph4, addressing3, routing3, routerId, source, ospfGraph).filter((entry) => entry.active && builderPolicyPrefixContainsPrefix(prefix2, entry.prefix));
}
function summaryActive(graph4, addressing3, routing3, summary, ospfGraph) {
  return matchingNativePolicyRoutes(graph4, addressing3, routing3, summary.routerId, summary.source, summary.prefix, ospfGraph).some((entry) => entry.prefix !== summary.prefix);
}
function effectiveBgpConfig(graph4, addressing3, routing3, ospfGraph) {
  const bgp2 = cloneBuilderBgpConfig(routing3.bgp);
  for (const rule of routing3.policy.redistributions.filter((entry) => entry.enabled && entry.target === "bgp")) for (const route of matchingNativePolicyRoutes(graph4, addressing3, routing3, rule.routerId, rule.source, rule.prefix, ospfGraph)) {
    const id2 = `trackf-redist-bgp:${rule.id}:${route.prefix}`.replaceAll("/", "_");
    if (!bgp2.origins.some((entry) => entry.id === id2)) bgp2.origins.push({ id: id2, routerId: rule.routerId, prefix: route.prefix, med: rule.metric, communities: [`65000:${rule.routeTag}`], description: `REDISTRIBUTED ${rule.source.toUpperCase()} \xB7 RULE ${rule.id}` });
    if (!bgp2.enabledRouterIds.includes(rule.routerId)) bgp2.enabledRouterIds.push(rule.routerId);
  }
  for (const summary of routing3.policy.summaries.filter((entry) => entry.advertiseInto === "bgp" && summaryActive(graph4, addressing3, routing3, entry, ospfGraph))) {
    const id2 = `trackf-summary-bgp:${summary.id}`;
    if (!bgp2.origins.some((entry) => entry.id === id2)) bgp2.origins.push({ id: id2, routerId: summary.routerId, prefix: summary.prefix, med: summary.metric, communities: ["65000:999"], description: `SUMMARY ${summary.id}` });
    if (!bgp2.enabledRouterIds.includes(summary.routerId)) bgp2.enabledRouterIds.push(summary.routerId);
  }
  return bgp2;
}
function annotateBgpPolicyProvenance(routing3, entries) {
  return entries.map((entry) => {
    if (entry.source !== "bgp") return entry;
    const rule = routing3.policy.redistributions.find((candidate) => candidate.enabled && candidate.target === "bgp" && entry.bgpCommunities?.includes(`65000:${candidate.routeTag}`) && builderPolicyPrefixContainsPrefix(candidate.prefix, entry.prefix));
    if (rule) return { ...entry, redistributedFrom: rule.source, redistributionRuleId: rule.id, routeTag: rule.routeTag, stateNote: `${entry.stateNote} \xB7 REDISTRIBUTED ${rule.source.toUpperCase()} \xB7 RULE ${rule.id} \xB7 TAG ${rule.routeTag}` };
    const summary = routing3.policy.summaries.find((candidate) => candidate.advertiseInto === "bgp" && candidate.prefix === entry.prefix && entry.bgpCommunities?.includes("65000:999"));
    return summary ? { ...entry, redistributedFrom: "summary", summaryId: summary.id, stateNote: `${entry.stateNote} \xB7 SUMMARY ${summary.id}` } : entry;
  });
}
function summaryDiscardEntries(graph4, addressing3, routing3, routerId, ospfGraph) {
  return routing3.policy.summaries.filter((entry) => entry.routerId === routerId && entry.discard && summaryActive(graph4, addressing3, routing3, entry, ospfGraph)).map((entry) => ({ id: `summary-discard:${entry.id}`, routerId, prefix: entry.prefix, prefixLength: Number(entry.prefix.split("/")[1]), source: "summary", administrativeDistance: 254, metric: entry.metric, nextHop: null, outgoingInterface: "Null0", linkId: "discard", active: true, stateNote: `INTENTIONAL SUMMARY DISCARD \xB7 SOURCE ${entry.source.toUpperCase()} \xB7 ${entry.description || entry.id}`, summaryDiscard: true, summarySource: entry.source, summaryId: entry.id }));
}
function generalOspfExternalEntries(graph4, addressing3, routing3, routerId) {
  if (!routing3.ospf.enabledRouterIds.includes(routerId)) return [];
  const entries = [];
  for (const rule of routing3.policy.redistributions.filter((entry) => entry.enabled && entry.target === "ospf")) {
    const areas = builderOspfAreasForRouter(graph4, routing3.ospf, rule.routerId).filter((area) => builderOspfAreaType(routing3.ospf, area) !== "stub").sort();
    const areaId = areas[0];
    if (!areaId) continue;
    for (const sourceRoute of matchingNativePolicyRoutes(graph4, addressing3, routing3, rule.routerId, rule.source, rule.prefix, graph4)) {
      if (rule.routerId === routerId) continue;
      const paths = builderOspfPathCandidates(graph4, routing3.ospf, routerId, rule.routerId, areaId);
      for (const path of paths) {
        if (!path.reachable) continue;
        for (const firstHop of path.firstHops) {
          const hop = firstHopEntry(graph4, addressing3, routerId, firstHop.nextRouterId, firstHop.linkId);
          if (!hop) continue;
          const nssa = builderOspfAreaType(routing3.ospf, areaId) === "nssa" && path.routeType === "intra-area";
          entries.push({ id: `ospf-redist-general:${routerId}:${rule.id}:${sourceRoute.prefix}:${firstHop.linkId}`.replaceAll("/", "_"), routerId, prefix: sourceRoute.prefix, prefixLength: sourceRoute.prefixLength, source: "ospf", administrativeDistance: 110, metric: path.totalCost + rule.metric, nextHop: hop.remote.address, outgoingInterface: hop.local.name, linkId: firstHop.linkId, active: true, stateNote: `${nssa ? "OSPF O N1 \xB7 TYPE-7 NSSA" : "OSPF O E1 \xB7 TYPE-5 EXTERNAL"} \xB7 REDISTRIBUTED ${rule.source.toUpperCase()} \xB7 TAG ${rule.routeTag}`, ospfRouteType: nssa ? "nssa-external" : "external", ospfAreaId: areaId, ospfAbrRouterId: path.destinationAbrRouterId, ospfSummaryId: null, ospfExternalLsaType: nssa ? 7 : 5, redistributedFrom: rule.source, redistributionRuleId: rule.id, routeTag: rule.routeTag });
        }
      }
    }
  }
  for (const summary of routing3.policy.summaries.filter((entry) => entry.advertiseInto === "ospf" && summaryActive(graph4, addressing3, routing3, entry, graph4))) {
    if (summary.routerId === routerId) continue;
    const areaId = builderOspfAreasForRouter(graph4, routing3.ospf, summary.routerId).filter((area) => builderOspfAreaType(routing3.ospf, area) !== "stub").sort()[0];
    if (!areaId) continue;
    for (const path of builderOspfPathCandidates(graph4, routing3.ospf, routerId, summary.routerId, areaId)) {
      for (const firstHop of path.firstHops) {
        const hop = firstHopEntry(graph4, addressing3, routerId, firstHop.nextRouterId, firstHop.linkId);
        if (!hop) continue;
        entries.push({ id: `ospf-summary:${routerId}:${summary.id}:${firstHop.linkId}`, routerId, prefix: summary.prefix, prefixLength: Number(summary.prefix.split("/")[1]), source: "ospf", administrativeDistance: 110, metric: path.totalCost + summary.metric, nextHop: hop.remote.address, outgoingInterface: hop.local.name, linkId: firstHop.linkId, active: true, stateNote: `OSPF SUMMARY \xB7 ORIGIN ${summary.routerId.toUpperCase()} \xB7 DISCARD AT ORIGIN`, ospfRouteType: "external", ospfAreaId: areaId, ospfExternalLsaType: 5, redistributedFrom: "summary", summaryId: summary.id });
      }
    }
  }
  return bestOspfEntries(entries);
}
function isisInjectedRoutes(graph4, addressing3, routing3, ospfGraph) {
  const result = [];
  for (const rule of routing3.policy.redistributions.filter((entry) => entry.enabled && entry.target === "isis")) for (const route of matchingNativePolicyRoutes(graph4, addressing3, routing3, rule.routerId, rule.source, rule.prefix, ospfGraph)) result.push({ id: `isis-inject:${rule.id}:${route.prefix}`, originRouterId: rule.routerId, prefix: route.prefix, metric: rule.metric, source: rule.source, routeTag: rule.routeTag, redistributionRuleId: rule.id, summaryId: null });
  for (const summary of routing3.policy.summaries.filter((entry) => entry.advertiseInto === "isis" && summaryActive(graph4, addressing3, routing3, entry, ospfGraph))) result.push({ id: `isis-summary:${summary.id}`, originRouterId: summary.routerId, prefix: summary.prefix, metric: summary.metric, source: "summary", routeTag: 999, redistributionRuleId: null, summaryId: summary.id });
  return result;
}
function ospfExternalEntries(graph4, addressing3, routing3, routerId) {
  if (!routing3.ospf.enabledRouterIds.includes(routerId)) return [];
  const viewerAreas = builderOspfAreasForRouter(graph4, routing3.ospf, routerId);
  const viewerHasNormalArea = viewerAreas.some((areaId) => builderOspfAreaType(routing3.ospf, areaId) === "normal");
  const entries = [];
  for (const rule of routing3.ospf.redistributions ?? []) {
    if (rule.routerId === routerId) continue;
    const staticRoute = routing3.staticRoutes.find((route) => route.id === rule.staticRouteId && route.routerId === rule.routerId);
    if (!staticRoute) continue;
    const originStatic = routeTableForBuilderRouter(graph4, addressing3, toBaseRouting(routing3), rule.routerId).find((entry) => entry.id === staticRoute.id);
    if (!originStatic?.active) continue;
    const originType = builderOspfAreaType(routing3.ospf, rule.areaId);
    const insideOriginNssa = originType === "nssa" && viewerAreas.includes(rule.areaId);
    if (originType === "nssa" ? !insideOriginNssa && !viewerHasNormalArea : !viewerHasNormalArea) continue;
    const paths = builderOspfPathCandidates(graph4, routing3.ospf, routerId, rule.routerId, rule.areaId);
    for (const path of paths) {
      if (!path.reachable || path.firstHops.length === 0) continue;
      for (const firstHop of path.firstHops) {
        const hop = firstHopEntry(graph4, addressing3, routerId, firstHop.nextRouterId, firstHop.linkId);
        if (!hop) continue;
        const nssa = originType === "nssa" && path.routeType === "intra-area";
        entries.push({
          id: `ospf-external:${routerId}:${staticRoute.prefix}:${rule.id}:${firstHop.nextRouterId}:${firstHop.linkId}`.replace(/\//g, ":"),
          routerId,
          prefix: staticRoute.prefix,
          prefixLength: Number(staticRoute.prefix.split("/")[1]),
          source: "ospf",
          administrativeDistance: 110,
          metric: path.totalCost + rule.metric,
          nextHop: hop.remote.address,
          outgoingInterface: hop.local.name,
          linkId: firstHop.linkId,
          active: true,
          stateNote: `${nssa ? "OSPF O N1 \xB7 TYPE-7 NSSA" : originType === "nssa" ? "OSPF O E1 \xB7 TYPE-5 TRANSLATED FROM NSSA" : "OSPF O E1 \xB7 TYPE-5 EXTERNAL"} \xB7 REDISTRIBUTED STATIC \xB7 ASBR ${nodeById2(graph4, rule.routerId)?.label ?? rule.routerId} \xB7 METRIC ${rule.metric}`,
          ospfRouteType: nssa ? "nssa-external" : "external",
          ospfAreaId: rule.areaId,
          ospfAbrRouterId: path.destinationAbrRouterId,
          ospfSummaryId: null,
          ospfExternalSource: "static",
          ospfExternalLsaType: nssa ? 7 : 5,
          ospfRedistributionId: rule.id
        });
      }
    }
  }
  return bestOspfEntries(entries);
}
function ospfStubDefaultEntries(graph4, addressing3, routing3, routerId) {
  if (!routing3.ospf.enabledRouterIds.includes(routerId)) return [];
  const state = builderOspfState2(graph4, addressing3, routing3);
  if (state.abrRouterIds.includes(routerId)) return [];
  const entries = [];
  for (const areaId of builderOspfAreasForRouter(graph4, routing3.ospf, routerId)) {
    const areaType = builderOspfAreaType(routing3.ospf, areaId);
    if (areaType === "normal") continue;
    const abrIds = builderOspfAbrRouterIds(graph4, routing3.ospf).filter((abrId) => builderOspfAreasForRouter(graph4, routing3.ospf, abrId).includes(areaId));
    for (const abrId of abrIds) {
      const path = builderOspfAreaPath(graph4, routing3.ospf, routerId, abrId, areaId);
      if (!path.reachable || path.firstHops.length === 0) continue;
      for (const firstHop of path.firstHops) {
        const hop = firstHopEntry(graph4, addressing3, routerId, firstHop.nextRouterId, firstHop.linkId);
        if (!hop) continue;
        entries.push({
          id: `ospf-default:${routerId}:${areaId}:${abrId}:${firstHop.linkId}`,
          routerId,
          prefix: "0.0.0.0/0",
          prefixLength: 0,
          source: "ospf",
          administrativeDistance: 110,
          metric: path.totalCost + 1,
          nextHop: hop.remote.address,
          outgoingInterface: hop.local.name,
          linkId: firstHop.linkId,
          active: true,
          stateNote: `OSPF O IA \xB7 ${areaType === "stub" ? "STUB" : "NSSA"} DEFAULT \xB7 ABR ${nodeById2(graph4, abrId)?.label ?? abrId}`,
          ospfRouteType: "inter-area",
          ospfAreaId: areaId,
          ospfAbrRouterId: abrId,
          ospfSummaryId: null
        });
      }
    }
  }
  return bestOspfEntries(entries);
}
function ospfRank(entry) {
  if (entry.source !== "ospf") return 0;
  if (entry.ospfRouteType === "inter-area") return 1;
  if (entry.ospfRouteType === "external" || entry.ospfRouteType === "nssa-external") return 2;
  return 0;
}
function bestOspfEntries(entries) {
  const byPrefix = /* @__PURE__ */ new Map();
  for (const entry of entries) byPrefix.set(entry.prefix, [...byPrefix.get(entry.prefix) ?? [], entry]);
  const winners = [];
  for (const candidates of byPrefix.values()) {
    const bestRank = Math.min(...candidates.map(ospfRank));
    const ranked = candidates.filter((entry) => ospfRank(entry) === bestRank);
    const bestMetric = Math.min(...ranked.map((entry) => entry.metric));
    const byNextHop = /* @__PURE__ */ new Map();
    for (const entry of ranked.filter((candidate) => candidate.metric === bestMetric).sort((a, b) => a.id.localeCompare(b.id))) {
      const key2 = `${entry.nextHop ?? ""}\0${entry.linkId}`;
      if (!byNextHop.has(key2)) byNextHop.set(key2, entry);
    }
    const equal = [...byNextHop.values()].sort((a, b) => a.id.localeCompare(b.id));
    winners.push(...equal.map((entry) => ({ ...entry, stateNote: `${entry.stateNote}${equal.length > 1 ? ` \xB7 ECMP ${equal.length}-WAY` : ""}` })));
  }
  return winners;
}
function compareRoutePreference(left, right) {
  return right.prefixLength - left.prefixLength || left.administrativeDistance - right.administrativeDistance || ospfRank(left) - ospfRank(right) || left.metric - right.metric || left.id.localeCompare(right.id);
}
function routeTableForBuilderRouter2(graph4, addressing3, routing3, routerId, ospfTopologyGraph = graph4) {
  const validated = validateBuilderRoutingConfig2(graph4, addressing3, routing3);
  const effectiveOspf = builderOspfEffectiveGraph(ospfTopologyGraph, validated.policy, validated.ospf.enabledRouterIds);
  const bgp2 = effectiveBgpConfig(graph4, addressing3, validated, effectiveOspf);
  const baseRouting = { ...toBaseRouting(validated), bgp: bgp2 };
  const baseEntries = annotateBgpPolicyProvenance(validated, routeTableForBuilderRouter(graph4, addressing3, baseRouting, routerId, effectiveOspf));
  const isis = builderIsisRouteEntriesForRouter(graph4, addressing3, validated.policy.isis, routerId, isisInjectedRoutes(graph4, addressing3, validated, effectiveOspf)).map((entry) => ({ ...entry, source: "isis" }));
  return [...baseEntries, ...ospfExternalEntries(effectiveOspf, addressing3, validated, routerId), ...generalOspfExternalEntries(effectiveOspf, addressing3, validated, routerId), ...ospfStubDefaultEntries(effectiveOspf, addressing3, validated, routerId), ...isis, ...summaryDiscardEntries(graph4, addressing3, validated, routerId, effectiveOspf)].sort(compareRoutePreference);
}
var builderStableFlowHash2 = builderStableFlowHash;
function canonicalFlowKey(flowKey, destinationAddress) {
  if (flowKey == null) return null;
  if (typeof flowKey === "string") return flowKey;
  return `${String(flowKey.protocol ?? "ip").trim().toLowerCase() || "ip"}|${String(flowKey.sourceAddress ?? "").trim()}|${String(flowKey.destinationAddress ?? destinationAddress).trim()}|${flowKey.sourcePort == null ? "" : String(flowKey.sourcePort)}|${flowKey.destinationPort == null ? "" : String(flowKey.destinationPort)}|${flowKey.discriminator == null ? "" : String(flowKey.discriminator)}`;
}
function builderEcmpRoutesForDestination(entries, destinationAddress) {
  const matches = entries.filter((entry) => entry.active && prefixContains(entry.prefix, destinationAddress)).sort(compareRoutePreference);
  const best = matches[0];
  if (!best) return [];
  return matches.filter((entry) => entry.prefix === best.prefix && entry.prefixLength === best.prefixLength && entry.administrativeDistance === best.administrativeDistance && ospfRank(entry) === ospfRank(best) && entry.metric === best.metric).sort((a, b) => a.id.localeCompare(b.id));
}
function selectBuilderRouteWithDecision(entries, destinationAddress, flowKey = null, maxPaths = 16) {
  const candidates = builderEcmpRoutesForDestination(entries, destinationAddress).slice(0, Math.max(1, Math.min(16, Math.round(Number(maxPaths) || 16))));
  if (candidates.length === 0) return { route: null, candidates: [], flowKey: null, flowHash: null, selectedIndex: null };
  const canonical = canonicalFlowKey(flowKey, destinationAddress);
  if (candidates.length === 1 || canonical === null) return { route: candidates[0], candidates, flowKey: canonical, flowHash: null, selectedIndex: 0 };
  const flowHash = builderStableFlowHash2(canonical);
  const selectedIndex = flowHash % candidates.length;
  return { route: candidates[selectedIndex], candidates, flowKey: canonical, flowHash, selectedIndex };
}
function interfaceOwner(addressing3, address2) {
  const normalized = normalizeBuilderIpv4(address2);
  for (const segment of Object.values(addressing3.segments)) {
    const entry = segment.interfaces.find((candidate) => candidate.address === normalized);
    if (entry) return { nodeId: entry.nodeId, linkId: segment.linkId, interfaceName: entry.name };
  }
  return null;
}
function primaryInterfaceForNode2(addressing3, nodeId) {
  return interfacesForBuilderNode(addressing3, nodeId)[0] ?? null;
}
function forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, failureNodeId, failureReason) {
  return { reachable: false, sourceNodeId, destinationNodeId, destinationAddress, hops, failureNodeId, failureReason, explanation: `${failureNodeId.toUpperCase()} stopped forwarding: ${failureReason}.` };
}
function traceBuilderForwarding(graph4, addressing3, routing3, sourceNodeId, destinationNodeId, ospfTopologyGraph = graph4, flowKey = null) {
  const source = nodeById2(graph4, sourceNodeId);
  const destination = nodeById2(graph4, destinationNodeId);
  if (!source || !destination) return { reachable: false, sourceNodeId, destinationNodeId, destinationAddress: null, hops: [], failureNodeId: null, failureReason: "SOURCE OR DESTINATION DOES NOT EXIST", explanation: "Choose source and destination devices that still exist in the topology." };
  if (sourceNodeId === destinationNodeId) return { reachable: true, sourceNodeId, destinationNodeId, destinationAddress: primaryInterfaceForNode2(addressing3, destinationNodeId)?.address ?? null, hops: [], failureNodeId: null, failureReason: null, explanation: "Source and destination are the same device." };
  const destinationInterface = primaryInterfaceForNode2(addressing3, destinationNodeId);
  if (!destinationInterface) return forwardingFailure(sourceNodeId, destinationNodeId, null, [], destinationNodeId, "DESTINATION HAS NO IPV4 INTERFACE");
  const destinationAddress = destinationInterface.address;
  const hops = [];
  const visited = /* @__PURE__ */ new Set();
  let currentNodeId = sourceNodeId;
  for (let hopIndex = 0; hopIndex <= graph4.nodes.length + 1; hopIndex += 1) {
    if (currentNodeId === destinationNodeId) return { reachable: true, sourceNodeId, destinationNodeId, destinationAddress, hops, failureNodeId: null, failureReason: null, explanation: `${source.label} reaches ${destination.label} at ${destinationAddress} in ${hops.length} forwarding hop${hops.length === 1 ? "" : "s"}.` };
    if (visited.has(currentNodeId)) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "FORWARDING LOOP");
    visited.add(currentNodeId);
    const current = nodeById2(graph4, currentNodeId);
    if (!current) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "DEVICE DISAPPEARED");
    if (current.kind === "endpoint") {
      const interfaces = interfacesForBuilderNode(addressing3, currentNodeId);
      const direct = interfaces.find((entry) => prefixContains(entry.cidr, destinationAddress));
      if (direct) {
        const link3 = linkById3(graph4, direct.linkId);
        const owner2 = interfaceOwner(addressing3, destinationAddress);
        if (!link3 || link3.failed) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "DIRECT LINK DOWN");
        if (!owner2 || owner2.linkId !== direct.linkId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "DESTINATION NOT PRESENT ON DIRECT SEGMENT");
        hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: "endpoint-local", matchedPrefix: direct.cidr, nextHop: destinationAddress, outgoingInterface: direct.name, linkId: direct.linkId, nextNodeId: owner2.nodeId });
        currentNodeId = owner2.nodeId;
        continue;
      }
      const gateway = addressing3.defaultGateways[currentNodeId] ?? null;
      if (!gateway) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "NO DEFAULT GATEWAY");
      const owner = interfaceOwner(addressing3, gateway);
      const localAttachment = owner ? interfaces.find((entry) => entry.linkId === owner.linkId) : null;
      const link2 = owner ? linkById3(graph4, owner.linkId) : null;
      if (!owner || !localAttachment) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "DEFAULT GATEWAY IS NOT DIRECTLY CONNECTED");
      if (!link2 || link2.failed) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "DEFAULT GATEWAY LINK DOWN");
      hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: "default-gateway", matchedPrefix: "0.0.0.0/0", nextHop: gateway, outgoingInterface: localAttachment.name, linkId: owner.linkId, nextNodeId: owner.nodeId });
      currentNodeId = owner.nodeId;
      continue;
    }
    const packetKey = { sourceAddress: primaryInterfaceForNode2(addressing3, sourceNodeId)?.address ?? "0.0.0.0", destinationAddress, protocol: typeof flowKey === "object" && flowKey ? String(flowKey.protocol ?? "ip") : "ip", sourcePort: typeof flowKey === "object" && flowKey && flowKey.sourcePort != null ? flowKey.sourcePort : null, destinationPort: typeof flowKey === "object" && flowKey && flowKey.destinationPort != null ? flowKey.destinationPort : null };
    const ecmp = builderEcmpProfile(routing3.policy, currentNodeId);
    const discriminator = typeof flowKey === "object" && flowKey ? flowKey.discriminator ?? null : typeof flowKey === "string" ? flowKey : null;
    const hashedKey = builderCanonicalEcmpKey(ecmp.hashMode, packetKey, discriminator);
    const selection = selectBuilderRouteWithDecision(routeTableForBuilderRouter2(graph4, addressing3, routing3, currentNodeId, ospfTopologyGraph), destinationAddress, hashedKey, ecmp.maxPaths);
    const selected = selection.route;
    if (!selected) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "NO MATCHING ROUTE");
    let nextNodeId = null;
    let nextHop = selected.nextHop;
    let actualLinkId = selected.linkId;
    let actualOutgoingInterface = selected.outgoingInterface;
    const pbr = builderPbrDecision(routing3.policy, currentNodeId, packetKey);
    if (pbr.matched && pbr.rule) {
      const owner = interfaceOwner(addressing3, pbr.rule.nextHop);
      const local = owner ? addressing3.segments[owner.linkId]?.interfaces.find((entry) => entry.nodeId === currentNodeId) : null;
      if (!owner || !local) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "PBR NEXT HOP INVALID");
      nextNodeId = owner.nodeId;
      nextHop = pbr.rule.nextHop;
      actualLinkId = owner.linkId;
      actualOutgoingInterface = local.name;
    } else if (selected.source === "summary" && selected.summaryDiscard) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "INTENTIONAL SUMMARY BLACK HOLE");
    if (!pbr.matched && selected.source === "connected") {
      const owner = interfaceOwner(addressing3, destinationAddress);
      if (!owner || owner.linkId !== selected.linkId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "CONNECTED PREFIX HAS NO DESTINATION NEIGHBOR");
      nextNodeId = owner.nodeId;
      nextHop = destinationAddress;
    } else if (!pbr.matched) {
      const owner = selected.nextHop ? interfaceOwner(addressing3, selected.nextHop) : null;
      if (!owner || owner.linkId !== selected.linkId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, selected.source === "static" ? "STATIC NEXT HOP INVALID" : selected.source === "bgp" ? "BGP NEXT HOP INVALID" : selected.source === "isis" ? "IS-IS NEXT HOP INVALID" : "OSPF NEXT HOP INVALID");
      nextNodeId = owner.nodeId;
    }
    const link = linkById3(graph4, actualLinkId);
    if (!link || link.failed) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, pbr.matched ? "PBR NEXT-HOP LINK DOWN" : "OUTGOING LINK DOWN");
    hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: selected.source, matchedPrefix: selected.prefix, nextHop, outgoingInterface: actualOutgoingInterface, linkId: actualLinkId, nextNodeId, ecmpCandidateCount: selection.candidates.length, ecmpSelectedIndex: selection.selectedIndex, ecmpFlowHash: selection.flowHash, ecmpFlowKey: selection.flowKey, ecmpHashMode: ecmp.hashMode, fibRouteSource: selected.source, fibMatchedPrefix: selected.prefix, fibNextHop: selected.nextHop, pbrRuleId: pbr.rule?.id ?? null, pbrNextHop: pbr.rule?.nextHop ?? null });
    if (!nextNodeId) return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "NEXT HOP HAS NO DEVICE");
    currentNodeId = nextNodeId;
  }
  return forwardingFailure(sourceNodeId, destinationNodeId, destinationAddress, hops, currentNodeId, "HOP LIMIT EXCEEDED");
}
function installStaticRoutesForWeightedPath2(graph4, addressing3, routing3, sourceNodeId, destinationNodeId) {
  const result = installStaticRoutesForWeightedPath(graph4, addressing3, toBaseRouting(routing3), sourceNodeId, destinationNodeId);
  return { ...result, routing: reconcileBuilderRoutingConfig2(graph4, addressing3, { ...result.routing, ospf: { ...result.routing.ospf, areaTypes: routing3.ospf.areaTypes ?? {}, redistributions: routing3.ospf.redistributions ?? [] }, policy: cloneBuilderRoutingPolicyConfig(routing3.policy) }) };
}

// ../8f1a24ac8c73/hopscotch/src/builder/acl.ts
function ipv4ToInt7(value) {
  return normalizeBuilderIpv4(value).split(".").reduce((result, part) => (result << 8 | Number(part)) >>> 0, 0) >>> 0;
}
function intToIpv46(value) {
  const v = value >>> 0;
  return [24, 16, 8, 0].map((shift) => v >>> shift & 255).join(".");
}
function parsePrefix3(value) {
  const [addressText, prefixText, ...extra] = value.trim().split("/");
  if (!addressText || prefixText == null || extra.length > 0 || !/^\d{1,2}$/.test(prefixText)) throw new Error(`Invalid ACL prefix ${value}.`);
  const length = Number(prefixText);
  if (!Number.isInteger(length) || length < 0 || length > 32) throw new Error("ACL prefixes must be /0 through /32.");
  const address2 = ipv4ToInt7(addressText);
  const mask = length === 0 ? 0 : 4294967295 << 32 - length >>> 0;
  const network = (address2 & mask) >>> 0;
  const broadcast = (network | ~mask >>> 0) >>> 0;
  return { network, broadcast, cidr: `${intToIpv46(network)}/${length}` };
}
function contains2(prefix2, address2) {
  const p = parsePrefix3(prefix2);
  const value = ipv4ToInt7(address2);
  return value >= p.network && value <= p.broadcast;
}
function createDefaultBuilderAclConfig() {
  return { rules: [], defaultAction: "permit" };
}
function cloneBuilderAclConfig(config) {
  return { defaultAction: config.defaultAction, rules: config.rules.map((rule) => ({ ...rule })) };
}
function validateBuilderAclConfig(graph4, config) {
  if (!config || !Array.isArray(config.rules) || !["permit", "deny"].includes(config.defaultAction)) throw new Error("ACL config requires rules and a default action.");
  if (config.rules.length > 128) throw new Error("Builder ACL teaching model supports at most 128 rules.");
  const routerIds3 = new Set(graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id));
  const ids = /* @__PURE__ */ new Set();
  const rules = config.rules.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`ACL rule ${index + 1} is invalid.`);
    if (!/^[a-zA-Z0-9_-]+$/.test(raw.id) || ids.has(raw.id)) throw new Error(`ACL rule id ${raw.id} is invalid or duplicated.`);
    if (!routerIds3.has(raw.routerId)) throw new Error(`ACL rule ${raw.id} references a non-router.`);
    if (!Number.isInteger(raw.order) || raw.order < 1 || raw.order > 65535) throw new Error(`ACL rule ${raw.id} order must be 1\u201365535.`);
    if (!["permit", "deny"].includes(raw.action) || !["ip", "icmp", "tcp", "udp"].includes(raw.protocol)) throw new Error(`ACL rule ${raw.id} action/protocol is invalid.`);
    const sourcePrefix = parsePrefix3(raw.sourcePrefix).cidr;
    const destinationPrefix = parsePrefix3(raw.destinationPrefix).cidr;
    const destinationPort = raw.destinationPort == null ? null : Number(raw.destinationPort);
    if (destinationPort != null && (!Number.isInteger(destinationPort) || destinationPort < 1 || destinationPort > 65535)) throw new Error(`ACL rule ${raw.id} destination port is invalid.`);
    if (!["tcp", "udp"].includes(raw.protocol) && destinationPort != null) throw new Error(`ACL rule ${raw.id} can match a port only for TCP/UDP.`);
    ids.add(raw.id);
    return { id: raw.id, routerId: raw.routerId, order: raw.order, action: raw.action, protocol: raw.protocol, sourcePrefix, destinationPrefix, destinationPort, description: String(raw.description ?? "").slice(0, 80) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.order - b.order || a.id.localeCompare(b.id));
  return { defaultAction: config.defaultAction, rules };
}
function protocolMatches(rule, protocol) {
  return rule.protocol === "ip" || rule.protocol === protocol;
}
function portMatches(rule, destinationPort) {
  return rule.destinationPort == null || rule.destinationPort === destinationPort;
}
function evaluateBuilderAclAtRouter(config, routerId, sourceAddress, destinationAddress, protocol, destinationPort) {
  const normalizedSource = normalizeBuilderIpv4(sourceAddress);
  const normalizedDestination = normalizeBuilderIpv4(destinationAddress);
  const rules = config.rules.filter((rule) => rule.routerId === routerId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const match = rules.find((rule) => protocolMatches(rule, protocol) && portMatches(rule, destinationPort) && contains2(rule.sourcePrefix, normalizedSource) && contains2(rule.destinationPrefix, normalizedDestination));
  if (match) return { routerId, action: match.action, ruleId: match.id, ruleDescription: match.description || `${match.action.toUpperCase()} ${match.protocol.toUpperCase()} ${match.sourcePrefix} \u2192 ${match.destinationPrefix}` };
  return { routerId, action: config.defaultAction, ruleId: null, ruleDescription: `DEFAULT ${config.defaultAction.toUpperCase()}` };
}
function primaryAddress2(addressing3, nodeId) {
  return interfacesForBuilderNode(addressing3, nodeId)[0]?.address ?? null;
}
function traceBuilderPolicy(graph4, addressing3, routing3, acl2, sourceNodeId, destinationNodeId, protocol = "ip", destinationPort = null, flowKey = null, routingGraph = graph4) {
  const config = validateBuilderAclConfig(graph4, acl2);
  const forwarding = traceBuilderForwarding(graph4, addressing3, routing3, sourceNodeId, destinationNodeId, routingGraph, flowKey);
  const sourceAddress = primaryAddress2(addressing3, sourceNodeId);
  const destinationAddress = forwarding.destinationAddress ?? primaryAddress2(addressing3, destinationNodeId);
  if (!forwarding.reachable || !sourceAddress || !destinationAddress) return { forwarding, permitted: false, sourceAddress, destinationAddress, protocol, destinationPort, decisions: [], deniedAtRouterId: null, explanation: forwarding.failureReason ?? "Forwarding must succeed before ACL policy can be evaluated." };
  const routerIds3 = [...new Set(forwarding.hops.map((hop) => hop.nodeId).filter((id2) => graph4.nodes.find((node) => node.id === id2)?.kind === "router"))];
  const decisions = [];
  for (const routerId of routerIds3) {
    const decision = evaluateBuilderAclAtRouter(config, routerId, sourceAddress, destinationAddress, protocol, destinationPort);
    decisions.push(decision);
    if (decision.action === "deny") return { forwarding, permitted: false, sourceAddress, destinationAddress, protocol, destinationPort, decisions, deniedAtRouterId: routerId, explanation: `${graph4.nodes.find((node) => node.id === routerId)?.label ?? routerId} denied ${protocol.toUpperCase()} by ${decision.ruleId ?? "default policy"}: ${decision.ruleDescription}.` };
  }
  return { forwarding, permitted: true, sourceAddress, destinationAddress, protocol, destinationPort, decisions, deniedAtRouterId: null, explanation: decisions.length === 0 ? "No router ACL boundary was crossed." : `All ${decisions.length} routed ACL boundary${decisions.length === 1 ? "" : "ies"} permitted the flow.` };
}

// ../8f1a24ac8c73/hopscotch/src/builder/stp.ts
function createDefaultBuilderStpConfig() {
  return { enabled: true, bridgePriorities: {}, protocol: "stp" };
}
function cloneBuilderStpConfig(config) {
  return { enabled: config?.enabled !== false, bridgePriorities: { ...config?.bridgePriorities ?? {} }, protocol: config?.protocol };
}
function carriesVlan(link, vlanId) {
  if (link.failed) return false;
  return link.mode === "access" ? link.accessVlan === vlanId : link.mode === "trunk" && Boolean(link.allowedVlans?.includes(vlanId));
}
function deviceById(config, id2) {
  return config.devices.find((device2) => device2.id === id2);
}
function switchIds(config) {
  return config.devices.filter((device2) => device2.kind === "switch").map((device2) => device2.id).sort();
}
function priority(config, id2) {
  return config.stp?.bridgePriorities?.[id2] ?? 32768;
}
function bridgeKey(config, id2) {
  const device2 = deviceById(config, id2);
  return `${String(priority(config, id2)).padStart(5, "0")}:${device2?.mac ?? "ff:ff:ff:ff:ff:ff"}:${id2}`;
}
function validateBuilderStpConfig(config, input2) {
  const next = cloneBuilderStpConfig(input2);
  const switches = new Set(switchIds(config));
  const priorities = {};
  for (const [id2, value] of Object.entries(next.bridgePriorities)) {
    if (!switches.has(id2)) continue;
    if (!Number.isInteger(value) || value < 0 || value > 61440 || value % 4096 !== 0) throw new Error(`STP bridge priority for ${id2} must be 0\u201361440 in increments of 4096.`);
    priorities[id2] = value;
  }
  return { enabled: next.enabled, bridgePriorities: priorities, protocol: next.protocol };
}
function activeSwitchEdges(config, vlanId) {
  return config.links.filter((link) => {
    if (!carriesVlan(link, vlanId)) return false;
    return deviceById(config, link.a)?.kind === "switch" && deviceById(config, link.b)?.kind === "switch";
  }).map((link) => ({ linkId: link.id, a: link.a, b: link.b })).sort((x, y) => x.linkId.localeCompare(y.linkId));
}
function hasCycle(nodes, edges) {
  const parent = new Map(nodes.map((id2) => [id2, id2]));
  const find = (id2) => {
    const p = parent.get(id2) ?? id2;
    if (p === id2) return id2;
    const root = find(p);
    parent.set(id2, root);
    return root;
  };
  for (const edge of edges) {
    const a = find(edge.a), b = find(edge.b);
    if (a === b) return true;
    parent.set(a, b);
  }
  return false;
}
function builderStpState(config, vlanId) {
  const switches = switchIds(config);
  const edges = activeSwitchEdges(config, vlanId);
  const loopDetected = hasCycle(switches, edges);
  if (switches.length === 0) return { vlanId, enabled: config.stp?.enabled !== false, rootBridgeId: null, rootBridgeLabel: null, loopDetected: false, ports: [], blockedLinkIds: [], forwardingLinkIds: [], explanation: "No switches participate in this VLAN." };
  const root = [...switches].sort((a, b) => bridgeKey(config, a).localeCompare(bridgeKey(config, b)))[0];
  const enabled = config.stp?.enabled !== false;
  if (!enabled) {
    const ports2 = config.links.map((link) => {
      if (link.failed) return { linkId: link.id, a: link.a, b: link.b, state: "DOWN", blockedAt: null, reason: "Physical link is down." };
      const aSwitch = deviceById(config, link.a)?.kind === "switch", bSwitch = deviceById(config, link.b)?.kind === "switch";
      if (!aSwitch || !bSwitch || !carriesVlan(link, vlanId)) return { linkId: link.id, a: link.a, b: link.b, state: "NOT-STP", blockedAt: null, reason: "Not an active switch-to-switch segment for this VLAN." };
      return { linkId: link.id, a: link.a, b: link.b, state: "FORWARDING", blockedAt: null, reason: "STP disabled; redundant switch links all forward." };
    });
    return { vlanId, enabled: false, rootBridgeId: root, rootBridgeLabel: deviceById(config, root)?.label ?? root, loopDetected, ports: ports2, blockedLinkIds: [], forwardingLinkIds: ports2.filter((p) => p.state === "FORWARDING").map((p) => p.linkId), explanation: loopDetected ? "STP is disabled while this VLAN contains a Layer-2 cycle. Broadcast/unknown-unicast traffic can circulate and is treated as unsafe." : "STP is disabled; the active switch graph has no cycle." };
  }
  const best = /* @__PURE__ */ new Map();
  best.set(root, { id: root, cost: 0, path: [root], parentLink: null });
  const settled = /* @__PURE__ */ new Set();
  const adjacency2 = new Map(switches.map((id2) => [id2, []]));
  for (const edge of edges) {
    adjacency2.get(edge.a)?.push({ id: edge.b, linkId: edge.linkId });
    adjacency2.get(edge.b)?.push({ id: edge.a, linkId: edge.linkId });
  }
  for (const values of adjacency2.values()) values.sort((a, b) => bridgeKey(config, a.id).localeCompare(bridgeKey(config, b.id)) || a.linkId.localeCompare(b.linkId));
  while (true) {
    let current;
    for (const candidate of best.values()) if (!settled.has(candidate.id) && (!current || candidate.cost < current.cost || candidate.cost === current.cost && candidate.path.map((id2) => bridgeKey(config, id2)).join("|").localeCompare(current.path.map((id2) => bridgeKey(config, id2)).join("|")) < 0)) current = candidate;
    if (!current) break;
    settled.add(current.id);
    for (const edge of adjacency2.get(current.id) ?? []) {
      if (settled.has(edge.id)) continue;
      const next = { id: edge.id, cost: current.cost + 1, path: [...current.path, edge.id], parentLink: edge.linkId };
      const prior = best.get(edge.id);
      if (!prior || next.cost < prior.cost || next.cost === prior.cost && next.path.map((id2) => bridgeKey(config, id2)).join("|").localeCompare(prior.path.map((id2) => bridgeKey(config, id2)).join("|")) < 0) best.set(edge.id, next);
    }
  }
  const parentLinks = new Set([...best.values()].flatMap((candidate) => candidate.parentLink ? [candidate.parentLink] : []));
  const ports = config.links.map((link) => {
    if (link.failed) return { linkId: link.id, a: link.a, b: link.b, state: "DOWN", blockedAt: null, reason: "Physical link is down." };
    const aSwitch = deviceById(config, link.a)?.kind === "switch", bSwitch = deviceById(config, link.b)?.kind === "switch";
    if (!aSwitch || !bSwitch || !carriesVlan(link, vlanId)) return { linkId: link.id, a: link.a, b: link.b, state: "NOT-STP", blockedAt: null, reason: "Access/edge segment or VLAN not carried." };
    if (parentLinks.has(link.id)) return { linkId: link.id, a: link.a, b: link.b, state: "FORWARDING", blockedAt: null, reason: "Root/designated tree edge." };
    const aBest = best.get(link.a), bBest = best.get(link.b);
    if (!aBest || !bBest) return { linkId: link.id, a: link.a, b: link.b, state: "BLOCKING", blockedAt: aBest ? link.b : link.a, reason: "Segment is outside the root component." };
    const aRank = `${String(aBest.cost).padStart(6, "0")}:${bridgeKey(config, link.a)}`;
    const bRank = `${String(bBest.cost).padStart(6, "0")}:${bridgeKey(config, link.b)}`;
    const blockedAt = aRank <= bRank ? link.b : link.a;
    return { linkId: link.id, a: link.a, b: link.b, state: "BLOCKING", blockedAt, reason: `Redundant segment blocked at ${deviceById(config, blockedAt)?.label ?? blockedAt}; lower root-path/bridge ID remains designated.` };
  });
  const blockedLinkIds = ports.filter((port) => port.state === "BLOCKING").map((port) => port.linkId);
  return { vlanId, enabled: true, rootBridgeId: root, rootBridgeLabel: deviceById(config, root)?.label ?? root, loopDetected, ports, blockedLinkIds, forwardingLinkIds: ports.filter((p) => p.state === "FORWARDING").map((p) => p.linkId), explanation: blockedLinkIds.length > 0 ? `${deviceById(config, root)?.label ?? root} is root; ${blockedLinkIds.length} redundant segment${blockedLinkIds.length === 1 ? "" : "s"} blocked for VLAN ${vlanId}.` : `${deviceById(config, root)?.label ?? root} is root; this VLAN needs no blocked switch segment.` };
}

// ../8f1a24ac8c73/hopscotch/src/builder/ethernet.ts
var IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
var MAC_RE = /^(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/;
function cloneBuilderEthernetConfig(config) {
  return structuredClone(config);
}
function createEmptyBuilderEthernetConfig() {
  return { vlans: [], devices: [], links: [], layout: {}, stp: createDefaultBuilderStpConfig() };
}
function createDefaultBuilderEthernetConfig() {
  return {
    vlans: [
      { id: 10, name: "USERS", cidr: "10.10.0.0/24" },
      { id: 20, name: "SERVERS", cidr: "10.20.0.0/24" }
    ],
    devices: [
      { id: "lan-a", label: "PC-A", kind: "endpoint", mac: "02:48:4f:10:00:0a", interfaces: [{ vlanId: 10, address: "10.10.0.10", gateway: "10.10.0.1" }] },
      { id: "lan-b", label: "PC-B", kind: "endpoint", mac: "02:48:4f:10:00:0b", interfaces: [{ vlanId: 10, address: "10.10.0.11", gateway: "10.10.0.1" }] },
      { id: "lan-c", label: "PC-C", kind: "endpoint", mac: "02:48:4f:20:00:0c", interfaces: [{ vlanId: 20, address: "10.20.0.10", gateway: "10.20.0.1" }] },
      { id: "lan-sw1", label: "SW1", kind: "switch", mac: "02:48:4f:00:01:01", interfaces: [] },
      { id: "lan-sw2", label: "SW2", kind: "switch", mac: "02:48:4f:00:02:02", interfaces: [] },
      { id: "lan-sw3", label: "SW3", kind: "switch", mac: "02:48:4f:00:03:03", interfaces: [] },
      { id: "lan-r1", label: "RTR", kind: "router", mac: "02:48:4f:00:fe:01", interfaces: [
        { vlanId: 10, address: "10.10.0.1" },
        { vlanId: 20, address: "10.20.0.1" }
      ] }
    ],
    links: [
      { id: "lan-a-sw1", a: "lan-a", b: "lan-sw1", mode: "access", accessVlan: 10, failed: false },
      { id: "lan-sw1-sw2", a: "lan-sw1", b: "lan-sw2", mode: "trunk", allowedVlans: [10, 20], failed: false },
      { id: "lan-sw1-sw3", a: "lan-sw1", b: "lan-sw3", mode: "trunk", allowedVlans: [10], failed: false },
      { id: "lan-sw2-sw3", a: "lan-sw2", b: "lan-sw3", mode: "trunk", allowedVlans: [10], failed: false },
      { id: "lan-b-sw2", a: "lan-b", b: "lan-sw2", mode: "access", accessVlan: 10, failed: false },
      { id: "lan-c-sw2", a: "lan-c", b: "lan-sw2", mode: "access", accessVlan: 20, failed: false },
      { id: "lan-sw1-r1", a: "lan-sw1", b: "lan-r1", mode: "trunk", allowedVlans: [10, 20], failed: false }
    ],
    layout: {
      "lan-a": { x: 8, y: 18 },
      "lan-sw1": { x: 35, y: 35 },
      "lan-sw2": { x: 66, y: 35 },
      "lan-sw3": { x: 58, y: 68 },
      "lan-b": { x: 92, y: 16 },
      "lan-c": { x: 92, y: 68 },
      "lan-r1": { x: 30, y: 82 }
    },
    stp: createDefaultBuilderStpConfig()
  };
}
function validIpv4(value) {
  if (!IPV4_RE.test(value)) return false;
  return value.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
}
function validCidr(value) {
  const [address2, prefix2] = value.split("/");
  return Boolean(address2 && validIpv4(address2) && /^\d{1,2}$/.test(prefix2 ?? "") && Number(prefix2) >= 8 && Number(prefix2) <= 30);
}
function validateBuilderEthernetConfig(input2) {
  if (!input2 || !Array.isArray(input2.vlans) || !Array.isArray(input2.devices) || !Array.isArray(input2.links) || !input2.layout || typeof input2.layout !== "object") {
    throw new Error("Ethernet fabric must contain VLAN, device, link, and layout collections.");
  }
  if (input2.devices.length === 0 && input2.links.length === 0 && input2.vlans.length === 0) return createEmptyBuilderEthernetConfig();
  if (input2.devices.length > 24 || input2.links.length > 48 || input2.vlans.length > 32) throw new Error("Ethernet teaching fabric exceeds its 24-device / 48-link / 32-VLAN ceiling.");
  const vlanIds = /* @__PURE__ */ new Set();
  for (const vlan of input2.vlans) {
    if (!Number.isInteger(vlan.id) || vlan.id < 1 || vlan.id > 4094 || vlanIds.has(vlan.id)) throw new Error(`VLAN ${vlan.id} must be unique and within 1\u20134094.`);
    if (!vlan.name || vlan.name.length > 32 || !validCidr(vlan.cidr)) throw new Error(`VLAN ${vlan.id} requires a short name and valid IPv4 CIDR.`);
    vlanIds.add(vlan.id);
  }
  const deviceIds = /* @__PURE__ */ new Set();
  for (const device2 of input2.devices) {
    if (!/^[a-zA-Z0-9_-]+$/.test(device2.id) || deviceIds.has(device2.id)) throw new Error(`Ethernet device id ${device2.id} is invalid or duplicated.`);
    if (!device2.label || device2.label.length > 32 || !["endpoint", "switch", "router", "l3-switch"].includes(device2.kind) || !MAC_RE.test(device2.mac)) throw new Error(`Ethernet device ${device2.id} metadata is invalid.`);
    if (device2.kind === "switch" && device2.interfaces.length !== 0) throw new Error(`Switch ${device2.id} cannot own routed IPv4 interfaces in this teaching slice.`);
    if (device2.kind === "endpoint" && device2.interfaces.length !== 1) throw new Error(`Endpoint ${device2.id} must have exactly one access-VLAN interface.`);
    const localVlans = /* @__PURE__ */ new Set();
    for (const iface of device2.interfaces) {
      if (!vlanIds.has(iface.vlanId) || localVlans.has(iface.vlanId) || !validIpv4(iface.address) || iface.gateway != null && !validIpv4(iface.gateway)) throw new Error(`Ethernet interface on ${device2.id} is invalid.`);
      localVlans.add(iface.vlanId);
    }
    deviceIds.add(device2.id);
  }
  const linkIds2 = /* @__PURE__ */ new Set();
  for (const link of input2.links) {
    if (!/^[a-zA-Z0-9_-]+$/.test(link.id) || linkIds2.has(link.id) || !deviceIds.has(link.a) || !deviceIds.has(link.b) || link.a === link.b) throw new Error(`Ethernet link ${link.id} is invalid.`);
    linkIds2.add(link.id);
    const a = input2.devices.find((device2) => device2.id === link.a);
    const b = input2.devices.find((device2) => device2.id === link.b);
    if (link.mode === "access") {
      if (!Number.isInteger(link.accessVlan) || !vlanIds.has(link.accessVlan)) throw new Error(`Access link ${link.id} needs an existing VLAN.`);
    } else if (link.mode === "trunk") {
      if (a.kind === "endpoint" || b.kind === "endpoint") throw new Error(`Endpoint links cannot be trunks (${link.id}).`);
      const allowed = [...new Set(link.allowedVlans ?? [])].sort((x, y) => x - y);
      if (allowed.length === 0 || allowed.some((id2) => !vlanIds.has(id2))) throw new Error(`Trunk ${link.id} must allow at least one existing VLAN.`);
    } else if (link.mode !== "routed") throw new Error(`Ethernet link ${link.id} mode is invalid.`);
  }
  for (const device2 of input2.devices) {
    const point = input2.layout[device2.id];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) throw new Error(`Ethernet layout is missing ${device2.id}.`);
  }
  const normalized = cloneBuilderEthernetConfig({ ...input2, stp: cloneBuilderStpConfig(input2.stp) });
  normalized.stp = validateBuilderStpConfig(normalized, input2.stp);
  return normalized;
}
function linkCarriesVlanRaw(link, vlanId) {
  if (link.failed || link.mode === "routed") return false;
  if (link.mode === "access") return link.accessVlan === vlanId;
  if (!link.allowedVlans?.includes(vlanId)) return false;
  return link.nativeVlanA === vlanId === (link.nativeVlanB === vlanId);
}
function linkCarriesVlan(config, link, vlanId) {
  if (!linkCarriesVlanRaw(link, vlanId)) return false;
  return !builderStpState(config, vlanId).blockedLinkIds.includes(link.id);
}
function deviceById2(config, id2) {
  return config.devices.find((device2) => device2.id === id2);
}
function interfaceFor(device2, vlanId) {
  return device2?.interfaces.find((iface) => iface.vlanId === vlanId);
}
function neighbors(config, id2, vlanId) {
  return config.links.filter((link) => linkCarriesVlan(config, link, vlanId) && (link.a === id2 || link.b === id2)).map((link) => ({ id: link.a === id2 ? link.b : link.a, linkId: link.id })).sort((a, b) => a.id.localeCompare(b.id));
}
function builderEthernetDeviceById(config, id2) {
  return deviceById2(config, id2);
}
function builderEthernetInterfaceFor(device2, vlanId) {
  return interfaceFor(device2, vlanId);
}
function builderEthernetPathForVlan(config, sourceId, destinationId, vlanId) {
  if (sourceId === destinationId) return { nodeIds: [sourceId], linkIds: [] };
  const queue = [{ id: sourceId, nodes: [sourceId], links: [] }];
  const seen = /* @__PURE__ */ new Set([sourceId]);
  while (queue.length) {
    const current = queue.shift();
    for (const next of neighbors(config, current.id, vlanId)) {
      if (seen.has(next.id)) continue;
      const nextDevice = deviceById2(config, next.id);
      if (!nextDevice) continue;
      const nodes = [...current.nodes, next.id];
      const links = [...current.links, next.linkId];
      if (next.id === destinationId) return { nodeIds: nodes, linkIds: links };
      if (nextDevice.kind !== "switch") continue;
      seen.add(next.id);
      queue.push({ id: next.id, nodes, links });
    }
  }
  return null;
}
function learn(config, path, vlanId, mac2, learnedFrom, fdb) {
  path.nodeIds.forEach((nodeId, index) => {
    const device2 = deviceById2(config, nodeId);
    if (device2?.kind !== "switch" || index === 0) return;
    const ingress = path.linkIds[index - 1];
    if (!ingress) return;
    fdb.set(`${nodeId}:${vlanId}:${mac2}`, { switchId: nodeId, vlanId, mac: mac2, linkId: ingress, learnedFrom });
  });
}
function fail(sourceId, destinationId, sourceVlan, destinationVlan, reason) {
  return { sourceId, destinationId, sourceVlan, destinationVlan, success: false, routed: false, routedAt: null, ttlBefore: 64, ttlAfter: 64, segments: [], fdb: [], failureReason: reason, summary: reason };
}
function runBuilderEthernetFlow(configInput, sourceId, destinationId) {
  const config = validateBuilderEthernetConfig(configInput);
  const source = deviceById2(config, sourceId);
  const destination = deviceById2(config, destinationId);
  if (!source || !destination || source.kind !== "endpoint" || destination.kind !== "endpoint" || sourceId === destinationId) return fail(sourceId, destinationId, null, null, "Choose two different Ethernet endpoints.");
  const sourceIf = source.interfaces[0];
  const destinationIf = destination.interfaces[0];
  const sourceVlan = sourceIf?.vlanId ?? null;
  const destinationVlan = destinationIf?.vlanId ?? null;
  if (!sourceIf || !destinationIf) return fail(sourceId, destinationId, sourceVlan, destinationVlan, "Endpoint VLAN interfaces are incomplete.");
  const fdb = /* @__PURE__ */ new Map();
  const sourceStp = builderStpState(config, sourceVlan);
  if (!sourceStp.enabled && sourceStp.loopDetected) return fail(sourceId, destinationId, sourceVlan, destinationVlan, `STP is disabled while VLAN ${sourceVlan} contains a Layer-2 cycle. Broadcast/unknown-unicast forwarding is unsafe.`);
  const destinationStp = builderStpState(config, destinationVlan);
  if (!destinationStp.enabled && destinationStp.loopDetected) return fail(sourceId, destinationId, sourceVlan, destinationVlan, `STP is disabled while VLAN ${destinationVlan} contains a Layer-2 cycle. Broadcast/unknown-unicast forwarding is unsafe.`);
  if (sourceVlan === destinationVlan) {
    const path = builderEthernetPathForVlan(config, sourceId, destinationId, sourceVlan);
    if (!path) return fail(sourceId, destinationId, sourceVlan, destinationVlan, `VLAN ${sourceVlan} has no active Layer-2 path between the endpoints.`);
    const reverse = { nodeIds: [...path.nodeIds].reverse(), linkIds: [...path.linkIds].reverse() };
    learn(config, path, sourceVlan, source.mac, sourceId, fdb);
    learn(config, reverse, sourceVlan, destination.mac, destinationId, fdb);
    return {
      sourceId,
      destinationId,
      sourceVlan,
      destinationVlan,
      success: true,
      routed: false,
      routedAt: null,
      ttlBefore: 64,
      ttlAfter: 64,
      segments: [{ phase: "same-vlan", vlanId: sourceVlan, nodeIds: path.nodeIds, linkIds: path.linkIds, disposition: "FLOOD THEN LEARN" }],
      fdb: [...fdb.values()].sort((a, b) => `${a.switchId}:${a.mac}`.localeCompare(`${b.switchId}:${b.mac}`)),
      failureReason: null,
      summary: `VLAN ${sourceVlan} stays Layer 2: first unknown unicast floods only inside that VLAN, then learned MAC state enables unicast return.`
    };
  }
  const router = config.devices.filter((device2) => device2.kind === "router" && interfaceFor(device2, sourceVlan) && interfaceFor(device2, destinationVlan)).sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!router) return fail(sourceId, destinationId, sourceVlan, destinationVlan, `VLAN ${sourceVlan} and VLAN ${destinationVlan} are isolated: no router has interfaces in both broadcast domains.`);
  const sourceRouterIf = interfaceFor(router, sourceVlan);
  const destinationRouterIf = interfaceFor(router, destinationVlan);
  if (sourceIf.gateway !== sourceRouterIf.address) return fail(sourceId, destinationId, sourceVlan, destinationVlan, `${source.label} gateway ${sourceIf.gateway ?? "NONE"} does not match ${router.label} VLAN ${sourceVlan} interface ${sourceRouterIf.address}.`);
  if (destinationIf.gateway !== destinationRouterIf.address) return fail(sourceId, destinationId, sourceVlan, destinationVlan, `${destination.label} gateway ${destinationIf.gateway ?? "NONE"} does not match ${router.label} VLAN ${destinationVlan} interface ${destinationRouterIf.address}.`);
  const toGateway = builderEthernetPathForVlan(config, sourceId, router.id, sourceVlan);
  if (!toGateway) return fail(sourceId, destinationId, sourceVlan, destinationVlan, `VLAN ${sourceVlan} cannot reach the router trunk/access interface.`);
  const fromRouter = builderEthernetPathForVlan(config, router.id, destinationId, destinationVlan);
  if (!fromRouter) return fail(sourceId, destinationId, sourceVlan, destinationVlan, `Router can route to VLAN ${destinationVlan}, but its tagged/access Layer-2 path to ${destination.label} is blocked.`);
  learn(config, toGateway, sourceVlan, source.mac, sourceId, fdb);
  learn(config, { nodeIds: [...toGateway.nodeIds].reverse(), linkIds: [...toGateway.linkIds].reverse() }, sourceVlan, router.mac, router.id, fdb);
  learn(config, fromRouter, destinationVlan, router.mac, router.id, fdb);
  learn(config, { nodeIds: [...fromRouter.nodeIds].reverse(), linkIds: [...fromRouter.linkIds].reverse() }, destinationVlan, destination.mac, destinationId, fdb);
  return {
    sourceId,
    destinationId,
    sourceVlan,
    destinationVlan,
    success: true,
    routed: true,
    routedAt: router.id,
    ttlBefore: 64,
    ttlAfter: 63,
    segments: [
      { phase: "to-gateway", vlanId: sourceVlan, nodeIds: toGateway.nodeIds, linkIds: toGateway.linkIds, disposition: "FLOOD THEN LEARN" },
      { phase: "from-router", vlanId: destinationVlan, nodeIds: fromRouter.nodeIds, linkIds: fromRouter.linkIds, disposition: "ROUTED UNICAST" }
    ],
    fdb: [...fdb.values()].sort((a, b) => `${a.switchId}:${a.vlanId}:${a.mac}`.localeCompare(`${b.switchId}:${b.vlanId}:${b.mac}`)),
    failureReason: null,
    summary: `${router.label} routes VLAN ${sourceVlan} \u2192 VLAN ${destinationVlan} using connected router-on-a-stick subinterfaces; IP TTL decreases once at the router.`
  };
}

// ../8f1a24ac8c73/hopscotch/src/builder/dhcp.ts
var IPV4_RE2 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
function validIpv42(value) {
  return IPV4_RE2.test(value) && value.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
}
function ipv4ToInt8(value) {
  if (!validIpv42(value)) throw new Error(`Invalid IPv4 address ${value}.`);
  return value.split(".").reduce((result, part) => (result << 8 | Number(part)) >>> 0, 0) >>> 0;
}
function intToIpv47(value) {
  const v = value >>> 0;
  return [24, 16, 8, 0].map((shift) => v >>> shift & 255).join(".");
}
function prefixLength(cidr) {
  const part = cidr.split("/")[1];
  const value = Number(part);
  if (!Number.isInteger(value) || value < 8 || value > 30) throw new Error(`Invalid DHCP VLAN CIDR ${cidr}.`);
  return value;
}
function maskForPrefix2(prefix2) {
  return prefix2 === 0 ? 0 : 4294967295 << 32 - prefix2 >>> 0;
}
function subnetMaskForCidr(cidr) {
  return intToIpv47(maskForPrefix2(prefixLength(cidr)));
}
function networkAndBroadcast(cidr) {
  const [address2] = cidr.split("/");
  const prefix2 = prefixLength(cidr);
  const mask = maskForPrefix2(prefix2);
  const network = (ipv4ToInt8(address2) & mask) >>> 0;
  return { network, broadcast: (network | ~mask >>> 0) >>> 0 };
}
function isUsable(address2, cidr) {
  const value = ipv4ToInt8(address2);
  const range2 = networkAndBroadcast(cidr);
  return value > range2.network && value < range2.broadcast;
}
function device(config, id2) {
  return builderEthernetDeviceById(config, id2);
}
function vlanOfClient(config, id2) {
  const endpoint = device(config, id2);
  return endpoint?.kind === "endpoint" ? endpoint.interfaces[0]?.vlanId ?? null : null;
}
function uniqueSorted(values) {
  return [...new Set(values)].sort();
}
function createEmptyBuilderDhcpConfig() {
  return { clientDeviceIds: [], pools: [], relays: [] };
}
function createDefaultBuilderDhcpConfig(ethernet2) {
  if (ethernet2.devices.length === 0) return createEmptyBuilderDhcpConfig();
  const server = ethernet2.devices.find((entry) => entry.id === "lan-r1" && entry.kind === "router") ?? ethernet2.devices.find((entry) => entry.kind === "router");
  if (!server) return createEmptyBuilderDhcpConfig();
  const pools = [];
  for (const iface of server.interfaces) {
    const vlan = ethernet2.vlans.find((candidate) => candidate.id === iface.vlanId);
    if (!vlan) continue;
    const range2 = networkAndBroadcast(vlan.cidr);
    const start = Math.min(range2.broadcast - 1, range2.network + 100);
    const end = Math.min(range2.broadcast - 1, range2.network + 199);
    if (start > end) continue;
    pools.push({ id: `dhcp-${server.id}-v${vlan.id}`, serverDeviceId: server.id, vlanId: vlan.id, startAddress: intToIpv47(start), endAddress: intToIpv47(end), gateway: iface.address, dnsServers: ["1.1.1.1", "8.8.8.8"], leaseSteps: 64 });
  }
  return { clientDeviceIds: [], pools, relays: [] };
}
function cloneBuilderDhcpConfig(config) {
  return { clientDeviceIds: [...config.clientDeviceIds], pools: config.pools.map((pool) => ({ ...pool, dnsServers: [...pool.dnsServers] })), relays: config.relays.map((relay) => ({ ...relay })) };
}
function validateBuilderDhcpConfig(ethernet2, input2) {
  if (!input2 || !Array.isArray(input2.clientDeviceIds) || !Array.isArray(input2.pools) || !Array.isArray(input2.relays)) throw new Error("DHCP config requires client, pool, and relay arrays.");
  if (input2.clientDeviceIds.length > 24 || input2.pools.length > 32 || input2.relays.length > 32) throw new Error("DHCP teaching model exceeds its bounded client/pool/relay ceiling.");
  const endpointIds = new Set(ethernet2.devices.filter((entry) => entry.kind === "endpoint").map((entry) => entry.id));
  const routerIds3 = new Set(ethernet2.devices.filter((entry) => entry.kind === "router").map((entry) => entry.id));
  const vlanIds = new Set(ethernet2.vlans.map((vlan) => vlan.id));
  const clientDeviceIds = uniqueSorted(input2.clientDeviceIds);
  if (clientDeviceIds.some((id2) => !endpointIds.has(id2))) throw new Error("DHCP clients must reference Ethernet endpoint devices.");
  const poolIds = /* @__PURE__ */ new Set();
  const pools = input2.pools.map((raw, index) => {
    if (!raw || typeof raw !== "object" || !/^[a-zA-Z0-9_-]+$/.test(raw.id) || poolIds.has(raw.id)) throw new Error(`DHCP pool ${index + 1} id is invalid or duplicated.`);
    const server = device(ethernet2, raw.serverDeviceId);
    if (!server || server.kind === "switch") throw new Error(`DHCP pool ${raw.id} server must be an endpoint or router device.`);
    const vlan = ethernet2.vlans.find((candidate) => candidate.id === raw.vlanId);
    if (!vlan || !vlanIds.has(raw.vlanId)) throw new Error(`DHCP pool ${raw.id} references an unknown VLAN.`);
    if (!validIpv42(raw.startAddress) || !validIpv42(raw.endAddress) || !isUsable(raw.startAddress, vlan.cidr) || !isUsable(raw.endAddress, vlan.cidr) || ipv4ToInt8(raw.startAddress) > ipv4ToInt8(raw.endAddress)) throw new Error(`DHCP pool ${raw.id} range must be ordered usable addresses inside VLAN ${raw.vlanId}.`);
    const gateway = raw.gateway == null || raw.gateway === "" ? null : raw.gateway;
    if (gateway && !isUsable(gateway, vlan.cidr)) throw new Error(`DHCP pool ${raw.id} gateway must be a usable VLAN ${raw.vlanId} address.`);
    const dnsServers = uniqueSorted(raw.dnsServers ?? []);
    if (dnsServers.some((address2) => !validIpv42(address2))) throw new Error(`DHCP pool ${raw.id} has an invalid DNS option.`);
    if (!Number.isInteger(raw.leaseSteps) || raw.leaseSteps < 4 || raw.leaseSteps > 1e5) throw new Error(`DHCP pool ${raw.id} leaseSteps must be 4\u2013100000.`);
    poolIds.add(raw.id);
    return { id: raw.id, serverDeviceId: raw.serverDeviceId, vlanId: raw.vlanId, startAddress: raw.startAddress, endAddress: raw.endAddress, gateway, dnsServers, leaseSteps: raw.leaseSteps };
  }).sort((a, b) => a.vlanId - b.vlanId || a.id.localeCompare(b.id));
  const relayIds = /* @__PURE__ */ new Set();
  const relays = input2.relays.map((raw, index) => {
    if (!raw || typeof raw !== "object" || !/^[a-zA-Z0-9_-]+$/.test(raw.id) || relayIds.has(raw.id)) throw new Error(`DHCP relay ${index + 1} id is invalid or duplicated.`);
    if (!routerIds3.has(raw.routerId)) throw new Error(`DHCP relay ${raw.id} must reference a router.`);
    if (!vlanIds.has(raw.clientVlanId) || !vlanIds.has(raw.serverVlanId)) throw new Error(`DHCP relay ${raw.id} references an unknown VLAN.`);
    const router = device(ethernet2, raw.routerId);
    if (!builderEthernetInterfaceFor(router, raw.clientVlanId) || !builderEthernetInterfaceFor(router, raw.serverVlanId)) throw new Error(`DHCP relay ${raw.id} router needs interfaces in client and server VLANs.`);
    const server = device(ethernet2, raw.serverDeviceId);
    if (!server || !builderEthernetInterfaceFor(server, raw.serverVlanId)) throw new Error(`DHCP relay ${raw.id} server must have an interface in server VLAN ${raw.serverVlanId}.`);
    relayIds.add(raw.id);
    return { ...raw };
  }).sort((a, b) => a.clientVlanId - b.clientVlanId || a.id.localeCompare(b.id));
  for (const pool of pools) {
    const server = device(ethernet2, pool.serverDeviceId);
    const local = Boolean(builderEthernetInterfaceFor(server, pool.vlanId));
    const relayed = relays.some((relay) => relay.clientVlanId === pool.vlanId && relay.serverDeviceId === pool.serverDeviceId);
    if (!local && !relayed) throw new Error(`DHCP pool ${pool.id} server is neither local to VLAN ${pool.vlanId} nor reachable through a configured relay.`);
  }
  return { clientDeviceIds, pools, relays };
}
function setBuilderDhcpClient(ethernet2, config, clientDeviceId, enabled) {
  const next = cloneBuilderDhcpConfig(config);
  next.clientDeviceIds = enabled ? uniqueSorted([...next.clientDeviceIds, clientDeviceId]) : next.clientDeviceIds.filter((id2) => id2 !== clientDeviceId);
  return validateBuilderDhcpConfig(ethernet2, next);
}
function pathForDhcp(ethernet2, clientId, pool, config) {
  const clientVlan = vlanOfClient(ethernet2, clientId);
  if (clientVlan == null) return null;
  const server = device(ethernet2, pool.serverDeviceId);
  if (!server) return null;
  if (builderEthernetInterfaceFor(server, clientVlan)) {
    const path = builderEthernetPathForVlan(ethernet2, clientId, server.id, clientVlan);
    if (!path) return null;
    return { relayed: false, requestNodes: path.nodeIds, requestLinks: path.linkIds, responseNodes: [...path.nodeIds].reverse(), responseLinks: [...path.linkIds].reverse() };
  }
  const relay = config.relays.find((entry) => entry.clientVlanId === clientVlan && entry.serverDeviceId === pool.serverDeviceId);
  if (!relay) return null;
  const clientLeg = builderEthernetPathForVlan(ethernet2, clientId, relay.routerId, clientVlan);
  const serverLeg = builderEthernetPathForVlan(ethernet2, relay.routerId, pool.serverDeviceId, relay.serverVlanId);
  if (!clientLeg || !serverLeg) return null;
  const nodes = [...clientLeg.nodeIds, ...serverLeg.nodeIds.slice(1)];
  const links = [...clientLeg.linkIds, ...serverLeg.linkIds];
  return { relayed: true, requestNodes: nodes, requestLinks: links, responseNodes: [...nodes].reverse(), responseLinks: [...links].reverse() };
}
function usedAddresses(ethernet2, config, leases, pool) {
  const dhcpClients = new Set(config.clientDeviceIds);
  const used = /* @__PURE__ */ new Set();
  for (const entry of ethernet2.devices) {
    for (const iface of entry.interfaces) {
      if (iface.vlanId !== pool.vlanId) continue;
      if (entry.kind === "endpoint" && dhcpClients.has(entry.id)) continue;
      used.add(ipv4ToInt8(iface.address));
    }
  }
  for (const lease of leases) if (lease.poolId === pool.id) used.add(ipv4ToInt8(lease.address));
  return used;
}
function allocateAddress(ethernet2, config, leases, pool) {
  const used = usedAddresses(ethernet2, config, leases, pool);
  for (let value = ipv4ToInt8(pool.startAddress); value <= ipv4ToInt8(pool.endAddress); value += 1) if (!used.has(value)) return intToIpv47(value);
  return null;
}
function optionsIssues(pool) {
  const issues = [];
  if (!pool.gateway) issues.push("DEFAULT GATEWAY MISSING");
  if (pool.dnsServers.length === 0) issues.push("DNS OPTION MISSING");
  return issues;
}
function leaseFor(client, pool, address2, vlanCidr, sequence) {
  const leaseSteps = pool.leaseSteps;
  return { id: `lease:${client.id}:${pool.id}:${address2}`, clientDeviceId: client.id, clientMac: client.mac, poolId: pool.id, serverDeviceId: pool.serverDeviceId, vlanId: pool.vlanId, address: address2, subnetMask: subnetMaskForCidr(vlanCidr), gateway: pool.gateway, dnsServers: [...pool.dnsServers], acquiredAtSequence: sequence, renewedAtSequence: sequence, renewAtSequence: sequence + Math.max(1, Math.floor(leaseSteps * 0.5)), rebindAtSequence: sequence + Math.max(2, Math.floor(leaseSteps * 0.875)), expiresAtSequence: sequence + leaseSteps };
}
function upsertLease(leases, lease) {
  return [...leases.filter((entry) => entry.clientDeviceId !== lease.clientDeviceId), lease].sort((a, b) => a.clientDeviceId.localeCompare(b.clientDeviceId));
}
function pruneBuilderDhcpLeases(leases, sequence) {
  return leases.filter((lease) => sequence <= lease.expiresAtSequence).map((lease) => ({ ...lease, dnsServers: [...lease.dnsServers] }));
}
function runBuilderDhcpAcquire(ethernetInput, configInput, leasesInput, clientDeviceId, sequence = 1) {
  const ethernet2 = ethernetInput;
  const config = validateBuilderDhcpConfig(ethernet2, configInput);
  const leases = pruneBuilderDhcpLeases(leasesInput, sequence);
  const client = device(ethernet2, clientDeviceId);
  const vlanId = vlanOfClient(ethernet2, clientDeviceId);
  const fail2 = (reason, events3 = []) => ({ id: `dhcp-${sequence}-${clientDeviceId}`, sequence, clientDeviceId, success: false, configurationReady: false, relayed: events3.some((event3) => event3.relayed), events: events3, lease: null, leases, optionsIssues: [], failureReason: reason, summary: reason });
  if (!client || client.kind !== "endpoint" || vlanId == null) return fail2("DHCP client must be an Ethernet endpoint with one access VLAN.");
  if (!config.clientDeviceIds.includes(clientDeviceId)) return fail2(`${client.label} is configured for STATIC IPv4, not DHCP.`);
  const existing = leases.find((lease2) => lease2.clientDeviceId === clientDeviceId);
  if (existing && sequence <= existing.expiresAtSequence) return { ...fail2(`${client.label} already has active lease ${existing.address}.`), lease: existing };
  const pools = config.pools.filter((pool) => pool.vlanId === vlanId).sort((a, b) => a.id.localeCompare(b.id));
  if (pools.length === 0) return fail2(`No DHCP pool serves VLAN ${vlanId}.`);
  let selected = null;
  let path = null;
  for (const pool of pools) {
    const candidate = pathForDhcp(ethernet2, clientDeviceId, pool, config);
    if (candidate) {
      selected = pool;
      path = candidate;
      break;
    }
  }
  if (!selected || !path) return fail2(`DHCP DISCOVER in VLAN ${vlanId} cannot reach any configured server or relay path.`);
  const address2 = allocateAddress(ethernet2, config, leases, selected);
  if (!address2) return fail2(`DHCP pool ${selected.id} is exhausted.`, [{ kind: "DISCOVER", sourceDeviceId: client.id, destinationDeviceId: selected.serverDeviceId, vlanId, relayed: path.relayed, nodeIds: path.requestNodes, linkIds: path.requestLinks, detail: path.relayed ? "Broadcast reached relay; relay forwarded DISCOVER to server." : "DISCOVER broadcast reached local server." }]);
  const vlan = ethernet2.vlans.find((entry) => entry.id === vlanId);
  const lease = leaseFor(client, selected, address2, vlan.cidr, sequence);
  const issues = optionsIssues(selected);
  const events2 = [
    { kind: "DISCOVER", sourceDeviceId: client.id, destinationDeviceId: selected.serverDeviceId, vlanId, relayed: path.relayed, nodeIds: path.requestNodes, linkIds: path.requestLinks, detail: path.relayed ? "Client broadcast reaches relay; relay forwards DISCOVER across the routed boundary." : "Client broadcasts DHCPDISCOVER inside its VLAN." },
    { kind: "OFFER", sourceDeviceId: selected.serverDeviceId, destinationDeviceId: client.id, vlanId, relayed: path.relayed, nodeIds: path.responseNodes, linkIds: path.responseLinks, detail: `Server offers ${address2} from ${selected.id}.` },
    { kind: "REQUEST", sourceDeviceId: client.id, destinationDeviceId: selected.serverDeviceId, vlanId, relayed: path.relayed, nodeIds: path.requestNodes, linkIds: path.requestLinks, detail: `Client requests offered address ${address2}.` },
    { kind: "ACK", sourceDeviceId: selected.serverDeviceId, destinationDeviceId: client.id, vlanId, relayed: path.relayed, nodeIds: path.responseNodes, linkIds: path.responseLinks, detail: `Server ACKs ${address2}/${prefixLength(vlan.cidr)} \xB7 GW ${selected.gateway ?? "MISSING"} \xB7 DNS ${selected.dnsServers.join(", ") || "MISSING"}.` }
  ];
  const next = upsertLease(leases, lease);
  const ready = issues.length === 0;
  return { id: `dhcp-${sequence}-${clientDeviceId}`, sequence, clientDeviceId, success: true, configurationReady: ready, relayed: path.relayed, events: events2, lease, leases: next, optionsIssues: issues, failureReason: null, summary: ready ? `${client.label} leased ${address2} through ${path.relayed ? "DHCP relay" : "local DHCP"}; host IPv4/gateway/DNS state is ready.` : `${client.label} leased ${address2}, but ACK options are incomplete: ${issues.join(" \xB7 ")}.` };
}
function applyBuilderDhcpState(ethernetInput, config, leasesInput, sequence) {
  const next = cloneBuilderEthernetConfig(ethernetInput);
  const leases = pruneBuilderDhcpLeases(leasesInput, sequence);
  const byClient = new Map(leases.map((lease) => [lease.clientDeviceId, lease]));
  next.devices = next.devices.map((entry) => {
    if (entry.kind !== "endpoint" || !config.clientDeviceIds.includes(entry.id)) return entry;
    const lease = byClient.get(entry.id);
    return { ...entry, interfaces: entry.interfaces.map((iface) => ({ ...iface, address: lease?.address ?? "0.0.0.0", gateway: lease?.gateway ?? null })) };
  });
  return next;
}

// ../8f1a24ac8c73/hopscotch/src/builder/ipv6.ts
var MAX_IPV6_SEGMENTS = 65535;
var DOC_PREFIX_BASE = parseIpv6AddressValue("2001:db8::");
var LINK_LOCAL_NETWORK = parseIpv6AddressValue("fe80::");
var LINK_LOCAL_MASK = maskForPrefix3(10);
function groupsFromIpv6(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized.includes("%")) throw new Error(`Invalid IPv6 address: ${value}.`);
  if (normalized.includes(".")) throw new Error("Embedded IPv4 notation is not supported in Builder IPv6 addresses.");
  if ((normalized.match(/::/g) ?? []).length > 1) throw new Error(`Invalid IPv6 address: ${value}.`);
  const hasCompression = normalized.includes("::");
  const [leftText, rightText = ""] = hasCompression ? normalized.split("::") : [normalized, ""];
  const parseSide = (text2) => text2 === "" ? [] : text2.split(":").map((part) => {
    if (!/^[0-9a-f]{1,4}$/.test(part)) throw new Error(`Invalid IPv6 address: ${value}.`);
    return Number.parseInt(part, 16);
  });
  const left = parseSide(leftText);
  const right = parseSide(rightText);
  if (!hasCompression) {
    if (left.length !== 8) throw new Error(`Invalid IPv6 address: ${value}.`);
    return left;
  }
  const missing = 8 - left.length - right.length;
  if (missing < 1) throw new Error(`Invalid IPv6 address: ${value}.`);
  return [...left, ...Array.from({ length: missing }, () => 0), ...right];
}
function parseIpv6AddressValue(value) {
  return groupsFromIpv6(value).reduce((result, group) => result << 16n | BigInt(group), 0n);
}
function groupsFromValue(value) {
  const result = [];
  for (let index = 0; index < 8; index += 1) {
    const shift = BigInt((7 - index) * 16);
    result.push(Number(value >> shift & 0xffffn));
  }
  return result;
}
function formatIpv6Value(value) {
  const groups = groupsFromValue(value);
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length; ) {
    if (groups[index] !== 0) {
      index += 1;
      continue;
    }
    let end = index;
    while (end < groups.length && groups[end] === 0) end += 1;
    const length = end - index;
    if (length >= 2 && length > bestLength) {
      bestStart = index;
      bestLength = length;
    }
    index = end;
  }
  const parts = groups.map((group) => group.toString(16));
  if (bestStart < 0) return parts.join(":");
  const before = parts.slice(0, bestStart).join(":");
  const after = parts.slice(bestStart + bestLength).join(":");
  return `${before}::${after}`;
}
function maskForPrefix3(prefixLength2) {
  if (!Number.isInteger(prefixLength2) || prefixLength2 < 0 || prefixLength2 > 128) throw new Error("IPv6 prefix length must be /0 through /128.");
  if (prefixLength2 === 0) return 0n;
  return (1n << BigInt(prefixLength2)) - 1n << BigInt(128 - prefixLength2);
}
function normalizeBuilderIpv6(value) {
  return formatIpv6Value(parseIpv6AddressValue(value));
}
function parseBuilderIpv6Cidr(value) {
  const normalized = String(value ?? "").trim();
  const [addressText, prefixText, ...extra] = normalized.split("/");
  if (!addressText || prefixText == null || extra.length > 0 || !/^\d{1,3}$/.test(prefixText)) throw new Error(`Invalid IPv6 CIDR: ${value}.`);
  const prefixLength2 = Number(prefixText);
  const mask = maskForPrefix3(prefixLength2);
  const addressValue = parseIpv6AddressValue(addressText);
  const network = addressValue & mask;
  const address2 = formatIpv6Value(addressValue);
  const networkAddress = formatIpv6Value(network);
  return { cidr: `${networkAddress}/${prefixLength2}`, address: address2, prefixLength: prefixLength2, networkAddress, addressValue, network };
}
function builderIpv6PrefixContains(prefix2, address2) {
  const parsed = parseBuilderIpv6Cidr(prefix2);
  return (parseIpv6AddressValue(address2) & maskForPrefix3(parsed.prefixLength)) === parsed.network;
}
function isLinkLocal(value) {
  return (parseIpv6AddressValue(value) & LINK_LOCAL_MASK) === (LINK_LOCAL_NETWORK & LINK_LOCAL_MASK);
}
function isMulticast(value) {
  return parseIpv6AddressValue(value) >> 120n === 0xffn;
}
function nodeById3(graph4, nodeId) {
  return graph4.nodes.find((node) => node.id === nodeId);
}
function linkById4(graph4, linkId) {
  return graph4.links.find((link) => link.id === linkId);
}
function ipv4InterfaceName(ipv42, linkId, nodeId) {
  return ipv42.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nodeId)?.name ?? "eth0";
}
function segmentNumberFromPrefix(prefix2) {
  const parsed = parseBuilderIpv6Cidr(prefix2);
  if (parsed.prefixLength !== 64) return null;
  if (!builderIpv6PrefixContains("2001:db8::/32", parsed.networkAddress)) return null;
  return Number(parsed.network >> 64n & 0xffffn);
}
function prefixForSegmentNumber(segmentNumber) {
  if (!Number.isInteger(segmentNumber) || segmentNumber < 1 || segmentNumber > MAX_IPV6_SEGMENTS) throw new Error("IPv6 deterministic segment id is out of range.");
  const network = DOC_PREFIX_BASE | BigInt(segmentNumber) << 64n;
  return `${formatIpv6Value(network)}/64`;
}
function addressInPrefix(prefix2, hostId) {
  const parsed = parseBuilderIpv6Cidr(prefix2);
  if (parsed.prefixLength !== 64) throw new Error("Builder routed IPv6 segments must use /64 prefixes.");
  return formatIpv6Value(parsed.network | hostId & 0xffffffffffffffffn);
}
function linkLocalFor(segmentNumber, slot) {
  return formatIpv6Value(LINK_LOCAL_NETWORK | BigInt(segmentNumber) << 16n | BigInt(slot));
}
function nextFreeSegmentNumber(addressing3) {
  const used = new Set(Object.values(addressing3.segments).flatMap((segment) => {
    try {
      const number = segmentNumberFromPrefix(segment.prefix);
      return number == null ? [] : [number];
    } catch {
      return [];
    }
  }));
  for (let index = 1; index <= MAX_IPV6_SEGMENTS; index += 1) if (!used.has(index)) return index;
  throw new Error("No free deterministic 2001:db8::/64 Builder segment remains.");
}
function makeSegment2(ipv42, addressing3, link) {
  const segmentNumber = nextFreeSegmentNumber(addressing3);
  const prefix2 = prefixForSegmentNumber(segmentNumber);
  return {
    linkId: link.id,
    prefix: prefix2,
    interfaces: [
      { nodeId: link.a, name: ipv4InterfaceName(ipv42, link.id, link.a), globalAddress: addressInPrefix(prefix2, 1n), linkLocalAddress: linkLocalFor(segmentNumber, 1), addressOrigin: "manual" },
      { nodeId: link.b, name: ipv4InterfaceName(ipv42, link.id, link.b), globalAddress: addressInPrefix(prefix2, 2n), linkLocalAddress: linkLocalFor(segmentNumber, 2), addressOrigin: "manual" }
    ]
  };
}
function cloneInterface(entry) {
  return { ...entry };
}
function cloneBuilderIpv6Addressing(value) {
  return {
    segments: Object.fromEntries(Object.entries(value.segments).map(([linkId, segment]) => [linkId, { ...segment, interfaces: [cloneInterface(segment.interfaces[0]), cloneInterface(segment.interfaces[1])] }])),
    defaultGateways: Object.fromEntries(Object.entries(value.defaultGateways).map(([nodeId, gateway]) => [nodeId, gateway ? { ...gateway } : null]))
  };
}
function cloneBuilderIpv6Config(value) {
  return { enabled: value.enabled, addressing: cloneBuilderIpv6Addressing(value.addressing), routing: { staticRoutes: value.routing.staticRoutes.map((route) => ({ ...route })) }, autoconfig: { raEnabledRouterIds: [...value.autoconfig.raEnabledRouterIds], slaacEndpointIds: [...value.autoconfig.slaacEndpointIds] }, ospfv3: { enabledRouterIds: [...value.ospfv3.enabledRouterIds] } };
}
function preferredDefaultGateway(graph4, addressing3, endpointId) {
  const links = graph4.links.filter((link) => link.a === endpointId || link.b === endpointId).sort((a, b) => a.id.localeCompare(b.id));
  for (const link of links) {
    const neighborId = link.a === endpointId ? link.b : link.a;
    if (nodeById3(graph4, neighborId)?.kind !== "router") continue;
    const neighbor = addressing3.segments[link.id]?.interfaces.find((entry) => entry.nodeId === neighborId);
    if (neighbor) return { address: neighbor.linkLocalAddress, linkId: link.id };
  }
  return null;
}
function validateBuilderIpv6Addressing(graph4, ipv42, value) {
  if (!value || typeof value !== "object" || !value.segments || !value.defaultGateways) throw new Error("Builder IPv6 addressing must contain segments and default gateways.");
  const linkIds2 = new Set(graph4.links.map((link) => link.id));
  if (Object.keys(value.segments).length !== graph4.links.length || Object.keys(value.segments).some((linkId) => !linkIds2.has(linkId))) throw new Error("Builder IPv6 addressing must define exactly one /64 segment per routed graph link.");
  const segments = {};
  const networks = /* @__PURE__ */ new Map();
  const globalOwners = /* @__PURE__ */ new Map();
  const linkLocalOwners = /* @__PURE__ */ new Map();
  for (const link of graph4.links) {
    const raw = value.segments[link.id];
    if (!raw || raw.linkId !== link.id || !Array.isArray(raw.interfaces) || raw.interfaces.length !== 2) throw new Error(`IPv6 segment ${link.id} must contain two interfaces matching the graph link.`);
    const parsedPrefix = parseBuilderIpv6Cidr(raw.prefix);
    if (parsedPrefix.prefixLength !== 64) throw new Error(`Builder routed IPv6 segment ${link.id} must use a /64 prefix.`);
    const priorNetwork = networks.get(parsedPrefix.network);
    if (priorNetwork) throw new Error(`IPv6 segments ${priorNetwork} and ${link.id} overlap at ${parsedPrefix.cidr}.`);
    networks.set(parsedPrefix.network, link.id);
    const expected = /* @__PURE__ */ new Set([link.a, link.b]);
    const seen = /* @__PURE__ */ new Set();
    const interfaces = raw.interfaces.map((entry) => {
      if (!expected.has(entry.nodeId) || seen.has(entry.nodeId)) throw new Error(`IPv6 segment ${link.id} interfaces must match ${link.a} and ${link.b} exactly.`);
      seen.add(entry.nodeId);
      const expectedName = ipv4InterfaceName(ipv42, link.id, entry.nodeId);
      if (entry.name !== expectedName) throw new Error(`${entry.nodeId} IPv6 interface on ${link.id} must share IPv4 interface name ${expectedName}.`);
      const globalAddress = normalizeBuilderIpv6(entry.globalAddress);
      const linkLocalAddress = normalizeBuilderIpv6(entry.linkLocalAddress);
      if (!builderIpv6PrefixContains(parsedPrefix.cidr, globalAddress)) throw new Error(`${entry.nodeId} global IPv6 address ${globalAddress} is not in ${parsedPrefix.cidr}.`);
      if (globalAddress === parsedPrefix.networkAddress || isLinkLocal(globalAddress) || isMulticast(globalAddress)) throw new Error(`${entry.nodeId} global IPv6 address ${globalAddress} is not a usable global/ULA interface address in this model.`);
      if (!isLinkLocal(linkLocalAddress)) throw new Error(`${entry.nodeId} link-local IPv6 address ${linkLocalAddress} must be within fe80::/10.`);
      const priorGlobal = globalOwners.get(globalAddress);
      if (priorGlobal) throw new Error(`IPv6 global address ${globalAddress} is already assigned to ${priorGlobal}.`);
      globalOwners.set(globalAddress, `${entry.nodeId} ${entry.name}`);
      const priorLinkLocal = linkLocalOwners.get(linkLocalAddress);
      if (priorLinkLocal) throw new Error(`Builder link-local address ${linkLocalAddress} is already assigned to ${priorLinkLocal}; this bounded model keeps them globally unique for unambiguous scoped next hops.`);
      linkLocalOwners.set(linkLocalAddress, `${entry.nodeId} ${entry.name}`);
      return { nodeId: entry.nodeId, name: expectedName, globalAddress, linkLocalAddress, addressOrigin: entry.addressOrigin === "slaac" ? "slaac" : entry.addressOrigin === "dhcpv6" ? "dhcpv6" : "manual" };
    });
    segments[link.id] = { linkId: link.id, prefix: parsedPrefix.cidr, interfaces };
  }
  const defaultGateways = {};
  const endpointIds = new Set(graph4.nodes.filter((node) => node.kind === "endpoint").map((node) => node.id));
  for (const nodeId of Object.keys(value.defaultGateways)) if (!endpointIds.has(nodeId)) throw new Error(`IPv6 default router is only valid for endpoint nodes; ${nodeId} is not an endpoint.`);
  for (const endpointId of endpointIds) {
    const raw = value.defaultGateways[endpointId] ?? null;
    if (!raw) {
      defaultGateways[endpointId] = null;
      continue;
    }
    const link = linkById4(graph4, raw.linkId);
    if (!link || link.a !== endpointId && link.b !== endpointId) throw new Error(`${endpointId} IPv6 default router must be on a directly connected link.`);
    const neighborId = link.a === endpointId ? link.b : link.a;
    if (nodeById3(graph4, neighborId)?.kind !== "router") throw new Error(`${endpointId} IPv6 default router must be a directly connected router.`);
    const neighbor = segments[link.id].interfaces.find((entry) => entry.nodeId === neighborId);
    const address2 = normalizeBuilderIpv6(raw.address);
    if (!neighbor || neighbor.linkLocalAddress !== address2) throw new Error(`${endpointId} IPv6 default router ${address2} must match the directly connected router link-local address on ${link.id}.`);
    defaultGateways[endpointId] = { address: address2, linkId: link.id };
  }
  return { segments, defaultGateways };
}
function validateStaticRoutes(graph4, addressing3, routes) {
  const ids = /* @__PURE__ */ new Set();
  const keys = /* @__PURE__ */ new Set();
  return routes.map((raw, index) => {
    const router = nodeById3(graph4, raw.routerId);
    if (!router || router.kind !== "router") throw new Error(`IPv6 static route ${index + 1} references a non-router ${raw.routerId}.`);
    const prefix2 = parseBuilderIpv6Cidr(raw.prefix).cidr;
    const link = linkById4(graph4, raw.linkId);
    if (!link || link.a !== raw.routerId && link.b !== raw.routerId) throw new Error(`IPv6 static route ${raw.id || index + 1} must use a link attached to ${raw.routerId}.`);
    const neighborId = link.a === raw.routerId ? link.b : link.a;
    const neighbor = addressing3.segments[link.id]?.interfaces.find((entry) => entry.nodeId === neighborId);
    const nextHop = normalizeBuilderIpv6(raw.nextHop);
    if (!neighbor || neighbor.linkLocalAddress !== nextHop && neighbor.globalAddress !== nextHop) throw new Error(`IPv6 static next hop ${nextHop} is not the neighbor address on ${link.id}.`);
    const metric = Number(raw.metric);
    if (!Number.isInteger(metric) || metric < 1 || metric > 999) throw new Error("IPv6 static route metric must be an integer from 1 to 999.");
    const id2 = String(raw.id ?? "").trim() || `ipv6-static:${raw.routerId}:${prefix2}:${link.id}`.replace(/\//g, ":");
    if (ids.has(id2)) throw new Error(`Duplicate IPv6 static route id ${id2}.`);
    ids.add(id2);
    const key2 = `${raw.routerId}\0${prefix2}`;
    if (keys.has(key2)) throw new Error(`${raw.routerId} already has an IPv6 static route for ${prefix2}.`);
    keys.add(key2);
    return { id: id2, routerId: raw.routerId, prefix: prefix2, nextHop, linkId: link.id, metric, description: String(raw.description ?? "").slice(0, 80) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.prefix.localeCompare(b.prefix) || a.id.localeCompare(b.id));
}
function validateIpv6Autoconfig(graph4, value) {
  const routers = new Set(graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id));
  const endpoints2 = new Set(graph4.nodes.filter((node) => node.kind === "endpoint").map((node) => node.id));
  const raEnabledRouterIds = [...new Set(value?.raEnabledRouterIds ?? [])].sort();
  const slaacEndpointIds = [...new Set(value?.slaacEndpointIds ?? [])].sort();
  if (raEnabledRouterIds.some((id2) => !routers.has(id2))) throw new Error("IPv6 RA enablement can reference routers only.");
  if (slaacEndpointIds.some((id2) => !endpoints2.has(id2))) throw new Error("IPv6 SLAAC state can reference endpoints only.");
  return { raEnabledRouterIds, slaacEndpointIds };
}
function validateOspfv3Config(graph4, value) {
  const routers = new Set(graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id));
  const enabledRouterIds = [...new Set(value?.enabledRouterIds ?? [])].sort();
  if (enabledRouterIds.some((id2) => !routers.has(id2))) throw new Error("OSPFv3 enablement can reference routers only.");
  return { enabledRouterIds };
}
function validateBuilderIpv6Config(graph4, ipv42, value) {
  if (!value || typeof value !== "object") throw new Error("Builder IPv6 config is invalid.");
  const addressing3 = validateBuilderIpv6Addressing(graph4, ipv42, value.addressing);
  return {
    enabled: value.enabled === true,
    addressing: addressing3,
    routing: { staticRoutes: validateStaticRoutes(graph4, addressing3, value.routing?.staticRoutes ?? []) },
    autoconfig: validateIpv6Autoconfig(graph4, value.autoconfig),
    ospfv3: validateOspfv3Config(graph4, value.ospfv3)
  };
}
function baseAddressing(graph4, ipv42) {
  let addressing3 = { segments: {}, defaultGateways: {} };
  for (const link of [...graph4.links].sort((a, b) => a.id.localeCompare(b.id))) {
    const segment = makeSegment2(ipv42, addressing3, link);
    addressing3 = { ...addressing3, segments: { ...addressing3.segments, [link.id]: segment } };
  }
  for (const endpoint of graph4.nodes.filter((node) => node.kind === "endpoint")) addressing3.defaultGateways[endpoint.id] = preferredDefaultGateway(graph4, addressing3, endpoint.id);
  return validateBuilderIpv6Addressing(graph4, ipv42, addressing3);
}
function createDefaultBuilderIpv6Config(graph4, ipv42, enabled = true) {
  return { enabled, addressing: baseAddressing(graph4, ipv42), routing: { staticRoutes: [] }, autoconfig: { raEnabledRouterIds: graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id).sort(), slaacEndpointIds: [] }, ospfv3: { enabledRouterIds: [] } };
}
function createEmptyBuilderIpv6Config(graph4, ipv42) {
  return createDefaultBuilderIpv6Config(graph4, ipv42, false);
}
function interfacesForBuilderNodeIpv6(addressing3, nodeId) {
  return Object.values(addressing3.segments).flatMap((segment) => segment.interfaces.filter((entry) => entry.nodeId === nodeId).map((entry) => ({ ...entry, linkId: segment.linkId, prefix: segment.prefix }))).sort((a, b) => a.name.localeCompare(b.name) || a.linkId.localeCompare(b.linkId));
}
function primaryBuilderIpv6Address(addressing3, nodeId) {
  return interfacesForBuilderNodeIpv6(addressing3, nodeId)[0]?.globalAddress ?? null;
}
function builderIpv6SolicitedNodeMulticast(address2) {
  const low24 = parseIpv6AddressValue(address2) & 0xffffffn;
  return formatIpv6Value(parseIpv6AddressValue("ff02::1:ff00:0") | low24);
}
function builderIpv6SolicitedNodeMulticastMac(address2) {
  const low24 = Number(parseIpv6AddressValue(address2) & 0xffffffn);
  return [51, 51, 255, low24 >>> 16 & 255, low24 >>> 8 & 255, low24 & 255].map((byte) => byte.toString(16).padStart(2, "0")).join(":");
}
function stableSlaacInterfaceId(endpointId, linkId) {
  const text2 = `${endpointId}:${linkId}:slaac`;
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text2.length; index += 1) {
    hash ^= BigInt(text2.charCodeAt(index));
    hash = hash * 0x100000001b3n & 0xffffffffffffffffn;
  }
  hash = hash & 0xfdffffffffffffffn | 0x0200000000000000n;
  return hash === 0n || hash === 1n || hash === 2n ? hash + 0x100n : hash;
}
function setBuilderIpv6RaRouterEnabled(graph4, ipv42, config, routerId, enabled) {
  if (nodeById3(graph4, routerId)?.kind !== "router") throw new Error(`${routerId} is not a router.`);
  const next = cloneBuilderIpv6Config(config);
  next.autoconfig.raEnabledRouterIds = enabled ? [.../* @__PURE__ */ new Set([...next.autoconfig.raEnabledRouterIds, routerId])].sort() : next.autoconfig.raEnabledRouterIds.filter((id2) => id2 !== routerId);
  return validateBuilderIpv6Config(graph4, ipv42, next);
}
function applyBuilderIpv6Slaac(graph4, ipv42, config, endpointId, routerId, linkId) {
  if (!config.enabled) throw new Error("Enable IPv6 before running SLAAC.");
  if (nodeById3(graph4, endpointId)?.kind !== "endpoint") throw new Error(`${endpointId} is not an endpoint.`);
  if (nodeById3(graph4, routerId)?.kind !== "router") throw new Error(`${routerId} is not a router.`);
  if (!config.autoconfig.raEnabledRouterIds.includes(routerId)) throw new Error(`${routerId} is not sending Router Advertisements.`);
  const link = linkById4(graph4, linkId);
  if (!link || link.failed || ![link.a, link.b].includes(endpointId) || ![link.a, link.b].includes(routerId)) throw new Error(`${endpointId} and ${routerId} must share a live link.`);
  const next = cloneBuilderIpv6Config(config);
  const segment = next.addressing.segments[linkId];
  const endpointInterface = segment?.interfaces.find((entry) => entry.nodeId === endpointId);
  const routerInterface = segment?.interfaces.find((entry) => entry.nodeId === routerId);
  if (!segment || !endpointInterface || !routerInterface) throw new Error("SLAAC requires endpoint and router IPv6 interfaces on the same /64.");
  endpointInterface.globalAddress = addressInPrefix(segment.prefix, stableSlaacInterfaceId(endpointId, linkId));
  endpointInterface.addressOrigin = "slaac";
  next.addressing.defaultGateways[endpointId] = { address: routerInterface.linkLocalAddress, linkId };
  next.autoconfig.slaacEndpointIds = [.../* @__PURE__ */ new Set([...next.autoconfig.slaacEndpointIds, endpointId])].sort();
  return validateBuilderIpv6Config(graph4, ipv42, next);
}
function setBuilderOspfv3Everywhere(graph4, ipv42, config, enabled) {
  const next = cloneBuilderIpv6Config(config);
  next.ospfv3.enabledRouterIds = enabled ? graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id).sort() : [];
  return validateBuilderIpv6Config(graph4, ipv42, next);
}
function builderOspfv3State(graph4, config) {
  const enabled = new Set(config.enabled ? config.ospfv3.enabledRouterIds : []);
  const adjacencies = graph4.links.flatMap((link) => {
    if (nodeById3(graph4, link.a)?.kind !== "router" || nodeById3(graph4, link.b)?.kind !== "router" || !enabled.has(link.a) || !enabled.has(link.b)) return [];
    return [{ id: `ospfv3:${link.id}`, aRouterId: link.a, bRouterId: link.b, linkId: link.id, state: link.failed ? "DOWN" : "FULL", cost: link.cost, reason: link.failed ? "LINK DOWN" : "LINK-LOCAL HELLO + DATABASE SYNC" }];
  }).sort((a, b) => a.linkId.localeCompare(b.linkId));
  const advertisements = [...enabled].flatMap((routerId) => interfacesForBuilderNodeIpv6(config.addressing, routerId).map((entry) => ({ routerId, prefix: entry.prefix, linkId: entry.linkId }))).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.prefix.localeCompare(b.prefix));
  return { enabledRouterIds: [...enabled].sort(), adjacencies, advertisements, fullAdjacencyCount: adjacencies.filter((entry) => entry.state === "FULL").length };
}
function ospfv3RoutesForRouter(graph4, config, routerId) {
  const state = builderOspfv3State(graph4, config);
  if (!state.enabledRouterIds.includes(routerId)) return [];
  const enabled = new Set(state.enabledRouterIds);
  const ospfGraph = {
    nodes: graph4.nodes.filter((node) => node.kind === "router" && enabled.has(node.id)),
    links: graph4.links.filter((link) => !link.failed && enabled.has(link.a) && enabled.has(link.b) && nodeById3(graph4, link.a)?.kind === "router" && nodeById3(graph4, link.b)?.kind === "router")
  };
  const localPrefixes = new Set(interfacesForBuilderNodeIpv6(config.addressing, routerId).map((entry) => entry.prefix));
  const best = /* @__PURE__ */ new Map();
  for (const advertisement of state.advertisements) {
    if (advertisement.routerId === routerId || localPrefixes.has(advertisement.prefix)) continue;
    const path = findShortestPath(ospfGraph, routerId, advertisement.routerId);
    if (!path.reachable || path.nodeIds.length < 2 || path.linkIds.length < 1 || path.totalCost == null) continue;
    const firstLinkId = path.linkIds[0];
    const nextRouterId = path.nodeIds[1];
    const nextHop = config.addressing.segments[firstLinkId]?.interfaces.find((entry) => entry.nodeId === nextRouterId)?.linkLocalAddress;
    const local = config.addressing.segments[firstLinkId]?.interfaces.find((entry) => entry.nodeId === routerId);
    if (!nextHop || !local) continue;
    const advertisedLink = linkById4(graph4, advertisement.linkId);
    const otherNodeId = advertisedLink ? advertisedLink.a === advertisement.routerId ? advertisedLink.b : advertisedLink.a : null;
    const stubCost = otherNodeId && nodeById3(graph4, otherNodeId)?.kind === "endpoint" ? advertisedLink?.cost ?? 0 : 0;
    const parsed = parseBuilderIpv6Cidr(advertisement.prefix);
    const candidate = { id: `ospfv3-route:${routerId}:${parsed.cidr}:${nextRouterId}`, routerId, prefix: parsed.cidr, prefixLength: parsed.prefixLength, source: "ospfv3", administrativeDistance: 110, metric: path.totalCost + stubCost, nextHop, outgoingInterface: local.name, linkId: firstLinkId, active: true, stateNote: `OSPFV3 AREA 0 \xB7 ADV ${advertisement.routerId.toUpperCase()}` };
    const prior = best.get(candidate.prefix);
    if (!prior || candidate.metric < prior.metric || candidate.metric === prior.metric && (candidate.nextHop ?? "") < (prior.nextHop ?? "")) best.set(candidate.prefix, candidate);
  }
  return [...best.values()];
}
function routeTableForBuilderIpv6Router(graph4, config, routerId, routeOverlay) {
  if (!config.enabled || nodeById3(graph4, routerId)?.kind !== "router") return [];
  const connected = interfacesForBuilderNodeIpv6(config.addressing, routerId).map((entry) => {
    const link = linkById4(graph4, entry.linkId);
    return { id: `ipv6-connected:${routerId}:${entry.linkId}`, routerId, prefix: entry.prefix, prefixLength: 64, source: "connected", administrativeDistance: 0, metric: 0, nextHop: null, outgoingInterface: entry.name, linkId: entry.linkId, active: !link.failed, stateNote: link.failed ? "LINK DOWN" : "DIRECT IPV6 /64" };
  });
  const statics = config.routing.staticRoutes.filter((route) => route.routerId === routerId).map((route) => {
    const parsed = parseBuilderIpv6Cidr(route.prefix);
    const link = linkById4(graph4, route.linkId);
    const active = Boolean(link && !link.failed);
    const local = config.addressing.segments[route.linkId]?.interfaces.find((entry) => entry.nodeId === routerId);
    return { id: route.id, routerId, prefix: parsed.cidr, prefixLength: parsed.prefixLength, source: "static", administrativeDistance: 1, metric: route.metric, nextHop: route.nextHop, outgoingInterface: local?.name ?? "\u2014", linkId: route.linkId, active, stateNote: active ? route.description || "STATIC IPV6" : "NEXT-HOP LINK DOWN" };
  });
  const ospfv3 = routeOverlay?.[routerId] ?? ospfv3RoutesForRouter(graph4, config, routerId);
  return [...connected, ...statics, ...ospfv3].sort((a, b) => b.prefixLength - a.prefixLength || a.administrativeDistance - b.administrativeDistance || a.metric - b.metric || a.id.localeCompare(b.id));
}
function selectBuilderIpv6Route(entries, destinationAddress) {
  return entries.filter((entry) => entry.active && builderIpv6PrefixContains(entry.prefix, destinationAddress)).sort((a, b) => b.prefixLength - a.prefixLength || a.administrativeDistance - b.administrativeDistance || a.metric - b.metric || a.id.localeCompare(b.id))[0] ?? null;
}
function failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, failureNodeId, failureReason) {
  return { reachable: false, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, failureNodeId, failureReason, explanation: `${failureNodeId ? nodeById3(graph4, failureNodeId)?.label ?? failureNodeId : "IPv6 forwarding"}: ${failureReason}` };
}
function ownerOfAddress(addressing3, address2) {
  const normalized = normalizeBuilderIpv6(address2);
  for (const segment of Object.values(addressing3.segments)) {
    const found = segment.interfaces.find((entry) => entry.globalAddress === normalized || entry.linkLocalAddress === normalized);
    if (found) return { nodeId: found.nodeId, linkId: segment.linkId, interface: found };
  }
  return null;
}
function traceBuilderIpv6Forwarding(graph4, config, sourceNodeId, destinationNodeId, routeOverlay) {
  const sourceAddress = primaryBuilderIpv6Address(config.addressing, sourceNodeId);
  const destinationAddress = primaryBuilderIpv6Address(config.addressing, destinationNodeId);
  if (!config.enabled) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, [], sourceNodeId, "IPv6 is disabled for this Builder scenario.");
  if (!nodeById3(graph4, sourceNodeId) || !nodeById3(graph4, destinationNodeId)) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, [], null, "Source or destination node does not exist.");
  if (!sourceAddress || !destinationAddress) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, [], sourceNodeId, "Source or destination has no global IPv6 interface address.");
  if (sourceNodeId === destinationNodeId) return { reachable: true, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops: [], failureNodeId: null, failureReason: null, explanation: "IPv6 source and destination are the same node." };
  const hops = [];
  const visited = /* @__PURE__ */ new Set();
  let currentNodeId = sourceNodeId;
  for (let step = 0; step < Math.max(8, graph4.nodes.length * 2); step += 1) {
    if (currentNodeId === destinationNodeId) return { reachable: true, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, failureNodeId: null, failureReason: null, explanation: `IPv6 FIB forwarding reached ${nodeById3(graph4, destinationNodeId)?.label ?? destinationNodeId}.` };
    if (visited.has(currentNodeId)) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, "IPv6 forwarding loop detected.");
    visited.add(currentNodeId);
    const current = nodeById3(graph4, currentNodeId);
    if (current.kind === "endpoint") {
      const onLink = interfacesForBuilderNodeIpv6(config.addressing, currentNodeId).find((entry) => builderIpv6PrefixContains(entry.prefix, destinationAddress));
      if (onLink) {
        const link3 = linkById4(graph4, onLink.linkId);
        const owner2 = ownerOfAddress(config.addressing, destinationAddress);
        if (!link3 || link3.failed) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `Direct IPv6 link ${onLink.linkId} is down.`);
        if (!owner2 || owner2.linkId !== onLink.linkId) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `Destination ${destinationAddress} is on-link by prefix but is not assigned to the neighboring interface.`);
        hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: "endpoint-local", matchedPrefix: onLink.prefix, nextHop: destinationAddress, outgoingInterface: onLink.name, linkId: onLink.linkId, nextNodeId: owner2.nodeId });
        currentNodeId = owner2.nodeId;
        continue;
      }
      const gateway = config.addressing.defaultGateways[currentNodeId] ?? null;
      if (!gateway) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, "Off-link IPv6 destination has no configured default router.");
      const link2 = linkById4(graph4, gateway.linkId);
      const owner = ownerOfAddress(config.addressing, gateway.address);
      const local = config.addressing.segments[gateway.linkId]?.interfaces.find((entry) => entry.nodeId === currentNodeId);
      if (!link2 || link2.failed) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `IPv6 default-router link ${gateway.linkId} is down.`);
      if (!owner || owner.linkId !== gateway.linkId || nodeById3(graph4, owner.nodeId)?.kind !== "router") return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `IPv6 default router ${gateway.address} is unavailable.`);
      hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: "default-router", matchedPrefix: "::/0", nextHop: gateway.address, outgoingInterface: local?.name ?? null, linkId: gateway.linkId, nextNodeId: owner.nodeId });
      currentNodeId = owner.nodeId;
      continue;
    }
    const selected = selectBuilderIpv6Route(routeTableForBuilderIpv6Router(graph4, config, currentNodeId, routeOverlay), destinationAddress);
    if (!selected) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `No active IPv6 route matches ${destinationAddress}.`);
    const link = linkById4(graph4, selected.linkId);
    if (!link || link.failed) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `Selected IPv6 route uses failed link ${selected.linkId}.`);
    let nextNodeId = null;
    let nextHop = selected.nextHop;
    if (selected.source === "static" || selected.source === "ospfv3") {
      const owner = selected.nextHop ? ownerOfAddress(config.addressing, selected.nextHop) : null;
      if (!owner || owner.linkId !== selected.linkId) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `Static IPv6 next hop ${selected.nextHop} cannot be resolved on ${selected.linkId}.`);
      nextNodeId = owner.nodeId;
    } else {
      const owner = ownerOfAddress(config.addressing, destinationAddress);
      if (!owner || owner.linkId !== selected.linkId) return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, `Connected IPv6 route ${selected.prefix} does not contain the assigned destination interface on ${selected.linkId}.`);
      nextNodeId = owner.nodeId;
      nextHop = destinationAddress;
    }
    hops.push({ nodeId: currentNodeId, nodeLabel: current.label, routeSource: selected.source, matchedPrefix: selected.prefix, nextHop, outgoingInterface: selected.outgoingInterface, linkId: selected.linkId, nextNodeId });
    currentNodeId = nextNodeId;
  }
  return failure(graph4, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, hops, currentNodeId, "IPv6 hop ceiling exceeded.");
}

// ../8f1a24ac8c73/hopscotch/src/builder/ipv6-routing-depth.ts
var DEFAULT_TIMERS = {
  helloMs: 1e4,
  deadMs: 4e4,
  lsaFloodMs: 200,
  spfMs: 50,
  ribInstallMs: 50,
  fibInstallMs: 50
};
function routerIds2(graph4) {
  return graph4.nodes.filter((node) => node.kind === "router").map((node) => node.id).sort();
}
function isRouter(graph4, nodeId) {
  return graph4.nodes.find((node) => node.id === nodeId)?.kind === "router";
}
function normalizeArea(value) {
  const area = Math.round(Number(value));
  if (!Number.isFinite(area) || area < 0 || area > 4294967295) throw new Error("OSPFv3 area must be 0 through 4294967295.");
  return area;
}
function createDefaultBuilderIpv6RoutingDepthState(graph4) {
  return {
    clockMs: 0,
    linkAreas: Object.fromEntries(graph4.links.map((link) => [link.id, 0])),
    failures: [],
    timers: { ...DEFAULT_TIMERS },
    policy: { defaultActions: Object.fromEntries(routerIds2(graph4).map((id2) => [id2, "permit"])), rules: [] }
  };
}
function cloneState(value) {
  return {
    clockMs: value.clockMs,
    linkAreas: { ...value.linkAreas },
    failures: value.failures.map((entry) => ({ ...entry })),
    timers: { ...value.timers },
    policy: { defaultActions: { ...value.policy.defaultActions }, rules: value.policy.rules.map((rule) => ({ ...rule })) }
  };
}
function reconcileBuilderIpv6RoutingDepthState(graph4, current) {
  const next = cloneState(current);
  const linkIds2 = new Set(graph4.links.map((link) => link.id));
  next.linkAreas = Object.fromEntries(graph4.links.map((link) => [link.id, normalizeArea(current.linkAreas[link.id] ?? 0)]));
  const failures = new Map(current.failures.filter((entry) => linkIds2.has(entry.linkId)).map((entry) => [entry.linkId, { ...entry }]));
  for (const link of graph4.links) {
    if (link.failed && !failures.has(link.id)) failures.set(link.id, { linkId: link.id, failedAtMs: current.clockMs });
    if (!link.failed) failures.delete(link.id);
  }
  next.failures = [...failures.values()].sort((a, b) => a.linkId.localeCompare(b.linkId));
  const routers = new Set(routerIds2(graph4));
  next.policy.defaultActions = Object.fromEntries([...routers].map((id2) => [id2, current.policy.defaultActions[id2] === "deny" ? "deny" : "permit"]));
  next.policy.rules = current.policy.rules.filter((rule) => routers.has(rule.routerId)).map((rule) => ({ ...rule, order: Math.max(1, Math.min(9999, Math.round(rule.order))) })).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.order - b.order || a.id.localeCompare(b.id));
  return next;
}
function failurePhase(state, linkId) {
  const failure2 = state.failures.find((entry) => entry.linkId === linkId);
  if (!failure2) return { phase: null, elapsedMs: null, fibReady: true };
  const elapsed = Math.max(0, state.clockMs - failure2.failedAtMs);
  const dead = state.timers.deadMs;
  const flood = dead + state.timers.lsaFloodMs;
  const spf = flood + state.timers.spfMs;
  const rib = spf + state.timers.ribInstallMs;
  const fib = rib + state.timers.fibInstallMs;
  if (elapsed < dead) return { phase: "PHYSICAL", elapsedMs: elapsed, fibReady: false };
  if (elapsed < flood) return { phase: "DEAD TIMER", elapsedMs: elapsed, fibReady: false };
  if (elapsed < spf) return { phase: "LSA FLOOD", elapsedMs: elapsed, fibReady: false };
  if (elapsed < rib) return { phase: "SPF", elapsedMs: elapsed, fibReady: false };
  if (elapsed < fib) return { phase: "RIB", elapsedMs: elapsed, fibReady: false };
  return { phase: "FIB", elapsedMs: elapsed, fibReady: true };
}
function routerAreasFor(graph4, config, state) {
  const enabled = new Set(config.enabled ? config.ospfv3.enabledRouterIds : []);
  const result = {};
  for (const routerId of enabled) {
    const areas = /* @__PURE__ */ new Set();
    for (const link of graph4.links.filter((entry) => entry.a === routerId || entry.b === routerId)) areas.add(state.linkAreas[link.id] ?? 0);
    result[routerId] = [...areas].sort((a, b) => a - b);
  }
  return result;
}
function builderOspfv3DepthSummary(graph4, config, current) {
  const state = reconcileBuilderIpv6RoutingDepthState(graph4, current);
  const enabled = new Set(config.enabled ? config.ospfv3.enabledRouterIds : []);
  const routerAreas = routerAreasFor(graph4, config, state);
  const abrRouterIds = Object.entries(routerAreas).filter(([, areas]) => areas.includes(0) && areas.some((area) => area !== 0)).map(([id2]) => id2).sort();
  const adjacencies = graph4.links.flatMap((link) => {
    if (!isRouter(graph4, link.a) || !isRouter(graph4, link.b) || !enabled.has(link.a) || !enabled.has(link.b)) return [];
    const area = state.linkAreas[link.id] ?? 0;
    const timing = failurePhase(state, link.id);
    const phase = !link.failed ? "FULL" : timing.elapsedMs != null && timing.elapsedMs < state.timers.deadMs ? "STALE FULL" : "DOWN";
    return [{ id: `ospfv3-depth:${link.id}`, linkId: link.id, area, aRouterId: link.a, bRouterId: link.b, phase, failurePhase: timing.phase, elapsedMs: timing.elapsedMs, detail: phase === "FULL" ? `Area ${area} link-local Hello adjacency is FULL.` : phase === "STALE FULL" ? `Physical link is down, but the ${state.timers.deadMs / 1e3}s dead timer has not expired.` : `Dead timer expired; Area ${area} adjacency is DOWN and LSAs can reconverge.` }];
  }).sort((a, b) => a.linkId.localeCompare(b.linkId));
  return { adjacencies, abrRouterIds, routerAreas, fullCount: adjacencies.filter((entry) => entry.phase === "FULL").length, staleCount: adjacencies.filter((entry) => entry.phase === "STALE FULL").length };
}
function ospfStatePath(graph4, config, state, routingGraph, sourceRouterId, destinationRouterId, destinationArea) {
  const enabled = new Set(config.ospfv3.enabledRouterIds);
  const areas = routerAreasFor(routingGraph, config, state);
  const adjacency2 = /* @__PURE__ */ new Map();
  const add = (from, edge) => adjacency2.set(from, [...adjacency2.get(from) ?? [], edge]);
  for (const routerId of enabled) for (const area of areas[routerId] ?? []) adjacency2.set(`${routerId}|${area}`, adjacency2.get(`${routerId}|${area}`) ?? []);
  for (const link of routingGraph.links) {
    if (link.failed || !enabled.has(link.a) || !enabled.has(link.b) || !isRouter(graph4, link.a) || !isRouter(graph4, link.b)) continue;
    const area = state.linkAreas[link.id] ?? 0;
    const a = `${link.a}|${area}`, b = `${link.b}|${area}`;
    if (!adjacency2.has(a) || !adjacency2.has(b)) continue;
    add(a, { to: b, cost: link.cost, linkId: link.id, nextRouterId: link.b, transition: false });
    add(b, { to: a, cost: link.cost, linkId: link.id, nextRouterId: link.a, transition: false });
  }
  for (const [routerId, routerAreaList] of Object.entries(areas)) {
    if (!routerAreaList.includes(0)) continue;
    for (const area of routerAreaList.filter((value) => value !== 0)) {
      const zero = `${routerId}|0`, other = `${routerId}|${area}`;
      if (!adjacency2.has(zero) || !adjacency2.has(other)) continue;
      add(other, { to: zero, cost: 0, linkId: null, nextRouterId: routerId, transition: true });
      add(zero, { to: other, cost: 0, linkId: null, nextRouterId: routerId, transition: true });
    }
  }
  const starts = (areas[sourceRouterId] ?? []).map((area) => `${sourceRouterId}|${area}`);
  const target2 = `${destinationRouterId}|${destinationArea}`;
  if (!adjacency2.has(target2) || starts.length === 0) return { reachable: false, cost: Infinity, firstLinkId: null, nextRouterId: null, interArea: false };
  const dist = /* @__PURE__ */ new Map();
  const prev = /* @__PURE__ */ new Map();
  const queue = /* @__PURE__ */ new Set();
  for (const key2 of adjacency2.keys()) {
    dist.set(key2, Infinity);
    queue.add(key2);
  }
  for (const start of starts) if (queue.has(start)) dist.set(start, 0);
  while (queue.size) {
    let current = null;
    for (const key2 of queue) if (current == null || (dist.get(key2) ?? Infinity) < (dist.get(current) ?? Infinity) || (dist.get(key2) ?? Infinity) === (dist.get(current) ?? Infinity) && key2 < current) current = key2;
    if (current == null || (dist.get(current) ?? Infinity) === Infinity) break;
    queue.delete(current);
    if (current === target2) break;
    for (const edge of adjacency2.get(current) ?? []) {
      if (!queue.has(edge.to)) continue;
      const candidate = (dist.get(current) ?? Infinity) + edge.cost;
      if (candidate < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, candidate);
        prev.set(edge.to, { from: current, edge });
      }
    }
  }
  if ((dist.get(target2) ?? Infinity) === Infinity) return { reachable: false, cost: Infinity, firstLinkId: null, nextRouterId: null, interArea: false };
  const edges = [];
  let cursor = target2;
  while (prev.has(cursor)) {
    const step = prev.get(cursor);
    edges.push(step.edge);
    cursor = step.from;
  }
  edges.reverse();
  const firstPhysical = edges.find((edge) => edge.linkId) ?? null;
  return { reachable: true, cost: dist.get(target2) ?? 0, firstLinkId: firstPhysical?.linkId ?? null, nextRouterId: firstPhysical?.nextRouterId ?? null, interArea: edges.some((edge) => edge.transition) };
}
function routingGraphAtTime(graph4, state) {
  return { nodes: graph4.nodes, links: graph4.links.map((link) => {
    if (!link.failed) return { ...link };
    const phase = failurePhase(state, link.id);
    return { ...link, failed: phase.fibReady };
  }) };
}
function builderOspfv3DepthRouteOverlay(graph4, config, current) {
  const state = reconcileBuilderIpv6RoutingDepthState(graph4, current);
  const routingGraph = routingGraphAtTime(graph4, state);
  const enabled = new Set(config.enabled ? config.ospfv3.enabledRouterIds : []);
  const overlay = {};
  const advertisements = [...enabled].flatMap((routerId) => interfacesForBuilderNodeIpv6(config.addressing, routerId).map((entry) => ({ routerId, prefix: entry.prefix, linkId: entry.linkId, area: state.linkAreas[entry.linkId] ?? 0 })));
  for (const routerId of enabled) {
    const localPrefixes = new Set(interfacesForBuilderNodeIpv6(config.addressing, routerId).map((entry) => entry.prefix));
    const best = /* @__PURE__ */ new Map();
    for (const advertisement of advertisements) {
      if (advertisement.routerId === routerId || localPrefixes.has(advertisement.prefix)) continue;
      const path = ospfStatePath(graph4, config, state, routingGraph, routerId, advertisement.routerId, advertisement.area);
      if (!path.reachable || !path.firstLinkId || !path.nextRouterId) continue;
      const nextHop = config.addressing.segments[path.firstLinkId]?.interfaces.find((entry) => entry.nodeId === path.nextRouterId)?.linkLocalAddress;
      const local = config.addressing.segments[path.firstLinkId]?.interfaces.find((entry) => entry.nodeId === routerId);
      if (!nextHop || !local) continue;
      const advertisedLink = graph4.links.find((link) => link.id === advertisement.linkId);
      const otherNodeId = advertisedLink ? advertisedLink.a === advertisement.routerId ? advertisedLink.b : advertisedLink.a : null;
      const stubCost = otherNodeId && !isRouter(graph4, otherNodeId) ? advertisedLink?.cost ?? 0 : 0;
      const parsed = parseBuilderIpv6Cidr(advertisement.prefix);
      const candidate = {
        id: `ospfv3-depth-route:${routerId}:${parsed.cidr}:${path.nextRouterId}`,
        routerId,
        prefix: parsed.cidr,
        prefixLength: parsed.prefixLength,
        source: "ospfv3",
        administrativeDistance: 110,
        metric: path.cost + stubCost,
        nextHop,
        outgoingInterface: local.name,
        linkId: path.firstLinkId,
        active: true,
        stateNote: path.interArea ? `OSPFV3 O6 IA \xB7 AREA ${advertisement.area} \xB7 ABR/BACKBONE` : `OSPFV3 O6 \xB7 AREA ${advertisement.area}`
      };
      const prior = best.get(candidate.prefix);
      if (!prior || candidate.metric < prior.metric || candidate.metric === prior.metric && (candidate.nextHop ?? "") < (prior.nextHop ?? "")) best.set(candidate.prefix, candidate);
    }
    overlay[routerId] = [...best.values()];
  }
  return overlay;
}

// ../8f1a24ac8c73/hopscotch/src/builder/device-workbench.ts
function refKey(ref) {
  return `${ref.plane}:${ref.id}`;
}
function sameRef(a, b) {
  return a.plane === b.plane && a.id === b.id;
}
function uniqueRefs(values) {
  const seen = /* @__PURE__ */ new Set();
  return values.filter((value) => {
    const key2 = refKey(value);
    if (seen.has(key2)) return false;
    seen.add(key2);
    return true;
  });
}
function row(id2, label, value, detail, status = "normal", why2 = []) {
  return { id: id2, label, value, detail, status, why: why2 };
}
function why(id2, source, label, detail) {
  return { id: id2, source, label, detail };
}
function section(id2, title, rows, emptySummary = "No applicable state for this device.") {
  return { id: id2, title, summary: rows.length === 0 ? emptySummary : `${rows.length} item${rows.length === 1 ? "" : "s"}`, rows };
}
function linkState(graph4, linkId) {
  return graph4.links.find((link) => link.id === linkId)?.failed ? "DOWN" : "UP";
}
function routedLabel(graph4, id2) {
  return graph4.nodes.find((node) => node.id === id2)?.label ?? id2.toUpperCase();
}
function ethernetLabel(ethernet2, id2) {
  return ethernet2.devices.find((device2) => device2.id === id2)?.label ?? id2.toUpperCase();
}
function builderWorkbenchDeviceOptions(graph4, ethernet2) {
  const routed = graph4.nodes.map((node) => ({ plane: "routed", id: node.id, label: node.label, kind: node.kind.toUpperCase(), group: "ROUTED GRAPH" }));
  const lan = ethernet2.devices.map((device2) => ({ plane: "ethernet", id: device2.id, label: device2.label, kind: device2.kind.toUpperCase(), group: "ETHERNET FABRIC" }));
  return [...routed, ...lan];
}
function createBuilderWorkbenchEventJournal() {
  return [{ id: "wb-event-0000", sequence: 0, atMs: 0, kind: "session", category: "session", summary: "BUILDER SESSION INITIALIZED", detail: "Canonical configuration loaded. Derived runtime state and the event journal are session-only.", deviceRefs: [], causeId: null, objectIds: [] }];
}
function classifyBuilderWorkbenchMessage(message) {
  const text2 = message.toUpperCase();
  if (/^(PING|TRACEROUTE|PROBE)\b/.test(text2)) return "probe";
  if (/^APPLICATION\b/.test(text2)) return "application";
  if (/DHCP/.test(text2)) return "dhcp";
  if (/NAT|PAT|TRANSLAT/.test(text2)) return "nat";
  if (/ARP|NEIGHBOR|ND |NUD|DAD|SLAAC|RA |ROUTER SOLICIT/.test(text2)) return "neighbor";
  if (/VLAN|LAN |STP|FDB|FRAME|TRUNK|ACCESS PORT|MAC /.test(text2)) return "switching";
  if (/ACL|FIREWALL|POLICY|DENY|PERMIT/.test(text2)) return "policy";
  if (/IPV6|OSPFV3|PMTU|PACKET TOO BIG/.test(text2)) return "ipv6";
  if (/PING|TRACEROUTE|PROBE|ICMP/.test(text2)) return "probe";
  if (/OSPF|BGP|STATIC ROUTE|ROUTE TABLE|FIB|RIB|NEXT HOP/.test(text2)) return "routing";
  if (/TOPOLOGY|LINK |NODE |ROUTER |ENDPOINT |DELETED|ADDED|RESET/.test(text2)) return "topology";
  return "config";
}
function causalCategory(category) {
  return ["routing", "policy", "neighbor", "switching", "nat", "dhcp", "probe", "ipv6", "application"].includes(category);
}
function appendBuilderWorkbenchMessageEvent(journal, message, deviceRefs = []) {
  const category = classifyBuilderWorkbenchMessage(message);
  const sequence = (journal.at(-1)?.sequence ?? -1) + 1;
  const previous = journal.at(-1) ?? null;
  const priorAtMs = previous?.atMs ?? (previous?.sequence ?? 0) * 1e3;
  const cause = causalCategory(category) ? [...journal].reverse().find((event4) => ["topology", "config", "routing", "policy", "nat", "dhcp", "ipv6"].includes(event4.category)) ?? null : null;
  const summary = (message.split("\xB7")[0]?.trim() || message.trim() || "BUILDER EVENT").slice(0, 96);
  const objectIds = [...new Set((message.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g) ?? []).filter((value) => value.length <= 64))].slice(0, 12);
  const event3 = { id: "wb-event-" + String(sequence).padStart(4, "0"), sequence, atMs: priorAtMs + 1e3, kind: "action", category, summary, detail: message, deviceRefs: uniqueRefs(deviceRefs), causeId: cause?.id ?? null, objectIds };
  return [...journal, event3].slice(-160);
}
function builderWorkbenchEventCausalChain(journal, eventId, maxDepth = 8) {
  const byId = new Map(journal.map((event3) => [event3.id, event3]));
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  let current = byId.get(eventId) ?? null;
  while (current && result.length < maxDepth && !seen.has(current.id)) {
    seen.add(current.id);
    result.push(current);
    current = current.causeId ? byId.get(current.causeId) ?? null : null;
  }
  return result.reverse();
}
function routeWhy(graph4, addressing3, routing3, entry) {
  const steps = [];
  if (entry.source === "connected") steps.push(why(`${entry.id}:config`, "CONFIG", "CONNECTED PREFIX", `${entry.prefix} exists because ${entry.outgoingInterface} is configured on ${entry.linkId}.`));
  if (entry.source === "static") steps.push(why(`${entry.id}:config`, "CONFIG", "STATIC ROUTE", `${entry.prefix} via ${entry.nextHop} metric ${entry.metric} is explicitly configured.`));
  if (entry.source === "ospf") steps.push(why(`${entry.id}:ospf`, "STATE", entry.ospfRouteType === "inter-area" ? "OSPF INTER-AREA" : "OSPF SPF", `${entry.stateNote}. OSPF AD ${entry.administrativeDistance}, metric ${entry.metric}.`));
  if (entry.source === "bgp") {
    const bgp2 = builderBgpState(graph4, addressing3, routing3.bgp);
    const learned = bgp2.bestRoutes.find((candidate) => candidate.routerId === entry.routerId && candidate.prefix === entry.prefix);
    steps.push(why(`${entry.id}:bgp`, "STATE", "BGP BEST PATH", learned?.bestReason ?? `${entry.stateNote}. BGP route projected into the IPv4 RIB.`));
  }
  steps.push(why(`${entry.id}:select`, "STATE", "ROUTE SELECTION", `Prefix length ${entry.prefixLength} \u2192 AD ${entry.administrativeDistance} \u2192 metric ${entry.metric}; ${entry.active ? "candidate is active" : "candidate is inactive"}.`));
  steps.push(why(`${entry.id}:link`, "TOPOLOGY", `LINK ${linkState(graph4, entry.linkId)}`, `${entry.outgoingInterface} exits through ${entry.linkId}.`));
  return steps;
}
function routedConfigSections(input2, deviceId) {
  const node = input2.graph.nodes.find((candidate) => candidate.id === deviceId);
  if (!node) return [];
  const ipv42 = interfacesForBuilderNode(input2.addressing, deviceId).map((entry) => {
    const profile = input2.linkProfiles?.[entry.linkId];
    return row(`cfg4:${entry.linkId}`, "IPV4 INTERFACE", `${entry.name} \xB7 ${entry.address}`, `${input2.addressing.segments[entry.linkId]?.cidr ?? "\u2014"} \xB7 ${entry.linkId} \xB7 ${linkState(input2.graph, entry.linkId)}${profile ? ` \xB7 MTU ${profile.mtuBytes} \xB7 ${profile.bandwidthMbps} Mb/s` : ""}`, linkState(input2.graph, entry.linkId) === "UP" ? "good" : "bad", [why(`cfg4:${entry.linkId}:why`, "CONFIG", "INTERFACE ADDRESS", `${entry.address} is canonical scenario configuration on ${entry.name}.`), ...profile ? [why(`cfg4:${entry.linkId}:profile`, "CONFIG", "LINK CHARACTERISTICS", `MTU ${profile.mtuBytes} \xB7 latency ${profile.latencyMs} ms \xB7 jitter ${profile.jitterMs} ms \xB7 loss ${profile.lossPercent}% \xB7 queue ${profile.queuePackets}.`)] : [], why(`cfg4:${entry.linkId}:topology`, "TOPOLOGY", `LINK ${linkState(input2.graph, entry.linkId)}`, `${entry.linkId} supplies physical adjacency.`)]);
  });
  const ipv63 = input2.ipv6.enabled ? interfacesForBuilderNodeIpv6(input2.ipv6.addressing, deviceId).map((entry) => {
    const profile = input2.linkProfiles?.[entry.linkId];
    return row(`cfg6:${entry.linkId}`, "IPV6 INTERFACE", `${entry.name} \xB7 ${entry.globalAddress}`, `${entry.prefix} \xB7 LL ${entry.linkLocalAddress} \xB7 ${entry.addressOrigin.toUpperCase()}${profile ? ` \xB7 MTU ${profile.mtuBytes}` : ""}`, linkState(input2.graph, entry.linkId) === "UP" ? "good" : "bad", [why(`cfg6:${entry.linkId}:why`, "CONFIG", `ADDRESS ORIGIN \xB7 ${entry.addressOrigin.toUpperCase()}`, `${entry.globalAddress} and ${entry.linkLocalAddress} belong to canonical IPv6 interface configuration.`), ...profile ? [why(`cfg6:${entry.linkId}:profile`, "CONFIG", "LINK MTU", `This routed link is configured for MTU ${profile.mtuBytes}; IPv6 transit routers do not fragment packets.`)] : []]);
  }) : [];
  const gateway4 = node.kind === "endpoint" ? input2.addressing.defaultGateways[deviceId] ?? null : null;
  const gateway6 = node.kind === "endpoint" ? input2.ipv6.addressing.defaultGateways[deviceId] ?? null : null;
  const gateways = [];
  if (node.kind === "endpoint") gateways.push(row("cfg:gw4", "IPV4 DEFAULT GATEWAY", gateway4 ?? "NONE", "Endpoint off-link IPv4 forwarding uses this directly connected router.", gateway4 ? "normal" : "warn", [why("cfg:gw4:why", "CONFIG", "HOST ROUTING", gateway4 ? "A canonical IPv4 default gateway is configured." : "No IPv4 default gateway is configured.")]), row("cfg:gw6", "IPV6 DEFAULT ROUTER", gateway6 ? `${gateway6.address}%${gateway6.linkId}` : "NONE", "IPv6 default-router scope is explicit and independent from IPv4.", gateway6 ? "normal" : "warn", [why("cfg:gw6:why", "CONFIG", "HOST ROUTING", gateway6 ? "A scoped link-local default router is configured." : "No IPv6 default router is configured.")]));
  const routingRows = [];
  if (node.kind === "router") {
    input2.routing.staticRoutes.filter((entry) => entry.routerId === deviceId).forEach((entry) => routingRows.push(row(`cfg:static:${entry.id}`, "IPV4 STATIC", entry.prefix, `via ${entry.nextHop} \xB7 metric ${entry.metric}`, "normal", [why(`cfg:static:${entry.id}:why`, "CONFIG", "STATIC ROUTE", `Explicit route ${entry.id} is persisted in scenario configuration.`)])));
    input2.ipv6.routing.staticRoutes.filter((entry) => entry.routerId === deviceId).forEach((entry) => routingRows.push(row(`cfg:static6:${entry.id}`, "IPV6 STATIC", entry.prefix, `via ${entry.nextHop}%${entry.linkId} \xB7 metric ${entry.metric}`, "normal", [why(`cfg:static6:${entry.id}:why`, "CONFIG", "STATIC IPV6 ROUTE", `Explicit IPv6 route ${entry.id} is persisted in scenario configuration.`)])));
    const ospfEnabled = input2.routing.ospf.enabledRouterIds.includes(deviceId);
    routingRows.push(row("cfg:ospf", "OSPF", ospfEnabled ? "ENABLED" : "DISABLED", `Areas are derived from configured routed-link area assignments.`, ospfEnabled ? "good" : "muted", [why("cfg:ospf:why", "CONFIG", "OSPF PROCESS", ospfEnabled ? "Router is configured to participate in OSPF." : "Router is not configured for OSPF.")]));
    const ospfv3Enabled = input2.ipv6.enabled && input2.ipv6.ospfv3.enabledRouterIds.includes(deviceId);
    routingRows.push(row("cfg:ospfv3", "OSPFV3", ospfv3Enabled ? "ENABLED" : "DISABLED", `Areas ${builderOspfv3DepthSummary(input2.graph, input2.ipv6, input2.ipv6RoutingDepth).routerAreas[deviceId]?.join(", ") || "\u2014"}`, ospfv3Enabled ? "good" : "muted", [why("cfg:ospfv3:why", "CONFIG", "OSPFV3 PROCESS", ospfv3Enabled ? "Router participates in the IPv6 link-state control plane." : "OSPFv3 is disabled on this router.")]));
    const bgpEnabled = input2.routing.bgp.enabledRouterIds.includes(deviceId);
    routingRows.push(row("cfg:bgp", "BGP", bgpEnabled ? `ENABLED \xB7 AS${builderBgpAsnForRouter(input2.graph, input2.routing.bgp, deviceId)}` : "DISABLED", `${input2.routing.bgp.sessions.filter((entry) => entry.aRouterId === deviceId || entry.bRouterId === deviceId).length} sessions \xB7 ${input2.routing.bgp.origins.filter((entry) => entry.routerId === deviceId).length} origins`, bgpEnabled ? "good" : "muted", [why("cfg:bgp:why", "CONFIG", "BGP PROCESS", bgpEnabled ? "ASN, sessions, origins, and policy are canonical Builder configuration." : "BGP is disabled on this router.")]));
  }
  const serviceRows = node.kind === "endpoint" ? (input2.services ?? []).filter((service) => service.nodeId === deviceId).map((service) => row(`cfg:service:${service.id}`, "HOSTED SERVICE", `${service.label} \xB7 ${service.enabled ? "LISTENING" : "CLOSED"}`, `${service.hostname ?? "NO DETERMINISTIC NAME"} \xB7 ${service.kind.toUpperCase()}/${service.port}`, service.enabled && service.hostname ? "good" : service.enabled || service.hostname ? "warn" : "bad", [why(`cfg:service:${service.id}:name`, "CONFIG", "DNS NAME", service.hostname ? `${service.hostname} is the canonical deterministic service name.` : "No deterministic hostname is configured; the application transaction stops at DNS."), why(`cfg:service:${service.id}:listener`, "CONFIG", "LISTENER", service.enabled ? `${service.kind.toUpperCase()} listener is enabled on port ${service.port}.` : `Listener is disabled on port ${service.port}; lower layers may still reach this endpoint.`)])) : [];
  const policyRows = [];
  if (node.kind === "router") {
    input2.acl.rules.filter((entry) => entry.routerId === deviceId).forEach((entry) => policyRows.push(row(`cfg:acl:${entry.id}`, "IPV4 ACL", `${entry.order} \xB7 ${entry.action.toUpperCase()} ${entry.protocol.toUpperCase()}`, `${entry.sourcePrefix} \u2192 ${entry.destinationPrefix}${entry.destinationPort ? `:${entry.destinationPort}` : ""} \xB7 ${entry.description || entry.id}`, entry.action === "deny" ? "warn" : "normal", [why(`cfg:acl:${entry.id}:why`, "CONFIG", "FIRST-MATCH RULE", `Rule ${entry.id} is persisted and evaluated in ascending order.`)])));
    input2.routing.bgp.policies.filter((entry) => entry.routerId === deviceId).forEach((entry) => policyRows.push(row(`cfg:bgp-policy:${entry.id}`, "BGP POLICY", `${entry.order} \xB7 ${entry.direction.toUpperCase()} \xB7 ${entry.action.toUpperCase()}`, `${entry.prefix} \xB7 ${entry.sessionId ?? "ANY SESSION"} \xB7 LP ${entry.setLocalPref ?? "KEEP"} \xB7 MED ${entry.setMed ?? "KEEP"} \xB7 ${entry.description || entry.id}`, entry.action === "deny" ? "warn" : "normal", [why(`cfg:bgp-policy:${entry.id}:why`, "CONFIG", "BGP IMPORT / EXPORT POLICY", `Rule ${entry.id} is canonical BGP policy and is evaluated against matching routes on the selected session.`)])));
    const acl6 = input2.ipv6RoutingDepth.policy.rules.filter((entry) => entry.routerId === deviceId);
    acl6.forEach((entry) => policyRows.push(row(`cfg:acl6:${entry.id}`, "IPV6 ACL", `${entry.order} \xB7 ${entry.action.toUpperCase()} \xB7 ${entry.icmpType.toUpperCase()}`, `${entry.sourcePrefix} \u2192 ${entry.destinationPrefix}`, entry.action === "deny" ? "warn" : "normal", [why(`cfg:acl6:${entry.id}:why`, "CONFIG", "IPV6 FIRST-MATCH RULE", `Rule ${entry.id} is evaluated independently from IPv4 policy.`)])));
    const boundary = input2.nat.boundaries.find((entry) => entry.routerId === deviceId);
    if (boundary) policyRows.push(row(`cfg:nat:${boundary.id}`, "NAT BOUNDARY", boundary.enabled ? "ENABLED" : "DISABLED", `inside ${boundary.insideLinkIds.join(", ")} \xB7 outside ${boundary.outsideLinkIds.join(", ")} \xB7 overload ${boundary.overloadAddress}`, boundary.enabled ? "good" : "muted", [why(`cfg:nat:${boundary.id}:why`, "CONFIG", "TRANSLATION BOUNDARY", "Inside/outside interface roles and overload address are canonical NAT configuration.")]));
    input2.nat.staticAddresses.filter((entry) => entry.routerId === deviceId).forEach((entry) => policyRows.push(row(`cfg:nat1:${entry.id}`, "STATIC NAT", entry.outsideAddress, `${entry.insideAddress} \u2194 ${entry.outsideAddress} \xB7 ${entry.description}`, "normal", [why(`cfg:nat1:${entry.id}:why`, "CONFIG", "ONE-TO-ONE MAPPING", "Static mapping exists independent from active translation state.")])));
    input2.nat.staticMappings.filter((entry) => entry.routerId === deviceId).forEach((entry) => policyRows.push(row(`cfg:natp:${entry.id}`, "PORT FORWARD", `${entry.outsideAddress}:${entry.outsidePort}/${entry.protocol}`, `\u2192 ${entry.insideAddress}:${entry.insidePort} \xB7 ${entry.description}`, "normal", [why(`cfg:natp:${entry.id}:why`, "CONFIG", "STATIC PORT MAPPING", "Published tuple is persisted; matching flow state remains derived.")])));
  }
  return [section("interfaces", "INTERFACES", [...ipv42, ...ipv63, ...gateways], "No routed interfaces are configured."), section("services-config", "HOSTED SERVICES", serviceRows, "No canonical hosted services are configured on this endpoint."), section("routing-config", "ROUTING / CONTROL PLANE", routingRows, "This endpoint has no router control-plane configuration."), section("policy-config", "POLICY / EDGE SERVICES", policyRows, "No explicit policy or edge-service configuration applies to this device.")];
}
function routedStateSections(input2, deviceId) {
  const node = input2.graph.nodes.find((candidate) => candidate.id === deviceId);
  if (!node) return [];
  const ribGraph = input2.truthGraphs?.ribGraph ?? input2.graph;
  const controlGraph = input2.truthGraphs?.controlGraph ?? input2.graph;
  const routeRows = [];
  if (node.kind === "router") {
    routeTableForBuilderRouter2(ribGraph, input2.addressing, input2.routing, deviceId).forEach((entry) => routeRows.push(row(`state:route4:${entry.id}`, `IPV4 ${entry.source.toUpperCase()}`, entry.prefix, `${entry.nextHop ? `via ${entry.nextHop}` : "DIRECT"} \xB7 ${entry.outgoingInterface} \xB7 AD ${entry.administrativeDistance} \xB7 M ${entry.metric} \xB7 ${entry.stateNote}`, entry.active ? "good" : "bad", routeWhy(input2.graph, input2.addressing, input2.routing, entry))));
    const overlay = builderOspfv3DepthRouteOverlay(input2.graph, input2.ipv6, input2.ipv6RoutingDepth);
    routeTableForBuilderIpv6Router(input2.graph, input2.ipv6, deviceId, overlay).forEach((entry) => routeRows.push(row(`state:route6:${entry.id}`, `IPV6 ${entry.source.toUpperCase()}`, entry.prefix, `${entry.nextHop ? `via ${entry.nextHop}` : "DIRECT"} \xB7 ${entry.outgoingInterface} \xB7 AD ${entry.administrativeDistance} \xB7 M ${entry.metric} \xB7 ${entry.stateNote}`, entry.active ? "good" : "bad", [why(`state:route6:${entry.id}:source`, "STATE", entry.source.toUpperCase(), entry.stateNote), why(`state:route6:${entry.id}:selection`, "STATE", "ROUTE SELECTION", `Prefix length ${entry.prefixLength} \u2192 AD ${entry.administrativeDistance} \u2192 metric ${entry.metric}.`), why(`state:route6:${entry.id}:link`, "TOPOLOGY", `LINK ${linkState(input2.graph, entry.linkId)}`, `${entry.outgoingInterface} uses ${entry.linkId}.`)])));
  } else {
    const gateway = input2.addressing.defaultGateways[deviceId] ?? null;
    routeRows.push(row("state:endpoint-routing", "HOST FIB", gateway ? `DEFAULT VIA ${gateway}` : "ON-LINK ONLY", gateway ? "Off-link IPv4 traffic uses the configured gateway." : "No off-link IPv4 forwarding is possible without a gateway.", gateway ? "normal" : "warn", [why("state:endpoint-routing:why", "CONFIG", "HOST DEFAULT ROUTE", gateway ? "Default-gateway configuration supplies endpoint FIB behavior." : "Only connected prefixes are usable.")]));
  }
  const controlRows = [];
  if (node.kind === "router") {
    const ospf = builderOspfState2(controlGraph, input2.addressing, input2.routing);
    ospf.adjacencies.filter((entry) => entry.aRouterId === deviceId || entry.bRouterId === deviceId).forEach((entry) => controlRows.push(row(`state:ospf:${entry.id}`, "OSPF NEIGHBOR", `${routedLabel(input2.graph, entry.aRouterId === deviceId ? entry.bRouterId : entry.aRouterId)} \xB7 ${entry.state}`, `AREA ${entry.areaId} \xB7 cost ${entry.cost} \xB7 ${entry.reason}`, entry.state === "FULL" ? "good" : "bad", [why(`state:ospf:${entry.id}:config`, "CONFIG", "OSPF ENABLEMENT", "Both router endpoints must participate in the configured area."), why(`state:ospf:${entry.id}:topology`, "TOPOLOGY", `LINK ${linkState(input2.graph, entry.linkId)}`, `${entry.linkId} carries the adjacency.`), why(`state:ospf:${entry.id}:state`, "STATE", "ADJACENCY RESULT", entry.reason)])));
    const advertised = ospf.advertisements.filter((entry) => entry.routerId === deviceId);
    if (advertised.length) controlRows.push(row("state:ospf:lsdb", "OSPF LSDB / SELF LSA", `${advertised.length} PREFIXES`, advertised.map((entry) => entry.prefix).join(" \xB7 "), "normal", [why("state:ospf:lsdb:why", "STATE", "LINK-STATE ORIGINATION", "Active connected prefixes are originated by the selected router into its current LSDB view.")]));
    const ospfv3 = builderOspfv3DepthSummary(input2.graph, input2.ipv6, input2.ipv6RoutingDepth);
    ospfv3.adjacencies.filter((entry) => entry.aRouterId === deviceId || entry.bRouterId === deviceId).forEach((entry) => controlRows.push(row(`state:ospfv3:${entry.id}`, "OSPFV3 NEIGHBOR", `${routedLabel(input2.graph, entry.aRouterId === deviceId ? entry.bRouterId : entry.aRouterId)} \xB7 ${entry.phase}`, `AREA ${entry.area} \xB7 ${entry.detail}`, entry.phase === "FULL" ? "good" : entry.phase === "STALE FULL" ? "warn" : "bad", [why(`state:ospfv3:${entry.id}:clock`, "STATE", entry.failurePhase ?? "ADJACENCY", entry.detail), why(`state:ospfv3:${entry.id}:topology`, "TOPOLOGY", `LINK ${linkState(input2.graph, entry.linkId)}`, `Physical state and timed control-plane knowledge remain separate.`)])));
    const bgp2 = builderBgpState(input2.graph, input2.addressing, input2.routing.bgp);
    bgp2.sessions.filter((entry) => entry.aRouterId === deviceId || entry.bRouterId === deviceId).forEach((entry) => controlRows.push(row(`state:bgp-session:${entry.id}`, "BGP SESSION", `${entry.mode.toUpperCase()} \xB7 ${entry.state}`, `AS${entry.aAsn} \u2194 AS${entry.bAsn} \xB7 ${entry.relationship.toUpperCase()} \xB7 ${entry.reason}`, entry.state === "ESTABLISHED" ? "good" : "bad", [why(`state:bgp-session:${entry.id}:config`, "CONFIG", "PEERING CONFIG", `Session ${entry.id} is authored on ${entry.linkId}.`), why(`state:bgp-session:${entry.id}:state`, "STATE", "SESSION STATE", entry.reason), why(`state:bgp-session:${entry.id}:topology`, "TOPOLOGY", `LINK ${linkState(input2.graph, entry.linkId)}`, `Peering depends on the direct Builder link.`)])));
    bgp2.routes.filter((entry) => entry.routerId === deviceId && entry.best).forEach((entry) => controlRows.push(row(`state:bgp-route:${entry.id}`, "BGP BEST", entry.prefix, `LP ${entry.localPref} \xB7 AS_PATH ${entry.asPath.join(" ") || "LOCAL"} \xB7 MED ${entry.med} \xB7 NEXT_HOP ${entry.nextHopAddress} \xB7 ${entry.communities.join(" ") || "NO COMM"}`, entry.policyAnomaly ? "warn" : "good", [why(`state:bgp-route:${entry.id}:best`, "STATE", "BEST-PATH DECISION", entry.bestReason), why(`state:bgp-route:${entry.id}:learned`, "STATE", entry.learnedVia.toUpperCase(), entry.learnedFromRouterId ? `Learned from ${routedLabel(input2.graph, entry.learnedFromRouterId)} over ${entry.learnedSessionId}.` : "Locally originated NLRI."), why(`state:bgp-route:${entry.id}:policy`, "CONFIG", "BGP POLICY", entry.policyAnomaly ? "Relationship leak override produced an explicit anomaly." : "Import/export policy and relationship export allowed this route.")])));
  }
  const neighborRows = input2.ipv6ControlState.neighborCache.filter((entry) => entry.nodeId === deviceId).map((entry) => row(`state:nd:${entry.id}`, "IPV6 NEIGHBOR", `${entry.address} \u2192 ${entry.mac}`, `${routedLabel(input2.graph, entry.targetNodeId)} \xB7 ${entry.source} \xB7 seq ${entry.learnedSequence} \xB7 ${entry.linkId}`, "good", [why(`state:nd:${entry.id}:source`, "EVENT", entry.source, entry.source === "RA" ? "Router Advertisement supplied the neighbor/default-router mapping." : "Neighbor Solicitation/Advertisement resolved the next hop."), why(`state:nd:${entry.id}:link`, "TOPOLOGY", `LINK ${linkState(input2.graph, entry.linkId)}`, `Neighbor state is scoped to ${entry.linkId}.`)]));
  const natRows = input2.natSessions.filter((entry) => entry.routerId === deviceId).map((entry) => row(`state:nat:${entry.id}`, entry.kind.toUpperCase(), `${entry.insideAddress}${entry.insidePort ? `:${entry.insidePort}` : ""} \u2192 ${entry.outsideAddress}${entry.outsidePort ? `:${entry.outsidePort}` : ""}`, `${entry.protocol.toUpperCase()} \xB7 remote ${entry.remoteAddress}${entry.remotePort ? `:${entry.remotePort}` : ""} \xB7 seq ${entry.createdSequence}\u2192${entry.lastUsedSequence}${entry.expiresAfterSequence == null ? " \xB7 STATIC" : ` \xB7 EXP ${entry.expiresAfterSequence}`}`, "good", [why(`state:nat:${entry.id}:boundary`, "CONFIG", "NAT BOUNDARY", `Translation belongs to ${entry.routerId}; static rules or PAT policy supplied the translated tuple.`), why(`state:nat:${entry.id}:runtime`, "STATE", "TRANSLATION STATE", `Created at sequence ${entry.createdSequence}; last used at ${entry.lastUsedSequence}.`)]));
  const policy = input2.graph.nodes.find((candidate) => candidate.id === deviceId)?.kind === "router" ? traceBuilderPolicy(input2.graph, input2.addressing, input2.routing, input2.acl, input2.sourceId, input2.destinationId, "icmp") : null;
  const policyRows = policy?.decisions.filter((entry) => entry.routerId === deviceId).map((entry) => row(`state:policy:${entry.routerId}:${entry.ruleId ?? "default"}`, "CURRENT ICMP POLICY", entry.action.toUpperCase(), entry.ruleDescription, entry.action === "permit" ? "good" : "bad", [why(`state:policy:${entry.routerId}:path`, "STATE", "FLOW REACHED ROUTER", `Current ${input2.sourceId} \u2192 ${input2.destinationId} forwarding path crosses this router.`), why(`state:policy:${entry.routerId}:rule`, "CONFIG", entry.ruleId ?? "DEFAULT POLICY", entry.ruleDescription), why(`state:policy:${entry.routerId}:decision`, "STATE", "FIRST MATCH WINS", `${entry.action.toUpperCase()} is the deterministic policy result for the current flow.`)])) ?? [];
  const probeRows = input2.probeHistory.filter((probe2) => probe2.sourceNodeId === deviceId || probe2.destinationNodeId === deviceId || probe2.attempts.some((attempt) => attempt.requestNodeIds.includes(deviceId) || attempt.responseNodeIds.includes(deviceId))).slice(0, 8).map((probe2) => row(`state:probe:${probe2.id}`, `${probe2.kind.toUpperCase()} \xB7 ${probe2.plane.replace("ROUTED ", "")}`, probe2.success ? "PASS" : "FAIL", `${routedLabel(input2.graph, probe2.sourceNodeId)} \u2192 ${routedLabel(input2.graph, probe2.destinationNodeId)} \xB7 ${probe2.summary}`, probe2.success ? "good" : "warn", [why(`state:probe:${probe2.id}:snapshot`, "STATE", "SESSION SNAPSHOT", probe2.snapshotNote), why(`state:probe:${probe2.id}:result`, "EVENT", "PROBE RESULT", probe2.attempts.at(-1)?.detail ?? probe2.summary)]));
  return [section("rib-fib", "RIB / FIB", routeRows, "No route state applies to this device."), section("control-state", "DYNAMIC ROUTING STATE", controlRows, "No dynamic-routing state applies to this device."), section("neighbor-state", "NEIGHBOR / TRANSLATION STATE", [...neighborRows, ...natRows], "No ND or NAT runtime state applies to this device."), section("policy-flow-state", "POLICY / FLOW STATE", [...policyRows, ...probeRows], "No current policy decision or probe snapshot involves this device.")];
}
function stpStatesForDevice(ethernet2, deviceId) {
  return ethernet2.vlans.map((vlan) => builderStpState(ethernet2, vlan.id)).filter((state) => state.ports.some((port) => port.a === deviceId || port.b === deviceId) || state.rootBridgeId === deviceId);
}
function ethernetConfigSections(input2, deviceId) {
  const device2 = input2.ethernet.devices.find((candidate) => candidate.id === deviceId);
  if (!device2) return [];
  const identity = [row("cfg:lan:identity", "DEVICE", `${device2.kind.toUpperCase()} \xB7 ${device2.mac}`, device2.label, "normal", [why("cfg:lan:identity:why", "CONFIG", "DEVICE IDENTITY", "Role, MAC address, and VLAN interfaces are canonical Ethernet configuration.")]), ...device2.interfaces.map((entry) => row(`cfg:lan:if:${entry.vlanId}`, "L3 VLAN INTERFACE", `VLAN ${entry.vlanId} \xB7 ${entry.address}`, `gateway ${entry.gateway ?? "\u2014"}`, "normal", [why(`cfg:lan:if:${entry.vlanId}:why`, "CONFIG", "VLAN INTERFACE", `IPv4 interface belongs to VLAN ${entry.vlanId}.`)]))];
  const ports = input2.ethernet.links.filter((link) => link.a === deviceId || link.b === deviceId).map((link) => row(`cfg:lan:port:${link.id}`, "PORT", `${link.id} \xB7 ${link.mode.toUpperCase()}`, link.mode === "access" ? `ACCESS VLAN ${link.accessVlan} \xB7 ${link.failed ? "DOWN" : "UP"}` : `ALLOWED ${link.allowedVlans?.join(", ") || "NONE"} \xB7 ${link.failed ? "DOWN" : "UP"}`, link.failed ? "bad" : "normal", [why(`cfg:lan:port:${link.id}:mode`, "CONFIG", link.mode.toUpperCase(), link.mode === "access" ? `Frames are untagged members of VLAN ${link.accessVlan}.` : `Only VLANs ${link.allowedVlans?.join(", ") || "NONE"} are carried.`), why(`cfg:lan:port:${link.id}:physical`, "TOPOLOGY", link.failed ? "LINK DOWN" : "LINK UP", `${ethernetLabel(input2.ethernet, link.a)} \u2194 ${ethernetLabel(input2.ethernet, link.b)}`)]));
  const serviceRows = [];
  const dhcpClient = input2.dhcp.clientDeviceIds.includes(deviceId);
  if (device2.kind === "endpoint") serviceRows.push(row("cfg:dhcp:client", "IPV4 ADDRESS MODE", dhcpClient ? "DHCP" : "STATIC", dhcpClient ? "No effective IPv4 is assumed until a lease ACK exists." : "Configured interface address remains authoritative.", dhcpClient ? "normal" : "muted", [why("cfg:dhcp:client:why", "CONFIG", "HOST BOOTSTRAP", dhcpClient ? "Endpoint is persisted as a DHCP client." : "Endpoint uses static IPv4 configuration.")]));
  input2.dhcp.pools.filter((pool) => pool.serverDeviceId === deviceId).forEach((pool) => serviceRows.push(row(`cfg:dhcp:pool:${pool.id}`, "DHCP POOL", `VLAN ${pool.vlanId} \xB7 ${pool.startAddress}\u2013${pool.endAddress}`, `GW ${pool.gateway ?? "MISSING"} \xB7 DNS ${pool.dnsServers.join(", ") || "MISSING"} \xB7 lease ${pool.leaseSteps} steps`, "normal", [why(`cfg:dhcp:pool:${pool.id}:why`, "CONFIG", "DHCP SERVER POOL", `Pool ${pool.id} is canonical service configuration.`)])));
  input2.dhcp.relays.filter((relay) => relay.routerId === deviceId || relay.serverDeviceId === deviceId).forEach((relay) => serviceRows.push(row(`cfg:dhcp:relay:${relay.id}`, "DHCP RELAY", `VLAN ${relay.clientVlanId} \u2192 VLAN ${relay.serverVlanId}`, `${ethernetLabel(input2.ethernet, relay.routerId)} \u2192 ${ethernetLabel(input2.ethernet, relay.serverDeviceId)}`, "normal", [why(`cfg:dhcp:relay:${relay.id}:why`, "CONFIG", "EXPLICIT RELAY", "Broadcast does not cross the router; the configured relay forwards DHCP messages between VLANs.")])));
  if (device2.kind === "switch") serviceRows.push(row("cfg:stp", "STP", input2.ethernet.stp.enabled ? "ENABLED" : "DISABLED", `bridge priority ${input2.ethernet.stp.bridgePriorities[deviceId] ?? 32768}`, input2.ethernet.stp.enabled ? "good" : "warn", [why("cfg:stp:why", "CONFIG", "LOOP CONTROL", input2.ethernet.stp.enabled ? "Per-VLAN spanning trees are derived from canonical bridge priority and topology." : "Redundant Layer-2 cycles can become unsafe.")]));
  return [section("lan-identity", "IDENTITY / INTERFACES", identity), section("lan-ports", "PORTS / VLANS", ports, "No Ethernet links attach to this device."), section("lan-services", "L2 CONTROL / DHCP", serviceRows, "No STP or DHCP configuration applies to this device.")];
}
function ethernetStateSections(input2, deviceId) {
  const device2 = input2.ethernet.devices.find((candidate) => candidate.id === deviceId);
  if (!device2) return [];
  const runtime = applyBuilderDhcpState(input2.ethernet, input2.dhcp, input2.dhcpLeases, input2.dhcpSequence);
  const runtimeDevice = runtime.devices.find((candidate) => candidate.id === deviceId);
  const hostRows = (runtimeDevice?.interfaces ?? []).map((entry) => row(`state:host:${entry.vlanId}`, "EFFECTIVE IPV4", entry.address, `VLAN ${entry.vlanId} \xB7 GW ${entry.gateway ?? "NONE"}${input2.dhcp.clientDeviceIds.includes(deviceId) ? " \xB7 DHCP RUNTIME" : " \xB7 STATIC"}`, entry.address === "0.0.0.0" ? "warn" : "good", [why(`state:host:${entry.vlanId}:config`, "CONFIG", "ADDRESS MODE", input2.dhcp.clientDeviceIds.includes(deviceId) ? "DHCP client configuration suppresses the static address until an ACK lease exists." : "Static interface configuration is effective immediately."), why(`state:host:${entry.vlanId}:state`, "STATE", "RUNTIME ADDRESS", entry.address === "0.0.0.0" ? "No active DHCP lease currently materializes an IPv4 address." : `${entry.address} is the effective address used by the LAN data plane.`)]));
  const arpRows = input2.arpCache.filter((entry) => entry.ownerDeviceId === deviceId).map((entry) => row(`state:arp:${entry.ownerDeviceId}:${entry.vlanId}:${entry.address}`, "ARP", `${entry.address} \u2192 ${entry.mac}`, `VLAN ${entry.vlanId} \xB7 learned from ${ethernetLabel(input2.ethernet, entry.learnedFromDeviceId)}`, "good", [why(`state:arp:${entry.address}:request`, "EVENT", "ARP RESOLUTION", input2.arpResolutions.find((resolution) => resolution.ownerDeviceId === deviceId && resolution.targetAddress === entry.address)?.summary ?? "A prior ARP Request/Reply resolved this target."), why(`state:arp:${entry.address}:cache`, "STATE", "ARP CACHE", `Mapping is session-only and scoped to device ${deviceId}, VLAN ${entry.vlanId}.`)]));
  const fdb = input2.ethernetFlow?.fdb.filter((entry) => entry.switchId === deviceId) ?? [];
  const fdbRows = fdb.map((entry) => row(`state:fdb:${entry.switchId}:${entry.vlanId}:${entry.mac}`, "FDB", `${entry.mac} \u2192 ${entry.linkId}`, `VLAN ${entry.vlanId} \xB7 learned from ${ethernetLabel(input2.ethernet, entry.learnedFrom)}`, "good", [why(`state:fdb:${entry.mac}:flow`, "EVENT", "SOURCE MAC LEARNING", `The last canonical Ethernet flow observed ${entry.mac} arriving from ${entry.learnedFrom}.`), why(`state:fdb:${entry.mac}:vlan`, "STATE", "VLAN-SCOPED FDB", `Entry exists only in VLAN ${entry.vlanId}; another VLAN may learn the same MAC independently.`)]));
  const stpRows = stpStatesForDevice(input2.ethernet, deviceId).map((state) => {
    const localPorts = state.ports.filter((port) => port.a === deviceId || port.b === deviceId);
    return row(`state:stp:${state.vlanId}`, "STP", `VLAN ${state.vlanId} \xB7 ${state.rootBridgeId === deviceId ? "ROOT" : localPorts.some((port) => port.state === "BLOCKING" && port.blockedAt === deviceId) ? "BLOCKING" : "FORWARDING"}`, `${state.explanation} \xB7 ${localPorts.map((port) => `${port.linkId}:${port.state}`).join(" \xB7 ")}`, state.enabled ? localPorts.some((port) => port.state === "BLOCKING" && port.blockedAt === deviceId) ? "warn" : "good" : state.loopDetected ? "bad" : "muted", [why(`state:stp:${state.vlanId}:election`, "STATE", "ROOT / PORT ELECTION", state.explanation), ...localPorts.map((port) => why(`state:stp:${state.vlanId}:${port.linkId}`, "STATE", `${port.linkId} \xB7 ${port.state}`, port.reason))]);
  });
  const activeLeases = pruneBuilderDhcpLeases(input2.dhcpLeases, input2.dhcpSequence).filter((lease) => lease.clientDeviceId === deviceId || lease.serverDeviceId === deviceId);
  const leaseRows = activeLeases.map((lease) => row(`state:dhcp:${lease.id}`, "DHCP LEASE", `${ethernetLabel(input2.ethernet, lease.clientDeviceId)} \xB7 ${lease.address}`, `VLAN ${lease.vlanId} \xB7 server ${ethernetLabel(input2.ethernet, lease.serverDeviceId)} \xB7 T1 ${lease.renewAtSequence} \xB7 T2 ${lease.rebindAtSequence} \xB7 EXP ${lease.expiresAtSequence}`, "good", [why(`state:dhcp:${lease.id}:pool`, "CONFIG", "POOL", `Lease came from ${lease.poolId} with gateway ${lease.gateway ?? "MISSING"} and DNS ${lease.dnsServers.join(", ") || "MISSING"}.`), why(`state:dhcp:${lease.id}:ack`, "EVENT", "DHCP ACK", `Lease was acquired/renewed at sequence ${lease.renewedAtSequence}.`), why(`state:dhcp:${lease.id}:clock`, "STATE", "LEASE TIMER", `Current sequence ${input2.dhcpSequence}; lease expires at ${lease.expiresAtSequence}.`)]));
  const flowRows = input2.ethernetFlow && input2.ethernetFlow.segments.some((segment) => segment.nodeIds.includes(deviceId)) ? [row(`state:lan-flow:${input2.ethernetFlow.sourceId}:${input2.ethernetFlow.destinationId}`, "LAST LAN FLOW", input2.ethernetFlow.success ? "DELIVERED" : "FAILED", input2.ethernetFlow.summary, input2.ethernetFlow.success ? "good" : "bad", [why("state:lan-flow:path", "STATE", "FORWARDING SEGMENTS", input2.ethernetFlow.segments.map((segment) => `VLAN ${segment.vlanId}: ${segment.nodeIds.map((id2) => ethernetLabel(input2.ethernet, id2)).join(" \u2192 ")} \xB7 ${segment.disposition}`).join(" | ")), why("state:lan-flow:boundary", "TOPOLOGY", "L2/L3 BOUNDARY", input2.ethernetFlow.routed ? `TTL ${input2.ethernetFlow.ttlBefore} \u2192 ${input2.ethernetFlow.ttlAfter} at ${ethernetLabel(input2.ethernet, input2.ethernetFlow.routedAt ?? "")}.` : "Same-VLAN switching did not decrement IP TTL.")])] : [];
  return [section("lan-host-state", "HOST / ARP STATE", [...hostRows, ...arpRows], "No host or ARP state applies to this device."), section("lan-switch-state", "FDB / STP STATE", [...fdbRows, ...stpRows], "No switching state applies to this device."), section("lan-service-state", "DHCP / FLOW STATE", [...leaseRows, ...flowRows], "No lease or recent LAN-flow state applies to this device.")];
}
function eventViews(journal, device2) {
  return journal.filter((event3) => event3.deviceRefs.length === 0 || event3.deviceRefs.some((ref) => sameRef(ref, device2))).slice(-40).reverse().map((event3) => ({ ...event3, causeChain: builderWorkbenchEventCausalChain(journal, event3.id).map((cause) => why(`${event3.id}:cause:${cause.id}`, "EVENT", `#${String(cause.sequence).padStart(3, "0")} \xB7 ${cause.category.toUpperCase()}`, cause.detail)) }));
}
function buildBuilderDeviceWorkbench(input2, requested) {
  const options2 = builderWorkbenchDeviceOptions(input2.graph, input2.ethernet);
  const device2 = options2.find((candidate) => sameRef(candidate, requested)) ?? options2[0] ?? { plane: "routed", id: "none", label: "NO DEVICE", kind: "NONE", group: "NONE" };
  const configSections = device2.plane === "routed" ? routedConfigSections(input2, device2.id) : ethernetConfigSections(input2, device2.id);
  const stateSections = device2.plane === "routed" ? routedStateSections(input2, device2.id) : ethernetStateSections(input2, device2.id);
  return { device: device2, configSections, stateSections, events: eventViews(input2.events, device2), configRowCount: configSections.reduce((sum, current) => sum + current.rows.length, 0), stateRowCount: stateSections.reduce((sum, current) => sum + current.rows.length, 0), depthInput: input2 };
}

// ../8f1a24ac8c73/hopscotch/src/builder/arp.ts
function key(entry) {
  return `${entry.ownerDeviceId}:${entry.vlanId}:${entry.address}`;
}
function cloneBuilderArpCache(cache) {
  return cache.map((entry) => ({ ...entry }));
}
function upsert(cache, entry) {
  return [...cache.filter((candidate) => key(candidate) !== key(entry)), entry].sort((a, b) => key(a).localeCompare(key(b)));
}
function targetForAddress(config, vlanId, address2) {
  return config.devices.filter((device2) => builderEthernetInterfaceFor(device2, vlanId)?.address === address2).sort((a, b) => a.id.localeCompare(b.id))[0]?.id ?? null;
}
function resolveBuilderArp(config, ownerDeviceId, vlanId, targetAddress, cacheInput) {
  const owner = builderEthernetDeviceById(config, ownerDeviceId);
  const ownerIf = builderEthernetInterfaceFor(owner, vlanId);
  const cache = cloneBuilderArpCache(cacheInput);
  const cached = cache.find((entry2) => entry2.ownerDeviceId === ownerDeviceId && entry2.vlanId === vlanId && entry2.address === targetAddress);
  if (cached) {
    return { cache, resolution: { ownerDeviceId, targetDeviceId: cached.learnedFromDeviceId, vlanId, targetAddress, targetMac: cached.mac, cacheHit: true, success: true, requestNodeIds: [], requestLinkIds: [], replyNodeIds: [], replyLinkIds: [], failureReason: null, summary: `ARP cache hit: ${targetAddress} is already mapped to ${cached.mac}.` } };
  }
  if (!owner || !ownerIf) return { cache, resolution: { ownerDeviceId, targetDeviceId: null, vlanId, targetAddress, targetMac: null, cacheHit: false, success: false, requestNodeIds: [], requestLinkIds: [], replyNodeIds: [], replyLinkIds: [], failureReason: `${ownerDeviceId} has no IPv4 interface in VLAN ${vlanId}.`, summary: `ARP cannot start without a local VLAN ${vlanId} interface.` } };
  const targetDeviceId = targetForAddress(config, vlanId, targetAddress);
  if (!targetDeviceId) return { cache, resolution: { ownerDeviceId, targetDeviceId: null, vlanId, targetAddress, targetMac: null, cacheHit: false, success: false, requestNodeIds: [ownerDeviceId], requestLinkIds: [], replyNodeIds: [], replyLinkIds: [], failureReason: `No device owns ${targetAddress} in VLAN ${vlanId}.`, summary: `ARP Request for ${targetAddress} receives no reply.` } };
  const target2 = builderEthernetDeviceById(config, targetDeviceId);
  if (!target2) return { cache, resolution: { ownerDeviceId, targetDeviceId: null, vlanId, targetAddress, targetMac: null, cacheHit: false, success: false, requestNodeIds: [ownerDeviceId], requestLinkIds: [], replyNodeIds: [], replyLinkIds: [], failureReason: `No device owns ${targetAddress} in VLAN ${vlanId}.`, summary: `ARP Request for ${targetAddress} receives no reply.` } };
  const path = builderEthernetPathForVlan(config, ownerDeviceId, targetDeviceId, vlanId);
  if (!path) return { cache, resolution: { ownerDeviceId, targetDeviceId, vlanId, targetAddress, targetMac: null, cacheHit: false, success: false, requestNodeIds: [ownerDeviceId], requestLinkIds: [], replyNodeIds: [], replyLinkIds: [], failureReason: `VLAN ${vlanId} has no STP-forwarding Layer-2 path to ${target2.label}.`, summary: `ARP broadcast cannot reach ${target2.label}.` } };
  const reverse = { nodeIds: [...path.nodeIds].reverse(), linkIds: [...path.linkIds].reverse() };
  const entry = { ownerDeviceId, vlanId, address: targetAddress, mac: target2.mac, learnedFromDeviceId: targetDeviceId };
  const next = upsert(cache, entry);
  return { cache: next, resolution: { ownerDeviceId, targetDeviceId, vlanId, targetAddress, targetMac: target2.mac, cacheHit: false, success: true, requestNodeIds: path.nodeIds, requestLinkIds: path.linkIds, replyNodeIds: reverse.nodeIds, replyLinkIds: reverse.linkIds, failureReason: null, summary: `ARP Request floods inside VLAN ${vlanId}; ${target2.label} replies ${targetAddress} is ${target2.mac}, then ${owner.label} caches the mapping.` } };
}
function resolveBuilderEthernetFlowArp(config, sourceId, destinationId, cacheInput) {
  const source = builderEthernetDeviceById(config, sourceId);
  const destination = builderEthernetDeviceById(config, destinationId);
  if (!source || !destination || source.kind !== "endpoint" || destination.kind !== "endpoint") return { resolutions: [], cache: cloneBuilderArpCache(cacheInput), success: false, failureReason: "ARP flow endpoints must be Ethernet endpoints." };
  const sourceIf = source.interfaces[0], destinationIf = destination.interfaces[0];
  if (!sourceIf || !destinationIf) return { resolutions: [], cache: cloneBuilderArpCache(cacheInput), success: false, failureReason: "Endpoint IPv4/VLAN interfaces are incomplete." };
  let cache = cloneBuilderArpCache(cacheInput);
  const resolutions = [];
  if (sourceIf.vlanId === destinationIf.vlanId) {
    const first = resolveBuilderArp(config, sourceId, sourceIf.vlanId, destinationIf.address, cache);
    resolutions.push(first.resolution);
    cache = first.cache;
    return { resolutions, cache, success: first.resolution.success, failureReason: first.resolution.failureReason };
  }
  if (!sourceIf.gateway) return { resolutions, cache, success: false, failureReason: `${source.label} has no default gateway for off-subnet traffic.` };
  const toGateway = resolveBuilderArp(config, sourceId, sourceIf.vlanId, sourceIf.gateway, cache);
  resolutions.push(toGateway.resolution);
  cache = toGateway.cache;
  if (!toGateway.resolution.success) return { resolutions, cache, success: false, failureReason: toGateway.resolution.failureReason };
  const routerId = toGateway.resolution.targetDeviceId;
  if (!routerId) return { resolutions, cache, success: false, failureReason: "Gateway ARP did not resolve to a router device." };
  const fromRouter = resolveBuilderArp(config, routerId, destinationIf.vlanId, destinationIf.address, cache);
  resolutions.push(fromRouter.resolution);
  cache = fromRouter.cache;
  return { resolutions, cache, success: fromRouter.resolution.success, failureReason: fromRouter.resolution.failureReason };
}

// ../8f1a24ac8c73/hopscotch/src/builder/ipv6-control-plane.ts
function stableMac(nodeId, linkId) {
  const text2 = `${nodeId}:${linkId}:nd6`;
  let hash = 2166136261;
  for (let index = 0; index < text2.length; index += 1) {
    hash ^= text2.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return [2, 72, 54, hash >>> 16 & 255, hash >>> 8 & 255, hash & 255].map((byte) => byte.toString(16).padStart(2, "0")).join(":");
}
function cloneTrace(trace2) {
  return trace2 ? { ...trace2, hops: trace2.hops.map((hop) => ({ ...hop })) } : null;
}
function cloneState2(state) {
  return {
    neighborCache: state.neighborCache.map((entry) => ({ ...entry })),
    ndHistory: state.ndHistory.map((entry) => ({ ...entry })),
    raHistory: state.raHistory.map((entry) => ({ ...entry })),
    pmtuCache: state.pmtuCache.map((entry) => ({ ...entry })),
    pmtuHistory: state.pmtuHistory.map((entry) => ({ ...entry, reverseTrace: cloneTrace(entry.reverseTrace) })),
    clock: state.clock
  };
}
function createBuilderIpv6ControlState() {
  return { neighborCache: [], ndHistory: [], raHistory: [], pmtuCache: [], pmtuHistory: [], clock: 0 };
}
function interfaceOnLink(config, linkId, nodeId) {
  return config.addressing.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nodeId) ?? null;
}
function resolveBuilderIpv6TraceNeighbors(graph4, config, trace2, current = createBuilderIpv6ControlState(), sequence = current.clock + 1, maxHops = trace2.hops.length) {
  let state = cloneState2(current);
  state.clock = Math.max(state.clock, sequence);
  const resolutions = [];
  const hops = trace2.hops.slice(0, Math.max(0, maxHops));
  for (const [index, hop] of hops.entries()) {
    if (!hop.linkId || !hop.nextNodeId) continue;
    const link = graph4.links.find((candidate) => candidate.id === hop.linkId);
    if (!link || link.failed) {
      return { success: false, state, resolutions, failureReason: `Neighbor Discovery cannot use failed link ${hop.linkId}.` };
    }
    const targetInterface = interfaceOnLink(config, hop.linkId, hop.nextNodeId);
    if (!targetInterface) {
      return { success: false, state, resolutions, failureReason: `${hop.nextNodeId} has no IPv6 interface on ${hop.linkId}.` };
    }
    const targetAddress = hop.nextHop ?? targetInterface.globalAddress;
    if (targetAddress !== targetInterface.globalAddress && targetAddress !== targetInterface.linkLocalAddress) {
      return { success: false, state, resolutions, failureReason: `${targetAddress} is not assigned to ${hop.nextNodeId} on ${hop.linkId}.` };
    }
    const id2 = `${hop.nodeId}|${hop.linkId}|${targetAddress}`;
    const prior = state.neighborCache.find((entry) => entry.id === id2);
    const cacheHit = Boolean(prior && sequence - prior.learnedSequence <= 8);
    const targetMac = prior?.mac ?? stableMac(hop.nextNodeId, hop.linkId);
    const solicitedNodeMulticast = builderIpv6SolicitedNodeMulticast(targetAddress);
    const multicastMac = builderIpv6SolicitedNodeMulticastMac(targetAddress);
    const resolution = {
      id: `nd6:${sequence}:${index}:${id2}`,
      sequence,
      nodeId: hop.nodeId,
      targetNodeId: hop.nextNodeId,
      linkId: hop.linkId,
      targetAddress,
      solicitedNodeMulticast,
      multicastMac,
      targetMac,
      cacheHit,
      detail: cacheHit ? `${hop.nodeLabel} used its neighbor cache for ${targetAddress} \u2192 ${targetMac}.` : `${hop.nodeLabel} sent Neighbor Solicitation to ${solicitedNodeMulticast} (${multicastMac}); ${hop.nextNodeId.toUpperCase()} returned Neighbor Advertisement with ${targetMac}.`
    };
    resolutions.push(resolution);
    if (!cacheHit) {
      state.neighborCache = [
        ...state.neighborCache.filter((entry) => entry.id !== id2),
        { id: id2, nodeId: hop.nodeId, linkId: hop.linkId, address: targetAddress, mac: targetMac, targetNodeId: hop.nextNodeId, learnedSequence: sequence, source: "NS/NA" }
      ].slice(-96);
    }
  }
  state.ndHistory = [...state.ndHistory, ...resolutions].slice(-96);
  return { success: true, state, resolutions, failureReason: null };
}
function runBuilderIpv6RouterSolicitation(graph4, ipv42, config, endpointId, current = createBuilderIpv6ControlState()) {
  const sequence = current.clock + 1;
  let state = cloneState2(current);
  state.clock = sequence;
  const endpoint = graph4.nodes.find((node) => node.id === endpointId);
  const links = graph4.links.filter((link) => !link.failed && (link.a === endpointId || link.b === endpointId)).sort((a, b) => a.id.localeCompare(b.id));
  const candidate = endpoint?.kind === "endpoint" ? links.map((link) => {
    const routerId = link.a === endpointId ? link.b : link.a;
    const router = graph4.nodes.find((node) => node.id === routerId);
    return router?.kind === "router" && config.autoconfig.raEnabledRouterIds.includes(routerId) ? { link, routerId } : null;
  }).find((entry) => Boolean(entry)) : null;
  if (!config.enabled || !endpoint || endpoint.kind !== "endpoint" || !candidate) {
    const event4 = {
      id: `ra6:${sequence}:${endpointId}`,
      sequence,
      endpointId,
      routerId: null,
      linkId: null,
      success: false,
      rsDestination: "ff02::2",
      raSource: null,
      prefix: null,
      slaacAddress: null,
      routerLifetimeSeconds: 0,
      preferredLifetimeSeconds: 0,
      validLifetimeSeconds: 0,
      detail: !config.enabled ? "IPv6 is disabled; Router Solicitation cannot run." : "No live directly connected router is advertising a prefix to this endpoint."
    };
    state.raHistory = [...state.raHistory, event4].slice(-24);
    return { config, state, event: event4 };
  }
  const nextConfig = applyBuilderIpv6Slaac(graph4, ipv42, config, endpointId, candidate.routerId, candidate.link.id);
  const segment = nextConfig.addressing.segments[candidate.link.id];
  const routerInterface = segment.interfaces.find((entry) => entry.nodeId === candidate.routerId);
  const endpointInterface = segment.interfaces.find((entry) => entry.nodeId === endpointId);
  const cacheId = `${endpointId}|${candidate.link.id}|${routerInterface.linkLocalAddress}`;
  state.neighborCache = [
    ...state.neighborCache.filter((entry) => entry.id !== cacheId),
    { id: cacheId, nodeId: endpointId, linkId: candidate.link.id, address: routerInterface.linkLocalAddress, mac: stableMac(candidate.routerId, candidate.link.id), targetNodeId: candidate.routerId, learnedSequence: sequence, source: "RA" }
  ].slice(-96);
  const event3 = {
    id: `ra6:${sequence}:${endpointId}:${candidate.routerId}`,
    sequence,
    endpointId,
    routerId: candidate.routerId,
    linkId: candidate.link.id,
    success: true,
    rsDestination: "ff02::2",
    raSource: routerInterface.linkLocalAddress,
    prefix: segment.prefix,
    slaacAddress: endpointInterface.globalAddress,
    routerLifetimeSeconds: 1800,
    preferredLifetimeSeconds: 1800,
    validLifetimeSeconds: 3600,
    detail: `${endpoint.label} sent RS to ff02::2. ${candidate.routerId.toUpperCase()} advertised ${segment.prefix}; SLAAC installed ${endpointInterface.globalAddress} and default router ${routerInterface.linkLocalAddress}%${candidate.link.id}.`
  };
  state.raHistory = [...state.raHistory, event3].slice(-24);
  return { config: nextConfig, state, event: event3 };
}

// ../8f1a24ac8c73/hopscotch/src/builder/link-characteristics.ts
var DEFAULT_BUILDER_LINK_PROFILE = {
  latencyMs: 5,
  jitterMs: 0,
  bandwidthMbps: 1e3,
  lossPercent: 0,
  mtuBytes: 1500,
  queuePackets: 256
};
function cloneProfile(profile) {
  return { ...profile };
}
function createDefaultBuilderLinkProfiles(graph4) {
  return Object.fromEntries(graph4.links.map((link) => [link.id, cloneProfile(DEFAULT_BUILDER_LINK_PROFILE)]));
}
function cloneBuilderLinkProfiles(profiles2) {
  return Object.fromEntries(Object.entries(profiles2).map(([id2, profile]) => [id2, cloneProfile(profile)]));
}
function validateBuilderLinkProfile(profile) {
  const latencyMs = Number(profile.latencyMs);
  const jitterMs = Number(profile.jitterMs);
  const bandwidthMbps = Number(profile.bandwidthMbps);
  const lossPercent = Number(profile.lossPercent);
  const mtuBytes = Number(profile.mtuBytes);
  const queuePackets = Number(profile.queuePackets);
  if (!Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > 5e3) throw new Error("Link latency must be 0\u20135000 ms.");
  if (!Number.isFinite(jitterMs) || jitterMs < 0 || jitterMs > 2e3) throw new Error("Link jitter must be 0\u20132000 ms.");
  if (!Number.isFinite(bandwidthMbps) || bandwidthMbps <= 0 || bandwidthMbps > 1e6) throw new Error("Link bandwidth must be greater than 0 and at most 1,000,000 Mb/s.");
  if (!Number.isFinite(lossPercent) || lossPercent < 0 || lossPercent > 100) throw new Error("Link loss must be 0\u2013100%.");
  if (!Number.isInteger(mtuBytes) || mtuBytes < 68 || mtuBytes > 9216) throw new Error("Link MTU must be an integer from 68\u20139216 bytes.");
  if (!Number.isInteger(queuePackets) || queuePackets < 1 || queuePackets > 1e6) throw new Error("Link queue capacity must be an integer from 1\u20131,000,000 packets.");
  return { latencyMs, jitterMs, bandwidthMbps, lossPercent, mtuBytes, queuePackets };
}
function validateBuilderLinkProfiles(graph4, profiles2) {
  const links = new Set(graph4.links.map((link) => link.id));
  const next = {};
  for (const link of graph4.links) next[link.id] = validateBuilderLinkProfile(profiles2?.[link.id] ?? DEFAULT_BUILDER_LINK_PROFILE);
  for (const id2 of Object.keys(profiles2 ?? {})) if (!links.has(id2)) throw new Error(`Link profile references unknown link ${id2}.`);
  return next;
}
function builderPathCharacteristics(profiles2, linkIds2) {
  if (linkIds2.length === 0) return { linkIds: [], oneWayLatencyMs: 0, jitterMs: 0, bottleneckMbps: null, lossPercent: 0, pathMtuBytes: null, queuePackets: null };
  const resolved = linkIds2.map((id2) => profiles2[id2] ?? DEFAULT_BUILDER_LINK_PROFILE);
  const survival = resolved.reduce((value, profile) => value * (1 - profile.lossPercent / 100), 1);
  return {
    linkIds: [...linkIds2],
    oneWayLatencyMs: resolved.reduce((sum, profile) => sum + profile.latencyMs, 0),
    jitterMs: resolved.reduce((sum, profile) => sum + profile.jitterMs, 0),
    bottleneckMbps: Math.min(...resolved.map((profile) => profile.bandwidthMbps)),
    lossPercent: (1 - survival) * 100,
    pathMtuBytes: Math.min(...resolved.map((profile) => profile.mtuBytes)),
    queuePackets: Math.min(...resolved.map((profile) => profile.queuePackets))
  };
}
function stableUnit(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash / 4294967295;
}
function deterministicBuilderPathDrop(profiles2, linkIds2, seed) {
  for (const [index, linkId] of linkIds2.entries()) {
    const profile = profiles2[linkId] ?? DEFAULT_BUILDER_LINK_PROFILE;
    if (profile.lossPercent <= 0) continue;
    if (stableUnit(`${seed}:${index}:${linkId}`) < profile.lossPercent / 100) return linkId;
  }
  return null;
}
function builderRoundTripCharacteristics(profiles2, requestLinkIds, responseLinkIds) {
  const request = builderPathCharacteristics(profiles2, requestLinkIds);
  const response = builderPathCharacteristics(profiles2, responseLinkIds);
  const all = [...requestLinkIds, ...responseLinkIds];
  const path = builderPathCharacteristics(profiles2, all);
  return { ...path, rttMs: request.oneWayLatencyMs + response.oneWayLatencyMs };
}

// ../8f1a24ac8c73/hopscotch/src/builder/nat.ts
function nodeById4(graph4, id2) {
  return graph4.nodes.find((node) => node.id === id2);
}
function linkById5(graph4, id2) {
  return graph4.links.find((link) => link.id === id2);
}
function primaryAddress3(addressing3, nodeId) {
  return interfacesForBuilderNode(addressing3, nodeId)[0]?.address ?? null;
}
function normalizePort(value, protocol, label) {
  if (protocol === "icmp") {
    if (value != null) throw new Error(`${label} must be empty for ICMP in the HOPSCOTCH teaching model.`);
    return null;
  }
  if (!Number.isInteger(value) || value == null || value < 1 || value > 65535) throw new Error(`${label} must be 1\u201365535 for TCP/UDP.`);
  return value;
}
function uniqueSorted2(values) {
  return [...new Set(values)].sort();
}
function createEmptyBuilderNatConfig() {
  return { boundaries: [], staticAddresses: [], staticMappings: [], patPortStart: 4e4, patPortEnd: 49999, sessionLifetime: 32 };
}
function createDefaultBuilderNatConfig(graph4 = { nodes: [], links: [] }) {
  const empty = createEmptyBuilderNatConfig();
  const edge = graph4.nodes.find((node) => node.id === "edge" && node.kind === "router");
  const inside = graph4.links.filter((link) => link.a === "edge" && link.b === "client" || link.b === "edge" && link.a === "client").map((link) => link.id);
  const outside = graph4.links.filter((link) => (link.a === "edge" || link.b === "edge") && !inside.includes(link.id)).map((link) => link.id);
  return {
    ...empty,
    boundaries: edge && inside.length > 0 && outside.length > 0 ? [{ id: "nat-edge", routerId: "edge", insideLinkIds: inside.sort(), outsideLinkIds: outside.sort(), overloadAddress: "198.51.100.10", enabled: true }] : []
  };
}
function cloneBuilderNatConfig(config) {
  return {
    boundaries: config.boundaries.map((boundary) => ({ ...boundary, insideLinkIds: [...boundary.insideLinkIds], outsideLinkIds: [...boundary.outsideLinkIds] })),
    staticAddresses: config.staticAddresses.map((mapping) => ({ ...mapping })),
    staticMappings: config.staticMappings.map((mapping) => ({ ...mapping })),
    patPortStart: config.patPortStart,
    patPortEnd: config.patPortEnd,
    sessionLifetime: config.sessionLifetime
  };
}
function pruneBuilderNatSessions(config, sessions, sequence) {
  if (!Number.isInteger(config.sessionLifetime) || config.sessionLifetime < 1) throw new Error("NAT session lifetime must be a positive integer.");
  return sessions.filter((session) => session.expiresAfterSequence == null || sequence <= session.expiresAfterSequence).map((session) => ({ ...session }));
}
function validateBuilderNatConfig(graph4, config, allowDetached = false) {
  if (!config || !Array.isArray(config.boundaries) || !Array.isArray(config.staticAddresses) || !Array.isArray(config.staticMappings)) throw new Error("NAT config requires boundary, static-address, and static-port arrays.");
  if (!Number.isInteger(config.patPortStart) || !Number.isInteger(config.patPortEnd) || config.patPortStart < 1024 || config.patPortEnd > 65535 || config.patPortStart > config.patPortEnd) throw new Error("PAT range must be an ordered 1024\u201365535 port interval.");
  if (!Number.isInteger(config.sessionLifetime) || config.sessionLifetime < 1 || config.sessionLifetime > 1e5) throw new Error("NAT session lifetime must be 1\u2013100000 sequence steps.");
  if (config.boundaries.length > 32) throw new Error("Builder NAT teaching model supports at most 32 boundaries.");
  if (config.staticAddresses.length > 128 || config.staticMappings.length > 128) throw new Error("Builder NAT teaching model supports at most 128 mappings of each static kind.");
  const boundaryIds = /* @__PURE__ */ new Set();
  const boundaries = config.boundaries.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`NAT boundary ${index + 1} is invalid.`);
    if (!/^[a-zA-Z0-9_-]+$/.test(raw.id) || boundaryIds.has(raw.id)) throw new Error(`NAT boundary id ${raw.id} is invalid or duplicated.`);
    const router = nodeById4(graph4, raw.routerId);
    if (!allowDetached && (!router || router.kind !== "router")) throw new Error(`NAT boundary ${raw.id} references a non-router.`);
    const insideLinkIds = uniqueSorted2(raw.insideLinkIds ?? []);
    const outsideLinkIds = uniqueSorted2(raw.outsideLinkIds ?? []);
    if (insideLinkIds.length === 0 || outsideLinkIds.length === 0) throw new Error(`NAT boundary ${raw.id} needs at least one inside and one outside link.`);
    if (insideLinkIds.some((id2) => outsideLinkIds.includes(id2))) throw new Error(`NAT boundary ${raw.id} cannot classify one link as both inside and outside.`);
    if (!allowDetached) {
      for (const linkId of [...insideLinkIds, ...outsideLinkIds]) {
        const link = linkById5(graph4, linkId);
        if (!link || link.a !== raw.routerId && link.b !== raw.routerId) throw new Error(`NAT boundary ${raw.id} link ${linkId} is not attached to ${raw.routerId}.`);
      }
    }
    const overloadAddress = normalizeBuilderIpv4(raw.overloadAddress);
    boundaryIds.add(raw.id);
    return { id: raw.id, routerId: raw.routerId, insideLinkIds, outsideLinkIds, overloadAddress, enabled: raw.enabled !== false };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const staticAddressIds = /* @__PURE__ */ new Set();
  const staticAddresses = config.staticAddresses.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Static one-to-one NAT mapping ${index + 1} is invalid.`);
    if (!/^[a-zA-Z0-9_-]+$/.test(raw.id) || staticAddressIds.has(raw.id)) throw new Error(`Static one-to-one NAT mapping id ${raw.id} is invalid or duplicated.`);
    const boundary = boundaries.find((candidate) => candidate.routerId === raw.routerId);
    if (!allowDetached && !boundary) throw new Error(`Static one-to-one NAT mapping ${raw.id} references a router without a NAT boundary.`);
    const insideAddress = normalizeBuilderIpv4(raw.insideAddress);
    const outsideAddress = normalizeBuilderIpv4(raw.outsideAddress);
    if (boundary && outsideAddress === boundary.overloadAddress) throw new Error(`Static one-to-one NAT mapping ${raw.id} cannot reuse the PAT overload address.`);
    staticAddressIds.add(raw.id);
    return { id: raw.id, routerId: raw.routerId, insideAddress, outsideAddress, description: String(raw.description ?? "").slice(0, 80) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.outsideAddress.localeCompare(b.outsideAddress) || a.id.localeCompare(b.id));
  const addressOutsideKeys = /* @__PURE__ */ new Set();
  const addressInsideKeys = /* @__PURE__ */ new Set();
  for (const mapping of staticAddresses) {
    const outsideKey = `${mapping.routerId}:${mapping.outsideAddress}`;
    const insideKey = `${mapping.routerId}:${mapping.insideAddress}`;
    if (addressOutsideKeys.has(outsideKey)) throw new Error(`Static NAT outside address ${mapping.outsideAddress} is duplicated on ${mapping.routerId}.`);
    if (addressInsideKeys.has(insideKey)) throw new Error(`Static NAT inside address ${mapping.insideAddress} has multiple one-to-one mappings on ${mapping.routerId}.`);
    addressOutsideKeys.add(outsideKey);
    addressInsideKeys.add(insideKey);
  }
  const mappingIds = /* @__PURE__ */ new Set();
  const staticMappings = config.staticMappings.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Static port mapping ${index + 1} is invalid.`);
    if (!/^[a-zA-Z0-9_-]+$/.test(raw.id) || mappingIds.has(raw.id)) throw new Error(`Static port mapping id ${raw.id} is invalid or duplicated.`);
    if (raw.protocol !== "tcp" && raw.protocol !== "udp") throw new Error(`Static port mapping ${raw.id} protocol must be TCP or UDP.`);
    const boundary = boundaries.find((candidate) => candidate.routerId === raw.routerId);
    if (!allowDetached && !boundary) throw new Error(`Static port mapping ${raw.id} references a router without a NAT boundary.`);
    const insideAddress = normalizeBuilderIpv4(raw.insideAddress);
    const outsideAddress = normalizeBuilderIpv4(raw.outsideAddress);
    const insidePort = normalizePort(Number(raw.insidePort), raw.protocol, `Static mapping ${raw.id} inside port`);
    const outsidePort = normalizePort(Number(raw.outsidePort), raw.protocol, `Static mapping ${raw.id} outside port`);
    mappingIds.add(raw.id);
    return { id: raw.id, routerId: raw.routerId, protocol: raw.protocol, insideAddress, insidePort, outsideAddress, outsidePort, description: String(raw.description ?? "").slice(0, 80) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.outsideAddress.localeCompare(b.outsideAddress) || a.outsidePort - b.outsidePort || a.id.localeCompare(b.id));
  const published = /* @__PURE__ */ new Set();
  for (const mapping of staticMappings) {
    const key2 = `${mapping.routerId}:${mapping.protocol}:${mapping.outsideAddress}:${mapping.outsidePort}`;
    if (published.has(key2)) throw new Error(`Static NAT outside tuple ${mapping.outsideAddress}:${mapping.outsidePort}/${mapping.protocol} is duplicated.`);
    published.add(key2);
  }
  return { boundaries, staticAddresses, staticMappings, patPortStart: config.patPortStart, patPortEnd: config.patPortEnd, sessionLifetime: config.sessionLifetime };
}
function stableHash2(text2) {
  let hash = 2166136261;
  for (let index = 0; index < text2.length; index += 1) {
    hash ^= text2.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
function translationKey(translation) {
  return `${translation.routerId}:${translation.protocol}:${translation.outsideAddress}:${translation.outsidePort ?? 0}:${translation.remoteAddress}:${translation.remotePort ?? 0}`;
}
function choosePatPort(config, sessions, seed) {
  const width = config.patPortEnd - config.patPortStart + 1;
  const used = new Set(sessions.filter((session) => session.kind === "pat").map((session) => session.outsidePort).filter((port) => port != null));
  const start = stableHash2(seed) % width;
  for (let offset = 0; offset < width; offset += 1) {
    const candidate = config.patPortStart + (start + offset) % width;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("PAT port pool is exhausted.");
}
function pathBoundary(graph4, forwarding, config, direction) {
  const enabled = config.boundaries.filter((boundary) => boundary.enabled);
  for (let index = 0; index < forwarding.hops.length; index += 1) {
    const hop = forwarding.hops[index];
    const node = nodeById4(graph4, hop.nodeId);
    if (!node || node.kind !== "router") continue;
    const incomingLinkId = index > 0 ? forwarding.hops[index - 1].linkId : null;
    const outgoingLinkId = hop.linkId;
    const boundary = enabled.find((candidate) => {
      if (candidate.routerId !== hop.nodeId || !incomingLinkId || !outgoingLinkId) return false;
      return direction === "outbound" ? candidate.insideLinkIds.includes(incomingLinkId) && candidate.outsideLinkIds.includes(outgoingLinkId) : candidate.outsideLinkIds.includes(incomingLinkId) && candidate.insideLinkIds.includes(outgoingLinkId);
    });
    if (boundary) return boundary;
  }
  return null;
}
function ownerNodeForAddress(graph4, addressing3, address2) {
  for (const node of graph4.nodes) if (interfacesForBuilderNode(addressing3, node.id).some((entry) => entry.address === address2)) return node.id;
  return null;
}
function sessionForOutbound(config, sessions, boundary, tuple, sequence) {
  const active = pruneBuilderNatSessions(config, sessions, sequence);
  const existing = active.find((session) => session.kind === "pat" && session.routerId === boundary.routerId && session.protocol === tuple.protocol && session.insideAddress === tuple.sourceAddress && session.insidePort === tuple.sourcePort && session.remoteAddress === tuple.destinationAddress && session.remotePort === tuple.destinationPort);
  if (existing) {
    const refreshed = { ...existing, lastUsedSequence: sequence, expiresAfterSequence: sequence + config.sessionLifetime };
    return { translation: refreshed, sessions: [...active.filter((session) => session.id !== existing.id), refreshed].sort((a, b) => translationKey(a).localeCompare(translationKey(b))) };
  }
  const outsidePort = tuple.protocol === "icmp" ? null : choosePatPort(config, active, `${boundary.id}:${tuple.protocol}:${tuple.sourceAddress}:${tuple.sourcePort}:${tuple.destinationAddress}:${tuple.destinationPort}`);
  const translation = {
    id: `nat:${boundary.id}:${sequence}:${stableHash2(`${tuple.protocol}:${tuple.sourceAddress}:${tuple.sourcePort}:${tuple.destinationAddress}:${tuple.destinationPort}`).toString(16)}`,
    kind: "pat",
    routerId: boundary.routerId,
    protocol: tuple.protocol,
    insideAddress: tuple.sourceAddress,
    insidePort: tuple.sourcePort,
    outsideAddress: boundary.overloadAddress,
    outsidePort,
    remoteAddress: tuple.destinationAddress,
    remotePort: tuple.destinationPort,
    createdSequence: sequence,
    lastUsedSequence: sequence,
    expiresAfterSequence: sequence + config.sessionLifetime
  };
  return { translation, sessions: [...active, translation].sort((a, b) => translationKey(a).localeCompare(translationKey(b))) };
}
function staticPortTranslation(mapping, remoteAddress, remotePort, sequence) {
  return {
    id: `static-port:${mapping.id}`,
    kind: "static-port",
    routerId: mapping.routerId,
    protocol: mapping.protocol,
    insideAddress: mapping.insideAddress,
    insidePort: mapping.insidePort,
    outsideAddress: mapping.outsideAddress,
    outsidePort: mapping.outsidePort,
    remoteAddress,
    remotePort,
    createdSequence: sequence,
    lastUsedSequence: sequence,
    expiresAfterSequence: null
  };
}
function staticAddressTranslation(mapping, tuple, sequence) {
  return {
    id: `static-address:${mapping.id}`,
    kind: "static-address",
    routerId: mapping.routerId,
    protocol: tuple.protocol,
    insideAddress: mapping.insideAddress,
    insidePort: tuple.sourcePort,
    outsideAddress: mapping.outsideAddress,
    outsidePort: tuple.sourcePort,
    remoteAddress: tuple.destinationAddress,
    remotePort: tuple.destinationPort,
    createdSequence: sequence,
    lastUsedSequence: sequence,
    expiresAfterSequence: null
  };
}
function policyForNatPath(graph4, aclInput, forwarding, boundary, originalTuple, translatedTuple) {
  const acl2 = validateBuilderAclConfig(graph4, aclInput);
  const stages = [];
  let translated = false;
  for (const hop of forwarding.hops) {
    if (nodeById4(graph4, hop.nodeId)?.kind !== "router") continue;
    if (hop.nodeId === boundary.routerId) {
      const preDecision = evaluateBuilderAclAtRouter(acl2, hop.nodeId, originalTuple.sourceAddress, originalTuple.destinationAddress, originalTuple.protocol, originalTuple.destinationPort);
      stages.push({ phase: "pre-nat", routerId: hop.nodeId, tuple: { ...originalTuple }, decision: preDecision, boundary: true });
      if (preDecision.action === "deny") return { permitted: false, stages, deniedAtRouterId: hop.nodeId, reason: `${nodeById4(graph4, hop.nodeId)?.label ?? hop.nodeId} denied the pre-NAT tuple by ${preDecision.ruleId ?? "default policy"}: ${preDecision.ruleDescription}.` };
      const postDecision = evaluateBuilderAclAtRouter(acl2, hop.nodeId, translatedTuple.sourceAddress, translatedTuple.destinationAddress, translatedTuple.protocol, translatedTuple.destinationPort);
      stages.push({ phase: "post-nat", routerId: hop.nodeId, tuple: { ...translatedTuple }, decision: postDecision, boundary: true });
      if (postDecision.action === "deny") return { permitted: false, stages, deniedAtRouterId: hop.nodeId, reason: `${nodeById4(graph4, hop.nodeId)?.label ?? hop.nodeId} denied the post-NAT tuple by ${postDecision.ruleId ?? "default policy"}: ${postDecision.ruleDescription}.` };
      translated = true;
      continue;
    }
    const tuple = translated ? translatedTuple : originalTuple;
    const decision = evaluateBuilderAclAtRouter(acl2, hop.nodeId, tuple.sourceAddress, tuple.destinationAddress, tuple.protocol, tuple.destinationPort);
    stages.push({ phase: translated ? "post-nat" : "pre-nat", routerId: hop.nodeId, tuple: { ...tuple }, decision, boundary: false });
    if (decision.action === "deny") return { permitted: false, stages, deniedAtRouterId: hop.nodeId, reason: `${nodeById4(graph4, hop.nodeId)?.label ?? hop.nodeId} denied the ${translated ? "post-NAT" : "pre-NAT"} tuple by ${decision.ruleId ?? "default policy"}: ${decision.ruleDescription}.` };
  }
  return { permitted: true, stages, deniedAtRouterId: null, reason: null };
}
function noBoundaryPolicy(graph4, aclInput, forwarding, tuple) {
  const acl2 = validateBuilderAclConfig(graph4, aclInput);
  const stages = [];
  for (const hop of forwarding.hops) {
    if (nodeById4(graph4, hop.nodeId)?.kind !== "router") continue;
    const decision = evaluateBuilderAclAtRouter(acl2, hop.nodeId, tuple.sourceAddress, tuple.destinationAddress, tuple.protocol, tuple.destinationPort);
    stages.push({ phase: "pre-nat", routerId: hop.nodeId, tuple: { ...tuple }, decision, boundary: false });
    if (decision.action === "deny") return { permitted: false, stages, deniedAtRouterId: hop.nodeId, reason: `${nodeById4(graph4, hop.nodeId)?.label ?? hop.nodeId} denied the untranslated tuple by ${decision.ruleId ?? "default policy"}: ${decision.ruleDescription}.` };
  }
  return { permitted: true, stages, deniedAtRouterId: null, reason: null };
}
function failedResult(direction, forwarding, originalTuple, sessions, failureReason, explanation, extra = {}) {
  return {
    direction,
    success: false,
    forwarding,
    boundaryId: null,
    routerId: null,
    originalTuple,
    translatedTuple: null,
    translation: null,
    sessions,
    policyStages: [],
    policyPermitted: true,
    deniedAtRouterId: null,
    failureReason,
    explanation,
    ...extra
  };
}
function runBuilderNatOutboundFlow(graph4, addressing3, routing3, configInput, sessionsInput, sourceNodeId, destinationNodeId, protocol, sourcePort, destinationPort, sequence = 1, aclInput = createDefaultBuilderAclConfig()) {
  const config = validateBuilderNatConfig(graph4, configInput);
  const sourceAddress = primaryAddress3(addressing3, sourceNodeId);
  const destinationAddress = primaryAddress3(addressing3, destinationNodeId);
  if (!sourceAddress || !destinationAddress) throw new Error("NAT flow endpoints require IPv4 interfaces.");
  const normalizedSourcePort = normalizePort(sourcePort, protocol, "Source port");
  const normalizedDestinationPort = normalizePort(destinationPort, protocol, "Destination port");
  const originalTuple = { sourceAddress, sourcePort: normalizedSourcePort, destinationAddress, destinationPort: normalizedDestinationPort, protocol };
  const forwarding = traceBuilderForwarding(graph4, addressing3, routing3, sourceNodeId, destinationNodeId);
  const sessions = pruneBuilderNatSessions(config, sessionsInput, sequence);
  if (!forwarding.reachable) return failedResult("outbound", forwarding, originalTuple, sessions, forwarding.failureReason ?? "ROUTING FAILED", `Routing failed before NAT: ${forwarding.failureReason ?? "unreachable"}.`);
  const boundary = pathBoundary(graph4, forwarding, config, "outbound");
  if (!boundary) {
    const policy2 = noBoundaryPolicy(graph4, aclInput, forwarding, originalTuple);
    if (!policy2.permitted) return failedResult("outbound", forwarding, originalTuple, sessions, "ACL DENY", policy2.reason ?? "ACL denied untranslated flow.", { policyStages: policy2.stages, policyPermitted: false, deniedAtRouterId: policy2.deniedAtRouterId });
    return { direction: "outbound", success: true, forwarding, boundaryId: null, routerId: null, originalTuple, translatedTuple: originalTuple, translation: null, sessions, policyStages: policy2.stages, policyPermitted: true, deniedAtRouterId: null, failureReason: null, explanation: "Forwarding crosses no configured inside\u2192outside NAT boundary; the tuple is unchanged." };
  }
  const staticAddress = config.staticAddresses.find((mapping) => mapping.routerId === boundary.routerId && mapping.insideAddress === originalTuple.sourceAddress);
  let translation;
  let nextSessions = sessions;
  if (staticAddress) {
    translation = staticAddressTranslation(staticAddress, originalTuple, sequence);
  } else {
    try {
      const sessionResult = sessionForOutbound(config, sessions, boundary, originalTuple, sequence);
      translation = sessionResult.translation;
      nextSessions = sessionResult.sessions;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "PAT allocation failed.";
      return failedResult("outbound", forwarding, originalTuple, sessions, "PAT ALLOCATION FAILED", reason, { boundaryId: boundary.id, routerId: boundary.routerId });
    }
  }
  const translatedTuple = { ...originalTuple, sourceAddress: translation.outsideAddress, sourcePort: translation.outsidePort };
  const policy = policyForNatPath(graph4, aclInput, forwarding, boundary, originalTuple, translatedTuple);
  if (!policy.permitted) return failedResult("outbound", forwarding, originalTuple, nextSessions, "ACL DENY", policy.reason ?? "ACL denied translated flow.", { boundaryId: boundary.id, routerId: boundary.routerId, translatedTuple, translation, policyStages: policy.stages, policyPermitted: false, deniedAtRouterId: policy.deniedAtRouterId });
  const kindLabel = translation.kind === "pat" ? "PAT" : "STATIC 1:1";
  return { direction: "outbound", success: true, forwarding, boundaryId: boundary.id, routerId: boundary.routerId, originalTuple, translatedTuple, translation, sessions: nextSessions, policyStages: policy.stages, policyPermitted: true, deniedAtRouterId: null, failureReason: null, explanation: `${nodeById4(graph4, boundary.routerId)?.label ?? boundary.routerId} ${kindLabel} translates ${originalTuple.sourceAddress}${originalTuple.sourcePort == null ? "" : `:${originalTuple.sourcePort}`} \u2192 ${translatedTuple.sourceAddress}${translatedTuple.sourcePort == null ? "" : `:${translatedTuple.sourcePort}`}; remote destination is unchanged.` };
}
function translationForInbound(config, sessions, tuple, sequence) {
  const dynamic = sessions.find((session) => session.protocol === tuple.protocol && session.outsideAddress === tuple.destinationAddress && session.outsidePort === tuple.destinationPort && session.remoteAddress === tuple.sourceAddress && session.remotePort === tuple.sourcePort);
  if (dynamic) return dynamic;
  if (tuple.protocol !== "icmp") {
    const portMapping = config.staticMappings.find((candidate) => candidate.protocol === tuple.protocol && candidate.outsideAddress === tuple.destinationAddress && candidate.outsidePort === tuple.destinationPort);
    if (portMapping) return staticPortTranslation(portMapping, tuple.sourceAddress, tuple.sourcePort, sequence);
  }
  const addressMapping = config.staticAddresses.find((candidate) => candidate.outsideAddress === tuple.destinationAddress);
  if (addressMapping) {
    return {
      id: `static-address:${addressMapping.id}`,
      kind: "static-address",
      routerId: addressMapping.routerId,
      protocol: tuple.protocol,
      insideAddress: addressMapping.insideAddress,
      insidePort: tuple.destinationPort,
      outsideAddress: addressMapping.outsideAddress,
      outsidePort: tuple.destinationPort,
      remoteAddress: tuple.sourceAddress,
      remotePort: tuple.sourcePort,
      createdSequence: sequence,
      lastUsedSequence: sequence,
      expiresAfterSequence: null
    };
  }
  return null;
}
function runBuilderNatInboundFlow(graph4, addressing3, routing3, configInput, sessionsInput, outsideSourceNodeId, outsideDestinationAddress, protocol, sourcePort, destinationPort, sequence = 1, aclInput = createDefaultBuilderAclConfig()) {
  const config = validateBuilderNatConfig(graph4, configInput);
  const sourceAddress = primaryAddress3(addressing3, outsideSourceNodeId);
  if (!sourceAddress) throw new Error("Inbound NAT source node requires an IPv4 interface.");
  const normalizedOutsideAddress = normalizeBuilderIpv4(outsideDestinationAddress);
  const normalizedSourcePort = normalizePort(sourcePort, protocol, "Source port");
  const normalizedDestinationPort = normalizePort(destinationPort, protocol, "Destination port");
  const originalTuple = { sourceAddress, sourcePort: normalizedSourcePort, destinationAddress: normalizedOutsideAddress, destinationPort: normalizedDestinationPort, protocol };
  const active = pruneBuilderNatSessions(config, sessionsInput, sequence);
  const translation = translationForInbound(config, active, originalTuple, sequence);
  if (!translation) return failedResult("inbound", null, originalTuple, active, "NO NAT MAPPING", `Unsolicited inbound ${protocol.toUpperCase()} to ${normalizedOutsideAddress}${normalizedDestinationPort == null ? "" : `:${normalizedDestinationPort}`} has no active PAT session, static port mapping, or static one-to-one address mapping.`);
  const insideNodeId = ownerNodeForAddress(graph4, addressing3, translation.insideAddress);
  if (!insideNodeId) return failedResult("inbound", null, originalTuple, active, "INSIDE ADDRESS HAS NO DEVICE", `NAT maps to ${translation.insideAddress}, but no Builder device owns that IPv4 address.`, { routerId: translation.routerId, translation });
  const forwarding = traceBuilderForwarding(graph4, addressing3, routing3, outsideSourceNodeId, insideNodeId);
  const boundary = pathBoundary(graph4, forwarding, config, "inbound");
  if (!forwarding.reachable) return failedResult("inbound", forwarding, originalTuple, active, forwarding.failureReason ?? "INSIDE FORWARDING FAILED", `NAT mapping exists, but translated inside forwarding fails: ${forwarding.failureReason ?? "unreachable"}.`, { routerId: translation.routerId, translation });
  if (!boundary || boundary.routerId !== translation.routerId) return failedResult("inbound", forwarding, originalTuple, active, "NAT BOUNDARY NOT ON RETURN PATH", "A mapping exists, but the current outside\u2192inside forwarding path does not cross the configured NAT boundary in the outside\u2192inside direction.", { boundaryId: boundary?.id ?? null, routerId: translation.routerId, translation });
  const translatedTuple = { ...originalTuple, destinationAddress: translation.insideAddress, destinationPort: translation.insidePort };
  const policy = policyForNatPath(graph4, aclInput, forwarding, boundary, originalTuple, translatedTuple);
  if (!policy.permitted) return failedResult("inbound", forwarding, originalTuple, active, "ACL DENY", policy.reason ?? "ACL denied translated inbound flow.", { boundaryId: boundary.id, routerId: boundary.routerId, translatedTuple, translation, policyStages: policy.stages, policyPermitted: false, deniedAtRouterId: policy.deniedAtRouterId });
  const refreshed = translation.kind === "pat" ? { ...translation, lastUsedSequence: sequence, expiresAfterSequence: sequence + config.sessionLifetime } : translation;
  const sessions = translation.kind === "pat" ? [...active.filter((session) => session.id !== translation.id), refreshed].sort((a, b) => translationKey(a).localeCompare(translationKey(b))) : active;
  const kindLabel = translation.kind === "pat" ? "active PAT state" : translation.kind === "static-port" ? "static port forwarding" : "static one-to-one NAT";
  return { direction: "inbound", success: true, forwarding, boundaryId: boundary.id, routerId: boundary.routerId, originalTuple, translatedTuple, translation: refreshed, sessions, policyStages: policy.stages, policyPermitted: true, deniedAtRouterId: null, failureReason: null, explanation: `${nodeById4(graph4, boundary.routerId)?.label ?? boundary.routerId} matches ${kindLabel} and translates destination ${originalTuple.destinationAddress}${originalTuple.destinationPort == null ? "" : `:${originalTuple.destinationPort}`} \u2192 ${translatedTuple.destinationAddress}${translatedTuple.destinationPort == null ? "" : `:${translatedTuple.destinationPort}`}.` };
}
function runBuilderNatRelatedIcmpInbound(graph4, addressing3, routing3, configInput, sessionsInput, outsideSourceNodeId, relatedTranslationId, sequence = 1, aclInput = createDefaultBuilderAclConfig()) {
  const config = validateBuilderNatConfig(graph4, configInput);
  const active = pruneBuilderNatSessions(config, sessionsInput, sequence);
  const related = active.find((session) => session.id === relatedTranslationId);
  const sourceAddress = primaryAddress3(addressing3, outsideSourceNodeId);
  if (!sourceAddress) throw new Error("Related ICMP source requires an IPv4 interface.");
  const originalTuple = { sourceAddress, sourcePort: null, destinationAddress: related?.outsideAddress ?? "0.0.0.0", destinationPort: null, protocol: "icmp" };
  if (!related) return failedResult("inbound", null, originalTuple, active, "NO RELATED NAT STATE", "ICMP error cannot be translated because the quoted outbound transaction no longer has active NAT state.");
  const insideNodeId = ownerNodeForAddress(graph4, addressing3, related.insideAddress);
  if (!insideNodeId) return failedResult("inbound", null, originalTuple, active, "INSIDE ADDRESS HAS NO DEVICE", `Related NAT state points to ${related.insideAddress}, but no Builder device owns that address.`, { translation: related, routerId: related.routerId });
  const forwarding = traceBuilderForwarding(graph4, addressing3, routing3, outsideSourceNodeId, insideNodeId);
  const boundary = pathBoundary(graph4, forwarding, config, "inbound");
  if (!forwarding.reachable || !boundary || boundary.routerId !== related.routerId) return failedResult("inbound", forwarding, originalTuple, active, forwarding.failureReason ?? "NAT BOUNDARY NOT ON RETURN PATH", forwarding.failureReason ? `Related ICMP error has NAT state, but translated inside forwarding fails: ${forwarding.failureReason}.` : "Related ICMP error has NAT state, but the translated path does not cross the expected NAT boundary.", { translation: related, routerId: related.routerId, boundaryId: boundary?.id ?? null });
  const translatedTuple = { ...originalTuple, destinationAddress: related.insideAddress };
  const policy = policyForNatPath(graph4, aclInput, forwarding, boundary, originalTuple, translatedTuple);
  if (!policy.permitted) return failedResult("inbound", forwarding, originalTuple, active, "ACL DENY", policy.reason ?? "ACL denied related ICMP.", { boundaryId: boundary.id, routerId: boundary.routerId, translatedTuple, translation: related, policyStages: policy.stages, policyPermitted: false, deniedAtRouterId: policy.deniedAtRouterId });
  const refreshed = related.kind === "pat" ? { ...related, lastUsedSequence: sequence, expiresAfterSequence: sequence + config.sessionLifetime } : related;
  const sessions = related.kind === "pat" ? [...active.filter((session) => session.id !== related.id), refreshed].sort((a, b) => translationKey(a).localeCompare(translationKey(b))) : active;
  return { direction: "inbound", success: true, forwarding, boundaryId: boundary.id, routerId: boundary.routerId, originalTuple, translatedTuple, translation: refreshed, sessions, policyStages: policy.stages, policyPermitted: true, deniedAtRouterId: null, failureReason: null, explanation: `${nodeById4(graph4, boundary.routerId)?.label ?? boundary.routerId} recognizes ICMP as related to ${related.id} and translates the quoted NAT destination back to ${related.insideAddress}.` };
}

// ../8f1a24ac8c73/hopscotch/src/builder/probes.ts
var PROBE_PACKET_BYTES = 84;
function nodeLabel(graph4, nodeId) {
  return graph4.nodes.find((node) => node.id === nodeId)?.label ?? nodeId.toUpperCase();
}
function nodePath(trace2) {
  return [trace2.sourceNodeId, ...trace2.hops.map((hop) => hop.nextNodeId).filter((id2) => Boolean(id2))].filter((id2, index, all) => index === 0 || id2 !== all[index - 1]);
}
function linkPath(trace2) {
  return trace2.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []);
}
function primaryAddress4(addressing3, nodeId) {
  return interfacesForBuilderNode(addressing3, nodeId)[0]?.address ?? null;
}
function inboundAddress(addressing3, nodeId, linkId) {
  if (!linkId) return primaryAddress4(addressing3, nodeId);
  return addressing3.segments[linkId]?.interfaces.find((entry) => entry.nodeId === nodeId)?.address ?? primaryAddress4(addressing3, nodeId);
}
function stableMac2(nodeId, salt = "") {
  const text2 = `${nodeId}:${salt}`;
  let hash = 2166136261;
  for (let index = 0; index < text2.length; index += 1) {
    hash ^= text2.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return [2, 72, 79, hash >>> 16 & 255, hash >>> 8 & 255, hash & 255].map((byte) => byte.toString(16).padStart(2, "0")).join(":");
}
function packetSeed(id2, label, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, ttl) {
  if (!sourceAddress || !destinationAddress) return null;
  return { id: id2, label, family: "ipv4", sourceAddress, destinationAddress, sourceMac: stableMac2(sourceNodeId, "probe"), destinationMac: stableMac2(destinationNodeId, "probe"), ttl };
}
function metrics(profiles2, requestLinkIds, responseLinkIds, hasResponse) {
  const path = builderPathCharacteristics(profiles2, [...requestLinkIds, ...responseLinkIds]);
  const round = builderRoundTripCharacteristics(profiles2, requestLinkIds, responseLinkIds);
  return { simulatedRttMs: hasResponse ? Number(round.rttMs.toFixed(2)) : null, jitterMs: Number(path.jitterMs.toFixed(2)), bottleneckMbps: path.bottleneckMbps, pathMtuBytes: path.pathMtuBytes, pathLossPercent: Number(path.lossPercent.toFixed(4)) };
}
function natNote(request, response) {
  if (!request?.translation && !response?.translation) return null;
  const parts = [];
  if (request?.translation) parts.push(`${request.translation.kind.toUpperCase()} ${request.originalTuple.sourceAddress} \u2192 ${request.translatedTuple?.sourceAddress}`);
  if (response?.translation) parts.push(`RETURN ${response.originalTuple.destinationAddress} \u2192 ${response.translatedTuple?.destinationAddress}`);
  return parts.join(" \xB7 ");
}
function runPing(graph4, addressing3, routing3, sourceNodeId, destinationNodeId, sequence, profiles2, acl2, nat2, natSessions) {
  const natEnabled = nat2.boundaries.some((boundary) => boundary.enabled);
  const ordinaryRequestPolicy = natEnabled ? null : traceBuilderPolicy(graph4, addressing3, routing3, acl2, sourceNodeId, destinationNodeId, "icmp", null, `icmp|${sourceNodeId}|${destinationNodeId}|${sequence}|request`);
  const natRequest = natEnabled ? runBuilderNatOutboundFlow(graph4, addressing3, routing3, nat2, natSessions, sourceNodeId, destinationNodeId, "icmp", null, null, sequence, acl2) : null;
  const request = natRequest?.forwarding ?? ordinaryRequestPolicy?.forwarding ?? traceBuilderForwarding(graph4, addressing3, routing3, sourceNodeId, destinationNodeId, graph4, `icmp|${sourceNodeId}|${destinationNodeId}|${sequence}|request`);
  let workingSessions = natRequest?.sessions ?? natSessions;
  const sourceAddress = primaryAddress4(addressing3, sourceNodeId);
  const destinationAddress = request.destinationAddress ?? primaryAddress4(addressing3, destinationNodeId);
  let reply = null;
  let natReply = null;
  let status = "unreachable";
  let responderNodeId = null;
  let detail = "";
  let dropLinkId = null;
  const requestLinks = linkPath(request);
  const requestPhysical = builderPathCharacteristics(profiles2, requestLinks);
  if (!request.reachable) {
    status = "unreachable";
    responderNodeId = request.failureNodeId;
    detail = request.failureReason ?? "Forward request could not be delivered.";
  } else if (natRequest && !natRequest.success) {
    status = "unreachable";
    responderNodeId = natRequest.deniedAtRouterId ?? natRequest.routerId;
    detail = `NAT / policy stopped the Echo Request: ${natRequest.explanation}`;
  } else if (ordinaryRequestPolicy && !ordinaryRequestPolicy.permitted) {
    status = "unreachable";
    responderNodeId = ordinaryRequestPolicy.deniedAtRouterId;
    detail = `ACL / firewall policy denied the Echo Request: ${ordinaryRequestPolicy.explanation}`;
  } else if ((requestPhysical.pathMtuBytes ?? PROBE_PACKET_BYTES) < PROBE_PACKET_BYTES) {
    status = "unreachable";
    responderNodeId = request.hops.find((hop) => profiles2[hop.linkId ?? ""]?.mtuBytes < PROBE_PACKET_BYTES)?.nodeId ?? sourceNodeId;
    detail = `DF teaching probe is ${PROBE_PACKET_BYTES} bytes but path MTU is ${requestPhysical.pathMtuBytes}. Fragmentation is not fabricated.`;
  } else if (dropLinkId = deterministicBuilderPathDrop(profiles2, requestLinks, `ping:${sequence}:request`)) {
    status = "timeout";
    responderNodeId = null;
    detail = `Echo Request was deterministically dropped on ${dropLinkId}; route, policy, and translation state were otherwise valid.`;
  } else {
    if (natRequest?.translation) {
      natReply = runBuilderNatInboundFlow(graph4, addressing3, routing3, nat2, workingSessions, destinationNodeId, natRequest.translation.outsideAddress, "icmp", null, null, sequence + 1, acl2);
      reply = natReply.forwarding;
      workingSessions = natReply.sessions;
    } else {
      const replyPolicy = traceBuilderPolicy(graph4, addressing3, routing3, acl2, destinationNodeId, sourceNodeId, "icmp", null, `icmp|${destinationNodeId}|${sourceNodeId}|${sequence}|reply`);
      reply = replyPolicy.forwarding;
      if (!reply.reachable) {
        status = "timeout";
        responderNodeId = destinationNodeId;
        detail = `Echo Request reached ${nodeLabel(graph4, destinationNodeId)}, but the Echo Reply cannot return: ${reply.failureReason ?? "reverse path unavailable"}.`;
      } else if (!replyPolicy.permitted) {
        status = "timeout";
        responderNodeId = destinationNodeId;
        detail = `Echo Request arrived, but reverse ACL / firewall policy denied the Echo Reply: ${replyPolicy.explanation}`;
      }
    }
    if (status !== "timeout") {
      const responseLinks2 = reply ? linkPath(reply) : [];
      if (natReply && !natReply.success) {
        status = "timeout";
        responderNodeId = destinationNodeId;
        detail = `Echo Request arrived, but NAT / reverse policy cannot deliver the Echo Reply: ${natReply.explanation}`;
      } else if (!reply || !reply.reachable) {
        status = "timeout";
        responderNodeId = destinationNodeId;
        detail = `Echo Request reached ${nodeLabel(graph4, destinationNodeId)}, but the Echo Reply has no usable reverse path.`;
      } else if (dropLinkId = deterministicBuilderPathDrop(profiles2, responseLinks2, `ping:${sequence}:reply`)) {
        status = "timeout";
        responderNodeId = destinationNodeId;
        detail = `Echo Reply was deterministically dropped on ${dropLinkId}.`;
      } else {
        status = "echo-reply";
        responderNodeId = destinationNodeId;
        detail = natRequest?.translation ? "ICMP Echo Request crossed the NAT boundary, reverse translation matched the same state, and both directions pass policy/MTU/loss checks." : "ICMP Echo Request and Echo Reply both pass forwarding, policy, MTU, and deterministic link-loss checks.";
      }
    }
  }
  const responseLinks = reply ? linkPath(reply) : [];
  const m = metrics(profiles2, requestLinks, responseLinks, status === "echo-reply");
  const attempt = { index: 0, ttl: 64, status, responderNodeId, responderAddress: responderNodeId ? primaryAddress4(addressing3, responderNodeId) : null, requestNodeIds: nodePath(request), requestLinkIds: requestLinks, responseNodeIds: reply ? nodePath(reply) : [], responseLinkIds: responseLinks, detail, packet: packetSeed(`probe-${sequence}-echo`, "ICMP ECHO REQUEST", sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, 64), ...m, dropLinkId, natDetail: natNote(natRequest, natReply) };
  return { id: `probe-${sequence}-ping`, sequence, kind: "ping", plane: "ROUTED IPV4", sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, success: status === "echo-reply", attempts: [attempt], summary: status === "echo-reply" ? `${nodeLabel(graph4, destinationNodeId)} replied \xB7 simulated RTT ${m.simulatedRttMs} ms \xB7 path MTU ${m.pathMtuBytes}${natRequest?.translation ? " \xB7 NAT state matched" : ""}.` : status === "timeout" ? "Request/reply forwarding exists only partially; translation, policy, or link behavior prevented a returning Echo Reply." : `${nodeLabel(graph4, responderNodeId ?? request.failureNodeId ?? sourceNodeId)} stopped the Echo Request.`, snapshotNote: "Probe history is session-only. RTT comes from explicit link latency, never OSPF cost. NAT-aware Ping consumes the same translation/session engine as Builder flows.", natApplied: Boolean(natRequest?.translation), natTranslationId: natRequest?.translation?.id ?? null, natSessions: workingSessions };
}
function runTraceroute(graph4, addressing3, routing3, sourceNodeId, destinationNodeId, sequence, profiles2, acl2, nat2, natSessions) {
  const natEnabled = nat2.boundaries.some((boundary) => boundary.enabled);
  const fullPolicy = natEnabled ? null : traceBuilderPolicy(graph4, addressing3, routing3, acl2, sourceNodeId, destinationNodeId, "icmp", null, `icmp|${sourceNodeId}|${destinationNodeId}|${sequence}|request`);
  const natRequest = natEnabled ? runBuilderNatOutboundFlow(graph4, addressing3, routing3, nat2, natSessions, sourceNodeId, destinationNodeId, "icmp", null, null, sequence, acl2) : null;
  const forward = natRequest?.forwarding ?? fullPolicy?.forwarding ?? traceBuilderForwarding(graph4, addressing3, routing3, sourceNodeId, destinationNodeId, graph4, `icmp|${sourceNodeId}|${destinationNodeId}|${sequence}|request`);
  let workingSessions = natRequest?.sessions ?? natSessions;
  const sourceAddress = primaryAddress4(addressing3, sourceNodeId);
  const destinationAddress = forward.destinationAddress ?? primaryAddress4(addressing3, destinationNodeId);
  const nodes = nodePath(forward);
  const links = linkPath(forward);
  const attempts = [];
  let ttl = 1;
  let terminal = false;
  const natBoundaryRouterId = natRequest?.routerId ?? null;
  const boundaryNodeIndex = natBoundaryRouterId ? nodes.indexOf(natBoundaryRouterId) : -1;
  for (let nodeIndex = 1; nodeIndex < nodes.length; nodeIndex += 1) {
    const nodeId = nodes[nodeIndex];
    const node = graph4.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.kind !== "router") continue;
    const requestLinks = links.slice(0, nodeIndex);
    const packet2 = packetSeed(`probe-${sequence}-ttl-${ttl}`, `ICMP TRACE TTL ${ttl}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, ttl);
    const physical = builderPathCharacteristics(profiles2, requestLinks);
    const deniedHere = (natRequest?.deniedAtRouterId ?? fullPolicy?.deniedAtRouterId) === nodeId;
    const natHardFailureHere = Boolean(natRequest && !natRequest.success && !natRequest.deniedAtRouterId && natRequest.routerId === nodeId);
    if (deniedHere || natHardFailureHere) {
      const m2 = metrics(profiles2, requestLinks, [], false);
      const why2 = natRequest?.explanation ?? fullPolicy?.explanation ?? "policy denied";
      attempts.push({ index: attempts.length, ttl, status: "unreachable", responderNodeId: nodeId, responderAddress: inboundAddress(addressing3, nodeId, links[nodeIndex - 1]), requestNodeIds: nodes.slice(0, nodeIndex + 1), requestLinkIds: requestLinks, responseNodeIds: [], responseLinkIds: [], detail: `${nodeLabel(graph4, nodeId)} stops the TTL-${ttl} probe: ${why2}`, packet: packet2, ...m2, dropLinkId: null, natDetail: natNote(natRequest, null) });
      terminal = true;
      break;
    }
    if ((physical.pathMtuBytes ?? PROBE_PACKET_BYTES) < PROBE_PACKET_BYTES) {
      const m2 = metrics(profiles2, requestLinks, [], false);
      attempts.push({ index: attempts.length, ttl, status: "unreachable", responderNodeId: nodeId, responderAddress: inboundAddress(addressing3, nodeId, links[nodeIndex - 1]), requestNodeIds: nodes.slice(0, nodeIndex + 1), requestLinkIds: requestLinks, responseNodeIds: [], responseLinkIds: [], detail: `DF traceroute probe exceeds path MTU ${physical.pathMtuBytes}.`, packet: packet2, ...m2, dropLinkId: null, natDetail: natNote(natRequest, null) });
      terminal = true;
      break;
    }
    const requestDrop = deterministicBuilderPathDrop(profiles2, requestLinks, `trace:${sequence}:${ttl}:request`);
    if (requestDrop) {
      const m2 = metrics(profiles2, requestLinks, [], false);
      attempts.push({ index: attempts.length, ttl, status: "timeout", responderNodeId: null, responderAddress: null, requestNodeIds: nodes.slice(0, nodeIndex + 1), requestLinkIds: requestLinks, responseNodeIds: [], responseLinkIds: [], detail: `TTL-${ttl} probe was dropped on ${requestDrop}.`, packet: packet2, ...m2, dropLinkId: requestDrop, natDetail: natNote(natRequest, null) });
      ttl += 1;
      continue;
    }
    let response;
    let responsePermitted = true;
    let responseExplanation = "";
    let natResponse = null;
    if (natRequest?.translation && boundaryNodeIndex >= 0 && nodeIndex > boundaryNodeIndex) {
      natResponse = natRequest.translation.kind === "pat" ? runBuilderNatRelatedIcmpInbound(graph4, addressing3, routing3, nat2, workingSessions, nodeId, natRequest.translation.id, sequence + ttl, acl2) : runBuilderNatInboundFlow(graph4, addressing3, routing3, nat2, workingSessions, nodeId, natRequest.translation.outsideAddress, "icmp", null, null, sequence + ttl, acl2);
      response = natResponse.forwarding ?? traceBuilderForwarding(graph4, addressing3, routing3, nodeId, sourceNodeId, graph4, `icmp|${nodeId}|${sourceNodeId}|${sequence}|ttl-${ttl}-reply`);
      responsePermitted = natResponse.success;
      responseExplanation = natResponse.explanation;
      workingSessions = natResponse.sessions;
    } else {
      const responsePolicy = traceBuilderPolicy(graph4, addressing3, routing3, acl2, nodeId, sourceNodeId, "icmp", null, `icmp|${nodeId}|${sourceNodeId}|${sequence}|ttl-${ttl}-reply`);
      response = responsePolicy.forwarding;
      responsePermitted = responsePolicy.permitted;
      responseExplanation = responsePolicy.explanation;
    }
    const responseLinks = linkPath(response);
    const responseDrop = response.reachable && responsePermitted ? deterministicBuilderPathDrop(profiles2, responseLinks, `trace:${sequence}:${ttl}:reply`) : null;
    const ok = response.reachable && responsePermitted && !responseDrop;
    const m = metrics(profiles2, requestLinks, responseLinks, ok);
    attempts.push({ index: attempts.length, ttl, status: ok ? "time-exceeded" : "timeout", responderNodeId: nodeId, responderAddress: inboundAddress(addressing3, nodeId, links[nodeIndex - 1]), requestNodeIds: nodes.slice(0, nodeIndex + 1), requestLinkIds: requestLinks, responseNodeIds: ok ? nodePath(response) : [], responseLinkIds: ok ? responseLinks : [], detail: ok ? `${nodeLabel(graph4, nodeId)} decrements TTL to zero and returns ICMP Time Exceeded${natResponse?.translation ? " through related NAT state" : ""} \xB7 ${m.simulatedRttMs} ms simulated RTT.` : !response.reachable ? `${nodeLabel(graph4, nodeId)} expires TTL, but Time Exceeded has no reverse route.` : !responsePermitted ? `Time Exceeded cannot traverse its reverse policy/NAT path: ${responseExplanation}` : `Time Exceeded was dropped on ${responseDrop}.`, packet: packet2, ...m, dropLinkId: responseDrop, natDetail: natNote(natRequest, natResponse) });
    ttl += 1;
  }
  if (!terminal) {
    const forwardPermitted = natRequest ? natRequest.success : fullPolicy?.permitted ?? true;
    if (forward.reachable && forwardPermitted) {
      let reply;
      let replyPermitted = true;
      let replyExplanation = "";
      let natReply = null;
      if (natRequest?.translation) {
        natReply = runBuilderNatInboundFlow(graph4, addressing3, routing3, nat2, workingSessions, destinationNodeId, natRequest.translation.outsideAddress, "icmp", null, null, sequence + ttl, acl2);
        reply = natReply.forwarding ?? traceBuilderForwarding(graph4, addressing3, routing3, destinationNodeId, sourceNodeId);
        replyPermitted = natReply.success;
        replyExplanation = natReply.explanation;
        workingSessions = natReply.sessions;
      } else {
        const replyPolicy = traceBuilderPolicy(graph4, addressing3, routing3, acl2, destinationNodeId, sourceNodeId, "icmp", null, `icmp|${destinationNodeId}|${sourceNodeId}|${sequence}|reply`);
        reply = replyPolicy.forwarding;
        replyPermitted = replyPolicy.permitted;
        replyExplanation = replyPolicy.explanation;
      }
      const responseLinks = linkPath(reply);
      const requestDrop = deterministicBuilderPathDrop(profiles2, links, `trace:${sequence}:${ttl}:request`);
      const responseDrop = !requestDrop && reply.reachable && replyPermitted ? deterministicBuilderPathDrop(profiles2, responseLinks, `trace:${sequence}:${ttl}:reply`) : null;
      const ok = !requestDrop && reply.reachable && replyPermitted && !responseDrop;
      const m = metrics(profiles2, links, responseLinks, ok);
      attempts.push({ index: attempts.length, ttl, status: ok ? "echo-reply" : "timeout", responderNodeId: destinationNodeId, responderAddress: destinationAddress, requestNodeIds: nodes, requestLinkIds: links, responseNodeIds: ok ? nodePath(reply) : [], responseLinkIds: ok ? responseLinks : [], detail: ok ? `${nodeLabel(graph4, destinationNodeId)} returns Echo Reply${natReply?.translation ? " through reverse NAT" : ""} \xB7 ${m.simulatedRttMs} ms simulated RTT.` : requestDrop ? `Final Echo probe was dropped on ${requestDrop}.` : !reply.reachable ? "Final Echo Reply has no reverse route." : !replyPermitted ? `Final Echo Reply cannot traverse reverse policy/NAT: ${replyExplanation}` : `Final Echo Reply was dropped on ${responseDrop}.`, packet: packetSeed(`probe-${sequence}-ttl-${ttl}`, `ICMP TRACE TTL ${ttl}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, ttl), ...m, dropLinkId: requestDrop ?? responseDrop, natDetail: natNote(natRequest, natReply) });
    } else if (!forward.reachable) {
      const m = metrics(profiles2, links, [], false);
      attempts.push({ index: attempts.length, ttl, status: "unreachable", responderNodeId: forward.failureNodeId, responderAddress: forward.failureNodeId ? primaryAddress4(addressing3, forward.failureNodeId) : null, requestNodeIds: nodes, requestLinkIds: links, responseNodeIds: [], responseLinkIds: [], detail: `${nodeLabel(graph4, forward.failureNodeId ?? sourceNodeId)} cannot continue the probe: ${forward.failureReason ?? "no route"}.`, packet: packetSeed(`probe-${sequence}-ttl-${ttl}`, `ICMP TRACE TTL ${ttl}`, sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, ttl), ...m, dropLinkId: null, natDetail: natNote(natRequest, null) });
    }
  }
  const success = attempts.at(-1)?.status === "echo-reply";
  return { id: `probe-${sequence}-traceroute`, sequence, kind: "traceroute", plane: "ROUTED IPV4", sourceNodeId, destinationNodeId, sourceAddress, destinationAddress, success, attempts, summary: success ? `ICMP traceroute reached ${nodeLabel(graph4, destinationNodeId)} after ${Math.max(0, attempts.length - 1)} routed hop${attempts.length - 1 === 1 ? "" : "s"}${natRequest?.translation ? " with NAT-aware return handling" : ""}.` : "Traceroute terminated without a returning destination Echo Reply.", snapshotNote: "TTL decrements only at routers. RTT/loss/MTU come from explicit link characteristics. When NAT is active, downstream Time Exceeded replies consume related translation state instead of bypassing it.", natApplied: Boolean(natRequest?.translation), natTranslationId: natRequest?.translation?.id ?? null, natSessions: workingSessions };
}
function runBuilderProbe(graph4, addressing3, routing3, kind, sourceNodeId, destinationNodeId, sequence = 1, profiles2 = createDefaultBuilderLinkProfiles(graph4), acl2 = createDefaultBuilderAclConfig(), nat2 = createEmptyBuilderNatConfig(), natSessions = []) {
  return kind === "ping" ? runPing(graph4, addressing3, routing3, sourceNodeId, destinationNodeId, sequence, profiles2, acl2, nat2, natSessions) : runTraceroute(graph4, addressing3, routing3, sourceNodeId, destinationNodeId, sequence, profiles2, acl2, nat2, natSessions);
}

// ../8f1a24ac8c73/hopscotch/src/builder/application.ts
var MAX_SERVICES = 96;
function normalizeHostname(value) {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(normalized) || !normalized.includes(".")) throw new Error(`Invalid Builder service hostname ${value}.`);
  return normalized;
}
function validateBuilderHostedServices(graph4, services) {
  if (services.length > MAX_SERVICES) throw new Error(`Builder supports at most ${MAX_SERVICES} hosted services.`);
  const endpointIds = new Set(graph4.nodes.filter((node) => node.kind === "endpoint").map((node) => node.id));
  const ids = /* @__PURE__ */ new Set();
  return services.map((raw, index) => {
    if (!raw || !/^[a-zA-Z0-9_.:-]+$/.test(raw.id) || ids.has(raw.id)) throw new Error(`Hosted service ${index + 1} has an invalid or duplicate id.`);
    if (!endpointIds.has(raw.nodeId)) throw new Error(`Hosted service ${raw.id} must belong to a Builder endpoint.`);
    if (!["dns", "http", "https", "ssh", "tcp", "udp"].includes(raw.kind)) throw new Error(`Hosted service ${raw.id} has an unsupported kind.`);
    if (!Number.isInteger(raw.port) || raw.port < 1 || raw.port > 65535) throw new Error(`Hosted service ${raw.id} port must be 1\u201365535.`);
    if (!Number.isInteger(raw.responseBytes) || raw.responseBytes < 0 || raw.responseBytes > 16 * 1024 * 1024) throw new Error(`Hosted service ${raw.id} responseBytes is outside the bounded 0\u201316 MiB range.`);
    const transportProfile = raw.kind === "https" ? raw.transportProfile === "quic-h3" ? "quic-h3" : "tcp-h2" : raw.transportProfile === "quic-h3" ? "quic-h3" : raw.transportProfile === "tcp-h2" ? "tcp-h2" : null;
    ids.add(raw.id);
    return { id: raw.id, nodeId: raw.nodeId, kind: raw.kind, label: String(raw.label || raw.kind.toUpperCase()).slice(0, 80), hostname: normalizeHostname(raw.hostname), port: raw.port, enabled: raw.enabled !== false, transportProfile, responseBytes: raw.responseBytes };
  }).sort((left, right) => left.nodeId.localeCompare(right.nodeId) || left.port - right.port || left.id.localeCompare(right.id));
}
function createDefaultBuilderHostedServices(graph4) {
  const preferred = graph4.nodes.find((node) => node.id === "app" && node.kind === "endpoint") ?? graph4.nodes.find((node) => node.kind === "endpoint");
  if (!preferred) return [];
  const host = `${preferred.id}.hopscotch.test`;
  return validateBuilderHostedServices(graph4, [
    { id: `${preferred.id}:dns`, nodeId: preferred.id, kind: "dns", label: "DNS", hostname: host, port: 53, enabled: true, transportProfile: null, responseBytes: 128 },
    { id: `${preferred.id}:http`, nodeId: preferred.id, kind: "http", label: "HTTP", hostname: host, port: 80, enabled: true, transportProfile: "tcp-h2", responseBytes: 4096 },
    { id: `${preferred.id}:https-h2`, nodeId: preferred.id, kind: "https", label: "HTTPS \xB7 TCP/H2", hostname: host, port: 443, enabled: true, transportProfile: "tcp-h2", responseBytes: 8192 },
    { id: `${preferred.id}:https-h3`, nodeId: preferred.id, kind: "https", label: "HTTPS \xB7 QUIC/H3", hostname: host, port: 443, enabled: true, transportProfile: "quic-h3", responseBytes: 8192 },
    { id: `${preferred.id}:ssh`, nodeId: preferred.id, kind: "ssh", label: "SSH", hostname: host, port: 22, enabled: true, transportProfile: "tcp-h2", responseBytes: 512 },
    { id: `${preferred.id}:tcp`, nodeId: preferred.id, kind: "tcp", label: "GENERIC TCP", hostname: host, port: 9e3, enabled: true, transportProfile: "tcp-h2", responseBytes: 1024 },
    { id: `${preferred.id}:udp`, nodeId: preferred.id, kind: "udp", label: "GENERIC UDP", hostname: host, port: 9001, enabled: true, transportProfile: null, responseBytes: 1024 }
  ]);
}
function cloneBuilderHostedServices(graph4, services) {
  return validateBuilderHostedServices(graph4, services);
}

// ../8f1a24ac8c73/hopscotch/src/builder/scenario.ts
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertString2(value, label, max = 120) {
  if (typeof value !== "string" || value.length === 0 || value.length > max) throw new Error(`${label} must be a non-empty string under ${max + 1} characters.`);
  return value;
}
function assertTimestamp2(value, label) {
  const text2 = assertString2(value, label, 80);
  if (Number.isNaN(Date.parse(text2))) throw new Error(`${label} must be an ISO-compatible timestamp.`);
  return text2;
}
function validateGraph(value) {
  if (!isRecord3(value) || !Array.isArray(value.nodes) || !Array.isArray(value.links)) throw new Error("Scenario graph must contain node and link arrays.");
  if (value.nodes.length < 1 || value.nodes.length > BUILDER_LIMITS.maxNodes) throw new Error(`Scenario must contain 1\u2013${BUILDER_LIMITS.maxNodes} nodes.`);
  if (value.links.length > BUILDER_LIMITS.maxLinks) throw new Error(`Scenario supports at most ${BUILDER_LIMITS.maxLinks} links.`);
  const ids = /* @__PURE__ */ new Set();
  const nodes = value.nodes.map((raw, index) => {
    if (!isRecord3(raw)) throw new Error(`Node ${index + 1} is invalid.`);
    const id2 = assertString2(raw.id, `Node ${index + 1} id`, 48);
    if (!/^[a-zA-Z0-9_-]+$/.test(id2)) throw new Error(`Node id ${id2} contains unsupported characters.`);
    if (ids.has(id2)) throw new Error(`Duplicate node id: ${id2}.`);
    ids.add(id2);
    const label = assertString2(raw.label, `Node ${id2} label`, 48);
    if (raw.kind !== "router" && raw.kind !== "endpoint") throw new Error(`Node ${id2} kind must be router or endpoint.`);
    return { id: id2, label, kind: raw.kind, builtin: raw.builtin === true };
  });
  const linkIds2 = /* @__PURE__ */ new Set();
  const pairs = /* @__PURE__ */ new Set();
  const links = value.links.map((raw, index) => {
    if (!isRecord3(raw)) throw new Error(`Link ${index + 1} is invalid.`);
    const id2 = assertString2(raw.id, `Link ${index + 1} id`, 64);
    if (linkIds2.has(id2)) throw new Error(`Duplicate link id: ${id2}.`);
    linkIds2.add(id2);
    const a = assertString2(raw.a, `Link ${id2} endpoint A`, 48);
    const b = assertString2(raw.b, `Link ${id2} endpoint B`, 48);
    if (!ids.has(a) || !ids.has(b)) throw new Error(`Link ${id2} references a node that does not exist.`);
    if (a === b) throw new Error(`Link ${id2} cannot connect a node to itself.`);
    const pair = [a, b].sort().join("\0");
    if (pairs.has(pair)) throw new Error(`Duplicate undirected link between ${a} and ${b}.`);
    pairs.add(pair);
    if (typeof raw.cost !== "number" || !Number.isInteger(raw.cost) || raw.cost < BUILDER_LIMITS.minCost || raw.cost > BUILDER_LIMITS.maxCost) throw new Error(`Link ${id2} cost must be an integer from ${BUILDER_LIMITS.minCost} to ${BUILDER_LIMITS.maxCost}.`);
    return { id: id2, a, b, cost: raw.cost, failed: raw.failed === true, builtin: raw.builtin === true };
  });
  return { nodes, links };
}
function validateLayout(value, graph4) {
  if (!isRecord3(value)) throw new Error("Scenario layout must be an object keyed by node id.");
  const ids = new Set(graph4.nodes.map((node) => node.id));
  const layout2 = {};
  for (const [id2, raw] of Object.entries(value)) {
    if (!ids.has(id2)) throw new Error(`Layout references unknown node ${id2}.`);
    if (!isRecord3(raw) || typeof raw.x !== "number" || typeof raw.y !== "number" || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) throw new Error(`Layout for ${id2} must contain finite x/y coordinates.`);
    if (raw.x < BUILDER_LIMITS.minCoordinate || raw.x > BUILDER_LIMITS.maxCoordinate || raw.y < BUILDER_LIMITS.minCoordinate || raw.y > BUILDER_LIMITS.maxCoordinate) throw new Error(`Layout for ${id2} must stay within 0\u2013100.`);
    layout2[id2] = { x: raw.x, y: raw.y };
  }
  for (const node of graph4.nodes) if (!layout2[node.id]) throw new Error(`Layout is missing node ${node.id}.`);
  return layout2;
}
function layoutForGraph(layout2, graph4) {
  const scoped = {};
  for (const node of graph4.nodes) {
    const point = layout2[node.id];
    if (point) scoped[node.id] = { ...point };
  }
  return scoped;
}
function validateV9(raw) {
  if (raw.schema !== "hopscotch.builder" || raw.version !== 9) throw new Error("Unsupported HOPSCOTCH Builder schema/version.");
  const graph4 = validateGraph(raw.graph);
  const sourceId = assertString2(raw.sourceId, "sourceId", 48);
  const destinationId = assertString2(raw.destinationId, "destinationId", 48);
  const ids = new Set(graph4.nodes.map((node) => node.id));
  if (!ids.has(sourceId) || !ids.has(destinationId)) throw new Error("Source and destination must reference nodes that exist.");
  if (!isRecord3(raw.addressing) || !isRecord3(raw.addressing.segments) || !isRecord3(raw.addressing.defaultGateways)) throw new Error("Builder schema v9 requires explicit L3 addressing.");
  const addressing3 = validateBuilderAddressing(graph4, raw.addressing);
  if (!isRecord3(raw.routing) || !Array.isArray(raw.routing.staticRoutes)) throw new Error("Builder schema v9 requires explicit routing config.");
  if (!isRecord3(raw.ethernet)) throw new Error("Builder schema v9 requires explicit Ethernet/VLAN configuration.");
  if (!isRecord3(raw.linkProfiles)) throw new Error("Builder schema v9 requires routed link characteristics.");
  if (!isRecord3(raw.acl)) throw new Error("Builder schema v9 requires ACL policy configuration.");
  if (!isRecord3(raw.nat)) throw new Error("Builder schema v9 requires NAT/PAT configuration.");
  if (!isRecord3(raw.dhcp)) throw new Error("Builder schema v9 requires DHCP configuration.");
  const ethernet2 = validateBuilderEthernetConfig(raw.ethernet);
  const ipv63 = isRecord3(raw.ipv6) ? validateBuilderIpv6Config(graph4, addressing3, raw.ipv6) : createEmptyBuilderIpv6Config(graph4, addressing3);
  const services = Array.isArray(raw.services) ? validateBuilderHostedServices(graph4, raw.services) : createDefaultBuilderHostedServices(graph4);
  return { schema: "hopscotch.builder", version: 9, name: assertString2(raw.name, "Scenario name", 80), graph: graph4, addressing: addressing3, routing: validateBuilderRoutingConfig2(graph4, addressing3, raw.routing), ethernet: ethernet2, linkProfiles: validateBuilderLinkProfiles(graph4, raw.linkProfiles), acl: validateBuilderAclConfig(graph4, raw.acl), nat: validateBuilderNatConfig(graph4, raw.nat), dhcp: validateBuilderDhcpConfig(ethernet2, raw.dhcp), ipv6: ipv63, services, sourceId, destinationId, layout: validateLayout(raw.layout, graph4), createdAt: assertTimestamp2(raw.createdAt, "createdAt"), updatedAt: assertTimestamp2(raw.updatedAt, "updatedAt") };
}
function createBuilderScenario(name, graph4, sourceId, destinationId, layout2, addressing3 = createDefaultBuilderAddressing(graph4), routing3 = createDefaultBuilderRoutingConfig2(), existing, ethernet2 = createDefaultBuilderEthernetConfig(), linkProfiles2 = createDefaultBuilderLinkProfiles(graph4), acl2 = createDefaultBuilderAclConfig(), nat2 = createDefaultBuilderNatConfig(graph4), dhcp2 = createDefaultBuilderDhcpConfig(ethernet2), ipv63 = createDefaultBuilderIpv6Config(graph4, addressing3), services = createDefaultBuilderHostedServices(graph4)) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return validateV9({ schema: "hopscotch.builder", version: 9, name, graph: cloneBuilderGraph(graph4), addressing: addressing3, routing: cloneBuilderRoutingConfig2(routing3), ethernet: cloneBuilderEthernetConfig(ethernet2), linkProfiles: cloneBuilderLinkProfiles(linkProfiles2), acl: cloneBuilderAclConfig(acl2), nat: cloneBuilderNatConfig(nat2), dhcp: cloneBuilderDhcpConfig(dhcp2), ipv6: cloneBuilderIpv6Config(ipv63), services: cloneBuilderHostedServices(graph4, services), sourceId, destinationId, layout: layoutForGraph(layout2, graph4), createdAt: existing?.createdAt ?? now, updatedAt: now });
}
function defaultBuilderScenario() {
  const ethernet2 = createDefaultBuilderEthernetConfig();
  return createBuilderScenario("Default topology", defaultBuilderGraph, "client", "app", defaultBuilderLayout, createDefaultBuilderAddressing(defaultBuilderGraph), createDefaultBuilderRoutingConfig2(), void 0, ethernet2, createDefaultBuilderLinkProfiles(defaultBuilderGraph), createDefaultBuilderAclConfig(), createDefaultBuilderNatConfig(defaultBuilderGraph), createDefaultBuilderDhcpConfig(ethernet2));
}

// ../8f1a24ac8c73/hopscotch/src/builder/cli.ts
var BUILDER_CLI_SHOW_TARGETS = Object.freeze(["interfaces", "route", "arp", "mac"]);
var BUILDER_CLI_PROBE_VERBS = Object.freeze(["ping", "traceroute"]);
var BuilderCliCommandError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "BuilderCliCommandError";
    this.code = code;
  }
};
function commandLabel(input2) {
  return JSON.stringify(input2.trim());
}
function parseBuilderCliCommand(input2) {
  const trimmed = input2.trim();
  if (!trimmed) {
    throw new BuilderCliCommandError("EMPTY_COMMAND", "Unsupported command: the command is empty.");
  }
  const tokens = trimmed.split(/\s+/);
  const verb = tokens[0].toLowerCase();
  if (verb === "show") {
    if (tokens.length === 1) {
      throw new BuilderCliCommandError(
        "AMBIGUOUS_COMMAND",
        `Ambiguous command ${commandLabel(input2)}. Specify one of: ${BUILDER_CLI_SHOW_TARGETS.join(", ")}.`
      );
    }
    if (tokens.length !== 2) {
      throw new BuilderCliCommandError(
        "UNSUPPORTED_SYNTAX",
        `Unsupported syntax ${commandLabel(input2)}. Expected exactly "show <target>".`
      );
    }
    const target2 = tokens[1].toLowerCase();
    if (!BUILDER_CLI_SHOW_TARGETS.some((candidate) => candidate === target2)) {
      throw new BuilderCliCommandError(
        "UNSUPPORTED_COMMAND",
        `Unsupported show target ${JSON.stringify(tokens[1])}. Supported targets: ${BUILDER_CLI_SHOW_TARGETS.join(", ")}.`
      );
    }
    return Object.freeze({ verb: "show", target: target2 });
  }
  if (BUILDER_CLI_PROBE_VERBS.some((candidate) => candidate === verb)) {
    if (tokens.length === 1) {
      throw new BuilderCliCommandError(
        "AMBIGUOUS_COMMAND",
        `Ambiguous command ${commandLabel(input2)}. Specify one routed destination by node id, label, or IPv4 address.`
      );
    }
    if (tokens.length !== 2) {
      throw new BuilderCliCommandError(
        "UNSUPPORTED_SYNTAX",
        `Unsupported syntax ${commandLabel(input2)}. Expected exactly "${verb} <destination>".`
      );
    }
    return Object.freeze({ verb, destination: tokens[1] });
  }
  throw new BuilderCliCommandError(
    "UNSUPPORTED_COMMAND",
    `Unsupported command ${commandLabel(input2)}. Supported verbs: show, ping, traceroute.`
  );
}
function linkState2(graph4, linkId) {
  const link = graph4.links.find((candidate) => candidate.id === linkId);
  return !link ? "UNKNOWN" : link.failed ? "DOWN" : "UP";
}
function projectBuilderCliState(input2) {
  const ribGraph = input2.truthGraphs?.ribGraph ?? input2.graph;
  const interfaces = input2.graph.nodes.flatMap((node) => interfacesForBuilderNode(input2.addressing, node.id).map((entry) => {
    const physicalState = linkState2(input2.graph, entry.linkId);
    return {
      deviceId: node.id,
      interfaceName: entry.name,
      address: entry.address,
      linkState: physicalState,
      protocolState: physicalState === "UP" ? "UP" : "DOWN"
    };
  }));
  const routes = ribGraph.nodes.filter((node) => node.kind === "router").flatMap((node) => routeTableForBuilderRouter2(ribGraph, input2.addressing, input2.routing, node.id));
  return {
    interfaces,
    routes,
    arpEntries: input2.arpCache.map((entry) => ({ ...entry })),
    macEntries: (input2.ethernetFlow?.fdb ?? []).map((entry) => ({ ...entry }))
  };
}
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function firstDifference(...comparisons) {
  return comparisons.find((comparison) => comparison !== 0) ?? 0;
}
function displayNullable(value) {
  return value ?? "\u2014";
}
function formatTable(headers, rows) {
  const widths = headers.map((header, columnIndex) => Math.max(
    header.length,
    ...rows.map((row2) => (row2[columnIndex] ?? "").length)
  ));
  return [headers, ...rows].map((row2) => row2.map((cell, columnIndex) => cell.padEnd(widths[columnIndex] ?? cell.length)).join("  ").trimEnd()).join("\n");
}
function formatInterfaces(state) {
  if (state.interfaces.length === 0) return "No interface facts supplied.";
  const rows = [...state.interfaces].sort((left, right) => firstDifference(
    compareText(left.deviceId, right.deviceId),
    compareText(left.interfaceName, right.interfaceName),
    compareText(displayNullable(left.address), displayNullable(right.address)),
    compareText(left.linkState, right.linkState),
    compareText(left.protocolState, right.protocolState)
  )).map((entry) => [entry.deviceId, entry.interfaceName, displayNullable(entry.address), entry.linkState, entry.protocolState]);
  return formatTable(["DEVICE", "INTERFACE", "ADDRESS", "LINK", "PROTOCOL"], rows);
}
function formatRoutes(state) {
  if (state.routes.length === 0) return "No route facts supplied.";
  const rows = [...state.routes].sort((left, right) => firstDifference(
    compareText(left.routerId, right.routerId),
    right.prefixLength - left.prefixLength,
    compareText(left.prefix, right.prefix),
    left.administrativeDistance - right.administrativeDistance,
    left.metric - right.metric,
    compareText(left.source, right.source),
    compareText(displayNullable(left.nextHop), displayNullable(right.nextHop)),
    compareText(left.outgoingInterface, right.outgoingInterface),
    Number(right.active) - Number(left.active),
    compareText(left.stateNote, right.stateNote),
    compareText(left.id, right.id)
  )).map((entry) => [
    entry.routerId,
    entry.prefix,
    entry.source,
    String(entry.administrativeDistance),
    String(entry.metric),
    displayNullable(entry.nextHop),
    entry.outgoingInterface,
    entry.active ? "ACTIVE" : "INACTIVE",
    entry.stateNote
  ]);
  return formatTable(["DEVICE", "PREFIX", "SOURCE", "AD", "METRIC", "NEXT HOP", "INTERFACE", "STATE", "DETAIL"], rows);
}
function formatArp(state) {
  if (state.arpEntries.length === 0) return "No ARP facts supplied.";
  const rows = [...state.arpEntries].sort((left, right) => firstDifference(
    compareText(left.ownerDeviceId, right.ownerDeviceId),
    left.vlanId - right.vlanId,
    compareText(left.address, right.address),
    compareText(left.mac, right.mac),
    compareText(left.learnedFromDeviceId, right.learnedFromDeviceId)
  )).map((entry) => [entry.ownerDeviceId, String(entry.vlanId), entry.address, entry.mac, entry.learnedFromDeviceId]);
  return formatTable(["DEVICE", "VLAN", "ADDRESS", "MAC", "LEARNED FROM"], rows);
}
function formatMac3(state) {
  if (state.macEntries.length === 0) return "No MAC facts supplied.";
  const rows = [...state.macEntries].sort((left, right) => firstDifference(
    compareText(left.switchId, right.switchId),
    left.vlanId - right.vlanId,
    compareText(left.mac, right.mac),
    compareText(left.linkId, right.linkId),
    compareText(left.learnedFrom, right.learnedFrom)
  )).map((entry) => [entry.switchId, String(entry.vlanId), entry.mac, entry.linkId, entry.learnedFrom]);
  return formatTable(["SWITCH", "VLAN", "MAC", "PORT", "LEARNED FROM"], rows);
}
function formatBuilderCliCommand(command, state) {
  switch (command.target) {
    case "interfaces":
      return formatInterfaces(state);
    case "route":
      return formatRoutes(state);
    case "arp":
      return formatArp(state);
    case "mac":
      return formatMac3(state);
  }
}
function projectBuilderCliCommand(input2, state) {
  const command = parseBuilderCliCommand(input2);
  if (command.verb !== "show") {
    throw new BuilderCliCommandError(
      "EXECUTION_REQUIRED",
      `${command.verb.toUpperCase()} is an active probe command and must run through the Builder probe engine.`
    );
  }
  return formatBuilderCliCommand(command, state);
}

// ../8f1a24ac8c73/hopscotch/src/builder/ipv6-lifecycle.ts
function createBuilderIpv6LifecycleState() {
  return { clockSeconds: 0, sequence: 0, nud: [], dadHistory: [], prefixLifetimes: [], dhcpServers: [], dhcpLeases: [], dhcpHistory: [], renumberHistory: [] };
}

// complete-review/builder-device-workbench-reference.mjs
var graph = cloneBuilderGraph(defaultBuilderGraph);
var addressing = createDefaultBuilderAddressing(graph);
var routing = setBuilderOspfEverywhere2(graph, addressing, createDefaultBuilderRoutingConfig2(), true);
var bgp = createDefaultBuilderBgpConfig();
bgp = setBuilderBgpRouterAsn(graph, bgp, "edge", 64496);
bgp = setBuilderBgpRouterAsn(graph, bgp, "r1", 64500);
bgp = setBuilderBgpRouterAsn(graph, bgp, "r2", 64500);
bgp = setBuilderBgpRouterAsn(graph, bgp, "core", 65538);
bgp = upsertBuilderBgpSession(graph, bgp, "edge-r1", "customer-provider");
var edgeR1 = bgp.sessions.find((entry) => entry.linkId === "edge-r1");
bgp = updateBuilderBgpSession(graph, bgp, edgeR1.id, { relationship: "customer-provider", customerRouterId: "edge" });
bgp = upsertBuilderBgpSession(graph, bgp, "r1-r2", "peer");
var r1r2 = bgp.sessions.find((entry) => entry.linkId === "r1-r2");
bgp = updateBuilderBgpSession(graph, bgp, r1r2.id, { nextHopSelf: true });
bgp = upsertBuilderBgpSession(graph, bgp, "r2-core", "customer-provider");
var r2core = bgp.sessions.find((entry) => entry.linkId === "r2-core");
bgp = updateBuilderBgpSession(graph, bgp, r2core.id, { relationship: "customer-provider", customerRouterId: "r2" });
var appPrefix = addressing.segments["core-app"].cidr;
bgp = upsertBuilderBgpOrigin(graph, bgp, { routerId: "core", prefix: appPrefix, med: 10, communities: ["65538:110"], description: "Workbench app origin" });
routing = { ...routing, bgp };
var ethernet = createDefaultBuilderEthernetConfig();
var arp = resolveBuilderEthernetFlowArp(ethernet, "lan-a", "lan-b", []);
var ethernetFlow = runBuilderEthernetFlow(ethernet, "lan-a", "lan-b");
var dhcp = createDefaultBuilderDhcpConfig(ethernet);
dhcp = setBuilderDhcpClient(ethernet, dhcp, "lan-a", true);
var dhcpTx = runBuilderDhcpAcquire(ethernet, dhcp, [], "lan-a", 1);
var acl = createDefaultBuilderAclConfig();
var nat = createDefaultBuilderNatConfig(graph);
var linkProfiles = createDefaultBuilderLinkProfiles(graph);
var probe = runBuilderProbe(graph, addressing, routing, "ping", "client", "app", 1, linkProfiles, acl, nat, []);
var ipv6 = createDefaultBuilderIpv6Config(graph, addressing, true);
var ipv6ControlState = createBuilderIpv6ControlState();
var ipv6RoutingDepth = createDefaultBuilderIpv6RoutingDepthState(graph);
var events = createBuilderWorkbenchEventJournal();
events = appendBuilderWorkbenchMessageEvent(events, "TOPOLOGY CHANGED \xB7 OSPF recomputes from active links.", [{ plane: "routed", id: "edge" }]);
events = appendBuilderWorkbenchMessageEvent(events, "PING \xB7 canonical forwarding and policy produced a probe snapshot.", [{ plane: "routed", id: "edge" }]);
events = appendBuilderWorkbenchMessageEvent(events, "LAN FABRIC \xB7 ARP RESOLVED \xB7 frame delivered.", [{ plane: "ethernet", id: "lan-sw1" }, { plane: "ethernet", id: "lan-a" }]);
events = appendBuilderWorkbenchMessageEvent(events, "DHCP ACK \xB7 PC-A leased a runtime IPv4 address.", [{ plane: "ethernet", id: "lan-a" }]);
var input = { graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache: arp.cache, arpResolutions: arp.resolutions, acl, nat, natSessions: probe.natSessions, dhcp, dhcpLeases: dhcpTx.leases, dhcpSequence: 2, probeHistory: [probe], sourceId: "client", destinationId: "app", events };
var options = builderWorkbenchDeviceOptions(graph, ethernet);
var devices = options.map((ref) => buildBuilderDeviceWorkbench(input, ref));
var cliState = projectBuilderCliState({ graph, addressing, routing, ethernet, arpCache: arp.cache, ethernetFlow });
var commands = ["show interfaces", "show route", "show arp", "show mac"];
var builder_device_workbench_reference_default = { input, options, devices, layout: defaultBuilderLayout, services: createDefaultBuilderHostedServices(graph), lifecycle: createBuilderIpv6LifecycleState(), cli: commands.map((command) => ({ command, output: projectBuilderCliCommand(command, cliState) })) };

// ../8f1a24ac8c73/hopscotch/src/builder/provider.ts
function primaryAddress5(addressing3, nodeId) {
  return interfacesForBuilderNode(addressing3, nodeId)[0]?.address ?? null;
}
function linkIds(trace2) {
  return trace2.hops.map((hop) => hop.linkId).filter((id2) => Boolean(id2) && id2 !== "discard");
}
function routerPath(trace2) {
  const result = [trace2.sourceNodeId];
  for (const hop of trace2.hops) if (hop.nextNodeId && result.at(-1) !== hop.nextNodeId) result.push(hop.nextNodeId);
  if (result.at(-1) !== trace2.destinationNodeId) result.push(trace2.destinationNodeId);
  return result;
}
function stableHash3(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
function labelFor(lspId, index) {
  return 16e3 + (stableHash3(`${lspId}:${index}`) + index * 997) % 8e5;
}
function tunnelOverhead(kind) {
  return kind === "ipip" ? 20 : kind === "gre" ? 24 : kind === "ipsec" ? 58 : 60;
}
function encrypted(kind) {
  return kind === "ipsec" || kind === "wireguard";
}
function tunnelProtocol(kind) {
  return kind === "gre" ? "GRE" : kind === "ipip" ? "IP-IN-IP" : kind === "ipsec" ? "ESP-STYLE" : "UDP/WIREGUARD-STYLE";
}
function builderProviderUnderlayTrace(graph4, addressing3, routing3, sourceRouterId, destinationRouterId, discriminator = "track-g-underlay") {
  return traceBuilderForwarding(graph4, addressing3, routing3, sourceRouterId, destinationRouterId, graph4, { protocol: "udp", sourcePort: 45e3, destinationPort: 4789, discriminator });
}
function builderTunnelState(graph4, addressing3, routing3, profiles2, tunnel) {
  const trace2 = builderProviderUnderlayTrace(graph4, addressing3, routing3, tunnel.sourceRouterId, tunnel.destinationRouterId, `tunnel:${tunnel.id}`), ids = linkIds(trace2), characteristics = builderPathCharacteristics(profiles2, ids), isEncrypted = encrypted(tunnel.kind), securityReady = !isEncrypted || tunnel.securityState === "ready";
  let reason = "UNDERLAY REACHABLE \xB7 ENCAPSULATION READY";
  if (!tunnel.enabled) reason = "TUNNEL ADMINISTRATIVELY DISABLED";
  else if (!trace2.reachable) reason = `UNDERLAY UNREACHABLE \xB7 ${trace2.failureReason ?? trace2.explanation}`;
  else if (!securityReady) reason = `ENCRYPTED TUNNEL ${tunnel.securityState.toUpperCase().replaceAll("-", " ")}`;
  const up = tunnel.enabled && trace2.reachable && securityReady, overhead = tunnelOverhead(tunnel.kind), pathMtu = characteristics.pathMtuBytes, effective = pathMtu == null ? null : Math.max(68, pathMtu - overhead);
  return { tunnelId: tunnel.id, kind: tunnel.kind, state: up ? "UP" : "DOWN", underlayReachable: trace2.reachable, overlayReachable: up, encrypted: isEncrypted, securityState: tunnel.securityState, underlayLinkIds: ids, outerSourceAddress: primaryAddress5(addressing3, tunnel.sourceRouterId), outerDestinationAddress: primaryAddress5(addressing3, tunnel.destinationRouterId), pathMtuBytes: pathMtu, encapsulationOverheadBytes: overhead, effectiveOverlayMtuBytes: effective, reason, trace: trace2 };
}
function builderTunnelPacketProjection(graph4, addressing3, routing3, profiles2, tunnel, inner) {
  const state = builderTunnelState(graph4, addressing3, routing3, profiles2, tunnel), bytes2 = Math.max(20, Math.round(inner.bytes)), tooLarge2 = state.effectiveOverlayMtuBytes != null && bytes2 > state.effectiveOverlayMtuBytes;
  const accepted = state.state === "UP" && !tooLarge2;
  return { tunnelId: tunnel.id, state: accepted ? "ENCAPSULATED" : "DROP", inner: { ...inner, bytes: bytes2 }, outer: { source: state.outerSourceAddress, destination: state.outerDestinationAddress, protocol: tunnelProtocol(tunnel.kind), bytes: bytes2 + state.encapsulationOverheadBytes }, effectiveOverlayMtuBytes: state.effectiveOverlayMtuBytes, fragmentationRequired: tooLarge2, reason: state.state !== "UP" ? state.reason : tooLarge2 ? `INNER PACKET ${bytes2} B EXCEEDS EFFECTIVE TUNNEL MTU ${state.effectiveOverlayMtuBytes} B` : `INNER ${inner.source} \u2192 ${inner.destination} PRESERVED \xB7 OUTER UNDERLAY HEADER ADDED`, underlayLinkIds: state.underlayLinkIds };
}
function builderMplsLspState(graph4, addressing3, routing3, lsp2) {
  const trace2 = builderProviderUnderlayTrace(graph4, addressing3, routing3, lsp2.ingressRouterId, lsp2.egressRouterId, `mpls:${lsp2.id}`), path = routerPath(trace2), ids = linkIds(trace2), enabled = new Set(routing3.provider?.mpls.enabledRouterIds ?? []);
  let reason = "LSP FOLLOWS CANONICAL UNDERLAY FIB";
  if (!lsp2.enabled) reason = "LSP ADMINISTRATIVELY DISABLED";
  else if (!trace2.reachable) reason = `UNDERLAY UNREACHABLE \xB7 ${trace2.failureReason ?? trace2.explanation}`;
  else {
    const missing = path.find((routerId) => !enabled.has(routerId));
    if (missing) reason = `MPLS NOT ENABLED ON ${missing.toUpperCase()}`;
  }
  const up = lsp2.enabled && trace2.reachable && !path.some((routerId) => !enabled.has(routerId)), operations = [];
  if (up && path.length >= 2) {
    const labels = ids.map((_, index) => labelFor(lsp2.id, index));
    operations.push({ lspId: lsp2.id, routerId: path[0], operation: "PUSH", inLabel: null, outLabel: labels[0], outgoingLinkId: ids[0] ?? null, nextRouterId: path[1] ?? null, fecPrefix: lsp2.fecPrefix });
    for (let i = 1; i < path.length - 1; i++) operations.push({ lspId: lsp2.id, routerId: path[i], operation: "SWAP", inLabel: labels[i - 1] ?? null, outLabel: labels[i] ?? labels[i - 1] ?? null, outgoingLinkId: ids[i] ?? null, nextRouterId: path[i + 1] ?? null, fecPrefix: lsp2.fecPrefix });
    operations.push({ lspId: lsp2.id, routerId: path.at(-1), operation: "POP", inLabel: labels.at(-1) ?? null, outLabel: null, outgoingLinkId: null, nextRouterId: null, fecPrefix: lsp2.fecPrefix });
  }
  return { lspId: lsp2.id, state: up ? "UP" : "DOWN", reason, underlayTrace: trace2, routerPath: path, linkIds: ids, operations };
}
function bgpControlReachable(graph4, addressing3, routing3, originRouterId, viewerRouterId) {
  if (originRouterId === viewerRouterId) return true;
  const bgp2 = routing3.bgp, sessionState = builderBgpState(graph4, addressing3, bgp2), established = new Set(sessionState.sessions.filter((entry) => entry.state === "ESTABLISHED").map((entry) => entry.id));
  const queue = [{ routerId: originRouterId, learnedVia: "local", learnedFromRouterId: null, learnedSessionId: null, asPath: [], reflectionPath: [] }], seen = /* @__PURE__ */ new Set();
  for (let steps = 0; queue.length && steps < 256; steps += 1) {
    const state = queue.shift();
    const fingerprint = [state.routerId, state.learnedVia, state.learnedFromRouterId ?? "", state.learnedSessionId ?? "", state.asPath.join(","), state.reflectionPath.join(",")].join("|");
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    for (const session of bgp2.sessions) {
      if (!established.has(session.id) || session.aRouterId !== state.routerId && session.bRouterId !== state.routerId) continue;
      const receiverId = session.aRouterId === state.routerId ? session.bRouterId : session.aRouterId;
      if (state.learnedFromRouterId === receiverId) continue;
      const senderAsn = builderBgpAsnForRouter(graph4, bgp2, state.routerId), receiverAsn = builderBgpAsnForRouter(graph4, bgp2, receiverId), mode = senderAsn === receiverAsn ? "ibgp" : "ebgp";
      if (mode === "ibgp" && state.learnedVia === "ibgp") {
        const inbound = bgp2.sessions.find((entry) => entry.id === state.learnedSessionId);
        const learnedFromClient = Boolean(inbound && inbound.routeReflectorClientRouterId === state.learnedFromRouterId && (inbound.aRouterId === state.routerId || inbound.bRouterId === state.routerId));
        const receiverIsClient = session.routeReflectorClientRouterId === receiverId && (session.aRouterId === state.routerId || session.bRouterId === state.routerId);
        if (!learnedFromClient && !receiverIsClient) continue;
        if (state.reflectionPath.includes(receiverId)) continue;
      }
      let next;
      if (mode === "ebgp") {
        const asPath = [senderAsn, ...state.asPath];
        if (asPath.includes(receiverAsn)) continue;
        next = { routerId: receiverId, learnedVia: "ebgp", learnedFromRouterId: state.routerId, learnedSessionId: session.id, asPath, reflectionPath: [...state.reflectionPath] };
      } else next = { routerId: receiverId, learnedVia: "ibgp", learnedFromRouterId: state.routerId, learnedSessionId: session.id, asPath: [...state.asPath], reflectionPath: state.learnedVia === "ibgp" ? [.../* @__PURE__ */ new Set([...state.reflectionPath, state.routerId])] : [...state.reflectionPath] };
      if (receiverId === viewerRouterId) return true;
      queue.push(next);
    }
  }
  return false;
}
function vtep(config, routerId) {
  return config.vxlan.vteps.find((entry) => entry.routerId === routerId && entry.enabled);
}
function vni(config, value) {
  return config.vxlan.vnis.find((entry) => entry.vni === value);
}
function builderVxlanVniState(graph4, addressing3, routing3, vniConfig) {
  const provider2 = routing3.provider ?? { tunnels: [], mpls: { enabledRouterIds: [], lsps: [] }, vxlan: { vteps: [], vnis: [], bindings: [], evpnEnabled: false } }, active = vniConfig.memberVtepRouterIds.filter((id2) => vtep(provider2, id2)), pairs = [];
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const trace2 = builderProviderUnderlayTrace(graph4, addressing3, routing3, active[i], active[j], `vxlan:${vniConfig.vni}:${active[i]}:${active[j]}`);
    pairs.push({ aRouterId: active[i], bRouterId: active[j], reachable: trace2.reachable, linkIds: linkIds(trace2), reason: trace2.reachable ? "UNDERLAY REACHABLE" : trace2.failureReason ?? trace2.explanation });
  }
  const reachable = pairs.filter((entry) => entry.reachable).length, total = pairs.length, state = active.length < 2 ? "DOWN" : reachable === total ? "UP" : reachable === 0 ? "DOWN" : "DEGRADED";
  return { vni: vniConfig.vni, state, activeVtepRouterIds: active, pairs, reason: state === "UP" ? "ALL VTEP PAIRS HAVE CANONICAL UNDERLAY REACHABILITY" : state === "DEGRADED" ? "OVERLAY PARTITIONED BY UNDERLAY REACHABILITY" : "VNI HAS NO COMPLETE VTEP UNDERLAY" };
}
function builderEvpnRoutes(graph4, addressing3, routing3, viewerVtepRouterId) {
  const provider2 = routing3.provider;
  if (!provider2?.vxlan.evpnEnabled || !vtep(provider2, viewerVtepRouterId)) return [];
  const rows = [];
  for (const binding of provider2.vxlan.bindings) {
    const network = vni(provider2, binding.vni);
    if (!network?.memberVtepRouterIds.includes(viewerVtepRouterId)) continue;
    const local = binding.vtepRouterId === viewerVtepRouterId, control2 = local || bgpControlReachable(graph4, addressing3, routing3, binding.vtepRouterId, viewerVtepRouterId), underlay = local || builderProviderUnderlayTrace(graph4, addressing3, routing3, viewerVtepRouterId, binding.vtepRouterId, `evpn:${binding.id}:${viewerVtepRouterId}`).reachable;
    if (!local && (!control2 || !underlay)) continue;
    const originVtep = vtep(provider2, binding.vtepRouterId);
    if (!originVtep) continue;
    rows.push({ id: `evpn2:${viewerVtepRouterId}:${binding.id}`, routeType: "TYPE-2 MAC/IP", viewerVtepRouterId, originVtepRouterId: binding.vtepRouterId, vni: binding.vni, mac: binding.mac, ip: binding.ip, nextHop: originVtep.sourceAddress, routeDistinguisher: `${builderBgpAsnForRouter(graph4, routing3.bgp, binding.vtepRouterId)}:${binding.vni}`, routeTarget: network.routeTarget, learned: local ? "LOCAL" : "BGP EVPN", underlayReachable: underlay, controlPlaneReachable: control2, attachment: binding.attachment });
  }
  return rows.sort((a, b) => a.vni - b.vni || a.mac.localeCompare(b.mac) || a.originVtepRouterId.localeCompare(b.originVtepRouterId));
}
function bindingForMac(config, vniValue, mac2) {
  const normalized = mac2.trim().toLowerCase().replaceAll("-", ":");
  return config.vxlan.bindings.find((entry) => entry.vni === vniValue && entry.mac === normalized);
}
function builderVxlanForwarding(graph4, addressing3, routing3, sourceBinding, destinationMac) {
  const provider2 = routing3.provider, network = provider2 ? vni(provider2, sourceBinding.vni) : void 0, sourceVtep = provider2 ? vtep(provider2, sourceBinding.vtepRouterId) : void 0;
  if (!provider2 || !network || !sourceVtep) return { vni: sourceBinding.vni, sourceBindingId: sourceBinding.id, destinationMac, mode: "DROP", delivered: false, remoteVtepRouterIds: [], outerPaths: [], reason: "SOURCE VNI/VTEP IS NOT ACTIVE" };
  const destination = bindingForMac(provider2, sourceBinding.vni, destinationMac);
  if (destination?.vtepRouterId === sourceBinding.vtepRouterId) return { vni: network.vni, sourceBindingId: sourceBinding.id, destinationMac, mode: "LOCAL", delivered: true, remoteVtepRouterIds: [], outerPaths: [], reason: `DESTINATION MAC IS LOCALLY ATTACHED AT ${sourceBinding.vtepRouterId.toUpperCase()}` };
  let remotes = [];
  let mode = "INGRESS REPLICATION";
  if (destination && provider2.vxlan.evpnEnabled && builderEvpnRoutes(graph4, addressing3, routing3, sourceBinding.vtepRouterId).some((route) => route.mac === destination.mac && route.originVtepRouterId === destination.vtepRouterId)) {
    remotes = [destination.vtepRouterId];
    mode = "EVPN UNICAST";
  } else remotes = network.memberVtepRouterIds.filter((id2) => id2 !== sourceBinding.vtepRouterId && Boolean(vtep(provider2, id2)));
  const outerPaths = remotes.map((remoteVtepRouterId) => {
    const remote = vtep(provider2, remoteVtepRouterId);
    const trace2 = builderProviderUnderlayTrace(graph4, addressing3, routing3, sourceBinding.vtepRouterId, remoteVtepRouterId, `vxlan-forward:${network.vni}:${sourceBinding.id}:${destinationMac}:${remoteVtepRouterId}`);
    return { remoteVtepRouterId, sourceAddress: sourceVtep.sourceAddress, destinationAddress: remote.sourceAddress, udpPort: 4789, linkIds: linkIds(trace2), reachable: trace2.reachable };
  });
  const delivered = destination ? outerPaths.some((entry) => entry.remoteVtepRouterId === destination.vtepRouterId && entry.reachable) : false;
  return { vni: network.vni, sourceBindingId: sourceBinding.id, destinationMac, mode, delivered, remoteVtepRouterIds: remotes, outerPaths, reason: mode === "EVPN UNICAST" ? delivered ? "TYPE-2 MAC/IP ROUTE SELECTED REMOTE VTEP \xB7 VXLAN USES CANONICAL UNDERLAY" : "EVPN REMOTE VTEP EXISTS BUT UNDERLAY IS UNREACHABLE" : destination ? delivered ? "NO USABLE EVPN TYPE-2 ROUTE \xB7 INGRESS REPLICATION REACHES DESTINATION VTEP" : "FLOOD LIST CANNOT REACH DESTINATION VTEP" : "UNKNOWN MAC \xB7 INGRESS REPLICATION ONLY; DESTINATION DELIVERY IS NOT INVENTED" };
}

// complete-review/builder-provider-reference.mjs
var graph2 = { nodes: [
  { id: "pe1", label: "PE1", kind: "router", builtin: false },
  { id: "p1", label: "P1", kind: "router", builtin: false },
  { id: "p2", label: "P2", kind: "router", builtin: false },
  { id: "pe2", label: "PE2", kind: "router", builtin: false }
], links: [
  { id: "pe1-p1", a: "pe1", b: "p1", cost: 10, failed: false, builtin: false },
  { id: "p1-p2", a: "p1", b: "p2", cost: 10, failed: false, builtin: false },
  { id: "p2-pe2", a: "p2", b: "pe2", cost: 10, failed: false, builtin: false }
] };
var layout = { pe1: { x: 10, y: 50 }, p1: { x: 35, y: 50 }, p2: { x: 65, y: 50 }, pe2: { x: 90, y: 50 } };
var addressing2 = createDefaultBuilderAddressing(graph2);
var profiles = createDefaultBuilderLinkProfiles(graph2);
var routing2 = setBuilderOspfEverywhere2(graph2, addressing2, createDefaultBuilderRoutingConfig2(), true);
for (const [index, router] of graph2.nodes.entries()) {
  routing2 = { ...routing2, bgp: setBuilderBgpRouterAsn(graph2, routing2.bgp, router.id, 64496 + index) };
  routing2 = { ...routing2, bgp: setBuilderBgpRouterEnabled(graph2, routing2.bgp, router.id, true) };
}
for (const link of graph2.links) routing2 = { ...routing2, bgp: upsertBuilderBgpSession(graph2, routing2.bgp, link.id) };
var address = (id2) => interfacesForBuilderNode(addressing2, id2)[0].address;
var provider = createDefaultBuilderProviderConfig();
provider.tunnels = [
  { id: "gre-pe", kind: "gre", sourceRouterId: "pe1", destinationRouterId: "pe2", overlayPrefix: "172.31.255.0/30", localTunnelAddress: "172.31.255.1", remoteTunnelAddress: "172.31.255.2", enabled: true, securityState: "none", description: "GRE overlay" },
  { id: "ipsec-core", kind: "ipsec", sourceRouterId: "p1", destinationRouterId: "p2", overlayPrefix: "172.31.254.0/30", localTunnelAddress: "172.31.254.1", remoteTunnelAddress: "172.31.254.2", enabled: true, securityState: "ready", description: "IPsec-style semantic" }
];
provider.mpls.enabledRouterIds = ["pe1", "p1", "p2", "pe2"];
provider.mpls.lsps = [{ id: "lsp-pe1-pe2", ingressRouterId: "pe1", egressRouterId: "pe2", fecPrefix: "10.20.0.0/16", enabled: true, description: "Provider LSP" }];
provider.vxlan.vteps = [{ routerId: "pe1", sourceAddress: address("pe1"), enabled: true }, { routerId: "pe2", sourceAddress: address("pe2"), enabled: true }];
provider.vxlan.vnis = [{ id: "vni-10100", vni: 10100, memberVtepRouterIds: ["pe1", "pe2"], routeTarget: "64496:10100", description: "Tenant 10" }];
provider.vxlan.bindings = [{ id: "host-a", vni: 10100, vtepRouterId: "pe1", mac: "02:00:00:00:10:01", ip: "10.10.0.10", attachment: "SITE A", description: "Host A" }, { id: "host-b", vni: 10100, vtepRouterId: "pe2", mac: "02:00:00:00:10:02", ip: "10.10.0.20", attachment: "SITE B", description: "Host B" }];
provider.vxlan.evpnEnabled = true;
routing2 = setBuilderProviderConfig(graph2, addressing2, routing2, provider);
var gre = builderTunnelState(graph2, addressing2, routing2, profiles, routing2.provider.tunnels[0]);
var packet = builderTunnelPacketProjection(graph2, addressing2, routing2, profiles, routing2.provider.tunnels[0], { source: "172.31.255.1", destination: "172.31.255.2", bytes: 1400 });
var tooLarge = builderTunnelPacketProjection(graph2, addressing2, routing2, profiles, routing2.provider.tunnels[0], { source: "172.31.255.1", destination: "172.31.255.2", bytes: 1480 });
var lsp = builderMplsLspState(graph2, addressing2, routing2, routing2.provider.mpls.lsps[0]);
var vni2 = builderVxlanVniState(graph2, addressing2, routing2, routing2.provider.vxlan.vnis[0]);
var evpn = builderEvpnRoutes(graph2, addressing2, routing2, "pe1");
var vxlan = builderVxlanForwarding(graph2, addressing2, routing2, routing2.provider.vxlan.bindings[0], "02:00:00:00:10:02");
var failedGraph = structuredClone(graph2);
failedGraph.links.find((link) => link.id === "p1-p2").failed = true;
var failedGre = builderTunnelState(failedGraph, addressing2, routing2, profiles, routing2.provider.tunnels[0]);
var builder_provider_reference_default = { graph: graph2, layout, addressing: addressing2, routing: routing2, profiles, gre, packet, tooLarge, lsp, vni: vni2, evpn, vxlan, failedGre };

// complete-review/builder-ipv6-control-plane-reference.mjs
var graph3 = cloneBuilderGraph(defaultBuilderGraph);
var ipv4 = createDefaultBuilderAddressing(graph3);
var ipv62 = createDefaultBuilderIpv6Config(graph3, ipv4);
var control = createBuilderIpv6ControlState();
ipv62 = setBuilderIpv6RaRouterEnabled(graph3, ipv4, ipv62, "edge", true);
var ra = runBuilderIpv6RouterSolicitation(graph3, ipv4, ipv62, "client", control);
ipv62 = setBuilderOspfv3Everywhere(graph3, ipv4, ra.config, true);
control = ra.state;
var trace = traceBuilderIpv6Forwarding(graph3, ipv62, "client", "app");
var firstNd = resolveBuilderIpv6TraceNeighbors(graph3, ipv62, trace, control, control.clock + 1);
var secondNd = resolveBuilderIpv6TraceNeighbors(graph3, ipv62, trace, firstNd.state, firstNd.state.clock + 1);
var builder_ipv6_control_plane_reference_default = { graph: graph3, ipv4, ipv6: ipv62, ra, trace, firstNd, secondNd };

// complete-review/observed-reference.mjs
var observed_reference_default = {
  schema: "hopscotch.internet-evidence",
  version: 1,
  generatedAt: "2026-08-20T22:00:00.000Z",
  edge: { provenance: "EDGE OBSERVED", availability: "available", asn: 13335, organization: "Cloudflare, Inc.", colo: "LHR", country: "GB", region: "England", city: "London", transportRttMs: 17, transport: "QUIC", observedAt: "2026-08-20T22:00:00.000Z", note: "Observed at the edge serving this explicit HOPSCOTCH request." },
  destination: { provenance: "INFERRED", availability: "available", hostname: "cloudflare.com", addresses: ["104.16.132.229", "104.16.133.229", "2606:4700::6810:84e5"], selectedAddress: "104.16.132.229", note: "DNS resolution provides destination context, not a measured forwarding path." },
  routing: { provenance: "PUBLIC COLLECTOR", availability: "available", prefix: "104.16.128.0/20", originAsns: [13335], note: "Public route-origin context seen from independent collector vantage points." },
  collectorPaths: [
    { provenance: "PUBLIC COLLECTOR", availability: "available", sourceId: "rrc00-peer-64500", targetPrefix: "104.16.128.0/20", asPath: [64500, 3356, 13335], note: "Independent RIS vantage; not the browser path." },
    { provenance: "PUBLIC COLLECTOR", availability: "available", sourceId: "rrc10-peer-64496", targetPrefix: "104.16.128.0/20", asPath: [64496, 1299, 13335], note: "Independent RIS vantage; not the browser path." },
    { provenance: "PUBLIC COLLECTOR", availability: "available", sourceId: "rrc21-peer-64497", targetPrefix: "104.16.128.0/20", asPath: [64497, 174, 13335], note: "Independent RIS vantage; not the browser path." }
  ],
  bridge: { provenance: "INFERRED", availability: "partial", sourceAsn: 13335, destinationOriginAsns: [13335], note: "No continuous observation joins the request edge, the browser forwarding path, and these public collector routes." },
  warnings: ["Collector paths are independent route observations and do not identify the current browser path."]
};

// ../8f1a24ac8c73/hopscotch/src/builder/authoring.ts
function cloneValue(value) {
  return structuredClone(value);
}
function cloneSnapshot(snapshot) {
  return cloneValue(snapshot);
}
function createBuilderAuthoringSnapshot(snapshot) {
  return cloneSnapshot(snapshot);
}

// ../8f1a24ac8c73/hopscotch/src/builder/challenges.ts
var BUILDER_CHALLENGE_SCHEMA = "hopscotch.builder.challenge";
var BUILDER_CHALLENGE_VERSION = 1;
function normalizeSeed(seed) {
  const normalized = seed.trim();
  if (!normalized) return "gateway-001";
  return normalized.slice(0, 64);
}
function hashSeed(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
function defaultHealthySnapshot() {
  const scenario = defaultBuilderScenario();
  const routing3 = setBuilderOspfEverywhere2(scenario.graph, scenario.addressing, scenario.routing, true);
  return createBuilderAuthoringSnapshot({
    graph: scenario.graph,
    addressing: scenario.addressing,
    routing: routing3,
    ethernet: scenario.ethernet,
    linkProfiles: scenario.linkProfiles,
    acl: scenario.acl,
    nat: scenario.nat,
    dhcp: scenario.dhcp,
    ipv6: scenario.ipv6,
    services: scenario.services,
    sourceId: scenario.sourceId,
    destinationId: scenario.destinationId,
    layout: scenario.layout
  });
}
function defaultStaticHealthySnapshot() {
  const scenario = defaultBuilderScenario();
  let routing3 = setBuilderOspfEverywhere2(scenario.graph, scenario.addressing, scenario.routing, false);
  routing3 = installStaticRoutesForWeightedPath2(scenario.graph, scenario.addressing, routing3, "client", "app").routing;
  routing3 = installStaticRoutesForWeightedPath2(scenario.graph, scenario.addressing, routing3, "app", "client").routing;
  return createBuilderAuthoringSnapshot({
    graph: scenario.graph,
    addressing: scenario.addressing,
    routing: routing3,
    ethernet: scenario.ethernet,
    linkProfiles: scenario.linkProfiles,
    acl: scenario.acl,
    nat: scenario.nat,
    dhcp: scenario.dhcp,
    ipv6: scenario.ipv6,
    services: scenario.services,
    sourceId: "client",
    destinationId: "app",
    layout: scenario.layout
  });
}
function createDefaultGatewayChallenge(seedInput) {
  const seed = normalizeSeed(seedInput);
  const healthy = defaultHealthySnapshot();
  const endpoints2 = healthy.graph.nodes.filter((node) => node.kind === "endpoint" && healthy.addressing.defaultGateways[node.id]).sort((left, right) => left.id.localeCompare(right.id));
  if (endpoints2.length < 2) throw new Error("The gateway challenge requires at least two routed endpoints with canonical gateways.");
  const hash = hashSeed(seed);
  const target2 = endpoints2[hash % endpoints2.length];
  const destination = endpoints2.find((endpoint) => endpoint.id !== target2.id) ?? endpoints2[0];
  const expectedGateway = healthy.addressing.defaultGateways[target2.id];
  if (!expectedGateway) throw new Error(`Challenge endpoint ${target2.id} has no healthy default gateway.`);
  healthy.sourceId = target2.id;
  healthy.destinationId = destination.id;
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.addressing.defaultGateways[target2.id] = null;
  broken.addressing = validateBuilderAddressing(broken.graph, broken.addressing);
  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: `gateway-${hash.toString(16).padStart(8, "0")}`,
    seed,
    family: "gateway",
    title: "REMOTE SERVICE UNREACHABLE",
    objective: `Restore IPv4 reachability from ${target2.label} to ${destination.label}. Diagnose the failure with ordinary Builder evidence before repairing canonical configuration.`,
    difficulty: "FOUNDATION",
    healthy,
    broken,
    verification: { kind: "routed-probe", sourceId: target2.id, destinationId: destination.id },
    fault: {
      kind: "missing-default-gateway",
      boundary: "ADDRESSING",
      plane: "routed",
      nodeId: target2.id,
      expectedGateway
    }
  };
}
function createMissingStaticRouteChallenge(seedInput) {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultStaticHealthySnapshot();
  const candidates = ["edge", "core"].map((routerId) => healthy.routing.staticRoutes.find((route) => route.routerId === routerId)).filter((route) => Boolean(route));
  if (candidates.length !== 2) throw new Error("The static-route challenge requires canonical forward and reverse edge routes.");
  const expectedRoute = { ...candidates[hash % candidates.length] };
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.routing = validateBuilderRoutingConfig2(broken.graph, broken.addressing, {
    ...broken.routing,
    staticRoutes: broken.routing.staticRoutes.filter((route) => route.id !== expectedRoute.id)
  });
  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: `static-${hash.toString(16).padStart(8, "0")}`,
    seed,
    family: "static-route",
    title: "STATIC PATH HAS A HOLE",
    objective: "Restore IPv4 reachability from CLIENT to APP in a static-only routed network. Use ordinary Ping / Traceroute, route-table state, and Device Workbench before restoring the missing route.",
    difficulty: "FOUNDATION",
    healthy,
    broken,
    verification: { kind: "routed-probe", sourceId: "client", destinationId: "app" },
    fault: { kind: "missing-static-route", boundary: "ROUTING", plane: "routed", nodeId: expectedRoute.routerId, expectedRoute }
  };
}

// complete-review/extract.mjs
var repo = "/workspace/scratch/8f1a24ac8c73/hopscotch";
var measured = projectMeasuredSnapshot(adaptNetworkDiagnosticsReportV2(JSON.parse(fs.readFileSync(repo + "/scripts/fixtures/measured-workspace-v2.json"))));
var capture = parseCaptureSession(pcapCapture([{ bytes: tcpIpv4Frame(), seconds: 1, fraction: 0 }]));
var journey = buildJourneyScenario();
var data = {
  baseline: "be21750003cf3c097c917ae4340c78a0035ccbc6",
  workspaces: Object.values(WORKSPACE_CATALOG),
  dns: Object.fromEntries(Object.entries(dnsScenarios).map(([mode, s]) => [mode, { duration: s.durationMs, events: s.events, frames: s.events.map((e) => ({ event: e, state: dnsStateAt(mode, e.atMs) })) }])),
  tls: { duration: tlsDurationMs, frames: tlsEvents.map((event3) => ({ event: event3, state: tlsStateAt(event3.atMs) })) },
  http: { duration: HTTP_COMPARISON_DURATION_MS, frames: httpComparisonEvents.map((event3) => ({ event: event3, state: httpComparisonStateAt(event3.atMs) })) },
  tcp: { duration: tcpScenario.durationMs, frames: tcpScenario.events.map((event3) => ({ event: event3, state: tcpStateAt(event3.atMs) })) },
  internet: { graph: simulatedAsGraph, source: DEFAULT_AS_SOURCE, destination: DEFAULT_AS_DESTINATION, paths: enumeratePolicyPaths(simulatedAsGraph, DEFAULT_AS_SOURCE, DEFAULT_AS_DESTINATION) },
  packet: buildPacket(defaultPacketConfig),
  journey: { duration: journey.durationMs, frames: journey.events.map((event3) => ({ event: event3, state: journeyStateAt(journey, event3.atMs) })) },
  failure: { duration: lab01Scenario.durationMs, graph: { nodes: lab01Scenario.nodes, links: lab01Scenario.links }, frames: lab01Scenario.events.map((event3) => ({ event: event3, state: lab01StateAt(event3.atMs) })) },
  measured,
  capture,
  captureFrameBytes: Array.from(tcpIpv4Frame())
};
data.builder = builder_device_workbench_reference_default;
data.provider = builder_provider_reference_default;
data.ipv6Control = builder_ipv6_control_plane_reference_default;
data.observed = observed_reference_default;
data.packetVariants = [];
for (const family of ["ipv4", "ipv6"]) for (const transport of ["tcp", "udp", "icmp"]) data.packetVariants.push(buildPacket({ ...defaultPacketConfig, family, transport }));
data.packetOperations = [buildPacket(defaultPacketConfig), buildPacket({ ...defaultPacketConfig, ttl: 63 }), buildPacket({ ...defaultPacketConfig, ttl: 63, payloadBytes: 128 }), buildPacket({ ...defaultPacketConfig, ttl: 63, payloadBytes: 0 })];
data.captureMulti = parseCaptureSession(pcapCapture(Array.from({ length: 9 }, (_, i) => ({ bytes: i % 3 === 2 ? udpIpv4Frame(new Uint8Array()) : tcpIpv4Frame(), seconds: 1 + i, fraction: 0 }))));
data.captureNg = parseCaptureSession(pcapngSection({ packets: [{ bytes: tcpIpv4Frame(), ticks: 1000000000n }, { bytes: udpIpv4Frame(new Uint8Array()), ticks: 1500000000n }] }));
data.captureTruncated = parseCaptureSession(pcapCapture([{ bytes: tcpIpv4Frame().slice(0, 32), seconds: 1, fraction: 0, originalLength: 54 }]));
data.captureMultiBytes = Array.from({ length: 9 }, (_, i) => Array.from(i % 3 === 2 ? udpIpv4Frame(new Uint8Array()) : tcpIpv4Frame()));
data.captureNgBytes = [Array.from(tcpIpv4Frame()), Array.from(udpIpv4Frame(new Uint8Array()))];
data.captureTruncatedBytes = [Array.from(tcpIpv4Frame().slice(0, 32))];
data.challenges = [createDefaultGatewayChallenge("design-review"), createMissingStaticRouteChallenge("design-review")];
data.physical = { schema: "hopscotch.internet-infrastructure", version: 1, provenance: "PUBLIC DATA", source: "PeeringDB", generatedAt: "2026-08-20T22:00:00.000Z", note: "Repository synthetic worker fixture. Geographic coordinates and names are test data, not real facilities.", facilities: Array.from({ length: 160 }, (_, index) => ({ provenance: "PUBLIC DATA", id: index + 1, name: `Fixture Facility ${String(index + 1).padStart(3, "0")}`, city: index % 2 === 0 ? "Los Angeles" : "Tokyo", country: index % 2 === 0 ? "US" : "JP", latitude: -70 + index % 140, longitude: -170 + index * 17 % 340, networkCount: index + 4, exchangeCount: index % 7 })) };
fs.writeFileSync("/workspace/scratch/0a09595e9300/complete-review/source-data.json", JSON.stringify(data, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));
console.log(JSON.stringify({ tcp: data.tcp.frames.length, failure: data.failure.frames.length, builderDevices: builder_device_workbench_reference_default.devices.length, packets: data.packetVariants.length, captureFrames: data.captureMulti.frames.length, pcapngFrames: data.captureNg.frames.length, physicalFixtureFacilities: data.physical.facilities.length }));

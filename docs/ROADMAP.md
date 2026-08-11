# HOPSCOTCH Roadmap

## Product thesis

HOPSCOTCH is an animated network systems lab for understanding how packets, protocols, routing, Internet-scale policy, and physical infrastructure fit together.

The product remains explanation-first:

- canonical state is deterministic
- animation visualizes state but never determines it
- provenance is explicit
- scale changes preserve causality
- simulated, inferred, observed, public, and measured facts remain distinguishable

## Lab 00 — deterministic packet motion

- [x] simple routed topology
- [x] deterministic event timeline
- [x] packet animation driven by event state
- [x] play / pause / reset / scrub
- [x] reduced-motion mode

## Lab 01 — packet anatomy

- [x] Ethernet / IPv4 / TCP / payload decomposition
- [x] byte-level packet inspection
- [x] contextual field explanations
- [x] checksum and header-size teaching state

## Lab 02 — transport theater

- [x] TCP handshake
- [x] TCP teardown
- [x] sequence / ACK progression
- [x] receive-window teaching state
- [x] transport animation tied to deterministic events

## Lab 03 — routing workbench

- [x] link-state topology
- [x] Dijkstra/SPF route selection
- [x] link failure
- [x] deterministic alternate-path convergence
- [x] route cost editing
- [x] routing events remain independent from animation frame timing

## Lab 04 — topology builder

- [x] editable graph
- [x] custom node/link creation
- [x] source/destination selection
- [x] route recomputation
- [x] link failure controls
- [x] deterministic scenario persistence
- [x] strict authoring limits

## Lab 05 — Internet scale

- [x] simulated AS graph
- [x] customer/provider and peer relationships
- [x] valley-free policy-path enumeration
- [x] teaching LOCAL_PREF behavior
- [x] public evidence overlay
- [x] PeeringDB physical facilities
- [x] physical/inferred/public provenance boundaries

## Lab 06 — URL Journey

One canonical event log and time machine connects the scale-specific labs into a continuous story.

### 06A — cross-scale Journey
- [x] canonical HTTPS Journey event log
- [x] application → routing → Internet → transport → application → packet → pull-back
- [x] global play / pause / scrub / event seek
- [x] scale-aware zoom/morph transitions
- [x] full causal event rail
- [x] hostname input
- [x] optional live/public endpoint context as decoration only
- [x] timestamp-preserving detail-lab jumps
- [x] reduced-motion synchronous state changes

### 06B — transport branch
- [x] TCP + TLS 1.3 + HTTP/2 branch
- [x] QUIC + integrated TLS 1.3 + HTTP/3 branch
- [x] QUIC Initial → Handshake → 1-RTT progression
- [x] branch-specific packet projections
- [x] protocol exclusivity contracts

### 06C — DNS branch
- [x] cache-miss authority walk
- [x] cache-hit local resolution with deterministic TTL
- [x] cache-hit timeline genuinely shortens
- [x] DNS and transport axes compose independently

### 06D — mid-transfer loss
- [x] third `clean / single-loss` scenario axis
- [x] TCP sequence / duplicate-ACK / fast-retransmit recovery
- [x] QUIC packet-number / ACK-range / STREAM recovery
- [x] retransmitted QUIC STREAM data uses a new packet number
- [x] loss → detection → repair → application-recovery scale choreography
- [x] all 8 transport × DNS × impairment combinations under contract

### 06E — scenario authoring + sharing
- [x] canonical serializable Journey schema v1
- [x] optional human-readable scenario name
- [x] strict validation and deterministic time clamping
- [x] JSON import/export
- [x] readable share URL representation
- [x] direct shared-link bootstrap into Journey
- [x] invalid URL/file fails closed without mutating active state
- [x] authored scenarios restore all branch axes and time position
- [x] detail-lab return preserves restored state
- [x] Journey semantic + sharing contracts permanently wired into CI

## Lab 07 — GOD MODE scenario modifiers

GOD MODE impairments are deterministic modifiers over the same canonical Journey rather than a growing pile of hand-authored branches. Modifier truth stays upstream of reducer state, semantic scenes, and animation.

### 07A — modifier pipeline + latency spike
- [x] declarative modifier interface and deterministic ordering
- [x] migrate `single-loss` onto the modifier pipeline without changing its event log
- [x] add `latency-spike` without inventing packet loss
- [x] TCP RTT / SRTT / RTTVAR / RTO teaching state
- [x] QUIC latest/adjusted/smoothed RTT / RTTVAR / PTO teaching state
- [x] explicit `NO LOSS DETECTED` latency boundary
- [x] amber latency visual language distinct from red loss and teal recovery
- [x] schema-v1 sharing/persistence accepts latency

### 07B — route failure + convergence
- [x] distinct `route-failure` modifier before transport
- [x] primary R1 → CORE failure
- [x] route invalidation / SPF recomputation / alternate R2 → CORE installation
- [x] no transport packet loss fabricated for the pre-transport route failure
- [x] route failure can compose with loss and latency
- [x] ROUTE and LOSS remain visually and semantically distinct

### 07C — modifier composition
- [x] modifier sets replace single impairment selection internally
- [x] canonical ordering independent of UI click order
- [x] route-failure → single-loss → latency-spike composition
- [x] schema v1 compatibility for zero/single modifier
- [x] schema v2 sharing/persistence for composed modifier sets
- [x] browser persistence migration
- [x] permanent composition contract

### 07D — mid-transfer path outage
- [x] distinct `path-outage` modifier
- [x] active R1 → CORE fails after response transfer begins
- [x] route invalidation / SPF / alternate cost-52 route installation
- [x] established transport/TLS state survives route convergence
- [x] TCP ACK silence → teaching RTO → retransmission
- [x] QUIC PTO/probe → new packet number after route convergence
- [x] ROUTE and OUTAGE remain mutually exclusive on the two-path topology
- [x] LOSS + OUTAGE + LATENCY compose sequentially
- [x] schema v1/v2 support
- [x] timeout-specific transport panels
- [x] permanent path-outage contracts
- [x] exact production-artifact desktop/mobile/reduced-motion audit

### 07E — congestion + queue growth
- [x] distinct no-drop congestion modifier
- [x] queue occupancy and queueing delay rise before feedback
- [x] ECN CE signal distinct from packet drop
- [x] TCP/QUIC congestion-controller response reduces cwnd without inventing retransmission
- [x] queue drains after response
- [x] loss remains a separate modifier
- [x] deterministic composition and persistence
- [x] permanent congestion contract

### 07F — DNS failure + retry
- [x] distinct DNS failure modifier
- [x] cache-miss timeout/retry semantics
- [x] cache-hit shielding remains correct
- [x] transport is never fabricated before successful DNS resolution
- [x] deterministic composition and persistence
- [x] permanent DNS-failure contract

### 07G — server failure + safe retry
- [x] distinct `server-failure` modifier at the HTTP/application boundary
- [x] canonical GET reaches an established TCP/H2 or QUIC/H3 + TLS connection before failure
- [x] reachable service returns real HTTP 503 Service Unavailable with `Retry-After: 1`
- [x] client waits exactly one teaching second on the same established connection
- [x] service becomes ready and the canonical idempotent GET is retried without a new transport/TLS handshake
- [x] explicit server metrics record status, retry interval, GET/idempotency, retry safety, and connection reuse
- [x] successful response/data and later response-path modifiers shift by a deterministic 1.7 s episode
- [x] server-failure-only scenarios add no loss detection, retransmission, RTO/PTO, or transport/TLS handshake
- [x] TCP/H2 and QUIC/H3 preserve the same HTTP-layer failure/retry semantics
- [x] canonical DNS FAIL → ROUTE → SERVER → LOSS → OUTAGE → LATENCY → CONGESTION composition independent of UI selection order
- [x] schema-v1 single SERVER and schema-v2 composed sharing/persistence compatibility
- [x] eighth GOD MODE selector, server service-state panel, rail marker, and scrubber marker
- [x] mobile eight-control 4×2 layout remains collision- and overflow-free with viewport-stable playback
- [x] permanent server failure/model/composition contract wired into `npm run check`
- [x] exact production-artifact desktop/mobile/reduced-motion audit

### 07H — partition + terminal unreachable state
- [x] distinct terminal `partition` modifier that runs after recoverable response-path modifiers
- [x] fail both R1 → CORE and R2 → CORE exits rather than inventing a third recovery path
- [x] SPF/recomputation runs with zero candidate routes and no alternate installation
- [x] route state becomes `unreachable` with active path `none`
- [x] existing TCP/QUIC state becomes `stalled`, not magically closed
- [x] TCP scene explicitly shows `NO IP PROGRESS`; QUIC may retain 1-RTT crypto state separately from reachability
- [x] terminal state exposes `journeyFailed = true` and `failureReason = network-unreachable`
- [x] remove successful `response.ready`, `transfer.complete`, and `journey.complete` tail after partition
- [x] no fabricated RTO/PTO recovery, successful retransmission, successful probe, or post-partition route installation
- [x] partition composes last after earlier recoverable modifiers while ROUTE/OUTAGE remain mutually exclusive with each other
- [x] schema-v1 single PARTITION and schema-v2 composed sharing/persistence compatibility
- [x] ninth GOD MODE selector, dual-link failure routing scene, stalled transport state, terminal NO ROUTE scene, rail marker, and scrubber marker
- [x] mobile nine-control 3×3 layout remains collision- and overflow-free with viewport-stable playback
- [x] permanent partition/model/composition contract wired into `npm run check`
- [x] exact GitHub Actions production-artifact desktop/mobile/reduced-motion audit

### 07I — BGP route leak + policy anomaly
- [x] distinct `route-leak` modifier at the interdomain/BGP policy boundary
- [x] reuse the existing Lab 05 documentation-AS graph and valley-free policy enumerator instead of inventing a second BGP model
- [x] legitimate AS64504 → AS65540 → AS65538 path remains `peer → down` with teaching LOCAL_PREF 200
- [x] AS64500 leaks a peer-learned AS65538 route upward to provider AS64504
- [x] leaked AS64504 → AS64500 → AS65538 path is physically connected but `down → peer` and rejected by the normal valley-free enumerator
- [x] deterministic teaching LOCAL_PREF changes 200 → 300 while the leaked customer advertisement is selected
- [x] explicit policy metrics keep forwarding reachability separate from selected-path/export-policy compliance
- [x] UI simultaneously shows `REACHABLE = YES` and `POLICY COMPLIANT = NO`
- [x] anomaly containment withdraws the leak and restores the legitimate peer path before transport begins
- [x] LEAK-only scenarios fabricate no local route failure, partition, transport loss/recovery, RTO/PTO, TLS failure, or server failure
- [x] canonical DNS FAIL → ROUTE → LEAK → SERVER → LOSS → OUTAGE → LATENCY → CONGESTION → PARTITION composition is independent of UI selection order
- [x] schema-v1 single LEAK and schema-v2 composed sharing/persistence compatibility
- [x] tenth GOD MODE selector, Internet policy panel, distinct rail marker, and scrubber marker
- [x] mobile ten-control 4 + 4 + 2 layout remains collision- and overflow-free with viewport-stable playback
- [x] permanent route-leak/Lab-05-model/composition contract wired into `npm run check`
- [x] exact GitHub Actions production-artifact desktop/mobile/reduced-motion audit with zero runtime/console errors

**Lab 07 GOD MODE modifier series complete.** Reachability, policy correctness, routing reachability, transport recovery, latency, congestion, DNS availability, and application-service availability remain separate semantic dimensions.

## Measured/native mode — future

Browser-visible evidence is intentionally limited. A future native measurement source may provide data that browsers cannot legitimately observe, such as local interfaces, route tables, traceroute/ICMP, richer transport telemetry, and packet-level captures.

- [x] define native measurement provenance contract
- [ ] keep measured state separate from simulated Journey state
- [ ] ingest native/network-diagnostics data without pretending it is globally complete
- [ ] map measured facts into existing semantic scenes where appropriate

## Performance + rendering — complete hardening baseline

- [x] DOM/CSS for controls and text
- [x] SVG for focused topology/protocol scenes
- [x] Canvas for dense AS scenes
- [x] WebGL for physical Internet scale
- [x] renderer performance budget and profiling harness
- [x] high-density stress scenarios
- [x] broader browser/GPU compatibility pass

## Non-goals

- emulating every vendor CLI
- matching Packet Tracer device breadth
- pretending inferred Internet topology is ground truth
- using animation as simulation truth
- presenting public collector observations as the viewer’s measured forwarding path
- adding motion that does not explain state, causality, scale, or interaction

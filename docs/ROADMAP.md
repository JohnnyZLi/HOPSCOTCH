# HOPSCOTCH roadmap

HOPSCOTCH grows as polished vertical slices. A slice is complete only when its model is deterministic, its truth boundary is explicit, CI is green, and the exact production artifact has been exercised visually.

## Lab 00 — Foundation

- [x] React / TypeScript / Vite shell
- [x] Motion + Anime.js as first-class dependencies
- [x] deterministic event/reducer architecture
- [x] abstraction-scale navigation
- [x] Cloudflare Worker + Static Assets runtime
- [x] production custom-domain deployment
- [x] lockfile, CI, and production-build artifact
- [x] reduced-motion baseline
- [x] broader cross-browser/performance baseline

## Lab 01 — Failure + recovery

- [x] redundant six-node routed topology
- [x] active application flow
- [x] link failure injection
- [x] OSPF-style control-plane propagation
- [x] deterministic route recomputation
- [x] traffic failover
- [x] global pause / scrub / replay
- [x] causal event inspector
- [x] Linux Chromium desktop/mobile audit

## Lab 02 — Packet microscope

- [x] Ethernet + IPv4/IPv6 + TCP/UDP deterministic packet model
- [x] IPv4 header checksum derivation
- [x] TCP/UDP pseudo-header checksum derivation
- [x] peelable encapsulation layers
- [x] raw bytes mapped to selected header fields
- [x] payload/TTL/protocol mutations update derived lengths/checksums
- [x] cross-link to the source Lab 01 event
- [x] Linux Chromium desktop/mobile audit

## Lab 03 — Protocol theater

### 03A — TCP
- [x] three-way handshake + teardown
- [x] deterministic segment loss
- [x] duplicate ACKs + fast retransmit
- [x] congestion-window / ssthresh teaching model
- [x] packet-microscope cross-link

### 03B — DNS
- [x] recursive client query vs iterative resolver work
- [x] root → TLD → authoritative referrals
- [x] cache insertion and deterministic TTL
- [x] cache-hit replay without upstream DNS work

### 03C — TLS 1.3
- [x] ClientHello / ServerHello negotiation
- [x] TLS 1.3 encryption boundary
- [x] symbolic key-schedule stages without fabricated secret bytes
- [x] certificate / CertificateVerify / Finished progression
- [x] application-key transition

### 03D — HTTP/2 vs HTTP/3/QUIC
- [x] synchronized two-resource comparison
- [x] same logical loss in both lanes
- [x] TCP connection-level head-of-line blocking
- [x] QUIC stream-level ordering independence
- [x] explicit QUIC connection-wide congestion-response caveat

## Lab 04 — Network Builder

### 04A — deterministic builder
- [x] graph truth separated from draggable layout
- [x] source/destination selection
- [x] weighted route selection and explanation
- [x] link cost edits
- [x] fail/restore links
- [x] partition detection

### 04B — persistence
- [x] local save/restore
- [x] JSON import/export
- [x] strict scenario validation
- [x] storage adapter separated from route model

### 04C — topology authoring
- [x] mutable routers/endpoints/links
- [x] atomic node deletion
- [x] arbitrary validated graph persistence
- [x] schema v2 with v1 migration

## Lab 05 — Internet scale

### 05A — simulated AS policy theater
- [x] Canvas renderer
- [x] documentation-only ASNs
- [x] peer / provider / customer relationships
- [x] curated valley-free teaching policy
- [x] relationship failure and reroute
- [x] explicit unreachable state

### 05B — observed vs inferred evidence
- [x] shared provenance model
- [x] Cloudflare edge-observed request metadata
- [x] deterministic DNS destination context
- [x] RIPE public prefix/origin context
- [x] RIPE collector AS-path observations
- [x] partial-success/error handling
- [x] no claim that a collector path is “your route”

### 05C — physical Internet

- [x] Three.js/WebGL globe
- [x] public PeeringDB facility coordinates
- [x] bounded Worker adapter + cache policy
- [x] raycast facility selection
- [x] inferred great-circle corridor
- [x] explicit `PUBLIC DATA` vs `INFERRED` boundary
- [x] WebGL-unavailable fallback

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
- [x] latency panel wired into the actual Journey theater
- [x] exact production-artifact desktop/mobile/reduced-motion audit

### 07B — pre-transport route failure + convergence
- [x] modifier pipeline expanded over the entire canonical Journey
- [x] deterministic primary-link failure after gateway selection
- [x] installed-route invalidation and SPF-style recomputation
- [x] cost-22 primary → cost-52 alternate route installation
- [x] convergence guaranteed before TCP SYN / QUIC Initial
- [x] identical routing projection for TCP/H2 and QUIC/H3
- [x] cache-miss and cache-hit route timelines
- [x] no false transport timeout/loss semantics in the pre-transport route modifier
- [x] direct jump into the detailed Lab 01 failure story and timestamp-preserving return
- [x] CLEAN / LOSS / LATENCY / ROUTE selector and route semantic scene
- [x] schema-v1 sharing/persistence accepts route failure
- [x] permanent 16-scenario GOD MODE CI contract
- [x] exact production-artifact desktop/mobile/reduced-motion audit

### 07C — modifier sets + causal composition
- [x] replace the single mutually-exclusive impairment choice with a canonical ordered modifier set
- [x] preserve schema-v1 zero/single-modifier links and files through migration
- [x] schema-v2 portable representation for composed modifier sets
- [x] define deterministic compatibility/sequentialization rules between modifiers
- [x] prove modifier order does not depend on UI selection order
- [x] compose ROUTE + LOSS, ROUTE + LATENCY, LOSS + LATENCY, and all three without duplicating the base Journey
- [x] expose selected causes separately from the current active impairment phase
- [x] keep route/loss/latency semantic colors independently inspectable in the rail and scrubber
- [x] browser persistence migrates from the legacy impairment key to canonical modifier sets
- [x] detail-lab round trips preserve the complete modifier set and timestamp
- [x] permanent pair/triple composition and browser-migration contracts in CI
- [x] exact production-artifact desktop/mobile/reduced-motion audit

### 07D — mid-transfer path outage + cross-layer recovery
- [x] distinct `path-outage` modifier rather than overloading pre-transport `route-failure`
- [x] fail the active R1 → CORE path while response data is already in flight
- [x] preserve routing causality: failure → invalidation → SPF → cost-52 alternate installation
- [x] preserve the established transport/TLS connection across route convergence
- [x] TCP branch uses ACK silence → 1 s teaching RTO → byte-range retransmission
- [x] QUIC branch exposes PTO/probe behavior while routing is unavailable and retransmits STREAM data in a new packet number after convergence
- [x] `ROUTE` and `OUTAGE` are mutually exclusive on the current two-path teaching topology rather than inventing a third recovery path
- [x] LOSS + OUTAGE + LATENCY canonical composition with latency sequenced after the latest transport recovery
- [x] schema-v1 single-modifier and schema-v2 composed sharing/persistence compatibility
- [x] GOD MODE OUTAGE selector, route scene reuse, and outage-specific RTO/PTO teaching panel
- [x] permanent state/model/composition contract wired into `npm run check`
- [x] exact production-artifact desktop/mobile/reduced-motion audit

### 07E — congestion + queue growth
- [x] distinct `congestion` modifier rather than treating high RTT as an implicit congestion declaration
- [x] deterministic 160 Mb/s offered load against a 100 Mb/s ECN-capable teaching bottleneck
- [x] explicit queue capacity, occupancy, queue-delay, ECN, cwnd, ssthresh, signal, and drop metrics
- [x] queue occupancy and delay rise before the transport congestion response
- [x] TCP branch uses delivered CE marks → ECE feedback → CWR with cwnd/ssthresh reduction
- [x] QUIC branch uses delivered CE marks → ACK_ECN CE-counter feedback with cwnd reduction
- [x] congestion-only scenarios preserve contiguous TCP/QUIC delivery with no loss-detection or retransmission event
- [x] dropped-packet count remains zero in the base ECN story
- [x] queue drains after offered load falls below bottleneck service rate
- [x] canonical LOSS → OUTAGE → LATENCY → CONGESTION composition independent of UI selection order
- [x] schema-v1 single CONGESTION and schema-v2 composed sharing/persistence compatibility
- [x] sixth GOD MODE selector, congestion panel, ECN packet card, rail marker, and scrubber marker
- [x] mobile six-control layout remains collision- and overflow-free
- [x] permanent congestion/model/composition contract wired into `npm run check`
- [x] exact production-artifact desktop/mobile/reduced-motion audit

### 07F — DNS failure + retry path
- [x] distinct `dns-failure` modifier placed before routing/transport modifiers in canonical order
- [x] cache-miss recursive query → primary resolver silence → timeout → secondary recursive retry → authority walk
- [x] timeout represented as absence of a DNS response rather than fabricated NXDOMAIN/SERVFAIL
- [x] retry uses a new transaction context and adds a deterministic 1.2 s downstream penalty
- [x] cache-hit path masks the simulated upstream outage without inventing any query, timeout, retry, or retry delay
- [x] explicit DNS `timeout` / `retrying` states plus masked-outage impairment state
- [x] timeout/retry state normalizes when authority referrals resume; masked state normalizes when routing begins
- [x] canonical DNS FAIL → ROUTE → LOSS → OUTAGE → LATENCY → CONGESTION composition independent of UI selection order
- [x] schema-v1 single DNS FAIL and schema-v2 composed sharing/persistence compatibility
- [x] seventh GOD MODE selector, timeout/retry/masked DNS scene banners, rail marker, and scrubber marker
- [x] mobile seven-control 4+3 layout remains collision- and overflow-free
- [x] permanent DNS failure/model/composition contract wired into `npm run check`
- [x] exact production-artifact desktop/mobile/reduced-motion audit

### 07G — server service unavailable + safe retry
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

## Measured/native mode — ongoing

Browser-visible evidence is intentionally limited. A future native measurement source may provide data that browsers cannot legitimately observe, such as local interfaces, route tables, traceroute/ICMP, richer transport telemetry, and packet-level captures.

- [x] define native measurement provenance contract
- [x] keep measured state separate from simulated Journey state
- [x] ingest native/network-diagnostics data without pretending it is globally complete
- [x] explicit session-only Network Diagnostics report import + provenance-first measured workspace
- [x] map measured facts into existing semantic scenes where appropriate
- [x] explicit loopback-only Network Diagnostics bridge transport with no scanning, polling, credentials, or alternate truth path

## Lab 10 — Product surface

### 10A — Explore launcher
- [x] persistent Explore entry point in the global shell
- [x] overview hero exposes the full lab catalog directly
- [x] featured Watch / Break / Build starting points
- [x] direct one-click access to every major protocol, Internet, and measured workspace
- [x] launcher stays presentation/navigation-only and cannot become simulation truth
- [x] keyboard Escape, modal semantics, reduced-motion behavior, and mobile layout
- [x] permanent Explore routing contract wired into `npm run check`

### 10B — Canonical deep links + browser history
- [x] canonical URL for every major lab and Internet/evidence workspace
- [x] direct loads derive the initial lab from `window.location.pathname`
- [x] internal lab changes update browser history without reloading the simulation
- [x] browser Back / Forward restores the matching HOPSCOTCH workspace
- [x] old root-level `?journey=...` share links migrate to `/journey?...`
- [x] unknown and trailing-slash routes canonicalize deterministically
- [x] Cloudflare SPA fallback serves deep links while `/api/*` remains Worker-first
- [x] permanent navigation contract wired into `npm run check`


### 10C — Action-first overview
- [x] Watch a Request / Break the Network / Build a Network are the three first-class overview choices
- [x] Explore, measured evidence, X-Ray, and source move to a secondary utility row
- [x] remove the scale-dependent extra hero CTA so network scale and product navigation stay separate concepts
- [x] preserve the existing Explore launcher as the complete catalog rather than duplicating all 12 labs on the home screen
- [x] compact mobile action rows keep all three primary choices visible without a tall card stack
- [x] home action component stays presentation-only and cannot import Journey, simulation, or measurement truth
- [x] permanent home-action contract wired into `npm run check`


### 10D — One-click scenario gallery
- [x] expose eight curated failure/protocol stories inside Explore without increasing the lab count
- [x] DNS outage, route failover, mid-transfer path outage, congestion, BGP route leak, terminal partition, HTTP 503, and QUIC loss presets
- [x] every preset maps to an existing canonical Journey modifier; no gallery-specific event generator exists
- [x] preset selection launches Journey from t=0 with autoplay so the causal story is visible from the beginning
- [x] preset URLs use the existing Journey share-query codec under `/journey?...`
- [x] scenario catalog/presentation stays separate from Journey construction truth
- [x] responsive gallery collapses from 4-column → 2-column → compact mobile rows
- [x] permanent scenario-gallery contract wired into `npm run check`

## Lab 11 — Deeper Network Builder

### 11A — L3 addressing foundation
- [x] keep weighted graph/path truth unchanged while adding a separate IPv4 addressing model
- [x] one explicit IPv4 segment per graph link with two named node interfaces
- [x] deterministic private /30 address plan for default and newly authored links
- [x] editable /8–/30 segment CIDRs with automatic interface renumbering
- [x] editable interface IPv4 addresses with host-range, duplicate-address, and overlapping-subnet rejection
- [x] endpoint default gateways must reference a directly connected router interface
- [x] device inspector lists stable ethN interfaces, addresses, segment CIDRs, and link identity
- [x] topology add/delete operations reconcile addressing without renumbering surviving segments
- [x] Builder scenario schema v3 persists addressing; v1/v2 files migrate deterministically
- [x] schema-v3 high-density 32-node / 96-link round trip remains inside existing ceilings
- [x] UI explicitly states addressing does not change weighted path cost yet; route tables are the next slice
- [x] permanent Builder L3 addressing contract wired into `npm run check`

### 11B — Connected + static routing
- [x] derive connected route-table entries from active L3 interfaces; failed links withdraw connected reachability
- [x] add explicit static routes on router nodes with destination prefix, directly connected next hop, and metric
- [x] route lookup uses longest prefix → administrative distance → metric → deterministic ID
- [x] connected routes use AD 0 and static routes AD 1
- [x] endpoint forwarding uses on-link delivery or the configured default gateway
- [x] deterministic hop-by-hop L3 forwarding trace detects no-route, link-down, invalid-next-hop, and forwarding-loop states
- [x] graph path and L3 forwarding are shown separately; a graph can be physically reachable while IP forwarding is not configured
- [x] explicit INSTALL STATIC PATH snapshots the current weighted path without creating automatic reconvergence
- [x] static path stays broken after a link failure even when the weighted graph finds an alternate path; reinstall is an explicit user action
- [x] selected-router route table exposes C/S source, prefix, next hop, outgoing interface, AD, metric, active/down state, and route deletion
- [x] manual static route editor supports /0–/32 and only directly connected next-hop interface addresses
- [x] addressing/topology changes reconcile invalid static routes instead of silently retaining broken configuration
- [x] Builder scenario schema v4 persists routing; v1/v2/v3 files migrate with an empty static table
- [x] high-density schema-v4 round trip preserves addressing and empty routing at the 32-node / 96-link ceiling
- [x] permanent Builder static-routing/forwarding contract wired into `npm run check`

### 11C — Single-area OSPF control plane
- [x] keep weighted graph truth, OSPF control-plane truth, and L3 forwarding truth as separate layers
- [x] explicit per-router OSPF Area 0 enablement with endpoints excluded from participation
- [x] derive FULL/DOWN router adjacencies only from active OSPF-enabled router-router links
- [x] advertise active connected prefixes into a deterministic Area 0 link-state view
- [x] run deterministic SPF over OSPF router adjacencies using Builder link cost as OSPF teaching cost
- [x] install OSPF routes with AD 110 behind connected AD 0 and static AD 1
- [x] automatic OSPF reconvergence after link failure, restore, or cost change without changing static-route semantics
- [x] route table exposes O routes, next hop, outgoing interface, AD, metric, and origin
- [x] selected-router control-plane inspector exposes Area 0 participation, LSDB component, prefixes, and neighbor state
- [x] Builder scenario schema v5 persists OSPF configuration; v1-v4 migrate with OSPF disabled
- [x] high-density schema-v5 round trip preserves the 32-node / 96-link ceiling with OSPF disabled by default
- [x] permanent Builder OSPF contract wired into `npm run check`

### 11D — Active probes: Ping + Traceroute
- [x] PING consumes the existing hop-by-hop L3 forwarding engine instead of calculating its own route
- [x] Echo success requires both forward Echo Request and independently evaluated reverse Echo Reply reachability
- [x] ICMP traceroute expires TTL only at router hops and models Time Exceeded return-path reachability
- [x] no fabricated RTT: Builder link cost remains routing/control-plane cost, not milliseconds
- [x] probe failure preserves the underlying no-route, gateway, link, next-hop, loop, or hop-limit reason
- [x] OSPF failover is visible by rerunning the same probe after topology reconvergence
- [x] probe history is session-only snapshot state and is not serialized into Builder scenarios
- [x] active probe links are visually distinct from weighted graph and steady-state L3 forwarding highlights
- [x] probe attempts can jump to Lab 02 with a seeded IPv4 ICMP Echo Request and the actual Builder source/destination addresses + TTL
- [x] Packet Microscope supports ICMP/ICMPv6 control-message headers without changing default TCP/UDP behavior
- [x] permanent active-probe contract wired into `npm run check`

### 11E — Ethernet LANs + switching foundation
- [x] add a bounded Layer-2 fabric with endpoint, switch, and router device roles inside Network Builder
- [x] keep Ethernet/LAN truth separate from the existing routed point-to-point /30 graph instead of silently reinterpreting old links
- [x] explicit access-port VLAN membership and link-up/down state
- [x] deterministic VLAN-scoped MAC learning/FDB derivation from each flow
- [x] unknown-unicast flood-and-learn teaching state followed by learned unicast return
- [x] same-VLAN forwarding stays Layer 2 and leaves IP TTL unchanged
- [x] Layer-2 path search permits switches as transit while endpoints/routers remain edge devices
- [x] permanent Ethernet switching contract wired into `npm run check`

### 11F — VLANs, trunks + inter-VLAN routing
- [x] VLAN IDs 1–4094 with named IPv4 broadcast domains
- [x] explicit trunk mode with bounded allowed-VLAN lists; endpoints cannot become trunk ports
- [x] trunk filtering can isolate one VLAN without breaking another VLAN carried on the same physical link
- [x] router-on-a-stick device owns explicit per-VLAN IPv4 interfaces
- [x] endpoint gateways must match the router interface used for inter-VLAN forwarding
- [x] inter-VLAN flow is two Layer-2 segments separated by one routed hop and one TTL decrement
- [x] switch FDB state remains keyed by switch + VLAN + MAC
- [x] Builder scenario schema v6 persists LAN/VLAN configuration while derived FDB/flow observations remain session-only
- [x] v1–v5 routed scenarios migrate to v6 with an empty LAN fabric rather than fabricated Layer-2 state
- [x] permanent VLAN/trunk/inter-VLAN contract wired into `npm run check`

### 11G — ARP + Layer-2/Layer-3 resolution
- [x] same-subnet endpoints ARP for the destination while off-subnet endpoints ARP for their configured gateway
- [x] routed inter-VLAN delivery performs independent gateway-side and destination-side ARP resolution
- [x] ARP Request broadcast and Reply unicast follow the current VLAN + STP forwarding topology
- [x] session-only ARP cache produces explicit cache hits and can be cleared without mutating topology
- [x] unresolved targets, blocked paths, and unsafe STP-disabled loops fail closed

### 11H — STP / Layer-2 loop control
- [x] deterministic root-bridge election from bridge priority + MAC + stable device ID
- [x] per-VLAN root-path tree with explicit FORWARDING/BLOCKING switch segments
- [x] redundant VLAN-10 switch triangle demonstrates blocked links without changing VLAN-20 trunk-isolation truth
- [x] forwarding-link failure recomputes the tree and activates the alternate trunk
- [x] STP-disabled Layer-2 cycles are surfaced as unsafe instead of silently terminating looping broadcasts

### 11I — Routed link characteristics
- [x] routing cost remains independent from latency, jitter, bandwidth, loss, MTU, and queue capacity
- [x] deterministic link profiles persist per routed link and reconcile with topology edits
- [x] Ping/Traceroute report simulated RTT, jitter, bottleneck bandwidth, path MTU, and aggregate loss from actual forwarding links
- [x] deterministic replayable loss sampling; no random/non-reproducible packet outcomes
- [x] DF teaching probes fail explicitly when packet size exceeds path MTU; fragmentation is not fabricated

### 11J — ACL / firewall policy
- [x] ordered per-router permit/deny rules with IPv4 prefixes, protocol, and optional TCP/UDP destination port
- [x] first-match rule semantics with explicit default action
- [x] route reachability and policy permission stay separate truth dimensions
- [x] ICMP probes evaluate forward and reverse policy independently, including Time Exceeded replies
- [x] ACL configuration persists while per-flow decisions remain derived

### 11K — NAT / PAT
- [ ] static one-to-one NAT and dynamic PAT use explicit inside/outside interfaces
- [ ] deterministic translation table records original and translated address/port tuples
- [ ] outbound flows create state; unsolicited inbound flows fail without a matching mapping or static rule
- [ ] static port forwarding and translation expiration are visible without conflating NAT state with firewall policy
- [ ] ACL decisions are evaluated at documented pre/post-translation boundaries
- [ ] probes and application flows can explain whether failure is routing, policy, or translation state
- [ ] NAT configuration persists while active translation entries remain derived/session state

### 11L — DHCP + host bootstrap
- [ ] endpoints can begin without an IPv4 lease instead of requiring preconfigured addresses
- [ ] deterministic DISCOVER → OFFER → REQUEST → ACK exchange with transaction/lease state
- [ ] configurable pools, subnet mask, default gateway, and DNS options
- [ ] renewal/rebinding and lease expiration
- [ ] pool exhaustion and invalid/missing option failure states
- [ ] DHCP relay across routed boundaries without pretending broadcasts cross routers directly
- [ ] acquired host configuration feeds the same ARP/routing/application models used by statically configured endpoints

### 11M — OSPF depth + real convergence timing
- [x] explicit Hello/dead timers and adjacency lifecycle rather than instantaneous neighbor loss
- [x] LSA origination/flooding and per-router LSDB state in deterministic link-failure convergence episodes
- [x] SPF scheduling, RIB installation, and FIB transition are distinct causal events
- [x] traffic can encounter stale state during convergence instead of teleporting directly to the final route
- [x] equal-cost multipath with deterministic per-flow selection
- [x] multi-area OSPF with ABRs, inter-area routes, and summarization
- [ ] stub/NSSA and redistribution only after the base multi-area model is stable

### 11N — IPv6 + dual stack
- [x] IPv6 global and link-local interface addressing
- [x] Neighbor Discovery replaces ARP for IPv6 next-hop resolution
- [x] Router Solicitation / Router Advertisement and SLAAC host bootstrap
- [x] ICMPv6 control behavior including Packet Too Big / path-MTU discovery
- [x] IPv6 connected/static forwarding and default routes
- [x] OSPFv3 Area 0 integration with link-local adjacencies and failure reconvergence
- [x] dual-stack application/probe selection keeps IPv4 and IPv6 truth independent
- [x] Duplicate Address Detection plus deterministic duplicate-conflict teaching probes
- [x] Neighbor Unreachability Detection lifecycle: REACHABLE → STALE → DELAY → PROBE → FAILED / recovery
- [x] RA preferred/valid/router lifetimes with deprecation, expiry, and deterministic /64 renumbering
- [x] stateful DHCPv6 SOLICIT → ADVERTISE → REQUEST → REPLY leases kept distinct from RA default-router discovery
- [ ] timed + multi-area OSPFv3 with ABRs and inter-area IPv6 route reasoning
- [ ] IPv6 ACL/firewall policy with independent forward/reverse ICMPv6 evaluation

### 11O — BGP inside Network Builder
- [ ] author routers with documentation ASNs and explicit eBGP/iBGP sessions
- [ ] advertise/withdraw prefixes through a deterministic path-vector control plane
- [ ] expose AS_PATH, LOCAL_PREF, MED, NEXT_HOP, communities, and best-path reasoning
- [ ] prefix lists and route-policy controls affect import/export independently from physical reachability
- [ ] route leaks and hijack-style teaching scenarios reuse the same policy truth as Lab 05 rather than a second BGP model
- [ ] Builder BGP state can project into the Internet-scale AS view and back without changing truth

### 11P — Device CONFIG / STATE / EVENTS workspace
- [ ] every device exposes canonical configuration separately from derived runtime state
- [ ] CONFIG covers interfaces, VLANs, routes, dynamic routing, ACLs, NAT, DHCP, and later service configuration
- [ ] STATE covers ARP/ND, FDB, RIB/FIB, OSPF neighbors/LSDB, BGP RIBs, NAT translations, and DHCP leases
- [ ] EVENTS answers what changed, when, and which upstream event caused it
- [ ] route, packet, adjacency, FDB, and policy objects expose a deterministic “why?” chain
- [ ] state can be inspected at historical timestamps once Builder-wide time travel exists

## Long-term product roadmap — visual causal debugger

The long-term target is not a browser clone of Packet Tracer or a catalog of vendor commands. HOPSCOTCH should let a user build a network, run real simulated traffic through the canonical model, break any layer, and inspect exactly why the observed behavior follows from configuration and state.

### Track A — Builder-wide time machine + causal troubleshooting
- [ ] promote Builder configuration changes, control-plane transitions, forwarding decisions, and flow outcomes into one scrub-able deterministic event timeline
- [ ] inspect every device’s historical state at any timestamp
- [ ] before/after state diffs for route tables, FIB, ARP/ND, FDB, STP, ACL counters, NAT state, DHCP leases, and routing databases
- [ ] causal “why?” chains from user-visible failure back through policy, routing, resolution, topology, and configuration
- [ ] preserve independent truth dimensions such as physical reachability, L2 forwarding, next-hop resolution, route selection, policy permission, translation state, transport state, and application state
- [ ] never collapse a failure into generic “network down” when the model knows the actual boundary

### Track B — Network Builder authoring environment
- [ ] undo/redo over canonical configuration edits
- [ ] copy/paste, multi-select, marquee selection, alignment, and distribution
- [ ] reusable topology groups/templates and collapsible sites
- [ ] labels, annotations, interface-name visibility, topology search, zoom-to-device, and minimap
- [ ] bulk edits for interface/VLAN/link/device properties
- [ ] scenario snapshots and branches so failures/repairs can fork from a clean baseline without destroying it
- [ ] deterministic compare view between scenarios/configurations

### Track C — enterprise Layer 2 / Layer 3 depth
- [ ] RSTP after the base STP model, with faster role/state transitions and failure recovery
- [ ] LACP / EtherChannel as one logical bundle backed by multiple physical members
- [ ] LLDP-style neighbor discovery as derived local state
- [ ] Layer-3 switches, SVIs, routed switch ports, and access/distribution/core designs
- [ ] first-hop redundancy with a vendor-neutral VRRP-style virtual gateway model
- [ ] VRFs with genuinely separate routing tables, including overlapping address space
- [ ] native VLAN / tagged-vs-untagged behavior only when it can be modeled without weakening current VLAN truth

### Track D — end-to-end application traffic in Builder
- [ ] endpoints can host simulated DNS, HTTP/HTTPS, SSH, generic TCP, and generic UDP services
- [ ] a Builder application request consumes DHCP/addressing, ARP/ND, Ethernet, VLAN/STP, routing, ACL/NAT, transport, TLS, and application truth rather than a shortcut path
- [ ] Builder-generated TCP/QUIC sessions reuse the canonical protocol models from Lab 03 / Journey
- [ ] any packet/segment can open Packet Microscope with exact state from the originating Builder flow
- [ ] the same transaction can project between Builder, protocol theater, Journey, and Packet Microscope as different cameras on one simulation

### Track E — data-plane realism
- [ ] packet queues with serialization delay, queue occupancy, capacity, and deterministic scheduling
- [ ] tail drop and ECN behavior share concepts with the existing GOD MODE congestion model
- [ ] traffic generators for single flows, bulk TCP, competing flows, constant-rate UDP, and bursts
- [ ] deterministic bandwidth sharing and per-flow throughput/latency observations
- [ ] IPv4 fragmentation, DF behavior, ICMP Fragmentation Needed, IPv6 Packet Too Big, and PMTU caches
- [ ] PMTUD black-hole scenarios where small traffic succeeds but large application transfers fail because required ICMP is blocked
- [ ] integrate transport congestion/recovery with Builder link/queue truth rather than maintaining isolated approximations

### Track F — routing + policy depth
- [ ] route redistribution between connected/static/OSPF/BGP with explicit provenance and loop hazards
- [ ] policy-based routing without replacing normal destination-based forwarding truth
- [ ] ECMP forwarding based on deterministic flow hashing rather than only displaying equal routes
- [ ] route summarization and intentional black-hole teaching scenarios
- [ ] deeper BGP policy including communities, local policy, withdrawal timing, and route-reflector concepts
- [ ] IS-IS only after OSPF/BGP depth is strong enough that another IGP adds meaningful value
- [ ] avoid protocol-count work such as RIP/EIGRP unless certification coverage becomes an explicit product goal

### Track G — service-provider + overlay networking
- [ ] GRE / IP-in-IP tunnel encapsulation with explicit underlay/overlay path separation
- [ ] IPsec-style and WireGuard-style encrypted tunnel semantics without pretending to implement production cryptography
- [ ] MPLS label push/swap/pop, LSP state, and label forwarding tables
- [ ] VXLAN VNI/VTEP overlays with distinct underlay and overlay reachability
- [ ] EVPN MAC/IP control-plane learning after VXLAN and BGP foundations are mature

### Track H — real evidence import + replay
- [ ] PCAP/PCAPNG import as `CAPTURED` evidence, never simulated truth
- [ ] reconstruct conversations, DNS, TCP streams, retransmissions, RTT observations, ICMP, and TLS metadata from capture-bounded facts
- [ ] replay captured evidence through HOPSCOTCH visualizations while preserving capture provenance and uncertainty
- [ ] traceroute, route-table, interface, and device-state snapshot imports
- [ ] optional parsed Cisco/Juniper/FRR configuration import with `PARSED CONFIG` provenance distinct from observed runtime state
- [ ] never infer a complete network topology from partial evidence without marking the result `INFERRED`

### Track I — native companion integration
- [ ] use the existing loopback-only Network Diagnostics bridge contract as the boundary for richer local measurements
- [ ] surface local interfaces, routes, DNS configuration, traceroute/ICMP, and bounded transport telemetry as `LOCAL MEASURED`
- [ ] correlate local measurements with public routing/facility observations without claiming they are the same evidence source
- [ ] visualize local host → gateway → measured hops → public observations → destination with explicit provenance transitions
- [ ] no credentials, network scanning/discovery, or hidden background collection as a prerequisite for the web product

### Track J — troubleshooting challenges
- [ ] deterministic broken-network scenarios generated from canonical configuration/state rather than hand-authored answer text
- [ ] challenge families for addressing, gateway, VLAN, trunk, STP, ARP/ND, routing, OSPF, ACL, NAT, DHCP, MTU, DNS, transport, and BGP policy failures
- [ ] users diagnose with the same inspectors/probes available in normal Builder instead of special challenge-only tools
- [ ] score reasoning path and evidence gathered, not merely whether the final repair button was clicked
- [ ] reproducible challenge seeds and shareable challenge scenarios

### Track K — vendor-neutral HOPSCOTCH CLI
- [ ] compact read commands such as `show interfaces`, `show arp`, `show mac`, `show route`, `show ospf neighbors`, `show bgp`, `show acl`, `show nat`, `ping`, and `traceroute`
- [ ] later bounded configuration commands mutate the same canonical configuration as the GUI
- [ ] CLI is a second interaction surface, never a second simulator or source of truth
- [ ] deliberately avoid broad vendor syntax emulation and device-image behavior

### Track L — explain-this-network layer
- [ ] deterministic simulator emits structured cause/effect facts before any natural-language explanation exists
- [ ] explanation layer can summarize why a route was selected, packet was dropped, adjacency changed, or application failed
- [ ] explanations cite the canonical configuration/state/events they are interpreting
- [ ] AI may explain simulator output but must never decide routing, forwarding, packet outcomes, or protocol state
- [ ] users can request explanations at novice, operational, and protocol-detail levels without changing simulation truth

### North-star integration
- [ ] a workstation can obtain configuration, resolve a next hop, cross switched/routed domains, traverse policy/NAT, resolve DNS, establish TCP or QUIC/TLS, exchange HTTP, and expose exact packet bytes as one continuous deterministic scenario
- [ ] every abstraction is a projection of shared canonical truth rather than a disconnected lab-specific reenactment
- [ ] failures remain composable across layers while preserving the boundary where each failure actually occurs
- [ ] time, causality, provenance, and inspectability remain first-class even as protocol breadth increases

## Performance + rendering — ongoing

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
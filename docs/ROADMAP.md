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
- [ ] broader cross-browser/performance baseline

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
- [ ] canonical serializable Journey config/schema
- [ ] human-readable scenario names/descriptions
- [ ] import/export
- [ ] shareable URL representation
- [ ] strict forward-compatible validation/migration
- [ ] authored scenarios restore all branch axes and time position

## Measured/native mode — future

Browser-visible evidence is intentionally limited. A future native measurement source may provide data that browsers cannot legitimately observe, such as local interfaces, route tables, traceroute/ICMP, richer transport telemetry, and packet-level captures.

- [ ] define native measurement provenance contract
- [ ] keep measured state separate from simulated Journey state
- [ ] ingest native/network-diagnostics data without pretending it is globally complete
- [ ] map measured facts into existing semantic scenes where appropriate

## Performance + rendering — ongoing

- [x] DOM/CSS for controls and text
- [x] SVG for focused topology/protocol scenes
- [x] Canvas for dense AS scenes
- [x] WebGL for physical Internet scale
- [ ] renderer performance budget and profiling harness
- [ ] high-density stress scenarios
- [ ] broader browser/GPU compatibility pass

## Non-goals

- emulating every vendor CLI
- matching Packet Tracer device breadth
- pretending inferred Internet topology is ground truth
- using animation as simulation truth
- presenting public collector observations as the viewer’s measured forwarding path
- adding motion that does not explain state, causality, scale, or interaction

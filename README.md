# HOPSCOTCH

**See the Internet happen.**

HOPSCOTCH is an interactive network-systems laboratory for making invisible behavior visible—from packet bytes and transport recovery to routing convergence, autonomous-system policy, physical Internet infrastructure, and a single URL request moving across every abstraction layer.

It is not a Packet Tracer clone. HOPSCOTCH treats **time, causality, abstraction, and provenance** as first-class parts of the model. The same scenario can be paused, scrubbed, replayed, inspected, and projected into different semantic views without making animation the source of truth.

## What is implemented

### Failure + routing

- deterministic six-node routed topology
- OSPF-style failure propagation and route recomputation
- traffic failover with causal event inspection
- pause / scrub / replay time machine

### Packet microscope

- Ethernet + IPv4/IPv6 + TCP/UDP packet construction
- real IPv4 and TCP/UDP checksum derivation
- raw-byte ↔ header-field mapping
- animated length/checksum relationships

### Captured-data replay · Track T

- explicit local-only `.pcap` / `.pcapng` import with no upload or silent persistence
- immutable `CAPTURED` frame evidence separated from `INFERRED` conversation/transport interpretations
- deterministic conversation index, semantic event rail, capture time machine, and FOLLOW FLOW focus
- Ethernet/VLAN, IPv4/IPv6, TCP/UDP, ICMP, DNS, and capture-visible TLS metadata decoding
- event → frame → protocol field → exact captured byte lineage
- read-only captured mode in Packet Microscope; generated teaching packets remain explicitly `SIMULATED`

### Protocol theater

- TCP handshake, loss, fast retransmit, congestion response, and teardown
- recursive DNS resolution and cache behavior
- TLS 1.3 negotiation, certificate validation, encryption boundary, and key-schedule stages
- synchronized HTTP/2-over-TCP vs HTTP/3-over-QUIC loss comparison

### Network Builder

- draggable mutable topology with graph truth separated from visual layout
- deterministic weighted route selection
- link-cost edits, failure/restore, partitions, endpoint selection
- router/endpoint/link authoring and deletion
- scenario schema v2 save/restore/import/export with v1 migration

### Internet scale

- Canvas autonomous-system policy theater using documentation ASNs
- typed peer / provider / customer relationships and deterministic rerouting
- Cloudflare edge-observed + RIPE public-routing evidence with strict provenance
- Three.js/WebGL physical Internet globe backed by public PeeringDB facility coordinates
- inferred geometric corridors explicitly separated from measured paths

### URL Journey + GOD MODE

One canonical time machine explains a URL request continuously across application, routing, Internet, transport, and packet scales.

The Journey composes independent transport and DNS axes with a deterministic ordered GOD MODE modifier set:

- **Transport:** TCP + TLS 1.3 + HTTP/2 or QUIC + integrated TLS 1.3 + HTTP/3
- **DNS:** cache miss with the full authority walk or cache hit with deterministic TTL state
- **GOD MODE:** DNS failure/retry, pre-transport route failure, BGP route leak, HTTP 503 service failure/retry, packet loss, mid-transfer path outage, latency spike, ECN congestion/queue growth, and terminal network partition

The modifiers deliberately preserve different failure boundaries instead of collapsing everything into “the network is down”:

- DNS timeout is absence of a DNS response; a cache hit can shield the upstream outage entirely.
- ROUTE converges before transport begins; OUTAGE breaks an active response transfer while preserving the established transport/TLS connection.
- TCP and QUIC recover loss/outage with their own sequence/ACK versus packet-number/STREAM/timer semantics.
- CONGESTION is a zero-drop ECN teaching story: queue growth and congestion response occur without inventing packet loss.
- SERVER is a real HTTP 503 + `Retry-After` episode on the same healthy transport/TLS connection; replay is explicitly justified only for the curated idempotent `GET /`.
- LEAK reuses the existing Lab 05 AS-policy graph to show that **reachability and policy correctness are separate dimensions**.
- PARTITION is terminal: both routed exits disappear, SPF finds zero candidates, transport becomes stalled rather than magically closed, and the Journey ends `network-unreachable` instead of inventing recovery.

`ROUTE` and `OUTAGE` remain mutually exclusive on the current two-path teaching topology rather than inventing a third recovery path. Other compatible modifiers compose in canonical causal order, independent of UI selection order.

Optional live/public endpoint evidence can decorate the Journey, but never rewrites its simulated forwarding path, protocol state, modifier set, or causal event log.

## Architecture

```text
scenario / live source
        ↓
canonical configuration
        ↓
ordered modifier pipeline
        ↓
canonical events
        ↓
deterministic reducer + time machine
        ↓
semantic scene state
        ↓
scale-specific renderer
        ↓
Motion / Anime.js choreography
```

Animation reacts to state. It never determines state.

HOPSCOTCH keeps provenance explicit:

- `SIMULATED`
- `CAPTURED` — immutable bytes and fields decoded from a user-selected packet capture
- `EDGE OBSERVED`
- `PUBLIC COLLECTOR`
- `PUBLIC DATA`
- `INFERRED`
- `LOCAL MEASURED` — local-host, capture-bounded evidence that never becomes simulated Journey truth

See `docs/ARCHITECTURE.md` for the full system boundary, `docs/TRACKT.md` for captured replay, and `docs/ROADMAP.md` for completed and upcoming work.

## Stack

- React + TypeScript + Vite
- Motion for UI, layout, gesture, focus, and cross-scale transitions
- Anime.js for protocol/topology choreography
- SVG for focused protocol/topology scenes
- Canvas for denser autonomous-system views
- Three.js / WebGL for the physical Internet globe
- Cloudflare Workers + Static Assets for production hosting and public-data adapters

Production is configured for `hopscotch.johnnyli.dev`.

## Development

```bash
npm ci
npm run dev
```

Full contract/type/build validation:

```bash
npm run check
```

Production renderer profiling is intentionally separate from the normal correctness gate. Build first, then run the Chrome/Chromium CDP profiler:

```bash
npm run build
npm run performance:profile
# Enforce the versioned stable budgets:
npm run performance:check
```

Use `CHROME_PATH=/path/to/chrome` when browser auto-discovery is not appropriate. Timing counters are diagnostic; stable bundle/DOM/heap/overflow/semantic budgets are enforced by the dedicated Performance workflow.

Cloudflare local runtime:

```bash
npm run build
npm run cf:dev
```

Deploy:

```bash
npm run deploy
```

## Project status

The core product architecture and the full curated Lab 07 GOD MODE modifier series are implemented: deterministic routing, packet inspection, protocol theater, topology authoring, Internet-scale policy/physical views, the cross-scale URL Journey, portable scenarios, multi-cause composition, recoverable cross-layer failures, congestion, application/DNS failures, terminal partition state, and BGP policy anomalies all exist as integrated experiences. Track T now adds the first deterministic captured-data vertical slice from local PCAP/PCAPNG import through conversation/time/event/frame/field/exact-byte lineage without turning evidence into simulation.

Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. Native measurement now has a strict `LOCAL MEASURED` provenance/schema contract, a separate measured-state projection, whitelist-only Network Diagnostics Suite report-v2 ingestion, an explicit session-only measured workspace, and optional target-scoped Journey sidecars without entering simulated truth. Lab 09 can acquire the same validated report either by explicit JSON import or through an explicit loopback-only Network Diagnostics bridge with fixed endpoints, no credentials, no scanning/discovery, and no background polling. The remaining native-side work is **an optional companion bridge/server implementation outside HOPSCOTCH; the web app already has the bounded acquisition contract it needs**.

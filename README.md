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

### URL Journey

One canonical time machine can now explain a URL request continuously across application, routing, Internet, transport, and packet scales.

The Journey composes three deterministic scenario axes:

- **Transport:** TCP + TLS 1.3 + HTTP/2 or QUIC + integrated TLS 1.3 + HTTP/3
- **DNS:** cache miss with the full authority walk or cache hit with deterministic TTL state
- **Impairment:** clean transfer or injected mid-transfer loss with protocol-correct recovery

TCP loss uses sequence/cumulative-ACK semantics. QUIC loss uses packet numbers, ACK ranges, and STREAM offsets; retransmitted STREAM data is carried in a new QUIC packet number.

Optional live/public endpoint evidence can decorate the Journey, but never rewrites its simulated forwarding path.

## Architecture

```text
scenario / live source
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
- `EDGE OBSERVED`
- `PUBLIC COLLECTOR`
- `PUBLIC DATA`
- `INFERRED`

See `docs/ARCHITECTURE.md` for the full system boundary and `docs/ROADMAP.md` for completed and upcoming work.

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

HOPSCOTCH is in active development, but the foundational vertical slices are implemented: deterministic routing failure/recovery, packet inspection, protocol theater, topology authoring, Internet-scale views, and the cross-scale URL Journey all exist as integrated experiences.

Current work is moving from proving individual abstractions toward **composable scenarios, richer failure injection, shareable authored stories, and measured/native data sources where browser visibility ends**.
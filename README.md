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

### URL Journey + GOD MODE

One canonical time machine can explain a URL request continuously across application, routing, Internet, transport, and packet scales.

The Journey composes deterministic transport and DNS axes with an ordered GOD MODE modifier set:

- **Transport:** TCP + TLS 1.3 + HTTP/2 or QUIC + integrated TLS 1.3 + HTTP/3
- **DNS:** cache miss with the full authority walk or cache hit with deterministic TTL state
- **Modifiers:** packet loss, latency spike, pre-transport route failure, and mid-transfer path outage

The mid-transfer outage intentionally crosses abstraction boundaries. Routing invalidates the failed path and installs the surviving route while the already-established transport connection reacts independently: TCP waits for its teaching RTO before retransmitting the missing byte range; QUIC can enter PTO/probe recovery sooner and later retransmits the missing STREAM data in a new QUIC packet number once forwarding is restored.

`ROUTE` and `OUTAGE` remain distinct scenarios. `ROUTE` converges before transport starts; `OUTAGE` breaks an active response transfer. The current two-path teaching topology treats them as mutually exclusive rather than inventing a third recovery path.

Optional live/public endpoint evidence can decorate the Journey, but never rewrites its simulated forwarding path or modifier truth.

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

HOPSCOTCH is in active development, but the foundational vertical slices are implemented: deterministic routing failure/recovery, packet inspection, protocol theater, topology authoring, Internet-scale views, the cross-scale URL Journey, composable GOD MODE modifiers, and protocol-correct mid-transfer path-outage recovery all exist as integrated experiences.

Current work is moving from proving individual abstractions toward **queue/congestion behavior, richer terminal failure stories, measured/native data sources, and renderer/performance stress work**.

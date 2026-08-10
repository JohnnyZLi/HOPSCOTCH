# HOPSCOTCH architecture

HOPSCOTCH treats animation as a renderer of network truth, never as the source of that truth.

The core invariant is:

```text
same scenario + same timestamp = same semantic state
```

Frame rate, animation duration, viewport size, and renderer choice must not change a network outcome.

## System flow

```text
scenario / measurement / public-data source
                  ↓
           canonical events
                  ↓
      deterministic reducer / replay
                  ↓
            semantic state
                  ↓
       scale-specific renderer
                  ↓
      Motion / Anime.js choreography
```

## 1. Canonical models

Pure TypeScript owns topology, packet, protocol, Journey, and scenario state.

Examples currently implemented:

- routed graph + link state + installed route
- packet/header fields and derived checksums
- TCP/DNS/TLS/HTTP protocol traces
- autonomous-system relationships and policy candidates
- Builder scenario schema + migration
- URL Journey scenario configuration and canonical event stream

The model layer knows nothing about React, Motion, Anime.js, SVG, Canvas, WebGL, or Cloudflare.

### URL Journey configuration

The Journey currently composes independent typed axes:

```text
transportProfile  = tcp-h2 | quic-h3
dnsProfile        = cache-miss | cache-hit
impairmentProfile = clean | single-loss
```

The scenario builder generates the resulting canonical event sequence. A UI toggle never directly “makes” a packet disappear or a protocol recover.

## 2. Deterministic time

Time is first-class.

Every curated scenario is replayable from its event log. Seeking to a timestamp reconstructs state by applying deterministic events up to that time.

This enables:

- pause / play / reset
- arbitrary timeline seeking
- event-to-event navigation
- rewind after failure or recovery
- detail-lab jumps that return to the same Journey timestamp
- reduced-motion rendering without changing state semantics

Animation clocks are not simulation clocks.

## 3. Semantic state

Reducers expose inspectable concepts rather than renderer instructions.

Examples:

- active path / route cost / partition state
- packet fields and selected byte ranges
- DNS cache/TTL state
- TCP congestion/retransmission state
- TLS protection stage
- QUIC crypto level
- HTTP stream progress
- Journey abstraction scale
- impairment state: armed / lost / detected / recovering / recovered
- provenance for observed/public/inferred facts

Semantic state is the contract between model and renderer.

## 4. Renderers

HOPSCOTCH uses the cheapest renderer that preserves clarity.

### DOM + CSS

Used for:

- controls
- inspectors
- event rails
- timelines
- text-heavy protocol state
- compact semantic diagrams

### SVG

Used for focused network/protocol scenes where individual paths/nodes remain inspectable.

### Canvas 2D

Used for the autonomous-system theater so denser topology is not represented as dozens or hundreds of React DOM nodes.

### WebGL / Three.js

Used for the physical Internet globe and facility point cloud.

Renderer changes must not alter scenario semantics.

## 5. Motion boundary

### Motion

Owns interface-level transitions:

- layout changes
- focus shifts
- cross-scale zoom/morph behavior
- panels and callouts
- gestures
- draggable Builder nodes
- camera-like scene transitions

### Anime.js

Owns tightly choreographed visualization sequences where timeline control is useful, such as SVG/topology/protocol motion.

The two systems must not fight over the same transform/property on the same element.

Motion is cancellable and cleaned up on unmount. `prefers-reduced-motion` must preserve information with synchronous/instantaneous state transitions.

## 6. Truth + provenance

HOPSCOTCH does not collapse different evidence classes into one fake “ground truth.”

Current provenance labels:

- `SIMULATED` — deterministic HOPSCOTCH scenario/model state
- `EDGE OBSERVED` — facts Cloudflare attaches to the current request
- `PUBLIC COLLECTOR` — routing state observed from public collector vantage points
- `PUBLIC DATA` — published infrastructure facts such as facility coordinates
- `INFERRED` — HOPSCOTCH connects separate facts or draws explanatory geometry without claiming direct measurement

A public collector path is not presented as the viewer’s packet path. An inferred great-circle corridor is not presented as a submarine cable or measured route. Optional live evidence can decorate a simulated Journey but cannot silently rewrite its forwarding path.

## 7. Data adapters + Cloudflare Worker

The Worker is now an active adapter layer rather than only a static-file server.

Current responsibilities include:

- static production assets
- edge-observation API contracts
- bounded DNS/public-routing evidence aggregation
- public PeeringDB facility retrieval/normalization
- explicit partial-failure states
- cache policy for public infrastructure data

Browser-facing contracts intentionally omit request-address identifiers where they are not necessary to the product experience.

External adapters are bounded by validation, timeout, normalization, and provenance rules before data reaches React.

## 8. Persistence boundaries

The Network Builder keeps route computation independent from persistence.

- graph + route model: pure TypeScript
- scenario schema/validation: pure TypeScript
- localStorage: repository adapter
- JSON files: portable scenario representation

The same pattern should be used for future shareable Journey scenarios: schema first, storage/URL/cloud adapter second.

## 9. Protocol correctness boundaries

Curated teaching traces simplify implementation breadth but must not cross protocol semantics.

Examples enforced by contracts:

- QUIC Journey branch has no TCP connection underneath it
- TLS 1.3 state in QUIC is represented through QUIC crypto levels, not a fake TLS-record layer over UDP
- HTTP/3 runs on QUIC streams
- TCP loss uses sequence and cumulative-ACK semantics
- QUIC loss uses packet-number, ACK-range, and STREAM-offset semantics
- retransmitted QUIC data travels in a **new packet number**; the lost packet number is not reused

## 10. Validation strategy

A feature is not complete because it renders once.

Current validation layers:

1. **Pure model contracts** — deterministic route/protocol/Journey assertions under Node.
2. **TypeScript checks** — app + Worker.
3. **Production build** — Vite output generated in CI.
4. **Worker contracts** — deterministic fixtures exercise browser-facing APIs.
5. **Exact-artifact browser audit** — the GitHub Actions production bundle is rendered in Linux Chromium rather than testing only a dev server.
6. **Desktop/mobile/reduced-motion assertions** — overflow, semantic state, navigation, and runtime errors.

## Performance rules

- keep simulation updates independent from animation frame rate
- prefer transforms/opacity for high-frequency DOM motion
- never model Internet-scale density as thousands of DOM nodes
- use Canvas/WebGL when scene density demands it
- keep continuous animation cancellable
- do not load external data directly into renderers without normalization
- profile before increasing scene density
- preserve the exact same semantic result under reduced motion

## Architectural direction

The original proof was one routed-link failure/recovery scenario. That architecture has now scaled across packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, and a cross-scale URL Journey.

The next architectural pressure points are:

- a serializable/shareable Journey scenario schema
- more composable failure and congestion profiles without branch explosion
- native/measured data sources for facts browsers cannot legitimately observe
- renderer/performance budgets for substantially denser scenarios

Those additions should extend the canonical-event/reducer boundary rather than bypass it.
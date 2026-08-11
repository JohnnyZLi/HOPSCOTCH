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
      canonical configuration
                  ↓
       ordered modifier pipeline
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

Modifiers are part of scenario truth. They never live in animation callbacks.

## 1. Canonical models

Pure TypeScript owns topology, packet, protocol, Journey, and scenario state.

Examples currently implemented:

- routed graph + link state + installed route
- packet/header fields and derived checksums
- TCP/DNS/TLS/HTTP protocol traces
- autonomous-system relationships and policy candidates
- Builder scenario schema + migration
- URL Journey configuration + canonical event stream
- GOD MODE modifier sets + deterministic composition

The model layer knows nothing about React, Motion, Anime.js, SVG, Canvas, WebGL, or Cloudflare.

### URL Journey configuration

The Journey has independent transport and DNS axes plus a canonical modifier set:

```text
transportProfile = tcp-h2 | quic-h3
dnsProfile       = cache-miss | cache-hit
modifierIds      = ordered subset of:
                   route-failure
                   single-loss
                   path-outage
                   latency-spike
```

Canonical modifier order is model-defined:

```text
route-failure → single-loss → path-outage → latency-spike
```

Input/UI selection order is normalized before scenario identity or events are generated. Duplicate IDs collapse and unknown IDs fail validation. `route-failure` and `path-outage` are intentionally incompatible on the current two-path teaching topology: the former consumes the alternate path before transport begins, so composing both would require inventing a third recovery path.

Legacy `impairmentProfile` remains an input compatibility layer:

- `clean` maps to `[]`
- a single legacy impairment maps to one modifier
- multiple modifiers derive `impairmentProfile: composed`

### Modifier composition

Modifiers transform the same clean canonical Journey rather than selecting separate hand-authored builders.

Current rules:

- route failure happens before transport and shifts later causal events naturally
- single loss keeps its protocol-correct TCP/QUIC recovery trace
- path outage happens after response data begins and crosses the routing/transport boundary without recreating the connection
- TCP path-outage recovery waits for the teaching RTO after ACK silence; QUIC may enter PTO/probe recovery while routing is still unavailable
- routing convergence restores reachability, but transport separately repairs data lost during the outage
- latency alone changes RTT/timer estimator state without inventing loss
- when recovery modifiers and latency coexist, latency begins after the latest transport recovery so the event log remains strictly ordered and causally legible
- LOSS + OUTAGE + LATENCY therefore composes sequentially without duplicating the base Journey

Every final Journey log must have unique event IDs, unique timestamps, and strictly increasing event time.

## 2. Portable Journey schemas

Portable scenarios store configuration + timestamp, never reducer snapshots.

### Schema v1

Kept for backward compatibility with clean and single-modifier scenarios.

```text
schema
version = 1
hostname
transportProfile
dnsProfile
impairmentProfile
timeMs
name? 
```

Existing v1 links/files remain valid and migrate into the canonical internal modifier representation. New single-modifier path-outage scenarios also fit this representation without requiring a schema bump.

### Schema v2

Used when two or more modifiers are composed.

```text
schema
version = 2
hostname
transportProfile
dnsProfile
modifiers[]
timeMs
name?
```

Readable shared URLs use `journey=2` and a canonical `mods=` list. Import/export validation rebuilds the deterministic scenario and clamps the restored timestamp to its generated duration.

Browser persistence follows the same boundary: canonical modifier sets are stored explicitly, with fallback to the old single-impairment key for migration.

## 3. Deterministic time

Time is first-class.

Every curated scenario is replayable from its canonical event log. Seeking to a timestamp reconstructs state by applying deterministic events up to that time.

This enables:

- pause / play / reset
- arbitrary timeline seeking
- event-to-event navigation
- rewind after failure or recovery
- detail-lab jumps that return to the same Journey timestamp
- composed GOD MODE scenarios that remain seekable
- reduced-motion rendering without changing state semantics

Animation clocks are not simulation clocks.

## 4. Semantic state

Reducers expose inspectable concepts rather than renderer instructions.

Examples:

- active path / route cost / partition state
- selected canonical Journey modifiers
- current impairment phase independent from selected modifiers
- packet fields and selected byte ranges
- DNS cache/TTL state
- TCP sequence/retransmission and RTT/RTO estimator state
- QUIC packet-number/STREAM recovery and RTT/PTO state
- TLS protection stage
- HTTP stream progress
- Journey abstraction scale
- provenance for observed/public/inferred facts

Selected causes and the active causal phase are intentionally separate. A Journey may have LOSS + OUTAGE + LATENCY selected while the current timestamp is still in clean DNS state; later the same scenario may be in routing convergence while the established transport and TLS state remain intact.

Semantic state is the contract between model and renderer.

## 5. Renderers

HOPSCOTCH uses the cheapest renderer that preserves clarity.

### DOM + CSS

Used for controls, inspectors, event rails, timelines, text-heavy protocol state, and compact semantic diagrams.

### SVG

Used for focused network/protocol scenes where individual paths/nodes remain inspectable.

### Canvas 2D

Used for the autonomous-system theater so denser topology is not represented as hundreds of React DOM nodes.

### WebGL / Three.js

Used for the physical Internet globe and facility point cloud.

Renderer changes must not alter scenario semantics.

## 6. Motion boundary

### Motion

Owns interface-level transitions: layout changes, focus shifts, cross-scale zoom/morph behavior, panels/callouts, gestures, draggable Builder nodes, and camera-like scene transitions.

### Anime.js

Owns tightly choreographed visualization sequences where timeline control is useful, such as SVG/topology/protocol motion.

The two systems must not fight over the same transform/property on the same element. Motion is cancellable and cleaned up on unmount. `prefers-reduced-motion` preserves information through synchronous state changes.

Event-rail auto-follow is also bounded as UI behavior: it scrolls the rail container itself and must never move the document viewport as canonical time advances.

## 7. Truth + provenance

HOPSCOTCH does not collapse different evidence classes into one fake ground truth.

Current provenance labels:

- `SIMULATED` — deterministic HOPSCOTCH scenario/model state
- `EDGE OBSERVED` — facts Cloudflare attaches to the current request
- `PUBLIC COLLECTOR` — routing state observed from public collector vantage points
- `PUBLIC DATA` — published infrastructure facts such as facility coordinates
- `INFERRED` — explanatory connection/geometry not directly measured

A public collector path is not presented as the viewer’s packet path. Optional live evidence can decorate a simulated Journey but cannot silently rewrite its transport, DNS, modifier set, forwarding path, or causal event log.

## 8. Data adapters + Cloudflare Worker

The Worker is an adapter layer as well as a static-file runtime.

Current responsibilities include:

- static production assets
- edge-observation API contracts
- bounded DNS/public-routing evidence aggregation
- public PeeringDB facility retrieval/normalization
- explicit partial-failure states
- cache policy for public infrastructure data

External data is validated, normalized, bounded, and labeled before it reaches React.

## 9. Persistence boundaries

Persistence never owns model truth.

Network Builder:

- graph + route model: pure TypeScript
- scenario schema/validation: pure TypeScript
- localStorage/JSON: adapters

URL Journey:

- canonical modifier/config model: pure TypeScript
- v1/v2 schema + migration: pure TypeScript
- sessionStorage, JSON files, and share URLs: adapters

A restored scenario is rebuilt through the canonical builder rather than reviving serialized reducer state.

## 10. Protocol correctness boundaries

Curated teaching traces simplify breadth but must not cross protocol semantics.

Contracts enforce, among other things:

- QUIC Journey branches have no TCP connection underneath them
- TLS 1.3 in QUIC is represented through QUIC crypto levels, not a fake TLS-record layer over UDP
- HTTP/3 runs on QUIC streams
- TCP loss uses sequence and cumulative-ACK semantics
- QUIC loss uses packet-number, ACK-range, and STREAM-offset semantics
- retransmitted QUIC data uses a new packet number; the lost packet number is never reused
- higher RTT alone does not become packet loss
- pre-transport route convergence does not fabricate TCP RTO or QUIC PTO behavior
- a mid-transfer path outage does not silently tear down an established TCP/QUIC/TLS connection
- TCP outage recovery uses ACK silence and the teaching RTO rather than pretending duplicate ACKs survived a dead path
- QUIC outage recovery can expose PTO/probe behavior before routing recovers, but probe traffic cannot repair missing IP reachability
- QUIC STREAM repair after convergence uses a new packet number
- composed modifiers retain each component's protocol-specific semantics

## 11. Validation strategy

A feature is not complete because it renders once.

Current validation layers:

1. **Pure model contracts** — deterministic route/protocol/Journey assertions under Node.
2. **Regression matrices** — legacy clean/single-modifier scenarios remain exact.
3. **Composition contracts** — representative modifier pairs/triples, canonical ordering, timing, and persistence migration.
4. **Schema contracts** — v1 compatibility plus v2 JSON/query round trips and invalid-input handling.
5. **Cross-layer outage contracts** — routing convergence, TCP RTO projection, QUIC PTO/probe behavior, connection continuity, and composed recovery ordering.
6. **TypeScript checks** — app + Worker.
7. **Production build** — Vite output generated in CI.
8. **Worker contracts** — deterministic fixtures exercise browser-facing APIs.
9. **Exact-artifact browser audit** — GitHub Actions production bundle rendered in Linux Chromium.
10. **Desktop/mobile/reduced-motion assertions** — overflow, semantic state, navigation, viewport stability, and runtime errors.

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

The original proof was one routed-link failure/recovery scenario. The architecture has now scaled across packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, and cross-layer mid-transfer path-outage recovery.

The next pressure points are:

- **queue growth/congestion** with explicit separation between delay, loss detection, congestion signals, and sender control response
- DNS/server/partition failure modifiers that terminate or retry a Journey honestly
- route leak / policy-anomaly stories that preserve the distinction between forwarding reachability and policy correctness
- native/measured data sources for facts browsers cannot legitimately observe
- renderer/performance budgets for substantially denser scenarios

Those additions should extend the canonical-event/modifier/reducer boundary rather than bypass it.

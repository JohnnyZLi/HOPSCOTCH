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

Modifiers are scenario truth. They never live in animation callbacks.

## 1. Canonical models

Pure TypeScript owns topology, packet, protocol, Journey, and scenario state. The model layer knows nothing about React, Motion, Anime.js, SVG, Canvas, WebGL, or Cloudflare.

Current canonical domains include:

- routed graph + link state + installed routes
- packet/header fields and derived checksums
- TCP, DNS, TLS, HTTP/2, HTTP/3, and QUIC teaching traces
- autonomous-system relationships and policy candidates
- Builder schema + migration
- URL Journey configuration + canonical event stream
- deterministic GOD MODE modifier composition
- terminal Journey failure state

### URL Journey configuration

The Journey has independent transport and DNS axes plus a canonical modifier set:

```text
transportProfile = tcp-h2 | quic-h3
dnsProfile       = cache-miss | cache-hit
modifierIds      = ordered subset of:
                   dns-failure
                   route-failure
                   server-failure
                   single-loss
                   path-outage
                   latency-spike
                   congestion
                   partition
```

Canonical modifier order is model-defined:

```text
dns-failure
→ route-failure
→ server-failure
→ single-loss
→ path-outage
→ latency-spike
→ congestion
→ partition
```

Input/UI selection order is normalized before scenario identity or events are generated. Duplicate IDs collapse and unknown IDs fail validation.

`route-failure` and `path-outage` remain intentionally incompatible on the current two-path teaching topology: pre-transport ROUTE consumes the alternate path, so composing both would require inventing a third recovery path. `partition` is different: it runs last and may follow either earlier recoverable route story because it removes all remaining reachability rather than requiring another recovery path.

Legacy `impairmentProfile` remains an input compatibility layer:

- `clean` maps to `[]`
- a single modifier maps to that modifier ID
- multiple modifiers derive `impairmentProfile: composed`

### Modifier composition

Modifiers transform the same clean canonical Journey rather than selecting separate hand-authored builders.

Current rules:

- DNS failure is earliest because resolution can fail before route or transport state exists.
- On a cache miss, resolver silence produces a timeout and secondary recursive retry; later causal events shift by the deterministic retry penalty.
- On a cache hit, the same simulated upstream outage is masked by local state; no query, timeout, retry, or delay is fabricated.
- Pre-transport route failure invalidates the primary route, runs SPF, installs the alternate, and converges before transport starts.
- Server failure occurs after the canonical HTTP request but before successful response headers. A reachable service returns HTTP 503 + Retry-After, and the idempotent `GET /` retries on the same transport/TLS state.
- Single loss retains protocol-correct TCP sequence/ACK or QUIC packet-number/STREAM recovery semantics.
- Mid-transfer path outage crosses routing and transport without recreating the connection. Routing restores reachability; transport then repairs missing data.
- Latency changes RTT/timer estimator state without inventing loss.
- Congestion is a zero-drop ECN teaching episode: queue occupancy/delay rise, CE feedback reaches the sender, cwnd falls, and the queue drains.
- Partition runs last. It removes both routed exits, produces zero SPF candidates, stalls the existing transport, removes the successful Journey tail, and terminates with `journey.failed / network-unreachable` rather than inventing recovery.

Every final Journey log must have unique event IDs, unique timestamps, and strictly increasing event time.

## 2. Portable Journey schemas

Portable scenarios store configuration + timestamp, never reducer snapshots.

### Schema v1

Kept for clean and single-modifier scenarios:

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

Existing v1 links/files remain valid. New single-modifier path-outage, congestion, DNS-failure, server-failure, and partition scenarios also fit v1 without a schema bump.

### Schema v2

Used when two or more modifiers are composed:

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

Readable shared URLs use `journey=2` and a canonical `mods=` list. Import/export validation rebuilds the deterministic scenario and clamps restored time to generated duration. Browser persistence follows the same boundary, with fallback to the old single-impairment key for migration.

## 3. Deterministic time

Time is first-class. Every curated scenario is replayable from its canonical event log, and seeking reconstructs state by reducing events up to the requested timestamp.

This enables:

- pause / play / reset
- arbitrary timeline seeking
- event-to-event navigation
- rewind through failure, recovery, or terminal failure
- detail-lab jumps that return to the same Journey timestamp
- composed GOD MODE scenarios that remain seekable
- reduced-motion rendering without semantic changes

Animation clocks are not simulation clocks.

## 4. Semantic state

Reducers expose inspectable concepts rather than renderer instructions.

Examples include:

- active path, route costs, failed links, candidate route count, and recovery availability
- selected canonical modifiers versus current active impairment phase
- DNS cache/TTL, timeout, retry, and masked-outage state
- application-service state and HTTP 503 / Retry-After / idempotency / connection-reuse facts
- TCP sequence/retransmission plus RTT/RTO state
- QUIC packet-number/STREAM recovery plus RTT/PTO state
- queue occupancy/delay, ECN CE count, cwnd, ssthresh, signal, and drop count
- TLS protection stage
- HTTP stream progress
- terminal reachability state: route `unreachable`, transport `stalled`, HTTP `stalled`, `journeyFailed = true`, and `failureReason = network-unreachable`
- Journey abstraction scale and provenance

Selected causes and active causal phase remain separate. A scenario may have many modifiers selected while the current timestamp is still before any of them. A later timestamp may be in DNS retry, HTTP Retry-After wait, transport recovery, congestion response, or terminal partition state while the selected modifier set remains unchanged scenario truth.

Semantic state is the contract between model and renderer.

## 5. Renderers

HOPSCOTCH uses the cheapest renderer that preserves clarity.

### DOM + CSS

Controls, inspectors, event rails, timelines, text-heavy protocol state, and compact semantic diagrams.

### SVG

Focused network/protocol scenes where individual paths and nodes remain inspectable.

### Canvas 2D

Autonomous-system theater and denser topology where hundreds of React DOM nodes would be wasteful.

### WebGL / Three.js

Physical Internet globe and facility point cloud.

Renderer changes must not alter scenario semantics.

## 6. Motion boundary

### Motion

Owns interface-level transitions: layout changes, focus shifts, cross-scale zoom/morph behavior, panels/callouts, gestures, draggable Builder nodes, and camera-like scene transitions.

### Anime.js

Owns tightly choreographed visualization sequences where timeline control is useful, such as SVG/topology/protocol motion.

The two systems must not fight over the same property on the same element. Motion is cancellable and cleaned up on unmount. `prefers-reduced-motion` preserves information through synchronous state changes.

Event-rail auto-follow is also bounded UI behavior: it scrolls the rail container itself and must never move the document viewport as canonical time advances.

## 7. Truth + provenance

HOPSCOTCH does not collapse different evidence classes into one fake ground truth.

Current provenance labels:

- `SIMULATED` — deterministic HOPSCOTCH scenario/model state
- `EDGE OBSERVED` — facts Cloudflare attaches to the current request
- `PUBLIC COLLECTOR` — routing state observed from public collector vantage points
- `PUBLIC DATA` — published infrastructure facts such as facility coordinates
- `INFERRED` — explanatory connection/geometry not directly measured

A public collector path is not the viewer's packet path. Optional live evidence can decorate a simulated Journey but cannot silently rewrite transport, DNS, modifiers, forwarding path, or the causal event log.

## 8. Data adapters + Cloudflare Worker

The Worker is an adapter layer and static-file runtime. Current responsibilities include:

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

Curated teaching traces simplify breadth but must not cross protocol semantics. Contracts currently enforce, among other things:

- DNS timeout means absence of a response, not an answer/referral and not fabricated NXDOMAIN/SERVFAIL.
- Cache-hit DNS shielding creates no upstream query/retry traffic.
- HTTP 503 is a real application-layer response, not DNS silence, packet loss, or path failure.
- The server-failure retry stays on the established TCP/QUIC + TLS state and is justified only for the curated idempotent `GET /`.
- QUIC branches have no TCP connection underneath them; TLS 1.3 is represented through QUIC crypto levels.
- TCP loss uses sequence and cumulative-ACK semantics.
- QUIC loss uses packet-number, ACK-range, and STREAM-offset semantics; retransmitted data uses a new packet number.
- Higher RTT alone is not loss or an implicit congestion signal.
- Pre-transport route convergence does not fabricate RTO/PTO behavior.
- Mid-transfer outage does not silently tear down an established connection.
- TCP outage recovery uses ACK silence + teaching RTO; QUIC may expose PTO/probe behavior, but probes cannot manufacture IP reachability.
- ECN CE marks are delivered congestion signals, not drops; the base congestion story keeps dropped packets at zero.
- Partition removes routing reachability without pretending the established transport object instantly disappears. TCP shows `NO IP PROGRESS`; QUIC may retain 1-RTT crypto state while the separate route state is `NONE`.
- Terminal partition does not fabricate alternate installation, successful retransmission, successful probe, `response.ready`, `transfer.complete`, or `journey.complete` after the cut.
- Composed modifiers retain each component's protocol-specific semantics.

## 11. Validation strategy

A feature is not complete because it renders once.

Current validation layers:

1. **Pure model contracts** — deterministic route/protocol/Journey assertions under Node.
2. **Regression matrices** — legacy clean/single-modifier scenarios remain exact.
3. **Composition contracts** — representative modifier combinations, canonical ordering, timing, and persistence migration.
4. **Schema contracts** — v1 compatibility plus v2 JSON/query round trips and invalid-input handling.
5. **DNS failure contracts** — timeout/retry ordering, unresolved state, cache shielding, and persistence.
6. **Server failure contracts** — HTTP 503/Retry-After, same transport/TLS state, idempotent retry safety, and persistence.
7. **Cross-layer outage contracts** — routing convergence, TCP RTO projection, QUIC PTO/probe behavior, connection continuity, and composed recovery ordering.
8. **Congestion contracts** — queue growth before ECN, protocol-specific feedback, cwnd reduction, zero-drop/no-retransmission semantics, queue drain, composition, and persistence.
9. **Partition contracts** — dual-link failure, zero SPF candidates, stalled-not-closed transport, successful-tail removal, terminal failure state, composition, and persistence.
10. **TypeScript checks** — app + Worker.
11. **Production build** — Vite output generated in CI.
12. **Worker contracts** — deterministic fixtures exercise browser-facing APIs.
13. **Exact-artifact browser audit** — GitHub Actions production bundle rendered in Linux Chromium.
14. **Desktop/mobile/reduced-motion assertions** — overflow, semantic state, navigation, viewport stability, and runtime errors.

## Performance rules

- keep simulation updates independent from animation frame rate
- prefer transforms/opacity for high-frequency DOM motion
- never model Internet-scale density as thousands of DOM nodes
- use Canvas/WebGL when scene density demands it
- keep continuous animation cancellable
- do not load external data directly into renderers without normalization
- profile before increasing scene density
- preserve identical semantic results under reduced motion

## Architectural direction

The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, and terminal network partition behavior.

The next pressure points are:

- route leak / policy-anomaly stories that preserve the distinction between **reachability** and **policy correctness**
- loss-based or AQM variants of congestion only where they remain explicitly distinct from the current zero-drop ECN story
- native/measured data sources for facts browsers cannot legitimately observe
- renderer/performance budgets for substantially denser scenarios

Those additions should extend the canonical-event/modifier/reducer boundary rather than bypass it.

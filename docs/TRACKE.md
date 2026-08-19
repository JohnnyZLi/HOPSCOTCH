# Track E — Data-plane realism

Track E closes the active-roadmap data-plane slice by adding deterministic queueing, bandwidth sharing, congestion feedback, fragmentation, and PMTU behavior **after** canonical Builder forwarding has already selected a path.

It does not introduce another routing engine, another topology model, or a second application/transport simulator.

## Canonical boundary

A Track E run is only available after a successful Track D application transaction.

The application transaction supplies the exact ordered Builder link IDs that the request reached through the canonical routing, L2, policy, NAT, and link gates. Track E consumes those IDs directly.

Track E therefore does **not**:

- calculate another route
- infer a shortest path from the graph
- bypass ACL/NAT/L2 failure truth
- invent a path when the application transaction did not reach the data plane

If the prior transaction fails, the Track E workspace remains unavailable.

## Existing link truth

`BuilderLinkProfile` remains the physical data-plane input boundary. The queue engine consumes existing per-link:

- bandwidth
- latency
- jitter/path characteristics
- MTU
- configured queue capacity

Track E does not persist a second copy of those properties.

## Packet queues and deterministic scheduling

`src/builder/data-plane.ts` models bounded packet tokens through per-link queues.

Each link has:

- one bounded queue capacity in packets from `queuePackets`
- per-flow FIFO packet queues
- a deterministic round-robin admission order
- deterministic round-robin dequeue scheduling
- a bit budget derived from configured link bandwidth and the simulation tick

A dequeued packet advances only to the next canonical link ID in its supplied path. Multi-hop queueing therefore preserves the path selected by Builder forwarding.

The engine records:

- occupancy samples
- peak queue depth
- serialization delay
- queue delay
- transmitted packets/bytes
- utilization
- per-flow delivered throughput
- estimated RTT using canonical path latency plus observed queue/serialization delay

The model is deliberately bounded rather than pretending to be a general-purpose discrete-event packet simulator.

## Traffic generators

Track E exposes the roadmap traffic shapes through the same queue engine:

- single moderate flow
- bulk TCP
- competing TCP/TCP/QUIC flows
- constant-rate UDP
- deterministic on/off UDP bursts

Generators produce packet pressure on the selected Builder path; they do not alter route selection.

## ECN and tail drop

Queue pressure has two distinct outcomes.

ECN-capable flows are CE-marked once occupancy reaches the deterministic marking threshold. A queue at its configured packet ceiling tail-drops new arrivals.

These are recorded separately. A tail drop is not relabeled as ECN and an ECN mark is not relabeled as packet loss.

## Transport response driven by queue truth

TCP and QUIC are responsive senders in the Track E traffic engine.

When a tick produces new CE marks or queue drops for a responsive flow, subsequent offered pressure is reduced deterministically. Clean feedback periods recover sending pressure toward the configured rate.

The run records in-band `TRANSPORT_BACKOFF` and `TRANSPORT_RECOVERY` events and reports the final sender rate and backoff count.

UDP generators do not receive an invented congestion window. Constant-rate UDP remains constant-rate even when the queue marks or drops packets; its observation is explicitly `UDP UNRESPONSIVE` when congestion occurs.

This is the important Track E change from earlier Journey congestion demonstrations: transport response is now driven by the actual Builder queue result rather than by a pre-authored congestion story.

## IPv4 fragmentation

For IPv4 packets larger than the limiting path MTU:

- DF clear permits router fragmentation
- fragment payloads are aligned to 8-byte offsets
- every resulting fragment fits the limiting MTU
- fragmentation does not populate PMTU cache state

With DF set, an oversized packet requires ICMP Fragmentation Needed. A delivered control message records the learned PMTU and allows the next send to be constrained before an oversized packet is emitted.

## IPv4 PMTU cache

IPv4 PMTU learning is bounded Track E **session state**, not persisted network configuration.

The cache is keyed by destination, capped at 32 entries, and is updated only by a valid PMTU result. A cache hit constrains the effective packet size before transmission and does not manufacture another ICMP message.

The workspace resets its IPv4 PMTU session cache when a different application transaction becomes active and also exposes an explicit clear action.

## IPv6 Packet Too Big and canonical cache reuse

Track E does not create a second IPv6 PMTU cache.

Builder already had canonical IPv6 PMTU state in `BuilderIpv6ControlState`, including `pmtuCache`, `pmtuHistory`, reverse-path evaluation, and `checkBuilderIpv6Pmtu(...)`.

For an IPv6 application transaction, the Track E workspace calls that existing control-plane function and writes the returned IPv6 control state through the same Builder session-state callback used by the application workspace.

Consequences:

- IPv6 routers never fragment
- Packet Too Big delivery depends on the canonical reverse IPv6 route
- a delivered PTB updates the existing Builder IPv6 PMTU cache
- a later send uses the cached effective packet size
- a PTB with no valid return path is an explicit PMTUD black hole

## Address-family truth

The PMTU workspace follows the active application transaction's family.

There is intentionally no independent IPv4/IPv6 selector. An IPv4 transaction cannot be reused as if it were proof of an IPv6 path, and vice versa.

## Explicit PMTUD black holes

The workspace can exercise the bounded black-hole case where the required ICMP Fragmentation Needed or ICMPv6 Packet Too Big signal is suppressed.

The resulting state is `BLACK_HOLE` with `TIMEOUT NO PROGRESS`. No PMTU cache entry is learned and the UI does not claim successful transport progress.

For canonical IPv6 PTB processing, an actual missing reverse route produces the same no-progress boundary without needing the suppression toggle.

## Product surface and lazy loading

`BuilderDataPlanePanel` is composed with the existing Track D application workspace inside `BuilderApplicationDataPlaneWorkspace`.

`BuilderApplicationPanel` still provides the outer lazy boundary. `NetworkBuilder` does not statically import the Track E engine or panel.

This keeps queue/PMTU algorithms and their UI out of unconditional startup while preserving Track D's existing Builder/Protocol/Journey/Packet cameras.

The workspace exposes:

- exact canonical path identity
- traffic generator selection
- link utilization/queue/drop/CE observations
- per-flow delivered rate, RTT, queue delay, sender backoff and recovery
- ordered queue/transport events
- transaction-family PMTU evaluation
- fragment layout
- PMTU cache state
- explicit black-hole outcome

## Determinism and boundedness

The engine validates and bounds:

- at most 16 flows
- at most 32 path links per flow
- at most 10 seconds per run
- 5–100 ms simulation ticks
- bounded packet sizes
- bounded queue sample history
- bounded IPv4 PMTU session cache

The same input scenario and Builder link profiles produce the same queue scheduling, ECN/drop decisions, throughput observations, transport feedback events, fragments, and PMTU result.

## Permanent contract

`npm run test:builder-data-plane-contract` is part of `npm run check` and permanently covers:

- canonical-link queue execution
- queue-capacity ceilings
- serialization/queue/RTT observations
- deterministic fair competing-flow sharing
- real queue pressure producing ECN or tail drop
- in-band TCP/QUIC backoff that changes subsequent sender pressure
- UDP non-response and constant offered rate
- single, bulk, competing, CBR UDP, and burst generators
- IPv4 fragmentation with DF clear
- ICMP Fragmentation Needed with DF set
- bounded IPv4 PMTU cache application before retransmission
- IPv6 no-fragment semantics
- Packet Too Big projection
- explicit PMTUD black holes
- product integration with the Track D transaction
- canonical IPv6 PMTU-state reuse
- address-family locking to the transaction
- lazy integration that keeps Track E out of `NetworkBuilder`

Existing IPv6 control-plane contracts continue to cover the deeper canonical PTB reverse-route and PMTU-cache behavior that Track E reuses.

## Validation baseline

The code-complete candidate passed the full repository contract suite, enforced production performance profile, Chrome default, Chrome GPU-disabled, Chrome SwiftShader, Firefox semantic compatibility, and real PCAP/PCAPNG capture replay.

The production profile measured:

- initial JavaScript: **431,980 gzip bytes / 432,000-byte ceiling**
- initial CSS: **34,912 gzip bytes**
- stress Builder: **900 DOM nodes / 900-node ceiling**
- all heap, ready-time, normal seek, and high-density seek/stress budgets: pass

No production ceiling was widened. The Track E application/data-plane implementation remains in its lazy workspace chunk rather than becoming startup cost.

An earlier capture-replay attempt failed before opening HOPSCOTCH because Chrome DevTools never became reachable (`fetch failed`); the next unchanged semantic-head run passed capture replay normally.

## Closeout boundary

Track E is complete only when the permanent contracts, full repository checks, production performance budgets, Chrome default/disabled/SwiftShader, Firefox semantic compatibility, and captured-replay browser gate pass on the exact final PR head.

Deeper redistribution and routing policy belong to Track F. Overlay/service-provider protocols belong to Track G.

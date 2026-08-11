# Lab 07H — Network partition and terminal unreachable state

Lab 07H adds a deterministic `partition` GOD MODE modifier that can end a Journey honestly instead of forcing every failure story to recover.

## Terminal causal story

After response-path activity has begun—or after the latest earlier response modifier has completed—the teaching topology loses both destination-facing routed exits:

1. R1 → CORE and R2 → CORE fail across the partition
2. installed forwarding is no longer usable
3. SPF/recomputation runs with zero surviving route candidates
4. route state becomes `unreachable` and active path becomes `none`
5. the established TCP or QUIC state becomes `stalled`
6. the Journey ends with `journey.failed` / `network-unreachable`

The successful tail is removed. No `response.ready`, `transfer.complete`, or `journey.complete` remains after terminalization.

## Transport boundary

Partition is a routing/reachability truth, not an immediate transport close.

- TCP may still have an established connection object, but no bytes can make IP progress.
- QUIC may still have valid 1-RTT state, but a PTO/path probe cannot manufacture a missing IP route.
- HOPSCOTCH therefore models transport as `stalled`, not automatically `closed`.
- The terminal story does not invent duplicate ACKs, successful retransmission, RTO/PTO recovery, a successful path probe, or a third route.

The transport scene preserves retained protocol state without implying forward delivery: TCP explicitly reads `NO IP PROGRESS`, while QUIC may still show its retained `1-RTT` crypto level alongside the separate no-route stall panel.

Rewinding the global time machine reconstructs the earlier DNS, TLS, HTTP, and transport history normally.

## Routing state

Partition route metrics make the terminal state inspectable:

- failed links: `r1-core`, `r2-core`
- active path: `none`
- candidate route count: `0`
- recovery available: `false`
- primary cost: `22`
- alternate cost: `52`

Recomputation still occurs even though it cannot install a route. "SPF ran" and "a route exists" are intentionally separate facts.

## Modifier order

Canonical order is now:

`DNS FAIL → ROUTE → SERVER → LOSS → OUTAGE → LATENCY → CONGESTION → PARTITION`

PARTITION is terminal and therefore runs last. Earlier recoverable modifiers may complete before the later partition removes all remaining reachability. `ROUTE` and `OUTAGE` remain mutually exclusive with each other, but either can precede PARTITION.

## UI

The Journey adds a ninth `PARTITION` GOD MODE control. The routing scene can show both branches failed with `ACTIVE PATH = NONE`, the transport scene shows `STALLED · NO IP ROUTE`, and the terminal application scene shows `NO ROUTE / NETWORK UNREACHABLE` with zero route candidates.

At mobile widths the nine modifier controls form a 3×3 grid.

## Validation

The permanent `journey-partition-contract-check.mjs` contract verifies dual-link failure, zero-route SPF state, terminal event ordering, stalled-not-closed TCP/QUIC state, removal of the successful Journey tail, absence of fabricated recovery semantics, composition after prior recoverable modifiers, schema-v1/v2 portability, and browser persistence.

Exact production-artifact desktop/mobile/reduced-motion inspection remains the final completion gate for this slice.

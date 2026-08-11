# Lab 07E — Congestion and queue growth

Lab 07E adds a deterministic `congestion` GOD MODE modifier that models an ECN-capable bottleneck without collapsing congestion into generic latency or packet loss.

## Causal story

1. offered load rises above a 100 Mb/s teaching bottleneck
2. queue occupancy and queueing delay increase
3. delivered packets receive ECN CE marks before a drop is required
4. TCP reports congestion through ECE/CWR semantics; QUIC reports CE-counter growth through ACK_ECN
5. the teaching congestion window falls from 12 to 6 packets
6. offered load drops below the bottleneck service rate and the queue drains

The base congestion modifier intentionally emits no `transport.loss`, `transport.loss-detected`, or `transport.retransmit` event. `LOSS` remains the packet-loss story; `LATENCY` remains delay without an explicit congestion-control signal; `OUTAGE` remains routing failure under an established transport connection.

## State boundary

RTT/timer estimator facts remain in `transportMetrics`. Queue and congestion-control facts are separate `congestionMetrics`:

- bottleneck and offered rates
- queue capacity and occupancy
- queueing delay
- ECN CE count
- congestion window
- slow-start threshold where applicable
- congestion feedback signal
- dropped-packet count

This prevents UI animation or a high RTT sample from becoming an implicit congestion declaration.

## Transport branches

### TCP + HTTP/2

The receiver echoes congestion with ECE; the sender reduces cwnd/ssthresh and acknowledges the response with CWR. The TCP sequence space remains contiguous and no retransmission occurs.

### QUIC + HTTP/3

The receiver reports increased CE counters in ACK_ECN. The sender validates the ECN feedback and reduces its congestion window. There is no packet-number gap, PTO recovery, or STREAM retransmission.

## Composition

Canonical modifier order is now:

`ROUTE → LOSS → OUTAGE → LATENCY → CONGESTION`

`ROUTE` and `OUTAGE` remain mutually exclusive on the current two-path teaching topology. Congestion composes as a later deterministic episode after transport recovery/latency normalization, so UI selection order cannot change causal order.

## Validation

The permanent `journey-congestion-contract-check.mjs` contract verifies queue growth before ECN, cwnd reduction after feedback, queue drain after sender backoff, zero dropped packets, absence of loss/retransmission events, TCP/QUIC protocol-specific feedback, canonical composition, schema-v1 single-modifier portability, schema-v2 composed portability, and browser persistence.

Exact production-artifact desktop/mobile/reduced-motion inspection is the final completion gate for this slice.

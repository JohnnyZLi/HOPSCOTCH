# Lab 07G — Server service unavailable and safe retry

Lab 07G adds a deterministic `server-failure` GOD MODE modifier for an HTTP-layer availability failure while DNS, routing, transport, and TLS remain healthy.

## Causal story

The canonical successful Journey is interrupted after `GET /` has already crossed an established TCP/H2 or QUIC/H3 connection:

1. the application service becomes temporarily unavailable
2. the reachable HTTP server returns `503 Service Unavailable` with `Retry-After: 1`
3. the teaching client waits the explicit retry interval on the existing connection
4. the service becomes ready again
5. exactly one second after the 503, the canonical GET is retried
6. the original successful response headers/data resume on the same transport/TLS state

The retry episode adds a deterministic 1.7 s shift to the successful response and all later response-path events.

## Failure boundary

This slice intentionally distinguishes HTTP application availability from other failure classes:

- DNS remains resolved/cached
- the installed route remains usable
- the TCP or QUIC connection remains established
- TLS application keys remain active
- there is no new handshake
- there is no packet-loss detection, retransmission, RTO, or PTO

A 503 is a **real HTTP response**, unlike DNS timeout silence. The endpoint is reachable enough to return a status code and retry guidance.

## Retry safety

The canonical request is `GET /`. The server metrics explicitly record:

- method `GET`
- `idempotent: true`
- `retrySafe: true`
- `transportReused: true`
- `Retry-After: 1000 ms`

HOPSCOTCH does not generalize this teaching retry to arbitrary requests. Non-idempotent writes must not be assumed safe to replay automatically.

## Modifier order

Canonical order is now:

`DNS FAIL → ROUTE → SERVER → LOSS → OUTAGE → LATENCY → CONGESTION`

SERVER runs after the request but before the successful response. That lets later response-path modifiers act on the retried successful response without duplicating the base Journey. `ROUTE` and `OUTAGE` remain mutually exclusive on the current teaching topology.

## UI

The Journey adds an eighth `SERVER` GOD MODE control and an application-layer panel that exposes service state, HTTP status, Retry-After, method/idempotency, connection reuse, and TLS continuity. At mobile widths the eight modifier controls form a 4×2 grid.

## Validation

The permanent `journey-server-failure-contract-check.mjs` contract verifies request → unavailable → 503 → retry wait → ready → GET retry → successful response ordering, exact Retry-After timing, response shifting, connection/TLS reuse, absence of extra transport recovery semantics, safe-retry metrics, canonical composition, schema-v1/v2 portability, and browser persistence.

Exact production-artifact desktop/mobile/reduced-motion inspection remains the final completion gate for this slice.

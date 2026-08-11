# Lab 07F — DNS failure and retry path

Lab 07F adds a deterministic `dns-failure` GOD MODE modifier that keeps DNS timeout semantics separate from DNS answers, routing failure, and transport loss.

## Cache-miss path

The canonical cache-miss story becomes:

1. stub cache miss
2. recursive A query to the primary recursive resolver
3. no response before the teaching timeout
4. retry of the same logical question through a secondary recursive resolver using a new transaction context
5. normal root → TLD → authoritative authority walk
6. cache insertion and the rest of the Journey

The retry episode adds a deterministic 1.2 s penalty to downstream events. A timeout is modeled as **absence of a response**. HOPSCOTCH does not turn resolver silence into NXDOMAIN or SERVFAIL, because neither DNS response was received.

## Cache-hit path

A cache hit deliberately behaves differently. The local cached answer already satisfies the hostname, so the selected simulated upstream outage is shown as **masked by cache**.

No upstream DNS query is generated. Therefore no timeout packet, retry, secondary resolver delay, or 1.2 s penalty is invented. The cached TTL continues to age normally.

This keeps the existing DNS axis meaningful under failure instead of silently forcing every DNS-failure scenario into cache-miss mode.

## State boundary

DNS state can now expose:

- `timeout` — the primary recursive attempt has not produced a response
- `retrying` — the stub has moved the logical lookup to the secondary recursive path
- `cached` + `dns-masked` impairment phase — the upstream outage exists in the simulated environment but the local answer avoids it

The timeout/retry impairment phase normalizes once the authority walk resumes. The masked phase normalizes when the Journey moves into routing.

## Modifier order

Canonical order is now:

`DNS FAIL → ROUTE → LOSS → OUTAGE → LATENCY → CONGESTION`

A cache-miss DNS retry shifts later route/transport modifiers naturally. A cache-hit masked outage adds no timing penalty. `ROUTE` and `OUTAGE` remain mutually exclusive on the current two-path teaching topology.

## UI

The Journey adds a seventh `DNS FAIL` GOD MODE control, a dedicated DNS failure/masked visual language, timeout and secondary-retry banners, and rail/scrubber markers. Cache-hit masking explicitly displays `NO QUERY · NO TIMEOUT · NO RETRY`.

## Validation

The permanent `journey-dns-failure-contract-check.mjs` contract verifies query → timeout → retry → root ordering, deterministic downstream delay, unresolved timeout state, retrying state, normalization when referrals resume, cache-hit shielding with zero fabricated upstream traffic, zero transport-loss semantics, canonical composition, schema-v1/v2 portability, and browser persistence.

The exact GitHub Actions production artifact was exercised in Linux Chromium at desktop, 390 px mobile, and reduced motion. Timeout, retry, cache-hit masking, seven-control layout, overflow, viewport stability, and runtime-error assertions all passed.

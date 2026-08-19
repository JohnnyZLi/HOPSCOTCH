# Track I — Native companion integration

Track I turns HOPSCOTCH's already-shipped Network Diagnostics report/loopback bridge into a provenance-aware local-to-public investigation surface.

The central rule is:

> **local measurements may be correlated with independent public evidence, but correlation never turns those sources into one observed end-to-end path.**

Track I does not create a second measurement store, add a local command-execution API, or broaden Network Diagnostics permissions. It consumes the existing strict native-measurement/report-v2 pipeline and derives a separate correlation camera from accepted facts.

## Existing canonical measurement boundary

Before Track I, HOPSCOTCH already had:

- `hopscotch.native-measurement` schema v1,
- `LOCAL MEASURED` provenance enforced on every accepted native fact,
- bounded `local-host` scope with `globalComplete: false`,
- categories for interface, route, DNS, ICMP, traceroute, transport, and packet-capture evidence,
- a measured-state projection/store,
- Network Diagnostics report-v2 ingestion,
- an optional explicit loopback-only bridge at a fixed report endpoint.

The report-v2 adapter already maps the Track I local domains:

- selected/deep local interface state, disclosed addresses, MTU, link speed, gateways, and DNS servers,
- local route-table entries, default-route flags, metrics, egress interfaces, and disclosed gateways,
- resolver attempts/timing and service DNS timing,
- ICMP probe counts/loss/latency,
- traceroute destination state, disclosed responding hop addresses/hostnames, and RTT samples,
- bounded TCP/TLS/application-service timing, throughput, loaded latency, and other transport observations exposed by Network Diagnostics.

Track I therefore does **not** require a Network-Diagnostics-Suite protocol change. The established `report-v2` capability is the native companion contract for this track.

## Local companion security boundary

`src/measurement/loopbackBridge.ts` remains intentionally narrow:

- origin must be `localhost`, `127.0.0.0/8`, or `::1`,
- HTTP(S) only,
- no URL credentials,
- no arbitrary path/query/fragment,
- one explicit handshake action,
- one separate explicit report refresh action,
- `credentials: 'omit'`,
- fixed report-v2 endpoint and schema validation,
- no background polling,
- no LAN scanning/discovery,
- no arbitrary native command execution.

Track I does not change any of those constraints.

## Native/public correlation model

`src/measurement/nativeCorrelation.ts` is a pure derived projection over:

1. the existing `MeasuredSnapshotState`,
2. the existing `InternetEvidenceSnapshot`,
3. optional existing PeeringDB `PublicInfrastructureSnapshot` context.

It does not write back into the measured store or public evidence objects.

The projection emits an ordered evidence lane:

1. **LOCAL HOST — `LOCAL MEASURED`**
2. **DEFAULT GATEWAY — `LOCAL MEASURED`** when disclosed
3. **MEASURED HOPS — `LOCAL MEASURED`** for responding traceroute addresses
4. **OBSERVATION BOUNDARY — `INFERRED`**
5. **EDGE OBSERVATION — `EDGE OBSERVED`**
6. **PUBLIC ROUTING — `PUBLIC COLLECTOR`**
7. **PUBLIC FACILITY CONTEXT — `PUBLIC DATA`** where PeeringDB has facilities in the same observed edge city
8. **DESTINATION — `INFERRED`** from the existing Internet-evidence destination resolver

The observation-boundary stage is mandatory. It states that local traceroute ends before independently observed edge/public context begins. HOPSCOTCH never draws the public stages as if the local traceroute directly observed them.

### Conservative local extraction

Track I derives only facts that the existing adapter already emitted:

- source address from the selected interface or a disclosed interface unicast address,
- default gateway by pairing an explicitly default route with its disclosed gateway, with interface gateway data as a bounded fallback,
- DNS servers from disclosed interface DNS-server facts,
- traceroute hops only from explicit `traceroute hop N address` observations,
- a hostname target only from an existing hostname/service target.

If the measurement does not contain a hostname target, the public-correlation action is disabled. HOPSCOTCH does not guess a destination.

## Public evidence

Public context is fetched only after the user explicitly selects **CORRELATE PUBLIC CONTEXT**.

Track I reuses existing HOPSCOTCH Worker APIs:

- `/api/internet/snapshot?host=...` for Cloudflare edge observation, DNS-derived destination context, RIPE prefix/origin data, and RIS collector paths,
- `/api/internet/infrastructure` for PeeringDB public facility context.

No new third-party data pipeline is introduced.

The public request is not a continuation of the local measurement. Each returned object retains its original provenance.

### Facility context is not path evidence

When a PeeringDB facility shares the city/country of the independently observed Cloudflare edge, Track I may show it as **PUBLIC FACILITY CONTEXT**.

That relationship is deliberately weak. The UI and permanent contract state that geographic co-location is context only and **not evidence that the measured traffic traversed that facility**.

Likewise, measured traceroute hop addresses are never silently decorated with an AS number, facility, or geographic location from unrelated public data.

## Product surface

`MeasuredNativeCorrelationPanel` is loaded through `React.lazy` from the existing measured workspace after a valid local measurement is present.

It provides:

- one cross-category local summary for interface / route / DNS / ICMP / traceroute / transport facts,
- disclosed source, default gateway, DNS servers, and measured hostname target,
- explicit public-correlation and clear-public actions,
- an ordered local → gateway → measured hops → observation boundary → edge/public context → destination lane,
- a provenance badge on every stage,
- explicit no-credentials / no-scanning / no-hidden-polling copy.

Public data is not fetched by `useEffect`, timers, or bridge connection. Loading public context always requires a separate explicit action.

## Permanent contract

`npm run test:native-companion-track-i-contract` is part of `npm run check`.

It covers:

- all six required local Track I measurement domains remain surfaced,
- selected source address, default gateway, DNS servers, and ordered traceroute-hop extraction,
- hostname target selection from measured evidence,
- exact provenance for local, boundary, edge, public-routing, facility, and destination stages,
- measured hops do not inherit AS/facility claims from independent public evidence,
- same-city PeeringDB facilities are labeled context rather than traversal proof,
- no-public state remains explicit,
- the bridge remains loopback-only, credential-free, and report-v2-only,
- the correlation UI remains lazy,
- public correlation is an explicit action rather than an automatic effect,
- no credentials, LAN scanning/discovery, or hidden polling is introduced.

Every pre-existing measurement, Builder, Journey, capture, compatibility, and performance contract remains part of the merge gate.

## Closeout boundary

Track I is complete when:

- all four roadmap items are recorded complete,
- full `npm run check` passes on the final head,
- production performance remains inside existing ceilings,
- Chrome default / disabled-GPU / SwiftShader compatibility is green,
- Firefox semantic compatibility is green,
- real PCAP/PCAPNG replay remains green,
- the final diff contains no integration patcher/workflow changes,
- Track J is promoted to the active priority.

Track J owns deterministic troubleshooting challenges. Track I does not introduce challenge-only measurement shortcuts or change the simulation truth model.

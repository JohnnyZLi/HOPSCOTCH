# Lab 09A — Native measurement provenance contract

Lab 09A defines what a future native/local measurement source is allowed to claim before HOPSCOTCH connects any daemon, privileged collector, local bridge, or Network Diagnostics feed.

## Why this comes before integration

A browser cannot legitimately observe the local route table, interface configuration, ICMP/traceroute behavior, richer transport telemetry, or packet captures. A native source eventually can. That does **not** make native data globally authoritative.

The architectural risk is provenance laundering: a fact measured on one host at one instant could otherwise be presented as simulated Journey truth, inferred Internet topology, public collector evidence, or a claim about the global forwarding path.

09A blocks that at the schema boundary.

## Provenance vocabulary

The existing evidence vocabulary remains distinct:

- `EDGE OBSERVED` — browser/edge-visible observation
- `PUBLIC COLLECTOR` — observation from a public routing collector
- `PUBLIC DATA` — source-attributed public datasets such as PeeringDB
- `INFERRED` — a derived bridge or visualization, not direct observation
- `SIMULATED` — deterministic teaching/model state
- `LOCAL MEASURED` — a fact measured by a declared native adapter from the local host vantage

`LOCAL MEASURED` is added to the existing evidence provenance type; it does not replace or subsume the others.

## Schema v1

A valid `hopscotch.native-measurement` v1 snapshot contains:

- `provenance = LOCAL MEASURED`
- source adapter name/version
- source platform
- measurement tool name/version
- capture start/completion timestamps
- generated-at timestamp
- `vantage = local-host`
- `completeness = bounded`
- `globalComplete = false`
- explicit nullable target scope
- at least one explicit limitation string
- zero or more typed facts
- warnings

The supported fact categories establish the future native boundary without claiming those collectors exist yet:

- interface
- route
- DNS
- ICMP
- traceroute
- transport
- packet-capture

Each fact has its own ID, `LOCAL MEASURED` provenance, category, subject, availability, observation timestamp, explicit nullable target, value, optional unit, and note.

## Deliberately narrow fact values

Measured fact values may only be:

- string
- finite number
- boolean
- string list
- null

Arbitrary nested objects are rejected. This is intentional: a future adapter cannot stuff a Journey event list, modifier state, inferred graph, or other canonical model object into a field and have it cross the measurement boundary as measured truth.

Structured native data should be represented as multiple individually scoped facts or introduced later through a deliberately versioned typed schema.

## Scope and time invariants

A native snapshot is authoritative only inside its declared scope:

- one local-host vantage
- one capture interval
- one adapter/tool identity
- an explicit target where applicable
- declared limitations

Every fact timestamp must fall inside the capture interval. `generatedAt` must not precede capture completion. Capture completion may not precede capture start.

The schema cannot claim global completeness: `globalComplete` is literally typed and validated as `false`.

## Availability and metric rules

- `available`, `partial`, and `unavailable` reuse the existing evidence availability vocabulary.
- unavailable facts must have a null value.
- a non-null unit requires a numeric value.
- supported scalar units are milliseconds, bytes, bits per second, percent, count, and hops.
- percent is bounded to 0–100.
- time/size/rate/count/hop metrics must be non-negative.

## Fail-closed validation

The permanent contract rejects:

- wrong schema/version/provenance
- simulated or inferred provenance inside measured facts
- non-local vantage claims
- non-bounded/global-complete scope
- empty limitations
- missing adapter/tool identity
- reversed capture intervals
- generated timestamps before capture completion
- fact timestamps outside capture
- duplicate fact IDs
- unsupported categories/units
- units attached to non-numeric values
- negative bounded scalar metrics
- unavailable facts carrying values
- arbitrary structured values containing Journey/modifier state
- unsupported top-level fields such as embedded `journey`

## Current integration boundary

Lab 09A does **not** add:

- a native daemon or executable
- privileged command execution
- a localhost HTTP/WebSocket/socket bridge
- automatic discovery of Network Diagnostics Suite
- measured-mode UI
- projection of measured facts into Journey scenes
- packet capture or traceroute collection

Those are later slices. 09A only defines and permanently tests the trust boundary they must obey.

## Validation state

The permanent source contract is wired into `npm run check` and has already passed the full existing TypeScript, model-contract, regression, and production-build gate. Shared ARCHITECTURE/README synchronization is applied only after that source gate. A final hygiene repair restores ROADMAP from authoritative `main` and flips only the native-provenance checkbox, preventing unrelated roadmap history from changing in this PR. Final completion still requires normal clean-tree CI, Performance, and Compatibility to remain green.

# Lab 09B — Measured state stays separate from Journey truth

Lab 09B defines how HOPSCOTCH may hold and inspect a validated `LOCAL MEASURED` snapshot without allowing measured observations to become simulated Journey configuration, events, modifiers, or reducer state.

## Boundary

09A answers: **what may a native adapter say?**

09B answers: **what may HOPSCOTCH do with that validated observation once it arrives?**

The answer remains deliberately narrow. A measured snapshot is projected into its own `hopscotch.measured-state` semantic object. It does not enter the Journey modifier pipeline, event log, reducer, scenario schema, or timeline.

## Projection model

`projectMeasuredSnapshot()` accepts unknown input and begins by running the complete 09A `hopscotch.native-measurement` parser. Invalid provenance, scope, time, value, or embedded model state therefore fails before measured state exists.

A valid projection preserves:

- `LOCAL MEASURED` provenance
- adapter/tool/platform identity
- capture start/completion timestamps
- local-host/bounded/global-incomplete scope
- snapshot and per-fact targets
- limitations and warnings
- fact availability and values exactly as measured

It adds only deterministic inspection structures:

- a snapshot-scoped measurement key
- fact lookup by ID
- ordered fact IDs by measurement category
- available / partial / unavailable counts
- latest observation timestamp

No missing observation is synthesized from simulation, public evidence, or inference.

## No global merged measurement view

One projected snapshot is one measured-state object. Selectors operate on that object only.

Snapshots for different targets retain different measurement keys and separate fact indexes. Lab 09B intentionally provides no helper that merges target-specific snapshots into a supposed global Internet view.

An `ActiveMeasuredStateStore` can replace the currently inspected snapshot, but the store contains only measured state. Replacing it cannot alter any Journey object because the measured-state module has no Journey import or Journey-typed API.

## Deterministic freshness

Freshness is presentation metadata about capture age, not network truth.

`measuredFreshnessAt()` therefore requires an explicit `now` argument. The model never calls `Date.now()`.

The default display policy is:

- `fresh`: capture completed no more than 60 seconds ago
- `aging`: older than 60 seconds but less than 5 minutes
- `stale`: at least 5 minutes old
- `clock-skew`: explicit evaluation time precedes capture completion

Callers may supply an explicit alternative threshold policy. Changing those thresholds cannot change the measured facts themselves.

## Separation contract

The permanent Lab 09B contract proves:

- projection does not mutate or alias the input snapshot
- measured state has its own schema/type identity
- 09A rejects embedded Journey state at the measured-state entry point
- the measured-state source imports no Journey module and exposes no Journey event/scenario/modifier/state types
- fact/category/target indexes are deterministic
- partial and unavailable observations remain partial/unavailable
- two target-specific snapshots remain separate
- replacing the active measured snapshot replaces measured observations only
- a composed QUIC Journey is deep- and byte-identical before and after measured-state projection/replacement
- Journey reducer state at the same timestamp is identical before and after measured-state work
- freshness classification is deterministic from explicit time

## Still not implemented

Lab 09B does **not** add:

- a native daemon or collector
- privileged command execution
- localhost HTTP/WebSocket/socket transport
- Network Diagnostics Suite ingestion
- measured-mode React UI
- measured facts rendered onto Journey scenes
- reconciliation with public/inferred evidence

Those later integrations must consume this boundary rather than bypass it.

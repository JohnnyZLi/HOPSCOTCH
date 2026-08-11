# Lab 09D — Measured report workspace

Lab 09D turns the native-measurement architecture from a model-only path into an explicit user-facing lab without weakening any of the provenance boundaries established in 09A–09C.

A user may select a Network Diagnostics Suite v2 JSON report from local disk and inspect the validated `LOCAL MEASURED` facts in HOPSCOTCH. The file is not uploaded, persisted, polled, or inserted into the simulated Journey timeline.

## Product boundary

The main URL Journey remains HOPSCOTCH's primary action. `Inspect measured report` is a secondary lab entry.

Inside Lab 09 the interface states the boundary continuously:

- `LOCAL MEASURED`
- `LOCAL HOST`
- `BOUNDED`
- `NOT GLOBAL`
- `SESSION ONLY`
- `NOT STORED · NOT UPLOADED`

This is not a cosmetic label. The workspace source contract rejects browser persistence/upload APIs and Journey-model coupling.

## Import path

The UI does not contain its own diagnostic parser.

```text
explicit local .json selection
          ↓
       file.text()
          ↓
       JSON.parse
          ↓
ingestNetworkDiagnosticsReportV2()
          ↓
       Lab 09C whitelist
          ↓
  Lab 09A native validation
          ↓
  Lab 09B measured projection
          ↓
MeasuredNetworkWorkspace state
```

Only a successful 09C ingestion replaces the active measured workspace state.

An invalid replacement therefore fails closed while the previous valid report remains visible. The UI explicitly says that the previous report is still active.

## Session-only privacy

Imported report bytes and projected facts live only in React component memory.

Lab 09D intentionally does not use:

- `localStorage`
- `sessionStorage`
- `fetch()`
- `XMLHttpRequest`
- `WebSocket`
- `navigator.sendBeacon`
- `FormData` upload

Unmounting the workspace or pressing Clear drops the imported projection. The current 10 MB file-size ceiling bounds accidental large browser imports before reading/parsing.

Local addresses appear only if Lab 09C admitted them under the source report's disclosure flags. Lab 09D has no alternate path around those privacy rules.

## Workspace information architecture

The measured lab is intentionally not a dense generic dashboard.

### Capture strip

A compact summary shows:

- `LOCAL MEASURED` provenance
- source tool / platform / adapter version
- local file name
- total fact count and availability breakdown
- capture freshness/age
- capture completion time

Freshness uses the deterministic 09B helper. The React layer supplies the display clock explicitly and refreshes that presentation timestamp while a report is open; it does not mutate measured facts.

### Measured-domain rail

Seven native measurement categories remain separate:

- Interface
- Routing
- DNS
- ICMP
- Trace
- Transport
- Packet capture

Each domain displays a fact count. Empty domains say that this report did not supply a whitelisted measurement and HOPSCOTCH will not fill the gap from simulation.

### Target-aware facts

Facts inside the selected domain are grouped by their explicit target scope. When a domain has multiple targets, a compact target selector shows one target group at a time rather than rendering every target as one long ledger.

Examples include:

- interface target
- route prefix target
- resolver IP target
- traceroute hostname target
- service target
- remote IP target
- deliberately untargeted facts

There is no selector or renderer that concatenates those groups into an alleged observed end-to-end path. The rail explicitly states `NO CROSS-TARGET MERGE`.

### Provenance panel

The side panel keeps:

- local-host vantage
- bounded completeness
- `globalComplete = false`
- multi-target snapshot scope
- 09C limitations
- report sections deliberately not promoted to local measurement
- complete adapter warnings

This makes omission inspectable instead of silently hiding why a report field is absent.

## Human-readable values

The workspace formats validated scalar values without changing their underlying semantics:

- bits per second → bps / Kbps / Mbps / Gbps
- bytes → B / KB / MB / GB
- milliseconds → ms
- percentages → `%`
- hop counts → `hops`
- booleans → YES / NO
- string lists → dot-separated observed values

The 09C snapshot remains the source of truth. Formatting never feeds back into the measurement model.

## App integration

`App.tsx` now treats the measured workspace as `activeLab = measured`.

The global header reports:

- `LAB 09`
- `LOCAL MEASURED ACTIVE`

The overview exposes `Inspect measured report` after the primary URL Journey action. Exit uses the normal lab return behavior.

No measured state is stored in `App.tsx`; it stays owned by the Lab 09 component so leaving the lab also drops potentially sensitive imported data.

## Permanent source contract

`test:measured-workspace-contract` verifies:

- the UI uses `ingestNetworkDiagnosticsReportV2()`
- freshness uses `measuredFreshnessAt()`
- import is an explicit JSON file input
- successful ingestion is the only measured-state replacement path
- Clear removes the active measured projection
- rejected replacement semantics are visible
- `LOCAL MEASURED · BOUNDED · NOT GLOBAL` remains visible
- `NOT STORED · NOT UPLOADED` remains visible
- cross-target merging is explicitly rejected
- empty categories refuse simulated fill-in
- the file-size cap remains present
- no browser persistence/upload/network API is introduced
- no Journey import/type coupling enters the workspace
- the main URL Journey remains the primary hero action

## Permanent production-artifact browser audit

Lab 09D extends the compatibility-only Chrome production profiler rather than inventing a second browser harness.

For desktop, mobile, and reduced-motion profiles the browser:

1. loads the exact built Vite artifact
2. opens `Inspect measured report`
3. attaches a real Network Diagnostics v2 JSON file to the actual hidden file input through CDP
4. waits for the real React import handler and 09C ingestion path
5. verifies source/provenance text, selects the explicit transfer target scope, and verifies the expected measured value
6. verifies intentionally excluded fixture marker values are absent from the measured workspace
7. attaches an invalid replacement report
8. verifies `IMPORT REJECTED` while the previous valid report remains active
9. presses Clear and verifies the workspace returns to the empty state
10. reimports the valid report
11. checks horizontal overflow, document scroll stability, category count, reduced motion, and runtime/console errors

Because these profiles are compatibility-only, they do not change Lab 08 performance budgets. They run under the permanent Chrome compatibility matrix, including default, SwiftShader, and WebGL-disabled process modes.

## Still not implemented

Lab 09D deliberately stops before automatic local connectivity.

Remaining native work includes:

- localhost transport/discovery or another explicit desktop handoff
- live refresh behavior
- automatic Network Diagnostics Suite discovery
- measured semantic overlays/reuse inside existing route/DNS/transport scenes beyond this dedicated workspace
- reconciliation views between local measurement and public/inferred evidence

Any later transport must feed the already validated 09C ingestion path rather than creating a second native truth channel.

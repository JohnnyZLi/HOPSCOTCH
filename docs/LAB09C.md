# Lab 09C — Network Diagnostics Suite report ingestion

Lab 09C gives HOPSCOTCH its first real native-data adapter. It consumes the existing Network Diagnostics Suite combined report-v2 shape and converts only defensible direct/local measurements into the `LOCAL MEASURED` contract established by Labs 09A and 09B.

This slice is report ingestion, not transport discovery. A caller can provide a parsed Network Diagnostics Suite v2 report object; HOPSCOTCH validates, adapts, and projects it. No localhost daemon/socket/HTTP bridge is connected yet.

## Upstream contract

The adapter targets the existing Network Diagnostics Suite sources rather than inventing a new export format:

- `contracts/report-v2.schema.json` — combined report `schemaVersion = 2.0`
- `src/report-compatibility.ts` — current report-v2 compatibility boundary
- `src/types/deep-probe.ts` — native/deep diagnostic report structures
- `src/types/diagnostics.ts` — measurement endpoint/context structures

Lab 09C deliberately accepts report v2 only. Legacy standalone deep-probe 1.x reports remain out of scope for this slice.

## Ingestion chain

```text
Network Diagnostics Suite report v2
              ↓
    narrow report-v2 validation
              ↓
    whitelisted field adapter
              ↓
 hopscotch.native-measurement v1
              ↓
     complete 09A parser
              ↓
     complete 09B projection
              ↓
    hopscotch.measured-state
```

There is no bypass from the external report into measured state. `adaptNetworkDiagnosticsReportV2()` returns a snapshot only after `parseNativeMeasurementSnapshot()` accepts it, and `ingestNetworkDiagnosticsReportV2()` then runs that snapshot through `projectMeasuredSnapshot()`.

## Multi-target scope

A combined diagnostic report can contain measurements for multiple targets at once: gateway, Internet ping target, traceroute destination, DNS resolvers, service endpoints, transfer endpoint, LAN throughput target, and IPv4/IPv6 probes.

Therefore:

- snapshot-level `scope.target` is intentionally `null`
- `scope.vantage = local-host`
- `scope.completeness = bounded`
- `scope.globalComplete = false`
- target scope is preserved on individual measured facts where the source provides it

HOPSCOTCH never turns one report into a claim about a single global forwarding path.

## Observation time

Report v2 provides run start/completion timestamps but not a distinct timestamp for every metric.

The adapter does not invent subtest times. Mapped facts use `run.completedAt` as their bounded `observedAt`, and the resulting snapshot contains an explicit limitation explaining that choice.

## Whitelisted measurements

The adapter currently maps known scalar/list values from these direct measurement families.

### Interface

- selected interface name/type/binding scope
- link speed, exactly converted from Mbps to bits per second
- deep-interface address-family support
- IPv4 MTU
- disclosed local address/gateway/DNS-server lists

### Local routing

- routing-details availability/status
- route address family
- default-route flag
- route metric
- egress interface
- disclosed destination prefix and gateway

Route metrics remain source/platform-specific. HOPSCOTCH does not pretend route metric values are directly comparable across operating systems.

### ICMP/ping

- sent / received / lost counts
- loss percentage
- minimum / maximum / mean / median / p95 latency
- jitter

When some but not all probes succeed, latency observations are marked `partial`. A zero-success run does not fabricate latency values.

### Traceroute

- configured maximum hops
- whether the source reports destination reached
- source-reported hop number
- per-hop destination flag
- individual non-null RTT samples
- disclosed hop address/hostname

Individual RTT samples remain individual facts because the 09A measured-value contract intentionally rejects arbitrary nested number arrays/objects. The adapter does not infer path symmetry or turn traceroute into global topology.

### DNS resolvers

- attempts / successful count
- minimum / median / p95 / maximum latency

Partial resolver success remains `partial`; zero-success resolvers do not acquire invented timing data.

### Service checks

- reachability
- DNS phase duration
- TCP connect duration
- TLS handshake duration
- TLS protocol
- negotiated application protocol

### Internet transfer

- idle-latency statistics
- download/upload throughput
- steady and peak throughput
- byte count
- duration
- stability percentage
- transfer-cap flag
- source qualification
- loaded-latency statistics/increase/grade
- total report data use

Mbps values are converted arithmetically to `bits-per-second`; HOPSCOTCH does not reinterpret or recalibrate the source test.

### Local-link transfer

- latency statistics
- download/upload throughput
- transferred bytes

### Dual stack

For IPv4 and IPv6 where present:

- destination-address availability
- ICMP availability/median
- TCP reachability/connect duration
- TLS reachability/handshake duration/protocol
- application protocol
- HTTP reachability/response duration/status
- preferred family
- NAT64 suspicion flag
- DNS resolution duration
- resolved address counts
- parallel-connect winner/difference

## Privacy boundary

The combined report has explicit local-address disclosure metadata. HOPSCOTCH treats it conservatively.

When local-address disclosure is not explicitly permitted, the adapter withholds:

- selected-interface source address
- interface unicast/gateway/DNS-server address lists
- local route destination prefixes
- route gateways
- gateway target address
- traceroute hop address/hostname
- DNS resolver address targets
- local-link target identity

Non-address measurement semantics remain available. For example, route address family/default/metric/interface and gateway RTT can still be inspected without exposing a local address.

## What is intentionally excluded

A Network Diagnostics report is broader than direct native measurements. These sections are not converted into `LOCAL MEASURED` facts:

- `browserEvidence` — browser/edge evidence has a different provenance
- `measurement.network` — edge/public network metadata is not local measurement truth
- `measurement.http3` — browser HTTP/3 evidence is not native measurement truth
- `findings` — derived conclusions/recommendations
- `loadLocalization` — derived localization conclusion
- `networkChange.publicNetworkBefore/After` — public network context
- `hostResources` — outside the current 09A network measurement categories
- `annotations` — user/report metadata
- arbitrary unknown report-v2 extension fields

Those sections may create adapter warnings explaining why they were skipped. They never enter the measured fact array.

## Missing data stays missing

Network Diagnostics report v2 intentionally has many optional sections. If a section was not captured, Lab 09C omits its facts.

It does not synthesize an `unavailable` fact merely because a field is absent. `unavailable` is preserved only when the source explicitly gives enough information to support that state.

## Validation contract

The permanent `test:network-diagnostics-ingestion-contract` uses a realistic combined v2 fixture populated with both valid local measurements and deliberately tempting excluded data.

It proves:

- adapter input is not mutated
- output passes the complete 09A parser
- ingestion output passes through the 09B measured-state model
- macOS/Linux platform normalization is deterministic
- snapshot-level scope remains multi-target and globally incomplete
- per-fact target scopes remain distinct
- known Mbps values convert exactly to bits per second
- partial/unavailable behavior stays source-grounded
- absent optional sections fabricate zero facts
- local-address privacy suppresses local prefixes/addresses/LAN target identity
- browser/public/derived/unknown marker values never appear in measured facts
- malformed schema/profile/method/timestamps/known numeric fields fail closed
- arbitrary nested raw report objects are never embedded as measured values
- the adapter source imports no Journey model
- the same composed Journey and reducer state remain byte/deep-equal before and after report ingestion

## Remaining native work

Lab 09C does not yet add:

- automatic discovery of Network Diagnostics Suite
- localhost HTTP/WebSocket/socket transport
- a native daemon/sidecar owned by HOPSCOTCH
- a measured-mode React workspace
- file-picker/import UX
- projection of measured facts into the existing semantic scenes
- reconciliation between local measurements and public/inferred evidence

Those later slices must consume the 09A → 09B → 09C chain rather than bypass it.

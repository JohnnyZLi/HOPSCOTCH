# Track H — captured evidence + replay

Track H promotes the first captured-data replay slice into a complete evidence-analysis track. The product still treats a user-selected capture as immutable local evidence rather than as a simulator input, topology discovery mechanism, or upload source.

`docs/TRACKT.md` remains the implementation record for the original PCAP/PCAPNG vertical slice. This document records the Track H closeout layers built on top of it.

## Truth boundary

The source boundary is unchanged:

```text
user-selected capture bytes
        ↓
bounded container + protocol parser
        ↓
immutable CAPTURED frames / fields / bytes
        ↓
deterministic indexes
        ↓
INFERRED evidence analysis
        ↓
read-only presentation / comparison
```

Track H adds two other explicit provenance domains without promoting either into capture truth:

- `IMPORTED EVIDENCE` — explicit user-selected traceroute, route-table, interface, or device-state snapshots from a strict sidecar JSON document.
- `PARSED CONFIG` — facts parsed from supported Cisco, Juniper, or FRR configuration text. Parsed configuration is not runtime state and is not proof that a device applied or reached that configuration.

When capture evidence is compared with a Journey counterfactual, the Journey column remains `SIMULATED`. A match is compatibility between two separate domains, not evidence that the simulated story happened on the captured network.

## TCP byte-stream reconstruction

`src/capture/analysis.ts` projects each capture-visible TCP direction into logical sequence space.

The reconstruction:

- derives sequence offsets from capture-visible TCP sequence numbers,
- retains the first observed bytes for each sequence-space interval with exact source frame offsets,
- never allocates or invents bytes for sequence-space holes,
- labels repeated fully covered ranges as retransmission observations,
- labels partial repeated ranges as overlaps,
- identifies late sequence-space fills as out-of-order observations,
- preserves explicit gaps with `INFERRED` uncertainty explaining that absence from the capture is not proof of network loss,
- surfaces mid-conversation, one-direction-only, truncated, and otherwise incomplete evidence states,
- provides bounded stream windows that resolve every rendered byte back to its exact captured frame.

The stream view therefore reconstructs what the capture contains, not an idealized TCP stream that silently repairs missing evidence.

## RTT / ACK-delay observations

RTT analysis is deliberately capture-vantage bounded.

For a TCP segment that consumes sequence space, Track H looks for a later capture-visible ACK in the reverse direction. TCP timestamp echo correlation is preferred when an exact visible timestamp echo exists. Otherwise, the earliest unambiguous cumulative ACK covering the sequence range is used.

A sample is excluded when a repeated overlapping transmission makes ACK attribution ambiguous before the candidate ACK. The result exposes individual observations plus p50/p95/min/max summaries, but every value remains `INFERRED` and carries uncertainty language. It is never promoted to hidden-path or global latency truth.

## Captured Protocol Theater

Captured Protocol Theater is a read-only projection over existing capture events. It can project capture-visible stages for:

- TCP SYN / SYN-ACK / observed establishment / stream activity / FIN or RST,
- TLS ClientHello / ServerHello when visible in a captured frame,
- DNS query / response,
- UDP datagrams,
- supported ICMP / ICMPv6 messages.

Every stage has one of four evidence states:

- `OBSERVED`
- `NOT_OBSERVED_IN_CAPTURE`
- `CAPTURE_STARTED_MID_CONVERSATION`
- `INSUFFICIENT_CAPTURE_EVIDENCE`

A missing handshake stage stays missing. Theater presentation does not synthesize a clean protocol story merely because a later captured frame would normally imply earlier work occurred.

## Aggregate traffic overview

The aggregate view derives bounded capture-visible traffic density, protocol groups, conversation counts, and endpoint participation from accepted frames.

It does **not** infer routers, sites, links, physical geography, or a network path. Endpoint aggregation is a view over transport endpoints present in captured frames, not topology discovery.

## Capture comparison

A second explicit local PCAP/PCAPNG can be loaded for deterministic comparison.

The comparison keeps each capture independent and reports:

- total frame / file-byte / conversation / semantic-event deltas,
- normalized conversation matches and left-only/right-only flows,
- per-matched-flow frame, byte, and visible-duration deltas,
- semantic event-kind deltas.

A delta means the evidence sets differ. Track H does not invent a causal explanation for why they differ.

## Captured ↔ simulated counterfactual

The comparison panel can also place one captured conversation beside a deterministic canonical Journey counterfactual. The first presets reuse the existing TCP/H2 clean, TCP/H2 single-loss, TCP/H2 latency, and QUIC/H3 clean Journey models.

The comparison never feeds captured bytes into the Journey reducer. Capture-visible transport, visible span, ACK-backed timing, and visible application metadata remain on the captured/inferred side; Journey outcomes remain `SIMULATED`.

UDP is not promoted to captured QUIC merely because a port number or encrypted payload could be compatible with QUIC.

## Imported runtime sidecars

Track H accepts a strict `hopscotch.capture-sidecar-evidence` version-1 JSON document with bounded snapshots for:

- traceroute hops and optional observed RTT samples,
- route-table rows,
- interface state / MTU / addresses / MAC facts,
- generic device-state key/value facts.

The parser bounds snapshot count, row count, and string size and rejects unsupported snapshot kinds. Sidecars are session-only and never merged into captured frames.

The current Track H view intentionally does not auto-correlate matching addresses into a topology. That would require a later evidence-correlation contract with explicit uncertainty rather than a convenience join.

## Parsed Cisco / Juniper / FRR configuration

`src/capture/evidence.ts` contains a bounded, vendor-selectable text parser for explicit supported statements.

The parser recognizes a deliberately small set of useful interface/address/static-route/OSPF/BGP/VLAN/policy/NAT/state facts from:

- Cisco-style configuration text,
- FRR-style configuration text,
- Juniper `set` configuration text.

The input is capped at 2 MiB, 20,000 source lines, and 10,000 parsed facts. Unrecognized lines are ignored rather than guessed. Every accepted fact is `PARSED CONFIG` and retains its source line number and raw line.

This is not broad vendor CLI/configuration emulation and it does not claim semantic equivalence between vendors.

## Worker-backed parsing and indexing

Primary browser ingest now uses `parseCaptureSessionAsync(...)`.

When browser Workers are available:

1. the selected `ArrayBuffer` is transferred to a dedicated module Worker,
2. container parsing, protocol decoding, conversation construction, semantic-event construction, and index construction run there,
3. immutable metadata is returned as structured data,
4. all raw frame bytes are packed into one transferred byte slab,
5. the main thread rehydrates immutable frame byte views and the canonical `CaptureSessionIndex`.

Node/non-Worker environments use the same synchronous canonical parser as a deterministic fallback for contracts and compatibility.

The worker does not change acceptance limits: 64 MiB capture, 100,000 frames, and the existing bounded parser ceilings remain authoritative.

## Product surface

The canonical `/capture` workspace keeps the original replay, conversation browser, event rail, time machine, exact lineage, and read-only Packet Microscope. A new **Capture Evidence Lab** beneath the primary replay adds five views:

1. Protocol Theater
2. TCP Stream + RTT
3. Traffic Overview
4. Compare
5. Sidecar Evidence

The selected replay conversation is the selected analysis conversation; there is no second capture truth model.

## Validation

The existing capture contracts remain intact. Track H adds permanent coverage for:

- stream holes, retransmission, overlap, out-of-order, and midstream states,
- exact stream-window source bytes,
- ACK-backed RTT and ambiguity exclusion,
- truthful Protocol Theater missing-evidence states,
- evidence-only aggregate accounting,
- capture comparison,
- worker wire round-trip parity and non-Worker fallback,
- strict sidecar parsing,
- Cisco/Juniper/FRR `PARSED CONFIG` provenance,
- captured-vs-`SIMULATED` comparison separation,
- the local-only Track H UI boundary.

The production capture browser profile still imports real generated PCAP/PCAPNG files into the exact built artifact. Because the Track H Evidence Lab is part of the loaded `/capture` DOM, that profile also exercises its default Protocol Theater projection under desktop/mobile/reduced-motion/runtime-error bounds.

## Closeout boundary

Track H is complete when the integrated contracts and production profiles are green and the active roadmap is updated.

Later evidence work can become new tracks/slices—for example richer PCAPNG/link-layer coverage, IP-fragment reconstruction, decrypted capture workflows with explicit user-supplied secrets, deeper cross-source correlation, or a generalized query engine—but those are not hidden Track H acceptance criteria.
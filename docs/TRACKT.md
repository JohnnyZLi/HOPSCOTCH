# Track T — captured-data replay first vertical slice

Track T turns a user-selected packet capture into a deterministic, evidence-first HOPSCOTCH workspace. It is deliberately not a packet table and it is not a simulator. The first slice supports this complete navigation path:

```text
capture
  → conversation
  → capture time
  → semantic event
  → source frame
  → protocol layer
  → decoded field
  → exact captured bytes
```

The implementation lives at the canonical `/capture` route and is discoverable under **Explore → Evidence → Capture replay**.

## Truth boundary

Captured replay has its own evidence pipeline:

```text
user-selected bytes
        ↓
bounded container parser
        ↓
immutable captured frames
        ↓
bounded protocol decoder
        ↓
deterministic indexes + interpretations
        ↓
capture-time semantic projection
        ↓
React / Motion / Anime.js presentation
```

The equivalent invariant is:

```text
same capture bytes + same capture timestamp = same semantic projection
```

Animation never appends a packet, recognizes a protocol event, changes an endpoint, or decides a transport outcome. Playback advances a requested capture timestamp; `CaptureSessionIndex.projectionAt(...)` reconstructs the meaning at that timestamp.

Track T uses two provenance values without changing any existing provenance meaning:

- `CAPTURED` — bytes and facts decoded directly from a captured frame
- `INFERRED` — deterministic interpretation over captured facts, such as normalized bidirectional grouping or an observed repeated sequence range

`CAPTURED` is not `SIMULATED` and is not `LOCAL MEASURED`. Imported bytes never enter the Journey reducer, Builder engine, native-measurement projection, or Cloudflare Worker.

## Local-only import

Import is an explicit file-input or drag/drop action. The browser reads `.pcap` and `.pcapng` bytes with `File.arrayBuffer()` and passes them directly to the internal parser.

The workspace does not:

- upload capture bytes
- call `fetch`, WebSocket, XMLHttpRequest, or `sendBeacon`
- scan, sniff, probe, or discover a network
- poll localhost
- request credentials
- write capture bytes or parsed frames to localStorage, sessionStorage, IndexedDB, or a server

Capture state exists only in the current React application session. `CLEAR` discards the active in-memory session. A malformed replacement is rejected without clearing the last valid capture.

## Parser and model modules

| Module | Responsibility |
| --- | --- |
| `src/capture/bytes.ts` | Owned immutable byte views, bounds-checked integer reads, defensive copies, controlled parse errors |
| `src/capture/container.ts` | Classic PCAP and bounded PCAPNG container parsing, timestamps, interfaces, frame records |
| `src/capture/protocol.ts` | Ethernet/IP/transport/application decoding with field byte ranges |
| `src/capture/session.ts` | Conversation/event construction, stable indexes, capture-time projection, evidence lineage |
| `src/capture/types.ts` | Capture evidence, provenance, limits, protocol facts, conversations, events, and lineage contracts |
| `src/CaptureReplayWorkspace.tsx` | Session-only import and the capture → conversation → event → frame → bytes workspace |
| `src/CapturedPacketMicroscope.tsx` | Read-only captured projection using Packet Microscope's visual language |

Binary parsing is not performed inside React components. The parser, decoder, indexes, timeline, and lineage contracts run under Node without a DOM.

## Supported capture containers

### Classic PCAP

The parser supports common PCAP 2.4 files with:

- little- and big-endian magic values
- microsecond and nanosecond timestamp formats
- global-header/version validation
- snapshot length and link-layer metadata
- packet record bounds
- captured and original wire length
- stable source-frame ordering
- original timestamp plus capture-relative nanoseconds

When captured length is smaller than original length, the frame is explicitly `truncated`. Missing bytes are never allocated or fabricated.

### PCAPNG

The first slice implements:

- Section Header Block
- Interface Description Block
- Enhanced Packet Block
- per-section byte order, including mixed-endian multi-section files
- multiple interfaces
- decimal and binary `if_tsresol`
- 32-bit packet/option padding
- interface-reference validation
- leading/trailing block-length validation
- safe skipping of length-valid unknown block types

Simple Packet Blocks are not decoded and produce an explicit capture warning. Other block types do not acquire semantics merely because their lengths are safe to skip.

### Link layer

Ethernet (`LINKTYPE_ETHERNET = 1`) is the only decoded link type in this slice. Unsupported link types retain raw frame bytes and produce an explicit unsupported layer; they are never guessed to be Ethernet.

## Protocol decoding

All decoded fields retain one or more frame-relative `{ offset, length }` byte ranges. A range is validated before it enters the evidence model.

Implemented decoding includes:

- Ethernet II source/destination MAC, EtherType, and payload boundary
- up to two 802.1Q/802.1ad VLAN tags
- IPv4 version/IHL, DSCP/ECN, total length, identification, flags/fragment offset, TTL, protocol, checksum field, addresses, and payload boundary
- IPv6 version, traffic class, flow label, payload length, next header, hop limit, addresses, and bounded extension-header traversal
- TCP ports, sequence/acknowledgment numbers, header offset, flags, advertised window, checksum field, urgent pointer, payload range, MSS, window scale, SACK-permitted, and timestamps
- UDP ports, declared length, checksum field, and bounded payload range
- common ICMP/ICMPv6 echo, destination-unreachable, time-exceeded, fragmentation-needed, and packet-too-big metadata
- DNS header flags, questions, common resource records, TTLs, and bounded compression-name decoding
- capture-visible TLS record, ClientHello, ServerHello, SNI, ALPN, supported-version, and cipher-suite metadata

The decoder does not claim checksum validity; it labels the checksum **field value observed in the capture**. Fragmented payloads are not reassembled. DNS-over-TCP decodes only the first complete length-prefixed message in one captured frame. TLS parsing is frame-local and performs no stream reassembly or decryption.

Unknown EtherTypes and IP protocol IDs remain captured but uninterpreted. Encrypted application payload, physical path, off-capture hops, and unseen packets remain unknown.

## Hostile-input boundary

All capture input is untrusted. The parser checks lengths before reads or views and rejects an over-limit input before making the defensive owned copy. Permanent negative fixtures cover truncated buffers, impossible lengths, broken PCAPNG blocks, invalid interfaces, malformed IPv4 IHL, malformed TCP offsets, cyclic/out-of-range DNS pointers, malformed TLS records, and unexpected protocol values.

Explicit first-slice ceilings are:

| Limit | Ceiling |
| --- | ---: |
| Capture file | 64 MiB |
| Frames | 100,000 |
| Semantic events | 500,000 |
| One captured frame | 16 MiB |
| One PCAPNG block | 32 MiB |
| PCAPNG blocks / interfaces | 250,000 / 4,096 |
| IPv6 extension headers / bytes | 16 / 2,048 |
| DNS questions / records / pointer depth | 128 / 256 / 32 |
| TLS records / handshake messages per frame | 64 / 128 |
| TLS extensions per hello | 256 |
| Disjoint TCP sequence intervals per direction | 4,096 |

Crossing a hard container, frame, or semantic-event ceiling rejects the import; packets are never silently dropped to make the capture fit. The TCP interval ceiling bounds overlap inference only: exact repeated ranges stay indexed, every frame stays available, and the session exposes a warning when the interval index saturates. A malformed protocol inside an otherwise valid container preserves the raw frame, stops that frame's unsafe decode path, and exposes a bounded decoder issue.

## Deterministic identities and indexes

The capture receives a deterministic full-byte fingerprint. Frame identities and source order are ordinal and stable for identical capture bytes. Conversations normalize endpoint A/B identity from address family, address, port, and transport while preserving every source frame's A→B or B→A direction.

`CaptureSessionIndex` builds stable indexes for:

- frame ID
- frame number
- conversation ID
- frame → conversation
- semantic event ID
- conversation → stable event array
- capture-time binary search

Conversation and event order uses explicit timestamp/source-order/ID comparison. It does not rely on React render order or incidental `Map` iteration.

Conversation summaries expose endpoint A/B, protocol, captured application metadata where supported, frame/byte counts, direction counts, first/last observation, duration, truncation, and evidence-backed observed initiator. Port number alone never determines client/server identity.

## Semantic captured events

The first slice recognizes direct captured events including:

- TCP SYN, SYN/ACK, ACK, DATA, FIN, and RST
- DNS query and response
- TLS ClientHello and ServerHello
- UDP datagram
- ICMP/ICMPv6 echo, unreachable, time-exceeded, packet-too-big, and other messages

It also emits separately `INFERRED` interpretations when captured facts support them:

- observed TCP establishment progression
- duplicate ACK observed
- observed retransmission of a previously seen directional sequence range
- overlapping sequence range
- capture-visible sequence gap

The wording is intentionally vantage-bounded. A gap is not automatically packet loss, a repeated ACK is not proof of loss, and a missing SYN can mean that capture started mid-conversation.

Every event contains a primary frame, all supporting frame IDs, and captured field references. No event exists without frame evidence.

## Capture time machine and FOLLOW FLOW

The earliest captured timestamp becomes `t=0`; original timestamp precision and representation remain attached to each frame. Equal timestamps are ordered by source frame order and stable event priority.

The workspace supports play/pause, reset, scrub, previous/next event, direct event selection, previous/next frame, and direct frame-number selection. Reduced motion changes choreography only.

The restrained **FOLLOW FLOW** mode keeps the selected conversation and current evidence frame in focus as deterministic capture time advances. It deemphasizes unrelated flow noise but never creates a packet or event. Manual selection, scrubbing, or pausing interrupts the presentation normally.

## Evidence lineage and Packet Microscope

`CaptureSessionIndex.lineage(eventId)` resolves:

```text
conversation
  → semantic event
  → supporting frame(s)
  → protocol layer
  → decoded field
  → exact captured byte range and hex bytes
```

The captured Packet Microscope is a distinct read-only projection. It reuses the encapsulation, field-list, and raw-byte visual language while removing family, transport, payload, TTL, and checksum mutation controls. The existing generated teaching Packet Microscope now explicitly identifies its frame as `SIMULATED`; captured mode identifies itself as `CAPTURED · READ ONLY`.

## Large-capture presentation

All accepted evidence remains indexed. Presentation work is bounded independently:

- at most 80 matching conversations render at once; filtering reaches later deterministic matches
- the event rail renders a 73-event window around current focus
- aggregate event density uses 96 fixed bins
- raw-byte inspectors render 256-byte pages
- the captured workspace is lazy-loaded from the main application bundle

The model is constructed once per successful import and retained in App session state. React playback reads stable indexed arrays and binary-search projections rather than rebuilding the capture on each frame.

## Validation

`npm run test:capture-contract` runs deterministic container, protocol, flow/timeline/provenance/lineage, and workspace-boundary contracts using synthetic documentation-address fixtures. No private traffic or large binary capture is committed.

The dedicated production browser check attaches real generated PCAP, PCAPNG, and malformed files to the built application. It covers desktop, exact 390 px mobile, reduced motion, valid/replacement/clear behavior, conversations, time controls, lineage, captured Packet Microscope, bounded DOM/bytes, deep linking, and runtime/console errors.

## Known limitations and next slice

This is a coherent first vertical slice, not completion of the Track T moonshot. It does not yet provide:

- TCP byte-stream or IP-fragment reassembly
- RTT measurement/correlation
- TLS decryption, certificate extraction beyond captured visible metadata, QUIC decryption, or hidden HTTP
- every PCAPNG block type or non-Ethernet link-layer decoder
- transaction-specific DNS sub-indexes beyond semantic events in the normalized transport conversation
- Protocol Theater projection of incomplete captured stories
- capture comparison or captured-vs-counterfactual branching
- semantic zoom from aggregate traffic weather to site/device topology
- worker-thread parsing or persistent user-controlled capture projects

The next logical slice is bounded TCP stream/RTT projection plus truthful captured Protocol Theater states (`NOT OBSERVED IN CAPTURE`, `CAPTURE STARTED MID-CONVERSATION`, `INSUFFICIENT CAPTURE EVIDENCE`), followed by capture comparison. None of those additions may rewrite the immutable source evidence.

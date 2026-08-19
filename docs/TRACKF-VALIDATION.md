# Track F — Final validation record

This file freezes the Track F merge candidate after the implementation, persistence contract, roadmap closeout, and performance-budget corrections are complete.

## Permanent acceptance boundary

The exact final PR head must pass all of the following without widening a product ceiling:

- `npm run check`, including `test:builder-routing-policy-contract`
- production performance enforcement
- Chrome default rendering/semantic compatibility
- Chrome with GPU disabled
- Chrome SwiftShader software rendering
- Firefox semantic compatibility
- real local PCAP and PCAPNG production replay

The permanent Track F contract includes a Builder scenario-v9 serialize/deserialize round trip for routing-policy configuration and BGP session timing, in addition to the protocol/forwarding invariants documented in `TRACKF.md`.

## Frozen performance architecture

Track F keeps advanced routing-policy, BGP, and OSPF depth UI behind lazy boundaries. The canonical routing and forwarding algorithms remain synchronous because probes, application transactions, diagnosis, and data-plane work all consume the same route/FIB truth.

The implementation does not increase the established JavaScript, CSS, DOM, heap, readiness, seek, or stress ceilings. The pre-freeze production profile passed at:

- initial JavaScript: 423,966 gzip bytes
- initial CSS: 34,912 gzip bytes
- stress Builder: 898 DOM nodes against the existing 900-node ceiling

These measurements are evidence from the implementation candidate, not permission to weaken the final exact-head gate.

## Merge rule

No temporary patch scripts or workflow modifications may appear in the PR diff. The PR may merge only after the exact frozen head is green, or after an unchanged rerun resolves a clearly identified pre-existing browser-runner startup/readiness flake.

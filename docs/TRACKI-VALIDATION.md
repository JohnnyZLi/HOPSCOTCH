# Track I — Merge gate

This file freezes the final validation boundary for Track I without changing runtime behavior.

The exact final PR head must pass:

- full `npm run check`, including `test:native-companion-track-i-contract`
- production performance with the existing 432,000-byte initial-JavaScript and 900-node stress-Builder ceilings unchanged
- Chrome default compatibility
- Chrome disabled-GPU compatibility
- Chrome SwiftShader compatibility
- Firefox semantic compatibility
- real local PCAP/PCAPNG capture replay
- final-diff hygiene with no integration patcher or workflow modification

The implementation candidate immediately before this documentation-only freeze measured:

- initial JavaScript: **431,779 / 432,000 gzip bytes**
- initial CSS: **34,912 gzip bytes**
- stress Builder: **896 / 900 DOM nodes**

Track I does not broaden the local companion protocol. The existing explicit report-v2 bridge remains loopback-only and credential-free; public context is a separate explicit browser action over HOPSCOTCH's existing Internet evidence APIs.

The GitHub Actions runs attached to the final PR head are authoritative for merge.

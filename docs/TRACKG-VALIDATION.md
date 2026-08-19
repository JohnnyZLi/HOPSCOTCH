# Track G — Merge gate

This file freezes the validation boundary for Track G without changing runtime behavior.

The merge candidate must satisfy all of the following on the exact same head:

- full `npm run check`, including `test:builder-provider-contract`
- production performance with the existing 432,000-byte initial-JavaScript and 900-node stress-Builder ceilings unchanged
- Chrome default compatibility
- Chrome disabled-GPU compatibility
- Chrome SwiftShader compatibility
- Firefox semantic compatibility
- real local PCAP/PCAPNG capture replay
- no temporary integration workflow, patcher, or trigger file in the final diff

Track G's provider workspace is closed by default inside the already-lazy routing-policy workspace. Unrelated OSPF/BGP inspection therefore does not mount tunnel/MPLS/VXLAN/EVPN projections or the full provider editor. Opening Track G mounts the complete provider workspace without changing canonical underlay, routing, or evidence truth.

The authoritative validation results are the GitHub Actions runs attached to the final PR head; this document deliberately does not duplicate transient run IDs or timing values.
